import express, { Router } from "express";
import { requireAuth } from "./requireAuth.js";

/**
 * Creates a router with auth applied to all routes registered on it.
 * Use this at the feature level when some routes in a module are public
 * and others need protection.
 */
export function createProtectedRouter(): Router {
      const router = express.Router();
      router.use(requireAuth);
      return router;
}
