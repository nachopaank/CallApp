// Run: npm init -y && npm i express socket.io


const express = require('express');
const http = require('http');
const { Server } = require('socket.io');


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
cors: {
origin: '*', // lock this down in prod
}
});


// Simple room join + relay
io.on('connection', socket => {
console.log('Socket connected:', socket.id);


socket.on('join', roomId => {
socket.join(roomId);
const clients = io.sockets.adapter.rooms.get(roomId) || new Set();
console.log(`Socket ${socket.id} joined ${roomId} (clients=${clients.size})`);
// inform others
socket.to(roomId).emit('peer-joined', socket.id);
});


socket.on('signal', ({ roomId, data }) => {
// broadcast the signaling data to others in the room
socket.to(roomId).emit('signal', { from: socket.id, data });
});


socket.on('disconnect', () => {
console.log('Socket disconnected:', socket.id);
});
});


const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log('Signaling server running on', PORT));