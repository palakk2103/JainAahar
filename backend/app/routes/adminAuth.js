import express from "express";
import {
    bootstrapAdmin,
    signupAdmin,
    loginAdmin,
} from "../controller/adminAuthController.js";
import {
    getAdminProfile,
    updateAdminProfile,
    updateAdminPassword,
    getAdminStats,
    getDeliveryPartners,
    approveDeliveryPartner,
    rejectDeliveryPartner,
    getActiveFleet,
    getAdminWalletData,
    getDeliveryTransactions,
    settleTransaction,
    bulkSettleDelivery,
    getActiveSellers,
    getPendingSellers,
    approveSellerApplication,
    rejectSellerApplication,
    getPendingWarehouses,
    getActiveWarehouses,
    approveWarehouseApplication,
    rejectWarehouseApplication,
    getSellerWithdrawals,
    getDeliveryWithdrawals,
    updateWithdrawalStatus,
    getSellerTransactions,
    getDeliveryCashBalances,
    getRiderCashDetails,
    settleRiderCash,
    getCashSettlementHistory,
    getUsers,
    getUserById,
    getSellers,
    getSellerLocations,
    getPlatformSettings,
    updatePlatformSettings
} from "../controller/adminController.js";
import {
    exportAdminFinanceStatementController,
    getAdminFinanceLedgerController,
    getAdminFinancePayoutsController,
    getAdminFinanceSummaryController,
    getDeliverySettingsController,
    processAdminFinancePayoutsController,
    updateDeliverySettingsController,
} from "../controller/adminFinanceController.js";
import {
    getSOSAlerts,
    acknowledgeSOSAlert,
    resolveSOSAlert,
} from "../controller/sosController.js";
import {
    getAllWarehouseQueuesHandler,
    getQueueSnapshotHandler,
    getQueueStatsHandler,
} from "../controller/warehouseCheckinController.js";
import {
    getUnassignedOrdersHandler,
    getEligibleWarehousesForOrderHandler,
    assignWarehouseToOrderHandler,
} from "../controller/warehouseAssignmentController.js";

import {
    adminGetReferral,
    adminGetReferralSettings,
    adminListReferralAudit,
    adminListReferrals,
    adminReevaluateReferral,
    adminUpdateReferralSettings,
} from "../controller/referralController.js";

import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
    adminBootstrapRateLimiter,
    authRouteRateLimiter,
    createContentLengthGuard,
} from "../middleware/securityMiddlewares.js";

const router = express.Router();

const smallAdminPayload = createContentLengthGuard(
    parseInt(process.env.ADMIN_AUTH_MAX_PAYLOAD_BYTES || "20480", 10),
    "Admin auth payload too large",
);
router.post("/bootstrap", adminBootstrapRateLimiter, smallAdminPayload, bootstrapAdmin);
router.post("/signup", adminBootstrapRateLimiter, smallAdminPayload, signupAdmin);
router.post("/login", authRouteRateLimiter, smallAdminPayload, loginAdmin);

// Profile routes
router.get(
    "/profile",
    verifyToken,
    allowRoles("admin"),
    getAdminProfile
);

router.put(
    "/profile",
    verifyToken,
    allowRoles("admin"),
    updateAdminProfile
);

router.put(
    "/profile/password",
    verifyToken,
    allowRoles("admin"),
    updateAdminPassword
);

router.get(
    "/stats",
    verifyToken,
    allowRoles("admin"),
    getAdminStats
);
router.get(
    "/finance/summary",
    verifyToken,
    allowRoles("admin"),
    getAdminFinanceSummaryController,
);
router.get(
    "/finance/ledger",
    verifyToken,
    allowRoles("admin"),
    getAdminFinanceLedgerController,
);
router.get(
    "/finance/payouts",
    verifyToken,
    allowRoles("admin"),
    getAdminFinancePayoutsController,
);
router.post(
    "/finance/payouts/process",
    verifyToken,
    allowRoles("admin"),
    processAdminFinancePayoutsController,
);
router.get(
    "/finance/export-statement",
    verifyToken,
    allowRoles("admin"),
    exportAdminFinanceStatementController,
);
router.get(
    "/settings/platform",
    verifyToken,
    allowRoles("admin"),
    getPlatformSettings
);
router.get(
    "/settings/delivery",
    verifyToken,
    allowRoles("admin"),
    getDeliverySettingsController,
);
router.put(
    "/settings/delivery",
    verifyToken,
    allowRoles("admin"),
    updateDeliverySettingsController,
);
router.put(
    "/settings/platform",
    verifyToken,
    allowRoles("admin"),
    updatePlatformSettings
);
router.get("/users", verifyToken, allowRoles("admin"), getUsers);
router.get("/users/:id", verifyToken, allowRoles("admin"), getUserById);
router.get("/sellers", verifyToken, allowRoles("admin"), getSellers);
router.get("/sellers/locations", verifyToken, allowRoles("admin"), getSellerLocations);
router.get("/sellers/active", verifyToken, allowRoles("admin"), getActiveSellers);
router.get(
    "/sellers/pending",
    verifyToken,
    allowRoles("admin"),
    getPendingSellers
);
router.patch(
    "/sellers/approve/:id",
    verifyToken,
    allowRoles("admin"),
    approveSellerApplication
);
router.delete(
    "/sellers/reject/:id",
    verifyToken,
    allowRoles("admin"),
    rejectSellerApplication
);

