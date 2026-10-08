import { jest } from "@jest/globals";
import { MINIMUM_ORDER_VALUE } from "../app/constants/finance.js";

const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  abortTransaction: jest.fn().mockResolvedValue(undefined),
  endSession: jest.fn().mockResolvedValue(undefined),
};

const mockStartSession = jest.fn().mockResolvedValue(mockSession);
const mockCheckoutGroupSave = jest.fn().mockResolvedValue(undefined);
const mockOrderSave = jest.fn().mockResolvedValue(undefined);
const mockReserveStockForItems = jest.fn().mockResolvedValue([]);
const mockBuildCheckoutPricingSnapshot = jest.fn();
const mockCheckIdempotency = jest.fn().mockResolvedValue({ exists: false });
const mockAcquireIdempotencyLock = jest.fn().mockResolvedValue(true);
const mockStoreIdempotencyResult = jest.fn().mockResolvedValue(true);
const mockReleaseIdempotencyLock = jest.fn().mockResolvedValue(true);

function mockLean(val) {
  return { lean: jest.fn().mockResolvedValue(val) };
}

const mockUserFindById = jest.fn().mockReturnValue({
  session: jest.fn().mockReturnValue(Promise.resolve({ _id: "67f0000000000000000000c1", walletBalance: 1000 })),
});

jest.unstable_mockModule("mongoose", () => {
  const SchemaMock = function() {
    return {
      index: jest.fn(),
      pre: jest.fn(),
    };
  };
  SchemaMock.Types = {
    ObjectId: function() {},
  };

  return {
    default: {
      startSession: mockStartSession,
      Schema: SchemaMock,
      isValidObjectId: jest.fn().mockReturnValue(true),
      Types: {
        ObjectId: class ObjectId {
          constructor(id) {
            this.id = id || "67f000000000000000000099";
          }
          toString() {
            return String(this.id);
          }
        },
      },
      model: jest.fn(() => ({
        index: jest.fn(),
        pre: jest.fn(),
      })),
    },
    Schema: SchemaMock,
    model: jest.fn(() => ({
      index: jest.fn(),
      pre: jest.fn(),
    })),
  };
});

jest.unstable_mockModule("../app/models/transaction.js", () => ({
  default: {
    create: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue({}),
  },
}));

jest.unstable_mockModule("../app/models/customer.js", () => ({
  default: {
    findById: mockUserFindById,
  },
}));

jest.unstable_mockModule("../app/models/cart.js", () => ({
  default: {
    findOne: jest.fn().mockReturnValue(Promise.resolve(null)),
  },
}));

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    }),
    findById: jest.fn().mockReturnValue(mockLean({ _id: "p1", warehouseId: "wh1" })),
  },
}));

jest.unstable_mockModule("../app/models/checkoutGroup.js", () => ({
  default: class MockCheckoutGroup {
    constructor(data) {
      Object.assign(this, data);
      this._id = "mock-checkout-group-id";
    }
    save() {
      return mockCheckoutGroupSave();
    }
    static findOne() {
      return mockLean(null);
    }
  },
}));

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: class MockOrder {
    constructor(data) {
      Object.assign(this, data);
      this._id = "mock-order-id";
    }
    save() {
      return mockOrderSave();
    }
    static find() {
      return {
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      };
    }
    static findOne() {
      return mockLean(null);
    }
  },
}));

jest.unstable_mockModule("../app/models/ledgerEntry.js", () => ({
  default: {
    findOne: jest.fn().mockReturnValue(Promise.resolve(null)),
  },
}));

jest.unstable_mockModule("../app/services/finance/walletService.js", () => ({
  getCustomerBalance: jest.fn().mockResolvedValue(1000),
  getOrCreateWallet: jest.fn().mockResolvedValue({ availableBalance: 1000 }),
  creditWallet: jest.fn().mockResolvedValue({}),
  debitWallet: jest.fn().mockResolvedValue({}),
}));

jest.unstable_mockModule("../app/services/finance/orderFinanceService.js", () => ({
  freezeFinancialSnapshot: jest.fn().mockResolvedValue({}),
}));

jest.unstable_mockModule("../app/services/finance/couponService.js", () => ({
  incrementCouponUsage: jest.fn().mockResolvedValue({}),
}));

