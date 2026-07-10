'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Palette, Save } from 'lucide-react';
import { toast } from 'sonner';
import { BrandingEditor } from '@/components/branding/branding-editor';
import { LoadingButton } from '@/components/ui/loading-button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth-client';
import {
  DEFAULT_ORG_BRANDING,
  getOrgBranding,
  normalizeHexColor,
  publishOrgBrandingTheme,
  updateOrgBranding,
  type BrandingColors,
  type OrgBranding,
} from '@/lib/branding';
import { isOrgAppearanceEnabled } from '@/lib/feature-flags';
import { isOrgAdminRole } from '@/lib/org-roles';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

export default function AppearanceSettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [branding, setBranding] = useState<BrandingColors>({
    primaryColor: DEFAULT_ORG_BRANDING.primaryColor,
    secondaryColor: DEFAULT_ORG_BRANDING.secondaryColor,
    accentColor: DEFAULT_ORG_BRANDING.accentColor,
  });
  const [savedBranding, setSavedBranding] = useState<OrgBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOrgAppearanceEnabled()) {
      router.replace('/dashboard');
      return;
    }

    if (!session) {
      return;
    }

    void getTeamOverview()
      .then(async (nextTeam) => {
        if (!isOrgAdminRole(nextTeam.currentMember?.role)) {
          router.replace('/dashboard');
          return;
        }

        setTeam(nextTeam);
        const nextBranding = await getOrgBranding();
        setSavedBranding(nextBranding);
        setBranding({
          primaryColor: nextBranding.primaryColor,
          secondaryColor: nextBranding.secondaryColor,
          accentColor: nextBranding.accentColor,
        });
      })
      .catch(() => router.replace('/dashboard'))
      .finally(() => setLoading(false));
  }, [router, session]);

  const hasChanges = Boolean(
    savedBranding &&
      (normalizeHexColor(branding.primaryColor, '') !==
        savedBranding.primaryColor ||
        normalizeHexColor(branding.secondaryColor, '') !==
          savedBranding.secondaryColor ||
        normalizeHexColor(branding.accentColor, '') !==
          savedBranding.accentColor),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasChanges) {
      return;
    }

    setSaving(true);

    try {
      const next = await updateOrgBranding({
        primaryColor: normalizeHexColor(
          branding.primaryColor,
          DEFAULT_ORG_BRANDING.primaryColor,
        ),
        secondaryColor: normalizeHexColor(
          branding.secondaryColor,
          DEFAULT_ORG_BRANDING.secondaryColor,
        ),
        accentColor: normalizeHexColor(
          branding.accentColor,
          DEFAULT_ORG_BRANDING.accentColor,
        ),
      });

      setSavedBranding(next);
      setBranding({
        primaryColor: next.primaryColor,
        secondaryColor: next.secondaryColor,
        accentColor: next.accentColor,
      });
      publishOrgBrandingTheme(next);
      toast.success('Appearance settings saved.');
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to save appearance settings.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !team) {
    return (
      <div className="space-y-6 px-6 py-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 px-6 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Palette className="size-6 text-primary" />
          Appearance
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Set your organization colors. Primary drives backgrounds, secondary
          drives buttons, and accent drives borders across the dashboard. Manage
          company name and logo under Branding.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <section className="rounded-2xl border border-border bg-card p-6">
          <BrandingEditor
            value={branding}
            onChange={setBranding}
            showLogoUpload={false}
          />
        </section>

        <LoadingButton
          type="submit"
          loading={saving}
          loadingText="Saving…"
          disabled={!hasChanges}
        >
          <Save className="size-4" />
          Save appearance
        </LoadingButton>
      </form>
    </div>
  );
}
