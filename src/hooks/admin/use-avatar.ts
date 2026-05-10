import { useMemo } from "react";
import { useAuth } from "@/contexts/admin/AuthContext";

export interface AvatarInfo {
  url: string | null;
  initials: string;
  fullName: string;
}

export function useAvatar(): AvatarInfo {
  const { user } = useAuth();

  const fullName = useMemo(
    () => user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "U",
    [user]
  );

  const initials = useMemo(
    () =>
      fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [fullName]
  );

  const url = useMemo(() => {
    return user?.user_metadata?.avatar_url ?? null;
  }, [user]);

  return { url, initials, fullName };
}
