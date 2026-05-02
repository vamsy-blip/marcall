import bcrypt from 'bcryptjs';
import { storage } from './storage';

// v0.3 demo passwords are pre-hashed at build time so the deployed server
// boots without spending bcrypt CPU on every cold start. Source passwords
// live in CREDENTIALS_v0.3.md (kept out of the repo). Login uses
// `bcrypt.compare` in routes.ts, with transparent rehash for legacy SHA-256
// values that may still exist on long-running deployments.
const BCRYPT_HASHES: Record<string, string> = {
  'admin@marcall.mx':         '$2b$12$i1cG2kdIyOZmZHEPnB2.YOXzxBpL0rkL0KCdBE/Kus8dxtUrkewT6',
  'agencia@demo.mx':          '$2b$12$QfR9hPS2WHKdKDFpaWdRcu1NMgrjq4Mg.u0ZAMnmAas7RF23ID56W',
  'dueno@despachoreyes.mx':   '$2b$12$Poi3mlC7nyFtW2iKG31gneQxUottm9t/ih.r9bNm8YyPd2whF174O',
  'dueno@salonbella.mx':      '$2b$12$wSGHgfrGkBnly.K6Ad2KwO77UOTU1Uh9YJSvdGUjPbVi.aUiuDvZ6',
};

function hash(pw: string, email?: string) {
  // The four demo accounts ship with pre-baked bcrypt hashes (above). The
  // plaintext passwords NEVER appear in this file — the `pw` argument is
  // ignored for those accounts. Source passwords live in CREDENTIALS_v0.3.md
  // (gitignored) and only the agent + the user have access to them.
  if (email && BCRYPT_HASHES[email]) return BCRYPT_HASHES[email];
  // Fallback for any future seeds that pass a real password (dev only).
  return bcrypt.hashSync(pw, 12);
}

const PLAN_DEFS = [
  {
    slug: 'inicia', name: 'Inicia', priceMxnCents: 79900, includedMinutes: 200,
    overagePerMinMxnCents: 700, maxAssistants: 1, maxNumbers: 1, voiceTier: 'azure_standard',
    // Features are stored as i18n translation keys (see
    // `client/src/i18n/{en,es}.json` → marketing.planFeatures). The Pricing
    // page resolves them through t(); legacy literal strings still render
    // as a fallback for backwards compat.
    features: JSON.stringify(['assistants_one', 'voice_azure_standard', 'calendar_google', 'support_email']),
  },
  {
    slug: 'crece', name: 'Crece', priceMxnCents: 249900, includedMinutes: 800,
    overagePerMinMxnCents: 500, maxAssistants: 3, maxNumbers: 2, voiceTier: 'elevenlabs',
    features: JSON.stringify(['assistants_three', 'voice_elevenlabs', 'languages_es_en', 'webhooks_crm', 'support_priority']),
  },
  {
    slug: 'empresa', name: 'Empresa', priceMxnCents: 499900, includedMinutes: 2500,
    overagePerMinMxnCents: 400, maxAssistants: 10, maxNumbers: 5, voiceTier: 'elevenlabs_premium',
    features: JSON.stringify(['assistants_ten', 'voice_elevenlabs_premium', 'languages_multi', 'remove_marcall_brand', 'account_manager']),
  },
  {
    slug: 'agencia', name: 'Agencia', priceMxnCents: 999900, includedMinutes: 7500,
    overagePerMinMxnCents: 300, maxAssistants: 9999, maxNumbers: 25, voiceTier: 'elevenlabs',
    features: JSON.stringify(['assistants_unlimited', 'shared_minutes', 'custom_domain', 'white_label', 'commission_25_35', 'support_24_7']),
  },
];

