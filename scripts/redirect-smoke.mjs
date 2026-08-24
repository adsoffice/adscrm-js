/**
 * Yönlendirme motoru testi — **ağ gerektirmez**.
 *
 *   node scripts/redirect-smoke.mjs
 *
 * `src/redirects.js` içindeki eşleştirme, panelin (Laravel `LinkRedirects`
 * servisi) davranışını birebir taklit etmelidir: aynı kural + aynı yol → aynı
 * hedef. Buradaki senaryolar CRM tarafındaki `LinkManagerTest` ile eşleşir.
 */
import { findRedirect, normalizeRedirectPath, sortRedirects } from '../src/redirects.js';

let failed = 0;
const is = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) failed++;
    console.log(`  ${ok ? '✓' : '✗'} ${label}${ok ? '' : `  → ${JSON.stringify(got)} (beklenen ${JSON.stringify(want)})`}`);
};

/** Delivery'nin `/links` satırlarıyla aynı biçim. */
const rule = (o) => ({
    match: 'exact',
    type: 'internal',
    status: 301,
    only_when_missing: false,
    keep_query: true,
    append_remainder: true,
    ...o,
});

console.log('\n── yol normalleştirme ─────────────────────');
is('tam adres → yol + sorgu', normalizeRedirectPath('https://x.com/Haberler//Eski%20Sayfa/?id=12'), '/Haberler/Eski Sayfa?id=12');
is('boş → kök', normalizeRedirectPath(''), '/');
is('sondaki slash düşer', normalizeRedirectPath('/blog/yazi/'), '/blog/yazi');

const rules = [
    rule({ source: '/eski-sayfa.php', target: '/yeni-sayfa' }),
    rule({ source: '/blog', match: 'prefix', target: '/haberler' }),
    rule({ source: '/urun/*/detay', match: 'wildcard', target: '/urunler/$1' }),
    rule({ source: '/kampanya/*', match: 'wildcard', target: '/promosyon' }),
    rule({ source: '^/haber-(\\d+)\\.html$', match: 'regex', target: '/haberler/$1' }),
    rule({ source: '/hizmetler', target: '/hizmetlerimiz', only_when_missing: true }),
    rule({ source: '/dongu', target: '/dongu' }),
    rule({ source: '/detay.php?id=12', target: '/urunler/masa' }),
];

console.log('\n── eşleşme tipleri ────────────────────────');
is('tam (büyük/küçük harf duyarsız)', findRedirect(rules, '/ESKI-Sayfa.PHP')?.target, '/yeni-sayfa');
is('önek + kalan yol', findRedirect(rules, '/blog/2019/eski-yazi')?.target, '/haberler/2019/eski-yazi');
is('önek kökün kendisi', findRedirect(rules, '/blog')?.target, '/haberler');
is('joker → $1', findRedirect(rules, '/URUN/Masa-Lambasi/detay')?.target, '/urunler/Masa-Lambasi');
is('joker sonda → kalan yol', findRedirect(rules, '/kampanya/yaz/2026')?.target, '/promosyon/yaz/2026');
is('regex grubu', findRedirect(rules, '/haber-4512.html')?.target, '/haberler/4512');
is('eşleşme yok', findRedirect(rules, '/hicbir-yerde-yok'), null);

console.log('\n── seçenekler ─────────────────────────────');
is('sorgu hedefe taşınır', findRedirect(rules, '/eski-sayfa.php?utm=mail')?.target, '/yeni-sayfa?utm=mail');
is('kaynak sorgu şartı tutar', findRedirect(rules, '/detay.php?id=12')?.target, '/urunler/masa?id=12');
is('kaynak sorgu şartı tutmaz', findRedirect(rules, '/detay.php?id=99'), null);
is('yalnızca-404: sayfa varken atlanır', findRedirect(rules, '/hizmetler'), null);
is('yalnızca-404: 404 iken çalışır', findRedirect(rules, '/hizmetler', { missing: true })?.target, '/hizmetlerimiz');
is('sonsuz döngü engellenir', findRedirect(rules, '/dongu'), null);

is(
    'append_remainder=false → tek hedef',
    findRedirect([rule({ source: '/eski', match: 'prefix', target: '/tek-hedef', append_remainder: false })], '/eski/alt/yol')?.target,
    '/tek-hedef',
);
is(
    'keep_query=false → sorgu düşer',
    findRedirect([rule({ source: '/x', target: '/y', keep_query: false })], '/x?utm=1')?.target,
    '/y',
);
is(
    'dış hedefte sorgu birleşir (hedefinki kazanır)',
    findRedirect([rule({ source: '/git', type: 'external', target: 'https://ornek.com/x?a=1', status: 302 })], '/git?b=2')?.target,
    'https://ornek.com/x?b=2&a=1',
);

console.log('\n── sıralama ───────────────────────────────');
is(
    'tam eşleşme öneğin önünde',
    sortRedirects([
        rule({ source: '/blog', match: 'prefix', target: '/haberler' }),
        rule({ source: '/blog', target: '/blog-ana-sayfa' }),
    ])[0].target,
    '/blog-ana-sayfa',
);

console.log(failed ? `\n${failed} adım başarısız.\n` : '\nTüm adımlar geçti.\n');
process.exit(failed ? 1 : 0);
