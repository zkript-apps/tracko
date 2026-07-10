import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { randomBytes } from 'crypto';
import { WorkforceContextService } from '../workforce/workforce-context.service';
import {
  BILLABLE_FEATURE_IDS,
  calculateMonthlyTotalPhp,
  getFeatureCatalogForTier,
  getFeatureById,
  isBillableFeatureId,
  ORGANIZATION_SCALE_TIERS,
  type BillableFeatureId,
} from './feature-catalog';
import {
  isOrganizationScaleTier,
} from './organization-scale';
import { OrganizationScaleService } from './organization-scale.service';
import { formatEffectiveDate, getChangeEffectiveDate } from './billing.util';
import {
  createOrganizationSubscription,
  findSubscriptionByOrganizationId,
  saveOrganizationSubscription,
  type OrganizationSubscription,
  type PendingScaleChange,
  type PendingSubscriptionChange,
} from './organization-subscriptions.store';

function createChangeId(): string {
  return randomBytes(8).toString('hex');
}

function applyDuePendingChanges(
  subscription: OrganizationSubscription,
  now = new Date(),
): OrganizationSubscription {
  const remaining: PendingSubscriptionChange[] = [];
  const activeFeatures = new Set(subscription.activeFeatures);

  for (const change of subscription.pendingChanges) {
    if (change.effectiveAt.getTime() > now.getTime()) {
      remaining.push(change);
      continue;
    }

    if (change.action === 'add') {
      activeFeatures.add(change.featureId);
    } else {
      activeFeatures.delete(change.featureId);
    }
  }

  let scaleTier = subscription.scaleTier;
  let pendingScaleChange = subscription.pendingScaleChange;

  if (
    pendingScaleChange &&
    pendingScaleChange.effectiveAt.getTime() <= now.getTime()
  ) {
    scaleTier = pendingScaleChange.scaleTier;
    pendingScaleChange = null;
  }

  return {
    ...subscription,
    scaleTier,
    activeFeatures: Array.from(activeFeatures),
    pendingChanges: remaining,
    pendingScaleChange,
  };
}

function subscriptionNeedsPersist(
  before: OrganizationSubscription,
  after: OrganizationSubscription,
): boolean {
  return (
    before.scaleTier !== after.scaleTier ||
    before.pendingScaleChange?.id !== after.pendingScaleChange?.id ||
    before.activeFeatures.length !== after.activeFeatures.length ||
    before.pendingChanges.length !== after.pendingChanges.length ||
    before.activeFeatures.some(
      (feature, index) => feature !== after.activeFeatures[index],
    )
  );
}

@Injectable()
export class BillingService {
  constructor(
    private readonly workforce: WorkforceContextService,
    private readonly organizationScale: OrganizationScaleService,
  ) {}

  async getOrCreateSubscription(
    organizationId: string,
  ): Promise<OrganizationSubscription> {
    const existing = await findSubscriptionByOrganizationId(organizationId);
    if (existing) {
      const { hasStoredScaleTier, ...subscription } = existing;
      let next = applyDuePendingChanges(subscription);

      if (!hasStoredScaleTier) {
        const scaleTier =
          await this.organizationScale.deriveScaleTierFromEmployeeCount(
            organizationId,
          );
        next = { ...next, scaleTier };
        return saveOrganizationSubscription(next);
      }

      if (subscriptionNeedsPersist(subscription, next)) {
        return saveOrganizationSubscription(next);
      }
      return next;
    }

    return createOrganizationSubscription({ organizationId });
  }

  async isFeatureEnabled(
    organizationId: string,
    featureId: BillableFeatureId,
  ): Promise<boolean> {
    const subscription = await this.getOrCreateSubscription(organizationId);
    return subscription.activeFeatures.includes(featureId);
  }

  async requireFeature(
    organizationId: string,
    featureId: BillableFeatureId,
    featureLabel: string,
  ): Promise<void> {
    const enabled = await this.isFeatureEnabled(organizationId, featureId);
    if (!enabled) {
      throw new ForbiddenException(
        `${featureLabel} is not enabled on your subscription. Add it from Subscription settings.`,
      );
    }
  }

