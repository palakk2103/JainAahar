import React, { lazy, useMemo, useEffect, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom';
import ProtectedRoute from '../guards/ProtectedRoute';
import RoleGuard from '../guards/RoleGuard';
import { UserRole } from '../constants/roles';
import RootErrorBoundary from '../../shared/components/RootErrorBoundary';
import { setActiveRole, ROLES } from '../auth/activeRoleStore';

// Providers for Customer Module
import { WishlistProvider } from '../../modules/customer/context/WishlistContext';
import { CartProvider } from '../../modules/customer/context/CartContext';
import { CartAnimationProvider } from '../../modules/customer/context/CartAnimationContext';
import { ProductDetailProvider } from '../../modules/customer/context/ProductDetailContext';
import { LocationProvider } from '../../modules/customer/context/LocationContext';
import { PageTransitionProvider } from '../../modules/customer/context/PageTransitionContext';
import ScrollToTop from '../../modules/customer/components/shared/ScrollToTop';

// Public Pages
import Auth from '../../modules/seller/pages/Auth';
import ApplicationPending from '../../modules/seller/pages/ApplicationPending';

import AdminAuth from '../../modules/admin/pages/AdminAuth';
import DeliveryAuth from '../../modules/delivery/pages/DeliveryAuth';
import CustomerAuth from '../../modules/customer/pages/CustomerAuth';
import WarehouseAuth from '../../modules/warehouse-mgmt/pages/WarehouseAuth';

// Core Customer Pages (eagerly imported for instant 0ms page response)
import Home from '../../modules/customer/pages/Home';
import CategoriesPage from '../../modules/customer/pages/CategoriesPage';
import CategoryProductsPage from '../../modules/customer/pages/CategoryProductsPage';
import WishlistPage from '../../modules/customer/pages/WishlistPage';
import OffersPage from '../../modules/customer/pages/OffersPage';
import ShopByStorePage from '../../modules/customer/pages/ShopByStorePage';
import ProfilePage from '../../modules/customer/pages/ProfilePage';
import OrdersPage from '../../modules/customer/pages/OrdersPage';
import OrderTransactionsPage from '../../modules/customer/pages/OrderTransactionsPage';
import AddressesPage from '../../modules/customer/pages/AddressesPage';
import SettingsPage from '../../modules/customer/pages/SettingsPage';
import SupportPage from '../../modules/customer/pages/SupportPage';
import ContactUsPage from '../../modules/customer/pages/ContactUsPage';
import ChatPage from '../../modules/customer/pages/ChatPage';
import TermsPage from '../../modules/customer/pages/TermsPage';
import PrivacyPage from '../../modules/customer/pages/PrivacyPage';
import AboutPage from '../../modules/customer/pages/AboutPage';
import ShippingPolicyPage from '../../modules/customer/pages/ShippingPolicyPage';
import RefundPolicyPage from '../../modules/customer/pages/RefundPolicyPage';
import EditProfilePage from '../../modules/customer/pages/EditProfilePage';
import OrderDetailPage from '../../modules/customer/pages/OrderDetailPage';
import ProductDetailPage from '../../modules/customer/pages/ProductDetailPage';
import KitDetailPage from '../../modules/customer/pages/KitDetailPage';
import CheckoutPage from '../../modules/customer/pages/CheckoutPage';
import PaymentStatusPage from '../../modules/customer/pages/PaymentStatusPage';
import SearchPage from '../../modules/customer/pages/SearchPage';
import WalletPage from '../../modules/customer/pages/WalletPage';
import ReferEarnPage from '../../modules/customer/pages/ReferEarnPage';
import NotificationsPage from '../../modules/customer/pages/NotificationsPage';

// Lazy load heavy admin/seller/delivery/warehouse portals
const SellerModule = lazy(() => import('../../modules/seller/routes/index'));
const AdminModule = lazy(() => import('../../modules/admin/routes/index'));
const DeliveryModule = lazy(() => import('../../modules/delivery/routes/index'));
const WarehouseMgmtModule = lazy(() => import('../../modules/warehouse-mgmt/routes/index'));

import CustomerLayout from '../../modules/customer/components/layout/CustomerLayout';
import { CustomerNotificationProvider } from '../../modules/customer/context/CustomerNotificationContext';

const CustomerLayoutWrapper = () => {
    useEffect(() => {
        setActiveRole(ROLES.CUSTOMER);
    }, []);

    return (
        <LocationProvider>
            <PageTransitionProvider>
                <WishlistProvider>
                    <CartProvider>
                        <CartAnimationProvider>
                            <ProductDetailProvider>
                                <CustomerNotificationProvider>
                                    <ScrollToTop />
                                    <CustomerLayout>
                                        <Suspense fallback={<div className="flex h-screen items-center justify-center font-outfit">Loading...</div>}>
                                            <Outlet />
                                        </Suspense>
                                    </CustomerLayout>
                                </CustomerNotificationProvider>
                            </ProductDetailProvider>
                        </CartAnimationProvider>
                    </CartProvider>
                </WishlistProvider>
            </PageTransitionProvider>
        </LocationProvider>
    );
};

const AppRouter = () => {
    const router = useMemo(() => createBrowserRouter([
        {
            path: '/',
            element: <Outlet />,
            errorElement: <RootErrorBoundary />,
            children: [
                {
                    path: 'login',
                    element: <CustomerAuth />,
                },
                {
                    path: 'signup',
                    element: <CustomerAuth />,
                },
                {
                    path: 'seller/auth',
                    element: <Auth />,
                },
                {
                    path: 'seller/pending-approval',
                    element: <ApplicationPending />,
                },
                {
                    path: 'warehouse/pending-approval',
                    element: <ApplicationPending />,
                },

                {
                    path: 'admin/auth',
                    element: <AdminAuth />,
                },
                {
                    path: 'delivery/auth',
                    element: <DeliveryAuth />,
                },
                {
                    path: 'warehouse/auth',
                    element: <WarehouseAuth />,
                },
                {
                    path: 'seller/*',
                    element: (
                        <ProtectedRoute>
                            <RoleGuard allowedRoles={[UserRole.SELLER]}>
                                <SellerModule />
                            </RoleGuard>
                        </ProtectedRoute>
                    ),
                },
                {
                    path: 'admin/*',
                    element: (
                        <ProtectedRoute>
                            <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                                <AdminModule />
                            </RoleGuard>
                        </ProtectedRoute>
                    ),
                },
                {
                    path: 'delivery/*',
                    element: (
                        <ProtectedRoute>
                            <RoleGuard allowedRoles={[UserRole.DELIVERY]}>
                                <DeliveryModule />
                            </RoleGuard>
                        </ProtectedRoute>
                    ),
                },
                {
                    path: 'warehouse-mgmt/*',
                    element: (
                        <ProtectedRoute>
                            <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.WAREHOUSE_MGMT]}>
                                <WarehouseMgmtModule />
                            </RoleGuard>
                        </ProtectedRoute>
                    ),
                },
                {
                    path: 'warehouse/*',
                    element: (
                        <ProtectedRoute>
                            <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.WAREHOUSE_MGMT, UserRole.WAREHOUSE, 'warehouse']}>
                                <WarehouseMgmtModule />
                            </RoleGuard>
                        </ProtectedRoute>
                    ),
                },


                {
                    path: 'unauthorized',
                    element: <div className="flex h-screen items-center justify-center font-outfit">Unauthorized Access</div>,
                },
                {
                    element: <CustomerLayoutWrapper />,
                    children: [
                        { index: true, element: <Home /> },
                        { path: 'categories', element: <CategoriesPage /> },
                        { path: 'category/:categoryName', element: <CategoryProductsPage /> },
                        { path: 'product/:id', element: <ProductDetailPage /> },
                        { path: 'kit/:id', element: <KitDetailPage /> },
                        { path: 'terms', element: <TermsPage /> },
                        { path: 'terms-conditions', element: <TermsPage /> },
                        { path: 'terms-and-conditions', element: <TermsPage /> },
                        { path: 'terms-of-service', element: <TermsPage /> },
                        { path: 'privacy', element: <PrivacyPage /> },
                        { path: 'privacy-policy', element: <PrivacyPage /> },
                        { path: 'support', element: <SupportPage /> },
                        { path: 'contact', element: <ContactUsPage /> },
                        { path: 'contact-us', element: <ContactUsPage /> },
                        { path: 'about', element: <AboutPage /> },
                        { path: 'about-us', element: <AboutPage /> },
                        { path: 'shipping', element: <ShippingPolicyPage /> },
                        { path: 'shipping-policy', element: <ShippingPolicyPage /> },
                        { path: 'shipping-delivery-policy', element: <ShippingPolicyPage /> },
                        { path: 'cancellation-refund-policy', element: <RefundPolicyPage /> },
                        { path: 'cancellation-and-refund-policy', element: <RefundPolicyPage /> },
                        { path: 'cancellation-policy', element: <RefundPolicyPage /> },
                        { path: 'refund-policy', element: <RefundPolicyPage /> },
                        { path: 'offers', element: <OffersPage /> },
                        { path: 'shop-by-store', element: <ShopByStorePage /> },
                        { path: 'wishlist', element: <ProtectedRoute><WishlistPage /></ProtectedRoute> },
                        { path: 'orders', element: <ProtectedRoute><OrdersPage /></ProtectedRoute> },
                        { path: 'orders/:orderId', element: <ProtectedRoute><OrderDetailPage /></ProtectedRoute> },
                        { path: 'transactions', element: <ProtectedRoute><OrderTransactionsPage /></ProtectedRoute> },
                        { path: 'addresses', element: <ProtectedRoute><AddressesPage /></ProtectedRoute> },
                        { path: 'settings', element: <ProtectedRoute><SettingsPage /></ProtectedRoute> },
                        { path: 'chat', element: <ProtectedRoute><ChatPage /></ProtectedRoute> },
                        { path: 'checkout', element: <ProtectedRoute><CheckoutPage /></ProtectedRoute> },
                        { path: 'payment-status', element: <PaymentStatusPage /> },
                        { path: 'profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
                        { path: 'profile/edit', element: <ProtectedRoute><EditProfilePage /></ProtectedRoute> },
                        { path: 'wallet', element: <ProtectedRoute><WalletPage /></ProtectedRoute> },
                        { path: 'refer-earn', element: <ProtectedRoute><ReferEarnPage /></ProtectedRoute> },
                        { path: 'notifications', element: <ProtectedRoute><NotificationsPage /></ProtectedRoute> },
                        { path: 'search', element: <SearchPage /> },
                    ]
                },
                {
                    path: '*',
                    element: <Navigate to="/" replace />
                }
            ]
        }
    ]), []);

    return <RouterProvider router={router} />;
};

export default AppRouter;
