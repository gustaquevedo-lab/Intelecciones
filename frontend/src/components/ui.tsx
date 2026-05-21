import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  showClear?: boolean;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = 'Buscar...',
  debounceMs = 300,
  style,
  inputStyle,
  showClear = true,
  className
}) => {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (onSearch) onSearch(newValue);
    }, debounceMs);
  }, [onChange, onSearch, debounceMs]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
    if (onSearch) onSearch('');
  }, [onChange, onSearch]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div style={{ position: 'relative', ...style }} className={className}>
      <Search 
        size={14} 
        style={{ 
          position: 'absolute', 
          left: '0.75rem', 
          top: '50%', 
          transform: 'translateY(-50%)', 
          color: 'var(--text-3)',
          pointerEvents: 'none'
        }} 
      />
      <input
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '0.45rem 2rem 0.45rem 2rem',
          borderRadius: '10px',
          background: 'var(--input-bg)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          fontSize: '0.78rem',
          outline: 'none',
          boxSizing: 'border-box',
          ...inputStyle
        }}
      />
      {showClear && localValue && (
        <button
          onClick={handleClear}
          style={{
            position: 'absolute',
            right: '0.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.2rem',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-3)'
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

interface LazyImageProps {
  src: string;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
  placeholder?: React.ReactNode;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  style,
  className,
  placeholder
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setLoaded(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  if (error) {
    return (
      <div style={{ 
        background: 'var(--bg-2)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        ...style 
      }} className={className}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Sin imagen</span>
      </div>
    );
  }

  return (
    <div ref={imgRef} style={{ background: 'var(--bg-2)', ...style }} className={className}>
      {loaded ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        placeholder || (
          <div style={{ 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'var(--bg-2)' 
          }}>
            <div className="spinner" style={{ width: '20px', height: '20px' }} />
          </div>
        )
      )}
    </div>
  );
};

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  style?: React.CSSProperties;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 40, style }) => {
  const initials = name.slice(0, 2).toUpperCase();
  
  if (src) {
    return (
      <LazyImage
        src={src}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          flexShrink: 0,
          ...style
        }}
      />
    );
  }

  return (
    <div 
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--plra-500), var(--plra-300))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.35,
        fontWeight: 800,
        color: 'white',
        flexShrink: 0,
        ...style
      }}
    >
      {initials}
    </div>
  );
};

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 24, 
  color = 'var(--plra-300)' 
}) => (
  <div 
    className="spinner" 
    style={{ 
      width: size, 
      height: size,
      borderColor: `${color}20`,
      borderTopColor: color
    }} 
  />
);

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon, 
  title, 
  description, 
  action 
}) => (
  <div style={{ 
    textAlign: 'center', 
    padding: '2rem',
    color: 'var(--text-3)' 
  }}>
    {icon && <div style={{ marginBottom: '0.5rem', opacity: 0.3 }}>{icon}</div>}
    <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>{title}</p>
    {description && (
      <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.7 }}>
        {description}
      </p>
    )}
    {action && <div style={{ marginTop: '1rem' }}>{action}</div>}
  </div>
);