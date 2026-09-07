import mongoose from "mongoose";
import WarehouseFulfillment, {
  FULFILLMENT_STATUS,
  isValidFulfillmentTransition,
} from "../models/warehouseFulfillment.js";
import Order from "../models/order.js";
import Warehouse from "../models/warehouse.js";
import {
  commitWarehouseStock,
  releaseWarehouseStockReservation,
} from "./warehouseInventoryService.js";
import { shiprocketProvider } from "../modules/delivery/providers/shiprocket/shiprocketProvider.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { emitOrderStatusUpdate } from "./orderSocketEmitter.js";
import * as logger from "./logger.js";

/**
 * List fulfillments with pagination, search, and status filters.
 * - Warehouse users only see fulfillments for their own warehouse.
 * - Admin sees all.
 */
export async function getFulfillmentsList({
  warehouseId = null,
  status = "all",
  search = "",
  page = 1,
  limit = 25,
  skip = 0,
}) {
  const query = {};

  if (warehouseId && warehouseId !== "all") {
    query.warehouse = new mongoose.Types.ObjectId(warehouseId);
  }

  if (status && status !== "all") {
    query.status = String(status).toUpperCase();
  }

  if (search) {
    const searchRegex = new RegExp(search.trim(), "i");
    query.$or = [
      { fulfillmentId: searchRegex },
      { orderId: searchRegex },
    ];
  }

  const [items, total] = await Promise.all([
    WarehouseFulfillment.find(query)
      .populate("warehouse", "warehouseName name city address phone")
      .populate("order", "orderId status workflowStatus pricing address customer paymentMode paymentStatus createdAt")
      .populate("items.product", "name title sku price salePrice discountPrice images image")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    WarehouseFulfillment.countDocuments(query),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Get fulfillment detail by ID or fulfillmentId string.
 */
export async function getFulfillmentById(idOrFulfillmentId, user = null) {
  const isObjectId = mongoose.Types.ObjectId.isValid(idOrFulfillmentId);
  const query = isObjectId
    ? { _id: idOrFulfillmentId }
    : { fulfillmentId: idOrFulfillmentId };

  const fulfillment = await WarehouseFulfillment.findOne(query)
    .populate("warehouse", "warehouseName name city address phone location serviceRadius")
    .populate("order")
    .populate("items.product", "name title sku price salePrice discountPrice images image variants")
    .lean();

  if (!fulfillment) {
    const error = new Error("Warehouse fulfillment record not found");
    error.statusCode = 404;
    throw error;
  }

  // Security check: Warehouse user can only view their own fulfillment
  if (user && user.role === "warehouse") {
    const whId = String(user.id || user._id);
    const targetWhId = String(fulfillment.warehouse?._id || fulfillment.warehouse);
    if (whId !== targetWhId) {
      const error = new Error("Access denied to this fulfillment record");
      error.statusCode = 403;
      throw error;
    }
  }

  return fulfillment;
}

/**
 * Helper to fetch and authorize fulfillment document for status updates.
 */
async function getAuthorizedFulfillmentDoc(idOrFulfillmentId, user) {
  const isObjectId = mongoose.Types.ObjectId.isValid(idOrFulfillmentId);
  const query = isObjectId
    ? { _id: idOrFulfillmentId }
    : { fulfillmentId: idOrFulfillmentId };

  const fulfillment = await WarehouseFulfillment.findOne(query);
  if (!fulfillment) {
    const error = new Error("Warehouse fulfillment record not found");
    error.statusCode = 404;
    throw error;
  }

  if (user && user.role === "warehouse") {
    const whId = String(user.id || user._id);
    if (whId !== String(fulfillment.warehouse)) {
      const error = new Error("Access denied: You can only update fulfillments for your own warehouse");
      error.statusCode = 403;
      throw error;
    }
  }

  return fulfillment;
}

/**
 * Accept fulfillment (ASSIGNED -> ACCEPTED).
 */
export async function acceptFulfillment({ id, user }) {
  const fulfillment = await getAuthorizedFulfillmentDoc(id, user);

  if (fulfillment.status !== FULFILLMENT_STATUS.ASSIGNED) {
    const error = new Error(
      `Cannot accept fulfillment in status "${fulfillment.status}". Current status must be ASSIGNED.`,
    );
    error.statusCode = 400;
    throw error;
  }

  fulfillment.status = FULFILLMENT_STATUS.ACCEPTED;
  fulfillment.acceptedAt = new Date();
  await fulfillment.save();

  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      fulfillment.order,
      {
        $set: {
          status: "confirmed",
          orderStatus: "confirmed",
          workflowStatus: WORKFLOW_STATUS.SELLER_ACCEPTED,
        },
        $unset: {
          sellerPendingExpiresAt: 1,
          deliverySearchExpiresAt: 1,
        },
      },
      { new: true },
    );
    if (updatedOrder) {
      emitOrderStatusUpdate(
        fulfillment.orderId,
        {
          workflowStatus: WORKFLOW_STATUS.SELLER_ACCEPTED,
          status: "confirmed",
        },
        updatedOrder.customer,
      );
    }
  } catch (syncErr) {
    logger.warn(`[WarehouseFulfillment] Error syncing order on accept: ${syncErr.message}`);
  }

  return fulfillment;
}

/**
 * Start Picking (ACCEPTED -> PICKING).
 */
export async function startPicking({ id, user }) {
  const fulfillment = await getAuthorizedFulfillmentDoc(id, user);

  if (
    fulfillment.status !== FULFILLMENT_STATUS.ACCEPTED &&
    fulfillment.status !== FULFILLMENT_STATUS.ASSIGNED
  ) {
    const error = new Error(
      `Cannot start picking from status "${fulfillment.status}". Must be ACCEPTED or ASSIGNED.`,
    );
    error.statusCode = 400;
    throw error;
  }

  fulfillment.status = FULFILLMENT_STATUS.PICKING;
  fulfillment.pickingStartedAt = new Date();
  await fulfillment.save();

  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      fulfillment.order,
      {
        $set: {
          status: "packed",
          orderStatus: "packed",
          workflowStatus: WORKFLOW_STATUS.PICKUP_READY,
        },
        $unset: {
          sellerPendingExpiresAt: 1,
          deliverySearchExpiresAt: 1,
        },
      },
      { new: true },
    );
    if (updatedOrder) {
      emitOrderStatusUpdate(
        fulfillment.orderId,
        {
          workflowStatus: WORKFLOW_STATUS.PICKUP_READY,
          status: "packed",
        },
        updatedOrder.customer,
      );
    }
  } catch (syncErr) {
    logger.warn(`[WarehouseFulfillment] Error syncing order on picking: ${syncErr.message}`);
  }

  return fulfillment;
}

