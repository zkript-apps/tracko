/**
 * Product feature flags (env-gated).
 * Optional org-level branding (colors/logo). User dark/light theme is always on.
 */
export function isOrgAppearanceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ORG_APPEARANCE === 'true';
}
