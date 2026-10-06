import { jest } from "@jest/globals";

const { isTestPhone } = await import("../app/services/otpAuthService.js");

describe("test-phone OTP bypass", () => {
  const originalTestPhones = process.env.TEST_PHONES;

  afterEach(() => {
    if (originalTestPhones === undefined) {
      delete process.env.TEST_PHONES;
    } else {
      process.env.TEST_PHONES = originalTestPhones;
    }
  });

  it("recognises the demo number from the code default, with no TEST_PHONES set", () => {
    // Mirrors a server whose .env never sets TEST_PHONES.
    delete process.env.TEST_PHONES;
    expect(isTestPhone("9111966732")).toBe(true);
  });

  it("recognises the demo number in every format the app passes around", () => {
    delete process.env.TEST_PHONES;
    for (const variant of [
      "9111966732",
      "919111966732",
      "+919111966732",
      "+91 91119 66732",
      "09111966732",
    ]) {
      expect(isTestPhone(variant)).toBe(true);
    }
  });

  it("keeps the pre-existing 9999999999 test number working", () => {
    delete process.env.TEST_PHONES;
    expect(isTestPhone("9999999999")).toBe(true);
  });

  it("does not treat ordinary numbers as test phones", () => {
    delete process.env.TEST_PHONES;
    for (const real of ["9755620716", "8770620342", "9111966731"]) {
      expect(isTestPhone(real)).toBe(false);
    }
  });

  it("lets TEST_PHONES override the default list", () => {
    process.env.TEST_PHONES = "9000000001";
    expect(isTestPhone("9000000001")).toBe(true);
    expect(isTestPhone("9111966732")).toBe(false);
  });
});
