import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff } from "lucide-react";
import { toast } from "sonner";

interface VideoCallProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  currentUserId: string;
  otherUserId: string;
  isInitiator: boolean;
}

const VideoCall = ({ isOpen, onClose, chatId, currentUserId, otherUserId, isInitiator }: VideoCallProps) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState<"connecting" | "connected" | "ended">("connecting");
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<any>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  const configuration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };

  useEffect(() => {
    if (!isOpen) return;

    console.log("VideoCall opened, isInitiator:", isInitiator);
    initializeCall();

    return () => {
      cleanup();
    };
  }, [isOpen]);

  useEffect(() => {
    if (callStatus === "connected") {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callStatus]);

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const initializeCall = async () => {
    try {
      console.log("Initializing call, requesting media access...");
      
      // Адаптивные настройки для разных устройств
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      const constraints = {
        video: {
          width: { ideal: isMobile ? 640 : 1280 },
          height: { ideal: isMobile ? 480 : 720 },
          facingMode: "user",
          frameRate: { ideal: isMobile ? 24 : 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // Fallback для устройств с ограниченными возможностями
        console.warn("Failed with ideal constraints, trying basic media");
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
      }
      
      console.log("Media access granted, got stream:", stream.id);
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Создаем peer connection
      const pc = new RTCPeerConnection(configuration);
      setPeerConnection(pc);
      console.log("PeerConnection created");

      // Добавляем локальные треки
      stream.getTracks().forEach((track) => {
        console.log("Adding track:", track.kind);
        pc.addTrack(track, stream);
      });

      // Обрабатываем входящие треки
      pc.ontrack = (event) => {
        console.log("Received remote track:", event.track.kind);
        const [remoteStream] = event.streams;
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        setCallStatus("connected");
        toast.success("Звонок подключен");
      };

      // Обрабатываем ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("Sending ICE candidate");
          sendSignalingMessage({
            type: "ice-candidate",
            candidate: event.candidate,
          });
        }
      };

      // Обрабатываем изменение состояния соединения
      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
        if (pc.iceConnectionState === "connected") {
          setCallStatus("connected");
        } else if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          toast.error("Потеряно соединение");
          handleEndCall();
        }
      };

      // Подписываемся на сообщения сигнализации ПЕРЕД созданием offer
      await subscribeToSignaling(pc);

      // Если мы инициатор звонка, создаем offer
      if (isInitiator) {
        console.log("Creating offer as initiator");
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        console.log("Sending offer");
        await sendSignalingMessage({
          type: "offer",
          offer: offer,
        });
      }

    } catch (error) {
      console.error("Error initializing call:", error);
      toast.error("Не удалось получить доступ к камере/микрофону");
      onClose();
    }
  };

  const sendSignalingMessage = async (message: any) => {
    try {
      if (!channelRef.current) {
        console.error("Channel not initialized");
        return;
      }
      
      console.log("Sending signaling message:", message.type);
      await channelRef.current.send({
        type: "broadcast",
        event: "signaling",
        payload: {
          from: currentUserId,
          to: otherUserId,
          message,
        },
      });
    } catch (error) {
      console.error("Error sending signaling message:", error);
    }
  };

  const subscribeToSignaling = async (pc: RTCPeerConnection) => {
    return new Promise<void>((resolve, reject) => {
      const channel = supabase
        .channel(`video-call-${chatId}`, {
          config: {
            broadcast: { self: false },
          },
        })
        .on("broadcast", { event: "signaling" }, async ({ payload }) => {
          if (payload.to !== currentUserId) return;

          const { message } = payload;
          console.log("Received signaling message:", message.type);

          try {
            if (message.type === "offer") {
              console.log("Processing offer");
              await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              console.log("Sending answer");
              await sendSignalingMessage({
                type: "answer",
                answer: answer,
              });
            } else if (message.type === "answer") {
              console.log("Processing answer");
              if (pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
              }
            } else if (message.type === "ice-candidate") {
              console.log("Adding ICE candidate");
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
              }
            } else if (message.type === "end-call") {
              console.log("Call ended by remote peer");
              handleEndCall();
            }
          } catch (error) {
            console.error("Error processing signaling message:", error);
          }
        })
        .subscribe((status) => {
          console.log("Channel subscription status:", status);
          if (status === "SUBSCRIBED") {
            channelRef.current = channel;
            resolve();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            reject(new Error(`Channel subscription failed: ${status}`));
          }
        });
    });
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleEndCall = () => {
    if (channelRef.current) {
      sendSignalingMessage({ type: "end-call" });
    }
    cleanup();
    onClose();
  };

  const cleanup = () => {
    console.log("Cleaning up video call resources");
    
    // Stop all local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log("Stopped local track:", track.kind);
      });
    }
    
    // Stop all remote tracks
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => {
        track.stop();
        console.log("Stopped remote track:", track.kind);
      });
    }
    
    // Close peer connection
    if (peerConnection) {
      peerConnection.close();
      console.log("Closed peer connection");
    }
    
    // Remove Supabase channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      console.log("Removed Supabase channel");
    }
    
    // Clear timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    
    setLocalStream(null);
    setRemoteStream(null);
    setPeerConnection(null);
    setCallStatus("ended");
    setCallDuration(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleEndCall()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Видеозвонок</span>
            <span className="text-sm font-normal text-muted-foreground">
              {callStatus === "connecting" && "Соединение..."}
              {callStatus === "connected" && formatCallDuration(callDuration)}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Удаленное видео */}
            <div className="relative aspect-video bg-secondary rounded-lg overflow-hidden">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {!remoteStream && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  Ожидание подключения...
                </div>
              )}
            </div>

            {/* Локальное видео */}
            <div className="relative aspect-video bg-secondary rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
                Вы
              </div>
            </div>
          </div>

          {/* Элементы управления */}
          <div className="flex justify-center gap-4">
            <Button
              variant={isMuted ? "destructive" : "secondary"}
              size="icon"
              onClick={toggleMute}
              className="rounded-full w-12 h-12"
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            <Button
              variant={isVideoOff ? "destructive" : "secondary"}
              size="icon"
              onClick={toggleVideo}
              className="rounded-full w-12 h-12"
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
            </Button>

            <Button
              variant="destructive"
              size="icon"
              onClick={handleEndCall}
              className="rounded-full w-12 h-12"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoCall;
