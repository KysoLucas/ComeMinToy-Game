import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';
import 'package:slapjack/session.dart';

class CardBack extends StatelessWidget {
  const CardBack({super.key, required this.width, required this.height});

  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFF1E4D8C),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE4C56A), width: 2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x66000000),
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Container(
        margin: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: const Color(0xFF8FB4E0)),
        ),
      ),
    );
  }
}

class CoveredFan extends StatelessWidget {
  const CoveredFan({
    super.key,
    required this.count,
    required this.onPlay,
    required this.canPlay,
  });

  final int count;
  final VoidCallback onPlay;
  final bool canPlay;

  @override
  Widget build(BuildContext context) {
    final shown = count == 0 ? 0 : math.min(count, 8);
    return Semantics(
      button: canPlay,
      label: canPlay ? 'Play' : 'Your cards',
      onTap: canPlay ? onPlay : null,
      container: true,
      child: GestureDetector(
        onTap: onPlay,
        child: ExcludeSemantics(
          child: SizedBox(
            height: 108,
            width: double.infinity,
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: canPlay
                      ? const Color(0xFFF0C14A)
                      : const Color(0x00000000),
                  width: 3,
                ),
              ),
              child: shown == 0
                  ? const Center(child: Text('No cards'))
                  : Stack(
                      alignment: Alignment.center,
                      children: [
                        for (var i = 0; i < shown; i++)
                          Transform.translate(
                            offset: Offset((i - (shown - 1) / 2) * 18, 0),
                            child: const CardBack(width: 68, height: 96),
                          ),
                        if (canPlay)
                          const Align(
                            alignment: Alignment(0, 0.72),
                            child: Text(
                              'Play',
                              style: TextStyle(
                                color: Color(0xFFF0C14A),
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                              ),
                            ),
                          ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

class FaceCard extends StatelessWidget {
  const FaceCard({super.key, required this.card});

  final CardFace card;

  @override
  Widget build(BuildContext context) {
    final color = card.red ? const Color(0xFFC0392B) : const Color(0xFF1A1A1A);
    return Container(
      width: 110,
      height: 154,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F1E3),
        borderRadius: BorderRadius.circular(10),
        boxShadow: const [
          BoxShadow(
            color: Color(0x88000000),
            blurRadius: 12,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            card.rank,
            style: TextStyle(
              color: color,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
          Expanded(
            child: Center(
              child: Text(
                card.suit,
                style: TextStyle(color: color, fontSize: 42),
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomRight,
            child: Text(
              card.rank,
              style: TextStyle(
                color: color,
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class BoardSlot extends StatelessWidget {
  const BoardSlot({super.key, required this.top, required this.pileCount});

  final CardFace? top;
  final int pileCount;

  @override
  Widget build(BuildContext context) {
    final topCard = top;
    return Semantics(
      label: topCard == null
          ? 'Board'
          : 'Board ${topCard.rank} ${topCard.suit}',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (topCard == null)
            Container(
              width: 110,
              height: 154,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0x99F7F1E3), width: 2),
              ),
              child: const Text('Board'),
            )
          else
            FaceCard(card: topCard),
          const SizedBox(height: 8),
          Text(
            'Pile $pileCount',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
