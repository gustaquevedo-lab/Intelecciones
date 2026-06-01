import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '../../components/Skeleton';
import {
  Search, MapPin, User, Map, Building2, Home,
  ClipboardCheck, ArrowRight, AlertCircle, AlertTriangle,
  CheckCheck, ThumbsUp, HelpCircle, X, Shield, Share2, History, Edit2, Trash2, MessageSquare, Fingerprint, Landmark,
  UserPlus, Camera, LayoutList, Users, Mic, Square, ChevronRight,
  Car, Inbox, Truck, Download, Activity
} from 'lucide-react';
import { getImageUrl } from '../../services/api';
import { ImageCropperModal } from '../../components/ImageCropperModal';
import { Virtuoso } from 'react-virtuoso';


// Shared helper components (copied from CoordinatorApp)

const formatWhatsApp = (phone: string) => {
  if (!phone) return '';
  // 1. Remove everything that is not a digit
  let clean = phone.replace(/\D/g, ''); 
  
  // 2. If it starts with 595, remove it to normalize the base number
  if (clean.startsWith('595')) {
    clean = clean.substring(3);
  }
  
  // 3. Remove leading 0 if it exists (e.g. 0981 -> 981)
  const normalized = clean.replace(/^0/, ''); 
  
  // 4. Return with single 595 prefix
  return `595${normalized}`;
};

const handlePhoneChange = (value: string, setter: (v: string) => void) => {
  // Remove everything except digits and optional leading +
  let clean = value.replace(/[^\d+]/g, '');
  
  let prefix = '+595';
  if (clean.startsWith('+55') || clean.startsWith('55')) {
    prefix = '+55';
    clean = clean.startsWith('+55') ? clean.substring(3) : clean.substring(2);
  } else if (clean.startsWith('+595') || clean.startsWith('595')) {
    prefix = '+595';
    clean = clean.startsWith('+595') ? clean.substring(4) : clean.substring(3);
  }
  
  // Clean remaining non-digits
  clean = clean.replace(/\D/g, '');
  
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  
  if (clean.length > 0) {
    setter(`${prefix} ${clean}`);
  } else {
    setter('');
  }
};

const Spinner = ({ size = 22 }: { size?: number }) => (
  <div
    className="spinner"
    style={{ width: size, height: size }}
  />
);

const SectionLabel = ({ icon, text, color = 'var(--plra-300)' }: { icon: React.ReactNode; text: string; color?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
    <div style={{
      width: '3px',
      height: '18px',
      borderRadius: '2px',
      background: color,
      boxShadow: `0 0 8px ${color}`,
      flexShrink: 0,
    }} />
    <span style={{ color: icon ? color : 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      {icon}
    </span>
    <span style={{
      fontSize: '0.65rem',
      fontWeight: 800,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: 'var(--text-3)',
      fontFamily: 'var(--font-display)',
    }}>
      {text}
    </span>
  </div>
);

const DataItem = ({
  icon,
  iconColor = 'blue',
  label,
  value,
  large = false,
}: {
  icon: React.ReactNode;
  iconColor?: 'blue' | 'green' | 'teal' | 'amber';
  label: string;
  value: React.ReactNode;
  large?: boolean;
}) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
    <div className={`icon-box icon-box-md icon-box-${iconColor}`} style={{ borderRadius: '10px', marginTop: '2px', flexShrink: 0 }}>
      {icon}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
      <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-display)' }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: large ? '1.6rem' : '0.95rem',
        color: 'var(--text)',
        lineHeight: 1.2,
        textTransform: 'uppercase',
      }}>
        {value}
      </span>
    </div>
  </div>
);

const NumberBadge = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
    <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-display)' }}>
      {label}
    </span>
    <div style={{
      height: '3.25rem',
      background: 'var(--accent-subtle)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: '1.6rem',
      color: 'var(--text)',
    }}>
      {value}
    </div>
  </div>
);

