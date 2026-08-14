import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import PanelApp from './PanelApp';
import { windowLabel } from './services/sync';

import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';

import './styles/theme.css';
import './styles/app.css';
import './styles/parts.css';
import './styles/desktop.css';
import './styles/panel.css';

// Both windows load this same bundle; the label decides which app to mount.
const isPanel = windowLabel() === 'panel';
if (isPanel) document.body.classList.add('panel-window');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{isPanel ? <PanelApp /> : <App />}</React.StrictMode>
);