  private async serializeSubscription(
    subscription: OrganizationSubscription,
    organizationId: string,
  ) {
    const employeeCount =
      await this.organizationScale.countEmployees(organizationId);
    const scaleTier = subscription.scaleTier;
    const scaleDefinition = ORGANIZATION_SCALE_TIERS.find(
      (tier) => tier.id === scaleTier,
    )!;
    const features = getFeatureCatalogForTier(scaleTier);
    const basePlan = features.find((feature) => feature.id === 'base');
    const effectiveAt = getChangeEffectiveDate();
    const pendingChanges = subscription.pendingChanges.map((change) => ({
      id: change.id,
      featureId: change.featureId,
      action: change.action,
      effectiveAt: change.effectiveAt.toISOString(),
      effectiveDateLabel: formatEffectiveDate(change.effectiveAt.toISOString()),
      requestedAt: change.requestedAt.toISOString(),
    }));
    const pendingScaleChange = subscription.pendingScaleChange
      ? {
          id: subscription.pendingScaleChange.id,
          scaleTier: subscription.pendingScaleChange.scaleTier,
          scaleTierLabel:
            ORGANIZATION_SCALE_TIERS.find(
              (tier) => tier.id === subscription.pendingScaleChange!.scaleTier,
            )?.label ?? subscription.pendingScaleChange.scaleTier,
          effectiveAt: subscription.pendingScaleChange.effectiveAt.toISOString(),
          effectiveDateLabel: formatEffectiveDate(
            subscription.pendingScaleChange.effectiveAt.toISOString(),
          ),
          requestedAt:
            subscription.pendingScaleChange.requestedAt.toISOString(),
        }
      : null;

    const projectedFeatures = new Set(subscription.activeFeatures);
    for (const change of subscription.pendingChanges) {
      if (change.action === 'add') {
        projectedFeatures.add(change.featureId);
      } else {
        projectedFeatures.delete(change.featureId);
      }
    }

    const projectedScaleTier =
      subscription.pendingScaleChange?.scaleTier ?? scaleTier;

    return {
      organizationId: subscription.organizationId,
      currency: subscription.currency,
      status: subscription.status,
      employeeCount,
      scaleTier,
      scaleTierLabel: scaleDefinition.label,
      scaleTierRange: scaleDefinition.employeeRange,
      scaleTiers: ORGANIZATION_SCALE_TIERS,
      basePlan,
      features,
      activeFeatures: subscription.activeFeatures,
      pendingChanges,
      pendingScaleChange,
      nextChangeEffectiveAt: effectiveAt.toISOString(),
      nextChangeEffectiveDateLabel: formatEffectiveDate(
        effectiveAt.toISOString(),
      ),
      currentMonthlyTotalPhp: calculateMonthlyTotalPhp(
        subscription.activeFeatures,
        scaleTier,
      ),
      projectedMonthlyTotalPhp: calculateMonthlyTotalPhp(
        Array.from(projectedFeatures),
        projectedScaleTier,
      ),
    };
  }

  async getSubscriptionForRequest(request: Request) {
    const context = await this.workforce.getMemberContext(request);
    if (!context.isAdmin && !context.isHr) {
      throw new ForbiddenException('Organization admin or HR access required.');
    }

    const subscription = await this.getOrCreateSubscription(
      context.organizationId,
    );
    return this.serializeSubscription(subscription, context.organizationId);
  }

  async scheduleFeatureChange(
    request: Request,
    featureId: string,
    action: 'add' | 'remove',
  ) {
    const context = await this.workforce.getMemberContext(request);
    if (!context.isAdmin) {
      throw new ForbiddenException('Organization admin access required.');
    }

    if (!isBillableFeatureId(featureId)) {
      throw new BadRequestException('Unknown subscription feature.');
    }

    const subscription = await this.getOrCreateSubscription(
      context.organizationId,
    );
    const feature = getFeatureById(featureId, subscription.scaleTier);
    if (!feature) {
      throw new BadRequestException('Unknown subscription feature.');
    }

    const effectiveAt = getChangeEffectiveDate();
    const isActive = subscription.activeFeatures.includes(featureId);
    const hasPending = subscription.pendingChanges.some(
      (change) => change.featureId === featureId,
    );

    if (action === 'add') {
      if (isActive) {
        throw new BadRequestException(`${feature.name} is already active.`);
      }
      if (hasPending) {
        throw new BadRequestException(
          `A change for ${feature.name} is already scheduled.`,
        );
      }
    } else if (!isActive) {
      throw new BadRequestException(`${feature.name} is not currently active.`);
    } else if (hasPending) {
      throw new BadRequestException(
        `A change for ${feature.name} is already scheduled.`,
      );
    }

    const pendingChange: PendingSubscriptionChange = {
      id: createChangeId(),
      featureId,
      action,
      effectiveAt,
      requestedAt: new Date(),
      requestedByUserId: context.userId,
    };

    const updated = await saveOrganizationSubscription({
      ...subscription,
      pendingChanges: [...subscription.pendingChanges, pendingChange],
    });

    return this.serializeSubscription(updated, context.organizationId);
  }

