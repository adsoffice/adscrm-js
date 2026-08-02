import { createCmsClient } from '@adsoffice/adscrm/next';

/**
 * Tek istemci — tüm sunucu bileşenleri ve rota işleyicileri bunu kullanır.
 * `revalidate` ISR süresi, `tags` ise webhook'tan topluca tazeleme içindir.
 */
export const cms = createCmsClient({
    baseUrl: process.env.ADSCRM_URL,
    token: process.env.ADSCRM_TOKEN,
    revalidate: 60,
    tags: ['cms'],
});
