import 'dart:async';

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:slapjack/cards.dart';
import 'package:slapjack/session.dart';

const _gold = Color(0xFFF0C14A);
const _edge = Color(0xFF8FB4E0);
const _oppStack = 64.0;

class HomeForm extends StatefulWidget {
  const HomeForm({super.key, required this.session});

  final Session session;

  @override
  State<HomeForm> createState() => _HomeFormState();
}

class _HomeFormState extends State<HomeForm> {
  late final TextEditingController _name;
  final _code = TextEditingController();
  late int _step;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.session.name);
    _step = widget.session.name.trim().isEmpty ? 1 : 2;
  }

  @override
  void dispose() {
    _name.dispose();
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: _step == 1 ? _nameStep() : _roomStep(),
        ),
      ),
    );
  }

  Widget _nameStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Hong Kong Slapjack',
          style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 20),
        const Center(child: _PersonMark()),
        const SizedBox(height: 16),
        TextField(
          controller: _name,
          textInputAction: TextInputAction.done,
          decoration: const InputDecoration(
            labelText: 'Your name',
            border: OutlineInputBorder(),
          ),
          onSubmitted: (_) => _continue(),
        ),
        const SizedBox(height: 16),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          onPressed: _continue,
          child: const Text('Continue'),
        ),
      ],
    );
  }

  Widget _roomStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Hong Kong Slapjack',
          style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 16),
        PlayerChip(name: widget.session.name),
        const SizedBox(height: 20),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          onPressed: () => widget.session.createRoom(widget.session.name),
          child: const Text('Create room'),
        ),
        const SizedBox(height: 24),
        TextField(
          controller: _code,
          textCapitalization: TextCapitalization.characters,
          maxLength: 4,
          decoration: const InputDecoration(
            labelText: 'Room code',
            border: OutlineInputBorder(),
          ),
        ),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          onPressed: () =>
              widget.session.joinRoom(widget.session.name, _code.text),
          child: const Text('Join room'),
        ),
      ],
    );
  }

  void _continue() {
    widget.session.submitName(_name.text);
    if (widget.session.name.trim().isEmpty || widget.session.view != null) {
      return;
    }
    setState(() => _step = 2);
  }
}

class WaitingRoom extends StatefulWidget {
  const WaitingRoom({super.key, required this.session});

  final Session session;

  @override
  State<WaitingRoom> createState() => _WaitingRoomState();
}

class _WaitingRoomState extends State<WaitingRoom> {
  String? _copied;

  @override
  Widget build(BuildContext context) {
    final view = widget.session.view;
    if (view == null) return const SizedBox.shrink();
    final link = roomLink(view.code);
    final named = view.players.where((seat) => !seat.waiting).length;
    final canStart = view.host && named >= 2;
    return Align(
      alignment: Alignment.topCenter,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Room ${view.code}',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 40,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 4,
                ),
              ),
              const SizedBox(height: 12),
              for (final seat in view.players) ...[
                PlayerChip(
                  name: seat.waiting
                      ? 'Waiting'
                      : seat.host
                      ? '${seat.name} · host'
                      : seat.name,
                ),
                const SizedBox(height: 8),
              ],
              const SizedBox(height: 8),
              Center(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF7F1E3),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: QrImageView(
                      data: link,
                      size: 160,
                      backgroundColor: const Color(0xFFF7F1E3),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Semantics(
                label: 'Room link $link',
                child: Text(link, textAlign: TextAlign.center),
              ),
              const SizedBox(height: 8),
              FilledButton(
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: link));
                  if (mounted) setState(() => _copied = 'Link copied');
                },
                child: Text(_copied ?? 'Copy link'),
              ),
              const SizedBox(height: 16),
              if (view.host)
                FilledButton(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                  ),
                  onPressed: canStart ? widget.session.startGame : null,
                  child: const Text('Start'),
                )
              else
                const Text('Waiting for the host', textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}

