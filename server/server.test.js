import http from "node:http";
import assert from "node:assert/strict";
import test from "node:test";
import { io } from "socket.io-client";
import { start } from "./index.js";

function connect(port, path) {
  const socket = io(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
    forceNew: true,
    ...(path ? { path } : {}),
  });
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

function ack(socket, event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, resolve);
  });
}

function nextView(socket, pred) {
  return new Promise((resolve) => {
    const onView = (view) => {
      if (pred(view)) {
        socket.off("room:state", onView);
        resolve(view);
      }
    };
    socket.on("room:state", onView);
  });
}

test("the current player deals when five seconds pass", async () => {
  const running = await start({ port: 0, host: "127.0.0.1" });
  const alice = await connect(running.port);
  const bob = await connect(running.port);
  try {
    const created = await ack(alice, "room:create", { name: "Alice" });
    await ack(bob, "room:join", { name: "Bob", code: created.code });
    const dealt = nextView(alice, (view) => view.phase === "play" && view.pileCount === 1);
    assert.equal((await ack(alice, "game:start", {})).ok, true);
    const view = await dealt;
    assert.equal(view.players[0].count, 25);
    assert.equal(view.turn, 1);
    assert.equal(view.top != null, true);
    assert.ok(view.remainMs <= 3000);
  } finally {
    alice.close();
    bob.close();
    await running.close();
  }
});

test("two sockets share a room, a ping, and one pile", async () => {
  const running = await start({ port: 0, host: "127.0.0.1" });
  const alice = await connect(running.port);
  const bob = await connect(running.port);
  try {
    const createdView = nextView(alice, (view) => view.players.length === 1);
    const created = await ack(alice, "room:create", { name: "Alice" });
    assert.equal(created.ok, true);
    assert.equal((await createdView).code, created.code);

    const missing = await ack(bob, "room:join", { name: "Bob", code: "ZZZZ" });
    assert.equal(missing.error, "Room not found");

    const joined = Promise.all([
      nextView(alice, (view) => view.players.length === 2),
      nextView(bob, (view) => view.players.length === 2),
    ]);
    const join = await ack(bob, "room:join", { name: "Bob", code: created.code });
    assert.equal(join.ok, true);
    const [aliceLobby, bobLobby] = await joined;
    assert.equal(aliceLobby.you, 0);
    assert.equal(bobLobby.you, 1);
    assert.equal(bobLobby.host, false);

    const refused = await ack(bob, "game:start", {});
    assert.equal(refused.error, "Only the host can start");

    const started = Promise.all([
      nextView(alice, (view) => view.phase === "play" && view.pileCount === 0),
      nextView(bob, (view) => view.phase === "play" && view.pileCount === 0),
    ]);
    assert.equal((await ack(alice, "game:start", {})).ok, true);
    const [aliceDeal, bobDeal] = await started;
    assert.equal(aliceDeal.players[0].count + aliceDeal.players[1].count, 52);
    assert.equal(aliceDeal.top, null);
    assert.equal(JSON.stringify(aliceDeal).includes("hands"), false);
    assert.equal(bobDeal.players[0].count, aliceDeal.players[0].count);

    const ping = await ack(alice, "net:ping", { t: Date.now() });
    assert.equal(ping.ok, true);

    const played = Promise.all([
      nextView(alice, (view) => view.pileCount === 1),
      nextView(bob, (view) => view.pileCount === 1),
    ]);
    assert.equal((await ack(alice, "game:play", {})).ok, true);
    const [alicePlay, bobPlay] = await played;
    assert.equal(alicePlay.top.rank, bobPlay.top.rank);
    assert.equal(typeof alicePlay.top.suit, "string");
    assert.equal((await ack(alice, "game:play", {})).ok, false);

    const resolved = nextView(alice, (view) => view.pileCount === 0);
    assert.equal((await ack(bob, "game:slap", {})).ok, true);
    const after = await resolved;
    if (alicePlay.phase === "slap") {
      assert.equal(after.players[0].count, 26);
      assert.equal(after.players[1].count, 26);
      assert.match(after.banner, /too slow/);
    } else {
      assert.equal(after.players[0].count, 25);
      assert.equal(after.players[1].count, 27);
      assert.match(after.banner, /Slapped the Wrong Card/);
    }
  } finally {
    alice.close();
    bob.close();
    await running.close();
  }
});

test("one address cannot open an endless number of sockets", async () => {
  const running = await start({ port: 0, host: "127.0.0.1" });
  const sockets = [];
  try {
    for (let i = 0; i < 8; i += 1) sockets.push(await connect(running.port));
    const extra = io(`http://127.0.0.1:${running.port}`, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      timeout: 2000,
    });
    const result = await new Promise((resolve) => {
      extra.once("connect", () => resolve("open"));
      extra.once("connect_error", (error) => resolve(error.message));
    });
    extra.close();
    assert.equal(result, "Too many connections");
  } finally {
    for (const socket of sockets) socket.close();
    await running.close();
  }
});