/**
 * Update Pick Status for individual items (during PICKING).
 */
export async function updateItemPickStatus({
  id,
  user,
  productId,
  pickedQty,
  shortQty = 0,
  shortReason = "",
}) {
  const fulfillment = await getAuthorizedFulfillmentDoc(id, user);

  if (
    fulfillment.status !== FULFILLMENT_STATUS.PICKING &&
    fulfillment.status !== FULFILLMENT_STATUS.ACCEPTED &&
    fulfillment.status !== FULFILLMENT_STATUS.ASSIGNED
  ) {
    const error = new Error("Item pick status can only be updated while fulfillment is in PICKING, ACCEPTED or ASSIGNED status");
    error.statusCode = 400;
    throw error;
  }

  if (fulfillment.status !== FULFILLMENT_STATUS.PICKING) {
    fulfillment.status = FULFILLMENT_STATUS.PICKING;
    fulfillment.pickingStartedAt = new Date();
  }

  const targetItem = fulfillment.items.find(
    (item) => String(item.product) === String(productId),
  );

  if (!targetItem) {
    const error = new Error(`Item with product ID ${productId} not found in fulfillment`);
    error.statusCode = 404;
    throw error;
  }

  const qtyPicked = Number(pickedQty);
  if (!Number.isFinite(qtyPicked) || qtyPicked < 0) {
    const error = new Error("Picked quantity must be a non-negative number");
    error.statusCode = 400;
    throw error;
  }

  if (qtyPicked > targetItem.requiredQty) {
    const error = new Error(
      `Picked quantity (${qtyPicked}) cannot exceed required quantity (${targetItem.requiredQty})`,
    );
    error.statusCode = 400;
    throw error;
  }

  targetItem.pickedQty = qtyPicked;
  targetItem.shortQty = Number(shortQty) || (targetItem.requiredQty - qtyPicked);

  if (targetItem.shortQty > 0) {
    targetItem.status = "SHORT";
    targetItem.shortReason = shortReason || "Item unavailable during pick";
    fulfillment.hasShortPick = true;

    // Notify Admin about the short pick exception
    try {
      await emitNotificationEvent({
        event: NOTIFICATION_EVENTS.WAREHOUSE_SHORT_PICK,
        recipients: [{ role: "admin", id: "all" }],
        data: {
          orderId: fulfillment.orderId,
          fulfillmentId: fulfillment.fulfillmentId,
          productName: targetItem.name,
          requiredQty: targetItem.requiredQty,
          pickedQty: targetItem.pickedQty,
          shortQty: targetItem.shortQty,
          reason: targetItem.shortReason,
        },
      });
    } catch (notifErr) {
      logger.warn("[WarehouseFulfillment] Failed to emit short pick notification:", notifErr);
    }
  } else {
    targetItem.status = "PICKED";
    targetItem.shortReason = "";
  }

  await fulfillment.save();
  return fulfillment;
}

