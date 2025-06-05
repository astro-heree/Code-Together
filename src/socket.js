import { io } from "socket.io-client";

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempts: 'Infinity',
        timeout: 10000,
        transports: ['websocket'],
    };

    // Use development URL if REACT_APP_BACKEND_URL is not set
    const serverPath = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
    return io(serverPath, options);
};