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
import { OrganizationScaleService } from './organization-scale.service';
import { formatEffectiveDate, getFirstDayOfNextMonth } from './billing.util';
import {
  createOrganizationSubscription,
  findSubscriptionByOrganizationId,
  saveOrganizationSubscription,
  type OrganizationSubscription,
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

  return {
    ...subscription,
    activeFeatures: Array.from(activeFeatures),
    pendingChanges: remaining,
  };
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
      const updated = applyDuePendingChanges(existing);
      if (
        updated.activeFeatures.length !== existing.activeFeatures.length ||
        updated.pendingChanges.length !== existing.pendingChanges.length ||
        updated.activeFeatures.some(
          (feature, index) => feature !== existing.activeFeatures[index],
        )
      ) {
        return saveOrganizationSubscription(updated);
      }
      return existing;
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
    const { employeeCount, scaleTier } =
      await this.organizationScale.resolveScaleTier(organizationId);
    const scaleDefinition = ORGANIZATION_SCALE_TIERS.find(
      (tier) => tier.id === scaleTier,
    )!;
    const features = getFeatureCatalogForTier(scaleTier);
    const basePlan = features.find((feature) => feature.id === 'base');
    const effectiveAt = getFirstDayOfNextMonth();
    const pendingChanges = subscription.pendingChanges.map((change) => ({
      id: change.id,
      featureId: change.featureId,
      action: change.action,
      effectiveAt: change.effectiveAt.toISOString(),
      effectiveDateLabel: formatEffectiveDate(change.effectiveAt.toISOString()),
      requestedAt: change.requestedAt.toISOString(),
    }));

    const projectedFeatures = new Set(subscription.activeFeatures);
    for (const change of subscription.pendingChanges) {
      if (change.action === 'add') {
        projectedFeatures.add(change.featureId);
      } else {
        projectedFeatures.delete(change.featureId);
      }
    }

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
        scaleTier,
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

    const feature = getFeatureById(featureId, (
      await this.organizationScale.resolveScaleTier(context.organizationId)
    ).scaleTier);
    if (!feature) {
      throw new BadRequestException('Unknown subscription feature.');
    }

    const subscription = await this.getOrCreateSubscription(
      context.organizationId,
    );
    const effectiveAt = getFirstDayOfNextMonth();
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

    if (!pending) {
      throw new BadRequestException('Scheduled change not found.');
    }

    const updated = await saveOrganizationSubscription({
      ...subscription,
      pendingChanges: subscription.pendingChanges.filter(
        (change) => change.id !== changeId,
      ),
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
      return existing;
    }

    return createOrganizationSubscription({
      organizationId,
      activeFeatures,
    });
  }
}
