import { useState, useEffect } from "react";
import handIcon from "./slap.png";
import sound from "./slapsound.mp4";

export default function Game() {
  //Creating Deck

  const [player1Card, setPlayer1Card] = useState([]);
  const [player2Card, setPlayer2Card] = useState([]);
  const [player3Card, setPlayer3Card] = useState([]);
  const [player4Card, setPlayer4Card] = useState([]);
  const [player1Order, setPlayer1Order] = useState();
  const [player2Order, setPlayer2Order] = useState();
  const [player3Order, setPlayer3Order] = useState();
  const [player4Order, setPlayer4Order] = useState();
  const [slapOrder, setSlapOrder] = useState(50);
  const [gameStart, setGameStart] = useState(false);
  const [winner, setWinner] = useState("");
  const playerCardArr = [player1Card, player2Card, player3Card, player4Card];
  const setPlayerCardArr = [
    setPlayer1Card,
    setPlayer2Card,
    setPlayer3Card,
    setPlayer4Card,
  ];

  // Start of Deal()

  function deal() {
    var deck = [];
    var card = {};

    var suits = ["♠", "♥", "♣", "♦"];
    var ranks = [
      "A",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "J",
      "Q",
      "K",
    ];

    for (let suitCounter = 0; suitCounter < suits.length; suitCounter++) {
      for (let rankCounter = 0; rankCounter < ranks.length; rankCounter++) {
        var card = { suit: "", rank: "" };
        card.suit = suits[suitCounter];
        card.rank = ranks[rankCounter];
        deck.push(card);
        card = {};
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 13; y++) {
        let newCard = deck.shift();
        setPlayerCardArr[x](
          (playerCardArr[x] = [...playerCardArr[x], newCard])
        );
      }
    }
    setPlayerTurn(playerList[0]);
    setGameStart(true);
    //End of Deal()
  }

  function slapSound() {
    new Audio(sound).play();
  }

  const playerList = ["player1", "player2", "player3", "player4"];
  const [playerTurn, setPlayerTurn] = useState(null);
  const [currentCard, setCurrentCard] = useState(null);

  const [tableCard, setTableCard] = useState([]);
  const [counter, setCounter] = useState(null);
  const [counterCard, setCounterCard] = useState([
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ]);
  const [player1Slap, setPlayer1Slap] = useState(false);
  const [player2Slap, setPlayer2Slap] = useState(false);
  const [player3Slap, setPlayer3Slap] = useState(false);
  const [player4Slap, setPlayer4Slap] = useState(false);
  const playerSlapArr = [player1Slap, player2Slap, player3Slap, player4Slap];
  const setPlayerSlapArr = [
    setPlayer1Slap,
    setPlayer2Slap,
    setPlayer3Slap,
    setPlayer4Slap,
  ];

  //
  // function changeColor() {
  //   document.querySelector("#tableCardAmount").style.backgroundColor = "red";
  // }

  const playCardFunc = (playerIndex) => {
    const playerCardArr = [player1Card, player2Card, player3Card, player4Card];
    const setPlayerCardArr = [
      setPlayer1Card,
      setPlayer2Card,
      setPlayer3Card,
      setPlayer4Card,
    ];
    var theCard;
    theCard = playerCardArr[[playerIndex]][0];
    setTableCard([...tableCard, theCard]);
    setCurrentCard(theCard);
    setPlayerCardArr[playerIndex](playerCardArr[playerIndex].slice(1));
    if (counter == null || counter == 12) {
      setCounter(0);
    } else {
      setCounter(counter + 1);
    }
    if (playerIndex !== 3) {
      setPlayerTurn(playerList[playerIndex + 1]);
    } else {
      setPlayerTurn(playerList[0]);
    }
  };

  const playCard = (event) => {
    if (event.code === "KeyQ" && playerTurn == playerList[0]) {
      playCardFunc(0);
    } else if (event.code === "KeyB" && playerTurn == playerList[1]) {
      playCardFunc(1);
    } else if (event.code === "KeyO" && playerTurn == playerList[2]) {
      playCardFunc(2);
    } else if (event.code === "ArrowUp" && playerTurn == playerList[3]) {
      playCardFunc(3);
    }
    event.preventDefault();
  };

  const slapCard = (event) => {
    if (event.code === "KeyW" && player1Slap) {
      return false;
    } else if (event.code === "KeyW") {
      setPlayer1Slap(true);
      setSlapOrder(slapOrder + 1);
      setPlayer1Order(slapOrder);
      slapSound();
    }
    if (event.code === "KeyN" && player2Slap) {
      return false;
    } else if (event.code === "KeyN") {
      setPlayer2Slap(true);
      setSlapOrder(slapOrder + 1);
      setPlayer2Order(slapOrder);
      slapSound();
    }
    if (event.code === "KeyP" && player3Slap) {
      return false;
    } else if (event.code === "KeyP") {
      setPlayer3Slap(true);
      setSlapOrder(slapOrder + 1);
      setPlayer3Order(slapOrder);
      slapSound();
    }
    if (event.code === "ArrowDown" && player4Slap) {
      return false;
    } else if (event.code === "ArrowDown") {
      setPlayer4Slap(true);
      setSlapOrder(slapOrder + 1);
      setPlayer4Order(slapOrder);
      slapSound();
    }
    event.preventDefault();
  };

  const slapWrong = (playerIndex) => {
    alert(
      "Oh! " +
        playerList[playerIndex].charAt(0).toUpperCase() +
        playerList[playerIndex].slice(1) +
        " Slapped the Wrong Card!"
    );
    setPlayerCardArr[playerIndex]([
      ...playerCardArr[playerIndex],
      ...tableCard,
    ]);
    setPlayerSlapArr[playerIndex](false);
    setTableCard([]);
    setCurrentCard(null);
    setCounter(null);
    setPlayerTurn(playerList[playerIndex]);
    setSlapOrder(50);
  };

  const lateSlap = (playerIndex) => {
    for (let i = 0; i < playerList.length; i++) {
      setPlayerSlapArr[i](false);
    }
    setPlayerCardArr[playerIndex]([
      ...playerCardArr[playerIndex],
      ...tableCard,
    ]);
    alert(
      playerList[playerIndex].charAt(0).toUpperCase() +
        playerList[playerIndex].slice(1) +
        " is too slow!"
    );
    setTableCard([]);
    setCurrentCard(null);
    setCounter(null);
    setPlayerTurn(playerList[playerIndex]);
    setSlapOrder(50);
  };

  useEffect(() => {
    window.addEventListener("keydown", playCard);
    if (tableCard.length != 0) {
      window.addEventListener("keydown", slapCard);
    }
    if (
      counter != null &&
      currentCard != null &&
      counterCard[counter] == currentCard.rank
    ) {
      window.removeEventListener("keydown", playCard);
      if (playerSlapArr[1] && playerSlapArr[2] && playerSlapArr[3]) {
        window.removeEventListener("keydown", slapCard);
        window.removeEventListener("keydown", playCard);
        setTimeout(function () {
          lateSlap(0);
        }, 300);
      }
      if (playerSlapArr[0] && playerSlapArr[2] && playerSlapArr[3]) {
        window.removeEventListener("keydown", slapCard);
        window.removeEventListener("keydown", playCard);
        setTimeout(function () {
          lateSlap(1);
        }, 300);
      }
      if (playerSlapArr[0] && playerSlapArr[1] && playerSlapArr[3]) {
        window.removeEventListener("keydown", slapCard);
        window.removeEventListener("keydown", playCard);
        setTimeout(function () {
          lateSlap(2);
        }, 300);
      }
      if (playerSlapArr[0] && playerSlapArr[1] && playerSlapArr[2]) {
        window.removeEventListener("keydown", slapCard);
        window.removeEventListener("keydown", playCard);
        setTimeout(function () {
          lateSlap(3);
        }, 300);
      }
    }
    if (
      player1Slap &&
      currentCard != null &&
      counterCard[counter] != currentCard.rank
    ) {
      window.removeEventListener("keydown", slapCard);
      window.removeEventListener("keydown", playCard);
      setTimeout(function () {
        slapWrong(0);
      }, 300);
    }
    if (
      player2Slap &&
      currentCard != null &&
      counterCard[counter] != currentCard.rank
    ) {
      window.removeEventListener("keydown", slapCard);
      window.removeEventListener("keydown", playCard);
      setTimeout(function () {
        slapWrong(1);
      }, 300);
    }
    if (
      player3Slap &&
      currentCard != null &&
      counterCard[counter] != currentCard.rank
    ) {
      window.removeEventListener("keydown", slapCard);
      window.removeEventListener("keydown", playCard);
      setTimeout(function () {
        slapWrong(2);
      }, 300);
    }
    if (
      player4Slap &&
      currentCard != null &&
      counterCard[counter] != currentCard.rank
    ) {
      window.removeEventListener("keydown", slapCard);
      window.removeEventListener("keydown", playCard);
      setTimeout(function () {
        slapWrong(3);
      }, 300);
    }
    // Winner message
    for (let playerIndex = 0; playerIndex < playerList.length; playerIndex++) {
      if (
        (gameStart &&
          playerCardArr[playerIndex].length == 0 &&
          counterCard[counter] != currentCard.rank) ||
        (gameStart &&
          playerCardArr[playerIndex].length == 0 &&
          tableCard.length == 0)
      ) {
        window.removeEventListener("keydown", slapCard);
        window.removeEventListener("keydown", playCard);
        setTimeout(function () {
          setWinner(playerList[playerIndex]);
        }, 100);
      }
    }
    return () => {
      window.removeEventListener("keydown", playCard);
      window.removeEventListener("keydown", slapCard);
    };
  });

  // Winner
  useEffect(() => {
    if (gameStart) {
      alert(winner.charAt(0).toUpperCase() + winner.slice(1) + " WIN!");
      window.location.reload();
    }
  }, [winner]);

  return (
    <div>
      {!gameStart && (
        <div id="start">
          <div className="startInstruction">
            <div>"Come Min Toy" (Hong Kong SlapJack)</div>
          </div>
          <button onClick={deal}>Start!</button>
        </div>
      )}
      <div className="container">
        <div className="publicArea">
          {/* Player Slapping Hand */}

          <div
            className="handIcon player1Slap"
            style={{ zIndex: `${player1Order}` }}
          >
            {player1Slap && <img src={handIcon} />}
          </div>

          <div
            className="handIcon player2Slap"
            style={{ zIndex: `${player2Order}` }}
          >
            {player2Slap && <img src={handIcon} />}
          </div>
          <div
            className="handIcon player3Slap"
            style={{ zIndex: `${player3Order}` }}
          >
            {player3Slap && <img src={handIcon} />}
          </div>
          <div
            className="handIcon player4Slap"
            style={{ zIndex: `${player4Order}` }}
          >
            {player4Slap && <img src={handIcon} />}
          </div>
          {/* Current Card on top */}
          {currentCard != null && (
            <div className="cardFront">
              <div id="tableCardAmount">
                <div style={{ position: "relative", left: "20px" }}>
                  {tableCard.length}
                </div>
              </div>
              <div
                style={
                  currentCard.suit == "♥" || currentCard.suit == "♦"
                    ? { color: "red" }
                    : {}
                }
              >
                <div className="currentCardRank">{currentCard.rank}</div>
                <div className="currentCardSuit">{currentCard.suit}</div>
              </div>
            </div>
          )}
          {/* Player Speech */}
          {counter != null && playerTurn == playerList[1] && (
            <div className="player1SpeechBox sbLeft">
              {counterCard[counter] != "A" ? counterCard[counter] : "1"}
            </div>
          )}
          {counter != null && playerTurn == playerList[2] && (
            <div className="player2SpeechBox sbRight">
              {counterCard[counter] != "A" ? counterCard[counter] : "1"}
            </div>
          )}
          {counter != null && playerTurn == playerList[3] && (
            <div className="player3SpeechBox sbRight">
              {counterCard[counter] != "A" ? counterCard[counter] : "1"}
            </div>
          )}
          {counter != null && playerTurn == playerList[0] && (
            <div className="player4SpeechBox sbLeft">
              {counterCard[counter] != "A" ? counterCard[counter] : "1"}
            </div>
          )}
        </div>
        <div
          className="player1Hand cardBack"
          style={playerTurn == playerList[0] ? { backgroundColor: "red" } : {}}
        >
          <div className="playerName">P1</div>
          <div className="holdingCardAmount">{player1Card.length}</div>
          <div className="instructionBox player1instructionBox">
            <p>Deal: "Q"</p>
            <p>Slap: "W"</p>
          </div>
        </div>

        <div
          className="player2Hand cardBack"
          style={playerTurn == playerList[1] ? { backgroundColor: "red" } : {}}
        >
          <div className="playerName">P2</div>
          <div className="holdingCardAmount">{player2Card.length}</div>
          <div className="instructionBox player2instructionBox">
            <p>Deal: "B"</p>
            <p>Slap: "N"</p>
          </div>
        </div>
        <div
          className="player3Hand cardBack"
          style={playerTurn == playerList[2] ? { backgroundColor: "red" } : {}}
        >
          <div className="playerName">P3</div>
          <div className="holdingCardAmount">{player3Card.length}</div>
          <div className="instructionBox player3instructionBox">
            <p>Deal: "O"</p>
            <p>Slap: "P"</p>
          </div>
        </div>
        <div
          className="player4Hand cardBack"
          style={playerTurn == playerList[3] ? { backgroundColor: "red" } : {}}
        >
          <div className="playerName">P4</div>
          <div className="holdingCardAmount">{player4Card.length}</div>
          <div className="instructionBox player4instructionBox">
            <p>Deal: "↑"</p>
            <p>Slap: "↓"</p>
          </div>
        </div>
      </div>
    </div>
  );
}
