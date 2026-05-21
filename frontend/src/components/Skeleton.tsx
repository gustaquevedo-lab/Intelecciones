import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  width = '100%', 
  height = 20, 
  borderRadius = 8,
  style,
  className
}) => (
  <div
    className={`skeleton ${className || ''}`}
    style={{
      width,
      height,
      borderRadius,
      background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
      ...style
    }}
  />
);

interface SkeletonTextProps {
  lines?: number;
  width?: string;
  lastLineWidth?: string;
  gap?: number;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ 
  lines = 3, 
  width = '100%', 
  lastLineWidth = '60%',
  gap = 8
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap }}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        width={i === lines - 1 ? lastLineWidth : width}
        height={14}
        borderRadius={4}
      />
    ))}
  </div>
);

interface SkeletonCardProps {
  avatar?: boolean;
  title?: boolean;
  description?: boolean;
  actions?: boolean;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  avatar = true,
  title = true,
  description = true,
  actions = true
}) => (
  <div style={{ 
    padding: '1rem', 
    background: 'var(--surface)', 
    borderRadius: 12,
    border: '1px solid var(--border)'
  }}>
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
      {avatar && <Skeleton width={40} height={40} borderRadius="50%" />}
      <div style={{ flex: 1 }}>
        {title && <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />}
        {description && <SkeletonText lines={2} />}
      </div>
    </div>
    {actions && (
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <Skeleton width={80} height={32} borderRadius={8} />
        <Skeleton width={80} height={32} borderRadius={8} />
      </div>
    )}
  </div>
);

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({ 
  rows = 5, 
  columns = 4 
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', gap: 8 }}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} height={14} style={{ flex: 1 }} />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} style={{ display: 'flex', gap: 8 }}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton 
            key={colIndex} 
            height={18} 
            width={colIndex === 0 ? '30%' : colIndex === columns - 1 ? '15%' : '20%'}
            borderRadius={4}
          />
        ))}
      </div>
    ))}
  </div>
);

interface SkeletonListProps {
  count?: number;
  type?: 'card' | 'row' | 'compact';
}

export const SkeletonList: React.FC<SkeletonListProps> = ({ 
  count = 5, 
  type = 'card' 
}) => {
  if (type === 'row') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            padding: '0.75rem',
            background: 'var(--surface)',
            borderRadius: 8,
            border: '1px solid var(--border)'
          }}>
            <Skeleton width={36} height={36} borderRadius="50%" />
            <div style={{ flex: 1 }}>
              <Skeleton width="40%" height={14} style={{ marginBottom: 6 }} />
              <Skeleton width="60%" height={12} borderRadius={4} />
            </div>
            <Skeleton width={60} height={24} borderRadius={6} />
          </div>
        ))}
      </div>
    );
  }
  
  if (type === 'compact') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} height={48} borderRadius={8} />
        ))}
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};

// CSS keyframes for shimmer animation - add to index.css or create a global stylesheet
export const skeletonStyles = `
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

export default Skeleton;