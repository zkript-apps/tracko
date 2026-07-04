import { MongoClient } from 'mongodb';

declare global {
  // eslint-disable-next-line no-var
  var __trackoMongoClient: MongoClient | undefined;
}

function getMongoUri(): string {
  return (
    process.env.MONGODB_URI ??
    'mongodb://tracko:tracko_dev_password@localhost:27017/tracko?authSource=admin'
  );
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!global.__trackoMongoClient) {
    global.__trackoMongoClient = new MongoClient(getMongoUri());
    await global.__trackoMongoClient.connect();
  }

  return global.__trackoMongoClient;
}

export async function getMongoDb() {
  const client = await getMongoClient();
  return client.db();
}
