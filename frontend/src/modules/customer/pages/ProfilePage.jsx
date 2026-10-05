import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    User, MapPin, Package, CreditCard, Wallet, ChevronRight,
    LogOut, ShieldCheck, Heart, HelpCircle, Info, Edit2, ChevronLeft, Bell, ShoppingCart,
    ClipboardCheck, Ticket, LifeBuoy, MapPinned, CalendarCheck, BadgePercent, Globe,
    Trash2, AlertTriangle, Phone, ScrollText, Truck, RotateCcw, MessageSquare, Settings
} from 'lucide-react';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { useTranslation } from '@core/context/LanguageContext';
import { useToast } from '@shared/components/ui/Toast';
import { customerApi } from '../services/customerApi';
import { useCustomerNotification } from '../context/CustomerNotificationContext';
import CartPage from './CartPage';
import { cn } from '@/lib/utils';

const ProfilePage = () => {
    const navigate = useNavigate();
    const { user, logout, refreshUser } = useAuth();
    const { settings } = useSettings();
    const { unreadCount: notificationCount } = useCustomerNotification();
    const { showToast } = useToast();
    const { t, language, setLanguage, languages } = useTranslation();
    const appName = settings?.appName || 'App';
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isLangExpanded, setIsLangExpanded] = useState(false);

    React.useEffect(() => {
        if (refreshUser) {
            refreshUser();
        }
    }, []);

    const formatIndiaPhone = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.startsWith('+91')) return raw.replace(/^\+91[\s-]*/, '');
        if (raw.startsWith('91') && raw.length >= 12) return raw.replace(/^91[\s-]*/, '');
        return raw;
    };

    const handleDeleteAccount = async () => {
        try {
            setDeleteLoading(true);
            const res = await customerApi.deleteAccount();
            showToast(res?.data?.message || "Account deleted successfully", "success");
            setShowDeleteModal(false);
            logout();
            navigate('/login');
        } catch (error) {
            console.error("Delete account error:", error);
            showToast(error.response?.data?.message || "Failed to delete account", "error");
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <>
            <div className="min-h-screen bg-slate-50/50 pb-20 font-['Outfit',_sans-serif]">
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 pt-4 pb-3 border-b border-slate-100 mb-4 flex items-center gap-2 shadow-2xs">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors -ml-1"
                >
                    <ChevronLeft size={22} className="text-slate-800" />
                </button>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t('myProfile')}</h1>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/notifications')}
                        title="View notifications"
                        className="w-10 h-10 flex items-center justify-center rounded-full transition-colors border border-slate-200 bg-white hover:bg-slate-100 shadow-2xs relative"
                        aria-label="Notifications"
                    >
                        <Bell size={18} className="text-slate-700" />
                        {notificationCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-[#FF8200] text-white text-[9px] font-black min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-in zoom-in duration-300">
                                {notificationCount > 99 ? '99+' : notificationCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-1 relative z-20 space-y-4">

                {/* User Identity Card */}
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-brand-50 to-brand-100/60 border border-brand-200/50 flex items-center justify-center p-0.5 shadow-sm">
                            <div className="h-full w-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                                {user?.avatar ? (
                                    <img
                                        src={user.avatar}
                                        alt={user?.name || "Customer"}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <User size={26} className="text-primary" />
                                )}
                            </div>
                        </div>
                        <div>
                            <h2 className="text-base leading-tight font-bold text-slate-900">{user?.name || 'Customer'}</h2>
                            <p className="text-slate-500 text-xs font-semibold flex items-center gap-1 mt-1">
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase">India</span> +91 {formatIndiaPhone(user?.phone)}
                            </p>
                        </div>
                    </div>
                    <Link to="/profile/edit" className="p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100 transition-colors shadow-2xs">
                        <Edit2 size={16} />
                    </Link>
                </div>

                {/* Quick Action Badges (Circular Highlight Icon Style) */}
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="grid grid-cols-4 gap-2">
                        <button
                            onClick={() => navigate('/orders')}
                            className="flex flex-col items-center text-center group py-1"
                        >
                            <div className="w-12 h-12 rounded-full bg-emerald-50/80 border border-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs mb-1.5 group-hover:scale-108 transition-transform">
                                <CalendarCheck size={22} strokeWidth={2.5} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 leading-tight">{t('yourOrders')}</span>
                        </button>
                        <button
                            onClick={() => navigate('/wallet')}
                            className="flex flex-col items-center text-center group py-1"
                        >
                            <div className="w-12 h-12 rounded-full bg-teal-50/80 border border-teal-100 text-teal-700 flex items-center justify-center shadow-2xs mb-1.5 group-hover:scale-108 transition-transform">
                                <Wallet size={22} strokeWidth={2.5} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 leading-tight">{t('wallet')}</span>
                        </button>
                        <button
                            onClick={() => navigate('/wishlist')}
                            className="flex flex-col items-center text-center group py-1"
                        >
                            <div className="w-12 h-12 rounded-full bg-rose-50/80 border border-rose-100 text-rose-700 flex items-center justify-center shadow-2xs mb-1.5 group-hover:scale-108 transition-transform">
                                <BadgePercent size={22} strokeWidth={2.5} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 leading-tight">{t('wishlist')}</span>
                        </button>
                        <button
                            onClick={() => navigate('/addresses')}
                            className="flex flex-col items-center text-center group py-1"
                        >
                            <div className="w-12 h-12 rounded-full bg-blue-50/80 border border-blue-100 text-blue-700 flex items-center justify-center shadow-2xs mb-1.5 group-hover:scale-108 transition-transform">
                                <MapPinned size={22} strokeWidth={2.5} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 leading-tight">{t('savedAddresses')}</span>
                        </button>
                    </div>
                </div>

                {/* Menu Sections */}
                <div className="space-y-4">
                    {/* Account Section */}
                    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('personalAccount')}</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            <MenuItem
                                icon={ShoppingCart}
                                label={t('myCart')}
                                sub={t('viewAdded')}
                                onClick={() => setIsCartOpen(true)}
                                badgeBg="bg-amber-50/80 border-amber-100/70 text-amber-700"
                            />
                            <MenuItem
                                icon={CalendarCheck}
                                label={t('yourOrders')}
                                sub={t('trackReturn')}
                                path="/orders"
                                badgeBg="bg-emerald-50/80 border-emerald-100/70 text-emerald-700"
                            />
                            <MenuItem
                                icon={CreditCard}
                                label={t('transactions')}
                                sub={t('viewPayments')}
                                path="/transactions"
                                badgeBg="bg-orange-50/80 border-orange-100/70 text-orange-700"
                            />
                            <MenuItem
                                icon={Wallet}
                                label={t('wallet')}
                                sub={t('balanceRefunds')}
                                path="/wallet"
                                badgeBg="bg-teal-50/80 border-teal-100/70 text-teal-700"
                            />
                            <MenuItem
                                icon={BadgePercent}
                                label={t('wishlist')}
                                sub={t('savedItems')}
                                path="/wishlist"
                                badgeBg="bg-rose-50/80 border-rose-100/70 text-rose-700"
                            />
                            <MenuItem
                                icon={MapPinned}
                                label={t('savedAddresses')}
                                sub={t('manageLocations')}
                                path="/addresses"
                                badgeBg="bg-blue-50/80 border-blue-100/70 text-blue-700"
                            />
                        </div>
                    </div>

                    {/* Support Section */}
                    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('helpSettings')}</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {/* Select Language Accordion */}
                            <div>
                                <button
                                    onClick={() => setIsLangExpanded(!isLangExpanded)}
                                    className="w-full text-left px-4 py-3.5 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full border bg-orange-50/80 border-orange-100/70 text-orange-600 flex items-center justify-center shadow-2xs group-hover:scale-108 transition-transform flex-shrink-0">
                                            <Globe size={18} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800 leading-tight">{t('selectLanguage')}</h3>
                                            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                                                {languages.find(l => l.code === language)?.flag} {languages.find(l => l.code === language)?.name}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="p-1.5 rounded-full group-hover:bg-slate-100 transition-colors">
                                        <ChevronRight 
                                            size={16} 
                                            className={cn("text-slate-400 group-hover:text-slate-600 transition-all", isLangExpanded ? "rotate-90 text-slate-600" : "")} 
                                        />
                                    </div>
                                </button>
                                
                                {isLangExpanded && (
                                    <div className="bg-slate-50/50 border-t border-slate-100/60 divide-y divide-slate-100/60 transition-all duration-300">
                                        {languages.map((lang) => (
                                            <button
                                                key={lang.code}
                                                type="button"
                                                onClick={() => setLanguage(lang.code)}
                                                className="w-full flex items-center justify-between px-6 py-3 hover:bg-slate-100/40 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg leading-none">{lang.flag}</span>
                                                    <span className={`text-xs font-bold transition-colors ${
                                                        language === lang.code ? 'text-orange-500' : 'text-slate-600'
                                                    }`}>
                                                        {lang.name}
                                                    </span>
                                                </div>
                                                {language === lang.code && (
                                                    <div className="w-2 h-2 rounded-full bg-orange-500 shadow-xs" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* WhatsApp & Notification Settings hidden for now */}
                            {false && (
                                <MenuItem
                                    icon={MessageSquare}
                                    label="WhatsApp & Notification Settings"
                                    path="/profile/settings"
                                    badgeBg="bg-emerald-50/80 border-emerald-100/70 text-emerald-700"
                                />
                            )}
                            <MenuItem
                                icon={LifeBuoy}
                                label={t('helpSupport') || "Help & Support"}
                                path="/support"
                                badgeBg="bg-purple-50/80 border-purple-100/70 text-purple-700"
                            />
                            <MenuItem
                                icon={Phone}
                                label="Contact Us"
                                path="/contact-us"
                                badgeBg="bg-emerald-50/80 border-emerald-100/70 text-emerald-700"
                            />
                            <MenuItem
                                icon={ShieldCheck}
                                label={t('privacy') || "Privacy Policy"}
                                path="/privacy-policy"
                                badgeBg="bg-indigo-50/80 border-indigo-100/70 text-indigo-700"
                            />
                            <MenuItem
                                icon={ScrollText}
                                label="Terms & Conditions"
                                path="/terms"
                                badgeBg="bg-blue-50/80 border-blue-100/70 text-blue-700"
                            />
                            <MenuItem
                                icon={Truck}
                                label="Shipping Policy"
                                path="/shipping-policy"
                                badgeBg="bg-teal-50/80 border-teal-100/70 text-teal-700"
                            />
                            <MenuItem
                                icon={RotateCcw}
                                label="Cancellation & Refund"
                                path="/cancellation-refund-policy"
                                badgeBg="bg-rose-50/80 border-rose-100/70 text-rose-700"
                            />
                            <MenuItem
                                icon={Info}
                                label={t('aboutUs') || "About Us"}
                                path="/about"
                                badgeBg="bg-cyan-50/80 border-cyan-100/70 text-cyan-700"
                            />
                        </div>
                    </div>
                </div>

                {/* Account Action Buttons */}
                <div className="space-y-2 mt-3">
                    {/* Logout Button */}
                    <button
                        type="button"
                        onClick={() => setShowLogoutModal(true)}
                        className="w-full py-3.5 rounded-2xl border border-slate-200 text-slate-700 font-bold bg-white hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                    >
                        <LogOut size={18} className="text-slate-600" />
                        {t('signOut')}
                    </button>

                    {/* Delete Account Button */}
                    <button
                        type="button"
                        onClick={() => setShowDeleteModal(true)}
                        className="w-full py-3 rounded-2xl border border-red-100 text-red-600 font-bold bg-red-50/60 hover:bg-red-100/70 transition-colors flex items-center justify-center gap-2 text-xs shadow-2xs cursor-pointer"
                    >
                        <Trash2 size={15} className="text-red-500" />
                        Delete Account
                    </button>
                </div>

                <div className="text-center pb-8 mt-4">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Version 2.4.0 • {appName}</p>
                </div>

            </div>
        </div>

        {/* Logout Confirmation Modal */}
        {showLogoutModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                        <LogOut size={24} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 text-center mb-2">{t('signOutTitle')}</h3>
                    <p className="text-sm font-medium text-slate-500 text-center mb-6">
                        {t('signOutConfirm')}
                    </p>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setShowLogoutModal(false)}
                            className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowLogoutModal(false);
                                logout();
                            }}
                            className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30"
                        >
                            {t('yesSignOut')}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Delete Account Confirmation Modal */}
        {showDeleteModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative border border-slate-100">
                    <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-inner">
                        <AlertTriangle size={28} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 text-center mb-2">Delete Account?</h3>
                    <p className="text-xs font-medium text-slate-500 text-center mb-6 leading-relaxed">
                        Are you sure you want to permanently delete your account? All your personal profile information, addresses, active cart, and preferences will be permanently removed.
                    </p>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            disabled={deleteLoading}
                            onClick={() => setShowDeleteModal(false)}
                            className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={deleteLoading}
                            onClick={handleDeleteAccount}
                            className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {deleteLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                "Delete"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Cart Overlay */}
        {isCartOpen && (
            <div className="fixed inset-0 z-[9999] flex flex-col justify-end sm:justify-center items-center bg-slate-900/60 backdrop-blur-sm m-0 p-0 sm:p-4">
                <div className="absolute inset-0" onClick={() => setIsCartOpen(false)}></div>
                <div 
                    className="relative w-full sm:max-w-md h-[90vh] sm:h-auto sm:max-h-[85vh] bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl transition-transform"
                    style={{ animation: 'slideUp 0.3s ease-out' }}
                >
                    <CartPage asOverlay onClose={() => setIsCartOpen(false)} />
                </div>
                <style dangerouslySetInnerHTML={{__html: `
                    @keyframes slideUp {
                        from { transform: translateY(100%); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                    @media (min-width: 640px) {
                        @keyframes slideUp {
                            from { transform: scale(0.95); opacity: 0; }
                            to { transform: scale(1); opacity: 1; }
                        }
                    }
                `}} />
            </div>
        )}
    </>
    );
};

const MenuItem = ({ icon: Icon, label, sub = '', path = '', onClick = undefined, badgeBg = '' }) => {
    const Component = onClick ? 'button' : Link;
    return (
    <Component to={path || undefined} onClick={onClick} className="w-full text-left px-4 py-3.5 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-colors group">
        <div className="flex items-center gap-4">
            <div className={cn("w-10 h-10 rounded-full border flex items-center justify-center shadow-2xs group-hover:scale-108 transition-transform flex-shrink-0", badgeBg || "bg-slate-50 border-slate-100 text-slate-600")}>
                <Icon size={18} strokeWidth={2.5} />
            </div>
            <div>
                <h3 className="text-sm font-bold text-slate-800 leading-tight">{label}</h3>
                {sub && <p className="text-[11px] font-medium text-slate-500 mt-0.5">{sub}</p>}
            </div>
        </div>
        <div className="p-1.5 rounded-full group-hover:bg-slate-100 transition-colors">
            <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-600 transition-all group-hover:translate-x-0.5" />
        </div>
    </Component>
    );
};

export default ProfilePage;
