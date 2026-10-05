import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, ChevronRight, Clock, CheckCircle, Loader2, ChevronLeft, ShoppingBag } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { getOrderStatusLabel, getLegacyStatusFromOrder } from '@/shared/utils/orderStatus';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

const OrdersPage = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const fetchOrders = async () => {
            setLoading(true);
            try {
                const response = await customerApi.getMyOrders();
                if (!isMounted) return;

                const payload = response?.data;
                const items =
                    payload?.result?.items ||
                    payload?.results ||
                    payload?.data?.items ||
                    payload?.data ||
                    [];

                const finalOrders = Array.isArray(items) ? items : [];
                setOrders(finalOrders);
            } catch (error) {
                console.error("Failed to fetch orders:", error);
                if (isMounted) {
                    setOrders([]);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchOrders();

        return () => {
            isMounted = false;
        };
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white font-['Outfit',_sans-serif]">
                <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white shadow-sm border border-slate-100">
                    <Loader2 className="animate-spin text-emerald-600" size={22} />
                    <span className="text-sm font-medium text-slate-600">Loading your orders…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/60 pb-24 font-['Outfit',_sans-serif]">
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 pt-4 pb-3 border-b border-slate-100 mb-4 flex items-center gap-2">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors -ml-1"
                >
                    <ChevronLeft size={22} className="text-slate-800" />
                </button>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">My Orders</h1>
            </div>

            <div className="space-y-4 px-4 pb-2 max-w-2xl mx-auto">
                {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mb-4 shadow-xs border border-emerald-100">
                            <Package size={36} className="text-emerald-600" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 mb-1.5">No orders yet</h2>
                        <p className="text-slate-500 text-xs sm:text-sm mb-6 max-w-[280px] leading-relaxed">
                            When you place an order, it will appear here so you can track its live delivery status.
                        </p>
                        <Link
                            to="/categories"
                            className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-colors flex items-center gap-2"
                        >
                            <ShoppingBag size={16} />
                            <span>Start Shopping</span>
                        </Link>
                    </div>
                ) : (
                    orders.map((order) => {
                        const legacy = getLegacyStatusFromOrder(order);
                        const firstItem = order.items?.[0];
                        const itemCount = order.items?.length || 0;

                        return (
                            <Link
                                to={`/orders/${order.orderId}`}
                                key={order._id || order.orderId}
                                className="block bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 active:scale-[0.99] transition-all hover:border-slate-300 hover:shadow-sm"
                            >
                                <div className="flex justify-between items-start gap-3 mb-3">
                                    <div className="flex gap-3.5 flex-1 min-w-0">
                                        <div className="h-12 w-12 rounded-xl overflow-hidden flex items-center justify-center bg-slate-50 ring-1 ring-slate-200/80 shrink-0">
                                            {firstItem?.image ? (
                                                <img
                                                    src={applyCloudinaryTransform(firstItem.image)}
                                                    alt={firstItem?.name || 'Order thumbnail'}
                                                    loading="lazy"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <Package size={22} className="text-slate-400" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-slate-900 text-sm tracking-tight leading-snug">
                                                Order #{String(order.orderId || '').slice(-6)}
                                            </h3>
                                            <p className="mt-0.5 text-[11px] text-slate-500 font-medium leading-tight">
                                                {new Date(order.createdAt).toLocaleDateString('en-GB', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                })}{' '}
                                                <span className="mx-1 text-slate-400">•</span>
                                                {new Date(order.createdAt).toLocaleTimeString('en-IN', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                                legacy === 'cancelled'
                                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                    : legacy === 'delivered'
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                            }`}
                                        >
                                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/80">
                                                <CheckCircle
                                                    size={10}
                                                    className={
                                                        legacy === 'cancelled'
                                                            ? 'text-rose-600'
                                                            : legacy === 'delivered'
                                                            ? 'text-emerald-600'
                                                            : 'text-blue-600'
                                                    }
                                                />
                                            </span>
                                            <span>{getOrderStatusLabel(order).toUpperCase()}</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-3 flex justify-between items-center gap-3">
                                    <div className="text-[11px] text-slate-500 font-medium truncate max-w-[220px]">
                                        {firstItem?.name || 'Items'}
                                        {itemCount > 1 ? ` + ${itemCount - 1} more` : ''}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[11px] font-medium text-slate-400">Total</span>
                                        <span className="text-sm font-bold text-slate-900">
                                            ₹{order.pricing?.total ?? order.pricing?.finalAmount ?? order.totalAmount ?? 0}
                                        </span>
                                        <ChevronRight size={16} className="text-slate-300" />
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default OrdersPage;
