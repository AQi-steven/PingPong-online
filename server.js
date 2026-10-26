/**
 * 《乒乓》(PING PONG) 桌游电子版 - 手机一体式联机服务端 (HTTP静态服务 + WebSocket联机)
 *
 * 启动方式：
 *   1. npm install ws
 *   2. node server.js
 *   3. 大家各自用手机浏览器直接打开 http://你的服务器IP:8080 即可自动连上联机大厅，输入4位房间号同台对战！
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      name: 'Ping Pong Card Game Online Server',
      status: 'running',
      rooms: rooms.size,
      time: new Date().toISOString()
    }));
  }

  const htmlPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(htmlPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(htmlPath).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('PingPong WebSocket Server Running');
  }
});

const wss = new WebSocket.Server({ server });
const rooms = new Map();

function broadcastRoom(room, payload) {
  const msg = JSON.stringify(payload);
  for (const p of room.players) {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(msg);
    }
  }
}

function getPublicRoomInfo(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    mode: room.mode,
    targetScore: room.targetScore,
    deuceMode: room.deuceMode,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      isAI: !!p.isAI,
      online: p.isAI ? true : (p.ws && p.ws.readyState === WebSocket.OPEN)
    })),
    hasStarted: !!room.state
  };
}

wss.on('connection', (ws) => {
  let currentRoomCode = null;
  let currentPlayerId = null;

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch (e) { return; }

    if (data.type === 'CREATE_ROOM') {
      const code = (data.roomCode || '8888').toUpperCase();
      const playerId = data.playerId || ('p_' + Math.random().toString(36).slice(2, 9));
      const room = {
        code,
        hostId: playerId,
        mode: data.mode || '1v1',
        targetScore: data.targetScore || 11,
        deuceMode: data.deuceMode !== false,
        players: [{ id: playerId, name: data.playerName || '玩家1', seat: 0, isAI: false, ws }],
        state: null
      };
      rooms.set(code, room);
      currentRoomCode = code;
      currentPlayerId = playerId;
      ws.send(JSON.stringify({ type: 'ROOM_JOINED', playerId, seat: 0, room: getPublicRoomInfo(room) }));
    }

    else if (data.type === 'JOIN_ROOM') {
      const code = (data.roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        ws.send(JSON.stringify({ type: 'ERROR', message: '未找到房间 #' + code }));
        return;
      }
      let existing = room.players.find(p => p.id === data.playerId);
      if (existing) {
        existing.ws = ws;
        existing.name = data.playerName || existing.name;
        currentRoomCode = code;
        currentPlayerId = existing.id;
        ws.send(JSON.stringify({ type: 'ROOM_JOINED', playerId: existing.id, seat: existing.seat, room: getPublicRoomInfo(room), state: room.state }));
        broadcastRoom(room, { type: 'ROOM_UPDATED', room: getPublicRoomInfo(room) });
        return;
      }

      const maxSeats = room.mode === '2v2' ? 4 : 2;
      const takenSeats = new Set(room.players.map(p => p.seat));
      let freeSeat = -1;
      for (let i = 0; i < maxSeats; i++) {
        if (!takenSeats.has(i)) { freeSeat = i; break; }
      }
      if (freeSeat === -1) {
        const aiIdx = room.players.findIndex(p => p.isAI);
        if (aiIdx !== -1 && !room.state) {
          freeSeat = room.players[aiIdx].seat;
          room.players.splice(aiIdx, 1);
        } else {
          ws.send(JSON.stringify({ type: 'ERROR', message: '房间人数已满' }));
          return;
        }
      }

      const playerId = data.playerId || ('p_' + Math.random().toString(36).slice(2, 9));
      room.players.push({
        id: playerId,
        name: data.playerName || ('玩家' + (freeSeat + 1)),
        seat: freeSeat,
        isAI: false,
        ws
      });
      room.players.sort((a, b) => a.seat - b.seat);
      currentRoomCode = code;
      currentPlayerId = playerId;

      ws.send(JSON.stringify({ type: 'ROOM_JOINED', playerId, seat: freeSeat, room: getPublicRoomInfo(room), state: room.state }));
      broadcastRoom(room, { type: 'ROOM_UPDATED', room: getPublicRoomInfo(room) });
    }

    else if (data.type === 'FILL_AI') {
      const room = rooms.get(currentRoomCode);
      if (!room) return;
      const maxSeats = room.mode === '2v2' ? 4 : 2;
      const takenSeats = new Set(room.players.map(p => p.seat));
      for (let i = 0; i < maxSeats; i++) {
        if (!takenSeats.has(i)) {
          room.players.push({ id: 'ai_' + i, name: 'AI' + (i + 1), seat: i, isAI: true, ws: null });
        }
      }
      room.players.sort((a, b) => a.seat - b.seat);
      broadcastRoom(room, { type: 'ROOM_UPDATED', room: getPublicRoomInfo(room) });
    }

    else if (data.type === 'SYNC_STATE') {
      const room = rooms.get(currentRoomCode);
      if (!room) return;
      room.state = data.state;
      broadcastRoom(room, { type: 'STATE_SYNCED', state: room.state, actorId: currentPlayerId });
    }
  });

  ws.on('close', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    broadcastRoom(room, { type: 'ROOM_UPDATED', room: getPublicRoomInfo(room) });
  });
});

server.listen(PORT, () => {
  console.log(`[PingPong Mobile Server] Running at http://0.0.0.0:${PORT} (WebSocket enabled)`);
});
