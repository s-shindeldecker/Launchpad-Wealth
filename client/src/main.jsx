import { createRoot } from 'react-dom/client';
import { BrandProvider } from './brand/BrandProvider.jsx';
import App from './App.jsx';
import './styles.css';

// No <StrictMode>: in dev it double-invokes effects, which would evaluate the experiment
// flag twice on screen 6 once LaunchDarkly is wired in (two exposures). One render of
// screen 6 must mean exactly one evaluation.
createRoot(document.getElementById('root')).render(
  <BrandProvider>
    <App />
  </BrandProvider>,
);
