import { describe, it, expect } from "@jest/globals";
import { createFinanceOrderSchema } from "../app/validation/financeValidation.js";

describe("Order Address Validation in createFinanceOrderSchema", () => {
  const baseValidOrder = {
    items: [{ productId: "p1", quantity: 1, price: 100 }],
    paymentMode: "COD",
    address: {
      name: "Palak Patel",
      phone: "9876543210",
      address: "123 MG Road, Scheme 54",
      city: "Indore",
      pincode: "452010",
    },
  };

  it("accepts valid order with complete customer details", () => {
    const { error, value } = createFinanceOrderSchema.validate(baseValidOrder);
    expect(error).toBeUndefined();
    expect(value.address.name).toBe("Palak Patel");
    expect(value.address.phone).toBe("9876543210");
  });

  it("rejects order when customer name is missing or empty", () => {
    const invalidOrder = {
      ...baseValidOrder,
      address: { ...baseValidOrder.address, name: "" },
    };
    const { error } = createFinanceOrderSchema.validate(invalidOrder);
    expect(error).toBeDefined();
    expect(error.message).toMatch(/name/i);
  });

  it("rejects order when customer phone is missing or invalid", () => {
    const invalidOrder = {
      ...baseValidOrder,
      address: { ...baseValidOrder.address, phone: "123" },
    };
    const { error } = createFinanceOrderSchema.validate(invalidOrder);
    expect(error).toBeDefined();
    expect(error.message).toMatch(/phone/i);
  });

  it("rejects order when address is missing or too short", () => {
    const invalidOrder = {
      ...baseValidOrder,
      address: { ...baseValidOrder.address, address: "" },
    };
    const { error } = createFinanceOrderSchema.validate(invalidOrder);
    expect(error).toBeDefined();
    expect(error.message).toMatch(/address/i);
  });

  it("rejects order when city is missing", () => {
    const invalidOrder = {
      ...baseValidOrder,
      address: { ...baseValidOrder.address, city: "" },
    };
    const { error } = createFinanceOrderSchema.validate(invalidOrder);
    expect(error).toBeDefined();
    expect(error.message).toMatch(/city/i);
  });
});
