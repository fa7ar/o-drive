import { supabase } from "@/integrations/supabase/client";
import type { User } from "@/core/types";
import { getSessionUser } from "@/lib/session.functions";

/**
 * Real authentication service. Sessions, tokens and password handling live in
 * the managed auth backend; this module only adapts it to the app's contract so
 * a different identity provider could be swapped in later.
 */
export interface AuthService {
  signUp(input: { email: string; password: string; displayName?: string }): Promise<void>;
  signIn(input: { email: string; password: string }): Promise<User>;
  signInWithGoogle(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
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
  async signUp({ email, password, displayName }) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: displayName ? { full_name: displayName } : {},
      },
    });
    if (error) throw new Error(error.message);
  },

  async signIn({ email, password }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const user = await loadUser();
    if (!user) throw new Error("Sign in did not create a session. Try again.");
    return user;
  },

  async signInWithGoogle() {
    // Google sign-in is not enabled for this workspace yet.
    throw new Error("Google sign-in is not enabled yet. Use your email and password.");
  },

  async sendPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/settings/security`,
    });
    if (error) throw new Error(error.message);
  },

  async updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
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
