import React, { useEffect } from 'react';
  import { WebRTCService } from '../webrtc';

  interface VoiceChatProps {
    userId: string;
    channelId: string;
    recipientId: string;
  }

  const VoiceChat: React.FC<VoiceChatProps> = ({ userId, channelId, recipientId }) => {
    let webrtc: WebRTCService;

    useEffect(() => {
      webrtc = new WebRTCService(userId, channelId, 'wss://your-server.com/voice');
      webrtc.startVoiceVideo();
      webrtc.joinCall(recipientId);

      return () => {
        webrtc(stop);
      };
    }, [userId, channelId, recipientId]);

    return (
      <div>
        <video id="localVideo" autoPlay muted style={{ width: '300px' }}></video>
        <video id={`remoteVideo-${recipientId}`} autoPlay style={{ width: '300px' }}></video>
      </div>
    );
  };

  export default VoiceChat;