jest.unstable_mockModule("../app/services/stockService.js", () => ({
  computeStockReservationWindow: jest.fn().mockReturnValue({
    reservedUntil: new Date(),
    expiresAt: new Date(Date.now() + 60000),
  }),
  reserveStockForItems: mockReserveStockForItems,
}));

jest.unstable_mockModule("../app/services/orderIdService.js", () => ({
  generateUniqueCheckoutGroupId: jest.fn().mockResolvedValue("CHK-TEST-001"),
  generateUniquePublicOrderId: jest.fn().mockResolvedValue("ORD-TEST-001"),
}));

jest.unstable_mockModule("../app/services/orderWorkflowService.js", () => ({
  afterPlaceOrderV2: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../app/services/warehouseAssignmentService.js", () => ({
  assignWarehouseToOrder: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../app/services/lowStockAlertService.js", () => ({
  isLowStockAlertsEnabled: jest.fn().mockReturnValue(false),
}));

jest.unstable_mockModule("../app/services/checkoutPricingService.js", () => ({
  buildCheckoutPricingSnapshot: mockBuildCheckoutPricingSnapshot,
}));

jest.unstable_mockModule("../app/services/idempotencyService.js", () => ({
  checkIdempotency: mockCheckIdempotency,
  acquireIdempotencyLock: mockAcquireIdempotencyLock,
  storeIdempotencyResult: mockStoreIdempotencyResult,
  releaseIdempotencyLock: mockReleaseIdempotencyLock,
  storeIdempotencyError: jest.fn().mockResolvedValue(true),
  validateIdempotencyKey: jest.fn().mockReturnValue(true),
  isRetryableError: jest.fn().mockReturnValue(false),
}));

jest.unstable_mockModule("../app/modules/notifications/notification.emitter.js", () => ({
  emitNotificationEvent: jest.fn(),
}));

const { placeOrderAtomic } = await import("../app/services/orderPlacementService.js");

