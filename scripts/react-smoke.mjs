/**
 * React katmanı duman testi — sunucu tarafında render ederek hook'ların ve
 * `Captcha` bileşeninin doğru çıktı verdiğini doğrular (ağ isteği yapmaz).
 *
 *   node scripts/react-smoke.mjs
 *
 * Not: `react` ve `react-dom` kurulu olmalıdır (paketin peer bağımlılığı).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { createClient } from '../src/index.js';
import { AdsCrmProvider, Captcha, useAdsCrm, useAdsCrmQuery, useAdsForm } from '../src/react/index.js';
import { buildSubmitBody, initialValues, normalizeCaptcha, validateValues } from '../src/forms.js';

let failed = 0;
const check = (label, condition, extra = '') => {
    if (condition) console.log(`  ✓ ${label}`, extra);
    else {
        failed++;
        console.log(`  ✗ ${label}`, extra);
    }
};

const client = createClient({ baseUrl: 'https://example.test', token: 'sk_test' });

console.log('\n── saf yardımcılar ────────────────────────');
const schema = {
    name: 'İletişim',
    slug: 'iletisim',
    fields: [
        { name: 'ad', label: 'Ad', type: 'text', required: true },
        { name: 'eposta', label: 'E-posta', type: 'email', required: true },
        { name: 'kvkk', label: 'Onay', type: 'checkbox' },
    ],
    captcha: { enabled: true, provider: 'math', site_key: null, honeypot_field: '_gotcha' },
};

check('initialValues()', JSON.stringify(initialValues(schema)) === '{"ad":"","eposta":"","kvkk":false}');
check('validateValues() zorunlu alan', validateValues(schema, {}).ad === 'Ad zorunludur.');
check('validateValues() e-posta', validateValues(schema, { ad: 'A', eposta: 'yanlis' }).eposta?.includes('e-posta'));
check('validateValues() temiz', Object.keys(validateValues(schema, { ad: 'A', eposta: 'a@b.co' })).length === 0);
check('normalizeCaptcha()', normalizeCaptcha(schema).provider === 'math' && normalizeCaptcha(schema).honeypotField === '_gotcha');
check(
    'buildSubmitBody() honeypot',
    JSON.stringify(buildSubmitBody({ ad: 'A' }, { captcha: { provider: 'honeypot', field: '_gotcha' }, honeypot: '' }))
        === '{"data":{"ad":"A"},"_gotcha":""}',
);

console.log('\n── bileşen render ─────────────────────────');

function CaptchaProbe({ provider }) {
    const form = {
        captcha: {
            enabled: true,
            provider,
            honeypotField: '_gotcha',
            honeypot: '',
            setHoneypot: () => {},
            question: '3 + 4',
            answer: '',
            setAnswer: () => {},
            widgetRef: { current: null },
            error: null,
        },
    };
    return createElement(Captcha, { form, className: 'captcha' });
}

const honeypotHtml = renderToStaticMarkup(createElement(CaptchaProbe, { provider: 'honeypot' }));
check('Captcha honeypot gizli input', honeypotHtml.includes('name="_gotcha"') && honeypotHtml.includes('aria-hidden'), honeypotHtml.slice(0, 60) + '…');

const mathHtml = renderToStaticMarkup(createElement(CaptchaProbe, { provider: 'math' }));
check('Captcha math soru', mathHtml.includes('3 + 4') && mathHtml.includes('<input'), mathHtml.slice(0, 70) + '…');

const widgetHtml = renderToStaticMarkup(createElement(CaptchaProbe, { provider: 'turnstile' }));
check('Captcha widget kabı', widgetHtml.includes('class="captcha"'), widgetHtml);

console.log('\n── provider + hook ────────────────────────');

function Consumer() {
    const { locale, client: scoped } = useAdsCrm();
    const query = useAdsCrmQuery(['probe'], () => Promise.resolve('x'), { enabled: false });
    return createElement('span', null, `${locale}|${scoped.config.base.endsWith('/sk_test')}|${query.isLoading}`);
}

const providerHtml = renderToStaticMarkup(
    createElement(AdsCrmProvider, { client, locale: 'en' }, createElement(Consumer)),
);
check('AdsCrmProvider dili aktarır', providerHtml.includes('en|true'), providerHtml);

function FormProbe() {
    const form = useAdsForm('iletisim');
    return createElement('span', null, String(form.loading));
}
const formHtml = renderToStaticMarkup(createElement(AdsCrmProvider, { client }, createElement(FormProbe)));
check('useAdsForm ilk render', formHtml.includes('true'), formHtml);

let threw = false;
try {
    renderToStaticMarkup(createElement(Consumer));
} catch (error) {
    threw = /AdsCrmProvider/.test(error.message);
}
check('provider dışında anlamlı hata', threw);

console.log(failed ? `\n${failed} kontrol başarısız.\n` : '\nTüm kontroller geçti.\n');
process.exit(failed ? 1 : 0);
