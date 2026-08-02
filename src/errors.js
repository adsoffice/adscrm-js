/**
 * Delivery API hataları. Tümü `AdsCrmError`'dan türer, böylece tek `catch` ile
 * yakalanır; ayrımı `status` veya `instanceof` ile yaparsınız.
 */

export class AdsCrmError extends Error {
    constructor(message, { status = 0, url = '', body = null, cause = undefined } = {}) {
        super(message);
        this.name = 'AdsCrmError';
        this.status = status;
        this.url = url;
        this.body = body;
        if (cause !== undefined) this.cause = cause;
    }
}

/** 404 — bölüm/sayfa/form bulunamadı ya da yayında değil. */
export class AdsCrmNotFoundError extends AdsCrmError {
    constructor(message = 'Kayıt bulunamadı.', meta) {
        super(message, { ...meta, status: 404 });
        this.name = 'AdsCrmNotFoundError';
    }
}

/** 422 — form doğrulaması / captcha. `errors` alan bazlı mesajları taşır. */
export class AdsCrmValidationError extends AdsCrmError {
    constructor(message = 'Doğrulama başarısız.', meta = {}) {
        super(message, { ...meta, status: meta.status ?? 422 });
        this.name = 'AdsCrmValidationError';
        /** @type {Record<string, string[]>} */
        this.errors = meta.errors || {};
    }

    /** Alan adına göre ilk hata mesajı (form alanları `data.<ad>` ile döner). */
    fieldError(field) {
        const list = this.errors[field] || this.errors[`data.${field}`];
        return Array.isArray(list) ? list[0] : undefined;
    }

    /** `{ ad: 'Zorunlu alan' }` biçiminde düz harita — form state'ine doğrudan yazılır. */
    fieldErrors() {
        const out = {};
        for (const [key, list] of Object.entries(this.errors)) {
            out[key.startsWith('data.') ? key.slice(5) : key] = Array.isArray(list) ? list[0] : String(list);
        }
        return out;
    }
}

/** 429 — Delivery 120 istek/dk, form gönderimi 10 istek/dk sınırındadır. */
export class AdsCrmRateLimitError extends AdsCrmError {
    constructor(message = 'İstek sınırı aşıldı.', meta = {}) {
        super(message, { ...meta, status: 429 });
        this.name = 'AdsCrmRateLimitError';
        /** Sunucunun önerdiği bekleme süresi (saniye), varsa. */
        this.retryAfter = meta.retryAfter ?? null;
    }
}

/** Ağ hatası / zaman aşımı — sunucudan yanıt alınamadı. */
export class AdsCrmNetworkError extends AdsCrmError {
    constructor(message = 'Sunucuya ulaşılamadı.', meta) {
        super(message, meta);
        this.name = 'AdsCrmNetworkError';
    }
}

/** `notFound()` çağırmadan önce kullanışlı: `if (isNotFound(err)) notFound()`. */
export function isNotFound(error) {
    return error instanceof AdsCrmNotFoundError || error?.status === 404;
}

export function isValidationError(error) {
    return error instanceof AdsCrmValidationError || error?.status === 422;
}

export function isRateLimited(error) {
    return error instanceof AdsCrmRateLimitError || error?.status === 429;
}
