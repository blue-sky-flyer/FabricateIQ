import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { logError } from './services/logger.js';
import './styles/index.css';

// Catch stray async failures that no try/catch caught.
window.addEventListener('unhandledrejection', (e) => {
  logError('unhandled.promise', e?.reason || e);
});
window.addEventListener('error', (e) => {
  logError('window.error', e?.error || e?.message || e);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
