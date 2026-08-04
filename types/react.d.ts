import type { ReactNode, RefObject, FormEvent } from 'react';
import type {
    AdsCrmClient, CaptchaProvider, ContentItem, ContentType, FormField, FormSchema,
    ListResponse, Locale, LocaleInfo, LocalesResponse, Menu, MenuTreeEntry, MenuTreeResponse,
    RequestOptions, RoutesOptions, RoutesResponse, SearchResponse, SectionRoutes, Site,
    SiteRoute, SiteUrl, Slider, StringMap, SubmitResult, UrlsOptions, UrlsResponse, View,
} from './index.js';

export interface AdsCrmContextValue {
    client: AdsCrmClient;
    locale: Locale | null;
    setLocale(locale: Locale): void;
}

export function AdsCrmProvider(props: { client: AdsCrmClient; locale?: Locale; children?: ReactNode }): JSX.Element;
export function useAdsCrm(): AdsCrmContextValue;

export interface QueryResult<T> {
    data: T | null;
    error: Error | null;
    isLoading: boolean;
    isFetching: boolean;
    refetch(): Promise<T>;
}

export interface QueryOptions {
    enabled?: boolean;
    /** Aynı anahtar bu süre boyunca yeniden çekilmez (ms, varsayılan 30000). */
    staleTime?: number;
    initialData?: unknown;
}

export function useAdsCrmQuery<T>(
    key: unknown[] | string,
    fetcher: () => Promise<T>,
    options?: QueryOptions,
): QueryResult<T>;

export function invalidateAdsCrm(key?: unknown[] | string): void;

export function useSite(options?: RequestOptions): QueryResult<Site>;

export function useLocales(options?: RequestOptions): QueryResult<LocalesResponse> & {
    locales: Locale[];
    defaultLocale: Locale | null;
    current: Locale | null;
    items: LocaleInfo[];
    /** Provider'daki aktif dili değiştirir (hook'lar yeni dille yeniden çeker). */
    switchTo(locale: Locale): void;
};
export function useContentTypes(options?: RequestOptions): QueryResult<ContentType[]>;

export function useUrls(options?: UrlsOptions): QueryResult<UrlsResponse> & {
    urls: SiteUrl[];
    /** `byRef['p:101'].urls.en` */
    byRef: Record<string, SiteUrl>;
    meta: UrlsResponse['meta'] | null;
};

export function useRoutes(options?: RoutesOptions): QueryResult<RoutesResponse> & {
    sections: SectionRoutes[];
    routes: SiteRoute[];
    /** `byPath['/projeler/{slug}'].section` */
    byPath: Record<string, SiteRoute>;
    /** Dil kodu → ana sayfa yolu. */
    homepage: Record<Locale, string> | null;
    meta: RoutesResponse['meta'] | null;
};

export function useList(
    typeSlug: string,
    options?: RequestOptions & { page?: number; limit?: number },
): QueryResult<ListResponse> & { items: ContentItem[]; page: ContentItem | null; meta: ListResponse['meta'] | null };

export function useItem(typeSlug: string, itemSlug: string, options?: RequestOptions): QueryResult<ContentItem>;
export function usePage(typeSlug: string, options?: RequestOptions): QueryResult<ContentItem | null>;
export function useMenu(slugOrId: string | number, options?: RequestOptions): QueryResult<Menu>;

export function useMenuTree(
    options?: RequestOptions & { locales?: 'all' },
): QueryResult<MenuTreeResponse> & {
    menus: MenuTreeEntry[];
    bySlug: Record<string, MenuTreeEntry>;
    meta: MenuTreeResponse['meta'] | null;
};
export function useSlider(slug: string, options?: RequestOptions): QueryResult<Slider>;
export function useView(slug: string, options?: RequestOptions): QueryResult<View>;
export function useBlocks(slug: string, options?: RequestOptions): QueryResult<Record<string, unknown>> & {
    blocks: Record<string, unknown>;
};

export function useStrings(
    options?: RequestOptions & { keys?: string[] | string; group?: string; view?: string },
): QueryResult<StringMap> & { strings: StringMap; t(key: string, fallback?: string): string };

export function useSearch(
    term: string,
    options?: RequestOptions & { debounce?: number; limit?: number },
): QueryResult<SearchResponse> & { results: SearchResponse['data']; meta: SearchResponse['meta'] | null; isEmpty: boolean };

export interface AdsFormCaptcha {
    enabled: boolean;
    provider: CaptchaProvider;
    siteKey: string | null;
    honeypotField: string;
    /** math sağlayıcısında soru metni ("3 + 4"). */
    question: string | null;
    expiresAt: number | null;
    answer: string;
    setAnswer(value: string): void;
    /** recaptcha/turnstile token'ı — özel widget kullanıyorsanız kendiniz set edin. */
    token: string;
    setToken(value: string): void;
    honeypot: string;
    setHoneypot(value: string): void;
    refresh(): Promise<unknown>;
    /** Widget'ın basılacağı kap (recaptcha/turnstile). */
    widgetRef: RefObject<HTMLDivElement>;
    error: string | null;
}

export interface AdsFormState {
    schema: FormSchema | null;
    /** Açılır liste alanlarında `choices` ([{value,label}]) dolu gelir. */
    fields: FormField[];
    /** Kanonik değerin kullanıcının dilindeki etiketi (özet/onay ekranı için). */
    labelFor(fieldName: string, value: unknown): string;
    loading: boolean;
    loadError: Error | null;

    values: Record<string, unknown>;
    setValue(name: string, value: unknown): void;
    setValues(values: Record<string, unknown>): void;
    errors: Record<string, string | undefined>;
    error: Error | null;
    message: string | null;
    submitting: boolean;
    submitted: boolean;

    submit(): Promise<SubmitResult | null>;
    onSubmit(event?: FormEvent): Promise<SubmitResult | null>;
    reset(): void;

    captcha: AdsFormCaptcha;
}

export function useAdsForm(
    slug: string,
    options?: {
        onSuccess?(result: SubmitResult): void;
        onError?(error: Error): void;
        /** İstemci tarafı zorunlu alan/e-posta kontrolü (varsayılan açık). */
        validate?: boolean;
    },
): AdsFormState;

export function Captcha(props: { form: AdsFormState; className?: string; label?: ReactNode }): JSX.Element | null;
export function HoneypotField(props: { form: AdsFormState }): JSX.Element | null;
