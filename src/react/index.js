/**
 * React katmanı — provider, veri hook'ları ve captcha destekli form hook'u.
 *
 * JSX kullanılmaz (`createElement`), böylece paket derleme adımı olmadan
 * doğrudan git'ten kurulup kullanılabilir.
 */

import {
    createContext,
    createElement,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import {
    initialValues as buildInitialValues,
    loadCaptchaScript,
    normalizeCaptcha,
    validateValues,
} from '../forms.js';
import { isValidationError } from '../errors.js';

/* ────────────────────────────────────────────────────────── context */

const AdsCrmContext = createContext(null);

/**
 * Uygulamayı istemciyle sarar. Sunucu bileşenlerinde provider'a gerek yoktur;
 * bu katman yalnızca istemci ("use client") tarafı içindir.
 */
export function AdsCrmProvider({ client, locale, children }) {
    const [current, setCurrent] = useState(locale);

    useEffect(() => {
        setCurrent(locale);
    }, [locale]);

    const value = useMemo(
        () => ({
            client: current ? client.withLocale(current) : client,
            locale: current ?? client.config.locale ?? null,
            setLocale: setCurrent,
        }),
        [client, current],
    );

    return createElement(AdsCrmContext.Provider, { value }, children);
}

export function useAdsCrm() {
    const context = useContext(AdsCrmContext);
    if (!context) {
        throw new Error('useAdsCrm: bileşeni <AdsCrmProvider client={…}> içine alın.');
    }
    return context;
}

/* ──────────────────────────────────────────────────── sorgu altyapısı */

/** Basit modül içi önbellek: aynı anahtar için tek istek + kısa süreli tazelik. */
const store = new Map();

function cacheKeyOf(key) {
    return (Array.isArray(key) ? key : [key])
        .map((part) => (part === undefined || part === null ? '' : typeof part === 'object' ? JSON.stringify(part) : String(part)))
        .join('|');
}

/** Bir anahtarı (veya tümünü) önbellekten düşürür. */
export function invalidateAdsCrm(key) {
    if (key === undefined) return store.clear();
    store.delete(cacheKeyOf(key));
}

/**
 * Genel amaçlı veri hook'u — istemci tarafı çağrılar için.
 * `{ data, error, isLoading, isFetching, refetch }` döner.
 */
export function useAdsCrmQuery(key, fetcher, { enabled = true, staleTime = 30000, initialData = null } = {}) {
    const cacheKey = cacheKeyOf(key);
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    const readCache = () => {
        const hit = store.get(cacheKey);
        return hit && Date.now() - hit.time < staleTime ? hit : null;
    };

    const [state, setState] = useState(() => {
        const hit = readCache();
        return {
            data: hit ? hit.data : initialData,
            error: null,
            isLoading: enabled && !hit,
            isFetching: enabled && !hit,
        };
    });

    const run = useCallback(
        (force = false) => {
            if (!enabled) return Promise.resolve(null);

            const hit = force ? null : readCache();
            if (hit) {
                setState({ data: hit.data, error: null, isLoading: false, isFetching: false });
                return Promise.resolve(hit.data);
            }

            setState((s) => ({ ...s, isFetching: true, isLoading: s.data === null }));

            const entry = store.get(cacheKey);
            const promise = !force && entry?.promise ? entry.promise : Promise.resolve().then(() => fetcherRef.current());
            store.set(cacheKey, { ...(entry || {}), promise, time: entry?.time ?? 0 });

            return promise.then(
                (data) => {
                    store.set(cacheKey, { data, time: Date.now(), promise: null });
                    return data;
                },
                (error) => {
                    store.delete(cacheKey);
                    throw error;
                },
            );
        },
        [cacheKey, enabled, staleTime],
    );

    useEffect(() => {
        let alive = true;
        if (!enabled) {
            setState((s) => ({ ...s, isLoading: false, isFetching: false }));
            return undefined;
        }

        run().then(
            (data) => alive && setState({ data, error: null, isLoading: false, isFetching: false }),
            (error) => alive && setState((s) => ({ ...s, error, isLoading: false, isFetching: false })),
        );

        return () => {
            alive = false;
        };
    }, [cacheKey, enabled, run]);

    const refetch = useCallback(
        () =>
            run(true).then(
                (data) => {
                    setState({ data, error: null, isLoading: false, isFetching: false });
                    return data;
                },
                (error) => {
                    setState((s) => ({ ...s, error, isLoading: false, isFetching: false }));
                    throw error;
                },
            ),
        [run],
    );

    return { ...state, refetch };
}

/* ─────────────────────────────────────────────────────── veri hook'ları */

export function useSite(options) {
    const { client, locale } = useAdsCrm();
    return useAdsCrmQuery(['site', locale], () => client.site(options));
}

export function useContentTypes(options) {
    const { client, locale } = useAdsCrm();
    return useAdsCrmQuery(['content-types', locale], () => client.contentTypes(options));
}

/** Koleksiyon listesi — `{ items, page, meta }` olarak da açılır. */
export function useList(typeSlug, options = {}) {
    const { client, locale } = useAdsCrm();
    const query = useAdsCrmQuery(
        ['list', typeSlug, locale, options.page, options.limit],
        () => client.list(typeSlug, options),
        { enabled: !!typeSlug },
    );
    return {
        ...query,
        items: query.data?.data ?? [],
        page: query.data?.page ?? null,
        meta: query.data?.meta ?? null,
    };
}

export function useItem(typeSlug, itemSlug, options) {
    const { client, locale } = useAdsCrm();
    return useAdsCrmQuery(['item', typeSlug, itemSlug, locale], () => client.item(typeSlug, itemSlug, options), {
        enabled: !!typeSlug && !!itemSlug,
    });
}

/** Tekil sayfa bölümünün (veya koleksiyon ana sayfasının) içeriği. */
export function usePage(typeSlug, options) {
    const { client, locale } = useAdsCrm();
    return useAdsCrmQuery(['page', typeSlug, locale], () => client.page(typeSlug, options), { enabled: !!typeSlug });
}

export function useMenu(slug, options) {
    const { client, locale } = useAdsCrm();
    return useAdsCrmQuery(['menu', slug, locale], () => client.menu(slug, options), { enabled: !!slug });
}

export function useSlider(slug, options) {
    const { client, locale } = useAdsCrm();
    return useAdsCrmQuery(['slider', slug, locale], () => client.slider(slug, options), { enabled: !!slug });
}

export function useView(slug, options) {
    const { client, locale } = useAdsCrm();
    return useAdsCrmQuery(['view', slug, locale], () => client.view(slug, options), { enabled: !!slug });
}

/** Görünüm bloklarını `key → data` haritası olarak verir. */
export function useBlocks(slug, options) {
    const { client, locale } = useAdsCrm();
    const query = useAdsCrmQuery(['blocks', slug, locale], () => client.blocks(slug, options), { enabled: !!slug });
    return { ...query, blocks: query.data ?? {} };
}

/**
 * Dil değişkenleri + `t()` yardımcısı.
 * `const { t } = useStrings({ group: 'footer' })` → `t('footer_copyright')`
 */
export function useStrings(options = {}) {
    const { client, locale } = useAdsCrm();
    const query = useAdsCrmQuery(['strings', locale, options.group, options.keys, options.view], () =>
        options.view ? client.viewStrings(options.view, options) : client.strings(options),
    );

    const t = useCallback(
        (key, fallback = '') => {
            const value = query.data?.[key];
            if (value === undefined || value === null) return fallback || key;
            return typeof value === 'object' ? value[locale] ?? fallback ?? key : value;
        },
        [query.data, locale],
    );

    return { ...query, strings: query.data ?? {}, t };
}

/** Arama — `debounce` ms boyunca yazma durunca istek atar. */
export function useSearch(term, { debounce = 300, limit, ...options } = {}) {
    const { client, locale } = useAdsCrm();
    const [debounced, setDebounced] = useState(term);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(term), debounce);
        return () => clearTimeout(timer);
    }, [term, debounce]);

    const enabled = !!debounced && String(debounced).trim().length >= 2;
    const query = useAdsCrmQuery(
        ['search', debounced, locale, limit],
        () => client.search(debounced, { limit, ...options }),
        { enabled, staleTime: 10000 },
    );

    return { ...query, results: query.data?.data ?? [], meta: query.data?.meta ?? null, isEmpty: enabled && !(query.data?.data || []).length };
}