/**
 * Start Packing (PICKING -> PACKING).
 */
export async function startPacking({ id, user }) {
  const fulfillment = await getAuthorizedFulfillmentDoc(id, user);

  if (fulfillment.status !== FULFILLMENT_STATUS.PICKING) {
    const error = new Error(`Cannot start packing from status "${fulfillment.status}". Current status must be PICKING.`);
    error.statusCode = 400;
    throw error;
  }

  fulfillment.status = FULFILLMENT_STATUS.PACKING;
  fulfillment.packingStartedAt = new Date();
  await fulfillment.save();

  return fulfillment;
}

/**
 * Mark Packed (PACKING -> PACKED).
 */
export async function markPacked({ id, user, notes = "" }) {
  const fulfillment = await getAuthorizedFulfillmentDoc(id, user);

  if (fulfillment.status !== FULFILLMENT_STATUS.PACKING) {
    const error = new Error(`Cannot mark packed from status "${fulfillment.status}". Current status must be PACKING.`);
    error.statusCode = 400;
    throw error;
  }

  fulfillment.status = FULFILLMENT_STATUS.PACKED;
  fulfillment.packedAt = new Date();
  if (notes) {
    fulfillment.notes = fulfillment.notes ? `${fulfillment.notes}\n${notes}` : notes;
  }
  await fulfillment.save();

  // Notify customer via WhatsApp (Non-blocking)
  setImmediate(async () => {
    try {
      const { sendOrderNotification } = await import("./whatsappService.js");
      const { WHATSAPP_EVENTS } = await import("../constants/whatsapp.js");
      await sendOrderNotification(WHATSAPP_EVENTS.ORDER_PACKED, {
        orderId: fulfillment.orderId,
        order: fulfillment.order,
      });
    } catch (waErr) {
      logger.debug("[WarehouseFulfillment] WhatsApp packed notification skipped", { error: waErr?.message });
    }
  });

  return fulfillment;
}

/**
 * Mark Ready to Ship (PACKED -> READY_TO_SHIP).
 * Commits the reserved warehouse stock permanently.
 */
export async function markReadyToShip({
  id,
  user,
  notes = "",
}) {
  const fulfillment = await getAuthorizedFulfillmentDoc(id, user);

  if (fulfillment.status !== FULFILLMENT_STATUS.PACKED) {
    const error = new Error(`Cannot mark ready to ship from status "${fulfillment.status}". Current status must be PACKED.`);
    error.statusCode = 400;
    throw error;
  }

  // Commit reserved stock in warehouse inventory permanently
  try {
    await commitWarehouseStock({
      warehouseId: fulfillment.warehouse,
      items: fulfillment.items,
      reference: fulfillment.fulfillmentId || fulfillment.orderId,
      performedBy: user.id || user._id,
      performedByModel: user.role === "admin" ? "Admin" : "Warehouse",
    });
  } catch (commErr) {
    logger.warn(`[WarehouseFulfillment] Error committing stock on READY_TO_SHIP: ${commErr.message}`);
  }

  fulfillment.status = FULFILLMENT_STATUS.READY_TO_SHIP;
  fulfillment.readyAt = new Date();
  if (notes) {
    fulfillment.notes = fulfillment.notes ? `${fulfillment.notes}\n${notes}` : notes;
  }
  await fulfillment.save();

  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      fulfillment.order,
      {
        $set: {
          status: "packed",
          orderStatus: "packed",
          workflowStatus: WORKFLOW_STATUS.PICKUP_READY,
        },
        $unset: {
          sellerPendingExpiresAt: 1,
          deliverySearchExpiresAt: 1,
        },
      },
      { new: true },
    );
    if (updatedOrder) {
      emitOrderStatusUpdate(
        fulfillment.orderId,
        {
          workflowStatus: WORKFLOW_STATUS.PICKUP_READY,
          status: "packed",
        },
        updatedOrder.customer,
      );
    }
  } catch (syncErr) {
    logger.warn(`[WarehouseFulfillment] Error syncing order on ready to ship: ${syncErr.message}`);
  }

  // Attempt automatic Shiprocket shipment creation
  try {
    await createShiprocketShipmentForFulfillment(fulfillment);
  } catch (shipErr) {
    logger.warn(`[WarehouseFulfillment] Automatic Shiprocket creation on READY_TO_SHIP failed (can retry): ${shipErr.message}`);
  }

  // Notify Admin that fulfillment is ready for dispatch
  try {
    await emitNotificationEvent({
      event: NOTIFICATION_EVENTS.WAREHOUSE_READY_TO_SHIP,
      recipients: [{ role: "admin", id: "all" }],
      data: {
        orderId: fulfillment.orderId,
        fulfillmentId: fulfillment.fulfillmentId,
      },
    });
  } catch (notifErr) {}

  return fulfillment;
}

