import { useEffect, useState } from 'react';

// 390×844 viewport inside device chrome — stand-in for the customer's native app.
// `aside` renders beside the device (presenter panels such as the Inspector).
export default function PhoneFrame({ platform, children, aside }) {
  const [time, setTime] = useState(() => clock());
  const [zoom, setZoom] = useState(fitZoom);
  useEffect(() => {
    const t = setInterval(() => setTime(clock()), 30_000);
    const onResize = () => setZoom(fitZoom());
    window.addEventListener('resize', onResize);
    return () => {
      clearInterval(t);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className="stage">
      <div className={`phone phone--${platform || 'ios'}`} style={{ zoom }}>
        <div className="phone__screen">
          <div className="statusbar">
            <span className="statusbar__time">{time}</span>
            {platform !== 'android' && <span className="statusbar__notch" />}
            <span className="statusbar__icons">▂▄▆ ● ▮</span>
          </div>
          <div className="phone__content">{children}</div>
          {platform !== 'android' && <div className="home-indicator" />}
        </div>
      </div>
      {aside}
    </div>
  );
}

// Shrink the whole device to fit short windows (projector, laptop) without clipping.
const PHONE_W = 414;
const PHONE_H = 868;
function fitZoom() {
  const margin = 32;
  return Math.min(1, (window.innerHeight - margin) / PHONE_H, (window.innerWidth - margin) / PHONE_W);
}

function clock() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
