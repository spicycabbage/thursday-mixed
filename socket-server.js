// Simple Socket.IO server to broadcast tournament updates across viewers
// Run locally: node socket-server.js (uses PORT 4000 by default)

const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 4000;

const tournamentsById = new Map();

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
  });
  res.end('Socket server is running.\n');
});

const io = new Server(server, {
  cors: {
    origin: '*',
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