/**
 * Creates/generates a Shiprocket shipment for an existing fulfillment.
 * Idempotent — will not duplicate if already generated.
 */
export async function createShiprocketShipmentForFulfillment(fulfillmentDoc) {
  if (!fulfillmentDoc) return null;

  if (fulfillmentDoc.awbCode || fulfillmentDoc.shiprocketOrderId) {
    return {
      success: true,
      alreadyCreated: true,
      awbCode: fulfillmentDoc.awbCode,
      trackingUrl: fulfillmentDoc.trackingUrl,
    };
  }

  const [order, warehouse] = await Promise.all([
    Order.findById(fulfillmentDoc.order).lean(),
    Warehouse.findById(fulfillmentDoc.warehouse).lean(),
  ]);

  if (!order) {
    throw new Error("Associated order not found for Shiprocket shipment");
  }

  const productIds = (fulfillmentDoc.items || [])
    .map((item) => item.product?._id || item.product)
    .filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } })
    .select("shippingWeight")
    .lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  let totalWeight = 0;
  for (const item of fulfillmentDoc.items || []) {
    const pid = String(item.product?._id || item.product);
    const p = productMap.get(pid);
    const qty = Number(item.pickedQty || item.requiredQty || 1);
    const weight = Number(p?.shippingWeight || 0.5);
    totalWeight += weight * qty;
  }
  if (totalWeight <= 0) totalWeight = 0.5;

  const context = {
    orderId: fulfillmentDoc.orderId || order.orderId,
    pickup: {
      name: warehouse?.warehouseName || warehouse?.name || "Primary Warehouse",
      shiprocketPickupLocation: warehouse?.shiprocketPickupLocation || null,
      phone: warehouse?.phone || "9999999999",
      address: warehouse?.address || "Warehouse Address",
      city: warehouse?.city || "Indore",
      state: warehouse?.state || "Madhya Pradesh",
      pincode: warehouse?.pincode || "452001",
    },
    drop: {
      name: order.address?.name || "Customer",
      phone: order.address?.phone || "9999999999",
      address: order.address?.address || "Address",
      city: order.address?.city || "City",
      state: order.address?.state || "State",
      pincode: order.address?.pincode || "452001",
      email: order.customer?.email || "customer@example.com",
    },
    items: (fulfillmentDoc.items || []).map((item) => ({
      name: item.name || "Item",
      sku: item.sku || "SKU-001",
      qty: item.pickedQty || item.requiredQty || 1,
      price: item.price || 100,
    })),
    paymentMode: order.paymentMode || "COD",
    totalValue: Number(order.paymentBreakdown?.grandTotal || order.pricing?.total || 100),
    weight: totalWeight,
  };

  const shipmentResult = await shiprocketProvider.createShipment(context);

  fulfillmentDoc.shiprocketOrderId = shipmentResult.externalId || `SR-${order.orderId}`;
  fulfillmentDoc.awbCode = shipmentResult.externalId;
  fulfillmentDoc.courierName = "Shiprocket";
  fulfillmentDoc.trackingUrl = shipmentResult.trackingUrl || (shipmentResult.externalId ? `https://shiprocket.co/tracking/${shipmentResult.externalId}` : null);
  fulfillmentDoc.shipmentStatus = shipmentResult.providerStatus || "SHIPMENT_CREATED";

  await fulfillmentDoc.save();

  // Reconcile shipping charges if final rate returned by provider
  try {
    const finalShippingCharge = Number(
      shipmentResult.cost || shipmentResult.charge || shipmentResult.raw?.rate || 0,
    );
    if (finalShippingCharge > 0) {
      const estimatedCharge = Number(order.paymentBreakdown?.shippingChargeEstimated || 0);
      const difference = Number((finalShippingCharge - estimatedCharge).toFixed(2));
      await Order.findByIdAndUpdate(order._id, {
        $set: {
          "paymentBreakdown.shippingChargeFinal": finalShippingCharge,
          "paymentBreakdown.shippingChargeDifference": difference,
        },
      });
    }
  } catch (reconcileErr) {
    logger.warn(`[WarehouseFulfillment] Error updating shipping charge reconciliation: ${reconcileErr.message}`);
  }

  // Notify customer via WhatsApp (Non-blocking)
  setImmediate(async () => {
    try {
      const { sendShipmentNotification } = await import("./whatsappService.js");
      const { WHATSAPP_EVENTS } = await import("../constants/whatsapp.js");
      await sendShipmentNotification(WHATSAPP_EVENTS.SHIPMENT_CREATED, {
        order,
        shipment: fulfillmentDoc,
        awbCode: fulfillmentDoc.awbCode,
        courierName: "Shiprocket",
        trackingUrl: fulfillmentDoc.trackingUrl,
      });
    } catch (waErr) {
      logger.debug("[WarehouseFulfillment] WhatsApp shipment created notification skipped", { error: waErr?.message });
    }
  });

  return fulfillmentDoc;
}

