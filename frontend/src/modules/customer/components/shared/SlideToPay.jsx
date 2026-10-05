import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { ChevronRight, Check, ChevronsRight } from 'lucide-react';

const SlideToPay = ({
    onSuccess,
    amount,
    isLoading = false,
    disabled = false,
    text = "Slide to Pay"
}) => {
    const [isCompleted, setIsCompleted] = useState(false);
    const controls = useAnimation();
    const x = useMotionValue(0);
    const containerRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(360);
    const sliderWidth = 56; // Width of the sliding circle (w-14 = 56px)

    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth || containerRef.current.getBoundingClientRect().width;
                if (width > 0) {
                    setContainerWidth(width);
                }
            }
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);

        let resizeObserver;
        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
            resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const width = entry.contentRect.width;
                    if (width > 0) {
                        setContainerWidth(width);
                    }
                }
            });
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            window.removeEventListener('resize', updateWidth);
            if (resizeObserver) resizeObserver.disconnect();
        };
    }, []);

    // Maximum drag distance (container - slider - 8px padding)
    const maxDrag = Math.max(80, containerWidth - sliderWidth - 8);

    // Transforms
    const textOpacity = useTransform(x, [0, maxDrag * 0.4], [1, 0]);
    const shimmerOpacity = useTransform(x, [0, maxDrag * 0.3], [1, 0]);
    const rotate = useTransform(x, [0, maxDrag], [0, 360]);
    const arrowsOpacity = useTransform(x, [0, maxDrag * 0.7], [1, 0]);
    const checkOpacity = useTransform(x, [maxDrag * 0.4, maxDrag], [0, 1]);
    const fillWidth = useTransform(x, [0, maxDrag], [56, containerWidth]);

    const executeSuccess = async () => {
        setIsCompleted(true);
        await controls.start({
            x: maxDrag,
            transition: { type: "spring", stiffness: 450, damping: 30 }
        });
        if (onSuccess) {
            try {
                await onSuccess();
            } catch (err) {
                console.error("SlideToPay action error:", err);
            } finally {
                setIsCompleted(false);
                controls.start({
                    x: 0,
                    transition: { type: "spring", stiffness: 350, damping: 28 }
                });
            }
        } else {
            setIsCompleted(false);
            controls.start({ x: 0 });
        }
    };

    const handleDragEnd = async (event, info) => {
        if (disabled || isLoading || isCompleted) return;

        const currentX = x.get();
        const velocityX = info?.velocity?.x || 0;

        // Smooth swipe trigger: >45% dragged OR flicked forward (>200px/s) past 20%
        const isSuccess = currentX >= maxDrag * 0.45 || (velocityX > 200 && currentX >= maxDrag * 0.2);

        if (isSuccess) {
            await executeSuccess();
        } else {
            controls.start({
                x: 0,
                transition: { type: "spring", stiffness: 350, damping: 28 }
            });
        }
    };

    // Allow clicking arrow to trigger smooth auto-slide as an accessibility fallback
    const handleArrowClick = (e) => {
        e.stopPropagation();
        if (disabled || isLoading || isCompleted) return;
        executeSuccess();
    };

    return (
        <div
            ref={containerRef}
            className={`relative h-16 w-full rounded-full overflow-hidden select-none bg-linear-to-r from-primary via-primary to-primary shadow-[0_18px_45px_rgba(255,130,0,0.3)] border border-white/20 ${
                disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
            }`}
            style={{ touchAction: "none" }}
        >
            {/* Progress Fill */}
            <motion.div
                className="absolute inset-y-0 left-0 bg-white/20"
                style={{ width: fillWidth }}
            />

            {/* Shimmer Effect Background */}
            <motion.div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ opacity: shimmerOpacity }}
            >
                <motion.div
                    className="absolute inset-y-0 -inset-x-1 bg-linear-to-r from-transparent via-white/35 to-transparent skew-x-[-20deg]"
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                />
            </motion.div>

            {/* Text Label */}
            <motion.div
                className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none px-12"
                style={{ opacity: textOpacity }}
            >
                <span className="text-white font-black text-sm md:text-[13px] tracking-[0.25em] uppercase flex items-center gap-2 truncate">
                    {text} <span className="text-white/40">|</span> <span className="text-white font-extrabold">₹{amount}</span>
                </span>

                <div
                    onClick={handleArrowClick}
                    className="absolute right-4 animate-pulse text-white/90 pointer-events-auto cursor-pointer p-1"
                    title="Tap to slide"
                >
                    <ChevronsRight size={22} />
                </div>
            </motion.div>

            {/* Success State Text */}
            {isCompleted && (
                <motion.div
                    className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
                >
                    <span className="text-white font-black text-base tracking-wide uppercase flex items-center gap-2">
                        Processing Order <span className="animate-pulse">...</span>
                    </span>
                </motion.div>
            )}

            {/* Draggable Circle */}
            <motion.div
                className="absolute left-1 top-1 bottom-1 w-14 h-14 bg-white rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-20 shadow-[0_4px_16px_rgba(0,0,0,0.25)] border border-white"
                style={{ x, touchAction: "none" }}
                drag={!isCompleted && !isLoading && !disabled ? "x" : false}
                dragConstraints={{ left: 0, right: maxDrag }}
                dragElastic={0.08}
                dragMomentum={false}
                onDragStart={() => controls.stop()}
                onDragEnd={handleDragEnd}
                animate={controls}
                whileTap={{ scale: 0.96 }}
            >
                {isLoading || isCompleted ? (
                    <div
                        className="h-6 w-6 border-3 border-primary border-t-transparent rounded-full animate-spin"
                    />
                ) : (
                    <motion.div
                        className="relative w-full h-full flex items-center justify-center"
                        style={{ rotate }}
                    >
                        <motion.div className="text-primary" style={{ opacity: arrowsOpacity }}>
                            <ChevronRight size={28} strokeWidth={3.5} />
                        </motion.div>
                        <motion.div
                            className="absolute inset-0 flex items-center justify-center text-primary"
                            style={{ opacity: checkOpacity }}
                        >
                            <Check size={24} strokeWidth={3.5} />
                        </motion.div>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
};

export default SlideToPay;



