import 'package:flutter_test/flutter_test.dart';
import 'package:slapjack/main.dart';
import 'package:slapjack/session.dart';

void main() {
  testWidgets('the lobby offers a room and a ping', (tester) async {
    final session = Session(autostart: false);
    await tester.pumpWidget(SlapjackApp(session: session));

    expect(find.text('Hong Kong Slapjack'), findsOneWidget);
    expect(find.text('Create room'), findsOneWidget);
    expect(find.text('Join room'), findsOneWidget);
    expect(find.text('Connecting'), findsOneWidget);

    session.dispose();
  });
}
