import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import { useToast } from "@shared/components/ui/Toast";
import {
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Flame,
  Search,
  Plus,
  Trash2,
  Save,
  Check,
  Clock,
  Eye,
  EyeOff,
  Package,
  Layers,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { adminApi } from "../services/adminApi";
import SafeImage from "@/shared/components/SafeImage";
import { DEFAULT_PRODUCT_IMAGE } from "@/core/utils/imageUtils";

const SECTIONS_CONFIG = [
  {
    key: "todays-deals",
    label: "Today's Deals",
    description: "Daily highlighted specials with optional timer",
    icon: ShoppingBag,
    color: "text-amber-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
    activeColor: "bg-amber-500 text-white",
  },
  {
    key: "lowest-price-ever",
    label: "Lowest Price Ever",
    description: "Deep discount items with all-time lowest price guarantees",
    icon: Sparkles,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    activeColor: "bg-emerald-600 text-white",
  },
  {
    key: "trending-products",
    label: "Trending Products",
    description: "Popular hot selling items for shoppers right now",
    icon: TrendingUp,
    color: "text-blue-500",
    bg: "bg-blue-50",
    border: "border-blue-200",
    activeColor: "bg-blue-600 text-white",
  },
  {
    key: "best-value-deals",
    label: "Best Value Deals",
    description: "High value for money packs & everyday savings",
    icon: Flame,
    color: "text-rose-500",
    bg: "bg-rose-50",
    border: "border-rose-200",
    activeColor: "bg-rose-600 text-white",
  },
];

const DealSectionManager = () => {
  const { sectionKey } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const currentSectionKey = sectionKey || "todays-deals";
  const currentConfig =
    SECTIONS_CONFIG.find((s) => s.key === currentSectionKey) ||
    SECTIONS_CONFIG[0];

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sectionData, setSectionData] = useState({
    title: currentConfig.label,
    subtitle: "",
    hasTimer: currentSectionKey === "todays-deals",
    status: "active",
    productIds: [],
  });
  const [assignedProducts, setAssignedProducts] = useState([]);

  // Catalog search state
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);

  // Load Categories for filtering
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await adminApi.getCategories();
        const list = res.data.results || res.data.result || [];
        setCategories(list.filter((c) => c.type === "category"));
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    };
    fetchCats();
  }, []);

  // Fetch Section Data
  const loadSectionData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getDealSectionByKey(currentSectionKey);
      if (res.data?.success && res.data?.result) {
        const data = res.data.result;
        setSectionData({
          title: data.title || currentConfig.label,
          subtitle: data.subtitle || "",
          hasTimer: Boolean(data.hasTimer),
          status: data.status || "active",
          productIds: (data.productIds || []).map((p) =>
            typeof p === "object" ? p._id : p
          ),
        });
        setAssignedProducts(
          Array.isArray(data.productIds)
            ? data.productIds.filter((p) => typeof p === "object")
            : []
        );
      }
    } catch (err) {
      console.error("Error loading deal section:", err);
      showToast("Failed to load section data", "error");
    } finally {
      setIsLoading(false);
    }
  }, [currentSectionKey, currentConfig.label, showToast]);

  useEffect(() => {
    loadSectionData();
  }, [loadSectionData]);

  // Search catalog products
  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsSearchingCatalog(true);
      try {
        const params = {
          limit: 30,
          status: "active",
        };
        if (searchQuery.trim()) params.search = searchQuery.trim();
        if (selectedCategory && selectedCategory !== "all") {
          params.category = selectedCategory;
        }

        const res = await adminApi.getProducts(params);
        const list =
          res.data.results ||
          res.data.result?.items ||
          res.data.result ||
          [];
        setCatalogProducts(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("Failed to search catalog:", err);
      } finally {
        setIsSearchingCatalog(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory]);

  const assignedProductIdsSet = useMemo(() => {
    return new Set(assignedProducts.map((p) => String(p._id || p.id)));
  }, [assignedProducts]);

  // Add product to section
  const handleAddProduct = (product) => {
    const pId = String(product._id || product.id);
    if (assignedProductIdsSet.has(pId)) return;

    setAssignedProducts((prev) => [product, ...prev]);
    setSectionData((prev) => ({
      ...prev,
      productIds: [pId, ...prev.productIds],
    }));
    showToast(`Added "${product.name}" to ${currentConfig.label}`, "success");
  };

  // Remove product from section
  const handleRemoveProduct = (productId) => {
    const pId = String(productId);
    setAssignedProducts((prev) =>
      prev.filter((p) => String(p._id || p.id) !== pId)
    );
    setSectionData((prev) => ({
      ...prev,
      productIds: prev.productIds.filter((id) => String(id) !== pId),
    }));
  };

  // Save changes
  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const payload = {
        title: sectionData.title,
        subtitle: sectionData.subtitle,
        hasTimer: sectionData.hasTimer,
        status: sectionData.status,
        productIds: assignedProducts.map((p) => p._id || p.id),
      };

      const res = await adminApi.updateDealSection(
        currentSectionKey,
        payload
      );
      if (res.data?.success) {
        showToast("Section updated successfully!", "success");
        loadSectionData();
      } else {
        showToast(res.data?.message || "Failed to update section", "error");
      }
    } catch (err) {
      console.error("Save error:", err);
      showToast("Failed to save changes", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const IconComponent = currentConfig.icon;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span className="p-2 rounded-xl bg-orange-100 text-orange-600">
              <Layers size={22} />
            </span>
            Deals & Highlights Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage products specifically displayed in homepage deals rows like Today's Deals, Lowest Price Ever, etc.
          </p>
        </div>

        <button
          onClick={handleSaveChanges}
          disabled={isSaving || isLoading}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-medium shadow-md shadow-orange-500/20 transition-all disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <RefreshCw size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}
          <span>{isSaving ? "Saving..." : "Save All Changes"}</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SECTIONS_CONFIG.map((sec) => {
          const TabIcon = sec.icon;
          const isActive = sec.key === currentSectionKey;
          return (
            <button
              key={sec.key}
              onClick={() => navigate(`/admin/deals/${sec.key}`)}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isActive
                  ? `${sec.border} bg-white shadow-sm ring-2 ring-orange-500/30`
                  : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${sec.bg} ${sec.color}`}
                >
                  <TabIcon size={18} />
                </div>
                {isActive && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                    Active Tab
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  {sec.label}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                  {sec.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Section Settings Bar */}
      <Card className="p-5 border border-slate-200/80 shadow-sm bg-white rounded-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start md:items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl ${currentConfig.bg} ${currentConfig.color} flex items-center justify-center shrink-0 shadow-sm`}
            >
              <IconComponent size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={sectionData.title}
                  onChange={(e) =>
                    setSectionData({ ...sectionData, title: e.target.value })
                  }
                  className="text-lg font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-orange-500 focus:outline-none bg-transparent px-1 py-0.5 transition-colors"
                  placeholder="Section Title"
                />
              </div>
              <input
                type="text"
                value={sectionData.subtitle}
                onChange={(e) =>
                  setSectionData({ ...sectionData, subtitle: e.target.value })
                }
                className="text-xs text-slate-500 border-b border-transparent hover:border-slate-300 focus:border-orange-500 focus:outline-none bg-transparent px-1 py-0.5 mt-0.5 w-full md:w-80"
                placeholder="Optional Subtitle or description..."
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            {/* Status Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <input
                type="checkbox"
                checked={sectionData.status === "active"}
                onChange={(e) =>
                  setSectionData({
                    ...sectionData,
                    status: e.target.checked ? "active" : "inactive",
                  })
                }
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                {sectionData.status === "active" ? (
                  <>
                    <Eye size={14} className="text-emerald-500" />
                    Visible on Home
                  </>
                ) : (
                  <>
                    <EyeOff size={14} className="text-slate-400" />
                    Hidden (Inactive)
                  </>
                )}
              </span>
            </label>

            {/* Countdown Timer Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <input
                type="checkbox"
                checked={sectionData.hasTimer}
                onChange={(e) =>
                  setSectionData({
                    ...sectionData,
                    hasTimer: e.target.checked,
                  })
                }
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Clock size={14} className="text-amber-500" />
                Countdown Timer
              </span>
            </label>

            {/* Product Count Badge */}
            <Badge
              variant={assignedProducts.length > 0 ? "success" : "neutral"}
              className="px-3 py-1 text-xs"
            >
              {assignedProducts.length} Products Added
            </Badge>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Main Column: Currently Assigned Products */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Package size={18} className="text-orange-600" />
              Products in this Section
              <span className="text-xs font-normal text-slate-400">
                (Customer Homepage display order)
              </span>
            </h2>
            {assignedProducts.length > 0 && (
              <button
                onClick={() => {
                  setAssignedProducts([]);
                  setSectionData((prev) => ({ ...prev, productIds: [] }));
                }}
                className="text-xs text-rose-500 hover:text-rose-700 font-medium cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <RefreshCw
                size={24}
                className="animate-spin text-orange-500 mx-auto mb-2"
              />
              <p className="text-sm text-slate-500">Loading section products...</p>
            </div>
          ) : assignedProducts.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-3">
                <Plus size={22} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                No products added to {currentConfig.label}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Use the product finder on the right to search and add products specifically to this section.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {assignedProducts.map((product, idx) => (
                <div
                  key={product._id || product.id}
                  className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm hover:border-orange-200 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-slate-400 w-5 text-center">
                      #{idx + 1}
                    </span>
                    <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                      <SafeImage
                        src={product.mainImage || product.image}
                        fallbackSrc={DEFAULT_PRODUCT_IMAGE}
                        alt={product.name}
                        className="w-full h-full object-contain p-1"
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-800 truncate leading-snug">
                        {product.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-emerald-600">
                          ₹{product.salePrice || product.price}
                        </span>
                        {product.salePrice && product.salePrice < product.price && (
                          <span className="text-[11px] text-slate-400 line-through">
                            ₹{product.price}
                          </span>
                        )}
                        {product.sku && (
                          <span className="text-[10px] text-slate-400">
                            SKU: {product.sku}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveProduct(product._id || product.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0 ml-2"
                    title="Remove from section"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Search & Add Products from Catalog */}
        <div className="lg:col-span-5 space-y-4">
          <div className="px-1">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Plus size={18} className="text-orange-600" />
              Add Products to Section
            </h2>
            <p className="text-xs text-slate-500">
              Search by product name or filter by category
            </p>
          </div>

          <Card className="p-4 border border-slate-200/80 shadow-sm bg-white rounded-2xl space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search products by title or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-slate-50/50"
              />
            </div>

            {/* Category Dropdown */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-slate-50/50 text-slate-700"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Products List from Search */}
            <div className="border-t border-slate-100 pt-3 space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {isSearchingCatalog ? (
                <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin" />
                  Searching products...
                </div>
              ) : catalogProducts.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No products found.
                </div>
              ) : (
                catalogProducts.map((prod) => {
                  const isAlreadyAdded = assignedProductIdsSet.has(
                    String(prod._id || prod.id)
                  );
                  return (
                    <div
                      key={prod._id || prod.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-200/60 overflow-hidden flex items-center justify-center shrink-0">
                          <SafeImage
                            src={prod.mainImage || prod.image}
                            fallbackSrc={DEFAULT_PRODUCT_IMAGE}
                            alt={prod.name}
                            className="w-full h-full object-contain p-0.5"
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-slate-800 truncate">
                            {prod.name}
                          </h4>
                          <span className="text-[11px] font-bold text-slate-700">
                            ₹{prod.salePrice || prod.price}
                          </span>
                        </div>
                      </div>

                      {isAlreadyAdded ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold shrink-0">
                          <Check size={12} strokeWidth={3} />
                          Added
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddProduct(prod)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-600 text-orange-600 hover:text-white text-[11px] font-bold transition-all shrink-0 cursor-pointer"
                        >
                          <Plus size={12} strokeWidth={3} />
                          Add
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DealSectionManager;