  async scheduleScaleChange(request: Request, scaleTier: string) {
    const context = await this.workforce.getMemberContext(request);
    if (!context.isAdmin) {
      throw new ForbiddenException('Organization admin access required.');
    }

    if (!isOrganizationScaleTier(scaleTier)) {
      throw new BadRequestException('Unknown organization scale.');
    }

    const subscription = await this.getOrCreateSubscription(
      context.organizationId,
    );

    if (subscription.scaleTier === scaleTier) {
      throw new BadRequestException('That scale is already active.');
    }

    if (subscription.pendingScaleChange) {
      throw new BadRequestException(
        'A scale change is already scheduled. Cancel it before choosing another.',
      );
    }

    const pendingScaleChange: PendingScaleChange = {
      id: createChangeId(),
      scaleTier,
      effectiveAt: getChangeEffectiveDate(),
      requestedAt: new Date(),
      requestedByUserId: context.userId,
    };

    const updated = await saveOrganizationSubscription({
      ...subscription,
      pendingScaleChange,
    });

    return this.serializeSubscription(updated, context.organizationId);
  }

  async cancelPendingChange(request: Request, changeId: string) {
    const context = await this.workforce.getMemberContext(request);
    if (!context.isAdmin) {
      throw new ForbiddenException('Organization admin access required.');
    }

    const subscription = await this.getOrCreateSubscription(
      context.organizationId,
    );
    const pending = subscription.pendingChanges.find(
      (change) => change.id === changeId,
    );

    if (pending) {
      const updated = await saveOrganizationSubscription({
        ...subscription,
        pendingChanges: subscription.pendingChanges.filter(
          (change) => change.id !== changeId,
        ),
      });

      return this.serializeSubscription(updated, context.organizationId);
    }

    if (subscription.pendingScaleChange?.id === changeId) {
      const updated = await saveOrganizationSubscription({
        ...subscription,
        pendingScaleChange: null,
      });

      return this.serializeSubscription(updated, context.organizationId);
    }

    throw new BadRequestException('Scheduled change not found.');
  }

  async cancelPendingScaleChange(request: Request) {
    const context = await this.workforce.getMemberContext(request);
    if (!context.isAdmin) {
      throw new ForbiddenException('Organization admin access required.');
    }

    const subscription = await this.getOrCreateSubscription(
      context.organizationId,
    );

    if (!subscription.pendingScaleChange) {
      throw new BadRequestException('No scheduled scale change found.');
    }

    const updated = await saveOrganizationSubscription({
      ...subscription,
      pendingScaleChange: null,
    });

    return this.serializeSubscription(updated, context.organizationId);
  }

  async enableAllFeaturesForDemo(request: Request) {
    const context = await this.workforce.getMemberContext(request);
    if (!context.isAdmin) {
      throw new ForbiddenException('Organization admin access required.');
    }

    const subscription = await this.getOrCreateSubscription(
      context.organizationId,
    );
    const updated = await saveOrganizationSubscription({
      ...subscription,
      activeFeatures: [...BILLABLE_FEATURE_IDS],
      pendingChanges: [],
    });

    return this.serializeSubscription(updated, context.organizationId);
  }

  async seedSubscriptionForOrganization(
    organizationId: string,
    activeFeatures: BillableFeatureId[] = [],
  ) {
    const existing = await findSubscriptionByOrganizationId(organizationId);
    if (existing) {
      const { hasStoredScaleTier: _hasStoredScaleTier, ...subscription } =
        existing;
      return subscription;
    }

    return createOrganizationSubscription({
      organizationId,
      activeFeatures,
    });
  }
}
