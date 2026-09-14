import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyPreferences } from './application/preferences';
import './styles.css';
import './theme.css';
import './board.css';
import './app-v2.css';
import './layout-fixes.css';
import './feature-panels.css';
import './viewer-tree.css';

applyPreferences();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
