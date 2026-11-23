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
    // Fluid Compute serves concurrent requests from one instance; a single
    // connection makes every poll queue behind the slowest write.
    max: 4,
    idle_timeout: 20,
    max_lifetime: 60 * 5,
    connect_timeout: 8,
    prepare: false,
    fetch_types: false,
  });
}

export const sql = createSqlClient();

let schemaReady: Promise<void> | null = null;

const SCHEMA_SQL = `
create table if not exists tournaments (
  id text primary key,
  access_code text not null default '',
  date text not null,
  current_round int not null default 1,
  is_finalized boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists players (
  tournament_id text not null,
  id int not null,
  name text not null,
  team_id int not null default 1,
  total_score int not null default 0,
  primary key (tournament_id, id),
  foreign key (tournament_id) references tournaments(id) on delete cascade
);
create table if not exists matches (
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
);
alter table matches add column if not exists winner_team text;
alter table matches add column if not exists queue_order int not null default 0;
alter table matches add column if not exists finish_order int not null default 0;
alter table matches add column if not exists streak_a int not null default 0;
alter table matches add column if not exists streak_b int not null default 0;
alter table matches add column if not exists court int not null default 1;
alter table matches add column if not exists team_a_id int not null default 1;
alter table matches add column if not exists team_b_id int not null default 2;
alter table players add column if not exists team_id int not null default 1;
alter table tournaments enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
create index if not exists idx_players_tournament_name on players(tournament_id, name);
create index if not exists idx_matches_tournament_completed on matches(tournament_id, completed);
create index if not exists idx_matches_players on matches(tournament_id, team_a_p1, team_a_p2, team_b_p1, team_b_p2);
create index if not exists idx_tournaments_finalized on tournaments(is_finalized);
create index if not exists idx_matches_winner on matches(tournament_id, winner_team, completed);
create index if not exists idx_tournaments_date on tournaments(date);
create index if not exists idx_tournaments_finalized_date on tournaments(is_finalized, date);
alter table tournaments add column if not exists event_type text not null default 'XD';
alter table tournaments add column if not exists name text not null default '';
`;

const TOURNAMENT_META_SQL = `
alter table tournaments add column if not exists event_type text not null default 'XD';
alter table tournaments add column if not exists name text not null default '';
alter table matches add column if not exists queue_order int not null default 0;
alter table matches add column if not exists finish_order int not null default 0;
alter table matches add column if not exists streak_a int not null default 0;
alter table matches add column if not exists streak_b int not null default 0;
alter table tournaments add column if not exists court_numbers int[];
alter table tournaments add column if not exists started_at timestamptz;
alter table matches add column if not exists started_at timestamptz;
alter table matches add column if not exists ended_at timestamptz;
alter table matches add column if not exists match_number int not null default 0;
`;

let metaReady: Promise<void> | null = null;

function statementsOf(sqlText: string): string[] {
  return sqlText
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

// One statement per round trip. A multi-statement script through the
// transaction pooler can wedge the only connection and hang every later request.
async function runStatements(sqlText: string): Promise<void> {
  for (const statement of statementsOf(sqlText)) {
    await sql.unsafe(statement);
  }
}

const META_COLUMN_COUNT = 11;

// ALTER TABLE takes an ACCESS EXCLUSIVE lock even when the column already exists,
// so cold starts check the catalog first and only migrate when something is missing.
// Keep the column list in sync with TOURNAMENT_META_SQL.
async function schemaState(): Promise<{ schemaOk: boolean; metaOk: boolean }> {
  const [row] = await sql<{ schema_ok: boolean; meta_cols: number }[]>`
    select
      to_regclass('public.idx_tournaments_finalized_date') is not null as schema_ok,
      (
        select count(*)::int
        from information_schema.columns
        where table_schema = 'public'
          and (table_name, column_name) in (
            ('tournaments', 'event_type'),
            ('tournaments', 'name'),
            ('tournaments', 'court_numbers'),
            ('matches', 'queue_order'),
            ('matches', 'finish_order'),
            ('matches', 'streak_a'),
            ('matches', 'streak_b'),
            ('tournaments', 'started_at'),
            ('matches', 'started_at'),
            ('matches', 'ended_at'),
            ('matches', 'match_number')
          )
      ) as meta_cols
  `;
  const metaOk = Number(row?.meta_cols ?? 0) === META_COLUMN_COUNT;
  return { schemaOk: !!row?.schema_ok && metaOk, metaOk };
}

export function ensureTournamentMeta(): Promise<void> {
  if (metaReady) return metaReady;
  metaReady = schemaState()
    .then(({ metaOk }) => (metaOk ? undefined : runStatements(TOURNAMENT_META_SQL)))
    .then(
    () => undefined,
    (error: unknown) => {
      metaReady = null;
      throw error;
    }
  );
  return metaReady;
}

export function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = schemaState()
    .then(async ({ schemaOk }) => {
      if (schemaOk) return;
      await runStatements(SCHEMA_SQL);
      await runStatements(TOURNAMENT_META_SQL);
    })
    .then(
    () => undefined,
    (error: unknown) => {
      schemaReady = null;
      throw error;
    }
  );
  return schemaReady;
}

export type DbTournamentRow = {
  id: string;
  access_code: string;
  name: string;
  event_type: string;
  date: string;
  current_round: number;
  is_finalized: boolean;
  created_at: string;
  court_numbers?: number[] | null;
  started_at?: string | Date | null;
};
