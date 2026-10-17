// Simple Socket.IO server to broadcast tournament updates across viewers
// Run locally: node socket-server.js (uses PORT 4000 by default)

const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 4000;

const tournamentsById = new Map();

// Only the app's own origins may connect. Extra origins (comma-separated) can be
// added with SOCKET_ALLOWED_ORIGINS, e.g. a custom domain.
const ALLOWED_ORIGINS = new Set([
  'https://thursday-mixed.vercel.app',
  'http://localhost:3000',
  ...(process.env.SOCKET_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
]);
const PREVIEW_ORIGIN = /^https:\/\/thursday-mixed-[a-z0-9-]+\.vercel\.app$/;

function isAllowedOrigin(origin) {
  return !!origin && (ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN.test(origin));
}

const server = http.createServer((req, res) => {
  const headers = { 'Content-Type': 'text/plain', Vary: 'Origin' };
  if (isAllowedOrigin(req.headers.origin)) {
    headers['Access-Control-Allow-Origin'] = req.headers.origin;
  }
  res.writeHead(200, headers);
  res.end('Socket server is running.\n');
});

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Non-browser clients send no Origin header; allow those.
      if (!origin || isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed'), false);
    },
    methods: ['GET', 'POST'],
  },
});

function getRoomName(tournamentId) {
  return `tournament:${tournamentId}`;
}

io.on('connection', (socket) => {
  socket.on('create-tournament', (tournament) => {
    if (!tournament?.id) return;
    tournamentsById.set(tournament.id, tournament);

    const room = getRoomName(tournament.id);
    socket.join(room);
    io.to(room).emit('tournament:sync', tournament);
  });

  socket.on('join-tournament', (tournamentId) => {
    if (!tournamentId) return;
    const room = getRoomName(tournamentId);
    socket.join(room);
    const tournament = tournamentsById.get(tournamentId);
    if (tournament) {
      socket.emit('tournament:sync', tournament);
    }
  });

  socket.on('tournament:update', (payload) => {
    const tournament = payload?.tournament ?? payload;
    if (!tournament?.id) return;
    tournamentsById.set(tournament.id, tournament);

    const room = getRoomName(tournament.id);
    io.to(room).emit('tournament:sync', tournament);

    const update = payload?.update;
    if (update && typeof update === 'object') {
      socket.to(room).emit('toast:score', {
        matchId: update.matchId,
        round: update.round,
        scoreA: update.scoreA,
        scoreB: update.scoreB,
        ts: Date.now(),
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Socket server listening on port ${PORT}`);
});
