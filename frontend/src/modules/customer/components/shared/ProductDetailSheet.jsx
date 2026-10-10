import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation, useDragControls } from 'framer-motion';
import { Link } from 'react-router-dom';
import { X, ChevronDown, Share2, Heart, Search, Clock, Minus, Plus, ShoppingBag, ShoppingCart, Star, MessageSquare, ArrowLeft, ChevronRight } from 'lucide-react';
import { useProductDetail } from '../../context/ProductDetailContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { useSettings } from '@core/context/SettingsContext';
import { useLocation as useAppLocation } from '../../context/LocationContext';
import { cn } from '@/lib/utils';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { formatWeight } from '@/core/utils/formatUtils';
import { customerApi } from '../../services/customerApi';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import ParticleBurst from './ParticleBurst';

const AccordionItem = ({ title, children, id, icon, expandedSections, toggleSection }) => {
    const isOpen = expandedSections.includes(id);
    return (
        <div className="border-b border-slate-100 last:border-0">
            <button
                onClick={() => toggleSection(id)}
                className="w-full py-2.5 flex items-center justify-between transition-all hover:bg-slate-50/50 rounded-lg group px-2"
            >
                <div className="flex items-center gap-2.5">
                    <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                        isOpen ? "bg-brand-50 text-primary" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"
                    )}>
                        {icon}
                    </div>
                    <span className={cn(
                        "font-bold text-[12px] uppercase tracking-wider",
                        isOpen ? "text-[#1A1A1A]" : "text-slate-500"
                    )}>{title}</span>
                </div>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    className={cn("transition-colors", isOpen ? "text-primary" : "text-slate-300")}
                >
                    <ChevronDown size={16} strokeWidth={3} />
                </motion.div>
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="pt-1 pb-3 px-2">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const HIGHLIGHT_ICON_MAP = {
    leaf: { emoji: "🌿", bg: "bg-amber-50/80 border-amber-100/70 text-amber-700" },
    avocado: { emoji: "🥑", bg: "bg-emerald-50/80 border-emerald-100/70 text-emerald-700" },
    zap: { emoji: "⚡", bg: "bg-orange-50/80 border-orange-100/70 text-orange-700" },
    sprout: { emoji: "🌱", bg: "bg-teal-50/80 border-teal-100/70 text-teal-700" },
    shield: { emoji: "🛡️", bg: "bg-blue-50/80 border-blue-100/70 text-blue-700" },
    heart: { emoji: "❤️", bg: "bg-rose-50/80 border-rose-100/70 text-rose-700" },
    star: { emoji: "⭐", bg: "bg-yellow-50/80 border-yellow-100/70 text-yellow-700" },
    truck: { emoji: "🚚", bg: "bg-indigo-50/80 border-indigo-100/70 text-indigo-700" },
    wheat: { emoji: "🌾", bg: "bg-amber-50/80 border-amber-100/70 text-amber-800" },
    sugarfree: { emoji: "🍬", bg: "bg-purple-50/80 border-purple-100/70 text-purple-700" },
    sun: { emoji: "☀️", bg: "bg-orange-50/80 border-orange-100/70 text-orange-700" },
    smile: { emoji: "😊", bg: "bg-green-50/80 border-green-100/70 text-green-700" },
};

