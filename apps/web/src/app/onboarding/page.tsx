'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import {
  completeOnboarding,
  getOnboardingStatus,
  type BranchInput,
} from '@/lib/onboarding';
import { LoadingButton } from '@/components/ui/loading-button';
import { OnboardingSkeleton } from '@/components/ui/onboarding-skeleton';

const industries = [
  'Retail',
  'Food & Beverage',
  'Construction',
  'Healthcare',
  'Logistics',
  'Manufacturing',
  'Professional Services',
  'Other',
];

const timezones = [
  { value: 'Asia/Manila', label: 'Philippines (Asia/Manila)' },
  { value: 'Asia/Singapore', label: 'Singapore (Asia/Singapore)' },
  { value: 'Asia/Tokyo', label: 'Japan (Asia/Tokyo)' },
];

function emptyBranch(): BranchInput {
  return { name: '', address: '', city: '', isHeadOffice: false };
}

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [timezone, setTimezone] = useState('Asia/Manila');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [branches, setBranches] = useState<BranchInput[]>([
    { ...emptyBranch(), name: 'Head Office', isHeadOffice: true },
  ]);

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      router.replace('/sign-in');
      return;
    }

    void getOnboardingStatus()
      .then((status) => {
        if (!status.needsOnboarding) {
          router.replace('/dashboard');
          return;
        }

        if (status.organization?.name) {
          setName(status.organization.name);
        }
      })
      .finally(() => setCheckingStatus(false));
  }, [isPending, router, session]);

  function updateBranch(index: number, patch: Partial<BranchInput>) {
    setBranches((current) =>
      current.map((branch, branchIndex) =>
        branchIndex === index ? { ...branch, ...patch } : branch,
      ),
    );
  }

  function addBranch() {
    setBranches((current) => [...current, emptyBranch()]);
  }

  function removeBranch(index: number) {
    setBranches((current) => current.filter((_, branchIndex) => branchIndex !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await completeOnboarding({
        name,
        industry,
        timezone,
        address,
        city,
        phone,
        branches,
      });
      router.push('/dashboard');
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to complete onboarding.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (isPending || checkingStatus) {
    return <OnboardingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
            Organization setup
          </p>
          <h1 className="text-3xl font-semibold text-white">
            Set up {session?.user.name.split(' ')[0]}&apos;s company
          </h1>
          <p className="text-sm text-slate-400">
            Step {step} of 2 — tell us about your organization and branches.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl"
        >
          {step === 1 ? (
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Organization name</span>
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
                  placeholder="Acme Logistics Inc."
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Industry</span>
                <select
                  required
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
                >
                  <option value="">Select industry</option>
                  {industries.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Timezone</span>
                <select
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
                >
                  {timezones.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm text-slate-300">City</span>
                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
                    placeholder="Quezon City"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-slate-300">Phone</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
                    placeholder="+63 912 345 6789"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Head office address</span>
                <input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
                  placeholder="123 Main Street, Barangay Example"
                />
              </label>

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!name.trim() || !industry}
                className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue to branches
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 className="text-lg font-medium text-white">Branches</h2>
                <p className="text-sm text-slate-400">
                  Add each office or site your organization operates. HR users
                  will be assigned to oversee specific branches later.
                </p>
              </div>

              {branches.map((branch, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-200">
                      Branch {index + 1}
                    </p>
                    {branches.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeBranch(index)}
                        className="text-xs text-red-300 hover:underline"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <input
                    required
                    value={branch.name}
                    onChange={(event) =>
                      updateBranch(index, { name: event.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
                    placeholder="Branch name"
                  />

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={branch.city ?? ''}
                      onChange={(event) =>
                        updateBranch(index, { city: event.target.value })
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
                      placeholder="City"
                    />
                    <input
                      value={branch.address ?? ''}
                      onChange={(event) =>
                        updateBranch(index, { address: event.target.value })
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
                      placeholder="Address"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(branch.isHeadOffice)}
                      onChange={(event) =>
                        updateBranch(index, { isHeadOffice: event.target.checked })
                      }
                      className="rounded border-slate-600"
                    />
                    Head office
                  </label>
                </div>
              ))}

              <button
                type="button"
                onClick={addBranch}
                className="w-full rounded-lg border border-dashed border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                + Add another branch
              </button>

              {error ? (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  Back
                </button>
                <LoadingButton
                  type="submit"
                  loading={loading}
                  loadingText="Creating organization…"
                  className="flex-1 rounded-lg bg-emerald-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-400"
                >
                  Finish setup
                </LoadingButton>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
