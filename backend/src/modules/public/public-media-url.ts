import { inArray } from "drizzle-orm";
import { db } from "../../config/connectDB";
import { media } from "../media/models/media";

/**
 * Batch-resolves media UUIDs to their Cloudinary `secureUrl` values for the
 * public feeds (team / events / partners / content / gallery).
 *
 * Returns a `Map<mediaId, secureUrl>`; callers attach the resolved URL under
 * their entity-specific key (photoUrl / coverUrl / logoUrl / imageUrl /
 * secureUrl) **alongside** the existing FK columns — never renaming them.
 */
export const resolveMediaUrlMap = async (
      ids: Array<string | null | undefined>,
): Promise<Map<string, string>> => {
      const unique = [
            ...new Set(ids.filter((id): id is string => Boolean(id))),
      ];
      if (unique.length === 0) {
            return new Map<string, string>();
      }

      const rows = await db
            .select({ id: media.id, secureUrl: media.secureUrl })
            .from(media)
            .where(inArray(media.id, unique));

      return new Map(rows.map((row) => [row.id, row.secureUrl]));
};

/** Looks up a single media URL; `null` when the FK is empty or unresolved. */
export const pickMediaUrl = (
      map: Map<string, string>,
      mediaId: string | null | undefined,
): string | null => (mediaId ? (map.get(mediaId) ?? null) : null);
