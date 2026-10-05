import Cart from "../models/cart.js";
import Product from "../models/product.js";
import handleResponse from "../utils/helper.js";
import { getApprovedOrLegacyFilter } from "../services/productModerationService.js";
import { getProductWarehouseAvailability } from "../services/customerVisibilityService.js";

const CART_POPULATE_FIELDS =
  "name slug price salePrice mainImage stock status headerId categoryId subcategoryId sellerId variants";

const CUSTOMER_VISIBLE_PRODUCT_MATCH = {
  status: "active",
  ...getApprovedOrLegacyFilter(),
};

function sanitizeCartItems(cart) {
  if (!cart || !Array.isArray(cart.items)) return cart;
  cart.items = cart.items.filter((item) => Boolean(item?.productId));
  return cart;
}

async function getCustomerVisibleProductById(productId) {
  if (!productId) return null;
  return Product.findOne({
    _id: productId,
    ...CUSTOMER_VISIBLE_PRODUCT_MATCH,
  })
    .select("_id name price salePrice stock status variants")
    .lean();
}

async function enrichCartWithAvailability(cart) {
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) return cart;
  const productIds = cart.items
    .map((item) => item?.productId?._id || item?.productId)
    .filter(Boolean);

  if (productIds.length === 0) return cart;
  const availabilityMap = await getProductWarehouseAvailability(productIds);

  for (const item of cart.items) {
    if (!item?.productId) continue;
    const pId = String(item.productId._id || item.productId);
    const avail = availabilityMap.get(pId);
    const effectiveStock = avail ? avail.availableStock : (item.productId.stock ?? 0);
    if (typeof item.productId === "object") {
      item.productId.stock = effectiveStock;
      item.productId.availableStock = effectiveStock;
      item.productId.isAvailable = effectiveStock > 0;
      item.productId.isOutOfStock = effectiveStock <= 0;
      item.productId.stockStatus = avail
        ? avail.stockStatus
        : effectiveStock <= 0
        ? "out_of_stock"
        : "in_stock";
    }
    item.availableStock = effectiveStock;
    item.isOutOfStock = effectiveStock <= 0 || effectiveStock < Number(item.quantity || 0);
  }
  return cart;
}

async function fetchPopulatedCart(cartId) {
  const cart = await Cart.findById(cartId)
    .populate({
      path: "items.productId",
      select: CART_POPULATE_FIELDS,
      match: CUSTOMER_VISIBLE_PRODUCT_MATCH,
    })
    .lean();

  const sanitized = sanitizeCartItems(cart);
  return enrichCartWithAvailability(sanitized);
}

/* ===============================
   GET CUSTOMER CART
================================ */
export const getCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    let cart = await Cart.findOne({ customerId })
      .populate({
        path: "items.productId",
        select: CART_POPULATE_FIELDS,
        match: CUSTOMER_VISIBLE_PRODUCT_MATCH,
      })
      .lean();

    if (!cart) {
      const newCart = await Cart.create({ customerId, items: [] });
      return handleResponse(res, 200, "Cart fetched successfully", newCart);
    }

    const sanitized = sanitizeCartItems(cart);
    const enriched = await enrichCartWithAvailability(sanitized);
    return handleResponse(res, 200, "Cart fetched successfully", enriched);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

const MAX_PRODUCT_QUANTITY = 10;

