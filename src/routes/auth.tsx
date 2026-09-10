import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { OdriveLogo } from "@/components/odrive-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to ODrive" },
      {
        name: "description",
        content: "Sign in or create an account for your ODrive storage workspace.",
      },
      { property: "og:title", content: "Sign in to ODrive" },
      {
        property: "og:description",
        content: "Sign in or create an account for your ODrive storage workspace.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, ready, signIn, signUp, sendPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) navigate({ to: "/explorer", replace: true });
  }, [ready, user, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    if (password.length < 8) {
      toast.error("Use a password of at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp({ email, password, displayName });
        toast.success("Account created", {
          description: "Check your inbox if confirmation is required, then sign in.",
        });
        setMode("signin");
      } else {
        await signIn({ email, password });
        navigate({ to: "/explorer", replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!email.includes("@")) {
      toast.error("Enter your email address first");
      return;
    }
    try {
      await sendPasswordReset(email);
      toast.success("Reset link sent", { description: `Check ${email}` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send reset link");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="grid-backdrop absolute inset-0 opacity-50" aria-hidden />
      <div className="hero-glow absolute inset-0" aria-hidden />
      <div className="panel relative w-full max-w-md p-8">
        <OdriveLogo />
        <h1 className="mt-6 text-2xl font-semibold">
          {mode === "signin" ? "Sign in to ODrive" : "Create your ODrive workspace"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your workspace, drives and files stay isolated to your account.
        </p>

        <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                autoComplete="name"
                placeholder="Fajar Tri"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
          {mode === "signin" ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={handleReset}
            >
              Forgot password?
            </button>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Back to homepage
          </Link>
        </p>
      </div>
    </div>
  );
}
