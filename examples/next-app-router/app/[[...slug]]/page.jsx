import { notFound } from 'next/navigation';
import Link from 'next/link';
import { pageMetadata, staticSectionParams } from '@adsoffice/adscrm/next';

import { cms } from '../../lib/cms';

/**
 * Tüm siteyi karşılayan tek rota. `cms.resolve()` gelen URL'i sitemap'e
 * göre eşler; ana sayfa, koleksiyon listesi, tekil sayfa ve alt sayfa
 * aynı dosyadan sunulur.
 *
 * Alt sayfaları da statik üretmek isterseniz:
 *   const [sections, items] = await Promise.all([staticSectionParams(cms), staticItemParams(cms)]);
 *   return [...sections, ...items];
 */
export async function generateStaticParams() {
    return staticSectionParams(cms);
}

export async function generateMetadata({ params }) {
    const page = await cms.resolve(params.slug);
    const site = await cms.site();
    return pageMetadata(page, { siteName: site.name });
}

export default async function CmsPage({ params }) {
    const page = await cms.resolve(params.slug, { limit: 12 });

    if (page.kind === 'notFound') notFound();

    if (page.kind === 'item') {
        return <Detay type={page.type} item={page.data} />;
    }

    // Tekil sayfa bölümlerinde alt sayfa yoktur; içerik `page` altındadır.
    if (!page.type.is_collection) {
        return <TekilSayfa icerik={page.page} />;
    }

    return <Liste page={page} />;
}

function TekilSayfa({ icerik }) {
    if (!icerik) return <p>Bu sayfanın içeriği henüz girilmemiş.</p>;
    return (
        <article>
            <h1>{icerik.seo?.title}</h1>
            {/* richtext alanları HTML döner */}
            {icerik.icerik ? <div dangerouslySetInnerHTML={{ __html: icerik.icerik }} /> : null}
        </article>
    );
}

function Liste({ page }) {
    const { type, data: items, page: bolumSayfasi, meta, locale } = page;

    return (
        <section>
            <h1>{bolumSayfasi?.seo?.title || type.name}</h1>

            <ul>
                {items.map((item) => (
                    <li key={item.id}>
                        <Link href={cms.itemPath(type, item, locale)}>{item.seo?.title || item.slug}</Link>
                    </li>
                ))}
            </ul>

            {meta?.last_page > 1 && <p>Sayfa {meta.page} / {meta.last_page}</p>}
        </section>
    );
}

function Detay({ item }) {
    return (
        <article>
            <h1>{item.seo?.title}</h1>
            {item.published_at && <time dateTime={item.published_at}>{new Date(item.published_at).toLocaleDateString('tr-TR')}</time>}
            {item.icerik ? <div dangerouslySetInnerHTML={{ __html: item.icerik }} /> : null}
        </article>
    );
}
