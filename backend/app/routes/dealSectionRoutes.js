import express from "express";
import {
  getPublicDealSections,
  getAdminDealSections,
  getAdminDealSectionByKey,
  updateDealSection,
} from "../controller/dealSectionController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public endpoint for customer app
router.get("/deals/sections", getPublicDealSections);

// Admin endpoints
router.get(
  "/admin/deals/sections",
  verifyToken,
  allowRoles("admin"),
  getAdminDealSections
);

router.get(
  "/admin/deals/sections/:key",
  verifyToken,
  allowRoles("admin"),
  getAdminDealSectionByKey
);

router.put(
  "/admin/deals/sections/:key",
  verifyToken,
  allowRoles("admin"),
  updateDealSection
);

export default router;
