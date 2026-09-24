/**
 * Preload for drizzle-kit (see package.json db:generate / db:migrate).
 *
 * Our TypeScript sources use NodeNext-style `./foo.js` relative specifiers —
 * tsc requires them under `moduleResolution: NodeNext`, and they resolve at
 * runtime because dist/foo.js exists. drizzle-kit, however, loads schema and
 * config files through plain CommonJS require, which treats an explicit
 * `.js` request as a literal filename and never falls back to the sibling
 * `.ts` source (extensionless imports only worked because Node retries
 * registered extensions like `.ts`).
 *
 * This shim rewrites a failed `*.js` resolution to the sibling `*.ts` file
 * when one exists, so `npm run db:generate` / `db:migrate` work offline
 * without changing source specifiers or adding a dependency.
 *
 * Build-time only — never loaded by the server.
 */
const Module = require("node:module");

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function patchedResolve(request, ...rest) {
      try {
            return originalResolveFilename.call(this, request, ...rest);
      } catch (error) {
            const isMissingJs =
                  error &&
                  error.code === "MODULE_NOT_FOUND" &&
                  typeof request === "string" &&
                  request.endsWith(".js");

            if (isMissingJs) {
                  try {
                        // `./config/env.js` -> `./config/env.ts`
                        return originalResolveFilename.call(
                              this,
                              request.slice(0, -3) + ".ts",
                              ...rest,
                        );
                  } catch {
                        // No .ts sibling — fall through and rethrow the
                        // original .js error for a clear message.
                  }
            }
            throw error;
      }
};
