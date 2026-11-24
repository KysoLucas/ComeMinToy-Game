import assert from "node:assert/strict";
import test from "node:test";
import { io } from "socket.io-client";
import { start } from "./index.js";

function connect(port) {
  const socket = io(`http://127.0.0.1:${port}`, { transports: ["websocket"], forceNew: true });
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
