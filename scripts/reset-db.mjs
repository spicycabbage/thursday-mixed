import fs from 'fs';
import postgres from 'postgres';

const envPath = process.argv[2] || '.env.production.local';
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      const key = line.slice(0, index);
      let value = line.slice(index + 1);
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      return [key, value];
    })
);

const databaseUrl =
  env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL || env.DATABASE_URL;
if (!databaseUrl) {
  console.error('POSTGRES_URL not found in', envPath);
  process.exit(1);
}

const sql = postgres(databaseUrl, { ssl: 'require', max: 1 });

try {
  const before = await sql`
    select
      (select count(*)::int from tournaments) as tournaments,
      (select count(*)::int from players) as players,
      (select count(*)::int from matches) as matches
  `;
  console.log('Before:', before[0]);

  await sql`truncate table matches, players, tournaments restart identity cascade`;

  const after = await sql`
    select
      (select count(*)::int from tournaments) as tournaments,
      (select count(*)::int from players) as players,
      (select count(*)::int from matches) as matches
  `;
  console.log('After:', after[0]);
} finally {
  await sql.end();
}
