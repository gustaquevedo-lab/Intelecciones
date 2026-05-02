import { useSettings } from '../context/SettingsContext';

export const Logo = ({ variant = 'default', className = '' }: { variant?: 'default' | 'light'; className?: string }) => {
  const { settings } = useSettings();

  return (
    <div className={`flex items-center ${className}`} style={{ flexShrink: 0 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        padding: '0.5rem 1rem',
        background: variant === 'light'
          ? 'rgba(255,255,255,0.08)'
          : 'rgba(0,71,171,0.12)',
        border: `1px solid ${variant === 'light' ? 'rgba(255,255,255,0.15)' : 'rgba(59,130,246,0.2)'}`,
        borderRadius: '12px',
        backdropFilter: 'blur(8px)',
      }}>
        {/* Logo Icon or Custom Image */}
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: settings.app_logo_url ? 'transparent' : 'linear-gradient(135deg, #1565D8, #0047AB)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: settings.app_logo_url ? 'none' : '0 2px 10px rgba(0,71,171,0.5)',
          overflow: 'hidden'
        }}>
          {settings.app_logo_url ? (
            <img src={settings.app_logo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Logo" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          )}
        </div>

        {/* Wordmark */}
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{
            fontFamily: 'var(--font-display, "Space Grotesk", sans-serif)',
            fontWeight: 700,
            fontSize: '0.9rem',
            letterSpacing: '-0.02em',
            color: variant === 'light' ? '#fff' : 'var(--text, #EEF4FF)',
            textTransform: 'uppercase'
          }}>
            {settings.app_name}
          </span>
          <span style={{
            fontSize: '0.55rem',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--text-3, #3A6495)',
            marginTop: '2px',
          }}>
            Estrategia Ganadora
          </span>
        </div>
      </div>
    </div>
  );
};
