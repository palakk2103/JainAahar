import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useInViewAnimation } from "@/core/hooks/useInViewAnimation";
import { Sparkles, Heart, Snowflake, ChevronLeft, ChevronRight, TrendingUp, Flame, ShoppingBag } from "lucide-react";

// MUI Icons (shared with admin & icon selector)
import HomeIcon from "@mui/icons-material/Home";
import DevicesIcon from "@mui/icons-material/Devices";
import LocalGroceryStoreIcon from "@mui/icons-material/LocalGroceryStore";
import KitchenIcon from "@mui/icons-material/Kitchen";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import PetsIcon from "@mui/icons-material/Pets";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import VerifiedIcon from "@mui/icons-material/Verified";

import { motion, useScroll, useTransform } from "framer-motion";
import { isMobileOrWebView } from "@/core/utils/deviceUtils";
import { customerApi } from "../services/customerApi";
import { DEFAULT_CATEGORY_IMAGE, DEFAULT_PRODUCT_IMAGE, getRealCategoryFallback } from "@/core/utils/imageUtils";
import SafeImage from "@/shared/components/SafeImage";
import { toast } from "sonner";
import ProductCard from "../components/shared/ProductCard";
import MainLocationHeader from "../components/shared/MainLocationHeader";
import { useProductDetail } from "../context/ProductDetailContext";
import { cn } from "@/lib/utils";
import CardBanner from "@/assets/CardBanner.jpg";
import SectionRenderer from "../components/experience/SectionRenderer";
import ExperienceBannerCarousel from "../components/experience/ExperienceBannerCarousel";
import { useLocation } from "../context/LocationContext";
import { useSettings } from "@core/context/SettingsContext";
import Lottie from "lottie-react";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { getJSON, remove as removeStorage, STORAGE_KEYS } from "@core/utils/storage";
import { useTranslation } from "@core/context/LanguageContext";
import { usePageTranslation } from "@/core/hooks/usePageTranslation";
import { useDynamicTranslation } from "@/core/hooks/useDynamicTranslation";

import {
  MARQUEE_MESSAGES,
  ICON_COMPONENTS,
} from "../constants/homeConstants";
import PromoMarquee from "../components/home/PromoMarquee";
import QuickCategorySlider from "../components/home/QuickCategorySlider";
import LowestPriceSection from "../components/home/LowestPriceSection";
import OfferSections from "../components/home/OfferSections";
import MonthlyBasketSection from "../components/home/MonthlyBasketSection";

const DEFAULT_CATEGORY_THEME = {
  gradient: "linear-gradient(to bottom, var(--primary), var(--brand-400))",
  shadow: "shadow-brand-500/20",
  accent: "text-[#1A1A1A]",
};

const CATEGORY_METADATA = {
  All: {
    icon: "🏪",
    theme: DEFAULT_CATEGORY_THEME,
    banner: {
      title: "HOUSEFULL",
      subtitle: "SALE",
      floatingElements: "sparkles",
    },
  },
  Grocery: {
    icon: "🛒",
    theme: {
      gradient: "linear-gradient(to bottom, #FF9F1C, #FFBF69)",
      shadow: "shadow-orange-500/20",
      accent: "text-orange-900",
    },
    banner: {
      title: "SUPERSAVER",
      subtitle: "FRESH & FAST",
      floatingElements: "leaves",
    },
  },
  Wedding: {
    icon: "💍",
    theme: {
      gradient: "linear-gradient(to bottom, #FF4D6D, #FF8FA3)",
      shadow: "shadow-rose-500/20",
      accent: "text-rose-900",
    },
    banner: { title: "WEDDING", subtitle: "BLISS", floatingElements: "hearts" },
  },
  "Home & Kitchen": {
    icon: "🍳",
    theme: {
      gradient: "linear-gradient(to bottom, #BC6C25, #DDA15E)",
      shadow: "shadow-amber-500/20",
      accent: "text-amber-900",
    },
    banner: { title: "HOME", subtitle: "KITCHEN", floatingElements: "smoke" },
  },
  Electronics: {
    icon: "📱",
    theme: {
      gradient: "linear-gradient(to bottom, #7209B7, #B5179E)",
      shadow: "shadow-purple-500/20",
      accent: "text-purple-900",
    },
    banner: {
      title: "TECH FEST",
      subtitle: "GADGETS",
      floatingElements: "tech",
    },
  },
  Kids: {
    icon: "🧸",
    theme: {
      gradient: "linear-gradient(to bottom, #4CC9F0, #A0E7E5)",
      shadow: "shadow-brand-500/20",
      accent: "text-brand-900",
    },
    banner: {
      title: "LITTLE ONE",
      subtitle: "CARE",
      floatingElements: "bubbles",
    },
  },
  "Pet Supplies": {
    icon: "🐾",
    theme: {
      gradient: "linear-gradient(to bottom, #FB8500, #FFB703)",
      shadow: "shadow-yellow-500/20",
      accent: "text-yellow-900",
    },
    banner: { title: "PAWSOME", subtitle: "DEALS", floatingElements: "bones" },
  },
  Sports: {
    icon: "⚽",
    theme: {
      gradient: "linear-gradient(to bottom, #4361EE, #4895EF)",
      shadow: "shadow-brand-500/20",
      accent: "text-brand-900",
    },
    banner: { title: "SPORTS", subtitle: "GEAR", floatingElements: "confetti" },
  },
};

