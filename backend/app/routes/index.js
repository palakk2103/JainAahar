import customerRoute from "./customerAuth.js";
import deliveryRoute from "./deliveryAuth.js";
import deliveryWebhookRoute from "./deliveryWebhookRoutes.js";
import adminRoute from "./adminAuth.js";
import sellerRoute from "./sellerAuth.js";
import warehouseRoute from "./warehouseAuth.js";
import warehouseInventoryRoute from "./warehouseInventoryRoutes.js";
import warehouseTransferRoute from "./warehouseTransferRoutes.js";
import warehouseFulfillmentRoute from "./warehouseFulfillmentRoutes.js";
import shiprocketPickupRoute from "./shiprocketPickupRoutes.js";
import categoryRoute from "./categoryRoutes.js";
import productRoute from "./productRoutes.js";
import cartRoute from "./cartRoutes.js";
import wishlistRoute from "./wishlistRoutes.js";
import orderRoute from "./orderRoutes.js";
import paymentRoute from "./paymentRoutes.js";
import notificationRoute from "./notificationRoutes.js";
import pushRoute from "./pushRoutes.js";
import ticketRoute from "./ticketRoutes.js";
import reviewRoute from "./reviewRoutes.js";
import faqRoute from "./faqRoutes.js";
import experienceRoute from "./experienceRoutes.js";
import offerRoute from "./offerRoutes.js";
import couponRoute from "./couponRoutes.js";
import settingsRoute from "./settingsRoutes.js";
import mapsRoute from "./mapsRoutes.js";
import mediaRoute from "./mediaRoutes.js";
import healthRoute from "./healthRoutes.js";
import metricsRoute from "./metricsRoutes.js";
import kitRoute from "./kitRoutes.js";
import authOtpRoute from "../modules/otp/otp.routes.js";
import employeeRoute from "./employeeRoutes.js";
import translationRoute from "./translationRoutes.js";
import whatsappRoute from "./whatsappRoutes.js";
import whatsappWebhookRoute from "./whatsappWebhookRoutes.js";
import dealSectionRoute from "./dealSectionRoutes.js";

import express from "express";

const setupRoutes = (app) => {
    const router = express.Router();

    // Health and metrics endpoints (no /api prefix for standard paths)
    app.use("/health", healthRoute);
    app.use("/metrics", metricsRoute);

    router.use("/admin/whatsapp", whatsappRoute);
    router.use("/customer/whatsapp", whatsappRoute);
    router.use("/webhooks", whatsappWebhookRoute);
    router.use("/customer", customerRoute);
    router.use("/delivery", deliveryRoute);
    router.use("/delivery", deliveryWebhookRoute);
    // categoryRoute is mounted twice on purpose:
    //   /admin/categories → admin category management (auth enforced inside the router)
    //   /categories       → public category browsing (read-only handlers)
    // Same router, two URL surfaces. Do not deduplicate without coordinated frontend changes.
    router.use("/admin/categories", categoryRoute);
    router.use("/admin", adminRoute);
    router.use("/seller", sellerRoute);
    router.use("/warehouse/inventory", warehouseInventoryRoute);
    router.use("/warehouse/transfers", warehouseTransferRoute);
    router.use("/warehouse/fulfillments", warehouseFulfillmentRoute);
    router.use("/warehouse/shiprocket-pickup", shiprocketPickupRoute);
    router.use("/warehouse", warehouseRoute);
    router.use("/settings", settingsRoute);
    router.use("/categories", categoryRoute);
    router.use("/products", productRoute);
    router.use("/cart", cartRoute);
    router.use("/wishlist", wishlistRoute);
    router.use("/orders", orderRoute);
    router.use("/payments", paymentRoute);
    router.use("/maps", mapsRoute);
    router.use("/media", mediaRoute);
    // experienceRoute, offerRoute, couponRoute are mounted at "/" intentionally:
    // each of these routers declares ABSOLUTE paths internally (e.g.
    //   router.get("/experience", ...), router.get("/offers", ...),
    //   router.get("/admin-offers", ...), router.get("/admin/coupons", ...))
    // Mounting them under an explicit prefix would double the path
    // ("/offers/offers", etc.) and break every existing frontend caller.
    // The right cleanup is to rewrite each router to use a relative prefix
    // and update the frontend in the same PR. Until then, keep the "/" mount.
    router.use("/", experienceRoute);
    router.use("/", offerRoute);
    router.use("/", couponRoute);
    router.use("/", dealSectionRoute);
    router.use("/notifications", notificationRoute);
    router.use("/auth/otp", authOtpRoute);
    router.use("/push", pushRoute);
    router.use("/tickets", ticketRoute);
    router.use("/reviews", reviewRoute);
    router.use("/admin/faqs", faqRoute);
    router.use("/public/faqs", faqRoute); // For public access without admin prefix
    router.use("/kits", kitRoute);
    router.use("/employees", employeeRoute);
    router.use("/translate", translationRoute);

    app.use("/api", router);
}
export default setupRoutes;
