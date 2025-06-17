import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';

const LiveKitContext = createContext();

export const useLiveKit = () => {
  const context = useContext(LiveKitContext);
  if (!context) {
    throw new Error('useLiveKit must be used within a LiveKitProvider');
  }
  return context;
};

export const LiveKitProvider = ({ children }) => {
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [audioContextEnabled, setAudioContextEnabled] = useState(false);
  
  const roomRef = useRef(null);

  // Function to enable audio context
  const enableAudioContext = async () => {
    try {
      if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        setAudioContextEnabled(true);
      }
    } catch (error) {
      console.error('Failed to enable audio context:', error);
    }
  };

  const connectToRoom = async (token, wsUrl, roomName, participantName) => {
    try {
      const newRoom = new Room();
      roomRef.current = newRoom;
      
      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(participant.identity, participant);
          return newMap;
        });
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.delete(participant.identity);
          return newMap;
        });
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          if (publication.setEnabled) {
            publication.setEnabled(true);
          }
        }
        
        if (track.kind === Track.Kind.Video) {
          if (publication.setEnabled) {
            publication.setEnabled(true);
          }
        }
        
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(participant.identity, participant);
          return newMap;
        });
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(participant.identity, participant);
          return newMap;
        });
      });

      newRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
        if (publication && publication.setSubscribed) {
          publication.setSubscribed(true);
        }
        
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(participant.identity, participant);
          return newMap;
        });
      });

      newRoom.on(RoomEvent.TrackUnpublished, (publication, participant) => {
        // Track unpublished - no action needed
      });

      await newRoom.connect(wsUrl, token, {
        autoSubscribe: true,
        audio: true,
        video: true
      });
      setRoom(newRoom);
      setIsConnected(true);

      if (newRoom.localParticipant) {
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(newRoom.localParticipant.identity, newRoom.localParticipant);
          return newMap;
        });
      }

      if (newRoom.participants && typeof newRoom.participants.forEach === 'function') {
        newRoom.participants.forEach((participant) => {
          setParticipants(prev => {
            const newMap = new Map(prev);
            newMap.set(participant.identity, participant);
            return newMap;
          });
          
          if (participant.trackPublications) {
            participant.trackPublications.forEach((publication) => {
              if (publication && publication.setSubscribed) {
                publication.setSubscribed(true);
              }
            });
          }
        });
      } else if (newRoom.participants && newRoom.participants.size > 0) {
        for (const [identity, participant] of newRoom.participants) {
          setParticipants(prev => {
            const newMap = new Map(prev);
            newMap.set(participant.identity, participant);
            return newMap;
          });
          
          if (participant.trackPublications) {
            participant.trackPublications.forEach((publication) => {
              if (publication && publication.setSubscribed) {
                publication.setSubscribed(true);
              }
            });
          }
        }
      }

    } catch (error) {
      console.error('Failed to connect to LiveKit room:', error);
      throw error;
    }
  };

  const disconnectFromRoom = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      setRoom(null);
      setIsConnected(false);
      setParticipants(new Map());
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      setIsMicOn(false);
      setIsVideoOn(false);
      setAudioContextEnabled(false);
    }
  };

  const toggleMic = async () => {
    if (!room) return;

    try {
      // First, ensure audio context is enabled when turning on mic
      if (!isMicOn && !audioContextEnabled) {
        await enableAudioContext();
      }

      if (isMicOn) {
        // Turn off mic
        await room.localParticipant.setMicrophoneEnabled(false);
        setIsMicOn(false);
        setLocalAudioTrack(null);
      } else {
        // Turn on mic
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMicOn(true);
        
        let audioPublication = room.localParticipant.getTrackPublication('microphone');
        if (!audioPublication) {
          audioPublication = room.localParticipant.getTrackPublication('mic');
        }
        if (!audioPublication) {
          const audioTracks = Array.from(room.localParticipant.trackPublications.values())
            .filter(pub => pub.kind === Track.Kind.Audio);
          if (audioTracks.length > 0) {
            audioPublication = audioTracks[0];
          }
        }
        
        if (audioPublication && audioPublication.track) {
          setLocalAudioTrack(audioPublication.track);
        }
      }
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
    }
  };

  const toggleVideo = async () => {
    if (!room) return;

    try {
      if (isVideoOn) {
        // Turn off video
        await room.localParticipant.setCameraEnabled(false);
        setIsVideoOn(false);
        setLocalVideoTrack(null);
      } else {
        // Turn on video
        await room.localParticipant.setCameraEnabled(true);
        setIsVideoOn(true);
        
        // Wait a moment for the track to be available
        setTimeout(() => {
          // Get the local video track using correct API
          // Try different source names
          let videoPublication = room.localParticipant.getTrackPublication('camera');
          if (!videoPublication) {
            videoPublication = room.localParticipant.getTrackPublication('webcam');
          }
          if (!videoPublication) {
            // Get the first video track
            const videoTracks = Array.from(room.localParticipant.trackPublications.values())
              .filter(pub => pub.kind === Track.Kind.Video);
            if (videoTracks.length > 0) {
              videoPublication = videoTracks[0];
            }
          }
          
          if (videoPublication && videoPublication.track) {
            setLocalVideoTrack(videoPublication.track);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error toggling camera:', error);
    }
  };

  const getParticipantVideoTrack = (participantIdentity) => {
    const participant = participants.get(participantIdentity);
    if (!participant || !participant.getTrackPublication) return null;
    
    try {
      // Try different source names for video
      let videoPublication = participant.getTrackPublication('camera');
      if (!videoPublication) {
        videoPublication = participant.getTrackPublication('webcam');
      }
      if (!videoPublication) {
        // Get the first video track
        const videoTracks = Array.from(participant.trackPublications.values())
          .filter(pub => pub.kind === Track.Kind.Video);
        if (videoTracks.length > 0) {
          videoPublication = videoTracks[0];
        }
      }
      return videoPublication?.track || null;
    } catch (error) {
      console.error('Error getting participant video track:', error);
      return null;
    }
  };

  const getParticipantAudioTrack = (participantIdentity) => {
    const participant = participants.get(participantIdentity);
    if (!participant || !participant.getTrackPublication) {
      return null;
    }
    
    try {
      // Try different source names for audio
      let audioPublication = participant.getTrackPublication('microphone');
      if (!audioPublication) {
        audioPublication = participant.getTrackPublication('mic');
      }
      if (!audioPublication) {
        // Get the first audio track
        const audioTracks = Array.from(participant.trackPublications.values())
          .filter(pub => pub.kind === Track.Kind.Audio);
        if (audioTracks.length > 0) {
          audioPublication = audioTracks[0];
        }
      }
      
      return audioPublication?.track || null;
    } catch (error) {
      console.error('Error getting participant audio track:', error);
      return null;
    }
  };

  const isParticipantVideoEnabled = (participantIdentity) => {
    const participant = participants.get(participantIdentity);
    if (!participant || !participant.getTrackPublication) return false;
    
    try {
      // Try different source names for video
      let videoPublication = participant.getTrackPublication('camera');
      if (!videoPublication) {
        videoPublication = participant.getTrackPublication('webcam');
      }
      if (!videoPublication) {
        // Get the first video track
        const videoTracks = Array.from(participant.trackPublications.values())
          .filter(pub => pub.kind === Track.Kind.Video);
        if (videoTracks.length > 0) {
          videoPublication = videoTracks[0];
        }
      }
      return videoPublication?.isEnabled || false;
    } catch (error) {
      console.error('Error checking participant video status:', error);
      return false;
    }
  };

  const isParticipantAudioEnabled = (participantIdentity) => {
    const participant = participants.get(participantIdentity);
    if (!participant || !participant.getTrackPublication) return false;
    
    try {
      // Try different source names for audio
      let audioPublication = participant.getTrackPublication('microphone');
      if (!audioPublication) {
        audioPublication = participant.getTrackPublication('mic');
      }
      if (!audioPublication) {
        // Get the first audio track
        const audioTracks = Array.from(participant.trackPublications.values())
          .filter(pub => pub.kind === Track.Kind.Audio);
        if (audioTracks.length > 0) {
          audioPublication = audioTracks[0];
        }
      }
      return audioPublication?.isEnabled || false;
    } catch (error) {
      console.error('Error checking participant audio status:', error);
      return false;
    }
  };

  useEffect(() => {
    return () => {
      disconnectFromRoom();
    };
  }, []);

  const value = {
    room,
    participants,
    isConnected,
    isMicOn,
    isVideoOn,
    localVideoTrack,
    localAudioTrack,
    connectToRoom,
    disconnectFromRoom,
    toggleMic,
    toggleVideo,
    getParticipantVideoTrack,
    getParticipantAudioTrack,
    isParticipantVideoEnabled,
    isParticipantAudioEnabled,
    audioContextEnabled
  };

  return (
    <LiveKitContext.Provider value={value}>
      {children}
    </LiveKitContext.Provider>
  );
}; 