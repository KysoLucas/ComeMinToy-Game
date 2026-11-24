class SeatMemory {
  String name = '';
  String? code;
  String? playerId;

  void persist() {}

  void clearSeat() {
    code = null;
    playerId = null;
  }
}
