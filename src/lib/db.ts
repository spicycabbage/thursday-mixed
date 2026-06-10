import postgres from 'postgres';

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.NEON_DATABASE_URL;

function createSqlClient() {
  if (!databaseUrl) {
    const missing = (async () => {
      throw new Error('DATABASE_URL not set');
    }) as unknown as ReturnType<typeof postgres>;
    return missing;
  }

  return postgres(databaseUrl, {
    ssl: 'require',
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export const sql = createSqlClient();

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await sql`create table if not exists tournaments (
      id text primary key,
      access_code text not null default '',
      date text not null,
      current_round int not null default 1,
      is_finalized boolean not null default false,
      created_at timestamptz not null default now()
    )`;

    await sql`create table if not exists players (
      tournament_id text not null,
      id int not null,
      name text not null,
      team_id int not null default 1,
      total_score int not null default 0,
      primary key (tournament_id, id),
      foreign key (tournament_id) references tournaments(id) on delete cascade
    )`;

    await sql`create table if not exists matches (
      tournament_id text not null,
      id int not null,
      round int not null,
      court int not null default 1,
      team_a_id int not null default 1,
      team_b_id int not null default 2,
      team_a_p1 int not null,
      team_a_p2 int not null,
      team_b_p1 int not null,
      team_b_p2 int not null,
      score_a int,
      score_b int,
      completed boolean not null default false,
      winner_team text,
      primary key (tournament_id, id),
      foreign key (tournament_id) references tournaments(id) on delete cascade
    )`;

    try {
      await sql`alter table matches add column if not exists winner_team text`;
      await sql`alter table matches add column if not exists court int not null default 1`;
      await sql`alter table matches add column if not exists team_a_id int not null default 1`;
      await sql`alter table matches add column if not exists team_b_id int not null default 2`;
      await sql`alter table players add column if not exists team_id int not null default 1`;
    } catch {
      // Columns might already exist
    }

    await sql`alter table tournaments enable row level security`;
    await sql`alter table players enable row level security`;
    await sql`alter table matches enable row level security`;

    try {
      await sql`create index if not exists idx_players_tournament_name on players(tournament_id, name)`;
      await sql`create index if not exists idx_matches_tournament_completed on matches(tournament_id, completed)`;
      await sql`create index if not exists idx_matches_players on matches(tournament_id, team_a_p1, team_a_p2, team_b_p1, team_b_p2)`;
      await sql`create index if not exists idx_tournaments_finalized on tournaments(is_finalized)`;
      await sql`create index if not exists idx_matches_winner on matches(tournament_id, winner_team, completed)`;
      await sql`create index if not exists idx_tournaments_date on tournaments(date)`;
      await sql`create index if not exists idx_tournaments_finalized_date on tournaments(is_finalized, date)`;
    } catch {
      // Indexes might already exist
    }
  })();
  return schemaReady;
}

export type DbTournamentRow = {
  id: string;
  access_code: string;
  date: string;
  current_round: number;
  is_finalized: boolean;
  created_at: string;
};
