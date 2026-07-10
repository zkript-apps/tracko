'use client';

import type { BrandingColors } from '@/lib/branding';
import { getContrastingForeground } from '@/lib/branding';

function PreviewSkeletonBar({
  width,
  color,
}: {
  width: string;
  color: string;
}) {
  return (
    <div
      className="h-2.5 rounded-full opacity-80"
      style={{ width, backgroundColor: color }}
    />
  );
}

export function BrandingPreviewCards({
  colors,
}: {
  colors: BrandingColors;
}) {
  const { primaryColor, secondaryColor, accentColor } = colors;
  const onPrimary = getContrastingForeground(primaryColor);
  const onSecondary = getContrastingForeground(secondaryColor);

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <article
        className="rounded-xl border p-4 shadow-sm"
        style={{
          backgroundColor: primaryColor,
          borderColor: accentColor,
          color: onPrimary,
        }}
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] opacity-70">
          Preview 1 · Surface
        </p>
        <p className="mt-3 text-sm font-semibold">Dashboard card</p>
        <div className="mt-4 space-y-2">
          <PreviewSkeletonBar width="88%" color={accentColor} />
          <PreviewSkeletonBar width="64%" color={accentColor} />
        </div>
        <button
          type="button"
          className="mt-5 rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{
            backgroundColor: secondaryColor,
            color: onSecondary,
          }}
        >
          Primary action
        </button>
        <dl className="mt-4 space-y-1 text-[11px] opacity-70">
          <div>BG: {primaryColor}</div>
          <div>Button: {secondaryColor}</div>
          <div>Border: {accentColor}</div>
        </dl>
      </article>

      <article
        className="rounded-xl border p-4 shadow-sm"
        style={{
          backgroundColor: primaryColor,
          borderColor: accentColor,
          color: onPrimary,
        }}
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] opacity-70">
          Preview 2 · Form
        </p>
        <p className="mt-3 text-sm font-semibold">Input field</p>
        <div
          className="mt-4 rounded-lg border px-3 py-2 text-xs"
          style={{ borderColor: accentColor, backgroundColor: 'transparent' }}
        >
          <span className="opacity-60">Employee name</span>
        </div>
        <div className="mt-3 flex gap-2">
          <div
            className="h-8 flex-1 rounded-lg"
            style={{ backgroundColor: secondaryColor }}
          />
          <div
            className="h-8 w-8 rounded-lg border"
            style={{ borderColor: accentColor }}
          />
        </div>
        <dl className="mt-4 space-y-1 text-[11px] opacity-70">
          <div>BG: {primaryColor}</div>
          <div>Button: {secondaryColor}</div>
          <div>Border: {accentColor}</div>
        </dl>
      </article>

      <article
        className="rounded-xl border p-4 shadow-sm"
        style={{
          backgroundColor: primaryColor,
          borderColor: accentColor,
          color: onPrimary,
        }}
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] opacity-70">
          Preview 3 · Nav
        </p>
        <div className="mt-3 space-y-2">
          <div
            className="rounded-lg px-3 py-2 text-xs font-medium"
            style={{
              backgroundColor: secondaryColor,
              color: onSecondary,
            }}
          >
            Active page
          </div>
          <div
            className="rounded-lg border px-3 py-2 text-xs opacity-80"
            style={{ borderColor: accentColor }}
          >
            Inactive page
          </div>
          <div
            className="rounded-lg border px-3 py-2 text-xs opacity-80"
            style={{ borderColor: accentColor }}
          >
            Settings
          </div>
        </div>
        <dl className="mt-4 space-y-1 text-[11px] opacity-70">
          <div>BG: {primaryColor}</div>
          <div>Button: {secondaryColor}</div>
          <div>Border: {accentColor}</div>
        </dl>
      </article>
    </div>
  );
}
