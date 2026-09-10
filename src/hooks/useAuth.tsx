import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { cloudAuthService, type AuthService } from "@/auth/cloud-auth";
import type { User } from "@/core/types";

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  sendMagicLink: AuthService["sendMagicLink"];
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  service = cloudAuthService,
}: {
  children: ReactNode;
  service?: AuthService;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setUser(await service.currentUser());
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, [service]);

  useEffect(() => {
    void refresh();
    return service.onChange(() => void refresh());
  }, [service, refresh]);

  const signOut = useCallback(async () => {
    await service.signOut();
    setUser(null);
  }, [service]);

  const value = useMemo(
    () => ({
      user,
      ready,
      sendMagicLink: service.sendMagicLink,
      signOut,
    }),
    [user, ready, service, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within <AuthProvider>");
  return context;
}
