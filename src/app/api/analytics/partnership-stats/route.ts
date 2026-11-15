import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { analyticsCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';
import { nameKey, normalizeName } from '@/lib/gameLogic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const player1Name = searchParams.get('player1') ? normalizeName(searchParams.get('player1')!) : null;
    const player2Name = searchParams.get('player2') ? normalizeName(searchParams.get('player2')!) : null;
    const year = searchParams.get('year') || 'all';

    // If no players specified, return all unique players
    if (!player1Name || !player2Name) {
      // Check cache for all players
      const cachedPlayers = analyticsCache.get<string[]>(CACHE_KEYS.ALL_PLAYERS);
      if (cachedPlayers) {
        return NextResponse.json({ players: cachedPlayers });
      }

      const players = await sql<{ name: string }[]>`
        SELECT name
        FROM (
          SELECT
            lower(trim(p.name)) AS name_key,
            (array_agg(trim(p.name) ORDER BY length(trim(p.name)) DESC, trim(p.name)))[1] AS name
          FROM players p
          JOIN tournaments t ON p.tournament_id = t.id
          WHERE t.is_finalized = true
          GROUP BY lower(trim(p.name))
        ) deduped
        ORDER BY name_key
      `;
      const playerNames = players.map((p: { name: string }) => p.name);
      
      // Cache the player list
      analyticsCache.set(CACHE_KEYS.ALL_PLAYERS, playerNames, CACHE_TTL);
      
      return NextResponse.json({ players: playerNames });
    }

    // Check cache for partnership stats
    const cacheKey = `${CACHE_KEYS.PARTNERSHIP_STATS(nameKey(player1Name), nameKey(player2Name))}:${year}`;
    const cachedStats = analyticsCache.get(cacheKey);
    if (cachedStats) {
      return NextResponse.json(cachedStats);
    }

    // Find all matches where these two players were partners
    let partnershipMatches;
    if (year === 'all') {
      partnershipMatches = await sql<{
        tournament_id: string;
        match_id: number;
        round: number;
        score_a: number;
        score_b: number;
        winner_team: string;
        team_position: string;
        date: string;
      }[]>`
        SELECT DISTINCT 
          m.tournament_id,
          m.id as match_id,
          m.round,
          m.score_a,
          m.score_b,
          m.winner_team,
          CASE 
            WHEN (lower(trim(p1.name)) = ${nameKey(player1Name)} AND lower(trim(p2.name)) = ${nameKey(player2Name)}) OR 
                 (lower(trim(p1.name)) = ${nameKey(player2Name)} AND lower(trim(p2.name)) = ${nameKey(player1Name)}) THEN 'A'
            WHEN (lower(trim(p3.name)) = ${nameKey(player1Name)} AND lower(trim(p4.name)) = ${nameKey(player2Name)}) OR 
                 (lower(trim(p3.name)) = ${nameKey(player2Name)} AND lower(trim(p4.name)) = ${nameKey(player1Name)}) THEN 'B'
          END as team_position,
          t.date
        FROM matches m
        JOIN tournaments t ON m.tournament_id = t.id
        JOIN players p1 ON m.tournament_id = p1.tournament_id AND m.team_a_p1 = p1.id
        JOIN players p2 ON m.tournament_id = p2.tournament_id AND m.team_a_p2 = p2.id
        JOIN players p3 ON m.tournament_id = p3.tournament_id AND m.team_b_p1 = p3.id
        JOIN players p4 ON m.tournament_id = p4.tournament_id AND m.team_b_p2 = p4.id
        WHERE m.completed = true
          AND t.is_finalized = true
          AND m.winner_team IS NOT NULL
          AND (
            (lower(trim(p1.name)) = ${nameKey(player1Name)} AND lower(trim(p2.name)) = ${nameKey(player2Name)}) OR
            (lower(trim(p1.name)) = ${nameKey(player2Name)} AND lower(trim(p2.name)) = ${nameKey(player1Name)}) OR
            (lower(trim(p3.name)) = ${nameKey(player1Name)} AND lower(trim(p4.name)) = ${nameKey(player2Name)}) OR
            (lower(trim(p3.name)) = ${nameKey(player2Name)} AND lower(trim(p4.name)) = ${nameKey(player1Name)})
          )
        ORDER BY t.date DESC, m.round ASC
      `;
    } else {
      const yearInt = parseInt(year);
      partnershipMatches = await sql<{
        tournament_id: string;
        match_id: number;
        round: number;
        score_a: number;
        score_b: number;
        winner_team: string;
        team_position: string;
        date: string;
      }[]>`
        SELECT DISTINCT 
          m.tournament_id,
          m.id as match_id,
          m.round,
          m.score_a,
          m.score_b,
          m.winner_team,
          CASE 
            WHEN (lower(trim(p1.name)) = ${nameKey(player1Name)} AND lower(trim(p2.name)) = ${nameKey(player2Name)}) OR 
                 (lower(trim(p1.name)) = ${nameKey(player2Name)} AND lower(trim(p2.name)) = ${nameKey(player1Name)}) THEN 'A'
            WHEN (lower(trim(p3.name)) = ${nameKey(player1Name)} AND lower(trim(p4.name)) = ${nameKey(player2Name)}) OR 
                 (lower(trim(p3.name)) = ${nameKey(player2Name)} AND lower(trim(p4.name)) = ${nameKey(player1Name)}) THEN 'B'
          END as team_position,
          t.date
        FROM matches m
        JOIN tournaments t ON m.tournament_id = t.id
        JOIN players p1 ON m.tournament_id = p1.tournament_id AND m.team_a_p1 = p1.id
        JOIN players p2 ON m.tournament_id = p2.tournament_id AND m.team_a_p2 = p2.id
        JOIN players p3 ON m.tournament_id = p3.tournament_id AND m.team_b_p1 = p3.id
        JOIN players p4 ON m.tournament_id = p4.tournament_id AND m.team_b_p2 = p4.id
        WHERE m.completed = true
          AND t.is_finalized = true
          AND m.winner_team IS NOT NULL
          AND EXTRACT(YEAR FROM t.date::date) = ${yearInt}
          AND (
            (lower(trim(p1.name)) = ${nameKey(player1Name)} AND lower(trim(p2.name)) = ${nameKey(player2Name)}) OR
            (lower(trim(p1.name)) = ${nameKey(player2Name)} AND lower(trim(p2.name)) = ${nameKey(player1Name)}) OR
            (lower(trim(p3.name)) = ${nameKey(player1Name)} AND lower(trim(p4.name)) = ${nameKey(player2Name)}) OR
            (lower(trim(p3.name)) = ${nameKey(player2Name)} AND lower(trim(p4.name)) = ${nameKey(player1Name)})
          )
        ORDER BY t.date DESC, m.round ASC
      `;
    }

    if (partnershipMatches.length === 0) {
      const noPartnershipResult = { 
        exists: false, 
        message: "No such partnership" 
      };
      
      // Cache the "no partnership" result too
      analyticsCache.set(cacheKey, noPartnershipResult, CACHE_TTL);
      
      return NextResponse.json(noPartnershipResult);
    }

    // Calculate statistics
    let wins = 0;
    let losses = 0;
    let totalMargin = 0;

    partnershipMatches.forEach((match: {
      tournament_id: string;
      match_id: number;
      round: number;
      score_a: number;
      score_b: number;
      winner_team: string;
      team_position: string;
      date: string;
    }) => {
      const isWin = match.winner_team === match.team_position;
      const partnerScore = match.team_position === 'A' ? match.score_a : match.score_b;
      const opponentScore = match.team_position === 'A' ? match.score_b : match.score_a;
      const margin = partnerScore - opponentScore; // Net margin (positive for wins, negative for losses)

      totalMargin += margin;

      if (isWin) {
        wins++;
      } else {
        losses++;
      }
    });

    const totalGames = wins + losses;
    const winPercentage = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0.0';
    const avgMarginVictory = totalGames > 0 ? (totalMargin / totalGames).toFixed(1) : '0.0';

    const result = {
      exists: true,
      player1: player1Name,
      player2: player2Name,
      stats: {
        totalGames,
        wins,
        losses,
        winPercentage: parseFloat(winPercentage),
        avgMarginVictory: parseFloat(avgMarginVictory)
      },
      matches: partnershipMatches.map((match: {
        tournament_id: string;
        match_id: number;
        round: number;
        score_a: number;
        score_b: number;
        winner_team: string;
        team_position: string;
        date: string;
      }) => ({
        tournamentId: match.tournament_id,
        date: match.date,
        round: match.round,
        partnerScore: match.team_position === 'A' ? match.score_a : match.score_b,
        opponentScore: match.team_position === 'A' ? match.score_b : match.score_a,
        won: match.winner_team === match.team_position
      }))
    };

    // Cache the result
    analyticsCache.set(cacheKey, result, CACHE_TTL);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Partnership stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partnership statistics' },
      { status: 500 }
    );
  }
}
