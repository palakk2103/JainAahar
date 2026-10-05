import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { formatWeight } from '@/core/utils/formatUtils';

const CartPage = ({ asOverlay = false, onClose }) => {
    const { cart, cartTotal } = useCart();
    const navigate = useNavigate();

    const hasOutOfStockItems = React.useMemo(() => {
        return cart.some(
            (item) =>
                item?.isOutOfStock === true ||
                item?.stockStatus === "out_of_stock" ||
                (item?.stock !== undefined && item?.stock !== null && Number(item.stock) <= 0) ||
                (item?.availableStock !== undefined && item?.availableStock !== null && Number(item.availableStock) <= 0)
        );
    }, [cart]);

    const hasExceededQuantityItems = React.useMemo(() => {
        return cart.some((item) => Number(item?.quantity || 0) > 10);
    }, [cart]);

    return (
        <div className={`bg-white font-sans ${asOverlay ? 'h-full overflow-y-auto relative pb-28' : 'min-h-screen pb-28'}`}>
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white px-4 py-4 flex items-center border-b border-gray-100/50">
                <button
                    onClick={() => (asOverlay && onClose ? onClose() : navigate(-1))}
                    className="p-1 -ml-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <ChevronLeft size={24} className="text-gray-900" />
                </button>
                <h1 className="flex-1 text-center text-[18px] font-bold text-gray-900 mr-6">
                    My Cart
                </h1>
            </div>

            {/* Cart Items */}
            {cart.length > 0 ? (
                <div className="px-5 pt-2 space-y-8">
                    {cart.map((item) => {
                        const isItemOutOfStock = Boolean(
                            item?.isOutOfStock === true ||
                            item?.stockStatus === "out_of_stock" ||
                            (item?.stock !== undefined && item?.stock !== null && Number(item.stock) <= 0) ||
                            (item?.availableStock !== undefined && item?.availableStock !== null && Number(item.availableStock) <= 0)
                        );

                        return (
                            <div key={`${item.id}-${item.variantSku || ''}`} className="flex items-center">
                                {/* Image */}
                                <div className="w-[72px] h-[72px] flex-shrink-0 flex items-center justify-center mr-5 relative">
                                    <img
                                        src={applyCloudinaryTransform(item.image)}
                                        alt={item.name}
                                        className={`w-full h-full object-contain ${isItemOutOfStock ? 'opacity-60 grayscale-[40%]' : ''}`}
                                        loading="lazy"
                                    />
                                </div>

                                {/* Details */}
                                <div className="flex-1">
                                    <h3 className="text-[16px] font-bold text-gray-900 leading-tight">
                                        {item.name}
                                    </h3>
                                    <p className="text-[14px] text-gray-500 font-medium mt-1">
                                        {formatWeight(item.weight || item.variantName, "1 unit")} {item.quantity > 1 ? `(x${item.quantity})` : ''}
                                    </p>
                                    {isItemOutOfStock && (
                                        <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded w-fit mt-1">
                                            Out of Stock — Please remove
                                        </p>
                                    )}
                                    {Number(item.quantity || 0) > 10 && (
                                        <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded w-fit mt-1">
                                            Maximum 10 units allowed per product
                                        </p>
                                    )}
                                </div>

                                {/* Price */}
                                <div className="text-[16px] font-bold text-gray-900 pl-4">
                                    ₹{(() => {
                                        const mrp = Number(item.price || 0);
                                        const sale = Number(item.salePrice || 0);
                                        const unit = sale > 0 && sale < mrp ? sale : mrp;
                                        return Math.round(unit * Number(item.quantity || 1));
                                    })()}
                                </div>
                            </div>
                        );
                    })}

                    <div className="pt-8 pb-4">
                        {/* Apply Coupon */}
                        <div className="flex items-center justify-between py-4 cursor-pointer">
                            <span className="text-[16px] font-bold text-gray-700">Apply Coupon</span>
                            <ChevronRight size={20} className="text-gray-400" />
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between py-6 mt-2">
                            <span className="text-[22px] font-black text-gray-900">Total</span>
                            <span className="text-[22px] font-black text-gray-900">₹{cartTotal}</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center pt-32 px-4 text-center">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <span className="text-4xl">🛒</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
                    <p className="text-gray-500 font-medium mb-8">Looks like you haven't added anything yet.</p>
                    <Link
                        to="/categories"
                        className="bg-[#f97316] hover:bg-[#ea580c] transition-colors text-white font-bold py-3.5 px-8 rounded-xl"
                    >
                        Start Shopping
                    </Link>
                </div>
            )}

            {/* Bottom Fixed Checkout Button */}
            {cart.length > 0 && (
                <div className={`${asOverlay ? 'absolute' : 'fixed'} bottom-0 left-0 right-0 p-4 bg-white z-40 border-t border-gray-100`}>
                    {hasOutOfStockItems ? (
                        <div className="flex flex-col gap-1.5 items-center">
                            <button
                                disabled
                                className="flex w-full items-center justify-center bg-slate-200 text-slate-500 text-[16px] font-bold py-4 rounded-xl cursor-not-allowed border border-slate-300"
                            >
                                Remove Out of Stock Items to Checkout
                            </button>
                            <span className="text-[11px] text-red-600 font-bold text-center">
                                One or more items in your cart are currently out of stock.
                            </span>
                        </div>
                    ) : hasExceededQuantityItems ? (
                        <div className="flex flex-col gap-1.5 items-center">
                            <button
                                disabled
                                className="flex w-full items-center justify-center bg-slate-200 text-slate-500 text-[16px] font-bold py-4 rounded-xl cursor-not-allowed border border-slate-300"
                            >
                                Adjust Quantity to Checkout (Max 10)
                            </button>
                            <span className="text-[11px] text-amber-700 font-bold text-center">
                                Maximum 10 units allowed per product.
                            </span>
                        </div>
                    ) : (
                        <Link
                            to="/checkout"
                            onClick={onClose}
                            className="flex w-full items-center justify-center bg-[#f97316] hover:bg-[#ea580c] transition-colors text-white text-[17px] font-bold py-4 rounded-xl shadow-lg shadow-orange-500/20"
                        >
                            Proceed to Checkout
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
};

export default CartPage;
