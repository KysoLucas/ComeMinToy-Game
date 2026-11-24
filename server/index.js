import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Server } from "socket.io";
import { createRoomBook } from "./rooms.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultWebRoot = path.resolve(here, "../client/build/web");

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

function readBody(payload) {
  if (payload && typeof payload === "object") return payload;
  return {};
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

export function start({ port = 0, host = "0.0.0.0", webRoot = defaultWebRoot } = {}) {
  const book = createRoomBook({
    onChange(code) {
      push(io, book, code);
    },
  });
  const server = createServer((req, res) => serve(req, res, webRoot));
  const io = new Server(server);

  io.on("connection", (socket) => {
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

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        port: typeof address === "object" && address ? address.port : port,
        close() {
          return new Promise((done) => {
            io.close(() => server.close(() => done()));
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
