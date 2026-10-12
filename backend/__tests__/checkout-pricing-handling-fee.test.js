import { jest } from "@jest/globals";

const mockProductFind = jest.fn();
const mockCategoryFind = jest.fn();
const mockGetOrCreateFinanceSettings = jest.fn();

function createQueryChain(result) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
}

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    find: mockProductFind,
  },
}));

jest.unstable_mockModule("../app/models/category.js", () => ({
  default: {
    find: mockCategoryFind,
  },
}));

jest.unstable_mockModule("../app/services/finance/financeSettingsService.js", () => ({
  getOrCreateFinanceSettings: mockGetOrCreateFinanceSettings,
}));

const { buildCheckoutPricingSnapshot } = await import(
  "../app/services/checkoutPricingService.js"
);

describe("checkout pricing snapshot handling fee", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("charges only the highest header-category handling fee once across a multi-seller checkout", async () => {
    mockProductFind.mockReturnValue(
      createQueryChain([
        {
          _id: "p1",
          name: "P1",
          salePrice: 0,
          price: 100,
          mainImage: "",
          headerId: "h1",
          sellerId: "seller-a",
          status: "active",
          variants: [],
        },
        {
          _id: "p2",
          name: "P2",
          salePrice: 0,
          price: 200,
          mainImage: "",
          headerId: "h2",
          sellerId: "seller-b",
          status: "active",
          variants: [],
        },
      ]),
    );

    mockCategoryFind.mockReturnValue(
      createQueryChain([
        {
          _id: "h1",
          name: "Header 1",
          adminCommissionType: "percentage",
          adminCommissionValue: 0,
          adminCommissionFixedRule: "per_qty",
          handlingFeeType: "fixed",
          handlingFeeValue: 20,
          handlingFees: 20,
        },
        {
          _id: "h2",
          name: "Header 2",
          adminCommissionType: "percentage",
          adminCommissionValue: 0,
          adminCommissionFixedRule: "per_qty",
          handlingFeeType: "fixed",
          handlingFeeValue: 30,
          handlingFees: 30,
        },
      ]),
    );

    mockGetOrCreateFinanceSettings.mockResolvedValue({
      deliveryPricingMode: "distance_based",
      customerBaseDeliveryFee: 30,
      riderBasePayout: 30,
      baseDistanceCapacityKm: 0.5,
      incrementalKmSurcharge: 10,
      deliveryPartnerRatePerKm: 5,
      fixedDeliveryFee: 30,
      handlingFeeStrategy: "highest_category_fee",
      codEnabled: true,
      onlineEnabled: true,
    });

    const snapshot = await buildCheckoutPricingSnapshot({
      orderItems: [
        { product: "p1", quantity: 1 },
        { product: "p2", quantity: 1 },
      ],
      address: {}, // ensures distance calc returns 0 without Seller lookup
      session: null,
    });

    expect(snapshot.sellerCount).toBe(2);
    expect(snapshot.aggregateBreakdown.deliveryFeeCharged).toBe(60);
    expect(snapshot.aggregateBreakdown.handlingFeeCharged).toBe(30);
    expect(snapshot.aggregateBreakdown.productSubtotal).toBe(300);
    expect(snapshot.aggregateBreakdown.grandTotal).toBe(390);

    const perSellerFees = snapshot.sellerBreakdownEntries.map(
      (entry) => entry.breakdown.handlingFeeCharged,
    );
    expect(perSellerFees.reduce((sum, v) => sum + v, 0)).toBe(30);

    const sellerA = snapshot.sellerBreakdownEntries.find(
      (entry) => entry.sellerId === "seller-a",
    );
    const sellerB = snapshot.sellerBreakdownEntries.find(
      (entry) => entry.sellerId === "seller-b",
    );
    expect(sellerA.breakdown.handlingFeeCharged).toBe(0);
    expect(sellerB.breakdown.handlingFeeCharged).toBe(30);
  });

  it("charges ₹15 handling fee for COD and ₹9 for ONLINE across checkouts", async () => {
    mockProductFind.mockReturnValue(
      createQueryChain([
        {
          _id: "p1",
          name: "Item",
          salePrice: 0,
          price: 500,
          mainImage: "",
          headerId: "h1",
          sellerId: "seller-a",
          status: "active",
          variants: [],
        },
      ]),
    );

    mockCategoryFind.mockReturnValue(
      createQueryChain([
        {
          _id: "h1",
          name: "Header 1",
          adminCommissionType: "percentage",
          adminCommissionValue: 0,
          adminCommissionFixedRule: "per_qty",
          handlingFeeType: "fixed",
          handlingFeeValue: 0,
          handlingFees: 0,
        },
      ]),
    );

    mockGetOrCreateFinanceSettings.mockResolvedValue({
      deliveryPricingMode: "fixed_price",
      fixedDeliveryFee: 0,
      customerBaseDeliveryFee: 0,
      riderBasePayout: 0,
      handlingFeeStrategy: "highest_category_fee",
      codEnabled: true,
      onlineEnabled: true,
    });

    // 1. Test COD
    const codSnapshot = await buildCheckoutPricingSnapshot({
      orderItems: [{ product: "p1", quantity: 1 }],
      address: {},
      paymentMode: "COD",
      session: null,
    });
    expect(codSnapshot.aggregateBreakdown.handlingFeeCharged).toBe(15);
    expect(codSnapshot.aggregateBreakdown.grandTotal).toBe(515);

    // 2. Test ONLINE
    const onlineSnapshot = await buildCheckoutPricingSnapshot({
      orderItems: [{ product: "p1", quantity: 1 }],
      address: {},
      paymentMode: "ONLINE",
      session: null,
    });
    expect(onlineSnapshot.aggregateBreakdown.handlingFeeCharged).toBe(9);
    expect(onlineSnapshot.aggregateBreakdown.grandTotal).toBe(509);
  });
});

