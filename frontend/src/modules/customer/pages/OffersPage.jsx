import React, { useEffect, useState } from "react";
import { Tag, Sparkles, Clock, ArrowRight, Copy, Check, Ticket, Percent } from "lucide-react";
import { motion } from "framer-motion";
import { customerApi } from "../services/customerApi";

const OffersPage = () => {
  const [legacyOffers, setLegacyOffers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [offersRes, couponsRes] = await Promise.all([
          customerApi.getOffers().catch(() => ({ data: {} })),
          customerApi.getActiveCoupons().catch(() => ({ data: {} })),
        ]);

        const offersList =
          offersRes.data?.results ||
          offersRes.data?.result ||
          offersRes.data ||
          [];
        const couponsList =
          couponsRes.data?.results ||
          couponsRes.data?.result ||
          couponsRes.data ||
          [];

        setLegacyOffers(Array.isArray(offersList) ? offersList : []);
        setCoupons(Array.isArray(couponsList) ? couponsList : []);
      } catch (e) {
        console.error("Failed to load offers", e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2500);
  };

  const styleToBg = {
    blue: "bg-black ",
    green: "bg-primary",
    orange: "bg-orange-500",
  };
  const iconFor = (icon) => {
    if (icon === "clock") return <Clock className="text-white" size={32} />;
    if (icon === "tag") return <Tag className="text-white" size={32} />;
    return <Sparkles className="text-white" size={32} />;
  };

  const sortedLegacyOffers = [...legacyOffers]
    .filter((o) => o.status === "active")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const hasAnyOffers = sortedLegacyOffers.length > 0 || coupons.length > 0;

  return (
    <div className="relative z-10 py-4 w-full max-w-[1920px] mx-auto px-4 md:px-[50px] mt-10 md:mt-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 text-left"
      >
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-primary mb-3">
          Best Offers & Promo Codes
        </h1>
        <p className="text-gray-500 text-lg font-medium">
          Grab these exclusive discounts and coupon codes before they expire!
        </p>
      </motion.div>

      {isLoading && (
        <div className="mt-12 text-center text-slate-400 text-sm font-bold">
          Loading offers...
        </div>
      )}

      {/* Active Promo Coupons Section */}
      {!isLoading && coupons.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center gap-2.5 mb-6">
            <Ticket className="text-primary h-6 w-6" />
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Promo Coupons ({coupons.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coupons.map((coupon) => {
              const isCopied = copiedCode === coupon.code;
              const discountLabel =
                coupon.discountType === "percentage"
                  ? `${coupon.discountValue}% OFF`
                  : coupon.discountType === "free_delivery"
                  ? "FREE DELIVERY"
                  : `₹${coupon.discountValue} OFF`;

              return (
                <div
                  key={coupon._id}
                  className="relative group bg-gradient-to-br from-white to-slate-50/50 rounded-3xl p-6 border-2 border-dashed border-primary/20 shadow-sm hover:shadow-xl hover:border-primary/50 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Top row: Discount Badge & Expiry */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-black tracking-wide uppercase shadow-sm shadow-primary/20">
                        <Percent className="h-3.5 w-3.5" />
                        {discountLabel}
                      </span>
                      {coupon.validTill && (
                        <span className="text-[11px] font-bold text-slate-400">
                          Till {new Date(coupon.validTill).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        </span>
                      )}
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1">
                      {coupon.title || `${discountLabel} on your order`}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 mb-4 line-clamp-2">
                      {coupon.description || "Apply this coupon code at checkout to claim your discount."}
                    </p>

                    {/* Requirements */}
                    {coupon.minOrderValue > 0 && (
                      <p className="text-[11px] font-bold text-slate-400 mb-4">
                        Minimum order amount: <span className="text-slate-700 font-extrabold">₹{coupon.minOrderValue}</span>
                      </p>
                    )}
                  </div>

                  {/* Coupon Code Strip with Copy Button */}
                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div className="bg-slate-100 px-3.5 py-2 rounded-xl border border-dashed border-slate-300 font-mono text-sm font-black text-slate-800 tracking-wider">
                      {coupon.code}
                    </div>
                    <button
                      onClick={() => handleCopyCode(coupon.code)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black tracking-wider transition-all duration-200 cursor-pointer ${
                        isCopied
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-slate-900 text-white hover:bg-primary shadow-sm active:scale-95"
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          COPIED!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          COPY CODE
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legacy offer cards (promo codes / first-order type) */}
      {!isLoading && sortedLegacyOffers.length > 0 && (
        <div className="mt-8 mb-12">
          <h3 className="text-xl font-black text-slate-800 mb-4">
            Exclusive Deals
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedLegacyOffers.map((offer) => (
              <div
                key={offer._id}
                className="relative overflow-hidden rounded-3xl group cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
              >
                <div
                  className={`${styleToBg[offer.style] || styleToBg.blue
                    } p-8 h-full flex flex-col justify-between text-white relative z-10`}
                >
                  <div>
                    <div className="bg-white/20 p-3 rounded-2xl w-fit mb-6 backdrop-blur-md">
                      {iconFor(offer.icon)}
                    </div>
                    <h2 className="text-3xl font-black mb-3 leading-tight">
                      {offer.title}
                    </h2>
                    <p className="text-white/80 font-medium mb-8 leading-relaxed">
                      {offer.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex flex-col items-end gap-2">
                      <div className="bg-black/20 px-4 py-2 rounded-xl font-mono font-bold tracking-widest text-lg">
                        {offer.code || "AUTO-APPLIED"}
                      </div>
                      {offer.appliesOnOrderNumber && (
                        <span className="text-xs font-bold text-white/80">
                          Applies on order #{offer.appliesOnOrderNumber}
                        </span>
                      )}
                    </div>
                    <button className="h-12 w-12 bg-white rounded-full flex items-center justify-center text-primary transform transition-transform group-hover:rotate-[-45deg]">
                      <ArrowRight size={24} />
                    </button>
                  </div>
                </div>
                <div className="absolute top-[-10%] right-[-10%] w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && !hasAnyOffers && (
        <div className="mt-16 p-8 bg-slate-100 rounded-[2.5rem] border border-slate-200 text-center">
          <h3 className="text-2xl font-bold text-slate-800 mb-4">
            No active offers right now
          </h3>
          <p className="text-slate-500 mb-4 max-w-md mx-auto">
            Check back soon. Our team is curating fresh deals for you.
          </p>
        </div>
      )}
    </div>
  );
};

export default OffersPage;