/* ────────────────────────────────────────────────────────────── formlar */

/**
 * Form durumu + captcha akışı tek hook'ta.
 *
 * ```jsx
 * const form = useAdsForm('iletisim');
 * <form onSubmit={form.onSubmit}>
 *   <input value={form.values.ad} onChange={(e) => form.setValue('ad', e.target.value)} />
 *   <Captcha form={form} />
 *   <button disabled={form.submitting}>Gönder</button>
 * </form>
 * ```
 */
export function useAdsForm(slug, { onSuccess, onError, validate = true } = {}) {
    const { client, locale } = useAdsCrm();
    const schemaQuery = useAdsCrmQuery(['form', slug, locale], () => client.form(slug), { enabled: !!slug });
    const schema = schemaQuery.data;

    const [values, setValues] = useState({});
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const settings = useMemo(() => normalizeCaptcha(schema), [schema]);

    // Şema gelince alanları başlat.
    useEffect(() => {
        if (schema) setValues(buildInitialValues(schema));
    }, [schema]);

    /* ── captcha durumu ── */
    const [challenge, setChallenge] = useState(null); // math: { question, token, expires_at }
    const [answer, setAnswer] = useState('');
    const [token, setToken] = useState('');
    // Honeypot: insan boş bırakır, bot doldurur → sunucu sessizce spam işaretler.
    const [honeypot, setHoneypot] = useState('');
    const widgetRef = useRef(null);
    const widgetId = useRef(null);

    const refreshCaptcha = useCallback(() => {
        if (!slug || !settings.enabled || settings.provider !== 'math') return Promise.resolve(null);
        return client.formCaptcha(slug).then((data) => {
            setChallenge(data);
            setAnswer('');
            return data;
        });
    }, [client, slug, settings.enabled, settings.provider]);

    useEffect(() => {
        refreshCaptcha();
    }, [refreshCaptcha]);

    // reCAPTCHA / Turnstile widget'ı — script yüklenip alan render edilir.
    useEffect(() => {
        if (!settings.enabled || !['recaptcha', 'turnstile'].includes(settings.provider)) return undefined;
        if (!settings.siteKey || !widgetRef.current) return undefined;

        let cancelled = false;
        loadCaptchaScript(settings.provider)
            .then((api) => {
                if (cancelled || !api || !widgetRef.current || widgetId.current !== null) return;
                const render = () => {
                    widgetId.current = api.render(widgetRef.current, {
                        sitekey: settings.siteKey,
                        callback: (value) => setToken(value),
                        'expired-callback': () => setToken(''),
                        'error-callback': () => setToken(''),
                    });
                };
                if (settings.provider === 'recaptcha' && api.ready) api.ready(render);
                else render();
            })
            .catch((err) => setError(err));

        return () => {
            cancelled = true;
        };
    }, [settings.enabled, settings.provider, settings.siteKey]);

    const resetWidget = useCallback(() => {
        setToken('');
        const api = globalThis[settings.provider === 'turnstile' ? 'turnstile' : 'grecaptcha'];
        if (api?.reset && widgetId.current !== null) {
            try {
                api.reset(widgetId.current);
            } catch {
                /* widget kaldırılmış olabilir */
            }
        }
    }, [settings.provider]);

    const setValue = useCallback((name, value) => {
        setValues((v) => ({ ...v, [name]: value }));
        setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
    }, []);

    const reset = useCallback(() => {
        setValues(schema ? buildInitialValues(schema) : {});
        setErrors({});
        setMessage(null);
        setError(null);
        setSubmitted(false);
    }, [schema]);

    const submit = useCallback(async () => {
        if (!schema) return null;

        setError(null);
        setMessage(null);

        if (validate) {
            const local = validateValues(schema, values);
            if (Object.keys(local).length) {
                setErrors(local);
                return null;
            }
        }

        // Captcha ön kontrolü — boşuna istek atmayalım.
        if (settings.enabled) {
            if (settings.provider === 'math' && !String(answer).trim()) {
                setErrors((e) => ({ ...e, _captcha: 'Lütfen güvenlik sorusunu yanıtlayın.' }));
                return null;
            }
            if (['recaptcha', 'turnstile'].includes(settings.provider) && !token) {
                setErrors((e) => ({ ...e, _captcha: 'Lütfen doğrulamayı tamamlayın.' }));
                return null;
            }
        }

        setSubmitting(true);
        try {
            const result = await client.submitForm(slug, values, {
                honeypot,
                captcha: {
                    provider: settings.provider,
                    field: settings.honeypotField,
                    answer,
                    token: settings.provider === 'math' ? challenge?.token : token,
                    expiresAt: challenge?.expires_at,
                },
            });

            setSubmitted(true);
            setErrors({});
            setMessage(result?.message || 'Form gönderildi.');
            setValues(buildInitialValues(schema));
            resetWidget();
            refreshCaptcha();
            onSuccess?.(result);
            return result;
        } catch (err) {
            if (isValidationError(err)) setErrors(err.fieldErrors());
            setError(err);
            resetWidget();
            refreshCaptcha();
            onError?.(err);
            return null;
        } finally {
            setSubmitting(false);
        }
    }, [
        client, slug, schema, values, validate, settings, answer, token, challenge, honeypot,
        onSuccess, onError, refreshCaptcha, resetWidget,
    ]);

    const onSubmit = useCallback(
        (event) => {
            event?.preventDefault?.();
            return submit();
        },
        [submit],
    );

    return {
        schema,
        fields: schema?.fields ?? [],
        loading: schemaQuery.isLoading,
        loadError: schemaQuery.error,

        values,
        setValue,
        setValues,
        errors,
        error,
        message,
        submitting,
        submitted,
        submit,
        onSubmit,
        reset,

        captcha: {
            ...settings,
            question: challenge?.question ?? null,
            expiresAt: challenge?.expires_at ?? null,
            answer,
            setAnswer,
            token,
            setToken,
            honeypot,
            setHoneypot,
            refresh: refreshCaptcha,
            widgetRef,
            error: errors._captcha ?? null,
        },
    };
}

