'use client';

import { FormEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LoadingButton } from '@/components/ui/loading-button';
import {
  calculateMonthlyTotalPhp,
  formatPhp,
  getFeatureCatalogForTier,
  getScaleTierDefinition,
  resolveScaleTierFromEmployeeCount,
  submitSubscriptionInquiry,
  type BillableFeatureId,
} from '@/lib/billing';

export function SubscriptionContactForm() {
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [employeeCount, setEmployeeCount] = useState('10');
  const [selectedFeatures, setSelectedFeatures] = useState<BillableFeatureId[]>(
    [],
  );
  const [loading, setLoading] = useState(false);

  const parsedEmployeeCount = Math.max(1, Number(employeeCount) || 1);
  const scaleTier = resolveScaleTierFromEmployeeCount(parsedEmployeeCount);
  const scaleDefinition = getScaleTierDefinition(scaleTier);
  const featureCatalog = useMemo(
    () => getFeatureCatalogForTier(scaleTier),
    [scaleTier],
  );

  const estimatedTotal = useMemo(
    () => calculateMonthlyTotalPhp(selectedFeatures, scaleTier),
    [selectedFeatures, scaleTier],
  );

  function toggleFeature(featureId: BillableFeatureId) {
    setSelectedFeatures((current) =>
      current.includes(featureId)
        ? current.filter((id) => id !== featureId)
        : [...current, featureId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const result = await submitSubscriptionInquiry({
        companyName,
        contactName,
        email,
        phone,
        message,
        employeeCount: parsedEmployeeCount,
        selectedFeatures,
      });
      toast.success(result.message);
      setCompanyName('');
      setContactName('');
      setEmail('');
      setPhone('');
      setMessage('');
      setEmployeeCount('10');
      setSelectedFeatures([]);
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to submit your request.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-8 rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:grid-cols-[1.1fr_0.9fr]"
    >
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-medium text-white">Contact information</h3>
          <p className="mt-1 text-sm text-slate-400">
            Tell us who to reach after you review the plan.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 sm:col-span-2">
            <span className="text-sm text-slate-300">Company name</span>
            <input
              required
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Contact name</span>
            <input
              required
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Phone</span>
            <input
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
            />
          </label>
          <label className="block space-y-2 sm:col-span-2">
            <span className="text-sm text-slate-300">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
            />
          </label>
          <label className="block space-y-2 sm:col-span-2">
            <span className="text-sm text-slate-300">
              Expected employees to track
            </span>
            <input
              required
              type="number"
              min={1}
              value={employeeCount}
              onChange={(event) => setEmployeeCount(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
            />
            <p className="text-xs text-slate-500">
              Pricing tier:{' '}
              <span className="text-emerald-400">
                {scaleDefinition.label} ({scaleDefinition.employeeRange})
              </span>
            </p>
          </label>
          <label className="block space-y-2 sm:col-span-2">
            <span className="text-sm text-slate-300">Message (optional)</span>
            <textarea
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
            />
          </label>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-medium text-white">Features & pricing</h3>
          <p className="mt-1 text-sm text-slate-400">
            Base plan is required. Prices adjust for your organization size.
          </p>
        </div>

        <div className="space-y-3">
          {featureCatalog.map((feature) => {
            const isBase = feature.id === 'base';
            const checked =
              isBase ||
              selectedFeatures.includes(feature.id as BillableFeatureId);

            return (
              <label
                key={feature.id}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                  isBase
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-slate-800 bg-slate-950'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isBase}
                  onChange={() => {
                    if (!isBase) {
                      toggleFeature(feature.id as BillableFeatureId);
                    }
                  }}
                  className="mt-1"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-medium text-white">{feature.name}</span>
                    <span className="text-sm text-emerald-400">
                      {formatPhp(feature.pricePhp)}/mo
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-slate-400">
                    {feature.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
          <p className="text-sm text-slate-400">
            Estimated monthly total ({scaleDefinition.label})
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {formatPhp(estimatedTotal)}
          </p>
        </div>

        <LoadingButton
          type="submit"
          loading={loading}
          loadingText="Submitting…"
          className="w-full rounded-lg bg-emerald-500 px-5 py-3 font-medium text-slate-950 hover:bg-emerald-400"
        >
          Request subscription
        </LoadingButton>
      </div>
    </form>
  );
}
