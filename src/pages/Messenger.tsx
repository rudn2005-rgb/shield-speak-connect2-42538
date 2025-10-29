import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ChatList from "@/components/ChatList";
import ChatWindow from "@/components/ChatWindow";
import ContactSearch from "@/components/ContactSearch";
import { LogOut, Plus, Shield, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const Messenger = () => {
  const navigate = useNavigate();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setCurrentUserId(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate("/auth");
        } else {
          setCurrentUserId(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const createNewChat = async (targetProfileId: string) => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (targetProfileId === user.id) {
        toast.error("Нельзя создать чат с самим собой");
        return;
      }

      const { data: existingMembers } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", user.id);

      if (existingMembers) {
        for (const member of existingMembers) {
          const { data: otherMember } = await supabase
            .from("chat_members")
            .select("chat_id")
            .eq("chat_id", member.chat_id)
            .eq("user_id", targetProfileId)
            .maybeSingle();

          if (otherMember) {
            setSelectedChatId(member.chat_id);
            setIsDialogOpen(false);
            toast.success("Чат уже существует");
            return;
          }
        }
      }

      const { data: newChat, error: chatError } = await supabase
        .from("chats")
        .insert({
          is_group: false,
        })
        .select()
        .single();

      if (chatError) throw chatError;

      const { error: membersError } = await supabase
        .from("chat_members")
        .insert([
          { chat_id: newChat!.id, user_id: user.id },
          { chat_id: newChat!.id, user_id: targetProfileId },
        ]);

      if (membersError) throw membersError;

      setSelectedChatId(newChat!.id);
      setIsDialogOpen(false);
      toast.success("Чат создан!");
    } catch (error: any) {
      toast.error(error.message || "Ошибка создания чата");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <div className="w-80 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">SecureChat</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Новый чат
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Создать новый чат</DialogTitle>
              </DialogHeader>
              <ContactSearch
                onSelectContact={(profile) => createNewChat(profile.id)}
                currentUserId={currentUserId}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex-1 overflow-hidden">
          <ChatList
            onSelectChat={setSelectedChatId}
            selectedChatId={selectedChatId}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedChatId ? (
          <ChatWindow chatId={selectedChatId} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageCircle className="w-24 h-24 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-bold mb-2">Добро пожаловать в SecureChat</h2>
            <p className="text-muted-foreground max-w-md">
              Выберите чат слева или создайте новый, чтобы начать безопасное общение
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messenger;
