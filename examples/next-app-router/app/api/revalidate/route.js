import { revalidateTag } from 'next/cache';

/**
 * Panelde içerik değişince çağrılacak webhook.
 *
 *   curl -X POST https://site.com/api/revalidate \
 *     -H 'Content-Type: application/json' \
 *     -d '{"secret":"…","tag":"cms"}'
 *
 * İstemci `tags: ['cms']` ile kurulduğu için tek etiket tüm içeriği tazeler;
 * daha ince taneli tazeleme için çağrı bazında `tags: ['cms:haberler']` verin.
 */
export async function POST(request) {
    const { secret, tag } = await request.json().catch(() => ({}));

    if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
        return Response.json({ message: 'Yetkisiz.' }, { status: 401 });
    }

    revalidateTag(tag || 'cms');

    return Response.json({ revalidated: true, tag: tag || 'cms' });
}
