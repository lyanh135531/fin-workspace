import { describe, expect, it } from "vitest";
import {
  containsAuthSessionCookie,
  readRememberSessionPolicy,
  stripAuthSessionCookiePersistence,
} from "@/lib/auth-session-cookie";

describe("remember-session cookie policy", () => {
  it("reads persistent and transient policies", () => {
    expect(readRememberSessionPolicy("foo=bar; felix.remember-session=1")).toBe(
      "persistent",
    );
    expect(readRememberSessionPolicy("felix.remember-session=0; foo=bar")).toBe(
      "transient",
    );
    expect(readRememberSessionPolicy("foo=bar")).toBeNull();
  });

  it("removes persistence only from NextAuth session cookies", () => {
    const sessionCookie =
      "__Secure-next-auth.session-token=value; Path=/; Expires=Wed, 16 Sep 2026 00:00:00 GMT; Max-Age=2592000; HttpOnly; Secure";
    expect(stripAuthSessionCookiePersistence(sessionCookie)).toBe(
      "__Secure-next-auth.session-token=value; Path=/; HttpOnly; Secure",
    );

    const csrfCookie = "next-auth.csrf-token=value; Path=/; Max-Age=2592000";
    expect(stripAuthSessionCookiePersistence(csrfCookie)).toBe(csrfCookie);
  });

  it("recognizes chunked NextAuth session cookies", () => {
    expect(
      containsAuthSessionCookie([
        "next-auth.session-token.0=value; Path=/; HttpOnly",
      ]),
    ).toBe(true);
  });
});
