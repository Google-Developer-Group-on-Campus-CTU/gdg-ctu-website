import { apiFetch } from './client.js';
import { toArray, getId, getStatus, getUpdatedAt, qs } from './resources.js';
import { useFeed } from './feed.js';

/**
 * Public (unauthenticated) CMS contract — CMS simplification Phase 3.
 * Base is VITE_API_URL which already includes /GDGoC-CTU-Main/v0.0.1.
 * All payloads are safe fields only (no account IDs, no emails rendered).
 *
 * Retired: site-content helpers (GET /public/content is gone — hero/CTA
 * copy is hardcoded in the pages) and the `featured` event scope (the
 * backend rejects it with 400; use upcoming|past|recent).
 */

/** Scopes accepted by GET /public/events — anything else is rejected upstream with 400. */
const PUBLIC_EVENT_SCOPES = new Set(['upcoming', 'past', 'recent']);

/**
 * Static fallback for past events — shown when the content service is
 * unavailable so the page always has meaningful content. Each entry is
 * pre-shaped to match mapEvent() output so it can be used directly in
 * EventCard without any further transformation.
 *
 * Dates are ISO strings (full UTC midnight, Asia/Manila offset = UTC+8,
 * so midnight Manila = 16:00 previous day UTC; simplified here as date-only
 * ISO strings which formatDate() handles fine).
 */
