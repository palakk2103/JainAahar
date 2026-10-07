import { jest } from "@jest/globals";

const mockAxiosGet = jest.fn();
jest.unstable_mockModule("axios", () => ({ default: { get: mockAxiosGet } }));

const { sendSmsIndiaHubOtp, sendSmsIndiaHubOrderConfirmation } = await import(
  "../app/services/smsIndiaHubService.js"
);
const { buildOrderMessage } = await import("../app/utils/smsHelpers.js");

const OTP_TPL = "1777179135316960068";
const ORDER_TPL = "1777179135414949375";
const ORDER_TEXT =
  "Dear Customer, your order from JAINA ENTERPRISES (Jain Aahar) has been " +
  "successfully placed. Your Order ID is ##var##. Thank you.";
const OTP_TEXT =
  "Welcome to Jain Aahar. Your OTP for registration is ##var##. " +
  "Please do not share this OTP with anyone. JAINA ENTERPRISES";

describe("order confirmation SMS", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMS_INDIA_HUB_API_KEY = "api";
    process.env.SMS_INDIA_HUB_SENDER_ID = "JAINAE";
    process.env.SMS_INDIA_HUB_URL =
      "http://cloud.smsindiahub.in/vendorsms/pushsms.aspx";
    process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID = OTP_TPL;
    process.env.SMS_INDIA_HUB_ORDER_TEMPLATE_ID = ORDER_TPL;
    process.env.SMS_INDIA_HUB_TEMPLATE_TEXT = OTP_TEXT;
    process.env.SMS_INDIA_HUB_ORDER_TEMPLATE_TEXT = ORDER_TEXT;
    mockAxiosGet.mockResolvedValue({
      data: { ErrorCode: "000", ErrorMessage: "Done" },
    });
  });

  it("substitutes the order id into the approved template body", () => {
    expect(buildOrderMessage("JA664904")).toBe(
      "Dear Customer, your order from JAINA ENTERPRISES (Jain Aahar) has been " +
        "successfully placed. Your Order ID is JA664904. Thank you.",
    );
  });

  it("sends the order confirmation under the ORDER template id, not the OTP one", async () => {
    await sendSmsIndiaHubOrderConfirmation({
      phone: "9755620716",
      orderId: "JA664904",
    });

    const params = mockAxiosGet.mock.calls.at(-1)[1].params;
    expect(params.dlt_template_id).toBe(ORDER_TPL);
    expect(params.msg).toContain("JA664904");
    expect(params.msisdn).toBe("919755620716");
  });

  it("still sends OTP under the OTP template id", async () => {
    await sendSmsIndiaHubOtp({ phone: "9755620716", otp: "4321" });

    const params = mockAxiosGet.mock.calls.at(-1)[1].params;
    expect(params.dlt_template_id).toBe(OTP_TPL);
    expect(params.msg).toContain("4321");
  });

  it("refuses to send an order confirmation when its template id is unset", async () => {
    delete process.env.SMS_INDIA_HUB_ORDER_TEMPLATE_ID;

    await expect(
      sendSmsIndiaHubOrderConfirmation({ phone: "9755620716", orderId: "X1" }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("SMS_INDIA_HUB_ORDER_TEMPLATE_ID"),
    });
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it("refuses to send when the order template body is unset", async () => {
    delete process.env.SMS_INDIA_HUB_ORDER_TEMPLATE_TEXT;

    await expect(
      sendSmsIndiaHubOrderConfirmation({ phone: "9755620716", orderId: "X1" }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("SMS_INDIA_HUB_ORDER_TEMPLATE_TEXT"),
    });
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });
});
