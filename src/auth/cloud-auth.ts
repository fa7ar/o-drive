import { supabase } from "@/integrations/supabase/client";
import type { User } from "@/core/types";
import { getSessionUser } from "@/lib/session.functions";

/**
 * Real authentication service. Sessions and email delivery live in the managed
 * auth backend; this module only adapts it to the app's contract so a different
 * identity provider could be swapped in later.
 *
 * ODrive uses passwordless magic links: there are no passwords to store, leak
 * or rotate, and the same link both signs up and signs in.
 */
export interface AuthService {
  sendMagicLink(input: { email: string; displayName?: string }): Promise<void>;
  currentUser(): Promise<User | null>;
  onChange(listener: () => void): () => void;
  signOut(): Promise<void>;
}

async function loadUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const profile = await getSessionUser();
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName || profile.email.split("@")[0] || "member",
    workspaceId: profile.workspaceId,
  };
}

export const cloudAuthService: AuthService = {
  async sendMagicLink({ email, displayName }) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        ...(displayName ? { data: { full_name: displayName } } : {}),
      },
    });
    if (error) throw new Error(error.message);
  },

  currentUser: loadUser,

  onChange(listener) {
    const { data } = supabase.auth.onAuthStateChange(() => listener());
    return () => data.subscription.unsubscribe();
  },

  async signOut() {
    await supabase.auth.signOut();
  },
};
