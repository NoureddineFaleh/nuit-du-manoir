'use strict';
// Serveur de « La Nuit du Manoir » : fichiers statiques + WebSocket temps réel.
//   /          → écran partagé (PC / TV)
//   /play      → téléphone du joueur (ouvert via le QR code)

const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');

const { Game } = require('./src/game');
const { LANGS, CLIENT_CONTENT, LANG_LIST, UI_SCRIPT } = require('./src/lang');
const U = require('./src/util');

const PORT = parseInt(process.env.PORT || '3000', 10);
const SCALE = parseFloat(process.env.TIME_SCALE || '1'); // < 1 pour accélérer les tests
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

// Messages d'erreur dans toutes les langues (le téléphone ne connaît pas encore la langue de la salle)
const errText = (code) => Object.values(LANGS).map((l) => l.T.err[code]).join('  /  ');

// ---------------------------------------------------------------------------
//  Adresse à encoder dans le QR code
// ---------------------------------------------------------------------------
function lanIp() {
  const cands = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) cands.push(i.address);
    }
  }
  const priv = (a) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a);
  return cands.find(priv) || cands[0] || null;
}

function baseUrl(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  const host = req.headers.host || `localhost:${PORT}`;
  const hostname = host.replace(/:\d+$/, '');
  if (['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)) {
    const ip = lanIp();
    if (ip) return `http://${ip}:${PORT}`;
  }
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0];
  return `${proto}://${host}`;
}

// ---------------------------------------------------------------------------
//  Salles
// ---------------------------------------------------------------------------
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

function newCode() {
  for (;;) {
    const c = Array.from({ length: 4 }, () => CODE_CHARS[U.rnd(CODE_CHARS.length)]).join('');
    if (!rooms.has(c)) return c;
  }
}

const strip = (v) => {
  const { now, ...rest } = v; // eslint-disable-line no-unused-vars
  return JSON.stringify(rest);
};
const send = (ws, obj) => {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
};

class Room {
  constructor(code, base) {
    this.code = code;
    this.joinUrl = `${base}/play?room=${code}`;
    this.screen = null;
    this.sockets = new Map(); // pid → ws
    this.last = new Map(); // pid → dernière vue envoyée (sans l'horloge)
    this.lastScreen = '';
    this.queued = false;
    this.touched = Date.now();
    this.qr = null;
    this.ready = QRCode.toDataURL(this.joinUrl, {
      margin: 1, width: 420, errorCorrectionLevel: 'M', color: { dark: '#120a0a', light: '#f1e7d0' },
    }).then((u) => (this.qr = u));
    this.game = new Game({ scale: SCALE, onChange: () => this.schedule() });
  }

  touch() {
    this.touched = Date.now();
  }

  schedule() {
    if (this.queued) return;
    this.queued = true;
    setImmediate(() => {
      this.queued = false;
      this.flush(false);
    });
  }

  flush(force) {
    const g = this.game;
    if (this.screen && this.screen.readyState === 1) {
      const v = g.screenView();
      const s = strip(v);
      if (force || s !== this.lastScreen) {
        this.lastScreen = s;
        send(this.screen, { ...v, now: Date.now() });
      }
    }
    for (const [pid, ws] of this.sockets) {
      const v = g.viewFor(pid);
      if (!v) continue;
      const s = strip(v);
      if (force || s !== this.last.get(pid)) {
        this.last.set(pid, s);
        send(ws, { ...v, now: Date.now() });
      }
    }
  }
}

function createRoom(base) {
  const room = new Room(newCode(), base);
  rooms.set(room.code, room);
  return room;
}

// ---------------------------------------------------------------------------
//  HTTP
// ---------------------------------------------------------------------------
const app = express();
app.disable('x-powered-by');
app.get('/ui.js', (_req, res) => res.type('application/javascript').send(UI_SCRIPT));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'screen.html')));
app.get('/play', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'play.html')));
app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8 * 1024 });

const parse = (raw) => {
  try {
    const m = JSON.parse(String(raw));
    return m && typeof m === 'object' ? m : null;
  } catch {
    return null;
  }
};

