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
  
  const roomRef = useRef(null);

  const connectToRoom = async (token, wsUrl, roomName, participantName) => {
    try {
      const newRoom = new Room();
      roomRef.current = newRoom;
      
      // Set up event listeners using proper RoomEvent constants
      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        // Always add participant to map when they connect
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

      // Proper track subscription handling as per LiveKit docs
      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        // Handle audio tracks - ensure they are set up for playback
        if (track.kind === Track.Kind.Audio) {
          // Enable the publication to ensure audio flows
          if (publication.setEnabled) {
            publication.setEnabled(true);
          }
        }
        
        // Handle video tracks
        if (track.kind === Track.Kind.Video) {
          // Enable the publication to ensure video flows
          if (publication.setEnabled) {
            publication.setEnabled(true);
          }
        }
        
        // Update participants state to ensure latest participant data and trigger re-render
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(participant.identity, participant);
          return newMap;
        });
      });

                    newRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        // Update participants state to ensure latest participant data and trigger re-render
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(participant.identity, participant);
          return newMap;
        });
      });

            // Track published events
      newRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
        // Automatically subscribe to published tracks
        if (publication && publication.setSubscribed) {
          publication.setSubscribed(true);
        }
        
        // Update participants to trigger re-render
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(participant.identity, participant);
          return newMap;
        });
      });

      // Track unpublished events  
      newRoom.on(RoomEvent.TrackUnpublished, (publication, participant) => {
        // Track unpublished - no action needed
      });

      // Connect to the room with explicit options
      await newRoom.connect(wsUrl, token, {
        autoSubscribe: true,  // Ensure auto-subscription is enabled
        audio: true,
        video: true
      });
      setRoom(newRoom);
      setIsConnected(true);

      // Add local participant to the participants map
      if (newRoom.localParticipant) {
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(newRoom.localParticipant.identity, newRoom.localParticipant);
          return newMap;
        });
      }

      // Initialize participants and subscribe to existing tracks
      if (newRoom.participants && typeof newRoom.participants.forEach === 'function') {
        newRoom.participants.forEach((participant) => {
          setParticipants(prev => {
            const newMap = new Map(prev);
            newMap.set(participant.identity, participant);
            return newMap;
          });
          
          // Subscribe to existing tracks from participants already in room
          if (participant.trackPublications) {
            participant.trackPublications.forEach((publication) => {
              if (publication && publication.setSubscribed) {
                publication.setSubscribed(true);
              }
            });
          }
        });
      } else if (newRoom.participants && newRoom.participants.size > 0) {
        // Handle if participants is a Map
        for (const [identity, participant] of newRoom.participants) {
          setParticipants(prev => {
            const newMap = new Map(prev);
            newMap.set(participant.identity, participant);
            return newMap;
          });
          
          // Subscribe to existing tracks from participants already in room
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
    }
  };

  const toggleMic = async () => {
    if (!room) return;

    try {
      if (isMicOn) {
        // Turn off mic
        await room.localParticipant.setMicrophoneEnabled(false);
        setIsMicOn(false);
        setLocalAudioTrack(null);
      } else {
        // Turn on mic
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMicOn(true);
        
        // Get the local audio track - try different source names
        let audioPublication = room.localParticipant.getTrackPublication('microphone');
        if (!audioPublication) {
          audioPublication = room.localParticipant.getTrackPublication('mic');
        }
        if (!audioPublication) {
          // Get the first audio track
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
      console.error('Error toggling microphone:', error);
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
  };

  return (
    <LiveKitContext.Provider value={value}>
      {children}
    </LiveKitContext.Provider>
  );
}; 