import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { cloudAuthService, type AuthService } from "@/auth/cloud-auth";
import type { User } from "@/core/types";

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  sendMagicLink: AuthService["sendMagicLink"];
  verifyMagicLink: AuthService["verifyMagicLink"];
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

  const verifyMagicLink = useCallback(
    async (input: Parameters<AuthService["verifyMagicLink"]>[0]) => {
      await service.verifyMagicLink(input);
      const verifiedUser = await service.currentUser();
      if (!verifiedUser)
        throw new Error("Sign-in succeeded, but the workspace session could not be loaded");
      setUser(verifiedUser);
      setReady(true);
    },
    [service],
  );

  const signOut = useCallback(async () => {
    await service.signOut();
    setUser(null);
  }, [service]);

  const value = useMemo(
    () => ({
      user,
      ready,
      sendMagicLink: service.sendMagicLink,
      verifyMagicLink,
      signOut,
    }),
    [user, ready, service, verifyMagicLink, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within <AuthProvider>");
  return context;
}
