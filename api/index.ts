// api/index.ts — Vercel serverless entry (single-project layout, Phase 4).
//
// No business logic: load the built Express app (backend/dist/app.js) and
// delegate every invocation to it. App-import failures are logged as one
// structured JSON line (message + stack) and RETHROWN so the invocation
// fails loudly — never caught-and-serve from a half-loaded app.
import type { IncomingMessage, ServerResponse } from "node:http";

type AppHandler = (req: IncomingMessage, res: ServerResponse) => void;

let handlerPromise: Promise<AppHandler> | undefined;

function loadApp(): Promise<AppHandler> {
      if (!handlerPromise) {
            handlerPromise = (async () => {
                  const mod = (await import("../backend/dist/app.js")) as {
                        default?: unknown;
                        app?: unknown;
                  };
                  const app = mod.default ?? mod.app;
                  if (typeof app !== "function") {
                        throw new Error(
                              "backend/dist/app.js did not export an Express app",
                        );
                  }
                  return app as AppHandler;
            })();
      }
      return handlerPromise;
}

export default async function handler(
      req: IncomingMessage,
      res: ServerResponse,
): Promise<void> {
      let app: AppHandler;
      try {
            app = await loadApp();
      } catch (err) {
            // Structured cold-start failure log, then rethrow (fail the
            // invocation — Vercel shows the function as errored).
            console.error(
                  JSON.stringify({
                        level: "error",
                        message: "backend app import failed",
                        error:
                              err instanceof Error ? err.message : String(err),
                        stack: err instanceof Error ? err.stack : undefined,
                  }),
            );
            throw err;
      }
      app(req, res);
}
