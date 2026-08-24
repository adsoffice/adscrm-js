import { buildBase, request } from './http.js';
import { resolveRoute, sectionPath, itemPath, alternatePaths, toSegments } from './routing.js';
import { buildSubmitBody } from './forms.js';
import { findRedirect, normalizeRedirectPath } from './redirects.js';
import { isNotFound } from './errors.js';

const DEFAULTS = {
    locale: undefined,
    timeout: 15000,
    retries: 2,
    retryDelay: 300,
    revalidate: undefined,
    tags: undefined,
    headers: undefined,
    fetch: undefined,
};

/**
 * AdsCRM Delivery (headless) istemcisi — **salt okunur**.
 * Tek yazma işlemi form gönderimidir (`submitForm`), o da public uçtur.
 *
 * ```js
 * export const cms = createClient({
 *   baseUrl: 'https://crm.adsoffice.net',
 *   token: process.env.ADSCRM_SITE_TOKEN,
 *   locale: 'tr',
 *   revalidate: 60,           // Next.js Data Cache
 *   tags: ['cms'],            // revalidateTag('cms') ile topluca tazele
 * });
 * ```
 */
export function createClient(options = {}) {
    const config = {
        ...DEFAULTS,
        ...options,
        base: buildBase(options.baseUrl, options.token),
    };

    const call = (path, opts) => request(config, path, opts);
    const data = (promise) => promise.then((res) => (res && 'data' in res ? res.data : res));

    /** Aynı yanıtı istek başına tekrar çekmemek için küçük bellek içi önbellek. */
    const memo = new Map();
    const remember = (key, factory, ttl) => {
        const now = Date.now();
        const hit = memo.get(key);
        if (hit && (hit.expires === 0 || hit.expires > now)) return hit.value;
        const value = factory().catch((error) => {
            memo.delete(key);
            throw error;
        });
        memo.set(key, { value, expires: ttl ? now + ttl : 0 });
        return value;
    };

    const client = {
        /** Çözülmüş yapılandırma (base adres dahil) — hata ayıklama için. */
        config,

        /** Aynı ayarlarla ama sabit dilli yeni bir istemci. */
        withLocale(locale) {
            return createClient({ ...options, locale });
        },

        /** Önbelleğe alınmış `site` / `content-types` yanıtlarını düşürür. */
        clearMemo() {
            memo.clear();
        },

        /** Şemada olmayan bir uca doğrudan erişim (kaçış kapısı). */
        raw(path, opts) {
            return call(path, opts);
        },

        /* ── Site künyesi ─────────────────────────────────────────── */

        /**
         * Site adı, etkin diller, varsayılan dil, ana sayfa, izleme kodları,
         * sosyal medya bağlantıları (`social`) ve çerez politikası (`cookie`).
         * `cookie` metinleri istemcinin diline çözülür.
         */
        site(opts) {
            const key = `site:${opts?.locale ?? config.locale ?? ''}`;
            return remember(key, () => data(call('site', opts)), 30000);
        },

        /**
         * Etkin diller + varsayılan dil. Dil seçici ve `hreflang` için gereken her şey:
         * `{ locales, default, current, items: [{ code, name, is_default, prefix, home_path }] }`.
         */
        locales(opts) {
            const key = `locales:${opts?.locale ?? config.locale ?? ''}`;
            return remember(key, () => data(call('locales', opts)), 30000);
        },

        /** Yalnızca varsayılan dil kodu — istemci dil ayarı yapmadan önce sorulur. */
        async defaultLocale(opts) {
            return (await client.locales(opts)).default;
        },

        /** Google/Meta izleme kodları + enjekte edilmeye hazır `head_html`/`body_html`. */
        tracking(opts) {
            return data(call('tracking', opts));
        },

        /**
         * Sosyal medya bağlantıları — yalnızca **etkin** olanlar, footer için hazır:
         * `[{ platform, label, url, logo_url, color }]`. `logo_url` panelde özel logo
         * seçilmişse doludur; değilse `platform` anahtarıyla kendi marka ikonunuzu basın.
         */
        social(opts) {
            return remember(`social:${opts?.locale ?? config.locale ?? ''}`, () => data(call('social', opts)), 30000);
        },

        /**
         * Çerez politikası banner ayarları. Metinler istemcinin diline çözülür
         * (eksik dil varsayılana düşer): `{ enabled, position, theme, show_reject,
         * show_settings, policy_link, texts: { title, message, accept_label, … } }`.
         * Banner'ı kendi frontend'iniz çizer; onay tercihini (cookie/localStorage)
         * de siz saklarsınız.
         */
        cookie(opts) {
            return remember(`cookie:${opts?.locale ?? config.locale ?? ''}`, () => data(call('cookie', opts)), 30000);
        },

        /**
         * Site görselleri (logo, footer logo, beyaz logo, favicon vb.) — panelde
         * tanımlanan `{ key, label, url }` kayıtları. Dilden bağımsızdır.
         */
        images(opts) {
            return remember('images', () => data(call('images', opts)), 30000);
        },

        /** Aynı veri, `key → url` haritası olarak: `imageMap().site_logo`. */
        async imageMap(opts) {
            const list = await client.images(opts);
            const out = {};
            for (const img of list || []) out[img.key] = img.url;
            return out;
        },

        /* ── Sitemap ──────────────────────────────────────────────── */

        /** Sitenin bölümleri (koleksiyonlar + tekil sayfalar), panel sırasıyla. */
        contentTypes(opts = {}) {
            const key = `types:${opts.locale ?? config.locale ?? ''}`;
            return remember(key, () => data(call('content-types', opts)), 30000);
        },

        /**
         * Sitenin **tüm public adresleri**, her dildeki URL'siyle:
         * bölümler + yayındaki alt sayfalar + kategoriler.
         * `{ data: [{ ref, kind, urls, labels, … }], meta: { locales, default_locale, … } }`
         *
         * sitemap.xml, hreflang ve dil değiştirici için tek kaynak.
         * `{ flat: true }` ile dil başına bir satır döner.
         */
        urls({ kind, type, limit, flat, ...opts } = {}) {
            return call('urls', {
                ...opts,
                query: {
                    kind: Array.isArray(kind) ? kind.join(',') : kind,
                    type,
                    limit,
                    flat: flat ? 1 : undefined,
                    ...(opts.query || {}),
                },
            });
        },

        /** `ref → kayıt` haritası — bir hedefin diller arası URL'lerini aramak için. */
        async urlMap(options) {
            const res = await client.urls(options);
            const out = {};
            for (const entry of res.data || []) out[entry.ref] = entry;
            return out;
        },

        /**
         * Sitenin **adres yapısı** (route şeması), her dilde. `urls()` somut
         * adresleri verir (`/projeler/villa-a`); bu uç onların **kalıbını**:
         * bölüm yolu, detay sayfası kalıbı ve (etkinse) kategori kalıbı.
         *
         * `{ data: { locales, default_locale, homepage, sections, routes }, meta }`
         *
         * `style`: `brace` → `{slug}` (öntanımlı) · `next` → `[slug]` ·
         * `colon` → `:slug` · `paren` → `(slug)`.
         *
         * ```js
         * const { data } = await cms.routes({ style: 'next' });
         * data.sections[0].locales.tr.page   // '/projeler/[slug]'
         * ```
         */
        routes({ style, kind, type, ...opts } = {}) {
            return call('routes', {
                ...opts,
                query: {
                    style,
                    kind: Array.isArray(kind) ? kind.join(',') : kind,
                    type,
                    ...(opts.query || {}),
                },
            });
        },

        /** `yol → satır` haritası: `map['/projeler/{slug}'].section`. */
        async routeMap(options) {
            const res = await client.routes(options);
            const out = {};
            for (const row of res.data?.routes || []) out[row.path] = row;
            return out;
        },

        /**
         * Yalnızca **dinamik** kalıplar (detay + kategori) — Next.js'te
         * `[slug]` klasörlerini/rotalarını üretmek için.
         */
        async dynamicRoutes(options) {
            const res = await client.routes(options);
            return (res.data?.routes || []).filter((row) => row.is_dynamic);
        },

        /** Slug (herhangi bir dilde) ile tek bir bölüm. */
        async contentType(slug, opts) {
            const types = await client.contentTypes(opts);
            const locale = opts?.locale ?? config.locale;
            return (
                types.find((t) => t.slug === slug || t.translations?.[locale]?.slug === slug) || null
            );
        },

        /* ── İçerik ───────────────────────────────────────────────── */

        /**
         * Bir bölümün yayındaki alt sayfaları + bölüm sayfası.
         * Tekil sayfa bölümlerinde `data` boş dizidir, içerik `page` altındadır.
         */
        list(typeSlug, { page, limit, ...opts } = {}) {
            return call(typeSlug, { ...opts, query: { page, limit, ...(opts.query || {}) } });
        },

        /** Tek bir alt sayfa. Yayında değilse / yoksa `AdsCrmNotFoundError`. */
        item(typeSlug, itemSlug, opts) {
            return data(call(`${typeSlug}/${itemSlug}`, opts));
        },

        /** Tekil sayfa bölümünün (ya da koleksiyon ana sayfasının) içeriği. */
        async page(typeSlug, opts) {
            const res = await client.list(typeSlug, { ...opts, limit: 1 });
            return res.page ?? null;
        },

        /**
         * Ana sayfa olarak işaretli bölüm. Liste uçlarıyla aynı biçimde
         * `{ data, page, meta }` döner; sayfa içeriği `page` altındadır.
         */
        homepage({ limit, ...opts } = {}) {
            return call('', { ...opts, query: { limit, ...(opts.query || {}) } });
        },

        /** Sayfalamayı otomatik dolaşır — `generateStaticParams` için birebir. */
        async allItems(typeSlug, { limit = 100, max = 5000, ...opts } = {}) {
            const out = [];
            let page = 1;
            for (;;) {
                const res = await client.list(typeSlug, { ...opts, page, limit });
                out.push(...(res.data || []));
                const last = res.meta?.last_page ?? 1;
                if (page >= last || out.length >= max || !(res.data || []).length) break;
                page += 1;
            }
            return out;
        },

        /** Yayındaki içeriklerde metin araması (en az 2 karakter). */
        search(q, { limit, ...opts } = {}) {
            return call('search', { ...opts, query: { q, limit, ...(opts.query || {}) } });
        },

        /* ── Menü & slider ────────────────────────────────────────── */

        /** Menü künyeleri (id, name, slug) — ağaç olmadan. */
        menus(opts) {
            return data(call('menus', opts));
        },

        /**
         * Sitenin **tüm** menüleri, hiyerarşik öğeleriyle tek istekte.
         * `{ locales: 'all' }` ile her menü `items` yerine `items_by_locale` taşır.
         * Yanıt `{ data, meta }` biçimindedir; yalnızca diziyi isterseniz `menuMap()`.
         */
        menuTree({ locales, ...opts } = {}) {
            return call('menus/tree', { ...opts, query: { locales, ...(opts.query || {}) } });
        },

        /** Aynı veri, `slug → menü` haritası olarak: `menus.header.items`. */
        async menuMap(opts) {
            const res = await client.menuTree(opts);
            const out = {};
            for (const menu of res.data || []) out[menu.slug] = menu;
            return out;
        },

        /** Tek menü — **slug ya da id** ile (`menu('header')` · `menu(1)`). */
        menu(slugOrId, opts) {
            return data(call(`menus/${slugOrId}`, opts));
        },
        sliders(opts) {
            return data(call('sliders', opts));
        },
        slider(slug, opts) {
            return data(call(`sliders/${slug}`, opts));
        },

        /* ── Sayfa görünümleri (view) ─────────────────────────────── */

        /** Bir sayfanın tüm blokları tek istekte. */
        view(slug, opts) {
            return data(call(`view/${slug}`, opts));
        },

        /** Görünüm bloklarını `key` → `data` haritasına çevirir. */
        async blocks(slug, opts) {
            const view = await client.view(slug, opts);
            const out = {};
            for (const block of view?.blocks || []) out[block.key] = block.data;
            return out;
        },

        /* ── Dil değişkenleri ─────────────────────────────────────── */

        /** Anahtar → değer sözlüğü. `locales: 'all'` tüm dilleri tek istekte verir. */
        strings({ keys, group, locales, ...opts } = {}) {
            return data(call('strings', { ...opts, query: { keys, group, locales, ...(opts.query || {}) } }));
        },
        string(key, opts) {
            return data(call(`strings/${key}`, opts));
        },
        /** Yalnızca bir görünüme bağlı dil değişkenleri. */
        viewStrings(slug, { locales, ...opts } = {}) {
            return data(call(`view/${slug}/strings`, { ...opts, query: { locales, ...(opts.query || {}) } }));
        },

        /* ── Formlar ──────────────────────────────────────────────── */

        /** Form şeması: alanlar + captcha ayarı (secret asla dönmez). */
        form(slug, opts) {
            return data(call(`forms/${slug}`, opts));
        },

        /**
         * Captcha meydan okuması. `math` sağlayıcısında soruyu ve imzalı token'ı
         * sunucu üretir; istemci imzayı hesaplayamaz.
         */
        formCaptcha(slug, opts) {
            return data(call(`forms/${slug}/captcha`, { revalidate: 0, cache: 'no-store', ...opts }));
        },

        /**
         * Form gönderimi (tek yazma ucu, 10 istek/dk).
         * `values` alan adı → değer; captcha bilgisi ayrı verilir.
         */
        submitForm(slug, values, { captcha, honeypot, ...opts } = {}) {
            return call(`forms/${slug}/submit`, {
                ...opts,
                method: 'POST',
                revalidate: 0,
                body: buildSubmitBody(values, { captcha, honeypot }),
            });
        },

        /* ── Yönlendirmeler (bağlantı yöneticisi) ─────────────────── */

        /**
         * Panelde tanımlı **aktif** yönlendirme kuralları — eşleşme gücüne göre
         * sıralı (tam → önek → joker → regex). Liste önbelleklenebilir; asıl
         * eşleştirme `matchRedirect()` ile yerelde yapılır.
         */
        redirects(opts) {
            return data(call('links', opts));
        },

        /**
         * Bir yolu kural listesiyle **yerelde** eşleştirir (middleware için:
         * istek başına CRM'e gidilmez, yalnızca kural listesi çekilir).
         * Tıklama saymaz. Eşleşme yoksa `null`.
         *
         * ```js
         * const hit = await cms.matchRedirect(request.nextUrl.pathname + request.nextUrl.search);
         * if (hit) return NextResponse.redirect(new URL(hit.target, request.url), hit.status);
         * ```
         */
        async matchRedirect(path, { missing = false, rules, ...opts } = {}) {
            const list = rules || (await client.redirects(opts));
            return findRedirect(list, path, { missing });
        },

        /**
         * Adresi **sunucuda** çözer: joker/regex kuralları panelde uygulanır,
         * eşleşen kuralın tıklaması sayılır. `missing: true` verilirse
         * yalnızca-404 kuralları da denenir ve çözümsüz adres panelin
         * "Bulunamayan Adresler" günlüğüne yazılır. Eşleşme yoksa `null`.
         *
         * 404 sayfasında çağırmak için birebir: `app/not-found.jsx`.
         */
        async resolveRedirect(path, { missing = false, query, ...opts } = {}) {
            try {
                return await data(call('links/resolve', {
                    revalidate: 0,
                    cache: 'no-store',
                    locale: null,
                    ...opts,
                    query: {
                        path: normalizeRedirectPath(path),
                        missing: missing ? 1 : undefined,
                        query,
                        ...(opts.query || {}),
                    },
                }));
            } catch (error) {
                if (isNotFound(error)) return null;
                throw error;
            }
        },

        /* ── Rota çözümü ──────────────────────────────────────────── */

        /** URL → { kind, locale, type, itemSlug }. Veri çekmez, yalnızca eşler. */
        async route(path) {
            const [site, types] = await Promise.all([client.site(), client.contentTypes()]);
            const { locale } = resolveRoute(path, { site, types });
            // Bölüm slug'ları dile göre değişir → doğru dilin listesiyle yeniden çöz.
            const localized = locale === site.default_locale ? types : await client.contentTypes({ locale });
            return { ...resolveRoute(path, { site, types: localized }), site };
        },

        /**
         * URL → hazır sayfa verisi. Next.js catch-all rotasında tek satırda kullanılır:
         * `const page = await cms.resolve(params.slug)`
         */
        async resolve(path, { limit, ...opts } = {}) {
            const route = await client.route(path);
            const { kind, locale, type, itemSlug } = route;
            const base = { ...route, data: null, page: null, meta: null, seo: null };

            if (kind === 'notFound' || !type) return base;

            if (kind === 'item') {
                const item = await client.item(type.slug, itemSlug, { ...opts, locale });
                return { ...base, data: item, seo: item?.seo ?? null };
            }

            const res = kind === 'home'
                ? await client.homepage({ ...opts, locale, limit })
                : await client.list(type.slug, { ...opts, locale, limit });
            return {
                ...base,
                data: res.data ?? [],
                page: res.page ?? null,
                meta: res.meta ?? null,
                seo: res.page?.seo ?? null,
            };
        },

        /* ── Yol yardımcıları (saf fonksiyonlar) ──────────────────── */

        path(type, locale) {
            return sectionPath(type, locale ?? config.locale);
        },
        itemPath(type, item, locale) {
            return itemPath(type, item, locale ?? config.locale);
        },
        /** Bir sayfanın tüm dillerdeki yolları — dil değiştirici / hreflang. */
        async alternates(type, item) {
            const site = await client.site();
            return alternatePaths(type, site.locales, item);
        },
        segments: toSegments,
    };

    return client;
}
