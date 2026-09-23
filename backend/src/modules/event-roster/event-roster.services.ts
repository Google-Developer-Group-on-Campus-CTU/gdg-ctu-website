import { AppError } from "../../utils/http.js";
import { getEventById } from "../events/models/event.queries.js";
import { getTeamMemberById } from "../team-members/models/team-member.queries.js";
import { getEventHostByEventAndTeamMember } from "../event-hosts/models/event-host.queries.js";
import { getEventAttendeeByEventAndEmail } from "../event-attendees/models/event-attendee.queries.js";

// Event roster seam: shared integrity checks for the hosts / attendees /
// speakers trio. Deliberately thin — existence + dedupe helpers only. Each
// trio module keeps its own router, caching, and list orchestration; list
// helpers intentionally live there (importing them here would cycle, since
// the trio services call these checks).

// Throws 404 when the event does not exist.
export const checkEventExists = async (eventId: string): Promise<void> => {
      if (!(await getEventById(eventId))) {
            throw new AppError(404, "Event not found");
      }
};

// Throws 400 when the team member does not exist (FK reference guard).
export const checkTeamMemberExists = async (
      teamMemberId: string,
): Promise<void> => {
      if (!(await getTeamMemberById(teamMemberId))) {
            throw new AppError(
                  400,
                  "teamMemberId must reference an existing team member",
            );
      }
};

// Dedupe guard: throws 409 when the team member already hosts the event,
// returns true when the pair is free.
export const checkHostMembership = async (
      eventId: string,
      teamMemberId: string,
): Promise<true> => {
      if (await getEventHostByEventAndTeamMember(eventId, teamMemberId)) {
            throw new AppError(
                  409,
                  "Team member already hosts this event",
            );
      }
      return true;
};

// Dedupe guard (case-insensitive email): throws 409 when the email is already
// registered for the event, returns true when free.
export const checkAttendeeMembership = async (
      eventId: string,
      email: string,
): Promise<true> => {
      if (await getEventAttendeeByEventAndEmail(eventId, email)) {
            throw new AppError(
                  409,
                  "Email already registered for this event",
            );
      }
      return true;
};
