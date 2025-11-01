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

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const configuration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  useEffect(() => {
    if (!isOpen) return;

    initializeCall();

    return () => {
      cleanup();
    };
  }, [isOpen]);

  const initializeCall = async () => {
    try {
      // Получаем доступ к камере и микрофону
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Создаем peer connection
      const pc = new RTCPeerConnection(configuration);
      setPeerConnection(pc);

      // Добавляем локальные треки
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Обрабатываем входящие треки
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        setCallStatus("connected");
      };

      // Обрабатываем ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignalingMessage({
            type: "ice-candidate",
            candidate: event.candidate,
          });
        }
      };

      // Если мы инициатор звонка, создаем offer
      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignalingMessage({
          type: "offer",
          offer: offer,
        });
      }

      // Подписываемся на сообщения сигнализации
      subscribeToSignaling(pc);

    } catch (error) {
      console.error("Error initializing call:", error);
      toast.error("Не удалось получить доступ к камере/микрофону");
      onClose();
    }
  };

  const sendSignalingMessage = async (message: any) => {
    const channel = supabase.channel(`call-${chatId}`);
    await channel.send({
      type: "broadcast",
      event: "signaling",
      payload: {
        from: currentUserId,
        to: otherUserId,
        message,
      },
    });
  };

  const subscribeToSignaling = (pc: RTCPeerConnection) => {
    const channel = supabase
      .channel(`call-${chatId}`)
      .on("broadcast", { event: "signaling" }, async ({ payload }) => {
        if (payload.to !== currentUserId) return;

        const { message } = payload;

        if (message.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignalingMessage({
            type: "answer",
            answer: answer,
          });
        } else if (message.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
        } else if (message.type === "ice-candidate") {
          await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        } else if (message.type === "end-call") {
          handleEndCall();
        }
      })
      .subscribe();
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
    sendSignalingMessage({ type: "end-call" });
    cleanup();
    onClose();
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnection) {
      peerConnection.close();
    }
    setLocalStream(null);
    setRemoteStream(null);
    setPeerConnection(null);
    setCallStatus("ended");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleEndCall()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Видеозвонок {callStatus === "connecting" && "- Соединение..."}
            {callStatus === "connected" && "- Активен"}
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
