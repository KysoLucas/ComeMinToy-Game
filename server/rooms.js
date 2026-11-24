import { randomBytes, randomInt } from "node:crypto";
import { newGame, play, slap, viewGame } from "./rules.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function cleanName(name) {
  const trimmed = String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 16);
  return trimmed.length ? trimmed : "Player";
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

export function createRoomBook() {
  const rooms = new Map();
  const sockets = new Map();

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
      })),
    };
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
    let code = "";
    do {
      code = "";
      for (let i = 0; i < 4; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
    } while (rooms.has(code));
    const player = {
      id: randomBytes(9).toString("base64url"),
      name: cleanName(name),
      socketId,
      connected: true,
    };
    rooms.set(code, { code, hostId: player.id, players: [player], game: null });
    sockets.set(socketId, { code, playerId: player.id });
    return { ok: true, code, playerId: player.id };
  }

  function joinRoom(socketId, payload) {
    const code = String(payload?.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    const room = code.length === 4 ? rooms.get(code) : undefined;
    if (!room) return { ok: false, error: "Room not found" };
    const existing = sockets.get(socketId);
    if (existing && !(existing.code === code && existing.playerId === payload?.playerId)) {
      return { ok: false, error: "Already in a room" };
    }
    const playerId = payload?.playerId;
    const returning = playerId ? room.players.find((player) => player.id === playerId) : undefined;
    if (returning) {
      returning.connected = true;
      returning.socketId = socketId;
      sockets.set(socketId, { code, playerId: returning.id });
      return { ok: true, code, playerId: returning.id };
    }
    if (room.game && room.game.phase !== "won") {
      return { ok: false, error: "Game already started" };
    }
    if (room.players.length >= 4) return { ok: false, error: "Room is full" };
    const player = {
      id: randomBytes(9).toString("base64url"),
      name: cleanName(payload?.name),
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
    if (!room.game || room.game.phase === "won") {
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
    return { ok: true, code: found.room.code };
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
    room.players = room.players.filter((player) => player.connected);
    if (room.players.length && !room.players.some((player) => player.id === room.hostId)) {
      room.hostId = room.players[0].id;
    }
    if (!room.players.some((player) => player.id === actor.id)) {
      return { ok: false, error: "Not in a room" };
    }
    if (room.players.length < 2) return { ok: false, error: "Need two players" };
    room.game = newGame(room.players.length);
    return { ok: true, code: room.code };
  }

  return {
    createRoom,
    joinRoom,
    leave: disconnect,
    disconnect,
    startGame,
    playCard: (socketId) => apply(socketId, play),
    slapCard: (socketId) => apply(socketId, slap),
    snapshots,
  };
}
