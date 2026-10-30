import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { initPwa } from '@/features/pwa';

import { App } from './App';
import './styles.css';

export function bootstrap() {
  initPwa();
  const root = document.getElementById('root');

  if (!root) {
    throw new Error('Missing root');
  }

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
