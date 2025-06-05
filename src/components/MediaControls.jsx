import React from 'react';

const MediaControls = ({ 
  isMicOn, 
  isVideoOn, 
  onToggleMic, 
  onToggleVideo 
}) => {
  return (
    <div className="mediaControls">
      <button 
        className={`btn ${isMicOn ? 'micOn' : 'micOff'}`}
        onClick={onToggleMic}
        title={isMicOn ? 'Turn off microphone' : 'Turn on microphone'}
      >
        {isMicOn ? '🎤 Mic On' : '🎤 Mic Off'}
      </button>
      <button 
        className={`btn ${isVideoOn ? 'videoOn' : 'videoOff'}`}
        onClick={onToggleVideo}
        title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
      >
        {isVideoOn ? '📹 Video On' : '📹 Video Off'}
      </button>
    </div>
  );
};

export default MediaControls; 