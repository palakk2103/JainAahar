import Product from "../models/product.js";
import Order from "../models/order.js";
import Review from "../models/review.js";
import { handleResponse } from "../utils/helper.js";
import https from "https";

// Helper function to translate input search terms to English dynamically with timeout
function translateToEnglish(text) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(text), 1500); // 1.5s max timeout
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        clearTimeout(timer);
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed[0] && parsed[0][0] && parsed[0][0][0]) {
            resolve(parsed[0][0][0].trim());
            return;
          }
        } catch (e) {
          // ignore
        }
        resolve(text);
      });
    }).on('error', (err) => {
      clearTimeout(timer);
      resolve(text);
    });
  });
}

// Comprehensive Grocery & Spices Synonym Dictionary (English <-> Hindi <-> Hinglish)
const GROCERY_SYNONYMS = {
  // Spices & Condiments
  "haldi": ["turmeric", "haldi", "haridra"],
  "turmeric": ["haldi", "turmeric", "haridra"],
  "jeera": ["cumin", "jeera", "zeera", "jira"],
  "cumin": ["jeera", "cumin", "zeera", "jira"],
  "zeera": ["jeera", "cumin", "zeera", "jira"],
  "jira": ["jeera", "cumin", "zeera", "jira"],
  "mirch": ["chilli", "chili", "mirch", "mirchi", "pepper"],
  "mirchi": ["chilli", "chili", "mirch", "mirchi", "pepper"],
  "chilli": ["mirch", "mirchi", "chilli", "chili", "pepper"],
  "chili": ["mirch", "mirchi", "chilli", "chili", "pepper"],
  "pepper": ["mirch", "mirchi", "kali mirch", "pepper"],
  "black pepper": ["kali mirch", "black pepper", "golki"],
  "kali mirch": ["black pepper", "kali mirch", "pepper", "golki"],
  "lal mirch": ["red chilli", "red chili", "lal mirch", "chilli powder"],
  "red chilli": ["lal mirch", "red chilli", "red chili", "mirch"],
  "red chili": ["lal mirch", "red chilli", "red chili", "mirch"],
  "dhaniya": ["coriander", "dhaniya", "dhania", "dhana"],
  "dhania": ["coriander", "dhaniya", "dhania", "dhana"],
  "dhana": ["coriander", "dhaniya", "dhania", "dhana"],
  "coriander": ["dhaniya", "dhania", "dhana", "coriander"],
  "methi": ["fenugreek", "methi", "maithi", "kasuri methi", "kasuri maithi"],
  "maithi": ["fenugreek", "methi", "maithi", "kasuri methi", "kasuri maithi"],
  "fenugreek": ["methi", "maithi", "fenugreek", "kasuri methi"],
  "kasuri methi": ["kasuri maithi", "kasuri methi", "maithi", "methi"],
  "kasuri maithi": ["kasuri methi", "kasuri maithi", "maithi", "methi"],
  "namak": ["salt", "namak", "sendha", "saida", "rock salt"],
  "salt": ["namak", "salt", "sendha namak", "saida namak", "rock salt"],
  "sendha": ["sendha namak", "saida namak", "rock salt", "namak"],
  "saida": ["sendha namak", "saida namak", "rock salt", "namak"],
  "rock salt": ["sendha namak", "saida namak", "rock salt", "namak"],
  "sarso": ["mustard", "sarso", "sarson", "rai", "rye"],
  "sarson": ["mustard", "sarso", "sarson", "rai", "rye"],
  "rai": ["mustard", "sarso", "sarson", "rai", "rye"],
  "mustard": ["sarso", "sarson", "rai", "mustard"],
  "ajwain": ["carom", "ajwain", "ajowan", "carom seeds"],
  "carom": ["ajwain", "carom", "carom seeds"],
  "elaichi": ["cardamom", "elaichi", "ilaichi", "elachi", "donda", "badi elaichi"],
  "ilaichi": ["cardamom", "elaichi", "ilaichi", "elachi", "donda", "badi elaichi"],
  "elachi": ["cardamom", "elaichi", "ilaichi", "elachi", "donda", "badi elaichi"],
  "cardamom": ["elaichi", "ilaichi", "cardamom", "donda", "badi elaichi"],
  "badi elaichi": ["donda", "badi elaichi", "black cardamom", "cardamom"],
  "donda": ["donda", "badi elaichi", "black cardamom", "cardamom"],
  "dalchini": ["cinnamon", "dalchini", "dal chini"],
  "dal chini": ["cinnamon", "dalchini", "dal chini"],
  "cinnamon": ["dalchini", "dal chini", "cinnamon"],
  "laung": ["clove", "laung", "long", "lavang", "cloves"],
  "long": ["clove", "laung", "long", "lavang", "cloves"],
  "clove": ["laung", "long", "clove", "lavang", "cloves"],
  "cloves": ["laung", "long", "clove", "lavang", "cloves"],
  "sonth": ["dry ginger", "sonth", "saunth", "ginger powder"],
  "saunth": ["dry ginger", "sonth", "saunth", "ginger powder"],
  "dry ginger": ["sonth", "saunth", "dry ginger"],
  "ginger": ["adrak", "sonth", "ginger"],
  "adrak": ["ginger", "adrak", "sonth"],
  "garlic": ["lahsun", "garlic"],
  "lahsun": ["garlic", "lahsun"],
  "onion": ["pyaz", "onion", "onions"],
  "pyaz": ["onion", "pyaz", "onions"],
  "potato": ["aloo", "potato", "potatoes"],
  "aloo": ["potato", "aloo", "potatoes"],
  "tomato": ["tamatar", "tomato", "tomatoes"],
  "tamatar": ["tomato", "tamatar", "tomatoes"],
  "tej patta": ["bay leaf", "tej patta", "bay leaves"],
  "bay leaf": ["tej patta", "bay leaf", "bay leaves"],
  "saunf": ["fennel", "saunf", "fennel seeds", "variyali"],
  "fennel": ["saunf", "fennel", "fennel seeds"],
  "hing": ["asafoetida", "hing", "heeng"],
  "heeng": ["asafoetida", "hing", "heeng"],
  "asafoetida": ["hing", "heeng", "asafoetida"],
  "masala": ["masala", "spice", "spices"],
  "garam masala": ["garam masala", "masala"],
  "jiraman": ["jiraman", "jeeravan", "masala"],

  // Dry Fruits & Nuts
  "badam": ["almond", "badam", "badaam", "almonds"],
  "badaam": ["almond", "badam", "badaam", "almonds"],
  "almond": ["badam", "badaam", "almond", "almonds"],
  "almonds": ["badam", "badaam", "almond", "almonds"],
  "kaju": ["cashew", "kaju", "cashews", "cashew nuts"],
  "cashew": ["kaju", "cashew", "cashews"],
  "cashews": ["kaju", "cashew", "cashews"],
  "kismis": ["raisin", "raisins", "kismis", "kishmish"],
  "kishmish": ["raisin", "raisins", "kismis", "kishmish"],
  "raisin": ["kismis", "kishmish", "raisin", "raisins"],
  "raisins": ["kismis", "kishmish", "raisin", "raisins"],
  "akhrot": ["walnut", "walnuts", "akhrot", "akroot"],
  "walnut": ["akhrot", "walnut", "walnuts"],
  "walnuts": ["akhrot", "walnut", "walnuts"],
  "pista": ["pistachio", "pistachios", "pista"],
  "pistachio": ["pista", "pistachio", "pistachios"],
  "pistachios": ["pista", "pistachio", "pistachios"],
  "khajur": ["dates", "date", "khajur", "khajoor", "chuhara"],
  "khajoor": ["dates", "date", "khajur", "khajoor", "chuhara"],
  "dates": ["khajur", "khajoor", "dates", "chuhara", "dry dates"],
  "chuhara": ["dry dates", "dates", "chuhara", "khajur"],
  "dry dates": ["chuhara", "dry dates", "khajur", "dates"],
  "mungfali": ["peanut", "peanuts", "groundnut", "mungfali", "moongfali", "singdana"],
  "moongfali": ["peanut", "peanuts", "groundnut", "mungfali", "moongfali", "singdana"],
  "peanut": ["mungfali", "moongfali", "peanut", "peanuts", "groundnut"],
  "peanuts": ["mungfali", "moongfali", "peanut", "peanuts", "groundnut"],
  "groundnut": ["mungfali", "moongfali", "peanut", "peanuts", "groundnut"],
  "chironji": ["charoli", "chironji"],
  "charoli": ["chironji", "charoli"],
  "makhana": ["fox nuts", "lotus seeds", "makhana", "phool makhana"],

  // Grains & Pulses / Dals
  "dal": ["dal", "dhal", "daal", "pulse", "pulses", "lentil", "lentils"],
  "dals": ["dal", "dhal", "daal", "pulse", "pulses", "lentil", "lentils"],
  "pulses": ["dal", "pulse", "pulses", "lentil", "lentils"],
  "lentil": ["dal", "lentil", "lentils", "pulse"],
  "lentils": ["dal", "lentil", "lentils", "pulse"],
  "toor": ["toor", "tuar", "arhar", "pigeon pea", "toor dal"],
  "tuar": ["toor", "tuar", "arhar", "pigeon pea", "tuar dal"],
  "arhar": ["toor", "tuar", "arhar", "toor dal", "tuar dal"],
  "moong": ["moong", "mung", "green gram", "moong dal"],
  "mung": ["moong", "mung", "green gram", "moong dal"],
  "masoor": ["masoor", "masur", "red lentil", "malka", "masoor dal"],
  "masur": ["masoor", "masur", "red lentil", "malka", "masoor dal"],
  "malka": ["masoor", "malka", "malka masoor"],
  "urad": ["urad", "udad", "black gram", "urad dal"],
  "udad": ["urad", "udad", "black gram", "urad dal"],
  "chana": ["chana", "channa", "gram", "bengal gram", "chana dal", "kala chana"],
  "channa": ["chana", "channa", "gram", "chana dal"],
  "chole": ["chole", "chana", "kabuli chana", "chickpeas", "chickpea"],
  "kabuli": ["kabuli chana", "chole", "chickpeas", "chickpea"],
  "chickpea": ["chole", "kabuli chana", "chana", "chickpea", "chickpeas"],
  "chickpeas": ["chole", "kabuli chana", "chana", "chickpea", "chickpeas"],
  "rajma": ["rajma", "rajmah", "kidney beans", "red kidney beans"],
  "kidney beans": ["rajma", "kidney beans"],
  "lobia": ["lobia", "ramasi", "black eyed peas", "cowpea"],
  "ramasi": ["lobia", "ramasi", "cowpea"],
  "rice": ["rice", "chawal", "tandul"],
  "chawal": ["rice", "chawal"],
  "corn": ["corn", "makka", "makkai", "maize"],
  "makka": ["corn", "makka", "makkai", "maize"],
  "makkai": ["corn", "makka", "makkai", "maize"],
  "maize": ["corn", "makka", "maize"],
  "jowar": ["jowar", "joo", "sorghum", "barley"],
  "joo": ["jowar", "joo", "barley"],
  "bajra": ["bajra", "pearl millet", "millet"],
  "millet": ["bajra", "jowar", "millet"],
  "wheat": ["gehun", "wheat", "atta"],
  "atta": ["atta", "flour", "wheat flour", "gehun"],
  "flour": ["atta", "flour", "maida", "besan"],
  "besan": ["besan", "gram flour", "chana flour"],
  "suji": ["suji", "sooji", "rava", "semolina"],
  "sooji": ["suji", "sooji", "rava", "semolina"],
  "rava": ["suji", "sooji", "rava", "semolina"],
  "poha": ["poha", "pohe", "flattened rice", "chivda"],
  "sabudana": ["sabudana", "sago", "tapioca pearls"],

  // Sweeteners & Dairy
  "sugar": ["sugar", "cheeni", "shakkar", "khand", "bura"],
  "cheeni": ["sugar", "cheeni", "shakkar"],
  "shakkar": ["sugar", "shakkar", "cheeni", "jaggery powder"],
  "gud": ["jaggery", "gud", "gur"],
  "gur": ["jaggery", "gud", "gur"],
  "jaggery": ["gud", "gur", "jaggery"],
  "ghee": ["ghee", "desi ghee", "clarified butter"],
  "oil": ["oil", "tel", "cooking oil"],
  "tel": ["oil", "tel"],
  "milk": ["doodh", "milk"],
  "doodh": ["milk", "doodh"],
  "paneer": ["paneer", "cottage cheese"],
  "cottage cheese": ["paneer", "cottage cheese"],

  // Pooja Items
  "poojan": ["poojan", "puja", "pooja", "mandir"],
  "pooja": ["poojan", "puja", "pooja", "mandir"],
  "puja": ["poojan", "puja", "pooja", "mandir"],
  "dhoop": ["dhoop", "incense", "agarbatti"],
  "tulsi": ["tulsi", "holy basil", "basil"],
  "neem": ["neem", "margosa"],

  // Mango / Aam
  "aam": ["aam", "mango", "amchur", "aamchur"],
  "mango": ["aam", "mango", "amchur", "aamchur"],
  "amchur": ["amchur", "aamchur", "dry mango powder", "mango powder"],
  "aamchur": ["amchur", "aamchur", "dry mango powder", "mango powder"]
};

