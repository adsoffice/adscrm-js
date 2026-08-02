# Next.js (App Router) örneği

Bu klasördeki dosyalar **kopyala-yapıştır** içindir; çalışan bir Next.js projesine
olduğu gibi taşıyabilirsiniz.

```
lib/cms.js                     → tek istemci (ISR + cache etiketi)
app/[[...slug]]/page.jsx       → tüm siteyi karşılayan tek rota
app/providers.jsx              → istemci bileşenleri için AdsCrmProvider
app/api/revalidate/route.js    → panel webhook'u ile önbellek tazeleme
components/ContactForm.jsx     → şemadan kurulan, captcha'lı form
```

## Kurulum

```bash
npm i git+https://github.com/<kullanici>/adscrm-js.git
```

`.env.local`:

```bash
ADSCRM_URL=https://crm.adsoffice.net
ADSCRM_TOKEN=sk_xxxxxxxxxxxx
REVALIDATE_SECRET=uzun-rastgele-bir-degen
```

## Dil önekli rotalar

AdsCRM varsayılan dili öneksiz (`/hakkimizda`), diğer dilleri önekli (`/en/about`)
yayınlar. `cms.resolve()` her iki biçimi de çözdüğü için `app/[[...slug]]` tek başına
yeterlidir — ayrı bir `[locale]` segmenti kurmanız gerekmez.

Dil değiştirici için:

```jsx
const site = await cms.site();
const page = await cms.resolve(params.slug);
const alternates = await cms.alternates(page.type, page.kind === 'item' ? page.data : undefined);
// { tr: '/urunler/sandalye', en: '/en/products/chair' }
```

## Statik üretim

`generateStaticParams` yalnızca bölümleri üretir (hızlı). Alt sayfaları da statik
istiyorsanız:

```js
import { staticItemParams, staticSectionParams } from '@adsoffice/adscrm/next';

export async function generateStaticParams() {
    const [sections, items] = await Promise.all([
        staticSectionParams(cms),
        staticItemParams(cms, { max: 500 }),
    ]);
    return [...sections, ...items];
}
```
