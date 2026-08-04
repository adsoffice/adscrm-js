/**
 * @adsoffice/adscrm — tip tanımları.
 * Paket saf ESM JavaScript'tir; tipler elle yazılmıştır (derleme adımı yok).
 */

/* ─────────────────────────────────────────────────────────── veri tipleri */

export type Locale = string;

export interface SeoInfo {
    title: string | null;
    description: string | null;
    slug: string;
}

export interface TrackingCodes {
    google_analytics_id: string | null;
    google_tag_manager_id: string | null;
    google_ads_id: string | null;
    google_site_verification: string | null;
    meta_pixel_id: string | null;
    meta_domain_verification: string | null;
    head_html: string | null;
    body_html: string | null;
}

export interface Site {
    name: string;
    domain: string | null;
    locales: Locale[];
    default_locale: Locale;
    tracking: TrackingCodes;
    homepage: { name: string; slug: string; paths: Record<Locale, string> } | null;
}

export interface LocaleInfo {
    code: Locale;
    /** Dilin kendi dilindeki adı: Türkçe, English, Русский… */
    name: string;
    is_default: boolean;
    is_current: boolean;
    /** URL öneki — varsayılan dilde boş string, diğerlerinde `/en`. */
    prefix: string;
    /** O dilin ana sayfa yolu: `/` · `/en`. */
    home_path: string;
}

export interface LocalesResponse {
    locales: Locale[];
    default: Locale;
    /** `?locale=` ile çözülen dil (geçersizse varsayılana düşer). */
    current: Locale;
    items: LocaleInfo[];
}

export interface Tracking {
    codes: TrackingCodes;
    head_html: string;
    body_html: string;
}

export type FieldType =
    | 'text' | 'textarea' | 'richtext' | 'number' | 'boolean' | 'date' | 'datetime'
    | 'select' | 'multiselect' | 'image' | 'gallery' | 'file' | 'relation'
    | 'slug' | 'color' | 'json' | 'category';

export interface FieldDefinition {
    id: number;
    group: 'item' | 'page';
    name: string;
    slug: string;
    type: FieldType;
}

export interface ContentType {
    id: number;
    name: string;
    slug: string;
    path: string;
    paths: Record<Locale, string>;
    is_collection: boolean;
    is_homepage: boolean;
    icon: string | null;
    translations: Record<Locale, { name: string; slug: string }> | null;
    fields: FieldDefinition[];
}

export type LinkKind = 'section' | 'page' | 'category';

/** `GET /urls` kaydı — bir hedefin tüm dillerdeki adresi. */
export interface SiteUrl {
    /** Dilden bağımsız kimlik: `s:12` (bölüm) · `p:101` (sayfa) · `c:3` (kategori). */
    ref: string;
    kind: LinkKind;
    /** Bağlı olduğu bölümün varsayılan dildeki slug'ı. */
    section: string;
    /** Panelde görünen grup adı (kategorilerde `… · Kategoriler`). */
    group: string;
    /** Dil kodu → URL. Varsayılan dil öneksiz, diğerleri `/en` önekli. */
    urls: Record<Locale, string>;
    /** Dil kodu → görünen ad. */
    labels: Record<Locale, string>;
    /** Yalnızca `page` kayıtlarında. */
    status?: ContentItem['status'];
    /** Yalnızca `section` kayıtlarında. */
    is_homepage?: boolean;
    is_collection?: boolean;
    published_at?: string | null;
    updated_at?: string | null;
}

/** `?flat=1` biçimi — dil başına bir satır. */
export interface SiteUrlFlat {
    ref: string;
    url: string;
    label: string;
    group: string;
    locale: Locale;
    kind: LinkKind;
}

export interface UrlsResponse<T = SiteUrl> {
    data: T[];
    meta: {
        locales: Locale[];
        default_locale: Locale;
        total: number;
        /** `limit` aşıldıysa liste kesilmiştir. */
        truncated: boolean;
    };
}

/** Dinamik segment biçimi: `{slug}` · `[slug]` · `:slug` · `(slug)`. */
export type RouteStyle = 'brace' | 'next' | 'colon' | 'paren';

