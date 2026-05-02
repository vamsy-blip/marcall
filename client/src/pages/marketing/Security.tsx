import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ShieldCheck, ExternalLink, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarcallWordmark } from '@/components/Brand';
import { LanguagePill } from '@/components/LanguageToggle';

// v2 controls added by security hardening pass
const V2_IN_PLACE_ES = [
  'Validación de firma de webhook de Twilio (SDK oficial, HMAC-SHA1)',
  'MFA (TOTP) para roles super-admin y tenant-admin — disponible, requerido para super-admin',
  'Almacén de sesiones en SQLite con revocación y cadena de expiración absoluta (7 días)',
  'CSP con nonces por solicitud (elimina unsafe-inline en producción)',
  'Registro de auditoría con cadena de hashes SHA-256 (detección de manipulación)',
  'Protección CSRF con doble-submit cookie (X-CSRF-Token)',
  'Consentimiento de cookies v2: categorías esencial vs. analíticas, Plausible solo al aceptar',
  'security.txt en /.well-known/security.txt',
  'Módulo centralizado de secretos con validación en producción',
];

const V2_IN_PLACE_EN = [
  'Twilio webhook signature validation (official SDK, HMAC-SHA1)',
  'MFA (TOTP) for super-admin and tenant-admin roles — available, required for super-admin',
  'SQLite-backed session store with revocation and 7-day absolute expiry',
  'CSP with per-request nonces (eliminates unsafe-inline in production)',
  'Tamper-evident audit log with SHA-256 hash chain',
  'CSRF protection via double-submit cookie (X-CSRF-Token)',
  'Cookie consent v2: essential vs. analytics categories, Plausible gated on consent',
  'security.txt at /.well-known/security.txt',
  'Centralized secrets module with production validation',
];

const SUBPROCESSORS = [
  { vendor: 'Vapi Labs Inc.', purpose: 'Voice orchestration', data: 'Call audio, transcripts', region: 'US', certs: 'SOC 2 Type II' },
  { vendor: 'Twilio Inc.', purpose: 'Telephony / SMS', data: 'Call metadata, recordings', region: 'US, global', certs: 'PCI, SOC 2, ISO 27001, HIPAA' },
  { vendor: 'OpenAI L.L.C.', purpose: 'LLM (assistant logic)', data: 'Transcripts (no training)', region: 'US', certs: 'SOC 2 Type II, GDPR DPA' },
  { vendor: 'ElevenLabs Inc.', purpose: 'Text-to-speech', data: 'Generated audio', region: 'US', certs: 'SOC 2 Type II' },
  { vendor: 'Deepgram Inc.', purpose: 'Speech-to-text', data: 'Call audio', region: 'US', certs: 'SOC 2 Type II, HIPAA' },
  { vendor: 'Stripe Inc.', purpose: 'Payments', data: 'Billing data only', region: 'US, global', certs: 'PCI L1, SOC 1/2, ISO 27001' },
  { vendor: 'Supabase Inc.', purpose: 'Database, storage, auth', data: 'Application data', region: 'US (us-east-1)', certs: 'SOC 2 Type II' },
  { vendor: 'Vercel Inc.', purpose: 'Hosting / CDN', data: 'Request metadata', region: 'Global', certs: 'SOC 2 Type II, ISO 27001' },
  { vendor: 'Resend Inc.', purpose: 'Transactional email', data: 'Email contents', region: 'US', certs: 'SOC 2 Type II' },
  { vendor: 'Plausible Insights OÜ', purpose: 'Web analytics', data: 'Anonymous usage', region: 'EU', certs: 'GDPR-native' },
];

