import Warehouse from "../models/warehouse.js";
import WarehouseInventory from "../models/warehouseInventory.js";
import Product from "../models/product.js";
import { shiprocketProvider } from "../modules/delivery/providers/shiprocket/shiprocketProvider.js";
import { getOrCreateFinanceSettings } from "./finance/financeSettingsService.js";
import * as logger from "./logger.js";

/**
 * ShippingRateService — centralised service for dynamic Shiprocket-based
 * shipping charge calculation at checkout.
 *
 * Design:
 *   • `isLocalDelivery()` — determines if customer is in the same city as the
 *     fulfilment warehouse → FREE delivery.
 *   • `calculateShippingRate()` — calls Shiprocket serviceability API for
 *     non-local deliveries.
 *   • `calculateCheckoutShipping()` — orchestrates warehouse selection +
 *     local-delivery check + rate calculation for the full checkout flow.
 *   • `findBestWarehouseForCheckout()` — lightweight version of the order
 *     assignment evaluator, adapted for pre-order checkout (no Order doc needed).
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normalise a city string for safe comparison.
 * Strips whitespace, lowercases, removes common suffixes.
 */
function normalizeCity(raw) {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\bcity\b/gi, "")
    .trim();
}

/**
 * Extract a clean 6-digit pincode from a string that might contain
 * mixed content such as "Indore - 452001" or "452001".
 */
function extractPincode(raw) {
  if (!raw || typeof raw !== "string") return "";
  const match = raw.match(/\b(\d{6})\b/);
  return match ? match[1] : raw.trim();
}

// ─── Local Delivery Detection ───────────────────────────────────────────────

/**
 * Determines whether the customer's delivery address qualifies as
 * "same city" relative to the fulfilment warehouse.
 *
 * Uses a dual-check approach:
 *   1. City-name match (normalised) — covers obvious cases.
 *   2. Pincode district-prefix match (first 3 digits = same postal district)
 *      — reliable fallback when the city string is inconsistent or missing.
 *
 * @param {Object} warehouse — Mongoose lean warehouse doc
 * @param {string} customerPincode — 6-digit customer delivery pincode
 * @param {string} [customerCity] — optional customer city string
 * @returns {{ isLocal: boolean, warehouseCity: string, method: string }}
 */
export function isLocalDelivery(warehouse, customerPincode, customerCity = "") {
  const warehouseCity = normalizeCity(warehouse?.city);
  const warehousePincode = extractPincode(warehouse?.pincode);
  const custPincode = extractPincode(customerPincode);
  const custCity = normalizeCity(customerCity);

  // No warehouse pincode or customer pincode → cannot determine
  if (!warehousePincode || !custPincode) {
    return { isLocal: false, warehouseCity, method: "no_pincode" };
  }

  // Check 1: exact pincode match → definitely local
  if (warehousePincode === custPincode) {
    return { isLocal: true, warehouseCity, method: "pincode_exact" };
  }

  // Check 2: postal district prefix match (first 3 digits)
  // In India, pincodes sharing the first 3 digits belong to the same
  // sorting district and are typically within the same city/region.
  const warehouseDistrict = warehousePincode.slice(0, 3);
  const customerDistrict = custPincode.slice(0, 3);
  if (warehouseDistrict === customerDistrict) {
    return { isLocal: true, warehouseCity, method: "district_prefix" };
  }

  // If the first digit (postal zone) differs (e.g. 4 vs 5), they are in different states/regions
  if (warehousePincode[0] !== custPincode[0]) {
    return { isLocal: false, warehouseCity, method: "different_zone" };
  }

  // Check 3: city name match (both non-empty and equal) within same zone
  if (warehouseCity && custCity && warehouseCity === custCity) {
    return { isLocal: true, warehouseCity, method: "city_match" };
  }

  return { isLocal: false, warehouseCity, method: "no_match" };
}

// ─── Shiprocket Rate Calculation ────────────────────────────────────────────

/**
 * Calls the existing shiprocketProvider.getQuote() to get dynamic
 * shipping rates from the Shiprocket serviceability API.
 *
 * @param {Object} params
 * @param {string} params.originPincode — warehouse / pickup pincode
 * @param {string} params.destinationPincode — customer delivery pincode
 * @param {number} params.weight — total shipment weight in kg
 * @param {number} [params.length] — package length in cm
 * @param {number} [params.breadth] — package breadth in cm
 * @param {number} [params.height] — package height in cm
 * @param {string} [params.paymentMode] — "COD" or "ONLINE" / "Prepaid"
 * @param {number} [params.totalValue] — total order value
 * @returns {Promise<{ rate: number, courierName: string, codCharges: number, etdHours: number, source: string }>}
 */
