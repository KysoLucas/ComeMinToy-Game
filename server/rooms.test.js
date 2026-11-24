import assert from "node:assert/strict";
import test from "node:test";
import { createRoomBook, formatBanner } from "./rooms.js";
import { newGame, play, slap } from "./rules.js";

const card = (rank, suit = "♠") => ({ rank, suit });

test("banners use the seat name", () => {
  const players = [{ name: "Alice" }, { name: "Bob" }];
  let game = play(newGame(2, { hands: [[card("K")], [card("4"), card("5")]] }), 0).state;
  assert.equal(formatBanner(players, game), "Alice WIN!");

  game = play(newGame(2, { hands: [[card("K"), card("3")], [card("4")]] }), 0).state;
  game = slap(game, 1).state;
  assert.equal(formatBanner(players, game), "Oh! Bob Slapped the Wrong Card!");

  game = play(newGame(2, { hands: [[card("A"), card("3")], [card("4")]] }), 0).state;
  game = slap(game, 1).state;
  assert.equal(formatBanner(players, game), "Alice is too slow!");
});

test("the host deals once two players are in the room", () => {
  const book = createRoomBook();
  const host = book.createRoom("s0", "Alice");
  assert.equal(book.startGame("s0").error, "Need two players");
  assert.equal(book.joinRoom("s1", { code: "nope", name: "Bob" }).error, "Room not found");
  assert.equal(book.joinRoom("s1", { code: host.code, name: "Bob" }).ok, true);
  assert.equal(book.startGame("s1").error, "Only the host can start");
  assert.equal(book.startGame("s0").ok, true);
  const first = book.snapshots(host.code)[0].view;
  assert.equal(first.players[0].count + first.players[1].count, 52);
  assert.equal(first.top, null);
  assert.equal(book.startGame("s0").error, "Game already started");
  const second = book.snapshots(host.code)[0].view;
  assert.equal(second.players[0].count, first.players[0].count);
  assert.equal(second.players[1].count, first.players[1].count);
});

test("the desk stops opening rooms", () => {
  const book = createRoomBook();
  let refused = null;
  for (let i = 0; i < 50 && !refused; i += 1) {
    const result = book.createRoom(`cap${i}`, "P");
    if (!result.ok) refused = result.error;
  }
  assert.equal(refused, "Too many rooms");
});

test("a nameless visitor holds a seat the others can see", () => {
  const book = createRoomBook({ schedule() {}, clear() {} });
  const host = book.createRoom("s0", "Ada");
  const held = book.holdSeat("s1", { code: host.code });
  assert.equal(held.ok, true);
  const views = book.snapshots(host.code);
  const hostView = views.find((item) => item.socketId === "s0").view;
  const heldView = views.find((item) => item.socketId === "s1").view;
  assert.equal(hostView.players[1].waiting, true);
  assert.equal(hostView.players[1].name, "Waiting");
  assert.equal(heldView.players.length, 1);
  assert.equal(heldView.players[0].name, "Waiting");
  assert.equal(JSON.stringify(heldView).includes("Ada"), false);
  assert.equal(book.joinRoom("s1", { code: host.code, name: "Bea" }).ok, true);
  const named = book.snapshots(host.code)[0].view;
  assert.equal(named.players.length, 2);
  assert.equal(named.players[1].name, "Bea");
  assert.equal(named.players[1].waiting, false);
});

test("a game is removed when the last player leaves", () => {
  let now = 0;
  const jobs = [];
  const book = createRoomBook({
    now: () => now,
    schedule(fn, ms) {
      const job = { fn, at: now + ms, dead: false };
      jobs.push(job);
      return job;
    },
    clear(job) {
      if (job) job.dead = true;
    },
  });
  const host = book.createRoom("s0", "Ada");
  book.joinRoom("s1", { code: host.code, name: "Bea" });
  assert.equal(book.startGame("s0").ok, true);
  book.disconnect("s0");
  assert.equal(book.snapshots(host.code).length, 1);
  assert.equal(book.disconnect("s1").code, null);
  assert.equal(book.snapshots(host.code).length, 0);
  now += 10_000;
  for (const job of jobs) {
    if (!job.dead && job.at <= now) job.fn();
  }
  assert.equal(book.joinRoom("s2", { code: host.code, name: "Cy" }).error, "Room not found");
});

test("a blank name cannot open or join a room", () => {
  const book = createRoomBook({ schedule() {}, clear() {} });
  assert.equal(book.createRoom("s0", "   ").error, "Need a name");
  const host = book.createRoom("s0", "Ada");
  assert.equal(book.joinRoom("s1", { code: host.code, name: " " }).error, "Need a name");
});

