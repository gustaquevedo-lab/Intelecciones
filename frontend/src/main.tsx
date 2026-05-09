import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

window.addEventListener('vite:preloadError', (event) => {
  console.log('Preload error detected, reloading to get latest version...');
  window.location.reload();
});

console.log('Mounting App in root. Version Timestamp:', new Date().toISOString());
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
