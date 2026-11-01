import { render } from 'preact';
import { App } from './ui/App';
import { watchForUpdate } from './ui/update';
import './ui/theme.css';

const root = document.getElementById('app');
if (root) render(<App />, root);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  watchForUpdate(navigator.serviceWorker).catch(() => undefined);
}
