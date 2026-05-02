import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './es.json';
import en from './en.json';

// Detect from navigator.language; Spanish family → es, else → en. Fallback es.
function detectInitialLanguage(): 'es' | 'en' {
  if (typeof window === 'undefined' || !navigator?.language) return 'es';
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('en')) return 'en';
  return 'es';
}

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: detectInitialLanguage(),
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
  returnObjects: true,
});

export default i18n;
