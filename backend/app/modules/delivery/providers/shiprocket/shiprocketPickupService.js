import { shiprocketClient } from "./shiprocketClient.js";
import logger from "../../../../services/logger.js";

/**
 * Shiprocket Pickup Location Service
 * Manages pickup location registration & listing via Shiprocket API.
 *
 * API Docs:
 *   POST /settings/company/addpickup  — Register a new pickup location
 *   GET  /settings/company/pickup     — List all registered pickup locations
 */

/**
 * Formats a JainAhar Warehouse document into the Shiprocket pickup location payload.
 *
 * @param {Object} warehouse  — Mongoose warehouse document (lean or hydrated)
 * @returns {Object} Shiprocket-compatible pickup location payload
 */
export function formatWarehouseForShiprocket(warehouse) {
  if (!warehouse) throw new Error("Warehouse document is required");

  // Generate a safe pickup nickname (max 36 chars, no special chars)
  const rawName = warehouse.warehouseName || warehouse.name || warehouse.shopName || "Warehouse";
  const pickupNickname = rawName
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase()
    .slice(0, 36);

  return {
    pickup_location: pickupNickname,
    name: warehouse.name || "Warehouse Manager",
    email: warehouse.email || "warehouse@jainaahar.in",
    phone: String(warehouse.phone || "9999999999").replace(/\D/g, "").slice(-10),
    address: (warehouse.address || "Warehouse Address").slice(0, 80),
    address_2: (warehouse.locality || "").slice(0, 80),
    city: warehouse.city || "City",
    state: warehouse.state || "State",
    country: "India",
    pin_code: String(warehouse.pincode || "452001").replace(/\D/g, "").slice(0, 6),
  };
}

/**
 * Registers a new pickup location in the Shiprocket account.
 *
 * @param {Object} pickupData — Shiprocket pickup payload (from formatWarehouseForShiprocket or custom)
 * @returns {Object} Shiprocket API response
 */
export async function addPickupLocation(pickupData) {
  if (!pickupData || !pickupData.pickup_location) {
    throw new Error("pickup_location (nickname) is required");
  }

  try {
    logger.info(
      { domain: "delivery", provider: "shiprocket", pickup: pickupData.pickup_location },
      "Adding pickup location to Shiprocket"
    );

    const response = await shiprocketClient.request(
      "POST",
      "/settings/company/addpickup",
      pickupData
    );

    logger.info(
      { domain: "delivery", provider: "shiprocket", pickup: pickupData.pickup_location },
      "Pickup location registered successfully on Shiprocket"
    );

    return {
      success: true,
      pickupLocation: pickupData.pickup_location,
      pickupId: response?.pickup_id || response?.address?.pickup_id || null,
      raw: response,
    };
  } catch (err) {
    logger.error(
      {
        domain: "delivery",
        provider: "shiprocket",
        pickup: pickupData.pickup_location,
        error: err.message,
      },
      "Failed to add pickup location to Shiprocket"
    );
    throw err;
  }
}

/**
 * Lists all pickup locations currently registered on the Shiprocket account.
 *
 * @returns {Array} Array of pickup location objects
 */
export async function listPickupLocations() {
  try {
    const response = await shiprocketClient.request(
      "GET",
      "/settings/company/pickup"
    );

    // Shiprocket returns { data: { shipping_address: [...] } } or similar structures
    const addresses =
      response?.data?.shipping_address ||
      response?.shipping_address ||
      (Array.isArray(response?.data) ? response.data : []) ||
      [];

    return Array.isArray(addresses) ? addresses : [];
  } catch (err) {
    logger.error(
      { domain: "delivery", provider: "shiprocket", error: err.message },
      "Failed to list Shiprocket pickup locations"
    );
    return [];
  }
}
