/**
 * Vite dev server plugin that routes /api/* requests to the Vercel
 * serverless function handlers, shimming VercelRequest/VercelResponse
 * onto Node's IncomingMessage/ServerResponse.
 *
 * This lets `npm run dev` serve both the frontend and API without
 * the Vercel CLI or any external credentials (falls back to local SQLite).
 */
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

interface VercelLikeRequest extends IncomingMessage {
  query: Record<string, string | string[]>;
  body: unknown;
}

interface VercelLikeResponse extends ServerResponse {
  status: (code: number) => VercelLikeResponse;
  json: (data: unknown) => void;
  send: (body: string) => void;
}

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(raw);
      }
    });
  });
}

function parseQuery(url: string): Record<string, string | string[]> {
  const idx = url.indexOf("?");
  if (idx === -1) return {};
  const params = new URLSearchParams(url.slice(idx + 1));
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of params) {
    const existing = result[key];
    if (existing) {
      result[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value];
    } else {
      result[key] = value;
    }
  }
  return result;
}

function shimResponse(res: ServerResponse): VercelLikeResponse {
  const vRes = res as VercelLikeResponse;
  vRes.status = (code: number) => {
    vRes.statusCode = code;
    return vRes;
  };
  vRes.json = (data: unknown) => {
    vRes.setHeader("Content-Type", "application/json");
    vRes.end(JSON.stringify(data));
  };
  vRes.send = (body: string) => {
    vRes.end(body);
  };
  return vRes;
}

type RouteHandler = {
  default: (req: VercelLikeRequest, res: VercelLikeResponse) => Promise<void>;
};

export default function viteApiPlugin(): Plugin {
  return {
    name: "vite-api-routes",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/api/")) {
          next();
          return;
        }

        try {
          const body = await parseBody(req);
          const query = parseQuery(url);

          const vReq = req as VercelLikeRequest;
          vReq.body = body;
          vReq.query = query;

          const vRes = shimResponse(res);

          // Route: /api/encounters
          // Route: /api/encounters/[id]
          // Route: /api/seed
          const pathname = url.split("?")[0];

          let handler: RouteHandler;

          if (pathname === "/api/encounters") {
            handler = await server.ssrLoadModule(
              "/api/encounters/index.ts",
            ) as RouteHandler;
          } else if (pathname.startsWith("/api/encounters/")) {
            const id = pathname.slice("/api/encounters/".length);
            vReq.query = { ...vReq.query, id };
            handler = await server.ssrLoadModule(
              "/api/encounters/[id].ts",
            ) as RouteHandler;
          } else if (pathname === "/api/seed") {
            handler = await server.ssrLoadModule(
              "/api/seed.ts",
            ) as RouteHandler;
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Not found" }));
            return;
          }

          await handler.default(vReq, vRes);
        } catch (err) {
          console.error("API route error:", err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      });
    },
  };
}