const ALL_CATEGORY = {
  id: "all",
  _id: "all",
  name: "All",
  icon: "🌟",
  theme: DEFAULT_CATEGORY_THEME,
  headerColor: "#0e7490",
  headerFontColor: "#111111",
  headerIconColor: "#111111",
  banner: {
    title: "HOUSEFULL",
    subtitle: "SALE",
    floatingElements: "sparkles",
    textColor: "text-white",
  },
};

const EMPTY_HERO_CONFIG = {
  banners: { items: [] },
  categoryIds: [],
};

const homePageDataCache = new Map();
const headerSectionsMemoryCache = {};
const heroConfigMemoryCache = {};

const getHomePageDataCacheKey = (location) => {
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "home:no-location";
  return `home:${lat.toFixed(5)}:${lng.toFixed(5)}`;
};

const homeStaticTexts = [
  "Subcategories",
  "View All",
  "No subcategories found.",
  "Latest in",
  "Search"
];

const getCachedHomePageData = (location) =>
  homePageDataCache.get(getHomePageDataCacheKey(location)) || null;

const Home = () => {
  const { scrollY } = useScroll();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { currentLocation } = useLocation();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const quickCatsRef = useRef(null);
  const cachedHomePageData = getCachedHomePageData(currentLocation);

  const { language } = useTranslation();
  const { getTranslatedText } = usePageTranslation(homeStaticTexts);
  const { translateObject } = useDynamicTranslation();

  const { ref: particleContainerRef, isVisible: particlesVisible } = useInViewAnimation();
  const heroRef = useRef(null);
  const [heroVisible, setHeroVisible] = useState(true);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setHeroVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting), { rootMargin: "0px" });
    const el = heroRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [categories, setCategories] = useState(() => cachedHomePageData?.categories || [ALL_CATEGORY]);
  const [activeCategory, setActiveCategory] = useState(() => cachedHomePageData?.activeCategory || ALL_CATEGORY);
  const [products, setProducts] = useState(() => cachedHomePageData?.products || []);
  const productsRef = useRef(cachedHomePageData?.products || []);
  const [quickCategories, setQuickCategories] = useState(() => cachedHomePageData?.quickCategories || []);
  const [isLoading, setIsLoading] = useState(() => !cachedHomePageData);
  const [experienceSections, setExperienceSections] = useState(() => cachedHomePageData?.experienceSections || []);
  const [headerSections, setHeaderSections] = useState([]);
  const [heroConfig, setHeroConfig] = useState(() => cachedHomePageData?.heroConfig || heroConfigMemoryCache.__home__ || EMPTY_HERO_CONFIG);
  const [mobileBannerIndex, setMobileBannerIndex] = useState(0);
  const [isInstantBannerJump, setIsInstantBannerJump] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState(() => {
    return cachedHomePageData?.quickCategories?.[0]?.id || cachedHomePageData?.quickCategories?.[0]?._id || null;
  });
  const [categoryMap, setCategoryMap] = useState(() => cachedHomePageData?.categoryMap || {});
  const [subcategoryMap, setSubcategoryMap] = useState(() => cachedHomePageData?.subcategoryMap || {});
  const [pendingReturn, setPendingReturn] = useState(null);
  const [offerSections, setOfferSections] = useState(() => cachedHomePageData?.offerSections || []);
  const [noServiceData, setNoServiceData] = useState(null);

  const [displayCategories, setDisplayCategories] = useState(categories);
  const [displayProducts, setDisplayProducts] = useState(products);
  const [displayQuickCategories, setDisplayQuickCategories] = useState(quickCategories);
  const [displayCategoryMap, setDisplayCategoryMap] = useState(categoryMap);
  const [displaySubcategoryMap, setDisplaySubcategoryMap] = useState(subcategoryMap);
  const [displayOfferSections, setDisplayOfferSections] = useState(offerSections);
  const [displayExperienceSections, setDisplayExperienceSections] = useState(experienceSections);
  const [displayHeaderSections, setDisplayHeaderSections] = useState(headerSections);

  useEffect(() => {
    if (language === "en") {
      setDisplayCategories(categories);
      setDisplayProducts(products);
      setDisplayQuickCategories(quickCategories);
      setDisplayCategoryMap(categoryMap);
      setDisplaySubcategoryMap(subcategoryMap);
      setDisplayOfferSections(offerSections);
      setDisplayExperienceSections(experienceSections);
      setDisplayHeaderSections(headerSections);
      return;
    }

    let isMounted = true;
    const translateHomeContent = async () => {
      try {
        const txCategories = await translateObject(categories, ["name"]);
        const txProducts = await translateObject(products, ["name", "weight", "description"]);
        const txQuickCats = await translateObject(quickCategories, ["name"]);
        const txOfferSections = await translateObject(offerSections, ["title", "subtitle"]);
        const txExperienceSections = await translateObject(experienceSections, ["title", "subtitle"]);
        const txHeaderSections = await translateObject(headerSections, ["title", "subtitle"]);

        // Maps
        const catArray = Object.values(categoryMap);
        const txCatArray = await translateObject(catArray, ["name"]);
        const txCatMap = {};
        txCatArray.forEach((c) => { txCatMap[c._id] = c; });

        const subArray = Object.values(subcategoryMap);
        const txSubArray = await translateObject(subArray, ["name"]);
        const txSubcatMap = {};
        txSubArray.forEach((s) => { txSubcatMap[s._id] = s; });

        if (isMounted) {
          setDisplayCategories(txCategories);
          setDisplayProducts(txProducts);
          setDisplayQuickCategories(txQuickCats);
          setDisplayCategoryMap(txCatMap);
          setDisplaySubcategoryMap(txSubcatMap);
          setDisplayOfferSections(txOfferSections);
          setDisplayExperienceSections(txExperienceSections);
          setDisplayHeaderSections(txHeaderSections);
        }
      } catch (err) {
        console.error("Translation of home content failed:", err);
      }
    };

    translateHomeContent();
    return () => {
      isMounted = false;
    };
  }, [
    language,
    categories,
    products,
    quickCategories,
    categoryMap,
    subcategoryMap,
    offerSections,
    experienceSections,
    headerSections,
  ]);

  useEffect(() => {
    productsRef.current = products || [];
  }, [products]);

  useEffect(() => {
    if (products.length === 0 && !isLoading) {
      import("@/assets/lottie/animation.json").then((m) => setNoServiceData(m.default)).catch(() => { });
    }
  }, [products.length, isLoading]);

  /**
   * @param {any} data
   * @param {{ cacheKey?: string; persist?: boolean }} [options]
   */
  const applyHomePageData = (data, { cacheKey, persist = true } = {}) => {
    if (!data) return;
    const catMap = data.categoryMap || {};
    const subMap = data.subcategoryMap || {};
    const cats = data.categories || [ALL_CATEGORY];
    const quickCats = data.quickCategories || [];
    const prods = data.products || [];
    const expSecs = data.experienceSections || [];
    const offSecs = data.offerSections || [];

    setCategoryMap(catMap);
    setSubcategoryMap(subMap);
    setCategories(cats);
    setQuickCategories(quickCats);
    setExpandedCategoryId(prev => {
      if (!prev && quickCats.length > 0) {
        return quickCats[0].id || quickCats[0]._id;
      }
      return prev;
    });
    setProducts(prods);
    setExperienceSections(expSecs);
    setOfferSections(offSecs);

    if (language === "en") {
      setDisplayCategories(cats);
      setDisplayProducts(prods);
      setDisplayQuickCategories(quickCats);
      setDisplayCategoryMap(catMap);
      setDisplaySubcategoryMap(subMap);
      setDisplayOfferSections(offSecs);
      setDisplayExperienceSections(expSecs);
    }

    if (data.heroConfig) setHeroConfig(data.heroConfig);
    setActiveCategory((prev) => {
      const parsed = getJSON(STORAGE_KEYS.EXPERIENCE_RETURN, null, { storage: "session" });
      if (parsed?.headerId) {
        const match = (data.formattedHeaders || []).find((h) => h._id === parsed.headerId);
        if (match) return match;
      }
      if (!prev || prev._id === "all") return data.activeCategory || data.categories?.[0] || ALL_CATEGORY;
      return (data.categories || []).find((cat) => cat._id === prev._id) || data.activeCategory || prev;
    });
    if (persist && cacheKey && (prods.length > 0 || cats.length > 1)) {
      homePageDataCache.set(cacheKey, data);
    }
  };

  const fetchData = async ({ forceRefresh = false } = {}) => {
    const cacheKey = getHomePageDataCacheKey(currentLocation);
    if (!forceRefresh) {
      const cached = homePageDataCache.get(cacheKey);
      if (cached && (cached.products?.length > 0 || cached.categories?.length > 1)) {
        applyHomePageData(cached, { cacheKey, persist: false });
        setIsLoading(false);
      }
    }
    if (products.length === 0) {
      setIsLoading(true);
    }
    try {
      const hasValidLocation = Number.isFinite(currentLocation?.latitude) && Number.isFinite(currentLocation?.longitude);
      const productParams = { limit: 20 };
      if (hasValidLocation) {
        productParams.lat = currentLocation.latitude;
        productParams.lng = currentLocation.longitude;
      }
      const sectionParams = hasValidLocation
        ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
        : {};

      const [catResult, prodResult, expResult, sectionsResult] = await Promise.allSettled([
        customerApi.getCategories(),
        customerApi.getProducts(productParams),
        customerApi.getExperienceSections({ pageType: "home" }),
        customerApi.getOfferSections(sectionParams),
      ]);

      const catRes = catResult.status === "fulfilled" ? catResult.value : null;
      const prodRes = prodResult.status === "fulfilled" ? prodResult.value : null;
      const expRes = expResult.status === "fulfilled" ? expResult.value : null;
      const sectionsRes = sectionsResult.status === "fulfilled" ? sectionsResult.value : null;

      const nextHomeData = {
        categories: [ALL_CATEGORY],
        activeCategory: ALL_CATEGORY,
        products: [],
        quickCategories: [],
        experienceSections: [],
        offerSections: [],
        categoryMap: {},
        subcategoryMap: {},
        formattedHeaders: [],
        heroConfig: heroConfigMemoryCache.__home__ || EMPTY_HERO_CONFIG,
      };

      if (catRes?.data?.success) {
        const dbCats = catRes.data.results || catRes.data.result || [];
        const catMap = {};
        const subMap = {};
        dbCats.forEach((c) => { if (c.type === "category") catMap[c._id] = c; else if (c.type === "subcategory") subMap[c._id] = c; });
        nextHomeData.categoryMap = catMap;
        nextHomeData.subcategoryMap = subMap;
        const formattedHeaders = dbCats.filter((cat) => cat.type === "header").map((cat) => {
          const catName = cat.name;
          const meta = CATEGORY_METADATA[catName] || CATEGORY_METADATA[catName.toUpperCase()] || { icon: "✨", theme: DEFAULT_CATEGORY_THEME, banner: { title: catName.toUpperCase(), subtitle: "TOP PICKS", floatingElements: "sparkles" } };
          const customImage = cat.image && String(cat.image).trim() && (cat.image.startsWith("http") || cat.image.startsWith("data:") || cat.image.includes("/")) ? cat.image : null;
          const IconComp = customImage || (cat.iconId && ICON_COMPONENTS[cat.iconId]) || meta.icon || "✨";
          return { ...cat, id: cat._id, icon: IconComp, image: customImage, theme: meta.theme, banner: { ...meta.banner, textColor: "text-white" } };
        });
        nextHomeData.formattedHeaders = formattedHeaders;
        const allHeaderFromAdmin = formattedHeaders.find((h) => (h.slug?.toLowerCase() === "all") || (h.name?.toLowerCase() === "all"));
        const mergedAllCategory = allHeaderFromAdmin ? { ...ALL_CATEGORY, headerColor: allHeaderFromAdmin.headerColor || ALL_CATEGORY.headerColor, headerFontColor: allHeaderFromAdmin.headerFontColor || ALL_CATEGORY.headerFontColor, headerIconColor: allHeaderFromAdmin.headerIconColor || ALL_CATEGORY.headerIconColor, icon: allHeaderFromAdmin.image || allHeaderFromAdmin.icon || ALL_CATEGORY.icon, image: allHeaderFromAdmin.image || null } : ALL_CATEGORY;
        nextHomeData.categories = [mergedAllCategory, ...formattedHeaders.filter((h) => !((h.slug?.toLowerCase() === "all") || (h.name?.toLowerCase() === "all")))];
        const rawQuickCats = dbCats.filter((cat) => cat.type === "category").map((cat) => ({ id: cat._id, name: cat.name, image: cat.image || getRealCategoryFallback(cat.name) }));
        const cutoffIndex = rawQuickCats.findIndex(cat => String(cat.name || '').trim().toLowerCase() === 'baby accessories');
        nextHomeData.quickCategories = cutoffIndex !== -1 ? rawQuickCats.slice(0, cutoffIndex + 1) : rawQuickCats;
      }

      if (prodRes?.data?.success) {
        const rawResult = prodRes.data.result;
        const dbProds = Array.isArray(prodRes.data.results) ? prodRes.data.results : Array.isArray(rawResult?.items) ? rawResult.items : Array.isArray(rawResult) ? rawResult : [];
        nextHomeData.products = dbProds.map((p) => ({ ...p, id: p._id, image: p.mainImage || p.image || DEFAULT_PRODUCT_IMAGE, price: p.salePrice || p.price, originalPrice: p.price, weight: p.weight || "1 unit", deliveryTime: p.deliveryTime }));
      }

      if (expRes?.data?.success) nextHomeData.experienceSections = Array.isArray(expRes.data.result || expRes.data.results) ? (expRes.data.result || expRes.data.results) : [];
      const sectionsList = sectionsRes?.data?.results || sectionsRes?.data?.result || sectionsRes?.data;
      nextHomeData.offerSections = Array.isArray(sectionsList) ? sectionsList : [];
      applyHomePageData(nextHomeData, { cacheKey });
    } catch (error) { console.error("Error:", error); } finally { setIsLoading(false); }
  };

  const hydrateSelectedSectionProducts = async (sections = []) => {
    const selectedProductIds = Array.from(new Set(sections.flatMap((s) => s?.displayType === "products" ? (s?.config?.products?.productIds || []) : []).map((id) => String(id || "").trim()).filter(Boolean)));
    if (!selectedProductIds.length) return;
    const existingIds = new Set(productsRef.current.map((p) => String(p?._id || p?.id || "").trim()));
    const missingIds = selectedProductIds.filter((id) => !existingIds.has(id));
    if (!missingIds.length) return;
    try {
      const locationParams = Number.isFinite(currentLocation?.latitude) ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined;
      const missingResults = await Promise.allSettled(missingIds.map((id) => customerApi.getProductById(id, locationParams)));
      const fetchedMissing = missingResults.filter((r) => r.status === "fulfilled").flatMap((r) => { const p = r.value?.data?.result || r.value?.data?.results; return Array.isArray(p) ? p : (p ? [p] : []); }).map((p) => ({ ...p, id: p._id, image: p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400&h=400", price: p.salePrice || p.price, originalPrice: p.price, weight: p.weight || "1 unit", deliveryTime: p.deliveryTime }));
      if (fetchedMissing.length) setProducts((prev) => { const merged = [...prev]; const mergedIds = new Set(merged.map((p) => String(p?._id || p?.id || "").trim())); fetchedMissing.forEach((p) => { const key = String(p?._id || p?.id || "").trim(); if (!mergedIds.has(key)) { merged.push(p); mergedIds.add(key); } }); return merged; });
    } catch (e) { }
  };

  useEffect(() => { fetchData(); }, [currentLocation?.latitude, currentLocation?.longitude]);
  const headerSectionsCache = useRef(headerSectionsMemoryCache);
  const heroConfigCache = useRef(heroConfigMemoryCache);

  useEffect(() => {
    const fetchHeaderSections = async () => {
      if (!activeCategory || activeCategory._id === "all") { setHeaderSections([]); return; }
      const cacheKey = activeCategory._id;
      if (headerSectionsCache.current[cacheKey]) { setHeaderSections(headerSectionsCache.current[cacheKey]); return; }
      try {
        const res = await customerApi.getExperienceSections({ pageType: "header", headerId: activeCategory._id });
        if (res.data.success) { const sections = Array.isArray(res.data.result || res.data.results) ? (res.data.result || res.data.results) : []; headerSectionsCache.current[cacheKey] = sections; setHeaderSections(sections); await hydrateSelectedSectionProducts(sections); }
        else setHeaderSections([]);
      } catch (e) { setHeaderSections([]); }
    };
    fetchHeaderSections();
  }, [activeCategory]);

  useEffect(() => {
    const fetchHeroConfig = async () => {
      try {
        const isHeader = activeCategory && activeCategory._id !== "all";
        const cacheKey = isHeader ? activeCategory._id : "__home__";
        if (heroConfigCache.current[cacheKey]) { setHeroConfig(heroConfigCache.current[cacheKey]); return; }
        let payload = null;
        if (isHeader) { const res = await customerApi.getHeroConfig({ pageType: "header", headerId: activeCategory._id }); if (res.data?.success && res.data?.result) payload = res.data.result; }
        if (!payload || (payload.banners?.items?.length === 0 && !payload.categoryIds?.length)) { const homeRes = await customerApi.getHeroConfig({ pageType: "home" }); if (homeRes.data?.success && homeRes.data?.result) payload = homeRes.data.result; }
        const resolved = payload && (payload.banners?.items?.length > 0 || payload.categoryIds?.length > 0) ? { banners: payload.banners || { items: [] }, categoryIds: payload.categoryIds || [] } : { banners: { items: [] }, categoryIds: [] };
        heroConfigCache.current[cacheKey] = resolved;
        if (cacheKey === "__home__") { const homeCacheKey = getHomePageDataCacheKey(currentLocation); const cachedHomeData = homePageDataCache.get(homeCacheKey); if (cachedHomeData) homePageDataCache.set(homeCacheKey, { ...cachedHomeData, heroConfig: resolved }); }
        setHeroConfig(resolved);
      } catch (e) { setHeroConfig(EMPTY_HERO_CONFIG); }
    };
    fetchHeroConfig();
  }, [activeCategory, currentLocation?.latitude, currentLocation?.longitude]);

  useEffect(() => {
    const firstUrl = heroConfig?.banners?.items?.[0]?.imageUrl;
    if (!firstUrl) return;
    const link = document.createElement("link");
    link.rel = "preload"; link.as = "image"; link.href = applyCloudinaryTransform(firstUrl, "f_auto,q_auto,c_scale,w_824");
    link.setAttribute("fetchpriority", "high"); document.head.appendChild(link);
    return () => { if (link.parentNode) link.parentNode.removeChild(link); };
  }, [heroConfig?.banners?.items?.[0]?.imageUrl]);

  useEffect(() => {
    const totalSlides = 3;
    const intervalId = setInterval(() => { setMobileBannerIndex((prev) => prev >= totalSlides - 1 ? prev : prev + 1); }, 3500);
    return () => clearInterval(intervalId);
  }, []);

  const handleBannerTransitionEnd = () => { if (mobileBannerIndex === 2) { setIsInstantBannerJump(true); setMobileBannerIndex(0); } };
  useEffect(() => { if (!isInstantBannerJump) return; const id = requestAnimationFrame(() => setIsInstantBannerJump(false)); return () => cancelAnimationFrame(id); }, [isInstantBannerJump]);

  const isAllCategory = !activeCategory || activeCategory._id === "all" || activeCategory.id === "all" || (activeCategory?.name && activeCategory.name.toLowerCase() === "all");

  const productsById = useMemo(() => {
    const map = {};
    displayProducts.forEach((p) => {
      map[p._id || p.id] = p;
    });
    return map;
  }, [displayProducts]);

  const effectiveQuickCategories = useMemo(() => {
    if (isAllCategory) {
      const ids = heroConfig.categoryIds || [];
      let list = displayQuickCategories;
      if (ids.length > 0) {
        const resolved = ids.map((id) => displayCategoryMap[id]).filter(Boolean).map((c) => ({ id: c._id, name: c.name, image: c.image || getRealCategoryFallback(c.name) }));
        if (resolved.length > 0) list = resolved;
      }
      const cutoffIndex = list.findIndex(cat => String(cat.name || '').trim().toLowerCase() === 'baby accessories');
      return cutoffIndex !== -1 ? list.slice(0, cutoffIndex + 1) : list;
    }

    const currentHeaderId = String(activeCategory?._id || activeCategory?.id || '');

    // 1. Check if heroConfig has specific categoryIds for this header
    const ids = heroConfig.categoryIds || [];
    if (ids.length > 0) {
      const resolved = ids.map((id) => displayCategoryMap[id]).filter(Boolean).map((c) => ({ id: c._id, name: c.name, image: c.image || getRealCategoryFallback(c.name) }));
      if (resolved.length > 0) return resolved;
    }

    // 2. Find categories whose parentId matches activeCategory._id
    const matchingCats = Object.values(displayCategoryMap).filter(c =>
      String(c.parentId || '') === currentHeaderId
    ).map(c => ({
      id: c._id,
      name: c.name,
      image: c.image || getRealCategoryFallback(c.name)
    }));

    if (matchingCats.length > 0) {
      return matchingCats;
    }

    // 3. Fallback: match quickCategories by parentId or keep current quick categories
    const nameMatching = displayQuickCategories.filter(c => {
      const dbCat = displayCategoryMap[c.id];
      return dbCat && String(dbCat.parentId || '') === currentHeaderId;
    });

    return nameMatching.length > 0 ? nameMatching : displayQuickCategories;
  }, [isAllCategory, activeCategory, heroConfig.categoryIds, displayCategoryMap, displayQuickCategories]);

  const headerFilteredProducts = useMemo(() => {
    if (isAllCategory) return displayProducts;
    const currentHeaderId = String(activeCategory?._id || activeCategory?.id || '');
    return displayProducts.filter((p) => {
      const pHeaderId = String(p.headerId?._id || p.headerId || '');
      if (pHeaderId && pHeaderId === currentHeaderId) return true;
      const pCatId = String(p.categoryId?._id || p.categoryId || '');
      if (pCatId && displayCategoryMap[pCatId] && String(displayCategoryMap[pCatId].parentId || '') === currentHeaderId) return true;
      if (activeCategory?.name && (
        String(p.category || '').toLowerCase() === activeCategory.name.toLowerCase() ||
        String(p.headerName || '').toLowerCase() === activeCategory.name.toLowerCase()
      )) return true;
      return false;
    });
  }, [isAllCategory, activeCategory, displayProducts, displayCategoryMap]);

  useEffect(() => {
    if (isAllCategory || !activeCategory?._id || activeCategory._id === "all") return;
    let isMounted = true;
    const fetchHeaderProducts = async () => {
      try {
        const hasValidLocation = Number.isFinite(currentLocation?.latitude) && Number.isFinite(currentLocation?.longitude);
        const params = { headerId: activeCategory._id, limit: 50 };
        if (hasValidLocation) {
          params.lat = currentLocation.latitude;
          params.lng = currentLocation.longitude;
        }
        const prodRes = await customerApi.getProducts(params);
        if (prodRes.data?.success && isMounted) {
          const rawResult = prodRes.data.result;
          const dbProds = Array.isArray(prodRes.data.results) ? prodRes.data.results : Array.isArray(rawResult?.items) ? rawResult.items : Array.isArray(rawResult) ? rawResult : [];
          if (dbProds.length > 0) {
            const formattedProds = dbProds.map((p) => ({
              ...p,
              id: p._id,
              image: p.mainImage || p.image || DEFAULT_PRODUCT_IMAGE,
              price: p.salePrice || p.price,
              originalPrice: p.price,
              weight: p.weight || "1 unit",
              deliveryTime: p.deliveryTime
            }));
            setProducts((prev) => {
              const existingMap = new Map(prev.map((p) => [String(p._id || p.id), p]));
              formattedProds.forEach((p) => existingMap.set(String(p._id || p.id), p));
              return Array.from(existingMap.values());
            });
          }
        }
      } catch (e) {
        console.error("Failed to fetch header products:", e);
      }
    };
    fetchHeaderProducts();
    return () => {
      isMounted = false;
    };
  }, [activeCategory?._id, isAllCategory, currentLocation?.latitude, currentLocation?.longitude]);

  useEffect(() => {
    if (!isAllCategory && effectiveQuickCategories.length > 0) {
      setExpandedCategoryId(effectiveQuickCategories[0].id || effectiveQuickCategories[0]._id);
    } else if (isAllCategory) {
      setExpandedCategoryId(null);
    }
  }, [isAllCategory, activeCategory, effectiveQuickCategories]);

  const handleCategorySelect = (cat) => {
    setActiveCategory(cat);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isMobile = useMemo(() => isMobileOrWebView(), []);
  const opacity = useTransform(scrollY, (heroVisible && !isMobile) ? [0, 300] : [0, 0], [1, 0.6]);
  const y = useTransform(scrollY, (heroVisible && !isMobile) ? [0, 300] : [0, 0], [0, 80]);
  const scale = useTransform(scrollY, (heroVisible && !isMobile) ? [0, 300] : [0, 0], [1, 0.95]);
  const pointerEvents = useTransform(scrollY, (heroVisible && !isMobile) ? [0, 100] : [0, 0], ["auto", "none"]);

  useEffect(() => {
    if (!pendingReturn?.sectionId) return;
    const allSections = displayHeaderSections.length ? displayHeaderSections : displayExperienceSections;
    if (!allSections.length) return;
    if (allSections.some((s) => s._id === pendingReturn.sectionId)) {
      const el = document.getElementById(`section-${pendingReturn.sectionId}`);
      if (el) {
        el.scrollIntoView({ behavior: "instant", block: "start" });
        removeStorage(STORAGE_KEYS.EXPERIENCE_RETURN, { storage: "session" });
        setPendingReturn(null);
      }
    }
  }, [displayHeaderSections, displayExperienceSections, pendingReturn]);

  return (
    <div className="min-h-screen pt-[210px] md:pt-[160px] bg-white">
      <div className={cn("contents", isProductDetailOpen && "hidden md:contents")}>
        <MainLocationHeader categories={displayCategories} activeCategory={activeCategory} onCategorySelect={handleCategorySelect} />
      </div>

      <>
        {(() => {
          const hasVideo = settings?.homeVideoBanner?.isVisible && settings.homeVideoBanner.videoUrl && isAllCategory;
          const hasBanners = heroConfig.banners?.items?.length > 0;
          if (!hasVideo && !hasBanners) return null;

          const combinedItems = [];
          if (hasVideo) {
            combinedItems.push({
              isVideo: true,
              videoUrl: settings.homeVideoBanner.videoUrl,
            });
          }
          if (hasBanners) {
            combinedItems.push(...heroConfig.banners.items);
          }

          return (
            <motion.div ref={heroRef} className="block md:hidden will-change-transform pt-2" style={isMobile ? { opacity: 1 } : { opacity, y, scale, pointerEvents }}>
              <div className="mx-4 mt-12 mb-1 relative overflow-hidden rounded-[24px] shadow-md z-20">
                <ExperienceBannerCarousel section={{ title: "" }} items={combinedItems} fullWidth edgeToEdge />
              </div>
            </motion.div>
          );
        })()}

        <div className="w-full z-[60] bg-transparent pt-1 pb-2 mb-2">
          <QuickCategorySlider
            categories={effectiveQuickCategories}
            onCategoryClick={(id) => setExpandedCategoryId(expandedCategoryId === id ? null : id)}
          />
        </div>
        {expandedCategoryId && (
          <div className="px-4 mb-5 pb-6 relative z-50 animate-in slide-in-from-top-2 fade-in duration-300">
            <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-3 px-1">
                <h4 className="text-sm font-bold text-slate-800">
                  {effectiveQuickCategories.find(c => c.id === expandedCategoryId)?.name} {getTranslatedText("Subcategories")}
                </h4>
                <button
                  onClick={() => {
                    window.scrollTo(0, 0);
                    navigate(`/category/${expandedCategoryId}`);
                  }}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  {getTranslatedText("View All")}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Object.values(displaySubcategoryMap)
                  .filter(sub => sub.parentId === expandedCategoryId)
                  .map(sub => (
                    <div
                      key={sub._id}
                      onClick={() => {
                        window.scrollTo(0, 0);
                        navigate(`/category/${expandedCategoryId}`, { state: { activeSubcategoryId: sub._id } });
                      }}
                      className="flex flex-col items-center gap-1.5 cursor-pointer group"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center p-1.5 shadow-sm border border-slate-100 group-hover:border-primary/50 group-hover:shadow-md transition-all">
                        <SafeImage
                          src={sub.image}
                          fallbackSrc={getRealCategoryFallback(sub.name)}
                          alt={sub.name}
                          className="w-full h-full object-contain group-hover:scale-110 transition-transform"
                        />
                      </div>
                      <span className="text-[10px] text-center font-semibold text-slate-600 leading-tight line-clamp-2 group-hover:text-primary">
                        {sub.name}
                      </span>
                    </div>
                  ))}
                {Object.values(displaySubcategoryMap).filter(sub => sub.parentId === expandedCategoryId).length === 0 && (
                  <div className="col-span-4 text-center py-4 text-xs text-slate-400 font-medium">
                    {getTranslatedText("No subcategories found.")}
                  </div>
                )}
              </div>

              {(() => {
                const isMatch = (productField, targetId) => {
                  if (!productField) return false;
                  return productField === targetId || productField._id === targetId || productField.id === targetId;
                };
                const categoryProducts = displayProducts.filter(p =>
                  isMatch(p.categoryId, expandedCategoryId) ||
                  isMatch(p.headerId, expandedCategoryId) ||
                  isMatch(p.subcategoryId, expandedCategoryId)
                );
                if (categoryProducts.length === 0) return null;
                return (
                  <div className="mt-5 pt-4 border-t border-slate-200/60">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h4 className="text-[13px] font-bold text-slate-700">
                        {getTranslatedText("Latest in")} {effectiveQuickCategories.find(c => c.id === expandedCategoryId)?.name || "Category"}
                      </h4>
                    </div>
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 snap-x">
                      {categoryProducts.slice(0, 10).map((product) => (
                        <div key={product.id || product._id} className="min-w-[140px] max-w-[140px] snap-start">
                          <ProductCard product={product} compact={true} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {isAllCategory ? (
          <>
            {/* Today's Deals & Additional Deals Sections */}
            <LowestPriceSection
              title="Today's Deals"
              icon={ShoppingBag}
              iconBg="bg-orange-50"
              iconColor="text-[#FF8200]"
              hasTimer={true}
              products={displayProducts}
              onSeeAll={() => navigate("/category/all")}
            />

            <LowestPriceSection
              title="Lowest Price Ever"
              icon={Sparkles}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              hasTimer={false}
              products={displayProducts}
              onSeeAll={() => navigate("/category/all")}
            />

            <LowestPriceSection
              title="Trending Products"
              icon={TrendingUp}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              hasTimer={false}
              products={displayProducts}
              onSeeAll={() => navigate("/category/all")}
            />

            <LowestPriceSection
              title="Best Value Deals"
              icon={Flame}
              iconBg="bg-rose-50"
              iconColor="text-rose-600"
              hasTimer={false}
              products={displayProducts}
              onSeeAll={() => navigate("/category/all")}
            />

            <MonthlyBasketSection />
            <OfferSections sections={displayOfferSections} noServiceData={noServiceData} />

            {displayExperienceSections.length > 0 && (
              <div className="container mx-auto px-4 md:px-8 lg:px-[50px] py-4 md:py-8">
                <SectionRenderer sections={displayExperienceSections} productsById={productsById} categoriesById={displayCategoryMap} subcategoriesById={displaySubcategoryMap} />
              </div>
            )}
          </>
        ) : (
          <>
            {/* Specific Header Category View */}
            {displayHeaderSections.length > 0 ? (
              <div className="container mx-auto px-4 md:px-8 lg:px-[50px] py-4 md:py-8">
                <SectionRenderer sections={displayHeaderSections} productsById={productsById} categoriesById={displayCategoryMap} subcategoriesById={displaySubcategoryMap} />
              </div>
            ) : (
              <div className="pb-12">
                {headerFilteredProducts.length > 0 ? (
                  <>
                    <LowestPriceSection
                      title={`${activeCategory?.name || "Category"} Deals`}
                      icon={Sparkles}
                      iconBg="bg-orange-50"
                      iconColor="text-[#FF8200]"
                      hasTimer={false}
                      products={headerFilteredProducts}
                      onSeeAll={() => expandedCategoryId ? navigate(`/category/${expandedCategoryId}`) : navigate('/categories')}
                    />

                    <div className="container mx-auto px-4 md:px-8 lg:px-[50px] py-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base md:text-lg font-black text-slate-800">
                          All {activeCategory?.name || "Category"} Products ({headerFilteredProducts.length})
                        </h3>
                        {expandedCategoryId && (
                          <button
                            onClick={() => {
                              window.scrollTo(0, 0);
                              navigate(`/category/${expandedCategoryId}`);
                            }}
                            className="text-xs font-bold text-primary hover:underline"
                          >
                            {getTranslatedText("View All")}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                        {headerFilteredProducts.map((product) => (
                          <ProductCard key={product.id || product._id} product={product} />
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="container mx-auto px-4 py-12 text-center max-w-md">
                    <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                      🛒
                    </div>
                    <h4 className="text-base font-bold text-slate-800 mb-1">
                      No products found in {activeCategory?.name || "this category"}
                    </h4>
                    <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                      We are adding more products to this category soon. Please check back later!
                    </p>
                    <button
                      onClick={() => handleCategorySelect(ALL_CATEGORY)}
                      className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-slate-800 active:scale-95 transition-all"
                    >
                      Explore All Categories
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </>
    </div>
  );
};

export default Home;
