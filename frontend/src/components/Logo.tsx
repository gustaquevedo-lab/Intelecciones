import { useSettings } from '../context/SettingsContext';

/* ─── Intelecciones Isotipo — ballot box + ecosystem dot ─── */
const Isotipo = ({ size = 32 }: { size?: number }) => (
  <svg
    viewBox="0 0 80 80"
    width={size}
    height={size}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0 }}
  >
    <defs>
      <linearGradient id="isotipoNavy" x1="15%" y1="0%" x2="85%" y2="110%">
        <stop offset="0%" stopColor="#1E3A6E" />
        <stop offset="100%" stopColor="#0D1F42" />
      </linearGradient>
    </defs>
    {/* Squircle navy background */}
    <rect width="80" height="80" rx="18" fill="url(#isotipoNavy)" />
    {/* Ballot paper entering the box (tilted -10°) */}
    <g transform="translate(40,30) rotate(-10)">
      <rect x="-11" y="-14" width="22" height="19" rx="2" fill="white" opacity="0.97" />
      <line x1="-6" y1="-8" x2="6" y2="-8" stroke="#D0DCF0" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="-6" y1="-3" x2="2" y2="-3" stroke="#D0DCF0" strokeWidth="1.2" strokeLinecap="round" />
      {/* Green check — firma ecosistema Inteli */}
      <path d="M-8,1 L-1,8 L10,-7" fill="none" stroke="#22C47E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    {/* Ballot box lid */}
    <rect x="12" y="41" width="56" height="8" rx="2" fill="white" opacity="0.95" />
    {/* Slot */}
    <rect x="27" y="43" width="26" height="4" rx="1" fill="url(#isotipoNavy)" opacity="0.45" />
    {/* Box body */}
    <rect x="15" y="47" width="50" height="29" rx="3" fill="white" opacity="0.95" />
    {/* Lock */}
    <circle cx="40" cy="63" r="4" fill="url(#isotipoNavy)" opacity="0.18" />
    <circle cx="40" cy="63" r="2" fill="url(#isotipoNavy)" opacity="0.3" />
    {/* Blue ecosystem dot */}
    <circle cx="69" cy="12" r="7" fill="#2E84F0" />
  </svg>
);

export const Logo = ({
  variant = 'default',
  className = '',
  size = 'default',
}: {
  variant?: 'default' | 'light';
  className?: string;
  size?: 'default' | 'large';
}) => {
  const { settings } = useSettings();

  const isMobile = window.innerWidth < 640;
  const isLarge = size === 'large';
  const isotipoSize = isMobile ? 24 : (isLarge ? 52 : 32);
  const wordmarkPx = isMobile ? '0.8rem' : (isLarge ? '1.3rem' : '0.92rem');
  const taglinePx  = isMobile ? '0.4rem' : (isLarge ? '0.58rem' : '0.48rem');

  return (
    <div className={`flex items-center ${className}`} style={{ flexShrink: 0 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '0.4rem' : (isLarge ? '0.9rem' : '0.65rem'),
        padding: isMobile ? '0.3rem 0.6rem' : (isLarge ? '0.65rem 1.25rem' : '0.45rem 1.1rem'),
        background: 'var(--accent-subtle)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        backdropFilter: 'blur(var(--blur-md))',
        boxShadow: 'var(--shadow-sm)'
      }}>

        {/* Isotipo or custom image */}
        {settings.app_logo_url ? (
          <div style={{
            width: isotipoSize, height: isotipoSize,
            borderRadius: '10px',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            <img
              src={settings.app_logo_url}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              alt="Logo"
            />
          </div>
        ) : (
          <Isotipo size={isotipoSize} />
        )}

        {/* Wordmark */}
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, gap: '3px' }}>
          <span style={{
            fontFamily: 'var(--font-display, "Space Grotesk", sans-serif)',
            fontSize: wordmarkPx,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}>
            <span style={{ fontWeight: 800, color: 'var(--plra-400)' }}>Int</span>
            <span style={{ fontWeight: 300, color: 'var(--green)' }}>elecciones</span>
          </span>
          <span style={{
            fontSize: taglinePx,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            opacity: 0.8
          }}>
            Gestión Electoral
          </span>
        </div>
      </div>
    </div>
  );
};