// Flexible regex generator that matches Hinglish vowels & common phonetic variations flexibly
function createFlexiblePattern(str) {
  let res = '';
  const s = str.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === 'a') {
      if (s[i + 1] === 'a') i++;
      res += 'a+';
    } else if (c === 'i') {
      if (s[i + 1] === 'i') i++;
      res += '(?:i+|ee)';
    } else if (c === 'e') {
      if (s[i + 1] === 'e') i++;
      res += '(?:e+|ee|ai)';
    } else if (c === 'u') {
      if (s[i + 1] === 'u') i++;
      res += '(?:u+|oo)';
    } else if (c === 'o') {
      if (s[i + 1] === 'o') i++;
      res += '(?:o+|au)';
    } else if (c === 's' && s[i + 1] === 'h') {
      i++;
      res += '(?:sh|s)';
    } else if (c === 's') {
      res += '(?:s|sh)';
    } else if (c === 'y' && i > 0 && s[i - 1] === 'i') {
      res += 'y?';
    } else if (/[.*+?^${}()|[\]\\]/.test(c)) {
      res += '\\' + c;
    } else {
      res += c;
    }
  }
  return res;
}

function buildSearchRegexWithSynonyms(word) {
  const normalized = word.toLowerCase().trim();
  const candidateTerms = new Set([normalized]);

  if (GROCERY_SYNONYMS[normalized]) {
    GROCERY_SYNONYMS[normalized].forEach(item => candidateTerms.add(item.toLowerCase()));
  }

  const patterns = [];
  for (const cand of candidateTerms) {
    patterns.push(cand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (cand.length >= 2) {
      patterns.push(createFlexiblePattern(cand));
    }
  }

  const uniquePatterns = [...new Set(patterns)];
  const pattern = uniquePatterns.length > 1 ? `(${uniquePatterns.join("|")})` : uniquePatterns[0];
  return {
    $regex: pattern,
    $options: "i"
  };
}

function computeRelevanceScore(product, term) {
  let score = 0;
  const name = String(product?.name || "").toLowerCase();
  const desc = String(product?.description || "").toLowerCase();
  const brand = String(product?.brand || "").toLowerCase();
  const tags = Array.isArray(product?.tags) ? product.tags.map(t => String(t).toLowerCase()) : [];

  // Exact name match
  if (name === term) score += 100;
  // Name starts with term
  else if (name.startsWith(term)) score += 60;
  // Name contains full term
  else if (name.includes(term)) score += 40;

  const words = term.split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (name.includes(w)) score += 20;
    if (tags.some(t => t.includes(w))) score += 15;
    if (brand.includes(w)) score += 10;
    if (desc.includes(w)) score += 5;
  }

  return score;
}