/**
 * Mark Shipped (READY_TO_SHIP -> SHIPPED).
 * Updates Order status and notifies customer.
 */
export async function markShipped({
  id,
  user,
  awbCode = "",
  courierName = "",
  trackingUrl = "",
  notes = "",
}) {
  const fulfillment = await getAuthorizedFulfillmentDoc(id, user);

  if (
    fulfillment.status !== FULFILLMENT_STATUS.READY_TO_SHIP &&
    fulfillment.status !== FULFILLMENT_STATUS.PACKED
  ) {
    const error = new Error(`Cannot mark shipped from status "${fulfillment.status}". Current status must be READY_TO_SHIP.`);
    error.statusCode = 400;
    throw error;
  }

  fulfillment.status = FULFILLMENT_STATUS.SHIPPED;
  fulfillment.shippedAt = new Date();
  if (awbCode) fulfillment.awbCode = awbCode;
  if (courierName) fulfillment.courierName = courierName;
  if (trackingUrl) fulfillment.trackingUrl = trackingUrl;
  if (notes) {
    fulfillment.notes = fulfillment.notes ? `${fulfillment.notes}\n${notes}` : notes;
  }
  await fulfillment.save();

  // Update order status
  try {
    await Order.findByIdAndUpdate(fulfillment.order, {
      $set: {
        status: "out_for_delivery",
        orderStatus: "out_for_delivery",
        workflowStatus: "OUT_FOR_DELIVERY",
        outForDeliveryAt: new Date(),
      },
    });
  } catch (ordErr) {
    logger.warn(`[WarehouseFulfillment] Error updating order status to out_for_delivery: ${ordErr.message}`);
  }

  // Notify customer and admin
  try {
    await emitNotificationEvent({
      event: NOTIFICATION_EVENTS.ORDER_OUT_FOR_DELIVERY,
      recipients: [{ role: "customer", id: String(fulfillment.order) }],
      data: {
        orderId: fulfillment.orderId,
        awbCode: fulfillment.awbCode,
        trackingUrl: fulfillment.trackingUrl,
      },
    });
  } catch (notifErr) {}

  return fulfillment;
}

/**
 * Mark Completed / Delivered (SHIPPED -> COMPLETED).
 */