const TabCoordinators = (props: any) => {
  const {
    // Auth + settings
    user, settings, activeDistrict, isReadOnly,
    // Core search
    ci, setCi, elector, setElector, isLoading, error, setError,
    successMsg, setSuccessMsg, location, setLocation,
    needsTransport, setNeedsTransport, activeTab, setActiveTab,
    telefono, setTelefono, trafficLight, setTrafficLight,
    photoFrente, setPhotoFrente, photoVerso, setPhotoVerso,
    isUploadingFrente, isUploadingVerso,
    showModal, setShowModal,
    showUnregisteredModal, setShowUnregisteredModal,
    customElectorCI, setCustomElectorCI,
    customElectorName, setCustomElectorName,
    customElectorTelefono, setCustomElectorTelefono,
    customActionPill, setCustomActionPill,
    isConfirmed, setIsConfirmed,
    customIsSubmitted, setCustomIsSubmitted,
    // History
    history, setHistory, editingCapture, setEditingCapture,
    colorCounts, locationStats, isStatsLoading,
    // Disputes
    disputes, disputesSearchQuery, setDisputesSearchQuery, isDisputesLoading,
    // Requests / support
    requests, requestMsg, setRequestMsg, requestType, setRequestType,
    supportPhoto, setSupportPhoto, supportAudio, setSupportAudio,
    isRecording, startRecording, stopRecording, handleSendRequest,
    // Coordinators / team
    teamStats, teamSearchQuery, setTeamSearchQuery,
    selectedCoordDetail, setSelectedCoordDetail,
    coordCaptures, showDetailModal, setShowDetailModal,
    myPadrinos,
    showCoordModal, setShowCoordModal,
    newCoordCI, setNewCoordCI,
    newCoordName, setNewCoordName,
    newCoordRealName, setNewCoordRealName,
    newCoordPhoto, setNewCoordPhoto,
    newCoordTelefono, setNewCoordTelefono,
    isCoordVerified,
    showPadrinoModal, setShowPadrinoModal,
    newPadrinoCI, setNewPadrinoCI,
    newPadrinoRealName, setNewPadrinoRealName,
    newPadrinoPhoto, setNewPadrinoPhoto,
    newPadrinoTelefono, setNewPadrinoTelefono,
    isPadrinoVerified, isLoading: _isLoading,
    showPhotoSource, setShowPhotoSource,
    cropperData, setCropperData,
    fileInputRef, frontCameraInputRef, galleryInputRef,
    padrinoFileInputRef, padrinoFrontCameraInputRef, padrinoGalleryInputRef,
    // Offline
    offlineCount, isDownloading, downloadProgress,
    handleDownloadPadron,
    // API handlers
    handleCapture, handleUpdateCapture, handleDeleteCapture,
    handleCreateCoord, handleCreatePadrino,
    fetchHistory, fetchRequests, fetchDisputes, fetchTeamStats,
    handlePhoneChange, fetchCoordinatorDetail, handleLookupCoordCI, handleLookupPadrinoCI,
    handleUploadCustomElectorPhoto, handleSaveCustomElector, handleEditHistory,

  } = props;

  return (
    <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionLabel 
              icon={<Users size={13} />} 
              text={user?.role === 'JEFE_CAMPANA' ? "Mis Padrinos" : "Mi Equipo de Trabajo"} 
            />
            <button 
              onClick={() => user?.role === 'JEFE_CAMPANA' ? setShowPadrinoModal(true) : setShowCoordModal(true)}
              className="btn-confirm-styled" 
              style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', height: 'auto', borderRadius: '10px' }}
            >
              <UserPlus size={14} /> NUEVO
            </button>
          </div>
      
          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <input 
              type="text"
              value={teamSearchQuery}
              onChange={(e) => setTeamSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o cédula..."
              style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', borderRadius: '16px', background: 'var(--surface-light)', border: '1px solid var(--border)', color: 'white', fontSize: '0.85rem', outline: 'none' }}
            />
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          </div>
      
          {teamStats.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed var(--border)' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Aún no tienes registros bajo tu cargo.</p>
            </div>
          )}
      
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            {(user?.role === 'JEFE_CAMPANA' ? myPadrinos : teamStats).filter(c => 
              (c?.nombre?.toLowerCase() || '').includes(teamSearchQuery.toLowerCase()) || 
              (c?.username?.toString() || '').includes(teamSearchQuery)
            ).map(c => {
              return (
                <motion.div 
                  key={c.id} 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchCoordinatorDetail(c)}
                  style={{ 
                    background: 'var(--surface)', 
                    border: '1px solid var(--border)', 
                    borderRadius: '20px', 
                    padding: '1.25rem', 
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '14px', overflow: 'hidden', border: '2px solid var(--border)', flexShrink: 0 }}>
                      {c.photo_url ? (
                        <img src={getImageUrl(c.photo_url) || ''} alt={c.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: 'var(--surface-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Users size={22} style={{ color: 'var(--text-3)' }} />
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h5 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>{c.nombre}</h5>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', margin: 0 }}>CI: {c.username} {c.telefono && `• ${c.telefono}`}</p>
                    </div>
                    <ChevronRight size={18} style={{ color: 'var(--text-3)' }} />
                  </div>
      
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem' }}>
                    {[
                      { count: c.green, color: '#22C55E' },
                      { count: c.yellow, color: '#FBBF24' },
                      { count: c.red, color: '#EF4444' },
                      { count: c.purple, color: '#A855F7' },
                      { count: c.transport_needed || c.needs_transport_count, color: 'var(--plra-300)', icon: <Car size={10} /> }
                    ].map((stat, idx) => (
                      <div key={idx} style={{ 
                        background: `${stat.color}15`, 
                        border: `1px solid ${stat.color}30`, 
                        borderRadius: '10px', 
                        padding: '0.4rem 0.2rem', 
                        textAlign: 'center' 
                      }}>
                        {stat.icon ? stat.icon : <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stat.color, margin: '0 auto 0.25rem', boxShadow: `0 0 8px ${stat.color}50` }} />}
                        <div style={{ fontSize: '0.8rem', fontWeight: 900, color: stat.color }}>{stat.count || 0}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

      {/* ══════════════════════════════════════════════════════
        COORDINADOR DETAIL MODAL
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
      {showDetailModal && selectedCoordDetail && (
        <div className="modal-overlay-premium">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="modal-content-premium-styled"
            style={{ width: '95%', maxWidth: '500px', padding: '1.5rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white', margin: 0 }}>{selectedCoordDetail.nombre}</h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', margin: 0 }}>Capturas realizadas por el coordinador</p>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)}
                style={{ background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.5rem', color: 'var(--text)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
      
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {coordCaptures.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-3)', padding: '2rem' }}>No hay capturas registradas.</p>
              ) : coordCaptures.map(cap => (
                <div key={cap.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '14px', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white', margin: 0 }}>{cap.nombre} {cap.apellido}</h4>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', margin: 0 }}>CI: {Number(cap.elector_ci).toLocaleString('es-PY')}</p>
                    </div>
                    <div style={{ 
                      width: '10px', height: '10px', borderRadius: '50%', 
                      background: cap.traffic_light === 'GREEN' ? '#22C55E' : cap.traffic_light === 'YELLOW' ? '#FBBF24' : cap.traffic_light === 'RED' ? '#EF4444' : '#A855F7',
                      boxShadow: `0 0 8px ${cap.traffic_light === 'GREEN' ? '#22C55E' : cap.traffic_light === 'YELLOW' ? '#FBBF24' : cap.traffic_light === 'RED' ? '#EF4444' : '#A855F7'}`
                    }} />
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.6rem', color: 'var(--text-2)' }}>
                      <MapPin size={10} style={{ color: 'var(--plra-300)' }} />
                      {cap.local_votacion}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.6rem', color: 'var(--text-2)' }}>
                      <Inbox size={10} style={{ color: 'var(--plra-300)' }} />
                      Mesa {cap.mesa} • Orden {cap.orden}
                    </div>
                    {cap.needs_transport === 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.6rem', color: 'var(--plra-200)', fontWeight: 800 }}>
                        <Car size={10} />
                        LOGÍSTICA
                      </div>
                    )}
                  </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '0.5rem' }}>
                      {cap.telefono && (
                        <a 
                          href={`https://wa.me/${formatWhatsApp(cap.telefono)}`} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ flex: 1, background: '#25D366', color: 'white', padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                        >
                          <MessageSquare size={12} /> WHATSAPP
                        </a>
                      )}
                      <button 
                        onClick={() => handleEditHistory(cap)}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.4rem', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: cap.telefono ? 'none' : 1 }}
                      >
                        <Edit2 size={14} />
                        {!cap.telefono && <span style={{ marginLeft: '4px', fontSize: '0.65rem', fontWeight: 800 }}>EDITAR</span>}
                      </button>
                      <button 
                        onClick={() => handleDeleteCapture(cap.id)}
                        style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '0.4rem', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: cap.telefono ? 'none' : 1 }}
                      >
                        <Trash2 size={14} />
                        {!cap.telefono && <span style={{ marginLeft: '4px', fontSize: '0.65rem', fontWeight: 800 }}>ELIMINAR</span>}
                      </button>
                    </div>
                  </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
      
      {/* ══════════════════════════════════════════════════════
        SEMAPHORE MODAL
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
      {showModal && (
        <motion.div
          key="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '0 0 env(safe-area-inset-bottom)',
            background: 'var(--surface)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <motion.div
            key="modal-sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            style={{
              width: '100%',
              maxWidth: '480px',
              background: 'var(--surface)',
              borderTopLeftRadius: '2rem',
              borderTopRightRadius: '2rem',
              border: '1px solid var(--border-mid)',
              borderBottom: 'none',
              boxShadow: '0 -20px 60px rgba(0,0,0,0.7)',
              overflow: 'hidden',
            }}
          >
            {/* Handle bar */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0 0' }}>
              <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--border)' }} />
            </div>
      
            {/* Header */}
            <div style={{ padding: '1.25rem 3.5rem 1.5rem', textAlign: 'center', position: 'relative' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1.25rem',
                  width: '32px',
                  height: '32px',
                  borderRadius: '9px',
                  background: 'var(--surface-light)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
      
              <p style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-display)', marginBottom: '0.4rem' }}>
                {editingCapture ? 'Editar Registro' : 'Calificación de Intención'}
              </p>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.35rem', color: 'var(--text)', letterSpacing: '-0.01em' }}>
                {editingCapture ? 'Modificar Datos' : '¿Cuál es la intención de voto?'}
              </h3>
      
              {/* Elector mini badge */}
              {(elector || editingCapture) && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '0.75rem',
                  padding: '0.3rem 0.85rem',
                  background: 'rgba(0,71,171,0.15)',
                  border: '1px solid var(--border-mid)',
                  borderRadius: '999px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--plra-200)',
                  fontFamily: 'var(--font-display)',
                }}>
                  <User size={12} />
                  {(elector || editingCapture)?.nombre} {(elector || editingCapture)?.apellido}
                </div>
              )}
            </div>
      
            {/* Phone & WhatsApp Input */}
            <div style={{ padding: '0 1.5rem 1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <label style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--plra-300)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Celular (WhatsApp) <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const currentDigits = telefono.replace(/\D/g, '');
                      let base = currentDigits;
                      if (currentDigits.startsWith('595')) base = currentDigits.substring(3);
                      else if (currentDigits.startsWith('55')) base = currentDigits.substring(2);
                      if (base.startsWith('0')) base = base.substring(1);
                      
                      const newPrefix = telefono.startsWith('+55') ? '+595' : '+55';
                      setTelefono(base ? `${newPrefix} ${base}` : `${newPrefix} `);
                    }}
                    style={{
                      position: 'absolute',
                      left: '0.5rem',
                      background: 'var(--accent-subtle)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--plra-300)',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.4rem',
                      cursor: 'pointer',
                      zIndex: 10
                    }}
                    title="Haz clic para cambiar entre +595 (PY) y +55 (BR)"
                  >
                    {telefono.startsWith('+55') ? '+55 🇧🇷' : '+595 🇵🇾'}
                  </button>
                  <input 
                    type="text"
                    inputMode="tel"
                    placeholder="+595 9xx xxx xxx"
                    value={telefono}
                    onChange={(e) => handlePhoneChange(e.target.value, setTelefono)}
                    className="modern-input-premium-styled"
                    style={{ paddingLeft: '4.8rem', fontSize: '1rem', fontWeight: 700 }}
                  />
                </div>
                <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontStyle: 'italic' }}>Formato automático para envío de mensajes.</p>
              </div>
            </div>
      
            {/* Logistics Toggle */}
            <div style={{ padding: '0 1.5rem 1.5rem' }}>
              <div 
                onClick={() => setNeedsTransport(!needsTransport)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  background: needsTransport ? 'var(--accent-subtle)' : 'var(--surface-light)',
                  border: `1px solid ${needsTransport ? 'var(--plra-300)' : 'var(--border)'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Truck size={18} style={{ color: needsTransport ? 'var(--plra-300)' : 'var(--text-3)' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>Necesita Transporte</span>
                </div>
                <div style={{
                  width: '36px', height: '18px', borderRadius: '9px',
                  background: needsTransport ? 'var(--plra-300)' : 'rgba(255,255,255,0.1)',
                  position: 'relative'
                }}>
                  <motion.div 
                    animate={{ x: needsTransport ? 18 : 2 }}
                    style={{
                      position: 'absolute', top: 2, left: 0,
                      width: '14px', height: '14px', borderRadius: '7px',
                      background: 'white'
                    }}
                  />
                </div>
              </div>
            </div>
      
             {/* Semaphore buttons — color only */}
             <div style={{ display: 'flex', gap: '0.75rem', padding: '0 1.5rem 2rem' }}>
               {[
                 { color: 'GREEN',  bg: 'linear-gradient(160deg, #22C55E 0%, #15803D 100%)', glow: 'rgba(34,197,94,0.5)',  border: 'rgba(34,197,94,0.35)', count: colorCounts.green, label: 'CASA' },
                 { color: 'YELLOW', bg: 'linear-gradient(160deg, #FBBF24 0%, #D97706 100%)', glow: 'rgba(251,191,36,0.5)', border: 'rgba(251,191,36,0.35)', count: colorCounts.yellow, label: 'FAMILIARES' },
                 { color: 'RED',    bg: 'linear-gradient(160deg, #EF4444 0%, #B91C1C 100%)', glow: 'rgba(239,68,68,0.5)',  border: 'rgba(239,68,68,0.35)', count: colorCounts.red, label: 'OTROS' },
                 { color: 'PURPLE', bg: 'linear-gradient(160deg, #A855F7 0%, #7E22CE 100%)', glow: 'rgba(168,85,247,0.5)', border: 'rgba(168,85,247,0.35)', count: colorCounts.purple, label: 'VOLUNTARIO' },
               ].map(({ color, bg, glow, border, count, label }) => (
                  <motion.button
                    key={color}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => editingCapture ? handleUpdateCapture(color) : handleCapture(color as any)}
                    disabled={isLoading}
                    style={{
                      flex: 1,
                      height: '5.5rem',
                      background: bg,
                      border: `1px solid ${border}`,
                      borderRadius: '1rem',
                      cursor: 'pointer',
                      boxShadow: `0 8px 28px ${glow}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'box-shadow 0.2s',
                      position: 'relative',
                    }}
                  >
                    {isLoading ? <Spinner size={22} /> : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                        {color === 'GREEN' ? <ThumbsUp size={24} /> : color === 'YELLOW' ? <Users size={24} /> : color === 'RED' ? <HelpCircle size={24} /> : <AlertCircle size={24} />}
                        <span style={{ fontSize: '0.5rem', fontWeight: 900 }}>{label}</span>
                      </div>
                    )}
                    {!isLoading && (
                      <span style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: '0.5rem',
                        background: 'rgba(0,0,0,0.3)',
                        color: 'white',
                        borderRadius: '999px',
                        fontSize: '0.6rem',
                        fontWeight: 900,
                        padding: '0.15rem 0.4rem',
                        minWidth: '1rem',
                        textAlign: 'center',
                      }}>{count}</span>
                    )}
                 </motion.button>
               ))}
             </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
      
      {/* ══════════════════════════════════════════════════════
        UNREGISTERED ELECTOR CAPTURE WIZARD MODAL
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
      {showUnregisteredModal && (
        <motion.div
          key="unreg-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '0 0 env(safe-area-inset-bottom)',
            background: 'var(--surface)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <motion.div
            key="unreg-modal-sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            style={{
              width: '100%',
              maxWidth: '480px',
              background: 'var(--surface)',
              borderTopLeftRadius: '2rem',
              borderTopRightRadius: '2rem',
              border: '1px solid var(--border-mid)',
              borderBottom: 'none',
              boxShadow: '0 -20px 60px rgba(0,0,0,0.7)',
              overflow: 'hidden',
              paddingBottom: '2.5rem'
            }}
          >
            {/* Handle bar */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0 0.5rem' }}>
              <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--border)' }} />
            </div>
      
            {/* Close Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 1.5rem' }}>
              <button
                onClick={() => {
                  setShowUnregisteredModal(false);
                  setIsConfirmed(false);
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>
      
            {!isConfirmed ? (
              /* PHASE 1: CI VERIFICATION QUESTION */
              <div style={{ padding: '0 1.5rem 1.5rem', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <div style={{
                    background: 'rgba(245,158,11,0.1)',
                    color: '#F59E0B',
                    padding: '16px',
                    borderRadius: '50%',
                    boxShadow: '0 0 20px rgba(245,158,11,0.15)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <HelpCircle size={40} className="animate-pulse" />
                  </div>
                </div>
      
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 0.5rem', textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}>
                  Cédula no encontrada
                </h3>
                
                <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', lineHeight: '1.4', margin: '0 0 1.5rem' }}>
                  El documento <strong style={{ color: 'var(--text)', fontSize: '1rem' }}>{customElectorCI}</strong> no figura en el padrón electoral oficial.
                </p>
      
                <div style={{
                  background: 'rgba(0,0,0,0.15)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '1.2rem',
                  marginBottom: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  textAlign: 'left'
                }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pregunta de seguridad:</span>
                  <span style={{ fontSize: '0.92rem', color: 'var(--text)', fontWeight: 700, lineHeight: '1.3' }}>
                    ¿Confirmas que la cédula ha sido ingresada de manera correcta y sin errores tipográficos?
                  </span>
                </div>
      
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => {
                      setShowUnregisteredModal(false);
                      setIsConfirmed(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '1rem',
                      borderRadius: '14px',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text-2)',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    No, corregir CI
                  </button>
                  
                  <button
                    onClick={() => setIsConfirmed(true)}
                    style={{
                      flex: 1,
                      padding: '1rem',
                      borderRadius: '14px',
                      border: 'none',
                      background: 'var(--plra-500)',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(0, 71, 171, 0.35)',
                      transition: 'all 0.2s'
                    }}
                  >
                    Sí, es correcta
                  </button>
                </div>
              </div>
            ) : (
              /* PHASE 2: NAME INPUT & PILLS SELECTION */
              <div style={{ padding: '0 1.5rem 1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 0.5rem', textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}>
                  Registro Rápido de Campo
                </h3>
                <p style={{ color: 'var(--text-3)', fontSize: '0.75rem', margin: '0 0 1.25rem' }}>
                  Registraremos los datos de este elector y quedará asociado a tu campaña.
                </p>
      
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  {/* Full Name Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nombre y Apellido Completo</label>
                    <input
                      type="text"
                      placeholder="ej. Juan Pérez"
                      value={customElectorName}
                      onChange={(e) => setCustomElectorName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.85rem 1rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border-mid)',
                        background: 'rgba(255,255,255,0.03)',
                        color: '#FFFFFF',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}
                    />
                  </div>
      
                  {/* Telefono Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Número de Teléfono</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const currentDigits = customElectorTelefono.replace(/\D/g, '');
                          let base = currentDigits;
                          if (currentDigits.startsWith('595')) base = currentDigits.substring(3);
                          else if (currentDigits.startsWith('55')) base = currentDigits.substring(2);
                          if (base.startsWith('0')) base = base.substring(1);
                          
                          const newPrefix = customElectorTelefono.startsWith('+55') ? '+595' : '+55';
                          setCustomElectorTelefono(base ? `${newPrefix} ${base}` : `${newPrefix} `);
                        }}
                        style={{
                          position: 'absolute',
                          left: '0.5rem',
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid var(--border-mid)',
                          borderRadius: '6px',
                          color: 'rgba(255,255,255,0.7)',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.4rem',
                          cursor: 'pointer',
                          zIndex: 10
                        }}
                        title="Haz clic para cambiar entre +595 (PY) y +55 (BR)"
                      >
                        {customElectorTelefono.startsWith('+55') ? '+55 🇧🇷' : '+595 🇵🇾'}
                      </button>
                      <input
                        type="tel"
                        placeholder="+595 981 123456"
                        value={customElectorTelefono}
                        onChange={(e) => handlePhoneChange(e.target.value, setCustomElectorTelefono)}
                        style={{
                          width: '100%',
                          padding: '0.85rem 1rem 0.85rem 4.5rem',
                          borderRadius: '12px',
                          border: '1px solid var(--border-mid)',
                          background: 'rgba(255,255,255,0.03)',
                          color: '#FFFFFF',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                        }}
                      />
                    </div>
                  </div>
      
                  {/* CI Photo capture front and back */}
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                    {/* Photo CI Frente */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                      <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Foto C.I. Frente</label>
                      <div style={{ position: 'relative', width: '100%', height: '80px', borderRadius: '12px', border: '1px dashed var(--border-mid)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {isUploadingFrente ? (
                          <Spinner size={16} />
                        ) : photoFrente ? (
                          <>
                            <img src={photoFrente} alt="Frente C.I." style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button 
                              onClick={() => setPhotoFrente(null)}
                              style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              <X size={8} />
                            </button>
                          </>
                        ) : (
                          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-3)' }}>
                            <Camera size={18} style={{ color: 'var(--plra-300)' }} />
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tomar Frente</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              capture="environment" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadCustomElectorPhoto(file, 'FRENTE');
                              }} 
                              style={{ display: 'none' }} 
                            />
                          </label>
                        )}
                      </div>
                    </div>
      
                    {/* Photo CI Verso */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                      <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Foto C.I. Verso</label>
                      <div style={{ position: 'relative', width: '100%', height: '80px', borderRadius: '12px', border: '1px dashed var(--border-mid)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {isUploadingVerso ? (
                          <Spinner size={16} />
                        ) : photoVerso ? (
                          <>
                            <img src={photoVerso} alt="Verso C.I." style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button 
                              onClick={() => setPhotoVerso(null)}
                              style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              <X size={8} />
                            </button>
                          </>
                        ) : (
                          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-3)' }}>
                            <Camera size={18} style={{ color: 'var(--plra-300)' }} />
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tomar Verso</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              capture="environment" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadCustomElectorPhoto(file, 'VERSO');
                              }} 
                              style={{ display: 'none' }} 
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
      
                  {/* Action Pills */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.25rem' }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Acción de Campaña (Selecciona una)</label>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {[
                        { key: 'TRASLADO', label: 'AFILIADO: necesita traslado o actualización', colorColor: 'var(--red)', borderClr: 'rgba(239,68,68,0.3)', bgClr: 'rgba(239,68,68,0.08)', activeBg: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.4) 100%)', activeBorder: '#EF4444' },
                        { key: 'AFILIARSE', label: 'NO AFILIADO: necesita afiliarse', colorColor: 'var(--yellow)', borderClr: 'rgba(245,158,11,0.3)', bgClr: 'rgba(245,158,11,0.08)', activeBg: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.4) 100%)', activeBorder: '#FBBF24' },
                        { key: 'GENERALES', label: 'NO AFILIADO: Apoya en las generales', colorColor: 'var(--green)', borderClr: 'rgba(34,197,94,0.3)', bgClr: 'rgba(34,197,94,0.08)', activeBg: 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(34,197,94,0.4) 100%)', activeBorder: '#22C55E' },
                      ].map((pill) => {
                        const isActive = customActionPill === pill.key;
                        return (
                          <button
                            key={pill.key}
                            onClick={() => setCustomActionPill(pill.key as any)}
                            style={{
                              width: '100%',
                              padding: '0.85rem 1rem',
                              borderRadius: '12px',
                              background: isActive ? pill.activeBg : pill.bgClr,
                              border: `1px solid ${isActive ? pill.activeBorder : pill.borderClr}`,
                              color: pill.colorColor,
                              fontWeight: 800,
                              fontSize: '0.78rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.6rem',
                              transition: 'all 0.2s',
                              boxShadow: isActive ? `0 0 15px ${pill.borderClr}` : 'none'
                            }}
                          >
                            <div style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              border: `2px solid ${pill.colorColor}`,
                              background: isActive ? pill.colorColor : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }} />
                            <span>{pill.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
      
                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red)', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '1.25rem' }}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}
      
                <button
                  onClick={handleSaveCustomElector}
                  disabled={isLoading || !customElectorName.trim() || !customElectorTelefono || !customActionPill}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'var(--plra-500)',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(0, 71, 171, 0.35)',
                    opacity: (isLoading || !customElectorName.trim() || !customElectorTelefono || !customActionPill) ? 0.55 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s'
                  }}
                >
                  {isLoading ? <Spinner size={18} /> : (
                    <>
                      <UserPlus size={16} /> Registrar y Captar Elector
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
      
      {/* ══════════════════════════════════════════════════════
        COORDINATOR CREATION MODAL (PADRINO)
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
      {showCoordModal && (
        <motion.div
          key="coord-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-overlay-premium"
        >
          <motion.div
            key="coord-modal-content"
            initial={{ scale: 0.9, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 50, opacity: 0 }}
            className="modal-content-premium-styled custom-scrollbar"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: 0,
              overflow: 'hidden'
            }}
          >
            <form onSubmit={handleCreateCoord}>
              <div style={{ 
                padding: '1.5rem 1.75rem', 
                borderBottom: '1px solid var(--border)', 
                background: 'linear-gradient(to bottom, rgba(0,71,171,0.15), transparent)',
                position: 'sticky',
                top: 0,
                zIndex: 2,
                backdropFilter: 'blur(10px)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-display)', color: 'var(--text)' }}>Registrar Miembro</h3>
                  <p style={{ fontSize: '0.65rem', color: 'var(--plra-300)', margin: '0.2rem 0 0', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Gestión de Equipo Directo</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowCoordModal(false)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.5rem', color: 'var(--text)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>
      
              {/* Photo Source Selector Overlay */}
              <AnimatePresence>
                {showPhotoSource === 'COORD' && (
                  <motion.div 
                    key="photo-source-coord"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    style={{ 
                      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
                      background: 'var(--surface)', backdropFilter: 'blur(20px)',
                      padding: '1.5rem', borderTop: '1px solid var(--border)',
                      borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                      boxShadow: '0 -10px 40px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--plra-300)' }}>ORIGEN DE LA FOTO</span>
                      <X size={18} onClick={() => setShowPhotoSource('NONE')} style={{ color: 'var(--text-3)', cursor: 'pointer' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                      {[
                        { id: 'env', icon: <Camera size={24} />, label: 'TRASERA', ref: fileInputRef },
                        { id: 'user', icon: <User size={24} />, label: 'SELFIE', ref: frontCameraInputRef },
                        { id: 'gal', icon: <LayoutList size={24} />, label: 'GALERÍA', ref: galleryInputRef }
                      ].map(opt => (
                        <button 
                          key={opt.id}
                          type="button" 
                          onClick={() => { opt.ref.current?.click(); setShowPhotoSource('NONE'); }} 
                          style={{ 
                            background: 'var(--surface-light)', 
                            border: '1px solid var(--border)', 
                            borderRadius: '16px', 
                            padding: '1rem', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            color: 'var(--text)' 
                          }}
                        >
                          {opt.icon}
                          <span style={{ fontSize: '0.6rem', fontWeight: 700 }}>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
      
              <div style={{ padding: '1.75rem' }}>
                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '0.85rem', borderRadius: '14px', color: 'var(--red)', fontSize: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <AlertCircle size={18} /> {error}
                  </div>
                )}
      
                <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem', alignItems: 'flex-start' }}>
                  <div 
                    onClick={() => setShowPhotoSource('COORD')}
                    style={{ 
                      width: '80px', height: '80px', borderRadius: '18px', 
                      background: 'var(--surface-light)', border: '2px dashed var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', overflow: 'hidden', flexShrink: 0,
                      position: 'relative'
                    }}
                  >
                    {newCoordPhoto ? (
                      <img src={newCoordPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <Camera size={24} style={{ color: 'var(--text-3)' }} />
                        <span style={{ display: 'block', fontSize: '0.5rem', color: 'var(--text-3)', marginTop: '0.2rem', fontWeight: 900 }}>FOTO</span>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--plra-300)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Cédula de Identidad</label>
                    <div className="search-input-wrapper-premium" style={{ height: '44px' }}>
                      <input 
                        className="modern-input-premium-styled" 
                        style={{ height: '44px', flex: 1 }}
                        placeholder="Número CI"
                        value={newCoordCI}
                        onChange={e => { setNewCoordCI(e.target.value); setIsCoordVerified(false); }}
                      />
                      <button type="button" onClick={handleLookupCoordCI} className="search-btn-action" style={{ height: '44px' }}>VERIFICAR</button>
                    </div>
                  </div>
                </div>
      
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--plra-300)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Nombre del Miembro (Padrón)</label>
                    <input className="modern-input-premium-styled" style={{ height: '44px', background: 'rgba(255,255,255,0.03)', fontSize: '0.9rem' }} value={newCoordRealName} readOnly placeholder="Se cargará al verificar" />
                  </div>
      
                  <div className="form-group">
                    <label style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--plra-300)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>WhatsApp Directo</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const currentDigits = newCoordTelefono.replace(/\D/g, '');
                          let base = currentDigits;
                          if (currentDigits.startsWith('595')) base = currentDigits.substring(3);
                          else if (currentDigits.startsWith('55')) base = currentDigits.substring(2);
                          if (base.startsWith('0')) base = base.substring(1);
                          
                          const newPrefix = newCoordTelefono.startsWith('+55') ? '+595' : '+55';
                          setNewCoordTelefono(base ? `${newPrefix} ${base}` : `${newPrefix} `);
                        }}
                        style={{
                          position: 'absolute',
                          left: '0.5rem',
                          background: 'var(--accent-subtle)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          color: 'var(--plra-300)',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.4rem',
                          cursor: 'pointer',
                          zIndex: 10
                        }}
                        title="Haz clic para cambiar entre +595 (PY) y +55 (BR)"
                      >
                        {newCoordTelefono.startsWith('+55') ? '+55 🇧🇷' : '+595 🇵🇾'}
                      </button>
                      <input 
                        className="modern-input-premium-styled" 
                        style={{ height: '44px', fontSize: '0.9rem', paddingLeft: '4.8rem' }} 
                        placeholder="+595 9xx xxx xxx"
                        value={newCoordTelefono}
                        onChange={e => handlePhoneChange(e.target.value, setNewCoordTelefono)}
                      />
                    </div>
                  </div>
                </div>
              </div>
      
              <div style={{ padding: '1.75rem', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.3)', display: 'flex', gap: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowCoordModal(false)}
                  style={{ flex: 1, height: '3.75rem', borderRadius: '16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', fontWeight: 800, cursor: 'pointer' }}
                >
                  CANCELAR
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading || !isCoordVerified}
                  className="btn btn-primary" 
                  style={{ flex: 2, height: '3.75rem', borderRadius: '16px', fontWeight: 900, fontSize: '0.85rem' }}
                >
                  {isLoading ? <Spinner /> : 'GUARDAR MIEMBRO'}
                </button>
              </div>
      
                {/* Invisible Inputs for Coordinator */}
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" capture="environment" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => setCropperData({ image: event.target?.result as string });
                      reader.readAsDataURL(file);
                    }
                  }} 
                />
                <input type="file" ref={frontCameraInputRef} style={{ display: 'none' }} accept="image/*" capture="user" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => setCropperData({ image: event.target?.result as string });
                      reader.readAsDataURL(file);
                    }
                  }} 
                />
                <input type="file" ref={galleryInputRef} style={{ display: 'none' }} accept="image/*" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => setCropperData({ image: event.target?.result as string });
                      reader.readAsDataURL(file);
                    }
                  }} 
                />
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
      {/* ══════════════════════════════════════════════════════
        PADRINO CREATION MODAL (JEFE DE CAMPANA)
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
      {showPadrinoModal && (
        <motion.div
          key="padrino-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-overlay-premium"
        >
          <motion.div
            key="padrino-modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="modal-content-premium-styled"
            style={{ maxWidth: '500px', width: '100%', padding: 0 }}
          >
            <form onSubmit={handleCreatePadrino}>
              <div style={{ padding: '1.75rem', borderBottom: '1px solid var(--border)', background: 'linear-gradient(to bottom, rgba(0,71,171,0.05), transparent)' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)' }}>Registrar Nuevo Padrino</h3>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '0.25rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>ADMINISTRADOR DE EQUIPO BAJO TU CARGO</p>
              </div>
      
              {/* Photo Source Selector Overlay (Padrino) */}
              <AnimatePresence>
                {showPhotoSource === 'PADRINO' && (
                  <motion.div 
                    key="photo-source-padrino"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    style={{ 
                      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
                      background: 'var(--surface)', backdropFilter: 'blur(20px)',
                      padding: '1.5rem', borderTop: '1px solid var(--border)',
                      borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                      boxShadow: '0 -10px 40px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--plra-300)' }}>ORIGEN DE LA FOTO</span>
                      <X size={18} onClick={() => setShowPhotoSource('NONE')} style={{ color: 'var(--text-3)', cursor: 'pointer' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                      {[
                        { id: 'env', icon: <Camera size={24} />, label: 'TRASERA', ref: padrinoFileInputRef },
                        { id: 'user', icon: <User size={24} />, label: 'SELFIE', ref: padrinoFrontCameraInputRef },
                        { id: 'gal', icon: <LayoutList size={24} />, label: 'GALERÍA', ref: padrinoGalleryInputRef }
                      ].map(opt => (
                        <button 
                          key={opt.id}
                          type="button" 
                          onClick={() => { opt.ref.current?.click(); setShowPhotoSource('NONE'); }} 
                          style={{ 
                            background: 'var(--surface-light)', 
                            border: '1px solid var(--border)', 
                            borderRadius: '16px', 
                            padding: '1rem', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            color: 'var(--text)' 
                          }}
                        >
                          {opt.icon}
                          <span style={{ fontSize: '0.6rem', fontWeight: 700 }}>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
      
              <div style={{ padding: '2rem' }}>
                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '0.85rem', borderRadius: '14px', color: 'var(--red)', fontSize: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <AlertCircle size={18} /> {error}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div 
                    onClick={() => setShowPhotoSource('PADRINO')}
                    style={{ 
                      width: '100px', height: '100px', borderRadius: '15px', 
                      background: 'var(--surface-light)', border: '2px dashed var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', overflow: 'hidden', position: 'relative'
                    }}
                  >
                    {newPadrinoPhoto ? (
                      <img src={newPadrinoPhoto} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Camera size={32} style={{ color: 'var(--text-3)' }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--plra-300)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Cédula del Padrino</label>
                    <div className="search-input-wrapper-premium">
                      <input 
                        className="modern-input-premium-styled" 
                        value={newPadrinoCI}
                        onChange={e => { setNewPadrinoCI(e.target.value); setIsPadrinoVerified(false); }}
                        placeholder="Buscar CI..."
                      />
                      <button type="button" onClick={handleLookupPadrinoCI} className="search-btn-action">BUSCAR</button>
                    </div>
                  </div>
                </div>
      
                {isPadrinoVerified && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="form-group">
                    <label style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--plra-300)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Nombre Completo</label>
                    <input className="modern-input-premium-styled" value={newPadrinoRealName} readOnly style={{ opacity: 0.8 }} />
                  </motion.div>
                )}
      
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--plra-300)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Teléfono de WhatsApp (Obligatorio)</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const currentDigits = newPadrinoTelefono.replace(/\D/g, '');
                        let base = currentDigits;
                        if (currentDigits.startsWith('595')) base = currentDigits.substring(3);
                        else if (currentDigits.startsWith('55')) base = currentDigits.substring(2);
                        if (base.startsWith('0')) base = base.substring(1);
                        
                        const newPrefix = newPadrinoTelefono.startsWith('+55') ? '+595' : '+55';
                        setNewPadrinoTelefono(base ? `${newPrefix} ${base}` : `${newPrefix} `);
                      }}
                      style={{
                        position: 'absolute',
                        left: '0.5rem',
                        background: 'var(--accent-subtle)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        color: 'var(--plra-300)',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '0.2rem 0.4rem',
                        cursor: 'pointer',
                        zIndex: 10
                      }}
                      title="Haz clic para cambiar entre +595 (PY) y +55 (BR)"
                    >
                      {newPadrinoTelefono.startsWith('+55') ? '+55 🇧🇷' : '+595 🇵🇾'}
                    </button>
                    <input 
                      className="modern-input-premium-styled" 
                      placeholder="+595 9xx xxx xxx"
                      value={newPadrinoTelefono} 
                      onChange={e => handlePhoneChange(e.target.value, setNewPadrinoTelefono)} 
                      style={{ paddingLeft: '4.8rem' }}
                      required
                    />
                  </div>
                </div>
      
                {/* Invisible Inputs for Padrino */}
                <input type="file" ref={padrinoFileInputRef} style={{ display: 'none' }} accept="image/*" capture="environment" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => setCropperData({ image: event.target?.result as string });
                      reader.readAsDataURL(file);
                    }
                  }} 
                />
                <input type="file" ref={padrinoFrontCameraInputRef} style={{ display: 'none' }} accept="image/*" capture="user" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => setCropperData({ image: event.target?.result as string });
                      reader.readAsDataURL(file);
                    }
                  }} 
                />
                <input type="file" ref={padrinoGalleryInputRef} style={{ display: 'none' }} accept="image/*" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => setCropperData({ image: event.target?.result as string });
                      reader.readAsDataURL(file);
                    }
                  }} 
                />
              </div>
      
              <div className="modal-footer-premium-styled" style={{ padding: '1.25rem 2rem' }}>
                <button type="button" onClick={() => setShowPadrinoModal(false)} className="btn-cancel-styled">Cancelar</button>
                <button type="submit" className="btn-confirm-styled" disabled={!isPadrinoVerified || !newPadrinoPhoto || !newPadrinoTelefono || isLoading}>
                  {isLoading ? <Spinner size={16} /> : 'Crear Padrino'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
};

export default TabCoordinators;
