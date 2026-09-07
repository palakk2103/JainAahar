import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { calculateCheckoutShipping } from "../app/services/shippingRateService.js";
import Product from "../app/models/product.js";

async function testOutsideShipping() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/jainahar";
    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB Connected.\n");

    // 1. Fetch or ensure warehouse and inventory
    const Warehouse = (await import("../app/models/warehouse.js")).default;
    const WarehouseInventory = (await import("../app/models/warehouseInventory.js")).default;

    let warehouse = await Warehouse.findOne({ isActive: true, isVerified: true });
    if (!warehouse) {
      warehouse = await Warehouse.findOne();
      if (warehouse) {
        warehouse.isActive = true;
        warehouse.isVerified = true;
      }
    }

    if (warehouse) {
      if (!warehouse.pincode || !warehouse.city) {
        warehouse.pincode = "452001";
        warehouse.city = "Indore";
        warehouse.state = "Madhya Pradesh";
        warehouse.isActive = true;
        warehouse.isVerified = true;
        await warehouse.save();
      }
    }

    const sampleProduct = await Product.findOne({ status: "active" }).lean() || await Product.findOne().lean();
    if (!sampleProduct) {
      console.error("❌ No product found in database to test!");
      process.exit(1);
    }

    if (warehouse) {
      // Ensure inventory exists for sample product
      let inv = await WarehouseInventory.findOne({ warehouse: warehouse._id, product: sampleProduct._id });
      if (!inv || inv.available < 5) {
        if (!inv) {
          inv = new WarehouseInventory({ warehouse: warehouse._id, product: sampleProduct._id, onHand: 100, available: 100, reserved: 0 });
        } else {
          inv.onHand = 100;
          inv.available = 100;
        }
        await inv.save();
      }
      console.log(`🏢 Fulfillment Warehouse: "${warehouse.warehouseName || warehouse.name}" (${warehouse.city} - PIN: ${warehouse.pincode})`);
    }

    console.log(`📦 Testing with Product: "${sampleProduct.name}" (ID: ${sampleProduct._id})`);
    console.log(`   Weight: ${sampleProduct.shippingWeight || 0.5} kg | Price: ₹${sampleProduct.salePrice || sampleProduct.price}\n`);

    const cartItems = [{ productId: sampleProduct._id, quantity: 1 }];

    // Test Cases: Local vs Outside Cities
    const testCases = [
      { name: "Indore (Local Warehouse City)", pincode: "452001", city: "Indore" },
      { name: "Shivpuri (Local Warehouse City)", pincode: "473551", city: "Shivpuri" },
      { name: "Bhopal (Outside City)", pincode: "462001", city: "Bhopal" },
      { name: "Delhi (Outside City)", pincode: "110001", city: "Delhi" },
      { name: "Mumbai (Outside City)", pincode: "400001", city: "Mumbai" },
      { name: "Bengaluru (Outside City)", pincode: "560001", city: "Bengaluru" },
    ];

    console.log("==========================================================================");
    console.log("🧪 TESTING CHECKOUT SHIPPING CALCULATION (Local vs Outside / Shiprocket)");
    console.log("==========================================================================");

    for (const tc of testCases) {
      console.log(`\n📍 Destination: ${tc.name} [PIN: ${tc.pincode}]`);
      try {
        const result = await calculateCheckoutShipping({
          items: cartItems,
          customerPincode: tc.pincode,
          customerCity: tc.city,
          paymentMode: "COD",
        });

        if (result.isLocalDelivery) {
          console.log(`   🟢 Delivery Type : LOCAL (Same City / District)`);
          console.log(`   🚚 Delivery Fee  : ₹${result.shippingCharge} (FREE DELIVERY)`);
          console.log(`   🏢 Fulfillment   : ${result.fulfillmentWarehouse?.name} (${result.fulfillmentWarehouse?.city})`);
        } else {
          console.log(`   🔵 Delivery Type : OUTSIDE CITY (Live Shiprocket Rate)`);
          console.log(`   🚚 Delivery Fee  : ₹${result.shippingCharge}`);
          console.log(`   🏢 Origin WH     : ${result.fulfillmentWarehouse?.name} (${result.fulfillmentWarehouse?.city} - ${result.fulfillmentWarehouse?.pincode})`);
          console.log(`   📦 Courier Name  : ${result.courierInfo?.name || "Shiprocket Courier"}`);
          console.log(`   ⏱️ Est. Delivery : ~${Math.round((result.courierInfo?.etdHours || 48) / 24)} Days (${result.courierInfo?.etdHours || 48} hrs)`);
        }
      } catch (err) {
        console.log(`   ⚠️ Calculation Error: ${err.message}`);
      }
    }

    console.log("\n==========================================================================");
    console.log("🎉 Test Completed!");
    console.log("==========================================================================");
  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

testOutsideShipping();
