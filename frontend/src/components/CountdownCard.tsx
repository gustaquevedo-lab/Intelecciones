import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

interface CountdownCardProps {
  targetDate: string; // ISO string
  title: string;
  color?: string;
}

export const CountdownCard: React.FC<CountdownCardProps> = ({ targetDate, title, color = 'var(--plra-400)' }) => {
  const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number } | null>(null);
  const [isDayD, setIsDayD] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const target = new Date(targetDate);
      
      // Reset hours to compare days only for "Day D" status
      const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const targetDateOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());

      // If today is exactly the election day
      const isElectionDay = todayDateOnly.getTime() === targetDateOnly.getTime();

      if (!isElectionDay && target.getTime() > now.getTime()) {
        // Still waiting for the election day
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
        // Closing time is 17:00 of the election day
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

      // If we are past the election day
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'rgba(4, 20, 40, 0.4)',
        border: `1px solid ${isFinished ? 'var(--red)' : isDayD ? 'var(--green)' : color}44`,
        borderRadius: '16px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        position: 'relative',
        overflow: 'hidden',
        minWidth: '280px'
      }}
    >
      {/* Decorative background element */}
      <div style={{
        position: 'absolute',
        top: '-20px',
        right: '-20px',
        width: '100px',
        height: '100px',
        background: isFinished ? 'var(--red)' : isDayD ? 'var(--green)' : color,
        filter: 'blur(60px)',
        opacity: 0.15,
        zIndex: 0
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative', zIndex: 1 }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: `${isDayD ? 'var(--green)' : color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isFinished ? 'var(--red)' : isDayD ? 'var(--green)' : color
        }}>
          {isFinished ? <Shield size={20} /> : isDayD ? <Clock size={20} /> : <Calendar size={20} />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
            {title}
          </span>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
            {isFinished ? 'Votación Cerrada' : isDayD ? '¡Votaciones en Curso!' : 'Cuenta Regresiva'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', position: 'relative', zIndex: 1 }}>
        {!isFinished && timeLeft ? (
          <>
            {!isDayD && <TimeUnit value={timeLeft.days} label="DÍAS" color={color} />}
            <TimeUnit value={timeLeft.hours} label="HORAS" color={isDayD ? 'var(--green)' : color} />
            <TimeUnit value={timeLeft.minutes} label="MIN" color={isDayD ? 'var(--green)' : color} />
            <TimeUnit value={timeLeft.seconds} label="SEG" color={isDayD ? 'var(--green)' : color} />
            {isDayD && <span style={{ position: 'absolute', right: 0, top: '-20px', fontSize: '0.5rem', fontWeight: 800, color: 'var(--green)' }}>CIERRE A LAS 17:00</span>}
          </>
        ) : isFinished ? (
          <div style={{ 
            flex: 1, 
            padding: '1rem', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '12px',
            textAlign: 'center',
            color: 'var(--red)',
            fontWeight: 800,
            fontSize: '1.2rem',
            fontFamily: 'var(--font-display)'
          }}>
            PROCESO FINALIZADO
          </div>
        ) : null}
      </div>
    </motion.div>
  );
};

const TimeUnit = ({ value, label, color }: { value: number, label: string, color: string }) => (
  <div style={{
    flex: 1,
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '10px',
    padding: '0.6rem 0.4rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.1rem'
  }}>
    <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
      {value.toString().padStart(2, '0')}
    </span>
    <span style={{ fontSize: '0.5rem', fontWeight: 800, color: 'var(--text-3)' }}>
      {label}
    </span>
  </div>
);