/** Limiteur simple : 40 messages / seconde / connexion. */
function limiter() {
  let n = 0;
  let t = Date.now();
  return () => {
    const now = Date.now();
    if (now - t > 1000) {
      t = now;
      n = 0;
    }
    return ++n <= 40;
  };
}

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  const url = new URL(req.url, 'http://x');
  const role = url.searchParams.get('role');
  const code = String(url.searchParams.get('room') || '').toUpperCase();
  const ok = limiter();

  // ------------------------------- ÉCRAN -------------------------------
  if (role === 'screen') {
    let room = rooms.get(code);
    if (!room) room = createRoom(baseUrl(req));
    if (room.screen && room.screen !== ws) {
      try {
        room.screen.close(4000, 'replaced');
      } catch {
        /* rien */
      }
    }
    room.screen = ws;
    room.touch();

    ws.on('message', (raw) => {
      const m = parse(raw);
      if (!m || !ok()) return;
      room.touch();
      const g = room.game;
      switch (m.t) {
        case 'target':
          g.setTarget(m.n);
          break;
        case 'lang':
          g.setLang(m.lang);
          break;
        case 'start':
          g.start();
          break;
        case 'kick': {
          const ws2 = room.sockets.get(m.id);
          if (g.removePlayer(m.id)) {
            room.sockets.delete(m.id);
            if (ws2) {
              send(ws2, { t: 'error', code: 'kicked', text: errText('kicked') });
              ws2.close();
            }
          }
          break;
        }
        case 'restart':
          if (g.phase === 'fin') {
            g.restart();
            room.flush(true);
          }
          break;
        case 'skip':
          if (!['lobby', 'fin'].includes(g.phase)) g.skip();
          break;
        default:
      }
    });
    ws.on('close', () => {
      if (room.screen === ws) room.screen = null;
    });

    room.ready.then(() => {
      send(ws, { t: 'hello', role: 'screen', code: room.code, joinUrl: room.joinUrl, qr: room.qr, content: CLIENT_CONTENT, langs: LANG_LIST });
      room.flush(true);
    });
    return;
  }

  // ------------------------------ JOUEUR -------------------------------
  if (role === 'player') {
    const room = rooms.get(code);
    if (!room) {
      send(ws, { t: 'error', code: 'noroom', text: errText('noroom') });
      ws.close();
      return;
    }
    let pid = null;

    ws.on('message', (raw) => {
      const m = parse(raw);
      if (!m || !ok()) return;
      room.touch();
      const g = room.game;

      if (m.t === 'join') {
        const token = typeof m.token === 'string' && /^[a-z0-9]{8,40}$/i.test(m.token) ? m.token : null;
        if (!token) return send(ws, { t: 'error', code: 'token', text: errText('token') });
        let p = g.players.find((x) => x.token === token);
        if (p) {
          const old = room.sockets.get(p.id);
          if (old && old !== ws) {
            try {
              old.close(4001, 'replaced');
            } catch {
              /* rien */
            }
          }
          pid = p.id;
          room.sockets.set(pid, ws);
          g.setConnected(pid, true);
        } else {
          if (g.phase !== 'lobby') return send(ws, { t: 'error', code: 'started', text: errText('started') });
          p = g.addPlayer(m.name, token);
          if (!p) return send(ws, { t: 'error', code: 'full', text: errText('full') });
          pid = p.id;
          room.sockets.set(pid, ws);
        }
        send(ws, { t: 'joined', pid, token, content: CLIENT_CONTENT });
        room.flush(true);
        return;
      }
      if (pid) g.handle(pid, m);
    });

    ws.on('close', () => {
      if (!pid || room.sockets.get(pid) !== ws) return;
      room.sockets.delete(pid);
      room.last.delete(pid);
      room.game.setConnected(pid, false);
      if (room.game.phase === 'lobby') {
        // pas de fantôme dans le salon : on libère la place si le joueur ne revient pas
        setTimeout(() => {
          const p = room.game.byId(pid);
          if (p && !p.connected && room.game.phase === 'lobby') room.game.removePlayer(pid);
        }, 6000);
      }
    });
    return;
  }

  ws.close();
});

// ---------------------------------------------------------------------------
//  Boucle de jeu + ménage
// ---------------------------------------------------------------------------
const failed = new Set();
setInterval(() => {
  for (const room of rooms.values()) {
    try {
      room.game.tick();
    } catch (e) {
      if (!failed.has(room.code)) {
        failed.add(room.code);
        console.error(`[${room.code}] erreur dans tick():`, e);
      }
    }
  }
}, 250);

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
  const now = Date.now();
  for (const [code, room] of rooms) {
    const abandoned = !room.screen && room.sockets.size === 0 && now - room.touched > 20 * 60 * 1000;
    if (abandoned || now - room.touched > 3 * 60 * 60 * 1000) rooms.delete(code);
  }
}, 20000);

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    const ip = lanIp();
    console.log('\n  🕯️  LA NUIT DU MANOIR\n');
    console.log(`  Écran (PC / TV)  : http://localhost:${PORT}`);
    if (ip) console.log(`  Réseau local     : http://${ip}:${PORT}   ← les téléphones doivent être sur le même Wi-Fi`);
    if (PUBLIC_URL) console.log(`  URL publique     : ${PUBLIC_URL}`);
    if (SCALE !== 1) console.log(`  ⚠ TIME_SCALE=${SCALE} (durées accélérées)`);
    console.log('');
  });
}

module.exports = { server, rooms };
