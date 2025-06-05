const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Actions');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('build'));
app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

const userSocketMap = {};

function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
        return {
            socketId,
            username: userSocketMap[socketId],
        }
    });
}

io.on('connection', (socket) => {

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);

        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });
        
        // console.log(`User ${username} joined room ${roomId}`);
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        // console.log(`Code change in room ${roomId}`);
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        // console.log(`Syncing code to socket ${socketId}`);
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    // CodeRun synchronization events
    socket.on(ACTIONS.INPUT_CHANGE, ({ roomId, input }) => {
        socket.in(roomId).emit(ACTIONS.INPUT_CHANGE, { input });
    });

    socket.on(ACTIONS.OUTPUT_CHANGE, ({ roomId, output }) => {
        socket.in(roomId).emit(ACTIONS.OUTPUT_CHANGE, { output });
    });

    socket.on(ACTIONS.LANGUAGE_CHANGE, ({ roomId, language }) => {
        socket.in(roomId).emit(ACTIONS.LANGUAGE_CHANGE, { language });
    });

    socket.on(ACTIONS.STATE_CHANGE, ({ roomId, currentState }) => {
        socket.in(roomId).emit(ACTIONS.STATE_CHANGE, { currentState });
    });

    socket.on(ACTIONS.CODE_RUN, ({ roomId }) => {
        socket.in(roomId).emit(ACTIONS.CODE_RUN, {});
    });


    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });

        delete userSocketMap[socket.id];
        socket.leave();
    })
})


const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));