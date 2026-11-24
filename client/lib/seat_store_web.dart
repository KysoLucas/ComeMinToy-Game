import 'package:slapjack/seat_memory.dart';
import 'package:web/web.dart';

SeatMemory loadMemory() {
  final box = window.localStorage;
  final memory = _WebMemory(box);
  memory.name = box.getItem('slapjack-name') ?? '';
  final code = box.getItem('slapjack-code');
  final playerId = box.getItem('slapjack-player');
  memory.code = code == null || code.isEmpty ? null : code;
  memory.playerId = playerId == null || playerId.isEmpty ? null : playerId;
  return memory;
}

class _WebMemory extends SeatMemory {
  _WebMemory(this._box);

  final Storage _box;

  @override
  void persist() {
    _box.setItem('slapjack-name', name);
    if (code == null || playerId == null) {
      _box.removeItem('slapjack-code');
      _box.removeItem('slapjack-player');
      return;
    }
    _box.setItem('slapjack-code', code!);
    _box.setItem('slapjack-player', playerId!);
  }
}
