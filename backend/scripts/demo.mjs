import 'dotenv/config';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.env.NODE_ENV === 'production')
  throw new Error('The local demo cannot run in production.');
const dataDir = resolve(process.env.DATA_DIR ?? '.data');
await mkdir(dataDir, { recursive: true });
const port = Number(process.env.DEMO_DATABASE_PORT ?? 5433);
const database = await PGlite.create({
  dataDir: resolve(dataDir, 'postgres'),
  database: 'template1',
  relaxedDurability: false,
});
await database.exec(
  "ALTER ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'postgres'",
);
const socket = new PGLiteSocketServer({
  db: database,
  port,
  host: '127.0.0.1',
  maxConnections: 20,
});
try {
  await socket.start();
} catch (error) {
  await database.close();
  throw error;
}

const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/template1?sslmode=disable`;
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  DEMO_MODE: 'true',
  DATA_DIR: dataDir,
};
await writeFile(
  resolve(dataDir, 'demo-runtime.json'),
  JSON.stringify({ databaseUrl, port }, null, 2),
);
console.log(
  `Local PostgreSQL is running on 127.0.0.1:${port}; data persists in ${dataDir}.`,
);

let child;
let stopping = false;
async function close() {
  if (stopping) return;
  stopping = true;
  child?.kill('SIGTERM');
  if (child && child.exitCode === null)
    await new Promise((done) => child.once('exit', done));
  await socket.stop();
  await database.syncToFs();
  await database.close();
}
process.once('SIGINT', () => {
  void close();
});
process.once('SIGTERM', () => {
  void close();
});

async function run(script, args) {
  if (stopping) throw new Error('Demo stopped');
  child = spawn(process.execPath, [script, ...args], { env, stdio: 'inherit' });
  const code = await new Promise((done, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => done(code ?? 1));
  });
  child = undefined;
  if (code !== 0 && !stopping)
    throw new Error(`Command ${script} failed with exit code ${code}`);
}

try {
  await run('node_modules/prisma/build/index.js', ['generate']);
  await run('node_modules/prisma/build/index.js', ['migrate', 'deploy']);
  if (process.argv.includes('--test')) {
    await run('node_modules/vitest/vitest.mjs', [
      'run',
      '--config',
      'vitest.config.e2e.ts',
    ]);
  } else {
    await run('node_modules/@nestjs/cli/bin/nest.js', ['build']);
    console.log(
      `Demo API: http://localhost:${env.PORT ?? 3000}/v1 · accounts: Alex and Sam`,
    );
    await run('dist/main.js', []);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await close();
}
