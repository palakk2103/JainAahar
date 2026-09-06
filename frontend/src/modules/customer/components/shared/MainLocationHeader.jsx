import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import Lottie from "lottie-react";
import LocationDrawer from "./LocationDrawer";
import { useLocation } from "../../context/LocationContext";
import { useProductDetail } from "../../context/ProductDetailContext";
import { useSettings } from "@core/context/SettingsContext";
import { cn } from "@/lib/utils";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import {
  buildHeaderGradient,
  buildMiniCartColor,
  buildSearchBarBackgroundColor,
  shiftHex,
} from "../../utils/headerTheme";


// MUI Icons
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import SearchIcon from "@mui/icons-material/Search";
import MicIcon from "@mui/icons-material/Mic";
import ChevronDownIcon from "@mui/icons-material/KeyboardArrowDown";
import FavoriteBorderOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import LanguageIcon from "@mui/icons-material/Language";
import { useTranslation } from "@core/context/LanguageContext";

/** Full-width bottom stroke + tab curve; l/r are 0–100% of column where the inner bump sits. */
function buildActiveTabPath(l, r) {
  const y = 20;
  const mapX = (x) => l + ((x - 1.5) / (98.5 - 1.5)) * (r - l);
  // Softer shoulders + flatter crown for a cleaner active tab curve.
  return `M 0 ${y} L ${l} ${y} L ${l} 12 C ${mapX(2.6)} 7 ${mapX(8.2)} 1.55 ${mapX(15)} 1.55 L ${mapX(85)} 1.55 C ${mapX(91.8)} 1.55 ${mapX(97.4)} 7 ${mapX(98.5)} 12 V ${y} L 100 ${y}`;
}

function CategoryNavColumn({
  cat,
  isActive,
  categoryAccent,
  onCategorySelect,
  headerFontColor,
  headerIconColor,
}) {
  const iconColor = headerIconColor || "#111111";
  const colRef = useRef(null);
  const labelRef = useRef(null);
  const [lr, setLr] = useState({ l: 22, r: 78 });

  const measure = () => {
    if (!isActive || !colRef.current || !labelRef.current) return;
    const col = colRef.current.getBoundingClientRect();
    const lab = labelRef.current.getBoundingClientRect();
    if (col.width < 4) return;
    const pad = 5;
    const l = Math.max(0, ((lab.left - col.left - pad) / col.width) * 100);
    const r = Math.min(100, ((lab.right - col.left + pad) / col.width) * 100);
    if (r - l > 6) setLr({ l, r });
  };

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (colRef.current) ro.observe(colRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isActive, cat.name]);

  const pathD = isActive ? buildActiveTabPath(lr.l, lr.r) : "";

  return (
    <motion.div
      ref={colRef}
      layout
      whileTap={{ scale: 0.96 }}
      transition={{
        layout: { type: "spring", stiffness: 520, damping: 38, mass: 0.55 },
      }}
      onClick={() => onCategorySelect && onCategorySelect(cat)}
      className="relative z-[2] flex min-w-[48px] shrink-0 cursor-pointer flex-col items-center gap-0.5 px-2 pb-0.5 pt-0.5 snap-start md:min-w-[58px]">
      <div 
        className={cn(
          "relative z-10 flex items-center justify-center rounded-full overflow-hidden transition-all duration-300",
          isActive ? "h-12 w-12 md:h-14 md:w-14 shadow-sm" : "h-11 w-11 md:h-12 md:w-12 opacity-90"
        )}
        style={{
          backgroundColor: `${iconColor}15`,
        }}
      >
        {cat.image || (typeof cat.icon === "string" && (cat.icon.startsWith("http") || cat.icon.startsWith("data:") || cat.icon.includes("/"))) ? (
          <img
            src={applyCloudinaryTransform(cat.image || cat.icon, "f_auto,q_auto,w_100")}
            alt={cat.name}
            loading="lazy"
            className="h-full w-full object-cover rounded-full drop-shadow-sm transition-all duration-300"
            style={{ filter: isActive ? 'none' : 'brightness(0.95)' }}
          />
        ) : typeof cat.icon === "function" ||
          (typeof cat.icon === "object" && cat.icon.$$typeof) ? (
          <cat.icon
            sx={{
              fontSize: isActive ? { xs: 24, md: 28 } : { xs: 20, md: 24 },
              color: iconColor,
              transition: "color 0.2s, font-size 0.2s",
            }}
          />
        ) : typeof cat.icon === "string" && !cat.icon.startsWith("http") && !cat.icon.includes("/") ? (
          <span 
            className="transition-all duration-300 drop-shadow-sm" 
            style={{ 
              fontSize: isActive ? '26px' : '22px', 
              filter: isActive ? 'none' : 'grayscale(15%) opacity(90%)' 
            }}
          >
            {cat.icon}
          </span>
        ) : (
          <img
            src={applyCloudinaryTransform(cat.icon, "f_auto,q_auto,w_100")}
            alt={cat.name}
            loading="lazy"
            className="h-full w-full object-cover rounded-full drop-shadow-sm transition-all duration-300"
            style={{ filter: isActive ? 'none' : 'brightness(0.95)' }}
          />
        )}
      </div>
      <div className="relative mt-px w-full">
        <span
          ref={labelRef}
          className={cn(
            "relative z-10 mx-auto block max-w-[72px] truncate px-1 pb-0.5 text-center text-[8px] uppercase tracking-tight md:max-w-[88px] md:text-[10px]",
            isActive ? "font-black" : "font-semibold",
          )}
          style={{
            color: isActive ? iconColor : (headerFontColor || "#111111"),
            opacity: isActive ? 1 : 0.68,
          }}>
          {cat.name}
        </span>
      </div>

    </motion.div>
  );
}

