import axiosInstance from "@core/api/axios";
import { getWithDedupe, invalidateCache } from "@core/api/dedupe";

export const customerApi = {
  sendLoginOtp: (data) => axiosInstance.post("/customer/send-login-otp", data),
  sendSignupOtp: (data) =>
    axiosInstance.post("/customer/send-signup-otp", data),
  verifyOtp: (data) => axiosInstance.post("/customer/verify-otp", data),
  getProfile: () => getWithDedupe("/customer/profile", {}, { ttl: 5000 }), // Short cache for profile
  updateProfile: (data) => {
    invalidateCache("/customer/profile");
    return axiosInstance.put("/customer/profile", data);
  },
  uploadAvatar: (formData) =>
    axiosInstance.post("/media/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  uploadMedia: (formData) =>
    axiosInstance.post("/media/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteAccount: () => {
    invalidateCache("/customer/profile");
    return axiosInstance.delete("/customer/profile");
  },
  getWhatsAppPreferences: () => axiosInstance.get("/customer/whatsapp/preferences"),
  updateWhatsAppPreferences: (data) => axiosInstance.put("/customer/whatsapp/preferences", data),
  getWalletTransactions: (params, options = {}) =>
    getWithDedupe("/customer/transactions", params, { ttl: 2000, ...options }),
  addWalletMoney: (data) => {
    invalidateCache("/customer/profile");
    invalidateCache("/customer/transactions");
    return axiosInstance.post("/payments/create-wallet-order", data);
  },
  getCategories: (params, options) =>
    getWithDedupe("/categories", params, { ttl: 30 * 1000, ...options }),
  getProducts: (params, options) =>
    getWithDedupe("/products", params, { ttl: 5000, ...options }),
  getProductById: (id, params, options) =>
    getWithDedupe(`/products/${id}`, params, { ttl: 5000, ...options }),

  // Sellers & Location
  getNearbySellers: (params) => getWithDedupe("/seller/nearby", params),

  // Cart
  getCart: () => getWithDedupe("/cart", {}, { ttl: 2000 }), // Very short cache for cart
  addToCart: (data) => {
    invalidateCache("/cart"); // Invalidate cart cache
    return axiosInstance.post("/cart/add", data);
  },
  updateCartQuantity: (data) => {
    invalidateCache("/cart");
    return axiosInstance.put("/cart/update", data);
  },
  removeFromCart: (productId, variantSku = "") => {
    invalidateCache("/cart");
    const params = {};
    const normalizedVariantSku = String(variantSku || "").trim();
    if (normalizedVariantSku) params.variantSku = normalizedVariantSku;
    return axiosInstance.delete(`/cart/remove/${productId}`, { params });
  },
  clearCart: () => {
    invalidateCache("/cart");
    return axiosInstance.delete("/cart/clear");
  },

  // Wishlist
  getWishlist: (params) => getWithDedupe("/wishlist", params, { ttl: 5000 }),
  addToWishlist: (data) => {
    invalidateCache("/wishlist");
    return axiosInstance.post("/wishlist/add", data);
  },
  toggleWishlist: (data) => {
    invalidateCache("/wishlist");
    return axiosInstance.post("/wishlist/toggle", data);
  },
  removeFromWishlist: (productId) => {
    invalidateCache("/wishlist");
    return axiosInstance.delete(`/wishlist/remove/${productId}`);
  },

  // Orders
  // Explicit timeout so checkout never waits forever if the server blocks (e.g. Redis/Bull).
  checkoutPreview: (data) =>
    axiosInstance.post("/orders/checkout/preview", data, { timeout: 120000 }),
  createOrder: (data) =>
    axiosInstance.post("/orders", data, { timeout: 120000 }),
  verifyOnlineOrderPayment: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/payment/verify-online`, data),
  markOrderDelivered: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/delivered`, data || {}),
  markOrderCodCollected: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/cod/mark-collected`, data || {}),
  reconcileOrderCod: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/cod/reconcile`, data),
  placeOrder: (data) =>
    axiosInstance.post("/orders/place", data, { timeout: 120000 }),
  getMyOrders: () => getWithDedupe("/orders/my-orders"),
  /**
   * Order details must reflect live workflow, but we still dedupe in-flight requests to avoid
   * network spam when multiple effects/events trigger refresh simultaneously.
   * ttl=0 means "no caching" (only in-flight dedupe).
   */
  getOrderDetails: (orderId) =>
    getWithDedupe(
      `/orders/details/${encodeURIComponent(String(orderId ?? "").trim())}`,
      {},
      { ttl: 0 },
    ),
  getOrderRoute: (orderId, params) =>
    axiosInstance.get(`/orders/workflow/${orderId}/route`, { params }),
  cancelOrder: (orderId, data) =>
    axiosInstance.put(`/orders/cancel/${orderId}`, data),
  requestReturn: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/returns`, data),
  getReturnDetails: (orderId) =>
    axiosInstance.get(`/orders/${encodeURIComponent(String(orderId ?? "").trim())}/returns`),

  // Payments
  createPaymentOrder: (data) =>
    axiosInstance.post("/payments/create-order", data),
  createWalletPaymentOrder: async (data) => {
    invalidateCache("/customer/profile");
    invalidateCache("/customer/transactions");
    try {
      return await axiosInstance.post("/payments/create-wallet-order", data);
    } catch (err) {
      if (err?.response?.status === 404) {
        try {
          return await axiosInstance.post("/customer/wallet/create-payment-order", data);
        } catch (fallbackErr1) {
          if (fallbackErr1?.response?.status === 404) {
            try {
              return await axiosInstance.post("/customer/create-wallet-order", data);
            } catch (fallbackErr2) {
              if (fallbackErr2?.response?.status === 404) {
                return await axiosInstance.post("/customer/wallet/add-money", data);
              }
              throw fallbackErr2;
            }
          }
          throw fallbackErr1;
        }
      }
      throw err;
    }
  },
  verifyPaymentStatus: (id) => axiosInstance.get(`/payments/status/${id}`),

  // Support & Reviews
  getProductReviews: (productId) =>
    getWithDedupe(`/reviews/product/${productId}`),
  submitReview: (data) => {
    invalidateCache("/reviews/product");
    return axiosInstance.post("/reviews/submit", data);
  },
  createTicket: (data) => axiosInstance.post("/tickets/create", data),
  getMyTickets: () => getWithDedupe("/tickets/my-tickets"),
  replyTicket: (ticketId, text, options = {}) => {
    const {
      mediaUrl = "",
      mediaType = "",
      mimeType = "",
    } = options || {};

    return axiosInstance.post(`/tickets/reply/${encodeURIComponent(String(ticketId))}`, {
      text,
      isAdmin: false,
      mediaUrl,
      mediaType,
      mimeType,
    });
  },

  // Experience sections (home / header pages)
  getExperienceSections: (params, options) =>
    getWithDedupe("/experience", params, { ttl: 10000, ...options }),

  // Hero config (separate hero banners + categories per page; fallback to home)
  getHeroConfig: (params, options) =>
    getWithDedupe("/experience/hero", params, { ttl: 30 * 1000, ...options }),

  // Public offers
  getOffers: (params, options) =>
    getWithDedupe("/offers", params, { ttl: 10000, ...options }),
  // Offer sections (category → products, banner + side image)
  getOfferSections: (params, options) =>
    getWithDedupe("/offer-sections", params, { ttl: 10000, ...options }),

  // Deal Sections (Today's Deals, Lowest Price Ever, Trending Products, Best Value Deals)
  getDealSections: (params, options) =>
    getWithDedupe("/deals/sections", params, { ttl: 10000, ...options }),

  // Coupons
  validateCoupon: (data) => axiosInstance.post("/coupons/validate", data),
  getActiveCoupons: () => getWithDedupe("/coupons", { status: "active" }),

  // Maps (server-side geocoding)
  geocodeAddress: (address, params = {}) =>
    axiosInstance.get("/maps/geocode", { params: { address, ...params } }),
  geocodePlaceId: (placeId, params = {}) =>
    axiosInstance.get("/maps/geocode", { params: { placeId, ...params } }),

  // Push (FCM) test
  testPushNotification: () => axiosInstance.post("/push/test"),
  getTestPushNotificationStatus: (orderId) =>
    axiosInstance.get(`/push/test-status/${encodeURIComponent(String(orderId || "").trim())}`),

  // Notifications
  getNotifications: (params) => axiosInstance.get("/notifications", { params }),
  markNotificationsRead: () => axiosInstance.patch("/notifications/read"),

  // Kits
  getKitHomeData: (params) => getWithDedupe("/kits/home-data", params),
  getKitById: (id, params) => getWithDedupe(`/kits/${id}`, params),
};
