import winston from "winston";
import path from "path";
import fs from "fs";

/*
  Central application logger.

  Purpose:
  - Standardize logging format across services.
  - Enable debugging in production using structured logs.
  - Separate error logs from general application logs.
  - Support future integration with log aggregation tools.

  Design decisions:
  - JSON format for machine parsing (logFormat below).
  - Production (NODE_ENV=production): Console/stdout transport ONLY — a
    serverless container must not buffer files (ephemeral fs, wasted I/O);
    structured lines on stdout feed the platform's log drain.
  - Development: file transports (logs/app.log, logs/error.log) for
    persistence plus a colorized console transport.
*/

const isProduction = process.env.NODE_ENV === "production";

// Dev-only: ensure the logs directory exists for the file transports.
// Skipped in production, which writes to stdout and creates nothing.
const logDir = "logs";
if (!isProduction && !fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
}

const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
);

const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
            const metaString = Object.keys(meta).length
                  ? JSON.stringify(meta)
                  : "";

            return `${timestamp} [${level}]: ${stack || message} ${metaString}`;
      }),
);

const logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",

      transports: isProduction
            ? [
                    // Serverless: structured JSON to stdout only — no file
                    // transports, no logs/ directory.
                    new winston.transports.Console({
                          format: logFormat,
                    }),
              ]
            : [
                    // Application logs
                    new winston.transports.File({
                          filename: path.join(logDir, "app.log"),
                    }),

                    // Error logs only
                    new winston.transports.File({
                          filename: path.join(logDir, "error.log"),
                          level: "error",
                    }),

                    // Console output for development
                    new winston.transports.Console({
                          format: consoleFormat,
                    }),
              ],

      exitOnError: false,
});

export default logger;
