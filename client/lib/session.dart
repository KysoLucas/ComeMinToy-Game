import 'dart:async';

import 'package:flutter/foundation.dart';
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
  });

  final int seat;
  final String name;
  final bool connected;
  final bool host;
  final int count;
  final bool slapped;

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
            ),
          )
          .toList(),
    );
  }
}

class Session extends ChangeNotifier {
  Session({bool autostart = true, this._origin}) {
    if (autostart) connect();
  }

  final String? _origin;
  io.Socket? _socket;
  Timer? _ping;
  bool _closed = false;
  bool _sawConnect = false;

  RoomView? view;
  String? error;
  String name = '';
  bool connected = false;
  int? rttMs;

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
        final id = view?.playerId;
        final code = view?.code;
        if (id != null && code != null && code.isNotEmpty) {
          socket.emitWithAck('room:join', {
            'playerId': id,
            'code': code,
            'name': name,
          }, ack: _onAck);
        }
        _armPing();
        notifyListeners();
      })
      ..onDisconnect((_) {
        if (_closed) return;
        connected = false;
        notifyListeners();
      })
      ..on('room:state', _onView)
      ..connect();
  }

  void createRoom(String rawName) {
    name = rawName.trim();
    _emit('room:create', {'name': name});
  }

  void joinRoom(String rawName, String rawCode) {
    name = rawName.trim();
    _emit('room:join', {'name': name, 'code': rawCode.trim()});
  }

  void startGame() => _emit('game:start', const {});

  void playCard() => _emit('game:play', const {});

  void slap() => _emit('game:slap', const {});

  void leave() {
    _socket?.emitWithAck('room:leave', const {}, ack: (_) {});
    view = null;
    error = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _closed = true;
    _ping?.cancel();
    _socket?.dispose();
    super.dispose();
  }

  void _emit(String event, Map<String, dynamic> payload) {
    final socket = _socket;
    if (socket == null || !connected) {
      error = 'Offline';
      notifyListeners();
      return;
    }
    socket.emitWithAck(event, payload, ack: _onAck);
  }

  void _onAck(dynamic data) {
    if (_closed) return;
    final map = _asMap(data);
    if (map['ok'] == true) {
      error = null;
    } else {
      error = map['error'] as String? ?? 'Try again';
    }
    notifyListeners();
  }

  void _onView(dynamic data) {
    if (_closed) return;
    final next = RoomView.fromJson(_asMap(data));
    view = next;
    error = null;
    notifyListeners();
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
        notifyListeners();
      },
    );
  }
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