export async function calculateShippingRate({
  originPincode,
  destinationPincode,
  weight,
  length,
  breadth,
  height,
  paymentMode = "COD",
  totalValue = 0,
}) {
  const originPin = extractPincode(originPincode);
  const destPin = extractPincode(destinationPincode);

  if (!originPin || originPin.length !== 6) {
    const err = new Error("Invalid origin pincode for shipping calculation");
    err.statusCode = 400;
    throw err;
  }
  if (!destPin || destPin.length !== 6) {
    const err = new Error("Please enter a valid delivery PIN code.");
    err.statusCode = 400;
    throw err;
  }

  const context = {
    pickup: { pincode: originPin },
    drop: { pincode: destPin },
    weight: weight || 0.5,
    totalValue: totalValue || 0,
    paymentMode: paymentMode === "ONLINE" ? "Prepaid" : "COD",
  };

  logger.info(
    `[ShippingRate] Calculating rate: origin=${originPin} dest=${destPin} weight=${weight}kg mode=${paymentMode}`
  );

  const quote = await shiprocketProvider.getQuote(context);

  if (!quote || typeof quote.price !== "number" || quote.price <= 0) {
    const err = new Error("Delivery is currently unavailable for this location.");
    err.statusCode = 422;
    throw err;
  }

  return {
    rate: Math.round(quote.price),
    courierName: quote.breakdown?.courierName || "Shiprocket",
    codCharges: quote.breakdown?.codCharges || 0,
    etdHours: Math.round((quote.estimatedMinutes || 1440) / 60),
    source: "shiprocket",
  };
}

// ─── Warehouse Selection for Checkout ───────────────────────────────────────

/**
 * Finds the best eligible warehouse for a set of cart items.
 * Lightweight variant of warehouseAssignmentService.evaluateWarehousesForOrder()
 * that doesn't require a full Order document.
 *
 * @param {Array<{ productId: string, quantity: number }>} cartItems
 * @returns {Promise<Object|null>} — warehouse lean doc or null
 */
export async function findBestWarehouseForCheckout(cartItems = []) {
  if (!cartItems || cartItems.length === 0) return null;

  const warehouses = await Warehouse.find({
    isActive: true,
    isVerified: true,
  }).lean();

  if (warehouses.length === 0) return null;

  const candidates = [];

  for (const wh of warehouses) {
    let hasAllStock = true;

    for (const cartItem of cartItems) {
      const productId = cartItem.productId || cartItem.product;
      const requiredQty = Number(cartItem.quantity || 1);

      const inv = await WarehouseInventory.findOne({
        warehouse: wh._id,
        product: productId,
      }).lean();

      const available = inv ? Number(inv.available || 0) : 0;
      if (available < requiredQty) {
        hasAllStock = false;
        break;
      }
    }

    if (hasAllStock) {
      candidates.push(wh);
    }
  }

  if (candidates.length === 0) return null;

  // If only one candidate, return it
  if (candidates.length === 1) return candidates[0];

  // Multiple candidates — return the first one (they're already sorted by
  // creation order which corresponds to admin-configured priority)
  return candidates[0];
}

// ─── Full Checkout Shipping Orchestrator ────────────────────────────────────

/**
 * The main entry point for checkout shipping calculation.
 *
 * 1. Fetch authoritative product data (weight/dimensions) from DB.
 * 2. Determine the best fulfilment warehouse (stock + availability).
 * 3. Check if the delivery is local (same city) → FREE.
 * 4. Otherwise, call Shiprocket for dynamic rate.
 * 5. Apply optional shipping buffer from Settings.
 *
 * @param {Object} params
 * @param {Array<{ productId: string, quantity: number }>} params.items — cart items
 * @param {string} params.customerPincode — 6-digit delivery pincode
 * @param {string} [params.customerCity] — delivery city (optional, used for local detection)
 * @param {string} [params.paymentMode] — "COD" or "ONLINE"
 * @param {Object} [params.session] — Mongoose session for transactional consistency
 * @returns {Promise<Object>} — shipping calculation result
 */