export async function markCompleted({ id, user, notes = "" }) {
  const fulfillment = await getAuthorizedFulfillmentDoc(id, user);

  if (fulfillment.status !== FULFILLMENT_STATUS.SHIPPED) {
    const error = new Error(`Cannot complete fulfillment from status "${fulfillment.status}". Current status must be SHIPPED.`);
    error.statusCode = 400;
    throw error;
  }

  fulfillment.status = FULFILLMENT_STATUS.COMPLETED;
  fulfillment.completedAt = new Date();
  if (notes) {
    fulfillment.notes = fulfillment.notes ? `${fulfillment.notes}\n${notes}` : notes;
  }
  await fulfillment.save();

  // Update order status
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      fulfillment.order,
      {
        $set: {
          status: "delivered",
          orderStatus: "delivered",
          workflowStatus: "DELIVERED",
          deliveredAt: new Date(),
        },
      },
      { new: true },
    );
    if (updatedOrder) {
      emitOrderStatusUpdate(
        fulfillment.orderId,
        {
          workflowStatus: "DELIVERED",
          status: "delivered",
        },
        updatedOrder.customer,
      );

      // Notify customer via WhatsApp (Non-blocking)
      setImmediate(async () => {
        try {
          const { sendOrderNotification } = await import("./whatsappService.js");
          const { WHATSAPP_EVENTS } = await import("../constants/whatsapp.js");
          await sendOrderNotification(WHATSAPP_EVENTS.ORDER_DELIVERED, {
            order: updatedOrder,
            orderId: fulfillment.orderId,
          });
        } catch (waErr) {
          logger.debug("[WarehouseFulfillment] WhatsApp delivered notification skipped", { error: waErr?.message });
        }
      });
    }
  } catch (ordErr) {
    logger.warn(`[WarehouseFulfillment] Error updating order status to delivered: ${ordErr.message}`);
  }

  return fulfillment;
}

/**
 * Cancel Fulfillment (ASSIGNED/ACCEPTED -> CANCELLED).
 * Releases reserved warehouse stock.
 */
export async function cancelFulfillment({
  id,
  user,
  reason = "Fulfillment Cancelled",
}) {
  const fulfillment = await getAuthorizedFulfillmentDoc(id, user);

  if (
    fulfillment.status === FULFILLMENT_STATUS.CANCELLED ||
    fulfillment.status === FULFILLMENT_STATUS.READY_TO_SHIP ||
    fulfillment.status === FULFILLMENT_STATUS.SHIPPED ||
    fulfillment.status === FULFILLMENT_STATUS.COMPLETED
  ) {
    const error = new Error(`Cannot cancel fulfillment in status "${fulfillment.status}"`);
    error.statusCode = 400;
    throw error;
  }

  // Release warehouse reserved stock back to available
  try {
    await releaseWarehouseStockReservation({
      warehouseId: fulfillment.warehouse,
      items: fulfillment.items,
      reference: fulfillment.fulfillmentId || fulfillment.orderId,
      reason,
      performedBy: user.id || user._id,
      performedByModel: user.role === "admin" ? "Admin" : "Warehouse",
    });
  } catch (relErr) {
    logger.warn(`[WarehouseFulfillment] Error releasing stock on cancellation: ${relErr.message}`);
  }

  fulfillment.status = FULFILLMENT_STATUS.CANCELLED;
  fulfillment.cancelledAt = new Date();
  fulfillment.cancelReason = reason;
  await fulfillment.save();

  return fulfillment;
}

/**
 * Dashboard stats for a warehouse (counts by fulfillment status).
 */
export async function getWarehouseFulfillmentStats({ warehouseId }) {
  const match = {};
  if (warehouseId && warehouseId !== "all") {
    match.warehouse = new mongoose.Types.ObjectId(warehouseId);
  }

  const statusCounts = await WarehouseFulfillment.aggregate([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const stats = {
    total: 0,
    assigned: 0,
    accepted: 0,
    picking: 0,
    packing: 0,
    packed: 0,
    readyToShip: 0,
    shipped: 0,
    completed: 0,
    cancelled: 0,
  };

  for (const item of statusCounts) {
    stats.total += item.count;
    switch (item._id) {
      case FULFILLMENT_STATUS.ASSIGNED:
        stats.assigned = item.count;
        break;
      case FULFILLMENT_STATUS.ACCEPTED:
        stats.accepted = item.count;
        break;
      case FULFILLMENT_STATUS.PICKING:
        stats.picking = item.count;
        break;
      case FULFILLMENT_STATUS.PACKING:
        stats.packing = item.count;
        break;
      case FULFILLMENT_STATUS.PACKED:
        stats.packed = item.count;
        break;
      case FULFILLMENT_STATUS.READY_TO_SHIP:
        stats.readyToShip = item.count;
        break;
      case FULFILLMENT_STATUS.SHIPPED:
        stats.shipped = item.count;
        break;
      case FULFILLMENT_STATUS.COMPLETED:
        stats.completed = item.count;
        break;
      case FULFILLMENT_STATUS.CANCELLED:
        stats.cancelled = item.count;
        break;
    }
  }

  return stats;
}
