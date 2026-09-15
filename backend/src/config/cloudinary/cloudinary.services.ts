import { UploadApiOptions, UploadApiResponse } from "cloudinary";
import cloudinary, { isCloudinaryEnabled } from "./cloudinary.config";
import { AppError } from "../../utils/http";

export interface UploadMediaOptions {
      folder: string;
      publicId?: string;
      resourceType?: "image" | "video" | "raw" | "auto";
}

// Cloudinary Upload Media Function Service
export async function uploadMedia(
      buffer: Buffer,
      options: UploadMediaOptions,
): Promise<UploadApiResponse> {
      if (!isCloudinaryEnabled()) {
            throw new AppError(
                  503,
                  "Media service unavailable: Cloudinary is not configured",
            );
      }
      return new Promise((resolve, reject) => {
            const uploadOptions: UploadApiOptions = {
                  folder: "GDGoC", // CHANGES THIS FOLDER BASE ON YOUR CLOUDINARY PREFERENCES
                  public_id: options.publicId,
                  resource_type: options.resourceType ?? "auto",
            };

            const uploadStream = cloudinary.uploader.upload_stream(
                  uploadOptions,
                  (error, result) => {
                        if (error) {
                              reject(error);
                              return new AppError(500, "An Error has Occured");
                        }

                        if (!result) {
                              reject(
                                    new AppError(
                                          404,
                                          "Cloudinary upload returned no result",
                                    ),
                              );
                              return;
                        }

                        resolve(result);
                  },
            );

            uploadStream.end(buffer);
      });
}

// Cloudinary Delete Media Function Service
export async function deleteMediaCloudinaryService(
      publicId: string,
      resourceType: "image" | "video" | "raw" = "image",
) {
      if (!isCloudinaryEnabled()) {
            throw new AppError(
                  503,
                  "Media service unavailable: Cloudinary is not configured",
            );
      }
      return cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
      });
}
