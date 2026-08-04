/**
 * Duman testi — paketi gerçek bir AdsCRM sitesine karşı uçtan uca dener.
 *
 *   ADSCRM_URL=http://localhost ADSCRM_TOKEN=sk_… node scripts/smoke.mjs
 *
 * Salt okunur uçları çağırır; hiçbir şey yazmaz (form gönderimi denenmez,
 * yalnızca şema + captcha meydan okuması okunur).
 */
import { isNotFound, resolveRoute, toMetadata, buildSubmitBody } from '../src/index.js';
import { createCmsClient, staticSectionParams, pageMetadata } from '../src/next/index.js';

const cms = createCmsClient({
    baseUrl: process.env.ADSCRM_URL || 'http://localhost',
    token: process.env.ADSCRM_TOKEN,
    revalidate: false,
});

let failed = 0;
const ok = (label, value) => console.log(`  ✓ ${label}`, value === undefined ? '' : value);
const bad = (label, error) => { failed++; console.log(`  ✗ ${label}:`, error?.message || error); };

async function step(label, fn) {
    try {
        const result = await fn();
        ok(label, result);
    } catch (error) {
        bad(label, error);
    }
}

console.log('\n── site & sitemap ─────────────────────────');
const site = await cms.site();
await step('site()', () => `${site.name} · diller: ${site.locales.join(',')} · varsayılan: ${site.default_locale}`);

await step('locales()', async () => {
    const langs = await cms.locales();
    return `${langs.locales.join(',')} · varsayılan=${langs.default} · current=${langs.current} · `
        + langs.items.map((l) => `${l.code}:"${l.name}"${l.prefix || '(öneksiz)'}→${l.home_path}`).join(' ');
});
await step('defaultLocale()', () => cms.defaultLocale());

const types = await cms.contentTypes();
await step('contentTypes()', () => types.map((t) => `${t.slug}${t.is_collection ? '' : ' (tekil)'}`).join(', '));
await step('tracking()', async () => Object.keys(await cms.tracking()).join(', '));

await step('urls()', async () => {
    const res = await cms.urls();
    const counts = res.data.reduce((acc, e) => ({ ...acc, [e.kind]: (acc[e.kind] || 0) + 1 }), {});
    const sample = res.data.find((e) => e.kind === 'page') || res.data[0];
    return `${res.meta.total} adres (${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(' ')})`
        + (sample ? ` · örn. ${sample.ref} → ${JSON.stringify(sample.urls)}` : '');
});
await step("urls({kind:'section'})", async () => {
    const res = await cms.urls({ kind: 'section' });
    return `${res.data.length} bölüm · hepsi section=${res.data.every((e) => e.kind === 'section')}`;
});
await step('urls({flat:true})', async () => {
    const res = await cms.urls({ flat: true });
    const first = res.data[0];
    return `${res.data.length} satır · örn. ${first?.locale} ${first?.url}`;
});
await step('urlMap()', async () => Object.keys(await cms.urlMap({ kind: 'section' })).slice(0, 3).join(', '));

await step('routes()', async () => {
    const res = await cms.routes();
    const first = res.data.sections.find((s) => s.is_collection) || res.data.sections[0];
    const tr = first?.locales?.[res.data.default_locale];
    return `${res.meta.sections} bölüm · ${res.meta.total} kalıp · ana sayfa ${JSON.stringify(res.data.homepage)}`
        + (tr ? ` · örn. ${tr.section} → ${tr.page ?? '(tekil)'}` : '');
});
await step("routes({style:'next'})", async () => {
    const rows = await cms.dynamicRoutes({ style: 'next' });
    return `${rows.length} dinamik kalıp · örn. ${rows[0]?.path ?? '—'}`;
});
await step("routes({kind:'page'})", async () => {
    const res = await cms.routes({ kind: 'page' });
    return `${res.data.routes.length} satır · hepsi page=${res.data.routes.every((r) => r.kind === 'page')}`;
});

console.log('\n── içerik ─────────────────────────────────');
const collection = types.find((t) => t.is_collection && !t.is_homepage);
const single = types.find((t) => !t.is_collection && !t.is_homepage);

if (collection) {
    const list = await cms.list(collection.slug, { limit: 3 });
    await step(`list('${collection.slug}')`, () => `${list.data.length} kayıt / toplam ${list.meta.total}`);

    if (list.data[0]) {
        const item = await cms.item(collection.slug, list.data[0].slug);
        await step(`item('${collection.slug}','${list.data[0].slug}')`, () => `seo.title = ${JSON.stringify(item.seo?.title)}`);
        await step('toMetadata()', () => JSON.stringify(toMetadata(item, { siteName: site.name })).slice(0, 90) + '…');
    }
    await step('allItems()', async () => (await cms.allItems(collection.slug, { limit: 50, max: 200 })).length + ' kayıt');
}

if (single) {
    await step(`page('${single.slug}') [tekil sayfa]`, async () => {
        const page = await cms.page(single.slug);
        return page ? `alanlar: ${Object.keys(page).slice(0, 6).join(', ')}` : 'içerik yok';
    });
}

