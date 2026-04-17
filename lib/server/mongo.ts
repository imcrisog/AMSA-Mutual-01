import "server-only";

import { MongoClient } from "mongodb";

declare global {
  var __mongoClient: MongoClient | undefined;
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function getDbName() {
  return process.env.DB_NAME || "torneo-app";
}

export function getMongoClient(): MongoClient {
  const uri = requiredEnv("MONGODB_URI");

  if (!globalThis.__mongoClient) {
    globalThis.__mongoClient = new MongoClient(uri);
  }
  return globalThis.__mongoClient;
}

export async function getMongoDb() {
  const client = getMongoClient();
  // The MongoDB driver internally caches connections per-client.
  await client.connect();
  return client.db(getDbName());
}
