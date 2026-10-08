import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import { sendSmsIndiaHubOtp } from "../app/services/smsIndiaHubService.js";

async function run() {
  console.log("=== LIVE SMS TEST ===");
  console.log("URL:", process.env.SMS_INDIA_HUB_URL);
  console.log("API Key:", process.env.SMS_INDIA_HUB_API_KEY ? "Present (" + process.env.SMS_INDIA_HUB_API_KEY.length + " chars)" : "Missing");
  console.log("Sender ID:", process.env.SMS_INDIA_HUB_SENDER_ID);
  console.log("DLT Template ID:", process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID);
  console.log("PE ID:", process.env.SMS_INDIA_HUB_PE_ID);
  console.log("TM ID:", process.env.SMS_INDIA_HUB_TM_ID);

  try {
    // Let's test with the test phone from scratch/test-sms.js or a dummy 10-digit number
    const testPhone = "8770620342"; // or another number
    console.log("\nAttempting to send OTP via sendSmsIndiaHubOtp to:", testPhone);
    const result = await sendSmsIndiaHubOtp({
      phone: testPhone,
      otp: "5678",
    });
    console.log("SUCCESS RESULT:", result);
  } catch (err) {
    console.error("ERROR CAUGHT:");
    console.error("Message:", err.message);
    console.error("Status code:", err.statusCode);
    console.error("Provider code:", err.providerCode);
    console.error("Raw response:", err.rawResponse);
    if (err.response) {
      console.error("Axios HTTP Status:", err.response.status);
      console.error("Axios HTTP Data:", err.response.data);
    }
  }
}

run();
