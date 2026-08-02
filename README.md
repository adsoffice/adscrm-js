# @adsoffice/adscrm

AdsCRM **Headless (Delivery) API** istemcisi — React ve Next.js projeleri için.

- ✅ **Salt okunur.** İçerik, sitemap, menü, slider, sayfa görünümleri, dil değişkenleri, arama.
- ✅ **Formlar** — şema + gönderim + 4 captcha sağlayıcısı (honeypot · math · reCAPTCHA · Turnstile).
- ✅ **Next.js App Router** — ISR (`revalidate`), cache etiketleri, `generateStaticParams`, `generateMetadata`.
- ✅ **Rota çözümü** — `/en/haberler/merhaba` gibi bir URL'i tek satırda içeriğe çevirir.
- ✅ **Sıfır bağımlılık, derleme adımı yok.** Saf ESM + elle yazılmış `.d.ts` (tam TypeScript desteği).

> Panel (Management) API'si — içerik yazma, kullanıcı/site yönetimi, süper admin uçları —
> **bu paketin kapsamı dışındadır.** Paket yalnızca site tokenıyla erişilen public uçları kullanır.

---

## Kurulum

```bash
npm i git+https://github.com/<kullanici>/adscrm-js.git
# belirli bir sürüm/etiket:
npm i git+https://github.com/<kullanici>/adscrm-js.git#v0.1.0
```

`.env.local`:

```bash
ADSCRM_URL=https://crm.adsoffice.net
ADSCRM_TOKEN=xxxxxxxxxxxxxxxx      # Panel → Ayarlar → API → Delivery token
```

> Token yalnızca okuma yetkilidir; yine de sunucu tarafında tutun (`NEXT_PUBLIC_` ile
> açmanız gerekirse, sitenizin izin verilen köken listesini panelden sınırlayın).

---

## Hızlı başlangıç

```js
// lib/cms.js
import { createCmsClient } from '@adsoffice/adscrm/next';

export const cms = createCmsClient({
  baseUrl: process.env.ADSCRM_URL,
  token: process.env.ADSCRM_TOKEN,
  locale: 'tr',          // varsayılan dil
  revalidate: 60,        // ISR (sn) — 0 ile kapatılır
  tags: ['cms'],         // revalidateTag('cms') ile topluca tazele
});
```

```jsx
// app/page.jsx  (React Server Component)
import { cms } from '@/lib/cms';

export default async function Home() {
  const { data: haberler } = await cms.list('haberler', { limit: 6 });

  return (
    <ul>
      {haberler.map((h) => (
        <li key={h.id}><a href={`/haberler/${h.slug}`}>{h.baslik}</a></li>
      ))}
    </ul>
  );
}
```

Next.js dışında (Vite, Remix, Node script) aynısı `@adsoffice/adscrm` girişiyle:

```js
import { createClient } from '@adsoffice/adscrm';
export const cms = createClient({ baseUrl: '…', token: '…' });
```

---

## Tüm siteyi tek rotayla sunmak

AdsCRM'de her bölümün her dildeki yolu (`/hakkimizda`, `/en/about`) API'den hazır gelir.
`cms.resolve()` bir URL'i bu haritayla eşleyip doğru veriyi çeker:

```jsx
// app/[[...slug]]/page.jsx
import { notFound } from 'next/navigation';
import { cms } from '@/lib/cms';
import { pageMetadata, staticSectionParams } from '@adsoffice/adscrm/next';

export async function generateStaticParams() {
  return staticSectionParams(cms);           // + staticItemParams(cms) alt sayfalar için
}

export async function generateMetadata({ params }) {
  const page = await cms.resolve(params.slug);
  return pageMetadata(page, { siteName: 'Acme' });
}

export default async function Page({ params }) {
  const page = await cms.resolve(params.slug);
  if (page.kind === 'notFound') notFound();

  switch (page.kind) {
    case 'home':                       // ana sayfa bölümü
    case 'section':
      return page.type.is_collection
        ? <Liste type={page.type} items={page.data} sayfa={page.page} meta={page.meta} />
        : <TekilSayfa icerik={page.page} />;   // /hakkimizda → içerik `page` altında
    case 'item':
      return <Detay type={page.type} item={page.data} />;
  }
}
```

