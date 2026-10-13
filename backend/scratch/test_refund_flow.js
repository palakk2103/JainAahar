import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { refundPaymentForOrder } from "../app/services/paymentService.js";
import { getActivePaymentProvider } from "../app/services/payment/providerRegistry.js";

async function run() {
  console.log("=== Testing Payment & Refund Logic ===");

  if (process.env.MONGO_URI) {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB successfully.");
  }

  // 1. Provider port & method verification
  const provider = getActivePaymentProvider();
  console.log("Active Provider:", provider.providerName);
  console.log("Is refundPayment implemented?:", typeof provider.refundPayment === "function");

  // 2. Test refundPaymentForOrder when order does not exist
  console.log("\n--- TEST: Non-existent order ---");
  const nonExistentResult = await refundPaymentForOrder(new mongoose.Types.ObjectId());
  console.log("Result on non-existent order:", nonExistentResult);

  // 3. Test refundPaymentForOrder on COD order (should skip gracefully)
  console.log("\n--- TEST: COD order (should safely skip) ---");
  const codOrder = {
    _id: new mongoose.Types.ObjectId(),
    orderId: "ORD-COD-1",
    paymentMode: "COD",
    financeFlags: {},
  };
  const codResult = await refundPaymentForOrder(codOrder);
  console.log("Result on COD order:", codResult);

  // 4. Test refundPaymentForOrder on already refunded order (idempotency check)
  console.log("\n--- TEST: Already refunded order (idempotency guard) ---");
  const alreadyRefundedOrder = {
    _id: new mongoose.Types.ObjectId(),
    orderId: "ORD-REF-1",
    paymentMode: "ONLINE",
    financeFlags: { onlineRefundInitiated: true },
  };
  const idempotentResult = await refundPaymentForOrder(alreadyRefundedOrder);
  console.log("Result on already refunded order:", idempotentResult);

  // 5. Test refundPaymentForOrder on online order with no captured payment
  console.log("\n--- TEST: Online order with no captured payment in DB ---");
  const unpaidOnlineOrder = {
    _id: new mongoose.Types.ObjectId(),
    orderId: "ORD-UNPAID-1",
    paymentMode: "ONLINE",
    financeFlags: { onlinePaymentCaptured: true },
  };
  const noPaymentResult = await refundPaymentForOrder(unpaidOnlineOrder);
  console.log("Result when no captured payment in DB:", noPaymentResult);

  console.log("\n=== ALL TESTS COMPLETED SUCCESSFULLY ===");
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch((e) => {
    console.error("Test error:", e);
    process.exit(1);
  });
