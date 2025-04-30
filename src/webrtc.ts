export class WebRTCService {
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private localStream: MediaStream | null = null;
    private ws: WebSocket;
    private userId: string;
    private channelId: string;

    constructor(userId: string, channelId: string, signalingServer: string) {
      this.userId = userId;
      this.channelId = channelId;
      this.ws = new WebSocket(signalingServer);
      this.setupWebSocket();
    }

    async startVoiceVideo() {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true
        });

        // Display local stream in a video element
        const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
        if (localVideo) {
          localVideo.srcObject = this.localStream;
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    }

    async joinCall(recipientId: string) {
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          // Add TURN server here if available
        ]
      };

      const peerConnection = new RTCPeerConnection(configuration);
      this.peerConnections.set(recipientId, peerConnection);

      // Add local stream tracks
      this.localStream?.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
      });

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.ws.send(JSON.stringify({
            type: 'ice',
            channelId: this.channelId,
            senderId: this.userId,
            recipientId,
            data: event.candidate
          }));
        }
      };

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById(`remoteVideo-${recipientId}`) as HTMLVideoElement;
        if (remoteVideo) {
          remoteVideo.srcObject = event.streams[0];
        }
      };

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      this.ws.send(JSON.stringify({
        type: 'offer',
        channelId: this.channelId,
        senderId: this.userId,
        recipientId,
        data: offer
      }));
    }

    private setupWebSocket() {
      this.ws.onmessage = async (event) => {
        const signal = JSON.parse(event.data);
        const { event: eventType, data } = signal;

        if (eventType === 'VOICE_SIGNAL_OFFER') {
          await this.handleOffer(data);
        } else if (eventType === 'VOICE_SIGNAL_ANSWER') {
          await this.handleAnswer(data);
        } else if (eventType === 'VOICE_SIGNAL_ICE') {
          await this.handleIceCandidate(data);
        }
      };
    }

    private async handleOffer({ senderId, channelId, data }: any) {
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      this.peerConnections.set(senderId, peerConnection);

      this.localStream?.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
      });

      peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById(`remoteVideo-${senderId}`) as HTMLVideoElement;
        if (remoteVideo) {
          remoteVideo.srcObject = event.streams[0];
        }
      };

      await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      this.ws.send(JSON.stringify({
        type: 'answer',
        channelId,
        senderId: this.userId,
        recipientId: senderId,
        data: answer
      }));
    }

    private async handleAnswer({ senderId, data }: any) {
      const peerConnection = this.peerConnections.get(senderId);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
      }
    }

    private async handleIceCandidate({ senderId, data }: any) {
      const peerConnection = this.peerConnections.get(senderId);
      if (peerConnection && data) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data));
      }
    }

    stop() {
      this.localStream?.getTracks().forEach(track => track.stop());
      this.peerConnections.forEach(pc => pc.close());
      this.ws.close();
    }
  }