/** Bir bölümün tek bir dildeki yolları. */
export interface SectionRoutePaths {
    name: string;
    slug: string;
    /** Bölümün **sabit** yolu — kalıp değil: `/projeler` · `/en/projects`. */
    section: string;
    /** Detay sayfası kalıbı. Tekil (koleksiyon olmayan) bölümlerde `null`. */
    page: string | null;
    /** Kategori listesi kalıbı. Kategoriler kapalıysa `null`. */
    category: string | null;
    category_prefix: string | null;
}

/** `GET /routes` → `data.sections[]`. */
export interface SectionRoutes {
    /** `/urls` ile aynı kimlik: `s:12`. */
    ref: string;
    id: number;
    /** Varsayılan dildeki ad ve slug. */
    name: string;
    slug: string;
    is_homepage: boolean;
    is_collection: boolean;
    categories_enabled: boolean;
    /** Bölümün kendi (is_index) sayfası oluşturulmuş mu. */
    has_index_page: boolean;
    /** Yayındaki alt sayfa sayısı — somut adresler için `urls()`. */
    page_count: number;
    /** Dil kodu → o dildeki yollar. */
    locales: Record<Locale, SectionRoutePaths>;
}

/** `GET /routes` → `data.routes[]` (düz liste: dil × tür başına bir satır). */
export interface SiteRoute {
    kind: LinkKind;
    locale: Locale;
    ref: string;
    /** Bağlı olduğu bölümün varsayılan dildeki slug'ı. */
    section: string;
    /** `/projeler` · `/projeler/{slug}` · `/en/projects/categories/{slug}` */
    path: string;
    /** Kalıptaki değişken adları — şimdilik `['slug']` ya da boş. */
    params: string[];
    is_dynamic: boolean;
}

export interface RoutesResponse {
    data: {
        locales: Locale[];
        default_locale: Locale;
        /** Dil kodu → ana sayfa yolu (`/`, `/en`). */
        homepage: Record<Locale, string>;
        sections: SectionRoutes[];
        routes: SiteRoute[];
    };
    meta: {
        locales: Locale[];
        default_locale: Locale;
        /** Kullanılan biçim (tanınmayan değer `brace`'e düşer). */
        style: RouteStyle;
        styles: RouteStyle[];
        sections: number;
        total: number;
    };
}

export interface RoutesOptions extends RequestOptions {
    /** Dinamik segment biçimi (öntanımlı `brace`). */
    style?: RouteStyle;
    /** Düz `routes` listesini süzer. */
    kind?: LinkKind | LinkKind[] | string;
    /** Yalnızca bir bölüm (herhangi bir dildeki slug). `homepage`'i etkilemez. */
    type?: string;
}

export interface UrlsOptions extends RequestOptions {
    kind?: LinkKind | LinkKind[] | string;
    /** Yalnızca bir bölüm (herhangi bir dildeki slug). */
    type?: string;
    /** Bölüm başına alt sayfa üst sınırı (öntanımlı 2000). */
    limit?: number;
    /** Dil başına bir satır döndürür. */
    flat?: boolean;
}

export interface GalleryValue {
    id: number;
    name: string;
    slug: string;
    images: Array<{ id: number; url: string; alt: string | null }>;
}

export interface CategoryValue {
    id: number;
    name: string;
    slug: string;
    parent_id: number | null;
}

export type FieldValue =
    | string | number | boolean | null
    | string[] | GalleryValue | CategoryValue[]
    | Record<string, unknown> | unknown[];

/** İçerik kaydı: sabit alanlar + alan slug'ları → değer. */
export interface ContentItem {
    id: number;
    slug: string;
    status: 'published' | 'draft' | 'scheduled' | 'archived';
    order: number | null;
    published_at: string | null;
    seo: SeoInfo;
    [field: string]: FieldValue | SeoInfo | undefined;
}

export interface ListResponse<T = ContentItem> {
    data: T[];
    /** Bölümün kendi sayfası (tekil sayfada içerik burada). */
    page: ContentItem | null;
    meta: { total: number; page: number; last_page: number; per_page: number };
}