test("the first card deals itself after five seconds, then the next after three", () => {
  let dealt = null;
  for (let attempt = 0; attempt < 30 && dealt?.phase !== "play"; attempt += 1) {
    let now = 1_000;
    const jobs = [];
    const book = createRoomBook({
      now: () => now,
      schedule(fn, ms) {
        const job = { fn, at: now + ms, dead: false };
        jobs.push(job);
        return job;
      },
      clear(job) {
        if (job) job.dead = true;
      },
    });
    const host = book.createRoom("s0", "Ada");
    book.joinRoom("s1", { code: host.code, name: "Bea" });
    assert.equal(book.startGame("s0").ok, true);
    const opened = book.snapshots(host.code)[0].view;
    assert.equal(opened.remainMs, 5000);
    now = 6_000;
    for (const job of jobs) {
      if (!job.dead && job.at <= now) job.fn();
    }
    dealt = book.snapshots(host.code)[0].view;
  }
  assert.equal(dealt.phase, "play");
  assert.equal(dealt.pileCount, 1);
  assert.equal(dealt.turn, 1);
  assert.equal(dealt.remainMs, 3000);
});

test("a disconnected seat deals one second after the last card", () => {
  let now = 5_000;
  const jobs = [];
  const book = createRoomBook({
    now: () => now,
    schedule(fn, ms) {
      const job = { fn, at: now + ms, dead: false };
      jobs.push(job);
      return job;
    },
    clear(job) {
      if (job) job.dead = true;
    },
  });
  const host = book.createRoom("s0", "Ada");
  book.joinRoom("s1", { code: host.code, name: "Bea" });
  book.startGame("s0");
  book.disconnect("s0");
  const away = book.snapshots(host.code).find((item) => item.view.you === 1).view;
  assert.equal(away.players[0].connected, false);
  assert.equal(away.remainMs, 1000);
  now = 6_000;
  for (const job of jobs) {
    if (!job.dead && job.at <= now) job.fn();
  }
  const dealt = book.snapshots(host.code)[0].view;
  assert.equal(dealt.pileCount, 1);
  assert.equal(dealt.players[0].count, 25);
});

test("a slap holds the pile, then the loser takes it, then the next round waits", () => {
  let now = 10_000;
  const jobs = [];
  const book = createRoomBook({
    now: () => now,
    schedule(fn, ms) {
      const job = { fn, at: now + ms, dead: false, ran: false };
      jobs.push(job);
      return job;
    },
    clear(job) {
      if (job) job.dead = true;
    },
  });
  function runDue() {
    for (const job of [...jobs]) {
      if (job.dead || job.ran || job.at > now) continue;
      job.ran = true;
      job.fn();
    }
  }
  const host = book.createRoom("s0", "Ada");
  book.joinRoom("s1", { code: host.code, name: "Bea" });
  book.startGame("s0");
  assert.equal(book.playCard("s0").ok, true);
  assert.equal(book.slapCard("s1").ok, true);
  const held = book.snapshots(host.code)[0].view;
  assert.equal(held.phase, "resolve");
  assert.equal(held.pileCount, 1);
  assert.equal(held.remainMs, null);
  assert.match(held.banner, /Slapped the Wrong Card|too slow/);
  now += 52;
  runDue();
  const scooped = book.snapshots(host.code)[0].view;
  assert.equal(scooped.phase, "gather");
  assert.equal(scooped.pileCount, 0);
  runDue();
  const next = book.snapshots(host.code)[0].view;
  assert.equal(next.phase, "play");
  assert.equal(next.banner, null);
  assert.equal(next.remainMs, 3000);
});

test("a slap while the pile is scooped still starts the next turn clock", () => {
  let now = 20_000;
  const jobs = [];
  const book = createRoomBook({
    now: () => now,
    schedule(fn, ms) {
      const job = { fn, at: now + ms, dead: false, ran: false };
      jobs.push(job);
      return job;
    },
    clear(job) {
      if (job) job.dead = true;
    },
  });
  function runDue() {
    for (const job of [...jobs]) {
      if (job.dead || job.ran || job.at > now) continue;
      job.ran = true;
      job.fn();
    }
  }
  const host = book.createRoom("s0", "test");
  book.joinRoom("s1", { code: host.code, name: "test2" });
  book.startGame("s0");
  assert.equal(book.playCard("s0").ok, true);
  assert.equal(book.slapCard("s1").ok, true);
  now += 52;
  runDue();
  const scooped = book.snapshots(host.code)[0].view;
  assert.equal(scooped.phase, "gather");
  assert.equal(scooped.pileCount, 0);
  assert.match(scooped.banner, /Slapped the Wrong Card|too slow/);
  assert.equal(book.slapCard("s0").ok, true);
  assert.equal(book.slapCard("s1").ok, true);
  const held = book.snapshots(host.code)[0].view;
  assert.equal(held.phase, "gather");
  assert.equal(held.remainMs, null);
  assert.equal(book.playCard(held.turn === 0 ? "s0" : "s1").error, "Wait for the slap");
  runDue();
  const next = book.snapshots(host.code)[0].view;
  assert.equal(next.phase, "play");
  assert.equal(next.banner, null);
  assert.equal(next.pileCount, 0);
  assert.equal(next.remainMs, 3000);
  assert.equal(book.playCard(next.turn === 0 ? "s0" : "s1").ok, true);
});

test("a fifth player cannot sit down", () => {
  const book = createRoomBook();
  const host = book.createRoom("s0", "Ada");
  for (let i = 1; i < 4; i += 1) {
    assert.equal(book.joinRoom(`s${i}`, { code: host.code, name: `P${i}` }).ok, true);
  }
  assert.equal(book.joinRoom("s4", { code: host.code, name: "P4" }).error, "Room is full");
});