await step('homepage()', async () => {
    const home = await cms.homepage();
    return `${home.data.length} kayıt · page ${home.page ? 'var' : 'yok'}`;
});

console.log('\n── rota çözümü ────────────────────────────');
if (collection) {
    const path = cms.path(collection, site.default_locale);
    await step(`route('${path}')`, async () => {
        const r = await cms.route(path);
        return `${r.kind} → ${r.type?.slug} (${r.locale})`;
    });
    await step(`resolve('${path}')`, async () => {
        const r = await cms.resolve(path, { limit: 2 });
        return `${r.kind}, ${Array.isArray(r.data) ? r.data.length + ' kayıt' : 'tek kayıt'}`;
    });

    const items = (await cms.list(collection.slug, { limit: 1 })).data;
    if (items[0]) {
        const itemUrl = cms.itemPath(collection, items[0], site.default_locale);
        await step(`resolve('${itemUrl}')`, async () => {
            const r = await cms.resolve(itemUrl);
            return `${r.kind} → ${r.data?.slug}`;
        });
    }

    const other = site.locales.find((l) => l !== site.default_locale);
    if (other) {
        const localized = cms.path(collection, other);
        await step(`resolve('${localized}') [dil önekli]`, async () => {
            const r = await cms.resolve(localized);
            return `${r.kind} · locale=${r.locale}`;
        });
    }
}
await step("resolve('/olmayan-sayfa')", async () => (await cms.resolve('/olmayan-sayfa')).kind);
await step('resolveRoute() saf fonksiyon', () => resolveRoute('/', { site, types }).kind);

console.log('\n── menü · slider · view · strings ─────────');
await step('menus()', async () => (await cms.menus()).map((m) => m.slug).join(', ') || '—');
const menus = await cms.menus();
if (menus[0]) {
    await step(`menu('${menus[0].slug}')`, async () => (await cms.menu(menus[0].slug)).items.length + ' öğe');
    await step(`menu(${menus[0].id}) [id ile]`, async () => {
        const byId = await cms.menu(menus[0].id);
        return `${byId.slug} · ${byId.items.length} öğe`;
    });
}
await step('menuTree()', async () => {
    const tree = await cms.menuTree();
    return tree.data.map((m) => `${m.slug}(${m.items.length})`).join(', ') + ` · meta.locale=${tree.meta.locale}`;
});
await step('menuMap()', async () => Object.keys(await cms.menuMap()).join(', ') || '—');
await step("menuTree({locales:'all'})", async () => {
    const tree = await cms.menuTree({ locales: 'all' });
    const first = tree.data[0];
    return first
        ? `${first.slug} → ${Object.entries(first.items_by_locale).map(([l, i]) => `${l}:${i.length}`).join(' ')}`
        : 'menü yok';
});
const sliders = await cms.sliders();
await step('sliders()', () => sliders.map((s) => s.slug).join(', ') || '—');
if (sliders[0]) await step(`slider('${sliders[0].slug}')`, async () => (await cms.slider(sliders[0].slug)).slides.length + ' slayt');
await step('strings()', async () => Object.keys(await cms.strings()).length + ' anahtar');
await step("strings({locales:'all'})", async () => Object.keys(await cms.strings({ locales: 'all' })).length + ' anahtar');
await step('search()', async () => (await cms.search('a', { limit: 3 })).data.length + ' sonuç');

console.log('\n── formlar & captcha ──────────────────────');
const formSlug = process.env.ADSCRM_FORM || 'iletisim';
await step(`form('${formSlug}')`, async () => {
    const schema = await cms.form(formSlug);
    return `${schema.fields.length} alan · captcha=${schema.captcha.provider} (honeypot alanı: ${schema.captcha.honeypot_field})`;
});
await step(`formCaptcha('${formSlug}')`, async () => JSON.stringify(await cms.formCaptcha(formSlug)));
await step('buildSubmitBody()', () =>
    JSON.stringify(buildSubmitBody({ ad: 'Ali' }, { captcha: { provider: 'math', answer: 7, token: 'x', expiresAt: 123 } })));

console.log('\n── next.js yardımcıları ───────────────────');
await step('staticSectionParams()', async () => {
    const params = await staticSectionParams(cms);
    return params.slice(0, 5).map((p) => '/' + p.slug.join('/')).join(' · ') + ` (toplam ${params.length})`;
});
await step('pageMetadata()', async () => {
    const resolved = await cms.resolve('/');
    return JSON.stringify(pageMetadata(resolved, { siteName: site.name })).slice(0, 90) + '…';
});

console.log('\n── hata yönetimi ──────────────────────────');
await step('404 → AdsCrmNotFoundError', async () => {
    try {
        await cms.item(collection?.slug || 'x', 'kesinlikle-yok-boyle-bir-sey');
        return 'HATA: istisna fırlatmadı';
    } catch (error) {
        return isNotFound(error) ? `isNotFound=true (${error.status})` : `beklenmedik: ${error.name}`;
    }
});

console.log(failed ? `\n${failed} adım başarısız.\n` : '\nTüm adımlar geçti.\n');
process.exit(failed ? 1 : 0);
