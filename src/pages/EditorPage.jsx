import React, { useEffect, useRef, useState } from 'react';
import Client from '../components/Client';
import Editor from '../components/Editor';
import MediaControls from '../components/MediaControls';
import { initSocket } from '../socket';
import ACTIONS from '../Actions';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import CodeRun from '../components/CodeRun';
import { useLiveKit } from '../contexts/LiveKitContext';

const EditorPage = () => {
  const codeRef = useRef(null);
  const socketRef = useRef(null);
  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useNavigate();

  const [clients, setClients] = useState([]);
  const [audioContextEnabled, setAudioContextEnabled] = useState(false);
  
  const {
    connectToRoom,
    disconnectFromRoom,
    toggleMic,
    toggleVideo,
    isMicOn,
    isVideoOn,
    localVideoTrack,
    localAudioTrack,
    getParticipantVideoTrack,
    getParticipantAudioTrack,
    isParticipantVideoEnabled,
    isParticipantAudioEnabled,
    isConnected: isLiveKitConnected
  } = useLiveKit();

  // Function to enable audio context (required for audio playback)
  const enableAudioContext = async () => {
    try {
      if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        setAudioContextEnabled(true);
        toast.success('Audio enabled! You should now hear other participants.');
      }
    } catch (error) {
      console.error('Failed to enable audio context:', error);
      toast.error('Failed to enable audio');
    }
  };

  // Function to get LiveKit token and connect
  const connectToLiveKit = async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      const response = await fetch(`${backendUrl}/api/get-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: roomId,
          participantName: location.state?.username,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get LiveKit token');
      }

      const { token, wsUrl } = await response.json();
      await connectToRoom(token, wsUrl, roomId, location.state?.username);
      toast.success('Connected to voice/video');
    } catch (error) {
      console.error('Failed to connect to LiveKit:', error);
      toast.error('Failed to connect to voice/video');
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        socketRef.current = await initSocket();

        socketRef.current.on('connect_error', (err) => handleErrors(err));
        socketRef.current.on('connect_failed', (err) => handleErrors(err));

        function handleErrors(e) {
          console.error('Socket connection error:', e);
          toast.error('Socket connection failed, try again later.');
          reactNavigator('/');
        }

        // Wait for connection before joining
        socketRef.current.on('connect', () => {
          // console.log('Socket connected successfully');
          socketRef.current.emit(ACTIONS.JOIN, {
            roomId,
            username: location.state?.username,
          });
        });

        // If already connected, join immediately
        if (socketRef.current.connected) {
          socketRef.current.emit(ACTIONS.JOIN, {
            roomId,
            username: location.state?.username,
          });
        }

        // Listening for joined events
        socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
          if (username !== location.state?.username) {
            toast.success(`${username} joined the room.`);
          }
          setClients(clients);
          
          // Only sync code if we have some and socket is connected
          if (codeRef.current && socketRef.current.connected) {
            socketRef.current.emit(ACTIONS.SYNC_CODE, {
              code: codeRef.current,
              socketId
            });
          }
        });

        //listening for disconnected
        socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
          toast.success(`${username} left the room.`);
          setClients((prev) => {
            return prev.filter((client) => client.socketId !== socketId);
          });
        });

        // Connect to LiveKit after socket connection
        await connectToLiveKit();

      } catch (error) {
        console.error('Failed to initialize:', error);
        toast.error('Failed to connect to server');
        reactNavigator('/');
      }
    };

    init();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
        socketRef.current.off('connect');
        socketRef.current.off('connect_error');
        socketRef.current.off('connect_failed');
      }
      disconnectFromRoom();
    };

  }, []);

  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID has been copied!");
    } catch (err) {
      toast.error("Could not copy the Room ID");
    }
  }

  function leaveRoom() {
    disconnectFromRoom();
    reactNavigator('/');
  }

  if (!location.state) {
    return <Navigate to="/"/>
  }

  return (
    <div className="mainWrap">
      <div className="aside">
        <div className="asideInner">
          <div className="logo">
            <img src="/code-sync.png" alt="logo" className="logoImage" />
          </div>
          <h3>Connected</h3>
          <div className="clientsList">
            {clients.map((client) => {
              // Check if this is the current user (local participant)
              const isLocalUser = client.username === location.state?.username;
              const videoTrack = isLocalUser ? localVideoTrack : getParticipantVideoTrack(client.username);
              const audioTrack = isLocalUser ? localAudioTrack : getParticipantAudioTrack(client.username);
              const isVideoEnabled = isLocalUser ? isVideoOn : isParticipantVideoEnabled(client.username);
              const isAudioEnabled = isLocalUser ? isMicOn : isParticipantAudioEnabled(client.username);
              
              return (
                <Client 
                  key={client.socketId} 
                  username={client.username}
                  videoTrack={videoTrack}
                  audioTrack={audioTrack}
                  isVideoEnabled={isVideoEnabled}
                  isAudioEnabled={isAudioEnabled}
                  isLocalUser={isLocalUser}
                />
              );
            })}
          </div>
        </div>

        <MediaControls
          isMicOn={isMicOn}
          isVideoOn={isVideoOn}
          onToggleMic={toggleMic}
          onToggleVideo={toggleVideo}
        />

        {/* Audio Enable Button - shows when audio context not enabled */}
        {!audioContextEnabled && (
          <button 
            className="btn audioEnableBtn" 
            onClick={enableAudioContext}
            style={{ 
              background: '#ffa500', 
              color: '#fff', 
              marginBottom: '10px',
              width: '100%'
            }}
          >
            🔊 Enable Audio to Hear Others
          </button>
        )}

        <button className="btn copyBtn" onClick={copyRoomId}>
          Copy ROOM ID
        </button>
        <button className="btn leaveBtn" onClick={leaveRoom}>
          Leave
        </button>
      </div>
      <div className="editorWrap">
        <Editor
          socketRef={socketRef}
          roomId={roomId}
          onCodeChange={(code) => {
            codeRef.current = code;
          }}
        />
        <CodeRun codeRef={codeRef} />
      </div>
    </div>
  );
}

export default EditorPage;