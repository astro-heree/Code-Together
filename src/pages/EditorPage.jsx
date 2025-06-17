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

        socketRef.current.on('connect', () => {
          socketRef.current.emit(ACTIONS.JOIN, {
            roomId,
            username: location.state?.username,
          });
        });

        if (socketRef.current.connected) {
          socketRef.current.emit(ACTIONS.JOIN, {
            roomId,
            username: location.state?.username,
          });
        }

        socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
          if (username !== location.state?.username) {
            toast.success(`${username} joined the room.`);
          }
          setClients(clients);
          
          if (codeRef.current && socketRef.current.connected) {
            socketRef.current.emit(ACTIONS.SYNC_CODE, {
              code: codeRef.current,
              socketId
            });
          }
        });

        socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
          toast.success(`${username} left the room.`);
          setClients((prev) => {
            return prev.filter((client) => client.socketId !== socketId);
          });
        });

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
                />
              );
            })}
          </div>
          <MediaControls
            isMicOn={isMicOn}
            isVideoOn={isVideoOn}
            onToggleMic={toggleMic}
            onToggleVideo={toggleVideo}
          />
          <button className="btn copyBtn" onClick={copyRoomId}>
            Copy Room ID
          </button>
          <button className="btn leaveBtn" onClick={leaveRoom}>
            Leave
          </button>
        </div>
      </div>
      <div className="editorWrap">
        <Editor
          socketRef={socketRef}
          roomId={roomId}
          onCodeChange={(code) => {
            codeRef.current = code;
          }}
        />
        <CodeRun codeRef={codeRef} socketRef={socketRef} roomId={roomId} />
      </div>
    </div>
  );
};

export default EditorPage;