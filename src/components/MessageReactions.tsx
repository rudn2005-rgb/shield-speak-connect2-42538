import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

interface MessageReactionsProps {
  messageId: string;
  onReactionChange?: () => void;
}

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  reacted: boolean;
}

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

const MessageReactions = ({ messageId, onReactionChange }: MessageReactionsProps) => {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    loadReactions();
    getCurrentUser();

    const channel = supabase
      .channel(`reactions:${messageId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
          filter: `message_id=eq.${messageId}`,
        },
        () => {
          loadReactions();
          onReactionChange?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageId]);

  const getCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setUserId(data.user.id);
    }
  };

  const loadReactions = async () => {
    const { data, error } = await supabase
      .from("message_reactions")
      .select("emoji, user_id")
      .eq("message_id", messageId);

    if (error) return;

    const groupedReactions: Record<string, Reaction> = {};

    data.forEach((reaction) => {
      if (!groupedReactions[reaction.emoji]) {
        groupedReactions[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: [],
          reacted: false,
        };
      }
      groupedReactions[reaction.emoji].count++;
      groupedReactions[reaction.emoji].users.push(reaction.user_id);
      if (reaction.user_id === userId) {
        groupedReactions[reaction.emoji].reacted = true;
      }
    });

    setReactions(Object.values(groupedReactions));
  };

  const handleReaction = async (emoji: string) => {
    const existingReaction = reactions.find(
      (r) => r.emoji === emoji && r.reacted
    );

    if (existingReaction) {
      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", userId)
        .eq("emoji", emoji);

      if (error) {
        toast.error("Ошибка удаления реакции");
      }
    } else {
      const { error } = await supabase
        .from("message_reactions")
        .insert({
          message_id: messageId,
          user_id: userId,
          emoji: emoji,
        });

      if (error) {
        toast.error("Ошибка добавления реакции");
      }
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {reactions.map((reaction) => (
        <Button
          key={reaction.emoji}
          variant={reaction.reacted ? "default" : "outline"}
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => handleReaction(reaction.emoji)}
        >
          <span>{reaction.emoji}</span>
          <span className="ml-1">{reaction.count}</span>
        </Button>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Smile className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="grid grid-cols-4 gap-1">
            {EMOJI_LIST.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                className="h-10 w-10 p-0 text-xl hover:scale-125 transition-transform"
                onClick={() => handleReaction(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default MessageReactions;