export interface SearchResponse {
    data: Array<ContentItem & { _type: { name: string; slug: string } }>;
    meta: { query: string; total: number };
}

export interface MenuItem {
    id: number;
    label: string;
    url: string;
    target: '_self' | '_blank';
    children: MenuItem[];
}

export interface Menu {
    id: number;
    name: string;
    slug: string;
    items: MenuItem[];
}

/** `menus/tree` yanıtındaki menü — `locales: 'all'` isteğinde `items_by_locale` gelir. */
export interface MenuTreeEntry {
    id: number;
    name: string;
    slug: string;
    items?: MenuItem[];
    items_by_locale?: Record<Locale, MenuItem[]>;
}

export interface MenuTreeResponse {
    data: MenuTreeEntry[];
    meta: {
        locale?: Locale;
        locales?: Locale[];
        default_locale: Locale;
        total: number;
    };
}

export interface Slide {
    id: number;
    type: 'image' | 'video';
    media_url: string;
    poster_url: string | null;
    title: string | null;
    subtitle: string | null;
    link: string | null;
    [extra: string]: unknown;
}

export interface Slider {
    name: string;
    slug: string;
    settings: Record<string, unknown>;
    slides: Slide[];
}

export type ViewBlockType = 'slider' | 'content_list' | 'category_items' | 'page' | 'item' | 'form' | 'menu';

export interface ViewBlock {
    key: string;
    type: ViewBlockType;
    label: string;
    data: unknown;
}

export interface View {
    name: string;
    slug: string;
    blocks: ViewBlock[];
    strings?: Record<string, string>;
}

export type StringMap = Record<string, string>;
export type StringMatrix = Record<string, Record<Locale, string>>;

/* ────────────────────────────────────────────────────────────── formlar */

export type CaptchaProvider = 'honeypot' | 'math' | 'recaptcha' | 'turnstile';

export interface FormField {
    name: string;
    label: string;
    type: string;
    required?: boolean;
    options?: string[];
    placeholder?: string;
    default?: unknown;
}

export interface FormSchema {
    name: string;
    slug: string;
    description: string | null;
    fields: FormField[];
    captcha: {
        enabled: boolean;
        provider: CaptchaProvider;
        site_key: string | null;
        honeypot_field: string;
    };
}

export interface CaptchaChallenge {
    enabled: boolean;
    provider: CaptchaProvider;
    /** math: "3 + 4" */
    question?: string;
    /** math: imzalı token */
    token?: string;
    /** math: unix zaman damgası */
    expires_at?: number;
    /** recaptcha/turnstile */
    site_key?: string;
    /** honeypot alan adı */
    field?: string;
}

export interface SubmitResult {
    message: string;
    id: number;
}

export interface CaptchaPayload {
    provider?: CaptchaProvider;
    token?: string;
    answer?: string | number;
    expiresAt?: number;
    field?: string;
    honeypotField?: string;
}

/* ───────────────────────────────────────────────────────── istemci */

export interface RequestOptions {
    /** Bu çağrı için dil (istemci varsayılanını ezer). */
    locale?: Locale | null;
    /** Next.js ISR süresi (sn). `0` → önbelleklenmez. */
    revalidate?: number | false;
    /** Next.js cache etiketleri. */
    tags?: string[];
    cache?: RequestCache;
    signal?: AbortSignal;
    headers?: Record<string, string>;
    /** Ek sorgu parametreleri. */
    query?: Record<string, string | number | boolean | undefined>;
    retries?: number;
}

export interface ClientOptions {
    /** `https://crm.adsoffice.net` ya da tam delivery adresi. */
    baseUrl: string;
    /** Sitenin Delivery API tokenı (Panel → Ayarlar → API). */
    token?: string;
    /** Varsayılan dil; verilmezse sunucunun varsayılanı kullanılır. */
    locale?: Locale;
    /** Tüm GET istekleri için varsayılan ISR süresi (sn). */
    revalidate?: number | false;
    /** Tüm GET istekleri için varsayılan cache etiketleri. */
    tags?: string[];
    /** Zaman aşımı (ms), varsayılan 15000. */
    timeout?: number;
    /** GET yeniden deneme sayısı, varsayılan 2. */
    retries?: number;
    retryDelay?: number;
    headers?: Record<string, string>;
    fetch?: typeof fetch;
}

