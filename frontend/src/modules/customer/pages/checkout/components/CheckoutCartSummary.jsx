import React from "react";
import { Plus, Minus } from "lucide-react";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";

/**
 * CheckoutCartSummary
 *
 * Props:
 *   cart              – array of cart items
 *   onUpdateQuantity  – (id, delta, variantSku) => void
 *   onRemoveFromCart  – (id, variantSku) => void
 *   onMoveToWishlist  – (item) => void
 *   showAll           – boolean (currently unused — all items shown)
 *   onToggleShowAll   – () => void
 */
function CheckoutCartSummary({
  cart,
  onUpdateQuantity,
  onRemoveFromCart,
  onMoveToWishlist,
  showAll = false,
  onToggleShowAll,
}) {

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
      {cart.map((item) => {
        const isItemOutOfStock = Boolean(
          item?.isOutOfStock === true ||
          item?.stockStatus === "out_of_stock" ||
          (item?.stock !== undefined && item?.stock !== null && Number(item.stock) <= 0) ||
          (item?.availableStock !== undefined && item?.availableStock !== null && Number(item.availableStock) <= 0)
        );

        return (
          <div
            key={`${item.id}::${String(item.variantSku || "").trim()}`}
            className="flex items-start gap-3 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
            <div className="h-20 w-20 rounded-xl overflow-hidden bg-slate-50 flex-shrink-0 relative">
              <img
                src={applyCloudinaryTransform(item.image)}
                alt={item.name}
                loading="lazy"
                className={`h-full w-full object-cover ${isItemOutOfStock ? 'opacity-60 grayscale-[40%]' : ''}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-800 mb-1">{item.name}</h4>
              {isItemOutOfStock && (
                <span className="inline-block text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md mb-1">
                  Out of Stock
                </span>
              )}
              {(item.variantName || item.variantSku) && (
                <p className="text-xs text-slate-500 mb-1">
                  Variant: {item.variantName || item.variantSku}
                </p>
              )}
              <button
                onClick={() => onMoveToWishlist(item)}
                className="text-xs text-slate-500 underline hover:text-primary transition-colors">
                Move to wishlist
              </button>
            </div>
              <div className="flex flex-col items-end gap-2">
                <div className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isItemOutOfStock ? 'bg-slate-400' : 'bg-primary'}`}>
                  <button
                    onClick={() => {
                      const productId = item.id || item._id;
                      return item.quantity > 1
                        ? onUpdateQuantity(productId, -1, item.variantSku)
                        : onRemoveFromCart(productId, item.variantSku);
                    }}
                    className="text-white p-1 hover:bg-white/20 rounded transition-colors"
                    title={item.quantity > 1 ? "Decrease quantity" : "Remove item"}>
                    <Minus size={14} strokeWidth={3} />
                  </button>
                  <span className="text-white font-bold min-w-[20px] text-center">
                    {item.quantity}
                  </span>
                  <button
                    disabled={isItemOutOfStock || item.quantity >= 10}
                    onClick={() => {
                      if (isItemOutOfStock) return;
                      if (item.quantity >= 10) return;
                      onUpdateQuantity(item.id || item._id, 1, item.variantSku);
                    }}
                    className={`text-white p-1 rounded transition-colors ${isItemOutOfStock || item.quantity >= 10 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/20'}`}
                    title={isItemOutOfStock ? "Item is out of stock" : item.quantity >= 10 ? "Maximum 10 units of this product can be ordered" : "Increase quantity"}>
                    <Plus size={14} strokeWidth={3} />
                  </button>
                </div>
              {(() => {
                const mrp = Number(item.price || 0);
                const sale = Number(item.salePrice || 0);
                const qty = Math.max(0, Number(item.quantity || 0));
                const hasDiscount =
                  Number.isFinite(mrp) &&
                  Number.isFinite(sale) &&
                  sale > 0 &&
                  sale < mrp;
                const unit = hasDiscount ? sale : mrp;
                const total = Math.round(unit * qty);
                const totalMrp = Math.round(mrp * qty);
                return (
                  <div className="text-right leading-tight">
                    <p className="text-base font-black text-slate-800">₹{total}</p>
                    {hasDiscount && (
                      <p className="text-[11px] font-bold text-slate-400 line-through">
                        ₹{totalMrp}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(CheckoutCartSummary);
