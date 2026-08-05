import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { magicLinkAuthService, type AuthService } from "@/auth/magic-link";
import type { User } from "@/core/types";

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  requestMagicLink: (email: string) => Promise<{ token: string }>;
  verifyMagicLink: (token: string) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  service = magicLinkAuthService,
}: {
  children: ReactNode;
  service?: AuthService;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(service.currentUser());
    setReady(true);
  }, [service]);

  const requestMagicLink = useCallback(
    (email: string) => service.requestMagicLink(email),
    [service],
  );

  const verifyMagicLink = useCallback(
    async (token: string) => {
      const signedIn = await service.verifyMagicLink(token);
      setUser(signedIn);
      return signedIn;
    },
    [service],
  );

  const signOut = useCallback(async () => {
    await service.signOut();
    setUser(null);
  }, [service]);

  const value = useMemo(
    () => ({ user, ready, requestMagicLink, verifyMagicLink, signOut }),
    [user, ready, requestMagicLink, verifyMagicLink, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within <AuthProvider>");
  return context;
}