describe("Minimum Order Value Validation (₹499)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupMockPricing(productSubtotal, grandTotal = productSubtotal + 20) {
    mockBuildCheckoutPricingSnapshot.mockResolvedValue({
      sellerCount: 1,
      itemCount: 1,
      aggregateBreakdown: {
        currency: "INR",
        productSubtotal,
        deliveryFeeCharged: 20,
        handlingFeeCharged: 0,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal,
        sellerPayoutTotal: productSubtotal * 0.9,
        adminProductCommissionTotal: productSubtotal * 0.1,
        riderPayoutTotal: 10,
        platformTotalEarning: 20,
        lineItems: [],
        snapshots: {},
      },
      sellerBreakdownEntries: [
        {
          sellerId: "67f000000000000000000001",
          distanceKm: 1.0,
          items: [
            {
              productId: "67f000000000000000000011",
              productName: "Item",
              quantity: 1,
              price: productSubtotal,
            },
          ],
          breakdown: {
            currency: "INR",
            productSubtotal,
            grandTotal,
            deliveryFeeCharged: 20,
            handlingFeeCharged: 0,
            discountTotal: 0,
            taxTotal: 0,
            sellerPayoutTotal: productSubtotal * 0.9,
            adminProductCommissionTotal: productSubtotal * 0.1,
            riderPayoutTotal: 10,
            platformTotalEarning: 20,
            lineItems: [],
            snapshots: {},
          },
        },
      ],
    });
  }

  const validPayload = {
    items: [{ product: "67f000000000000000000011", quantity: 1, price: 100 }],
    address: { city: "Indore" },
    paymentMode: "COD",
  };

  test("TEST 1: Cart amount ₹0 -> Blocked with MINIMUM_ORDER_VALUE_NOT_MET", async () => {
    setupMockPricing(0, 0);

    await expect(
      placeOrderAtomic({
        customerId: "67f0000000000000000000c1",
        payload: validPayload,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "MINIMUM_ORDER_VALUE_NOT_MET",
      message: "Minimum order value is ₹499. Add ₹499 more to place your order.",
      data: {
        code: "MINIMUM_ORDER_VALUE_NOT_MET",
        minimumOrderValue: 499,
        currentOrderValue: 0,
        remainingAmount: 499,
      },
    });

    expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
    expect(mockSession.commitTransaction).not.toHaveBeenCalled();
  });

  test("TEST 2: Cart amount ₹100 -> Blocked with remainingAmount = ₹399", async () => {
    setupMockPricing(100, 120);

    await expect(
      placeOrderAtomic({
        customerId: "67f0000000000000000000c1",
        payload: validPayload,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "MINIMUM_ORDER_VALUE_NOT_MET",
      message: "Minimum order value is ₹499. Add ₹399 more to place your order.",
      data: {
        minimumOrderValue: 499,
        currentOrderValue: 100,
        remainingAmount: 399,
      },
    });
  });

  test("TEST 3: Cart amount ₹450 -> Blocked with remainingAmount = ₹49", async () => {
    setupMockPricing(450, 470);

    await expect(
      placeOrderAtomic({
        customerId: "67f0000000000000000000c1",
        payload: validPayload,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "MINIMUM_ORDER_VALUE_NOT_MET",
      message: "Minimum order value is ₹499. Add ₹499 more to place your order." ? expect.stringContaining("Add ₹49 more") : undefined,
      data: {
        minimumOrderValue: 499,
        currentOrderValue: 450,
        remainingAmount: 49,
      },
    });
  });

  test("TEST 4: Cart amount ₹498 -> Blocked with remainingAmount = ₹1", async () => {
    setupMockPricing(498, 518);

    await expect(
      placeOrderAtomic({
        customerId: "67f0000000000000000000c1",
        payload: validPayload,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "MINIMUM_ORDER_VALUE_NOT_MET",
      message: "Minimum order value is ₹499. Add ₹1 more to place your order.",
      data: {
        minimumOrderValue: 499,
        currentOrderValue: 498,
        remainingAmount: 1,
      },
    });
  });

  test("TEST 5: Cart amount exactly ₹499 -> Allowed to place order", async () => {
    setupMockPricing(499, 519);

    const result = await placeOrderAtomic({
      customerId: "67f0000000000000000000c1",
      payload: validPayload,
    });

    expect(result).toBeDefined();
    expect(result.checkoutGroup.checkoutGroupId).toBe("CHK-TEST-001");
    expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
    expect(mockSession.abortTransaction).not.toHaveBeenCalled();
  });

  test("TEST 6: Cart amount ₹500 -> Allowed", async () => {
    setupMockPricing(500, 520);

    const result = await placeOrderAtomic({
      customerId: "67f0000000000000000000c1",
      payload: validPayload,
    });

    expect(result).toBeDefined();
    expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
  });

  test("TEST 7: Cart amount ₹999 -> Allowed", async () => {
    setupMockPricing(999, 1019);

    const result = await placeOrderAtomic({
      customerId: "67f0000000000000000000c1",
      payload: validPayload,
    });

    expect(result).toBeDefined();
    expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
  });

  test("TEST 8: Client bypass attempt (client sends total: 499, but server subtotal is 350) -> Rejected", async () => {
    setupMockPricing(350, 370);

    // Client attempts to send forged price / subtotal in payload
    const forgedPayload = {
      ...validPayload,
      total: 499,
      productSubtotal: 499,
      grandTotal: 499,
      items: [{ product: "67f000000000000000000011", quantity: 1, price: 499 }],
    };

    await expect(
      placeOrderAtomic({
        customerId: "67f0000000000000000000c1",
        payload: forgedPayload,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "MINIMUM_ORDER_VALUE_NOT_MET",
      data: {
        minimumOrderValue: 499,
        currentOrderValue: 350,
        remainingAmount: 149,
      },
    });

    expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
  });

  test("TEST 9: Payment mode ONLINE below ₹499 -> Blocked", async () => {
    setupMockPricing(300, 320);

    await expect(
      placeOrderAtomic({
        customerId: "67f0000000000000000000c1",
        payload: { ...validPayload, paymentMode: "ONLINE" },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "MINIMUM_ORDER_VALUE_NOT_MET",
    });
  });

  test("TEST 10: Payment mode COD below ₹499 -> Blocked", async () => {
    setupMockPricing(400, 420);

    await expect(
      placeOrderAtomic({
        customerId: "67f0000000000000000000c1",
        payload: { ...validPayload, paymentMode: "COD" },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "MINIMUM_ORDER_VALUE_NOT_MET",
    });
  });

  test("TEST 11: Wallet redemption below ₹499 -> Blocked", async () => {
    setupMockPricing(420, 0);

    await expect(
      placeOrderAtomic({
        customerId: "67f0000000000000000000c1",
        payload: { ...validPayload, walletAmount: 420 },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "MINIMUM_ORDER_VALUE_NOT_MET",
    });
  });
});
