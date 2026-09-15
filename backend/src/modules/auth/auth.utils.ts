import { getAuth } from "@clerk/express";
import { getStringParam } from "../../utils/http";

/**
 * Extracts the Clerk user ID from an Express request.
 * Prioritizes the Clerk auth session, falling back to req.body.uploadedBy.
 *
 * @param req - The Express Request object
 * @returns The Clerk ID as a string, or undefined if not found
 */
export const getClerkIdFromRequest = (req: any): string | undefined => {
      const auth = getAuth(req);

      // 1. Check for standard Clerk authentication
      if (auth.userId !== null && auth.userId !== undefined) {
            return auth.userId;
      }

      // 2. Fallback: Check the request body for an explicit uploader ID
      if (req.body?.uploadedBy) {
            return getStringParam(req.body.uploadedBy, "uploadedBy");
      }

      // 3. Return undefined if no identifier can be resolved
      return undefined;
};
