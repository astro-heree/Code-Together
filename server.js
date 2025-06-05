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
const io = new Server(server, {
    cors: {
        origin: true, // Allow all origins for ngrok/development
        methods: ["GET", "POST"],
        credentials: true
    }
});

// CORS middleware for Express routes - Allow anyone to access (good for ngrok/development)
app.use(cors({
    origin: true, // Allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware to parse JSON
app.use(express.json());

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - From: ${req.get('Origin') || req.get('Host')}`);
    next();
});

// LiveKit token generation endpoint - FIXED VERSION
app.post('/api/get-token', async (req, res) => {
    const { roomName, participantName } = req.body;
    
    if (!roomName || !participantName) {
        return res.status(400).json({ error: 'roomName and participantName are required' });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    console.log('Environment variables check:');
    console.log('API Key:', apiKey ? 'Present' : 'Missing');
    console.log('API Secret:', apiSecret ? 'Present' : 'Missing');
    console.log('WS URL:', wsUrl);

    if (!apiKey || !apiSecret || !wsUrl) {
        return res.status(500).json({ 
            error: 'Missing LiveKit credentials. Check your .env file.',
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
            ttl: '10m', // Token expires in 10 minutes
        });
        
        // Use simplified grant structure as per official docs
        at.addGrant({ 
            roomJoin: true, 
            room: roomName,
            canPublish: true,
            canSubscribe: true
        });

        // IMPORTANT: await the async toJwt() method
        const token = await at.toJwt();
        
        console.log('Generated token for:', participantName, 'in room:', roomName);
        console.log('Token length:', token.length);
        console.log('Token preview:', token.substring(0, 50) + '...');
        
        res.json({ token, wsUrl });
    } catch (error) {
        console.error('Error generating token:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to generate token', details: error.message });
    }
});

// Add a simple health check endpoint for debugging
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

// Serve static files and React app - MOVED TO END
app.use(express.static('build'));
app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));