import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:slapjack/seat_memory.dart';
import 'package:slapjack/seat_store.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

class CardFace {
  const CardFace({required this.rank, required this.suit});

  final String rank;
  final String suit;

  bool get red => suit == '♥' || suit == '♦';
}

class Seat {
  const Seat({
    required this.seat,
    required this.name,
    required this.connected,
    required this.host,
    required this.count,
    required this.slapped,
    this.waiting = false,
  });

  final int seat;
  final String name;
  final bool connected;
  final bool host;
  final int count;
  final bool slapped;
  final bool waiting;

  String get label => '$name · $count cards';
}

class RoomView {
  const RoomView({
    required this.code,
    required this.playerId,
    required this.phase,
    required this.you,
    required this.host,
    required this.banner,
    required this.turn,
    required this.winner,
    required this.pileCount,
    required this.top,
    required this.said,
    required this.saidBy,
    required this.players,
    this.remainMs,
  });

  final String code;
  final String? playerId;
  final String phase;
  final int you;
  final bool host;
  final String? banner;
  final int? turn;
  final int? winner;
  final int pileCount;
  final CardFace? top;
  final String? said;
  final int? saidBy;
  final List<Seat> players;
  final int? remainMs;

  Seat? get mine => you >= 0 && you < players.length ? players[you] : null;

  factory RoomView.fromJson(Map<String, dynamic> json) {
    final top = json['top'];
    return RoomView(
      code: '${json['code'] ?? ''}',
      playerId: json['playerId'] as String?,
      phase: '${json['phase'] ?? 'lobby'}',
      you: _asInt(json['you'], -1),
      host: json['host'] == true,
      banner: json['banner'] as String?,
      turn: json['turn'] == null ? null : _asInt(json['turn'], 0),
      winner: json['winner'] == null ? null : _asInt(json['winner'], 0),
      pileCount: _asInt(json['pileCount'], 0),
      top: top is Map
          ? CardFace(rank: '${top['rank']}', suit: '${top['suit']}')
          : null,
      said: json['said'] as String?,
      saidBy: json['saidBy'] == null ? null : _asInt(json['saidBy'], 0),
      remainMs: json['remainMs'] == null ? null : _asInt(json['remainMs'], 0),
      players: (json['players'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (item) => Seat(
              seat: _asInt(item['seat'], 0),
              name: '${item['name'] ?? 'Player'}',
              connected: item['connected'] == true,
              host: item['host'] == true,
              count: _asInt(item['count'], 0),
              slapped: item['slapped'] == true,
              waiting: item['waiting'] == true,
            ),
          )
          .toList(),
    );
  }
}

class Session extends ChangeNotifier {
  Session({
    bool autostart = true,
    this._origin,
    SeatMemory? memory,
    String? invite,
  }) : memory = memory ?? loadMemory() {
    name = this.memory.name;
    final inviteCode = invite ?? readInvite();
    if (inviteCode != null && inviteCode != this.memory.code) {
      this.memory.clearSeat();
      this.memory.persist();
    }
    pendingRoom = inviteCode;
    if (autostart) connect();
  }

  final String? _origin;
  final SeatMemory memory;
  io.Socket? _socket;
  Timer? _ping;
  bool _closed = false;
  bool _sawConnect = false;
  int? _remain;
  DateTime _remainAt = DateTime.now();

  RoomView? view;
  String? error;
  String? heldBanner;
  Timer? _bannerTimer;
  String? pendingRoom;
  String name = '';
  bool connected = false;
  bool confirmLeave = false;
  bool entering = false;
  int? rttMs;
  final ValueNotifier<String> connection = ValueNotifier<String>('Connecting');

  int? get remainMs {
    final remain = _remain;
    if (remain == null) return null;
    final left = remain - DateTime.now().difference(_remainAt).inMilliseconds;
    return left < 0 ? 0 : left;
  }

  String get pingLabel {
    if (rttMs != null && connected) return '$rttMs ms';
    if (!connected && _sawConnect) return 'Offline';
    return 'Connecting';
  }

  void connect() {
    final socket = io.io(
      _origin ?? _pageOrigin(),
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .disableAutoConnect()
          .build(),
    );
    _socket = socket;
    socket
      ..onConnect((_) {
        if (_closed) return;
        connected = true;
        _sawConnect = true;
        final savedId = memory.playerId;
        final savedCode = memory.code;
        if (savedId != null &&
            savedCode != null &&
            (pendingRoom == null || pendingRoom == savedCode)) {
          socket.emitWithAck('room:join', {
            'playerId': savedId,
            'code': savedCode,
            'name': name,
          }, ack: _onAck);
        } else if (name.isNotEmpty && pendingRoom != null) {
          entering = true;
          socket.emitWithAck('room:join', {
            'name': name,
            'code': pendingRoom,
          }, ack: _onAck);
        } else if (pendingRoom != null) {
          socket.emitWithAck('room:hold', {'code': pendingRoom}, ack: _onAck);
        }
        _armPing();
        _syncConnection();
        notifyListeners();
      })
      ..onDisconnect((_) {
        if (_closed) return;
        connected = false;
        _syncConnection();
        notifyListeners();
      })
      ..on('room:state', _onView)
      ..connect();
  }

