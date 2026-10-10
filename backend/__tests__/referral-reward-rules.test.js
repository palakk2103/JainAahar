import {
  calculateRewardCoins,
  computeKeptPurchaseAmount,
  computeRetainedCoins,
  checkOrderEligibility,
  computeEligiblePurchaseAmount,
  generateReferralCodeCandidate,
  normalizeReferralConfig,
  validateReferralConfigInput,
} from "../app/services/referralService.js";

const config = normalizeReferralConfig({
  enabled: true,
  referrerReward: { type: "fixed", value: 100 },
  referredReward: { type: "percentage", value: 10, maxCoins: 50 },
  minOrderValue: 200,
  validityDays: 30,
});

const referral = { referred: "cust-1", createdAt: new Date("2026-01-01T00:00:00Z") };

const deliveredOrder = (overrides = {}) => ({
  customer: "cust-1",
  status: "delivered",
  orderStatus: "delivered",
  paymentMode: "COD",
  paymentStatus: "CASH_COLLECTED",
  returnStatus: "none",
  createdAt: new Date("2026-01-05T00:00:00Z"),
  // MRP 700 each, sold at 450 each -> selling-price base 900.
  items: [{ price: 450, quantity: 2, mrp: 700 }],
  paymentBreakdown: { productSubtotal: 900, discountTotal: 100, deliveryFeeCharged: 40 },
  ...overrides,
});

