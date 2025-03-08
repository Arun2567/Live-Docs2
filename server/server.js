const WebSocket = require("ws");
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const server = app.listen(PORT, () => {
  console.log(`Signaling server running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

let rooms = {}; 

wss.on("connection", (ws) => {
  console.log("New WebSocket connection");

  ws.on("message", (message) => {
    const data = JSON.parse(message);
    console.log("Received message:", data);

    switch (data.type) {
      case "join":
        console.log(`User joined room: ${data.room}`);

        if (!rooms[data.room]) rooms[data.room] = [];
        rooms[data.room].push(ws);

        rooms[data.room].forEach((peer) => {
          if (peer !== ws) {
            console.log(`Notifying peer in room: ${data.room}`);
            peer.send(JSON.stringify({ type: "new-peer" }));
          }
        });
        break;

      case "offer":
      case "answer":
      case "candidate":
        console.log(`Forwarding ${data.type} to peers in room: ${data.room}`);
        rooms[data.room]?.forEach((peer) => {
          if (peer !== ws) {
            peer.send(JSON.stringify(data));
          }
        });
        break;

      default:
        console.log("Unknown message type:", data.type);
    }
  });

  ws.on("close", () => {
    console.log("WebSocket closed");
    Object.keys(rooms).forEach((room) => {
      rooms[room] = rooms[room].filter((peer) => peer !== ws);
      if (rooms[room].length === 0) {
        delete rooms[room];
      }
    });
  });
});

console.log("WebRTC Signaling server is running...");

