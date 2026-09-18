import { Request, Response } from "express";
import {
      AppError,
      getPagination,
      getStringParam,
      handleControllerError,
      validateBody,
      validateUuid,
} from "../../utils/http";
import {
      createPartnerService,
      deletePartnerService,
      getPartnerByIdService,
      getPartnerBySlugService,
      getPartnersService,
      updatePartnerService,
} from "./partner.services";
import {
      CreatePartnerDTO,
      UpdatePartnerDTO,
      CreatePartnerSchema,
      UpdatePartnerSchema,
} from "./partner.validations";
import { getClerkIdFromRequest } from "../auth/auth.utils";

/**
 * Create a new partner.
 * • Requires a valid admin (Clerk) ID.
 * • Expects multipart payload with `partner` JSON and a required logo image file.
 * • The logo image is mandatory; missing image results in a 400 error.
 * • Image is uploaded via Cloudinary and linked via `logoMediaId`.
 */
export const createPartner = async (req: Request, res: Response) => {
      try {
            // 1. HTTP/Auth Extraction
            const clerkId = getClerkIdFromRequest(req);
            if (!clerkId) {
                  throw new AppError(401, "Unauthorized: Missing clerkId");
            }

            // 2. Payload Presence Validations
            const partnerJson = req.body.partner;
            if (!partnerJson) {
                  throw new AppError(400, "'partner' JSON payload missing");
            }

            const file = (req as any).file?.buffer;
            if (!file) {
                  throw new AppError(400, "Partner logo image is required");
            }

            // 3. Shape/Type Validation
            const partnerData: CreatePartnerDTO = JSON.parse(partnerJson);
            const validData = validateBody(CreatePartnerSchema, partnerData);

            // 4. Pass to Service Layer
            const partner = await createPartnerService(
                  validData,
                  clerkId,
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
            const clerkId = getClerkIdFromRequest(req);
            if (!clerkId) {
                  throw new AppError(401, "Unauthorized: Missing clerkId");
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
            const clerkId = getClerkIdFromRequest(req);
            if (!clerkId) {
                  throw new AppError(401, "Unauthorized: Missing clerkId");
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
 * • Requires a valid admin (Clerk) ID.
 * • Accepts a multipart request with an optional new logo image file.
 * • If a new file is provided, the old logo media is removed (via service cleanup) and the
 *   new image is uploaded to Cloudinary, updating `logoMediaId`.
 * • If no image is supplied, only the non‑media fields are updated.
 */
export const updatePartner = async (req: Request, res: Response) => {
      try {
            const clerkId = getClerkIdFromRequest(req);
            if (!clerkId) {
                  return res.status(401).json({
                        success: false,
                        message: "Unable to determine uploader (Clerk ID)",
                  });
            }

            const partnerId = validateUuid(req.params.id);
            if (!partnerId) {
                  throw new AppError(404, "Missing partner ID");
            }

            // ----- optional JSON payload -----
            const partnerJson = req.body.partner;
            let data: UpdatePartnerDTO;
            if (partnerJson) {
                  const partnerData: UpdatePartnerDTO = JSON.parse(partnerJson);
                  data = validateBody(UpdatePartnerSchema, partnerData);
            } else {
                  // No JSON payload – use empty object; schema is partial
                  data = {} as UpdatePartnerDTO;
            }

            // optional new logo image
            const file = (req as any).file?.buffer;

            const partner = await updatePartnerService(
                  partnerId,
                  data,
                  clerkId,
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
            const clerkId = getClerkIdFromRequest(req);
            if (!clerkId) {
                  throw new AppError(401, "Unauthorized: Missing clerkId");
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
