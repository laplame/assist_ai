import { createServer } from 'node:http';
import { corsOrigins, loadEnv } from './config/env';
import { buildContainer } from './composition/container';
import { createApp } from './infrastructure/http/createApp';
import { connectMongo, disconnectMongo } from './infrastructure/persistence/mongoose/connection';
import { seedReferencia } from './v1/seed';

async function main(): Promise<void> {
  const env = loadEnv();
  await connectMongo(env.MONGODB_URI);
  await seedReferencia();
  const firebaseListo = Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
  const container = firebaseListo ? buildContainer(env, corsOrigins(env)) : null;
  const app = createApp(container, corsOrigins(env));
  const server = createServer(app);

  server.listen(env.PORT, () => {
    console.log(`API lista en http://localhost:${env.PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectMongo();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
