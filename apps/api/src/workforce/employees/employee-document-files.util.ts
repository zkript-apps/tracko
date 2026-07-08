import { createReadStream, existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import type { ReadStream } from 'fs';

export const MAX_EMPLOYEE_DOCUMENT_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.doc',
  '.docx',
]);

const UPLOAD_ROOT =
  process.env.EMPLOYEE_DOCUMENTS_DIR ??
  join(process.cwd(), 'uploads', 'employee-documents');

export function getAllowedEmployeeDocumentExtensions(): string[] {
  return [...ALLOWED_EXTENSIONS];
}

export function getEmployeeDocumentExtension(originalName: string): string | null {
  const index = originalName.lastIndexOf('.');
  if (index <= 0) {
    return null;
  }

  const extension = originalName.slice(index).toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension) ? extension : null;
}

export function createStoredFileName(documentId: string, extension: string): string {
  return `${documentId}${extension}`;
}

export function getEmployeeDocumentFilePath(
  organizationId: string,
  userId: string,
  storedFileName: string,
): string {
  return join(UPLOAD_ROOT, organizationId, userId, storedFileName);
}

export async function saveEmployeeDocumentFile(input: {
  organizationId: string;
  userId: string;
  storedFileName: string;
  buffer: Buffer;
}): Promise<void> {
  const directory = join(UPLOAD_ROOT, input.organizationId, input.userId);
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, input.storedFileName),
    input.buffer,
  );
}

export async function deleteEmployeeDocumentFile(input: {
  organizationId: string;
  userId: string;
  storedFileName: string;
}): Promise<void> {
  const filePath = getEmployeeDocumentFilePath(
    input.organizationId,
    input.userId,
    input.storedFileName,
  );

  if (!existsSync(filePath)) {
    return;
  }

  await unlink(filePath);
}

export function openEmployeeDocumentFile(input: {
  organizationId: string;
  userId: string;
  storedFileName: string;
}): ReadStream {
  const filePath = getEmployeeDocumentFilePath(
    input.organizationId,
    input.userId,
    input.storedFileName,
  );

  if (!existsSync(filePath)) {
    throw new Error('Document file not found on disk.');
  }

  return createReadStream(filePath);
}
