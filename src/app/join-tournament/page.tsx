import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import { PageCard, PageContent, PageHeader, PageShell, PageTitleBlock } from '@/components/PageShell';
import { sql } from '@/lib/db';
import { eventTypeOf } from '@/lib/gameLogic';

export const dynamic = 'force-dynamic';

export default async function JoinTournamentPage() {
  let open: { id: string; name: string; eventType: string }[] = [];
  try {
    const rows = await sql<{ id: string; name: string; event_type: string }[]>`
      select id, name, event_type from tournaments
      where is_finalized = false
      order by created_at desc`;
    open = rows.map((row) => ({
      id: row.id,
      name: row.name ?? '',
      eventType: eventTypeOf(row.event_type),
    }));
  } catch {
    open = [];
  }

  if (open.length === 1) redirect(`/tournament/${open[0].id}`);

  return (
    <PageShell>
      <PageCard>
        <PageHeader title="Join Tournament" icon={<UserGroupIcon className="w-5 h-5" />} />
        <PageContent>
          {open.length === 0 ? (
            <>
              <PageTitleBlock title="No open tournament" subtitle="Nothing is in progress right now." />
              <Link href="/" className="app-btn-action block text-center no-underline">
                Back to lobby
              </Link>
            </>
          ) : (
            <>
              <PageTitleBlock title="Choose a tournament" subtitle="More than one event is in progress." />
              <div className="space-y-3">
                {open.map((tournament) => (
                  <Link
                    key={tournament.id}
                    href={`/tournament/${tournament.id}`}
                    className="app-btn-success block text-center no-underline"
                  >
                    {tournament.eventType} · {tournament.name.trim() || 'Open tournament'}
                  </Link>
                ))}
              </div>
            </>
          )}
        </PageContent>
      </PageCard>
    </PageShell>
  );
}
