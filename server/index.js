import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Server } from "socket.io";
import { createRoomBook } from "./rooms.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function findWebRoot() {
  if (process.env.WEB_ROOT) return process.env.WEB_ROOT;
  const candidates = ["../public", "../client/build/web"].map((dir) => path.resolve(here, dir));
  return candidates.find((dir) => existsSync(path.join(dir, "index.html"))) ?? candidates.at(-1);
}

const defaultWebRoot = findWebRoot();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function reply(ack, body) {
  if (typeof ack === "function") ack(body);
}

const MAX_SOCKETS = 200;
const MAX_PER_ADDRESS = 8;
const MAX_EVENTS_PER_SECOND = 20;
const EVENT_WINDOW_MS = 1000;
const MAX_PAYLOAD = 2048;

function readBody(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const body = {};
  for (const key of ["name", "code", "playerId", "t"]) {
    if (payload[key] == null) continue;
    const value = payload[key];
    if (typeof value === "string") body[key] = value.slice(0, 64);
    else if (typeof value === "number" && Number.isFinite(value)) body[key] = value;
  }
  return body;
}

function clientAddress(socket) {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first.slice(0, 80);
  }
  return String(socket.handshake.address ?? "");
}

function push(io, book, code) {
  if (!code) return;
  for (const item of book.snapshots(code)) {
    io.to(item.socketId).emit("room:state", item.view);
  }
}

function serveFile(res, file) {
  const ext = path.extname(file);
  const headers = {
    "content-type": mime[ext] ?? "application/octet-stream",
    "x-content-type-options": "nosniff",
  };
  if (ext === ".html") headers["cache-control"] = "no-cache";
  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
}

function serve(req, res, webRoot) {
  if (!webRoot || !existsSync(webRoot)) {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("Flutter web build is missing. Run npm run build:web.\n");
    return;
  }
  let urlPath = "/";
  try {
    urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
  } catch {
    res.writeHead(400).end();
    return;
  }
  const relative = path.normalize(urlPath).replace(/^[/\\]+/, "");
  let full = path.resolve(webRoot, relative);
  const root = path.resolve(webRoot);
  if (full !== root && !full.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(full) && statSync(full).isDirectory()) full = path.join(full, "index.html");
  if (existsSync(full) && statSync(full).isFile()) {
    serveFile(res, full);
    return;
  }
  const fallback = path.join(root, "index.html");
  if (existsSync(fallback)) {
    serveFile(res, fallback);
    return;
  }
  res.writeHead(404).end();
}

function wire(io, book, open) {
  io.use((socket, next) => {
    const address = clientAddress(socket);
    let same = 0;
    for (const item of open.values()) {
      if (item.address === address) same += 1;
    }
    if (open.size >= MAX_SOCKETS || same >= MAX_PER_ADDRESS) {
      next(new Error("Too many connections"));
      return;
    }
    open.set(socket.id, { address, stamps: [] });
    socket.once("disconnect", () => open.delete(socket.id));
    next();
  });

  io.on("connection", (socket) => {
    socket.use((_packet, next) => {
      const slot = open.get(socket.id);
      if (!slot) {
        next();
        return;
      }
      const now = Date.now();
      slot.stamps = slot.stamps.filter((stamp) => now - stamp < EVENT_WINDOW_MS);
      if (slot.stamps.length >= MAX_EVENTS_PER_SECOND) {
        socket.disconnect(true);
        next(new Error("Slow down"));
        return;
      }
      slot.stamps.push(now);
      next();
    });

    const finish = (ack, result, okBody) => {
      reply(ack, result.ok ? okBody : { ok: false, error: result.error });
      if (result.ok && result.code) push(io, book, result.code);
    };

    socket.on("room:create", (payload, ack) => {
      const result = book.createRoom(socket.id, readBody(payload).name);
      finish(ack, result, { ok: true, playerId: result.playerId, code: result.code });
    });

    socket.on("room:join", (payload, ack) => {
      const result = book.joinRoom(socket.id, readBody(payload));
      finish(ack, result, { ok: true, playerId: result.playerId, code: result.code });
    });

    socket.on("room:hold", (payload, ack) => {
      const result = book.holdSeat(socket.id, readBody(payload));
      finish(ack, result, { ok: true, playerId: result.playerId, code: result.code });
    });

    socket.on("room:leave", (_payload, ack) => {
      const result = book.leave(socket.id);
      finish(ack, result, { ok: true });
    });

    socket.on("game:start", (_payload, ack) => {
      finish(ack, book.startGame(socket.id), { ok: true });
    });

    socket.on("game:play", (_payload, ack) => {
      finish(ack, book.playCard(socket.id), { ok: true });
    });

    socket.on("game:slap", (_payload, ack) => {
      finish(ack, book.slapCard(socket.id), { ok: true });
    });

    socket.on("net:ping", (_payload, ack) => {
      reply(ack, { ok: true });
    });

    socket.on("disconnect", () => {
      const result = book.disconnect(socket.id);
      if (result.code) push(io, book, result.code);
    });
  });
}

export function createGameServer({ webRoot = defaultWebRoot } = {}) {
  const sockets = [];
  const book = createRoomBook({
    onChange(code) {
      for (const io of sockets) push(io, book, code);
    },
  });
  const server = createServer((req, res) => serve(req, res, webRoot));
  const limits = { transports: ["websocket"], maxHttpBufferSize: MAX_PAYLOAD };
  const open = new Map();
  const io = new Server(server, limits);
  const hosted = new Server(server, { ...limits, path: "/api/socket/socket.io" });
  sockets.push(io, hosted);
  wire(io, book, open);
  wire(hosted, book, open);

  return { server, sockets, book };
}

export function start({ port = 0, host = "0.0.0.0", webRoot = defaultWebRoot } = {}) {
  const { server, sockets } = createGameServer({ webRoot });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        port: typeof address === "object" && address ? address.port : port,
        close() {
          return new Promise((done) => {
            const rest = [...sockets];
            const step = () => {
              const io = rest.pop();
              if (!io) {
                server.close(() => done());
                return;
              }
              io.close(step);
            };
            step();
          });
        },
      });
    });
  });
}

const isCli = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isCli) {
  const port = Number(process.env.PORT) || 8080;
  start({ port }).then((running) => {
    console.log(`Hong Kong Slapjack at http://127.0.0.1:${running.port}`);
  });
}
