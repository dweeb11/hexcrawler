import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  parseCookies,
  requireAuth,
  verifyPassphrase,
} from "../../api/_lib/auth";

vi.stubEnv("ADMIN_API_KEY", "test-signing-key");
vi.stubEnv("ADMIN_PASSPHRASE", "test-passphrase");

function createResponse() {
  const headers: Record<string, string> = {};
  return {
    statusCode: 200,
    jsonBody: undefined as unknown,
    ended: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.jsonBody = body;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    getHeader(name: string) {
      return headers[name];
    },
  };
}

describe("admin auth", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("verifies passphrases with constant-time comparison", () => {
    expect(verifyPassphrase("test-passphrase")).toBe(true);
    expect(verifyPassphrase("wrong")).toBe(false);
  });

  it("issues a session cookie on successful login", async () => {
    const handler = (await import("../../api/admin/[route]")).default;
    const res = createResponse();

    await handler(
      {
        method: "POST",
        query: { route: "login" },
        body: { passphrase: "test-passphrase" },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ ok: true });
    expect(res.getHeader("Set-Cookie")).toContain(`${SESSION_COOKIE_NAME}=`);
  });

  it("rejects invalid passphrases", async () => {
    const handler = (await import("../../api/admin/[route]")).default;
    const res = createResponse();

    await handler(
      {
        method: "POST",
        query: { route: "login" },
        body: { passphrase: "nope" },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(401);
  });

  it("reports authenticated session state", async () => {
    const handler = (await import("../../api/admin/[route]")).default;
    const token = createSessionToken();
    const res = createResponse();

    await handler(
      {
        method: "GET",
        query: { route: "session" },
        headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ authenticated: true });
  });

  it("accepts signed session cookies for write auth", () => {
    const token = createSessionToken();
    const res = createResponse();
    const allowed = requireAuth(
      {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` },
      } as never,
      res as never,
    );

    expect(allowed).toBe(true);
  });

  it("still accepts X-API-Key for programmatic writes", () => {
    const res = createResponse();
    const allowed = requireAuth(
      {
        headers: { "x-api-key": "test-signing-key" },
      } as never,
      res as never,
    );

    expect(allowed).toBe(true);
  });

  it("clears the session cookie on logout", async () => {
    const handler = (await import("../../api/admin/[route]")).default;
    const res = createResponse();

    await handler({ method: "POST", query: { route: "logout" } } as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.getHeader("Set-Cookie")).toContain("Max-Age=0");
  });

  it("ignores malformed cookie values instead of throwing", () => {
    expect(parseCookies(`${SESSION_COOKIE_NAME}=%`)).toEqual({});
    expect(parseCookies("valid=ok; broken=%")).toEqual({ valid: "ok" });
  });

  it("rejects auth when the session cookie value is malformed", () => {
    const res = createResponse();
    const allowed = requireAuth(
      {
        headers: { cookie: `${SESSION_COOKIE_NAME}=%` },
      } as never,
      res as never,
    );

    expect(allowed).toBe(false);
    expect(res.statusCode).toBe(401);
  });
});
