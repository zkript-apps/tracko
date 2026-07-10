/**
 * Product feature flags (env-gated).
 * Appearance/branding is optional while we decide whether to ship it.
 */
export function isOrgAppearanceEnabled(): boolean {
  return (
    process.env.ENABLE_ORG_APPEARANCE === 'true' ||
    process.env.NEXT_PUBLIC_ENABLE_ORG_APPEARANCE === 'true'
  );
}
