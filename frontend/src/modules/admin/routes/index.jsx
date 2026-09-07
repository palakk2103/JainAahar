import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@shared/layout/DashboardLayout";
import { useSupportUnread } from "@core/context/SupportUnreadContext";
import { setActiveRole, ROLES } from "@core/auth/activeRoleStore";
import {
  LayoutDashboard,
  Tag,
  Box,
  Building2,
  Truck,
  Wallet,
  Banknote,
  Receipt,
  CircleDollarSign,
  Users,
  HelpCircle,
  ClipboardList,
  RotateCcw,
  Settings,
  Terminal,
  Sparkles,
  User,
  AlertTriangle,
  UserCheck,
  MessageSquare,
} from "lucide-react";

const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const CategoryManagement = React.lazy(
  () => import("../pages/CategoryManagement"),
);
const HeaderCategories = React.lazy(
  () => import("../pages/categories/HeaderCategories"),
);
const Level2Categories = React.lazy(
  () => import("../pages/categories/Level2Categories"),
);
const SubCategories = React.lazy(
  () => import("../pages/categories/SubCategories"),
);
const CategoryHierarchy = React.lazy(
  () => import("../pages/categories/CategoryHierarchy"),
);
const ProductManagement = React.lazy(
  () => import("../pages/ProductManagement"),
);
const ActiveSellers = React.lazy(() => import("../pages/ActiveSellers"));
const PendingSellers = React.lazy(() => import("../pages/PendingSellers"));
const SellerLocations = React.lazy(() => import("../pages/SellerLocations"));
const ActiveDeliveryBoys = React.lazy(
  () => import("../pages/ActiveDeliveryBoys"),
);
const PendingDeliveryBoys = React.lazy(
  () => import("../pages/PendingDeliveryBoys"),
);
const DeliveryFunds = React.lazy(() => import("../pages/DeliveryFunds"));
const AdminWallet = React.lazy(() => import("../pages/AdminWallet"));
const WithdrawalRequests = React.lazy(
  () => import("../pages/WithdrawalRequests"),
);
const SellerTransactions = React.lazy(
  () => import("../pages/SellerTransactions"),
);
const CashCollection = React.lazy(() => import("../pages/CashCollection"));
const CustomerManagement = React.lazy(
  () => import("../pages/CustomerManagement"),
);
const CustomerDetail = React.lazy(() => import("../pages/CustomerDetail"));
const UserManagement = React.lazy(() => import("../pages/UserManagement"));
const Profile = React.lazy(() => import("@/pages/Profile"));
const FAQManagement = React.lazy(() => import("../pages/FAQManagement"));
const OrdersList = React.lazy(() => import("../pages/OrdersList"));
const OrderDetail = React.lazy(() => import("../pages/OrderDetail"));
const Returns = React.lazy(() => import("../pages/Returns"));
const SellerDetail = React.lazy(() => import("../pages/SellerDetail"));
const SupportTickets = React.lazy(() => import("../pages/SupportTickets"));
const ReviewModeration = React.lazy(() => import("../pages/ReviewModeration"));
const FleetTracking = React.lazy(() => import("../pages/FleetTracking"));
const CouponManagement = React.lazy(() => import("../pages/CouponManagement"));
const ContentManager = React.lazy(() => import("../pages/ContentManager"));
const HeroCategoriesPerPage = React.lazy(() => import("../pages/HeroCategoriesPerPage"));
const NotificationComposer = React.lazy(
  () => import("../pages/NotificationComposer"),
);
const OffersManagement = React.lazy(
  () => import("../pages/OffersManagement"),
);
const OfferSectionsManagement = React.lazy(
  () => import("../pages/OfferSectionsManagement"),
);
const ShopByStoreManagement = React.lazy(
  () => import("../pages/ShopByStoreManagement"),
);
const AdminSettings = React.lazy(() => import("../pages/AdminSettings"));
const EnvSettings = React.lazy(() => import("../pages/EnvSettings"));
const AdminProfile = React.lazy(() => import("../pages/AdminProfile"));
const WhatsAppManagement = React.lazy(() => import("../pages/WhatsAppManagement"));

const MonthlyBasketCategories = React.lazy(() => import("../pages/MonthlyBasketCategories"));
const MonthlyBasketBanners = React.lazy(() => import("../pages/MonthlyBasketBanners"));
const MonthlyBasketApprovals = React.lazy(() => import("../pages/MonthlyBasketApprovals"));

const SOSAlerts = React.lazy(() => import("../pages/SOSAlerts"));

