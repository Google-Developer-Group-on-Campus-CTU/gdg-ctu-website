import { AppError } from "../../utils/http.js";
import { getAdminByIdService } from "../admins/admin.services.js";

export const assertAdminExists = async (adminId: string) => {
      if (!(await getAdminByIdService(adminId))) {
            throw new AppError(
                  404,
                  "Admin user not found. You must be a registered admin to perform actions",
            );
      }
};
