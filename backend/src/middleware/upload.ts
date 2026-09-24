import * as multer from "multer";
import type { Request } from "express";
import path from "path";

// CMS Media upload guard (spec §4.8 / §7):
// allow-list jpeg/png/webp/gif. MIME + extension checked here;
// magic-bytes are verified by the Cloudinary pipeline rejecting non-images.
//
// Vercel Hobby hard-caps the whole request body at 4.5MB, so enforce our
// own <=4MB envelope: every route using this instance is upload.single()
// (one file per request), so the per-file cap IS the per-request cap.
// Over-size aborts mid-stream (multer LIMIT_FILE_SIZE) and is mapped to
// HTTP 413 in app.ts's error middleware.
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const upload = multer.default({
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
      fileFilter: (
            _req: Request,
            file: Express.Multer.File,
            cb: (error: Error | null, acceptFile?: boolean) => void,
      ) => {
            const ext = path.extname(file.originalname).toLowerCase();
            if (
                  !ALLOWED_MIME_TYPES.has(file.mimetype) ||
                  !ALLOWED_EXTENSIONS.has(ext)
            ) {
                  cb(
                        new Error(
                              "Invalid file type. Allowed: jpeg, png, webp, gif (max 4MB).",
                        ),
                  );
                  return;
            }
            cb(null, true);
      },
});

export default upload;
export { MAX_FILE_SIZE_BYTES };
