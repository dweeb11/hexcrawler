import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isSessionAuthenticated } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.status(200).json({ authenticated: isSessionAuthenticated(req) });
}
