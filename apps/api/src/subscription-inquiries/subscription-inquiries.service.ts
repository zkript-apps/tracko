import { BadRequestException, Injectable } from '@nestjs/common';
import { sendEmail } from '../email/email.client';
import {
  calculateMonthlyTotalPhp,
  getFeatureById,
  getFeatureCatalogForTier,
} from '../billing/feature-catalog';
import {
  getScaleTierDefinition,
  ORGANIZATION_SCALE_TIERS,
  resolveScaleTierFromEmployeeCount,
} from '../billing/organization-scale';
import {
  createSubscriptionInquiry,
  parseSelectedFeatures,
} from './subscription-inquiries.store';

@Injectable()
export class SubscriptionInquiriesService {
  getPricingCatalog() {
    return {
      scaleTiers: ORGANIZATION_SCALE_TIERS.map((tier) => ({
        id: tier.id,
        label: tier.label,
        employeeRange: tier.employeeRange,
        features: getFeatureCatalogForTier(tier.id),
      })),
    };
  }

  async create(input: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    message?: string;
    employeeCount?: number;
    selectedFeatures: string[];
  }) {
    const companyName = input.companyName?.trim();
    const contactName = input.contactName?.trim();
    const email = input.email?.trim();
    const phone = input.phone?.trim();
    const employeeCount = Number(input.employeeCount);

    if (!companyName || !contactName || !email || !phone) {
      throw new BadRequestException(
        'Company name, contact name, email, and phone are required.',
      );
    }

    if (!Number.isFinite(employeeCount) || employeeCount < 1) {
      throw new BadRequestException(
        'Enter how many employees you expect to track (at least 1).',
      );
    }

    const scaleTier = resolveScaleTierFromEmployeeCount(employeeCount);
    const scaleDefinition = getScaleTierDefinition(scaleTier);
    const selectedFeatures = parseSelectedFeatures(input.selectedFeatures ?? []);
    const inquiry = await createSubscriptionInquiry({
      companyName,
      contactName,
      email,
      phone,
      message: input.message?.trim(),
      employeeCount: Math.round(employeeCount),
      scaleTier,
      selectedFeatures,
    });

    const features = getFeatureCatalogForTier(scaleTier);
    const addonLines = selectedFeatures.map((featureId) => {
      const feature = getFeatureById(featureId, scaleTier);
      return `- ${feature?.name}: PHP ${feature?.pricePhp}/month`;
    });
    const estimatedTotal = calculateMonthlyTotalPhp(selectedFeatures, scaleTier);

    const text = [
      'New Tracko subscription inquiry',
      '',
      `Company: ${companyName}`,
      `Contact: ${contactName}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Employees: ${Math.round(employeeCount)} (${scaleDefinition.label} tier)`,
      '',
      `Base plan: PHP ${scaleDefinition.pricing.base}/month`,
      ...(addonLines.length > 0 ? ['Add-ons:', ...addonLines] : ['Add-ons: none']),
      `Estimated monthly total: PHP ${estimatedTotal}`,
      input.message?.trim() ? `\nMessage:\n${input.message.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const opsEmail =
      process.env.SUBSCRIPTION_INQUIRY_EMAIL?.trim() ||
      process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] ||
      'onboarding@resend.dev';

    await sendEmail({
      to: opsEmail,
      subject: `Tracko subscription inquiry — ${companyName}`,
      text,
      html: `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${text}</pre>`,
    });

    await sendEmail({
      to: email,
      subject: 'We received your Tracko subscription request',
      text: `Hi ${contactName},\n\nThanks for your interest in Tracko. Our team will review your request and contact you at ${email} or ${phone} with next steps.\n\nOrganization scale: ${scaleDefinition.label} (${scaleDefinition.employeeRange})\nEstimated monthly total: PHP ${estimatedTotal}.`,
      html: `<p>Hi ${contactName},</p><p>Thanks for your interest in Tracko. Our team will review your request and contact you at <strong>${email}</strong> or <strong>${phone}</strong> with next steps.</p><p>Organization scale: <strong>${scaleDefinition.label}</strong> (${scaleDefinition.employeeRange})</p><p>Estimated monthly total: <strong>PHP ${estimatedTotal}</strong>.</p>`,
    });

    return {
      id: inquiry._id,
      employeeCount: inquiry.employeeCount,
      scaleTier: inquiry.scaleTier,
      scaleTierLabel: scaleDefinition.label,
      estimatedMonthlyTotalPhp: estimatedTotal,
      selectedFeatures,
      features,
      message:
        'Thanks! We received your request and will contact you shortly.',
    };
  }
}
