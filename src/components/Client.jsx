import React, { useEffect, useRef, useState } from 'react';
import Avatar from 'react-avatar';

const Client = ({ username, videoTrack, audioTrack, isVideoEnabled, isAudioEnabled, isLocalUser = false }) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(false);



  // Handle user interaction to enable audio context
  useEffect(() => {
    const enableAudio = async () => {
      try {
        // Create or resume audio context on first user interaction
        if (typeof window !== 'undefined' && window.AudioContext) {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
        }
        setAudioEnabled(true);
      } catch (error) {
        // Audio context setup failed - silent fallback
      }
    };

    // Enable audio on first click anywhere on the page
    const handleClick = () => {
      enableAudio();
      document.removeEventListener('click', handleClick);
    };

    if (!audioEnabled) {
      document.addEventListener('click', handleClick);
    }

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [audioEnabled]);

  useEffect(() => {
    const videoElement = videoRef.current;
    
    if (videoElement && videoTrack && isVideoEnabled) {
      // Attach the video track
      try {
        videoTrack.attach(videoElement);
      } catch (error) {
        console.error('Error attaching video track for', username, ':', error);
      }
    } else if (videoElement) {
      // Clear the video element when video is disabled
      try {
        videoElement.srcObject = null;
      } catch (error) {
        console.error('Error clearing video for', username, ':', error);
      }
    }

    // Cleanup function for video
    return () => {
      if (videoElement && videoTrack) {
        try {
          videoTrack.detach(videoElement);
        } catch (error) {
          console.error('Error detaching video track for', username, ':', error);
        }
      }
    };
  }, [videoTrack, isVideoEnabled, username]);

  useEffect(() => {
    const audioElement = audioRef.current;
    
    // Don't play local user's own audio to prevent feedback
    if (isLocalUser) {
      return;
    }
    
    if (audioElement && audioTrack && isAudioEnabled) {
      // Attach the audio track using LiveKit's recommended approach
      try {
        // Clear any existing content first
        audioElement.srcObject = null;
        
        // Set volume to ensure it's audible
        audioElement.volume = 1.0;
        
        // Use LiveKit's attach method which returns the element
        const attachedElement = audioTrack.attach(audioElement);
        
        // Ensure autoplay is enabled
        attachedElement.autoplay = true;
        attachedElement.playsInline = true;
        
        // Attempt to play with better error handling
        const playPromise = attachedElement.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              // Audio playback started successfully
            })
            .catch(error => {
              // Audio autoplay prevented - user interaction required
            });
        }
        

      } catch (error) {
        console.error('Error attaching audio track for', username, ':', error);
      }
    } else if (audioElement && !audioTrack) {
      // Clear the audio element when no track is available
      try {
        audioElement.pause();
        audioElement.srcObject = null;
      } catch (error) {
        console.error('Error clearing audio for', username, ':', error);
      }
    }

    // Cleanup function for audio
    return () => {
      if (audioElement && audioTrack && !isLocalUser) {
        try {
          audioElement.pause();
          audioTrack.detach(audioElement);
        } catch (error) {
          console.error('Error detaching audio track for', username, ':', error);
        }
      }
    };
  }, [audioTrack, isAudioEnabled, username, audioEnabled, isLocalUser]);

  return (
      <div className='client'>
          <div className="clientVideo">
            {isVideoEnabled && videoTrack ? (
              <video
                ref={videoRef}
                className="participantVideo"
                autoPlay
                playsInline
                // Don't mute - we want to hear remote participants
              />
            ) : (
              <Avatar name={username} size={50} round="14px" />
            )}
          </div>
          <span className='userName'>{username}</span>
          {/* Audio element for participant audio - IMPORTANT: not muted for remote participants */}
          {!isLocalUser && (
            <audio
              ref={audioRef}
              autoPlay
              playsInline
              style={{ display: 'none' }}
              // Don't set muted - we want to hear the audio
            />
          )}
    </div>
  )
}

export default Client;