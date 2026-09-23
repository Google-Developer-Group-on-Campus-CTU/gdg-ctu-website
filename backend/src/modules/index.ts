import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import adminRoutes from "./admins/admin.routes";
import authRoutes from "./auth/auth.routes";
import eventHostRoutes from "./event-hosts/event-hosts.routes";
import eventAttendeeRoutes from "./event-attendees/event-attendees.routes";
import eventRoutes from "./events/event.routes";
import mediaCollectionRoutes from "./media-collections/media-collections.routes";
import mediaRoutes from "./media/media.routes";
import siteContentRoutes from "./site-content/site-content.routes";
import teamMemberRoutes from "./team-members/team-member.routes";
import eventSpeakerRoutes from "./event-speakers/event-speaker.routes";
import termsRoutes from "./terms/terms.routes";
import memberTermsRoutes from "./member_terms/member-terms.routes";
import partnerRoutes from "./partners/partner.routes";
import healthRoutes from "./health/health.routes";
import publicTeamRoutes from "./public/public-team.routes";
import publicEventsRoutes from "./public/public-events.routes";
import publicContentRoutes from "./public/public-content.routes";
import publicPartnersRoutes from "./public/public-partners.routes";
import publicGalleryRoutes from "./public/public-gallery.routes";

const router = Router();
const protectedRouter = Router();

protectedRouter.use(requireAuth);
protectedRouter.use("/admins", adminRoutes);
protectedRouter.use("/auth", authRoutes);
protectedRouter.use("/team-members", teamMemberRoutes);
protectedRouter.use("/events", eventRoutes);
protectedRouter.use("/media", mediaRoutes);
protectedRouter.use("/site-content", siteContentRoutes);
protectedRouter.use("/event-speakers", eventSpeakerRoutes);
protectedRouter.use("/event-hosts", eventHostRoutes);
protectedRouter.use("/event-attendees", eventAttendeeRoutes);
protectedRouter.use("/media-collections", mediaCollectionRoutes);
protectedRouter.use("/terms", termsRoutes);
protectedRouter.use("/member-terms", memberTermsRoutes);
protectedRouter.use("/partners", partnerRoutes);
router.use(protectedRouter);

// Public (no auth) — CMS reads for the website. A new public entity is one
// entry in `publicMounts`; paths stay identical.
const publicMounts = [
      ["/health", healthRoutes],
      ["/public/team", publicTeamRoutes],
      ["/public/events", publicEventsRoutes],
      ["/public/content", publicContentRoutes],
      ["/public/partners", publicPartnersRoutes],
      ["/public/gallery", publicGalleryRoutes],
] as const;

export function registerPublicRoutes(target: Router) {
      for (const [path, subRouter] of publicMounts) {
            target.use(path, subRouter);
      }
}

registerPublicRoutes(router);

export default router;