import { slugify } from "../utils/slugify.js";
import getPagination from "../utils/pagination.js";
import {
  parseCustomerCoordinates,
  getNearbySellerIdsForCustomer,
  getProductWarehouseAvailability,
} from "../services/customerVisibilityService.js";
import {
  enqueueProductIndex,
  enqueueProductRemoval,
} from "../services/searchSyncService.js";
import { buildKey, getOrSet, getTTL, invalidate } from "../services/cacheService.js";
import { uploadToCloudinary } from "../services/mediaService.js";
import logger from "../services/logger.js";
import { resolveCategoryName, resolveSellerName } from "../services/entityNameCache.js";
import {
  PRODUCT_APPROVAL_STATUS,
  getProductApprovalConfig,
  getApprovedOrLegacyFilter,
  buildApprovalStatusFilter,
  normalizeProductModerationFields,
  sanitizeApprovalNote,
  resolveProductApprovalStatus,
} from "../services/productModerationService.js";
import { buildSearchRegex } from "../utils/regex.js";
import { resolveAdminStore } from "../utils/storeResolver.js";

// Phase 3 P3-5: when search term is reasonably specific and the env flag
// is enabled, prefer Mongo's `name + tags` text index over case-insensitive
// regex. Default OFF — keeps existing substring-search semantics so the
// behavior of the customer-facing search bar is unchanged unless explicitly
// opted in by ops.
function isProductTextSearchEnabled() {
  return (
    String(process.env.PRODUCT_SEARCH_USE_TEXT || "false").toLowerCase() === "true"
  );
}

function buildProductListKey(queryParams) {
  const sorted = Object.keys(queryParams)
    .sort()
    .reduce((acc, k) => {
      acc[k] = String(queryParams[k] ?? "").trim().toLowerCase();
      return acc;
    }, {});
  return buildKey("catalog", "productList", JSON.stringify(sorted));
}

function isCustomerVisibilityRequest(req) {
  // If explicitly requesting all products (management / warehouse / admin / catalog selection)
  if (req.query?.scope === "all" || req.query?.status === "all" || req.query?.all === "true") {
    return false;
  }
  const role = String(req.user?.role || "").toLowerCase();
  // Admin, seller, warehouse and delivery should not be subject to location filtering
  if (role === "admin" || role === "seller" || role === "warehouse" || role === "delivery") {
    return false;
  }
  return true;
}

function parseSellerIdFilters({ sellerId, sellerIds }) {
  if (typeof sellerIds === "string" && sellerIds.trim()) {
    return sellerIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map(String);
  }

  if (sellerId) {
    return [String(sellerId)];
  }

  return [];
}

