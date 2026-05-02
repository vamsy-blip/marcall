import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import i18n from '@/i18n';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/components/AuthProvider';

type Lang = 'es' | 'en';
type Ctx = { lang: Lang; setLang: (l: Lang) => void };
const LanguageContext = createContext<Ctx>({ lang: 'es', setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState<Lang>((i18n.language?.startsWith('en') ? 'en' : 'es'));

  // When user logs in, hydrate from preferred_language
  useEffect(() => {
    if (user?.preferredLanguage && (user.preferredLanguage === 'es' || user.preferredLanguage === 'en')) {
      const u = user.preferredLanguage as Lang;
      if (u !== lang) {
        setLangState(u);
        i18n.changeLanguage(u);
      }
    }
  }, [user?.preferredLanguage]);

  const setLang = (l: Lang) => {
    setLangState(l);
    i18n.changeLanguage(l);
    document.documentElement.lang = l;
    if (user) {
      // fire-and-forget
      apiRequest('PATCH', '/api/auth/preferences', { preferredLanguage: l }).catch(() => {});
    }
  };

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export const useLang = () => useContext(LanguageContext);
