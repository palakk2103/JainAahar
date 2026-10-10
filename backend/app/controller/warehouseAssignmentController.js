import mongoose from "mongoose";
import { handleResponse } from "../utils/helper.js";
import getPagination from "../utils/pagination.js";
import Order from "../models/order.js";
import {
  evaluateWarehousesForOrder,
  assignWarehouseToOrder,
  getUnassignedOrdersList,
} from "../services/warehouseAssignmentService.js";

/**
 * GET /api/admin/orders/unassigned
 * List orders that have not been assigned to a warehouse or failed auto-assignment.
 */
export const getUnassignedOrdersHandler = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });
    const { search = "" } = req.query;

    const data = await getUnassignedOrdersList({
      page,
      limit,
      skip,
      search,
    });

    return handleResponse(
      res,
      200,
      "Unassigned orders retrieved successfully",
      data,
    );
  } catch (error) {
    return handleResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve unassigned orders",
    );
  }
};

/**
 * GET /api/admin/orders/:orderId/warehouse-eligibility
 * Analyze all active warehouses against an order for stock, distance, and radius.
 */
export const getEligibleWarehousesForOrderHandler = async (req, res) => {
  try {
    const { orderId } = req.params;

    const isObjectId = mongoose.Types.ObjectId.isValid(orderId);
    const order = await Order.findOne(
      isObjectId ? { $or: [{ _id: orderId }, { orderId }] } : { orderId },
    ).lean();

    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    const evaluation = await evaluateWarehousesForOrder(order);

    return handleResponse(
      res,
      200,
      "Warehouse eligibility analysis completed",
      evaluation,
    );
  } catch (error) {
    return handleResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to evaluate warehouse eligibility",
    );
  }
};

/**
 * POST /api/admin/orders/:orderId/assign-warehouse
 * Admin manually assigns or reassigns an order to a warehouse.
 */
export const assignWarehouseToOrderHandler = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { warehouseId, force = false } = req.body;

    const result = await assignWarehouseToOrder({
      orderId,
      warehouseId,
      assignedBy: req.user.id || req.user._id,
      force,
    });

    if (!result.success) {
      return handleResponse(res, 400, result.reason || "Assignment failed", result);
    }

    return handleResponse(
      res,
      200,
      result.alreadyAssigned
        ? "Order was already assigned to this warehouse"
        : "Order assigned to warehouse successfully",
      result,
    );
  } catch (error) {
    return handleResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to assign warehouse to order",
    );
  }
};
