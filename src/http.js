import {
    AdsCrmError,
    AdsCrmNetworkError,
    AdsCrmNotFoundError,
    AdsCrmRateLimitError,
    AdsCrmValidationError,
} from './errors.js';

const DELIVERY_PREFIX = 'api/v1/public';

/**
 * Delivery kök adresini kurar. `baseUrl` olarak hem sunucu kökü
 * (`https://crm.adsoffice.net`) hem de tam delivery adresi
 * (`https://crm.adsoffice.net/api/v1/public/TOKEN`) verilebilir.
 */
export function buildBase(baseUrl, token) {
    const base = String(baseUrl || '').replace(/\/+$/, '');
    if (!base) throw new AdsCrmError('createClient: `baseUrl` zorunludur.');

    if (base.includes(`/${DELIVERY_PREFIX}/`)) return base; // tam adres verilmiş
    if (!token) throw new AdsCrmError('createClient: `token` (site delivery tokenı) zorunludur.');

    return `${base}/${DELIVERY_PREFIX}/${token}`;
}

/** Sorgu dizesi — boş/undefined değerler düşer, diziler virgülle birleşir. */
export function queryString(params = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue;
        search.append(key, Array.isArray(value) ? value.join(',') : String(value));
    }
    const qs = search.toString();
    return qs ? `?${qs}` : '';
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tek bir Delivery isteği. Next.js kullanıyorsanız `revalidate` / `tags`
 * doğrudan `fetch`'in `next` seçeneğine geçer (Data Cache + `revalidateTag`).
 */
export async function request(config, path, options = {}) {
    const {
        method = 'GET',
        query = {},
        body,
        locale,
        revalidate,
        tags,
        cache,
        signal,
        headers = {},
        retries,
    } = options;

    // Dil önceliği: çağrı > sorgu > istemci varsayılanı. `locale: null` ile kapatılabilir.
    const params = { ...query };
    const resolvedLocale = locale !== undefined ? locale : query.locale !== undefined ? query.locale : config.locale;
    if (resolvedLocale) params.locale = resolvedLocale;
    else delete params.locale;

    const url = `${config.base}/${String(path).replace(/^\/+/, '')}${queryString(params)}`;

    const fetchImpl = config.fetch || globalThis.fetch;
    if (!fetchImpl) {
        throw new AdsCrmError('Ortamda `fetch` yok. Node 18+ kullanın ya da `fetch` seçeneğini verin.');
    }

    const init = {
        method,
        headers: { Accept: 'application/json', ...config.headers, ...headers },
        signal,
    };

    if (body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
    }

    // Next.js önbellek seçenekleri — Next dışında zararsızca yok sayılır.
    const nextRevalidate = revalidate ?? (method === 'GET' ? config.revalidate : undefined);
    const nextTags = tags ?? (method === 'GET' ? config.tags : undefined);
    const noStore = cache === 'no-store' || nextRevalidate === 0 || nextRevalidate === false;
    const nextOptions = {};
    // `revalidate: 0` ile `cache` birlikte verilmez — Next bunu çakışma sayar.
    if (!noStore && nextRevalidate !== undefined) nextOptions.revalidate = nextRevalidate;
    if (!noStore && nextTags && nextTags.length) nextOptions.tags = nextTags;
    if (Object.keys(nextOptions).length) init.next = nextOptions;

    if (noStore) init.cache = 'no-store';
    else if (cache) init.cache = cache;

    const maxRetries = retries ?? (method === 'GET' ? config.retries : 0);
    let attempt = 0;

    for (;;) {
        let response;
        const timeout = config.timeout;
        let timer = null;
        let controller = null;

        try {
            // Kendi zaman aşımımız — çağıranın `signal`'ı da korunur.
            if (timeout && typeof AbortController !== 'undefined' && !signal) {
                controller = new AbortController();
                timer = setTimeout(() => controller.abort(), timeout);
                init.signal = controller.signal;
            }
            response = await fetchImpl(url, init);
        } catch (error) {
            if (attempt < maxRetries) {
                attempt += 1;
                await sleep(config.retryDelay * attempt);
                continue;
            }
            throw new AdsCrmNetworkError(
                error?.name === 'AbortError' ? `İstek zaman aşımına uğradı (${timeout} ms).` : 'Sunucuya ulaşılamadı.',
                { url, cause: error },
            );
        } finally {
            if (timer) clearTimeout(timer);
        }

        const text = await response.text();
        let payload = null;
        if (text) {
            try {
                payload = JSON.parse(text);
            } catch {
                payload = text;
            }
        }

        if (response.ok) return payload;

        // 5xx geçici olabilir → yeniden dene.
        if (response.status >= 500 && attempt < maxRetries) {
            attempt += 1;
            await sleep(config.retryDelay * attempt);
            continue;
        }

        const message = (payload && payload.message) || `AdsCRM ${response.status}`;
        const meta = { url, body: payload, status: response.status };

        if (response.status === 404) throw new AdsCrmNotFoundError(message, meta);
        if (response.status === 422) throw new AdsCrmValidationError(message, { ...meta, errors: payload?.errors });
        if (response.status === 429) {
            throw new AdsCrmRateLimitError(message, {
                ...meta,
                retryAfter: Number(response.headers?.get?.('Retry-After')) || null,
            });
        }
        throw new AdsCrmError(message, meta);
    }
}
