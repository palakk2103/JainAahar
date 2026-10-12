import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function restore() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.\n');
    const db = mongoose.connection.db;

    // ==========================================
    // 1. RESTORE CUSTOMERS
    // ==========================================
    console.log('--- Step 1: Restoring Customers ---');
    const customersToEnsure = [
      {
        _id: new mongoose.Types.ObjectId('6acb6b75c31e7c27e7cef0ac'),
        name: 'Anita Jain',
        phone: '+918435128574',
        role: 'user',
        isVerified: true,
        isActive: true,
        addresses: [
          {
            type: 'Home',
            name: 'Anita Jain',
            phone: '+918435128574',
            address: 'Civil Lines, Near Jain Mandir',
            city: 'Gwalior',
            state: 'Madhya Pradesh',
            pincode: '474001',
            isDefault: true
          }
        ],
        createdAt: new Date('2026-10-11T10:55:00.000Z'),
        updatedAt: new Date('2026-10-11T11:00:00.000Z')
      },
      {
        _id: new mongoose.Types.ObjectId('6ac9edd373843ad0ed2ad2cb'),
        name: 'Nikhil',
        phone: '+919806380757',
        role: 'user',
        isVerified: true,
        isActive: true,
        addresses: [
          {
            type: 'Home',
            name: 'Nikhil',
            phone: '+919806380757',
            address: 'Morar',
            city: 'Gwalior',
            state: 'Madhya Pradesh',
            pincode: '474006',
            isDefault: true
          }
        ],
        createdAt: new Date('2026-10-10T08:00:00.000Z'),
        updatedAt: new Date('2026-10-12T03:44:00.000Z')
      },
      {
        _id: new mongoose.Types.ObjectId('6ac9ffa138b350cf224607db'),
        name: 'Ankit Ahirwar',
        phone: '+919755620716',
        role: 'user',
        isVerified: true,
        isActive: true,
        addresses: [
          {
            type: 'Home',
            name: 'Ankit Ahirwar',
            phone: '+919755620716',
            address: 'City Center',
            city: 'Gwalior',
            state: 'Madhya Pradesh',
            pincode: '474011',
            isDefault: true
          }
        ],
        createdAt: new Date('2026-10-10T08:30:00.000Z'),
        updatedAt: new Date('2026-10-10T09:13:00.000Z')
      }
    ];

    for (const cust of customersToEnsure) {
      const existing = await db.collection('users').findOne({
        $or: [{ _id: cust._id }, { phone: cust.phone }]
      });
      if (!existing) {
        await db.collection('users').insertOne(cust);
        console.log(`✓ Inserted customer: ${cust.name} (${cust.phone})`);
      } else {
        await db.collection('users').updateOne(
          { _id: existing._id },
          { $set: { name: cust.name, isVerified: true, isActive: true } }
        );
        console.log(`✓ Updated customer name/status: ${cust.name} (${cust.phone})`);
      }
    }

    // ==========================================
    // 2. RESTORE COUPON: Welcome-10
    // ==========================================
    console.log('\n--- Step 2: Restoring Coupon "Welcome-10" ---');
    const existingCoupon = await db.collection('coupons').findOne({
      code: { $in: ['WELCOME-10', 'Welcome-10'] }
    });

    if (existingCoupon) {
      await db.collection('coupons').updateOne(
        { _id: existingCoupon._id },
        {
          $set: {
            title: 'Welcome-10',
            discountType: 'percentage',
            discountValue: 10,
            couponType: 'generic',
            minOrderValue: 0,
            validFrom: new Date('2026-10-01T00:00:00.000Z'),
            validTill: new Date('2027-10-31T23:59:59.999Z'),
            isActive: true,
            description: 'Welcome coupon - 10% discount on order'
          }
        }
      );
      console.log(`✓ Updated existing coupon: ${existingCoupon.code}`);
    } else {
      const newCoupon = {
        code: 'WELCOME-10',
        title: 'Welcome-10',
        description: 'Welcome coupon - 10% discount on order',
        discountType: 'percentage',
        discountValue: 10,
        maxDiscount: null,
        couponType: 'generic',
        minOrderValue: 0,
        minItems: 0,
        applicableCategories: [],
        usageLimit: null,
        perUserLimit: 1,
        usedCount: 0,
        validFrom: new Date('2026-10-01T00:00:00.000Z'),
        validTill: new Date('2027-10-31T23:59:59.999Z'),
        isActive: true,
        metadata: {},
        createdAt: new Date('2026-10-10T10:00:00.000Z'),
        updatedAt: new Date()
      };
      await db.collection('coupons').insertOne(newCoupon);
      console.log('✓ Successfully created coupon WELCOME-10 with full validity!');
    }

    // ==========================================
    // 3. RESTORE ORDERS (Yesterday & Recent)
    // ==========================================
    console.log('\n--- Step 3: Restoring Orders ---');
    const defaultSellerId = new mongoose.Types.ObjectId('6999782fd49e8099e8a7b11c');
    const warehouse1 = new mongoose.Types.ObjectId('6a4f7a7625713dfd2894c849');
    const warehouse2 = new mongoose.Types.ObjectId('6a840c2cc9f7633f97528f35');

    const ordersToRestore = [
      // Order 1: Yesterday's order by Anita Jain (11 Oct 2026)
      {
        orderId: 'ORD-01M4N9YVJNTS6WSN9WQT902F6F',
        chkId: 'CHK-01M4N9YVJ001E78N9WQT902F6F',
        fulId: 'FUL-02F6F-101',
        customer: new mongoose.Types.ObjectId('6acb6b75c31e7c27e7cef0ac'),
        seller: defaultSellerId,
        warehouse: warehouse1,
        warehouseId: warehouse1,
        status: 'out_for_delivery',
        workflowStatus: 'OUT_FOR_DELIVERY',
        workflowVersion: 2,
        paymentMode: 'COD',
        paymentStatus: 'PENDING_CASH_COLLECTION',
        payment: { method: 'cash', status: 'pending' },
        createdAt: new Date('2026-10-11T11:00:54.000Z'),
        updatedAt: new Date('2026-10-12T03:46:10.000Z'),
        address: {
          type: 'Home',
          name: 'Anita Jain',
          phone: '+918435128574',
          address: 'Civil Lines, Near Jain Mandir',
          city: 'Gwalior',
          state: 'Madhya Pradesh',
          pincode: '474001',
          landmark: 'Jain Mandir',
          location: { lat: 26.2183, lng: 78.1828 }
        },
        pricing: {
          subtotal: 553,
          deliveryFee: 0,
          platformFee: 5,
          gst: 0,
          tip: 0,
          discount: 0,
          total: 558,
          walletAmount: 0
        },
        items: [
          {
            product: new mongoose.Types.ObjectId('6a96c50ffb430ebd8f64d3b2'),
            name: 'badaam',
            quantity: 1,
            price: 298,
            variantSlot: 'BADAA-01-WMP3',
            image: ''
          },
          {
            product: new mongoose.Types.ObjectId('6a96c4c5fb430ebd8f64d398'),
            name: 'kaju',
            quantity: 1,
            price: 255,
            variantSlot: 'KAJU-01-YU9B',
            image: ''
          }
        ]
      },
      // Order 2: Early morning / last night order by Nikhil (12 Oct 2026)
      {
        orderId: 'ORD-01M4Q3BM9XBF2M83E83KNFFHA1',
        chkId: 'CHK-01M4Q3BM9X02E82E83KNFFHA1',
        fulId: 'FUL-FFHA1-202',
        customer: new mongoose.Types.ObjectId('6ac9edd373843ad0ed2ad2cb'),
        seller: defaultSellerId,
        warehouse: warehouse2,
        warehouseId: warehouse2,
        status: 'out_for_delivery',
        workflowStatus: 'OUT_FOR_DELIVERY',
        workflowVersion: 2,
        paymentMode: 'COD',
        paymentStatus: 'PENDING_CASH_COLLECTION',
        payment: { method: 'cash', status: 'pending' },
        createdAt: new Date('2026-10-12T03:44:01.000Z'),
        updatedAt: new Date('2026-10-12T03:45:51.000Z'),
        address: {
          type: 'Home',
          name: 'Nikhil',
          phone: '+919806380757',
          address: 'Morar',
          city: 'Gwalior',
          state: 'Madhya Pradesh',
          pincode: '474006',
          landmark: '',
          location: { lat: 26.2235, lng: 78.2255 }
        },
        pricing: {
          subtotal: 539,
          deliveryFee: 0,
          platformFee: 5,
          gst: 0,
          tip: 0,
          discount: 0,
          total: 544,
          walletAmount: 0
        },
        items: [
          {
            product: new mongoose.Types.ObjectId('6a9eb32f24a0c37143b5c363'),
            name: 'Chironji /Charoli',
            quantity: 1,
            price: 245,
            variantSlot: 'CHIRO-01-56I7',
            image: ''
          },
          {
            product: new mongoose.Types.ObjectId('6a9eb16424a0c37143b5c2fb'),
            name: 'Khajur/Dates',
            quantity: 1,
            price: 119,
            variantSlot: 'KHAJU-01-A45A',
            image: ''
          },
          {
            product: new mongoose.Types.ObjectId('6a9eaed824a0c37143b5c269'),
            name: 'Chuhara / Dry Dates',
            quantity: 2,
            price: 45,
            variantSlot: 'CHUHA-01-RPMD',
            image: ''
          },
          {
            product: new mongoose.Types.ObjectId('6a9eb78f24a0c37143b5c3c8'),
            name: 'Mungfali /Peanuts',
            quantity: 2,
            price: 42.5,
            variantSlot: 'MUNGF-01-KMCW',
            image: ''
          }
        ]
      },
      // Order 3: Ankit Ahirwar (10 Oct 2026)
      {
        orderId: 'ORD-01M4JX47N324G35T6XSSHNE45Y',
        chkId: 'CHK-01M4JX47N03XG35T6XSSHNE45Y',
        fulId: 'FUL-NE45Y-303',
        customer: new mongoose.Types.ObjectId('6ac9ffa138b350cf224607db'),
        seller: defaultSellerId,
        warehouse: warehouse2,
        warehouseId: warehouse2,
        status: 'delivered',
        workflowStatus: 'DELIVERED',
        workflowVersion: 2,
        paymentMode: 'COD',
        paymentStatus: 'PAID',
        payment: { method: 'cash', status: 'completed' },
        createdAt: new Date('2026-10-10T12:38:09.000Z'),
        updatedAt: new Date('2026-10-10T12:39:10.000Z'),
        address: {
          type: 'Home',
          name: 'Ankit Ahirwar',
          phone: '+919755620716',
          address: 'City Center',
          city: 'Gwalior',
          state: 'Madhya Pradesh',
          pincode: '474011',
          location: { lat: 26.2058, lng: 78.1963 }
        },
        pricing: {
          subtotal: 594,
          deliveryFee: 0,
          platformFee: 5,
          gst: 0,
          tip: 0,
          discount: 0,
          total: 599,
          walletAmount: 0
        },
        items: [
          {
            product: new mongoose.Types.ObjectId('6ac21d31287a4ba774968bbf'),
            name: 'Garam masala',
            quantity: 6,
            price: 99,
            variantSlot: 'GARAM-01-6M50',
            image: ''
          }
        ]
      },
      // Order 4: Ankit Ahirwar (10 Oct 2026)
      {
        orderId: 'ORD-01M4JMWS6KKJBJSEYK406F2Z8S',
        chkId: 'CHK-01M4JMWS604JBJSEYK406F2Z8S',
        fulId: 'FUL-6F2Z8S-282',
        customer: new mongoose.Types.ObjectId('6ac9ffa138b350cf224607db'),
        seller: defaultSellerId,
        warehouse: warehouse2,
        warehouseId: warehouse2,
        status: 'out_for_delivery',
        workflowStatus: 'OUT_FOR_DELIVERY',
        workflowVersion: 2,
        paymentMode: 'COD',
        paymentStatus: 'PENDING_CASH_COLLECTION',
        payment: { method: 'cash', status: 'pending' },
        createdAt: new Date('2026-10-10T10:14:17.000Z'),
        updatedAt: new Date('2026-10-10T10:27:03.000Z'),
        address: {
          type: 'Home',
          name: 'Ankit Ahirwar',
          phone: '+919755620716',
          address: 'City Center',
          city: 'Gwalior',
          state: 'Madhya Pradesh',
          pincode: '474011',
          location: { lat: 26.2058, lng: 78.1963 }
        },
        pricing: {
          subtotal: 594,
          deliveryFee: 0,
          platformFee: 5,
          gst: 0,
          tip: 0,
          discount: 0,
          total: 599,
          walletAmount: 0
        },
        items: [
          {
            product: new mongoose.Types.ObjectId('6ac21d31287a4ba774968bbf'),
            name: 'Garam masala',
            quantity: 6,
            price: 99,
            variantSlot: 'GARAM-01-6M50',
            image: ''
          }
        ]
      },
      // Order 5: Ankit Ahirwar (10 Oct 2026)
      {
        orderId: 'ORD-01M4JKTKV1HE2CG8NT9G6TXW0R',
        chkId: 'CHK-01M4JKTKV05E2CG8NT9G6TXW0R',
        fulId: 'FUL-6TXW0R-473',
        customer: new mongoose.Types.ObjectId('6ac9ffa138b350cf224607db'),
        seller: defaultSellerId,
        warehouse: warehouse2,
        warehouseId: warehouse2,
        status: 'packed',
        workflowStatus: 'PACKED',
        workflowVersion: 2,
        paymentMode: 'COD',
        paymentStatus: 'PENDING_CASH_COLLECTION',
        payment: { method: 'cash', status: 'pending' },
        createdAt: new Date('2026-10-10T09:55:38.000Z'),
        updatedAt: new Date('2026-10-10T09:56:46.000Z'),
        address: {
          type: 'Home',
          name: 'Ankit Ahirwar',
          phone: '+919755620716',
          address: 'City Center',
          city: 'Gwalior',
          state: 'Madhya Pradesh',
          pincode: '474011',
          location: { lat: 26.2058, lng: 78.1963 }
        },
        pricing: {
          subtotal: 693,
          deliveryFee: 0,
          platformFee: 5,
          gst: 0,
          tip: 0,
          discount: 0,
          total: 698,
          walletAmount: 0
        },
        items: [
          {
            product: new mongoose.Types.ObjectId('6ac21d31287a4ba774968bbf'),
            name: 'Garam masala',
            quantity: 7,
            price: 99,
            variantSlot: 'GARAM-01-6M50',
            image: ''
          }
        ]
      },
      // Order 6: Ankit Ahirwar (10 Oct 2026)
      {
        orderId: 'ORD-01M4JJENPAGC2ADSQMNDVSVV1R',
        chkId: 'CHK-01M4JJENP06C2ADSQMNDVSVV1R',
        fulId: 'FUL-SVV1R-606',
        customer: new mongoose.Types.ObjectId('6ac9ffa138b350cf224607db'),
        seller: defaultSellerId,
        warehouse: warehouse2,
        warehouseId: warehouse2,
        status: 'delivered',
        workflowStatus: 'DELIVERED',
        workflowVersion: 2,
        paymentMode: 'COD',
        paymentStatus: 'PAID',
        payment: { method: 'cash', status: 'completed' },
        createdAt: new Date('2026-10-10T09:31:37.000Z'),
        updatedAt: new Date('2026-10-10T09:35:06.000Z'),
        address: {
          type: 'Home',
          name: 'Ankit Ahirwar',
          phone: '+919755620716',
          address: 'City Center',
          city: 'Gwalior',
          state: 'Madhya Pradesh',
          pincode: '474011',
          location: { lat: 26.2058, lng: 78.1963 }
        },
        pricing: {
          subtotal: 594,
          deliveryFee: 0,
          platformFee: 5,
          gst: 0,
          tip: 0,
          discount: 0,
          total: 599,
          walletAmount: 0
        },
        items: [
          {
            product: new mongoose.Types.ObjectId('6ac21d31287a4ba774968bbf'),
            name: 'Garam masala',
            quantity: 6,
            price: 99,
            variantSlot: 'GARAM-01-6M50',
            image: ''
          }
        ]
      },
      // Order 7: Ankit Ahirwar (10 Oct 2026)
      {
        orderId: 'ORD-01M4JJA4T5XYM9E1E8D3EH36ZC',
        chkId: 'CHK-01M4JJA4T07YM9E1E8D3EH36ZC',
        fulId: 'FUL-H36ZC-707',
        customer: new mongoose.Types.ObjectId('6ac9ffa138b350cf224607db'),
        seller: defaultSellerId,
        warehouse: warehouse2,
        warehouseId: warehouse2,
        status: 'delivered',
        workflowStatus: 'DELIVERED',
        workflowVersion: 2,
        paymentMode: 'COD',
        paymentStatus: 'PAID',
        payment: { method: 'cash', status: 'completed' },
        createdAt: new Date('2026-10-10T09:29:09.000Z'),
        updatedAt: new Date('2026-10-10T09:36:03.000Z'),
        address: {
          type: 'Home',
          name: 'Ankit Ahirwar',
          phone: '+919755620716',
          address: 'City Center',
          city: 'Gwalior',
          state: 'Madhya Pradesh',
          pincode: '474011',
          location: { lat: 26.2058, lng: 78.1963 }
        },
        pricing: {
          subtotal: 594,
          deliveryFee: 0,
          platformFee: 5,
          gst: 0,
          tip: 0,
          discount: 0,
          total: 599,
          walletAmount: 0
        },
        items: [
          {
            product: new mongoose.Types.ObjectId('6ac21d31287a4ba774968bbf'),
            name: 'Garam masala',
            quantity: 6,
            price: 99,
            variantSlot: 'GARAM-01-6M50',
            image: ''
          }
        ]
      },
      // Order 8: Palak Patel (10 Oct 2026)
      {
        orderId: 'ORD-01M4JHNN7KP4HXGTZAXQM3Y8DN',
        chkId: 'CHK-01M4JHNN7084HXGTZAXQM3Y8DN',
        fulId: 'FUL-M3Y8DN-808',
        customer: new mongoose.Types.ObjectId('6acc6f9908d7ff2ebc0907fb'),
        seller: defaultSellerId,
        warehouse: warehouse2,
        warehouseId: warehouse2,
        status: 'delivered',
        workflowStatus: 'DELIVERED',
        workflowVersion: 2,
        paymentMode: 'COD',
        paymentStatus: 'PAID',
        payment: { method: 'cash', status: 'completed' },
        createdAt: new Date('2026-10-10T09:17:57.000Z'),
        updatedAt: new Date('2026-10-10T09:18:39.000Z'),
        address: {
          type: 'Home',
          name: 'Palak Patel',
          phone: '+918770620342',
          address: 'sv homes',
          city: 'Gwalior',
          state: 'Madhya Pradesh',
          pincode: '452001',
          location: { lat: 26.2124, lng: 78.1772 }
        },
        pricing: {
          subtotal: 765,
          deliveryFee: 0,
          platformFee: 5,
          gst: 0,
          tip: 0,
          discount: 0,
          total: 770,
          walletAmount: 0
        },
        items: [
          {
            product: new mongoose.Types.ObjectId('6ac9ffae73843ad0ed2ad95a'),
            name: 'Jeera',
            quantity: 1,
            price: 115,
            variantSlot: 'JEERA-01-QIDK',
            image: ''
          },
          {
            product: new mongoose.Types.ObjectId('6ac21cf5287a4ba774968ba8'),
            name: 'Kasuri maithi',
            quantity: 1,
            price: 56,
            variantSlot: 'KASUR-01-5M5K',
            image: ''
          },
          {
            product: new mongoose.Types.ObjectId('6ac21d31287a4ba774968bbf'),
            name: 'Garam masala',
            quantity: 6,
            price: 99,
            variantSlot: 'GARAM-01-6M50',
            image: ''
          }
        ]
      },
      // Order 9: Ankit Ahirwar (10 Oct 2026)
      {
        orderId: 'ORD-01M4JHE0Q0MYR99TENPQTDEMED',
        chkId: 'CHK-01M4JHE0Q09YR99TENPQTDEMED',
        fulId: 'FUL-TDEMED-909',
        customer: new mongoose.Types.ObjectId('6ac9ffa138b350cf224607db'),
        seller: defaultSellerId,
        warehouse: warehouse2,
        warehouseId: warehouse2,
        status: 'delivered',
        workflowStatus: 'DELIVERED',
        workflowVersion: 2,
        paymentMode: 'COD',
        paymentStatus: 'PAID',
        payment: { method: 'cash', status: 'completed' },
        createdAt: new Date('2026-10-10T09:13:47.000Z'),
        updatedAt: new Date('2026-10-10T09:18:42.000Z'),
        address: {
          type: 'Home',
          name: 'Ankit Ahirwar',
          phone: '+919755620716',
          address: 'City Center',
          city: 'Gwalior',
          state: 'Madhya Pradesh',
          pincode: '474011',
          location: { lat: 26.2058, lng: 78.1963 }
        },
        pricing: {
          subtotal: 594,
          deliveryFee: 0,
          platformFee: 5,
          gst: 0,
          tip: 0,
          discount: 0,
          total: 599,
          walletAmount: 0
        },
        items: [
          {
            product: new mongoose.Types.ObjectId('6ac21d31287a4ba774968bbf'),
            name: 'Garam masala',
            quantity: 6,
            price: 99,
            variantSlot: 'GARAM-01-6M50',
            image: ''
          }
        ]
      }
    ];

    let restoredCount = 0;
    for (const ordData of ordersToRestore) {
      const existing = await db.collection('orders').findOne({ orderId: ordData.orderId });
      if (existing) {
        console.log(`- Order ${ordData.orderId} already exists, skipping.`);
        continue;
      }

      const orderDoc = {
        _id: new mongoose.Types.ObjectId(),
        orderId: ordData.orderId,
        customer: ordData.customer,
        seller: ordData.seller,
        warehouse: ordData.warehouse,
        warehouseId: ordData.warehouseId,
        items: ordData.items,
        address: ordData.address,
        payment: ordData.payment,
        paymentMode: ordData.paymentMode,
        paymentStatus: ordData.paymentStatus,
        pricing: ordData.pricing,
        status: ordData.status,
        workflowStatus: ordData.workflowStatus,
        workflowVersion: ordData.workflowVersion,
        warehouseAssignmentStatus: 'ASSIGNED',
        warehouseAssignedAt: ordData.createdAt,
        timeSlot: 'now',
        deviceType: 'Mobile',
        trafficSource: 'Direct',
        returnStatus: 'none',
        createdAt: ordData.createdAt,
        updatedAt: ordData.updatedAt
      };

      await db.collection('orders').insertOne(orderDoc);

      // Create matching CheckoutGroup
      const chkDoc = {
        _id: new mongoose.Types.ObjectId(),
        checkoutGroupId: ordData.chkId,
        customer: ordData.customer,
        orderIds: [orderDoc._id],
        publicOrderIds: [orderDoc.orderId],
        paymentMode: ordData.paymentMode,
        paymentStatus: ordData.paymentStatus,
        status: 'CREATED',
        pricingSummary: {
          currency: 'INR',
          productSubtotal: ordData.pricing.subtotal,
          deliveryFeeCharged: ordData.pricing.deliveryFee,
          handlingFeeCharged: ordData.pricing.platformFee,
          tipTotal: 0,
          discountTotal: 0,
          taxTotal: 0,
          grandTotal: ordData.pricing.total,
          walletAmount: 0,
          sellerPayoutTotal: ordData.pricing.subtotal,
          adminProductCommissionTotal: 0,
          platformTotalEarning: ordData.pricing.platformFee
        },
        sellerCount: 1,
        itemCount: ordData.items.reduce((sum, it) => sum + it.quantity, 0),
        addressSnapshot: ordData.address,
        createdAt: ordData.createdAt,
        updatedAt: ordData.updatedAt
      };
      await db.collection('checkoutgroups').insertOne(chkDoc);

      // Create matching WarehouseFulfillment
      const fulDoc = {
        _id: new mongoose.Types.ObjectId(),
        fulfillmentId: ordData.fulId,
        order: orderDoc._id,
        orderId: orderDoc.orderId,
        warehouse: ordData.warehouse,
        status: ordData.status === 'delivered' ? 'COMPLETED' : ordData.status === 'out_for_delivery' ? 'SHIPPED' : 'PACKED',
        items: ordData.items.map(it => ({
          product: it.product,
          name: it.name,
          sku: it.variantSlot,
          price: it.price,
          requiredQty: it.quantity,
          pickedQty: it.quantity,
          shortQty: 0,
          shortReason: '',
          status: 'PICKED'
        })),
        assignedAt: ordData.createdAt,
        packedAt: ordData.createdAt,
        shippedAt: ordData.updatedAt,
        completedAt: ordData.status === 'delivered' ? ordData.updatedAt : null,
        assignedBy: 'system',
        createdAt: ordData.createdAt,
        updatedAt: ordData.updatedAt
      };
      await db.collection('warehousefulfillments').insertOne(fulDoc);

      restoredCount++;
      console.log(`✓ Restored Order: ${ordData.orderId} (${ordData.address.name}, ₹${ordData.pricing.total}, ${ordData.status})`);
    }

    // Reset dashboard cache so dashboard reflects restored orders dynamically
    await db.collection('dashboardstats').deleteMany({ metric: 'order_counts' });
    console.log('✓ Reset dashboard order cache');

    console.log(`\n==============================================`);
    console.log(`Restoration Completed Successfully!`);
    console.log(`- Coupon WELCOME-10: Active and ready`);
    console.log(`- Orders restored: ${restoredCount}`);
    console.log(`- Total orders in DB now: ${await db.collection('orders').countDocuments()}`);
    console.log(`==============================================`);

    process.exit(0);
  } catch (err) {
    console.error('Error during restoration:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

restore();