describe("referral reward rules", () => {
  it("calculates fixed and percentage coins with cap", () => {
    expect(calculateRewardCoins({ type: "fixed", value: 100 }, 5000)).toBe(100);
    expect(calculateRewardCoins({ type: "percentage", value: 10, maxCoins: 50 }, 900)).toBe(50);
    expect(calculateRewardCoins({ type: "percentage", value: 0 }, 900)).toBe(0);
  });

  it("always floors to whole coins, never paying fractions", () => {
    expect(calculateRewardCoins({ type: "percentage", value: 10 }, 455)).toBe(45); // 45.5
    expect(calculateRewardCoins({ type: "percentage", value: 10 }, 99.99)).toBe(9); // 9.999
    expect(calculateRewardCoins({ type: "percentage", value: 7.5 }, 413)).toBe(30); // 30.975
    expect(calculateRewardCoins({ type: "percentage", value: 1 }, 99)).toBe(0); // 0.99
    // Float traps: 0.29 * 100 = 28.999999... in JS; exact math must give 29.
    expect(calculateRewardCoins({ type: "percentage", value: 29 }, 100)).toBe(29);
    expect(calculateRewardCoins({ type: "percentage", value: 7 }, 700)).toBe(49);
    expect(calculateRewardCoins({ type: "percentage", value: 1.1 }, 1000)).toBe(11);
  });

  it("uses the products' selling price (not MRP) as the percentage base", () => {
    // MRP 700, sold at 400 -> 10% = 40 coins.
    const order = { items: [{ price: 400, quantity: 1, mrp: 700 }] };
    expect(computeEligiblePurchaseAmount(order)).toBe(400);
    expect(calculateRewardCoins({ type: "percentage", value: 10 }, computeEligiblePurchaseAmount(order))).toBe(40);
    expect(computeEligiblePurchaseAmount(deliveredOrder())).toBe(900);
    expect(computeEligiblePurchaseAmount({ items: [{ price: 120.5, quantity: 3 }, { price: 99, quantity: 1 }] })).toBe(460.5);
    // Legacy orders without items fall back to the stored product subtotal.
    expect(computeEligiblePurchaseAmount({ paymentBreakdown: { productSubtotal: 300 } })).toBe(300);
  });

  it("accepts a delivered, paid, non-returned order above the minimum", () => {
    const result = checkOrderEligibility(deliveredOrder(), referral, config);
    expect(result).toEqual({ eligible: true, reasons: [], purchaseAmount: 900 });
  });

  it.each([
    ["cancelled", { status: "cancelled", orderStatus: "cancelled" }],
    ["not delivered", { status: "packed", orderStatus: "packed" }],
    ["refunded", { paymentStatus: "REFUNDED" }],
    ["uncaptured online payment", { paymentMode: "ONLINE", paymentStatus: "CREATED" }],
    ["returned", { returnStatus: "returned" }],
    ["below minimum", { items: [{ price: 150, quantity: 1 }] }],
    ["placed before referral", { createdAt: new Date("2025-12-31T00:00:00Z") }],
    ["outside validity window", { createdAt: new Date("2026-03-01T00:00:00Z") }],
    ["another customer's order", { customer: "cust-2" }],
  ])("rejects %s orders", (_label, overrides) => {
    const result = checkOrderEligibility(deliveredOrder(overrides), referral, config);
    expect(result.eligible).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("validates admin configuration", () => {
    expect(() => validateReferralConfigInput({
      referrerReward: { type: "percentage", value: 120 },
      referredReward: { type: "fixed", value: 10 },
    })).toThrow(/cannot exceed 100%/);
    expect(() => validateReferralConfigInput({
      referrerReward: { type: "fixed", value: 12.5 },
      referredReward: { type: "bogus", value: 10 },
    })).toThrow(/whole number of coins.*"fixed" or "percentage"/);
    expect(validateReferralConfigInput({
      enabled: true,
      referrerReward: { type: "fixed", value: 100 },
      referredReward: { type: "percentage", value: 5, maxCoins: 40 },
    })).toMatchObject({ enabled: true, minOrderValue: 0, validityDays: 0 });
  });

  it("defaults to a disabled program with zero rewards", () => {
    expect(normalizeReferralConfig(undefined)).toEqual({
      enabled: false,
      referrerReward: { type: "fixed", value: 0, maxCoins: 0 },
      referredReward: { type: "fixed", value: 0, maxCoins: 0 },
      minOrderValue: 0,
      validityDays: 0,
    });
  });

  it("generates codes that cannot collide with employee codes", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateReferralCodeCandidate()).toMatch(/^JA[A-HJ-NP-Z2-9]{6}$/);
    }
  });

  describe("reversal after return / refund", () => {
    const credited = { purchaseAmount: 1000 };

    it("keeps the full amount when nothing was refunded", () => {
      expect(computeKeptPurchaseAmount({ status: "delivered", returnStatus: "none" }, credited)).toBe(1000);
      // Return requested / approved but not yet refunded: nothing to reverse yet.
      expect(computeKeptPurchaseAmount({ status: "delivered", returnStatus: "return_approved" }, credited)).toBe(1000);
    });

    it("subtracts refunded items (selling price) once the refund is completed", () => {
      const order = {
        status: "delivered",
        returnStatus: "refund_completed",
        returnItems: [
          { price: 300, quantity: 1, status: "approved" },
          { price: 50, quantity: 2, status: "rejected" },
        ],
      };
      expect(computeKeptPurchaseAmount(order, credited)).toBe(700);
    });

    it("treats cancellation, gateway refund and itemless refunds as full returns", () => {
      expect(computeKeptPurchaseAmount({ status: "cancelled" }, credited)).toBe(0);
      expect(computeKeptPurchaseAmount({ status: "delivered", paymentStatus: "REFUNDED" }, credited)).toBe(0);
      expect(computeKeptPurchaseAmount({ status: "delivered", returnStatus: "refund_completed" }, credited)).toBe(0);
    });

    it("recalculates retained coins with the rule frozen at credit time", () => {
      const pct = { type: "percentage", value: 10, maxCoins: 0, coins: 100 };
      const fixed = { type: "fixed", value: 100, coins: 100 };
      expect(computeRetainedCoins(pct, 700, 300)).toBe(70);
      expect(computeRetainedCoins(pct, 455, 0)).toBe(45); // floored
      expect(computeRetainedCoins(fixed, 700, 300)).toBe(100);
      expect(computeRetainedCoins(fixed, 250, 300)).toBe(0); // fell below minimum
      expect(computeRetainedCoins(pct, 0, 0)).toBe(0);
      // Never more than what was credited (e.g. a cap applied at credit time).
      expect(computeRetainedCoins({ type: "percentage", value: 10, maxCoins: 50, coins: 50 }, 900, 0)).toBe(50);
    });
  });
});
