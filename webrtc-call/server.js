const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// socketId -> userId, userId -> socketId
const users = new Map();
const sockets = new Map();

io.on('connection', (socket) => {
  socket.on('register', (userId, ack) => {
    const id = String(userId || '').trim();
    if (!id) return ack && ack({ ok: false, error: 'empty-id' });
    const holder = users.get(id);
    if (holder && holder !== socket.id) {
      if (io.sockets.sockets.has(holder)) return ack && ack({ ok: false, error: 'id-taken' });
      sockets.delete(holder);
    }
    users.set(id, socket.id);
    sockets.set(socket.id, id);
    socket.join(id);
    ack && ack({ ok: true, userId: id });
  });

  const relay = (event) => {
    socket.on(event, ({ to, payload }) => {
      const from = sockets.get(socket.id);
      const target = users.get(String(to || ''));
      if (!from) return;
      if (!target) return socket.emit('peer-unavailable', { to });
      io.to(target).emit(event, { from, payload });
    });
  };

  ['call', 'answer', 'offer', 'ice-candidate', 'reject', 'hangup'].forEach(relay);

  socket.on('disconnect', () => {
    const id = sockets.get(socket.id);
    if (!id) return;
    sockets.delete(socket.id);
    users.delete(id);
    socket.broadcast.emit('peer-disconnected', { from: id });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`signaling server on :${PORT}`));
