import assert from "node:assert/strict";
import test from "node:test";
import { dealHands, newGame, play, resume, settle, slap, viewGame } from "./rules.js";

const card = (rank, suit = "♠") => ({ rank, suit });

test("a deck splits across two, three, and four seats", () => {
  assert.deepEqual(dealHands(2).map((hand) => hand.length), [26, 26]);
  assert.deepEqual(dealHands(3).map((hand) => hand.length), [18, 17, 17]);
  assert.deepEqual(dealHands(4).map((hand) => hand.length), [13, 13, 13, 13]);
});

test("the count calls ace 1 and hides every card still in a hand", () => {
  const dealt = play(newGame(2, { hands: [[card("Q"), card("7")], [card("5"), card("8")]] }), 0);
  const view = viewGame(dealt.state);
  assert.equal(view.said, "1");
  assert.equal(view.saidBy, 0);
  assert.equal(view.top.rank, "Q");
  const text = JSON.stringify(view);
  assert.equal(text.includes("7"), false);
  assert.equal(text.includes("5"), false);
  assert.equal(text.includes("8"), false);
  assert.equal(text.includes("hands"), false);
});

test("the count wraps after king", () => {
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const hands = [[], []];
  for (let i = 0; i < 14; i += 1) hands[i % 2].push(card(ranks[(i + 1) % 13]));
  hands[0].push(card("5"));
  hands[1].push(card("5"));
  let state = newGame(2, { hands });
  for (let i = 0; i < 13; i += 1) state = play(state, i % 2).state;
  assert.equal(viewGame(state).said, "K");
  assert.equal(state.phase, "play");
  state = play(state, 1).state;
  assert.equal(viewGame(state).said, "1");
  assert.equal(state.pileCount ?? state.table.length, 14);
});

test("a wrong slap gives that player the pile and the next turn", () => {
  let state = newGame(2, { hands: [[card("K"), card("3")], [card("4")]] });
  state = play(state, 0).state;
  const missed = play(state, 0);
  assert.equal(missed.error, "Not your turn");
  assert.equal(missed.state, state);
  const held = slap(state, 1).state;
  assert.equal(held.phase, "resolve");
  assert.equal(held.slaps[1], true);
  assert.equal(held.table.length, 1);
  assert.equal(held.notice.kind, "wrong");
  assert.equal(held.notice.seat, 1);
  state = settle(held);
  assert.equal(state.phase, "gather");
  assert.deepEqual(state.hands[1].map((item) => item.rank), ["4", "K"]);
  assert.equal(state.turn, 1);
  assert.equal(state.table.length, 0);
  assert.equal(state.counter, null);
  state = resume(state);
  assert.equal(state.phase, "play");
  assert.equal(state.notice, null);
  const again = slap(state, 1);
  assert.equal(again.error, "No card to slap");
  assert.equal(again.state, state);
});

test("two players resolve a match when the other person slaps", () => {
  let state = newGame(2, { hands: [[card("A"), card("3")], [card("4")]] });
  state = play(state, 0).state;
  assert.equal(state.phase, "slap");
  assert.equal(state.winner, null);
  const blocked = play(state, 1);
  assert.equal(blocked.error, "Wait for the slap");
  assert.equal(blocked.state, state);
  state = slap(state, 1).state;
  assert.equal(state.phase, "resolve");
  assert.equal(state.slaps[1], true);
  assert.equal(state.notice.kind, "late");
  assert.equal(state.notice.seat, 0);
  assert.equal(state.table.length, 1);
  state = resume(settle(state));
  assert.equal(state.phase, "play");
  assert.deepEqual(state.hands[0].map((item) => item.rank), ["3", "A"]);
  assert.equal(state.table.length, 0);
});

test("a repeated slap does not move the pile", () => {
  let state = newGame(4, {
    hands: [[card("A"), card("5")], [card("5")], [card("5")], [card("5")]],
  });
  state = play(state, 0).state;
  state = slap(state, 1).state;
  assert.equal(state.phase, "slap");
  assert.equal(state.table.length, 1);
  const before = slap(state, 2).state;
  const again = slap(before, 2);
  assert.equal(again.state, before);
  assert.equal(before.table.length, 1);
  state = slap(before, 3).state;
  assert.equal(state.phase, "resolve");
  assert.equal(state.table.length, 1);
  state = settle(state);
  assert.equal(state.notice.kind, "late");
  assert.equal(state.notice.seat, 0);
  assert.equal(state.table.length, 0);
  assert.equal(state.hands[0].length, 2);
});

test("three players resolve when everyone but one has slapped", () => {
  let state = newGame(3, { hands: [[card("A")], [card("2")], [card("3")]] });
  state = play(state, 0).state;
  state = slap(state, 1).state;
  assert.equal(state.phase, "slap");
  state = slap(state, 2).state;
  assert.equal(state.phase, "resolve");
  state = settle(state);
  assert.equal(state.notice.seat, 0);
  assert.equal(state.notice.kind, "late");
});

test("the last unmatched card wins, and a matched last card does not", () => {
  const won = play(newGame(2, { hands: [[card("K")], [card("4"), card("5")]] }), 0).state;
  assert.equal(won.phase, "won");
  assert.equal(won.winner, 0);

  let matched = play(newGame(2, { hands: [[card("A")], [card("4")]] }), 0).state;
  assert.equal(matched.phase, "slap");
  assert.equal(matched.winner, null);
  matched = slap(matched, 0).state;
  assert.equal(matched.phase, "resolve");
  matched = settle(matched);
  assert.equal(matched.phase, "gather");
  assert.equal(matched.winner, 0);
  assert.equal(matched.hands[1].at(-1).rank, "A");
  assert.equal(resume(matched).phase, "won");
});
