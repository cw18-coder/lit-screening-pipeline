import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import './styles/global.css';

// Apply persisted theme before first paint so there is no flash of wrong theme.
try {
  const saved = localStorage.getItem('esgci-theme');
  document.documentElement.dataset.theme = saved === 'dark' ? 'dark' : 'light';
} catch {
  document.documentElement.dataset.theme = 'light';
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('missing #root element');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
