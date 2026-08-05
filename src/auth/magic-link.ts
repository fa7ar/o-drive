import { useContainer } from "@/core/container";
import type { User } from "@/core/types";

/**
 * Auth service contract — magic link today, OAuth providers later without
 * touching callers.
 */
export interface AuthService {
  requestMagicLink(email: string): Promise<{ token: string }>;
  verifyMagicLink(token: string): Promise<User>;
  currentUser(): User | null;
  signOut(): Promise<void>;
}

const SESSION_KEY = "odrive.session";
const PENDING_KEY = "odrive.magic-link";

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export const magicLinkAuthService: AuthService = {
  async requestMagicLink(email) {
    const token = `ml_${btoa(email.toLowerCase()).replace(/=/g, "")}_${Date.now()}`;
    writeStorage(PENDING_KEY, JSON.stringify({ email: email.toLowerCase(), token }));
    return { token };
  },

  async verifyMagicLink(token) {
    const pending = readStorage(PENDING_KEY);
    if (!pending) throw new Error("This magic link has expired. Request a new one.");
    const parsed = JSON.parse(pending) as { email: string; token: string };
    if (parsed.token !== token) throw new Error("Invalid magic link token.");
    const user = await useContainer().users.upsertByEmail(parsed.email);
    writeStorage(PENDING_KEY, null);
    writeStorage(SESSION_KEY, JSON.stringify(user));
    return user;
  },

  currentUser() {
    const raw = readStorage(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  async signOut() {
    writeStorage(SESSION_KEY, null);
  },
};
