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

test("a fifth player cannot sit down", () => {
  const book = createRoomBook();
  const host = book.createRoom("s0", "Ada");
  for (let i = 1; i < 4; i += 1) {
    assert.equal(book.joinRoom(`s${i}`, { code: host.code, name: `P${i}` }).ok, true);
  }
  assert.equal(book.joinRoom("s4", { code: host.code, name: "P4" }).error, "Room is full");
});
