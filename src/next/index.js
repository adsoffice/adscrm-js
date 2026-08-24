/**
 * Next.js (App Router) yardımcıları.
 *
 * Bu dosya `next/*` paketlerinden **hiçbir şey import etmez** — sadece Next'in
 * `fetch` önbelleğiyle uyumlu seçenekler üretir ve rota/metadata yardımcıları verir.
 * Böylece paket Next sürümüne bağımlı olmaz, Vite/CRA/Remix ile de çalışır.
 */

import { createClient } from '../client.js';
import { isNotFound } from '../errors.js';
import { toMetadata, alternatePaths, sectionPath, itemPath } from '../routing.js';

/**
 * Next için makul varsayılanlarla istemci: ISR açık (60 sn) ve `cms` etiketli.
 * Webhook'tan `revalidateTag('cms')` çağırarak tüm içeriği tazeleyebilirsiniz.
 *
 * ```js
 * // lib/cms.js
 * import { createCmsClient } from '@adsoffice/adscrm/next';
 * export const cms = createCmsClient({
 *   baseUrl: process.env.ADSCRM_URL,
 *   token: process.env.ADSCRM_TOKEN,
 * });
 * ```
 */
export function createCmsClient(options = {}) {
    return createClient({
        revalidate: 60,
        tags: ['cms'],
        ...options,
    });
}

/** İçerik tipine göre etiket — `revalidateTag(tagFor('haberler'))`. */
export function tagFor(...parts) {
    return ['cms', ...parts.filter(Boolean)].join(':');
}

/**
 * `generateStaticParams` için bölüm yolları.
 * Catch-all rotada (`app/[[...slug]]/page.js`) doğrudan kullanılır.
 */
export async function staticSectionParams(client, { locales, param = 'slug' } = {}) {
    const site = await client.site();
    const codes = locales || site.locales || [];
    const params = [];

    for (const locale of codes) {
        const types = await client.contentTypes({ locale });
        for (const type of types) {
            const segments = sectionPath(type, locale).split('/').filter(Boolean);
            params.push({ [param]: segments });
        }
    }

    return dedupeParams(params, param);
}

/**
 * `generateStaticParams` için alt sayfa yolları. `types` verilmezse tüm
 * koleksiyonlar dolaşılır (büyük sitelerde `limit`/`max` ile sınırlayın).
 */
export async function staticItemParams(client, { locales, types, param = 'slug', limit = 100, max = 2000 } = {}) {
    const site = await client.site();
    const codes = locales || site.locales || [];
    const params = [];

    for (const locale of codes) {
        const all = await client.contentTypes({ locale });
        const selected = all.filter((t) => t.is_collection && (!types || types.includes(t.slug)));

        for (const type of selected) {
            const items = await client.allItems(type.slug, { locale, limit, max });
            for (const item of items) {
                params.push({ [param]: itemPath(type, item, locale).split('/').filter(Boolean) });
            }
        }
    }

    return dedupeParams(params, param);
}

function dedupeParams(params, param) {
    const seen = new Set();
    return params.filter((entry) => {
        const key = (entry[param] || []).join('/');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * `generateMetadata` için hazır meta — sayfanın/kaydın `seo` alanından üretir.
 *
 * ```js
 * export async function generateMetadata({ params }) {
 *   const page = await cms.resolve(params.slug);
 *   return pageMetadata(page, { siteName: 'Acme' });
 * }
 * ```
 */
export function pageMetadata(resolved, options = {}) {
    const entity = resolved?.data && !Array.isArray(resolved.data) ? resolved.data : resolved?.page;
    return toMetadata(entity || { seo: resolved?.seo }, {
        locale: resolved?.locale,
        ...options,
    });
}

/**
 * Bir sayfanın tüm dillerdeki yolları — `alternates.languages` için.
 * `resolved` çıktısını olduğu gibi alır.
 */
export function languageAlternates(resolved, site) {
    if (!resolved?.type) return {};
    const item = resolved.kind === 'item' ? resolved.data : null;
    return alternatePaths(resolved.type, site?.locales || [], item);
}

/* ── Yönlendirmeler (bağlantı yöneticisi) ─────────────────────── */

/** İstek/URL/yol → `{ path, search, origin }`. `next/server` gerekmez. */
function readUrl(input) {
    if (!input) return { path: '/', search: '', origin: null };

    // NextRequest (`nextUrl`) · Request (`url`) · URL · düz yol
    const url = input.nextUrl ?? (typeof input === 'object' && input.url ? input.url : input);

    if (typeof url === 'object' && url.pathname !== undefined) {
        return { path: url.pathname, search: url.search || '', origin: url.origin || null };
    }

    const raw = String(url);
    if (/^https?:\/\//i.test(raw)) {
        try {
            const parsed = new URL(raw);
            return { path: parsed.pathname, search: parsed.search, origin: parsed.origin };
        } catch {
            // düz yol gibi işle
        }
    }

    const [path, search] = raw.split('?');
    return { path, search: search ? `?${search}` : '', origin: null };
}

/**
 * Middleware kararı: istek bir yönlendirme kuralına uyuyor mu?
 * Kural listesi önbelleklenir (istek başına CRM'e gidilmez), eşleştirme
 * yereldedir. `only_when_missing` kuralları burada **atlanır** — onlar
 * `notFoundRedirect()` ile 404 akışında çözülür.
 *
 * ```js
 * // middleware.js
 * export async function middleware(request) {
 *   const hit = await redirectFor(cms, request);
 *   if (hit) return NextResponse.redirect(hit.target, hit.status);
 * }
 * ```
 *
 * @returns `{ target, status, type, source, rule }` ya da `null`
 */
export async function redirectFor(client, input, { missing = false, rules, ...opts } = {}) {
    const { path, search, origin } = readUrl(input);
    const hit = await client.matchRedirect(`${path}${search}`, { missing, rules, ...opts });

    if (!hit) return null;

    // NextResponse.redirect mutlak adres ister; iç hedefi isteğin köküne bağla.
    const target = hit.type === 'internal' && origin ? new URL(hit.target, origin).toString() : hit.target;

    return { ...hit, target };
}

/**
 * 404 sayfası için son çare: adresi **sunucuda** çözer (joker/regex ve
 * yalnızca-404 kuralları dahil), tıklamayı sayar ve eşleşme yoksa adresi
 * panelin "Bulunamayan Adresler" günlüğüne yazar.
 *
 * ```js
 * // app/not-found.jsx
 * import { redirect } from 'next/navigation';
 * import { headers } from 'next/headers';
 *
 * export default async function NotFound() {
 *   const path = (await headers()).get('x-invoked-path') ?? '/';
 *   const target = await notFoundRedirect(cms, path);
 *   if (target) redirect(target);
 *   return <h1>Sayfa bulunamadı</h1>;
 * }
 * ```
 *
 * @returns hedef adres (string) ya da `null`
 */
export async function notFoundRedirect(client, path, opts = {}) {
    const { path: pathname, search } = readUrl(path);
    const hit = await client.resolveRedirect(`${pathname}${search}`, { missing: true, ...opts });

    return hit?.target ?? null;
}

export { isNotFound };
