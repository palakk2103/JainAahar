import DealSection from "../models/dealSection.js";
import handleResponse from "../utils/helper.js";
import { getApprovedOrLegacyFilter } from "../services/productModerationService.js";
import { buildKey, getOrSet, getTTL, invalidate } from "../services/cacheService.js";

const DEFAULT_SECTIONS = [
  {
    sectionKey: "todays-deals",
    title: "Today's Deals",
    subtitle: "Exclusive deals refreshed daily",
    hasTimer: true,
    iconName: "ShoppingBag",
    iconBg: "bg-orange-50",
    iconColor: "text-[#FF8200]",
    status: "active",
    order: 0,
  },
  {
    sectionKey: "lowest-price-ever",
    title: "Lowest Price Ever",
    subtitle: "Unbeatable prices on your daily favorites",
    hasTimer: false,
    iconName: "Sparkles",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    status: "active",
    order: 1,
  },
  {
    sectionKey: "trending-products",
    title: "Trending Products",
    subtitle: "Most popular items right now",
    hasTimer: false,
    iconName: "TrendingUp",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    status: "active",
    order: 2,
  },
  {
    sectionKey: "best-value-deals",
    title: "Best Value Deals",
    subtitle: "Maximum savings on top essentials",
    hasTimer: false,
    iconName: "Flame",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    status: "active",
    order: 3,
  },
];

const ensureDefaultSections = async () => {
  for (const def of DEFAULT_SECTIONS) {
    const exists = await DealSection.findOne({ sectionKey: def.sectionKey });
    if (!exists) {
      await DealSection.create({
        ...def,
        productIds: [],
      });
    }
  }
};

/**
 * Public endpoint for customer app (Homepage)
 */
export const getPublicDealSections = async (req, res) => {
  try {
    await ensureDefaultSections();

    const cacheKey = buildKey("dealsections", "public", "all");
    const sections = await getOrSet(
      cacheKey,
      async () => {
        const list = await DealSection.find({ status: "active" })
          .sort({ order: 1, createdAt: 1 })
          .populate({
            path: "productIds",
            select: "name slug price salePrice mainImage image stock unit weight sellerId status approvalStatus deliveryTime",
            match: {
              status: "active",
              ...getApprovedOrLegacyFilter(),
            },
          })
          .lean();

        return list.map((section) => ({
          ...section,
          products: (Array.isArray(section.productIds) ? section.productIds : []).map((p) => ({
            ...p,
            id: p._id,
            image: p.mainImage || p.image || "",
            price: p.salePrice || p.price,
            originalPrice: p.price,
            weight: p.weight || p.unit || "1 unit",
          })),
        }));
      },
      getTTL("homepage") || 60
    );

    return handleResponse(res, 200, "Deal sections fetched successfully", sections);
  } catch (error) {
    console.error("getPublicDealSections error:", error);
    return handleResponse(res, 500, error.message);
  }
};

/**
 * Admin: Get all deal sections list
 */
export const getAdminDealSections = async (req, res) => {
  try {
    await ensureDefaultSections();

    const sections = await DealSection.find({})
      .sort({ order: 1, createdAt: 1 })
      .populate({
        path: "productIds",
        select: "name slug price salePrice mainImage image stock categoryId subcategoryId status",
      })
      .lean();

    const result = sections.map((sec) => ({
      ...sec,
      productCount: Array.isArray(sec.productIds) ? sec.productIds.length : 0,
    }));

    return handleResponse(res, 200, "Admin deal sections fetched", result);
  } catch (error) {
    console.error("getAdminDealSections error:", error);
    return handleResponse(res, 500, error.message);
  }
};

/**
 * Admin: Get particular section by sectionKey
 */
export const getAdminDealSectionByKey = async (req, res) => {
  try {
    const { key } = req.params;
    await ensureDefaultSections();

    const section = await DealSection.findOne({ sectionKey: key })
      .populate({
        path: "productIds",
        select: "name slug sku price salePrice mainImage image stock categoryId subcategoryId status",
      })
      .lean();

    if (!section) {
      return handleResponse(res, 404, "Deal section not found");
    }

    return handleResponse(res, 200, "Deal section fetched", section);
  } catch (error) {
    console.error("getAdminDealSectionByKey error:", error);
    return handleResponse(res, 500, error.message);
  }
};

/**
 * Admin: Update section settings & product list
 */
export const updateDealSection = async (req, res) => {
  try {
    const { key } = req.params;
    const { title, subtitle, hasTimer, status, productIds, iconName, iconBg, iconColor } = req.body;

    const updatePayload = {};
    if (typeof title === "string") updatePayload.title = title.trim();
    if (typeof subtitle === "string") updatePayload.subtitle = subtitle.trim();
    if (typeof hasTimer === "boolean") updatePayload.hasTimer = hasTimer;
    if (status && ["active", "inactive"].includes(status)) updatePayload.status = status;
    if (Array.isArray(productIds)) updatePayload.productIds = productIds;
    if (iconName) updatePayload.iconName = iconName;
    if (iconBg) updatePayload.iconBg = iconBg;
    if (iconColor) updatePayload.iconColor = iconColor;

    const updated = await DealSection.findOneAndUpdate(
      { sectionKey: key },
      { $set: updatePayload },
      { new: true }
    ).populate({
      path: "productIds",
      select: "name slug sku price salePrice mainImage image stock categoryId subcategoryId status",
    });

    if (!updated) {
      return handleResponse(res, 404, "Deal section not found");
    }

    try {
      invalidate(buildKey("dealsections", "public", "all"));
    } catch (e) {
      // cache service might not be redis
    }

    return handleResponse(res, 200, "Deal section updated successfully", updated);
  } catch (error) {
    console.error("updateDealSection error:", error);
    return handleResponse(res, 500, error.message);
  }
};
