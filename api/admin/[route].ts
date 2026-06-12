import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  clearSessionCookie,
  createSessionToken,
  isSessionAuthenticated,
  requirePassphraseConfigured,
  setSessionCookie,
  verifyPassphrase,
} from "../_lib/auth";

async function handleLogin(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!requirePassphraseConfigured(res)) {
    return;
  }

  const passphrase = String(req.body?.passphrase ?? "");
  if (!verifyPassphrase(passphrase)) {
    res.status(401).json({ error: "Invalid passphrase" });
    return;
  }

  setSessionCookie(res, createSessionToken());
  res.status(200).json({ ok: true });
}

async function handleLogout(_req: VercelRequest, res: VercelResponse): Promise<void> {
  if (_req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}

async function handleSession(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.status(200).json({ authenticated: isSessionAuthenticated(req) });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const route = String(req.query.route);

  switch (route) {
    case "login":
      await handleLogin(req, res);
      return;
    case "logout":
      await handleLogout(req, res);
      return;
    case "session":
      await handleSession(req, res);
      return;
    default:
      res.status(404).json({ error: "Not found" });
  }
}
