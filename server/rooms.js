import { randomBytes, randomInt } from "node:crypto";
import { newGame, play, resume, settle, slap, viewGame } from "./rules.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_ROOMS = 40;

export function cleanName(name) {
  return String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 16);
}

export function formatBanner(players, game) {
  if (!game) return null;
  if (game.phase === "won" && game.winner != null) {
    return `${players[game.winner]?.name ?? "Player"} WIN!`;
  }
  if (!game.notice) return null;
  const name = players[game.notice.seat]?.name ?? "Player";
  if (game.notice.kind === "wrong") return `Oh! ${name} Slapped the Wrong Card!`;
  if (game.notice.kind === "late") return `${name} is too slow!`;
  return null;
}

const FIRST_TURN_MS = 5000;
const LATER_TURN_MS = 3000;
const AWAY_TURN_MS = 1000;
const RESOLVE_MS = 900;
const ROUND_GAP_MS = 2000;

export function createRoomBook({
  now = () => Date.now(),
  schedule = defaultSchedule,
  clear = defaultClear,
  onChange = () => {},
} = {}) {
  const rooms = new Map();
  const sockets = new Map();
  const timers = new Map();

  function locate(socketId) {
    const loc = sockets.get(socketId);
    if (!loc) return { ok: false, error: "Not in a room" };
    const room = rooms.get(loc.code);
    if (!room) return { ok: false, error: "Room not found" };
    const seat = room.players.findIndex((player) => player.id === loc.playerId);
    if (seat < 0) return { ok: false, error: "Not in a room" };
    return { ok: true, room, seat };
  }

  function present(room, playerId) {
    const you = room.players.findIndex((player) => player.id === playerId);
    const seen = room.game ? viewGame(room.game) : null;
    return {
      code: room.code,
      playerId,
      phase: seen ? seen.phase : "lobby",
      you,
      host: room.players[you]?.id === room.hostId,
      banner: formatBanner(room.players, room.game),
      turn: seen ? seen.turn : null,
      winner: seen ? seen.winner : null,
      pileCount: seen ? seen.pileCount : 0,
      top: seen ? seen.top : null,
      said: seen ? seen.said : null,
      saidBy: seen ? seen.saidBy : null,
      players: room.players.map((player, seat) => ({
        seat,
        name: player.name,
        connected: player.connected,
        host: player.id === room.hostId,
        count: seen ? seen.counts[seat] ?? 0 : 0,
        slapped: seen ? Boolean(seen.slaps[seat]) : false,
        waiting: player.waiting === true,
      })),
      remainMs: room.deadline == null ? null : Math.max(0, room.deadline - now()),
    };
  }

  function disarm(room) {
    const pending = timers.get(room.code);
    if (pending) clear(pending);
    timers.delete(room.code);
    room.deadline = null;
  }

  function arm(room) {
    disarm(room);
    const game = room.game;
    if (!game || game.phase !== "play") return;
    const player = room.players[game.turn];
    const away = !player?.connected;
    const budget = away ? AWAY_TURN_MS : room.cardsPlayed === 0 ? FIRST_TURN_MS : LATER_TURN_MS;
    const started = away ? room.lastDealAt : room.turnStarted;
    const wait = Math.max(0, started + budget - now());
    room.deadline = now() + wait;
    timers.set(room.code, schedule(() => {
      timers.delete(room.code);
      autoDeal(room.code);
    }, wait));
  }

  function autoDeal(code) {
    const room = rooms.get(code);
    const game = room?.game;
    if (!game || game.phase !== "play") return;
    if (room.deadline != null && now() + 25 < room.deadline) return;
    const result = play(game, game.turn);
    if (result.error) return;
    room.game = result.state;
    room.cardsPlayed += 1;
    room.lastDealAt = now();
    room.turnStarted = now();
    arm(room);
    onChange(code);
  }

  function scheduleResolve(room) {
    room.holding = true;
    disarm(room);
    const code = room.code;
    timers.set(code, schedule(() => {
      timers.delete(code);
      const current = rooms.get(code);
      if (!current?.game || current.game.phase !== "resolve") return;
      current.game = settle(current.game);
      onChange(code);
      timers.set(code, schedule(() => {
        timers.delete(code);
        const next = rooms.get(code);
        if (!next?.game || next.game.phase !== "gather") return;
        next.holding = false;
        next.game = resume(next.game);
        if (next.game.phase === "play") {
          next.turnStarted = now();
          arm(next);
        }
        onChange(code);
      }, ROUND_GAP_MS));
    }, RESOLVE_MS));
  }

  function snapshots(code) {
    const room = rooms.get(code);
    if (!room) return [];
    return room.players
      .filter((player) => player.connected && player.socketId)
      .map((player) => ({ socketId: player.socketId, view: present(room, player.id) }));
  }

  function createRoom(socketId, name) {
    if (sockets.has(socketId)) return { ok: false, error: "Already in a room" };
    if (rooms.size >= MAX_ROOMS) return { ok: false, error: "Too many rooms" };
    let code = "";
    do {
      code = "";
      for (let i = 0; i < 4; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
    } while (rooms.has(code));
    const trimmed = cleanName(name);
    if (!trimmed) return { ok: false, error: "Need a name" };
    const player = {
      id: randomBytes(9).toString("base64url"),
      name: trimmed,
      socketId,
      connected: true,
    };
    rooms.set(code, {
      code,
      hostId: player.id,
      players: [player],
      game: null,
      cardsPlayed: 0,
      lastDealAt: 0,
      turnStarted: 0,
      deadline: null,
    });
    sockets.set(socketId, { code, playerId: player.id });
    return { ok: true, code, playerId: player.id };
  }

  function holdSeat(socketId, payload) {
    const code = String(payload?.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    const room = code.length === 4 ? rooms.get(code) : undefined;
    if (!room) return { ok: false, error: "Room not found" };
    const existing = sockets.get(socketId);
    if (existing) {
      if (existing.code !== code) return { ok: false, error: "Already in a room" };
      return { ok: true, code, playerId: existing.playerId };
    }
    if (room.game && room.game.phase !== "won") {
      return { ok: false, error: "Game already started" };
    }
    if (room.players.length >= 4) return { ok: false, error: "Room is full" };
    const player = {
      id: randomBytes(9).toString("base64url"),
      name: "Waiting",
      socketId,
      connected: true,
      waiting: true,
    };
    room.players.push(player);
    sockets.set(socketId, { code, playerId: player.id });
    return { ok: true, code, playerId: player.id };
  }

  function joinRoom(socketId, payload) {
    const code = String(payload?.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    const room = code.length === 4 ? rooms.get(code) : undefined;
    if (!room) return { ok: false, error: "Room not found" };
    const existing = sockets.get(socketId);
    if (existing && existing.code === code) {
      const seated = room.players.find((player) => player.id === existing.playerId);
      if (seated?.waiting) {
        const trimmed = cleanName(payload?.name);
        if (trimmed) {
          seated.name = trimmed;
          seated.waiting = false;
        }
        seated.connected = true;
        seated.socketId = socketId;
        return { ok: true, code, playerId: seated.id };
      }
    }
    if (existing && !(existing.code === code && existing.playerId === payload?.playerId)) {
      return { ok: false, error: "Already in a room" };
    }
    const playerId = payload?.playerId;
    const returning = playerId ? room.players.find((player) => player.id === playerId) : undefined;
    if (returning) {
      returning.connected = true;
      returning.socketId = socketId;
      sockets.set(socketId, { code, playerId: returning.id });
      if (room.game?.phase === "play") arm(room);
      return { ok: true, code, playerId: returning.id };
    }
    if (room.game && room.game.phase !== "won") {
      return { ok: false, error: "Game already started" };
    }
    if (room.players.length >= 4) return { ok: false, error: "Room is full" };
    const trimmed = cleanName(payload?.name);
    if (!trimmed) return { ok: false, error: "Need a name" };
    const player = {
      id: randomBytes(9).toString("base64url"),
      name: trimmed,
      socketId,
      connected: true,
    };
    room.players.push(player);
    sockets.set(socketId, { code, playerId: player.id });
    return { ok: true, code, playerId: player.id };
  }

  function disconnect(socketId) {
    const found = locate(socketId);
    if (!found.ok) return { ok: true, code: null };
    const { room } = found;
    const player = room.players[found.seat];
    sockets.delete(socketId);
    player.connected = false;
    player.socketId = null;
    if (room.game?.phase === "play") arm(room);
    if (!room.game || room.game.phase === "won") {
      disarm(room);
      room.players = room.players.filter((item) => item.connected);
      if (room.players.length === 0) {
        rooms.delete(room.code);
        return { ok: true, code: null };
      }
      if (!room.players.some((item) => item.id === room.hostId)) {
        room.hostId = room.players[0].id;
      }
    }
    return { ok: true, code: room.code };
  }

  function apply(socketId, move) {
    const found = locate(socketId);
    if (!found.ok) return found;
    if (!found.room.game) return { ok: false, error: "Game has not started" };
    const result = move(found.room.game, found.seat);
    if (result.error) return { ok: false, error: result.error };
    found.room.game = result.state;
    return { ok: true, code: found.room.code, room: found.room };
  }

  function noteDeal(room, before) {
    if (room.game.table.length > before) {
      room.cardsPlayed += 1;
      room.lastDealAt = now();
    }
    room.turnStarted = now();
    arm(room);
  }

  function startGame(socketId) {
    const found = locate(socketId);
    if (!found.ok) return found;
    const { room } = found;
    const actor = room.players[found.seat];
    if (actor.id !== room.hostId) return { ok: false, error: "Only the host can start" };
    if (room.game && room.game.phase !== "won") {
      return { ok: false, error: "Game already started" };
    }
    for (const player of room.players) {
      if (!player.waiting || !player.socketId) continue;
      sockets.delete(player.socketId);
    }
    room.players = room.players.filter((player) => player.connected && !player.waiting);
    if (room.players.length && !room.players.some((player) => player.id === room.hostId)) {
      room.hostId = room.players[0].id;
    }
    if (!room.players.some((player) => player.id === actor.id)) {
      return { ok: false, error: "Not in a room" };
    }
    if (room.players.length < 2) return { ok: false, error: "Need two players" };
    room.players = room.players.filter((player) => player.connected);
    room.game = newGame(room.players.length);
    room.cardsPlayed = 0;
    room.lastDealAt = now();
    room.turnStarted = now();
    arm(room);
    return { ok: true, code: room.code };
  }

  return {
    createRoom,
    joinRoom,
    holdSeat,
    leave: disconnect,
    disconnect,
    startGame,
    playCard(socketId) {
      const found = locate(socketId);
      const before = found.ok ? found.room.game?.table.length ?? 0 : 0;
      const result = apply(socketId, play);
      if (result.ok) noteDeal(result.room, before);
      return result;
    },
    slapCard(socketId) {
      const result = apply(socketId, slap);
      if (!result.ok) return result;
      const room = result.room;
      if (room.game.phase === "resolve") {
        if (!room.holding) scheduleResolve(room);
      } else {
        disarm(room);
      }
      return result;
    },
    snapshots,
  };
}

function defaultSchedule(fn, ms) {
  const id = setTimeout(fn, ms);
  if (typeof id.unref === "function") id.unref();
  return id;
}

function defaultClear(id) {
  clearTimeout(id);
}