const ProductDetailSheet = () => {
    const { selectedProduct, isOpen, closeProduct } = useProductDetail();
    const { cart, cartCount, addToCart, updateQuantity, removeFromCart, cartTotal } = useCart();
    const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
    const { showToast } = useToast();
    const { settings } = useSettings();
    const { currentLocation } = useAppLocation();
    const supportEmail = settings?.supportEmail || 'support@example.com';

    // Controls for sheet animation
    const controls = useAnimation();
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    const [reviews, setReviews] = useState([]);
    const [reviewLoading, setReviewLoading] = useState(true);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
    const [localHasReviewed, setLocalHasReviewed] = useState(false);
    const [extendedProduct, setExtendedProduct] = useState(null);
    const [expandedSections, setExpandedSections] = useState(['description']); // Start with description open
    const [showHeartPopup, setShowHeartPopup] = useState(false);

    const toggleSection = (section) => {
        setExpandedSections(prev => 
            prev.includes(section) 
                ? prev.filter(s => s !== section) 
                : [...prev, section]
        );
    };

    const scrollRef = useRef(null);

    const allImages = useMemo(() => {
        const prod = extendedProduct || selectedProduct;
        if (!prod) return [];
        const images = [];
        if (prod.mainImage) images.push(prod.mainImage);
        else if (prod.image) images.push(prod.image);

        if (prod.galleryImages && Array.isArray(prod.galleryImages)) {
            images.push(...prod.galleryImages);
        } else if (prod.images && Array.isArray(prod.images)) {
            const extra = prod.images.filter(img => img !== prod.mainImage && img !== prod.image);
            images.push(...extra);
        }

        // Deduplicate
        const uniqueImages = [...new Set(images)].filter(Boolean);

        return uniqueImages.length > 0
          ? uniqueImages
          : [
              "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400&h=400",
            ];
    }, [selectedProduct, extendedProduct]);

    const activeProduct = extendedProduct || selectedProduct;
    const isOutOfStock = useMemo(() => {
        if (!activeProduct) return false;
        if (activeProduct.isOutOfStock === true || activeProduct.stockStatus === "out_of_stock") return true;
        if (selectedVariant && typeof selectedVariant.stock === "number" && selectedVariant.stock <= 0) return true;
        if (activeProduct.availableStock !== undefined && activeProduct.availableStock !== null && Number(activeProduct.availableStock) <= 0) return true;
        if (activeProduct.stock !== undefined && activeProduct.stock !== null && Number(activeProduct.stock) <= 0) return true;
        return false;
    }, [activeProduct, selectedVariant]);

    const displayHighlights = useMemo(() => {
        if (Array.isArray(selectedProduct?.highlights) && selectedProduct.highlights.length > 0) {
            return selectedProduct.highlights.slice(0, 4);
        }
        return [
            { icon: "leaf", label: "100% Natural" },
            { icon: "avocado", label: "Farm Fresh" },
            { icon: "zap", label: "High Protein" },
            { icon: "sprout", label: "Source of Fiber" },
        ];
    }, [selectedProduct]);

    // Update variant when product changes
    useEffect(() => {
        setNewReview({ rating: 5, comment: '' });
        setLocalHasReviewed(false);
        setReviews([]);

        if (selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0) {
            setSelectedVariant(selectedProduct.variants[0]);
        } else {
            setSelectedVariant(null);
        }
        setActiveImageIndex(0);

        if (selectedProduct?.id || selectedProduct?._id) {
            const pid = selectedProduct.id || selectedProduct._id;
            fetchReviews(pid);
            fetchExtendedProduct(pid);
        }
    }, [selectedProduct]);

    const fetchExtendedProduct = async (productId) => {
        try {
            const hasValidLocation =
                Number.isFinite(currentLocation?.latitude) &&
                Number.isFinite(currentLocation?.longitude);

            const params = hasValidLocation ? {
                lat: currentLocation.latitude,
                lng: currentLocation.longitude
            } : {};

            const res = await customerApi.getProductById(productId, params);
            if (res.data.success) {
                setExtendedProduct(res.data.result);
            }
        } catch (error) {
            console.error("Fetch extended product error:", error);
        }
    };

    const fetchReviews = async (productId) => {
        try {
            setReviewLoading(true);
            const res = await customerApi.getProductReviews(productId);
            if (res.data.success) {
                setReviews(res.data.results);
            }
        } catch (error) {
            console.error("Fetch reviews error:", error);
        } finally {
            setReviewLoading(false);
        }
    };

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (!newReview.comment.trim()) return;

        try {
            setIsSubmittingReview(true);
            const res = await customerApi.submitReview({
                productId: selectedProduct.id,
                rating: newReview.rating,
                comment: newReview.comment
            });
            if (res.data.success) {
                showToast("Review submitted successfully", "success");
                setNewReview({ rating: 5, comment: '' });
                setLocalHasReviewed(true);
                setReviews(prev => [{
                    _id: 'temp-' + Date.now(),
                    rating: newReview.rating,
                    comment: newReview.comment,
                    createdAt: new Date().toISOString(),
                    userId: { name: 'You' },
                    status: 'pending'
                }, ...prev]);
            }
        } catch (error) {
            showToast(error.response?.data?.message || "Failed to submit review", "error");
        } finally {
            setIsSubmittingReview(false);
        }
    };

    // If no product selected, don't render anything (well, Context handles isOpen, but still good check)
    // Removed early return to satisfy Rules of Hooks (hooks must be called in same order)
    // if (!selectedProduct && !isOpen) return null;

    // Strip raw RTF/RTF-like codes from description strings from the backend
    const cleanDescription = (text) => {
        if (!text) return null;
        // Detect RTF format
        if (text.trim().startsWith('{\\rtf') || text.includes('\\par')) {
            // Extract readable text: remove RTF control words and braces
            return text
                .replace(/\{\\[^}]*\}/g, '') // Remove groups like {\rtf1 ...}
                .replace(/\\[a-z]+\d*\s?/gi, '') // Remove control words like \par \b \fs22
                .replace(/[{}]/g, '') // Remove remaining braces
                .replace(/\\'/g, "'") // Replace escaped apostrophes
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
        }
        return text;
    };

    const variantKey = String(selectedVariant?.sku || selectedVariant?.name || "").trim();
    const cartItem = selectedProduct
        ? cart.find(
            (item) =>
                `${item.id || item._id}::${String(item.variantSku || "").trim()}` ===
                `${selectedProduct.id}::${variantKey || ""}`,
        )
        : null;
    const quantity = cartItem ? cartItem.quantity : 0;
    const isWishlisted = selectedProduct ? isInWishlist(selectedProduct.id) : false;

    useEffect(() => {
        if (isOpen) {
            controls.start("visible");
            document.body.style.overflow = "hidden"; // Prevent background scroll
            document.body.style.touchAction = "none"; // Disable swipe background panning
            document.documentElement.style.overflow = "hidden";
        } else {
            controls.start("hidden");
            document.body.style.overflow = "unset";
            document.body.style.touchAction = "auto";
            document.documentElement.style.overflow = "unset";
            setIsExpanded(false);
        }

        // Cleanup function to ensure scroll is restored if component unmounts
        return () => {
            document.body.style.overflow = "unset";
            document.body.style.touchAction = "auto";
            document.documentElement.style.overflow = "unset";
        }
    }, [isOpen, controls]);

    const handleDragEnd = (event, info) => {
        const offset = info.offset.y;
        const velocity = info.velocity.y;

        if (offset > 150 || velocity > 200) {
            // Dragged down significantly -> Close
            closeProduct();
        } else if (offset < -20 || velocity < -200) {
            // Dragged up -> Expand
            setIsExpanded(true);
        } else {
            // Snap back to current state (expanded or initial)
        }
    };

    const toggleWishlist = (e) => {
        e.stopPropagation();
        
        if (!isWishlisted) {
            setShowHeartPopup(true);
            setTimeout(() => setShowHeartPopup(false), 1000);
        }

        toggleWishlistGlobal(selectedProduct);
        showToast(
            isWishlisted ? `${selectedProduct.name} removed from wishlist` : `${selectedProduct.name} added to wishlist`,
            isWishlisted ? 'info' : 'success'
        );
    };

    const handleAddToCart = () => {
        if (isOutOfStock) {
            showToast("Insufficient stock available", "error");
            return;
        }
        if (quantity >= 10) {
            showToast("Maximum 10 units of this product can be ordered.", "warning");
            return;
        }
        addToCart({
            ...selectedProduct,
            variantSku: String(selectedVariant?.sku || selectedVariant?.name || "").trim(),
        });
        showToast(`${selectedProduct.name} added to cart`, 'success');
    };

    const handleIncrement = () => {
        if (isOutOfStock) {
            showToast("Insufficient stock available", "error");
            return;
        }
        if (quantity >= 10) {
            showToast("Maximum 10 units of this product can be ordered.", "warning");
            return;
        }
        updateQuantity(selectedProduct.id, 1, String(selectedVariant?.sku || selectedVariant?.name || "").trim());
    };

    const handleDecrement = () => {
        if (quantity === 1) {
            removeFromCart(selectedProduct.id, String(selectedVariant?.sku || selectedVariant?.name || "").trim());
        } else {
            updateQuantity(selectedProduct.id, -1, String(selectedVariant?.sku || selectedVariant?.name || "").trim());
        }
    };

    // Scroll handler to expand on scroll
    const handleScroll = (e) => {
        if (!isExpanded && e.currentTarget.scrollTop > 5) {
            setIsExpanded(true);
        }
    };

    // Wheel handler for expansion
    const handleWheel = (e) => {
        if (!isExpanded && e.deltaY > 0) {
            setIsExpanded(true);
            e.stopPropagation();
        } else if (isExpanded) {
            // Allow normal scroll but stop propagation to background
            e.stopPropagation();
        }
    };

    if (!selectedProduct) return null;

    const cleanDesc = cleanDescription(selectedProduct?.description);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop - sits above header */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeProduct}
                        className="fixed inset-0 bg-black/60 z-[580] backdrop-blur-sm"
                    />

                    {/* ============================================================ */}
                    {/* DESKTOP LAYOUT: Wide 2-column modal (hidden on mobile) */}
                    {/* ============================================================ */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 30 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                        className="hidden md:flex fixed z-[590] top-[72px] bottom-[16px] left-[3%] right-[3%] lg:left-[6%] lg:right-[6%] xl:left-[12%] xl:right-[12%] bg-white rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.25)] overflow-hidden"
                    >
                        {/* Parent flex container that holds both sides together so the whole modal scrolls */}
                        <div className="flex w-full min-h-full">
                                {/* Left: Image Gallery — sticky to window so it doesn't scroll out of view if you want */}
                                <div className="relative w-[42%] lg:w-[44%] flex-shrink-0 flex flex-col min-h-full sticky top-0" style={{ background: 'linear-gradient(145deg, #f9fafb 0%, #f1f8f2 50%, #fafbfc 100%)' }}>
                                    {/* Top bar with back + wishlist */}
                                    <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-5 z-20">
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={closeProduct}
                                            className="w-10 h-10 bg-white/95 backdrop-blur-md rounded-xl shadow-md shadow-black/5 flex items-center justify-center hover:shadow-lg transition-all border border-gray-100/80"
                                        >
                                            <ArrowLeft size={18} className="text-gray-700" strokeWidth={2.5} />
                                        </motion.button>

                                        {/* Discount Badge (center) */}
                                        {(selectedProduct.originalPrice > selectedProduct.price) && (
                                            <motion.div
                                                initial={{ scale: 0, rotate: -10 }}
                                                animate={{ scale: 1, rotate: 0 }}
                                                transition={{ type: 'spring', delay: 0.2 }}
                                                className="bg-gradient-to-r from-primary to-[var(--brand-400)] text-white text-[10px] font-[800] px-3 py-1.5 rounded-xl uppercase tracking-wider shadow-md shadow-brand-200/40"
                                            >
                                                {Math.round(((selectedProduct.originalPrice - selectedProduct.price) / selectedProduct.originalPrice) * 100)}% OFF
                                            </motion.div>
                                        )}

                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={toggleWishlist}
                                            className={cn(
                                                "relative w-10 h-10 backdrop-blur-md rounded-xl shadow-md shadow-black/5 flex items-center justify-center hover:shadow-lg transition-all border",
                                                isWishlisted ? "bg-red-50/95 border-red-100" : "bg-white/95 border-gray-100/80"
                                            )}
                                        >
                                            <ParticleBurst isActive={showHeartPopup} />
                                            <motion.div
                                                animate={isWishlisted ? { scale: [1, 1.3, 1] } : {}}
                                                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                                className="relative z-10"
                                            >
                                                <Heart size={18} className={cn(
                                                    "transition-all",
                                                    isWishlisted ? 'text-red-500 fill-red-500' : 'text-gray-400 hover:text-red-400'
                                                )} />
                                            </motion.div>
                                        </motion.button>
                                        
                                        <AnimatePresence>
                                            {showHeartPopup && (
                                                <motion.div
                                                    initial={{ scale: 0.5, opacity: 1, y: 0 }}
                                                    animate={{ scale: 2.5, opacity: 0, y: -65 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.9, ease: "easeOut" }}
                                                    className="absolute top-4 right-4 z-50 pointer-events-none text-red-500"
                                                >
                                                    <Heart size={24} fill="currentColor" />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Main content area: vertical thumbnails + main image */}
                                    <div className="flex-1 flex mt-[64px] mb-3 overflow-hidden">
                                        {/* Vertical thumbnail strip (left side) */}
                                        {allImages.length > 1 && (
                                            <div className="flex flex-col gap-2 px-3 py-2 overflow-y-auto no-scrollbar">
                                                {allImages.slice(0, 5).map((img, i) => (
                                                    <motion.button
                                                        key={i}
                                                        whileHover={{ scale: 1.08 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => setActiveImageIndex(i)}
                                                        className={cn(
                                                            'w-[52px] h-[52px] lg:w-14 lg:h-14 rounded-xl overflow-hidden flex-shrink-0 transition-all duration-300 border-2',
                                                            i === activeImageIndex
                                                                ? 'border-primary shadow-lg shadow-brand-100/60 ring-2 ring-brand-100 bg-white'
                                                                : 'border-gray-200/60 opacity-50 hover:opacity-90 bg-white/60'
                                                        )}
                                                    >
                                                        <img src={applyCloudinaryTransform(img, "f_auto,q_auto:best,w_160,dpr_auto")} alt="" loading="lazy" className="w-full h-full object-contain p-1.5" />
                                                    </motion.button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Main image viewer */}
                                        <div className="flex-1 flex items-center justify-center p-6 lg:p-8 relative min-h-[350px]">
                                            <AnimatePresence mode="wait">
                                                <motion.img
                                                    key={activeImageIndex}
                                                    initial={{ scale: 0.93, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    exit={{ scale: 0.93, opacity: 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    src={applyCloudinaryTransform(allImages[activeImageIndex], "f_auto,q_auto:best,w_1200,dpr_auto")}
                                                    alt={`${selectedProduct.name} ${activeImageIndex + 1}`}
                                                    className="w-full h-full object-contain mix-blend-multiply drop-shadow-2xl hover:scale-[1.03] transition-transform duration-500 absolute inset-0 m-auto p-12"
                                                />
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    {/* Carousel dot indicators */}
                                    {allImages.length > 1 && (
                                        <div className="flex justify-center gap-2 pb-5">
                                            {allImages.map((_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setActiveImageIndex(i)}
                                                    className={cn(
                                                        'rounded-full transition-all duration-400',
                                                        i === activeImageIndex ? 'w-8 h-2 bg-primary' : 'w-2 h-2 bg-gray-300/60 hover:bg-gray-400'
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Right: Product Info (scrollable naturally) */}
                                <div className="flex-1 flex flex-col bg-white overflow-y-auto">
                                    <div className="flex-1 px-7 py-6 lg:px-8 lg:py-7 space-y-3">

                                        {/* Top badges row */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {selectedProduct.deliveryTime && (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.1 }}
                                                    className="inline-flex items-center gap-1.5 bg-[#ecfeff] border border-brand-200/50 text-primary px-3 py-1.5 rounded-lg text-[10px] font-[700] uppercase tracking-wider"
                                                >
                                                    <Clock size={12} strokeWidth={2.5} className="text-primary" />
                                                    {selectedProduct.deliveryTime}
                                                </motion.div>
                                            )}
                                            {selectedProduct.originalPrice > selectedProduct.price && (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.15 }}
                                                    className="text-[10px] font-[700] text-primary bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-200/50 uppercase tracking-wider"
                                                >
                                                    💰 Save ₹{selectedProduct.originalPrice - selectedProduct.price}
                                                </motion.div>
                                            )}
                                            {reviews.length > 0 && (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.2 }}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-[10px] font-[700] border border-orange-100/50"
                                                >
                                                    <Star size={10} fill="currentColor" />
                                                    {(reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)}
                                                    <span className="text-orange-400 font-medium">({reviews.length})</span>
                                                </motion.div>
                                            )}
                                        </div>

                                        {/* Product Name */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.15 }}
                                        >
                                            <h1 className="text-[19px] lg:text-[22px] font-black text-[#111827] leading-[1.2] tracking-tight mb-1">
                                                {selectedProduct.name}
                                            </h1>
                                            {selectedProduct.weight && (
                                                <span className="text-[13px] text-gray-400 font-bold uppercase tracking-wider">{formatWeight(selectedProduct.weight)}</span>
                                            )}
                                        </motion.div>

                                        {/* Price + Add-to-Cart Card */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 }}
                                            className="relative overflow-hidden rounded-[20px] border border-brand-200/60 shadow-sm"
                                            style={{ background: 'linear-gradient(135deg, #f4fcfe 0%, #eefbfb 100%)' }}
                                        >
                                            {/* Decorative subtle patterns */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-3xl" />
                                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand-500/5 rounded-full blur-2xl" />

                                            <div className="relative flex items-center justify-between py-4 px-5">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-[28px] lg:text-[32px] font-[800] text-primary tracking-tight leading-none">
                                                            ₹{selectedProduct.price}
                                                        </span>
                                                        {selectedProduct.originalPrice > selectedProduct.price && (
                                                            <span className="text-[14px] text-gray-400 line-through font-[600]">₹{selectedProduct.originalPrice}</span>
                                                        )}
                                                    </div>
                                                    {selectedProduct.originalPrice > selectedProduct.price && (
                                                        <span className="inline-flex w-fit items-center text-[10px] font-[800] text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md uppercase tracking-wide">
                                                            {Math.round(((selectedProduct.originalPrice - selectedProduct.price) / selectedProduct.originalPrice) * 100)}% off
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    {isOutOfStock ? (
                                                        <button
                                                            disabled
                                                            className="bg-slate-200 text-slate-500 cursor-not-allowed h-12 px-6 rounded-xl font-bold text-xs uppercase tracking-wider border border-slate-300"
                                                        >
                                                            Insufficient Stock
                                                        </button>
                                                    ) : quantity > 0 ? (
                                                        <div className="flex items-center gap-1 bg-white border border-brand-200 rounded-xl p-1 shadow-sm">
                                                            <motion.button whileTap={{ scale: 0.85 }} onClick={handleDecrement} className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center text-brand-700 hover:bg-brand-100 transition-colors">
                                                                <Minus size={16} strokeWidth={2.5} />
                                                            </motion.button>
                                                            <div className="w-8 flex justify-center items-center relative overflow-hidden h-6">
                                                                <AnimatePresence mode="popLayout">
                                                                    <motion.span
                                                                        key={quantity}
                                                                        initial={{ y: 15, opacity: 0 }}
                                                                        animate={{ y: 0, opacity: 1 }}
                                                                        exit={{ y: -15, opacity: 0 }}
                                                                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                                                        className="font-[800] text-base text-gray-800 text-center absolute"
                                                                    >
                                                                        {quantity}
                                                                    </motion.span>
                                                                </AnimatePresence>
                                                            </div>
                                                            <motion.button
                                                                whileTap={{ scale: 0.85 }}
                                                                onClick={handleIncrement}
                                                                disabled={quantity >= 10}
                                                                className={cn(
                                                                    "w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white hover:bg-[var(--brand-400)] transition-colors shadow-sm",
                                                                    quantity >= 10 && "opacity-40 cursor-not-allowed"
                                                                )}
                                                                title={quantity >= 10 ? "Maximum 10 units allowed" : "Increase quantity"}
                                                            >
                                                                <Plus size={16} strokeWidth={2.5} />
                                                            </motion.button>
                                                        </div>
                                                    ) : (
                                                    <motion.button
                                                        whileHover={{ scale: 1.02, y: -2 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={handleAddToCart}
                                                        className="bg-gradient-to-r from-primary to-[var(--brand-400)] text-white h-12 px-8 rounded-xl font-black text-[13px] flex items-center gap-2 shadow-lg shadow-brand-100 hover:shadow-brand-200 transition-all uppercase tracking-widest border border-white/20"
                                                    >
                                                        <ShoppingBag size={16} strokeWidth={3} />
                                                        Add to Cart
                                                    </motion.button>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>

                                        {/* View Cart */}
                                        {cartCount > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.98 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="flex justify-center -mt-1"
                                            >
                                                <Link
                                                    to="/checkout"
                                                    onClick={() => closeProduct({ fromNavigation: true })}
                                                    className="w-[80%] bg-gradient-to-r from-primary to-[var(--brand-500)] text-white h-[40px] rounded-xl flex items-center justify-between px-4 shadow-md shadow-brand-200/40 hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-[0.98]"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <ShoppingBag size={14} strokeWidth={2.0} />
                                                        <span className="text-[12px] font-[700] uppercase tracking-wider">View Cart</span>
                                                    </div>
                                                    <div className="flex items-center justify-center gap-1.5 bg-white/10 px-2 py-1 rounded-lg">
                                                        <span className="text-[13px] font-[800] tracking-tight">₹{cartTotal}</span>
                                                        <ChevronRight size={14} strokeWidth={2.5} />
                                                    </div>
                                                </Link>
                                            </motion.div>
                                        )}

                                        {/* Variants */}
                                        {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: 0.25 }}
                                                className="bg-gray-50/60 rounded-xl p-3 border border-gray-100/70"
                                            >
                                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2.5">Select Variant</h4>
                                                <div className="flex gap-3 flex-wrap">
                                                    {selectedProduct.variants.map((v, idx) => (
                                                        <motion.button
                                                            key={idx}
                                                            whileHover={{ scale: 1.03 }}
                                                            whileTap={{ scale: 0.97 }}
                                                            onClick={() => setSelectedVariant(v)}
                                                            className={cn(
                                                                'px-4 py-2 font-[600] rounded-lg text-[13px] transition-all border-2',
                                                                selectedVariant?.sku === v.sku
                                                                    ? 'bg-brand-50 border-primary text-primary shadow-md shadow-brand-100/50'
                                                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:shadow-sm'
                                                            )}
                                                        >
                                                            {formatWeight(v.name)}
                                                        </motion.button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}

                                         {/* Decorative Divider */}
                                        <div className="relative -mt-1 -mb-1">
                                            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                                            <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-white border border-gray-200 rounded-full" />
                                        </div>

                                        {/* Product Information Accordion (Desktop) */}
                                        <div className="mt-4 border-t border-slate-100">
                                            {/* Description */}
                                            {cleanDesc && (
                                                <AccordionItem expandedSections={expandedSections} toggleSection={toggleSection}
                                                    id="description" 
                                                    title="Product Description" 
                                                    icon={<Clock size={16} />}
                                                >
                                                    <div
                                                        className="text-[13px] text-slate-500 font-medium leading-relaxed whitespace-pre-line"
                                                        dangerouslySetInnerHTML={{ __html: cleanDesc }}
                                                    />
                                                </AccordionItem>
                                            )}

                                            {/* Product Details */}
                                            <AccordionItem expandedSections={expandedSections} toggleSection={toggleSection}
                                                id="details" 
                                                title="Product Details" 
                                                icon={<Search size={16} />}
                                            >
                                                <div className="grid grid-cols-2 gap-3 mt-1">
                                                    {[
                                                        activeProduct?.shelfLife ? { label: 'Shelf Life', value: activeProduct.shelfLife, emoji: '📅' } : null,
                                                        { label: 'Country of Origin', value: activeProduct?.countryOfOrigin || 'India', emoji: '🇮🇳' },
                                                        { label: 'FSSAI License', value: activeProduct?.fssaiLicense || '21425590000362', emoji: '🛡️' },
                                                        { label: 'Customer Care', value: supportEmail, emoji: '📧' }
                                                    ].filter(Boolean).map((d) => (
                                                        <div key={d.label} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 group hover:bg-white hover:shadow-sm transition-all">
                                                            <span className="text-[10px] text-slate-400 block mb-0.5 font-bold uppercase tracking-wider">{d.label}</span>
                                                            <span className="font-black text-slate-800 text-[12px]">{d.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </AccordionItem>

                                            {/* Customer Reviews */}
                                            <AccordionItem expandedSections={expandedSections} toggleSection={toggleSection}
                                                id="reviews" 
                                                title={reviews.length > 0 ? `Customer Reviews (${reviews.length})` : "Customer Reviews"}
                                                icon={<Star size={16} />}
                                            >
                                                <div className="space-y-6 mt-2">
                                                    {reviews.length > 0 && (
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-primary rounded-xl text-xs font-black border border-brand-100">
                                                                <Star size={14} fill="currentColor" />
                                                                {(reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Review Form */}
                                                    {selectedProduct?.hasReviewed || extendedProduct?.hasReviewed || localHasReviewed ? (
                                                        <div className="bg-brand-50 p-4 rounded-2xl border border-brand-100 mb-6 text-center">
                                                            <p className="text-[11px] font-bold text-primary uppercase tracking-wide">You have already reviewed this product. Thank you!</p>
                                                        </div>
                                                    ) : (selectedProduct?.hasPurchased || extendedProduct?.hasPurchased) ? (
                                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                                                            <h4 className="font-black text-slate-800 text-xs mb-3 flex items-center gap-2">
                                                                <MessageSquare size={13} className="text-primary" />
                                                                Rate this product
                                                            </h4>
                                                            <form onSubmit={handleReviewSubmit} className="space-y-3">
                                                                <div className="flex gap-1.5">
                                                                    {[1, 2, 3, 4, 5].map((s) => (
                                                                        <motion.button
                                                                            key={s}
                                                                            type="button"
                                                                            whileHover={{ scale: 1.1 }}
                                                                            whileTap={{ scale: 0.9 }}
                                                                            onClick={() => setNewReview({ ...newReview, rating: s })}
                                                                            className={cn(
                                                                                'h-9 w-9 rounded-xl flex items-center justify-center transition-all shadow-sm',
                                                                                newReview.rating >= s ? 'bg-brand-50 text-primary border border-brand-100' : 'bg-white text-slate-300 border border-slate-100'
                                                                            )}
                                                                        >
                                                                            <Star size={15} className={cn(newReview.rating >= s && 'fill-current')} />
                                                                        </motion.button>
                                                                    ))}
                                                                </div>
                                                                <textarea value={newReview.comment} onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })} placeholder="Share your experience..." className="w-full bg-white border border-slate-100 rounded-xl p-3 text-xs font-medium min-h-[80px] outline-none focus:border-primary transition-all resize-none shadow-sm" />
                                                                <Button type="submit" disabled={isSubmittingReview} className="w-full h-10 bg-primary hover:opacity-90 text-white font-black rounded-xl text-[11px] uppercase tracking-[0.1em] transition-all shadow-lg shadow-brand-100">
                                                                    {isSubmittingReview ? 'Submitting...' : 'Post Review'}
                                                                    </Button>
                                                            </form>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6 text-center">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">You must purchase this product to rate it</p>
                                                        </div>
                                                    )}

                                                    {/* Reviews List */}
                                                    <div className="space-y-3">
                                                        {reviewLoading ? (
                                                            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={20} /></div>
                                                        ) : reviews.length > 0 ? (
                                                            reviews.map((r, rIdx) => (
                                                                <div key={r._id} className="p-4 rounded-xl border border-slate-100 bg-white hover:shadow-md hover:translate-x-1 transition-all group">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="h-8 w-8 rounded-full bg-brand-50 flex items-center justify-center text-[11px] font-black text-primary border border-brand-100">{r.userId?.name?.[0] || 'A'}</div>
                                                                            <div>
                                                                                <p className="text-[12px] font-black text-slate-800">
                                                                                    {r.userId?.name || 'Anonymous'}
                                                                                    {r.status === 'pending' && <span className="ml-2 text-[10px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded uppercase">Pending</span>}
                                                                                </p>
                                                                                <div className="flex gap-0.5 mt-0.5">{[...Array(5)].map((_, i) => <Star key={i} size={9} className={cn(i < r.rating ? 'text-primary fill-primary' : 'text-slate-200')} />)}</div>
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-[10px] font-bold text-slate-400">{new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                                                    </div>
                                                                    <p className="text-[12px] text-slate-600 font-medium leading-relaxed pl-10">{r.comment}</p>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                                                <MessageSquare size={20} className="text-slate-300 mx-auto mb-2" />
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No reviews yet — be the first!</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </AccordionItem>
                                        </div>

                                        {/* Bottom spacer */}
                                        <div className="h-6" />
                                    </div>
                                </div>
                            </div>
                    </motion.div>

                    {/* ============================================================ */}
                    {/* MOBILE LAYOUT: Bottom sheet (hidden on desktop md+) */}
                    {/* ============================================================ */}
                    <motion.div
                        drag={isExpanded ? false : "y"}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.7}
                        onDragEnd={handleDragEnd}
                        initial={{
                            opacity: 0,
                            y: "100vh",
                            top: "auto",
                            bottom: 0,
                            left: 0,
                            width: "100%",
                            borderTopLeftRadius: "24px",
                            borderTopRightRadius: "24px",
                            height: "auto",
                            maxHeight: "85vh"
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            top: isExpanded ? 0 : "auto",
                            bottom: 0,
                            left: 0,
                            width: "100%",
                            borderTopLeftRadius: isExpanded ? 0 : "24px",
                            borderTopRightRadius: isExpanded ? 0 : "24px",
                            height: isExpanded ? "100vh" : "auto",
                            maxHeight: isExpanded ? "100vh" : "85vh"
                        }}
                        exit={{ opacity: 0, y: "100vh", transition: { duration: 0.3 } }}
                        transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 400,
                            mass: 0.8
                        }}
                        className={cn(
                            "md:hidden fixed z-[590] bg-white shadow-2xl overflow-hidden flex flex-col",
                        )}
                        style={{ willChange: "transform, top, height, border-radius", touchAction: isExpanded ? "auto" : "none" }}
                    >
                        {/* Drag Handle (Visible only when not fully expanded) */}
                        {!isExpanded && (
                            <div className="absolute top-0 left-0 right-0 h-8 flex justify-center items-center z-50 pointer-events-none">
                                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                            </div>
                        )}

                        {/* Header Actions (Absolute & Sticky) */}
                        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-40 pointer-events-none">
                            <motion.button
                                onClick={closeProduct}
                                whileTap={{ scale: 0.9 }}
                                className="w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center border border-gray-100 pointer-events-auto"
                            >
                                <ArrowLeft size={24} className="text-primary" strokeWidth={3} />
                            </motion.button>
                            <div className="flex gap-3 pointer-events-auto invisible">
                                {/* Hidden as per request to simplify the view */}
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div
                            className={cn(
                                "flex-1 overflow-x-hidden no-scrollbar pb-24 bg-white",
                                isExpanded ? "overflow-y-auto" : "overflow-y-hidden"
                            )}
                            onScroll={handleScroll}
                            onWheel={handleWheel}
                        >
                            {/* Product Image Carousel */}
                            <div className="relative w-full bg-gradient-to-b from-[#F5F7F8] to-white pt-12 pb-8 h-[380px] sm:h-[480px]">
                                <div
                                    ref={scrollRef}
                                    className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar h-full w-full"
                                    onScroll={(e) => {
                                        const index = Math.round(e.currentTarget.scrollLeft / e.currentTarget.offsetWidth);
                                        setActiveImageIndex(index);
                                    }}
                                >
                                    {allImages.map((img, i) => (
                                        <div key={i} className="flex-shrink-0 w-full h-full snap-center flex items-center justify-center px-0">
                                            <img
                                                src={applyCloudinaryTransform(img, "f_auto,q_auto:best,w_1000,dpr_auto")}
                                                alt={`${selectedProduct.name} ${i + 1}`}
                                                className="w-full h-full object-contain mix-blend-multiply drop-shadow-xl scale-110"
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Carousel Dots */}
                                {allImages.length > 1 && (
                                    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
                                        {allImages.map((_, i) => (
                                            <div
                                                key={i}
                                                className={cn(
                                                    "h-1.5 rounded-full transition-all duration-300",
                                                    i === activeImageIndex ? "w-6 bg-primary" : "w-1.5 bg-gray-300"
                                                )}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Thumbnail Row (Mobile) */}
                            {allImages.length > 1 && (
                                <div className="px-5 pt-4 pb-1">
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{allImages.length} Product Images</h4>
                                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                                        {allImages.map((img, i) => (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    setActiveImageIndex(i);
                                                    if (scrollRef.current) {
                                                        const width = scrollRef.current.offsetWidth;
                                                        scrollRef.current.scrollTo({ left: width * i, behavior: 'smooth' });
                                                    }
                                                }}
                                                className={cn(
                                                    "w-[65px] h-[65px] flex-shrink-0 rounded-2xl overflow-hidden transition-all duration-300 border-2",
                                                    i === activeImageIndex 
                                                        ? "border-primary shadow-md shadow-brand-100 ring-2 ring-brand-50 bg-white scale-95" 
                                                        : "border-slate-200 bg-slate-50 hover:border-primary/50"
                                                )}
                                            >
                                                <img src={applyCloudinaryTransform(img, "f_auto,q_auto:best,w_150")} alt="" className="w-full h-full object-contain p-1.5 mix-blend-multiply" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Product Info Container */}
                            <div className="px-5 pt-3 pb-3 space-y-3">
                                {/* Delivery Time Badge */}
                                {selectedProduct.deliveryTime && (
                                    <div className="inline-flex items-center gap-1.5 bg-[#F0FDF4] border border-brand-100 text-primary px-2.5 py-1 rounded-lg text-[10px] font-black uppercase">
                                        <Clock size={12} strokeWidth={3} />
                                        {selectedProduct.deliveryTime}
                                    </div>
                                )}

                                {/* Title & Weight */}
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 leading-snug tracking-tight">
                                        {selectedProduct.name}
                                    </h2>
                                    <p className="text-xs text-slate-500 font-semibold mt-1">
                                        {formatWeight(selectedVariant?.name || selectedProduct.weight, "1 unit")}
                                    </p>
                                </div>

                                {/* Price Row */}
                                <div className="flex items-baseline gap-2.5 pt-0.5">
                                    <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                        ₹{selectedVariant?.salePrice || selectedVariant?.price || selectedProduct.price}
                                    </span>
                                    {((selectedVariant?.salePrice && selectedVariant.salePrice < selectedVariant.price) || 
                                       (!selectedVariant && selectedProduct.originalPrice > selectedProduct.price)) && (
                                        <>
                                            <span className="text-sm font-semibold text-slate-400 line-through">
                                                ₹{selectedVariant?.price || selectedProduct.originalPrice}
                                            </span>
                                            <span className="text-xs font-bold text-orange-500 uppercase tracking-wide">
                                                {selectedVariant
                                                    ? Math.round(((selectedVariant.price - selectedVariant.salePrice) / selectedVariant.price) * 100)
                                                    : Math.round(((selectedProduct.originalPrice - selectedProduct.price) / selectedProduct.originalPrice) * 100)}% OFF
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Key Feature Highlights Row (Dynamic Seller Badges) */}
                                <div className="grid grid-cols-4 gap-2 pt-2 pb-1 border-t border-b border-slate-100/80 my-2">
                                    {displayHighlights.map((hl, idx) => {
                                        const iconConfig = HIGHLIGHT_ICON_MAP[hl.icon] || HIGHLIGHT_ICON_MAP.leaf;
                                        return (
                                            <div key={idx} className="flex flex-col items-center text-center group py-1">
                                                <div className={cn("w-11 h-11 rounded-full border flex items-center justify-center shadow-xs mb-1.5 group-hover:scale-105 transition-transform", iconConfig.bg)}>
                                                    <span className="text-lg">{iconConfig.emoji}</span>
                                                </div>
                                                <span className="text-[11px] font-bold text-slate-700 leading-tight whitespace-pre-line">
                                                    {hl.label || "Highlight"}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {isExpanded ? (
                                    <>
                                        {/* Variants Selection (Mobile) */}
                                        {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                                            <div className="pt-1 mb-1">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Select Variant</h4>
                                                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                                    {selectedProduct.variants.map((v, idx) => (
                                                        <motion.button
                                                            key={idx}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => setSelectedVariant(v)}
                                                            className={cn(
                                                                "flex-shrink-0 px-4 py-2 font-bold rounded-xl text-xs transition-all relative border-2",
                                                                selectedVariant?.sku === v.sku
                                                                    ? "bg-[#ecfeff] border-primary text-primary shadow-sm shadow-brand-100"
                                                                    : "bg-slate-50 border-slate-100 text-slate-500"
                                                            )}
                                                        >
                                                            {formatWeight(v.name)}
                                                            {selectedVariant?.sku === v.sku && (
                                                                <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-primary rounded-bl-lg" />
                                                            )}
                                                        </motion.button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Product Information Accordion (Mobile) */}
                                        <div className="mt-2 border-t border-slate-100">
                                            {/* Description */}
                                            {cleanDesc && (
                                                <AccordionItem expandedSections={expandedSections} toggleSection={toggleSection}
                                                    id="description" 
                                                    title="Product Description" 
                                                    icon={<Clock size={18} strokeWidth={2.5} />}
                                                >
                                                    <div
                                                        className="text-sm text-slate-500 font-medium leading-relaxed whitespace-pre-line"
                                                        dangerouslySetInnerHTML={{ __html: cleanDesc }}
                                                    />
                                                </AccordionItem>
                                            )}

                                            {/* Product Details */}
                                            <AccordionItem expandedSections={expandedSections} toggleSection={toggleSection}
                                                id="details" 
                                                title="Product Details" 
                                                icon={<Search size={18} strokeWidth={2.5} />}
                                            >
                                                <div className="grid grid-cols-2 gap-3 mt-1">
                                                    {[
                                                        activeProduct?.shelfLife ? { label: 'Shelf Life', value: activeProduct.shelfLife } : null,
                                                        { label: 'Country of Origin', value: activeProduct?.countryOfOrigin || 'India' },
                                                        { label: 'FSSAI License', value: activeProduct?.fssaiLicense || '21425590000362' },
                                                        { label: 'Customer Care', value: supportEmail }
                                                    ].filter(Boolean).map((d) => (
                                                        <div key={d.label} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                            <span className="text-gray-400 block mb-0.5 text-[10px] font-bold uppercase tracking-wider">{d.label}</span>
                                                            <span className="font-black text-slate-800 text-xs">{d.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </AccordionItem>

                                            {/* Customer Reviews */}
                                            <AccordionItem expandedSections={expandedSections} toggleSection={toggleSection}
                                                id="reviews" 
                                                title={reviews.length > 0 ? `Customer Reviews (${reviews.length})` : "Customer Reviews"}
                                                icon={<Star size={18} strokeWidth={2.5} />}
                                            >
                                                <div className="space-y-6 mt-2">
                                                    {reviews.length > 0 && (
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-primary rounded-xl text-xs font-black border border-brand-100">
                                                                <Star size={16} fill="currentColor" />
                                                                {(reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Review Form */}
                                                    {(selectedProduct?.hasReviewed || extendedProduct?.hasReviewed || localHasReviewed) ? (
                                                        <div className="bg-brand-50 p-5 rounded-3xl border border-brand-100 mb-6 text-center">
                                                            <p className="text-[12px] font-bold text-primary uppercase tracking-wide">You have already reviewed this product. Thank you!</p>
                                                        </div>
                                                    ) : (selectedProduct?.hasPurchased || extendedProduct?.hasPurchased) ? (
                                                        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 mb-6">
                                                            <h4 className="font-black text-slate-800 text-sm mb-1">Rate this product</h4>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-4">Reviews are moderated</p>
                                                            <form onSubmit={handleReviewSubmit} className="space-y-4">
                                                                <div className="flex gap-2">
                                                                    {[1, 2, 3, 4, 5].map((s) => (
                                                                        <button
                                                                            key={s}
                                                                            type="button"
                                                                            onClick={() => setNewReview({ ...newReview, rating: s })}
                                                                            className={cn(
                                                                                "h-10 w-10 rounded-xl flex items-center justify-center transition-all shadow-sm",
                                                                                newReview.rating >= s ? "bg-brand-50 text-primary border border-brand-100" : "bg-white text-slate-300 border border-slate-100"
                                                                            )}
                                                                        >
                                                                            <Star size={18} className={cn(newReview.rating >= s && "fill-current")} />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                <textarea value={newReview.comment} onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })} placeholder="Write your experience..." className="w-full bg-white border border-slate-100 rounded-2xl p-4 text-sm font-medium min-h-[100px] outline-none focus:border-primary transition-all resize-none shadow-sm" />
                                                                <Button type="submit" disabled={isSubmittingReview} className="w-full h-12 bg-primary hover:opacity-90 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-brand-100">
                                                                    {isSubmittingReview ? "Submitting..." : "Post Review"}
                                                                </Button>
                                                            </form>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 mb-6 text-center">
                                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">You must purchase this product to rate it</p>
                                                        </div>
                                                    )}

                                                    {/* Reviews List */}
                                                    <div className="space-y-4">
                                                        {reviewLoading ? (
                                                            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div>
                                                        ) : reviews.length > 0 ? (
                                                            reviews.map((r, rIdx) => (
                                                                <div key={r._id} className="p-5 rounded-2xl border border-slate-100 bg-white hover:shadow-md transition-all">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="h-8 w-8 rounded-full bg-brand-50 flex items-center justify-center text-[10px] font-black text-primary border border-brand-100">{r.userId?.name?.[0] || 'A'}</div>
                                                                            <div>
                                                                                <p className="text-xs font-black text-slate-800">{r.userId?.name || 'Anonymous'}</p>
                                                                                <div className="flex gap-0.5">{[...Array(5)].map((_, i) => <Star key={i} size={10} className={cn(i < r.rating ? 'text-primary fill-primary' : 'text-slate-200')} />)}</div>
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-[10px] font-bold text-slate-400">{new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                                                    </div>
                                                                    <p className="text-xs text-slate-600 font-medium leading-relaxed pl-10">{r.comment}</p>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="py-12 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                                                <MessageSquare size={24} className="text-slate-300 mx-auto mb-3" />
                                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No reviews yet — be the first!</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </AccordionItem>
                                        </div>
                                    </>
                                ) : (
                                    <div className="mt-2 text-center">
                                        <button 
                                            onClick={() => setIsExpanded(true)}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50/80 hover:bg-slate-100 rounded-2xl transition-colors text-primary font-bold text-xs uppercase tracking-widest border border-slate-100"
                                        >
                                            View Full Details
                                            <ChevronDown size={16} strokeWidth={3} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sticky Bottom Action Bar */}
                        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100/80 p-4 pb-7 shadow-[0_-10px_40px_rgba(0,0,0,0.06)] z-50 rounded-t-3xl">
                            <div className="flex items-center gap-4">
                                {/* Left Side: Cart Icon with Badge */}
                                <Link
                                    to="/checkout"
                                    onClick={() => closeProduct({ fromNavigation: true })}
                                    className="relative w-14 h-14 bg-white border border-slate-100 rounded-[20px] shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-all flex-shrink-0"
                                >
                                    <ShoppingCart size={22} className="text-slate-800" />
                                    {cartCount > 0 && (
                                        <div className="absolute -top-1.5 -right-1.5 bg-[#FF8200] text-white text-[11px] font-black w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center shadow-md animate-in zoom-in duration-200">
                                            {cartCount}
                                        </div>
                                    )}
                                </Link>

                                {/* Right Side: Add to Cart / Quantity Pill Button */}
                                {isOutOfStock ? (
                                    <button
                                        disabled
                                        className="flex-1 bg-slate-200 text-slate-500 cursor-not-allowed h-14 rounded-[20px] font-extrabold text-[13px] flex items-center justify-center px-6 shadow-none border border-slate-300 uppercase tracking-wider"
                                    >
                                        Insufficient Stock
                                    </button>
                                ) : quantity > 0 ? (
                                    <div className="flex-1 bg-[#FF8200] text-white h-14 rounded-[20px] flex items-center justify-between px-2 shadow-xl shadow-brand-100 border border-white/20">
                                        <motion.button
                                            whileTap={{ scale: 0.8 }}
                                            onClick={handleDecrement}
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                                        >
                                            <Minus size={18} strokeWidth={3.5} />
                                        </motion.button>
                                        <div className="flex-1 flex justify-center items-center relative overflow-hidden h-6">
                                            <AnimatePresence mode="popLayout">
                                                <motion.span
                                                    key={quantity}
                                                    initial={{ y: 15, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    exit={{ y: -15, opacity: 0 }}
                                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                                    className="font-[1000] text-sm uppercase tracking-wider absolute"
                                                >
                                                    {quantity} in cart
                                                </motion.span>
                                            </AnimatePresence>
                                        </div>
                                        <motion.button
                                            whileTap={{ scale: 0.8 }}
                                            onClick={handleIncrement}
                                            disabled={quantity >= 10}
                                            className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors",
                                                quantity >= 10 && "opacity-40 cursor-not-allowed"
                                            )}
                                            title={quantity >= 10 ? "Maximum 10 units allowed" : "Increase quantity"}
                                        >
                                            <Plus size={18} strokeWidth={3.5} />
                                        </motion.button>
                                    </div>
                                ) : (
                                    <motion.button
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={handleAddToCart}
                                        className="flex-1 bg-[#FF8200] text-white h-14 rounded-[20px] font-bold text-sm flex items-center justify-between px-6 shadow-xl shadow-brand-100 transition-all border border-white/20"
                                    >
                                        <span className="uppercase tracking-wider font-extrabold text-[13px]">Add to Cart</span>
                                        <span className="text-sm font-black">₹{selectedVariant?.salePrice || selectedVariant?.price || selectedProduct.price}</span>
                                    </motion.button>
                                )}
                            </div>
                        </div>

                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ProductDetailSheet;


