import { apiFetch, apiUpload, apiUrl } from './api';

export type OrgBranding = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  hasLogo: boolean;
  logoUrl: string | null;
};

/** Primary = background, secondary = buttons, accent = borders */
export const DEFAULT_ORG_BRANDING: OrgBranding = {
  primaryColor: '#04070f',
  secondaryColor: '#2fc183',
  accentColor: '#2d333d',
  hasLogo: false,
  logoUrl: null,
};

export function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{6})$/.test(value.trim());
}

export function normalizeHexColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (isValidHexColor(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (/^#([0-9a-fA-F]{3})$/.test(trimmed)) {
    const [, short] = trimmed.match(/^#([0-9a-fA-F]{3})$/) ?? [];
    if (short) {
      return `#${short
        .split('')
        .map((part) => `${part}${part}`)
        .join('')}`.toLowerCase();
    }
  }

  return fallback;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex, '#000000').replace('#', '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function getContrastingForeground(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#0f172a' : '#f8fafc';
}

export function mixHexColors(left: string, right: string, amount: number): string {
  const start = hexToRgb(left);
  const end = hexToRgb(right);
  const mix = (from: number, to: number) =>
    Math.round(from + (to - from) * Math.min(Math.max(amount, 0), 1));

  const toHex = (value: number) => value.toString(16).padStart(2, '0');

  return `#${toHex(mix(start.r, end.r))}${toHex(mix(start.g, end.g))}${toHex(mix(start.b, end.b))}`;
}

export type BrandingColors = Pick<
  OrgBranding,
  'primaryColor' | 'secondaryColor' | 'accentColor'
>;

export function applyOrgBrandingTheme(colors: BrandingColors) {
  if (typeof document === 'undefined') {
    return;
  }

  const primary = normalizeHexColor(
    colors.primaryColor,
    DEFAULT_ORG_BRANDING.primaryColor,
  );
  const secondary = normalizeHexColor(
    colors.secondaryColor,
    DEFAULT_ORG_BRANDING.secondaryColor,
  );
  const accent = normalizeHexColor(
    colors.accentColor,
    DEFAULT_ORG_BRANDING.accentColor,
  );

  const foreground = getContrastingForeground(primary);
  const onSecondary = getContrastingForeground(secondary);
  const card = mixHexColors(primary, secondary, 0.08);
  const muted = mixHexColors(primary, accent, 0.2);
  const mutedForeground = mixHexColors(foreground, primary, 0.35);

  const root = document.documentElement;
  const assignments: Record<string, string> = {
    '--background': primary,
    '--foreground': foreground,
    '--card': card,
    '--card-foreground': foreground,
    '--popover': card,
    '--popover-foreground': foreground,
    '--primary': secondary,
    '--primary-foreground': onSecondary,
    '--secondary': muted,
    '--secondary-foreground': foreground,
    '--muted': muted,
    '--muted-foreground': mutedForeground,
    '--accent': muted,
    '--accent-foreground': foreground,
    '--border': accent,
    '--input': muted,
    '--ring': secondary,
    '--sidebar': mixHexColors(primary, '#000000', 0.12),
    '--sidebar-foreground': foreground,
    '--sidebar-primary': secondary,
    '--sidebar-primary-foreground': onSecondary,
    '--sidebar-accent': muted,
    '--sidebar-accent-foreground': foreground,
    '--sidebar-border': accent,
    '--sidebar-ring': secondary,
    '--chart-1': secondary,
  };

  for (const [key, value] of Object.entries(assignments)) {
    root.style.setProperty(key, value);
    // Tailwind v4 theme tokens reference these as --color-*
    if (key.startsWith('--') && !key.startsWith('--color-')) {
      root.style.setProperty(`--color-${key.slice(2)}`, value);
    }
  }

  // Skeleton loaders: muted bars with a brand-tinted shimmer
  root.style.setProperty(
    '--skeleton',
    mixHexColors(muted, accent, 0.35),
  );
  root.style.setProperty(
    '--skeleton-shine',
    `${secondary}33`,
  );
  root.style.setProperty('--color-skeleton', mixHexColors(muted, accent, 0.35));

  persistOrgBrandingCache(colors);
}

const BRANDING_CACHE_KEY = 'tracko:org-branding';

function persistOrgBrandingCache(colors: BrandingColors) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      BRANDING_CACHE_KEY,
      JSON.stringify({
        primaryColor: normalizeHexColor(
          colors.primaryColor,
          DEFAULT_ORG_BRANDING.primaryColor,
        ),
        secondaryColor: normalizeHexColor(
          colors.secondaryColor,
          DEFAULT_ORG_BRANDING.secondaryColor,
        ),
        accentColor: normalizeHexColor(
          colors.accentColor,
          DEFAULT_ORG_BRANDING.accentColor,
        ),
      }),
    );
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

export function bootstrapOrgBrandingFromCache() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const raw = window.localStorage.getItem(BRANDING_CACHE_KEY);
    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw) as Partial<BrandingColors>;
    if (
      !parsed.primaryColor ||
      !parsed.secondaryColor ||
      !parsed.accentColor
    ) {
      return false;
    }

    applyOrgBrandingTheme({
      primaryColor: parsed.primaryColor,
      secondaryColor: parsed.secondaryColor,
      accentColor: parsed.accentColor,
    });
    return true;
  } catch {
    return false;
  }
}

export const ORG_BRANDING_UPDATED_EVENT = 'tracko:branding-updated';

export function publishOrgBrandingTheme(
  colors: BrandingColors & {
    hasLogo?: boolean;
    logoUrl?: string | null;
  },
) {
  applyOrgBrandingTheme(colors);

  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(ORG_BRANDING_UPDATED_EVENT, {
      detail: colors,
    }),
  );
}

export function clearOrgBrandingTheme() {
  if (typeof document === 'undefined') {
    return;
  }

  const keys = [
    '--background',
    '--foreground',
    '--card',
    '--card-foreground',
    '--popover',
    '--popover-foreground',
    '--primary',
    '--primary-foreground',
    '--secondary',
    '--secondary-foreground',
    '--muted',
    '--muted-foreground',
    '--accent',
    '--accent-foreground',
    '--border',
    '--input',
    '--ring',
    '--sidebar',
    '--sidebar-foreground',
    '--sidebar-primary',
    '--sidebar-primary-foreground',
    '--sidebar-accent',
    '--sidebar-accent-foreground',
    '--sidebar-border',
    '--sidebar-ring',
    '--chart-1',
    '--skeleton',
    '--skeleton-shine',
  ];

  for (const key of keys) {
    document.documentElement.style.removeProperty(key);
    document.documentElement.style.removeProperty(`--color-${key.slice(2)}`);
  }
}

export function resolveBrandingLogoUrl(logoUrl: string | null | undefined) {
  if (!logoUrl) {
    return null;
  }

  if (logoUrl.startsWith('http') || logoUrl.startsWith('blob:')) {
    return logoUrl;
  }

  return `${apiUrl}${logoUrl}`;
}

export async function getOrgBranding(): Promise<OrgBranding> {
  return apiFetch('/organization/branding');
}

export async function updateOrgBranding(
  input: BrandingColors,
): Promise<OrgBranding> {
  return apiFetch('/organization/branding', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function uploadOrgLogo(file: File): Promise<OrgBranding> {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload('/organization/branding/logo', formData);
}

export async function removeOrgLogo(): Promise<OrgBranding> {
  return apiFetch('/organization/branding/logo', {
    method: 'DELETE',
  });
}