`resolve()` dönüşü: `{ kind, locale, type, itemSlug, data, page, meta, seo }`.

| `kind` | Anlamı | Veri |
|--------|--------|------|
| `home` | Ana sayfa olarak işaretli bölüm (`/`, `/en`) | `data` = liste, `page` = sayfa içeriği |
| `section` | Koleksiyon listesi **veya** tekil sayfa | `data` = alt sayfalar (tekilde `[]`), `page` = sayfa içeriği |
| `item` | Koleksiyonun alt sayfası | `data` = kayıt |
| `notFound` | Eşleşme yok | — |

Yalnızca eşlemeyi isteyip veriyi kendiniz çekecekseniz `cms.route(path)` kullanın.

---

## İstemci API'si

Hepsi `Promise` döner ve son parametre olarak `{ locale, revalidate, tags, cache, signal, query }` alır.

### İçerik

| Metot | Açıklama |
|-------|----------|
| `cms.site()` | Site künyesi: ad, diller, varsayılan dil, ana sayfa, izleme kodları |
| `cms.tracking()` | GA4/GTM/Pixel kimlikleri + hazır `head_html` / `body_html` |
| `cms.contentTypes()` | Sitemap: tüm bölümler (`paths` ile birlikte) |
| `cms.contentType(slug)` | Tek bölüm (herhangi bir dildeki slug ile) |
| `cms.list(tip, { page, limit })` | Bölümün alt sayfaları + `page` + `meta` |
| `cms.item(tip, slug)` | Tek alt sayfa (yoksa `AdsCrmNotFoundError`) |
| `cms.page(tip)` | Bölümün kendi sayfası (tekil sayfalarda içerik burada) |
| `cms.homepage()` | Ana sayfa bölümü |
| `cms.allItems(tip)` | Sayfalamayı otomatik dolaşır (`generateStaticParams` için) |
| `cms.search('metin')` | Yayındaki içeriklerde arama (min. 2 karakter) |

### Yapı