test("a socket that floods events is closed", async () => {
  const running = await start({ port: 0, host: "127.0.0.1" });
  const socket = await connect(running.port);
  try {
    const closed = new Promise((resolve) => socket.once("disconnect", () => resolve("closed")));
    for (let i = 0; i < 40; i += 1) socket.emit("net:ping", { t: i });
    const result = await Promise.race([
      closed,
      new Promise((resolve) => setTimeout(() => resolve("open"), 1000)),
    ]);
    assert.equal(result, "closed");
  } finally {
    socket.close();
    await running.close();
  }
});

test("a huge payload cannot create a room", async () => {
  const running = await start({ port: 0, host: "127.0.0.1" });
  const socket = await connect(running.port);
  try {
    const closed = new Promise((resolve) => socket.once("disconnect", () => resolve("closed")));
    socket.emit("room:create", { name: "A".repeat(5000) });
    const result = await Promise.race([
      closed,
      ack(socket, "room:create", { name: "Ada" }).then((body) => body),
      new Promise((resolve) => setTimeout(() => resolve("open"), 1000)),
    ]);
    assert.notEqual(result?.ok, true);
    assert.notEqual(result, "open");
  } finally {
    socket.close();
    await running.close();
  }
});

test("the hosted socket path stays open for two players", async () => {
  const running = await start({ port: 0, host: "127.0.0.1" });
  const alice = await connect(running.port, "/api/socket/socket.io");
  const bob = await connect(running.port, "/api/socket/socket.io");
  try {
    const created = await ack(alice, "room:create", { name: "Alice" });
    assert.equal(created.ok, true);
    const joined = nextView(alice, (view) => view.players.length === 2);
    assert.equal((await ack(bob, "room:join", { name: "Bob", code: created.code })).ok, true);
    assert.equal((await joined).code, created.code);
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(alice.connected, true);
    assert.equal(bob.connected, true);
  } finally {
    alice.close();
    bob.close();
    await running.close();
  }
});

function hostProxy(targetPort) {
  const proxy = http.createServer((req, res) => {
    const path = req.url.replace(/^\/api\/socket/, "") || "/";
    const forwarded = http.request(
      { hostname: "127.0.0.1", port: targetPort, path, method: req.method, headers: req.headers },
      (upstream) => {
        res.writeHead(upstream.statusCode ?? 500, upstream.headers);
        upstream.pipe(res);
      },
    );
    forwarded.on("error", () => res.writeHead(502).end());
    req.pipe(forwarded);
  });
  proxy.on("upgrade", (req, socket, head) => {
    const path = req.url.replace(/^\/api\/socket/, "") || "/";
    const forwarded = http.request({
      hostname: "127.0.0.1",
      port: targetPort,
      path,
      method: "GET",
      headers: req.headers,
    });
    forwarded.on("upgrade", (upstreamResponse, upstream, upstreamHead) => {
      const headers = Object.entries(upstreamResponse.headers)
        .flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map((item) => `${key}: ${item}`))
        .join("\r\n");
      socket.write(
        `HTTP/1.1 ${upstreamResponse.statusCode} ${upstreamResponse.statusMessage}\r\n${headers}\r\n\r\n`,
      );
      if (upstreamHead?.length) socket.write(upstreamHead);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    forwarded.on("error", () => socket.destroy());
    forwarded.end(head);
  });
  return new Promise((resolve) => {
    proxy.listen(0, "127.0.0.1", () => {
      const address = proxy.address();
      resolve({
        port: typeof address === "object" && address ? address.port : 0,
        close: () => new Promise((done) => proxy.close(done)),
      });
    });
  });
}

test("the hosted websocket still opens after the function prefix is stripped", async () => {
  const running = await start({ port: 0, host: "127.0.0.1" });
  const proxy = await hostProxy(running.port);
  const alice = await connect(proxy.port, "/api/socket/socket.io");
  const bob = await connect(proxy.port, "/api/socket/socket.io");
  try {
    const created = await ack(alice, "room:create", { name: "Alice" });
    assert.equal(created.ok, true);
    const joined = nextView(alice, (view) => view.players.length === 2);
    assert.equal((await ack(bob, "room:join", { name: "Bob", code: created.code })).ok, true);
    assert.equal((await joined).code, created.code);
    assert.equal(alice.connected, true);
    assert.equal(bob.connected, true);
  } finally {
    alice.close();
    bob.close();
    await proxy.close();
    await running.close();
  }
});
