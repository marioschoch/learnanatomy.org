import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { initI18n } from './i18n';
import { bootstrap } from './state';
import { decodeGlb } from './viewer';

initI18n();
void bootstrap(decodeGlb);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
