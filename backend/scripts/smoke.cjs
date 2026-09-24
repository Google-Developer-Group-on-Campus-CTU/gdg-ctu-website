// Offline CI smoke (Phase 4): import the built app and assert the two
// contract route prefixes are mounted. No network, no DB — `src/app.ts`
// is side-effect-free at import (Phase 3), so this runs anywhere.
//
// Offline defaults only apply when a variable is UNSET — a local
// backend/.env (loaded by dotenv during the import) wins.
process.env.NODE_ENV ||= "production"; // console-only logger, no logs/ writes
process.env.FR_ORIGIN ||= "http://localhost:5173";
process.env.BETTER_AUTH_SECRET ||= "offline-smoke-secret-not-for-production";
process.env.BETTER_AUTH_URL ||= "http://localhost:3000";

const fail = (msg) => {
      console.error(`SMOKE FAIL: ${msg}`);
      process.exit(1);
};

const main = async () => {
      let mod;
      try {
            mod = await import("../dist/app.js");
      } catch (err) {
            fail(`dist/app.js import threw: ${err && err.message}`);
            return;
      }

      const app = mod.default ?? mod.app;
      if (typeof app !== "function") {
            fail("dist/app.js did not export an Express app");
      }

      // Express 5 exposes the router lazily via the `app.router` getter
      // (`_router` kept as a fallback for older majors).
      const router = app.router ?? app._router;
      if (!router || !Array.isArray(router.stack)) {
            fail("Express router stack is not introspectable");
      }

      // Express 5 (router@2) layers expose `route.path` for registered
      // routes — NOT Express 4's `layer.regexp`. Collect every registered
      // route path at the top level plus one router level deep.
      const collectPaths = (stack) => {
            const paths = [];
            for (const layer of stack || []) {
                  if (
                        layer &&
                        layer.route &&
                        typeof layer.route.path === "string"
                  ) {
                        paths.push(layer.route.path);
                  }
                  if (
                        layer &&
                        layer.handle &&
                        Array.isArray(layer.handle.stack)
                  ) {
                        paths.push(...collectPaths(layer.handle.stack));
                  }
            }
            return paths;
      };
      const paths = collectPaths(router.stack);
      const haystack = paths.join("\n");

      if (!paths.includes("/health")) {
            fail(`route /health not mounted (routes: ${haystack})`);
      }
      if (!haystack.includes("GDGoC-CTU-Main/v0.0.1")) {
            fail(
                  `API prefix /GDGoC-CTU-Main/v0.0.1 not mounted (routes: ${haystack})`,
            );
      }

      console.log(
            `SMOKE PASS: dist/app.js imported cleanly; /health and /GDGoC-CTU-Main/v0.0.1 mounted (${paths.length} routes seen)`,
      );
      process.exit(0);
};

main().catch((err) => fail(err && err.stack ? err.stack : String(err)));