export default function Security() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');

  const inPlaceItems = (t('security.inPlaceItems', { returnObjects: true }) as string[]) || [];
  const comingItems = (t('security.comingItems', { returnObjects: true }) as string[]) || [];
  const section2Items = (t('security.section2Items', { returnObjects: true }) as { k: string; v: string }[]) || [];
  const section3Cols = (t('security.section3Cols', { returnObjects: true }) as string[]) || ['Provider', 'Purpose', 'Data', 'Region', 'Certifications'];
  const section4Items = (t('security.section4Items', { returnObjects: true }) as string[]) || [];
  const section7Items = (t('security.section7Items', { returnObjects: true }) as { k: string; href: string }[]) || [];
  const section8Items = (t('security.section8Items', { returnObjects: true }) as { k: string; v: string }[]) || [];
  const v2Items = isEn ? V2_IN_PLACE_EN : V2_IN_PLACE_ES;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top bar ── */}
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80" data-testid="link-home">
            <MarcallWordmark className="h-6" />
          </Link>
          <div className="flex items-center gap-3">
            <LanguagePill />
            <Link href="/" data-testid="link-back-home">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                MARCALL
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="border-b">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            {t('security.heroEyebrow')}
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-semibold tracking-tight mb-5 leading-[1.1]" data-testid="text-security-hero-title">
            {t('security.heroTitle')}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-7">
            {t('security.heroLead')}
          </p>
          <a href="mailto:security@careofaddress.com" data-testid="link-security-contact">
            <Button variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Mail className="w-4 h-4 mr-2" />
              {t('security.contactBtn')}
            </Button>
          </a>
        </div>
      </section>

      {/* ── 1. Posture ── */}
      <Section id="posture" eyebrow="01">
        <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-2">{t('security.section1Title')}</h2>
        <p className="text-muted-foreground mb-8">{t('security.section1Sub')}</p>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">{t('security.inPlace')}</h3>
            <ul className="space-y-2.5 text-sm leading-relaxed">
              {inPlaceItems.map((item, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="text-primary font-semibold mt-0.5">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">{t('security.coming')}</h3>
            <ul className="space-y-2.5 text-sm leading-relaxed">
              {comingItems.map((item, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="text-muted-foreground/50 font-semibold mt-0.5">○</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* v2 controls — added by security hardening pass */}
        <div className="mt-8 pt-6 border-t">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            {isEn ? 'v2 Controls (2025 hardening)' : 'Controles v2 (refuerzo 2025)'}
          </h3>
          <ul className="grid md:grid-cols-2 gap-x-8 gap-y-2.5 text-sm leading-relaxed">
            {v2Items.map((item, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="text-primary font-semibold mt-0.5">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── 2. Compliance ── */}
      <Section id="compliance" eyebrow="02">
        <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-6">{t('security.section2Title')}</h2>
        <dl className="divide-y border-y">
          {section2Items.map((item, i) => (
            <div key={i} className="grid md:grid-cols-[220px_1fr] gap-2 md:gap-6 py-4">
              <dt className="font-semibold text-sm">{item.k}</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">{item.v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ── 3. Subprocessors ── */}
      <Section id="subprocessors" eyebrow="03">
        <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-2">{t('security.section3Title')}</h2>
        <p className="text-muted-foreground mb-6 text-sm">{t('security.section3Sub')}</p>
        <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
          <table className="w-full text-sm border-collapse min-w-[640px]">
            <thead>
              <tr className="border-y">
                {section3Cols.map((col, i) => (
                  <th key={i} className="text-left py-3 pr-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SUBPROCESSORS.map((sp, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="py-3 pr-4 font-medium">{sp.vendor}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{sp.purpose}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{sp.data}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{sp.region}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{sp.certs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── 4. Data & Retention ── */}
      <Section id="retention" eyebrow="04">
        <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-6">{t('security.section4Title')}</h2>
        <ul className="space-y-2.5 text-sm leading-relaxed">
          {section4Items.map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="text-primary font-semibold mt-0.5">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── 5. ARCO ── */}
      <Section id="arco" eyebrow="05">
        <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-3">{t('security.section5Title')}</h2>
        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">{t('security.section5Lead')}</p>
        <ul className="space-y-2.5 text-sm leading-relaxed mb-5">
          <li className="flex gap-2.5"><span className="text-primary font-semibold mt-0.5">A.</span><span>{t('security.arcoAccess')}</span></li>
          <li className="flex gap-2.5"><span className="text-primary font-semibold mt-0.5">R.</span><span>{t('security.arcoRect')}</span></li>
          <li className="flex gap-2.5"><span className="text-primary font-semibold mt-0.5">C.</span><span>{t('security.arcoCancel')}</span></li>
          <li className="flex gap-2.5"><span className="text-primary font-semibold mt-0.5">O.</span><span>{t('security.arcoOpp')}</span></li>
          <li className="flex gap-2.5"><span className="text-primary font-semibold mt-0.5">+</span><span>{t('security.arcoDelete')}</span></li>
        </ul>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">{t('security.arcoSla')}</span>
          <span className="text-muted-foreground">·</span>
          <a href={`mailto:${t('security.arcoEmail')}`} className="text-primary hover:underline" data-testid="link-arco-email">
            {t('security.arcoEmail')}
          </a>
        </div>
      </Section>

      {/* ── 6. Vulnerability reporting ── */}
      <Section id="vulnerability-reporting" eyebrow="06">
        <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-3">{t('security.section6Title')}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed mb-3">{t('security.section6Lead')}</p>
        <p className="text-xs text-muted-foreground italic mb-3">{t('security.section6Bounty')}</p>
        <div className="text-sm">
          <a
            href="https://marcall.careofaddress.com/.well-known/security.txt"
            className="text-primary hover:underline flex items-center gap-1.5"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-security-txt"
          >
            <span>security.txt</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </Section>

      {/* ── 7. Documents ── */}
      <Section id="documents" eyebrow="07">
        <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-6">{t('security.section7Title')}</h2>
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
          {section7Items.map((item, i) => {
            const isMail = item.href.startsWith('mailto:');
            const isInternal = item.href.startsWith('/');
            const inner = (
              <span className="flex items-center gap-2 group">
                <span className="group-hover:text-primary transition-colors">{item.k}</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground/60 group-hover:text-primary transition-colors" />
              </span>
            );
            return (
              <li key={i} className="text-sm">
                {isInternal ? (
                  <Link href={item.href} className="text-foreground hover:text-primary" data-testid={`link-doc-${i}`}>{inner}</Link>
                ) : (
                  <a href={item.href} className="text-foreground hover:text-primary" data-testid={`link-doc-${i}`}>{inner}</a>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ── 8. Contacts / Acknowledgments ── */}
      <Section id="acknowledgments" eyebrow="08" last>
        <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-6">{t('security.section8Title')}</h2>
        <dl className="divide-y border-y mb-5">
          {section8Items.map((item, i) => (
            <div key={i} className="grid grid-cols-[140px_1fr] gap-2 md:gap-6 py-3">
              <dt className="font-semibold text-sm">{item.k}</dt>
              <dd className="text-sm">
                <a href={`mailto:${item.v}`} className="text-primary hover:underline" data-testid={`link-contact-${i}`}>
                  {item.v}
                </a>
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground mb-1">{t('security.section8Address')}</p>
        <p className="text-xs text-muted-foreground">{t('security.section8Inai')}</p>
      </Section>

      {/* ── Footer back ── */}
      <footer className="border-t py-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© 2026 MARCALL</span>
          <Link href="/" className="hover:text-primary" data-testid="link-footer-home">← MARCALL</Link>
        </div>
      </footer>
    </div>
  );
}

function Section({ id, eyebrow, children, last = false }: { id: string; eyebrow: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section id={id} className={last ? 'py-14 md:py-20' : 'py-14 md:py-20 border-b'}>
      <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-[80px_1fr] gap-6 md:gap-12">
        <div className="text-xs font-mono text-muted-foreground/60 tracking-widest pt-1">{eyebrow}</div>
        <div>{children}</div>
      </div>
    </section>
  );
}
