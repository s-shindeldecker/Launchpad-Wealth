import { createRoot } from 'react-dom/client';
import { BrandProvider } from './brand/BrandProvider.jsx';
import App from './App.jsx';
import './styles.css';

// No <StrictMode>, for simplicity: in dev it double-invokes renders/effects (e.g. two LD
// client inits), which clutters the debugger. It would not double-count exposures —
// LaunchDarkly counts one exposure per context per experiment.
createRoot(document.getElementById('root')).render(
  <BrandProvider>
    <App />
  </BrandProvider>,
);
