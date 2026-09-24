# Frontend Developer Guide — Connecting a site to AdsCRM (Headless CMS)

> **Audience:** front‑end developers building a website (Next.js / React) on top of the
> **AdsCRM Headless CMS**. You will connect to the read‑only **Delivery API** through the
> [`@adsoffice/adscrm`](../README.md) package and render a complete, multilingual site whose
> pages, menus, sliders, categories, forms and SEO all come from the panel.
>
> 🇹🇷 Türkçe sürüm: [GUIDE.tr.md](GUIDE.tr.md) · 📚 Full API reference: [README.md](../README.md)

---

## Table of contents

1. [How AdsCRM works (the mental model)](#1-how-adscrm-works-the-mental-model)
2. [What the site admin manages vs. what you fetch](#2-what-the-site-admin-manages-vs-what-you-fetch)
3. [Prerequisites & getting your Delivery token](#3-prerequisites--getting-your-delivery-token)
4. [Project setup](#4-project-setup)
5. [The CMS client (`lib/cms`)](#5-the-cms-client-libcms)
6. [Serve the whole site from one route](#6-serve-the-whole-site-from-one-route)
7. [Rendering content](#7-rendering-content-lists-items-single-pages)
8. [Navigation menus](#8-navigation-menus)
9. [Sliders](#9-sliders)
10. [Categories](#10-categories)
11. [Language variables & the language switcher](#11-language-variables--the-language-switcher)
12. [SEO, metadata, sitemap.xml & robots](#12-seo-metadata-sitemapxml--robots)
13. [Forms & captcha (with a safe server proxy)](#13-forms--captcha-with-a-safe-server-proxy)
14. [Social links, cookie banner, tracking & site images](#14-social-links-cookie-banner-tracking--site-images)
15. [Caching & revalidation](#15-caching--revalidation)
16. [Error handling](#16-error-handling)
17. [Deployment notes](#17-deployment-notes)
18. [Redirects (old URLs & 404s)](#18-redirects-old-urls--404s)
19. [Reference: panel screen → SDK call map](#19-reference-panel-screen--sdk-call-map)

---

## 1. How AdsCRM works (the mental model)

AdsCRM is a **headless, multi‑tenant CMS**. There are two completely separate API surfaces:

| | Management API | Delivery API |
|---|---|---|
| **Who uses it** | Site administrators, in the panel | Your website (this guide) |
| **Direction** | **Write** (create/edit content) | **Read‑only** (+ form submit) |
| **URL prefix** | `/api/v1/admin/*` | `/api/v1/public/{site_token}/*` |
| **Auth** | Logged‑in user + `X-Site-ID` header | Site **Delivery token**, origin‑restricted |
| **In this package?** | ❌ out of scope | ✅ everything you need |

You never touch the Management API. The site admin edits content in the panel; that content
becomes instantly available (server‑cached) on the Delivery API; your Next.js app reads it.

```
┌───────────────┐        ┌──────────────────────┐        ┌────────────────────┐
│ Site admin    │ writes │  AdsCRM panel         │  reads │  Your Next.js site  │
│ (panel UI)    │ ─────▶ │  Management API       │ ◀───── │  @adsoffice/adscrm  │
└───────────────┘        │  Delivery API (cache) │        │  Delivery token     │
                         └──────────────────────┘        └────────────────────┘
```

**Key idea — the site is schema‑driven.** The admin defines *sections* (called **content
types**), each of which is either a **collection** (a list of entries, e.g. *News*, *Projects*)
or a **single page** (e.g. *About us*). The URL of every section and every entry, in every
language, is served by the API. Because of that, **you can render the entire site from a single
catch‑all route** — adding a new section in the panel needs **zero** frontend code changes.

---

## 2. What the site admin manages vs. what you fetch

This table is the backbone of the whole integration. Everything the admin does on the left
becomes a value you read on the right.

| Panel screen (site admin) | What it defines | You read it with |
|---|---|---|
| **Site structure / Sitemap** | Sections (content types), order, collection vs. single page, homepage | `cms.contentTypes()`, `cms.routes()`, `cms.urls()` |
| **Section builder → Fields** | Custom field definitions per section | fields appear on each `ContentItem` / `page` |
| **Entries (items)** | Rows of a collection section | `cms.list(type)`, `cms.item(type, slug)` |
| **Single page body** | Content of a non‑collection section | `cms.page(type)` |
| **Categories** | Taxonomy tree per section | `custom_fields` / `category` field, `kind:'category'` in `cms.urls()` |
| **Sliders** | Named sliders with slides | `cms.slider(slug)`, `cms.sliders()` |
| **Menus** | Navigation trees (header, footer…) | `cms.menu(slug)`, `cms.menuMap()` |
| **Language variables** | UI strings (labels, buttons) per language | `cms.strings()`, `cms.string(key)` |
| **Media & gallery** | Uploaded images/files/galleries | URLs inside field values (`image`, `gallery`) |
| **Forms + Inbox** | Form schema, fields, captcha | `cms.form(slug)`, `cms.submitForm(...)` |
| **SEO** | Title/description/slug per entry | `entry.seo`, `pageMetadata()` |
| **Page Views** | Composed pages (blocks) | `cms.view(slug)`, `cms.blocks(slug)` |
| **Settings → API** | Delivery tokens & allowed origins | your `ADSCRM_TOKEN` |
| **Settings → Social / Cookie / Tracking / Images** | Footer links, consent banner, analytics, logos | `cms.social()`, `cms.cookie()`, `cms.tracking()`, `cms.images()` |

> A companion **animated walkthrough** shows the admin side of each of these screens
> A‑to‑Z. As a developer you don't operate the panel, but knowing what each screen produces
> makes the field names and structures below obvious.

---

## 3. Prerequisites & getting your Delivery token

**You need:**

- Node **18+** (Next.js 15 wants 18.18+; 20/22 recommended)
- A site created in AdsCRM by an admin, with the **CMS** product enabled
- A **Delivery token** for that site

**Get the token (ask the site admin, or do it if you have panel access):**

> Panel → **Settings → API** → *Create Delivery token* → scope **read** → copy the value.
> In the same screen, add your site's domains (and `http://localhost:3000` for dev) to the
> **allowed origins** so the browser‑side and server‑side requests are accepted.

The token is **read‑only**, but still keep it server‑side (see §13 for why the browser never
needs it).

---

## 4. Project setup

```bash
npx create-next-app@latest my-site   # App Router, choose TS or JS
cd my-site
npm i @adsoffice/adscrm            # or: npm i git+https://github.com/adsoffice/adscrm-js.git
```

`.env.local`:

```bash
ADSCRM_URL=https://crm.adsoffice.net      # your AdsCRM base URL
ADSCRM_TOKEN=sk_xxxxxxxxxxxxxxxx           # Delivery token (read‑only)
ADSCRM_LOCALE=tr                            # default (prefix‑less) locale

# caching (see §15)
ADSCRM_REVALIDATE=60                        # ISR seconds for content (0 = always fresh)
ADSCRM_STRUCTURE_REVALIDATE=300             # ISR seconds for routes/urls (structural)

# forms (see §13)
ADSCRM_FORM_CONTACT=contact                 # a form slug defined in the panel

# revalidation webhook (see §15)
REVALIDATE_SECRET=change-me-to-a-long-random-string
```

> **Locales.** AdsCRM publishes the default locale **without a prefix** (`/about`) and every
> other locale **with a prefix** (`/en/about`). You do not build a `[locale]` segment — the
> catch‑all route in §6 handles both forms.

---

## 5. The CMS client (`lib/cms`)

Create **one shared client** for the whole app. This is the single most important file. The
pattern below (adapted from a real production site) adds three things beyond the bare
`createCmsClient`:

1. a **safe wrapper** (`fromCms`) that never throws — the site keeps rendering if the CMS is briefly unreachable;
2. **two cache tiers** — content vs. structural endpoints (`routes`/`urls`), because structural
   calls run on *every* page render and would otherwise burn the Delivery rate limit (120 req/min);
3. a **tag scheme** for targeted revalidation.

```ts
// lib/cms/client.ts
import { createCmsClient } from '@adsoffice/adscrm/next';
import type { AdsCrmClient } from '@adsoffice/adscrm';

const baseUrl = (process.env.ADSCRM_URL ?? '').replace(/\/$/, '');
const token = process.env.ADSCRM_TOKEN ?? '';

export const DEFAULT_LOCALE = process.env.ADSCRM_LOCALE || 'tr';

// Content pages: ISR seconds (0 = always dynamic/live).
export const REVALIDATE = Number(process.env.ADSCRM_REVALIDATE ?? '60');
// Structural endpoints (routes/urls) change rarely but are hit on every request → cache longer.
export const STRUCTURE_REVALIDATE = Number(process.env.ADSCRM_STRUCTURE_REVALIDATE ?? '300');

export const CMS_TAG = 'cms';
/** Build cache tags: cmsTag('item','news','hello') → ['cms', 'cms:item:news:hello']. */
export function cmsTag(...parts: (string | undefined)[]): string[] {
  return [CMS_TAG, [CMS_TAG, ...parts.filter(Boolean)].join(':')];
}

export function isCmsConfigured(): boolean {
  return baseUrl.length > 0 && token.length > 0;
}

export const cms: AdsCrmClient | null = isCmsConfigured()
  ? createCmsClient({ baseUrl, token, locale: DEFAULT_LOCALE, revalidate: REVALIDATE, tags: [CMS_TAG] })
  : null;

/** Run a CMS request that returns null (never throws) on any failure. */
export async function fromCms<T>(
  request: (client: AdsCrmClient) => Promise<T>,
  label = 'request',
): Promise<T | null> {
  if (!cms) return null;
  try {
    return await request(cms);
  } catch (error) {
    console.error(`[adscrm] ${label} failed:`, error);
    return null;
  }
}
```

Usage throughout the app:

```ts
import { cms, fromCms, cmsTag, STRUCTURE_REVALIDATE } from '@/lib/cms/client';

// content — throws are fine inside a page (Next shows error boundary / notFound)
const post = await cms!.item('news', slug, { tags: cmsTag('item', 'news', slug) });

// structural — safe wrapper + longer cache
const routes = await fromCms(
  (c) => c.routes({ revalidate: STRUCTURE_REVALIDATE, tags: cmsTag('routes') }),
  'routes',
);
```

> JS project? Drop the type annotations; the code is identical.

---

## 6. Serve the whole site from one route

Because every section/entry URL comes from the API, one **catch‑all** route renders everything.
`cms.resolve(path)` matches the URL against the site schema and returns the right data.

```jsx
// app/[[...slug]]/page.jsx   (React Server Component)
import { notFound } from 'next/navigation';
import { cms } from '@/lib/cms/client';
import { pageMetadata, staticSectionParams, staticItemParams } from '@adsoffice/adscrm/next';

// Pre‑render sections at build (fast); add items for full static export.
export async function generateStaticParams() {
  const [sections, items] = await Promise.all([
    staticSectionParams(cms),
    staticItemParams(cms, { max: 500 }),
  ]);
  return [...sections, ...items];
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [page, site] = await Promise.all([cms.resolve(slug), cms.site()]);
  return pageMetadata(page, { siteName: site.name });
}

export default async function Page({ params }) {
  const { slug } = await params;
  const page = await cms.resolve(slug, { limit: 12 });

  switch (page.kind) {
    case 'notFound':
      notFound();
    case 'item':
      return <Detail type={page.type} item={page.data} />;
    case 'home':
    case 'section':
      return page.type.is_collection
        ? <List type={page.type} items={page.data} page={page.page} meta={page.meta} />
        : <SinglePage content={page.page} />;
  }
}
```

`cms.resolve(path)` returns `{ kind, locale, type, itemSlug, data, page, meta, seo }`:

| `kind` | Meaning | Where the data is |
|---|---|---|
| `home` | The section flagged as homepage (`/`, `/en`) | `data` = list, `page` = page body |
| `section` | A collection list **or** a single page | `data` = child entries (empty for single pages), `page` = page body |
| `item` | An entry inside a collection | `data` = the entry |
| `notFound` | No match | — |

> Want to match the route yourself and fetch data separately? Use `cms.route(path)` (no data
> fetch) — useful when you build a custom template registry keyed by section slug.

### Multiple languages, still one route

`/about` (default locale) and `/en/about` both resolve here — no `[locale]` folder needed. If
you prefer language **route groups** (`app/(tr)` and `app/(en)`), each group has a thin
`[...slug]/page.jsx` that passes its locale to the same render function. Keep it simple with a
single catch‑all unless you need per‑language layouts.

---

## 7. Rendering content (lists, items, single pages)

### Collection list

```jsx
const { data: posts, meta } = await cms.list('news', { page: 1, limit: 12 });

<ul>
  {posts.map((p) => (
    <li key={p.id}>
      <a href={cms.itemPath(type, p, page.locale)}>{p.title}</a>
      <time>{p.published_at}</time>
    </li>
  ))}
</ul>
// meta = { total, page, last_page, per_page } → build pagination
```

### Single entry (detail page)

```jsx
const post = await cms.item('news', slug);            // throws AdsCrmNotFoundError if missing
<article>
  <h1>{post.title}</h1>
  <div dangerouslySetInnerHTML={{ __html: post.body }} />   {/* richtext field, sanitized by panel */}
</article>
```

### Single‑page section (e.g. About)

```jsx
const about = await cms.page('about');    // the section's own page body
```

### Field types → JSON

Every field the admin adds in the **Section builder** appears as a property on the entry.

| Field type | Value |
|---|---|
| `text`, `textarea`, `slug`, `select`, `color`, `date`, `datetime` | `string` |
| `richtext` | HTML `string` (sanitized) |
| `number` / `boolean` | `number` / `boolean` |
| `multiselect` / `json` | `string[]` / `object`\|`array` |
| `image`, `file` | URL `string` |
| `gallery` | `{ id, name, slug, images: [{ id, url, alt }] }` |
| `category` | `[{ id, name, slug, parent_id, description, image }]` — use `cms.categories()` for every category field |
| `relation` | Entry: `{ id, kind: 'item', slug, type, title }` — fetch it with `cms.item(type, slug)` · Category: `{ id, kind: 'category', slug, title, type, path, description, image }` |

**Relation field — entry or category?** In the panel a relation field targets either a
sitemap section (entries) or categories (all categories or one section's categories).
`kind` tells them apart:

```jsx
const rel = post.related; // relation field

if (rel?.kind === 'category') {
  // Category: resolved to the requested locale; path is a ready-to-use link.
  return <a href={rel.path}>{rel.title}</a>;
}
if (rel) {
  // Entry: fetch the full linked record when needed.
  const target = await cms.item(rel.type, rel.slug);
}
```

On multilingual sites mark the relation field as **Shared** in the panel: one choice
applies to every locale, and the reference is returned with that locale's name and path.

Every entry also carries `seo: { title, description, slug }` and a `custom_fields` array of
per‑entry free fields:

```jsx
{post.custom_fields.map((f) => (
  <div key={f.key}><dt>{f.label}</dt><dd>{f.value}</dd></div>
))}
```

---

## 8. Navigation menus

The admin builds menus (e.g. `header`, `footer`) on the **Menus** screen. Fetch them all in one
request in your layout:

```jsx
// app/layout.jsx
import { cms, fromCms, cmsTag, STRUCTURE_REVALIDATE } from '@/lib/cms/client';

export default async function RootLayout({ children }) {
  const menus = await fromCms(
    (c) => c.menuMap({ tags: cmsTag('menus'), revalidate: STRUCTURE_REVALIDATE }),
    'menus',
  ) ?? {};

  return (
    <html>
      <body>
        <nav>{menus.header?.items.map(renderItem)}</nav>
        {children}
        <footer>{menus.footer?.items.map(renderItem)}</footer>
      </body>
    </html>
  );
}

function renderItem(item) {
  return (
    <li key={item.id}>
      <a href={item.url} target={item.target}>{item.label}</a>
      {item.children.length > 0 && <ul>{item.children.map(renderItem)}</ul>}
    </li>
  );
}
```

- `item.url` is already resolved to the current language (`/services` · `/en/services`).
- A top‑level item with children but no real link is a **label/dropdown title** — render its
  children as the actual links.
- If a language has no items, the API falls back to the default language so nav is never empty.

---

## 9. Sliders

The admin creates sliders on the **Sliders** screen; each slide can be an image or a video with
a title, subtitle and link.

```jsx
const slider = await cms.slider('homepage');    // { name, slug, settings, slides }

<Swiper>
  {slider.slides.map((s) => (
    <SwiperSlide key={s.id}>
      {s.type === 'video'
        ? <video src={s.media_url} poster={s.poster_url ?? undefined} muted autoPlay loop />
        : <img src={s.media_url} alt={s.title} />}
      <div className="caption">
        <h2>{s.title}</h2>
        <p>{s.subtitle}</p>
        {s.link && <a href={s.link}>Learn more</a>}
      </div>
    </SwiperSlide>
  ))}
</Swiper>
```

`slider.settings` is a free object (autoplay, interval, etc.) — whatever the admin configured;
map it onto your carousel library.

---

## 10. Categories

Categories are a per‑section taxonomy tree, and they **carry their own content**: besides the
name and the URL they have a description, an image and any extra fields defined in the panel.

### Listing categories — `cms.categories()`

```jsx
const categories = await cms.categories({ type: 'services' });

<ul>
  {categories.map((c) => (
    <li key={c.id}>
      <a href={c.path}>
        {c.image && <img src={c.image} alt="" />}
        <h3>{c.name}</h3>
        <p>{c.description}</p>
        {c.kisa_slogan && <small>{c.kisa_slogan}</small>}   {/* extra field from the panel */}
      </a>
    </li>
  ))}
</ul>
```

Each category is `{ id, parent_id, name, slug, description, image, type, path }` plus the
**extra fields** defined on its section (`field_slug → value`).

- **Standard fields**: title, slug, **description** and **image** (picked from the panel's
  media library).
- **Extra fields**: Panel → sitemap section → *Edit fields* → **Category fields**
  (the same fields can also be managed from the section card on Panel → *Categories*
  and from the **Categories** button on the section's entry list).
  Available types: single line, multi line, rich text (entered per language) · image,
  gallery (shared across languages). The defined list is in `cms.contentTypes()` under
  `fields` where `group: 'category'`.
- `path` is the category's public URL — the same address `cms.urls()` / `cms.routes()` report.
- Categories of sections where categories are **disabled** are never returned.
- Other helpers: `cms.categoryTree()` (children nested under `children`, roots only) ·
  `cms.categoryMap()` (`slug → category`) · `cms.category(slug)`.
  In client components: `useCategories({ type })` → `{ categories, bySlug, tree }`.

### On entries and as URLs

1. **On an entry** — via a `category` field:
   `post.category = [{ id, name, slug, parent_id, description, image }]`.
2. **As routable URLs** — `cms.urls()` returns category rows with `kind: 'category'`, so you can
   build category landing pages and list them per section:

```jsx
const { data } = await cms.urls({ type: 'projects' });
const categories = data.filter((u) => u.kind === 'category');
// each: { ref: 'c:5', kind:'category', section:'projects', urls:{tr:'/projeler/kategoriler/villa', en:'…'}, labels:{…} }
```

The category route pattern itself (`/projects/categories/{slug}`) is available from
`cms.routes()` under each section's `locales[locale].category`. A category landing page is just
`cms.list('projects', { query: { category: slug } })` filtered to that category (the exact query
key depends on how the section was configured).

---

## 11. Language variables & the language switcher

### UI strings ("Language variables")

Static UI text that isn't part of any content entry — button labels, section headings, footer
text — lives on the **Language variables** screen as key/value pairs per language.

```jsx
// server component
const t = await cms.strings({ group: 'ui' });   // { search_placeholder: 'Search…', read_more: 'Read more', … }
<button>{t.read_more}</button>
```

```jsx
// client component
'use client';
import { useStrings } from '@adsoffice/adscrm/react';
const { t } = useStrings({ group: 'ui' });
<input placeholder={t('search_placeholder')} />
```

### Which languages are enabled + the switcher

```jsx
const { items, default: def } = await cms.locales();
// items: [{ code:'tr', name:'Türkçe', prefix:'', home_path:'/' },
//         { code:'en', name:'English', prefix:'/en', home_path:'/en' }]

// For "same page in the other language", combine with cms.alternates():
const page = await cms.resolve(slug);
const alt = await cms.alternates(page.type, page.kind === 'item' ? page.data : undefined);
// { tr: '/urunler/sandalye', en: '/en/products/chair' }

<ul>
  {items.map((l) => <li key={l.code}><a href={alt[l.code] ?? l.home_path}>{l.name}</a></li>)}
</ul>
```

Missing translations fall back to the default locale automatically — you never render an empty
field or a dead language link.

---

## 12. SEO, metadata, sitemap.xml & robots

### Per‑page metadata

`pageMetadata(resolved, opts)` turns a resolved page's `seo` into a Next `Metadata` object,
including `openGraph` and `alternates.languages` (hreflang):

```jsx
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [page, site] = await Promise.all([cms.resolve(slug), cms.site()]);
  return pageMetadata(page, {
    siteName: site.name,
    url: `https://example.com${page.locale === site.default_locale ? '' : '/' + page.locale}`,
  });
}
```

### `sitemap.xml`

```jsx
// app/sitemap.js
import { cms } from '@/lib/cms/client';

export const revalidate = 3600;

export default async function sitemap() {
  const { data, meta } = await cms.urls({ flat: false });
  const origin = 'https://example.com';

  return data.map((entry) => ({
    url: origin + entry.urls[meta.default_locale],
    lastModified: entry.updated_at ?? undefined,
    alternates: {
      languages: Object.fromEntries(meta.locales.map((l) => [l, origin + entry.urls[l]])),
    },
  }));
}
```

> **This is exactly what "adding a sitemap" means for you.** When the admin adds a section or
> publishes an entry, it appears in `cms.urls()`, so your `sitemap.xml` updates itself on the
> next revalidation — no manual list to maintain.

### `robots.txt`

```jsx
// app/robots.js
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: 'https://example.com/sitemap.xml',
  };
}
```

---

## 13. Forms & captcha (with a safe server proxy)

Form fields and captcha settings are defined by the admin on the **Form builder** screen; the
client fetches the schema and builds the form itself. Submissions land in the panel **Inbox**.

### The self‑building form (client component)

```jsx
'use client';
import { useAdsForm, Captcha } from '@adsoffice/adscrm/react';

export function ContactForm({ slug = 'contact' }) {
  const form = useAdsForm(slug);

  if (form.loading) return <p>Loading…</p>;
  if (form.submitted) return <p>{form.message}</p>;

  return (
    <form onSubmit={form.onSubmit}>
      {form.fields.map((field) => (
        <label key={field.name}>
          {field.label}{field.required && ' *'}
          {field.type === 'select' ? (
            <select value={form.values[field.name] ?? ''} onChange={(e) => form.setValue(field.name, e.target.value)}>
              <option value="">—</option>
              {field.choices.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : field.type === 'textarea' ? (
            <textarea value={form.values[field.name] ?? ''} onChange={(e) => form.setValue(field.name, e.target.value)} />
          ) : (
            <input
              type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
              value={form.values[field.name] ?? ''}
              onChange={(e) => form.setValue(field.name, e.target.value)}
              aria-invalid={!!form.errors[field.name]}
            />
          )}
          {form.errors[field.name] && <span role="alert">{form.errors[field.name]}</span>}
        </label>
      ))}

      <Captcha form={form} />

      <button disabled={form.submitting}>{form.submitting ? 'Sending…' : 'Send'}</button>
      {form.error && <p role="alert">{form.error.message}</p>}
    </form>
  );
}
```

Wrap your app once so client hooks have a client:

```jsx
// app/providers.jsx
'use client';
import { AdsCrmProvider } from '@adsoffice/adscrm/react';
import { cms } from '@/lib/cms/client';
export function Providers({ locale, children }) {
  return <AdsCrmProvider client={cms} locale={locale}>{children}</AdsCrmProvider>;
}
```

### Keep the token off the browser — proxy the submit

`useAdsForm` submits directly with the client. If you exposed `ADSCRM_TOKEN` to the browser you
would ship a (read‑only) token to every visitor. The production‑grade pattern is to **proxy**
submit and captcha through your own route handlers so the token stays on the server:

```js
// app/api/forms/[slug]/route.js  — POST proxy
import { cms } from '@/lib/cms/client';
import { isValidationError, isRateLimited, isNotFound } from '@adsoffice/adscrm';

export async function POST(request, { params }) {
  const { slug } = await params;
  const { values, captcha, honeypot } = await request.json();
  try {
    const result = await cms.submitForm(slug, values, { captcha, honeypot });
    return Response.json(result);
  } catch (e) {
    if (isValidationError(e)) return Response.json({ errors: e.fieldErrors() }, { status: 422 });
    if (isRateLimited(e)) return Response.json({ error: 'rate_limited' }, { status: 429 });
    if (isNotFound(e)) return new Response('not found', { status: 404 });
    throw e;
  }
}
```

```js
// app/api/forms/[slug]/captcha/route.js  — GET math challenge
import { cms } from '@/lib/cms/client';
export async function GET(_request, { params }) {
  const { slug } = await params;
  return Response.json(await cms.formCaptcha(slug));   // signed question; never cached
}
```

Then point the form at your proxy instead of the CMS directly. The four captcha providers
(`honeypot`, `math`, `recaptcha`, `turnstile`) are configured in the panel; `<Captcha>` renders
the right widget automatically and only the public `site_key` ever reaches the browser.

> **Multilingual forms** work with no extra effort: the client's locale is attached to every
> request, so labels, option labels and the success message all come back translated. Select
> options always submit the same canonical value (`field.options`) regardless of display
> language, so your Inbox isn't split by language.

---

## 14. Social links, cookie banner, tracking & site images

All configured in **Settings** and read‑only from your side.

```jsx
// Footer social icons (only enabled links, with brand colors)
const links = await cms.social();
{links.map((l) => (
  <a key={l.url} href={l.url} target="_blank" rel="noreferrer" style={{ color: l.color }}>
    {l.logo_url ? <img src={l.logo_url} alt={l.label} width={20} /> : <MyIcon name={l.platform} />}
  </a>
))}

// Site logo / favicon
const img = await cms.imageMap();          // { site_logo, site_footer_logo, site_logo_white, favicon }
<img src={img.site_logo} alt="Logo" />

// Analytics / verification codes (drop into <head>/<body>)
const { codes, head_html, body_html } = await cms.tracking();
```

Cookie consent — the package carries the **content**; you render the banner and store the
consent yourself:

```jsx
const c = await cms.cookie();
// { enabled, position, theme, policy_link, texts: { title, message, accept_label, policy_label } }
if (c.enabled && !localStorage.getItem('cookie-consent')) {
  // render banner at c.position with c.theme, show c.texts.*, save consent on accept
}
```

---

### Maintenance mode (the publish switch)

Every site has a **publish switch** under **Settings → Site Status**. It is **on by
default** (site live). When the owner turns it off the site goes passive: content
endpoints return **`503`** and the body carries the maintenance notice. **You** render
the maintenance page; the CMS only supplies the title and message, resolved to the
requested locale.

Endpoints that stay open during maintenance: `site` · `locales` · `images` · `social` ·
`cookie` · `tracking` · `strings` · `maintenance` — enough to render a branded,
localized maintenance page.

One check in the root layout is enough:

```jsx
// app/layout.jsx
const m = await cms.maintenance();          // { enabled, retry_after, texts: { title, message } }
if (m.enabled) {
  return <html><body><Maintenance title={m.texts.title} message={m.texts.message} /></body></html>;
}
```

Prefer no extra request? Catch the error — content calls already return 503:

```jsx
import { isMaintenance } from '@adsoffice/adscrm';

try {
  const { data } = await cms.list('news');
} catch (e) {
  if (isMaintenance(e)) return <Maintenance {...e.texts} />;
  throw e;
}
```

`cms.guard(fn)` does the same without `try/catch`: `{ ok, data, maintenance }`.

**Serve the maintenance page with `503`** (a `200` makes search engines treat it as
real content) and add a `Retry-After: m.retry_after` header.

**Preview:** the panel generates a key per site. Pass it as
`createCmsClient({ previewKey })` and every request carries `?preview=…`, so content is
returned even while the site is passive. Never expose the key to client-side JS
(no `NEXT_PUBLIC_`).

In client components: `const { enabled, texts } = useMaintenance()`.

---

## 15. Caching & revalidation

Two independent cache layers sit between the admin and the visitor:

1. **AdsCRM Delivery cache** (server side) — drops automatically when content is saved in the panel.
2. **Next.js fetch cache** (your app) — controlled by `revalidate` and `tags`.

Set sensible defaults, longer for structural calls:

```js
await cms.list('news', { revalidate: 300, tags: cmsTag('list', 'news') });
await cms.item('news', slug, { revalidate: 0 });                 // always fresh
await cms.routes({ revalidate: 3600, tags: cmsTag('routes') });  // structural, rarely changes
```

### On‑publish webhook (instant updates)

Add a route the panel can call to invalidate tags the moment content changes:

```js
// app/api/revalidate/route.js
import { revalidateTag, revalidatePath } from 'next/cache';

export async function POST(request) {
  const secret = request.headers.get('x-revalidate-secret') ?? (await request.json().catch(() => ({}))).secret;
  if (secret !== process.env.REVALIDATE_SECRET) return new Response('nope', { status: 401 });

  const { tags, paths } = await request.json().catch(() => ({}));
  (tags ?? ['cms']).forEach((t) => revalidateTag(t));
  (paths ?? []).forEach((p) => revalidatePath(p));
  return Response.json({ revalidated: true });
}
```

A **tag scheme** lets you revalidate narrowly:
`cms:site`, `cms:menus`, `cms:strings`, `cms:urls`, `cms:routes`,
`cms:type:<section>`, `cms:list:<section>`, `cms:item:<section>:<slug>`, `cms:view:<slug>`,
`cms:form:<slug>`.

**Live vs. ISR.** Set `ADSCRM_REVALIDATE=0` while developing (every request is fresh). In
production use `60`–`300` for ISR, and rely on the webhook for instant updates when needed.

---

## 16. Error handling

```js
import { isNotFound, isValidationError, isRateLimited } from '@adsoffice/adscrm';

try {
  const post = await cms.item('news', slug);
} catch (e) {
  if (isNotFound(e)) notFound();     // 404 → Next notFound()
  throw e;                            // let the error boundary handle the rest
}
```

| Class | When |
|---|---|
| `AdsCrmNotFoundError` | 404 — not published / doesn't exist |
| `AdsCrmValidationError` | 422 — form/captcha validation (`e.fieldErrors()`) |
| `AdsCrmRateLimitError` | 429 — Delivery 120/min, forms 10/min |
| `AdsCrmMaintenanceError` | 503 — site in maintenance mode; `e.texts` holds the title/message (`isMaintenance(e)`) |
| `AdsCrmNetworkError` | network/timeout (GETs retry twice) |

For anything read on **every** page (menus, site settings, routes), wrap with `fromCms(...)` so
a transient failure degrades gracefully instead of taking the whole site down.

---

## 17. Deployment notes

- The app needs a **Node server** (SSR/ISR + the form proxy) — it can't be a pure static export
  if you use the submit proxy or `revalidate: 0`.
- Set the same env vars in production. Add your production domain to the panel's **allowed
  origins** (Settings → API).
- `ADSCRM_REVALIDATE` decides render mode; if you containerize, treat it as a build arg and
  rebuild when you change it.
- Point the panel's revalidation webhook at `https://yourdomain/api/revalidate` with the
  `REVALIDATE_SECRET`.

---

## 18. Redirects (old URLs & 404s)

When a site is rebuilt, its old URLs start returning 404: links in search results,
inbound links from other sites, QR codes on printed material. The panel's
**Websites → Link Manager** maps those to their new targets; you apply them with
two lines of code.

The source URL is stored **verbatim** (`/Products/Old_Page.php?id=12`); matching is
case-insensitive and each rule picks how it matches:

| `match` | Source | Matches |
|---|---|---|
| `exact` | `/old-page.php` | that URL only |
| `prefix` | `/blog` | `/blog` and everything under it → `/blog/2019/post` ⇒ `/news/2019/post` |
| `wildcard` | `/product/*/detail` | captures what `*` matched; use `$1`, `$2` in the target |
| `regex` | `^/news-(\d+)\.html$` | pattern; groups become `$1`, `$2` |

Each rule also has: **only when missing** (never breaks a page that exists),
**keep query string**, **append the remaining path**.

### Middleware — on every request, with no added latency

The rule list is cached and matched locally by the engine shipped in this package
(identical logic to the server), so there is no per-request call to the CRM.

```js
// middleware.js
import { NextResponse } from 'next/server';
import { redirectFor } from '@adsoffice/adscrm/next';
import { cms } from './lib/cms';

export async function middleware(request) {
  const hit = await redirectFor(cms, request);
  if (hit) return NextResponse.redirect(hit.target, hit.status);

  // Pass the requested path to the 404 page (next step).
  const headers = new Headers(request.headers);
  headers.set('x-adscrm-path', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/((?!_next|api|favicon.ico|images).*)'] };
```

### The 404 page — last resort

Wildcard/regex rules and "only when missing" rules are resolved server-side here.
And when **nothing** matches, the URL is written to the panel's **Missing URLs**
log, so the site admin can see which old links are still being requested and turn
one into a rule with a single click.

```jsx
// app/not-found.jsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { notFoundRedirect } from '@adsoffice/adscrm/next';
import { cms } from '@/lib/cms';

export default async function NotFound() {
  const path = (await headers()).get('x-adscrm-path') || '/';
  const target = await notFoundRedirect(cms, path);
  if (target) redirect(target);

  return <h1>Page not found</h1>;
}
```

> This step alone is enough: without middleware, every redirect is resolved at the
> moment of the 404. Adding the middleware redirects earlier — the visitor never
> reaches the missing page.

### Matching by hand

```js
const rules = await cms.redirects();                        // sorted list
await cms.matchRedirect('/blog/2019/old-post', { rules });   // local, no hit counted
await cms.resolveRedirect('/missing', { missing: true });    // server-side, counts a hit
```

---

## 19. Reference: panel screen → SDK call map

A quick lookup when you're staring at a panel screen and wondering what to call.

| Admin screen | Produces | SDK (server) | SDK (client hook) |
|---|---|---|---|
| Site structure / Sitemap | sections + URLs | `cms.contentTypes()` · `cms.routes()` · `cms.urls()` | `useContentTypes` · `useRoutes` · `useUrls` |
| Section builder / fields | field defs on entries | (fields on `list`/`item`/`page`) | — |
| Entries | collection rows | `cms.list(type)` · `cms.item(type, slug)` | `useList` · `useItem` |
| Single page | page body | `cms.page(type)` | `usePage` |
| Categories | taxonomy + category content | `cms.categories()` · `cms.categoryTree()` · `cms.urls()` (`kind:'category'`) | `useCategories` · `useUrls` |
| Sliders | slides | `cms.slider(slug)` · `cms.sliders()` | `useSlider` |
| Menus | nav trees | `cms.menu(slug)` · `cms.menuMap()` | `useMenu` · `useMenuTree` |
| Language variables | UI strings | `cms.strings()` · `cms.string(key)` | `useStrings` |
| Media & gallery | image/file URLs | (URLs in field values) | — |
| Forms + Inbox | form schema / submit | `cms.form(slug)` · `cms.submitForm(...)` | `useAdsForm` |
| SEO | meta per entry | `entry.seo` · `pageMetadata()` | — |
| Page Views | composed blocks | `cms.view(slug)` · `cms.blocks(slug)` | `useView` · `useBlocks` |
| Settings → Social | footer links | `cms.social()` | `useSocial` |
| Settings → Cookie | consent banner | `cms.cookie()` | `useCookie` |
| Settings → Site Status | publish switch + maintenance copy | `cms.maintenance()` · `cms.guard()` | `useMaintenance` |
| Settings → Tracking | analytics codes | `cms.tracking()` | — |
| Settings → Images | logo/favicon | `cms.images()` · `cms.imageMap()` | `useSiteImages` |
| Settings → API | delivery token | your `ADSCRM_TOKEN` | — |
| Link Manager | redirect rules + 404 log | `cms.redirects()` · `redirectFor()` · `notFoundRedirect()` | — |

---

**Next steps:** skim the full [API reference](../README.md) for every method and option, and copy
the runnable starter in [`examples/next-app-router`](../examples/next-app-router). For the admin
side of every screen above, watch the animated panel walkthrough.

🇹🇷 [Türkçe sürüm →](GUIDE.tr.md)
