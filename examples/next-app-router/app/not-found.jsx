import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { notFoundRedirect } from '@adsoffice/adscrm/next';

import { cms } from '@/lib/cms';

/**
 * 404 sayfası — aynı zamanda yönlendirmelerin son çaresi.
 *
 * `notFoundRedirect` adresi sunucuda çözer: joker/regex ve "yalnızca 404'te
 * çalış" kuralları burada uygulanır, tıklama sayılır. Eşleşme yoksa adres
 * panelin **Bulunamayan Adresler** günlüğüne yazılır — yönetici oradan tek
 * tıkla kural tanımlar.
 *
 * Yolu `middleware.js` `x-adscrm-path` başlığıyla iletir.
 */
export default async function NotFound() {
    const path = (await headers()).get('x-adscrm-path') || '/';
    const target = await notFoundRedirect(cms, path);

    if (target) redirect(target);

    return (
        <main className="not-found">
            <h1>Sayfa bulunamadı</h1>
            <p>Aradığınız adres taşınmış ya da kaldırılmış olabilir.</p>
            <Link href="/">Ana sayfaya dön</Link>
        </main>
    );
}