function makeProductSku(name, index = 1) {
  const prefix = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5) || "item";
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix.toUpperCase()}-${String(index).padStart(2, "0")}-${randomSuffix}`;
}

async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug || "product";
  let count = 0;
  while (true) {
    const candidate = count === 0 ? slug : `${slug}-${count}`;
    const query = { slug: candidate };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const exists = await Product.exists(query);
    if (!exists) {
      return candidate;
    }
    count++;
  }
}

async function ensureUniqueSku(baseSku, excludeId = null) {
  let sku = String(baseSku || "").trim();
  if (!sku) {
    sku = `ITEM-${Date.now().toString(36).toUpperCase()}`;
  }
  let count = 0;
  while (true) {
    const candidate = count === 0 ? sku : `${sku}-${count}`;
    const query = { sku: candidate };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const exists = await Product.exists(query);
    if (!exists) {
      return candidate;
    }
    count++;
  }
}

function parseJsonIfString(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized) || /^data:image\//i.test(normalized) || normalized.startsWith("/")) {
    return normalized;
  }
  return "";
}

function parseImageList(input) {
  const candidate = parseJsonIfString(input);
  if (Array.isArray(candidate)) {
    return candidate.map((item) => normalizeUrl(item)).filter(Boolean);
  }
  if (typeof candidate === "string" && candidate.includes(",")) {
    return candidate
      .split(",")
      .map((item) => normalizeUrl(item))
      .filter(Boolean);
  }
  const single = normalizeUrl(candidate);
  return single ? [single] : [];
}

function applyMediaFields(productData) {
  const explicitMainImage = normalizeUrl(productData.mainImage || productData.mainImageUrl);
  const galleryImages = parseImageList(productData.galleryImages);
  const genericImages = parseImageList(productData.images);

  const mergedGallery = [...galleryImages, ...genericImages].filter(Boolean);
  if (explicitMainImage) {
    productData.mainImage = explicitMainImage;
  } else if (mergedGallery.length > 0) {
    productData.mainImage = mergedGallery[0];
    mergedGallery.shift();
  }

  if (mergedGallery.length > 0) {
    productData.galleryImages = mergedGallery;
  } else if (!Array.isArray(productData.galleryImages)) {
    productData.galleryImages = [];
  }
}

const RESTRICTED_MODERATION_FIELDS = [
  "approvalStatus",
  "approvalRequestedAt",
  "approvalReviewedAt",
  "approvalReviewedBy",
  "approvalNote",
  "lastSubmittedByRole",
];

function stripRestrictedModerationFields(payload = {}) {
  for (const field of RESTRICTED_MODERATION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      delete payload[field];
    }
  }
}

function sanitizeProductPayload(productData) {
  // Sanitize ObjectId fields: convert empty strings, 'null', 'undefined' to null or delete
  const nullableIdFields = ["subcategoryId", "sellerId", "warehouseId"];
  for (const field of nullableIdFields) {
    if (productData[field] !== undefined) {
      const val = String(productData[field] || "").trim();
      if (!val || val === "null" || val === "undefined") {
        productData[field] = null;
      }
    }
  }

  const requiredIdFields = ["headerId", "categoryId"];
  for (const field of requiredIdFields) {
    if (productData[field] !== undefined) {
      const val = String(productData[field] || "").trim();
      if (!val || val === "null" || val === "undefined") {
        delete productData[field];
      }
    }
  }

  // Sanitize numeric fields
  if (productData.price !== undefined && productData.price !== "") {
    productData.price = Number(productData.price) || 0;
  }
  if (productData.salePrice !== undefined && productData.salePrice !== "") {
    productData.salePrice = Number(productData.salePrice) || 0;
  }
  if (productData.stock !== undefined && productData.stock !== "") {
    productData.stock = Number(productData.stock) || 0;
  }
  if (productData.lowStockAlert !== undefined && productData.lowStockAlert !== "") {
    productData.lowStockAlert = Number(productData.lowStockAlert) || 5;
  }
  if (productData.shelfLife !== undefined) {
    productData.shelfLife = String(productData.shelfLife || "").trim();
  }

  // Sanitize variants
  if (Array.isArray(productData.variants)) {
    productData.variants = productData.variants
      .filter((v) => v && typeof v === "object")
      .map((v) => ({
        name: String(v.name || "Default").trim(),
        price: Number(v.price) || 0,
        salePrice: Number(v.salePrice) || 0,
        stock: Number(v.stock) || 0,
        sku: v?.sku && String(v.sku).trim() ? String(v.sku).trim() : undefined,
      }));
  }

  // Sanitize highlights
  if (Array.isArray(productData.highlights)) {
    productData.highlights = productData.highlights
      .filter((h) => h && (h.icon || h.label))
      .map((h) => ({
        icon: String(h.icon || "").trim(),
        label: String(h.label || "").trim(),
      }));
  }
}

function normalizeProductDocumentModeration(product) {
  if (!product) return product;
  return normalizeProductModerationFields(product);
}

function normalizeProductListModeration(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => normalizeProductDocumentModeration(item));
}

function buildSellerPendingModerationUpdate() {
  return {
    approvalStatus: PRODUCT_APPROVAL_STATUS.PENDING,
    approvalRequestedAt: new Date(),
    approvalReviewedAt: null,
    approvalReviewedBy: null,
    approvalNote: "",
    lastSubmittedByRole: "seller",
  };
}

function buildSellerApprovedModerationUpdate() {
  return {
    approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
    approvalRequestedAt: null,
    approvalReviewedAt: null,
    approvalReviewedBy: null,
    approvalNote: "",
    lastSubmittedByRole: "seller",
  };
}

function buildAdminApprovedModerationUpdate(adminId, note = "") {
  return {
    approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
    approvalRequestedAt: null,
    approvalReviewedAt: new Date(),
    approvalReviewedBy: adminId || null,
    approvalNote: sanitizeApprovalNote(note),
    lastSubmittedByRole: "admin",
  };
}

function buildAdminRejectedModerationUpdate(adminId, note = "") {
  return {
    approvalStatus: PRODUCT_APPROVAL_STATUS.REJECTED,
    approvalRequestedAt: null,
    approvalReviewedAt: new Date(),
    approvalReviewedBy: adminId || null,
    approvalNote: sanitizeApprovalNote(note),
    lastSubmittedByRole: "admin",
  };
}

/* ===============================
   GET ALL PRODUCTS (Public/Admin)
================================ */
export const getProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      subcategory,
      header,
      status,
      approvalStatus,
      sellerId,
      featured,
      categoryId,
      subcategoryId,
      headerId,
      categoryIds,
      sellerIds,
      sort,
      lat,
      lng,
    } = req.query;
    const enforceRadius = isCustomerVisibilityRequest(req);

    const query = {};
    if (search) {
      const term = String(search).trim();
      if (term) {
        if (isProductTextSearchEnabled() && term.length >= 3) {
          query.$text = { $search: term };
        } else {
          const cleanTerm = term.toLowerCase().trim();
          const originalWords = term.split(/\s+/).filter(Boolean);

          const wordClauses = originalWords.map((word) => {
            const regex = buildSearchRegexWithSynonyms(word);
            return {
              $or: [
                { name: regex },
                { tags: regex },
                { description: regex },
                { brand: regex },
                { "variants.name": regex },
                { weight: regex }
              ]
            };
          });

          const fullTermRegex = buildSearchRegexWithSynonyms(cleanTerm);
          const fullTermClause = {
            $or: [
              { name: fullTermRegex },
              { tags: fullTermRegex },
              { description: fullTermRegex },
              { brand: fullTermRegex },
              { "variants.name": fullTermRegex }
            ]
          };

          const orClauses = [fullTermClause];
          if (wordClauses.length > 1) {
            orClauses.push({ $and: wordClauses });
          }

          // English translation fallback if different
          const englishTerm = await translateToEnglish(term);
          if (englishTerm && englishTerm.toLowerCase() !== cleanTerm) {
            const engRegex = buildSearchRegexWithSynonyms(englishTerm);
            orClauses.push({
              $or: [
                { name: engRegex },
                { tags: engRegex },
                { description: engRegex }
              ]
            });
          }

          query.$or = orClauses;
        }
      }
    }

    // Support both field names for flexibility (backward compatibility)
    const finalHeaderId = header || headerId;
    const finalCategoryId = category || categoryId;
    const finalSubcategoryId = subcategory || subcategoryId;

    if (finalHeaderId && finalHeaderId !== "all") query.headerId = finalHeaderId;
    if (finalCategoryId && finalCategoryId !== "all") query.categoryId = finalCategoryId;
    if (finalSubcategoryId && finalSubcategoryId !== "all") query.subcategoryId = finalSubcategoryId;

    const requestedSellerIds = parseSellerIdFilters({ sellerId, sellerIds });
    if (requestedSellerIds.length > 0) {
      query.sellerId = { $in: requestedSellerIds };
    }

    if (categoryIds && typeof categoryIds === "string") {
      const ids = categoryIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id && id !== "all");
      if (ids.length) query.categoryId = { $in: ids };
    }
    // Multiple sellers: sellerIds=id1,id2 (or single sellerId)
    if (!query.sellerId) {
      if (sellerIds && typeof sellerIds === "string") {
        const ids = sellerIds
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id && id !== "all");
        if (ids.length) query.sellerId = { $in: ids };
      } else if (sellerId) {
        query.sellerId = sellerId;
      }
    }

    if (featured !== undefined) query.isFeatured = featured === "true";

    let finalQuery = { ...query };
    if (enforceRadius) {
      finalQuery.status = "active";
      finalQuery = { $and: [finalQuery, getApprovedOrLegacyFilter()] };
    } else {
      if (status && status !== "all") {
        finalQuery.status = status;
      }
      if (approvalStatus && String(approvalStatus).trim().toLowerCase() !== "all") {
        const moderationFilter = buildApprovalStatusFilter(approvalStatus);
        if (Object.keys(moderationFilter).length > 0) {
          finalQuery = { $and: [finalQuery, moderationFilter] };
        }
      }
    }

    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 24,
      maxLimit: 100,
    });

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "name-asc": { name: 1, createdAt: -1 },
      "name-desc": { name: -1, createdAt: -1 },
      "price-asc": { price: 1, createdAt: -1 },
      "price-desc": { price: -1, createdAt: -1 },
      "stock-asc": { stock: 1, createdAt: -1 },
      "stock-desc": { stock: -1, createdAt: -1 },
    };
    const sortQuery = sortMap[String(sort || "newest").toLowerCase()] || sortMap.newest;

    const fetchFn = async () => {
      const [rawProducts, total] = await Promise.all([
        Product.find(finalQuery)
          .select(
            "name slug description sku price salePrice stock brand weight shelfLife mainImage galleryImages headerId categoryId subcategoryId sellerId status approvalStatus approvalRequestedAt approvalReviewedAt approvalReviewedBy approvalNote lastSubmittedByRole isFeatured variants createdAt",
          )
          // No .populate() — names resolved via cache-backed entityNameCache
          .sort(sortQuery)
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(finalQuery),
      ]);

      // Collect unique category IDs (headerId, categoryId, subcategoryId) and seller IDs
      const categoryIdSet = new Set();
      const sellerIdSet = new Set();
      for (const p of rawProducts) {
        if (p.headerId) categoryIdSet.add(String(p.headerId));
        if (p.categoryId) categoryIdSet.add(String(p.categoryId));
        if (p.subcategoryId) categoryIdSet.add(String(p.subcategoryId));
        if (p.sellerId) sellerIdSet.add(String(p.sellerId));
      }

      // Resolve names in parallel via cache-backed service
      const [categoryEntries, sellerEntries] = await Promise.all([
        Promise.all(
          [...categoryIdSet].map(async (id) => [id, await resolveCategoryName(id)]),
        ),
        Promise.all(
          [...sellerIdSet].map(async (id) => [id, await resolveSellerName(id)]),
        ),
      ]);

      const nameMap = Object.fromEntries([...categoryEntries, ...sellerEntries]);

      // Query warehouse stock availability in batch for all products in this page
      const productIds = rawProducts.map((p) => p._id);
      const availabilityMap = await getProductWarehouseAvailability(productIds);

      // Enrich products to match the shape previously returned by .populate()
      const products = rawProducts.map((p) => {
        const pIdStr = String(p._id);
        const availability = availabilityMap.get(pIdStr);
        const effectiveStock = availability ? availability.availableStock : (p.stock ?? 0);
        const stockStatus = availability
          ? availability.stockStatus
          : effectiveStock <= 0
          ? "out_of_stock"
          : effectiveStock <= (p.lowStockAlert || 5)
          ? "low_stock"
          : "in_stock";

        return {
          ...p,
          stock: effectiveStock,
          availableStock: effectiveStock,
          stockStatus,
          isAvailable: effectiveStock > 0,
          isOutOfStock: effectiveStock <= 0,
          headerId: p.headerId
            ? { _id: p.headerId, name: nameMap[String(p.headerId)] ?? null }
            : null,
          categoryId: p.categoryId
            ? { _id: p.categoryId, name: nameMap[String(p.categoryId)] ?? null }
            : null,
          subcategoryId: p.subcategoryId
            ? { _id: p.subcategoryId, name: nameMap[String(p.subcategoryId)] ?? null }
            : null,
          sellerId: p.sellerId
            ? { _id: p.sellerId, shopName: nameMap[String(p.sellerId)] ?? null }
            : null,
        };
      });

      if (search && (!sort || String(sort).toLowerCase() === "newest")) {
        const cleanSearch = String(search).trim().toLowerCase();
        products.sort((a, b) => {
          const scoreA = computeRelevanceScore(a, cleanSearch);
          const scoreB = computeRelevanceScore(b, cleanSearch);
          return scoreB - scoreA;
        });
      }

      return {
        items: normalizeProductListModeration(products),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      };
    };

    const role = String(req.user?.role || "").toLowerCase();
    const shouldCache = !role || (role !== "admin" && role !== "seller" && role !== "warehouse");

    const result = shouldCache
      ? await getOrSet(buildProductListKey(req.query), fetchFn, getTTL("productList"))
      : await fetchFn();

    return handleResponse(res, 200, "Products fetched successfully", result);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SELLER PRODUCTS
================================ */
export const getSellerProducts = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { stockStatus, sort, approvalStatus } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const baseSellerQuery = { sellerId };
    const query = { ...baseSellerQuery };
    if (stockStatus === "in") {
      query.stock = { $gt: 0 };
    } else if (stockStatus === "out") {
      query.stock = 0;
    }

    if (approvalStatus && String(approvalStatus).trim().toLowerCase() !== "all") {
      const approvalFilter = buildApprovalStatusFilter(approvalStatus);
      if (Object.keys(approvalFilter).length > 0) {
        Object.assign(query, approvalFilter);
      }
    }

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "name-asc": { name: 1, createdAt: -1 },
      "name-desc": { name: -1, createdAt: -1 },
      "price-asc": { price: 1, createdAt: -1 },
      "price-desc": { price: -1, createdAt: -1 },
      "stock-asc": { stock: 1, createdAt: -1 },
      "stock-desc": { stock: -1, createdAt: -1 },
    };
    const sortQuery = sortMap[String(sort || "newest").toLowerCase()] || sortMap.newest;

    const [
      products,
      total,
      totalAll,
      activeCount,
      lowStockCount,
      outOfStockCount,
      pendingCount,
      approvedCount,
      rejectedCount,
    ] = await Promise.all([
      Product.find(query)
        .select(
          "name slug description sku price salePrice stock lowStockAlert brand weight shelfLife mainImage galleryImages headerId categoryId subcategoryId sellerId status approvalStatus approvalRequestedAt approvalReviewedAt approvalReviewedBy approvalNote lastSubmittedByRole isFeatured variants createdAt",
        )
        .populate("headerId", "name")
        .populate("categoryId", "name")
        .populate("subcategoryId", "name")
        .populate("sellerId", "shopName")
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
      Product.countDocuments(baseSellerQuery),
      Product.countDocuments({ ...baseSellerQuery, status: "active" }),
      Product.countDocuments({
        ...baseSellerQuery,
        $expr: {
          $and: [
            {
              $gt: [
                {
                  $convert: {
                    input: "$stock",
                    to: "double",
                    onError: 0,
                    onNull: 0,
                  },
                },
                0,
              ],
            },
            {
              $lte: [
                {
                  $convert: {
                    input: "$stock",
                    to: "double",
                    onError: 0,
                    onNull: 0,
                  },
                },
                {
                  $let: {
                    vars: {
                      rawThreshold: {
                        $convert: {
                          input: "$lowStockAlert",
                          to: "double",
                          onError: 0,
                          onNull: 0,
                        },
                      },
                    },
                    in: {
                      $cond: [{ $gt: ["$$rawThreshold", 0] }, "$$rawThreshold", 5],
                    },
                  },
                },
              ],
            },
          ],
        },
      }),
      Product.countDocuments({ ...baseSellerQuery, stock: 0 }),
      Product.countDocuments({
        ...baseSellerQuery,
        approvalStatus: PRODUCT_APPROVAL_STATUS.PENDING,
      }),
      Product.countDocuments({
        ...baseSellerQuery,
        $and: [
          { ...baseSellerQuery },
          buildApprovalStatusFilter(PRODUCT_APPROVAL_STATUS.APPROVED),
        ],
      }),
      Product.countDocuments({
        ...baseSellerQuery,
        approvalStatus: PRODUCT_APPROVAL_STATUS.REJECTED,
      }),
    ]);

    return handleResponse(res, 200, "Seller products fetched", {
      items: normalizeProductListModeration(products),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      summary: {
        total: totalAll,
        active: activeCount,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   CREATE PRODUCT
================================ */
export const createProduct = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const productData = { ...req.body };
    stripRestrictedModerationFields(productData);

    if (role === "admin") {
      // Single-vendor model: Admin is the sole seller.
      // sellerId is optional — if provided (e.g. legacy store), use it; otherwise leave null.
      if (!productData.sellerId || productData.sellerId === "null" || productData.sellerId === "undefined") {
        const storeId = await resolveAdminStore();
        if (storeId) {
          productData.sellerId = storeId;
        } else {
          productData.sellerId = null;
        }
      }
    } else if (role === "warehouse") {
      // Warehouse-created products: set the warehouse ID for backward compatibility
      if (!productData.sellerId || productData.sellerId === "null" || productData.sellerId === "undefined") {
        productData.sellerId = req.user.id;
      }
    } else {
      productData.sellerId = req.user.id;
    }

    // Handle multipart files (mainImage and galleryImages)
    const files = req.files || [];
    if (files.length > 0) {
      const galleryUrls = [];
      for (const file of files) {
        try {
          if (file.fieldname === "mainImage") {
            const url = await uploadToCloudinary(file.buffer, "products", {
              mimeType: file.mimetype,
              resourceType: "image",
            });
            productData.mainImage = url;
          } else if (file.fieldname === "galleryImages") {
            const url = await uploadToCloudinary(file.buffer, "products", {
              mimeType: file.mimetype,
              resourceType: "image",
            });
            galleryUrls.push(url);
          }
        } catch (err) {
          logger.error("Cloudinary upload failed", {
            scope: "createProduct",
            error: err,
          });
        }
      }
      if (galleryUrls.length > 0) {
        productData.galleryImages = galleryUrls;
      }
    }

    // Parse JSON fields if they come as strings from FormData
    if (typeof productData.variants === "string") {
      try {
        productData.variants = JSON.parse(productData.variants);
      } catch (e) {
        productData.variants = [];
      }
    }
    if (typeof productData.tags === "string" && productData.tags.startsWith("[")) {
      try {
        productData.tags = JSON.parse(productData.tags);
      } catch (e) {
        // Not JSON, keep as is
      }
    }
    if (typeof productData.highlights === "string") {
      try {
        productData.highlights = JSON.parse(productData.highlights);
      } catch (e) {
        productData.highlights = [];
      }
    }

    // Clean and sanitize all types and ObjectId references
    sanitizeProductPayload(productData);

    if (!productData.name || !String(productData.name).trim()) {
      return handleResponse(res, 400, "Product name is required");
    }
    
    // Auto-generate unique slug
    const baseSlug = slugify(productData.slug || productData.name) || "product";
    productData.slug = await ensureUniqueSlug(baseSlug);

    productData.description =
      typeof productData.description === "string"
        ? productData.description.trim()
        : productData.description || "";

    // Auto-generate and guarantee unique product SKU
    const baseSku = productData.sku && String(productData.sku).trim()
      ? String(productData.sku).trim()
      : makeProductSku(productData.name, 1);
    productData.sku = await ensureUniqueSku(baseSku);

    applyMediaFields(productData);

    // Handle tags if string
    if (typeof productData.tags === "string") {
      productData.tags = productData.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    }

    // Handle variants if string (multipart/form-data sends as string)
    if (typeof productData.variants === "string") {
      try {
        productData.variants = JSON.parse(productData.variants);
      } catch (e) {
        productData.variants = [];
      }
    }

    if (Array.isArray(productData.variants)) {
      productData.variants = productData.variants.map((variant, idx) => ({
        ...variant,
        sku:
          variant?.sku && String(variant.sku).trim()
            ? String(variant.sku).trim()
            : makeProductSku(productData.name, idx + 1),
      }));
    }

    let moderationUpdate = {};
    let successMessage = "Product created successfully";

    if (role === "admin") {
      moderationUpdate = buildAdminApprovedModerationUpdate(req.user?.id || null);
    } else {
      const approvalConfig = await getProductApprovalConfig();
      if (approvalConfig.sellerCreateRequiresApproval) {
        moderationUpdate = buildSellerPendingModerationUpdate();
        successMessage = "Product submitted for admin approval";
      } else {
        moderationUpdate = buildSellerApprovedModerationUpdate();
      }
    }
    Object.assign(productData, moderationUpdate);

    const product = await Product.create(productData);
    
    if (product && product._id) {
      // Enqueue search indexing asynchronously
      await enqueueProductIndex(product._id.toString());
      await invalidate(buildKey("catalog", "product", product._id.toString()));
      await invalidate(`cache:catalog:product:${product._id.toString()}`);
    }

    try {
      await invalidate(buildKey("catalog", "productList", "*"));
      await invalidate(buildKey("catalog", "categories", "*"));
      await invalidate(buildKey("offersections", "public", "*"));
      await invalidate("cache:offersections:public:*");
      await invalidate(buildKey("experience", "public", "*"));
      await invalidate(buildKey("experience", "hero", "*"));
    } catch (cacheErr) {
      logger.error("Cache invalidation error", {
        scope: "createProduct",
        error: cacheErr,
      });
    }

    return handleResponse(
      res,
      201,
      successMessage,
      normalizeProductDocumentModeration(product?.toObject?.() || product),
    );
  } catch (error) {
    logger.error("Create Product Error", { scope: "createProduct", error: error.message, stack: error.stack });
    if (error.name === "ValidationError") {
      return handleResponse(
        res,
        400,
        Object.values(error.errors || {})
          .map((e) => e.message)
          .join(", ") || error.message,
      );
    }
    if (error.name === "CastError") {
      return handleResponse(res, 400, `Invalid ${error.path}: ${error.value}`);
    }
    if (error.code === 11000) {
      return handleResponse(res, 400, "Slug or SKU already exists");
    }
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   UPDATE PRODUCT
================================ */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;
    const role = String(req.user.role || "").toLowerCase();
    const productData = { ...req.body };
    stripRestrictedModerationFields(productData);
    if (Object.prototype.hasOwnProperty.call(productData, "sellerId")) {
      delete productData.sellerId;
    }

    // Handle multipart files (mainImage and galleryImages)
    const files = req.files || [];
    let galleryUrls = [];
    if (files.length > 0) {
      for (const file of files) {
        try {
          if (file.fieldname === "mainImage") {
            const url = await uploadToCloudinary(file.buffer, "products", {
              mimeType: file.mimetype,
              resourceType: "image",
            });
            productData.mainImage = url;
          } else if (file.fieldname === "galleryImages") {
            const url = await uploadToCloudinary(file.buffer, "products", {
              mimeType: file.mimetype,
              resourceType: "image",
            });
            galleryUrls.push(url);
          }
        } catch (err) {
          logger.error("Cloudinary upload failed during update", {
            scope: "updateProduct",
            error: err,
          });
        }
      }
    }

    // Parse JSON fields
    if (typeof productData.variants === "string") {
      try {
        productData.variants = JSON.parse(productData.variants);
      } catch (e) {
        productData.variants = [];
      }
    }
    if (typeof productData.tags === "string" && productData.tags.startsWith("[")) {
      try {
        productData.tags = JSON.parse(productData.tags);
      } catch (e) {
        // Not JSON, keep as is
      }
    }
    if (typeof productData.highlights === "string") {
      try {
        productData.highlights = JSON.parse(productData.highlights);
      } catch (e) {
        productData.highlights = [];
      }
    }

    // Clean and sanitize all types and ObjectId references
    sanitizeProductPayload(productData);

    // Admin bypasses sellerId check
    const query = role === "admin" ? { _id: id } : { _id: id, sellerId };
    const product = await Product.findOne(query);

    if (!product) {
      return handleResponse(res, 404, "Product not found or unauthorized");
    }

    if (galleryUrls.length > 0) {
      let existingGallery = [];
      if (productData.galleryImages !== undefined) {
        existingGallery = Array.isArray(productData.galleryImages)
          ? productData.galleryImages
          : (typeof productData.galleryImages === "string"
              ? productData.galleryImages.split(",")
              : [productData.galleryImages]);
      } else {
        existingGallery = product.galleryImages || [];
      }
      productData.galleryImages = [...existingGallery, ...galleryUrls];
    }

    if (productData.name) {
      const baseSlug = slugify(productData.slug || productData.name) || "product";
      productData.slug = await ensureUniqueSlug(baseSlug, id);
    } else if (productData.slug) {
      productData.slug = await ensureUniqueSlug(slugify(productData.slug), id);
    }

    if (productData.description !== undefined) {
      productData.description =
        typeof productData.description === "string"
          ? productData.description.trim()
          : productData.description || "";
    }

    const skuBaseName = productData.name || product.name;
    if (productData.sku && String(productData.sku).trim() !== "") {
      productData.sku = await ensureUniqueSku(productData.sku, id);
    } else if (!product.sku) {
      productData.sku = await ensureUniqueSku(makeProductSku(skuBaseName, 1), id);
    }
    if (productData.mainImage === undefined && product.mainImage) {
      productData.mainImage = product.mainImage;
    }

    applyMediaFields(productData);

    if (typeof productData.tags === "string") {
      productData.tags = productData.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    }

    if (Array.isArray(productData.variants)) {
      productData.variants = productData.variants.map((variant, idx) => ({
        ...variant,
        sku:
          variant?.sku && String(variant.sku).trim()
            ? String(variant.sku).trim()
            : makeProductSku(skuBaseName, idx + 1),
      }));
    }

    let moderationUpdate = {};
    let successMessage = "Product updated successfully";

    if (role === "admin") {
      moderationUpdate = buildAdminApprovedModerationUpdate(req.user?.id || null);
    } else {
      const approvalConfig = await getProductApprovalConfig();
      if (approvalConfig.sellerEditRequiresApproval) {
        moderationUpdate = buildSellerPendingModerationUpdate();
        successMessage = "Product changes submitted for admin approval";
      } else {
        moderationUpdate = buildSellerApprovedModerationUpdate();
      }
    }
    Object.assign(productData, moderationUpdate);

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: productData },
      { new: true, runValidators: true },
    );
    
    // Enqueue search indexing asynchronously
    await enqueueProductIndex(id);
    await invalidate(buildKey("catalog", "product", id));
    await invalidate(`cache:catalog:product:${id}`);

    try {
      await invalidate(buildKey("catalog", "productList", "*"));
      await invalidate(buildKey("catalog", "categories", "*"));
      await invalidate(buildKey("offersections", "public", "*"));
      await invalidate("cache:offersections:public:*");
      await invalidate(buildKey("experience", "public", "*"));
      await invalidate(buildKey("experience", "hero", "*"));
    } catch (cacheErr) {
      logger.error("Cache invalidation error", {
        scope: "updateProduct",
        error: cacheErr,
      });
    }

    return handleResponse(
      res,
      200,
      successMessage,
      normalizeProductDocumentModeration(updatedProduct?.toObject?.() || updatedProduct),
    );
  } catch (error) {
    logger.error("Update Product Error", { scope: "updateProduct", error: error.message, stack: error.stack });
    if (error.name === "ValidationError") {
      return handleResponse(
        res,
        400,
        Object.values(error.errors || {})
          .map((e) => e.message)
          .join(", ") || error.message,
      );
    }
    if (error.name === "CastError") {
      return handleResponse(res, 400, `Invalid ${error.path}: ${error.value}`);
    }
    if (error.code === 11000) {
      return handleResponse(res, 400, "Slug or SKU already exists");
    }
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   DELETE PRODUCT
================================ */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;
    const role = req.user.role;

    const query = role === "admin" ? { _id: id } : { _id: id, sellerId };
    const product = await Product.findOneAndDelete(query);

    if (!product) {
      return handleResponse(res, 404, "Product not found or unauthorized");
    }
    
    // Enqueue search index removal asynchronously
    await enqueueProductRemoval(id);
    await invalidate(buildKey("catalog", "product", id));
    await invalidate(`cache:catalog:product:${id}`);

    try {
      await invalidate(buildKey("catalog", "productList", "*"));
      await invalidate(buildKey("catalog", "categories", "*"));
      await invalidate(buildKey("offersections", "public", "*"));
      await invalidate("cache:offersections:public:*");
      await invalidate(buildKey("experience", "public", "*"));
      await invalidate(buildKey("experience", "hero", "*"));
    } catch (cacheErr) {
      logger.error("Cache invalidation error", {
        scope: "deleteProduct",
        error: cacheErr,
      });
    }

    return handleResponse(res, 200, "Product deleted successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   DELETE ALL PRODUCTS (ADMIN / SELLER)
================================ */
export const deleteAllProducts = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const role = req.user.role;

    const query = role === "admin" ? {} : { sellerId };
    const productsToDelete = await Product.find(query).select("_id");
    const ids = productsToDelete.map((p) => String(p._id));

    if (ids.length === 0) {
      return handleResponse(res, 200, "No products found to delete", { deletedCount: 0 });
    }

    const result = await Product.deleteMany(query);

    // Enqueue search index removal and invalidate caches for all deleted products
    await Promise.allSettled(
      ids.map(async (id) => {
        try {
          await enqueueProductRemoval(id);
          await invalidate(buildKey("catalog", "product", id));
          await invalidate(`cache:catalog:product:${id}`);
        } catch (e) {
          // continue
        }
      })
    );

    try {
      await invalidate(buildKey("catalog", "productList", "*"));
      await invalidate(buildKey("catalog", "categories", "*"));
      await invalidate(buildKey("offersections", "public", "*"));
      await invalidate("cache:offersections:public:*");
      await invalidate(buildKey("experience", "public", "*"));
      await invalidate(buildKey("experience", "hero", "*"));
    } catch (cacheErr) {
      logger.error("Cache invalidation error", {
        scope: "deleteAllProducts",
        error: cacheErr,
      });
    }

    return handleResponse(res, 200, `Successfully deleted ${result.deletedCount || ids.length} products`, {
      deletedCount: result.deletedCount || ids.length,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SINGLE PRODUCT
================================ */
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const enforceRadius = isCustomerVisibilityRequest(req);

    const cacheKey = buildKey("catalog", "product", id);
    const product = await getOrSet(
      cacheKey,
      async () =>
        Product.findById(id)
          .select(
            "name slug description sku price salePrice stock lowStockAlert brand weight shelfLife mainImage galleryImages headerId categoryId subcategoryId sellerId warehouseId isMonthlyKit status approvalStatus approvalRequestedAt approvalReviewedAt approvalReviewedBy approvalNote lastSubmittedByRole isFeatured variants createdAt",
          )
          .populate("headerId", "name")
          .populate("categoryId", "name")
          .populate("subcategoryId", "name")
          .populate("sellerId", "shopName")
          .lean(),
      getTTL("product"),
    );

    if (!product) {
      return handleResponse(res, 404, "Product not found");
    }

    if (enforceRadius) {
      const approvalState = resolveProductApprovalStatus(product);
      if (product.status !== "active" || approvalState !== PRODUCT_APPROVAL_STATUS.APPROVED) {
        return handleResponse(res, 404, "Product not found");
      }
    }

    // Enrich single product with warehouse stock availability
    const singleAvailabilityMap = await getProductWarehouseAvailability([product._id]);
    const singleAvail = singleAvailabilityMap.get(String(product._id));
    const effectiveSingleStock = singleAvail ? singleAvail.availableStock : (product.stock ?? 0);

    const payload = normalizeProductDocumentModeration(product);
    payload.stock = effectiveSingleStock;
    payload.availableStock = effectiveSingleStock;
    payload.stockStatus = singleAvail
      ? singleAvail.stockStatus
      : effectiveSingleStock <= 0
      ? "out_of_stock"
      : effectiveSingleStock <= (product.lowStockAlert || 5)
      ? "low_stock"
      : "in_stock";
    payload.isAvailable = effectiveSingleStock > 0;
    payload.isOutOfStock = effectiveSingleStock <= 0;
    
    if (req.user) {
        const userId = req.user.id;
        const purchase = await Order.findOne({
            customer: userId,
            "items.product": id,
            $or: [
                { orderStatus: { $regex: /^delivered$/i } },
                { status: { $regex: /^delivered$/i } }
            ]
        });
        payload.hasPurchased = !!purchase;

        const existingReview = await Review.findOne({
            userId,
            productId: id
        });
        payload.hasReviewed = !!existingReview;
    }

    return handleResponse(
      res,
      200,
      "Product details fetched",
      payload,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   ADMIN MODERATION LIST
================================ */
export const getModerationProducts = async (req, res) => {
  try {
    const {
      approvalStatus = "all",
      status = "all",
      search = "",
      sellerId,
      category,
      categoryId,
      subcategory,
      subcategoryId,
      header,
      headerId,
      sort = "newest",
    } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const baseQuery = {};
    if (status && status !== "all") {
      baseQuery.status = status;
    }
    if (sellerId && sellerId !== "all") {
      baseQuery.sellerId = sellerId;
    }

    const finalHeaderId = header || headerId;
    const finalCategoryId = category || categoryId;
    const finalSubcategoryId = subcategory || subcategoryId;
    if (finalHeaderId && finalHeaderId !== "all") {
      baseQuery.headerId = finalHeaderId;
    }
    if (finalCategoryId && finalCategoryId !== "all") {
      baseQuery.categoryId = finalCategoryId;
    }
    if (finalSubcategoryId && finalSubcategoryId !== "all") {
      baseQuery.subcategoryId = finalSubcategoryId;
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      if (isProductTextSearchEnabled() && term.length >= 3) {
        baseQuery.$text = { $search: term };
      } else {
        // P3-5: same substring semantics, now safely escaped.
        const safe = buildSearchRegex(term, { anchored: false });
        baseQuery.$or = [
          { name: safe },
          { slug: safe },
          { sku: safe },
        ];
      }
    }

    let moderatedQuery = { ...baseQuery };
    const approvalFilter = buildApprovalStatusFilter(approvalStatus);
    if (Object.keys(approvalFilter).length > 0) {
      moderatedQuery = { $and: [moderatedQuery, approvalFilter] };
    }

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "name-asc": { name: 1, createdAt: -1 },
      "name-desc": { name: -1, createdAt: -1 },
      "price-asc": { price: 1, createdAt: -1 },
      "price-desc": { price: -1, createdAt: -1 },
    };
    const sortQuery = sortMap[String(sort || "newest").toLowerCase()] || sortMap.newest;

    const [items, total, allCount, pendingCount, approvedCount, rejectedCount] =
      await Promise.all([
        Product.find(moderatedQuery)
          .select(
            "name slug description sku price salePrice stock lowStockAlert brand weight shelfLife mainImage galleryImages headerId categoryId subcategoryId sellerId status approvalStatus approvalRequestedAt approvalReviewedAt approvalReviewedBy approvalNote lastSubmittedByRole isFeatured variants createdAt",
          )
          .populate("headerId", "name")
          .populate("categoryId", "name")
          .populate("subcategoryId", "name")
          .populate("sellerId", "shopName name")
          .populate("approvalReviewedBy", "name email")
          .sort(sortQuery)
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(moderatedQuery),
        Product.countDocuments(baseQuery),
        Product.countDocuments({
          ...baseQuery,
          approvalStatus: PRODUCT_APPROVAL_STATUS.PENDING,
        }),
        Product.countDocuments({
          $and: [
            { ...baseQuery },
            buildApprovalStatusFilter(PRODUCT_APPROVAL_STATUS.APPROVED),
          ],
        }),
        Product.countDocuments({
          ...baseQuery,
          approvalStatus: PRODUCT_APPROVAL_STATUS.REJECTED,
        }),
      ]);

    return handleResponse(res, 200, "Moderation products fetched", {
      items: normalizeProductListModeration(items),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      counts: {
        all: allCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   ADMIN MODERATION ACTIONS
================================ */
export const approveProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const note = req.body?.approvalNote ?? req.body?.note ?? "";
    const moderationUpdate = buildAdminApprovedModerationUpdate(
      req.user?.id || null,
      note,
    );

    const updated = await Product.findByIdAndUpdate(
      id,
      { $set: moderationUpdate },
      { new: true, runValidators: true },
    )
      .populate("headerId", "name")
      .populate("categoryId", "name")
      .populate("subcategoryId", "name")
      .populate("sellerId", "shopName name")
      .populate("approvalReviewedBy", "name email");

    if (!updated) {
      return handleResponse(res, 404, "Product not found");
    }

    await enqueueProductIndex(id);
    await invalidate(`cache:catalog:product:${id}`);
    await invalidate(buildKey("catalog", "productList", "*"));
    await invalidate("cache:offersections:public:*");

    return handleResponse(
      res,
      200,
      "Product approved successfully",
      normalizeProductDocumentModeration(updated?.toObject?.() || updated),
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const rejectProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const note = req.body?.approvalNote ?? req.body?.note ?? "";
    const moderationUpdate = buildAdminRejectedModerationUpdate(
      req.user?.id || null,
      note,
    );

    const updated = await Product.findByIdAndUpdate(
      id,
      { $set: moderationUpdate },
      { new: true, runValidators: true },
    )
      .populate("headerId", "name")
      .populate("categoryId", "name")
      .populate("subcategoryId", "name")
      .populate("sellerId", "shopName name")
      .populate("approvalReviewedBy", "name email");

    if (!updated) {
      return handleResponse(res, 404, "Product not found");
    }

    await enqueueProductIndex(id);
    await invalidate(`cache:catalog:product:${id}`);
    await invalidate(buildKey("catalog", "productList", "*"));
    await invalidate("cache:offersections:public:*");

    return handleResponse(
      res,
      200,
      "Product rejected successfully",
      normalizeProductDocumentModeration(updated?.toObject?.() || updated),
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