const EmployeeManagement = React.lazy(() => import("../pages/EmployeeManagement"));
const EmployeeDetail = React.lazy(() => import("../pages/EmployeeDetail"));

const InventoryManagement = React.lazy(() => import("../pages/InventoryManagement"));
const StoreProfile = React.lazy(() => import("../pages/StoreProfile"));
const StoreAnalytics = React.lazy(() => import("../pages/StoreAnalytics"));



const navItems = [
  {
    label: "Dashboard",
    path: "/admin",
    icon: LayoutDashboard,
    color: "indigo",
    end: true,
  },
  {
    label: "Categories",
    icon: Tag,
    color: "rose",
    children: [
      { label: "All Categories", path: "/admin/categories/hierarchy" },
      { label: "Header Categories", path: "/admin/categories/header" },
      { label: "Main Categories", path: "/admin/categories/level2" },
      { label: "Sub-Categories", path: "/admin/categories/sub" },
    ],
  },
  {
    label: "Products",
    icon: Box,
    color: "amber",
    children: [
      { label: "All Products", path: "/admin/products" },
      { label: "Add Product", path: "/admin/products/add" },
    ],
  },
  {
    label: "Orders",
    icon: ClipboardList,
    color: "fuchsia",
    children: [
      { label: "All Orders", path: "/admin/orders/all" },
      { label: "New Orders", path: "/admin/orders/pending" },
      { label: "Being Prepared", path: "/admin/orders/processed" },
      { label: "On the Way", path: "/admin/orders/out-for-delivery" },
      { label: "Delivered", path: "/admin/orders/delivered" },
      { label: "Cancelled", path: "/admin/orders/cancelled" },
      { label: "Returned", path: "/admin/orders/returned" },
      { label: "Return Requests", path: "/admin/returns" },
    ],
  },
  {
    label: "Warehouses & Fulfillment",
    icon: Building2,
    color: "teal",
    children: [
      { label: "Consolidated Overview", path: "/warehouse-mgmt/overview" },
      { label: "Warehouse Dashboard", path: "/warehouse-mgmt/dashboard" },
      { label: "All Warehouses", path: "/warehouse-mgmt/warehouses" },
      { label: "Inventory Levels", path: "/warehouse-mgmt/inventory" },
      { label: "Stock Inward", path: "/warehouse-mgmt/inward" },
      { label: "Picking & Packing (Fulfillment)", path: "/warehouse-mgmt/fulfillment" },
      { label: "Warehouse Orders", path: "/warehouse-mgmt/orders" },
      { label: "Stock Transfers", path: "/warehouse-mgmt/transfers" },
      { label: "Damaged & Defective", path: "/warehouse-mgmt/damaged" },
      { label: "Returned Items", path: "/warehouse-mgmt/returns" },
      { label: "Stock Adjustments", path: "/warehouse-mgmt/adjustments" },
      { label: "Movement History", path: "/warehouse-mgmt/audit" },
      { label: "Low Stock Alerts", path: "/warehouse-mgmt/low-stock" },
      { label: "Out of Stock Items", path: "/warehouse-mgmt/out-of-stock" },
      { label: "Operational Reports", path: "/warehouse-mgmt/reports" },
    ],
  },
  { label: "Inventory", path: "/admin/inventory", icon: Box, color: "orange" },
  {
    label: "Store Management",
    icon: Building2,
    color: "blue",
    children: [
      { label: "Store Status & Profile", path: "/admin/store-profile" },
      { label: "Business Details", path: "/admin/settings" },
    ],
  },
  { label: "Store Analytics", path: "/admin/store-analytics", icon: Sparkles, color: "rose" },
  {
    label: "Marketing Tools",
    icon: Sparkles,
    color: "amber",
    children: [
      { label: "WhatsApp Integration", path: "/admin/whatsapp" },
      { label: "Create Sections", path: "/admin/experience-studio" },
      { label: "Hero & categories per page", path: "/admin/hero-categories" },
      { label: "Send Notifications", path: "/admin/notifications" },
      { label: "Coupons & Promos", path: "/admin/coupons" },
      { label: "Offer Sections", path: "/admin/offer-sections" },
      { label: "Shop by Store", path: "/admin/shop-by-store" },
    ],
  },
  {
    label: "Customer Support",
    icon: Receipt,
    color: "emerald",
    children: [
      { label: "Help Tickets", path: "/admin/support-tickets" },
      { label: "Review Content", path: "/admin/moderation" },
    ],
  },
  { label: "Wallet", path: "/admin/wallet", icon: Wallet, color: "violet" },
  { label: "Customers", path: "/admin/customers", icon: Users, color: "sky" },
  { label: "FAQs", path: "/admin/faqs", icon: HelpCircle, color: "pink" },

  {
    label: "Fees & Charges",
    path: "/admin/billing",
    icon: RotateCcw,
    color: "red",
  },
  {
    label: "Settings",
    path: "/admin/settings",
    icon: Settings,
    color: "slate",
  },
  { label: "My Profile", path: "/admin/profile", icon: User, color: "indigo" },
  { label: "System Settings", path: "/admin/env", icon: Terminal, color: "dark" },
];

