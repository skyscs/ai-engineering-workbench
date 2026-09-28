import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
const element = document.getElementById('root');
if (!element) throw new Error('Root element was not found');
const root = createRoot(element);
if (location.pathname.startsWith('/advanced')) {
  void Promise.all([import('./App'), import('./styles.css')]).then(([{ App }]) => root.render(<StrictMode><App /></StrictMode>));
} else {
  void import('./Workbench').then(({ Workbench }) => root.render(<StrictMode><Workbench /></StrictMode>));
}
