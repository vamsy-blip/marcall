/**
 * Floating WhatsApp sales button for the marketing site only.
 * Documented in MARCALL/MARKETING_CONFIG.md \u2014 Vamsy will swap WA_NUMBER for the real number.
 */
import { SiWhatsapp } from 'react-icons/si';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Placeholder \u2014 see MARKETING_CONFIG.md
const WA_NUMBER = '5281110077000'; // E.164 format, no +
const PREFILL_ES = 'Hola, me interesa probar MARCALL';
const PREFILL_EN = "Hi, I'm interested in trying MARCALL";

export function WhatsAppButton() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'es').slice(0, 2);
  const text = lang === 'en' ? PREFILL_EN : PREFILL_ES;
  const href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('marketing.whatsapp_aria') as string}
          data-testid="link-whatsapp-sales"
          className="
            fixed bottom-5 right-5 z-50
            flex items-center justify-center
            w-14 h-14 rounded-full
            shadow-lg shadow-black/15
            transition-all duration-200
            hover:scale-105 hover:shadow-xl
            focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#25D366]
          "
          style={{ backgroundColor: '#25D366', color: '#fff' }}
        >
          <SiWhatsapp className="w-7 h-7" />
        </a>
      </TooltipTrigger>
      <TooltipContent side="left" className="font-medium">
        {t('marketing.whatsapp_tooltip')}
      </TooltipContent>
    </Tooltip>
  );
}