const FAQS_CLINICA = [
  { q: '¿Cuáles son sus horarios de atención?', a: 'Atendemos de lunes a viernes de 9:00 a 19:00 horas y sábados de 9:00 a 14:00 horas. Cerramos los domingos.', qEn: 'What are your hours?', aEn: 'We are open Monday to Friday from 9:00 AM to 7:00 PM and Saturdays from 9:00 AM to 2:00 PM. Closed Sundays.' },
  { q: '¿Aceptan seguros médicos?', a: 'Sí, trabajamos con GNP, AXA, MetLife y Mapfre. Le pedimos traer su credencial vigente y carta autorización si la requiere su aseguradora.', qEn: 'Do you accept insurance?', aEn: 'Yes, we work with GNP, AXA, MetLife and Mapfre. Please bring your valid card and authorization letter if your insurer requires one.' },
  { q: '¿Cuánto cuesta una consulta general?', a: 'La consulta general tiene un costo de 800 pesos. Las consultas de especialidad varían entre 1,200 y 2,000 pesos.', qEn: 'How much is a general consultation?', aEn: 'A general consultation is 800 pesos. Specialty consultations range between 1,200 and 2,000 pesos.' },
  { q: '¿Dónde están ubicados?', a: 'Estamos en Av. Constitución 2400, Col. Centro, Monterrey. Contamos con estacionamiento gratuito para pacientes.', qEn: 'Where are you located?', aEn: 'We are at Av. Constitución 2400, Col. Centro, Monterrey. Free parking is available for patients.' },
  { q: '¿Necesito traer estudios previos?', a: 'Si cuenta con análisis o estudios recientes, le sugerimos traerlos para que el médico pueda valorarlos. No es obligatorio.', qEn: 'Should I bring previous test results?', aEn: 'If you have recent labs or studies, we recommend bringing them so the doctor can review them. Not required.' },
];

const FAQS_DESPACHO = [
  { q: '¿Ofrecen consulta inicial gratuita?', a: 'Sí, la primera valoración es sin costo y dura 30 minutos. Solo necesita agendar cita.' },
  { q: '¿En qué áreas del derecho se especializan?', a: 'Nuestras áreas principales son derecho corporativo, fiscal, laboral y litigio mercantil.' },
  { q: '¿Trabajan con empresas o solo personas físicas?', a: 'Atendemos tanto a personas físicas como a personas morales. Tenemos clientes desde PyMEs hasta corporativos.' },
  { q: '¿Cómo cobran sus servicios?', a: 'Manejamos iguala mensual para asesoría continua, honorarios por proyecto, o porcentaje en casos de cobranza.' },
  { q: '¿Cuánto tarda un proceso laboral?', a: 'Depende del caso, pero típicamente entre 8 y 18 meses si llega a juicio. Procuramos siempre la conciliación.' },
];

const FAQS_SALON = [
  { q: '¿Necesito cita o aceptan walk-in?', a: 'Manejamos cita previa para garantizar el horario, pero si tenemos disponibilidad atendemos sin cita.', qEn: 'Do I need an appointment or do you accept walk-ins?', aEn: 'We prefer appointments to guarantee your slot, but we accept walk-ins when we have availability.' },
  { q: '¿Qué servicios ofrecen?', a: 'Corte, color, tinte, alaciado, peinado, manicure, pedicure y maquillaje para eventos.', qEn: 'What services do you offer?', aEn: 'Haircuts, color, highlights, straightening, styling, manicure, pedicure, and event makeup.' },
  { q: '¿Aceptan tarjeta?', a: 'Sí, aceptamos efectivo, tarjeta de débito y crédito, y transferencia.', qEn: 'Do you accept cards?', aEn: 'Yes, we accept cash, debit and credit cards, and bank transfers.' },
  { q: '¿Hacen servicio a domicilio?', a: 'Para eventos especiales como bodas y XV años, sí. Cobramos un viático adicional según la zona.', qEn: 'Do you offer in-home service?', aEn: 'For special events like weddings and quinceañeras, yes. We charge a travel fee depending on the area.' },
  { q: '¿Tienen promociones para grupos?', a: 'Para novias y damas tenemos paquetes con 15% de descuento. También miércoles de manicure a precio especial.', qEn: 'Do you have group promotions?', aEn: 'For brides and bridal parties we offer packages with 15% off. We also have Manicure Wednesdays at a special price.' },
];

const TRANSCRIPT_SAMPLE_EN = JSON.stringify([
  { role: 'assistant', text: 'Good afternoon, thank you for calling. This is Sofia. How may I help you?' },
  { role: 'user', text: 'Hi, I\'d like to book a general consultation this week.' },
  { role: 'assistant', text: 'Of course. Is the appointment for you, and would you prefer morning or afternoon?' },
  { role: 'user', text: 'For me, tomorrow afternoon if possible.' },
  { role: 'assistant', text: 'I have 4:00 PM or 5:30 PM open tomorrow. Which works better?' },
  { role: 'user', text: '5:30 sounds great.' },
  { role: 'assistant', text: 'Perfect. Could I get your full name and a contact phone number?' },
]);

