import { randomBytes } from 'crypto';
import { getMongoDb } from '../../database/mongo';

export const DOCUMENT_CATEGORIES = [
  'contract',
  'government_id',
  'clearance',
  'certificate',
  'other',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export interface EmployeeDocument {
  _id: string;
  organizationId: string;
  userId: string;
  title: string;
  category: DocumentCategory;
  notes?: string;
  referenceUrl?: string;
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  storedFileName?: string;
  createdBy: string;
  createdAt: Date;
}

const COLLECTION = 'employee_documents';

function createId(): string {
  return randomBytes(12).toString('hex');
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<EmployeeDocument>(COLLECTION);
}

export async function listEmployeeDocuments(
  organizationId: string,
  userId: string,
): Promise<EmployeeDocument[]> {
  const collection = await getCollection();
  return collection
    .find({
      organizationId: String(organizationId),
      userId: String(userId),
    })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function findEmployeeDocument(input: {
  organizationId: string;
  userId: string;
  documentId: string;
}): Promise<EmployeeDocument | null> {
  const collection = await getCollection();
  return collection.findOne({
    _id: input.documentId,
    organizationId: String(input.organizationId),
    userId: String(input.userId),
  });
}

export async function createEmployeeDocument(input: {
  organizationId: string;
  userId: string;
  title: string;
  category: DocumentCategory;
  notes?: string;
  referenceUrl?: string;
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  storedFileName?: string;
  createdBy: string;
}): Promise<EmployeeDocument> {
  const collection = await getCollection();
  const document: EmployeeDocument = {
    _id: createId(),
    organizationId: input.organizationId,
    userId: input.userId,
    title: input.title.trim(),
    category: input.category,
    notes: input.notes?.trim() || undefined,
    referenceUrl: input.referenceUrl?.trim() || undefined,
    fileName: input.fileName,
    fileMimeType: input.fileMimeType,
    fileSize: input.fileSize,
    storedFileName: input.storedFileName,
    createdBy: input.createdBy,
    createdAt: new Date(),
  };

  await collection.insertOne(document);
  return document;
}

export async function setEmployeeDocumentStoredFileName(input: {
  organizationId: string;
  userId: string;
  documentId: string;
  storedFileName: string;
}): Promise<void> {
  const collection = await getCollection();
  await collection.updateOne(
    {
      _id: input.documentId,
      organizationId: String(input.organizationId),
      userId: String(input.userId),
    },
    { $set: { storedFileName: input.storedFileName } },
  );
}

export async function deleteEmployeeDocument(input: {
  organizationId: string;
  userId: string;
  documentId: string;
}): Promise<boolean> {
  const collection = await getCollection();
  const result = await collection.deleteOne({
    _id: input.documentId,
    organizationId: String(input.organizationId),
    userId: String(input.userId),
  });
  return result.deletedCount > 0;
}

export function serializeEmployeeDocument(document: EmployeeDocument) {
  return {
    id: document._id,
    userId: document.userId,
    title: document.title,
    category: document.category,
    notes: document.notes ?? null,
    referenceUrl: document.referenceUrl ?? null,
    fileName: document.fileName ?? null,
    fileMimeType: document.fileMimeType ?? null,
    fileSize: document.fileSize ?? null,
    hasFile: Boolean(document.storedFileName),
    createdBy: document.createdBy,
    createdAt: document.createdAt.toISOString(),
  };
}
