import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserPresence = (userId: string | null) => {
  useEffect(() => {
    if (!userId) return;

    const updateStatus = async (status: "online" | "offline") => {
      try {
        await supabase
          .from("profiles")
          .update({ 
            status,
            last_seen: new Date().toISOString()
          })
          .eq("id", userId);
      } catch (error) {
        console.error("Error updating status:", error);
      }
    };

    // Устанавливаем статус "онлайн" при монтировании
    updateStatus("online");

    // Обновляем статус каждые 30 секунд
    const interval = setInterval(() => {
      updateStatus("online");
    }, 30000);

    // Обработчик закрытия страницы
    const handleBeforeUnload = () => {
      // Используем sendBeacon для надежной отправки при закрытии
      const data = {
        id: userId,
        status: "offline",
        last_seen: new Date().toISOString()
      };
      
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
        JSON.stringify(data)
      );
    };

    // Устанавливаем статус "оффлайн" при размонтировании
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      updateStatus("offline");
    };
  }, [userId]);
};