export type RouteKind = 'home' | 'section' | 'item' | 'notFound';

export interface RouteMatch {
    kind: RouteKind;
    locale: Locale;
    prefixed: boolean;
    type: ContentType | null;
    itemSlug: string | null;
    segments: string[];
    site?: Site;
}

export interface ResolvedPage extends RouteMatch {
    /** `item` → tek kayıt · `section`/`home` → liste. */
    data: ContentItem | ContentItem[] | null;
    page: ContentItem | null;
    meta: ListResponse['meta'] | null;
    seo: SeoInfo | null;
}

export interface AdsCrmClient {
    readonly config: Required<Pick<ClientOptions, 'baseUrl'>> & ClientOptions & { base: string };

    withLocale(locale: Locale): AdsCrmClient;
    clearMemo(): void;
    raw<T = unknown>(path: string, options?: RequestOptions & { method?: string; body?: unknown }): Promise<T>;

    site(options?: RequestOptions): Promise<Site>;
    /** Etkin diller + varsayılan dil (dil seçici / hreflang). */
    locales(options?: RequestOptions): Promise<LocalesResponse>;
    /** Yalnızca varsayılan dil kodu. */
    defaultLocale(options?: RequestOptions): Promise<Locale>;
    tracking(options?: RequestOptions): Promise<Tracking>;

    contentTypes(options?: RequestOptions): Promise<ContentType[]>;
    contentType(slug: string, options?: RequestOptions): Promise<ContentType | null>;

    /** Sitenin tüm public adresleri, her dilde (sitemap.xml / hreflang). */
    urls(options?: UrlsOptions & { flat?: false }): Promise<UrlsResponse<SiteUrl>>;
    urls(options: UrlsOptions & { flat: true }): Promise<UrlsResponse<SiteUrlFlat>>;
    /** Aynı veri, `ref → kayıt` haritası olarak. */
    urlMap(options?: UrlsOptions): Promise<Record<string, SiteUrl>>;

    /** Sitenin adres **yapısı**: bölüm yolları + detay/kategori kalıpları, her dilde. */
    routes(options?: RoutesOptions): Promise<RoutesResponse>;
    /** Aynı veri, `yol → satır` haritası olarak. */
    routeMap(options?: RoutesOptions): Promise<Record<string, SiteRoute>>;
    /** Yalnızca dinamik kalıplar (detay + kategori). */
    dynamicRoutes(options?: RoutesOptions): Promise<SiteRoute[]>;

    list(typeSlug: string, options?: RequestOptions & { page?: number; limit?: number }): Promise<ListResponse>;
    item(typeSlug: string, itemSlug: string, options?: RequestOptions): Promise<ContentItem>;
    page(typeSlug: string, options?: RequestOptions): Promise<ContentItem | null>;
    homepage(options?: RequestOptions & { limit?: number }): Promise<ListResponse>;
    allItems(typeSlug: string, options?: RequestOptions & { limit?: number; max?: number }): Promise<ContentItem[]>;
    search(q: string, options?: RequestOptions & { limit?: number }): Promise<SearchResponse>;

    menus(options?: RequestOptions): Promise<Array<{ id: number; name: string; slug: string }>>;
    /** Tüm menüler + ağaçları tek istekte. `locales: 'all'` → `items_by_locale`. */
    menuTree(options?: RequestOptions & { locales?: 'all' }): Promise<MenuTreeResponse>;
    /** Aynı veri, `slug → menü` haritası olarak. */
    menuMap(options?: RequestOptions & { locales?: 'all' }): Promise<Record<string, MenuTreeEntry>>;
    /** Tek menü — slug ya da id ile. */
    menu(slugOrId: string | number, options?: RequestOptions): Promise<Menu>;
    sliders(options?: RequestOptions): Promise<Array<{ id: number; name: string; slug: string }>>;
    slider(slug: string, options?: RequestOptions): Promise<Slider>;

