/**
 * Form gönderimi ve captcha yardımcıları.
 *
 * AdsCRM dört sağlayıcı destekler:
 * - `honeypot` (varsayılan) — gizli alan dolu gelirse kayıt sessizce spam işaretlenir.
 * - `math`     — sunucu imzalı soru üretir (`forms/{slug}/captcha`), istemci cevabı gönderir.
 * - `recaptcha`— Google reCAPTCHA v2/v3, `site_key` şemadan gelir.
 * - `turnstile`— Cloudflare Turnstile, `site_key` şemadan gelir.
 *
 * Gönderim gövdesi: alan değerleri `data` altında, captcha alanları kökte.
 */

export const CAPTCHA_PROVIDERS = ['honeypot', 'math', 'recaptcha', 'turnstile'];

export const CAPTCHA_SCRIPTS = {
    recaptcha: 'https://www.google.com/recaptcha/api.js?render=explicit',
    turnstile: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
};

/** Şemadaki captcha bloğunu normalize eder (eski yanıtlarda alan eksik olabilir). */
export function normalizeCaptcha(schema) {
    const captcha = schema?.captcha || {};
    return {
        enabled: captcha.enabled !== false && !!captcha.provider,
        provider: captcha.provider || 'honeypot',
        siteKey: captcha.site_key || null,
        honeypotField: captcha.honeypot_field || '_gotcha',
    };
}

/**
 * Gönderim gövdesini kurar.
 *
 * @param values   alan adı → değer
 * @param captcha  { provider, token?, answer?, expiresAt?, field? }
 * @param honeypot honeypot alanının değeri (normalde boş string)
 */
export function buildSubmitBody(values = {}, { captcha, honeypot } = {}) {
    const body = { data: { ...values } };
    if (!captcha) return body;

    const provider = captcha.provider || 'honeypot';

    if (provider === 'honeypot') {
        const field = captcha.field || captcha.honeypotField || '_gotcha';
        body[field] = honeypot ?? '';
        return body;
    }

    if (provider === 'math') {
        body.captcha_answer = captcha.answer ?? '';
        body.captcha_token = captcha.token ?? '';
        if (captcha.expiresAt ?? captcha.expires_at) {
            body.captcha_expires = captcha.expiresAt ?? captcha.expires_at;
        }
        return body;
    }

    // recaptcha / turnstile — widget'tan gelen token.
    body.captcha_token = captcha.token ?? '';
    return body;
}

/**
 * Açılır liste seçenekleri `{ value, label }` çiftleri olarak.
 *
 * Çok dilli sitede `options` **gönderilecek kanonik değerdir** (her dilde aynı),
 * kullanıcıya gösterilecek metinler index'i eşleşen `option_labels` dizisindedir.
 * Çevirisi girilmemiş satırlarda ikisi aynıdır.
 *
 * ```jsx
 * {fieldChoices(field).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
 * ```
 */
export function fieldChoices(field) {
    const options = field?.options;
    if (!Array.isArray(options)) return [];

    const labels = Array.isArray(field.option_labels) ? field.option_labels : [];

    return options.map((value, i) => ({
        value,
        label: labels[i] || value,
    }));
}

/**
 * Kanonik değerin görünen etiketi — gönderim özetini/onay ekranını kullanıcının
 * dilinde göstermek için. Eşleşme yoksa değerin kendisi döner.
 */
export function optionLabel(field, value) {
    const match = fieldChoices(field).find((o) => o.value === value);
    return match ? match.label : (value ?? '');
}

/** Form alanları için boş başlangıç değerleri (checkbox → false, çoklu → []). */
export function initialValues(schema) {
    const out = {};
    for (const field of schema?.fields || []) {
        if (field.type === 'checkbox' || field.type === 'boolean') out[field.name] = false;
        else if (field.type === 'multiselect') out[field.name] = [];
        else out[field.name] = field.default ?? '';
    }
    return out;
}

/** Sunucuya gitmeden önce zorunlu alan / e-posta kontrolü (sunucu yine doğrular). */
export function validateValues(schema, values = {}) {
    const errors = {};
    for (const field of schema?.fields || []) {
        const value = values[field.name];
        const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length);

        if (field.required && empty) {
            errors[field.name] = `${field.label || field.name} zorunludur.`;
            continue;
        }
        if (!empty && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
            errors[field.name] = 'Geçerli bir e-posta adresi girin.';
        }
    }
    return errors;
}

/** Tarayıcıda captcha sağlayıcısının script'ini bir kez yükler. */
export function loadCaptchaScript(provider) {
    const src = CAPTCHA_SCRIPTS[provider];
    if (!src) return Promise.resolve(null);
    if (typeof document === 'undefined') return Promise.resolve(null);

    const globalName = provider === 'turnstile' ? 'turnstile' : 'grecaptcha';
    if (globalThis[globalName]) return Promise.resolve(globalThis[globalName]);

    const existing = document.querySelector(`script[data-adscrm-captcha="${provider}"]`);
    if (existing && existing.__adscrmPromise) return existing.__adscrmPromise;

    const script = existing || document.createElement('script');
    const promise = new Promise((resolve, reject) => {
        script.addEventListener('load', () => resolve(globalThis[globalName]));
        script.addEventListener('error', () => reject(new Error(`${provider} script yüklenemedi.`)));
    });
    script.__adscrmPromise = promise;

    if (!existing) {
        script.src = src;
        script.async = true;
        script.defer = true;
        script.dataset.adscrmCaptcha = provider;
        document.head.appendChild(script);
    }

    return promise;
}
