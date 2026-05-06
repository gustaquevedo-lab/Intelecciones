import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Shield, Target } from 'lucide-react';
import { motion } from 'framer-motion';

interface CountdownCardProps {
  targetDate: string; // ISO string
  title: string;
  color?: string;
  isSidebar?: boolean;
}

export const CountdownCard: React.FC<CountdownCardProps> = ({ targetDate, title, color = 'var(--plra-400)', isSidebar = false }) => {
  const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number } | null>(null);
  const [isDayD, setIsDayD] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const target = new Date(targetDate);
      
      const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const targetDateOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());

      const isElectionDay = todayDateOnly.getTime() === targetDateOnly.getTime();

      if (!isElectionDay && target.getTime() > now.getTime()) {
        const diff = target.getTime() - now.getTime();
        setIsDayD(false);
        setIsFinished(false);
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000)
        });
        return;
      }

      if (isElectionDay) {
        setIsDayD(true);
        const closingTime = new Date(targetDateOnly);
        closingTime.setHours(17, 0, 0);
        const closingDiff = closingTime.getTime() - now.getTime();

        if (closingDiff <= 0) {
          setIsFinished(true);
          setTimeLeft(null);
        } else {
          setIsFinished(false);
          setTimeLeft({
            days: 0,
            hours: Math.floor((closingDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((closingDiff % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((closingDiff % (1000 * 60)) / 1000)
          });
        }
        return;
      }

      if (now.getTime() > target.getTime()) {
        setIsFinished(true);
        setTimeLeft(null);
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        background: isFinished 
          ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(153, 27, 27, 0.2) 100%)' 
          : isDayD 
            ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(21, 128, 61, 0.25) 100%)'
            : 'linear-gradient(135deg, rgba(30, 58, 138, 0.2) 0%, rgba(15, 23, 42, 0.4) 100%)',
        border: `1px solid ${isFinished ? 'var(--red)' : isDayD ? 'var(--green)' : color}44`,
        borderRadius: '20px',
        padding: isSidebar ? '1rem' : '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
        boxShadow: isDayD ? '0 10px 40px rgba(34, 197, 94, 0.2)' : '0 8px 32px rgba(0,0,0,0.25)'
      }}
    >
      {/* Tactical Grid Overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '16px 16px', opacity: 0.5, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative', zIndex: 1 }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: isFinished ? 'rgba(239,68,68,0.1)' : isDayD ? 'rgba(34,197,94,0.1)' : `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isFinished ? 'var(--red)' : isDayD ? 'var(--green)' : color,
          border: `1px solid ${isFinished ? 'var(--red)' : isDayD ? 'var(--green)' : color}33`
        }}>
          {isFinished ? <Shield size={22} /> : isDayD ? <Target size={22} className="animate-pulse" /> : <Clock size={22} />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.15em', color: isDayD ? 'var(--green)' : 'var(--text-3)', textTransform: 'uppercase' }}>
            {isDayD ? 'OPERACIÓN ACTIVA' : title}
          </span>
          <span style={{ fontSize: isSidebar ? '0.9rem' : '1.1rem', fontWeight: 800, color: 'white', truncate: true } as any}>
            {isFinished ? 'PROCESO CERRADO' : isDayD ? 'DÍA D: EN CURSO' : 'CUENTA REGRESIVA'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', position: 'relative', zIndex: 1 }}>
        {!isFinished && timeLeft ? (
          <>
            {!isDayD && <TimeUnit value={timeLeft.days} label="D" color={color} />}
            <TimeUnit value={timeLeft.hours} label="H" color={isDayD ? 'var(--green)' : color} />
            <TimeUnit value={timeLeft.minutes} label="M" color={isDayD ? 'var(--green)' : color} />
            <TimeUnit value={timeLeft.seconds} label="S" color={isDayD ? 'var(--green)' : color} />
          </>
        ) : isFinished ? (
          <div style={{ 
            flex: 1, padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px',
            textAlign: 'center', color: 'var(--red)', fontWeight: 900, fontSize: '0.9rem',
            fontFamily: 'var(--font-display)', letterSpacing: '0.1em'
          }}>
            VOTACIÓN FINALIZADA
          </div>
        ) : null}
      </div>

      {isDayD && !isFinished && (
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
          <div style={{ height: '4px', flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '65%' }} // Mock progress for visual effect
              style={{ height: '100%', background: 'var(--green)', boxShadow: '0 0 10px var(--green)' }} 
            />
          </div>
          <span style={{ fontSize: '0.55rem', fontWeight: 900, color: 'var(--green)' }}>CIERRE 17:00</span>
        </div>
      )}
    </motion.div>
  );
};

const TimeUnit = ({ value, label, color }: { value: number, label: string, color: string }) => (
  <div style={{
    flex: 1, background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px', padding: '0.5rem 0.2rem',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem'
  }}>
    <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
      {value.toString().padStart(2, '0')}
    </span>
    <span style={{ fontSize: '0.5rem', fontWeight: 800, color: 'var(--text-3)' }}>
      {label}
    </span>
  </div>
);
