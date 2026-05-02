/**
 * MARCALL public demo "brain" — deterministic intent classifier + scripted
 * bilingual responses. NOT a real LLM. The /demo page tells the visitor:
 *   "Esta es una demostración guiada. La versión real usa GPT-5.2 mini con
 *    tus FAQs y servicios reales."
 *
 * Why deterministic:
 *  - Public demo with no auth ⇒ no LLM credit-burn / abuse risk.
 *  - Predictable, on-brand responses prospects can verify in seconds.
 *  - Zero external dependencies / latency (~1ms).
 *
 * Sessions are held in-memory and garbage-collected after 10 minutes idle.
 */

export type Lang = 'es' | 'en';
export type Scenario = 'appointment' | 'info' | 'message' | 'human';

export type TurnRecord = {
  at: number; // epoch ms
  who: 'user' | 'assistant';
  text: string;
  intent?: string;
};

export type DemoSession = {
  sessionId: string;
  scenario: Scenario;
  lang: Lang;
  history: TurnRecord[];
  createdAt: number;
  lastSeenAt: number;
  // Slot-filling state
  state: {
    appt?: { date?: string; time?: string; name?: string; confirmed?: boolean };
    msg?: { name?: string; phone?: string; body?: string; saved?: boolean };
  };
};

const sessions = new Map<string, DemoSession>();
const TEN_MIN_MS = 10 * 60 * 1000;

// GC sweep every minute
setInterval(() => {
  const now = Date.now();
  for (const [k, s] of sessions.entries()) {
    if (now - s.lastSeenAt > TEN_MIN_MS) sessions.delete(k);
  }
}, 60_000).unref?.();

export function getSession(sessionId: string): DemoSession | undefined {
  return sessions.get(sessionId);
}

export function ensureSession(sessionId: string, scenario: Scenario, lang: Lang): DemoSession {
  let s = sessions.get(sessionId);
  if (!s) {
    s = {
      sessionId,
      scenario,
      lang,
      history: [],
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      state: {},
    };
    sessions.set(sessionId, s);
  } else {
    // allow scenario / lang to update mid-session
    s.scenario = scenario;
    s.lang = lang;
    s.lastSeenAt = Date.now();
  }
  return s;
}

export function endSession(sessionId: string): { turnCount: number; durationSec: number } | null {
  const s = sessions.get(sessionId);
  if (!s) return null;
  const durationSec = Math.round((Date.now() - s.createdAt) / 1000);
  const turnCount = s.history.length;
  sessions.delete(sessionId);
  return { turnCount, durationSec };
}

// ─────────────────────────────────────────────────────────────────────────
// Intent classifier
// ─────────────────────────────────────────────────────────────────────────

