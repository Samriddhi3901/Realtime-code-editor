const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { compileCode } = require('./compiler');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, '../public')));

const rooms = {}; // { roomId: { code, language, author, viewers: [], comments: [] } }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, isAuthor }) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = {
        code: '// Start coding...\n',
        language: 'python',
        author: isAuthor ? socket.id : null,
        viewers: [],
        comments: []
      };
    }

    if (isAuthor) {
      rooms[roomId].author = socket.id;
    } else if (rooms[roomId].author) {
      rooms[roomId].viewers.push(socket.id);
    }

    socket.emit('room-data', {
      code: rooms[roomId].code,
      language: rooms[roomId].language,
      isAuthor: rooms[roomId].author === socket.id,
      comments: rooms[roomId].comments
    });

    io.to(roomId).emit('user-count', {
      author: !!rooms[roomId].author,
      viewers: rooms[roomId].viewers.length
    });
  });

  socket.on('code-change', ({ roomId, code }) => {
    if (rooms[roomId]?.author === socket.id) {
      rooms[roomId].code = code;
      socket.to(roomId).emit('code-update', code);
    }
  });

  socket.on('language-change', ({ roomId, language }) => {
    if (rooms[roomId]?.author === socket.id) {
      rooms[roomId].language = language;
      io.to(roomId).emit('language-update', language);
    }
  });

  socket.on('run-code', async ({ roomId }) => {
    if (rooms[roomId]?.author === socket.id) {
      const { code, language } = rooms[roomId];
      const output = await compileCode(language, code);
      io.to(roomId).emit('output', output);
    }
  });

  socket.on('send-comment', ({ roomId, comment }) => {
    const viewerId = socket.id;
    if (rooms[roomId]?.viewers.includes(viewerId)) {
      const msg = {
        id: Date.now() + Math.random(),
        viewerId,
        comment,
        time: new Date(),
        replies: []
      };
      rooms[roomId].comments.push(msg);
      const authorSocket = rooms[roomId].author;
      if (authorSocket) {
        io.to(authorSocket).emit('new-comment', msg);
      }
      socket.to(roomId).emit('author-reply', { commentId: msg.id, text: '', time: msg.time }); // optional sync
    }
  });

  socket.on('author-reply', ({ roomId, commentId, text }) => {
    const room = rooms[roomId];
    if (room && room.author === socket.id) {
      const reply = { commentId, text, time: new Date() };
      const comment = room.comments.find(c => c.id === commentId);
      if (comment) {
        comment.replies = comment.replies || [];
        comment.replies.push(reply);
      }
      io.to(roomId).emit('author-reply', reply);
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.author === socket.id) {
        delete rooms[roomId];
        io.to(roomId).emit('author-left');
      } else if (room.viewers.includes(socket.id)) {
        room.viewers = room.viewers.filter(id => id !== socket.id);
      }
      io.to(roomId).emit('user-count', {
        author: !!room.author,
        viewers: room.viewers.length
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});