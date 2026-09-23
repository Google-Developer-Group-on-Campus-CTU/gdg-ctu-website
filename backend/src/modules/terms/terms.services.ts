import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import {
      insertTerm,
      getTerms,
      countTerms,
      getTermById,
      getTermByName,
      updateTerm,
      deleteTerm,
} from "./models/terms.queries.js";
import { CreateTermDTO, UpdateTermDTO, Term } from "./terms.validations.js";
import {
      getCache,
      setCache,
      clearCacheByPrefix,
      deleteCache,
} from "../../config/redis/redis.services.js";

// Constant value for cache timeout
const DEFAULT_CACHE_TIME_TO_LIVE = 60000;

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

      await clearCacheByPrefix("terms");
      return insertTerm(data);
};

export const getTermsService = async (pagination: Pagination) => {
      const cacheKey = `terms:${pagination.page}:${pagination.limit}`;

      // Check Cache
      const cachedTerms = await getCache<{
            terms: Term[];
            pagination: ReturnType<typeof getPaginationMeta>;
      }>(cacheKey);

      if (cachedTerms) return cachedTerms;

      // Cache Miss
      const [terms, total] = await Promise.all([
            getTerms(pagination),
            countTerms(),
      ]);

      const res = {
            terms,
            pagination: getPaginationMeta(pagination, total),
      };

      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);
      return res;
};

export const getTermByIdService = async (id: string) => {
      const cacheKey = `terms:${id}`;
      const cached = await getCache<Term>(cacheKey);
      if (cached) return cached;

      const term = await getTermById(id);
      if (!term) {
            throw new AppError(404, "Term not found");
      }

      const res = toTermResponse(term);

      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);
      return res;
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

      await deleteCache(`terms:${id}`);
      await clearCacheByPrefix("terms:");
      return updateTerm(id, { ...data, updatedAt: new Date() });
};

export const deleteTermService = async (id: string) => {
      const term = await getTermById(id);
      if (!term) {
            throw new AppError(404, "Term not found");
      }

      await deleteCache(`terms:${id}`);
      await clearCacheByPrefix("terms:");
      await deleteTerm(id);
};
