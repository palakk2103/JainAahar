import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockCartSave = jest.fn();
const mockCartFindOne = jest.fn();
const mockCartFindById = jest.fn();
const mockProductFindOne = jest.fn();
const mockGetProductWarehouseAvailability = jest.fn();

class MockCart {
  constructor(data) {
    Object.assign(this, data);
    this.save = mockCartSave;
    this.markModified = jest.fn();
  }
}
MockCart.findOne = mockCartFindOne;
MockCart.findById = mockCartFindById;

jest.unstable_mockModule("../app/models/cart.js", () => ({
  default: MockCart,
}));

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    findOne: mockProductFindOne,
  },
}));

jest.unstable_mockModule("../app/services/customerVisibilityService.js", () => ({
  getProductWarehouseAvailability: mockGetProductWarehouseAvailability,
}));

const { addToCart, updateQuantity } = await import(
  "../app/controller/cartController.js"
);

describe("cartController 10-unit Limit & Stock Integration", () => {
  let mockRes;
  let responseData;
  const productId = "67f000000000000000000011";

  beforeEach(() => {
    jest.clearAllMocks();
    responseData = null;
    mockRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        responseData = { statusCode: this.statusCode, ...payload };
        return this;
      },
    };

    mockProductFindOne.mockReturnValue({
      select: () => ({
        lean: async () => ({
          _id: productId,
          name: "Organic Apples",
          price: 100,
          stock: 100,
          status: "active",
        }),
      }),
    });

    mockGetProductWarehouseAvailability.mockResolvedValue(
      new Map([[productId, { availableStock: 100, stockStatus: "in_stock" }]])
    );

    mockCartFindById.mockReturnValue({
      populate: () => ({
        lean: async () => ({
          _id: "cart-1",
          items: [{ productId: { _id: productId, stock: 100 }, quantity: 1 }],
        }),
      }),
    });
  });

  describe("addToCart", () => {
    it("TEST 7: allows adding quantity = 10 when stock >= 10", async () => {
      mockCartFindOne.mockResolvedValue(new MockCart({ customerId: "u1", items: [] }));
      const req = {
        user: { id: "u1" },
        body: { productId, quantity: 10 },
      };

      await addToCart(req, mockRes);
      expect(responseData.statusCode).toBe(200);
      expect(mockCartSave).toHaveBeenCalled();
    });

    it("TEST 8: rejects quantity = 11 with 400", async () => {
      mockCartFindOne.mockResolvedValue(new MockCart({ customerId: "u1", items: [] }));
      const req = {
        user: { id: "u1" },
        body: { productId, quantity: 11 },
      };

      await addToCart(req, mockRes);
      expect(responseData.statusCode).toBe(400);
      expect(responseData.message).toMatch(/Maximum 10 units of this product can be ordered/);
      expect(mockCartSave).not.toHaveBeenCalled();
    });

    it("TEST 9 & 10: rejects quantity = 20 and quantity = 100", async () => {
      mockCartFindOne.mockResolvedValue(new MockCart({ customerId: "u1", items: [] }));
      const req20 = { user: { id: "u1" }, body: { productId, quantity: 20 } };
      await addToCart(req20, mockRes);
      expect(responseData.statusCode).toBe(400);

      const req100 = { user: { id: "u1" }, body: { productId, quantity: 100 } };
      await addToCart(req100, mockRes);
      expect(responseData.statusCode).toBe(400);
    });

    it("TEST 11: Stock = 5, Quantity = 5 -> allowed", async () => {
      mockGetProductWarehouseAvailability.mockResolvedValue(
        new Map([[productId, { availableStock: 5, stockStatus: "in_stock" }]])
      );
      mockCartFindOne.mockResolvedValue(new MockCart({ customerId: "u1", items: [] }));
      const req = { user: { id: "u1" }, body: { productId, quantity: 5 } };

      await addToCart(req, mockRes);
      expect(responseData.statusCode).toBe(200);
    });

    it("TEST 12: Stock = 5, Quantity = 6 -> rejected because stock is only 5", async () => {
      mockGetProductWarehouseAvailability.mockResolvedValue(
        new Map([[productId, { availableStock: 5, stockStatus: "in_stock" }]])
      );
      mockCartFindOne.mockResolvedValue(new MockCart({ customerId: "u1", items: [] }));
      const req = { user: { id: "u1" }, body: { productId, quantity: 6 } };

      await addToCart(req, mockRes);
      expect(responseData.statusCode).toBe(400);
      expect(responseData.message).toMatch(/Only 5 item\(s\) available in stock/);
    });

    it("TEST 13: Stock = 500, Quantity = 10 -> allowed", async () => {
      mockGetProductWarehouseAvailability.mockResolvedValue(
        new Map([[productId, { availableStock: 500, stockStatus: "in_stock" }]])
      );
      mockCartFindOne.mockResolvedValue(new MockCart({ customerId: "u1", items: [] }));
      const req = { user: { id: "u1" }, body: { productId, quantity: 10 } };

      await addToCart(req, mockRes);
      expect(responseData.statusCode).toBe(200);
    });

    it("TEST 15: Product A already quantity 8 + add 3 = 11 -> rejected (must NOT produce quantity 11)", async () => {
      mockCartFindOne.mockResolvedValue(
        new MockCart({
          customerId: "u1",
          items: [{ productId, quantity: 8, variantSku: "" }],
        })
      );
      const req = { user: { id: "u1" }, body: { productId, quantity: 3 } };

      await addToCart(req, mockRes);
      expect(responseData.statusCode).toBe(400);
      expect(responseData.message).toMatch(/Maximum 10 units of this product can be ordered/);
      expect(mockCartSave).not.toHaveBeenCalled();
    });

    it("Product A already quantity 9 + add 1 = 10 -> allowed", async () => {
      const existingCart = new MockCart({
        customerId: "u1",
        items: [{ productId, quantity: 9, variantSku: "" }],
      });
      mockCartFindOne.mockResolvedValue(existingCart);
      const req = { user: { id: "u1" }, body: { productId, quantity: 1 } };

      await addToCart(req, mockRes);
      expect(responseData.statusCode).toBe(200);
      expect(existingCart.items[0].quantity).toBe(10);
    });
  });

  describe("updateQuantity", () => {
    it("TEST 4: rejects updating quantity to 11", async () => {
      const existingCart = new MockCart({
        customerId: "u1",
        items: [{ productId, quantity: 10, variantSku: "" }],
      });
      mockCartFindOne.mockResolvedValue(existingCart);
      const req = { user: { id: "u1" }, body: { productId, quantity: 11 } };

      await updateQuantity(req, mockRes);
      expect(responseData.statusCode).toBe(400);
      expect(responseData.message).toMatch(/Maximum 10 units of this product can be ordered/);
    });

    it("TEST 5: allows decrementing quantity from 10 to 9", async () => {
      const existingCart = new MockCart({
        customerId: "u1",
        items: [{ productId, quantity: 10, variantSku: "" }],
      });
      mockCartFindOne.mockResolvedValue(existingCart);
      const req = { user: { id: "u1" }, body: { productId, quantity: 9 } };

      await updateQuantity(req, mockRes);
      expect(responseData.statusCode).toBe(200);
      expect(existingCart.items[0].quantity).toBe(9);
    });

    it("allows updating to 0 to remove item", async () => {
      const existingCart = new MockCart({
        customerId: "u1",
        items: [{ productId, quantity: 1, variantSku: "" }],
      });
      mockCartFindOne.mockResolvedValue(existingCart);
      const req = { user: { id: "u1" }, body: { productId, quantity: 0 } };

      await updateQuantity(req, mockRes);
      expect(responseData.statusCode).toBe(200);
      expect(existingCart.items.length).toBe(0);
    });
  });
});
