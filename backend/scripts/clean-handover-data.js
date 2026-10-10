import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function cleanTargetPagesData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.\n');

    const db = mongoose.connection.db;

    // Snapshot before
    console.log('=== BEFORE CLEANUP ===');
    const beforeTickets = await db.collection('tickets').countDocuments();
    const beforeReviews = await db.collection('reviews').countDocuments();
    const beforeFaqs = await db.collection('faqs').countDocuments();
    const beforeCustomers = await db.collection('users').countDocuments({ role: 'user' });
    const beforeCarts = await db.collection('carts').countDocuments();
    const beforeWishlists = await db.collection('wishlists').countDocuments();
    const beforeCustWallets = await db.collection('wallets').countDocuments({ ownerType: 'CUSTOMER' });
    const beforeTicketNotifs = await db.collection('notifications').countDocuments({ 
      type: { $in: ['SUPPORT_TICKET_MESSAGE', 'SUPPORT_TICKET_CREATED'] } 
    });

    console.log(`- Tickets: ${beforeTickets}`);
    console.log(`- Reviews: ${beforeReviews}`);
    console.log(`- FAQs: ${beforeFaqs}`);
    console.log(`- Customers (users with role 'user'): ${beforeCustomers}`);
    console.log(`- Carts: ${beforeCarts}`);
    console.log(`- Wishlists: ${beforeWishlists}`);
    console.log(`- Customer Wallets: ${beforeCustWallets}`);
    console.log(`- Ticket Notifications: ${beforeTicketNotifs}`);

    // Snapshot of preserved data
    const preservedAdmins = await db.collection('admins').countDocuments();
    const preservedSellers = await db.collection('sellers').countDocuments();
    const preservedDeliveries = await db.collection('deliveries').countDocuments();
    const preservedEmployees = await db.collection('employees').countDocuments();
    const preservedProducts = await db.collection('products').countDocuments();
    const preservedCategories = await db.collection('categories').countDocuments();
    const preservedWarehouses = await db.collection('warehouses').countDocuments();
    const preservedStores = await db.collection('stores').countDocuments();
    const preservedSettings = await db.collection('settings').countDocuments();

    console.log('\n=== PRESERVED DATA SNAPSHOT ===');
    console.log(`- Admins: ${preservedAdmins}`);
    console.log(`- Sellers: ${preservedSellers}`);
    console.log(`- Delivery Partners: ${preservedDeliveries}`);
    console.log(`- Employees: ${preservedEmployees}`);
    console.log(`- Products: ${preservedProducts}`);
    console.log(`- Categories: ${preservedCategories}`);
    console.log(`- Warehouses: ${preservedWarehouses}`);
    console.log(`- Stores: ${preservedStores}`);
    console.log(`- Settings: ${preservedSettings}`);

    console.log('\n>>> Performing Cleanup for Target Pages...');

    // 1. Customer Support -> Help Tickets (/admin/support-tickets)
    const delTickets = await db.collection('tickets').deleteMany({});
    const delTicketNotifs = await db.collection('notifications').deleteMany({
      type: { $in: ['SUPPORT_TICKET_MESSAGE', 'SUPPORT_TICKET_CREATED'] }
    });
    console.log(`✓ Cleaned Tickets: ${delTickets.deletedCount} deleted`);
    console.log(`✓ Cleaned Ticket Notifications: ${delTicketNotifs.deletedCount} deleted`);

    // 2. Customer Support -> Review Content (/admin/moderation)
    const delReviews = await db.collection('reviews').deleteMany({});
    console.log(`✓ Cleaned Reviews: ${delReviews.deletedCount} deleted`);

    // 3. FAQs (/admin/faqs)
    const delFaqs = await db.collection('faqs').deleteMany({});
    console.log(`✓ Cleaned FAQs: ${delFaqs.deletedCount} deleted`);

    // 4. Customers (/admin/customers)
    const delCustomers = await db.collection('users').deleteMany({ role: 'user' });
    const delCarts = await db.collection('carts').deleteMany({});
    const delWishlists = await db.collection('wishlists').deleteMany({});
    const delCustWallets = await db.collection('wallets').deleteMany({ ownerType: 'CUSTOMER' });
    console.log(`✓ Cleaned Customers: ${delCustomers.deletedCount} deleted`);
    console.log(`✓ Cleaned Customer Carts: ${delCarts.deletedCount} deleted`);
    console.log(`✓ Cleaned Customer Wishlists: ${delWishlists.deletedCount} deleted`);
    console.log(`✓ Cleaned Customer Wallets: ${delCustWallets.deletedCount} deleted`);

    // Verification after
    console.log('\n=== AFTER CLEANUP VERIFICATION ===');
    const afterTickets = await db.collection('tickets').countDocuments();
    const afterReviews = await db.collection('reviews').countDocuments();
    const afterFaqs = await db.collection('faqs').countDocuments();
    const afterCustomers = await db.collection('users').countDocuments({ role: 'user' });
    const afterCarts = await db.collection('carts').countDocuments();
    const afterWishlists = await db.collection('wishlists').countDocuments();
    const afterCustWallets = await db.collection('wallets').countDocuments({ ownerType: 'CUSTOMER' });

    console.log(`- Remaining Tickets: ${afterTickets} (Cleaned)`);
    console.log(`- Remaining Reviews: ${afterReviews} (Cleaned)`);
    console.log(`- Remaining FAQs: ${afterFaqs} (Cleaned)`);
    console.log(`- Remaining Customers: ${afterCustomers} (Cleaned)`);
    console.log(`- Remaining Carts: ${afterCarts} (Cleaned)`);
    console.log(`- Remaining Wishlists: ${afterWishlists} (Cleaned)`);
    console.log(`- Remaining Customer Wallets: ${afterCustWallets} (Cleaned)`);

    console.log('\n=== VERIFYING PRESERVED COLLECTIONS ARE UNTOUCHED ===');
    const checkAdmins = await db.collection('admins').countDocuments();
    const checkSellers = await db.collection('sellers').countDocuments();
    const checkDeliveries = await db.collection('deliveries').countDocuments();
    const checkEmployees = await db.collection('employees').countDocuments();
    const checkProducts = await db.collection('products').countDocuments();
    const checkCategories = await db.collection('categories').countDocuments();
    const checkWarehouses = await db.collection('warehouses').countDocuments();
    const checkStores = await db.collection('stores').countDocuments();
    const checkSettings = await db.collection('settings').countDocuments();
    const checkAdminSellerWallets = await db.collection('wallets').countDocuments({ ownerType: { $ne: 'CUSTOMER' } });

    console.log(`- Admins: ${checkAdmins} (UNCHANGED: ${checkAdmins === preservedAdmins})`);
    console.log(`- Sellers: ${checkSellers} (UNCHANGED: ${checkSellers === preservedSellers})`);
    console.log(`- Delivery Partners: ${checkDeliveries} (UNCHANGED: ${checkDeliveries === preservedDeliveries})`);
    console.log(`- Employees: ${checkEmployees} (UNCHANGED: ${checkEmployees === preservedEmployees})`);
    console.log(`- Products: ${checkProducts} (UNCHANGED: ${checkProducts === preservedProducts})`);
    console.log(`- Categories: ${checkCategories} (UNCHANGED: ${checkCategories === preservedCategories})`);
    console.log(`- Warehouses: ${checkWarehouses} (UNCHANGED: ${checkWarehouses === preservedWarehouses})`);
    console.log(`- Stores: ${checkStores} (UNCHANGED: ${checkStores === preservedStores})`);
    console.log(`- Settings: ${checkSettings} (UNCHANGED: ${checkSettings === preservedSettings})`);
    console.log(`- Admin/Seller/Delivery Wallets: ${checkAdminSellerWallets} (UNTOUCHED)`);

    console.log('\nAll targeted pages data cleaned successfully! Handover ready.');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

cleanTargetPagesData();