const BillingCharges = React.lazy(() => import("../pages/BillingCharges"));

const AdminRoutes = () => {
  useEffect(() => {
    setActiveRole(ROLES.ADMIN);
  }, []);

  const { totalUnread } = useSupportUnread();

  const navItemsWithBadges = React.useMemo(() => {
    const count = Number.isFinite(totalUnread) ? totalUnread : 0;
    if (count <= 0) return navItems;
    return navItems.map((item) => {
      if (item?.label !== "Customer Support") return item;
      return { ...item, badgeCount: count };
    });
  }, [totalUnread]);

  return (
    <DashboardLayout navItems={navItemsWithBadges} title="Admin Center">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/profile" element={<AdminProfile />} />
        {/* Lazy routes for new sections */}
        <Route
          path="/categories"
          element={<Navigate to="/admin/categories/header" replace />}
        />
        <Route path="/categories/header" element={<HeaderCategories />} />
        <Route path="/categories/level2" element={<Level2Categories />} />
        <Route path="/categories/sub" element={<SubCategories />} />
        <Route path="/categories/hierarchy" element={<CategoryHierarchy />} />
        <Route path="/products" element={<ProductManagement />} />
        <Route path="/products/add" element={<ProductManagement initialOpenAdd={true} />} />
        <Route path="/sellers/active" element={<ActiveSellers />} />
        <Route path="/sellers/active/:id" element={<SellerDetail />} />
        {/* Warehouse routes */}

        <Route path="/support-tickets" element={<SupportTickets />} />
        <Route path="/moderation" element={<ReviewModeration />} />
        {/* Monthly Baskets */}
        <Route path="/monthly-baskets/categories" element={<MonthlyBasketCategories />} />
        <Route path="/monthly-baskets/banners" element={<MonthlyBasketBanners />} />
        <Route path="/monthly-baskets/approvals" element={<MonthlyBasketApprovals />} />
        
        <Route path="/experience-studio" element={<ContentManager />} />
        <Route path="/hero-categories" element={<HeroCategoriesPerPage />} />
        <Route path="/notifications" element={<NotificationComposer />} />
        <Route path="/offers" element={<OffersManagement />} />
        <Route path="/offer-sections" element={<OfferSectionsManagement />} />
        <Route path="/shop-by-store" element={<ShopByStoreManagement />} />
        <Route path="/coupons" element={<CouponManagement />} />
        <Route path="/sellers/pending" element={<PendingSellers />} />
        <Route path="/seller-locations" element={<SellerLocations />} />
        <Route path="/delivery-boys/active" element={<ActiveDeliveryBoys />} />
        <Route
          path="/delivery-boys/pending"
          element={<PendingDeliveryBoys />}
        />
        <Route path="/tracking" element={<FleetTracking />} />
        <Route path="/delivery-funds" element={<DeliveryFunds />} />
        <Route path="/sos-alerts" element={<SOSAlerts />} />
        <Route path="/wallet" element={<AdminWallet />} />
        <Route path="/withdrawals" element={<WithdrawalRequests />} />
        <Route path="/seller-transactions" element={<SellerTransactions />} />
        <Route path="/cash-collection" element={<CashCollection />} />
        <Route path="/employees" element={<EmployeeManagement />} />
        <Route path="/employees/:id" element={<EmployeeDetail />} />
        <Route path="/customers" element={<CustomerManagement />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/faqs" element={<FAQManagement />} />
        <Route path="/orders/:status" element={<OrdersList />} />
        <Route path="/orders/view/:orderId" element={<OrderDetail />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/billing" element={<BillingCharges />} />
        <Route path="/settings" element={<AdminSettings />} />
        <Route path="/whatsapp" element={<WhatsAppManagement />} />
        <Route path="/inventory" element={<InventoryManagement />} />
        <Route path="/store-profile" element={<StoreProfile />} />
        <Route path="/store-analytics" element={<StoreAnalytics />} />
        <Route path="/env" element={<EnvSettings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardLayout>
  );
};

export default AdminRoutes;
