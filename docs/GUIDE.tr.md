# Frontend Geliştirici Rehberi — Bir siteyi AdsCRM'e (Headless CMS) bağlamak

> **Kime:** **AdsCRM Headless CMS** üzerine web sitesi (Next.js / React) geliştiren ön yüz
> geliştiricilerine. Salt‑okunur **Delivery API**'ye [`@adsoffice/adscrm`](../README.md)
> paketiyle bağlanacak; sayfaları, menüleri, sliderları, kategorileri, formları ve SEO'su
> panelden gelen çok dilli bir siteyi baştan sona işleyeceksiniz.
>
> 🇬🇧 English version: [GUIDE.en.md](GUIDE.en.md) · 📚 Tam API referansı: [README.md](../README.md)

---

## İçindekiler

1. [AdsCRM nasıl çalışır (zihinsel model)](#1-adscrm-nasıl-çalışır-zihinsel-model)
2. [Site yöneticisi ne yönetir, siz neyi çekersiniz](#2-site-yöneticisi-ne-yönetir-siz-neyi-çekersiniz)
3. [Ön koşullar & Delivery token'ını almak](#3-ön-koşullar--delivery-tokenını-almak)
4. [Proje kurulumu](#4-proje-kurulumu)
5. [CMS istemcisi (`lib/cms`)](#5-cms-istemcisi-libcms)
6. [Tüm siteyi tek rotayla sunmak](#6-tüm-siteyi-tek-rotayla-sunmak)
7. [İçerik işleme](#7-i̇çerik-i̇şleme-listeler-kayıtlar-tekil-sayfalar)
8. [Navigasyon menüleri](#8-navigasyon-menüleri)
9. [Sliderlar](#9-sliderlar)
10. [Kategoriler](#10-kategoriler)
11. [Dil değişkenleri & dil değiştirici](#11-dil-değişkenleri--dil-değiştirici)
12. [SEO, metadata, sitemap.xml & robots](#12-seo-metadata-sitemapxml--robots)
13. [Formlar & captcha (güvenli sunucu proxy'siyle)](#13-formlar--captcha-güvenli-sunucu-proxysiyle)
14. [Sosyal medya, çerez bandı, izleme & site görselleri](#14-sosyal-medya-çerez-bandı-i̇zleme--site-görselleri)
15. [Önbellek & tazeleme](#15-önbellek--tazeleme)
16. [Hata yönetimi](#16-hata-yönetimi)
17. [Yayına alma notları](#17-yayına-alma-notları)
18. [Yönlendirmeler (eski adresler & 404)](#18-yönlendirmeler-eski-adresler--404)
19. [Referans: panel ekranı → SDK çağrısı haritası](#19-referans-panel-ekranı--sdk-çağrısı-haritası)

---

## 1. AdsCRM nasıl çalışır (zihinsel model)

AdsCRM **headless, çok kiracılı (multi‑tenant)** bir CMS'tir. Birbirinden tamamen ayrı iki API
yüzeyi vardır:

| | Management API | Delivery API |
|---|---|---|
| **Kim kullanır** | Site yöneticileri, panelde | Web siteniz (bu rehber) |
| **Yön** | **Yazma** (içerik oluştur/düzenle) | **Salt‑okunur** (+ form gönderimi) |
| **URL öneki** | `/api/v1/admin/*` | `/api/v1/public/{site_token}/*` |
| **Yetki** | Giriş yapmış kullanıcı + `X-Site-ID` başlığı | Site **Delivery token'ı**, köken kısıtlı |
| **Bu pakette?** | ❌ kapsam dışı | ✅ ihtiyacınız olan her şey |

Management API'ye hiç dokunmazsınız. Yönetici içeriği panelde düzenler; içerik anında
(sunucu‑önbellekli) Delivery API'de yayınlanır; Next.js uygulamanız okur.

```
┌───────────────┐        ┌──────────────────────┐        ┌────────────────────┐
│ Site yönetici │ yazar  │  AdsCRM paneli        │  okur  │  Next.js siteniz    │
│ (panel arayüz)│ ─────▶ │  Management API       │ ◀───── │  @adsoffice/adscrm  │
└───────────────┘        │  Delivery API (önbel.)│        │  Delivery token     │
                         └──────────────────────┘        └────────────────────┘
```

**Anahtar fikir — site şema tabanlıdır.** Yönetici *bölümler* (**içerik tipleri** — content
type) tanımlar; her biri ya bir **koleksiyon** (kayıt listesi: *Haberler*, *Projeler*) ya da bir
**tekil sayfa** (ör. *Hakkımızda*). Her bölümün ve her kaydın, her dildeki URL'i API'den gelir.
Bu sayede **tüm siteyi tek bir yakalayıcı (catch‑all) rotayla** işleyebilirsiniz — panelde yeni
bölüm eklemek **sıfır** ön yüz kodu değişikliği gerektirir.

---

## 2. Site yöneticisi ne yönetir, siz neyi çekersiniz

Bu tablo tüm entegrasyonun belkemiğidir. Yöneticinin soldaki her yaptığı, sizin sağda okuduğunuz
bir değere dönüşür.

| Panel ekranı (site yönetici) | Neyi tanımlar | Siz nasıl okursunuz |
|---|---|---|
| **Site yapısı / Sitemap** | Bölümler (içerik tipleri), sıra, koleksiyon/tekil, ana sayfa | `cms.contentTypes()`, `cms.routes()`, `cms.urls()` |
| **Bölüm tasarımcısı → Alanlar** | Bölüm başına özel alan tanımları | alanlar her `ContentItem` / `page` üzerinde gelir |
| **Kayıtlar (items)** | Bir koleksiyon bölümünün satırları | `cms.list(tip)`, `cms.item(tip, slug)` |
| **Tekil sayfa gövdesi** | Koleksiyon olmayan bölümün içeriği | `cms.page(tip)` |
| **Kategoriler** | Bölüm başına taksonomi ağacı | `custom_fields` / `category` alanı, `cms.urls()`'te `kind:'category'` |
| **Sliderlar** | Adlandırılmış sliderlar + slaytlar | `cms.slider(slug)`, `cms.sliders()` |
| **Menüler** | Navigasyon ağaçları (header, footer…) | `cms.menu(slug)`, `cms.menuMap()` |
| **Dil değişkenleri** | Arayüz metinleri (etiket, buton), dil başına | `cms.strings()`, `cms.string(key)` |
| **Medya & galeri** | Yüklenen görsel/dosya/galeriler | alan değerleri içindeki URL'ler (`image`, `gallery`) |
| **Formlar + Gelen Kutusu** | Form şeması, alanlar, captcha | `cms.form(slug)`, `cms.submitForm(...)` |
| **SEO** | Kayıt başına başlık/açıklama/slug | `entry.seo`, `pageMetadata()` |
| **Sayfa Görünümleri** | Bloklardan oluşan sayfalar | `cms.view(slug)`, `cms.blocks(slug)` |
| **Ayarlar → API** | Delivery token'ları & izinli kökenler | `ADSCRM_TOKEN`'ınız |
| **Ayarlar → Sosyal / Çerez / İzleme / Görseller** | Footer bağlantıları, onay bandı, analitik, logolar | `cms.social()`, `cms.cookie()`, `cms.tracking()`, `cms.images()` |

> Bu ekranların yönetici tarafını A'dan Z'ye gösteren bir **animasyonlu tanıtım** ayrıca
> hazırlanmıştır. Geliştirici olarak paneli siz kullanmazsınız, ama her ekranın ne ürettiğini
> bilmek aşağıdaki alan adlarını ve yapıları apaçık kılar.

---

## 3. Ön koşullar & Delivery token'ını almak

**Gerekenler:**

- Node **18+** (Next.js 15 için 18.18+; 20/22 önerilir)
- Bir yönetici tarafından AdsCRM'de oluşturulmuş, **CMS** ürünü etkin bir site
- O site için bir **Delivery token'ı**

**Token'ı alın (yöneticiden isteyin ya da panel erişiminiz varsa kendiniz):**

> Panel → **Ayarlar → API** → *Delivery token oluştur* → kapsam **read** → değeri kopyalayın.
> Aynı ekranda, tarayıcı ve sunucu isteklerinin kabul edilmesi için sitenizin alan adlarını
> (ve geliştirme için `http://localhost:3000`) **izinli kökenler** listesine ekleyin.

Token **salt‑okunurdur**, yine de sunucu tarafında tutun (nedeni §13'te; tarayıcının token'a
ihtiyacı yoktur).

---

## 4. Proje kurulumu

```bash
npx create-next-app@latest sitem   # App Router, TS ya da JS
cd sitem
npm i @adsoffice/adscrm            # ya da: npm i git+https://github.com/adsoffice/adscrm-js.git
```

`.env.local`:

```bash
ADSCRM_URL=https://crm.adsoffice.net      # AdsCRM temel URL'iniz
ADSCRM_TOKEN=sk_xxxxxxxxxxxxxxxx           # Delivery token (salt‑okunur)
ADSCRM_LOCALE=tr                            # varsayılan (öneksiz) dil

# önbellek (bkz. §15)
ADSCRM_REVALIDATE=60                        # içerik için ISR saniyesi (0 = her istekte taze)
ADSCRM_STRUCTURE_REVALIDATE=300             # routes/urls için ISR saniyesi (yapısal)

# formlar (bkz. §13)
ADSCRM_FORM_CONTACT=iletisim                # panelde tanımlı bir form slug'ı

# tazeleme webhook'u (bkz. §15)
REVALIDATE_SECRET=uzun-rastgele-bir-deger
```

> **Diller.** AdsCRM varsayılan dili **öneksiz** (`/hakkimizda`), diğer dilleri **önekli**
> (`/en/about`) yayınlar. Bir `[locale]` segmenti kurmazsınız — §6'daki catch‑all rotası her iki
> biçimi de çözer.

---

## 5. CMS istemcisi (`lib/cms`)

Tüm uygulama için **tek bir paylaşılan istemci** kurun. Bu, en kritik dosyadır. Aşağıdaki kalıp
(gerçek bir yayın sitesinden uyarlanmıştır) çıplak `createCmsClient`'a üç şey ekler:

1. asla hata fırlatmayan bir **güvenli sarmalayıcı** (`fromCms`) — CMS kısa süre erişilemezse
   site işlemeye devam eder;
2. **iki önbellek katmanı** — içerik vs. yapısal uçlar (`routes`/`urls`); çünkü yapısal çağrılar
   *her* sayfa işlemesinde çalışır ve aksi halde Delivery hız limitini (120 istek/dk) yakar;
3. hedefli tazeleme için bir **etiket şeması**.

```ts
// lib/cms/client.ts
import { createCmsClient } from '@adsoffice/adscrm/next';
import type { AdsCrmClient } from '@adsoffice/adscrm';

const baseUrl = (process.env.ADSCRM_URL ?? '').replace(/\/$/, '');
const token = process.env.ADSCRM_TOKEN ?? '';

export const DEFAULT_LOCALE = process.env.ADSCRM_LOCALE || 'tr';

// İçerik sayfaları: ISR saniyesi (0 = her zaman dinamik/canlı).
export const REVALIDATE = Number(process.env.ADSCRM_REVALIDATE ?? '60');
// Yapısal uçlar (routes/urls) nadiren değişir ama her istekte çağrılır → daha uzun önbellek.
export const STRUCTURE_REVALIDATE = Number(process.env.ADSCRM_STRUCTURE_REVALIDATE ?? '300');

export const CMS_TAG = 'cms';
/** Etiket üretir: cmsTag('item','haberler','merhaba') → ['cms', 'cms:item:haberler:merhaba']. */
export function cmsTag(...parts: (string | undefined)[]): string[] {
  return [CMS_TAG, [CMS_TAG, ...parts.filter(Boolean)].join(':')];
}

export function isCmsConfigured(): boolean {
  return baseUrl.length > 0 && token.length > 0;
}

export const cms: AdsCrmClient | null = isCmsConfigured()
  ? createCmsClient({ baseUrl, token, locale: DEFAULT_LOCALE, revalidate: REVALIDATE, tags: [CMS_TAG] })
  : null;

/** Herhangi bir hatada null döndüren (asla fırlatmayan) CMS isteği. */
export async function fromCms<T>(
  request: (client: AdsCrmClient) => Promise<T>,
  label = 'istek',
): Promise<T | null> {
  if (!cms) return null;
  try {
    return await request(cms);
  } catch (error) {
    console.error(`[adscrm] ${label} başarısız:`, error);
    return null;
  }
}
```

Uygulama boyunca kullanım:

```ts
import { cms, fromCms, cmsTag, STRUCTURE_REVALIDATE } from '@/lib/cms/client';

// içerik — sayfa içinde fırlatması sorun değil (Next hata sınırı / notFound gösterir)
const post = await cms!.item('haberler', slug, { tags: cmsTag('item', 'haberler', slug) });

// yapısal — güvenli sarmalayıcı + daha uzun önbellek
const routes = await fromCms(
  (c) => c.routes({ revalidate: STRUCTURE_REVALIDATE, tags: cmsTag('routes') }),
  'routes',
);
```

> JS projesi mi? Tip anotasyonlarını atın; kod aynıdır.

---

## 6. Tüm siteyi tek rotayla sunmak

Her bölüm/kayıt URL'i API'den geldiği için tek bir **catch‑all** rota her şeyi işler.
`cms.resolve(path)` URL'i site şemasıyla eşleştirir ve doğru veriyi döndürür.

```jsx
// app/[[...slug]]/page.jsx   (React Server Component)
import { notFound } from 'next/navigation';
import { cms } from '@/lib/cms/client';
import { pageMetadata, staticSectionParams, staticItemParams } from '@adsoffice/adscrm/next';

// Bölümleri derlemede üret (hızlı); tam statik dışa aktarım için kayıtları da ekle.
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
      return <Detay type={page.type} item={page.data} />;
    case 'home':
    case 'section':
      return page.type.is_collection
        ? <Liste type={page.type} items={page.data} sayfa={page.page} meta={page.meta} />
        : <TekilSayfa icerik={page.page} />;
  }
}
```

`cms.resolve(path)` dönüşü: `{ kind, locale, type, itemSlug, data, page, meta, seo }`:

| `kind` | Anlamı | Veri nerede |
|---|---|---|
| `home` | Ana sayfa olarak işaretli bölüm (`/`, `/en`) | `data` = liste, `page` = sayfa gövdesi |
| `section` | Koleksiyon listesi **veya** tekil sayfa | `data` = alt kayıtlar (tekilde boş), `page` = sayfa gövdesi |
| `item` | Koleksiyon içindeki bir kayıt | `data` = kayıt |
| `notFound` | Eşleşme yok | — |

> Rotayı kendiniz eşleştirip veriyi ayrıca çekmek isterseniz `cms.route(path)` kullanın (veri
> çekmez) — bölüm slug'ına göre kendi şablon kayıt defterinizi kuracaksanız işe yarar.

### Çoklu dil, hâlâ tek rota

`/hakkimizda` (varsayılan dil) ve `/en/about` ikisi de burada çözülür — `[locale]` klasörü
gerekmez. Dil bazlı **rota grupları** (`app/(tr)` ve `app/(en)`) tercih ederseniz, her grubun
ince bir `[...slug]/page.jsx`'i kendi dilini aynı işleme fonksiyonuna geçirir. Dil bazlı ayrı
yerleşim (layout) gerekmiyorsa tek catch‑all ile sade tutun.

---

## 7. İçerik işleme (listeler, kayıtlar, tekil sayfalar)

### Koleksiyon listesi

```jsx
const { data: posts, meta } = await cms.list('haberler', { page: 1, limit: 12 });

<ul>
  {posts.map((p) => (
    <li key={p.id}>
      <a href={cms.itemPath(type, p, page.locale)}>{p.baslik}</a>
      <time>{p.published_at}</time>
    </li>
  ))}
</ul>
// meta = { total, page, last_page, per_page } → sayfalama kur
```

### Tek kayıt (detay sayfası)

```jsx
const post = await cms.item('haberler', slug);        // yoksa AdsCrmNotFoundError fırlatır
<article>
  <h1>{post.baslik}</h1>
  <div dangerouslySetInnerHTML={{ __html: post.icerik }} />   {/* richtext alanı, panelde temizlenmiş */}
</article>
```

### Tekil sayfa bölümü (ör. Hakkımızda)

```jsx
const about = await cms.page('hakkimizda');   // bölümün kendi sayfa gövdesi
```

### Alan tipleri → JSON

Yöneticinin **Bölüm tasarımcısı**'nda eklediği her alan, kayıt üzerinde bir özellik olarak gelir.

| Alan tipi | Değer |
|---|---|
| `text`, `textarea`, `slug`, `select`, `color`, `date`, `datetime` | `string` |
| `richtext` | HTML `string` (temizlenmiş) |
| `number` / `boolean` | `number` / `boolean` |
| `multiselect` / `json` | `string[]` / `object`\|`array` |
| `image`, `file` | URL `string` |
| `gallery` | `{ id, name, slug, images: [{ id, url, alt }] }` |
| `category` | `[{ id, name, slug, parent_id, description, image }]` — kategorinin tüm alanları için `cms.categories()` |
| `relation` | Sayfa: `{ id, kind: 'item', slug, type, title }` — `cms.item(type, slug)` ile çekin · Kategori: `{ id, kind: 'category', slug, title, type, path, description, image }` |

**İlişki alanı — sayfa mı, kategori mi?** Panelde ilişki alanının hedefi bir sitemap
bölümü (sayfa) ya da kategoriler (tüm kategoriler veya bir bölümün kategorileri)
olabilir. Hangisi olduğunu `kind` söyler:

```jsx
const rel = post.ilgili; // relation alanı

if (rel?.kind === 'category') {
  // Kategori: künye istenen dile çözülmüş gelir, path doğrudan bağlantıdır.
  return <a href={rel.path}>{rel.title}</a>;
}
if (rel) {
  // Sayfa: ilişkili kaydın tamamı gerekirse ayrıca çekilir.
  const target = await cms.item(rel.type, rel.slug);
}
```

Çok dilli sitelerde ilişki alanını panelde **Ortak alan** yapın: seçim tüm dillerde
geçerli olur, künye her dilde o dilin adı ve adresiyle döner.

Her kayıt ayrıca `seo: { title, description, slug }` ve kayda özgü serbest alanların dizisi
`custom_fields` taşır:

```jsx
{post.custom_fields.map((f) => (
  <div key={f.key}><dt>{f.label}</dt><dd>{f.value}</dd></div>
))}
```

---

## 8. Navigasyon menüleri

Yönetici menüleri (ör. `header`, `footer`) **Menüler** ekranında kurar. Layout'ta hepsini tek
istekte çekin:

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

- `item.url` zaten geçerli dile çözülmüştür (`/hizmetler` · `/en/services`).
- Alt öğesi olan ama gerçek bir bağlantısı olmayan üst öğe bir **etiket/açılır başlıktır** —
  çocuklarını asıl bağlantılar olarak işleyin.
- Bir dilde hiç öğe yoksa API varsayılan dile düşer; navigasyon asla boş kalmaz.

---

## 9. Sliderlar

Yönetici sliderları **Sliderlar** ekranında oluşturur; her slayt görsel veya video olabilir,
başlık, alt başlık ve bağlantı taşır.

```jsx
const slider = await cms.slider('anasayfa');    // { name, slug, settings, slides }

<Swiper>
  {slider.slides.map((s) => (
    <SwiperSlide key={s.id}>
      {s.type === 'video'
        ? <video src={s.media_url} poster={s.poster_url ?? undefined} muted autoPlay loop />
        : <img src={s.media_url} alt={s.title} />}
      <div className="caption">
        <h2>{s.title}</h2>
        <p>{s.subtitle}</p>
        {s.link && <a href={s.link}>Daha fazla</a>}
      </div>
    </SwiperSlide>
  ))}
</Swiper>
```

`slider.settings` serbest bir nesnedir (otomatik oynatma, aralık vb.) — yöneticinin
yapılandırdığı ne varsa; onu carousel kütüphanenize eşleyin.

---

## 10. Kategoriler

Kategoriler bölüm başına taksonomi ağacıdır ve **kendi içeriğini taşır**: ad ve adresin
yanında açıklama, görsel ve panelden tanımlanan ek alanlar.

### Kategori listesi — `cms.categories()`

```jsx
const kategoriler = await cms.categories({ type: 'hizmetler' });

<ul>
  {kategoriler.map((k) => (
    <li key={k.id}>
      <a href={k.path}>
        {k.image && <img src={k.image} alt="" />}
        <h3>{k.name}</h3>
        <p>{k.description}</p>
        {k.kisa_slogan && <small>{k.kisa_slogan}</small>}   {/* panelden eklenen ek alan */}
      </a>
    </li>
  ))}
</ul>
```

Her kategori: `{ id, parent_id, name, slug, description, image, type, path }` + bölümde
tanımlı **ek alanlar** (`alan_slug → değer`).

- **Standart alanlar**: başlık, adres (slug), **açıklama** ve **görsel** (görsel, panelin
  medya kütüphanesinden seçilir).
- **Ek alanlar**: Panel → Sitemap bölümü → *Alanları Düzenle* → **Kategori Alanları**
  (aynı alanlar Panel → *Kategoriler* ekranındaki bölüm kartından ve bölümün içerik
  listesindeki **Kategoriler** düğmesinden de yönetilir).
  Kullanılabilen tipler: tek satır, çok satır, zengin metin (dile göre ayrı girilir) ·
  görsel, galeri (tüm dillerde ortak). Tanımlı alanların listesi `cms.contentTypes()`
  yanıtındaki `fields` dizisinde `group: 'category'` satırlarıdır.
- `path` kategorinin public yoludur; `cms.urls()` / `cms.routes()` ile aynı adres.
- Kategorileri **kapalı** bölümlerin kategorileri hiç dönmez.
- Diğer yardımcılar: `cms.categoryTree()` (alt kategoriler `children` altında, yalnızca
  kökler döner) · `cms.categoryMap()` (`slug → kategori`) · `cms.category(slug)`.
  İstemci bileşenlerinde: `useCategories({ type })` → `{ categories, bySlug, tree }`.

### Kayıtlar ve URL'ler

1. **Bir kayıt üzerinde** — bir `category` alanıyla:
   `post.kategori = [{ id, name, slug, parent_id, description, image }]`.
2. **Rotalanabilir URL olarak** — `cms.urls()` `kind: 'category'` satırları döndürür; böylece
   kategori açılış sayfaları kurabilir ve bölüm başına listeleyebilirsiniz:

```jsx
const { data } = await cms.urls({ type: 'projeler' });
const kategoriler = data.filter((u) => u.kind === 'category');
// her biri: { ref: 'c:5', kind:'category', section:'projeler', urls:{tr:'/projeler/kategoriler/villa', …}, labels:{…} }
```

Kategori rota kalıbının kendisi (`/projeler/kategoriler/{slug}`) `cms.routes()`'te her bölümün
`locales[locale].category` alanında bulunur. Bir kategori açılış sayfası aslında o kategoriye
süzülmüş `cms.list('projeler', { query: { category: slug } })`'tir (kesin sorgu anahtarı bölümün
yapılandırmasına bağlıdır).

---

## 11. Dil değişkenleri & dil değiştirici

### Arayüz metinleri ("Dil değişkenleri")

Herhangi bir içerik kaydına ait olmayan sabit arayüz metinleri — buton etiketleri, bölüm
başlıkları, footer metni — **Dil değişkenleri** ekranında dil başına anahtar/değer olarak durur.

```jsx
// sunucu bileşeni
const t = await cms.strings({ group: 'ui' });   // { search_placeholder: 'Ara…', read_more: 'Devamı', … }
<button>{t.read_more}</button>
```

```jsx
// istemci bileşeni
'use client';
import { useStrings } from '@adsoffice/adscrm/react';
const { t } = useStrings({ group: 'ui' });
<input placeholder={t('search_placeholder')} />
```

### Hangi diller etkin + değiştirici

```jsx
const { items, default: def } = await cms.locales();
// items: [{ code:'tr', name:'Türkçe', prefix:'', home_path:'/' },
//         { code:'en', name:'English', prefix:'/en', home_path:'/en' }]

// "Aynı sayfanın diğer dildeki hâli" için cms.alternates() ile birleştirin:
const page = await cms.resolve(slug);
const alt = await cms.alternates(page.type, page.kind === 'item' ? page.data : undefined);
// { tr: '/urunler/sandalye', en: '/en/products/chair' }

<ul>
  {items.map((l) => <li key={l.code}><a href={alt[l.code] ?? l.home_path}>{l.name}</a></li>)}
</ul>
```

Eksik çeviriler otomatik olarak varsayılan dile düşer — asla boş alan veya ölü dil bağlantısı
göstermezsiniz.

---

## 12. SEO, metadata, sitemap.xml & robots

### Sayfa başına metadata

`pageMetadata(resolved, opts)` çözülmüş sayfanın `seo`'sunu bir Next `Metadata` nesnesine çevirir;
`openGraph` ve `alternates.languages` (hreflang) dahil:

```jsx
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [page, site] = await Promise.all([cms.resolve(slug), cms.site()]);
  return pageMetadata(page, {
    siteName: site.name,
    url: `https://ornek-site.com${page.locale === site.default_locale ? '' : '/' + page.locale}`,
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
  const origin = 'https://ornek-site.com';

  return data.map((entry) => ({
    url: origin + entry.urls[meta.default_locale],
    lastModified: entry.updated_at ?? undefined,
    alternates: {
      languages: Object.fromEntries(meta.locales.map((l) => [l, origin + entry.urls[l]])),
    },
  }));
}
```

> **"Sitemap eklemek" sizin için tam olarak budur.** Yönetici bir bölüm eklediğinde veya bir kayıt
> yayınladığında, o adres `cms.urls()`'te belirir; böylece `sitemap.xml`'iniz bir sonraki
> tazelemede kendini günceller — elle tutulan bir liste yoktur.

### `robots.txt`

```jsx
// app/robots.js
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: 'https://ornek-site.com/sitemap.xml',
  };
}
```

---

## 13. Formlar & captcha (güvenli sunucu proxy'siyle)

Form alanları ve captcha ayarları yönetici tarafından **Form tasarımcısı** ekranında tanımlanır;
istemci şemayı çekip formu kendisi kurar. Gönderimler panelde **Gelen Kutusu**'na düşer.

### Kendini kuran form (istemci bileşeni)

```jsx
'use client';
import { useAdsForm, Captcha } from '@adsoffice/adscrm/react';

export function IletisimFormu({ slug = 'iletisim' }) {
  const form = useAdsForm(slug);

  if (form.loading) return <p>Yükleniyor…</p>;
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

      <button disabled={form.submitting}>{form.submitting ? 'Gönderiliyor…' : 'Gönder'}</button>
      {form.error && <p role="alert">{form.error.message}</p>}
    </form>
  );
}
```

İstemci hook'larının bir istemcisi olması için uygulamanızı bir kez sarın:

```jsx
// app/providers.jsx
'use client';
import { AdsCrmProvider } from '@adsoffice/adscrm/react';
import { cms } from '@/lib/cms/client';
export function Providers({ locale, children }) {
  return <AdsCrmProvider client={cms} locale={locale}>{children}</AdsCrmProvider>;
}
```

### Token'ı tarayıcıdan uzak tutun — gönderimi proxy'leyin

`useAdsForm` doğrudan istemciyle gönderir. `ADSCRM_TOKEN`'ı tarayıcıya açarsanız (salt‑okunur da
olsa) her ziyaretçiye bir token göndermiş olursunuz. Yayın kalitesindeki kalıp; gönderimi ve
captcha'yı kendi rota işleyicilerinizden **proxy'lemektir**; böylece token sunucuda kalır:

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
    if (isNotFound(e)) return new Response('bulunamadı', { status: 404 });
    throw e;
  }
}
```

```js
// app/api/forms/[slug]/captcha/route.js  — GET matematik sorusu
import { cms } from '@/lib/cms/client';
export async function GET(_request, { params }) {
  const { slug } = await params;
  return Response.json(await cms.formCaptcha(slug));   // imzalı soru; asla önbelleklenmez
}
```

Sonra formu doğrudan CMS yerine kendi proxy'nize yöneltin. Dört captcha sağlayıcısı (`honeypot`,
`math`, `recaptcha`, `turnstile`) panelde ayarlanır; `<Captcha>` doğru widget'ı otomatik basar ve
tarayıcıya yalnızca public `site_key` ulaşır.

> **Çok dilli formlar** ek çaba gerektirmez: istemcinin dili her isteğe eklenir; etiketler, seçenek
> etiketleri ve başarı mesajı çevrilmiş gelir. Açılır listeler görüntü dili ne olursa olsun aynı
> kanonik değeri (`field.options`) gönderir; Gelen Kutunuz dile göre bölünmez.

---

## 14. Sosyal medya, çerez bandı, izleme & site görselleri

Hepsi **Ayarlar**'da yapılandırılır ve sizin tarafınızdan salt‑okunurdur.

```jsx
// Footer sosyal ikonlar (yalnızca etkin bağlantılar, marka renkleriyle)
const links = await cms.social();
{links.map((l) => (
  <a key={l.url} href={l.url} target="_blank" rel="noreferrer" style={{ color: l.color }}>
    {l.logo_url ? <img src={l.logo_url} alt={l.label} width={20} /> : <MyIcon name={l.platform} />}
  </a>
))}

// Site logosu / favicon
const img = await cms.imageMap();          // { site_logo, site_footer_logo, site_logo_white, favicon }
<img src={img.site_logo} alt="Logo" />

// Analitik / doğrulama kodları (<head>/<body>'ye bırakın)
const { codes, head_html, body_html } = await cms.tracking();
```

Çerez onayı — paket **içeriği** taşır; bandı siz çizer, onayı siz saklarsınız:

```jsx
const c = await cms.cookie();
// { enabled, position, theme, policy_link, texts: { title, message, accept_label, policy_label } }
if (c.enabled && !localStorage.getItem('cookie-consent')) {
  // bandı c.position'da c.theme ile çiz, c.texts.* göster, kabulde onayı sakla
}
```

---

### Bakım modu (yayın şarteli)

**Ayarlar → Site Durumu** altındaki şartel öntanımlı **açıktır** (site yayında).
Müşteri kapatırsa site pasife alınır: içerik uçları **`503`** döner ve yanıt gövdesinde
bakım künyesi gelir. Bakım sayfasını **siz** çizersiniz; CRM yalnızca başlık ile mesajı
(seçili dile çözülmüş) taşır.

Bakımda da açık kalan uçlar: `site` · `locales` · `images` · `social` · `cookie` ·
`tracking` · `strings` · `maintenance` — yani bakım sayfasının logosu ve dili çekilebilir.

Kök layout'ta tek kontrol yeterlidir:

```jsx
// app/layout.jsx
const m = await cms.maintenance();          // { enabled, retry_after, texts: { title, message } }
if (m.enabled) {
  return <html><body><Maintenance title={m.texts.title} message={m.texts.message} /></body></html>;
}
```

Ek istek istemiyorsanız hatayı yakalayın — içerik çağrısı zaten 503 döner:

```jsx
import { isMaintenance } from '@adsoffice/adscrm';

try {
  const { data } = await cms.list('haberler');
} catch (e) {
  if (isMaintenance(e)) return <Maintenance {...e.texts} />;
  throw e;
}
```

`cms.guard(fn)` aynısını `try/catch` yazmadan yapar: `{ ok, data, maintenance }`.

**Bakım sayfasını `503` ile döndürün** (`200` dönerseniz arama motorları onu gerçek
içerik sanar) ve `Retry-After: m.retry_after` başlığını ekleyin.

**Önizleme:** panel her siteye bir anahtar üretir; `createCmsClient({ previewKey })`
verirseniz istekler `?preview=…` taşır ve site pasifken de içerik döner. Anahtarı
istemci tarafı JS'e sızdırmayın (`NEXT_PUBLIC_` kullanmayın).

İstemci bileşenlerinde: `const { enabled, texts } = useMaintenance()`.

---

## 15. Önbellek & tazeleme

Yönetici ile ziyaretçi arasında birbirinden bağımsız iki önbellek katmanı vardır:

1. **AdsCRM Delivery önbelleği** (sunucu) — panelde içerik kaydedilince otomatik düşer.
2. **Next.js fetch önbelleği** (uygulamanız) — `revalidate` ve `tags` ile yönetilir.

Makul varsayılanlar, yapısal çağrılara daha uzun:

```js
await cms.list('haberler', { revalidate: 300, tags: cmsTag('list', 'haberler') });
await cms.item('haberler', slug, { revalidate: 0 });               // her zaman taze
await cms.routes({ revalidate: 3600, tags: cmsTag('routes') });    // yapısal, nadiren değişir
```

### Yayınlandığında webhook (anında güncelleme)

Panelin içerik değişiminde çağırabileceği, etiketleri düşüren bir rota ekleyin:

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

Bir **etiket şeması** dar tazeleme sağlar:
`cms:site`, `cms:menus`, `cms:strings`, `cms:urls`, `cms:routes`,
`cms:type:<bölüm>`, `cms:list:<bölüm>`, `cms:item:<bölüm>:<slug>`, `cms:view:<slug>`,
`cms:form:<slug>`.

**Canlı vs. ISR.** Geliştirme sırasında `ADSCRM_REVALIDATE=0` yapın (her istek taze). Yayında ISR
için `60`–`300` kullanın; anında güncelleme gerektiğinde webhook'a güvenin.

---

## 16. Hata yönetimi

```js
import { isNotFound, isValidationError, isRateLimited } from '@adsoffice/adscrm';

try {
  const post = await cms.item('haberler', slug);
} catch (e) {
  if (isNotFound(e)) notFound();     // 404 → Next notFound()
  throw e;                            // gerisini hata sınırına bırak
}
```

| Sınıf | Ne zaman |
|---|---|
| `AdsCrmNotFoundError` | 404 — yayında değil / yok |
| `AdsCrmValidationError` | 422 — form/captcha doğrulaması (`e.fieldErrors()`) |
| `AdsCrmRateLimitError` | 429 — Delivery 120/dk, formlar 10/dk |
| `AdsCrmMaintenanceError` | 503 — site bakım modunda; `e.texts` bakım başlığı/mesajı (`isMaintenance(e)`) |
| `AdsCrmNetworkError` | ağ/zaman aşımı (GET'ler iki kez yeniden denenir) |

**Her** sayfada okunan şeyleri (menüler, site ayarları, routes) `fromCms(...)` ile sarın; geçici
bir hata tüm siteyi düşürmek yerine zarifçe geriler.

---

## 17. Yayına alma notları

- Uygulama bir **Node sunucusu** ister (SSR/ISR + form proxy) — gönderim proxy'si veya
  `revalidate: 0` kullanıyorsanız saf statik dışa aktarım olamaz.
- Aynı ortam değişkenlerini yayında ayarlayın. Yayın alan adınızı panelin **izinli kökenler**
  listesine ekleyin (Ayarlar → API).
- `ADSCRM_REVALIDATE` işleme modunu belirler; konteynerliyorsanız bunu bir derleme argümanı gibi
  düşünün ve değiştirdiğinizde yeniden derleyin.
- Panelin tazeleme webhook'unu `https://alanadiniz/api/revalidate`'e `REVALIDATE_SECRET` ile
  yöneltin.

---

## 18. Yönlendirmeler (eski adresler & 404)

Site yenilendiğinde eski adresler 404'e düşer: arama motorlarındaki bağlantılar,
dış sitelerden gelen linkler, basılı malzemedeki QR kodları… Panelde
**Web Siteleri → Bağlantı Yöneticisi** ile bunlar yeni hedeflerine bağlanır ve
siz iki satır kodla uygularsınız.

Kaynak adres panelde **olduğu gibi** saklanır (`/Urunler/Eski_Sayfa.php?id=12`);
eşleşme büyük/küçük harfe duyarsızdır ve kural başına tip seçilir:

| `match` | Kaynak | Yakaladığı |
|---|---|---|
| `exact` | `/eski-sayfa.php` | yalnızca o adres |
| `prefix` | `/blog` | `/blog` ve altındaki her şey → `/blog/2019/yazi` ⇒ `/haberler/2019/yazi` |
| `wildcard` | `/urun/*/detay` | `*` yerine geleni yakalar; hedefte `$1`, `$2` |
| `regex` | `^/haber-(\d+)\.html$` | kalıp; gruplar hedefte `$1`, `$2` |

Ayrıca her kuralda: **yalnızca 404'te çalış** (var olan sayfaları bozmaz),
**sorgu parametrelerini taşı**, **kalan yolu hedefe ekle**.

### Middleware — her istekte, ek gecikme olmadan

Kural listesi önbelleklenir; eşleştirme paketin içindeki motorla yerelde yapılır
(sunucudakiyle birebir aynı mantık), yani istek başına CRM'e gidilmez.

```js
// middleware.js
import { NextResponse } from 'next/server';
import { redirectFor } from '@adsoffice/adscrm/next';
import { cms } from './lib/cms';

export async function middleware(request) {
  const hit = await redirectFor(cms, request);
  if (hit) return NextResponse.redirect(hit.target, hit.status);

  // İstenen yolu 404 sayfasına taşı (aşağıdaki adım için).
  const headers = new Headers(request.headers);
  headers.set('x-adscrm-path', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/((?!_next|api|favicon.ico|images).*)'] };
```

### 404 sayfası — son çare

Joker/regex kuralları ve "yalnızca 404'te çalış" kuralları burada sunucuda
çözülür. Ayrıca eşleşme **yoksa** adres panelin **Bulunamayan Adresler**
günlüğüne yazılır: site yöneticisi hangi eski bağlantıların hâlâ istendiğini
görür ve tek tıkla kural tanımlar.

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

  return <h1>Sayfa bulunamadı</h1>;
}
```

> Yalnızca bu adımı uygularsanız da sistem çalışır: middleware olmadan tüm
> yönlendirmeler 404 anında çözülür. Middleware'i eklemek, var olmayan sayfaya
> hiç girmeden yönlendirmeyi anında yapar (ve tıklama sayacı yerine önbellekli
> listeyi kullanır).

### Elle eşleştirme

```js
const rules = await cms.redirects();                          // sıralı liste
await cms.matchRedirect('/blog/2019/eski-yazi', { rules });    // yerel, sayaç artmaz
await cms.resolveRedirect('/kayip', { missing: true });        // sunucuda, sayaç artar
```

---

## 19. Referans: panel ekranı → SDK çağrısı haritası

Bir panel ekranına bakıp "ne çağırmalıyım" dediğinizde hızlı başvuru.

| Yönetici ekranı | Ürettiği | SDK (sunucu) | SDK (istemci hook) |
|---|---|---|---|
| Site yapısı / Sitemap | bölümler + URL'ler | `cms.contentTypes()` · `cms.routes()` · `cms.urls()` | `useContentTypes` · `useRoutes` · `useUrls` |
| Bölüm tasarımcısı / alanlar | kayıtlardaki alan tanımları | (`list`/`item`/`page` üzerindeki alanlar) | — |
| Kayıtlar | koleksiyon satırları | `cms.list(tip)` · `cms.item(tip, slug)` | `useList` · `useItem` |
| Tekil sayfa | sayfa gövdesi | `cms.page(tip)` | `usePage` |
| Kategoriler | taksonomi + kategori içeriği | `cms.categories()` · `cms.categoryTree()` · `cms.urls()` (`kind:'category'`) | `useCategories` · `useUrls` |
| Sliderlar | slaytlar | `cms.slider(slug)` · `cms.sliders()` | `useSlider` |
| Menüler | nav ağaçları | `cms.menu(slug)` · `cms.menuMap()` | `useMenu` · `useMenuTree` |
| Dil değişkenleri | arayüz metinleri | `cms.strings()` · `cms.string(key)` | `useStrings` |
| Medya & galeri | görsel/dosya URL'leri | (alan değerlerindeki URL'ler) | — |
| Formlar + Gelen Kutusu | form şeması / gönderim | `cms.form(slug)` · `cms.submitForm(...)` | `useAdsForm` |
| SEO | kayıt başına meta | `entry.seo` · `pageMetadata()` | — |
| Sayfa Görünümleri | bloklar | `cms.view(slug)` · `cms.blocks(slug)` | `useView` · `useBlocks` |
| Ayarlar → Sosyal | footer bağlantıları | `cms.social()` | `useSocial` |
| Ayarlar → Çerez | onay bandı | `cms.cookie()` | `useCookie` |
| Ayarlar → Site Durumu | yayın şarteli + bakım metni | `cms.maintenance()` · `cms.guard()` | `useMaintenance` |
| Ayarlar → İzleme | analitik kodları | `cms.tracking()` | — |
| Ayarlar → Görseller | logo/favicon | `cms.images()` · `cms.imageMap()` | `useSiteImages` |
| Ayarlar → API | delivery token | `ADSCRM_TOKEN`'ınız | — |
| Bağlantı Yöneticisi | yönlendirme kuralları + 404 günlüğü | `cms.redirects()` · `redirectFor()` · `notFoundRedirect()` | — |

---

**Sonraki adımlar:** yukarıdaki her metot ve seçenek için tam [API referansına](../README.md) göz
atın ve [`examples/next-app-router`](../examples/next-app-router) içindeki çalışan başlangıç
şablonunu kopyalayın. Yukarıdaki her ekranın yönetici tarafı için animasyonlu panel tanıtımını
izleyin.

🇬🇧 [English version →](GUIDE.en.md)
