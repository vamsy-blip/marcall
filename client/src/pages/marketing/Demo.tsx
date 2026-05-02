import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Mic, MicOff, ArrowRight, Send, Loader2, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/components/LanguageProvider';
import { LanguageToggle } from '@/components/LanguageToggle';
import { MarcallWordmark } from '@/components/Brand';
import { apiRequest } from '@/lib/queryClient';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────
type Lang = 'es' | 'en';
type Turn = { who: 'user' | 'assistant'; text: string; at: number };
type ScenarioKey = 'appointment' | 'info' | 'message' | 'human';

type DemoResponse = {
  response: string;
  action?: 'transfer' | 'end';
  metadata: { intent: string; confidence: number };
};

// ─────────────────────────────────────────────────────────────────────────
// Copy
// ─────────────────────────────────────────────────────────────────────────
const COPY: Record<Lang, Record<string, string>> = {
  es: {
    eyebrow: 'DEMO EN VIVO',
    hero1: 'Habla con MARCALL ahora.',
    hero2: 'Sin descargas, sin registro.',
    sub: 'Toca el micrófono y conversa con un asistente bilingüe directamente en tu navegador.',
    tap: 'Toca el micrófono para empezar',
    listening: 'Escuchando…',
    thinking: 'Pensando…',
    speaking: 'Hablando…',
    micPermissionTitle: 'Necesitamos acceso a tu micrófono',
    micPermissionBody: 'Cuando toques el botón, tu navegador te pedirá permiso para usar el micrófono. Solo procesamos texto en nuestros servidores — nunca audio.',
    permissionDeniedTitle: 'Sin acceso al micrófono',
    permissionDeniedBody: 'No te preocupes — puedes probar la demo escribiendo abajo.',
    fallbackPrompt: 'Si no puedes usar el micrófono, escribe aquí',
    typeHere: 'Escribe un mensaje...',
    send: 'Enviar',
    scenario: 'Escenario',
    scenarioAppt: 'Reservar cita en clínica',
    scenarioInfo: 'Información de un servicio',
    scenarioMsg: 'Dejar un mensaje',
    scenarioHuman: 'Hablar con un humano',
    transcript: 'Transcripción',
    metricResp: 'Tiempo de respuesta',
    metricCall: 'Llamada',
    you: 'Tú',
    assistant: 'MARCALL',
    privacyTitle: 'Esta demostración no graba audio.',
    privacyBody: 'La conversación es local en tu navegador y solo el texto se envía a nuestros servidores para responder.',
    guidedTitle: 'Esta es una demostración guiada.',
    guidedBody: 'La versión real usa GPT-5.2 mini con tus FAQs y servicios reales.',
    cta: '¿Te gustó? Configura el tuyo en 5 minutos',
    unsupportedTitle: 'Tu navegador no soporta voz',
    unsupportedBody: 'Aquí puedes probar en texto. Para la experiencia con voz, abre esta página en',
    unsupportedChrome: 'Chrome',
    or: 'o',
    safari: 'Safari',
    transfer: 'Transferiendo a un asesor humano',
    callEnded: 'Llamada finalizada',
    sampleHint: 'Prueba diciendo: ',
    sampleAppt: '"Necesito una cita para mañana"',
    sampleInfo: '"¿Cuál es el precio de la consulta?"',
    sampleMsg: '"Quiero dejar un recado"',
    sampleHuman: '"Quiero hablar con un humano"',
    backHome: 'Volver al inicio',
  },
  en: {
    eyebrow: 'LIVE DEMO',
    hero1: 'Talk to MARCALL right now.',
    hero2: 'No download, no signup.',
    sub: 'Tap the mic and have a real conversation with a bilingual assistant — right in your browser.',
    tap: 'Tap the mic to start',
    listening: 'Listening…',
    thinking: 'Thinking…',
    speaking: 'Speaking…',
    micPermissionTitle: 'We need microphone access',
    micPermissionBody: 'When you tap the button, your browser will ask permission to use the microphone. We only process text on our servers — never audio.',
    permissionDeniedTitle: 'No microphone access',
    permissionDeniedBody: 'No worries — you can try the demo by typing below.',
    fallbackPrompt: 'If you can\'t use the mic, type here',
    typeHere: 'Type a message...',
    send: 'Send',
    scenario: 'Scenario',
    scenarioAppt: 'Book an appointment at a clinic',
    scenarioInfo: 'Get info about a service',
    scenarioMsg: 'Leave a message',
    scenarioHuman: 'Talk to a human',
    transcript: 'Transcript',
    metricResp: 'Response time',
    metricCall: 'Call',
    you: 'You',
    assistant: 'MARCALL',
    privacyTitle: 'This demo does not record audio.',
    privacyBody: 'The conversation stays local in your browser — only text is sent to our servers to respond.',
    guidedTitle: 'This is a guided demo.',
    guidedBody: 'The real version uses GPT-5.2 mini with your actual FAQs and services.',
    cta: 'Like it? Set up yours in 5 minutes',
    unsupportedTitle: 'Your browser doesn\'t support voice',
    unsupportedBody: 'You can still try in text mode. For the voice experience, open this page in',
    unsupportedChrome: 'Chrome',
    or: 'or',
    safari: 'Safari',
    transfer: 'Transferring to a human agent',
    callEnded: 'Call ended',
    sampleHint: 'Try saying: ',
    sampleAppt: '"I need an appointment for tomorrow"',
    sampleInfo: '"What does a consultation cost?"',
    sampleMsg: '"I want to leave a message"',
    sampleHuman: '"I want to speak to a human"',
    backHome: 'Back home',
  },
};

