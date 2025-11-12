import { Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useRef } from "react";

interface IncomingCallNotificationProps {
  callerName: string;
  onAccept: () => void;
  onDecline: () => void;
}

const IncomingCallNotification = ({ callerName, onAccept, onDecline }: IncomingCallNotificationProps) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    // Создаем аудио контекст и генерируем звук звонка
    const playRingtone = () => {
      try {
        audioContextRef.current = new AudioContext();
        const oscillator = audioContextRef.current.createOscillator();
        const gainNode = audioContextRef.current.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);

        // Настройки звука: частота 440Hz (нота A), тип волны
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioContextRef.current.currentTime);
        
        // Громкость
        gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);

        // Создаем паттерн звонка: 1 сек звук, 1 сек тишина
        const now = audioContextRef.current.currentTime;
        let time = now;
        
        for (let i = 0; i < 10; i++) {
          gainNode.gain.setValueAtTime(0.3, time);
          gainNode.gain.setValueAtTime(0.3, time + 1);
          gainNode.gain.setValueAtTime(0, time + 1);
          gainNode.gain.setValueAtTime(0, time + 2);
          time += 2;
        }

        oscillator.start(now);
        oscillator.stop(time);

        oscillatorRef.current = oscillator;
        gainNodeRef.current = gainNode;
      } catch (error) {
        console.error('Error playing ringtone:', error);
      }
    };

    playRingtone();

    // Очистка при размонтировании
    return () => {
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop();
        } catch (e) {
          // Игнорируем ошибку если уже остановлен
        }
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleAccept = () => {
    // Останавливаем звук перед принятием вызова
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (e) {
        // Игнорируем
      }
    }
    onAccept();
  };

  const handleDecline = () => {
    // Останавливаем звук перед отклонением вызова
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (e) {
        // Игнорируем
      }
    }
    onDecline();
  };
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center animate-in fade-in">
      <Card className="w-full max-w-md mx-4 border-2 border-primary shadow-2xl">
        <CardContent className="pt-6 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="w-24 h-24 ring-4 ring-primary/20">
                <AvatarFallback className="bg-primary/10 text-primary text-3xl">
                  {callerName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center animate-pulse">
                <Phone className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-2xl font-semibold">{callerName}</h3>
              <p className="text-muted-foreground">Входящий видеозвонок...</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-8">
            <Button
              size="lg"
              variant="destructive"
              onClick={handleDecline}
              className="rounded-full w-16 h-16 shadow-lg hover:scale-110 transition-transform"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>

            <Button
              size="lg"
              onClick={handleAccept}
              className="rounded-full w-16 h-16 shadow-lg hover:scale-110 transition-transform bg-green-500 hover:bg-green-600"
            >
              <Phone className="w-6 h-6" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IncomingCallNotification;
