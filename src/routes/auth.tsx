import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, MailCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { OdriveLogo } from "@/components/odrive-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")(
  {
    head: () => ({
      meta: [
        { title: "Sign in to ODrive" },
        {
          name: "description",
          content: "Passwordless magic-link sign in for your ODrive storage workspace.",
        },
        { property: "og:title", content: "Sign in to ODrive" },
        {
          property: "og:description",
          content: "Passwordless magic-link sign in for your ODrive storage workspace.",
        },
      ],
    }),
    component: AuthPage,
  }
);

function AuthPage() {
  const { user, ready, requestMagicLink, verifyMagicLink } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) navigate({ to: "/explorer", replace: true });
  }, [ready, user, navigate]);

  async function handleRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!email.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setBusy(true);
    try {
      const result = await requestMagicLink(email);
      setToken(result.token);
      toast.success("Magic link sent", { description: `Delivered to ${email}` });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (!token) return;
    setBusy(true);
    try {
      await verifyMagicLink(token);
      navigate({ to: "/explorer", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not verify link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute inset-0 grid-backdrop opacity-50" aria-hidden />
      <div className="absolute inset-0 hero-glow" aria-hidden />
      <div className="panel relative w-full max-w-md p-8">
        <OdriveLogo />
        <h1 className="mt-6 text-2xl font-semibold">Sign in to ODrive</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Passwordless by design. Magic link today, OAuth providers drop in later without changing
          this screen.
        </p>

        {token ? (
          <div className="mt-7 space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-primary/25 bg-accent p-4">
              <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.8} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-accent-foreground">Check {email}</p>
                <p className="mt-1 text-xs break-all text-muted-foreground">
                  Demo mode — no mail is sent. Your link token:{" "}
                  <span className="font-mono">{token}</span>
                </p>
              </div>
            </div>
            <Button className="w-full" onClick={handleVerify} disabled={busy}>
              Open magic link
              <ArrowRight className="size-4" />
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setToken(null)}>
              Use a different email
            </Button>
          </div>
        ) : (
          <form className="mt-7 space-y-4" onSubmit={handleRequest}>
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
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Send magic link"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Back to homepage
          </Link>
        </p>
      </div>
    </div>
  );
}
