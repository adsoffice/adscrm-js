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

export { isNotFound };