const SCENARIO_KEYS: { key: ScenarioKey; es: string; en: string }[] = [
  { key: 'appointment', es: 'Reservar cita en clínica', en: 'Book an appointment at a clinic' },
  { key: 'info', es: 'Información de un servicio', en: 'Get info about a service' },
  { key: 'message', es: 'Dejar un mensaje', en: 'Leave a message' },
  { key: 'human', es: 'Hablar con un humano', en: 'Talk to a human' },
];

// ─────────────────────────────────────────────────────────────────────────
// Browser support helpers
// ─────────────────────────────────────────────────────────────────────────
function getSpeechRecognition(): any {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}
function speechSupported(): boolean {
  return !!getSpeechRecognition();
}
function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function makeSessionId(): string {
  // Random short id (no PII)
  const arr = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr);
  else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60); const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Mic button
// ─────────────────────────────────────────────────────────────────────────
function MicButton({ active, disabled, onClick, label }: {
  active: boolean; disabled?: boolean; onClick: () => void; label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      data-testid="button-mic"
      className={[
        'relative inline-flex items-center justify-center rounded-full',
        'transition-all select-none',
        'h-28 w-28 sm:h-32 sm:w-32 md:h-36 md:w-36',
        'shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-primary/95 text-primary-foreground hover:bg-primary',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.03] active:scale-[0.98]',
      ].join(' ')}
    >
      {active && (
        <>
          <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
          <span className="absolute -inset-2 rounded-full border-2 border-primary/30 animate-pulse" />
        </>
      )}
      {active ? (
        <MicOff className="h-12 w-12 sm:h-14 sm:w-14 relative z-10" />
      ) : (
        <Mic className="h-12 w-12 sm:h-14 sm:w-14 relative z-10" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────
export default function Demo() {
  const { lang, setLang } = useLang();
  const t = COPY[lang];

  // Read ?lang= once on mount — supports BOTH the path query string
  // ("/demo?lang=en") and the hash-routed equivalent ("#/demo?lang=en").
  useEffect(() => {
    const all: string[] = [];
    if (window.location.search) all.push(window.location.search);
    if (window.location.hash) {
      const i = window.location.hash.indexOf('?');
      if (i >= 0) all.push(window.location.hash.slice(i));
    }
    for (const s of all) {
      const q = new URLSearchParams(s).get('lang');
      if (q === 'en' || q === 'es') { setLang(q); return; }
    }
  }, []); // eslint-disable-line

  // Doc title
  useEffect(() => {
    document.title = lang === 'es'
      ? 'MARCALL — Demo de voz en el navegador'
      : 'MARCALL — Browser voice demo';
  }, [lang]);

  const [scenario, setScenario] = useState<ScenarioKey>('appointment');
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastResponseMs, setLastResponseMs] = useState<number | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [transferred, setTransferred] = useState(false);
  const [ended, setEnded] = useState(false);

  const sessionIdRef = useRef<string>(makeSessionId());
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const supportsVoice = useMemo(() => speechSupported(), []);
  const supportsTts = useMemo(() => ttsSupported(), []);

  // Tick call duration
  useEffect(() => {
    if (!callStartedAt) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - callStartedAt) / 1000)), 250);
    return () => clearInterval(id);
  }, [callStartedAt]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcript, interim]);

  // Fire demo.opened once
  useEffect(() => {
    apiRequest('POST', '/api/demo/event', {
      sessionId: sessionIdRef.current,
      event: 'demo.opened',
      payload: { lang, supportsVoice, supportsTts },
    }).catch(() => {});
    // demo.end on tab close
    const onUnload = () => {
      try {
        navigator.sendBeacon?.(
          '/api/demo/end',
          new Blob([JSON.stringify({ sessionId: sessionIdRef.current })], { type: 'application/json' })
        );
      } catch {}
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []); // eslint-disable-line

  // ─── Speech recognition setup ───
  function buildRecognizer() {
    const SR = getSpeechRecognition();
    if (!SR) return null;
    const r = new SR();
    r.continuous = false;
    r.interimResults = true;
    r.lang = lang === 'en' ? 'en-US' : 'es-MX';
    r.onstart = () => { setListening(true); };
    r.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const txt = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += txt;
        else interimText += txt;
      }
      if (interimText) setInterim(interimText);
      if (finalText) {
        setInterim('');
        handleUserUtterance(finalText.trim());
      }
    };
    r.onerror = (e: any) => {
      setListening(false);
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        setPermissionDenied(true);
      }
    };
    r.onend = () => { setListening(false); };
    return r;
  }

  // ─── Mic toggle ───
  async function onMicToggle() {
    if (ended) {
      // Reset on a fresh session
      sessionIdRef.current = makeSessionId();
      setTranscript([]); setEnded(false); setTransferred(false); setCallStartedAt(null);
    }
    if (!supportsVoice) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    if (!recognitionRef.current) recognitionRef.current = buildRecognizer();
    if (!recognitionRef.current) return;

    // First-mic-on event
    if (!callStartedAt) {
      setCallStartedAt(Date.now());
      apiRequest('POST', '/api/demo/event', {
        sessionId: sessionIdRef.current,
        event: 'demo.started',
        payload: { lang, scenario },
      }).catch(() => {});
    }

    // Try to ensure mic permission first (so we can detect denial cleanly)
    try {
      // getUserMedia is the most reliable permission probe
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      }
    } catch {
      setPermissionDenied(true);
      return;
    }

    try {
      recognitionRef.current.lang = lang === 'en' ? 'en-US' : 'es-MX';
      recognitionRef.current.start();
    } catch {
      // Already started — ignore
    }
  }

  // ─── Send user text to backend, speak the response ───
  async function handleUserUtterance(text: string) {
    if (!text.trim()) return;
    const turn: Turn = { who: 'user', text, at: Date.now() };
    setTranscript(t => [...t, turn]);
    setThinking(true);

    if (!callStartedAt) setCallStartedAt(Date.now());

    const t0 = performance.now();
    try {
      const res = await apiRequest('POST', '/api/demo/respond', {
        sessionId: sessionIdRef.current,
        transcript: text,
        lang,
        scenario,
      });
      const data = (await res.json()) as DemoResponse;
      const t1 = performance.now();
      setLastResponseMs(Math.round(t1 - t0));

      const aTurn: Turn = { who: 'assistant', text: data.response, at: Date.now() };
      setTranscript(t => [...t, aTurn]);

      if (data.action === 'transfer') setTransferred(true);
      if (data.action === 'end') setEnded(true);

      if (!muted && supportsTts) speakText(data.response);
    } catch (err) {
      // surface a soft error inline
      setTranscript(t => [...t, { who: 'assistant', text: lang === 'es'
        ? 'Lo siento, hubo un problema. ¿Puede repetir?'
        : 'Sorry, there was a problem. Could you repeat?', at: Date.now() }]);
    } finally {
      setThinking(false);
    }
  }

  // ─── Text-to-speech ───
  function speakText(text: string) {
    if (!supportsTts) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang === 'en' ? 'en-US' : 'es-MX';
      utter.rate = 1.02;
      utter.pitch = 1.0;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    } catch {}
  }

  function onSubmitText(e?: React.FormEvent) {
    e?.preventDefault();
    if (!textInput.trim()) return;
    handleUserUtterance(textInput.trim());
    setTextInput('');
  }

  function onSignupClick() {
    apiRequest('POST', '/api/demo/event', {
      sessionId: sessionIdRef.current,
      event: 'demo.signup_clicked',
      payload: { lang, scenario, turnCount: transcript.length },
    }).catch(() => {});
  }

  function onScenarioChange(s: ScenarioKey) {
    setScenario(s);
    // Reset visible transcript so visitor isn't confused
    setTranscript([]);
    setEnded(false); setTransferred(false);
  }

  const sampleHint = scenario === 'info' ? t.sampleInfo
    : scenario === 'message' ? t.sampleMsg
    : scenario === 'human' ? t.sampleHuman
    : t.sampleAppt;

  // ─── Render ───
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background">
      {/* Top bar */}
      <header className="border-b bg-background/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            <MarcallWordmark />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link href="/signup?from=demo">
              <Button size="sm" variant="ghost" data-testid="link-signup-top">
                {lang === 'es' ? 'Crear cuenta' : 'Sign up'}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* Hero */}
        <div className="text-center max-w-3xl mx-auto">
          <Badge variant="outline" className="border-primary/40 text-primary uppercase tracking-widest text-[10px] font-medium" data-testid="badge-eyebrow">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse" />
            {t.eyebrow}
          </Badge>
          <h1 className="mt-5 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]" data-testid="text-hero">
            {t.hero1}<br className="hidden sm:block" />{' '}
            <span className="text-muted-foreground">{t.hero2}</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground" data-testid="text-subhero">
            {t.sub}
          </p>
        </div>

        {/* Stage */}
        <div className="mt-10 sm:mt-12 grid lg:grid-cols-[1fr_minmax(0,520px)] gap-6 lg:gap-10 items-start">
          {/* Left: mic + scenario */}
          <Card className="border-2 shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col items-center text-center">
                {/* Scenario picker */}
                <div className="w-full max-w-sm">
                  <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">
                    {t.scenario}
                  </label>
                  <Select value={scenario} onValueChange={(v) => onScenarioChange(v as ScenarioKey)}>
                    <SelectTrigger data-testid="select-scenario" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCENARIO_KEYS.map(s => (
                        <SelectItem key={s.key} value={s.key} data-testid={`option-scenario-${s.key}`}>
                          {lang === 'en' ? s.en : s.es}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mic */}
                <div className="mt-8 mb-3">
                  <MicButton
                    active={listening}
                    disabled={!supportsVoice || ended}
                    onClick={onMicToggle}
                    label={t.tap}
                  />
                </div>

                {/* Status line */}
                <div className="h-6 text-sm font-medium" data-testid="text-status">
                  {transferred ? <span className="text-primary">{t.transfer}</span>
                    : ended ? <span className="text-muted-foreground">{t.callEnded}</span>
                    : speaking ? <span className="text-primary">{t.speaking}</span>
                    : thinking ? <span className="text-muted-foreground inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t.thinking}</span>
                    : listening ? <span className="text-primary inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary animate-pulse" />{t.listening}</span>
                    : <span className="text-muted-foreground">{t.tap}</span>}
                </div>

                {/* TTS mute */}
                {supportsTts && (
                  <button
                    onClick={() => { setMuted(m => !m); if (!muted) window.speechSynthesis.cancel(); }}
                    data-testid="button-mute-tts"
                    className="mt-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
                  >
                    {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    {muted ? (lang === 'es' ? 'Voz silenciada' : 'Voice muted')
                      : (lang === 'es' ? 'Silenciar voz' : 'Mute voice')}
                  </button>
                )}

                {/* Hint */}
                <p className="mt-5 text-xs text-muted-foreground">
                  {t.sampleHint}<span className="italic text-foreground">{sampleHint}</span>
                </p>

                {/* Permission / unsupported messaging */}
                {!supportsVoice && (
                  <div className="mt-6 w-full text-left rounded-md border bg-muted/40 p-4 text-sm" data-testid="alert-unsupported">
                    <div className="font-medium">{t.unsupportedTitle}</div>
                    <p className="text-muted-foreground mt-1">
                      {t.unsupportedBody}{' '}
                      <a className="underline" href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer">{t.unsupportedChrome}</a>{' '}
                      {t.or}{' '}
                      <a className="underline" href="https://www.apple.com/safari/" target="_blank" rel="noopener noreferrer">{t.safari}</a>.
                    </p>
                  </div>
                )}
                {permissionDenied && supportsVoice && (
                  <div className="mt-6 w-full text-left rounded-md border bg-muted/40 p-4 text-sm" data-testid="alert-permission-denied">
                    <div className="font-medium">{t.permissionDeniedTitle}</div>
                    <p className="text-muted-foreground mt-1">{t.permissionDeniedBody}</p>
                  </div>
                )}

                {/* Text fallback */}
                <form onSubmit={onSubmitText} className="mt-6 w-full max-w-md">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 text-left">
                    {(!supportsVoice || permissionDenied) ? t.fallbackPrompt : (lang === 'es' ? 'O escribe' : 'Or type')}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder={t.typeHere}
                      data-testid="input-text-fallback"
                      disabled={ended}
                    />
                    <Button type="submit" size="icon" data-testid="button-send-text" disabled={ended || !textInput.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>

          {/* Right: transcript + metrics */}
          <Card className="border-2 shadow-sm">
            <CardContent className="p-0">
              {/* Header */}
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b bg-muted/30">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {t.transcript}
                </div>
                <Badge variant="outline" className="font-mono text-[10px]" data-testid="badge-lang">
                  {lang === 'en' ? 'EN-US' : 'ES-MX'}
                </Badge>
              </div>

              {/* Bubbles */}
              <div className="px-4 sm:px-5 py-4 min-h-[280px] max-h-[440px] overflow-y-auto" data-testid="region-transcript">
                {transcript.length === 0 && !interim && (
                  <div className="text-sm text-muted-foreground text-center py-12 italic">
                    {lang === 'es'
                      ? 'La transcripción aparecerá aquí en cuanto hables.'
                      : 'The transcript will appear here as soon as you speak.'}
                  </div>
                )}
                <div className="space-y-3">
                  {transcript.map((turn, i) => (
                    <div key={i} className={`flex gap-2 ${turn.who === 'assistant' ? 'flex-row-reverse text-right' : ''}`} data-testid={`bubble-${turn.who}-${i}`}>
                      <div className="max-w-[82%]">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                          {turn.who === 'assistant' ? t.assistant : t.you} · {fmtTime(new Date(turn.at))}
                        </div>
                        <div className={
                          turn.who === 'assistant'
                            ? 'bg-card border-l-2 border-primary text-foreground rounded-r-md px-3.5 py-2 text-sm leading-relaxed'
                            : 'bg-muted text-foreground rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm leading-relaxed'
                        }>
                          {turn.text}
                        </div>
                      </div>
                    </div>
                  ))}
                  {interim && (
                    <div className="flex gap-2" data-testid="bubble-interim">
                      <div className="max-w-[82%] text-left">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                          {t.you} · …
                        </div>
                        <div className="bg-muted/60 text-muted-foreground italic rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm leading-relaxed">
                          {interim}
                        </div>
                      </div>
                    </div>
                  )}
                  {thinking && (
                    <div className="flex gap-2 flex-row-reverse">
                      <div className="bg-card border-l-2 border-primary rounded-r-md px-3.5 py-2 inline-flex gap-1 text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '120ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '240ms' }} />
                      </div>
                    </div>
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </div>

              {/* Metrics */}
              <div className="border-t bg-muted/20 px-4 sm:px-5 py-3 flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span data-testid="text-metric-resp">
                  {t.metricResp}: {lastResponseMs != null ? `${(lastResponseMs / 1000).toFixed(1)}s` : '—'}
                </span>
                <span data-testid="text-metric-call">
                  {t.metricCall}: {fmtDuration(elapsed)}
                </span>
              </div>

              {/* Honesty disclosure */}
              <div className="border-t px-4 sm:px-5 py-3 text-[11px] text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">{t.guidedTitle}</span>{' '}
                {t.guidedBody}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Privacy disclosure */}
        <div className="mt-8 max-w-3xl mx-auto rounded-lg border bg-muted/30 px-5 py-4 flex gap-3" data-testid="block-privacy">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">{t.privacyTitle}</div>
            <p className="text-muted-foreground mt-0.5">{t.privacyBody}</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link href="/signup?from=demo">
            <Button size="lg" className="gap-2" onClick={onSignupClick} data-testid="button-cta-signup">
              {t.cta}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div className="mt-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-back-home">
              ← {t.backHome}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
