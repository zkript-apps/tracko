'use client';

import { useEffect, useId, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { BrandingPreviewCards } from '@/components/branding/branding-preview';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DEFAULT_ORG_BRANDING,
  type BrandingColors,
} from '@/lib/branding';

type BrandingEditorProps = {
  value: BrandingColors;
  onChange: (value: BrandingColors) => void;
  logoPreviewUrl?: string | null;
  onLogoFileChange?: (file: File | null) => void;
  showLogoUpload?: boolean;
};

function ColorField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const colorId = useId();
  const hexId = useId();

  return (
    <div className="space-y-2">
      <div>
        <Label htmlFor={hexId}>{label}</Label>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        <input
          id={colorId}
          type="color"
          value={
            /^#([0-9a-fA-F]{6})$/.test(value)
              ? value
              : DEFAULT_ORG_BRANDING.primaryColor
          }
          onChange={(event) => onChange(event.target.value)}
          className="size-10 cursor-pointer rounded-lg border border-border bg-transparent p-1"
        />
        <Input
          id={hexId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#121826"
          className="font-mono uppercase"
          maxLength={7}
        />
      </div>
    </div>
  );
}

export function BrandingEditor({
  value,
  onChange,
  logoPreviewUrl,
  onLogoFileChange,
  showLogoUpload = true,
}: BrandingEditorProps) {
  const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(
    logoPreviewUrl ?? null,
  );

  useEffect(() => {
    setLocalLogoUrl(logoPreviewUrl ?? null);
  }, [logoPreviewUrl]);

  useEffect(() => {
    return () => {
      if (localLogoUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(localLogoUrl);
      }
    };
  }, [localLogoUrl]);

  function updateColor(
    key: keyof BrandingColors,
    nextValue: string,
  ) {
    onChange({
      ...value,
      [key]: nextValue,
    });
  }

  function handleLogoChange(file: File | null) {
    if (localLogoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(localLogoUrl);
    }

    if (!file) {
      setLocalLogoUrl(null);
      onLogoFileChange?.(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLocalLogoUrl(objectUrl);
    onLogoFileChange?.(file);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <ColorField
          label="Primary color"
          description="Used as the main page background."
          value={value.primaryColor}
          onChange={(next) => updateColor('primaryColor', next)}
        />
        <ColorField
          label="Secondary color"
          description="Used for buttons and active states."
          value={value.secondaryColor}
          onChange={(next) => updateColor('secondaryColor', next)}
        />
        <ColorField
          label="Accent color"
          description="Used for borders and outlines."
          value={value.accentColor}
          onChange={(next) => updateColor('accentColor', next)}
        />
      </div>

      {showLogoUpload ? (
        <div className="space-y-3">
          <div>
            <Label>Organization logo</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Optional. PNG, JPG, WEBP, or SVG up to 2MB.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
              {localLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={localLogoUrl}
                  alt="Organization logo preview"
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
            {localLogoUrl ? (
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
      ) : null}

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Live preview</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Skeleton-style cards showing how your colors combine across common
            UI surfaces.
          </p>
        </div>
        <BrandingPreviewCards colors={value} />
      </div>
    </div>
  );
}
