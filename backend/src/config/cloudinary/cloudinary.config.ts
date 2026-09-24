import { v2 as cloudinary } from "cloudinary";
import ENV from "../env.js";

export function isCloudinaryEnabled(): boolean {
      const url = ENV.CLOUDINARY_URL;
      return typeof url === "string" && url.trim().length > 0;
}

if (isCloudinaryEnabled()) {
      cloudinary.config();
}

export default cloudinary;
