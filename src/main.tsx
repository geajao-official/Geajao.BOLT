import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { MusicProvider } from '@/context/MusicContext';
import './index.css';

// Register Service Worker for push notifications
if ('serviceWorker' in navigator && 'PushManager' in window) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((swReg) => {
        console.log('Service Worker is registered', swReg);
      })
      .catch((error) => {
        console.error('Service Worker Error', error);
      });
  });
} else {
  console.warn('Push messaging is not supported');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MusicProvider>
      <App />
    </MusicProvider>
  </StrictMode>
);