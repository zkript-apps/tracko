export type OrgBranding = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoFileName?: string | null;
};

/** Primary = page background, secondary = buttons, accent = borders/highlights */
export const DEFAULT_ORG_BRANDING: OrgBranding = {
  primaryColor: '#04070f',
  secondaryColor: '#2fc183',
  accentColor: '#2d333d',
  logoFileName: null,
};

export function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{6})$/.test(value.trim());
}

export function normalizeOrgBranding(
  input?: Partial<OrgBranding> | null,
): OrgBranding {
  return {
    primaryColor: isValidHexColor(input?.primaryColor ?? '')
      ? input!.primaryColor!.trim()
      : DEFAULT_ORG_BRANDING.primaryColor,
    secondaryColor: isValidHexColor(input?.secondaryColor ?? '')
      ? input!.secondaryColor!.trim()
      : DEFAULT_ORG_BRANDING.secondaryColor,
    accentColor: isValidHexColor(input?.accentColor ?? '')
      ? input!.accentColor!.trim()
      : DEFAULT_ORG_BRANDING.accentColor,
    logoFileName: input?.logoFileName ?? null,
  };
}
