/**
 * Yönlendirme (bağlantı yöneticisi) kuralları — saf fonksiyonlar.
 *
 * Panelde tanımlanan kurallar `GET /links` ile alınır; burada **sunucudaki
 * motorun birebir aynısı** çalışır (tam/önek/joker/regex eşleşmesi, sorgu
 * taşıma, kalan yolu ekleme, döngü koruması). Böylece Next.js middleware'i
 * her istek için CRM'e gitmeden kararı yerelde verebilir.
 *
 * Ağ isteği yapmazlar — istemciyi (`cms.redirects()`) çağıran taraf besler.
 */

/** Yolu `["/a/b", "x=1&y=2"]` olarak ayırır (çapa `#...` atılır). */
export function splitQuery(value) {
    const raw = String(value ?? '').split('#')[0];
    const at = raw.indexOf('?');
    return at === -1 ? [raw, ''] : [raw.slice(0, at), raw.slice(at + 1).trim()];
}

/**
 * İstek yolunu karşılaştırılabilir hale getirir — içeriğini değiştirmeden:
 * tam adres verilirse yol kısmı alınır, yüzde kodlaması çözülür, çoklu `/`
 * teklenir, baştaki `/` eklenir, sondaki `/` atılır.
 *
 * `"https://site.com/Eski%20Sayfa/"` → `"/Eski Sayfa"`
 */
export function normalizeRedirectPath(value) {
    let input = String(value ?? '').trim();
    if (!input) return '/';

    if (/^(https?:)?\/\//i.test(input)) {
        try {
            const url = new URL(input.startsWith('//') ? `https:${input}` : input);
            input = url.pathname + (url.search || '');
        } catch {
            // ayrıştırılamazsa olduğu gibi devam
        }
    }

    let [path, query] = splitQuery(input);

    try {
        path = decodeURIComponent(path);
    } catch {
        // bozuk kodlama — ham hali kullanılır
    }

    path = `/${path.replace(/\/{2,}/g, '/').replace(/^\/+/, '')}`;
    if (path !== '/') path = path.replace(/\/+$/, '');

    return query ? `${path}?${query}` : path;
}

/** Eşleşme gücü: tam > önek > joker > regex, eşitlikte uzun kaynak kazanır. */
export function redirectSpecificity(rule) {
    const base = { exact: 4000, prefix: 3000, wildcard: 2000 }[rule?.match] ?? 1000;
    return base + Math.min(999, String(rule?.source || '').length);
}

/**
 * Kuralları eşleşme gücüne göre sıralar. `GET /links` zaten sıralı döner;
 * bu yardımcı, kuralları elle birleştirenler (ör. statik liste) içindir.
 */
export function sortRedirects(rules = []) {
    return [...rules].sort((a, b) => redirectSpecificity(b) - redirectSpecificity(a));
}

/* ------------------------------------------------------------ eşleşme */

function wildcardToRegex(source) {
    const quoted = source
        .replace(/\/+$/, '')
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\*/g, '(.*)');

    try {
        return new RegExp(`^${quoted}/?$`, 'i');
    } catch {
        return null;
    }
}

function regexFrom(source) {
    const body = String(source || '').trim().replace(/^\^+/, '').replace(/\$+$/, '');
    if (!body) return null;

    try {
        return new RegExp(`^${body}$`, 'i');
    } catch {
        return null;
    }
}

function matchPattern(pattern, path, endsWithStar) {
    if (!pattern) return null;

    const hit = pattern.exec(path);
    if (!hit) return null;

    const captures = hit.slice(1).map((c) => c ?? '');
    const remainder = endsWithStar ? trimSlashes(captures[captures.length - 1] || '') : '';

    return { captures, remainder };
}

function trimSlashes(value) {
    return String(value).replace(/^\/+/, '').replace(/\/+$/, '');
}

/** Kuralın şart koştuğu sorgu parametreleri istekte var mı? */
function queryMatches(required, incoming) {
    const want = new URLSearchParams(required);
    const got = new URLSearchParams(incoming);

    for (const [key, value] of want) {
        if (got.get(key) !== value) return false;
    }

    return true;
}

