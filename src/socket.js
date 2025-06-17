import { io } from "socket.io-client";

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempts: 'Infinity',
        timeout: 10000,
        transports: ['websocket'],
        withCredentials: true
    };

    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
    return io(backendUrl, options);
};