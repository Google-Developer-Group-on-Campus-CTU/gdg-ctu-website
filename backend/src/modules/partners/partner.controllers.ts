import { Request, Response } from "express";
import {
      AppError,
      getPagination,
      getStringParam,
      handleControllerError,
      validateBody,
      validateUuid,
} from "../../utils/http.js";
import {
      createPartnerService,
      deletePartnerService,
      getPartnerByIdService,
      getPartnerBySlugService,
      getPartnersService,
      updatePartnerService,
} from "./partner.services.js";
import {
      UpdatePartnerDTO,
      CreatePartnerSchema,
      UpdatePartnerSchema,
} from "./partner.validations.js";
import { getUserIdFromRequest } from "../auth/auth.utils.js";
import { parseJsonField } from "../../utils/multiPartPayloadHelper.js";

/**
 * Create a new partner.
 * • Requires a valid admin (user) ID.
 * • Accepts (a) multipart payload with `partner` JSON or (b) flat JSON body.
 * • The logo image file is optional: when provided it is uploaded via
 *   Cloudinary and linked via `logoMediaId`; otherwise the `logoMediaId`
 *   from the body (MediaPicker-selected media) is used.
 */
export const createPartner = async (req: Request, res: Response) => {
      try {
            // 1. HTTP/Auth Extraction
            const userId = getUserIdFromRequest(req);
            if (!userId) {
                  throw new AppError(401, "Unauthorized: Missing userId");
            }

            // 2. Payload Presence Validations (file is optional)
            const file = (req as any).file?.buffer as Buffer | undefined;

            const hasPartnerWrapper =
                  req.body?.partner !== undefined &&
                  req.body.partner !== null &&
                  req.body.partner !== "";
            let rawPartnerData: Record<string, unknown>;
            if (hasPartnerWrapper) {
                  rawPartnerData =
                        typeof req.body.partner === "string"
                              ? parseJsonField(req.body.partner, "partner")
                              : {
                                      ...(req.body.partner as Record<
                                            string,
                                            unknown
                                      >),
                                };
            } else {
                  rawPartnerData = { ...req.body };
                  delete rawPartnerData.file;
            }

            // 3. Shape/Type Validation
            const validData = validateBody(
                  CreatePartnerSchema,
                  rawPartnerData,
            );

            // 4. Pass to Service Layer
            const partner = await createPartnerService(
                  validData,
                  userId,
                  file,
            );

            // 5. HTTP Response
            return res.status(201).json({
                  success: true,
                  message: "Partner created successfully",
                  partner,
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to create partner",
            );
      }
};

export const listPartners = async (req: Request, res: Response) => {
      try {
            const userId = getUserIdFromRequest(req);
            if (!userId) {
                  throw new AppError(401, "Unauthorized: Missing userId");
            }

            const paginationQuery = getPagination(req.query);
            const { partners, pagination } =
                  await getPartnersService(paginationQuery);
            return res
                  .status(200)
                  .json({ success: true, partners, pagination });
      } catch (error) {
            return handleControllerError(res, error, "Failed to list partners");
      }
};

export const getPartner = async (req: Request, res: Response) => {
      try {
            const userId = getUserIdFromRequest(req);
            if (!userId) {
                  throw new AppError(401, "Unauthorized: Missing userId");
            }

            const id = validateUuid(req.params.id);
            const partner = await getPartnerByIdService(id);
            return res.status(200).json({ success: true, partner });
      } catch (error) {
            return handleControllerError(res, error, "Failed to get partner");
      }
};

export const getPartnerBySlug = async (req: Request, res: Response) => {
      try {
            const slug = getStringParam(req.params.slug, "slug");
            const partner = await getPartnerBySlugService(slug);
            return res.status(200).json({ success: true, partner });
      } catch (error) {
            return handleControllerError(res, error, "Failed to get partner");
      }
};

/**
 * Update an existing partner.
 * • Requires a valid admin (user) ID.
 * • Accepts a multipart request with an optional new logo image file.
 * • If a new file is provided, the old logo media is removed (via service cleanup) and the
 *   new image is uploaded to Cloudinary, updating `logoMediaId`.
 * • If no image is supplied, only the non‑media fields are updated.
 */
export const updatePartner = async (req: Request, res: Response) => {
      try {
            const userId = getUserIdFromRequest(req);
            if (!userId) {
                  return res.status(401).json({
                        success: false,
                        message: "Unable to determine uploader (user ID)",
                  });
            }

            const partnerId = validateUuid(req.params.id);

            // ----- optional JSON payload -----
            const partnerJson = req.body.partner;
            let data: UpdatePartnerDTO;
            if (partnerJson) {
                  data = validateBody(
                        UpdatePartnerSchema,
                        parseJsonField(partnerJson, "partner"),
                  );
            } else {
                  // No JSON payload (file-only logo swap) — parse an empty
                  // partial through Zod instead of casting; the non-empty
                  // refine lives only on UpdatePartnerSchema.
                  data = CreatePartnerSchema.partial().parse({});
            }

            // optional new logo image
            const file = (req as any).file?.buffer;

            const partner = await updatePartnerService(
                  partnerId,
                  data,
                  userId,
                  file,
            );

            return res.status(200).json({
                  success: true,
                  message: "Partner updated successfully",
                  partner,
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to update partner",
            );
      }
};

export const removePartner = async (req: Request, res: Response) => {
      try {
            const userId = getUserIdFromRequest(req);
            if (!userId) {
                  throw new AppError(401, "Unauthorized: Missing userId");
            }

            const id = validateUuid(req.params.id);
            await deletePartnerService(id);
            return res.status(200).json({
                  success: true,
                  message: "Partner deleted successfully",
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to delete partner",
            );
      }
};
