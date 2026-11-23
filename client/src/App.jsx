import { useEffect, useState } from 'react';
import PhoneFrame from './device/PhoneFrame.jsx';
import { initDevice } from './ld/index.js';
import Welcome from './screens/Welcome.jsx';
import Credentials from './screens/Credentials.jsx';
import Kyc from './screens/Kyc.jsx';
import BankLink from './screens/BankLink.jsx';
import ChooseProduct from './screens/ChooseProduct.jsx';
import Deposit from './screens/Deposit.jsx';
import Done from './screens/Done.jsx';
import Inspector from './inspector/Inspector.jsx';

// Linear onboarding flow as a small state machine (mirrors a native nav stack).
const SCREENS = [Welcome, Credentials, Kyc, BankLink, ChooseProduct, Deposit, Done];
const NUMBERED_STEPS = SCREENS.length - 2; // screens 2–6 show "Step n of 5"

export default function App() {
  const [device, setDevice] = useState(null);
  const [initError, setInitError] = useState(null);
  const [step, setStep] = useState(0);
  const [session, setSession] = useState({});

  // Starts the LD client with the anonymous device context. Does NOT evaluate any flag.
  useEffect(() => {
    initDevice().then(setDevice).catch((err) => setInitError(err.message));
  }, []);

  const inspector = <Inspector />;
  if (initError) return <PhoneFrame aside={inspector}><p className="init-error">{initError}</p></PhoneFrame>;
  if (!device) return <PhoneFrame aside={inspector} />;

  const Screen = SCREENS[step];
  const update = (patch) => setSession((s) => ({ ...s, ...patch }));
  const nav = {
    step,
    stepNumber: step >= 1 && step <= NUMBERED_STEPS ? step : null,
    totalSteps: NUMBERED_STEPS,
    next: () => setStep((s) => Math.min(s + 1, SCREENS.length - 1)),
    back: () => setStep((s) => Math.max(s - 1, 0)),
    restart: () => {
      setSession({});
      setStep(0);
    },
  };

  return (
    <PhoneFrame platform={device.platform} aside={inspector}>
      <Screen key={step} session={session} update={update} nav={nav} />
    </PhoneFrame>
  );
}
