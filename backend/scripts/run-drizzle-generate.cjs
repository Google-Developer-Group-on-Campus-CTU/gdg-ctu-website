/**
 * Non-interactive driver for `drizzle-kit generate`.
 *
 * drizzle-kit asks "Is <table> created or renamed from another table?" via
 * hanji, which resolves each prompt on an Enter keypress — but its readline
 * tears down after the first answer, so piping stdin up-front aborts mid-run
 * and can exit 0 without writing a migration. This driver keeps stdin open
 * and sends one Enter per prompt as it appears. The default selection is
 * always "create" (correct here: `admins` is dropped outright, the Better
 * Auth tables are brand new, no data migration).
 *
 * Usage: node scripts/run-drizzle-generate.cjs [extra drizzle-kit args...]
 */
const { spawn } = require("node:child_process");
const path = require("node:path");

const kitBin = path.join(__dirname, "..", "node_modules", "drizzle-kit", "bin.cjs");
const tsSpecifiers = path.join(__dirname, "resolve-ts-specifiers.cjs");
const PROMPT_RE = /created or renamed from another (table|column|schema)/;

const proc = spawn(
      process.execPath,
      ["-r", tsSpecifiers, kitBin, "generate", ...process.argv.slice(2)],
      {
            stdio: ["pipe", "pipe", "inherit"],
            cwd: path.join(__dirname, ".."),
      },
);

let pending = "";

proc.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      pending += text;

      if (PROMPT_RE.test(pending)) {
            pending = "";
            // Let hanji attach its keypress listener before we send Enter.
            setTimeout(() => {
                  if (!proc.stdin.destroyed) {
                        proc.stdin.write("\r");
                  }
            }, 150);
      } else if (pending.length > 8192) {
            pending = pending.slice(-4096);
      }
});

proc.stdin.on("error", () => {
      /* child may exit before a late write — ignore EPIPE */
});

proc.on("exit", (code, signal) => {
      if (signal) {
            console.error(`drizzle-kit generate killed by ${signal}`);
            process.exit(1);
      }
      process.exit(code ?? 1);
});
