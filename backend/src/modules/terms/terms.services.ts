import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import { db } from "../../config/connectDB.js";
import { eq, ne } from "drizzle-orm";
import {
      insertTerm,
      getTerms,
      countTerms,
      getTermById,
      getTermByName,
      updateTerm,
      deleteTerm,
} from "./models/terms.queries.js";
import { terms } from "./models/terms.js";
import { CreateTermDTO, UpdateTermDTO, Term } from "./terms.validations.js";

// Validate Response
const toTermResponse = (term: Term) => term;

export const createTermService = async (data: CreateTermDTO) => {
      // Ensure startDate <= endDate
      if (data.endDate < data.startDate) {
            throw new AppError(400, "endDate cannot be before startDate");
      }

      // Guard against duplicate term name – enforce uniqueness
      const existingByName = await getTermByName(data.name);
      if (existingByName) {
            throw new AppError(409, "Term with this name already exists");
      }

      return insertTerm(data);
};

export const getTermsService = async (pagination: Pagination) => {
      const [terms, total] = await Promise.all([
            getTerms(pagination),
            countTerms(),
      ]);

      return {
            terms,
            pagination: getPaginationMeta(pagination, total),
      };
};

export const getTermByIdService = async (id: string) => {
      const term = await getTermById(id);
      if (!term) {
            throw new AppError(404, "Term not found");
      }

      return toTermResponse(term);
};

export const updateTermService = async (id: string, data: UpdateTermDTO) => {
      const existing = await getTermById(id);
      if (!existing) {
            throw new AppError(404, "Term not found");
      }

      // Guard against duplicate term name – enforce uniqueness only when name is supplied
      if (data.name) {
            const existingByName = await getTermByName(data.name);
            if (existingByName && existingByName.id !== id) {
                  throw new AppError(409, "Term with this name already exists");
            }
      }

      if (data.endDate && data.startDate && data.endDate < data.startDate) {
            throw new AppError(400, "endDate cannot be before startDate");
      }

      // Single-current invariant: promoting this term runs inside a
      // transaction that first unsets isCurrent on every OTHER term, so
      // two concurrent promotions cannot leave two current terms.
      if (data.isCurrent === true) {
            return db.transaction(async (tx) => {
                  await tx
                        .update(terms)
                        .set({ isCurrent: false, updatedAt: new Date() })
                        .where(ne(terms.id, id));
                  const [updated] = await tx
                        .update(terms)
                        .set({ ...data, updatedAt: new Date() })
                        .where(eq(terms.id, id))
                        .returning();
                  return updated;
            });
      }

      return updateTerm(id, { ...data, updatedAt: new Date() });
};

export const deleteTermService = async (id: string) => {
      const term = await getTermById(id);
      if (!term) {
            throw new AppError(404, "Term not found");
      }

      await deleteTerm(id);
};
