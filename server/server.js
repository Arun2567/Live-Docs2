const WebSocket = require("ws");
const wss = new WebSocket.Server({ host: "0.0.0.0", port: 5000 }); // Bind to all interfaces

const rooms = new Map();

wss.on("connection", (ws) => {
  console.log(`New WebSocket connection from ${ws._socket.remoteAddress}`);

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error("Failed to parse message:", e);
      return;
    }

    if (data.type === "join") {
      const { room: roomId, peerId } = data;
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
        console.log(`${peerId} created room ${roomId}`);
      }
      const room = rooms.get(roomId);
      room.set(peerId, ws);
      ws.peerId = peerId;
      ws.roomId = roomId;

      room.forEach((client, existingPeerId) => {
        if (existingPeerId !== peerId && client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "new-peer",
              peerId: peerId,
              room: roomId,
            })
          );
          console.log(`${peerId} notified existing peer ${existingPeerId} in room ${roomId}`);
        }
      });

      broadcastActiveUsers(roomId);
    } else if (["offer", "answer", "candidate"].includes(data.type)) {
      const room = rooms.get(data.room);
      if (room) {
        const targetWs = room.get(data.to);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify(data));
          console.log(`Forwarding ${data.type} from ${data.from} to ${data.to} in room ${data.room}`);
        } else {
          console.log(`Target ${data.to} not found or not open in room ${data.room}`);
        }
      } else {
        console.log(`Room ${data.room} not found`);
      }
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`WebSocket closed. Code: ${code}, Reason: ${reason}`);
    const room = rooms.get(ws.roomId);
    if (room && ws.peerId) {
      room.delete(ws.peerId);
      if (room.size === 0) {
        rooms.delete(ws.roomId);
        console.log(`Room ${ws.roomId} deleted (empty)`);
      }
      broadcastActiveUsers(ws.roomId);
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

function broadcastActiveUsers(roomId) {
  const room = rooms.get(roomId);
  if (room) {
    const activeUsers = room.size;
    room.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "active-users",
            count: activeUsers,
            room: roomId,
          })
        );
      }
    });
    console.log(`Broadcasted active users in room ${roomId}: ${activeUsers}`);
  }
}

console.log("Signaling server running on ws://0.0.0.0:5000");

// const WebSocket = require("ws");
// const wss = new WebSocket.Server({ port: 5000 });

// const rooms = new Map(); 

// wss.on("connection", (ws) => {
//   console.log("New WebSocket connection");

//   ws.on("message", (message) => {
//     const data = JSON.parse(message);

//     if (data.type === "join") {
//       const { room: roomId, peerId } = data;
//       console.log(`---------------->${!rooms.has(roomId)}`);
//       if (!rooms.has(roomId)) {
//         rooms.set(roomId, new Map());
//         console.log(`${peerId} created room ,Room Created successfully.....`);
//       }
//       const room = rooms.get(roomId);
//       room.set(peerId, ws);
//       ws.peerId = peerId;
//       ws.roomId = roomId;

//       room.forEach((client, existingPeerId) => {
//         if (existingPeerId !== peerId && client.readyState === WebSocket.OPEN) {
//           client.send(
//             JSON.stringify({
//               type: "new-peer",
//               peerId: peerId,
//               room: roomId,
//             })
//           );
//           console.log(`${peerId} joined the room which is created already`);
//         }
//       });

//       broadcastActiveUsers(roomId);

//     } else if (data.type === "offer" || data.type === "answer" || data.type === "candidate") {
//       const room = rooms.get(data.room);
//       if (room) {
//         const targetWs = room.get(data.to);
//         if (targetWs && targetWs.readyState === WebSocket.OPEN) {
//           targetWs.send(JSON.stringify(data));
//           console.log(`Forwarding ${data.type} from ${data.from} to ${data.to} in room: RoomId ${data.roomId}`);
//         }
//       }
//     }
//   });

//   ws.on("close", (code, reason) => {
//     console.log(`WebSocket connection closed. Code: ${code}, Reason: ${reason}`);
//     const room = rooms.get(ws.roomId);
//     if (room && ws.peerId) {
//       room.delete(ws.peerId);
//       if (room.size === 0) {
//         rooms.delete(ws.roomId);
//       }
//       broadcastActiveUsers(ws.roomId);
//     }
//   });

//   ws.on("error", (error) => {
//     console.error("WebSocket error:", error);
//   });
// });

// function broadcastActiveUsers(roomId) {
//   const room = rooms.get(roomId);
//   if (room) {
//     const activeUsers = room.size;
//     room.forEach((client) => {
//       if (client.readyState === WebSocket.OPEN) {
//         client.send(
//           JSON.stringify({
//             type: "active-users",
//             count: activeUsers,
//             room: roomId,
//           })
//         );
//         console.log(`active users in roomId : ${roomId} is ${activeUsers}`);
//       }
//     });
//   }
// }

// console.log("1.Signaling server running on ws://localhost:5000");