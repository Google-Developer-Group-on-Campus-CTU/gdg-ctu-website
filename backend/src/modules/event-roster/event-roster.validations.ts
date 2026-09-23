import { z } from "zod";
import { AppError } from "../../utils/http.js";

// Shared `?eventId` query filter for the roster trio (hosts / attendees /
// speakers). Absent → the existing global list; present must be a UUID.
export const EventIdQuerySchema = z.object({
      eventId: z.uuid({ message: "Event ID must be a valid UUID." }),
});

export type EventIdQueryDTO = z.infer<typeof EventIdQuerySchema>;

// Parse optional `?eventId` from a request query object.
// Returns `undefined` when the param is absent; throws AppError(400) when it
// is present but not a valid UUID (empty string, array, malformed uuid, ...).
export const parseOptionalEventId = (query: unknown): string | undefined => {
      if (
            query === null ||
            typeof query !== "object" ||
            !("eventId" in query) ||
            (query as Record<string, unknown>).eventId === undefined
      ) {
            return undefined;
      }

      const result = EventIdQuerySchema.safeParse({
            eventId: (query as Record<string, unknown>).eventId,
      });

      if (!result.success) {
            const message = result.error.issues
                  .map((issue) => {
                        const path = issue.path.join(".");
                        return path ? `${path}: ${issue.message}` : issue.message;
                  })
                  .join("; ");
            throw new AppError(400, message);
      }

      return result.data.eventId;
};