  void submitName(String rawName) {
    final next = rawName.trim();
    if (next.isEmpty) {
      error = 'Enter your name';
      notifyListeners();
      return;
    }
    name = next;
    memory.name = next;
    memory.persist();
    error = null;
    final code =
        pendingRoom ?? (view?.mine?.waiting == true ? memory.code : null);
    if (code != null) {
      joinRoom(name, code);
      return;
    }
    notifyListeners();
  }

  void createRoom(String rawName) {
    final next = rawName.trim();
    if (next.isEmpty) {
      error = 'Enter your name';
      notifyListeners();
      return;
    }
    name = next;
    memory.name = next;
    memory.persist();
    entering = true;
    notifyListeners();
    _emit('room:create', {'name': name});
  }

  void joinRoom(String rawName, String rawCode) {
    final next = rawName.trim();
    if (next.isEmpty) {
      error = 'Enter your name';
      notifyListeners();
      return;
    }
    name = next;
    memory.name = next;
    memory.persist();
    entering = true;
    notifyListeners();
    _emit('room:join', {'name': name, 'code': rawCode.trim()});
  }

  void startGame() => _emit('game:start', const {});

  bool _quietMiss = false;

  void playCard() => _emit('game:play', const {});

  void dealIfDue() => _emit('game:play', const {}, quiet: true);

  void slap() => _emit('game:slap', const {});

  void askLeave() {
    confirmLeave = true;
    notifyListeners();
  }

  void cancelLeave() {
    confirmLeave = false;
    notifyListeners();
  }

  void leave() {
    _socket?.emitWithAck('room:leave', const {}, ack: (_) {});
    view = null;
    error = null;
    confirmLeave = false;
    pendingRoom = null;
    memory.clearSeat();
    memory.persist();
    notifyListeners();
  }

  @override
  void dispose() {
    _closed = true;
    _ping?.cancel();
    _bannerTimer?.cancel();
    _socket?.dispose();
    connection.dispose();
    super.dispose();
  }

  void _emit(String event, Map<String, dynamic> payload, {bool quiet = false}) {
    final socket = _socket;
    if (socket == null || !connected) {
      error = 'Offline';
      entering = false;
      notifyListeners();
      return;
    }
    _quietMiss = quiet;
    socket.emitWithAck(event, payload, ack: _onAck);
  }

  void _onAck(dynamic data) {
    if (_closed) return;
    final map = _asMap(data);
    final quiet = _quietMiss;
    _quietMiss = false;
    final missed = map['error'];
    if (map['ok'] == true) {
      error = null;
    } else if (quiet && missed == 'Not your turn') {
      return;
    } else if (missed == 'Not your turn' || missed == 'No card to slap') {
      return;
    } else {
      error = missed as String? ?? 'Try again';
      entering = false;
    }
    notifyListeners();
  }

  void _onView(dynamic data) {
    if (_closed) return;
    final next = RoomView.fromJson(_asMap(data));
    view = next;
    error = null;
    entering = false;
    _holdBanner(next.banner);
    if (next.playerId != null && next.code.isNotEmpty) {
      memory.code = next.code;
      memory.playerId = next.playerId;
      memory.persist();
      if (next.mine?.waiting != true) pendingRoom = null;
    }
    _remain = next.remainMs;
    _remainAt = DateTime.now();
    notifyListeners();
  }

  void _holdBanner(String? banner) {
    if (banner == null) return;
    if (!banner.contains('Slapped the Wrong Card') &&
        !banner.contains('too slow')) {
      return;
    }
    heldBanner = banner;
    _bannerTimer?.cancel();
    _bannerTimer = Timer(const Duration(milliseconds: 900), () {
      heldBanner = null;
      if (!_closed) notifyListeners();
    });
  }

  void _armPing() {
    _ping?.cancel();
    _pingOnce();
    _ping = Timer.periodic(const Duration(seconds: 1), (_) => _pingOnce());
  }

  void _pingOnce() {
    final socket = _socket;
    if (socket == null || !connected || _closed) return;
    final started = DateTime.now().millisecondsSinceEpoch;
    socket.emitWithAck(
      'net:ping',
      {'t': started},
      ack: (data) {
        if (_closed || _asMap(data)['ok'] != true) return;
        rttMs = DateTime.now().millisecondsSinceEpoch - started;
        _syncConnection();
      },
    );
  }

  void _syncConnection() {
    if (_closed) return;
    final next = pingLabel;
    if (connection.value != next) connection.value = next;
  }
}

String? readInvite() {
  final raw = Uri.base.queryParameters['room'];
  if (raw == null || raw.isEmpty) return null;
  final code = raw.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
  return code.length == 4 ? code : null;
}

String _pageOrigin() {
  final base = Uri.base;
  if (base.hasScheme && base.host.isNotEmpty) return base.origin;
  return 'http://127.0.0.1:8080';
}

Map<String, dynamic> _asMap(dynamic data) {
  if (data is Map) {
    return data.map((key, value) => MapEntry('$key', value));
  }
  if (data is List && data.isNotEmpty) return _asMap(data.first);
  return {};
}

int _asInt(dynamic value, int fallback) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse('$value') ?? fallback;
}
