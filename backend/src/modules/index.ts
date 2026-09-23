import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import adminRoutes from "./admins/admin.routes.js";
import adminInviteRoutes from "./admin-invites/admin-invite.routes.js";
import publicAdminInviteRoutes from "./admin-invites/public-admin-invite.routes.js";
import authRoutes from "./auth/auth.routes.js";
import eventHostRoutes from "./event-hosts/event-hosts.routes.js";
import eventAttendeeRoutes from "./event-attendees/event-attendees.routes.js";
import eventRoutes from "./events/event.routes.js";
import mediaCollectionRoutes from "./media-collections/media-collections.routes.js";
import mediaCollectionItemRoutes from "./media-collection-items/media-collection-items.routes.js";
import mediaRoutes from "./media/media.routes.js";
import siteContentRoutes from "./site-content/site-content.routes.js";
import teamMemberRoutes from "./team-members/team-member.routes.js";
import eventSpeakerRoutes from "./event-speakers/event-speaker.routes.js";
import termsRoutes from "./terms/terms.routes.js";
import memberTermsRoutes from "./member_terms/member-terms.routes.js";
import partnerRoutes from "./partners/partner.routes.js";
import healthRoutes from "./health/health.routes.js";
import publicTeamRoutes from "./public/public-team.routes.js";
import publicEventsRoutes from "./public/public-events.routes.js";
import publicContentRoutes from "./public/public-content.routes.js";
import publicPartnersRoutes from "./public/public-partners.routes.js";
import publicGalleryRoutes from "./public/public-gallery.routes.js";

const router = Router();
const protectedRouter = Router();

// requireAuth is applied per protected mount — never blanket on this router:
// `router.use(protectedRouter)` below mounts it prefix-less, so a global
// `protectedRouter.use(requireAuth)` would also run for the public mounts
// registered on the same router and 401 the public website.
protectedRouter.use("/admins", requireAuth, adminRoutes);
protectedRouter.use("/admin-invites", requireAuth, adminInviteRoutes);
protectedRouter.use("/auth", requireAuth, authRoutes);
protectedRouter.use("/team-members", requireAuth, teamMemberRoutes);
protectedRouter.use("/events", requireAuth, eventRoutes);
protectedRouter.use("/media", requireAuth, mediaRoutes);
protectedRouter.use("/site-content", requireAuth, siteContentRoutes);
protectedRouter.use("/event-speakers", requireAuth, eventSpeakerRoutes);
protectedRouter.use("/event-hosts", requireAuth, eventHostRoutes);
protectedRouter.use("/event-attendees", requireAuth, eventAttendeeRoutes);
protectedRouter.use("/media-collections", requireAuth, mediaCollectionRoutes);
protectedRouter.use(
      "/media-collection-items",
      requireAuth,
      mediaCollectionItemRoutes,
);
protectedRouter.use("/terms", requireAuth, termsRoutes);
protectedRouter.use("/member-terms", requireAuth, memberTermsRoutes);
protectedRouter.use("/partners", requireAuth, partnerRoutes);
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
      ["/public/admin-invites", publicAdminInviteRoutes],
] as const;

export function registerPublicRoutes(target: Router) {
      for (const [path, subRouter] of publicMounts) {
            target.use(path, subRouter);
      }
}

registerPublicRoutes(router);

export default router;