export async function calculateCheckoutShipping({
  items = [],
  customerPincode,
  customerCity = "",
  paymentMode = "COD",
  session = null,
}) {
  const cleanPincode = extractPincode(customerPincode);
  if (!cleanPincode || cleanPincode.length !== 6) {
    const err = new Error("Please enter a valid delivery PIN code.");
    err.statusCode = 400;
    throw err;
  }

  if (!items || items.length === 0) {
    const err = new Error("Cannot calculate shipping for empty cart.");
    err.statusCode = 400;
    throw err;
  }

  // 1. Fetch authoritative product data
  const productIds = items.map((i) => i.productId || i.product).filter(Boolean);
  const productQuery = Product.find({ _id: { $in: productIds } })
    .select("_id shippingWeight shippingLength shippingBreadth shippingHeight price salePrice name")
    .lean();
  if (session) productQuery.session(session);
  const products = await productQuery;

  const productMap = new Map(products.map((p) => [String(p._id), p]));

  // Fetch settings for default weight + buffer
  const financeSettings = await getOrCreateFinanceSettings({ session });
  const defaultWeight = Number(financeSettings.defaultShippingWeightKg || 0.5);
  const shippingBuffer = Number(financeSettings.shippingBuffer || 0);

  // 2. Aggregate weight and dimensions for all items
  let totalWeight = 0;
  let maxLength = 10;
  let maxBreadth = 10;
  let maxHeight = 10;
  let totalValue = 0;

  const itemsForWarehouse = [];

  for (const item of items) {
    const pid = String(item.productId || item.product);
    const product = productMap.get(pid);
    const qty = Number(item.quantity || 1);

    if (!product) {
      logger.warn(`[ShippingRate] Product ${pid} not found in DB during shipping calc`);
      continue;
    }

    const itemWeight = product.shippingWeight
      ? Number(product.shippingWeight)
      : defaultWeight;
    totalWeight += itemWeight * qty;

    if (product.shippingLength) maxLength = Math.max(maxLength, Number(product.shippingLength));
    if (product.shippingBreadth) maxBreadth = Math.max(maxBreadth, Number(product.shippingBreadth));
    if (product.shippingHeight) maxHeight = Math.max(maxHeight, Number(product.shippingHeight));

    const price = Number(product.salePrice || product.price || 0);
    totalValue += price * qty;

    itemsForWarehouse.push({ productId: pid, quantity: qty });
  }

  // Ensure minimum weight
  if (totalWeight <= 0) totalWeight = defaultWeight;

  // 3. Find best fulfilment warehouse
  const warehouse = await findBestWarehouseForCheckout(itemsForWarehouse);

  if (!warehouse) {
    const err = new Error("Products are currently out of stock at all warehouses.");
    err.statusCode = 422;
    throw err;
  }

  const warehousePincode = extractPincode(warehouse.pincode);
  if (!warehousePincode || warehousePincode.length !== 6) {
    logger.error(
      `[ShippingRate] Warehouse ${warehouse._id} (${warehouse.warehouseName}) has invalid pincode: ${warehouse.pincode}`
    );
    const err = new Error("Delivery charges could not be calculated right now. Please try again.");
    err.statusCode = 500;
    throw err;
  }

  // 4. Check local delivery
  const localCheck = isLocalDelivery(warehouse, cleanPincode, customerCity);

  if (localCheck.isLocal) {
    logger.info(
      `[ShippingRate] Local delivery detected: warehouse=${warehouse.warehouseName} ` +
      `city=${localCheck.warehouseCity} method=${localCheck.method} ` +
      `customerPin=${cleanPincode}`
    );

    return {
      shippingCharge: 0,
      shippingRateSource: "local_free",
      isLocalDelivery: true,
      fulfillmentWarehouse: {
        id: warehouse._id,
        name: warehouse.warehouseName || warehouse.name,
        city: warehouse.city,
        pincode: warehouse.pincode,
      },
      courierInfo: null,
      totalWeight,
      calculatedAt: new Date(),
    };
  }

  // 5. Not local — call Shiprocket
  try {
    const rateResult = await calculateShippingRate({
      originPincode: warehousePincode,
      destinationPincode: cleanPincode,
      weight: totalWeight,
      length: maxLength,
      breadth: maxBreadth,
      height: maxHeight,
      paymentMode,
      totalValue,
    });

    const finalCharge = Math.max(0, rateResult.rate + shippingBuffer);

    logger.info(
      `[ShippingRate] Shiprocket rate: ₹${rateResult.rate} + buffer ₹${shippingBuffer} = ₹${finalCharge} ` +
      `(origin=${warehousePincode} dest=${cleanPincode} weight=${totalWeight}kg courier=${rateResult.courierName})`
    );

    return {
      shippingCharge: finalCharge,
      shippingRateSource: "shiprocket",
      isLocalDelivery: false,
      fulfillmentWarehouse: {
        id: warehouse._id,
        name: warehouse.warehouseName || warehouse.name,
        city: warehouse.city,
        pincode: warehouse.pincode,
      },
      courierInfo: {
        name: rateResult.courierName,
        codCharges: rateResult.codCharges,
        etdHours: rateResult.etdHours,
        baseRate: rateResult.rate,
        bufferApplied: shippingBuffer,
      },
      totalWeight,
      calculatedAt: new Date(),
    };
  } catch (err) {
    // Re-throw known user-facing errors
    if (err.statusCode === 400 || err.statusCode === 422) {
      throw err;
    }

    logger.error(
      `[ShippingRate] Shiprocket rate calculation failed: ${err.message} ` +
      `(origin=${warehousePincode} dest=${cleanPincode})`
    );

    const userErr = new Error(
      "Delivery charges could not be calculated right now. Please try again."
    );
    userErr.statusCode = 503;
    throw userErr;
  }
}

export default {
  isLocalDelivery,
  calculateShippingRate,
  calculateCheckoutShipping,
  findBestWarehouseForCheckout,
};
