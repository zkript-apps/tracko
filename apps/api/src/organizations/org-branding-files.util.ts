import { createReadStream, existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import type { ReadStream } from 'fs';

export const MAX_ORG_LOGO_BYTES = 2 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

const UPLOAD_ROOT =
  process.env.ORG_LOGOS_DIR ?? join(process.cwd(), 'uploads', 'org-logos');

export function getAllowedOrgLogoExtensions(): string[] {
  return [...ALLOWED_EXTENSIONS];
}

export function getOrgLogoExtension(originalName: string): string | null {
  const index = originalName.lastIndexOf('.');
  if (index <= 0) {
    return null;
  }

  const extension = originalName.slice(index).toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension) ? extension : null;
}

export function getOrgLogoFilePath(
  organizationId: string,
  storedFileName: string,
): string {
  return join(UPLOAD_ROOT, organizationId, storedFileName);
}

export async function saveOrgLogoFile(input: {
  organizationId: string;
  storedFileName: string;
  buffer: Buffer;
}): Promise<void> {
  const directory = join(UPLOAD_ROOT, input.organizationId);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, input.storedFileName), input.buffer);
}

export async function deleteOrgLogoFile(input: {
  organizationId: string;
  storedFileName: string;
}): Promise<void> {
  const filePath = getOrgLogoFilePath(input.organizationId, input.storedFileName);

  if (!existsSync(filePath)) {
    return;
  }

  await unlink(filePath);
}

export function openOrgLogoFile(input: {
  organizationId: string;
  storedFileName: string;
}): { stream: ReadStream; exists: true } | { stream: null; exists: false } {
  const filePath = getOrgLogoFilePath(input.organizationId, input.storedFileName);

  if (!existsSync(filePath)) {
    return { stream: null, exists: false };
  }

  return {
    stream: createReadStream(filePath),
    exists: true,
  };
}

export function mimeTypeForLogoExtension(extension: string): string {
  switch (extension.toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}
