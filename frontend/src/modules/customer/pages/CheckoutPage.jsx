import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Lottie from "lottie-react";
import { useInViewAnimation } from "@/core/hooks/useInViewAnimation";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useAuth } from "../../../core/context/AuthContext";
import { customerApi } from "../services/customerApi";
import { useLocation as useAppLocation } from "../context/LocationContext";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import {
  MapPin,
  Clock,
  CreditCard,
  Banknote,
  ChevronRight,
  ChevronLeft,
  Share2,
  Gift,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Heart,
  Truck,
  Tag,
  Sparkles,
  Plus,
  Minus,
  Search,
  X,
  Clipboard,
  Check,
  Contact2,
  Wallet,
  MessageSquare,
  ShieldCheck,
  Lock,
  LocateFixed,
  Home,
  Briefcase,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@shared/components/ui/Toast";
import { useSettings } from "@core/context/SettingsContext";
import SlideToPay from "../components/shared/SlideToPay";
import { getCachedGeocode, setCachedGeocode } from "@/core/utils/geocodeCache";
import { getJSON, setJSON, STORAGE_KEYS } from "@core/utils/storage";
import { createSocketTokenReader } from "@core/utils/authStorage";
import {
  getOrderSocket,
  joinOrderRoom,
  leaveOrderRoom,
  onOrderStatusUpdate,
} from "@/core/services/orderSocket";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Sub-components
import CheckoutAddressSection from "./checkout/components/CheckoutAddressSection";
import CheckoutCartSummary from "./checkout/components/CheckoutCartSummary";
import CheckoutPricingBreakdown from "./checkout/components/CheckoutPricingBreakdown";
import CheckoutPaymentSelector from "./checkout/components/CheckoutPaymentSelector";
import CheckoutCouponSection from "./checkout/components/CheckoutCouponSection";
import CheckoutRecommendedProducts from "./checkout/components/CheckoutRecommendedProducts";
import CheckoutWishlistSection from "./checkout/components/CheckoutWishlistSection";
import CheckoutOrderSuccess from "./checkout/components/CheckoutOrderSuccess";

const CheckoutPage = () => {
  const {
    cart,
    addToCart,
    cartTotal,
    cartCount,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();
  const { wishlist, addToWishlist, fetchFullWishlist, isFullDataFetched } =
    useWishlist();
  const { showToast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettings();

  const wishlistSectionRef = useRef(null);
  const wishlistFetchedRef = useRef(false);

  // useInViewAnimation for floating/particle animation containers
  const { ref: emptyCartAnimRef, isVisible: emptyCartVisible } = useInViewAnimation();

  // Lazy-load wishlist via IntersectionObserver
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!("IntersectionObserver" in window)) {
      if (!wishlistFetchedRef.current) {
        wishlistFetchedRef.current = true;
        fetchFullWishlist();
      }
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !wishlistFetchedRef.current) {
          wishlistFetchedRef.current = true;
          fetchFullWishlist();
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    if (wishlistSectionRef.current) observer.observe(wishlistSectionRef.current);
    return () => observer.disconnect();
  }, [isAuthenticated]);

  const appName = settings?.appName || "App";
  const {
    savedAddresses: locationSavedAddresses = [],
    currentLocation,
    refreshLocation,
    isFetchingLocation,
    updateLocation,
    refreshAddresses,
  } = useAppLocation();
  const navigate = useNavigate();

  // State management
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("now");
  const [selectedPayment, setSelectedPayment] = useState("cash");
  const [selectedTip, setSelectedTip] = useState(0);
  const [showAllCartItems, setShowAllCartItems] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isRedirectingToPayment, setIsRedirectingToPayment] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isResolvingAddressCoords, setIsResolvingAddressCoords] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [walletAmountToUse, setWalletAmountToUse] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [pricingPreview, setPricingPreview] = useState(null);
  const [sellerBreakdowns, setSellerBreakdowns] = useState([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(
    user?.whatsappNotificationsEnabled !== false
  );
  const postOrderNavigateRef = useRef(null);
  const previewDebounceRef = useRef(null);

  /**
   * @typedef {Object} AddressInfo
   * @property {string} [id]
   * @property {string} [type]
   * @property {string} [name]
   * @property {string} [address]
   * @property {string} [landmark]
   * @property {string} [city]
   * @property {string} [state]
   * @property {string} [pincode]
   * @property {string} [phone]
   * @property {{ lat: number, lng: number } | null} [location]
   * @property {string | null} [placeId]
   * @property {string | null} [formattedAddress]
   */

  const [currentAddress, setCurrentAddress] = useState(/** @type {AddressInfo | null} */ (null));

  const [addAddressForm, setAddAddressForm] = useState({
    type: "Home",
    name: user?.name || "",
    phone: user?.phone || "",
    address: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    /** @type {{ lat: number, lng: number } | null} */
    location: null,
    placeId: null,
    formattedAddress: null,
  });

  const [editAddressForm, setEditAddressForm] = useState({
    id: "",
    type: "Home",
    name: "",
    phone: "",
    address: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    /** @type {{ lat: number, lng: number } | null} */
    location: null,
    placeId: null,
    formattedAddress: null,
  });

  const [showRecipientForm, setShowRecipientForm] = useState(false);
  const [recipientData, setRecipientData] = useState({
    completeAddress: "",
    landmark: "",
    pincode: "",
    name: "",
    phone: "",
  });
  const [savedRecipient, setSavedRecipient] = useState(null);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [manualCode, setManualCode] = useState("");
  const [emptyBoxData, setEmptyBoxData] = useState(null);

  // Auto-sync currentAddress with savedAddresses if user has saved addresses and currentAddress is not set
  useEffect(() => {
    if (!currentAddress && locationSavedAddresses && locationSavedAddresses.length > 0) {
      const defaultAddr =
        locationSavedAddresses.find((a) => a.isCurrent || a.isDefault) ||
        locationSavedAddresses[0];
      if (defaultAddr) {
        setCurrentAddress({
          id: defaultAddr.id || defaultAddr._id || "",
          type: defaultAddr.label || "Home",
          name: defaultAddr.name || user?.name || "",
          address: defaultAddr.rawAddress || defaultAddr.address || "",
          landmark: defaultAddr.landmark || "",
          city: defaultAddr.city
            ? `${defaultAddr.city}${defaultAddr.pincode ? ` - ${defaultAddr.pincode}` : ""}`
            : defaultAddr.pincode || "",
          state: defaultAddr.state || "",
          pincode: defaultAddr.pincode || "",
          phone: defaultAddr.phone || user?.phone || "",
          location: defaultAddr.location || null,
          placeId: defaultAddr.placeId || null,
          formattedAddress: defaultAddr.formattedAddress || null,
        });
      }
    }
  }, [locationSavedAddresses, currentAddress, user]);

  // Dynamically load empty-box Lottie only when cart is empty
  useEffect(() => {
    if (cart.length === 0) {
      import("../../../assets/lottie/Empty box.json")
        .then((m) => setEmptyBoxData(m.default))
        .catch(() => {});
    }
  }, [cart.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const paymentMethods = [
    {
      id: "online",
      label: "Pay Online (PhonePe / UPI / Cards)",
      icon: CreditCard,
      sublabel: "UPI, Cards, NetBanking via PhonePe",
    },
    {
      id: "cash",
      label: "Cash on Delivery",
      icon: Banknote,
      sublabel: "Pay after delivery",
    },
  ];

  const tipAmounts = [
    { value: 0, label: "No Tip" },
    { value: 10, label: "Rs.10" },
    { value: 20, label: "Rs.20" },
    { value: 30, label: "Rs.30" },
  ];

  const discountAmount = selectedCoupon
    ? selectedCoupon.discountAmount || selectedCoupon.discount || 0
    : 0;

  const RECIPIENT_STORAGE_KEY = STORAGE_KEYS.RECIPIENT_ADDRESS;

  // Derived display values for primary delivery card
  const displayName = savedRecipient?.name || currentAddress?.name || user?.name || "";
  const displayPhone = savedRecipient?.phone || currentAddress?.phone || user?.phone || "";
  const displayAddress = savedRecipient
    ? `${savedRecipient.completeAddress}${savedRecipient.landmark ? `, ${savedRecipient.landmark}` : ""}${savedRecipient.pincode ? ` - ${savedRecipient.pincode}` : ""}`
    : currentAddress?.address
      ? `${currentAddress.address}${currentAddress.landmark ? `, ${currentAddress.landmark}` : ""}${currentAddress.city ? `, ${currentAddress.city}` : ""}`
      : "";

  const hasValidAddress = Boolean(savedRecipient?.completeAddress || currentAddress?.address);

  // Dynamic estimated delivery time based on distance from sellers
  const estimatedDeliveryTime = useMemo(() => {
    if (!hasValidAddress) {
      return "10-15 mins";
    }
    const maxDist = (sellerBreakdowns || []).reduce(
      (max, s) => Math.max(max, Number(s.distanceKm) || 0),
      0
    );
    if (maxDist <= 0) return "10-15 mins";
    if (maxDist <= 2) return "10-15 mins";
    if (maxDist <= 5) return "15-25 mins";
    if (maxDist <= 8) return "25-35 mins";
    if (maxDist <= 12) return "35-45 mins";
    const minMins = Math.round(15 + maxDist * 2.5);
    const maxMins = Math.round(20 + maxDist * 3);
    return `${minMins}-${maxMins} mins`;
  }, [hasValidAddress, sellerBreakdowns]);

  useEffect(() => {
    if (!paymentMethods.length) return;
    const exists = paymentMethods.some((method) => method.id === selectedPayment);
    if (!exists) {
      setSelectedPayment(paymentMethods[0].id);
    }
  }, [paymentMethods, selectedPayment]);

  const grossOrderTotal = Number(
    pricingPreview?.grandTotal ??
      Math.max(
        0,
        (cartTotal || 0) +
          Number(pricingPreview?.deliveryFeeCharged || 0) +
          Number(pricingPreview?.handlingFeeCharged || 0) +
          Number(pricingPreview?.taxTotal || 0) +
          Number(selectedTip || 0) -
          Number(discountAmount || 0)
      )
  );

  useEffect(() => {
    if (useWallet && user?.walletBalance && grossOrderTotal > 0) {
      const maxAvailable = Number(user.walletBalance || 0);
      const totalToPay = grossOrderTotal;
      setWalletAmountToUse(Math.min(maxAvailable, totalToPay));
    } else {
      setWalletAmountToUse(0);
    }
  }, [useWallet, user?.walletBalance, grossOrderTotal]);

  const finalAmountToPay = Math.max(0, grossOrderTotal - walletAmountToUse);

  const buildAddressForOrder = () => {
    if (savedRecipient) {
      const recPin =
        savedRecipient.pincode ||
        savedRecipient.completeAddress?.match(/\b(\d{6})\b/)?.[1] ||
        "";
      return {
        type: "Other",
        name: savedRecipient.name,
        address: savedRecipient.completeAddress,
        landmark: savedRecipient.landmark || "",
        city: savedRecipient.city || recPin || "",
        pincode: recPin,
        phone: savedRecipient.phone,
        location:
          currentLocation?.latitude && currentLocation?.longitude
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : undefined,
      };
    }

    if (!currentAddress || !currentAddress.address) {
      return null;
    }

    const addrLoc = currentAddress?.location;
    const hasAddrLoc =
      addrLoc &&
      typeof addrLoc.lat === "number" &&
      typeof addrLoc.lng === "number" &&
      Number.isFinite(addrLoc.lat) &&
      Number.isFinite(addrLoc.lng);

    // Extract 6-digit pincode dynamically from address string or city or explicit pincode
    const pinFromAddress =
      (typeof currentAddress.address === "string" ? currentAddress.address.match(/\b(\d{6})\b/)?.[1] : null) ||
      (typeof currentAddress.city === "string" ? currentAddress.city.match(/\b(\d{6})\b/)?.[1] : null);

    const resolvedPincode =
      pinFromAddress ||
      currentAddress.pincode ||
      currentLocation?.pincode ||
      "";

    // Clean city to avoid carrying over "Indore" when user types a new address
    let resolvedCity = currentAddress.city || "";
    if (resolvedCity.includes("-")) {
      resolvedCity = resolvedCity.split("-")[0].trim();
    }

    return {
      ...currentAddress,
      city: resolvedCity,
      pincode: resolvedPincode,
      location: hasAddrLoc ? { lat: addrLoc.lat, lng: addrLoc.lng } : undefined,
    };
  };

  const handleSaveRecipient = () => {
    if (
      !recipientData.completeAddress ||
      !recipientData.name ||
      recipientData.phone.length !== 10
    ) {
      showToast("Please fill all required fields", "error");
      return;
    }
    setSavedRecipient(recipientData);
    setShowRecipientForm(false);
    setJSON(RECIPIENT_STORAGE_KEY, recipientData);
    showToast("Recipient details saved!", "success");
  };

  const handleMoveToWishlist = (item) => {
    addToWishlist(item);
    removeFromCart(item.id || item._id, item.variantSku);
    showToast(`${item.name} moved to wishlist`, "success");
  };

  const isValidLatLng = (loc) =>
    loc &&
    typeof loc.lat === "number" &&
    typeof loc.lng === "number" &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng);

  const resolveAddressCoords = async (addressText) => {
    const q = String(addressText || "").trim();
    if (!q) return null;

    const cacheKey = `addr:${q}`;
    const cached = getCachedGeocode(cacheKey);
    if (cached?.location?.lat && cached?.location?.lng) {
      return cached.location;
    }

    try {
      const resp = await customerApi.geocodeAddress(q);
      const loc = resp.data?.result?.location;
      if (isValidLatLng(loc)) {
        setCachedGeocode(cacheKey, { location: { lat: loc.lat, lng: loc.lng } });
        return { lat: loc.lat, lng: loc.lng };
      }
    } catch (e) {
      const serverMsg =
        e?.response?.data?.message ||
        e?.response?.data?.error?.message ||
        e?.message ||
        null;
      const err = new Error(serverMsg || "Could not geocode address");
      Object.assign(err, { __serverMsg: serverMsg });
      throw err;
    }

    return null;
  };

  // Open Add Address Modal
  const handleOpenAddAddress = () => {
    setAddAddressForm({
      type: "Home",
      name: user?.name || "",
      phone: user?.phone || "",
      address: "",
      landmark: "",
      city: currentLocation?.city || "Indore",
      state: currentLocation?.state || "Madhya Pradesh",
      pincode: currentLocation?.pincode || "",
      location: null,
      placeId: null,
      formattedAddress: null,
    });
    setIsAddressModalOpen(false);
    setIsAddAddressOpen(true);
  };

  // Open Edit Address Modal
  const handleOpenEditAddress = () => {
    if (!currentAddress || !currentAddress.address) {
      handleOpenAddAddress();
      return;
    }
    setEditAddressForm({
      id: currentAddress.id || "",
      type: currentAddress.type || "Home",
      name: currentAddress.name || user?.name || "",
      phone: currentAddress.phone || user?.phone || "",
      address: currentAddress.address || "",
      landmark: currentAddress.landmark || "",
      city: currentAddress.city || "",
      state: currentAddress.state || "",
      pincode: currentAddress.pincode || "",
      location: currentAddress.location || null,
      placeId: currentAddress.placeId || null,
      formattedAddress: currentAddress.formattedAddress || null,
    });
    setIsEditAddressOpen(true);
  };

  // Live Location detect inside Add Address Modal
  const handleUseLiveLocationForAdd = async () => {
    const result = await refreshLocation();
    if (result?.ok && result.location) {
      const loc = result.location;
      setAddAddressForm((prev) => ({
        ...prev,
        address: loc.name || prev.address,
        city: loc.city || prev.city,
        state: loc.state || prev.state,
        pincode: loc.pincode || prev.pincode,
        location:
          typeof loc.latitude === "number" && typeof loc.longitude === "number"
            ? { lat: loc.latitude, lng: loc.longitude }
            : null,
      }));
      showToast("Live location detected", "success");
    } else if (currentLocation?.name) {
      setAddAddressForm((prev) => ({
        ...prev,
        address: currentLocation.name,
        city: currentLocation.city || prev.city,
        state: currentLocation.state || prev.state,
        pincode: currentLocation.pincode || prev.pincode,
        location:
          typeof currentLocation.latitude === "number" && typeof currentLocation.longitude === "number"
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : null,
      }));
      showToast("Using current location", "success");
    } else {
      showToast(result?.error || "Could not detect location", "error");
    }
  };

  // Save new address from modal - INSTANT & OPTIMISTIC
  const handleSaveNewAddress = () => {
    const name = addAddressForm.name?.trim() || user?.name || "Customer";
    const phone = addAddressForm.phone?.trim() || user?.phone || "";
    const address = addAddressForm.address?.trim();
    const landmark = addAddressForm.landmark?.trim() || "";
    const city = addAddressForm.city?.trim() || "";
    const state = addAddressForm.state?.trim() || "";
    const pincode = addAddressForm.pincode?.trim() || "";

    if (!address) {
      showToast("Please enter complete delivery address", "error");
      return;
    }

    if (pincode && pincode.length !== 6) {
      showToast("Please enter a valid 6-digit PIN code (e.g. 560001)", "error");
      return;
    }

    // Determine initial coordinates: form GPS location > currentLocation > Indore default
    let initialLoc =
      addAddressForm.location ||
      (currentLocation?.latitude && currentLocation?.longitude
        ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
        : null);

    const activeAddr = {
      id: Date.now().toString(),
      type: addAddressForm.type || "Home",
      name: name,
      phone: phone,
      address: address,
      landmark: landmark,
      city: [city, pincode].filter(Boolean).join(" - "),
      state: state,
      pincode: pincode,
      ...(initialLoc ? { location: initialLoc } : {}),
    };

    // 1. INSTANT UI UPDATE: Set address and close modal immediately
    setCurrentAddress(activeAddr);
    setIsAddAddressOpen(false);
    showToast("Address saved and selected", "success");

    if (initialLoc) {
      updateLocation(
        {
          name: [address, city, state].filter(Boolean).join(", "),
          time: currentLocation?.time || "12-15 mins",
          city: city || currentLocation?.city,
          state: state || currentLocation?.state,
          pincode: pincode || currentLocation?.pincode,
          latitude: initialLoc.lat,
          longitude: initialLoc.lng,
        },
        { persist: true, updateSavedHome: false }
      );
    }

    // 2. BACKGROUND PERSISTENCE & GEOCODING
    (async () => {
      try {
        let preciseLoc = initialLoc;
        let placeId = null;
        let formattedAddress = null;

        // Geocode in background if not already provided via live GPS
        if (!addAddressForm.location) {
          try {
            const query = [address, landmark, city, state, pincode].filter(Boolean).join(", ");
            const geoResp = await customerApi.geocodeAddress(query);
            const loc = geoResp.data?.result?.location;
            if (isValidLatLng(loc)) {
              preciseLoc = { lat: loc.lat, lng: loc.lng };
              placeId = geoResp.data?.result?.placeId || null;
              formattedAddress = geoResp.data?.result?.formattedAddress || null;
              setCurrentAddress((prev) =>
                prev && prev.id === activeAddr.id
                  ? { ...prev, location: preciseLoc, placeId, formattedAddress }
                  : prev
              );
            }
          } catch {}
        }

        if (isAuthenticated) {
          const rawAddresses = Array.isArray(locationSavedAddresses)
            ? locationSavedAddresses.map((a) => ({
                label: (a.label || "home").toLowerCase(),
                fullAddress: a.rawAddress || a.address,
                landmark: a.landmark || "",
                city: a.city || "",
                state: a.state || "",
                pincode: a.pincode || "",
                location: a.location || null,
                placeId: a.placeId || null,
              }))
            : [];

          const newAddrPayload = {
            label: (addAddressForm.type || "home").toLowerCase(),
            fullAddress: address,
            ...(landmark ? { landmark } : {}),
            ...(city ? { city } : {}),
            ...(state ? { state } : {}),
            ...(pincode ? { pincode } : {}),
            ...(preciseLoc ? { location: preciseLoc } : {}),
            ...(placeId ? { placeId } : {}),
            ...(formattedAddress ? { formattedAddress } : {}),
          };

          await customerApi.updateProfile({
            ...(name ? { name } : {}),
            ...(phone ? { phone } : {}),
            addresses: [...rawAddresses, newAddrPayload],
          });

          refreshAddresses?.();
        }
      } catch (e) {
        console.warn("Background address persistence warning:", e);
      }
    })();
  };

  // Select a saved address from modal - INSTANT
  const handleSelectSavedAddress = (addr) => {
    const rawText = addr?.rawAddress || addr?.address || "";
    const addrLoc = addr?.location;
    const hasLoc = isValidLatLng(addrLoc);
    const pid = typeof addr?.placeId === "string" ? addr.placeId.trim() : "";

    const selected = {
      id: addr.id || addr._id || "",
      type: addr.label || "Home",
      name: addr.name || user?.name || "",
      address: rawText,
      city: addr.city ? `${addr.city}${addr.pincode ? ` - ${addr.pincode}` : ""}` : (addr.pincode || ""),
      state: addr.state || "",
      pincode: addr.pincode || "",
      phone: addr.phone || user?.phone || "",
      landmark: addr.landmark || "",
      ...(pid ? { placeId: pid } : {}),
      ...(hasLoc ? { location: addrLoc } : {}),
    };

    // INSTANT UI UPDATE
    setCurrentAddress(selected);
    setIsAddressModalOpen(false);
    showToast(`Delivering to ${addr.label || "Selected Address"}`, "success");

    if (hasLoc) {
      updateLocation(
        {
          name: rawText,
          time: currentLocation?.time || "12-15 mins",
          city: addr.city || currentLocation?.city,
          state: addr.state || currentLocation?.state,
          pincode: addr.pincode || currentLocation?.pincode,
          latitude: addrLoc.lat,
          longitude: addrLoc.lng,
        },
        { persist: true, updateSavedHome: false }
      );
    } else {
      // Resolve coords in background if missing
      (async () => {
        try {
          let resolvedLoc = null;
          if (pid) {
            const resp = await customerApi.geocodePlaceId(pid);
            if (isValidLatLng(resp.data?.result?.location)) {
              resolvedLoc = resp.data.result.location;
            }
          }
          if (!resolvedLoc && rawText) {
            resolvedLoc = await resolveAddressCoords(rawText);
          }
          if (resolvedLoc) {
            setCurrentAddress((prev) =>
              prev && prev.id === selected.id ? { ...prev, location: resolvedLoc } : prev
            );
            updateLocation(
              {
                name: rawText,
                time: currentLocation?.time || "12-15 mins",
                city: addr.city || currentLocation?.city,
                state: addr.state || currentLocation?.state,
                pincode: addr.pincode || currentLocation?.pincode,
                latitude: resolvedLoc.lat,
                longitude: resolvedLoc.lng,
              },
              { persist: true, updateSavedHome: false }
            );
          }
        } catch {}
      })();
    }
  };

  // Save edited address - INSTANT
  const handleSaveEditedAddress = () => {
    if (!editAddressForm.address.trim()) {
      showToast("Please enter an address", "error");
      return;
    }

    const pinFromText =
      editAddressForm.pincode?.trim() ||
      editAddressForm.address?.match(/\b(\d{6})\b/)?.[1] ||
      editAddressForm.city?.match(/\b(\d{6})\b/)?.[1] ||
      "";

    let editCity = editAddressForm.city?.trim() || "";
    if (editCity.includes("-")) {
      editCity = editCity.split("-")[0].trim();
    }

    const updated = {
      ...currentAddress,
      ...editAddressForm,
      city: editCity,
      pincode: pinFromText || currentAddress?.pincode || "",
    };

    // INSTANT UI UPDATE
    setCurrentAddress(updated);
    setIsEditAddressOpen(false);
    showToast("Delivery address updated", "success");

    // BACKGROUND PERSISTENCE
    (async () => {
      try {
        let location = currentAddress?.location || null;
        let placeId = currentAddress?.placeId || null;
        let formattedAddress = currentAddress?.formattedAddress || null;

        try {
          const query = [
            editAddressForm.address,
            editAddressForm.landmark,
            editAddressForm.city,
            editAddressForm.state,
            editAddressForm.pincode,
          ]
            .filter(Boolean)
            .join(", ");
          const resp = await customerApi.geocodeAddress(query);
          const loc = resp.data?.result?.location;
          if (isValidLatLng(loc)) {
            location = { lat: loc.lat, lng: loc.lng };
            placeId = resp.data?.result?.placeId || null;
            formattedAddress = resp.data?.result?.formattedAddress || null;
            setCurrentAddress((prev) =>
              prev && prev.id === updated.id
                ? { ...prev, location, placeId, formattedAddress }
                : prev
            );
          }
        } catch {}

        if (isAuthenticated && editAddressForm.id) {
          const rawAddresses = Array.isArray(locationSavedAddresses)
            ? locationSavedAddresses.map((a) => {
                if (String(a.id || a._id) === String(editAddressForm.id)) {
                  return {
                    label: (editAddressForm.type || "home").toLowerCase(),
                    fullAddress: editAddressForm.address,
                    landmark: editAddressForm.landmark || "",
                    city: editAddressForm.city || "",
                    state: editAddressForm.state || "",
                    pincode: editAddressForm.pincode || "",
                    ...(location ? { location } : {}),
                    ...(placeId ? { placeId } : {}),
                    ...(formattedAddress ? { formattedAddress } : {}),
                  };
                }
                return {
                  label: (a.label || "home").toLowerCase(),
                  fullAddress: a.rawAddress || a.address,
                  landmark: a.landmark || "",
                  city: a.city || "",
                  state: a.state || "",
                  pincode: a.pincode || "",
                  location: a.location || null,
                  placeId: a.placeId || null,
                };
              })
            : [];

          await customerApi.updateProfile({ addresses: rawAddresses });
          refreshAddresses?.();
        }

        if (location) {
          updateLocation(
            {
              name: formattedAddress || [editAddressForm.address, editAddressForm.city].filter(Boolean).join(", "),
              time: currentLocation?.time || "12-15 mins",
              city: editAddressForm.city || currentLocation?.city,
              state: editAddressForm.state || currentLocation?.state,
              pincode: editAddressForm.pincode || currentLocation?.pincode,
              latitude: location.lat,
              longitude: location.lng,
            },
            { persist: true, updateSavedHome: false }
          );
        }
      } catch (e) {
        console.warn("Background update warning:", e);
      }
    })();
  };

  const handleUseCurrentLiveLocation = async () => {
    const result = await refreshLocation();

    if (result?.ok && result.location) {
      const liveLocation = result.location;
      setCurrentAddress((prev) => ({
        id: prev?.id || Date.now().toString(),
        type: prev?.type || "Home",
        name: user?.name || prev?.name || "Customer",
        phone: user?.phone || prev?.phone || "",
        address: liveLocation.name,
        landmark: "",
        city: [liveLocation.city, liveLocation.state, liveLocation.pincode]
          .filter(Boolean)
          .join(", "),
        ...(typeof liveLocation.latitude === "number" &&
        typeof liveLocation.longitude === "number"
          ? { location: { lat: liveLocation.latitude, lng: liveLocation.longitude } }
          : {}),
      }));
      showToast("Using your current live location", "success");
      return;
    }

    if (currentLocation?.name) {
      setCurrentAddress((prev) => ({
        id: prev?.id || Date.now().toString(),
        type: prev?.type || "Home",
        name: user?.name || prev?.name || "Customer",
        phone: user?.phone || prev?.phone || "",
        address: currentLocation.name,
        landmark: "",
        city: [currentLocation.city, currentLocation.state, currentLocation.pincode]
          .filter(Boolean)
          .join(", "),
        ...(typeof currentLocation.latitude === "number" &&
        typeof currentLocation.longitude === "number"
          ? { location: { lat: currentLocation.latitude, lng: currentLocation.longitude } }
          : {}),
      }));
      showToast("Using your last detected location", "success");
      return;
    }

    showToast(result?.error || "Unable to detect current location", "error");
  };

  const handleApplyCoupon = async (coupon) => {
    try {
      const payload = {
        code: coupon.code,
        cartTotal,
        items: cart,
        customerId: user?._id,
      };
      const res = await customerApi.validateCoupon(payload);
      if (res.data.success) {
        const data = res.data.result;
        setSelectedCoupon({
          ...coupon,
          ...data,
        });
        setIsCouponModalOpen(false);
        showToast(`Coupon ${coupon.code} applied!`, "success");
      } else {
        showToast(res.data.message || "Unable to apply coupon", "error");
      }
    } catch (error) {
      showToast(
        error.response?.data?.message || "Unable to apply coupon",
        "error"
      );
    }
  };

  const handleApplyManualCode = async () => {
    if (!manualCode.trim()) {
      showToast("Please enter a coupon code", "error");
      return;
    }
    try {
      const res = await customerApi.validateCoupon({
        code: manualCode.trim(),
        cartTotal,
        items: cart,
        customerId: user?._id,
      });
      if (res.data.success) {
        const data = res.data.result;
        setSelectedCoupon({
          code: manualCode.trim(),
          description: "Applied manually",
          ...data,
        });
        showToast(`Coupon ${manualCode.trim()} applied!`, "success");
      } else {
        showToast(res.data.message || "Invalid coupon", "error");
      }
    } catch (error) {
      showToast(
        error.response?.data?.message || "Invalid coupon",
        "error"
      );
    }
  };

  const handleAddToCart = (product) => {
    addToCart(product);
    showToast(`${product.name} added to cart!`, "success");
  };

  const getCartItem = (productId) => cart.find((item) => item.id === productId);

  // Stable key for recommended products effect
  const cartProductIdKey = useMemo(
    () =>
      cart
        .map((i) => i.id || i._id)
        .sort()
        .join(","),
    [cart]
  );

  // Load recipient from localStorage + fetch coupons on mount
  useEffect(() => {
    const parsed = getJSON(RECIPIENT_STORAGE_KEY, null);
    if (parsed && parsed.completeAddress && parsed.name && parsed.phone) {
      setRecipientData(parsed);
      setSavedRecipient(parsed);
    }

    const fetchCoupons = async () => {
      try {
        const res = await customerApi.getActiveCoupons();
        if (res.data.success) {
          const list = res.data.result || res.data.results || [];
          setCoupons(list);
        }
      } catch {
        // silently ignore
      }
    };
    fetchCoupons();
  }, []);

  // Debounced checkoutPreview — fires 400 ms after last dependency change
  useEffect(() => {
    if (!isAuthenticated || cart.length === 0) {
      setPricingPreview(null);
      setSellerBreakdowns([]);
      return;
    }

    const orderAddress = buildAddressForOrder();

    const buildPreviewPayload = () => ({
      items: cart.map((item) => ({
        product: item.id || item._id,
        name: item.name,
        variantSku: String(item.variantSku || "").trim(),
        quantity: item.quantity,
        price: item.price,
        image: item.image,
      })),
      address: orderAddress || undefined,
      customerPincode: orderAddress?.pincode || currentAddress?.pincode || currentLocation?.pincode || undefined,
      discountTotal: discountAmount,
      taxTotal: 0,
      tipAmount: selectedTip,
      paymentMode: selectedPayment === "online" ? "ONLINE" : "COD",
      timeSlot: selectedTimeSlot,
    });

    const fetchPreview = async () => {
      try {
        setIsPreviewLoading(true);
        const res = await customerApi.checkoutPreview(buildPreviewPayload());
        if (res.data?.success) {
          setPricingPreview(res.data.result?.breakdown ?? null);
          setSellerBreakdowns(res.data.result?.sellerBreakdowns ?? []);
        }
      } catch (error) {
        console.error("Checkout preview failed", error);
      } finally {
        setIsPreviewLoading(false);
      }
    };

    clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(fetchPreview, 400);

    return () => clearTimeout(previewDebounceRef.current);
  }, [
    isAuthenticated,
    cart,
    selectedPayment,
    selectedTip,
    selectedTimeSlot,
    discountAmount,
    savedRecipient,
    currentAddress,
    currentLocation,
  ]);

  // Recommended products
  useEffect(() => {
    if (cart.length === 0) {
      setRecommendedProducts([]);
      return;
    }
    const categoryId = cart[0]?.categoryId?._id || cart[0]?.categoryId;
    if (!categoryId) return;

    const cartIds = new Set(cart.map((i) => i.id || i._id));
    customerApi
      .getProducts({ categoryId, limit: 10 })
      .then((res) => {
        if (res.data?.success) {
          const items = (res.data.result?.items || [])
            .map((p) => ({ ...p, id: p._id }))
            .filter((p) => !cartIds.has(p.id));
          setRecommendedProducts(items.slice(0, 8));
        }
      })
      .catch(() => {});
  }, [cartProductIdKey]);

  const handlePlaceOrder = async () => {
    const orderAddress = buildAddressForOrder();
    if (!orderAddress || !orderAddress.address) {
      showToast("Please add or select a delivery address first", "error");
      handleOpenAddAddress();
      return;
    }

    setIsPlacingOrder(true);
    try {
      const taxAmount = pricingPreview?.taxTotal || 0;
      const orderData = {
        address: orderAddress,
        paymentMode: selectedPayment === "online" ? "ONLINE" : "COD",
        discountTotal: discountAmount,
        taxTotal: taxAmount,
        tipAmount: selectedTip,
        timeSlot: selectedTimeSlot,
        walletAmount: walletAmountToUse,
        items: cart.map((item) => ({
          product: item.id || item._id,
          name: item.name,
          variantSku: String(item.variantSku || "").trim(),
          quantity: item.quantity,
          price: item.price,
          image: item.image,
        })),
      };

      const response = await customerApi.createOrder(orderData);

      if (response.data.success) {
        const result = response.data.result;
        const mainOrder =
          result.order ||
          (Array.isArray(result.orders) ? result.orders[0] : null);
        const mainOrderId = mainOrder?.orderId || result.orderId;
        const paymentRef =
          result.paymentRef || result.checkoutGroupId || mainOrderId;

        if (!mainOrderId) {
          setIsPlacingOrder(false);
          showToast(
            "Order placed but ID not received. Checking order history...",
            "warning"
          );
          navigate("/orders");
          return;
        }

        if (selectedPayment === "online" && finalAmountToPay > 0) {
          try {
            const paymentRes = await customerApi.createPaymentOrder({
              orderRef: paymentRef,
              orderId: mainOrderId,
            });

            if (!paymentRes.data?.success) {
              throw new Error(
                paymentRes.data?.message || "Failed to initiate payment gateway"
              );
            }

            const paymentData = paymentRes.data.result || {};

            if (paymentData.redirectUrl) {
              setIsRedirectingToPayment(true);
              clearCart();
              window.location.href = paymentData.redirectUrl;
              return;
            }

            throw new Error("Payment gateway redirect URL not received");
          } catch (payError) {
            setIsPlacingOrder(false);
            setIsRedirectingToPayment(false);
            const errorMsg =
              payError.response?.data?.message ||
              payError.response?.data?.error ||
              payError.message ||
              "Order created but payment gateway failed. Please pay from order details.";
            showToast(errorMsg, "error");
            navigate(`/orders/${mainOrderId}`);
            return;
          }
        }

        // COD flow
        clearCart();
        showToast("Order placed — waiting for seller to accept.", "success");
        setOrderId(mainOrderId);
        setShowSuccess(true);

        if (postOrderNavigateRef.current) {
          clearTimeout(postOrderNavigateRef.current);
        }
        postOrderNavigateRef.current = setTimeout(() => {
          postOrderNavigateRef.current = null;
          setIsPlacingOrder(false);
          navigate(`/orders/${mainOrderId}`);
        }, 3000);
      } else {
        setIsPlacingOrder(false);
        showToast(response.data.message || "Could not place order.", "error");
      }
    } catch (error) {
      setIsPlacingOrder(false);
      showToast(
        error.response?.data?.message ||
          "Failed to place order. Please try again.",
        "error"
      );
    }
  };

  // After order placement: WebSocket listener + fallback fetch
  useEffect(() => {
    if (!orderId || !showSuccess) return undefined;

    const getToken = createSocketTokenReader(STORAGE_KEYS.AUTH_CUSTOMER);
    getOrderSocket(getToken);
    joinOrderRoom(orderId, getToken);

    const applyCancelled = (order) => {
      if (order.workflowStatus === "CANCELLED" || order.status === "cancelled") {
        if (postOrderNavigateRef.current) {
          clearTimeout(postOrderNavigateRef.current);
          postOrderNavigateRef.current = null;
        }
        setShowSuccess(false);
        showToast("Order cancelled — seller did not accept in time.", "error");
        navigate(`/orders/${orderId}`, { replace: true });
        return true;
      }
      return false;
    };

    customerApi
      .getOrderDetails(orderId)
      .then((r) => {
        if (r.data?.result) applyCancelled(r.data.result);
      })
      .catch(() => {});

    const off = onOrderStatusUpdate(getToken, (order) => applyCancelled(order));

    return () => {
      off();
      leaveOrderRoom(orderId, getToken);
    };
  }, [orderId, showSuccess]);

  // Payment redirecting state
  if (isRedirectingToPayment) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-purple-50 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-purple-100/40 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute top-40 -left-20 w-60 h-60 bg-brand-100/40 rounded-full blur-3xl pointer-events-none animate-pulse" />

        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="relative z-10 bg-white rounded-3xl p-8 max-w-sm w-full shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-slate-100 flex flex-col items-center text-center">
          <div className="relative mb-6 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full border-4 border-purple-100 border-t-[#6739b7] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#5f259f] to-[#7b3fe4] flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
                <Lock size={22} className="text-white" />
              </div>
            </div>
          </div>

          <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">
            Connecting to PhonePe...
          </h3>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed font-medium">
            Redirecting to secure payment gateway. Please do not refresh or close this window.
          </p>

          <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 flex items-center justify-center gap-2 text-xs font-semibold text-slate-600">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>256-Bit SSL Bank Grade Security</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // Empty cart state
  if (cart.length === 0 && !showSuccess && !isPlacingOrder && !isRedirectingToPayment) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-brand-50/50 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-brand-100/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute top-40 -left-20 w-60 h-60 bg-yellow-100/40 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="relative z-10 flex flex-col items-center text-center max-w-sm mx-auto">
          <div ref={emptyCartAnimRef} className="relative w-56 h-56 md:w-64 md:h-64 mb-8 flex items-center justify-center">
            <motion.div
              animate={emptyCartVisible ? { y: [-8, 8, -8] } : { y: 0 }}
              transition={emptyCartVisible ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
              className="relative z-10 rounded-[2rem] bg-white/90 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-brand-100">
              {emptyBoxData ? (
                <Lottie animationData={emptyBoxData} loop className="h-36 w-36 md:h-44 md:w-44" />
              ) : (
                <div className="w-56 h-56" />
              )}
            </motion.div>
            <motion.div
              animate={emptyCartVisible ? { rotate: 360 } : { rotate: 0 }}
              transition={emptyCartVisible ? { duration: 20, repeat: Infinity, ease: "linear" } : { duration: 0 }}
              className="absolute inset-0 border-2 border-dashed border-slate-200 rounded-full"
            />
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">Your Cart is Empty</h2>
          <p className="text-slate-500 mb-8 leading-relaxed font-medium">
            It feels lighter than air! <br />
            Explore our aisles and fill it with goodies.
          </p>
          <Link
            to="/"
            className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-primary to-[var(--brand-400)] text-white font-bold rounded-2xl overflow-hidden shadow-xl shadow-brand-600/20 transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto">
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative flex items-center gap-2 text-lg">
              Start Shopping <ChevronRight size={20} />
            </span>
          </Link>
          <div className="mt-8 flex gap-6 text-slate-400">
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-50 rounded-2xl"><Clock size={20} /></div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Fast Delivery</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-50 rounded-2xl"><Tag size={20} /></div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Daily Deals</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-50 rounded-2xl"><Sparkles size={20} /></div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Fresh Items</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32 font-sans">
      {/* Order Success Overlay */}
      <CheckoutOrderSuccess orderId={orderId} show={showSuccess} />

      {/* Clean Header */}
      <div className="bg-white py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between relative">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1 -ml-1 hover:bg-slate-50 rounded-full transition-all">
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <h1 className="text-base md:text-lg font-bold text-gray-900 tracking-tight">Checkout</h1>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
              {cartCount} {cartCount === 1 ? "Item" : "Items"} in cart
            </p>
          </div>
          {/* Balanced spacer */}
          <div className="w-8 h-8" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6 relative z-20">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">
          {/* Left Column */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6 pb-8">
            {/* Address Section */}
            <CheckoutAddressSection
              currentAddress={currentAddress}
              savedRecipient={savedRecipient}
              savedAddresses={locationSavedAddresses}
              onSelectAddress={() => setIsAddressModalOpen(true)}
              onAddNewAddress={handleOpenAddAddress}
              onEditAddress={handleOpenEditAddress}
              onUseCurrentLocation={handleUseCurrentLiveLocation}
              isFetchingLocation={isFetchingLocation}
              showRecipientForm={showRecipientForm}
              onToggleRecipientForm={() => setShowRecipientForm((v) => !v)}
              recipientData={recipientData}
              onRecipientDataChange={setRecipientData}
              onSaveRecipient={handleSaveRecipient}
              onRemoveRecipient={() => setSavedRecipient(null)}
              displayName={displayName}
              displayPhone={displayPhone}
              displayAddress={displayAddress}
            />

            {/* Cart Summary */}
            <CheckoutCartSummary
              cart={cart}
              onUpdateQuantity={updateQuantity}
              onRemoveFromCart={removeFromCart}
              onMoveToWishlist={handleMoveToWishlist}
              showAll={showAllCartItems}
              onToggleShowAll={() => setShowAllCartItems((v) => !v)}
            />

            {/* Wishlist Section */}
            <CheckoutWishlistSection
              wishlist={wishlist}
              sectionRef={wishlistSectionRef}
            />

            {/* Recommended Products */}
            <CheckoutRecommendedProducts
              products={recommendedProducts}
              cart={cart}
              onAddToCart={handleAddToCart}
              onGetCartItem={getCartItem}
            />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6 pb-28 lg:pb-8">
            {/* Coupon Section */}
            <CheckoutCouponSection
              coupons={coupons}
              selectedCoupon={selectedCoupon}
              manualCode={manualCode}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={() => setSelectedCoupon(null)}
              onManualCodeChange={setManualCode}
              isOpen={isCouponModalOpen}
              onOpenChange={setIsCouponModalOpen}
              onApplyManualCode={handleApplyManualCode}
            />

            {/* Pricing Breakdown */}
            <CheckoutPricingBreakdown
              pricingPreview={pricingPreview}
              isPreviewLoading={isPreviewLoading}
              selectedTip={selectedTip}
              onSelectTip={setSelectedTip}
              tipAmounts={tipAmounts}
              walletAmountToUse={walletAmountToUse}
              finalAmountToPay={finalAmountToPay}
              cartTotal={cartTotal}
              selectedCoupon={selectedCoupon}
              discountAmount={discountAmount}
            />

            {/* Payment Selector */}
            <CheckoutPaymentSelector
              paymentMethods={paymentMethods}
              selectedPayment={selectedPayment}
              onSelectPayment={setSelectedPayment}
              useWallet={useWallet}
              onToggleWallet={() => setUseWallet((v) => !v)}
              walletBalance={user?.walletBalance || 0}
              walletAmountToUse={walletAmountToUse}
              finalAmountToPay={finalAmountToPay}
            />

            {/* Desktop Slide to Pay */}
            <div className="hidden lg:block">
              <SlideToPay
                amount={finalAmountToPay}
                onSuccess={hasValidAddress ? handlePlaceOrder : handleOpenAddAddress}
                isLoading={isPlacingOrder || isPreviewLoading || (hasValidAddress && !pricingPreview)}
                text={
                  !hasValidAddress
                    ? "Add Address to Order"
                    : walletAmountToUse > 0 && finalAmountToPay === 0
                      ? "Pay via Wallet (₹0)"
                      : finalAmountToPay === 0
                        ? "Place Free Order"
                        : "Order Now"
                }
              />
              <p className="text-center text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-[0.1em]">
                🔒 SSL encrypted secure checkout
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer — Mobile Only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 rounded-t-3xl">
        <div className="max-w-4xl mx-auto">
          <SlideToPay
            amount={finalAmountToPay}
            onSuccess={hasValidAddress ? handlePlaceOrder : handleOpenAddAddress}
            isLoading={isPlacingOrder || isPreviewLoading || (hasValidAddress && !pricingPreview)}
            text={
              !hasValidAddress
                ? "Add Address to Proceed"
                : walletAmountToUse > 0 && finalAmountToPay === 0
                  ? "Pay via Wallet (₹0)"
                  : finalAmountToPay === 0
                    ? "Place Free Order"
                    : "Slide to Pay"
            }
          />
        </div>
      </div>

      {/* Address Selection Modal */}
      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
        <DialogContent className="sm:max-w-[440px] max-h-[85vh] flex flex-col p-6 rounded-3xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-lg font-black text-slate-900">
              Select Delivery Address
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Choose an address for this order or add a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 no-scrollbar">
            {locationSavedAddresses && locationSavedAddresses.length > 0 ? (
              locationSavedAddresses.map((addr) => {
                const isSelected =
                  currentAddress &&
                  (currentAddress.id === addr.id ||
                    currentAddress.address === addr.rawAddress ||
                    currentAddress.address === addr.address);

                return (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => handleSelectSavedAddress(addr)}
                    disabled={isResolvingAddressCoords}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all relative ${
                      isSelected
                        ? "border-primary bg-brand-50/70 shadow-xs"
                        : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50"
                    }`}>
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                          isSelected
                            ? "bg-primary text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                        {addr.label?.toLowerCase() === "work" ? (
                          <Briefcase size={16} />
                        ) : addr.label?.toLowerCase() === "other" ? (
                          <Building size={16} />
                        ) : (
                          <Home size={16} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                            {addr.label || "Address"}
                          </span>
                          {isSelected && (
                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <Check size={12} className="text-white stroke-[3]" />
                            </div>
                          )}
                        </div>
                        {addr.name && (
                          <p className="text-xs font-bold text-slate-800 mb-0.5">{addr.name}</p>
                        )}
                        <p className="text-xs text-slate-600 leading-relaxed mb-1 break-words">
                          {addr.address || addr.rawAddress}
                        </p>
                        {addr.phone && (
                          <p className="text-[11px] text-slate-400 font-medium">
                            Phone: {addr.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-8">
                <div className="h-12 w-12 rounded-full bg-brand-50 text-primary flex items-center justify-center mx-auto mb-3">
                  <MapPin size={22} />
                </div>
                <p className="text-sm font-bold text-slate-700">No saved addresses</p>
                <p className="text-xs text-slate-400 mt-1">
                  Add an address to deliver your order quickly.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 pt-3 border-t border-slate-100">
            <Button
              type="button"
              className="w-full h-12 bg-primary hover:bg-[#0b721b] text-white font-bold rounded-2xl shadow-xs flex items-center justify-center gap-2"
              onClick={handleOpenAddAddress}>
              <Plus size={18} /> Add New Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Address Modal */}
      <Dialog open={isAddAddressOpen} onOpenChange={setIsAddAddressOpen}>
        <DialogContent className="sm:max-w-[460px] max-h-[90vh] flex flex-col p-6 rounded-3xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-lg font-black text-slate-900">
              Add Delivery Address
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Enter your address details to complete your order.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1 no-scrollbar">
            {/* Address Type Selector */}
            <div>
              <Label className="text-xs font-bold text-slate-700 mb-2 block">
                Save Address As
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {["Home", "Work", "Other"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setAddAddressForm((prev) => ({ ...prev, type: tag }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      addAddressForm.type === tag
                        ? "border-primary bg-brand-50 text-primary shadow-xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}>
                    {tag === "Home" && <Home size={14} />}
                    {tag === "Work" && <Briefcase size={14} />}
                    {tag === "Other" && <Building size={14} />}
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* GPS Helper Button */}
            <button
              type="button"
              onClick={handleUseLiveLocationForAdd}
              disabled={isFetchingLocation}
              className="w-full py-2.5 px-3 rounded-xl border border-dashed border-primary/60 bg-brand-50/50 text-primary text-xs font-bold flex items-center justify-center gap-2 hover:bg-brand-50 transition-all">
              <LocateFixed size={15} />
              {isFetchingLocation ? "Detecting GPS location..." : "Use Current GPS Location"}
            </button>

            {/* Receiver Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Contact Name*</Label>
                <Input
                  value={addAddressForm.name}
                  onChange={(e) => setAddAddressForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Your Name"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Phone Number*</Label>
                <Input
                  value={addAddressForm.phone}
                  onChange={(e) => setAddAddressForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="10-digit Phone"
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            {/* Complete Address */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Flat, House No., Building, Street*
              </Label>
              <Input
                value={addAddressForm.address}
                onChange={(e) => setAddAddressForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="e.g. Flat 302, Maple Heights, Main Road"
                className="h-11 rounded-xl"
              />
            </div>

            {/* Landmark */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Landmark (Optional)
              </Label>
              <Input
                value={addAddressForm.landmark}
                onChange={(e) => setAddAddressForm((p) => ({ ...p, landmark: e.target.value }))}
                placeholder="e.g. Near City Mall / Opp. Temple"
                className="h-10 rounded-xl"
              />
            </div>

            {/* City, State & Pincode */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">City</Label>
                <Input
                  value={addAddressForm.city}
                  onChange={(e) => setAddAddressForm((p) => ({ ...p, city: e.target.value }))}
                  placeholder="City"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">State</Label>
                <Input
                  value={addAddressForm.state}
                  onChange={(e) => setAddAddressForm((p) => ({ ...p, state: e.target.value }))}
                  placeholder="State"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Pincode</Label>
                <Input
                  value={addAddressForm.pincode}
                  onChange={(e) => setAddAddressForm((p) => ({ ...p, pincode: e.target.value }))}
                  placeholder="Pincode"
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddAddressOpen(false)}
              className="w-full sm:w-auto h-11 border-slate-200 text-slate-600 rounded-xl">
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSavingAddress}
              onClick={handleSaveNewAddress}
              className="w-full sm:flex-1 h-11 bg-primary hover:bg-[#0b721b] text-white font-bold rounded-xl shadow-xs">
              {isSavingAddress ? "Saving Address..." : "Save & Deliver Here"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Current Address Modal */}
      <Dialog open={isEditAddressOpen} onOpenChange={setIsEditAddressOpen}>
        <DialogContent className="sm:max-w-[450px] max-h-[90vh] flex flex-col p-6 rounded-3xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-lg font-black text-slate-900">
              Edit Delivery Address
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update the details of your current delivery address.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1 no-scrollbar">
            {/* Address Type Selector */}
            <div>
              <Label className="text-xs font-bold text-slate-700 mb-2 block">
                Address Tag
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {["Home", "Work", "Other"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setEditAddressForm((prev) => ({ ...prev, type: tag }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      editAddressForm.type === tag
                        ? "border-primary bg-brand-50 text-primary shadow-xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}>
                    {tag === "Home" && <Home size={14} />}
                    {tag === "Work" && <Briefcase size={14} />}
                    {tag === "Other" && <Building size={14} />}
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Contact Name</Label>
                <Input
                  value={editAddressForm.name}
                  onChange={(e) => setEditAddressForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Your Name"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Phone</Label>
                <Input
                  value={editAddressForm.phone}
                  onChange={(e) => setEditAddressForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="Phone"
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Complete Address*
              </Label>
              <Input
                value={editAddressForm.address}
                onChange={(e) => setEditAddressForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="House, street, area"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Landmark (Optional)
              </Label>
              <Input
                value={editAddressForm.landmark}
                onChange={(e) => setEditAddressForm((p) => ({ ...p, landmark: e.target.value }))}
                placeholder="Nearest landmark"
                className="h-10 rounded-xl"
              />
            </div>

            {/* City, State & Pincode */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">City</Label>
                <Input
                  value={editAddressForm.city}
                  onChange={(e) => setEditAddressForm((p) => ({ ...p, city: e.target.value }))}
                  placeholder="City"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">State</Label>
                <Input
                  value={editAddressForm.state}
                  onChange={(e) => setEditAddressForm((p) => ({ ...p, state: e.target.value }))}
                  placeholder="State"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Pincode</Label>
                <Input
                  value={editAddressForm.pincode}
                  onChange={(e) => setEditAddressForm((p) => ({ ...p, pincode: e.target.value }))}
                  placeholder="6-digit PIN"
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditAddressOpen(false)}
              className="w-full sm:w-auto h-11 border-slate-200 text-slate-600 rounded-xl">
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSavingAddress}
              onClick={handleSaveEditedAddress}
              className="w-full sm:flex-1 h-11 bg-primary hover:bg-[#0b721b] text-white font-bold rounded-xl shadow-xs">
              {isSavingAddress ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          `,
        }}
      />
    </div>
  );
};

export default CheckoutPage;