class PlayerChip extends StatelessWidget {
  const PlayerChip({super.key, required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _edge, width: 3),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            const Icon(Icons.person, color: _gold),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                name,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PersonMark extends StatelessWidget {
  const _PersonMark();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.fromBorderSide(BorderSide(color: _edge, width: 3)),
      ),
      child: Padding(
        padding: EdgeInsets.all(12),
        child: Icon(Icons.person, size: 48, color: _gold),
      ),
    );
  }
}

class TablePage extends StatefulWidget {
  const TablePage({super.key, required this.session});

  final Session session;

  @override
  State<TablePage> createState() => _TablePageState();
}

class _Deal {
  const _Deal({
    required this.seat,
    required this.card,
    required this.heldCount,
    required this.heldTop,
    required this.heldPile,
  });

  final int seat;
  final CardFace card;
  final int heldCount;
  final CardFace? heldTop;
  final int heldPile;
}

class _Gather {
  const _Gather({
    required this.seat,
    required this.top,
    required this.heldCount,
  });

  final int seat;
  final CardFace top;
  final int heldCount;
}

class _TablePageState extends State<TablePage> with TickerProviderStateMixin {
  final _boardKey = GlobalKey();
  final _layerKey = GlobalKey();
  final _seatKeys = <int, GlobalKey>{};
  late final AnimationController _motion;
  late final AnimationController _gatherMotion;
  final Map<int, AnimationController> _slaps = {};
  final Set<int> _armSlaps = {};
  final Set<int> _dropSlaps = {};
  Timer? _clock;
  String? _seen;
  RoomView? _prior;
  _Deal? _deal;
  _Gather? _gather;
  bool _armDeal = false;
  bool _armGather = false;
  int? _autoTurn;
  int? _autoPile;

  GlobalKey _seatKey(int seat) => _seatKeys.putIfAbsent(seat, GlobalKey.new);

