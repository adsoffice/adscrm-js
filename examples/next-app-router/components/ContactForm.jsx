'use client';

import { Captcha, useAdsForm } from '@adsoffice/adscrm/react';

/**
 * Panelde tanımlı form şemasından kendini kuran iletişim formu.
 * Alanlar, zorunluluklar ve captcha sağlayıcısı sunucudan gelir —
 * panelde alan eklendiğinde burada kod değişmez.
 *
 * Üst seviyede <AdsCrmProvider client={cms}> sarmalayıcısı gerekir.
 */
export function ContactForm({ slug = 'iletisim' }) {
    const form = useAdsForm(slug);

    if (form.loading) return <p>Form yükleniyor…</p>;
    if (form.loadError) return <p role="alert">Form yüklenemedi.</p>;
    if (form.submitted) return <p role="status">{form.message}</p>;

    return (
        <form onSubmit={form.onSubmit} noValidate>
            {form.fields.map((field) => (
                <div key={field.name}>
                    <label htmlFor={field.name}>
                        {field.label}
                        {field.required && <span aria-hidden="true"> *</span>}
                    </label>

                    {field.type === 'textarea' ? (
                        <textarea
                            id={field.name}
                            rows={4}
                            value={form.values[field.name] ?? ''}
                            onChange={(event) => form.setValue(field.name, event.target.value)}
                        />
                    ) : field.type === 'select' ? (
                        <select
                            id={field.name}
                            value={form.values[field.name] ?? ''}
                            onChange={(event) => form.setValue(field.name, event.target.value)}
                        >
                            <option value="">Seçin…</option>
                            {(field.options || []).map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    ) : field.type === 'checkbox' ? (
                        <input
                            id={field.name}
                            type="checkbox"
                            checked={!!form.values[field.name]}
                            onChange={(event) => form.setValue(field.name, event.target.checked)}
                        />
                    ) : (
                        <input
                            id={field.name}
                            type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
                            value={form.values[field.name] ?? ''}
                            onChange={(event) => form.setValue(field.name, event.target.value)}
                            aria-invalid={form.errors[field.name] ? 'true' : undefined}
                        />
                    )}

                    {form.errors[field.name] && <p role="alert">{form.errors[field.name]}</p>}
                </div>
            ))}

            {/* Sağlayıcıya göre honeypot / math sorusu / reCAPTCHA / Turnstile */}
            <Captcha form={form} />

            <button type="submit" disabled={form.submitting}>
                {form.submitting ? 'Gönderiliyor…' : 'Gönder'}
            </button>

            {form.error && <p role="alert">{form.error.message}</p>}
        </form>
    );
}
