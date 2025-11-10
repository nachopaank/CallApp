const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve React build folder
app.use(express.static(path.join(__dirname, "client/build")));

// Catch-all route for React frontend
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "client/build", "index.html"));
});

// Keep track of participants in the room
const rooms = {};

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Join a room
  socket.on("join", (roomId) => {
    if (!rooms[roomId]) rooms[roomId] = [];
    const room = rooms[roomId];

    room.push(socket.id);
    socket.join(roomId);

    console.log(`Socket ${socket.id} joined room ${roomId}`);

    // Notify the other participant (if exists) that someone joined
    if (room.length === 2) {
      // Send to the other peer in the room
      room.forEach(id => {
        if (id !== socket.id) {
          io.to(id).emit("peer-joined");
        }
      });
    }
  });

  // Handle signaling data
  socket.on("signal", ({ roomId, data }) => {
    const room = rooms[roomId] || [];
    // Broadcast to everyone else in the room except sender
    room.forEach(id => {
      if (id !== socket.id) {
        io.to(id).emit("signal", { data });
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
    // Remove socket from rooms
    Object.keys(rooms).forEach(roomId => {
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      if (rooms[roomId].length === 0) delete rooms[roomId];
    });
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Signaling server running on ${PORT}`));
