import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ChevronLeft,
    Bell,
    BellRing,
    Package,
    Truck,
    CheckCircle2,
    XCircle,
    Wallet,
    Tag,
    ShoppingBag,
    CheckCheck,
    RefreshCw,
    Sparkles,
    ArrowRight
} from "lucide-react";
import { customerApi } from "../services/customerApi";
import { useCustomerNotification } from "../context/CustomerNotificationContext";
import { toast } from "sonner";

const NotificationsPage = () => {
    const navigate = useNavigate();
    const { setUnreadCount } = useCustomerNotification();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [markingRead, setMarkingRead] = useState(false);
    const [activeTab, setActiveTab] = useState("all"); // 'all' | 'orders' | 'offers' | 'wallet'

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async (isManualRefresh = false) => {
        try {
            if (isManualRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const response = await customerApi.getNotifications({ limit: 50 });
            const resData = response.data?.result || response.data?.data || response.data;
            const fetchedList = resData?.notifications || resData?.items || (Array.isArray(resData) ? resData : []);

            if (Array.isArray(fetchedList)) {
                const normalized = fetchedList.map((n, i) => ({
                    id: n._id || n.id || `notif-${i}`,
                    title: n.title || "Notification",
                    message: n.message || n.body || "",
                    isRead: Boolean(n.isRead),
                    type: n.type || "alert",
                    data: n.data || {},
                    createdAt: n.createdAt || new Date().toISOString(),
                }));
                setNotifications(normalized);
                setUnreadCount(normalized.filter((n) => !n.isRead).length);
            } else {
                setNotifications([]);
                setUnreadCount(0);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
            // Default to empty array rather than dummy notifications
            setNotifications([]);
            setUnreadCount(0);
            if (isManualRefresh) {
                toast.error("Could not refresh notifications. Please try again.");
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const markAllAsRead = async () => {
        try {
            setMarkingRead(true);
            await customerApi.markNotificationsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
            toast.success("All notifications marked as read");
        } catch (error) {
            console.error("Error marking notifications as read:", error);
            toast.error("Failed to mark all as read");
        } finally {
            setMarkingRead(false);
        }
    };

    const handleNotificationClick = async (notification) => {
        if (!notification.isRead && notification.id) {
            try {
                await customerApi.markNotificationRead(notification.id);
                setNotifications((prev) =>
                    prev.map((item) =>
                        item.id === notification.id ? { ...item, isRead: true } : item
                    )
                );
                setUnreadCount((prev) => Math.max(0, prev - 1));
            } catch (e) {
                console.error("Failed to mark notification as read:", e);
            }
        }

        const data = notification.data || {};
        const orderId = data.orderId || notification.orderId;
        const typeStr = String(notification.type || "").toLowerCase();
        const titleStr = String(notification.title || "").toLowerCase();

        if (orderId) {
            navigate(`/orders/${orderId}`);
        } else if (typeStr.includes("order") || titleStr.includes("order")) {
            navigate("/orders");
        } else if (
            typeStr.includes("wallet") ||
            typeStr.includes("payment") ||
            titleStr.includes("wallet") ||
            titleStr.includes("₹")
        ) {
            navigate("/transactions");
        } else if (
            typeStr.includes("offer") ||
            typeStr.includes("promo") ||
            typeStr.includes("coupon") ||
            titleStr.includes("discount") ||
            titleStr.includes("coupon")
        ) {
            navigate("/offers");
        }
    };

    const getNotificationMeta = (n) => {
        const type = String(n.type || "").toLowerCase();
        const title = String(n.title || "").toLowerCase();

        if (type.includes("order") || type.includes("delivery") || title.includes("order")) {
            if (type.includes("delivered") || title.includes("delivered")) {
                return {
                    category: "orders",
                    label: "Order Delivered",
                    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
                    iconBg: "bg-emerald-100/80 text-emerald-600",
                    Icon: CheckCircle2,
                };
            }
            if (type.includes("out_for_delivery") || title.includes("out for delivery") || title.includes("dispatch")) {
                return {
                    category: "orders",
                    label: "Out For Delivery",
                    badgeColor: "bg-sky-50 text-sky-700 border-sky-200/70",
                    iconBg: "bg-sky-100/80 text-sky-600",
                    Icon: Truck,
                };
            }
            if (type.includes("cancel") || title.includes("cancelled")) {
                return {
                    category: "orders",
                    label: "Order Cancelled",
                    badgeColor: "bg-rose-50 text-rose-700 border-rose-200/70",
                    iconBg: "bg-rose-100/80 text-rose-600",
                    Icon: XCircle,
                };
            }
            return {
                category: "orders",
                label: "Order Update",
                badgeColor: "bg-blue-50 text-blue-700 border-blue-200/70",
                iconBg: "bg-blue-100/80 text-blue-600",
                Icon: Package,
            };
        }

        if (
            type.includes("wallet") ||
            type.includes("payment") ||
            type.includes("refund") ||
            title.includes("wallet") ||
            title.includes("payment") ||
            title.includes("refund")
        ) {
            return {
                category: "wallet",
                label: "Wallet & Payment",
                badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
                iconBg: "bg-emerald-100/80 text-emerald-600",
                Icon: Wallet,
            };
        }

        if (
            type.includes("offer") ||
            type.includes("promo") ||
            type.includes("system") ||
            title.includes("discount") ||
            title.includes("coupon") ||
            title.includes("sale")
        ) {
            return {
                category: "offers",
                label: "Special Offer",
                badgeColor: "bg-amber-50 text-amber-800 border-amber-200/70",
                iconBg: "bg-amber-100/80 text-amber-700",
                Icon: Tag,
            };
        }

        return {
            category: "all",
            label: "Update",
            badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
            iconBg: "bg-slate-100 text-slate-600",
            Icon: Bell,
        };
    };

    const timeAgo = (date) => {
        if (!date) return "Just now";
        const d = new Date(date);
        if (isNaN(d.getTime())) return "Just now";
        const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
        if (seconds < 60) return "Just now";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(seconds / 3600);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(seconds / 86400);
        if (days < 7) return `${days}d ago`;
        return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    };

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    const filteredNotifications = notifications.filter((n) => {
        if (activeTab === "all") return true;
        const meta = getNotificationMeta(n);
        return meta.category === activeTab;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-['Outfit',_sans-serif]">
                <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600 mb-3"></div>
                <p className="text-xs font-medium text-slate-500">Loading your notifications...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/60 pb-28 font-['Outfit',_sans-serif]">
            {/* Top Sticky Header */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 pt-4 pb-3 border-b border-slate-100 shadow-xs">
                <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors -ml-1 text-slate-800"
                            aria-label="Go back"
                        >
                            <ChevronLeft size={22} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                                    Notifications
                                </h1>
                                {unreadCount > 0 && (
                                    <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                                        {unreadCount} new
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                {notifications.length}{" "}
                                {notifications.length === 1 ? "notification" : "notifications"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => fetchNotifications(true)}
                            disabled={refreshing}
                            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
                            title="Refresh notifications"
                            aria-label="Refresh"
                        >
                            <RefreshCw size={18} className={refreshing ? "animate-spin text-emerald-600" : ""} />
                        </button>

                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                disabled={markingRead}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl transition-all"
                            >
                                <CheckCheck size={14} />
                                <span>{markingRead ? "Marking..." : "Read all"}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Tabs (Visible when there are notifications) */}
                {notifications.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 pt-1 overflow-x-auto no-scrollbar max-w-2xl mx-auto">
                        {[
                            { id: "all", label: "All", count: notifications.length },
                            {
                                id: "orders",
                                label: "Orders",
                                count: notifications.filter((n) => getNotificationMeta(n).category === "orders").length,
                            },
                            {
                                id: "offers",
                                label: "Offers",
                                count: notifications.filter((n) => getNotificationMeta(n).category === "offers").length,
                            },
                            {
                                id: "wallet",
                                label: "Wallet",
                                count: notifications.filter((n) => getNotificationMeta(n).category === "wallet").length,
                            },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                                    activeTab === tab.id
                                        ? "bg-emerald-600 text-white shadow-xs font-semibold"
                                        : "bg-slate-100/90 hover:bg-slate-200/70 text-slate-600"
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                        activeTab === tab.id
                                            ? "bg-white/20 text-white"
                                            : "bg-slate-200/70 text-slate-600"
                                    }`}
                                >
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Notification List Container */}
            <div className="px-4 pt-4 space-y-3 max-w-2xl mx-auto">
                {filteredNotifications.length > 0 ? (
                    filteredNotifications.map((notification) => {
                        const meta = getNotificationMeta(notification);
                        const MetaIcon = meta.Icon;
                        const isClickable =
                            Boolean(notification.data?.orderId) ||
                            meta.category === "orders" ||
                            meta.category === "offers" ||
                            meta.category === "wallet";

                        return (
                            <div
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`p-4 rounded-2xl border transition-all duration-200 relative text-left ${
                                    isClickable ? "cursor-pointer active:scale-[0.99]" : ""
                                } ${
                                    notification.isRead
                                        ? "bg-white border-slate-200/80 shadow-xs hover:border-slate-300"
                                        : "bg-emerald-50/35 border-emerald-200/90 shadow-xs hover:border-emerald-300"
                                }`}
                            >
                                {/* Unread indicator dot */}
                                {!notification.isRead && (
                                    <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                )}

                                <div className="flex items-start gap-3.5">
                                    <div
                                        className={`mt-0.5 w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center transition-transform ${
                                            meta.iconBg
                                        }`}
                                    >
                                        <MetaIcon size={20} />
                                    </div>

                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span
                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${meta.badgeColor}`}
                                            >
                                                {meta.label}
                                            </span>
                                            <span className="text-[11px] text-slate-400 font-medium">
                                                {timeAgo(notification.createdAt)}
                                            </span>
                                        </div>

                                        <h3
                                            className={`text-sm font-bold leading-snug ${
                                                notification.isRead ? "text-slate-800" : "text-slate-900"
                                            }`}
                                        >
                                            {notification.title}
                                        </h3>

                                        <p
                                            className={`mt-1 text-xs leading-relaxed ${
                                                notification.isRead ? "text-slate-500" : "text-slate-700"
                                            }`}
                                        >
                                            {notification.message}
                                        </p>

                                        {isClickable && (
                                            <div className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800">
                                                <span>
                                                    {meta.category === "orders"
                                                        ? "View Order Status"
                                                        : meta.category === "offers"
                                                        ? "View Offer"
                                                        : meta.category === "wallet"
                                                        ? "View Transactions"
                                                        : "View Details"}
                                                </span>
                                                <ArrowRight size={12} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    /* Clean Empty State */
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mb-4 shadow-xs border border-emerald-100">
                            <Bell className="text-emerald-600" size={32} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 mb-1.5">
                            {activeTab === "all" ? "No notifications yet" : `No ${activeTab} notifications`}
                        </h2>
                        <p className="text-slate-500 text-xs sm:text-sm max-w-[290px] leading-relaxed mb-6 font-medium">
                            {activeTab === "all"
                                ? "You'll see real-time updates here about your placed orders, live delivery status, wallet credits, and special offers."
                                : `When updates related to ${activeTab} arrive, they will be listed here.`}
                        </p>
                        {activeTab === "all" ? (
                            <button
                                onClick={() => navigate("/categories")}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
                            >
                                <ShoppingBag size={16} />
                                <span>Explore Groceries</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => setActiveTab("all")}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                            >
                                Show All Notifications
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;
