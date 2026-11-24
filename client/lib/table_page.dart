import 'package:material_ui/material_ui.dart';
import 'package:slapjack/cards.dart';
import 'package:slapjack/session.dart';

class HomeForm extends StatefulWidget {
  const HomeForm({super.key, required this.session});

  final Session session;

  @override
  State<HomeForm> createState() => _HomeFormState();
}

class _HomeFormState extends State<HomeForm> {
  final _name = TextEditingController();
  final _code = TextEditingController();

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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Hong Kong Slapjack',
                style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              const Text(
                'Play the top card on your turn. The count runs from ace to king, and ace is called 1. Slap when the card matches the count. A wrong slap takes the pile.',
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _name,
                textInputAction: TextInputAction.done,
                decoration: const InputDecoration(
                  labelText: 'Your name',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: () => widget.session.createRoom(_name.text),
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
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: () =>
                    widget.session.joinRoom(_name.text, _code.text),
                child: const Text('Join room'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class WaitingRoom extends StatelessWidget {
  const WaitingRoom({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    final view = session.view;
    if (view == null) return const SizedBox.shrink();
    final canStart = view.host && view.players.length >= 2;
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
              const SizedBox(height: 16),
              for (final seat in view.players)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Text(
                    seat.host ? '${seat.name} · host' : seat.name,
                    style: const TextStyle(fontSize: 20),
                  ),
                ),
              const SizedBox(height: 20),
              if (view.host)
                FilledButton(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                  ),
                  onPressed: canStart ? session.startGame : null,
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

class _TablePageState extends State<TablePage>
    with SingleTickerProviderStateMixin {
  final _boardKey = GlobalKey();
  final _layerKey = GlobalKey();
  final _seatKeys = <int, GlobalKey>{};
  late final AnimationController _motion;
  String? _seen;
  _Deal? _deal;
  bool _arm = false;

  GlobalKey _seatKey(int seat) => _seatKeys.putIfAbsent(seat, GlobalKey.new);

  @override
  void initState() {
    super.initState();
    _motion = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
    );
    _motion.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) {
        setState(() => _deal = null);
      }
    });
  }

  @override
  void dispose() {
    _motion.dispose();
    super.dispose();
  }

  void _watch(RoomView view) {
    final signature = _signature(view);
    final previous = _seen;
    if (previous == signature) return;
    final prior = _prior;
    _seen = signature;
    _prior = view;
    if (prior == null) return;
    final from = _dealtBy(prior, view);
    final card = view.top;
    if (from == null || card == null || view.pileCount != prior.pileCount + 1) {
      _deal = null;
      _arm = false;
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
    _arm = true;
  }

  RoomView? _prior;

  @override
  Widget build(BuildContext context) {
    final view = widget.session.view;
    if (view == null) return const SizedBox.shrink();
    _watch(view);
    if (_arm) {
      _arm = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _deal != null) _motion.forward(from: 0);
      });
    }
    final deal = _deal;
    final opponents = view.players
        .where((seat) => seat.seat != view.you)
        .toList();
    return Stack(
      key: _layerKey,
      children: [
        Column(
          children: [
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  for (final seat in opponents)
                    Expanded(
                      child: _Opponent(
                        view: view,
                        seat: seat,
                        count: deal?.seat == seat.seat
                            ? deal!.heldCount
                            : seat.count,
                        stackKey: _seatKey(seat.seat),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    BoardSlot(
                      top: deal == null ? view.top : deal.heldTop,
                      pileCount: deal == null ? view.pileCount : deal.heldPile,
                      cardKey: _boardKey,
                    ),
                    if (view.banner != null) ...[
                      const SizedBox(height: 12),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Text(
                          view.banner!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            _HandTray(
              session: widget.session,
              view: view,
              handCount: deal?.seat == view.you
                  ? deal!.heldCount
                  : view.mine?.count ?? 0,
              handKey: _seatKey(view.you),
            ),
          ],
        ),
        if (deal != null) _flight(deal),
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

  Offset? _center(GlobalKey key) {
    final stack = _layerKey.currentContext?.findRenderObject() as RenderBox?;
    final box = key.currentContext?.findRenderObject() as RenderBox?;
    if (stack == null || box == null || !stack.hasSize || !box.hasSize) {
      return null;
    }
    final global = box.localToGlobal(box.size.center(Offset.zero));
    return stack.globalToLocal(global);
  }
}

String _signature(RoomView view) {
  final top = view.top;
  final counts = view.players
      .map((seat) => '${seat.seat}:${seat.count}')
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

class _Opponent extends StatelessWidget {
  const _Opponent({
    required this.view,
    required this.seat,
    required this.count,
    required this.stackKey,
  });

  final RoomView view;
  final Seat seat;
  final int count;
  final Key stackKey;

  @override
  Widget build(BuildContext context) {
    final active = view.phase == 'play' && view.turn == seat.seat;
    return Column(
      children: [
        if (view.saidBy == seat.seat && view.said != null)
          Container(
            margin: const EdgeInsets.only(bottom: 4),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              view.said!,
              style: const TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: active ? const Color(0xFFF0C14A) : const Color(0x00000000),
              width: 3,
            ),
          ),
          child: SizedBox(
            key: stackKey,
            width: 46,
            height: 64,
            child: count == 0
                ? null
                : Stack(
                    alignment: Alignment.center,
                    children: [
                      const CardBack(width: 40, height: 56),
                      Transform.translate(
                        offset: const Offset(4, 3),
                        child: const CardBack(width: 40, height: 56),
                      ),
                    ],
                  ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '${seat.name} · $count cards',
          textAlign: TextAlign.center,
          overflow: TextOverflow.ellipsis,
        ),
        if (seat.slapped) const Text('Slapped', style: TextStyle(fontSize: 12)),
      ],
    );
  }
}

class _HandTray extends StatelessWidget {
  const _HandTray({
    required this.session,
    required this.view,
    required this.handCount,
    required this.handKey,
  });

  final Session session;
  final RoomView view;
  final int handCount;
  final Key handKey;

  @override
  Widget build(BuildContext context) {
    final yourTurn = view.phase == 'play' && view.turn == view.you;
    return Container(
      width: double.infinity,
      color: const Color(0xFF06261C),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            _status(view),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 16),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: KeyedSubtree(
                  key: handKey,
                  child: CoveredFan(
                    count: handCount,
                    canPlay: yourTurn,
                    onPlay: session.playCard,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Semantics(
                button: true,
                enabled: view.phase != 'won',
                label: 'Slap',
                onTap: view.phase == 'won' ? null : session.slap,
                container: true,
                child: GestureDetector(
                  onTap: view.phase == 'won' ? null : session.slap,
                  child: SizedBox(
                    width: 88,
                    height: 112,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: view.phase == 'won'
                            ? const Color(0xFF14365F)
                            : const Color(0xFF1E4D8C),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: view.phase == 'slap'
                              ? const Color(0xFFF0C14A)
                              : const Color(0xFFE4C56A),
                          width: view.phase == 'slap' ? 3 : 2,
                        ),
                      ),
                      child: const Center(
                        child: ExcludeSemantics(
                          child: Icon(
                            Icons.front_hand,
                            size: 44,
                            color: Color(0xFFF7F1E3),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (view.phase == 'won' && view.host)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: FilledButton(
                onPressed: session.startGame,
                child: const Text('Play again'),
              ),
            ),
        ],
      ),
    );
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
