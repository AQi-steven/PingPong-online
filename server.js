/**
 * 《乒乓》(PING PONG) 桌游电子版 - 手机一体式联机服务端 (HTTP静态服务 + WebSocket联机)
 *
 * 启动方式：
 *   1. npm install ws
 *   2. node server.js
 *   3. 大家各自用手机浏览器直接打开 http://你的服务器IP:8080 即可自动连上联机大厅，输入4位房间号同台对战！
 *
 * 加固记录（本版相对原版）：
 *   ① 修复 CREATE_ROOM 撞码被静默覆盖（两人同填 8888 会顶掉先来的）→ 改为加入已有房间
 *   ② 修复 ws 断线不回收（玩家对象永留数组、空房间永不删，内存泄漏）→ 真正移除玩家 + 删空房间 + 重派 host
 *   ③ 静态文件按扩展名返回（原版所有请求都返 index.html，本地化 Tailwind 后 ./vendor/tailwind.js 取不到）→ 配套修复
 *   ④ 30s 心跳：清理半开/掉线连接（手机网络尤需）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

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

  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  // 防目录穿越
  const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=300' });
    res.end(data);
  });
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
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch (e) { return; }

    if (data.type === 'CREATE_ROOM') {
      const code = (data.roomCode || '8888').toUpperCase();
      const playerId = data.playerId || ('p_' + Math.random().toString(36).slice(2, 9));
      let room = rooms.get(code);
      let seat;
      if (!room) {
        seat = 0;
        room = {
          code,
          hostId: playerId,
          mode: data.mode || '1v1',
          targetScore: data.targetScore || 11,
          deuceMode: data.deuceMode !== false,
          players: [{ id: playerId, name: data.playerName || '玩家1', seat: 0, isAI: false, ws }],
          state: null
        };
        rooms.set(code, room);
      } else {
        // 修复①：房间已存在则加入，不再静默覆盖（撞码顶人）
        const maxSeats = room.mode === '2v2' ? 4 : 2;
        const takenSeats = new Set(room.players.map(p => p.seat));
        let freeSeat = -1;
        for (let i = 0; i < maxSeats; i++) { if (!takenSeats.has(i)) { freeSeat = i; break; } }
        if (freeSeat === -1) {
          const aiIdx = room.players.findIndex(p => p.isAI);
          if (aiIdx !== -1 && !room.state) { freeSeat = room.players[aiIdx].seat; room.players.splice(aiIdx, 1); }
          else { ws.send(JSON.stringify({ type: 'ERROR', message: '房间人数已满' })); return; }
        }
        seat = freeSeat;
        room.players.push({ id: playerId, name: data.playerName || ('玩家' + (freeSeat + 1)), seat: freeSeat, isAI: false, ws });
        room.players.sort((a, b) => a.seat - b.seat);
      }
      currentRoomCode = code;
      currentPlayerId = playerId;
      ws.send(JSON.stringify({ type: 'ROOM_JOINED', playerId, seat, room: getPublicRoomInfo(room) }));
      if (room.players.length > 1) broadcastRoom(room, { type: 'ROOM_UPDATED', room: getPublicRoomInfo(room) });
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

    else if (data.type === 'CHANGE_SEAT') {
      // 换座（2026-10-26 新增）：玩家在开局前可点空位改坐哪
      const room = rooms.get(currentRoomCode);
      if (!room) return;
      if (!currentPlayerId) return;
      // 开局后锁定：座位决定 A→C→B→D 接球顺序与红黑队伍，中途换会让全场错乱
      if (room.state) {
        ws.send(JSON.stringify({ type: 'ERROR', message: '对局已开始，座位已锁定' }));
        return;
      }
      const target = parseInt(data.seat, 10);
      const maxSeats = room.mode === '2v2' ? 4 : 2;
      if (!(target >= 0 && target < maxSeats)) {
        ws.send(JSON.stringify({ type: 'ERROR', message: '无效座位' }));
        return;
      }
      const me = room.players.find(p => p.id === currentPlayerId);
      if (!me) return;
      if (me.seat === target) return;                    // 已是该位，无需变更
      const occupant = room.players.find(p => p.seat === target);
      if (occupant && occupant.isAI && !room.state) {
        // 目标是 AI 占位 → 顶掉 AI（与"真人加入时顶替 AI"同规则）
        room.players.splice(room.players.indexOf(occupant), 1);
      } else if (occupant) {
        // 目标位已被真人占用 → 拒绝（并回传最新房间信息让前端刷新）
        ws.send(JSON.stringify({ type: 'ERROR', message: '该座位已被占用', room: getPublicRoomInfo(room) }));
        broadcastRoom(room, { type: 'ROOM_UPDATED', room: getPublicRoomInfo(room) });
        return;
      }
      me.seat = target;
      room.players.sort((a, b) => a.seat - b.seat);
      // 换座后回传本人新座位号 + 全员刷新
      ws.send(JSON.stringify({ type: 'SEAT_CHANGED', playerId: currentPlayerId, seat: target, room: getPublicRoomInfo(room) }));
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
    // 修复②：断线真正回收玩家；空房间 或 已无真人(只剩AI孤儿房) 都删除（防内存泄漏）
    const idx = room.players.findIndex(p => p.id === currentPlayerId);
    if (idx !== -1) room.players.splice(idx, 1);
    const hasHuman = room.players.some(p => !p.isAI);
    if (room.players.length === 0 || !hasHuman) {
      rooms.delete(currentRoomCode);
    } else {
      if (room.hostId === currentPlayerId && room.players.length) room.hostId = room.players[0].id;
      broadcastRoom(room, { type: 'ROOM_UPDATED', room: getPublicRoomInfo(room) });
    }
  });
});

// 修复④：30s 心跳，清理半开/掉线连接（移动网络尤需）
const HEARTBEAT_MS = 30000;
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch (e) { /* ignore */ }
  });
}, HEARTBEAT_MS);
wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`[PingPong Mobile Server] Running at http://0.0.0.0:${PORT} (WebSocket enabled)`);
});
