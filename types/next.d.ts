import type {
    AdsCrmClient, ClientOptions, ContentType, Locale, MetadataOptions, ResolvedPage, Site,
} from './index.js';

/** Next.js için ISR (60 sn) ve `cms` etiketi öntanımlı istemci. */
export function createCmsClient(options: ClientOptions): AdsCrmClient;

/** `revalidateTag` için etiket üretir: `tagFor('haberler')` → `cms:haberler`. */
export function tagFor(...parts: Array<string | undefined | null>): string;

export function staticSectionParams(
    client: AdsCrmClient,
    options?: { locales?: Locale[]; param?: string },
): Promise<Array<Record<string, string[]>>>;

export function staticItemParams(
    client: AdsCrmClient,
    options?: { locales?: Locale[]; types?: string[]; param?: string; limit?: number; max?: number },
): Promise<Array<Record<string, string[]>>>;

/** `generateMetadata` çıktısı — `cms.resolve()` sonucundan üretir. */
export function pageMetadata(resolved: ResolvedPage | null, options?: MetadataOptions): Record<string, unknown>;

/** `alternates.languages` için dil → yol haritası. */
export function languageAlternates(resolved: ResolvedPage | null, site?: Site | null): Record<Locale, string>;

export function isNotFound(error: unknown): boolean;

export type { ContentType, ResolvedPage };
