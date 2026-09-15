import test from "node:test";
import assert from "node:assert/strict";
import { createAppMagicLink, readAppMagicLink } from "./magic-link.ts";

test("OTP stays in fragment on the current Workers origin", () => {
  const link = createAppMagicLink({
    email: "person@example.com",
    token: "one-time-token",
    callbackUrl: "https://odrive.plab.workers.dev/auth",
  });
  assert.match(link, /^https:\/\/odrive\.plab\.workers\.dev\/auth#/);
  assert.equal(new URL(link).search, "");
  assert.deepEqual(readAppMagicLink(new URL(link).hash), {
    email: "person@example.com",
    token: "one-time-token",
    type: "magiclink",
  });
});

test("configured future custom domain is accepted", () => {
  const link = createAppMagicLink({
    email: "person@example.com",
    token: "token",
    callbackUrl: "https://drive.example.com/auth",
    appUrl: "https://drive.example.com",
  });
  assert.match(link, /^https:\/\/drive\.example\.com\/auth#/);
});

test("untrusted callback origin is rejected", () => {
  const link = createAppMagicLink({
    email: "person@example.com",
    token: "token",
    callbackUrl: "https://attacker.example/auth",
    appUrl: "https://odrive.plab.workers.dev",
  });
  assert.match(link, /^https:\/\/odrive\.plab\.workers\.dev\/auth#/);
});

test("incomplete token payload fails closed", () => {
  assert.equal(readAppMagicLink("#type=magiclink&token=only-token"), null);
  assert.equal(createAppMagicLink({ email: "person@example.com", token: null }), null);
});
