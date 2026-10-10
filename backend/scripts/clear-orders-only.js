import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function clearOrdersData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    const db = mongoose.connection.db;

    // 1. Orders collection
    const orderCount = await db.collection('orders').countDocuments();
    const ordersResult = await db.collection('orders').deleteMany({});
    console.log(`Deleted ${ordersResult.deletedCount} orders (previously ${orderCount})`);

    // 2. Checkout Groups
    const chkCount = await db.collection('checkoutgroups').countDocuments();
    const chkResult = await db.collection('checkoutgroups').deleteMany({});
    console.log(`Deleted ${chkResult.deletedCount} checkoutgroups (previously ${chkCount})`);

    // 3. Order OTPs
    const otpCount = await db.collection('orderotps').countDocuments();
    const otpResult = await db.collection('orderotps').deleteMany({});
    console.log(`Deleted ${otpResult.deletedCount} orderotps (previously ${otpCount})`);

    // 4. Delivery Assignments
    const daCount = await db.collection('deliveryassignments').countDocuments();
    const daResult = await db.collection('deliveryassignments').deleteMany({});
    console.log(`Deleted ${daResult.deletedCount} deliveryassignments (previously ${daCount})`);

    // 5. Delivery Shipments
    const dsCount = await db.collection('deliveryshipments').countDocuments();
    const dsResult = await db.collection('deliveryshipments').deleteMany({});
    console.log(`Deleted ${dsResult.deletedCount} deliveryshipments (previously ${dsCount})`);

    // 6. Warehouse Fulfillments
    const wfCount = await db.collection('warehousefulfillments').countDocuments();
    const wfResult = await db.collection('warehousefulfillments').deleteMany({});
    console.log(`Deleted ${wfResult.deletedCount} warehousefulfillments (previously ${wfCount})`);

    // 7. Order-specific Payments
    const payResult = await db.collection('payments').deleteMany({
      $or: [
        { order: { $exists: true, $ne: null } },
        { orderIds: { $exists: true, $not: { $size: 0 } } },
        { checkoutGroupId: { $exists: true, $ne: null } }
      ]
    });
    console.log(`Deleted ${payResult.deletedCount} order payment records`);

    // 8. Order-specific Transactions
    const txResult = await db.collection('transactions').deleteMany({
      $or: [
        { order: { $exists: true, $ne: null } },
        { type: 'Order Payment' },
        { reference: /^ORD/ }
      ]
    });
    console.log(`Deleted ${txResult.deletedCount} order transaction records`);

    // 9. Reset order_counts in dashboardstats
    await db.collection('dashboardstats').deleteMany({ metric: 'order_counts' });
    console.log('Reset dashboardstats for order_counts');

    // Verification of unaffected core collections
    const productsCount = await db.collection('products').countDocuments();
    const categoriesCount = await db.collection('categories').countDocuments();
    const sellersCount = await db.collection('sellers').countDocuments();
    const warehousesCount = await db.collection('warehouses').countDocuments();
    const usersCount = await db.collection('users').countDocuments();

    console.log('\n--- VERIFICATION: Other pages preserved ---');
    console.log(`Products: ${productsCount} (UNTOUCHED)`);
    console.log(`Categories: ${categoriesCount} (UNTOUCHED)`);
    console.log(`Sellers: ${sellersCount} (UNTOUCHED)`);
    console.log(`Warehouses: ${warehousesCount} (UNTOUCHED)`);
    console.log(`Users/Customers: ${usersCount} (UNTOUCHED)`);
    console.log('------------------------------------------');

    console.log('Orders data clearance completed successfully!');
  } catch (error) {
    console.error('Error clearing orders data:', error);
  } finally {
    await mongoose.disconnect();
  }
}

clearOrdersData();