const MainLocationHeader = ({
  categories = [],
  activeCategory,
  onCategorySelect,
}) => {
  const { scrollY } = useScroll();
  const { t, language, setLanguage, languages } = useTranslation();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target)) {
        setIsLangDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isMobileView = typeof window !== "undefined" && window.innerWidth < 768;
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [cartAnimData, setCartAnimData] = useState(null);

  // Dynamically load shopping-cart Lottie on mount
  useEffect(() => {
    import("../../../../assets/lottie/shopping-cart.json")
      .then((m) => setCartAnimData(m.default))
      .catch(() => { });
  }, []);
  const { currentLocation, refreshLocation, isFetchingLocation } =
    useLocation();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { settings } = useSettings();
  const { cartCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const appName = settings?.appName || "App";
  const logoUrl = settings?.logoUrl;
  const navigate = useNavigate();

  // Search Logic
  const handleSearchClick = () => {
    navigate("/search");
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      navigate("/search", { state: { query: e.target.value } });
    }
  };

  // Search placeholder animation
  const [searchPlaceholder, setSearchPlaceholder] = useState("Search ");
  const [typingState, setTypingState] = useState({
    textIndex: 0,
    charIndex: 0,
    isDeleting: false,
    isPaused: false,
  });

  const staticText = "Search ";
  const typingPhrases = [
    '"bread"',
    '"milk"',
    '"chocolate"',
    '"eggs"',
    '"chips"',
  ];

  useEffect(() => {
    const { textIndex, charIndex, isDeleting, isPaused } = typingState;
    const currentPhrase = typingPhrases[textIndex];

    if (isPaused) {
      const timeout = setTimeout(() => {
        setTypingState((prev) => ({
          ...prev,
          isPaused: false,
          isDeleting: true,
        }));
      }, 2000); // Pause after full phrase
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          // Typing
          if (charIndex < currentPhrase.length) {
            setSearchPlaceholder(
              staticText + currentPhrase.substring(0, charIndex + 1),
            );
            setTypingState((prev) => ({
              ...prev,
              charIndex: prev.charIndex + 1,
            }));
          } else {
            // Finished typing
            setTypingState((prev) => ({ ...prev, isPaused: true }));
          }
        } else {
          // Deleting
          if (charIndex > 0) {
            setSearchPlaceholder(
              staticText + currentPhrase.substring(0, charIndex - 1),
            );
            setTypingState((prev) => ({
              ...prev,
              charIndex: prev.charIndex - 1,
            }));
          } else {
            // Finished deleting
            setTypingState((prev) => ({
              ...prev,
              isDeleting: false,
              textIndex: (prev.textIndex + 1) % typingPhrases.length,
            }));
          }
        }
      },
      isDeleting ? 50 : 100,
    ); // 50ms deleting speed, 100ms typing speed

    return () => clearTimeout(timeout);
  }, [typingState]);

  // Smooth scroll interpolations
  const headerTopPadding = useTransform(scrollY, [0, 160], [16, 16]);
  const headerBottomPadding = useTransform(scrollY, [0, 160], [4, 4]);
  const headerRoundness = useTransform(scrollY, [0, 160], [0, 0]);
  const bgOpacity = useTransform(scrollY, [0, 160], [1, 1]);

  // Content animations
  const contentHeight = useTransform(scrollY, [0, 160], ["64px", "64px"]);
  const contentOpacity = useTransform(scrollY, [0, 160], [1, 1]);
  const navHeight = useTransform(scrollY, [0, 200], ["80px", "80px"]);
  const navOpacity = useTransform(scrollY, [0, 200], [1, 1]);
  const navMargin = useTransform(scrollY, [0, 200], [8, 8]);
  const categorySpacing = useTransform(scrollY, [0, 200], [3, 3]);
  const cartOpacity = useTransform(scrollY, [0, 110, 150], [1, 1, 1]);
  const cartScale = useTransform(scrollY, [0, 110, 150], [1, 1, 1]);

  // Helper to hide elements completely when collapsed to prevent clicks
  const displayContent = useTransform(scrollY, (value) => "block");
  const displayNav = useTransform(scrollY, (value) => "flex");
  const displayCart = useTransform(scrollY, (value) => "block");

  const baseHeaderColor = activeCategory?.headerColor || "var(--primary)";
  const headerFontColor = "#111827";
  const headerIconColor = "#111111";

  const headerGradient = buildHeaderGradient(baseHeaderColor);
  const searchBarBg = buildSearchBarBackgroundColor(baseHeaderColor);
  const categoryAccent = headerIconColor;

  useEffect(() => {
    const c = buildMiniCartColor(baseHeaderColor);
    document.documentElement.style.setProperty("--customer-mini-cart-color", c);
    return () => {
      document.documentElement.style.removeProperty(
        "--customer-mini-cart-color",
      );
    };
  }, [baseHeaderColor]);

  return (
    <>
      <div
        className={cn(
          "fixed top-0 left-0 right-0 z-[200]",
          isProductDetailOpen && "hidden md:block",
        )}>
        <motion.div
          initial={false}
          style={{
            paddingTop: headerTopPadding,
            paddingBottom: headerBottomPadding,
            borderBottomLeftRadius: headerRoundness,
            borderBottomRightRadius: headerRoundness,
            opacity: bgOpacity,
            backgroundColor: "#ffffff",
          }}
          className="px-4 overflow-visible transform-gpu will-change-transform bg-white border-b border-slate-100/60 shadow-[0_2px_15px_rgba(0,0,0,0.015)]">
          {/* Subtle Glow Overlay */}
          <div className="absolute inset-0 bg-white/8 pointer-events-none" />



          {/* Desktop/Tablet Header Layout (md and above) */}
          <div className="hidden md:flex items-center justify-between relative z-20 px-2 lg:px-6 mb-4 mt-1">
            {/* Left Section: Logo + Location row */}
            <div className="flex items-center gap-4 lg:gap-8">
              <div
                onClick={() => navigate("/")}
                className="flex items-center gap-3 cursor-pointer group shrink-0">
                <div className="group-hover:scale-110 transition-all duration-300 drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]">
                  <img
                    src={logoUrl || "/jainaaharlogo-removebg-preview.png"}
                    alt={`${appName} Logo`}
                    loading="lazy"
                    className="h-14 w-auto object-contain"
                  />
                </div>
              </div>

              {/* Location Block (Desktop inline row) */}
              <div className="flex flex-col border-l border-black/10 pl-4 lg:pl-8 h-10 justify-center">
                <div className="flex items-center gap-1.5 opacity-70">
                  <AccessTimeIcon sx={{ fontSize: 13, color: headerFontColor }} />
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider leading-none"
                    style={{ color: headerFontColor }}
                  >
                    {currentLocation.time}
                  </span>
                </div>
                <button
                  type="button"
                  data-lenis-prevent
                  data-lenis-prevent-touch
                  onClick={() => {
                    setIsLocationOpen(true);
                  }}
                  className="flex items-center gap-1 text-slate-900 hover:text-slate-700 cursor-pointer group active:scale-95 transition-all border-0 bg-transparent p-0 text-left">
                  <LocationOnIcon sx={{ fontSize: 14, color: "inherit" }} />
                  <div
                    className="text-[13px] font-bold leading-tight max-w-[250px] lg:max-w-[320px] truncate"
                    style={{ color: headerFontColor }}
                  >
                    {isFetchingLocation
                      ? "Detecting location..."
                      : currentLocation.name}
                  </div>
                  <ChevronDownIcon
                    sx={{ fontSize: 12, opacity: 0.5, color: headerFontColor }}
                  />
                </button>
              </div>
            </div>

            {/* Center Section: Search Bar */}
            <div className="flex-1 max-w-[450px] lg:max-w-2xl px-6">
              <motion.div
                onClick={handleSearchClick}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="bg-slate-50/80 rounded-full px-4 h-11 border border-[#2E7D32]/35 flex items-center transition-all duration-200 focus-within:ring-2 focus-within:ring-[#2E7D32]/40 focus-within:bg-white cursor-pointer shadow-3xs hover:shadow-2xs hover:border-[#2E7D32]/60">
                <SearchIcon sx={{ color: "#64748b", fontSize: 20 }} />
                <input
                  type="text"
                  placeholder={searchPlaceholder || "Search Products..."}
                  readOnly
                  className="flex-1 bg-transparent border-none outline-none pl-2 text-slate-800 font-semibold placeholder:text-slate-400 text-[15px] cursor-pointer"
                />
                <div className="flex items-center gap-2 border-l border-slate-200/60 pl-3">
                  <MicIcon sx={{ color: "#64748b", fontSize: 20 }} />
                </div>
              </motion.div>
            </div>

            {/* Right Section: Action Icons */}
            <div className="flex items-center gap-5 lg:gap-8 shrink-0">
              {/* Language Selector Dropdown */}
              <div className="relative" ref={langDropdownRef}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200/60 bg-slate-50/50 hover:bg-slate-100/60 transition-all text-slate-700 hover:text-slate-900 cursor-pointer text-xs font-bold shadow-3xs"
                >
                  <LanguageIcon sx={{ fontSize: 16 }} className="text-slate-500" />
                  <span>{languages.find(l => l.code === language)?.flag}</span>
                  <span className="uppercase text-[11px]">{language}</span>
                  <ChevronDownIcon sx={{ fontSize: 14, opacity: 0.5 }} className={cn("transition-transform duration-200", isLangDropdownOpen ? "rotate-180" : "")} />
                </motion.button>

                {isLangDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-2xl border border-slate-100 shadow-xl py-1.5 z-[250] animate-in fade-in slide-in-from-top-1 duration-150">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setIsLangDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center justify-between",
                          language === lang.code
                            ? "bg-orange-50 text-orange-600"
                            : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base">{lang.flag}</span>
                          <span>{lang.name}</span>
                        </span>
                        {language === lang.code && (
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.15, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/wishlist")}
                className="transition-all hover:text-red-500 relative group"
                style={{ color: headerFontColor }}
              >
                <FavoriteBorderOutlinedIcon sx={{ fontSize: 24 }} />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-transform group-hover:-translate-y-0.5 animate-in zoom-in duration-300">
                    {wishlistCount}
                  </span>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.15, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/notifications")}
                className="transition-all hover:text-slate-700 relative group"
                style={{ color: headerFontColor }}
              >
                <NotificationsNoneOutlinedIcon sx={{ fontSize: 24 }} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.15, rotate: -5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/checkout")}
                className="transition-all hover:text-slate-700 relative group"
                style={{ color: headerFontColor }}
              >
                <ShoppingCartOutlinedIcon sx={{ fontSize: 24 }} />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-brand-900 text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-transform group-hover:-translate-y-0.5 animate-in zoom-in duration-300">
                    {cartCount}
                  </span>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/profile")}
                className="lg:bg-slate-100/60 p-1.5 lg:rounded-full hover:bg-slate-200/50 transition-all"
                style={{ color: headerFontColor }}
              >
                <AccountCircleOutlinedIcon sx={{ fontSize: 28 }} />
              </motion.button>
            </div>
          </div>

          {/* Mobile Header Layout (MOBILE ONLY) */}
          <div className="md:hidden pt-1 pb-1.5 space-y-1.5 select-none">
            {/* Top row: Logo/Branding + Bell Button */}
            <div className="flex items-center justify-between">
              {/* Brand Logo & Name */}
              <div onClick={() => navigate("/")} className="flex items-center gap-2.5 cursor-pointer">
                <img
                  src={logoUrl || "/jainaaharlogo-removebg-preview.png"}
                  alt="Jain Aahar"
                  className="h-14 w-auto object-contain shrink-0"
                />
                <div className="flex flex-col justify-center text-left">
                  <span className="text-[18px] font-black text-[#FF8200] leading-none tracking-tight">
                    Jain
                  </span>
                  <span className="text-[18px] font-black text-[#2E7D32] leading-none tracking-tight mt-[1px] ml-2">
                    Aahar
                  </span>
                  <span className="text-[11px] font-black text-[#5D7E68] tracking-wide mt-1 leading-none">
                    Shudh Saatvik Jain
                  </span>
                </div>
              </div>

              {/* Right actions: Language Dropdown + Notification Bell Button */}
              <div className="flex items-center gap-2.5">
                {/* Language Selector Dropdown (Mobile) */}
                <div className="relative" ref={langDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                    className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center relative cursor-pointer active:scale-95 transition-all text-slate-800 shadow-3xs"
                  >
                    <LanguageIcon sx={{ fontSize: 20 }} className="text-slate-500" />
                  </button>

                  {isLangDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-36 bg-white rounded-2xl border border-slate-100 shadow-xl py-1.5 z-[250] animate-in fade-in slide-in-from-top-1 duration-150">
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setLanguage(lang.code);
                            setIsLangDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3.5 py-2 text-xs font-bold transition-colors flex items-center justify-between",
                            language === lang.code
                              ? "bg-orange-50 text-orange-600"
                              : "text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-base">{lang.flag}</span>
                            <span>{lang.name}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notification Bell Button */}
                <button
                  onClick={() => navigate("/notifications")}
                  className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center relative cursor-pointer active:scale-95 transition-all text-slate-800 shadow-3xs"
                >
                  <NotificationsNoneOutlinedIcon sx={{ fontSize: 22 }} />
                  <span className="absolute -top-0.5 -right-0.5 bg-[#FF8200] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">
                    3
                  </span>
                </button>
              </div>
            </div>

            {/* Middle row: Deliver to Address capsule (w-fit) */}
            <div className="flex justify-start">
              <div
                onClick={() => setIsLocationOpen(true)}
                className="w-fit max-w-[90%] flex items-center gap-1.5 bg-white border border-slate-100 rounded-full py-1 px-3 cursor-pointer shadow-3xs active:scale-[0.99] transition-all"
              >
                <LocationOnIcon sx={{ color: "#FF8200", fontSize: 18 }} className="shrink-0" />
                <div className="flex flex-col text-left min-w-0">
                  <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider leading-none">Deliver to</span>
                  <span className="text-[11.5px] font-black text-slate-800 truncate max-w-[190px] mt-0.5 leading-none">
                    {isFetchingLocation ? "Detecting location..." : currentLocation.name}
                  </span>
                </div>
                <ChevronDownIcon sx={{ color: "#64748b", fontSize: 15 }} className="shrink-0 ml-0.5" />
              </div>
            </div>

            {/* Bottom row: Unified Search Bar */}
            <div
              onClick={handleSearchClick}
              className="w-full bg-white border border-[#2E7D32]/55 rounded-full px-4 h-9 flex items-center shadow-3xs cursor-pointer hover:border-[#2E7D32] transition-all"
            >
              <SearchIcon sx={{ color: "#78909c", fontSize: 20 }} className="shrink-0" />
              <input
                type="text"
                placeholder='Search "Atta, Rice, Oil, Maggi..."'
                readOnly
                className="flex-1 bg-transparent border-none outline-none pl-2 text-slate-800 font-bold placeholder:text-slate-400 text-[12.5px] cursor-pointer"
              />
              <div className="flex items-center shrink-0 ml-1">
                <MicIcon sx={{ color: "#78909c", fontSize: 20 }} className="cursor-pointer" />
              </div>
            </div>
          </div>

          {/* Categories Navigation Row (Shared for Desktop & Mobile) */}
          <motion.div
            style={{ height: navHeight, opacity: navOpacity, marginTop: navMargin }}
            className="relative z-10 -mx-2 flex items-end gap-1 overflow-x-auto overflow-y-visible px-2 pb-0 no-scrollbar md:gap-4 md:px-4"
          >
            {categories.map((cat) => {
              const activeId = String(activeCategory?.id || activeCategory?._id || '');
              const catId = String(cat?.id || cat?._id || '');
              const isCatActive = Boolean(
                (activeId && catId && activeId === catId) ||
                (activeCategory?.name && cat?.name && activeCategory.name.trim().toLowerCase() === cat.name.trim().toLowerCase())
              );

              return (
                <CategoryNavColumn
                  key={cat.id || cat._id || cat.name}
                  cat={cat}
                  isActive={isCatActive}
                  categoryAccent={categoryAccent}
                  onCategorySelect={onCategorySelect}
                  headerFontColor={headerFontColor}
                  headerIconColor={headerIconColor}
                />
              );
            })}
          </motion.div>

          {/* Background Decorative patterns */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none" />
        </motion.div>
      </div>

      <LocationDrawer
        isOpen={isLocationOpen}
        onClose={() => setIsLocationOpen(false)}
      />
    </>
  );
};

export default MainLocationHeader;

