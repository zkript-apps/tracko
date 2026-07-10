'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  bootstrapOrgBrandingFromCache,
  clearOrgBrandingTheme,
} from '@/lib/branding';
import { isOrgAppearanceEnabled } from '@/lib/feature-flags';

function shouldUseOrgBranding(pathname: string) {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/employee') ||
    pathname.startsWith('/onboarding')
  );
}

/**
 * Applies cached org palette only inside authenticated product areas,
 * and only when the appearance feature flag is enabled.
 */
export function BrandingBootstrap() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (!isOrgAppearanceEnabled() || !shouldUseOrgBranding(pathname)) {
      clearOrgBrandingTheme();
      return;
    }

    bootstrapOrgBrandingFromCache();
  }, [pathname]);

  return null;
}
