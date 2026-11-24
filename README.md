# Hong Kong Slapjack

A phone-sized web game for two to four players. One Node process owns the cards, speaks socket.io, and serves the Flutter client.

## Play

Build the client, then start the server.

1. `cd client && flutter build web --release`
2. `cd .. && npm install && npm start`
3. Open the printed address on two phones.
4. Create a room, join with the code, and press Start.

The first seat plays first. Tap the covered stack on your turn. The count starts at ace, called 1, and runs through king. Slap when the face-up card matches that count. A wrong slap takes the pile. On a match, the seat that has not slapped once every other seat has slapped takes the pile. The last card wins when it misses the count. A match waits for the slap.

## Test

`npm test` checks the slap rules and a two-socket room.

`npm run verify:room` opens two Chrome pages against the built app. Set `CHROME` if Chrome is not at `/usr/local/bin/google-chrome`.