    view(slug: string, options?: RequestOptions): Promise<View>;
    blocks(slug: string, options?: RequestOptions): Promise<Record<string, unknown>>;

    strings(options?: RequestOptions & { keys?: string[] | string; group?: string; locales?: 'all' }): Promise<StringMap | StringMatrix>;
    string(key: string, options?: RequestOptions): Promise<string>;
    viewStrings(slug: string, options?: RequestOptions & { locales?: 'all' }): Promise<StringMap | StringMatrix>;

    form(slug: string, options?: RequestOptions): Promise<FormSchema>;
    formCaptcha(slug: string, options?: RequestOptions): Promise<CaptchaChallenge>;
    submitForm(
        slug: string,
        values: Record<string, unknown>,
        options?: RequestOptions & { captcha?: CaptchaPayload; honeypot?: string },
    ): Promise<SubmitResult>;

    route(path: string | string[]): Promise<RouteMatch>;
    resolve(path: string | string[], options?: RequestOptions & { limit?: number }): Promise<ResolvedPage>;

    path(type: ContentType, locale?: Locale): string;
    itemPath(type: ContentType, item: ContentItem | string, locale?: Locale): string;
    alternates(type: ContentType, item?: ContentItem): Promise<Record<Locale, string>>;
    segments(path: string | string[]): string[];
}

export function createClient(options: ClientOptions): AdsCrmClient;

/* ───────────────────────────────────────────────────────────── hatalar */

export class AdsCrmError extends Error {
    status: number;
    url: string;
    body: unknown;
    constructor(message: string, meta?: { status?: number; url?: string; body?: unknown; cause?: unknown });
}
export class AdsCrmNotFoundError extends AdsCrmError {}
export class AdsCrmValidationError extends AdsCrmError {
    errors: Record<string, string[]>;
    fieldError(field: string): string | undefined;
    fieldErrors(): Record<string, string>;
}
export class AdsCrmRateLimitError extends AdsCrmError {
    retryAfter: number | null;
}
export class AdsCrmNetworkError extends AdsCrmError {}

export function isNotFound(error: unknown): boolean;
export function isValidationError(error: unknown): boolean;
export function isRateLimited(error: unknown): boolean;

/* ──────────────────────────────────────────────────── yol yardımcıları */

export function toSegments(path: string | string[]): string[];
export function joinPath(...parts: Array<string | string[]>): string;
export function sectionPath(type: ContentType, locale: Locale): string;
export function itemPath(type: ContentType, item: ContentItem | string, locale: Locale): string;
export function alternatePaths(type: ContentType, locales: Locale[], item?: ContentItem): Record<Locale, string>;
export function splitLocale(path: string | string[], site: Site): { locale: Locale; rest: string[]; prefixed: boolean };
export function resolveRoute(path: string | string[], context: { site: Site; types: ContentType[] }): RouteMatch;

export interface MetadataOptions {
    siteName?: string;
    url?: string;
    image?: string;
    locale?: Locale;
    alternates?: Record<string, string>;
    titleTemplate?: string;
    title?: string;
    description?: string;
    type?: string;
}

export function toMetadata(entity: { seo?: SeoInfo } | null, options?: MetadataOptions): Record<string, unknown>;

/* ─────────────────────────────────────────────────────── form yardımcıları */

export const CAPTCHA_PROVIDERS: CaptchaProvider[];
export const CAPTCHA_SCRIPTS: Record<string, string>;

export function normalizeCaptcha(schema: FormSchema | null): {
    enabled: boolean;
    provider: CaptchaProvider;
    siteKey: string | null;
    honeypotField: string;
};
export function buildSubmitBody(
    values: Record<string, unknown>,
    options?: { captcha?: CaptchaPayload; honeypot?: string },
): Record<string, unknown>;
export function initialValues(schema: FormSchema | null): Record<string, unknown>;
export function validateValues(schema: FormSchema | null, values: Record<string, unknown>): Record<string, string>;
export function loadCaptchaScript(provider: CaptchaProvider): Promise<unknown>;
