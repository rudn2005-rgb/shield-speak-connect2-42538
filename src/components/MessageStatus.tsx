import { Check, CheckCheck } from "lucide-react";

interface MessageStatusProps {
  isOwn: boolean;
  isRead: boolean;
  readCount?: number;
}

const MessageStatus = ({ isOwn, isRead, readCount = 0 }: MessageStatusProps) => {
  if (!isOwn) return null;

  return (
    <span className="inline-flex items-center ml-1">
      {isRead ? (
        <CheckCheck className="h-3 w-3 text-primary" />
      ) : (
        <Check className="h-3 w-3 text-muted-foreground" />
      )}
    </span>
  );
};

export default MessageStatus;
