import { NextResponse } from 'next/server';
import { redirectFor } from '@adsoffice/adscrm/next';

import { cms } from './lib/cms';

/**
 * Panelde tanımlı yönlendirmeler (Bağlantı Yöneticisi).
 *
 * Kural listesi önbelleklenir, eşleştirme yereldedir — istek başına CRM'e
 * gidilmez. "Yalnızca sayfa bulunamazsa çalışsın" işaretli kurallar burada
 * atlanır; onları `app/not-found.jsx` çözer (bkz. `notFoundRedirect`).
 */
export async function middleware(request) {
    const hit = await redirectFor(cms, request);
    if (hit) return NextResponse.redirect(hit.target, hit.status);

    // İstenen yolu 404 sayfasına taşı — `not-found.jsx` yolu kendisi bilemez.
    const headers = new Headers(request.headers);
    headers.set('x-adscrm-path', request.nextUrl.pathname + request.nextUrl.search);

    return NextResponse.next({ request: { headers } });
}

export const config = {
    // Statik dosyalar ve API rotaları dışındaki her istek.
    matcher: ['/((?!_next/static|_next/image|api|favicon.ico|images|fonts).*)'],
};
