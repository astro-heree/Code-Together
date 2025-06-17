require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Actions');
const { AccessToken } = require('livekit-server-sdk');

const server = http.createServer(app);

// Get backend URL from environment variable
const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

// Enable CORS before creating Socket.IO server
app.use(cors({
    origin: [backendUrl, 'http://localhost:3000', 'http://localhost:8080'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const io = new Server(server, {
    cors: {
        origin: [backendUrl, 'http://localhost:3000', 'http://localhost:8080'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Middleware to parse JSON
app.use(express.json());

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - From: ${req.get('Origin') || req.get('Host')}`);
    next();
});

// LiveKit token generation endpoint
app.post('/api/get-token', async (req, res) => {
    const { roomName, participantName } = req.body;
    
    if (!roomName || !participantName) {
        return res.status(400).json({ error: 'roomName and participantName are required' });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
        return res.status(500).json({ 
            error: 'Missing LiveKit credentials',
            details: {
                apiKey: !!apiKey,
                apiSecret: !!apiSecret,
                wsUrl: !!wsUrl
            }
        });
    }

    try {
        const at = new AccessToken(apiKey, apiSecret, {
            identity: participantName,
            ttl: '10m'
        });
        
        at.addGrant({ 
            roomJoin: true, 
            room: roomName,
            canPublish: true,
            canSubscribe: true
        });

        const token = await at.toJwt();
        res.json({ token, wsUrl });
    } catch (error) {
        console.error('Error generating token:', error);
        res.status(500).json({ error: 'Failed to generate token', details: error.message });
    }
});

// Add a health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

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
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
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
    });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static('build'));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'build', 'index.html'));
    });
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));