import translate from 'google-translate-api-x';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map();

// Periodic cleanup of expired cache entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiry < now) {
      cache.delete(key);
    }
  }
}, 60 * 60 * 1000);

const getCacheKey = (text, sourceLang, targetLang) => {
  const base64Text = Buffer.from(text).toString('base64');
  return `${sourceLang || 'en'}_${targetLang}_${base64Text}`;
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const callWithRetry = async (fn, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await wait(delay);
    return callWithRetry(fn, retries - 1, delay * 2);
  }
};

export const translateText = async (text, targetLang, sourceLang = 'en') => {
  if (!text || typeof text !== 'string' || !text.trim()) return text;
  if (sourceLang === targetLang) return text;

  const key = getCacheKey(text, sourceLang, targetLang);
  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.value;
  }

  try {
    const fn = async () => {
      const res = await translate(text, {
        from: sourceLang,
        to: targetLang
      });
      return res?.text || text;
    };

    const translated = await callWithRetry(fn);
    
    if (translated && translated !== text) {
      cache.set(key, {
        value: translated,
        expiry: Date.now() + CACHE_TTL
      });
    }

    return translated || text;
  } catch (error) {
    console.error(`Translation error for text "${text}":`, error);
    return text;
  }
};

export const translateBatch = async (texts, targetLang, sourceLang = 'en') => {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  if (sourceLang === targetLang) return texts;

  const results = new Array(texts.length);
  const uncachedIndices = [];
  const uncachedTexts = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    if (!text || typeof text !== 'string' || !text.trim()) {
      results[i] = text;
      continue;
    }

    const key = getCacheKey(text, sourceLang, targetLang);
    const cached = cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      results[i] = cached.value;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(text);
    }
  }

  if (uncachedTexts.length === 0) {
    return results;
  }

  try {
    const fn = async () => {
      const res = await translate(uncachedTexts, {
        from: sourceLang,
        to: targetLang
      });
      const translations = Array.isArray(res) ? res.map(r => r.text) : [res.text];
      return translations;
    };

    const translatedBatch = await callWithRetry(fn);

    for (let i = 0; i < uncachedIndices.length; i++) {
      const idx = uncachedIndices[i];
      const original = uncachedTexts[i];
      const translated = translatedBatch[i] || original;

      results[idx] = translated;

      if (translated && translated !== original) {
        const key = getCacheKey(original, sourceLang, targetLang);
        cache.set(key, {
          value: translated,
          expiry: Date.now() + CACHE_TTL
        });
      }
    }
  } catch (error) {
    console.error("Batch translation error:", error);
    for (let i = 0; i < uncachedIndices.length; i++) {
      results[uncachedIndices[i]] = uncachedTexts[i];
    }
  }

  return results;
};

export const translateObject = async (obj, targetLang, sourceLang = 'en', keysToTranslate = []) => {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return await Promise.all(obj.map(item => translateObject(item, targetLang, sourceLang, keysToTranslate)));
  }

  const cloned = { ...obj };
  const pathsToTranslate = [];
  const textsToTranslate = [];

  for (const key of keysToTranslate) {
    if (cloned[key] && typeof cloned[key] === 'string') {
      pathsToTranslate.push(key);
      textsToTranslate.push(cloned[key]);
    }
  }

  if (textsToTranslate.length === 0) {
    return cloned;
  }

  const translatedTexts = await translateBatch(textsToTranslate, targetLang, sourceLang);

  for (let i = 0; i < pathsToTranslate.length; i++) {
    cloned[pathsToTranslate[i]] = translatedTexts[i];
  }

  return cloned;
};