/* ─────────────────────────────────────────────────── captcha bileşeni */

/**
 * Sağlayıcıya göre doğru captcha arayüzünü basar:
 * honeypot → gizli alan · math → soru + cevap · recaptcha/turnstile → widget.
 * Görünümü kendiniz kurmak isterseniz `form.captcha` alanlarını kullanın.
 */
export function Captcha({ form, className, label, ...rest }) {
    const captcha = form?.captcha;
    if (!captcha || !captcha.enabled) return null;

    if (captcha.provider === 'honeypot') {
        // Değer form state'inde tutulur; gönderimde olduğu gibi iletilir.
        return createElement('input', {
            type: 'text',
            name: captcha.honeypotField,
            tabIndex: -1,
            autoComplete: 'off',
            'aria-hidden': 'true',
            value: captcha.honeypot,
            onChange: (event) => captcha.setHoneypot(event.target.value),
            style: { position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 },
            ...rest,
        });
    }

    if (captcha.provider === 'math') {
        return createElement(
            'div',
            { className, ...rest },
            createElement(
                'label',
                null,
                label || `${captcha.question ?? '…'} = `,
                createElement('input', {
                    type: 'text',
                    inputMode: 'numeric',
                    value: captcha.answer,
                    onChange: (event) => captcha.setAnswer(event.target.value),
                    'aria-invalid': captcha.error ? 'true' : undefined,
                }),
            ),
            captcha.error ? createElement('p', { role: 'alert' }, captcha.error) : null,
        );
    }

    return createElement(
        'div',
        { className, ...rest },
        createElement('div', { ref: captcha.widgetRef }),
        captcha.error ? createElement('p', { role: 'alert' }, captcha.error) : null,
    );
}

/** Yalnızca honeypot alanını basmak isteyenler için. */
export function HoneypotField({ form, ...rest }) {
    if (form?.captcha?.provider !== 'honeypot') return null;
    return createElement(Captcha, { form, ...rest });
}