// =======================
// WAREHOUSE MANAGEMENT
// =======================
router.get(
    "/warehouses/active",
    verifyToken,
    allowRoles("admin"),
    getActiveWarehouses
);
router.get(
    "/warehouses/pending",
    verifyToken,
    allowRoles("admin"),
    getPendingWarehouses
);
router.patch(
    "/warehouses/approve/:id",
    verifyToken,
    allowRoles("admin"),
    approveWarehouseApplication
);
router.delete(
    "/warehouses/reject/:id",
    verifyToken,
    allowRoles("admin"),
    rejectWarehouseApplication
);

router.get(
    "/delivery-partners",
    verifyToken,
    allowRoles("admin"),
    getDeliveryPartners
);

router.patch(
    "/delivery-partners/approve/:id",
    verifyToken,
    allowRoles("admin"),
    approveDeliveryPartner
);

router.delete(
    "/delivery-partners/reject/:id",
    verifyToken,
    allowRoles("admin"),
    rejectDeliveryPartner
);

router.get("/active-fleet", verifyToken, allowRoles("admin"), getActiveFleet);
router.get("/wallet-data", verifyToken, allowRoles("admin"), getAdminWalletData);

// Delivery Payouts / Funds
router.get("/delivery-transactions", verifyToken, allowRoles('admin'), getDeliveryTransactions);
router.put("/transactions/:id/settle", verifyToken, allowRoles("admin"), settleTransaction);
router.put("/transactions/bulk-settle-delivery", verifyToken, allowRoles("admin"), bulkSettleDelivery);

// Cash Collection Hub
router.get("/delivery-cash", verifyToken, allowRoles("admin"), getDeliveryCashBalances);
router.get("/rider-cash-details/:id", verifyToken, allowRoles("admin"), getRiderCashDetails);
router.post("/settle-cash", verifyToken, allowRoles("admin"), settleRiderCash);
router.get("/cash-history", verifyToken, allowRoles("admin"), getCashSettlementHistory);

// Seller Withdrawal Management
router.get("/seller-withdrawals", verifyToken, allowRoles("admin"), getSellerWithdrawals);
router.get("/delivery-withdrawals", verifyToken, allowRoles("admin"), getDeliveryWithdrawals);
router.get("/seller-transactions", verifyToken, allowRoles("admin"), getSellerTransactions);
router.put("/withdrawals/:id", verifyToken, allowRoles("admin"), updateWithdrawalStatus);

// =======================
// SOS ALERTS
// =======================
router.get("/sos-alerts", verifyToken, allowRoles("admin"), getSOSAlerts);
router.put("/sos-alerts/:id/acknowledge", verifyToken, allowRoles("admin"), acknowledgeSOSAlert);
router.put("/sos-alerts/:id/resolve", verifyToken, allowRoles("admin"), resolveSOSAlert);

// Protected admin route example
router.get(
    "/dashboard",
    verifyToken,
    allowRoles("admin"),
    (req, res) => {
        res.json({
            success: true,
            message: "Welcome to Admin Dashboard",
        });
    }
);

// Warehouse Queue Monitoring (Admin)
router.get("/warehouse-queue/all", verifyToken, allowRoles("admin"), getAllWarehouseQueuesHandler);
router.get("/warehouse-queue/:warehouseId", verifyToken, allowRoles("admin"), getQueueSnapshotHandler);
router.get("/warehouse-queue/:warehouseId/stats", verifyToken, allowRoles("admin"), getQueueStatsHandler);

// Warehouse Order Assignment (Admin)
router.get("/orders/unassigned", verifyToken, allowRoles("admin"), getUnassignedOrdersHandler);
router.get("/orders/:orderId/warehouse-eligibility", verifyToken, allowRoles("admin"), getEligibleWarehousesForOrderHandler);
router.post("/orders/:orderId/assign-warehouse", verifyToken, allowRoles("admin"), assignWarehouseToOrderHandler);

// Refer & Earn (Admin)
router.get("/referrals/settings", verifyToken, allowRoles("admin"), adminGetReferralSettings);
router.put("/referrals/settings", verifyToken, allowRoles("admin"), adminUpdateReferralSettings);
router.get("/referrals/audit", verifyToken, allowRoles("admin"), adminListReferralAudit);
router.get("/referrals", verifyToken, allowRoles("admin"), adminListReferrals);
router.get("/referrals/:id", verifyToken, allowRoles("admin"), adminGetReferral);
router.post("/referrals/:id/reevaluate", verifyToken, allowRoles("admin"), adminReevaluateReferral);

export default router;


// Disabled/placeholder routes removed