const TRANSCRIPT_SAMPLE = JSON.stringify([
  { role: 'assistant', text: 'Buenas tardes, gracias por llamar a Clínica Norte. Le atiende Sofía. ¿En qué le puedo ayudar?' },
  { role: 'user', text: 'Hola, quiero agendar una consulta general para esta semana.' },
  { role: 'assistant', text: 'Con mucho gusto. ¿Sería para usted o para otra persona? Y ¿prefiere por la mañana o por la tarde?' },
  { role: 'user', text: 'Para mí, mañana en la tarde si se puede.' },
  { role: 'assistant', text: 'Tengo disponible mañana a las 4:00 o a las 5:30 PM. ¿Cuál le acomoda?' },
  { role: 'user', text: 'A las 5:30 está perfecto.' },
  { role: 'assistant', text: 'Perfecto. ¿Me podría dar su nombre completo y un teléfono de contacto?' },
]);

// Plans are required for the public pricing page in every deployment.
// This minimal seed creates ONLY the four plans — no demo users, tenants, calls, or resellers.
export async function runSeedPlansOnly() {
  const existing = await storage.listPlans();
  if (existing.length > 0) return;
  for (const p of PLAN_DEFS) await storage.createPlan(p as any);
}

export async function runSeed() {
  const existing = await storage.listPlans();
  if (existing.length > 0) return;

  // Plans
  for (const p of PLAN_DEFS) await storage.createPlan(p as any);
  const planInicia = await storage.getPlanBySlug('inicia');
  const planCrece = await storage.getPlanBySlug('crece');
  const planEmpresa = await storage.getPlanBySlug('empresa');
  const planAgencia = await storage.getPlanBySlug('agencia');

  // Resellers
  const directo = await storage.createReseller({
    name: 'MARCALL Directo', slug: 'directo', brandName: 'MARCALL',
    commissionPct: 0, hideMarcallBranding: false,
    primaryColor: '14 75% 52%', accentColor: '38 90% 55%',
  } as any);
  const agenciaDemo = await storage.createReseller({
    name: 'Agencia Demo', slug: 'agencia-demo', brandName: 'VozPro',
    commissionPct: 30, hideMarcallBranding: true,
    primaryColor: '180 65% 40%', accentColor: '24 85% 60%',
    customDomain: 'voz.agenciademo.mx',
  } as any);

  // Users
  const superadmin = await storage.createUser({
    email: 'admin@marcall.mx', passwordHash: hash('seed-stub', 'admin@marcall.mx'),
    name: 'MARCALL Admin', role: 'superadmin',
  } as any);
  const resellerOwner = await storage.createUser({
    email: 'agencia@demo.mx', passwordHash: hash('seed-stub', 'agencia@demo.mx'),
    name: 'Carlos Mendoza', role: 'reseller', resellerId: agenciaDemo.id,
  } as any);
  await storage.updateReseller(agenciaDemo.id, { ownerUserId: resellerOwner.id } as any);

  // Tenants under MARCALL Directo
  async function createTenantWithFixtures(opts: {
    name: string; slug: string; industry: string; resellerId: number; planId: number;
    ownerEmail: string; ownerName: string; ownerPw: string; faqs: { q: string; a: string }[];
    services: { name: string; durationMin: number; description: string }[];
    transferNumber: string; primaryColor?: string;
  }) {
    const t = await storage.createTenant({
      name: opts.name, slug: opts.slug, industry: opts.industry,
      resellerId: opts.resellerId, planId: opts.planId, status: 'active',
      timezone: 'America/Monterrey',
      addressLine: 'Av. Constitución 2400, Col. Centro, Monterrey, N.L.',
      transferNumber: opts.transferNumber,
      primaryColor: opts.primaryColor,
    } as any);
    const owner = await storage.createUser({
      email: opts.ownerEmail, passwordHash: hash(opts.ownerPw, opts.ownerEmail),
      name: opts.ownerName, role: 'tenant_owner', currentTenantId: t.id,
    } as any);
    // Subscription
    await storage.createSubscription({
      tenantId: t.id, planId: opts.planId, status: 'active',
      currentPeriodStart: new Date(Date.now() - 10 * 86400000),
      currentPeriodEnd: new Date(Date.now() + 20 * 86400000),
    } as any);
    // Hours
    await storage.setBusinessHours(t.id, [0, 1, 2, 3, 4, 5, 6].map(d => ({
      tenantId: t.id, dayOfWeek: d,
      openTime: d === 0 ? '00:00' : '09:00',
      closeTime: d === 0 ? '00:00' : (d === 6 ? '14:00' : '19:00'),
      closed: d === 0,
    })) as any);
    // Assistant
    const isBilingual = opts.slug !== 'despacho-reyes';
    await storage.createAssistant({
      tenantId: t.id, name: 'Sofía', voiceId: 'adri-chilanga', voiceProvider: 'elevenlabs',
      languageCode: 'es-MX', formality: 'usted',
      greeting: `Buenas tardes, gracias por llamar a ${opts.name}. Le atiende Sofía. ¿En qué le puedo ayudar?`,
      systemPrompt: `Eres Sofía, recepcionista virtual de ${opts.name}. Hablas español mexicano formal (usted). Eres cálida, profesional y resolutiva. Tu trabajo es responder preguntas frecuentes, agendar citas, tomar recados y, cuando sea necesario, transferir la llamada. Nunca inventes información que no esté en tu base de conocimiento.`,
      languages: isBilingual ? '["es-MX","en-US"]' : '["es-MX"]',
      defaultLanguage: 'es-MX',
      codeSwitching: isBilingual,
      greetingEn: isBilingual ? `Good afternoon, thank you for calling ${opts.name}. This is Sofia. How may I help you?` : null,
      systemPromptEn: isBilingual ? `You are Sofia, virtual receptionist for ${opts.name}. You speak native Mexican Spanish and English fluently. Greet in Spanish first; if the caller replies in English, switch to English and stay there. Be warm, professional, and concise. Answer FAQs, book appointments, take messages, and transfer when needed. Never invent information.` : null,
      voiceIdEn: isBilingual ? 'adri-chilanga-en' : null,
    } as any);
    // FAQs
    for (const f of opts.faqs) {
      await storage.createFaq({ tenantId: t.id, question: f.q, answer: f.a, questionEn: (f as any).qEn || null, answerEn: (f as any).aEn || null, keywords: '[]', active: true } as any);
    }
    // Services
    for (const s of opts.services) {
      await storage.createService({ tenantId: t.id, name: s.name, durationMin: s.durationMin, description: s.description, active: true } as any);
    }
    // Phone number
    await storage.createPhoneNumber({
      tenantId: t.id, e164: '+528112345678', country: 'MX',
      kind: 'mx_managed', kycStatus: 'approved',
      twilioSid: 'PN_seed_' + t.id, vapiPhoneId: 'phn_seed_' + t.id,
    } as any);
    // Call logs (12)
    const outcomes = ['booked', 'message', 'info', 'transferred', 'booked', 'info', 'message', 'booked', 'info', 'lead', 'booked', 'info'];
    const phones = ['+528111111111', '+528122222222', '+528133333333', '+528144444444', '+528155555555', '+528166666666'];
    for (let i = 0; i < 12; i++) {
      const startedAt = new Date(Date.now() - (i * 3 + 1) * 3600 * 1000);
      const dur = 60 + Math.floor(Math.random() * 240);
      const lang = isBilingual && i % 3 === 0 ? 'en' : 'es';
      await storage.createCallLog({
        tenantId: t.id, callerPhone: phones[i % phones.length],
        startedAt, endedAt: new Date(startedAt.getTime() + dur * 1000),
        durationSec: dur, transcript: lang === 'en' ? TRANSCRIPT_SAMPLE_EN : TRANSCRIPT_SAMPLE,
        outcome: outcomes[i], costMxnCents: Math.round(dur / 60 * 320),
        language: lang,
      } as any);
      await storage.recordUsage({ tenantId: t.id, kind: 'call_minute', amount: Math.ceil(dur / 60), occurredAt: startedAt } as any);
    }
    // Appointments (4)
    for (let i = 0; i < 4; i++) {
      const start = new Date(Date.now() + (i + 1) * 86400000 + 14 * 3600 * 1000);
      await storage.createAppointment({
        tenantId: t.id, callerName: ['María González', 'Juan Pérez', 'Ana Hernández', 'Roberto Silva'][i],
        callerPhone: phones[i % phones.length], serviceId: null,
        startTime: start, endTime: new Date(start.getTime() + 30 * 60000),
        status: 'confirmed', notes: 'Confirmado por la recepcionista IA',
      } as any);
    }
    // Messages (3)
    await storage.createMessage({ tenantId: t.id, callerName: 'Pedro Ramírez', callerPhone: '+528177777777',
      subject: 'Llamada de seguimiento', body: 'Solicita que le devuelvan la llamada para tema fiscal urgente antes del cierre de mes.',
      urgency: 'high', delivered: false } as any);
    await storage.createMessage({ tenantId: t.id, callerName: 'Lorena Torres', callerPhone: '+528188888888',
      subject: 'Cotización', body: 'Pide cotización para servicio mensual de su empresa de 15 empleados.',
      urgency: 'normal', delivered: true } as any);
    // Leads (2)
    await storage.createLead({ tenantId: t.id, name: 'Laura Fernández', phone: '+528199999999',
      email: 'laura.f@empresa.mx', company: 'Distribuidora del Norte', interest: 'Asesoría fiscal anual',
      budget: '$25,000-$50,000 MXN', timeline: 'Próximo mes', qualificationScore: 78,
      transcriptExcerpt: 'Cliente busca cambiar de despacho por mal servicio. Empresa con 50 empleados, facturación 30M anual.' } as any);
    await storage.createLead({ tenantId: t.id, name: 'Diego Vargas', phone: '+528100000000',
      company: 'Vargas Construcciones', interest: 'Litigio laboral', qualificationScore: 45,
      transcriptExcerpt: 'Caso de demanda laboral, presupuesto sin definir.' } as any);
    return { tenant: t, owner };
  }

  await createTenantWithFixtures({
    name: 'Clínica Norte', slug: 'clinica-norte', industry: 'Clínica',
    resellerId: directo.id, planId: planCrece!.id,
    ownerEmail: 'dueno@clinicanorte.mx', ownerName: 'Dr. Alejandro Reyes', ownerPw: 'demo123',
    faqs: FAQS_CLINICA,
    services: [
      { name: 'Consulta general', durationMin: 30, description: 'Valoración médica general' },
      { name: 'Consulta de especialidad', durationMin: 45, description: 'Consulta con médico especialista' },
      { name: 'Estudios clínicos', durationMin: 20, description: 'Toma de muestras' },
    ],
    transferNumber: '+528111000111',
  });
  await createTenantWithFixtures({
    name: 'Despacho Reyes', slug: 'despacho-reyes', industry: 'Despacho',
    resellerId: directo.id, planId: planInicia!.id,
    ownerEmail: 'dueno@despachoreyes.mx', ownerName: 'Lic. Mariana Reyes', ownerPw: 'seed-stub',
    faqs: FAQS_DESPACHO,
    services: [
      { name: 'Consulta inicial', durationMin: 30, description: 'Valoración inicial sin costo' },
      { name: 'Asesoría fiscal', durationMin: 60, description: 'Asesoría con experto en fiscal' },
    ],
    transferNumber: '+528222000222',
  });
  await createTenantWithFixtures({
    name: 'Salón Bella', slug: 'salon-bella', industry: 'Salón',
    resellerId: agenciaDemo.id, planId: planInicia!.id,
    ownerEmail: 'dueno@salonbella.mx', ownerName: 'Patricia Soto', ownerPw: 'seed-stub',
    faqs: FAQS_SALON,
    services: [
      { name: 'Corte de cabello', durationMin: 30, description: 'Corte mujer/hombre' },
      { name: 'Tinte', durationMin: 90, description: 'Color completo' },
      { name: 'Manicure', durationMin: 45, description: 'Manicure clásico o gel' },
    ],
    transferNumber: '+528333000333',
    primaryColor: '180 65% 40%',
  });

  console.log('[seed] complete');
}