| Metot | Açıklama |
|-------|----------|
| `cms.menus()` | Menü künyeleri (id, name, slug) |
| `cms.menuTree()` | **Tüm menüler + ağaçları** tek istekte (`{ locales: 'all' }` → her dil) |
| `cms.menuMap()` | Aynısı, `slug → menü` haritası olarak |
| `cms.menu(slug \| id)` | Tek menünün hiyerarşik ağacı (slug ya da menü id'si) |
| `cms.sliders()` · `cms.slider(slug)` | Slider listesi / slaytlar |
| `cms.view(slug)` | Sayfa görünümü — bir sayfanın tüm blokları tek istekte |
| `cms.blocks(slug)` | Aynısı, `key → data` haritası olarak |
| `cms.strings({ group, keys })` | Dil değişkenleri sözlüğü (`locales: 'all'` → tüm diller) |
| `cms.string(key)` · `cms.viewStrings(slug)` | Tek değişken / görünüme bağlı değişkenler |

### Navigasyon (menüler)

Tüm menüleri tek istekte çekip layout'ta dağıtın:

```jsx
// app/layout.jsx
const { header, footer } = await cms.menuMap();      // slug → menü

<nav>{header?.items.map(renderItem)}</nav>
```

```jsx
function renderItem(item) {
  return (
    <li key={item.id}>
      <a href={item.url} target={item.target}>{item.label}</a>
      {item.children.length > 0 && <ul>{item.children.map(renderItem)}</ul>}
    </li>
  );
}
```

- `cms.menuTree()` → `{ data: [{ id, name, slug, items }], meta }`.
- `cms.menuTree({ locales: 'all' })` → her menü `items` yerine `items_by_locale`
  taşır; sözlüğü bir kez çekip dili istemcide değiştirmek için.
- `cms.menu('header')` ya da `cms.menu(1)` → tek menü (slug **veya** id).
- `url` alanları dile göre çözülmüş gelir (`/hizmetler` · `/en/services`).
- Bir dilde hiç öğe yoksa varsayılan dilin menüsüne düşülür — navigasyon boş kalmaz.

İstemci bileşenlerinde: `const { bySlug } = useMenuTree()` · `useMenu('header')`.

### Dil

```js
const en = cms.withLocale('en');        // sabit dilli yeni istemci
await cms.list('haberler', { locale: 'en' });   // ya da çağrı bazında
```

Dil sitede etkin değilse sunucu **varsayılan dile** düşer. Çeviri boşsa alan değeri
varsayılan dildeki değere düşer — sayfada asla boş alan görünmez.

### Yollar

```js
cms.path(type, 'en');            // /en/products
cms.itemPath(type, item, 'en');  // /en/products/chair
await cms.alternates(type, item);// { tr: '/urunler/sandalye', en: '/en/products/chair' }
```

---

## Önbellek ve tazeleme (Next.js)

`revalidate` ve `tags` doğrudan Next'in `fetch` önbelleğine geçer:

```js
await cms.list('haberler', { revalidate: 300, tags: ['cms:haberler'] });
await cms.item('haberler', slug, { revalidate: 0 });        // her istekte taze
```

Panelde içerik değişince tazelemek için bir webhook rotası:

```js
// app/api/revalidate/route.js
import { revalidateTag } from 'next/cache';

export async function POST(request) {
  const { secret, tag } = await request.json();
  if (secret !== process.env.REVALIDATE_SECRET) return new Response('nope', { status: 401 });
  revalidateTag(tag || 'cms');
  return Response.json({ ok: true });
}
```

> AdsCRM'in kendi Delivery önbelleği de vardır (Panel → Ayarlar → Önbellek). İki katman
> bağımsızdır: panelden içerik kaydedilince sunucu önbelleği otomatik düşer, Next'in
> önbelleği ise `revalidate` süresi dolunca ya da `revalidateTag` ile tazelenir.

---

## React hook'ları (istemci bileşenleri)

Sunucu bileşenlerinde hook'a gerek yoktur — doğrudan `await cms.…` kullanın.
Hook'lar arama kutusu, sonsuz liste, dil değiştirici gibi **etkileşimli** parçalar içindir.

```jsx
// app/providers.jsx
'use client';
import { AdsCrmProvider } from '@adsoffice/adscrm/react';
import { cms } from '@/lib/cms';

export function Providers({ locale, children }) {
  return <AdsCrmProvider client={cms} locale={locale}>{children}</AdsCrmProvider>;
}
```

```jsx
'use client';
import { useSearch, useList, useStrings } from '@adsoffice/adscrm/react';

function Arama() {
  const [q, setQ] = useState('');
  const { results, isLoading } = useSearch(q);          // 300 ms debounce
  const { t } = useStrings({ group: 'ui' });

  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search_placeholder')} />
      {isLoading ? '…' : results.map((r) => <a key={r.id} href={`/${r._type.slug}/${r.slug}`}>{r.baslik}</a>)}
    </>
  );
}
```

Mevcut hook'lar: `useSite` · `useContentTypes` · `useList` · `useItem` · `usePage` ·
`useMenu` · `useMenuTree` · `useSlider` · `useView` · `useBlocks` · `useStrings` ·
`useSearch` · `useAdsForm` — ve her şey için genel `useAdsCrmQuery(key, fetcher)`.

Hepsi `{ data, error, isLoading, isFetching, refetch }` döner; aynı anahtar için istekler
tekilleştirilir ve 30 sn taze sayılır (`staleTime` ile ayarlanır, `invalidateAdsCrm()` ile düşer).

---

## Formlar ve captcha

Form alanları ve captcha ayarı panelde tanımlanır; istemci şemayı çekip formu kendisi kurar.
`useAdsForm` tüm akışı yönetir: şema → değerler → captcha → gönderim → hata/başarı.

```jsx
'use client';
import { useAdsForm, Captcha } from '@adsoffice/adscrm/react';

export function IletisimFormu() {
  const form = useAdsForm('iletisim');

  if (form.loading) return <p>Yükleniyor…</p>;
  if (form.submitted) return <p>{form.message}</p>;

  return (
    <form onSubmit={form.onSubmit}>
      {form.fields.map((field) => (
        <label key={field.name}>
          {field.label}{field.required && ' *'}
          <input
            type={field.type === 'email' ? 'email' : 'text'}
            value={form.values[field.name] ?? ''}
            onChange={(e) => form.setValue(field.name, e.target.value)}
          />
          {form.errors[field.name] && <span role="alert">{form.errors[field.name]}</span>}
        </label>
      ))}

      <Captcha form={form} />

      <button disabled={form.submitting}>{form.submitting ? 'Gönderiliyor…' : 'Gönder'}</button>
      {form.error && <p role="alert">{form.error.message}</p>}
    </form>
  );
}
```

### Sağlayıcılar

| Sağlayıcı | İstemcinin yaptığı | `<Captcha>` neyi basar |
|-----------|--------------------|------------------------|
| `honeypot` (öntanımlı) | Gizli alanı boş bırakır | Ekranda görünmeyen input |
| `math` | `forms/{slug}/captcha` ucundan **imzalı** soruyu alır, cevabı gönderir | "3 + 4 = [ ]" |
| `recaptcha` | Google script'ini yükler, widget'ı basar, token'ı gönderir | reCAPTCHA v2 kutusu |
| `turnstile` | Cloudflare script'ini yükler, widget'ı basar | Turnstile kutusu |

- **Anahtarlar panelden gelir** — `site_key` şemayla birlikte döner, `secret_key` asla dışarı çıkmaz.
- **math** sağlayıcısında soruyu istemci üretemez (imza sunucu anahtarıyla atılır); paket bunu
  otomatik olarak `GET /forms/{slug}/captcha` ucundan alır, gönderim sonrası tazeler.
- Kendi arayüzünüzü çizecekseniz `<Captcha>` yerine `form.captcha` alanlarını kullanın
  (`question`, `answer/setAnswer`, `token/setToken`, `widgetRef`, `honeypot/setHoneypot`).
  reCAPTCHA **v3** kullanıyorsanız token'ı kendiniz üretip `form.captcha.setToken(token)` deyin.

### Formu sunucudan göndermek

```js
await cms.submitForm('iletisim', { ad: 'Ali', eposta: 'a@x.com', mesaj: '…' });
```

Gövde `{ data: { … } }` biçiminde gider; captcha alanları kökte taşınır. Gönderim sınırı
**10 istek/dk**'dır (`AdsCrmRateLimitError`).

---

## Hata yönetimi

```js
import { isNotFound, isValidationError, AdsCrmError } from '@adsoffice/adscrm';

try {
  const item = await cms.item('haberler', slug);
} catch (error) {
  if (isNotFound(error)) notFound();          // 404 → Next notFound()
  throw error;
}
```

| Sınıf | Ne zaman |
|-------|----------|
| `AdsCrmNotFoundError` | 404 — yayında değil / yok |
| `AdsCrmValidationError` | 422 — form doğrulaması veya captcha (`error.fieldErrors()`) |
| `AdsCrmRateLimitError` | 429 — Delivery 120/dk, form 10/dk |
| `AdsCrmNetworkError` | Ağ hatası / zaman aşımı (GET'ler 2 kez yeniden denenir) |

---

## Alan tipleri → JSON

| Alan tipi | Değer |
|-----------|-------|
| `text`, `textarea`, `slug`, `select`, `color`, `date`, `datetime` | `string` |
| `richtext` | HTML `string` (panelde temizlenmiş) |
| `number` / `boolean` | `number` / `boolean` |
| `multiselect` / `json` | `string[]` / `object`\|`array` |
| `image`, `file` | URL `string` |
| `gallery` | `{ id, name, slug, images: [{ id, url, alt }] }` |
| `category` | `[{ id, name, slug, parent_id }]` |

Her kayıt ayrıca `seo: { title, description, slug }` taşır — `toMetadata()` bunu doğrudan
Next metadata nesnesine çevirir.

---

## Sürüm ve uyumluluk

- Node **18+** (yerleşik `fetch`), React **18+** (yalnızca `/react` girişi için).
- Paket ESM'dir; Next.js App Router, Vite ve modern bundler'larla doğrudan çalışır.
- AdsCRM Delivery API `v1` ile uyumludur.

## Lisans

MIT