  @override
  void initState() {
    super.initState();
    _motion = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
    );
    _gatherMotion = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _clock = Timer.periodic(const Duration(milliseconds: 200), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      _dealIfDue();
      setState(() {});
    });
    _motion.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) {
        setState(() => _deal = null);
      }
    });
    _gatherMotion.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) {
        setState(() => _gather = null);
      }
    });
  }

  @override
  void dispose() {
    _clock?.cancel();
    _motion.dispose();
    _gatherMotion.dispose();
    for (final motion in _slaps.values) {
      motion.dispose();
    }
    super.dispose();
  }

  void _dealIfDue() {
    final view = widget.session.view;
    if (view == null || view.phase != 'play' || view.turn != view.you) {
      _autoTurn = null;
      return;
    }
    final left = widget.session.remainMs;
    if (left == null || left > 0 || !widget.session.connected) return;
    if (_autoTurn == view.turn && _autoPile == view.pileCount) return;
    _autoTurn = view.turn;
    _autoPile = view.pileCount;
    widget.session.dealIfDue();
  }

  void _watch(RoomView view) {
    final signature = _signature(view);
    if (signature == _seen) return;
    final prior = _prior;
    _seen = signature;
    _prior = view;
    if (prior == null) return;
    for (final seat in view.players) {
      final before = prior.players.where((item) => item.seat == seat.seat);
      final was = before.isEmpty ? false : before.first.slapped;
      if (seat.slapped && !was && !_slaps.containsKey(seat.seat)) {
        _armSlaps.add(seat.seat);
      }
      if (!seat.slapped && _slaps.containsKey(seat.seat)) {
        _dropSlaps.add(seat.seat);
      }
    }
    if (prior.pileCount > 0 && view.pileCount == 0 && prior.top != null) {
      final taker = _taker(prior, view);
      if (taker != null) {
        Seat? source;
        for (final seat in prior.players) {
          if (seat.seat == taker) source = seat;
        }
        _gather = _Gather(
          seat: taker,
          top: prior.top!,
          heldCount: source?.count ?? 0,
        );
        _armGather = true;
      }
      _deal = null;
      _armDeal = false;
      return;
    }
    final from = _dealtBy(prior, view);
    final card = view.top;
    if (from == null || card == null || view.pileCount != prior.pileCount + 1) {
      _deal = null;
      _armDeal = false;
      return;
    }
    Seat? source;
    for (final seat in prior.players) {
      if (seat.seat == from) source = seat;
    }
    _deal = _Deal(
      seat: from,
      card: card,
      heldCount: source?.count ?? 0,
      heldTop: prior.top,
      heldPile: prior.pileCount,
    );
    _armDeal = true;
  }

  @override
  Widget build(BuildContext context) {
    final view = widget.session.view;
    if (view == null) return const SizedBox.shrink();
    _watch(view);
    if (_armDeal ||
        _armGather ||
        _armSlaps.isNotEmpty ||
        _dropSlaps.isNotEmpty) {
      final deal = _armDeal;
      final gather = _armGather;
      final arm = Set<int>.of(_armSlaps);
      final drop = Set<int>.of(_dropSlaps);
      _armDeal = false;
      _armGather = false;
      _armSlaps.clear();
      _dropSlaps.clear();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (deal && _deal != null) _motion.forward(from: 0);
        if (gather && _gather != null) _gatherMotion.forward(from: 0);
        var changed = false;
        for (final seat in arm) {
          if (_slaps.containsKey(seat)) continue;
          final motion = AnimationController(
            vsync: this,
            duration: const Duration(milliseconds: 520),
          );
          _slaps[seat] = motion;
          motion.forward(from: 0);
          changed = true;
        }
        for (final seat in drop) {
          final motion = _slaps.remove(seat);
          if (motion == null) continue;
          motion.dispose();
          changed = true;
        }
        if (changed) setState(() {});
      });
    }
    final deal = _deal;
    final gather = _gather;
    final places = _places(view);
    final toast = _slapMessage(view.banner);
    return Stack(
      key: _layerKey,
      children: [
        Column(
          children: [
            _compass(view, places, 'North', deal, gather),
            Expanded(
              child: Row(
                children: [
                  _compass(view, places, 'West', deal, gather),
                  Expanded(child: _board(view, deal)),
                  _compass(view, places, 'East', deal, gather),
                ],
              ),
            ),
            _south(view, deal, gather),
          ],
        ),
        if (deal != null) _flight(deal),
        if (gather != null) _scoop(gather),
        _saidNear(view),
        Align(
          alignment: const Alignment(0, -0.52),
          child: _BumpToast(message: toast),
        ),
        for (final seat in _slaps.keys) _slapHand(view, seat, _slaps[seat]!),
      ],
    );
  }

  Widget _board(RoomView view, _Deal? deal) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          BoardSlot(
            top: deal == null ? view.top : deal.heldTop,
            cardKey: _boardKey,
          ),
        ],
      ),
    );
  }

  Widget _compass(
    RoomView view,
    Map<String, Seat?> places,
    String place,
    _Deal? deal,
    _Gather? gather,
  ) {
    final seat = places[place];
    final wide = place == 'West' || place == 'East';
    final active = view.phase == 'play' && view.turn == seat?.seat;
    final body = seat == null
        ? const SizedBox(width: _oppStack, height: _oppStack)
        : Opacity(
            opacity: active ? 1 : 0.38,
            child: _SeatStack(
              seat: seat,
              place: place,
              count: _shownCount(seat, deal, gather),
              active: active,
              remain: widget.session.remainMs,
              stackKey: _seatKey(seat.seat),
            ),
          );
    if (!wide) return SizedBox(height: 108, child: Center(child: body));
    return SizedBox(width: 124, child: Center(child: body));
  }

  Widget _saidNear(RoomView view) {
    final said = view.said;
    final by = view.saidBy;
    final center = _center(_boardKey);
    if (said == null || by == null || center == null) {
      return const SizedBox.shrink();
    }
    final place = _places(view).entries
        .where((entry) => entry.value?.seat == by)
        .map((entry) => entry.key)
        .firstWhere((_) => true, orElse: () => 'South');
    return _AnchoredSpeech(center: center, place: place, text: said);
  }

  Widget _south(RoomView view, _Deal? deal, _Gather? gather) {
    final mine = view.mine;
    final count = mine == null ? 0 : _shownCount(mine, deal, gather);
    final yourTurn = view.phase == 'play' && view.turn == view.you;
    final remain = widget.session.remainMs;
    final seconds = remain == null ? null : (remain / 1000).ceil();
    return Column(
      children: [
        SizedBox(
          height: 64,
          child: Row(
            children: [
              if (mine != null)
                Semantics(
                  label: 'South ${mine.name}',
                  container: true,
                  child: _PersonBadge(
                    name: mine.name,
                    offline: !mine.connected,
                    compact: true,
                  ),
                ),
              Expanded(
                child: view.phase == 'play' && seconds != null
                    ? Semantics(
                        label: 'Deal in $seconds',
                        container: true,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              '$seconds',
                              style: const TextStyle(
                                fontSize: 40,
                                fontWeight: FontWeight.w800,
                                color: _gold,
                                height: 1,
                              ),
                            ),
                            const Text(
                              'auto deal',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: _gold,
                              ),
                            ),
                          ],
                        ),
                      )
                    : Text(
                        _status(view),
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                      ),
              ),
              const SizedBox(width: 56),
            ],
          ),
        ),
        LayoutBuilder(
          builder: (context, constraints) {
            final side = ((constraints.maxWidth - 8) / 2).clamp(72.0, 210.0);
            return Row(
              children: [
                Opacity(
                  opacity: yourTurn ? 1 : 0.55,
                  child: _CornerButton(
                    size: side,
                    title: 'Deal',
                    child: KeyedSubtree(
                      key: _seatKey(view.you),
                      child: CoveredFan(
                        count: count,
                        canPlay: yourTurn,
                        active: yourTurn,
                        size: side,
                        onPlay: widget.session.playCard,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                _SlapButton(
                  size: side,
                  enabled: view.phase != 'won',
                  hot: view.phase == 'slap',
                  onPressed: view.phase == 'won' ? null : widget.session.slap,
                ),
              ],
            );
          },
        ),
      ],
    );
  }

  Widget _flight(_Deal deal) {
    return Positioned.fill(
      child: IgnorePointer(
        child: AnimatedBuilder(
          animation: _motion,
          builder: (context, _) {
            final from = _center(_seatKey(deal.seat));
            final to = _center(_boardKey);
            if (from == null || to == null) return const SizedBox.shrink();
            final t = Curves.easeOutCubic.transform(_motion.value);
            final center = Offset.lerp(from, to, t)!;
            final scale = 0.56 + (0.44 * t);
            return Stack(
              children: [
                Positioned(
                  left: center.dx - 55,
                  top: center.dy - 77,
                  child: Transform.scale(
                    scale: scale,
                    child: Semantics(
                      label: 'Dealing',
                      container: true,
                      child: ExcludeSemantics(child: FaceCard(card: deal.card)),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _scoop(_Gather gather) {
    return Positioned.fill(
      child: IgnorePointer(
        child: AnimatedBuilder(
          animation: _gatherMotion,
          builder: (context, _) {
            final from = _center(_boardKey);
            final to = _center(_seatKey(gather.seat));
            if (from == null || to == null) return const SizedBox.shrink();
            final t = Curves.easeInOut.transform(_gatherMotion.value);
            final center = Offset.lerp(from, to, t)!;
            final scale = 1 - (0.46 * t);
            return Stack(
              children: [
                Positioned(
                  left: center.dx - 55,
                  top: center.dy - 77,
                  child: Transform.scale(
                    scale: scale,
                    child: Semantics(
                      label: 'Gathering',
                      container: true,
                      child: ExcludeSemantics(
                        child: Stack(
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(left: 14, top: 10),
                              child: CardBack(width: 110, height: 154),
                            ),
                            Padding(
                              padding: const EdgeInsets.only(left: 7, top: 5),
                              child: CardBack(width: 110, height: 154),
                            ),
                            FaceCard(card: gather.top),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _slapHand(RoomView view, int seat, AnimationController motion) {
    final place = _places(view).entries
        .where((entry) => entry.value?.seat == seat)
        .map((entry) => entry.key)
        .firstWhere((_) => true, orElse: () => 'South');
    final turns = switch (place) {
      'West' => 0.25,
      'North' => 0.5,
      'East' => -0.25,
      _ => 0.0,
    };
    return Positioned.fill(
      child: IgnorePointer(
        child: AnimatedBuilder(
          animation: motion,
          builder: (context, _) {
            final from = _center(_seatKey(seat));
            final to = _center(_boardKey);
            if (from == null || to == null) return const SizedBox.shrink();
            final t = Curves.easeOut.transform(motion.value);
            final center = Offset.lerp(from, to, t)!;
            return Stack(
              children: [
                Positioned(
                  left: center.dx - 42,
                  top: center.dy - 42,
                  child: Semantics(
                    label: 'Slapping',
                    container: true,
                    child: ExcludeSemantics(
                      child: Transform.rotate(
                        angle: turns * 3.1415926535 * 2,
                        child: const Stack(
                          alignment: Alignment.center,
                          children: [
                            Icon(
                              Icons.front_hand,
                              size: 86,
                              color: Color(0xFF1A1A1A),
                            ),
                            Icon(
                              Icons.front_hand,
                              size: 74,
                              color: Color(0xFFFFB74D),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Offset? _center(GlobalKey key) {
    final stack = _layerKey.currentContext?.findRenderObject() as RenderBox?;
    final box = key.currentContext?.findRenderObject() as RenderBox?;
    if (stack == null || box == null || !stack.hasSize || !box.hasSize) {
      return null;
    }
    return stack.globalToLocal(box.localToGlobal(box.size.center(Offset.zero)));
  }

  String _status(RoomView view) {
    if (view.phase == 'won') return view.banner ?? 'Game over';
    if (view.phase == 'slap') return 'Slap now';
    if (view.turn == view.you) return 'Your turn';
    final turn = view.turn;
    if (turn == null || turn < 0 || turn >= view.players.length) {
      return 'Waiting';
    }
    return "${view.players[turn].name}'s turn";
  }
}

class _SeatStack extends StatelessWidget {
  const _SeatStack({
    required this.seat,
    required this.place,
    required this.count,
    required this.active,
    required this.remain,
    required this.stackKey,
  });

  final Seat seat;
  final String place;
  final int count;
  final bool active;
  final int? remain;
  final Key stackKey;

  @override
  Widget build(BuildContext context) {
    final stack = KeyedSubtree(
      key: stackKey,
      child: CoveredFan(
        count: count,
        canPlay: false,
        active: false,
        framed: false,
        size: _oppStack,
        label: 'Stack $count',
        onPlay: () {},
      ),
    );
    final badge = _PersonBadge(
      name: seat.name,
      place: place,
      offline: !seat.connected,
      seconds: active && remain != null ? (remain! / 1000).ceil() : null,
    );
    final row = Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: place == 'East' ? [stack, badge] : [badge, stack],
    );
    return row;
  }
}

class _PersonBadge extends StatelessWidget {
  const _PersonBadge({
    required this.name,
    this.place,
    this.offline = false,
    this.seconds,
    this.compact = false,
  });

  final String name;
  final String? place;
  final bool offline;
  final int? seconds;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final label = place == null ? name : '$place $name';
    return Semantics(
      label: label,
      container: true,
      child: SizedBox(
        width: 52,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: compact ? 32 : 36,
              height: compact ? 32 : 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: _edge, width: 2),
              ),
              child: Icon(
                Icons.person,
                size: compact ? 18 : 22,
                color: offline ? const Color(0xFFFFB4A8) : _gold,
              ),
            ),
            Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
            ),
            if (!compact)
              SizedBox(
                height: 18,
                child: Text(
                  offline
                      ? 'Offline'
                      : seconds == null
                      ? ' '
                      : '$seconds',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: offline ? const Color(0xFFFFB4A8) : _gold,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CornerButton extends StatelessWidget {
  const _CornerButton({
    required this.size,
    required this.title,
    required this.child,
  });

  final double size;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        children: [
          child,
          Positioned(
            left: 8,
            top: 6,
            child: ExcludeSemantics(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFFF7F1E3),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AnchoredSpeech extends StatelessWidget {
  const _AnchoredSpeech({
    required this.center,
    required this.place,
    required this.text,
  });

  final Offset center;
  final String place;
  final String text;

  @override
  Widget build(BuildContext context) {
    const bodyW = 56.0;
    const bodyH = 44.0;
    const tail = 8.0;
    const gap = 2.0;
    final towardCard = switch (place) {
      'North' => 'down',
      'West' => 'right',
      'East' => 'left',
      _ => 'up',
    };
    final horizontal = towardCard == 'left' || towardCard == 'right';
    final width = horizontal ? bodyW + tail : bodyW;
    final height = horizontal ? bodyH : bodyH + tail;
    final double left;
    final double top;
    if (place == 'North') {
      left = center.dx - width / 2;
      top = center.dy - 77 - gap - height;
    } else if (place == 'South') {
      left = center.dx - width / 2;
      top = center.dy + 77 + gap;
    } else if (place == 'West') {
      left = center.dx - 55 - gap - width;
      top = center.dy - height / 2;
    } else {
      left = center.dx + 55 + gap;
      top = center.dy - height / 2;
    }
    final bubble = DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFF7F1E3),
        borderRadius: BorderRadius.circular(14),
      ),
      child: SizedBox(
        width: bodyW,
        height: bodyH,
        child: Center(
          child: Text(
            text,
            style: const TextStyle(
              color: Color(0xFF1A1A1A),
              fontSize: 28,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ),
    );
    final tailBox = _Tail(direction: towardCard);
    return Positioned(
      left: left,
      top: top,
      child: IgnorePointer(
        child: horizontal
            ? Row(
                mainAxisSize: MainAxisSize.min,
                children: towardCard == 'left'
                    ? [tailBox, bubble]
                    : [bubble, tailBox],
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: towardCard == 'up'
                    ? [tailBox, bubble]
                    : [bubble, tailBox],
              ),
      ),
    );
  }
}

class _Tail extends StatelessWidget {
  const _Tail({required this.direction});

  final String direction;

  @override
  Widget build(BuildContext context) {
    final horizontal = direction == 'left' || direction == 'right';
    return CustomPaint(
      size: horizontal ? const Size(8, 14) : const Size(14, 8),
      painter: _TailPainter(direction),
    );
  }
}

class _TailPainter extends CustomPainter {
  const _TailPainter(this.direction);

  final String direction;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path();
    if (direction == 'up') {
      path
        ..moveTo(0, size.height)
        ..lineTo(size.width / 2, 0)
        ..lineTo(size.width, size.height);
    } else if (direction == 'down') {
      path
        ..moveTo(0, 0)
        ..lineTo(size.width / 2, size.height)
        ..lineTo(size.width, 0);
    } else if (direction == 'left') {
      path
        ..moveTo(size.width, 0)
        ..lineTo(0, size.height / 2)
        ..lineTo(size.width, size.height);
    } else {
      path
        ..moveTo(0, 0)
        ..lineTo(size.width, size.height / 2)
        ..lineTo(0, size.height);
    }
    path.close();
    canvas.drawPath(path, Paint()..color = const Color(0xFFF7F1E3));
  }

  @override
  bool shouldRepaint(covariant _TailPainter oldDelegate) {
    return oldDelegate.direction != direction;
  }
}

class _SlapButton extends StatelessWidget {
  const _SlapButton({
    required this.size,
    required this.enabled,
    required this.hot,
    required this.onPressed,
  });

  final double size;
  final bool enabled;
  final bool hot;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: enabled,
      label: 'Slap',
      onTap: onPressed,
      container: true,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onPressed,
        child: SizedBox(
          width: size,
          height: size,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: enabled
                  ? const Color(0xFF1E4D8C)
                  : const Color(0xFF14365F),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: hot ? _gold : _edge, width: 3),
            ),
            child: Stack(
              children: [
                const Positioned(
                  left: 8,
                  top: 6,
                  child: Text(
                    'Slap',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFFF7F1E3),
                    ),
                  ),
                ),
                const Center(
                  child: Icon(
                    Icons.front_hand,
                    size: 48,
                    color: Color(0xFFF7F1E3),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

Map<String, Seat?> _places(RoomView view) {
  final seats = {
    for (final place in ['North', 'East', 'South', 'West'])
      place: null as Seat?,
  };
  final you = view.you;
  final count = view.players.length;
  for (final seat in view.players) {
    seats[_place(seat.seat, you, count)] = seat;
  }
  return seats;
}

String _place(int seat, int you, int count) {
  if (count <= 1) return 'South';
  final rel = (seat - you + count) % count;
  if (count == 2) return rel == 0 ? 'South' : 'North';
  if (count == 3) return const ['South', 'West', 'East'][rel];
  return const ['South', 'West', 'North', 'East'][rel];
}

int _shownCount(Seat seat, _Deal? deal, _Gather? gather) {
  if (deal?.seat == seat.seat) return deal!.heldCount;
  if (gather?.seat == seat.seat) return gather!.heldCount;
  return seat.count;
}

int? _taker(RoomView before, RoomView after) {
  int? seat;
  for (final next in after.players) {
    Seat? prior;
    for (final item in before.players) {
      if (item.seat == next.seat) prior = item;
    }
    if (prior != null && next.count >= prior.count + before.pileCount) {
      if (seat != null) return null;
      seat = next.seat;
    }
  }
  return seat;
}

String? _slapMessage(String? banner) {
  if (banner == null) return null;
  if (banner.contains('Slapped the Wrong Card') ||
      banner.contains('too slow')) {
    return banner;
  }
  return null;
}

class _BumpToast extends StatefulWidget {
  const _BumpToast({required this.message});

  final String? message;

  @override
  State<_BumpToast> createState() => _BumpToastState();
}

class _BumpToastState extends State<_BumpToast>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pop;
  String? _shown;

  @override
  void initState() {
    super.initState();
    _pop = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
    );
    _shown = widget.message;
    if (_shown != null) _pop.forward(from: 0);
  }

  @override
  void didUpdateWidget(_BumpToast oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.message == null) {
      _shown = null;
      return;
    }
    if (widget.message != _shown) {
      _shown = widget.message;
      _pop.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _pop.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final message = widget.message;
    if (message == null) return const SizedBox.shrink();
    final scale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(
          begin: 0.15,
          end: 1.12,
        ).chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 62,
      ),
      TweenSequenceItem(
        tween: Tween<double>(
          begin: 1.12,
          end: 0.96,
        ).chain(CurveTween(curve: Curves.easeInOut)),
        weight: 20,
      ),
      TweenSequenceItem(
        tween: Tween<double>(
          begin: 0.96,
          end: 1,
        ).chain(CurveTween(curve: Curves.easeOut)),
        weight: 18,
      ),
    ]).animate(_pop);
    return IgnorePointer(
      child: ScaleTransition(
        scale: scale,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 300),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: const Color(0xFFF7F1E3),
              borderRadius: BorderRadius.circular(18),
              boxShadow: const [
                BoxShadow(
                  color: Color(0xAA000000),
                  blurRadius: 16,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              child: Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFF1A1A1A),
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String _signature(RoomView view) {
  final top = view.top;
  final counts = view.players
      .map((seat) => '${seat.seat}:${seat.count}:${seat.slapped}')
      .join(',');
  return '${view.code}|${view.phase}|${view.pileCount}|${top?.rank ?? ''}${top?.suit ?? ''}|$counts';
}

int? _dealtBy(RoomView before, RoomView after) {
  int? seat;
  for (final next in after.players) {
    Seat? prior;
    for (final item in before.players) {
      if (item.seat == next.seat) prior = item;
    }
    if (prior != null && prior.count == next.count + 1) {
      if (seat != null) return null;
      seat = next.seat;
    }
  }
  return seat;
}

String roomLink(String code) {
  final base = Uri.base;
  final origin = base.hasScheme && base.host.isNotEmpty
      ? base.origin
      : 'http://127.0.0.1:8080';
  return '$origin/?room=$code';
}
