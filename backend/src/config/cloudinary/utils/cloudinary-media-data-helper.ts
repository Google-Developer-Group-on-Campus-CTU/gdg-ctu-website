import { NewMediaRecord } from "../../../modules/media/models/media.queries.js";

export const createMediaRecord = (
      uploadResult: any,
      uploadedBy: string,
): NewMediaRecord => {
      return {
            cloudinaryAssetId: uploadResult.asset_id,
            publicId: uploadResult.public_id,
            secureUrl: uploadResult.secure_url,
            resourceType: uploadResult.resource_type,
            format: uploadResult.format,
            width: uploadResult.width,
            height: uploadResult.height,
            bytes: uploadResult.bytes,
            originalFilename: uploadResult.original_filename,
            uploadedBy: uploadedBy,
      } as NewMediaRecord;
};
