function usesApiProxy() {
  return process.env.NEXT_PUBLIC_USE_API_PROXY === 'true';
}

function resolveWebOrigin() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  if (process.env.NEXT_PUBLIC_WEB_URL) {
    return process.env.NEXT_PUBLIC_WEB_URL.replace(/\/$/, '');
  }

  if (process.env.VERCEL_URL) {
    const host = process.env.VERCEL_URL.replace(/^https?:\/\//, '');
    return `https://${host}`;
  }

  return 'http://localhost:3000';
}

function resolveApiUrl() {
  if (usesApiProxy()) {
    return '/backend';
  }

  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

const apiUrl = resolveApiUrl();

export function resolveAuthClientConfig() {
  if (usesApiProxy()) {
    return {
      baseURL: resolveWebOrigin(),
      basePath: '/backend/api/auth',
    };
  }

  return {
    baseURL: apiUrl,
  };
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = payload?.message;
    throw new Error(
      Array.isArray(message)
        ? message.join(', ')
        : message ?? 'Request failed.',
    );
  }

  return response.json() as Promise<T>;
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  init?: Omit<RequestInit, 'body'>,
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    method: init?.method ?? 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = payload?.message;
    throw new Error(
      Array.isArray(message)
        ? message.join(', ')
        : message ?? 'Upload failed.',
    );
  }

  return response.json() as Promise<T>;
}

export { apiUrl };
