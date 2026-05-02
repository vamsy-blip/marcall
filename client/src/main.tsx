import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n'; // initialize i18next BEFORE rendering
import { ThemeProvider } from '@/components/ThemeProvider';
import { initClientSentry } from '@/lib/sentry';

// Initialize Sentry as early as possible so it captures hydration errors and
// any synchronous startup failures. No-op when VITE_SENTRY_DSN is unset.
initClientSentry();

if (!window.location.hash) {
  window.location.hash = '#/';
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

// Register service worker (production-only, https-only).
// IMPORTANT: skip when running inside an iframe — the Perplexity Computer
// preview embeds this app in an iframe, and SW registration in that context
// can intercept routes and break rendering. The deployed *.pplx.app URL
// runs outside an iframe, so SW will register there.
if (
  'serviceWorker' in navigator &&
  import.meta.env.PROD &&
  window.self === window.top
) {
  window.addEventListener('load', () => {
    // Use a relative URL so the SW resolves correctly under any base path
    // (deploy_website serves under a proxied path, publish_website at root).
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[sw] registration failed:', err?.message || err);
    });
  });
}
