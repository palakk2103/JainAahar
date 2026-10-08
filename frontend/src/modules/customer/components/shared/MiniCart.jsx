import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useProductDetail } from '../../context/ProductDetailContext';
import { motion, AnimatePresence } from 'framer-motion';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { MINIMUM_ORDER_VALUE } from '@/core/constants/order';

const MiniCart = () => {
    const location = useLocation();
    const { cart, cartCount, cartTotal } = useCart();
    const { isOpen: isProductDetailOpen } = useProductDetail();

    const isCheckout = location.pathname.startsWith('/checkout');
    const isSearch = location.pathname.startsWith('/search');
    const isChat = location.pathname.startsWith('/chat');
    const shouldHide =
        cartCount <= 0 ||
        isCheckout ||
        isSearch ||
        isChat ||
        isProductDetailOpen;

    if (shouldHide) return null;

    const previewItems = cart.slice(0, 3);

    return (
        <AnimatePresence>
            {/* Mobile View: Centered Bar shifted cleanly above the BottomNav */}
            <div className="md:hidden fixed bottom-[74px] left-3 right-3 max-w-lg mx-auto z-[490] pointer-events-auto">
                <motion.div
                    initial={{ y: 50, opacity: 0, scale: 0.95 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 50, opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                >
                    <Link
                        to="/checkout"
                        id="mobile-mini-cart-button"
                        className="flex items-center justify-between bg-gradient-to-r from-[#ff5500] via-[#ff6a00] to-[#ff7700] text-white px-4 py-2.5 rounded-2xl shadow-[0_12px_28px_rgba(255,85,0,0.45)] border border-white/20 active:scale-[0.98] transition-transform"
                    >
                        <div className="flex items-center gap-2.5">
                            {/* Product Thumbnails Stack */}
                            <div className="flex -space-x-2.5">
                                {previewItems.map((item, idx) => (
                                    <div
                                        key={item.id || item._id || idx}
                                        className="w-8 h-8 rounded-full border-2 border-white bg-white overflow-hidden shadow-xs shrink-0"
                                        style={{ zIndex: 10 - idx }}
                                    >
                                        <img
                                            src={applyCloudinaryTransform(item.image || item.mainImage)}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.currentTarget.onerror = null;
                                                e.currentTarget.src = 'https://placehold.co/100x100?text=Item';
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col text-left">
                                <span className="text-[11px] font-black uppercase tracking-wider text-orange-100">
                                    {cartCount} {cartCount === 1 ? 'Item' : 'Items'}
                                    {cartTotal < MINIMUM_ORDER_VALUE && (
                                        <span className="ml-1 opacity-90 font-bold">• Min ₹{MINIMUM_ORDER_VALUE}</span>
                                    )}
                                </span>
                                <span className="text-sm font-black tracking-tight leading-tight">
                                    ₹{cartTotal.toLocaleString('en-IN')}
                                    {cartTotal < MINIMUM_ORDER_VALUE && (
                                        <span className="ml-1 text-[11px] font-semibold text-orange-100">
                                            (+₹{MINIMUM_ORDER_VALUE - cartTotal})
                                        </span>
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 bg-white/20 hover:bg-white/30 backdrop-blur-xs px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors">
                            <span>View Cart</span>
                            <ChevronRight size={15} strokeWidth={3} />
                        </div>
                    </Link>
                </motion.div>
            </div>

            {/* Desktop View: Floating Cart Bar in Bottom-Right Corner */}
            <div className="hidden md:flex fixed bottom-8 right-8 z-[490] pointer-events-auto">
                <motion.div
                    initial={{ y: 50, opacity: 0, scale: 0.95 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 50, opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                >
                    <Link
                        to="/checkout"
                        id="desktop-mini-cart-button"
                        className="flex items-center gap-4 bg-gradient-to-r from-[#ff5500] via-[#ff6a00] to-[#ff7700] text-white px-5 py-3 rounded-2xl shadow-[0_16px_36px_rgba(255,85,0,0.45)] border border-white/20 hover:scale-[1.03] active:scale-[0.98] transition-all group"
                    >
                        <div className="relative">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                <ShoppingBag size={20} className="text-white" strokeWidth={2.3} />
                            </div>
                            <span className="absolute -top-1.5 -right-1.5 bg-white text-[#ff5500] text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                                {cartCount}
                            </span>
                        </div>

                        <div className="flex flex-col text-left">
                            <span className="text-xs font-bold text-orange-100 uppercase tracking-wider">
                                {cartCount} {cartCount === 1 ? 'Item' : 'Items'} in Cart
                                {cartTotal < MINIMUM_ORDER_VALUE && (
                                    <span className="ml-1.5 font-bold">• Min ₹{MINIMUM_ORDER_VALUE}</span>
                                )}
                            </span>
                            <span className="text-base font-black tracking-tight">
                                ₹{cartTotal.toLocaleString('en-IN')}
                                {cartTotal < MINIMUM_ORDER_VALUE && (
                                    <span className="ml-2 text-xs font-semibold text-orange-100">
                                        (Add ₹{MINIMUM_ORDER_VALUE - cartTotal} more)
                                    </span>
                                )}
                            </span>
                        </div>

                        <div className="flex items-center gap-1 bg-white text-[#ff5500] px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wider ml-2 shadow-xs group-hover:bg-orange-50 transition-colors">
                            <span>Checkout</span>
                            <ChevronRight size={15} strokeWidth={3} />
                        </div>
                    </Link>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default MiniCart;
