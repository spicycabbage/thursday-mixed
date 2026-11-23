import { after, NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminSecret, hasAdminCookie } from '@/lib/adminAuth';
import { sql } from '@/lib/db';
import { assembleTournament, persistMatchCourts, snapshotMatchCourts } from '@/lib/tournamentRepo';
import { normalizeCourtNumbers, relabelCourtNumbers, toPgIntArray } from '@/lib/gameLogic';
import { broadcastTournamentUpdate } from '@/lib/realtime/server';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const tournament = await assembleTournament(id);
    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }
    
    return NextResponse.json(tournament);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const secret = adminSecret();
    if (!secret || !hasAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value, secret)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 401 });
    }

    const { id } = await params;

    // Delete the tournament (cascade will handle players and matches)
    await sql`delete from tournaments where id=${id}`;

    return NextResponse.json({ success: true, message: 'Tournament deleted successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const secret = adminSecret();
    if (!secret || !hasAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value, secret)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const tournament = await assembleTournament(id);
    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const courtNumbers = normalizeCourtNumbers(body?.courtNumbers, tournament.teams.length);
    if (!courtNumbers) {
      return NextResponse.json({ error: 'Enter a unique court number for each court' }, { status: 400 });
    }

    const before = snapshotMatchCourts(tournament.matches);
    relabelCourtNumbers(tournament, courtNumbers);
    await sql`update tournaments set court_numbers = ${toPgIntArray(courtNumbers)}::int[] where id = ${id}`;
    await persistMatchCourts(id, tournament.matches, before);

    const updated = await assembleTournament(id);
    if (updated) after(() => broadcastTournamentUpdate(id, updated));
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}
