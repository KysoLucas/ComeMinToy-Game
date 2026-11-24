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
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
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
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                onPressed: () => widget.session.joinRoom(_name.text, _code.text),
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
                style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w800, letterSpacing: 4),
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
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
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

class TablePage extends StatelessWidget {
  const TablePage({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    final view = session.view;
    if (view == null) return const SizedBox.shrink();
    final opponents = view.players.where((seat) => seat.seat != view.you).toList();
    return Column(
      children: [
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            children: [
              for (final seat in opponents)
                Expanded(child: _Opponent(view: view, seat: seat)),
            ],
          ),
        ),
        Expanded(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                BoardSlot(top: view.top, pileCount: view.pileCount),
                if (view.banner != null) ...[
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Text(
                      view.banner!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        _HandTray(session: session, view: view),
      ],
    );
  }
}

class _Opponent extends StatelessWidget {
  const _Opponent({required this.view, required this.seat});

  final RoomView view;
  final Seat seat;

  @override
  Widget build(BuildContext context) {
    final active = view.phase == 'play' && view.turn == seat.seat;
    return Column(
      children: [
        if (view.saidBy == seat.seat && view.said != null)
          Container(
            margin: const EdgeInsets.only(bottom: 4),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
            child: Text(
              view.said!,
              style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w800),
            ),
          ),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: active ? const Color(0xFFF0C14A) : const Color(0x00000000), width: 3),
          ),
          child: SizedBox(
            width: 46,
            height: 64,
            child: seat.count == 0
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
        Text(seat.label, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis),
        if (seat.slapped) const Text('Slapped', style: TextStyle(fontSize: 12)),
      ],
    );
  }
}

class _HandTray extends StatelessWidget {
  const _HandTray({required this.session, required this.view});

  final Session session;
  final RoomView view;

  @override
  Widget build(BuildContext context) {
    final mine = view.mine;
    final yourTurn = view.phase == 'play' && view.turn == view.you;
    return Container(
      width: double.infinity,
      color: const Color(0xFF06261C),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(_status(view), textAlign: TextAlign.center, style: const TextStyle(fontSize: 16)),
          if (mine != null) Text(mine.label, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          CoveredFan(
            count: mine?.count ?? 0,
            canPlay: yourTurn,
            onPlay: session.playCard,
          ),
          const SizedBox(height: 10),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56)),
            onPressed: view.phase == 'won' ? null : session.slap,
            child: const Text('Slap', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
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
    if (turn == null || turn < 0 || turn >= view.players.length) return 'Waiting';
    return "${view.players[turn].name}'s turn";
  }
}
