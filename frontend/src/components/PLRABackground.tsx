import React from 'react';
import { motion } from 'framer-motion';

const starOuterPoints = [
  { x: 50, y: 5 },
  { x: 95, y: 36 },
  { x: 78, y: 90 },
  { x: 22, y: 90 },
  { x: 5, y: 36 },
];

const starInnerPoints = [
  { x: 61, y: 36 },
  { x: 68, y: 56 },
  { x: 50, y: 70 },
  { x: 32, y: 56 },
  { x: 39, y: 36 },
];

const starPath = "M 50,5 L 61,36 L 95,36 L 68,56 L 78,90 L 50,70 L 22,90 L 32,56 L 5,36 L 39,36 Z";

export const PLRABackground = () => (
  <>
    {/* Waving Flag */}
    <div style={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div 
        animate={{ 
          backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="plra-gradient-bg"
        style={{ position: 'absolute', inset: 0, backgroundSize: '200% 200%' }}
      />
      
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3 }} preserveAspectRatio="none" viewBox="0 0 100 100">
        <motion.path 
          d="M 0 0 C 30 20 70 -20 100 0 L 100 100 L 0 100 Z" 
          fill="rgba(255,255,255,0.05)"
          animate={{ 
            d: [
              "M 0 0 C 30 20 70 -20 100 0 L 100 100 L 0 100 Z", 
              "M 0 0 C 40 -10 60 30 100 0 L 100 100 L 0 100 Z", 
              "M 0 0 C 30 20 70 -20 100 0 L 100 100 L 0 100 Z"
            ] 
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path 
          d="M 0 30 C 40 50 60 10 100 30 L 100 100 L 0 100 Z" 
          fill="rgba(255,255,255,0.1)"
          animate={{ 
            d: [
              "M 0 30 C 40 50 60 10 100 30 L 100 100 L 0 100 Z", 
              "M 0 30 C 30 10 70 50 100 30 L 100 100 L 0 100 Z", 
              "M 0 30 C 40 50 60 10 100 30 L 100 100 L 0 100 Z"
            ] 
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
      </svg>
    </div>

    {/* Animated Star */}
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }}>
      <motion.div 
        animate={{ 
          rotate: [0, 3, -3, 0],
          scale: [1, 1.03, 0.97, 1]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: 'relative', width: '150vw', height: '150vw', maxWidth: '1000px', maxHeight: '1000px', opacity: 0.2 }}
      >
        <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.3))' }}>
          <motion.path 
            d={starPath}
            fill="rgba(255,255,255,0.05)"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="0.8"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 4, ease: "easeInOut" }}
          />
          {starOuterPoints.map((point, i) => (
            <motion.circle
              key={`outer-${i}`}
              cx={point.x}
              cy={point.y}
              r="1.5"
              fill="#ffffff"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 3, delay: i * 0.4, repeat: Infinity }}
            />
          ))}
          <motion.circle cx="50" cy="50" r="1.5" fill="#ffffff" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity }} />
          {starOuterPoints.map((point, i) => (
            <motion.line 
              key={`line-${i}`}
              x1="50" y1="50" 
              x2={point.x} y2={point.y} 
              stroke="rgba(255,255,255,0.2)" 
              strokeWidth="0.2" 
              strokeDasharray="1 1"
              animate={{ opacity: [0.1, 0.4, 0.1] }} 
              transition={{ duration: 3, delay: i * 0.5, repeat: Infinity }} 
            />
          ))}
        </svg>
      </motion.div>
    </div>
  </>
);