const PATTERNS: Array<{ intent: string; es: RegExp; en: RegExp }> = [
  // Goodbyes (check first — short, decisive)
  { intent: 'farewell', es: /\b(adi[oó]s|hasta luego|nos vemos|bye|gracias.*adi)/i, en: /\b(bye|goodbye|see ya|that's all|thanks bye)/i },

  // Transfer to human
  { intent: 'transfer_human', es: /\b(humano|persona|alguien real|operador|agente|hablar con (un|una|alguien))\b/i, en: /\b(human|real person|agent|operator|representative|speak to someone)\b/i },

  // Appointment
  { intent: 'book_appointment', es: /\b(cita|agendar|reservar|apartar|programar|consulta|turno)\b/i, en: /\b(appointment|book|schedule|reserve|consultation|slot)\b/i },

  // Cancel / reschedule
  { intent: 'cancel', es: /\b(cancelar|cancela|anular)\b/i, en: /\b(cancel)\b/i },
  { intent: 'reschedule', es: /\b(reagendar|cambiar.*cita|mover.*cita)\b/i, en: /\b(reschedule|move.*appointment|change.*appointment)\b/i },

  // Hours
  { intent: 'ask_hours', es: /\b(horario|abren|cierran|abierto|cerrado|qu[eé] hora)\b/i, en: /\b(hours|open|close|when.*open|when.*close|what time)\b/i },

  // Pricing
  { intent: 'ask_price', es: /\b(precio|cu[aá]nto cuesta|costo|tarifa|cobran|cu[aá]nto es)\b/i, en: /\b(price|cost|how much|fee|charge|rate)\b/i },

  // Address / location
  { intent: 'ask_location', es: /\b(d[oó]nde|direcci[oó]n|ubicaci[oó]n|c[oó]mo llego)\b/i, en: /\b(where|address|location|how.*get there|directions)\b/i },

  // Services
  { intent: 'ask_services', es: /\b(servicios|qu[eé] hacen|qu[eé] ofrecen|tratamientos|menu)\b/i, en: /\b(services|what.*do|what.*offer|treatments|menu)\b/i },

  // Leave a message
  { intent: 'leave_message', es: /\b(recado|mensaje|que me llamen|d[ií]gale|dejarle)\b/i, en: /\b(leave a message|call me back|message for|tell (him|her|them))\b/i },

  // Yes / no / thanks (short follow-ups)
  { intent: 'affirm', es: /^\s*(s[ií]|claro|por favor|exacto|correcto|de acuerdo)\.?\!?\s*$|^\s*(s[ií]|claro|por favor|exacto|correcto|de acuerdo)\b/i, en: /^\s*(yes|yeah|sure|please|correct|of course|ok)\b/i },
  { intent: 'negate', es: /^\s*(no|nope|para nada)\.?\!?\s*$|^\s*(no|nope|para nada)\b/i, en: /^\s*(no|nope|not really)\b/i },
  { intent: 'thanks', es: /\b(gracias|muchas gracias)\b/i, en: /\b(thanks|thank you)\b/i },

  // Greeting
  { intent: 'greet', es: /\b(hola|buenos d[ií]as|buenas tardes|buenas noches|qu[eé] tal)\b/i, en: /\b(hi|hello|hey|good (morning|afternoon|evening))\b/i },
];

export function classify(transcript: string, lang: Lang): { intent: string; confidence: number } {
  const t = (transcript || '').trim();
  if (!t) return { intent: 'unknown', confidence: 0 };

  for (const p of PATTERNS) {
    const re = lang === 'en' ? p.en : p.es;
    if (re.test(t)) {
      // Confidence based on token overlap heuristic (rough)
      const m = t.match(re);
      const conf = Math.min(0.95, 0.65 + (m?.[0]?.length || 0) / Math.max(t.length, 10) * 0.3);
      return { intent: p.intent, confidence: Number(conf.toFixed(2)) };
    }
  }
  return { intent: 'unknown', confidence: 0.2 };
}

// Time / date extraction (very light heuristic)
function extractTime(text: string): string | undefined {
  const m = text.match(/\b([01]?\d|2[0-3])(?:\s*[:.]\s*([0-5]\d))?\s*(am|pm|a\.?m\.?|p\.?m\.?|hrs?)?\b/i);
  if (!m) return undefined;
  const h = m[1];
  const mins = m[2] ?? '00';
  const ap = (m[3] || '').toLowerCase().replace(/\./g, '').replace('hrs', '').replace('hr', '').trim();
  return `${h}:${mins}${ap ? ' ' + ap.toUpperCase() : ''}`.trim();
}

function extractDayKeyword(text: string, lang: Lang): string | undefined {
  if (lang === 'es') {
    const m = text.match(/\b(hoy|mañana|pasado mañana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i);
    return m?.[1];
  }
  const m = text.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  return m?.[1];
}

// ─────────────────────────────────────────────────────────────────────────
// Response composer
// ─────────────────────────────────────────────────────────────────────────

export type RespondResult = {
  response: string;
  action?: 'transfer' | 'end';
  metadata: { intent: string; confidence: number };
};

export function respond(sessionId: string, transcript: string, lang: Lang, scenarioStr: string): RespondResult {
  const scenario = normalizeScenario(scenarioStr);
  const session = ensureSession(sessionId, scenario, lang);
  const userText = (transcript || '').trim();
  const { intent, confidence } = classify(userText, lang);

  // Record user turn
  session.history.push({ at: Date.now(), who: 'user', text: userText, intent });

  let response = '';
  let action: 'transfer' | 'end' | undefined;

  switch (intent) {
    case 'farewell':
      response = lang === 'es'
        ? 'Gracias por llamar. Que tenga un excelente día.'
        : 'Thanks for calling. Have a great day.';
      action = 'end';
      break;

    case 'transfer_human':
      response = lang === 'es'
        ? 'Por supuesto, le transfiero con un asesor humano ahora mismo. Un momento, por favor.'
        : 'Of course, I\'m transferring you to a human agent now. One moment, please.';
      action = 'transfer';
      break;

    case 'book_appointment': {
      const day = extractDayKeyword(userText, lang);
      const time = extractTime(userText);
      session.state.appt = session.state.appt ?? {};
      if (day) session.state.appt.date = day;
      if (time) session.state.appt.time = time;

      if (session.state.appt.date && session.state.appt.time) {
        response = lang === 'es'
          ? `Perfecto, tengo disponibilidad ${session.state.appt.date} a las ${session.state.appt.time}. ¿A nombre de quién registro la cita?`
          : `Great, I have availability ${session.state.appt.date} at ${session.state.appt.time}. What name should I put it under?`;
      } else if (session.state.appt.date) {
        response = lang === 'es'
          ? `Para ${session.state.appt.date} tengo disponible a las 4:00 PM o 5:30 PM. ¿Cuál le acomoda?`
          : `For ${session.state.appt.date} I have 4:00 PM or 5:30 PM available. Which works best?`;
      } else {
        response = lang === 'es'
          ? 'Con gusto le agendo una cita. ¿Para qué día le acomoda — mañana, pasado mañana o esta semana?'
          : 'I\'d be happy to book an appointment. Which day works for you — tomorrow, the day after, or later this week?';
      }
      break;
    }

    case 'cancel':
      response = lang === 'es'
        ? '¿Me podría compartir su nombre y la fecha de la cita que desea cancelar?'
        : 'Could you share your name and the date of the appointment you\'d like to cancel?';
      break;

    case 'reschedule':
      response = lang === 'es'
        ? 'Claro. ¿Para qué nuevo día y hora le gustaría reagendar?'
        : 'Sure. Which new day and time would you like to reschedule to?';
      break;

    case 'ask_hours':
      response = lang === 'es'
        ? 'Atendemos de lunes a viernes de 9:00 AM a 7:00 PM, y los sábados de 9:00 AM a 2:00 PM.'
        : 'We\'re open Monday to Friday from 9:00 AM to 7:00 PM, and Saturdays from 9:00 AM to 2:00 PM.';
      break;

    case 'ask_price':
      response = scenario === 'info'
        ? (lang === 'es'
          ? 'La consulta general tiene un costo de 600 pesos. Tratamientos especializados varían entre 800 y 1,500. ¿Le interesa algún servicio en particular?'
          : 'A general consultation is 600 pesos. Specialized treatments range from 800 to 1,500. Which service interests you?')
        : (lang === 'es'
          ? 'Los precios varían según el servicio. ¿Sobre cuál le gustaría información?'
          : 'Prices vary by service. Which one would you like info about?');
      break;

    case 'ask_location':
      response = lang === 'es'
        ? 'Estamos en Av. Constitución 1234, Centro, Monterrey. Hay estacionamiento gratuito para clientes.'
        : 'We\'re at Av. Constitución 1234, Centro, Monterrey. Free parking is available for clients.';
      break;

    case 'ask_services':
      response = lang === 'es'
        ? 'Ofrecemos consulta general, exámenes de laboratorio, ultrasonidos y consultas especializadas. ¿Cuál le interesa?'
        : 'We offer general consultations, lab tests, ultrasounds, and specialist visits. Which one interests you?';
      break;

    case 'leave_message': {
      session.state.msg = session.state.msg ?? {};
      if (!session.state.msg.name) {
        response = lang === 'es'
          ? 'Con gusto le tomo un recado. ¿A nombre de quién?'
          : 'Happy to take a message. What\'s your name?';
      } else if (!session.state.msg.phone) {
        response = lang === 'es'
          ? '¿Y el número al que pueden devolverle la llamada?'
          : 'And the best phone number to reach you?';
      } else {
        session.state.msg.saved = true;
        response = lang === 'es'
          ? 'Listo. Le entrego el recado al equipo y le devolverán la llamada hoy mismo.'
          : 'All set. I\'ll pass the message to the team and they\'ll call you back today.';
      }
      break;
    }

    case 'greet':
      response = scenarioGreeting(scenario, lang);
      break;

    case 'thanks':
      response = lang === 'es' ? 'Con gusto. ¿Algo más en lo que pueda ayudarle?' : 'My pleasure. Anything else I can help with?';
      break;

    case 'affirm':
      response = followUp(session, lang, true);
      break;

    case 'negate':
      response = followUp(session, lang, false);
      break;

    case 'unknown':
    default:
      response = scenarioFallback(scenario, lang);
      break;
  }

  // record assistant turn
  session.history.push({ at: Date.now(), who: 'assistant', text: response });
  session.lastSeenAt = Date.now();

  return { response, action, metadata: { intent, confidence } };
}

function normalizeScenario(s: string): Scenario {
  const k = (s || '').toLowerCase();
  if (k.includes('cita') || k.includes('appointment')) return 'appointment';
  if (k.includes('servicio') || k.includes('information') || k.includes('info')) return 'info';
  if (k.includes('mensaje') || k.includes('message')) return 'message';
  if (k.includes('humano') || k.includes('human')) return 'human';
  return 'appointment';
}

function scenarioGreeting(s: Scenario, lang: Lang): string {
  if (lang === 'es') {
    switch (s) {
      case 'appointment': return 'Buenas tardes, gracias por llamar a Clínica Norte. Soy Sofía, su recepcionista virtual. ¿Le agendo una cita?';
      case 'info': return 'Hola, gracias por llamar a Clínica Norte. ¿Sobre qué servicio le gustaría información?';
      case 'message': return 'Buenas, soy Sofía. Con gusto le tomo un recado. ¿A nombre de quién?';
      case 'human': return 'Buenas tardes. Le transfiero con un asesor humano ahora mismo.';
    }
  }
  switch (s) {
    case 'appointment': return 'Good afternoon, thanks for calling Clínica Norte. I\'m Sofia, your virtual receptionist. Would you like to book an appointment?';
    case 'info': return 'Hi, thanks for calling Clínica Norte. Which service would you like to know about?';
    case 'message': return 'Hi, I\'m Sofia. Happy to take a message. What\'s your name?';
    case 'human': return 'Good afternoon. I\'m transferring you to a human agent now.';
  }
}

function scenarioFallback(s: Scenario, lang: Lang): string {
  if (lang === 'es') {
    switch (s) {
      case 'appointment': return 'Disculpe, no le entendí bien. ¿Le gustaría agendar una cita o necesita otra información?';
      case 'info': return 'Perdón, ¿podría repetirme qué información necesita? Tengo datos de servicios, precios, horarios y ubicación.';
      case 'message': return 'Disculpe, ¿podría repetir el mensaje que desea dejar?';
      case 'human': return 'Permítame transferirle con un asesor humano.';
    }
  }
  switch (s) {
    case 'appointment': return 'Sorry, I didn\'t catch that. Would you like to book an appointment, or do you need other information?';
    case 'info': return 'Sorry, could you repeat what you\'d like to know? I have details on services, prices, hours, and location.';
    case 'message': return 'Sorry, could you repeat the message you\'d like to leave?';
    case 'human': return 'Let me transfer you to a human agent.';
  }
}

function followUp(session: DemoSession, lang: Lang, yes: boolean): string {
  // Naive context — look at the previous assistant turn to decide.
  const prev = [...session.history].reverse().find(h => h.who === 'assistant');
  if (!prev) {
    return lang === 'es' ? '¿En qué le puedo ayudar?' : 'How can I help?';
  }
  if (yes) {
    if (session.scenario === 'appointment' && session.state.appt?.date && session.state.appt?.time) {
      session.state.appt.confirmed = true;
      return lang === 'es'
        ? `Perfecto. Le confirmo su cita ${session.state.appt.date} a las ${session.state.appt.time}. Le enviaré recordatorio por WhatsApp.`
        : `Perfect. Confirmed: ${session.state.appt.date} at ${session.state.appt.time}. I'll send a WhatsApp reminder.`;
    }
    return lang === 'es' ? 'Excelente. ¿Algo más en lo que pueda ayudarle?' : 'Excellent. Anything else I can help with?';
  }
  return lang === 'es' ? 'Entendido. ¿Hay algo más en lo que pueda ayudarle?' : 'Understood. Is there anything else I can help with?';
}

// Used by the /api/demo/respond route to expose history if needed
export function getHistory(sessionId: string): TurnRecord[] {
  return sessions.get(sessionId)?.history ?? [];
}

export function turnCountFor(sessionId: string): number {
  return sessions.get(sessionId)?.history.length ?? 0;
}
