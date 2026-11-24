import 'package:flutter/semantics.dart';
import 'package:material_ui/material_ui.dart';
import 'package:slapjack/session.dart';
import 'package:slapjack/table_page.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SemanticsBinding.instance.ensureSemantics();
  runApp(SlapjackApp(session: Session()));
}

class SlapjackApp extends StatelessWidget {
  const SlapjackApp({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Hong Kong Slapjack',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E4D8C),
          brightness: Brightness.dark,
        ).copyWith(primary: const Color(0xFFF0C14A)),
        scaffoldBackgroundColor: const Color(0xFF0D3B2E),
      ),
      home: GameScreen(session: session),
    );
  }
}

class GameScreen extends StatelessWidget {
  const GameScreen({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListenableBuilder(
          listenable: session,
          builder: (context, _) {
            final view = session.view;
            final page = view == null
                ? HomeForm(session: session)
                : view.phase == 'lobby'
                ? WaitingRoom(session: session)
                : TablePage(session: session);
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 4, 0),
                  child: Row(
                    children: [
                      Text(
                        session.pingLabel,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const Spacer(),
                      if (view != null)
                        Text(
                          'Room ${view.code}',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      if (view != null)
                        TextButton(
                          onPressed: session.leave,
                          child: const Text('Leave'),
                        ),
                    ],
                  ),
                ),
                if (session.error != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                    child: Text(
                      session.error!,
                      style: const TextStyle(
                        color: Color(0xFFFFB4A8),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                Expanded(child: page),
              ],
            );
          },
        ),
      ),
    );
  }
}
