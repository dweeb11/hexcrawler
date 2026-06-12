import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createSessionToken,
  requirePassphraseConfigured,
  setSessionCookie,
  verifyPassphrase,
} from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
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