/**
 * Kural bu yola uyuyor mu? Uyuyorsa joker/regex yakalamalarını ve önek
 * eşleşmesinde artan kısmı döndürür; uymuyorsa `null`.
 */
export function matchesRedirect(rule, path, query = '') {
    if (!rule?.source) return null;

    if (rule.match === 'regex') {
        return matchPattern(regexFrom(rule.source), path, false);
    }

    const [source, sourceQuery] = splitQuery(rule.source);
    if (sourceQuery && !queryMatches(sourceQuery, query)) return null;

    const lowerPath = path.toLowerCase();
    const lowerSource = source.toLowerCase();

    if (rule.match === 'prefix') {
        const trimmed = lowerSource === '/' ? '' : lowerSource.replace(/\/+$/, '');
        if (trimmed && lowerPath !== trimmed && !lowerPath.startsWith(`${trimmed}/`)) return null;

        return { captures: [], remainder: trimSlashes(path.slice(source.replace(/\/+$/, '').length)) };
    }

    if (rule.match === 'wildcard') {
        return matchPattern(wildcardToRegex(source), path, source.endsWith('*'));
    }

    return lowerPath === lowerSource ? { captures: [], remainder: '' } : null;
}

/* ------------------------------------------------------------ hedef */

/** Gelen sorgu parametrelerini hedefe ekler — hedefin kendi parametreleri korunur. */
export function mergeQuery(target, incoming) {
    const [path, existing] = splitQuery(target);
    const merged = new URLSearchParams(incoming);

    for (const [key, value] of new URLSearchParams(existing)) merged.set(key, value);

    const qs = merged.toString();
    return qs ? `${path}?${qs}` : path;
}

/**
 * Hedef adresi kurar: yakalamaları (`$1…$9`) yerleştirir, önek/joker artığını
 * ekler, istenmişse sorgu parametrelerini taşır. Kendi kaynağına dönen
 * (sonsuz döngü) hedeflerde `null` döner.
 */
export function buildRedirectTarget(rule, captures = [], remainder = '', query = '') {
    let target = String(rule?.target || '').trim();
    if (!target) return null;

    let usedCapture = false;
    target = target.replace(/\$(\d)/g, (_, digit) => {
        usedCapture = true;
        return captures[Number(digit) - 1] ?? '';
    });

    const appendRemainder = rule.append_remainder !== false;
    if (!usedCapture && appendRemainder && remainder) {
        const [targetPath, targetQuery] = splitQuery(target);
        target = `${targetPath.replace(/\/+$/, '')}/${trimSlashes(remainder)}${targetQuery ? `?${targetQuery}` : ''}`;
    }

    if (rule.keep_query !== false && query) target = mergeQuery(target, query);

    if (!isExternalTarget(target)) {
        target = `/${target.replace(/^\/+/, '')}`;
        const source = splitQuery(rule.source || '')[0];
        if (normalizeRedirectPath(target).toLowerCase() === normalizeRedirectPath(source).toLowerCase()) {
            return null;
        }
    }

    return target;
}

/** Hedef dış bir adres mi (http/https/mailto/tel)? */
export function isExternalTarget(url) {
    return /^(https?:|mailto:|tel:|\/\/)/i.test(String(url || '').trim());
}

/**
 * Kural listesinde ilk uyan kuralı bulur ve gidilecek hedefi üretir.
 *
 * @param rules   `cms.redirects()` çıktısı (sunucu sıralı verir)
 * @param path    istek yolu — sorgu içerebilir
 * @param missing istek gerçekten 404'e mi düştü (yalnızca-404 kuralları için)
 * @returns `{ rule, target, type, status, source }` ya da `null`
 */
export function findRedirect(rules, path, { missing = false } = {}) {
    const normalized = normalizeRedirectPath(path);
    const [requestPath, query] = splitQuery(normalized);

    for (const rule of rules || []) {
        if (rule.only_when_missing && !missing) continue;

        const hit = matchesRedirect(rule, requestPath, query);
        if (!hit) continue;

        const target = buildRedirectTarget(rule, hit.captures, hit.remainder, query);
        if (!target) continue;

        return {
            rule,
            source: rule.source,
            target,
            type: rule.type || (isExternalTarget(target) ? 'external' : 'internal'),
            status: rule.status || 301,
        };
    }

    return null;
}
