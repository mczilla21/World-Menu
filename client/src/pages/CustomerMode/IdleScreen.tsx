import { useState, useEffect, useRef, useCallback } from 'react';

interface Props {
  restaurantName: string;
  logo: string;
  message: string;
  bgImage: string;
  themeColor: string;
  timeoutMinutes: number;
  onDismiss: () => void;
}

export default function IdleScreen({ restaurantName, logo, message, bgImage, themeColor, timeoutMinutes, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(false);
  const timeoutMs = (timeoutMinutes > 0 ? timeoutMinutes : 3) * 60 * 1000;

  // Keep ref in sync with state
  useEffect(() => { visibleRef.current = visible; }, [visible]);

  const resetTimer = useCallback(() => {
    if (visibleRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(() => setFadeIn(true));
    }, timeoutMs);
  }, [timeoutMs]);

  // Set up activity listeners — stable across visible changes
  useEffect(() => {
    const events = ['touchstart', 'mousedown', 'mousemove', 'keydown', 'scroll'];
    const handler = () => {
      if (visibleRef.current) {
        // Dismiss the idle screen
        setFadeIn(false);
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = setTimeout(() => {
          setVisible(false);
          onDismiss();
        }, 300);
      } else {
        // Reset the idle countdown
        resetTimer();
      }
    };

    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [resetTimer, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-500"
      style={{ opacity: fadeIn ? 1 : 0 }}
    >
      <style>{`
        @keyframes idleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes idlePulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes idleGlow {
          0%, 100% { box-shadow: 0 0 30px rgba(255,255,255,0.1); }
          50% { box-shadow: 0 0 60px rgba(255,255,255,0.2); }
        }
        @keyframes bgZoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.05); }
        }
      `}</style>

      {/* Background */}
      {bgImage ? (
        <div className="absolute inset-0">
          <img
            src={`/uploads/${bgImage}`}
            alt=""
            className="w-full h-full object-cover"
            style={{ animation: 'bgZoom 20s ease-in-out alternate infinite' }}
          />
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
        </div>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${themeColor}dd 0%, ${themeColor}88 40%, ${themeColor}44 70%, ${themeColor}22 100%)`,
          }}
        >
          {/* Decorative circles */}
          <div className="absolute top-[10%] left-[10%] w-32 h-32 rounded-full opacity-10 bg-white" style={{ animation: 'idleFloat 6s ease-in-out infinite' }} />
          <div className="absolute bottom-[15%] right-[15%] w-48 h-48 rounded-full opacity-10 bg-white" style={{ animation: 'idleFloat 8s ease-in-out infinite 1s' }} />
          <div className="absolute top-[40%] right-[25%] w-20 h-20 rounded-full opacity-10 bg-white" style={{ animation: 'idleFloat 5s ease-in-out infinite 2s' }} />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-8 max-w-lg" style={{ animation: 'idleFloat 4s ease-in-out infinite' }}>
        {/* Logo */}
        {logo && (
          <div
            className="mb-6 rounded-3xl overflow-hidden bg-white/10 backdrop-blur-sm p-3"
            style={{ animation: 'idleGlow 3s ease-in-out infinite' }}
          >
            <img
              src={`/uploads/${logo}`}
              alt={restaurantName}
              className="w-28 h-28 object-contain rounded-2xl"
            />
          </div>
        )}

        {/* Restaurant name */}
        <h1 className="text-4xl font-bold text-white mb-4" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
          {restaurantName}
        </h1>

        {/* Custom message */}
        {message && (
          <p className="text-lg text-white/90 mb-8 leading-relaxed" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.2)' }}>
            {message}
          </p>
        )}

        {/* Tap prompt */}
        <div
          className="flex items-center gap-2 text-white/70 text-sm font-medium"
          style={{ animation: 'idlePulse 2s ease-in-out infinite' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
          </svg>
          Tap anywhere to start ordering
        </div>
      </div>
    </div>
  );
}
