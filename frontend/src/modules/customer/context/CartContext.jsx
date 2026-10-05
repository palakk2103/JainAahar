import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { customerApi } from "../services/customerApi";
import { useAuth } from "../../../core/context/AuthContext";
import { getJSON, setJSON, remove as removeStorage, STORAGE_KEYS } from "@core/utils/storage";

const CartContext = createContext(null);

const loadGuestCart = () => {
  const parsed = getJSON(STORAGE_KEYS.CART, []);
  if (!Array.isArray(parsed)) {
    removeStorage(STORAGE_KEYS.CART);
    return [];
  }
  return parsed;
};

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState(() => loadGuestCart());

  const [loading, setLoading] = useState(false);
  const pendingRequestsRef = React.useRef(0);
  const lsDebounceRef = useRef(null);

  // Clear cart locally when user logs out is handled by the useEffect dependency on isAuthenticated
  const normalizeBackendCart = (items) => {
    if (!items) return [];
    return items.map((item) => {
      const product = item.productId;
      const variantKey = String(item.variantSku || "").trim();
      const { price, salePrice, variantName } = resolveVariantPricing(product, variantKey);
      const stock = product?.stock !== undefined ? Number(product.stock) : item.availableStock !== undefined ? Number(item.availableStock) : undefined;
      const availableStock = product?.availableStock !== undefined ? Number(product.availableStock) : stock;
      const isOutOfStock = Boolean(
        item.isOutOfStock === true ||
        product?.isOutOfStock === true ||
        product?.stockStatus === "out_of_stock" ||
        (typeof availableStock === "number" && availableStock <= 0) ||
        (typeof stock === "number" && stock <= 0)
      );

      return {
        ...product,
        id: product?._id ? String(product._id) : "", // Normalize ID to string
        quantity: item.quantity,
        variantSku: variantKey,
        variantName,
        price,
        salePrice,
        image: product?.mainImage, // Handle mapping for frontend
        stock,
        availableStock,
        isOutOfStock,
        stockStatus: isOutOfStock ? "out_of_stock" : (product?.stockStatus || "in_stock"),
      };
    });
  };

  const resolveVariantPricing = (product, variantSku = "") => {
    const normalizedKey = String(variantSku || "").trim();
    if (!normalizedKey) {
      return {
        price: Number(product?.price || 0),
        salePrice: Number(product?.salePrice || 0),
        variantName: "",
      };
    }

    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const hit = variants.find((v) => {
      const sku = String(v?.sku || "").trim();
      const name = String(v?.name || "").trim();
      return (sku && sku === normalizedKey) || (!sku && name === normalizedKey) || name === normalizedKey;
    });
    return {
      price: Number(hit?.price || product?.price || 0),
      salePrice: Number(hit?.salePrice || 0),
      variantName: String(hit?.name || "").trim(),
    };
  };

  const syncCart = (backendItems) => {
    console.log("DEBUG: syncCart backendItems:", backendItems);
    // Only update state from backend if no more pending optimistic updates
    if (pendingRequestsRef.current === 0) {
      const normalized = normalizeBackendCart(backendItems);
      console.log("DEBUG: syncCart setting normalized cart:", normalized);
      setCart(normalized);
    } else {
      console.log("DEBUG: syncCart skipped due to pending optimistic updates:", pendingRequestsRef.current);
    }
  };

  const fetchCart = async () => {
    if (isAuthenticated) {
      setLoading(true);
      try {
        const response = await customerApi.getCart();
        const normalized = normalizeBackendCart(response.data.result.items);
        console.log("DEBUG: fetchCart loaded:", normalized);
        setCart(normalized);
      } catch (error) {
        console.error("Failed to fetch cart from backend", error);
      } finally {
        setLoading(false);
      }
    }
  };

  // Fetch cart from backend on mount or authentication change
  useEffect(() => {
    if (isAuthenticated) {
      // Cancel any pending guest-mode write that could otherwise overwrite
      // the authenticated state with stale guest data after login.
      clearTimeout(lsDebounceRef.current);
      // The legacy guest cart is no longer authoritative for this user; drop
      // it so a future logout doesn't resurface another account's items.
      removeStorage(STORAGE_KEYS.CART);
      fetchCart();
    } else {
      setCart(loadGuestCart());
    }
  }, [isAuthenticated]);

  // Save local cart to localStorage (fallback/guest mode) — debounced to 300 ms
  useEffect(() => {
    if (isAuthenticated) return;           // backend is source of truth

    clearTimeout(lsDebounceRef.current);
    lsDebounceRef.current = setTimeout(() => {
      setJSON(STORAGE_KEYS.CART, cart);
    }, 300);

    return () => {
      if (isAuthenticated) return;
      // Flush on unmount — no data loss
      clearTimeout(lsDebounceRef.current);
      setJSON(STORAGE_KEYS.CART, cart);
    };
  }, [cart, isAuthenticated]);

  const MAX_PRODUCT_QUANTITY = 10;

  const addToCart = async (product) => {
    const isOutOfStock = Boolean(
      product?.isOutOfStock === true ||
      product?.stockStatus === "out_of_stock" ||
      (product?.stock !== undefined && product?.stock !== null && Number(product.stock) <= 0) ||
      (product?.availableStock !== undefined && product?.availableStock !== null && Number(product.availableStock) <= 0)
    );

    if (isOutOfStock) {
      console.warn("Blocked attempt to add out of stock product:", product?.name || product?.id);
      return false;
    }

    const variantSku = String(product?.variantSku || product?.variantName || "").trim();
    const id = product.id || product._id;
    const key = `${id}::${variantSku || ""}`;
    console.log("DEBUG: addToCart product:", { id, name: product?.name, variantSku, key });

    const existingItem = cart.find(
      (item) => `${item.id || item._id}::${String(item.variantSku || "").trim()}` === key,
    );
    const currentQty = existingItem ? Number(existingItem.quantity || 0) : 0;
    const requestedQty = Math.max(1, Number(product?.quantity || 1));

    if (currentQty >= MAX_PRODUCT_QUANTITY || currentQty + requestedQty > MAX_PRODUCT_QUANTITY) {
      toast.warning(`Maximum ${MAX_PRODUCT_QUANTITY} units of this product can be ordered.`);
      return false;
    }

    const effectiveStock =
      product?.availableStock !== undefined
        ? Number(product.availableStock)
        : product?.stock !== undefined
        ? Number(product.stock)
        : existingItem?.availableStock !== undefined
        ? Number(existingItem.availableStock)
        : existingItem?.stock !== undefined
        ? Number(existingItem.stock)
        : undefined;

    if (
      typeof effectiveStock === "number" &&
      effectiveStock > 0 &&
      currentQty + requestedQty > effectiveStock
    ) {
      toast.warning(`Only ${effectiveStock} item(s) available in stock.`);
      return false;
    }

    const { price, salePrice, variantName } = resolveVariantPricing(product, variantSku);

    // Optimistic UI update for instant feedback
    setCart((prev) => {
      const itemInPrev = prev.find(
        (item) => `${item.id || item._id}::${String(item.variantSku || "").trim()}` === key,
      );
      if (itemInPrev) {
        console.log("DEBUG: addToCart existing item incrementing");
        return prev.map((item) =>
          `${item.id || item._id}::${String(item.variantSku || "").trim()}` === key
            ? { ...item, quantity: Math.min(MAX_PRODUCT_QUANTITY, item.quantity + requestedQty) }
            : item,
        );
      }

      console.log("DEBUG: addToCart new item adding");
      return [
        ...prev,
        {
          ...product,
          id,
          variantSku,
          variantName,
          price,
          salePrice,
          quantity: Math.min(MAX_PRODUCT_QUANTITY, requestedQty),
          image: product.image || product.mainImage,
        },
      ];
    });

    if (isAuthenticated) {
      pendingRequestsRef.current += 1;
      try {
        const response = await customerApi.addToCart({
          productId: id,
          variantSku,
          quantity: requestedQty,
        });
        pendingRequestsRef.current -= 1;
        await syncCart(response.data.result.items);
      } catch (error) {
        pendingRequestsRef.current -= 1;
        console.error("Error adding to cart on backend", error);
        const errorMsg = error?.response?.data?.message || "Failed to add to cart";
        toast.error(errorMsg);
        // Re-fetch entire cart to ensure consistency on error
        if (pendingRequestsRef.current === 0) {
          await fetchCart();
        }
      }
    }
  };

  const removeFromCart = async (productId, variantSku = "") => {
    const normalizedVariantSku = String(variantSku || "").trim();
    const key = `${productId}::${normalizedVariantSku || ""}`;

    // Optimistic update (remove only the matching line when variantSku is provided).
    setCart((prev) =>
      prev.filter(
        (item) =>
          `${item.id || item._id}::${String(item.variantSku || "").trim()}` !==
          key,
      ),
    );

    if (isAuthenticated) {
      pendingRequestsRef.current += 1;
      try {
        const response = await customerApi.removeFromCart(
          productId,
          normalizedVariantSku,
        );
        pendingRequestsRef.current -= 1;
        await syncCart(response.data.result.items);
      } catch (error) {
        pendingRequestsRef.current -= 1;
        console.error("Error removing from cart on backend", error);
        if (pendingRequestsRef.current === 0) {
          await fetchCart();
        }
      }
    }
  };

  const updateQuantity = async (productId, delta, variantSku = "") => {
    const normalizedVariantSku = String(variantSku || "").trim();
    const key = `${productId}::${normalizedVariantSku || ""}`;
    console.log("DEBUG: updateQuantity called:", { productId, delta, variantSku, key });
    const currentItem = cart.find(
      (item) =>
        `${item.id || item._id}::${String(item.variantSku || "").trim()}` === key,
    );
    if (!currentItem) {
      console.warn("DEBUG: updateQuantity currentItem NOT found in cart for key:", key);
      return;
    }

    if (delta > 0 && currentItem.isOutOfStock) {
      console.warn("Cannot increment out of stock item");
      return;
    }

    const currentQty = Number(currentItem.quantity || 0);

    if (delta > 0 && currentQty >= MAX_PRODUCT_QUANTITY) {
      toast.warning(`Maximum ${MAX_PRODUCT_QUANTITY} units of this product can be ordered.`);
      return;
    }

    const effectiveStock =
      currentItem.availableStock !== undefined
        ? Number(currentItem.availableStock)
        : currentItem.stock !== undefined
        ? Number(currentItem.stock)
        : undefined;

    if (
      delta > 0 &&
      typeof effectiveStock === "number" &&
      effectiveStock > 0 &&
      currentQty + delta > effectiveStock
    ) {
      toast.warning(`Only ${effectiveStock} item(s) available in stock.`);
      return;
    }

    const newQty = Math.min(MAX_PRODUCT_QUANTITY, Math.max(0, currentQty + delta));
    console.log("DEBUG: updateQuantity currentQty:", currentQty, "newQty:", newQty);

    if (newQty === 0) {
      removeFromCart(productId, normalizedVariantSku);
      return;
    }

    // Optimistic update
    setCart((prev) =>
      prev.map((item) => {
        if (
          `${item.id || item._id}::${String(item.variantSku || "").trim()}` ===
          key
        ) {
          return { ...item, quantity: newQty };
        }
        return item;
      }),
    );

    if (isAuthenticated) {
      pendingRequestsRef.current += 1;
      try {
        const response = await customerApi.updateCartQuantity({
          productId,
          quantity: newQty,
          variantSku: normalizedVariantSku,
        });
        pendingRequestsRef.current -= 1;
        await syncCart(response.data.result.items);
      } catch (error) {
        pendingRequestsRef.current -= 1;
        console.error("Error updating quantity on backend", error);
        const errorMsg = error?.response?.data?.message || "Failed to update quantity";
        toast.error(errorMsg);
        if (pendingRequestsRef.current === 0) {
          await fetchCart();
        }
      }
    }
  };

  const clearCart = async () => {
    if (isAuthenticated) {
      try {
        await customerApi.clearCart();
        setCart([]);
      } catch (error) {
        console.error("Error clearing cart on backend", error);
      }
    } else {
      setCart([]);
    }
  };

  const cartTotal = cart.reduce((total, item) => {
    const unit =
      Number(item.salePrice || 0) > 0 && Number(item.salePrice) < Number(item.price || 0)
        ? Number(item.salePrice)
        : Number(item.price || 0);
    return total + unit * Number(item.quantity || 0);
  }, 0);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const cartValue = useMemo(() => ({
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartTotal,
    cartCount,
    loading,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [cart, cartTotal, cartCount, loading]);

  return (
    <CartContext.Provider value={cartValue}>
      {children}
    </CartContext.Provider>
  );
};
