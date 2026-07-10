'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ImagePlus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingButton } from '@/components/ui/loading-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/lib/auth-client';
import { isOrgAdminRole } from '@/lib/org-roles';
import {
  getOrganizationProfile,
  removeOrgLogo,
  resolveOrganizationLogoUrl,
  updateOrganizationProfile,
  uploadOrgLogo,
  type OrganizationProfile,
} from '@/lib/organization-profile';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

const emptyProfile = {
  name: '',
  description: '',
  industry: '',
  website: '',
  phone: '',
  address: '',
  city: '',
  timezone: '',
};

export default function BrandingSettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [saved, setSaved] = useState<OrganizationProfile | null>(null);
  const [form, setForm] = useState(emptyProfile);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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
        const profile = await getOrganizationProfile();
        setSaved(profile);
        setForm({
          name: profile.name,
          description: profile.description ?? '',
          industry: profile.industry ?? '',
          website: profile.website ?? '',
          phone: profile.phone ?? '',
          address: profile.address ?? '',
          city: profile.city ?? '',
          timezone: profile.timezone ?? '',
        });
        setLogoPreviewUrl(resolveOrganizationLogoUrl(profile.logoUrl));
      })
      .catch(() => router.replace('/dashboard'))
      .finally(() => setLoading(false));
  }, [router, session]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const hasProfileChanges =
    saved &&
    (form.name.trim() !== saved.name ||
      (form.description.trim() || null) !== saved.description ||
      (form.industry.trim() || null) !== saved.industry ||
      (form.website.trim() || null) !== saved.website ||
      (form.phone.trim() || null) !== saved.phone ||
      (form.address.trim() || null) !== saved.address ||
      (form.city.trim() || null) !== saved.city ||
      (form.timezone.trim() || null) !== saved.timezone);

  const hasChanges = Boolean(hasProfileChanges || logoFile || removeLogo);

  function handleLogoChange(file: File | null) {
    if (logoPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    if (!file) {
      setLogoFile(null);
      setRemoveLogo(Boolean(saved?.hasLogo));
      setLogoPreviewUrl(null);
      return;
    }

    setLogoFile(file);
    setRemoveLogo(false);
    setLogoPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasChanges) {
      return;
    }

    setSaving(true);

    try {
      let next = await updateOrganizationProfile({
        name: form.name.trim(),
        description: form.description.trim() || null,
        industry: form.industry.trim() || null,
        website: form.website.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        timezone: form.timezone.trim() || null,
      });

      if (removeLogo && !logoFile) {
        const logoResult = await removeOrgLogo();
        next = {
          ...next,
          hasLogo: logoResult.hasLogo,
          logoUrl: logoResult.logoUrl,
        };
      }

      if (logoFile) {
        const logoResult = await uploadOrgLogo(logoFile);
        next = {
          ...next,
          hasLogo: logoResult.hasLogo,
          logoUrl: logoResult.logoUrl,
        };
      }

      setSaved(next);
      setForm({
        name: next.name,
        description: next.description ?? '',
        industry: next.industry ?? '',
        website: next.website ?? '',
        phone: next.phone ?? '',
        address: next.address ?? '',
        city: next.city ?? '',
        timezone: next.timezone ?? '',
      });
      setLogoPreviewUrl(resolveOrganizationLogoUrl(next.logoUrl));
      setLogoFile(null);
      setRemoveLogo(false);
      setTeam((current) =>
        current
          ? {
              ...current,
              organization: {
                ...current.organization,
                name: next.name,
              },
            }
          : current,
      );
      toast.success('Branding settings saved.');
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to save branding settings.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !team || !saved) {
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
          <Building2 className="size-6 text-primary" />
          Branding
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Set your company name, logo, and optional profile details shown across
          Tracko.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <section className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Company identity
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Required name and optional logo for your organization.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-name">Company name</Label>
            <Input
              id="company-name"
              required
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              maxLength={120}
              placeholder="Acme Corporation"
            />
          </div>

          <div className="space-y-3">
            <div>
              <Label>Company logo</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Optional. PNG, JPG, WEBP, or SVG up to 2MB.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex size-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
                {logoPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreviewUrl}
                    alt="Company logo preview"
                    className="size-full object-contain p-1"
                  />
                ) : (
                  <ImagePlus className="size-5 text-muted-foreground" />
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-border px-3 py-2 text-sm text-foreground transition hover:bg-muted">
                Upload logo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="sr-only"
                  onChange={(event) =>
                    handleLogoChange(event.target.files?.[0] ?? null)
                  }
                />
              </label>
              {logoPreviewUrl ? (
                <button
                  type="button"
                  onClick={() => handleLogoChange(null)}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
                >
                  <Trash2 className="size-4" />
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Company details
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional information about your business.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-description">Description</Label>
            <Textarea
              id="company-description"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              maxLength={1000}
              rows={4}
              placeholder="What your company does, who you serve, and how you work."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company-industry">Industry</Label>
              <Input
                id="company-industry"
                value={form.industry}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    industry: event.target.value,
                  }))
                }
                placeholder="Retail, BPO, Construction…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-website">Website</Label>
              <Input
                id="company-website"
                value={form.website}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    website: event.target.value,
                  }))
                }
                placeholder="https://company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-phone">Phone</Label>
              <Input
                id="company-phone"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="+63…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-timezone">Timezone</Label>
              <Input
                id="company-timezone"
                value={form.timezone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    timezone: event.target.value,
                  }))
                }
                placeholder="Asia/Manila"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-address">Address</Label>
              <Input
                id="company-address"
                value={form.address}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                placeholder="Street, building, unit"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-city">City</Label>
              <Input
                id="company-city"
                value={form.city}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
                placeholder="Makati"
              />
            </div>
          </div>
        </section>

        <LoadingButton
          type="submit"
          loading={saving}
          loadingText="Saving…"
          disabled={!hasChanges || !form.name.trim()}
        >
          <Save className="size-4" />
          Save branding
        </LoadingButton>
      </form>
    </div>
  );
}
