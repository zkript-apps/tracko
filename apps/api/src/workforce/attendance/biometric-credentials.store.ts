import { randomBytes } from 'crypto';
import { getMongoDb } from '../../database/mongo';

export interface BiometricCredential {
  _id: string;
  organizationId: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  deviceType: string;
  backedUp: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

const COLLECTION = 'biometric_credentials';

function createId(): string {
  return randomBytes(12).toString('hex');
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<BiometricCredential>(COLLECTION);
}

export async function listBiometricCredentialsForUser(
  organizationId: string,
  userId: string,
): Promise<BiometricCredential[]> {
  const collection = await getCollection();
  return collection
    .find({
      organizationId: String(organizationId),
      userId: String(userId),
    })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function findBiometricCredentialByCredentialId(
  credentialId: string,
): Promise<BiometricCredential | null> {
  const collection = await getCollection();
  return collection.findOne({ credentialId });
}

export async function createBiometricCredential(input: {
  organizationId: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  deviceType: string;
  backedUp: boolean;
}): Promise<BiometricCredential> {
  const collection = await getCollection();
  const credential: BiometricCredential = {
    _id: createId(),
    organizationId: input.organizationId,
    userId: input.userId,
    credentialId: input.credentialId,
    publicKey: input.publicKey,
    counter: input.counter,
    transports: input.transports,
    deviceType: input.deviceType,
    backedUp: input.backedUp,
    createdAt: new Date(),
  };

  await collection.insertOne(credential);
  return credential;
}

export async function updateBiometricCredentialCounter(input: {
  credentialId: string;
  counter: number;
}): Promise<void> {
  const collection = await getCollection();
  await collection.updateOne(
    { credentialId: input.credentialId },
    {
      $set: {
        counter: input.counter,
        lastUsedAt: new Date(),
      },
    },
  );
}

export async function deleteBiometricCredentialsForUser(
  organizationId: string,
  userId: string,
): Promise<number> {
  const collection = await getCollection();
  const result = await collection.deleteMany({
    organizationId: String(organizationId),
    userId: String(userId),
  });
  return result.deletedCount ?? 0;
}

export function serializeBiometricStatus(
  credentials: BiometricCredential[],
): {
  enrolled: boolean;
  credentialCount: number;
  lastUsedAt: string | null;
} {
  const lastUsedAt = credentials.reduce<Date | null>((latest, credential) => {
    if (!credential.lastUsedAt) {
      return latest;
    }

    if (!latest || credential.lastUsedAt > latest) {
      return credential.lastUsedAt;
    }

    return latest;
  }, null);

  return {
    enrolled: credentials.length > 0,
    credentialCount: credentials.length,
    lastUsedAt: lastUsedAt?.toISOString() ?? null,
  };
}
