import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { addToCartSchema, updateCartItemSchema, mergeCartSchema } from "../app/validation/cartValidation.js";
import { checkoutPreviewSchema, createFinanceOrderSchema } from "../app/validation/financeValidation.js";

describe("Business Rule: Maximum 10 Units Per Product", () => {
  describe("cartValidation Schemas", () => {
    const validProductId = "67f000000000000000000011";

    it("TEST 7: allows quantity = 10 in addToCartSchema", () => {
      const { error, value } = addToCartSchema.validate({
        productId: validProductId,
        quantity: 10,
      });
      expect(error).toBeUndefined();
      expect(value.quantity).toBe(10);
    });

    it("TEST 8: rejects quantity = 11 in addToCartSchema", () => {
      const { error } = addToCartSchema.validate({
        productId: validProductId,
        quantity: 11,
      });
      expect(error).toBeDefined();
      expect(error.message).toMatch(/less than or equal to 10/i);
    });

    it("TEST 9: rejects quantity = 20 in addToCartSchema", () => {
      const { error } = addToCartSchema.validate({
        productId: validProductId,
        quantity: 20,
      });
      expect(error).toBeDefined();
    });

    it("TEST 10: rejects quantity = 100 in addToCartSchema", () => {
      const { error } = addToCartSchema.validate({
        productId: validProductId,
        quantity: 100,
      });
      expect(error).toBeDefined();
    });

    it("rejects invalid quantity (0, negative, non-integer) in addToCartSchema", () => {
      expect(addToCartSchema.validate({ productId: validProductId, quantity: 0 }).error).toBeDefined();
      expect(addToCartSchema.validate({ productId: validProductId, quantity: -1 }).error).toBeDefined();
      expect(addToCartSchema.validate({ productId: validProductId, quantity: 2.5 }).error).toBeDefined();
    });

    it("allows quantity = 10 in updateCartItemSchema", () => {
      const { error } = updateCartItemSchema.validate({
        productId: validProductId,
        quantity: 10,
      });
      expect(error).toBeUndefined();
    });

    it("rejects quantity = 11 in updateCartItemSchema", () => {
      const { error } = updateCartItemSchema.validate({
        productId: validProductId,
        quantity: 11,
      });
      expect(error).toBeDefined();
      expect(error.message).toMatch(/less than or equal to 10/i);
    });

    it("allows quantity = 0 (removal) in updateCartItemSchema", () => {
      const { error } = updateCartItemSchema.validate({
        productId: validProductId,
        quantity: 0,
      });
      expect(error).toBeUndefined();
    });

    it("rejects quantity > 10 in mergeCartSchema", () => {
      const { error } = mergeCartSchema.validate({
        items: [{ productId: validProductId, quantity: 11 }],
      });
      expect(error).toBeDefined();
    });
  });

  describe("financeValidation (Order and Checkout Preview) Schemas", () => {
    const validAddress = {
      name: "Customer",
      address: "123 Street",
      city: "City",
      phone: "9999999999",
    };

    it("TEST 7 & 17: allows quantity = 10 per product in checkoutPreviewSchema", () => {
      const { error } = checkoutPreviewSchema.validate({
        items: [{ productId: "p1", quantity: 10 }],
        address: validAddress,
      });
      expect(error).toBeUndefined();
    });

    it("TEST 8 & 17: rejects quantity = 11 in checkoutPreviewSchema", () => {
      const { error } = checkoutPreviewSchema.validate({
        items: [{ productId: "p1", quantity: 11 }],
        address: validAddress,
      });
      expect(error).toBeDefined();
      expect(error.message).toMatch(/less than or equal to 10/i);
    });

    it("TEST 14 & 18: allows Product A = 10 and Product B = 10 (multivendor / multi-product)", () => {
      const { error } = checkoutPreviewSchema.validate({
        items: [
          { productId: "prod-A", quantity: 10 },
          { productId: "prod-B", quantity: 10 },
          { productId: "prod-C", quantity: 5 },
        ],
        address: validAddress,
      });
      expect(error).toBeUndefined();
    });

    it("TEST 16 & 17: rejects order creation when any item quantity > 10", () => {
      const { error } = createFinanceOrderSchema.validate({
        items: [{ productId: "p1", quantity: 11 }],
        address: validAddress,
        paymentMode: "COD",
      });
      expect(error).toBeDefined();
      expect(error.message).toMatch(/less than or equal to 10/i);
    });
  });
});
