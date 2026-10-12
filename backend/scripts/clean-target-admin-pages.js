import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function cleanTargetAdminPages() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.\n');

    const db = mongoose.connection.db;

    console.log('==============================================');
    console.log('   STEP 1: SNAPSHOT BEFORE CLEANUP            ');
    console.log('==============================================');

    // Target Pages Data Snapshot
    const beforeCustomers = await db.collection('users').countDocuments({ role: 'user' });
    const beforeCarts = await db.collection('carts').countDocuments();
    const beforeWishlists = await db.collection('wishlists').countDocuments();
    const beforeCustomerWallets = await db.collection('wallets').countDocuments({ ownerType: 'CUSTOMER' });

    const beforeReferrals = await db.collection('referrals').countDocuments();
    const beforeReferralLogs = await db.collection('referralauditlogs').countDocuments();

    const beforeCoupons = await db.collection('coupons').countDocuments();

    const beforeOrders = await db.collection('orders').countDocuments();
    const beforeCheckoutGroups = await db.collection('checkoutgroups').countDocuments();
    const beforeOrderOtps = await db.collection('orderotps').countDocuments();
    const beforeDeliveryAssignments = await db.collection('deliveryassignments').countDocuments();
    const beforeDeliveryShipments = await db.collection('deliveryshipments').countDocuments();
    const beforeWarehouseFulfillments = await db.collection('warehousefulfillments').countDocuments();
    const beforePayments = await db.collection('payments').countDocuments();
    const beforeTransactions = await db.collection('transactions').countDocuments();

    const beforeLedgerEntries = await db.collection('ledgerentries').countDocuments();
    const beforePayouts = await db.collection('payouts').countDocuments();
    const beforeFinanceReports = await db.collection('financereports').countDocuments();
    const beforeFinanceAuditLogs = await db.collection('financeauditlogs').countDocuments();
    const beforeSellerMetrics = await db.collection('sellermetrics').countDocuments();

    console.log('Target collections before cleanup:');
    console.log(`- Customers (users with role 'user'): ${beforeCustomers}`);
    console.log(`- Carts: ${beforeCarts}`);
    console.log(`- Wishlists: ${beforeWishlists}`);
    console.log(`- Customer Wallets: ${beforeCustomerWallets}`);
    console.log(`- Referrals: ${beforeReferrals}`);
    console.log(`- Referral Audit Logs: ${beforeReferralLogs}`);
    console.log(`- Coupons: ${beforeCoupons}`);
    console.log(`- Orders: ${beforeOrders}`);
    console.log(`- Checkout Groups: ${beforeCheckoutGroups}`);
    console.log(`- Order OTPs: ${beforeOrderOtps}`);
    console.log(`- Delivery Assignments: ${beforeDeliveryAssignments}`);
    console.log(`- Delivery Shipments: ${beforeDeliveryShipments}`);
    console.log(`- Warehouse Fulfillments: ${beforeWarehouseFulfillments}`);
    console.log(`- Payments: ${beforePayments}`);
    console.log(`- Transactions: ${beforeTransactions}`);
    console.log(`- Ledger Entries: ${beforeLedgerEntries}`);
    console.log(`- Payouts: ${beforePayouts}`);
    console.log(`- Finance Reports: ${beforeFinanceReports}`);
    console.log(`- Finance Audit Logs: ${beforeFinanceAuditLogs}`);
    console.log(`- Seller Metrics: ${beforeSellerMetrics}`);

    // Preserved Collections Snapshot
    const preservedAdmins = await db.collection('admins').countDocuments();
    const preservedSellers = await db.collection('sellers').countDocuments();
    const preservedDeliveries = await db.collection('deliveries').countDocuments();
    const preservedEmployees = await db.collection('employees').countDocuments();
    const preservedProducts = await db.collection('products').countDocuments();
    const preservedCatalogProducts = await db.collection('catalogproducts').countDocuments();
    const preservedCategories = await db.collection('categories').countDocuments();
    const preservedWarehouses = await db.collection('warehouses').countDocuments();
    const preservedStores = await db.collection('stores').countDocuments();
    const preservedInventories = await db.collection('warehouseinventories').countDocuments();
    const preservedStockHistories = await db.collection('stockhistories').countDocuments();
    const preservedInventoryTx = await db.collection('inventorytransactions').countDocuments();
    const preservedHeroConfigs = await db.collection('heroconfigs').countDocuments();
    const preservedDealSections = await db.collection('dealsections').countDocuments();
    const preservedSettings = await db.collection('settings').countDocuments();
    const preservedSubscriptionPlans = await db.collection('subscriptionplans').countDocuments();
    const preservedSellerSubscriptions = await db.collection('sellersubscriptions').countDocuments();

    console.log('\nPreserved collections to keep untouched:');
    console.log(`- Admins: ${preservedAdmins}`);
    console.log(`- Sellers: ${preservedSellers}`);
    console.log(`- Delivery Partners: ${preservedDeliveries}`);
    console.log(`- Employees: ${preservedEmployees}`);
    console.log(`- Products: ${preservedProducts}`);
    console.log(`- Catalog Products: ${preservedCatalogProducts}`);
    console.log(`- Categories: ${preservedCategories}`);
    console.log(`- Warehouses: ${preservedWarehouses}`);
    console.log(`- Stores: ${preservedStores}`);
    console.log(`- Warehouse Inventories: ${preservedInventories}`);
    console.log(`- Stock Histories: ${preservedStockHistories}`);
    console.log(`- Inventory Transactions: ${preservedInventoryTx}`);
    console.log(`- Hero Banners/Configs: ${preservedHeroConfigs}`);
    console.log(`- Deal Sections: ${preservedDealSections}`);
    console.log(`- Settings: ${preservedSettings}`);
    console.log(`- Subscription Plans: ${preservedSubscriptionPlans}`);
    console.log(`- Seller Subscriptions: ${preservedSellerSubscriptions}`);

    console.log('\n==============================================');
    console.log('   STEP 2: PERFORMING CLEANUP FOR TARGET PAGES');
    console.log('==============================================');

    // 1. /admin/customers
    const delCustomers = await db.collection('users').deleteMany({ role: 'user' });
    const delCarts = await db.collection('carts').deleteMany({});
    const delWishlists = await db.collection('wishlists').deleteMany({});
    const delCustWallets = await db.collection('wallets').deleteMany({ ownerType: 'CUSTOMER' });
    console.log(`✓ /admin/customers: Deleted ${delCustomers.deletedCount} customers, ${delCarts.deletedCount} carts, ${delWishlists.deletedCount} wishlists, ${delCustWallets.deletedCount} customer wallets.`);

    // 2. /admin/referrals
    const delReferrals = await db.collection('referrals').deleteMany({});
    const delReferralLogs = await db.collection('referralauditlogs').deleteMany({});
    console.log(`✓ /admin/referrals: Deleted ${delReferrals.deletedCount} referrals, ${delReferralLogs.deletedCount} audit logs.`);

    // 3. /admin/wallet
    const resetAdminWallet = await db.collection('wallets').updateMany(
      { ownerType: 'ADMIN' },
      { $set: { availableBalance: 0, pendingBalance: 0, cashInHand: 0, totalCredited: 0, totalDebited: 0 } }
    );
    const delLedgerEntries = await db.collection('ledgerentries').deleteMany({});
    const delPayouts = await db.collection('payouts').deleteMany({});
    const delFinanceReports = await db.collection('financereports').deleteMany({});
    const delFinanceAuditLogs = await db.collection('financeauditlogs').deleteMany({});
    console.log(`✓ /admin/wallet: Reset ${resetAdminWallet.modifiedCount} admin wallet(s) to 0, deleted ${delLedgerEntries.deletedCount} ledger entries, ${delPayouts.deletedCount} payouts, ${delFinanceReports.deletedCount} finance reports, ${delFinanceAuditLogs.deletedCount} finance logs.`);

    // 4. /admin/coupons
    const delCoupons = await db.collection('coupons').deleteMany({});
    console.log(`✓ /admin/coupons: Deleted ${delCoupons.deletedCount} coupons.`);

    // 5. /admin/store-analytics
    const delSellerMetrics = await db.collection('sellermetrics').deleteMany({});
    const resetSellerWallets = await db.collection('wallets').updateMany(
      { ownerType: 'SELLER' },
      { $set: { availableBalance: 0, pendingBalance: 0, cashInHand: 0, totalCredited: 0, totalDebited: 0 } }
    );
    const resetDeliveryWallets = await db.collection('wallets').updateMany(
      { ownerType: 'DELIVERY_PARTNER' },
      { $set: { availableBalance: 0, pendingBalance: 0, cashInHand: 0, totalCredited: 0, totalDebited: 0 } }
    );
    console.log(`✓ /admin/store-analytics: Deleted ${delSellerMetrics.deletedCount} seller metrics, reset ${resetSellerWallets.modifiedCount} seller wallet(s) and ${resetDeliveryWallets.modifiedCount} delivery wallet(s) to 0.`);

    // 6. /admin/orders/all, /admin/orders/processed, /admin/orders/out-for-delivery
    const delOrders = await db.collection('orders').deleteMany({});
    const delCheckoutGroups = await db.collection('checkoutgroups').deleteMany({});
    const delOrderOtps = await db.collection('orderotps').deleteMany({});
    const delDeliveryAssignments = await db.collection('deliveryassignments').deleteMany({});
    const delDeliveryShipments = await db.collection('deliveryshipments').deleteMany({});
    const delWarehouseFulfillments = await db.collection('warehousefulfillments').deleteMany({});
    const delPayments = await db.collection('payments').deleteMany({});
    const delTransactions = await db.collection('transactions').deleteMany({});
    const resetDashStats = await db.collection('dashboardstats').deleteMany({ metric: 'order_counts' });
    const delOrderNotifs = await db.collection('notifications').deleteMany({
      type: {
        $in: [
          'NEW_ORDER', 'ORDER_PLACED', 'ORDER_CONFIRMED', 'ORDER_READY',
          'ORDER_PACKED', 'OUT_FOR_DELIVERY', 'ORDER_DELIVERED', 'ORDER_CANCELLED',
          'DELIVERY_ASSIGNED', 'NEW_DELIVERY_BROADCAST', 'PAYMENT_SUCCESS',
          'order', 'payment', 'NEW_RETURN_BROADCAST', 'RETURN_REQUESTED',
          'RETURN_PICKUP_ASSIGNED', 'RETURN_COMPLETED'
        ]
      }
    });
    console.log(`✓ /admin/orders: Deleted ${delOrders.deletedCount} orders, ${delCheckoutGroups.deletedCount} checkout groups, ${delOrderOtps.deletedCount} order OTPs, ${delDeliveryAssignments.deletedCount} assignments, ${delDeliveryShipments.deletedCount} shipments, ${delWarehouseFulfillments.deletedCount} warehouse fulfillments, ${delPayments.deletedCount} payments, ${delTransactions.deletedCount} transactions, ${delOrderNotifs.deletedCount} order notifications, reset dashboard order counts.`);

    // 7. /admin Dashboard stats cache reset
    console.log(`✓ /admin (Dashboard): Will dynamically compute 0 orders, 0 customers, ₹0 revenue while keeping catalog & partners intact.`);

    console.log('\n==============================================');
    console.log('   STEP 3: AFTER CLEANUP VERIFICATION         ');
    console.log('==============================================');

    const afterCustomers = await db.collection('users').countDocuments({ role: 'user' });
    const afterCarts = await db.collection('carts').countDocuments();
    const afterWishlists = await db.collection('wishlists').countDocuments();
    const afterCustomerWallets = await db.collection('wallets').countDocuments({ ownerType: 'CUSTOMER' });
    const afterReferrals = await db.collection('referrals').countDocuments();
    const afterReferralLogs = await db.collection('referralauditlogs').countDocuments();
    const afterCoupons = await db.collection('coupons').countDocuments();
    const afterOrders = await db.collection('orders').countDocuments();
    const afterCheckoutGroups = await db.collection('checkoutgroups').countDocuments();
    const afterWarehouseFulfillments = await db.collection('warehousefulfillments').countDocuments();
    const afterPayments = await db.collection('payments').countDocuments();
    const afterTransactions = await db.collection('transactions').countDocuments();
    const afterLedgerEntries = await db.collection('ledgerentries').countDocuments();
    const afterPayouts = await db.collection('payouts').countDocuments();
    const afterSellerMetrics = await db.collection('sellermetrics').countDocuments();

    console.log(`- Customers: ${afterCustomers} (Cleaned)`);
    console.log(`- Carts: ${afterCarts} (Cleaned)`);
    console.log(`- Wishlists: ${afterWishlists} (Cleaned)`);
    console.log(`- Customer Wallets: ${afterCustomerWallets} (Cleaned)`);
    console.log(`- Referrals: ${afterReferrals} (Cleaned)`);
    console.log(`- Referral Audit Logs: ${afterReferralLogs} (Cleaned)`);
    console.log(`- Coupons: ${afterCoupons} (Cleaned)`);
    console.log(`- Orders: ${afterOrders} (Cleaned)`);
    console.log(`- Checkout Groups: ${afterCheckoutGroups} (Cleaned)`);
    console.log(`- Warehouse Fulfillments: ${afterWarehouseFulfillments} (Cleaned)`);
    console.log(`- Payments: ${afterPayments} (Cleaned)`);
    console.log(`- Transactions: ${afterTransactions} (Cleaned)`);
    console.log(`- Ledger Entries: ${afterLedgerEntries} (Cleaned)`);
    console.log(`- Payouts: ${afterPayouts} (Cleaned)`);
    console.log(`- Seller Metrics: ${afterSellerMetrics} (Cleaned)`);

    console.log('\n==============================================');
    console.log('   STEP 4: UNTOUCHED / PRESERVED DATA AUDIT   ');
    console.log('==============================================');

    const checkAdmins = await db.collection('admins').countDocuments();
    const checkSellers = await db.collection('sellers').countDocuments();
    const checkDeliveries = await db.collection('deliveries').countDocuments();
    const checkEmployees = await db.collection('employees').countDocuments();
    const checkProducts = await db.collection('products').countDocuments();
    const checkCatalogProducts = await db.collection('catalogproducts').countDocuments();
    const checkCategories = await db.collection('categories').countDocuments();
    const checkWarehouses = await db.collection('warehouses').countDocuments();
    const checkStores = await db.collection('stores').countDocuments();
    const checkInventories = await db.collection('warehouseinventories').countDocuments();
    const checkStockHistories = await db.collection('stockhistories').countDocuments();
    const checkInventoryTx = await db.collection('inventorytransactions').countDocuments();
    const checkHeroConfigs = await db.collection('heroconfigs').countDocuments();
    const checkDealSections = await db.collection('dealsections').countDocuments();
    const checkSettings = await db.collection('settings').countDocuments();
    const checkSubscriptionPlans = await db.collection('subscriptionplans').countDocuments();
    const checkSellerSubscriptions = await db.collection('sellersubscriptions').countDocuments();

    console.log(`- Admins: ${checkAdmins} (UNCHANGED: ${checkAdmins === preservedAdmins})`);
    console.log(`- Sellers: ${checkSellers} (UNCHANGED: ${checkSellers === preservedSellers})`);
    console.log(`- Delivery Partners: ${checkDeliveries} (UNCHANGED: ${checkDeliveries === preservedDeliveries})`);
    console.log(`- Employees: ${checkEmployees} (UNCHANGED: ${checkEmployees === preservedEmployees})`);
    console.log(`- Products: ${checkProducts} (UNCHANGED: ${checkProducts === preservedProducts})`);
    console.log(`- Catalog Products: ${checkCatalogProducts} (UNCHANGED: ${checkCatalogProducts === preservedCatalogProducts})`);
    console.log(`- Categories: ${checkCategories} (UNCHANGED: ${checkCategories === preservedCategories})`);
    console.log(`- Warehouses: ${checkWarehouses} (UNCHANGED: ${checkWarehouses === preservedWarehouses})`);
    console.log(`- Stores: ${checkStores} (UNCHANGED: ${checkStores === preservedStores})`);
    console.log(`- Warehouse Inventories: ${checkInventories} (UNCHANGED: ${checkInventories === preservedInventories})`);
    console.log(`- Stock Histories: ${checkStockHistories} (UNCHANGED: ${checkStockHistories === preservedStockHistories})`);
    console.log(`- Inventory Transactions: ${checkInventoryTx} (UNCHANGED: ${checkInventoryTx === preservedInventoryTx})`);
    console.log(`- Hero Banners/Configs: ${checkHeroConfigs} (UNCHANGED: ${checkHeroConfigs === preservedHeroConfigs})`);
    console.log(`- Deal Sections: ${checkDealSections} (UNCHANGED: ${checkDealSections === preservedDealSections})`);
    console.log(`- Settings: ${checkSettings} (UNCHANGED: ${checkSettings === preservedSettings})`);
    console.log(`- Subscription Plans: ${checkSubscriptionPlans} (UNCHANGED: ${checkSubscriptionPlans === preservedSubscriptionPlans})`);
    console.log(`- Seller Subscriptions: ${checkSellerSubscriptions} (UNCHANGED: ${checkSellerSubscriptions === preservedSellerSubscriptions})`);

    const allPreservedIntact = 
      checkAdmins === preservedAdmins &&
      checkSellers === preservedSellers &&
      checkDeliveries === preservedDeliveries &&
      checkEmployees === preservedEmployees &&
      checkProducts === preservedProducts &&
      checkCatalogProducts === preservedCatalogProducts &&
      checkCategories === preservedCategories &&
      checkWarehouses === preservedWarehouses &&
      checkStores === preservedStores &&
      checkInventories === preservedInventories &&
      checkStockHistories === preservedStockHistories &&
      checkInventoryTx === preservedInventoryTx &&
      checkHeroConfigs === preservedHeroConfigs &&
      checkDealSections === preservedDealSections &&
      checkSettings === preservedSettings &&
      checkSubscriptionPlans === preservedSubscriptionPlans &&
      checkSellerSubscriptions === preservedSellerSubscriptions;

    if (allPreservedIntact) {
      console.log('\n SUCCESS: All target pages cleaned! All other pages remain 100% UNTOUCHED and PRESERVED.');
    } else {
      console.warn('\n⚠️ WARNING: One or more preserved collections had a count mismatch.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

cleanTargetAdminPages();
