/**
 * URL ↔ içerik eşlemesi.
 *
 * Delivery `content-types` yanıtı her bölüm için hazır `paths` haritası verir
 * (`{ tr: '/urunler', en: '/en/products' }`), bu yüzden rota çözümü tahmin
 * yürütmeden, sunucunun söylediği yollarla yapılır.
 */

/** '/a/b/' → ['a','b'] */
export function toSegments(path) {
    if (Array.isArray(path)) return path.filter(Boolean).map(String);
    return String(path || '')
        .split('?')[0]
        .split('/')
        .filter(Boolean);
}

export function joinPath(...parts) {
    const path = parts
        .flatMap((p) => toSegments(p))
        .join('/');
    return `/${path}`.replace(/\/{2,}/g, '/');
}

/** Bölümün o dildeki yolu: `/urunler` · `/en/products` · ana sayfada `/` · `/en`. */
export function sectionPath(type, locale) {
    if (!type) return '/';
    const fromApi = type.paths?.[locale] || type.path;
    if (fromApi) return fromApi;
    const slug = type.translations?.[locale]?.slug || type.slug;
    return type.is_homepage ? '/' : `/${slug}`;
}

/** Alt sayfanın yolu: `/haberler/merhaba` · `/en/news/hello`. */
export function itemPath(type, item, locale) {
    const slug = typeof item === 'string' ? item : item?.slug;
    if (!slug) return sectionPath(type, locale);
    return joinPath(sectionPath(type, locale), slug);
}

/** Bir bölümün tüm dillerdeki yolları — dil değiştirici / hreflang için. */
export function alternatePaths(type, locales, item) {
    const out = {};
    for (const locale of locales || []) {
        out[locale] = item ? itemPath(type, item, locale) : sectionPath(type, locale);
    }
    return out;
}

/** Yoldaki dil önekini ayırır: '/en/news' → { locale:'en', rest:['news'] }. */
export function splitLocale(path, site) {
    const segments = toSegments(path);
    const locales = site?.locales || [];
    const fallback = site?.default_locale || locales[0] || null;

    if (segments.length && locales.includes(segments[0]) && segments[0] !== fallback) {
        return { locale: segments[0], rest: segments.slice(1), prefixed: true };
    }
    return { locale: fallback, rest: segments, prefixed: false };
}

/**
 * Bir URL'i içeriğe çözer. Dönen `kind`:
 * - `home`    → ana sayfa bölümü (`/`, `/en`)
 * - `section` → koleksiyon listesi ya da tekil sayfa (`/haberler`, `/hakkimizda`)
 * - `item`    → koleksiyonun alt sayfası (`/haberler/merhaba`)
 * - `notFound`→ eşleşme yok
 */
export function resolveRoute(path, { site, types }) {
    const { locale, rest, prefixed } = splitLocale(path, site);
    const list = types || [];

    if (rest.length === 0) {
        const home = list.find((t) => t.is_homepage) || null;
        return { kind: home ? 'home' : 'notFound', locale, prefixed, type: home, itemSlug: null, segments: rest };
    }

    // Bölümü o dildeki yoluyla eşleştir (önekli/öneksiz her iki biçim de kabul).
    const wanted = rest[0];
    const type = list.find((t) => {
        if (t.is_homepage) return false;
        const own = toSegments(sectionPath(t, locale));
        const slugs = new Set([
            own[own.length - 1],
            t.slug,
            t.translations?.[locale]?.slug,
        ].filter(Boolean));
        return slugs.has(wanted);
    });

    if (!type) return { kind: 'notFound', locale, prefixed, type: null, itemSlug: null, segments: rest };
    if (rest.length === 1) {
        return { kind: 'section', locale, prefixed, type, itemSlug: null, segments: rest };
    }
    if (rest.length === 2 && type.is_collection) {
        return { kind: 'item', locale, prefixed, type, itemSlug: rest[1], segments: rest };
    }

    return { kind: 'notFound', locale, prefixed, type, itemSlug: null, segments: rest };
}

/**
 * İçerik/sayfa nesnesinin `seo` alanından meta bilgisi üretir.
 * Next.js `generateMetadata` çıktısına birebir uyar.
 */
export function toMetadata(entity, options = {}) {
    const { siteName, url, image, locale, alternates, titleTemplate } = options;
    const seo = entity?.seo || {};
    const title = seo.title || options.title || null;
    const description = seo.description || options.description || null;

    /** @type {Record<string, any>} */
    const meta = {};
    if (title) meta.title = titleTemplate ? titleTemplate.replace('%s', title) : title;
    if (description) meta.description = description;

    const openGraph = {};
    if (title) openGraph.title = meta.title;
    if (description) openGraph.description = description;
    if (siteName) openGraph.siteName = siteName;
    if (url) openGraph.url = url;
    if (locale) openGraph.locale = locale;
    if (image) openGraph.images = [image];
    openGraph.type = options.type || 'website';
    if (Object.keys(openGraph).length > 1) meta.openGraph = openGraph;

    if (url || alternates) {
        meta.alternates = { ...(url ? { canonical: url } : {}), ...(alternates ? { languages: alternates } : {}) };
    }

    return meta;
}
