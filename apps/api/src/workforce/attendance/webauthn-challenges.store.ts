import { randomBytes } from 'crypto';
import { getMongoDb } from '../../database/mongo';

export type WebAuthnChallengeType = 'registration' | 'authentication';

export interface WebAuthnChallenge {
  _id: string;
  userId: string;
  challenge: string;
  type: WebAuthnChallengeType;
  expiresAt: Date;
  createdAt: Date;
}

const COLLECTION = 'webauthn_challenges';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function createId(): string {
  return randomBytes(12).toString('hex');
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<WebAuthnChallenge>(COLLECTION);
}

export async function createWebAuthnChallenge(input: {
  userId: string;
  challenge: string;
  type: WebAuthnChallengeType;
}): Promise<WebAuthnChallenge> {
  const collection = await getCollection();
  const now = new Date();
  const record: WebAuthnChallenge = {
    _id: createId(),
    userId: input.userId,
    challenge: input.challenge,
    type: input.type,
    expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
    createdAt: now,
  };

  await collection.deleteMany({
    userId: input.userId,
    type: input.type,
  });
  await collection.insertOne(record);
  return record;
}

export async function consumeLatestWebAuthnChallenge(input: {
  userId: string;
  type: WebAuthnChallengeType;
}): Promise<WebAuthnChallenge | null> {
  const collection = await getCollection();
  const record = await collection.findOne(
    {
      userId: input.userId,
      type: input.type,
      expiresAt: { $gt: new Date() },
    },
    { sort: { createdAt: -1 } },
  );

  if (!record) {
    return null;
  }

  await collection.deleteOne({ _id: record._id });
  return record;
}
