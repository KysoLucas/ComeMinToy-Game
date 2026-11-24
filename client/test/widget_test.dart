import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:slapjack/cards.dart';
import 'package:slapjack/main.dart';
import 'package:slapjack/session.dart';
import 'package:slapjack/table_page.dart';

void main() {
  testWidgets('the lobby offers a room and a ping', (tester) async {
    final session = Session(autostart: false);
    await tester.pumpWidget(SlapjackApp(session: session));

    expect(find.text('Hong Kong Slapjack'), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);
    expect(find.text('Create room'), findsNothing);
    await tester.enterText(find.byType(TextField), 'Alice');
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(find.text('Create room'), findsOneWidget);
    expect(find.text('Join room'), findsOneWidget);
    expect(find.text('Connecting'), findsOneWidget);

    session.dispose();
  });

  testWidgets('a played card travels from the hand to the board', (
    tester,
  ) async {
    final session = Session(autostart: false);
    session.view = _room(counts: const [26, 26], pile: 0, top: null, turn: 0);
    await tester.pumpWidget(_table(session));
    await tester.pump();

    session.view = _room(
      counts: const [25, 26],
      pile: 1,
      top: const CardFace(rank: 'K', suit: '♥'),
      turn: 1,
      said: '1',
      saidBy: 0,
    );
    session.notifyListeners();
    await tester.pump();
    await tester.pump();

    expect(find.text('Board'), findsOneWidget);
    expect(find.textContaining('Pile'), findsNothing);
    expect(find.bySemanticsLabel('Dealing'), findsOneWidget);
    expect(find.byType(FaceCard), findsOneWidget);
    final start = tester.getTopLeft(find.byType(FaceCard));
    await tester.pump(const Duration(milliseconds: 260));
    final mid = tester.getTopLeft(find.byType(FaceCard));
    expect(mid.dy, lessThan(start.dy - 12));

    await tester.pump(const Duration(milliseconds: 400));
    expect(find.bySemanticsLabel('Dealing'), findsNothing);
    expect(find.byType(FaceCard), findsOneWidget);
    expect(find.text('Board'), findsNothing);
    session.dispose();
  });

  testWidgets('a finished game ranks players from fewest cards', (
    tester,
  ) async {
    final session = Session(autostart: false);
    session.view = RoomView(
      code: 'TEST',
      playerId: 'p0',
      phase: 'won',
      you: 0,
      host: true,
      banner: 'Cara WIN!',
      turn: 0,
      winner: 2,
      pileCount: 0,
      top: null,
      said: null,
      saidBy: null,
      players: const [
        Seat(
          seat: 0,
          name: 'Alice',
          connected: true,
          host: true,
          count: 18,
          slapped: false,
        ),
        Seat(
          seat: 1,
          name: 'Bob',
          connected: true,
          host: false,
          count: 9,
          slapped: false,
        ),
        Seat(
          seat: 2,
          name: 'Cara',
          connected: true,
          host: false,
          count: 0,
          slapped: false,
        ),
      ],
    );
    await tester.pumpWidget(_table(session));
    await tester.pump();

    expect(find.text('Cara wins'), findsOneWidget);
    expect(find.text('Slap now'), findsNothing);
    expect(find.bySemanticsLabel('Scoreboard'), findsOneWidget);
    expect(find.bySemanticsLabel('1 Cara 0'), findsOneWidget);
    expect(find.bySemanticsLabel('2 Bob 9'), findsOneWidget);
    expect(find.bySemanticsLabel('3 Alice 18'), findsOneWidget);

    session.dispose();
  });
}

Widget _table(Session session) {
  return MaterialApp(
    home: ListenableBuilder(
      listenable: session,
      builder: (context, _) => TablePage(session: session),
    ),
  );
}

RoomView _room({
  required List<int> counts,
  required int pile,
  required CardFace? top,
  required int turn,
  String? said,
  int? saidBy,
}) {
  return RoomView(
    code: 'TEST',
    playerId: 'p0',
    phase: 'play',
    you: 0,
    host: true,
    banner: null,
    turn: turn,
    winner: null,
    pileCount: pile,
    top: top,
    said: said,
    saidBy: saidBy,
    players: [
      for (var i = 0; i < counts.length; i++)
        Seat(
          seat: i,
          name: i == 0 ? 'Alice' : 'Bob',
          connected: true,
          host: i == 0,
          count: counts[i],
          slapped: false,
        ),
    ],
  );
}
