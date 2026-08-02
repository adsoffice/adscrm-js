'use client';

import { AdsCrmProvider } from '@adsoffice/adscrm/react';

import { cms } from '../lib/cms';

/**
 * İstemci bileşenlerinin (arama kutusu, form, sonsuz liste) hook'ları
 * kullanabilmesi için kök layout'ta bir kez sarmalayın:
 *
 *   <Providers locale={locale}>{children}</Providers>
 *
 * Sunucu bileşenlerinde provider'a gerek yoktur — doğrudan `await cms.…`.
 */
export function Providers({ locale, children }) {
    return (
        <AdsCrmProvider client={cms} locale={locale}>
            {children}
        </AdsCrmProvider>
    );
}
