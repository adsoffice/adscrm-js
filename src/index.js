/**
 * @adsoffice/adscrm — AdsCRM Headless (Delivery) API istemcisi.
 *
 * Salt okunur: içerik, menü, slider, görünüm, dil değişkenleri ve arama.
 * Tek yazma ucu form gönderimidir (public, captcha korumalı).
 * Panel/Management API (yazma, süper admin) bu paketin kapsamı DIŞINDADIR.
 */

export { createClient } from './client.js';

export {
    AdsCrmError,
    AdsCrmNotFoundError,
    AdsCrmValidationError,
    AdsCrmRateLimitError,
    AdsCrmNetworkError,
    isNotFound,
    isValidationError,
    isRateLimited,
} from './errors.js';

export {
    toSegments,
    joinPath,
    sectionPath,
    itemPath,
    alternatePaths,
    splitLocale,
    resolveRoute,
    toMetadata,
} from './routing.js';

export {
    CAPTCHA_PROVIDERS,
    CAPTCHA_SCRIPTS,
    normalizeCaptcha,
    buildSubmitBody,
    initialValues,
    validateValues,
    loadCaptchaScript,
} from './forms.js';