export const FALLBACK_PAST_EVENTS = [
  {
    id: 'fallback-1',
    slug: null,
    title: 'Tech Welcome Fiesta: Discover GDG',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/contentbuilder/GDG_Bevy_DefaultEventThumbnail_2_va1kAS9.png',
    coverAlt: 'Tech Welcome Fiesta: Discover GDG',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-tech-welcome-fiesta-discover-gdg-1/',
    timezone: 'Asia/Manila',
    category: 'Meetup',
    startAt: '2026-09-14T00:00:00.000Z',
    endAt: '2026-09-14T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-2',
    slug: null,
    title: 'Build the Future of AI: Hands-On Workshop with Google ADK',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/blob_RWI3tOs',
    coverAlt: 'Build the Future of AI: Hands-On Workshop with Google ADK',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-build-the-future-of-ai-hands-on-workshop-with-google-adk/',
    timezone: 'Asia/Manila',
    category: 'Workshop',
    startAt: '2026-09-04T00:00:00.000Z',
    endAt: '2026-09-04T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-3',
    slug: null,
    title: 'Tech Welcome Fiesta: Discover GDG',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/blob_zGALIMu',
    coverAlt: 'Tech Welcome Fiesta: Discover GDG',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-tech-welcome-fiesta-discover-gdg/',
    timezone: 'Asia/Manila',
    category: 'Meetup',
    startAt: '2026-08-17T00:00:00.000Z',
    endAt: '2026-08-17T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-4',
    slug: null,
    title: 'ValenTech Venture',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/blob_cnPUXJy',
    coverAlt: 'ValenTech Venture',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-valentech-venture-1/',
    timezone: 'Asia/Manila',
    category: 'Competition',
    startAt: '2026-02-10T00:00:00.000Z',
    endAt: '2026-02-10T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-5',
    slug: null,
    title: 'Agentic Anything – Intro to AI Agents',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/blob_NnPtwte',
    coverAlt: 'Agentic Anything – Intro to AI Agents',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-agentic-anything-intro-to-ai-agents/',
    timezone: 'Asia/Manila',
    category: 'Talk',
    startAt: '2025-12-20T00:00:00.000Z',
    endAt: '2025-12-20T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-6',
    slug: null,
    title: 'Game Jam: Join us for some fun as we welcome November!',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/blob_4MPUNaJ',
    coverAlt: 'Game Jam: Join us for some fun as we welcome November!',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-game-jam-join-us-for-some-fun-as-we-welcome-november/',
    timezone: 'Asia/Manila',
    category: 'Competition',
    startAt: '2025-10-27T00:00:00.000Z',
    endAt: '2025-10-27T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-7',
    slug: null,
    title: 'Gemini Study Jam: Get Started with Gemini',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/blob_ThJDfun',
    coverAlt: 'Gemini Study Jam: Get Started with Gemini',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-gemini-study-jam-get-started-with-gemini/',
    timezone: 'Asia/Manila',
    category: 'Workshop',
    startAt: '2025-10-18T00:00:00.000Z',
    endAt: '2025-10-18T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-8',
    slug: null,
    title: 'Info Session : Stardust and Strides',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/blob_HYEIVtq',
    coverAlt: 'Info Session : Stardust and Strides',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-info-session-stardust-and-strides/',
    timezone: 'Asia/Manila',
    category: 'Talk',
    startAt: '2025-09-20T00:00:00.000Z',
    endAt: '2025-09-20T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-9',
    slug: null,
    title: 'Building a Web solution using Gemini and Firebase Studio',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/blob_lEa8VZ8',
    coverAlt: 'Building a Web solution using Gemini and Firebase Studio',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-building-a-web-solution-using-gemini-and-firebase-studio/cohost-gdg-on-campus-cebu-technological-university-cebu-philippines',
    timezone: 'Asia/Manila',
    category: 'Workshop',
    startAt: '2025-09-19T00:00:00.000Z',
    endAt: '2025-09-19T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-10',
    slug: null,
    title: 'First Year Feels + Computer Science for Everyone',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/blob_G4RCuNg',
    coverAlt: 'First Year Feels + Computer Science for Everyone',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-first-year-feels-computer-science-for-everyone/',
    timezone: 'Asia/Manila',
    category: 'Talk',
    startAt: '2025-08-23T00:00:00.000Z',
    endAt: '2025-08-23T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-11',
    slug: null,
    title: 'Getting to know GDGoC-CTU - Tech Storya Dba #1',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/blob_gcO0h7W',
    coverAlt: 'Getting to know GDGoC-CTU - Tech Storya Dba #1',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-getting-to-know-gdgoc-ctu-tech-storya-dba-1/',
    timezone: 'Asia/Manila',
    category: 'Meetup',
    startAt: '2025-08-16T00:00:00.000Z',
    endAt: '2025-08-16T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-12',
    slug: null,
    title: 'Pixel Planitia : CTU Opening Week',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/blob_H7qFyDt',
    coverAlt: 'Pixel Planitia : CTU Opening Week',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-pixel-planitia-ctu-opening-week-1/',
    timezone: 'Asia/Manila',
    category: 'Meetup',
    startAt: '2025-08-11T00:00:00.000Z',
    endAt: '2025-08-11T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-13',
    slug: null,
    title: 'Build Smart: Creating AI-Enabled Apps with Firebase',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/blob_sDRnGMU',
    coverAlt: 'Build Smart: Creating AI-Enabled Apps with Firebase',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-build-smart-creating-ai-enabled-apps-with-firebase/',
    timezone: 'Asia/Manila',
    category: 'Workshop',
    startAt: '2025-07-30T00:00:00.000Z',
    endAt: '2025-07-30T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-14',
    slug: null,
    title: 'Advanced Web Development with React',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/heheheheheh_d05PC6e.png',
    coverAlt: 'Advanced Web Development with React',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-advanced-web-development-with-react/',
    timezone: 'Asia/Manila',
    category: 'Workshop',
    startAt: '2025-03-30T00:00:00.000Z',
    endAt: '2025-03-30T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-15',
    slug: null,
    title: 'Flutter Workshop',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/flutter_wsqgmfv.png',
    coverAlt: 'Flutter Workshop',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-flutter-workshop/',
    timezone: 'Asia/Manila',
    category: 'Workshop',
    startAt: '2025-03-15T00:00:00.000Z',
    endAt: '2025-03-15T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-16',
    slug: null,
    title: 'Cybersecurity Workshop',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/Cybersecurity%20Poster_02RVTzX.png',
    coverAlt: 'Cybersecurity Workshop',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-cybersecurity-workshop/',
    timezone: 'Asia/Manila',
    category: 'Workshop',
    startAt: '2025-02-16T00:00:00.000Z',
    endAt: '2025-02-16T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-17',
    slug: null,
    title: 'Version Control with Git and GitHub',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/GIT%20%20GITHUB2_M3buPv6.png',
    coverAlt: 'Version Control with Git and GitHub',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-version-control-with-git-and-github/',
    timezone: 'Asia/Manila',
    category: 'Workshop',
    startAt: '2025-02-01T00:00:00.000Z',
    endAt: '2025-02-01T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-18',
    slug: null,
    title: 'UI & UX Design with Figma',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/UIUX%20Poster%20%281%29_Al8PRDZ.png',
    coverAlt: 'UI & UX Design with Figma',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-ui-amp-ux-design-with-figma/',
    timezone: 'Asia/Manila',
    category: 'Workshop',
    startAt: '2024-12-21T00:00:00.000Z',
    endAt: '2024-12-21T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-19',
    slug: null,
    title: 'Introduction to Web Development Workshop (HTML, CSS, JS)',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/21910746_RZJ2SJl.jpg',
    coverAlt: 'Introduction to Web Development Workshop (HTML, CSS, JS)',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-introduction-to-web-development-workshop-html-css-js/',
    timezone: 'Asia/Manila',
    category: 'Workshop',
    startAt: '2024-12-14T00:00:00.000Z',
    endAt: '2024-12-14T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-20',
    slug: null,
    title: 'C Programming for Newbies',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/C%20Programming_J5OX1q6.png',
    coverAlt: 'C Programming for Newbies',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-c-programming-for-newbies/',
    timezone: 'Asia/Manila',
    category: 'Workshop',
    startAt: '2024-12-07T00:00:00.000Z',
    endAt: '2024-12-07T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-21',
    slug: null,
    title: 'Info Session 2024',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/InfoSession-01_Sgr3LSG.png',
    coverAlt: 'Info Session 2024',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-info-session-2024/',
    timezone: 'Asia/Manila',
    category: 'Meetup',
    startAt: '2024-11-23T00:00:00.000Z',
    endAt: '2024-11-23T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-22',
    slug: null,
    title: 'Forest of the Devs Booth for CTU Intramurals: BANAAG 2024',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/Forest%20of%20the%20Devs_8Eeo12X.png',
    coverAlt: 'Forest of the Devs Booth for CTU Intramurals: BANAAG 2024',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-forest-of-the-devs-booth-for-ctu-intramurals-banaag-2024/',
    timezone: 'Asia/Manila',
    category: 'Meetup',
    startAt: '2024-11-04T00:00:00.000Z',
    endAt: '2024-11-04T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
  {
    id: 'fallback-23',
    slug: null,
    title: 'GDGoC Onboarding & Future Events',
    short: '',
    description: '',
    coverUrl: 'https://res.cloudinary.com/startup-grind/image/upload/c_fill,w_500,h_500,g_center/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/GDG%20Pfp%20_CgBsP9F.jpeg',
    coverAlt: 'GDGoC Onboarding & Future Events',
    location: null,
    locationEmbedUrl: null,
    externalUrl: 'https://gdg.community.dev/events/details/google-gdg-on-campus-cebu-technological-university-cebu-philippines-presents-gdgoc-onboarding-amp-future-events/',
    timezone: 'Asia/Manila',
    category: 'Meetup',
    startAt: '2024-11-03T00:00:00.000Z',
    endAt: '2024-11-03T00:00:00.000Z',
    status: 'published',
    order: 0,
    updatedAt: null,
  },
];

/**
 * Unwrap a single-object payload. Handles generic envelopes
 * ({ data/item/result }), domain envelopes ({ teamMember/event }),
 * and the album detail shape ({ success, album, items }) by merging
 * items onto the album so mapAlbum sees both.
 */
function toObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload ?? null;
  if (payload.album && typeof payload.album === 'object' && !Array.isArray(payload.album)) {
    const items = Array.isArray(payload.items) ? payload.items : (payload.album.items ?? []);
    return { ...payload.album, items };
  }
  for (const key of ['data', 'item', 'result', 'teamMember', 'event']) {
    const value = payload[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  }
  return payload;
}

async function getOne(path) {
  try {
    return toObject(await apiFetch(path));
  } catch (err) {
    if (err?.status === 404) return null;
    throw err;
  }
}

/**
 * A list endpoint returning 404 means "this module has nothing yet" — render
 * an empty state instead of a red error. Anything else still propagates to
 * the feeds' ErrorState + Retry.
 */
async function getMany(path) {
  try {
    return toArray(await apiFetch(path));
  } catch (err) {
    if (err?.status === 404) return [];
    throw err;
  }
}

/**
 * Terms picklist (GET /public/terms → { success, terms }) and gallery
 * categories (GET /public/gallery/categories → { success, categories }).
 * These unwrap their domain envelope keys directly instead of going
 * through the generic toArray — resources.js LIST_KEYS is owned by the
 * admin lane and knows neither `terms` nor `categories`.
 */
async function getTermsList() {
  try {
    const payload = await apiFetch('/public/terms');
    if (payload && typeof payload === 'object' && !Array.isArray(payload) && Array.isArray(payload.terms)) {
      return payload.terms;
    }
    return toArray(payload);
  } catch (err) {
    if (err?.status === 404) return [];
    throw err;
  }
}

async function getGalleryCategoriesList() {
  try {
    const payload = await apiFetch('/public/gallery/categories');
    if (payload && typeof payload === 'object' && !Array.isArray(payload) && Array.isArray(payload.categories)) {
      return payload.categories;
    }
    return toArray(payload);
  } catch (err) {
    if (err?.status === 404) return [];
    throw err;
  }
}

/**
 * Static fallback for team members — shown when the content service is
 * unavailable. Pre-shaped to match mapMember() output.
 *
 * Department mapping:
 *   Executive             → CEO, COO (their "Chief …" roles surface them under Organization Leads)
 *   Operations            → PMO, Events & Logistics Officers, Executive Secretary
 *   Technology            → CTO, Web Dev, AI/ML, Embedded Systems, Cyber Security, Data Science
 *   Creatives             → CCO, Graphics & Branding, UI/UX & Product Design, Game Development
 *   Community Development → CCDO, Public Relations, External Relations & Partnerships
 *   Finance               → CFO, Finance Officer, Budget & Audit Officer
 */
/**
 * Static fallback for partners — shown when the content service is
 * unavailable so the page always has meaningful content. Pre-shaped to
 * match mapPartner() output. Each entry has logoUrl: null so the UI
 * renders initials; real entries get Cloudinary URLs.
 *
 * SWUDevs, Notion CTU and ICpEP.SE are the fallback partners (pictures
 * to be added later).
 */
export const FALLBACK_PARTNERS = [
  {
    id: 'fallback-p-1',
    slug: null,
    name: 'SWUDevs',
    logoUrl: '/partners/swudevs.png',
    logoAlt: 'SWUDevs',
    website: null,
    tier: 'community',
    description: '',
    order: 0,
    status: 'published',
  },
  {
    id: 'fallback-p-2',
    slug: null,
    name: 'Notion CTU',
    logoUrl: '/partners/notion.png',
    logoAlt: 'Notion CTU',
    website: null,
    tier: 'community',
    description: '',
    order: 1,
    status: 'published',
  },
  {
    id: 'fallback-p-3',
    slug: null,
    name: 'ICpEP.SE',
    logoUrl: '/partners/icpep.png',
    logoAlt: 'ICpEP.SE',
    website: null,
    tier: 'community',
    description: '',
    order: 2,
    status: 'published',
  },
];

export const FALLBACK_TEAM_MEMBERS = [
  // ── EXECUTIVE ──────────────────────────────────────────────────────────
  {
    id: 'fallback-tm-1',
    slug: null,
    name: 'Michael Angelo A. Bejona',
    role: 'Chief Executive Officer',
    department: 'Executive',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: '/leads/michael.png',
    photoAlt: 'Michael Angelo A. Bejona',
    linkedin: null,
    github: null,
    website: null,
    featured: true,
    order: 1,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-2',
    slug: null,
    name: 'Tyrone Tabornal',
    role: 'Chief Operations Officer',
    department: 'Executive',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: '/leads/tyrone.png',
    photoAlt: 'Tyrone Tabornal',
    linkedin: null,
    github: null,
    website: null,
    featured: true,
    order: 2,
    status: 'published',
    updatedAt: null,
  },
  // ── OPERATIONS ─────────────────────────────────────────────────────────
  {
    id: 'fallback-tm-3',
    slug: null,
    name: 'Emmannuel D. Ugalde',
    role: 'Project Management Officer',
    department: 'Operations',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Emman D. Ugalde',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 3,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-4',
    slug: null,
    name: 'Lucy Jean T. Bansag',
    role: 'Events & Logistics Officer',
    department: 'Operations',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Lucy Jean T. Bansag',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 4,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-5',
    slug: null,
    name: 'Hariemar R. Rosell',
    role: 'Events & Logistics Officer',
    department: 'Operations',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Hariemar R. Rosell',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 5,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-6',
    slug: null,
    name: 'Juanah Andrea P. Aunzo',
    role: 'Events & Logistics Officer',
    department: 'Operations',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Juanah Andrea P. Aunzo',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 6,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-7',
    slug: null,
    name: 'Elaiza Kate T. Dacuba',
    role: 'Executive Secretary',
    department: 'Operations',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Elaiza Kate T. Dacuba',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 7,
    status: 'published',
    updatedAt: null,
  },
  // ── TECHNOLOGY ─────────────────────────────────────────────────────────
  {
    id: 'fallback-tm-8',
    slug: null,
    name: 'Josephus Kim L. Sarsonas',
    role: 'Chief Technology Officer',
    department: 'Technology',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: '/leads/josephus.png',
    photoAlt: 'Josephus Kim L. Sarsonas',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 8,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-9',
    slug: null,
    name: 'Mitch Andrie C. Amores',
    role: 'Web Development Officer',
    department: 'Technology',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Mitch Andrie C. Amores',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 9,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-10',
    slug: null,
    name: 'James D. Simblante',
    role: 'Web Development Officer',
    department: 'Technology',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'James D. Simblante',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 10,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-11',
    slug: null,
    name: 'Chrisford John B. Galon',
    role: 'Web Development Officer',
    department: 'Technology',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Chrisford John B. Galon',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 11,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-12',
    slug: null,
    name: 'Jane Therese F. Quilapio',
    role: 'Web Development Officer',
    department: 'Technology',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Jane Therese F. Quilapio',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 12,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-13',
    slug: null,
    name: 'Virgilio Ragasajo Jr.',
    role: 'Web Development Officer',
    department: 'Technology',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Virgilio Ragasajo Jr.',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 13,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-14',
    slug: null,
    name: 'Jonrheym P. Remegia',
    role: 'AI/ML Technologies Officer',
    department: 'Technology',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Jonrheym P. Remegia',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 14,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-15',
    slug: null,
    name: 'John Joseph Abella',
    role: 'Embedded Systems Officer',
    department: 'Technology',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'John Joseph Abella',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 15,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-16',
    slug: null,
    name: 'Edrian Taraya',
    role: 'Cyber Security Officer',
    department: 'Technology',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Edrian Taraya',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 16,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-17',
    slug: null,
    name: 'Julian Gen D. Carticiano',
    role: 'Data Science Officer',
    department: 'Technology',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Julian Gen D. Carticiano',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 17,
    status: 'published',
    updatedAt: null,
  },
  // ── CREATIVES ──────────────────────────────────────────────────────────
  {
    id: 'fallback-tm-18',
    slug: null,
    name: 'Lc Q. Camposo',
    role: 'UI/UX & Product Design Officer',
    department: 'Creatives',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Lc Q. Camposo',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 18,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-19',
    slug: null,
    name: 'Baby Jane Genovia',
    role: 'UI/UX & Product Design Officer',
    department: 'Creatives',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Baby Jane Genovia',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 19,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-20',
    slug: null,
    name: 'Jalniene Shynne D. Vender',
    role: 'UI/UX & Product Design Officer',
    department: 'Creatives',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Jalniene Shynne D. Vender',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 20,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-21',
    slug: null,
    name: 'Arien S. Destriza',
    role: 'UI/UX & Product Design Officer',
    department: 'Creatives',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Arien S. Destriza',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 21,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-22',
    slug: null,
    name: 'Angela Adlawan',
    role: 'UI/UX & Product Design Officer',
    department: 'Creatives',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Angela Adlawan',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 22,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-23',
    slug: null,
    name: 'Ryan Andrie P. Coretico',
    role: 'Game Development Officer',
    department: 'Creatives',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Ryan Andrie P. Coretico',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 23,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-24',
    slug: null,
    name: 'Sean Michael G. Ceniza',
    role: 'Game Development Officer',
    department: 'Creatives',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Sean Michael G. Ceniza',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 24,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-25',
    slug: null,
    name: 'Kent Juliory D. Antique',
    role: 'Game Development Officer',
    department: 'Creatives',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Kent Juliory D. Antique',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 25,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-26',
    slug: null,
    name: 'George David R. Tejada',
    role: 'Game Development Officer',
    department: 'Creatives',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'George David R. Tejada',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 26,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-27',
    slug: null,
    name: 'Oddyssy A. Subingsubing',
    role: 'Chief Creatives Officer (CCO)',
    department: 'Creatives',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: '/leads/odc.png',
    photoAlt: 'Oddyssy A. Subingsubing',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 27,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-28',
    slug: null,
    name: 'Russel Benedict F. Alforque',
    role: 'Graphics & Branding Officer',
    department: 'Creatives',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Russel Benedict F. Alforque',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 28,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-29',
    slug: null,
    name: 'Gian Michael C. Bico',
    role: 'Graphics & Branding Officer',
    department: 'Creatives',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Gian Michael C. Bico',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 29,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-30',
    slug: null,
    name: 'Rhea Bianca G. Ricaborda',
    role: 'Graphics & Branding Officer',
    department: 'Creatives',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Rhea Bianca G. Ricaborda',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 30,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-31',
    slug: null,
    name: 'Francis Luke G. Vicoy',
    role: 'Graphics & Branding Officer',
    department: 'Creatives',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Francis Luke G. Vicoy',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 31,
    status: 'published',
    updatedAt: null,
  },
  // ── COMMUNITY DEVELOPMENT ──────────────────────────────────────────────
  {
    id: 'fallback-tm-32',
    slug: null,
    name: 'John Erick C. Sebuco',
    role: 'Chief Community Development Officer (CCDO)',
    department: 'Community Development',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'John Erick C. Sebuco',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 32,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-33',
    slug: null,
    name: 'Lyza S. Fernandez',
    role: 'Public Relations Officer',
    department: 'Community Development',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Lyza S. Fernandez',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 33,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-34',
    slug: null,
    name: 'God Prey F. Torres',
    role: 'External Relations & Partnerships Officer',
    department: 'Community Development',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'God Prey F. Torres',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 34,
    status: 'published',
    updatedAt: null,
  },
  // ── FINANCE ────────────────────────────────────────────────────────────
  {
    id: 'fallback-tm-35',
    slug: null,
    name: 'Jian Kris D. Laborte',
    role: 'Chief Finance Officer (CFO)',
    department: 'Finance',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: '/leads/jian.png',
    photoAlt: 'Jian Kris D. Laborte',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 35,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-36',
    slug: null,
    name: 'Kim Z. Navaja',
    role: 'Finance Officer',
    department: 'Finance',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'Kim Z. Navaja',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 36,
    status: 'published',
    updatedAt: null,
  },
  {
    id: 'fallback-tm-37',
    slug: null,
    name: 'RJ R. Mangyao',
    role: 'Budget & Audit Officer',
    department: 'Finance',
    program: null,
    yearSection: null,
    bio: null,
    photoUrl: null,
    photoAlt: 'RJ R. Mangyao',
    linkedin: null,
    github: null,
    website: null,
    featured: false,
    order: 37,
    status: 'published',
    updatedAt: null,
  },
];

export const publicApi = {
  getTeam: (params) => getMany(`/public/team${qs(params)}`),
  getTeamBySlug: (slug) => getOne(`/public/team/slug/${encodeURIComponent(slug)}`),
  getTerms: () => getTermsList(),
  getEvents: (scope = 'upcoming') => {
    const safeScope = PUBLIC_EVENT_SCOPES.has(scope) ? scope : 'upcoming';
    return getMany(`/public/events${qs({ scope: safeScope })}`);
  },
  getEventBySlug: (slug) => getOne(`/public/events/slug/${encodeURIComponent(slug)}`),
  getPartners: () => getMany('/public/partners'),
  getAlbums: (params) => {
    // Accepts a category slug string or a params object — either way the
    // filter runs server-side (?category=).
    const query = typeof params === 'string' ? (params ? { category: params } : {}) : (params ?? {});
    return getMany(`/public/gallery/albums${qs(query)}`);
  },
  getAlbumBySlug: (slug) => getOne(`/public/gallery/albums/slug/${encodeURIComponent(slug)}`),
  getGalleryCategories: () => getGalleryCategoriesList(),
  getFeaturedPhotos: () => getMany('/public/gallery/featured'),
  getHealth: () => apiFetch('/health'),
  /**
   * Public contact form (POST /public/contact-messages → 201).
   * Write-only: errors propagate to the caller (no 404 tolerance —
   * a missing route is a real failure the form must surface).
   */
  submitContact: (body) =>
    apiFetch('/public/contact-messages', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

/* ---------- defensive field mapping (camelCase + snake_case) ---------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(\?.*)?$/i;

/**
 * Sanitize a value before it reaches an <img src>.
 * Allows http(s)/protocol-relative URLs, data:/blob: image URIs, and
 * path-like values; rejects bare tokens such as media UUIDs (mediaId/publicId)
 * so a UUID is never rendered as an image source.
 */
export function safeSrc(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || UUID_RE.test(v)) return null;
  if (v.startsWith('data:image/') || v.startsWith('blob:')) return v;
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('//')) return v;
  if (v.startsWith('/') || IMAGE_EXT_RE.test(v)) return v;
  return null;
}

/** First usable image URL across camelCase/snake_case variants (UUID-safe). */
export function pickImage(item) {
  if (!item || typeof item !== 'object') return null;
  const media = item.media && typeof item.media === 'object' ? item.media : null;
  const candidates = [
    item.secure_url,
    item.secureUrl,
    item.url,
    item.imageUrl,
    item.image_url,
    item.coverUrl,
    item.cover_url,
    item.logoUrl,
    item.logo_url,
    item.photoUrl,
    item.photo_url,
    item.profileUrl,
    item.profile_url,
    item.image,
    item.cover,
    item.logo,
    item.photo,
    media?.secure_url,
    media?.secureUrl,
    media?.url,
  ];
  for (const candidate of candidates) {
    const src = safeSrc(candidate);
    if (src) return src;
  }
  return null;
}

export function mapMember(m = {}) {
  const first = m.firstName ?? m.first_name ?? '';
  const last = m.lastName ?? m.last_name ?? '';
  return {
    id: getId(m),
    slug: m.slug ?? null,
    name: m.name ?? (`${first} ${last}`.trim() || 'Unnamed member'),
    role: m.role ?? m.roleTitle ?? m.role_title ?? '',
    department: m.department ?? null,
    program: m.program ?? null,
    yearSection: m.yearSection ?? m.year_section ?? null,
    bio: m.bio ?? null,
    photoUrl: pickImage(m),
    photoAlt: m.profileAlt ?? m.profile_alt ?? m.alt_text ?? m.altText ?? m.name ?? 'Team member photo',
    linkedin: m.linkedin_url ?? m.linkedinUrl ?? null,
    github: m.github_url ?? m.githubUrl ?? null,
    website: m.website_url ?? m.websiteUrl ?? null,
    featured: !!(m.isFeatured ?? m.is_featured),
    order: m.display_order ?? m.displayOrder ?? m.order ?? 0,
    status: getStatus(m),
    updatedAt: getUpdatedAt(m),
  };
}

export function mapEvent(e = {}) {
  return {
    id: getId(e),
    slug: e.slug ?? null,
    title: e.title ?? '(Untitled event)',
    short: e.short_description ?? e.shortDescription ?? '',
    description: e.description ?? '',
    coverUrl: pickImage(e),
    coverAlt: e.coverAlt ?? e.cover_alt ?? e.alt_text ?? e.title ?? 'Event cover',
    location: e.location ?? null,
    locationEmbedUrl: e.locationEmbedUrl ?? e.location_embed_url ?? null,
    externalUrl: e.externalUrl ?? e.external_url ?? null,
    timezone: e.timezone ?? null,
    category: e.category ?? null,
    startAt: e.startAt ?? e.start_at ?? null,
    endAt: e.endAt ?? e.end_at ?? null,
    status: getStatus(e),
    order: e.display_order ?? e.displayOrder ?? e.order ?? 0,
    updatedAt: getUpdatedAt(e),
  };
}

export function mapPartner(p = {}) {
  return {
    id: getId(p),
    slug: p.slug ?? null,
    name: p.name ?? 'Unnamed partner',
    logoUrl: pickImage(p),
    logoAlt: p.logoAlt ?? p.logo_alt ?? p.alt_text ?? p.name ?? 'Partner logo',
    website: p.websiteUrl ?? p.website_url ?? null,
    tier: String(p.tier ?? 'community').toLowerCase(),
    description: p.description ?? '',
    order: p.display_order ?? p.displayOrder ?? p.order ?? 0,
    status: getStatus(p),
  };
}

export function mapAlbum(a = {}) {
  const rawItems = a.items ?? a.photos ?? a.album_items ?? a.media ?? [];
  const category = a.category && typeof a.category === 'object' && !Array.isArray(a.category)
    ? {
      id: a.category.id ?? null,
      slug: a.category.slug ?? null,
      name: a.category.name ?? null,
    }
    : null;
  return {
    id: getId(a),
    slug: a.slug ?? null,
    title: a.title ?? a.name ?? '(Untitled album)',
    coverUrl: pickImage(a),
    coverAlt: a.coverAlt ?? a.cover_alt ?? a.alt_text ?? a.title ?? a.name ?? 'Album cover',
    eventId: a.eventId ?? a.event_id ?? null,
    date: a.date ?? null,
    description: a.description ?? '',
    category,
    categorySlug: category?.slug ?? a.categorySlug ?? a.category_slug ?? null,
    categoryName: category?.name ?? a.categoryName ?? a.category_name ?? null,
    featured: !!(a.isFeatured ?? a.is_featured),
    photoCount: a.photo_count ?? a.photoCount ?? (Array.isArray(rawItems) ? rawItems.length : 0),
    items: Array.isArray(rawItems) ? rawItems.map(mapPhoto).sort((x, y) => x.order - y.order) : [],
    status: getStatus(a),
  };
}

export function mapPhoto(it = {}) {
  const media = it.media && typeof it.media === 'object' ? it.media : it;
  const url = pickImage(it) ?? pickImage(media);
  const order = it.order ?? it.display_order ?? it.displayOrder ?? 0;
  const category = it.category && typeof it.category === 'object' && !Array.isArray(it.category)
    ? {
      id: it.category.id ?? null,
      slug: it.category.slug ?? null,
      name: it.category.name ?? null,
    }
    : null;
  return {
    id:
      getId(it) ??
      it.media_id ??
      it.mediaId ??
      media.id ??
      media.public_id ??
      media.publicId ??
      (url ? `${url}#${order}` : `photo-${order}`),
    url,
    alt:
      it.alt ??
      it.alt_text ??
      it.altText ??
      media.alt ??
      media.alt_text ??
      media.altText ??
      it.caption ??
      'Gallery photo',
    caption: it.caption ?? '',
    order,
    category,
    categorySlug: category?.slug ?? it.categorySlug ?? it.category_slug ?? null,
    featured: !!(it.isFeatured ?? it.is_featured),
  };
}

export function mapTerm(t = {}) {
  const name = t.name ?? '';
  return {
    id: getId(t) ?? (name || null),
    name,
    label: name ? `S.Y. ${name}` : 'School year',
    isCurrent: !!(t.isCurrent ?? t.is_current),
  };
}

export function mapGalleryCategory(c = {}) {
  return {
    id: getId(c) ?? c.slug ?? null,
    slug: c.slug ?? null,
    name: c.name ?? 'Unnamed category',
    order: c.displayOrder ?? c.display_order ?? c.order ?? 0,
  };
}

/**
 * Static fallback for moments/gallery albums on the home page — shown
 * when the content service is unavailable. Pre-shaped to match mapAlbum()
 * output, sliced to 3 entries to match the MomentsStrip limit.
 */
export const FALLBACK_MOMENTS_ALBUMS = [
  {
    id: 'fallback-ma-1',
    slug: null,
    title: 'Community Workshop',
    coverUrl: null,
    coverAlt: 'Community workshop moment',
    category: null,
    categorySlug: null,
    categoryName: null,
    date: null,
    description: '',
    eventId: null,
    photoCount: 0,
    items: [],
    featured: false,
    order: 0,
    status: 'published',
  },
  {
    id: 'fallback-ma-2',
    slug: null,
    title: 'Tech Talk Session',
    coverUrl: null,
    coverAlt: 'Tech talk session moment',
    category: null,
    categorySlug: null,
    categoryName: null,
    date: null,
    description: '',
    eventId: null,
    photoCount: 0,
    items: [],
    featured: false,
    order: 1,
    status: 'published',
  },
  {
    id: 'fallback-ma-3',
    slug: null,
    title: 'Hackathon',
    coverUrl: null,
    coverAlt: 'Hackathon moment',
    category: null,
    categorySlug: null,
    categoryName: null,
    date: null,
    description: '',
    eventId: null,
    photoCount: 0,
    items: [],
    featured: false,
    order: 2,
    status: 'published',
  },
];

export const TIER_ORDER = { platinum: 0, gold: 1, silver: 2, community: 3 };

export function sortPartners(list) {
  return [...list]
    .map(mapPartner)
    .sort((a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9) || a.order - b.order);
}

/** Shared public-feed state machine — delegates to the generic useFeed (see api/feed.js). */
export function usePublicFeed(loader, depsKey = '') {
  const { data, loading, error, requestId, retry } = useFeed(loader, { depsKey, initialData: null });
  return { data, loading, error, requestId, retry };
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
