const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♣", "♦"];

export function dealHands(playerCount, rng = Math.random) {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ suit, rank });
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const hands = Array.from({ length: playerCount }, () => []);
  const base = Math.floor(deck.length / playerCount);
  const extra = deck.length % playerCount;
  let cursor = 0;
  for (let seat = 0; seat < playerCount; seat += 1) {
    const count = base + (seat < extra ? 1 : 0);
    hands[seat] = deck.slice(cursor, cursor + count);
    cursor += count;
  }
  return hands;
}

export function newGame(playerCount, options = {}) {
  const hands = options.hands
    ? options.hands.map((hand) => hand.map((card) => ({ suit: card.suit, rank: card.rank })))
    : dealHands(playerCount, options.rng ?? Math.random);
  return {
    hands,
    table: [],
    counter: null,
    turn: 0,
    slaps: hands.map(() => false),
    phase: "play",
    winner: null,
    notice: null,
  };
}

export function play(state, seat) {
  if (state.phase === "won") return { state, error: "Game over" };
  if (state.phase === "slap") return { state, error: "Wait for the slap" };
  if (!Number.isInteger(seat) || seat < 0 || seat >= state.hands.length) {
    return { state, error: "Wait for the next game" };
  }
  if (seat !== state.turn) return { state, error: "Not your turn" };
  const hand = state.hands[seat];
  if (hand.length === 0) return { state, error: "No cards" };

  const card = { suit: hand[0].suit, rank: hand[0].rank };
  const counter = state.counter == null || state.counter === 12 ? 0 : state.counter + 1;
  const match = RANKS[counter] === card.rank;
  const next = {
    hands: state.hands.map((cards, index) => (index === seat ? cards.slice(1) : cards)),
    table: state.table.concat([card]),
    counter,
    turn: (seat + 1) % state.hands.length,
    slaps: state.slaps.map(() => false),
    phase: match ? "slap" : "play",
    winner: null,
    notice: null,
  };
  return { state: awardWin(next) };
}

export function slap(state, seat) {
  if (state.phase === "won") return { state, error: "Game over" };
  if (state.table.length === 0) return { state, error: "No card to slap" };
  if (!Number.isInteger(seat) || seat < 0 || seat >= state.hands.length) {
    return { state, error: "Wait for the next game" };
  }
  if (state.slaps[seat]) return { state };

  const slaps = state.slaps.slice();
  slaps[seat] = true;
  const top = state.table[state.table.length - 1];
  const match = state.counter != null && RANKS[state.counter] === top.rank;
  if (!match) return { state: givePile(state, seat, "wrong") };

  const marked = { ...state, slaps };
  const stillOut = slaps.filter((done) => !done).length;
  if (stillOut !== 1) return { state: marked };
  const slow = slaps.findIndex((done) => !done);
  return { state: givePile(marked, slow, "late") };
}

export function viewGame(state) {
  const count = state.hands.length;
  const pending = state.counter != null && state.table.length > 0;
  const rank = pending ? RANKS[state.counter] : null;
  const top = state.table[state.table.length - 1];
  return {
    phase: state.phase,
    turn: state.turn,
    winner: state.winner,
    notice: state.notice ? { kind: state.notice.kind, seat: state.notice.seat } : null,
    pileCount: state.table.length,
    top: top ? { suit: top.suit, rank: top.rank } : null,
    said: rank == null ? null : rank === "A" ? "1" : rank,
    saidBy: pending ? (state.turn - 1 + count) % count : null,
    counts: state.hands.map((hand) => hand.length),
    slaps: state.slaps.slice(),
  };
}

function givePile(state, taker, kind) {
  const hands = state.hands.map((hand, index) => {
    if (index !== taker) return hand;
    return hand.concat(state.table.map((card) => ({ suit: card.suit, rank: card.rank })));
  });
  return awardWin({
    hands,
    table: [],
    counter: null,
    turn: taker,
    slaps: state.slaps.map(() => false),
    phase: "play",
    winner: null,
    notice: { kind, seat: taker },
  });
}

function awardWin(state) {
  let winner = null;
  for (let seat = 0; seat < state.hands.length; seat += 1) {
    if (state.hands[seat].length !== 0) continue;
    const top = state.table[state.table.length - 1];
    const mismatch = !top || state.counter == null || RANKS[state.counter] !== top.rank;
    if (mismatch || state.table.length === 0) winner = seat;
  }
  if (winner == null) return state;
  return { ...state, phase: "won", winner };
}