/* ===============================
   ADD TO CART
================================ */
export const addToCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId, quantity = 1, variantSku = "" } = req.body;
    const normalizedVariantSku = String(variantSku || "").trim();
    const customerVisibleProduct = await getCustomerVisibleProductById(productId);
    if (!customerVisibleProduct) {
      return handleResponse(res, 404, "Product is not available for purchase");
    }

    const requestedQty = Number(quantity || 1);
    if (!Number.isInteger(requestedQty) || requestedQty <= 0) {
      return handleResponse(res, 400, "Invalid quantity");
    }
    if (requestedQty > MAX_PRODUCT_QUANTITY) {
      return handleResponse(
        res,
        400,
        `Maximum ${MAX_PRODUCT_QUANTITY} units of this product can be ordered.`,
      );
    }

    // Validate available stock before adding
    const availabilityMap = await getProductWarehouseAvailability([productId]);
    const avail = availabilityMap.get(String(productId));
    const effectiveStock = avail ? avail.availableStock : (customerVisibleProduct.stock ?? 0);

    if (effectiveStock <= 0) {
      return handleResponse(res, 400, "Insufficient stock: Product is currently out of stock");
    }

    if (normalizedVariantSku && Array.isArray(customerVisibleProduct.variants) && customerVisibleProduct.variants.length > 0) {
      const variant = customerVisibleProduct.variants.find(
        (v) => String(v.sku || "").trim() === normalizedVariantSku || String(v.name || "").trim() === normalizedVariantSku,
      );
      if (variant && typeof variant.stock === "number" && variant.stock <= 0) {
        return handleResponse(res, 400, `Insufficient stock: Selected variant (${variant.name || normalizedVariantSku}) is out of stock`);
      }
    }

    let cart = await Cart.findOne({ customerId });

    if (!cart) {
      cart = new Cart({ customerId, items: [] });
    }

    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId &&
        item.productId.toString() === productId &&
        String(item.variantSku || "").trim() === normalizedVariantSku,
    );

    const currentQty = itemIndex > -1 ? Number(cart.items[itemIndex].quantity || 0) : 0;
    const targetQty = currentQty + requestedQty;

    if (targetQty > MAX_PRODUCT_QUANTITY) {
      return handleResponse(
        res,
        400,
        currentQty > 0
          ? `Cannot add ${requestedQty} more. Maximum ${MAX_PRODUCT_QUANTITY} units of this product can be ordered.`
          : `Maximum ${MAX_PRODUCT_QUANTITY} units of this product can be ordered.`,
      );
    }

    if (targetQty > effectiveStock) {
      return handleResponse(
        res,
        400,
        `Cannot add ${requestedQty} more. Only ${effectiveStock} item(s) available in stock.`,
      );
    }

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = targetQty;
    } else {
      cart.items.push({ productId, variantSku: normalizedVariantSku, quantity: requestedQty });
    }

    await cart.save();
    const updatedCart = await fetchPopulatedCart(cart._id);

    return handleResponse(res, 200, "Item added to cart", updatedCart);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   UPDATE QUANTITY
================================ */
export const updateQuantity = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId, quantity, variantSku = "" } = req.body;
    const normalizedVariantSku = String(variantSku || "").trim();

    const targetQty = Number(quantity);
    if (!Number.isInteger(targetQty) || targetQty < 0) {
      return handleResponse(res, 400, "Invalid quantity");
    }
    if (targetQty > MAX_PRODUCT_QUANTITY) {
      return handleResponse(
        res,
        400,
        `Maximum ${MAX_PRODUCT_QUANTITY} units of this product can be ordered.`,
      );
    }

    let cart = await Cart.findOne({ customerId });

    if (!cart) {
      return handleResponse(res, 404, "Cart not found");
    }

    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId &&
        item.productId.toString() === productId &&
        String(item.variantSku || "").trim() === normalizedVariantSku,
    );

    if (itemIndex > -1) {
      if (targetQty <= 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        const customerVisibleProduct = await getCustomerVisibleProductById(productId);
        if (!customerVisibleProduct) {
          return handleResponse(res, 404, "Product is not available for purchase");
        }
        const availabilityMap = await getProductWarehouseAvailability([productId]);
        const avail = availabilityMap.get(String(productId));
        const effectiveStock = avail ? avail.availableStock : (customerVisibleProduct.stock ?? 0);

        if (effectiveStock <= 0) {
          return handleResponse(res, 400, "Insufficient stock: Product is currently out of stock");
        }
        if (targetQty > effectiveStock) {
          return handleResponse(
            res,
            400,
            `Insufficient stock: Cannot set quantity to ${targetQty}. Only ${effectiveStock} item(s) available in stock.`,
          );
        }
        cart.items[itemIndex].quantity = targetQty;
      }
    } else {
      return handleResponse(res, 404, "Product not in cart");
    }

    cart.markModified("items");
    await cart.save();
    const updatedCart = await fetchPopulatedCart(cart._id);

    return handleResponse(res, 200, "Cart updated successfully", updatedCart);
  } catch (error) {
    console.error("CRITICAL BACKEND ERROR IN updateQuantity:", error);
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   REMOVE FROM CART
================================ */
export const removeFromCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId } = req.params;
    const normalizedVariantSku = String(req.query?.variantSku || "").trim();

    let cart = await Cart.findOne({ customerId });

    if (!cart) {
      return handleResponse(res, 404, "Cart not found");
    }

    cart.items = cart.items.filter((item) => {
      if (!item.productId) return false;
      if (item.productId.toString() !== productId) return true;
      // If variantSku is provided, remove only that variant line.
      if (normalizedVariantSku) {
        return String(item.variantSku || "").trim() !== normalizedVariantSku;
      }
      // If no variantSku is provided, keep legacy behavior: remove all lines for that product.
      return false;
    });

    cart.markModified("items");
    await cart.save();
    const updatedCart = await fetchPopulatedCart(cart._id);

    return handleResponse(res, 200, "Item removed from cart", updatedCart);
  } catch (error) {
    console.error("CRITICAL BACKEND ERROR IN removeFromCart:", error);
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   CLEAR CART
================================ */
export const clearCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    let cart = await Cart.findOne({ customerId });

    if (cart) {
      cart.items = [];
      await cart.save();
    }

    return handleResponse(res, 200, "Cart cleared successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
