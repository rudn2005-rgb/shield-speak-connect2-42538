import { Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface IncomingCallNotificationProps {
  callerName: string;
  onAccept: () => void;
  onDecline: () => void;
}

const IncomingCallNotification = ({ callerName, onAccept, onDecline }: IncomingCallNotificationProps) => {
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
              onClick={onDecline}
              className="rounded-full w-16 h-16 shadow-lg hover:scale-110 transition-transform"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>

            <Button
              size="lg"
              onClick={onAccept}
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
