import { timingSafeEqual } from "node:crypto";

import type { VercelRequest, VercelResponse } from "@vercel/node";

function normalizeBuffers(a: string, b: string): [Buffer, Buffer, boolean] {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length === right.length) {
    return [left, right, true];
  }

  const size = Math.max(left.length, right.length);
  const paddedLeft = Buffer.alloc(size);
  const paddedRight = Buffer.alloc(size);
  left.copy(paddedLeft);
  right.copy(paddedRight);

  return [paddedLeft, paddedRight, false];
}

export function constantTimeEqual(a: string, b: string): boolean {
  const [left, right, sameLength] = normalizeBuffers(a, b);
  return sameLength && timingSafeEqual(left, right);
}

export function requireAuth(req: VercelRequest, res: VercelResponse): boolean {
  const expectedKey = process.env.ADMIN_API_KEY;
  const providedKey = req.headers["x-api-key"];
  const apiKey = Array.isArray(providedKey) ? providedKey[0] : providedKey;

  if (!expectedKey) {
    res.status(500).json({ error: "Server misconfigured: ADMIN_API_KEY is missing." });
    return false;
  }

  if (!apiKey || !constantTimeEqual(apiKey, expectedKey)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  return true;
}
