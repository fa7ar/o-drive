import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { OdriveLogo } from "@/components/odrive-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { readAppMagicLink } from "@/auth/magic-link";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to ODrive" },
      {
        name: "description",
        content: "Sign in to your ODrive storage workspace with a passwordless email link.",
      },
      { property: "og:title", content: "Sign in to ODrive" },
      {
        property: "og:description",
        content: "Sign in to your ODrive storage workspace with a passwordless email link.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, ready, sendMagicLink, verifyMagicLink } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (ready && user) navigate({ to: "/explorer", replace: true });
  }, [ready, user, navigate]);

  useEffect(() => {
    const payload = readAppMagicLink(window.location.hash);
    if (!payload) return;

    // Remove the one-time token before any navigation, error reporting, or UI work.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setVerifying(true);
    void verifyMagicLink(payload)
      .then(() => navigate({ to: "/explorer", replace: true }))
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "This sign-in link is invalid or expired",
        );
      })
      .finally(() => setVerifying(false));
  }, [navigate, verifyMagicLink]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setBusy(true);
    try {
      await sendMagicLink({ email, displayName });
      setSentTo(email);
      toast.success("Link sent", { description: `Open the email we sent to ${email}` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the sign-in link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="grid-backdrop absolute inset-0 opacity-50" aria-hidden />
      <div className="hero-glow absolute inset-0" aria-hidden />
      <div className="panel relative w-full max-w-md p-8">
        <OdriveLogo />
        <h1 className="mt-6 text-2xl font-semibold">Sign in to ODrive</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          No passwords. We email you a one-time link that signs you in and creates your workspace on
          first use.
        </p>

        {verifying ? (
          <div className="mt-7 rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <p className="font-medium">Signing you in…</p>
            <p className="mt-1 text-muted-foreground">Verifying your one-time link.</p>
          </div>
        ) : sentTo ? (
          <div className="mt-7 space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <p className="font-medium">Check {sentTo}</p>
              <p className="mt-1 text-muted-foreground">
                The link works once and expires shortly. Open it on this device to land straight in
                your workspace.
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setSentTo(null)}>
              Use a different email
            </Button>
          </div>
        ) : (
          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
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
              <Label htmlFor="name">Your name (optional)</Label>
              <Input
                id="name"
                autoComplete="name"
                placeholder="Fajar Tri"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Email me a sign-in link"}
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
