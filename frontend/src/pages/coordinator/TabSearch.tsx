import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '../../components/Skeleton';
import {
  Search, MapPin, User, Map, Building2, Home,
  ClipboardCheck, ArrowRight, AlertCircle, AlertTriangle,
  CheckCheck, ThumbsUp, HelpCircle, X, Shield, Share2, History, Edit2, Trash2, MessageSquare, Fingerprint, Landmark,
  UserPlus, Camera, LayoutList, Users, Mic, Square, ChevronRight,
  Car, Inbox, Truck, Download, Activity, Phone, Calendar
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

const TabSearch = (props: any) => {
  const {
    // Auth + settings
    user, loading, settings, activeDistrict, isReadOnly,
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
    handleSearch, handleConfirm, handleShare,

  } = props;

  return (
    <>
      
      <div style={{
        background: 'rgba(59, 130, 246, 0.05)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '16px',
        padding: '1rem',
        marginBottom: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={16} style={{ color: 'var(--plra-300)' }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase' }}>Padrón Offline</span>
          </div>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: offlineCount > 0 ? 'var(--green)' : 'var(--text-3)' }}>
            {offlineCount > 0 ? `${offlineCount.toLocaleString()} Registros` : 'Sin datos locales'}
          </span>
        </div>
        
        {isDownloading ? (
          <div style={{ width: '100%' }}>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${downloadProgress}%`, height: '100%', background: 'var(--plra-300)', transition: 'width 0.3s ease' }} />
            </div>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginTop: '0.4rem', textAlign: 'center' }}>Descargando base de datos... {downloadProgress}%</p>
          </div>
        ) : (
          <button 
            onClick={handleDownloadPadron}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '8px',
              background: 'var(--plra-500)',
              color: 'white',
              border: 'none',
              fontSize: '0.65rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <Activity size={14} /> {offlineCount > 0 ? 'ACTUALIZAR PADRÓN LOCAL' : 'DESCARGAR PADRÓN PARA USO OFFLINE'}
          </button>
        )}
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 160 }}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '1.25rem',
          padding: 'clamp(1rem, 3vw, 1.75rem)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <div style={{ width: '3px', height: '16px', borderRadius: '2px', background: 'var(--plra-300)', boxShadow: '0 0 8px var(--plra-300)' }} />
          <span style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-display)' }}>
            Consulta de Padrón Electoral
          </span>
        </div>
      
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              inputMode="numeric"
              className="input-plra"
              style={{
                width: '100%',
                height: '3.5rem',
                fontSize: '1.5rem',
                letterSpacing: '0.12em',
                paddingLeft: '1.25rem',
                paddingRight: '3rem',
              }}
              placeholder="0.000.000"
              value={ci}
              onChange={(e) => setCi(e.target.value.replace(/\D/g, ''))}
              autoComplete="off"
            />
            <Search
              size={16}
              style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: ci ? 'var(--plra-300)' : 'var(--text-3)',
                transition: 'color 0.2s',
                pointerEvents: 'none',
              }}
            />
          </div>
      
          <button
            type="submit"
            className="btn btn-icon"
            disabled={isLoading || !ci}
            style={{ width: '3.5rem', height: '3.5rem', borderRadius: '12px' }}
          >
            {isLoading ? <Spinner size={20} /> : <ArrowRight size={22} strokeWidth={2.5} />}
          </button>
        </form>
      
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: '1rem' }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                color: '#FCA5A5',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      <AnimatePresence mode="wait">
        {elector && !successMsg && (
          <motion.article
            key={elector.ci}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, filter: 'blur(8px)' }}
            transition={{ type: 'spring', damping: 24, stiffness: 180 }}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '1.5rem',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
            }}
          >
            <div className="card-header-section" style={{
              background: 'linear-gradient(135deg, var(--plra-700) 0%, var(--plra-900) 100%)',
              borderBottom: '1px solid var(--border-hi)',
              position: 'relative',
              overflow: 'hidden',
              padding: '2.5rem 1.5rem 2rem',
            }}>
              <div style={{
                position: 'absolute', right: '-1.5rem', bottom: '-2rem',
                fontSize: '6rem', fontWeight: 900, color: 'rgba(59,130,246,0.05)',
                fontFamily: 'var(--font-display)', letterSpacing: '-0.05em',
                userSelect: 'none', pointerEvents: 'none', lineHeight: 1,
              }}>PLRA</div>
      
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', position: 'relative', zIndex: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{
                    width: '68px', height: '68px', borderRadius: '20px', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--plra-500) 0%, var(--plra-400) 100%)',
                    border: '2.5px solid rgba(255,255,255,0.25)',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.8rem', fontWeight: 800, color: 'white',
                    fontFamily: 'var(--font-display)',
                  }}>
                    {elector.nombre?.charAt(0) ?? <User size={32} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      {elector.inhabilitado === 1 ? (
                        <div className="badge" style={{ 
                          background: 'rgba(239,68,68,0.25)', 
                          color: '#F87171', 
                          border: '1px solid rgba(239,68,68,0.4)',
                          padding: '0.25rem 0.75rem',
                          fontSize: '0.62rem',
                          fontWeight: 900
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444' }} />
                          INHABILITADO PARA VOTAR
                        </div>
                      ) : (
                        <div className="badge" style={{ 
                          background: 'rgba(34,197,94,0.25)', 
                          color: '#4ADE80', 
                          border: '1px solid rgba(34,197,94,0.4)',
                          padding: '0.25rem 0.75rem',
                          fontSize: '0.62rem',
                          fontWeight: 900
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ADE80', animation: 'pulse-dot 2s infinite' }} />
                          ACTIVO / HABILITADO
                        </div>
                      )}
                    </div>
                    <h2 style={{
                      fontFamily: 'var(--font-display)', fontWeight: 800,
                      fontSize: '1.35rem',
                      color: 'white', lineHeight: 1.1,
                      textTransform: 'uppercase', letterSpacing: '-0.02em',
                      textShadow: '0 2px 10px rgba(0,0,0,0.3)'
                    }}>
                      {elector.nombre} {elector.apellido}
                    </h2>
                  </div>
                </div>
      
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {elector.telefono && (
                    <a 
                      href={`https://wa.me/${formatWhatsApp(elector.telefono)}`} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ 
                        width: '3.5rem', height: '3.5rem', 
                        borderRadius: '16px', 
                        background: '#25D366', 
                        color: 'white', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        boxShadow: '0 8px 24px rgba(37,211,102,0.3)',
                        textDecoration: 'none' 
                      }}
                    >
                      <MessageSquare size={22} />
                    </a>
                  )}
                  <button
                    onClick={handleShare}
                    style={{
                      width: '3.5rem', height: '3.5rem',
                      borderRadius: '16px',
                      background: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      flexShrink: 0
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                  >
                    <Share2 size={22} />
                  </button>
                </div>
              </div>
      
              <div style={{ position: 'relative', zIndex: 5 }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.5rem 1rem',
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
                }}>
                  <Fingerprint size={16} style={{ color: 'var(--plra-200)' }} />
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: 'white', letterSpacing: '0.08em' }}>
                    C.I. {Number(elector.ci).toLocaleString('es-PY')}
                  </span>
                </div>
              </div>
            </div>
      
            <div className="card-section" style={{ background: 'var(--surface)' }}>
              <SectionLabel icon={<Map size={13} />} text="Local de Votación" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <DataItem icon={<Building2 size={18} />} iconColor="blue" label="Establecimiento" value={elector.local_votacion} />
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <NumberBadge label="Mesa No." value={elector.mesa} />
                  <NumberBadge label="Orden No." value={elector.orden} />
                </div>
              </div>
            </div>
      
            <div className="card-section" style={{ background: 'var(--surface-light)', borderBottom: 'none' }}>
              <SectionLabel icon={<MapPin size={13} />} text="Ubicación Territorial" color="var(--green)" />
              <div className="territory-grid">
                <DataItem 
                  icon={<Home size={18} />} 
                  iconColor="green" 
                  label="Dirección / Residencia" 
                  value={elector.direccion || elector.barrio || elector.residencia || 'Dirección no registrada'} 
                />
                <DataItem 
                  icon={<Landmark size={18} />} 
                  iconColor="teal" 
                  label="Comité / Distrito" 
                  value={elector.distrito || elector.ciudad || elector.departamento || 'Datos no disponibles'} 
                />
              </div>
            </div>

            {/* Datos Adicionales Demografía e Inclusividad */}
            {(elector.sexo || elector.edad || elector.tiene_discapacidad === 'S' || elector.es_indigena === 'S') && (
              <div className="card-section" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                <SectionLabel icon={<Activity size={13} />} text="Demografía e Inclusión" color="var(--blue)" />
                <div className="territory-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                  {elector.sexo && (
                    <DataItem 
                      icon={<User size={18} />} 
                      iconColor="blue" 
                      label="Género" 
                      value={elector.sexo === 'M' ? 'MASCULINO' : elector.sexo === 'F' ? 'FEMENINO' : elector.sexo} 
                    />
                  )}
                  {elector.edad && (
                    <DataItem 
                      icon={<Activity size={18} />} 
                      iconColor="teal" 
                      label="Edad" 
                      value={`${elector.edad} años (${elector.fecha_nacimiento ? elector.fecha_nacimiento.split('-').reverse().join('/') : ''})`} 
                    />
                  )}
                  {elector.tiene_discapacidad === 'S' && (
                    <DataItem 
                      icon={<Shield size={18} />} 
                      iconColor="amber" 
                      label="Accesibilidad / Discapacidad" 
                      value={elector.detalles_discapacidad || 'REQUIERE ASISTENCIA'} 
                    />
                  )}
                  {elector.es_indigena === 'S' && (
                    <DataItem 
                      icon={<Landmark size={18} />} 
                      iconColor="green" 
                      label="Comunidad Indígena" 
                      value="SÍ (PADRÓN ESPECIAL)" 
                    />
                  )}
                </div>
              </div>
            )}
      
            {elector.traffic_light && (
              <div className="card-section" style={{ background: 'var(--surface-light)', borderTop: '1px solid var(--border)' }}>
                <SectionLabel icon={<AlertCircle size={13} />} text="Detalle de Captación" color="var(--yellow)" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  
                  {/* Coordinator Information Card */}
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: '14px',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--plra-300)', letterSpacing: '0.1em' }}>
                        👤 Coordinador Captador
                      </span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                        ID #{elector.coordinator_id || elector.captured_by || '—'}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--plra-300)', flexShrink: 0 }}>
                        <User size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'white', textTransform: 'uppercase' }}>
                          {elector.coordinator_name || `Coordinador (ID: ${elector.captured_by})`}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          {elector.coordinator_ci && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 600 }}>
                              CI: {Number(elector.coordinator_ci).toLocaleString('es-PY')}
                            </span>
                          )}
                          {elector.coordinator_telefono && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-2)', fontWeight: 700 }}>
                              • Tel: {elector.coordinator_telefono}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {elector.coordinator_telefono && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                        <a
                          href={`https://wa.me/${formatWhatsApp(elector.coordinator_telefono)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            flex: 1,
                            padding: '0.45rem',
                            borderRadius: '8px',
                            background: 'rgba(34, 197, 94, 0.12)',
                            border: '1px solid rgba(34, 197, 94, 0.25)',
                            color: '#4ADE80',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            textDecoration: 'none'
                          }}
                        >
                          <MessageSquare size={13} /> WhatsApp
                        </a>
                        <a
                          href={`tel:${elector.coordinator_telefono}`}
                          style={{
                            flex: 1,
                            padding: '0.45rem',
                            borderRadius: '8px',
                            background: 'rgba(59, 130, 246, 0.12)',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            color: '#60A5FA',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            textDecoration: 'none'
                          }}
                        >
                          <Phone size={13} /> Llamar
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Padrino Information Card */}
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid rgba(168, 85, 247, 0.2)',
                    borderRadius: '14px',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: '#C084FC', letterSpacing: '0.1em' }}>
                        👑 Padrino Responsable
                      </span>
                      {elector.padrino_id && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'rgba(168, 85, 247, 0.15)', color: '#C084FC', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                          ID #{elector.padrino_id}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C084FC', flexShrink: 0 }}>
                        <Users size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'white', textTransform: 'uppercase' }}>
                          {elector.padrino_name || 'Sin Padrino Asignado'}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          {elector.padrino_ci && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 600 }}>
                              CI: {Number(elector.padrino_ci).toLocaleString('es-PY')}
                            </span>
                          )}
                          {elector.padrino_telefono && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-2)', fontWeight: 700 }}>
                              • Tel: {elector.padrino_telefono}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {elector.padrino_telefono && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                        <a
                          href={`https://wa.me/${formatWhatsApp(elector.padrino_telefono)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            flex: 1,
                            padding: '0.45rem',
                            borderRadius: '8px',
                            background: 'rgba(34, 197, 94, 0.12)',
                            border: '1px solid rgba(34, 197, 94, 0.25)',
                            color: '#4ADE80',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            textDecoration: 'none'
                          }}
                        >
                          <MessageSquare size={13} /> WhatsApp
                        </a>
                        <a
                          href={`tel:${elector.padrino_telefono}`}
                          style={{
                            flex: 1,
                            padding: '0.45rem',
                            borderRadius: '8px',
                            background: 'rgba(168, 85, 247, 0.12)',
                            border: '1px solid rgba(168, 85, 247, 0.25)',
                            color: '#C084FC',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            textDecoration: 'none'
                          }}
                        >
                          <Phone size={13} /> Llamar
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Priority and Transport Section */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem'
                    }}>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Prioridad / Color</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                        <span style={{ 
                          width: '10px', 
                          height: '10px', 
                          borderRadius: '50%', 
                          background: elector.traffic_light === 'GREEN' ? 'var(--green)' : elector.traffic_light === 'YELLOW' ? 'var(--yellow)' : elector.traffic_light === 'PURPLE' ? '#A855F7' : 'var(--red)' 
                        }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white' }}>
                          {elector.traffic_light === 'GREEN' ? 'VERDE (Seguro)' : elector.traffic_light === 'YELLOW' ? 'AMARILLO (Dudoso)' : elector.traffic_light === 'PURPLE' ? 'MORADO (Otros)' : 'ROJO (Opositor)'}
                        </span>
                      </div>
                    </div>

                    <div style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem'
                    }}>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Transporte</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: elector.needs_transport === 1 ? 'var(--yellow)' : 'var(--text-3)', marginTop: '0.2rem' }}>
                        {elector.needs_transport === 1 ? '🚗 Necesita transporte' : 'No requiere'}
                      </span>
                    </div>
                  </div>

                  {elector.captured_at && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <Calendar size={13} style={{ color: 'var(--text-3)' }} />
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 600 }}>
                        Fecha de Captación: {new Date(elector.captured_at).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}

                  {(elector.capture_lat && elector.capture_lng) ? (
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${elector.capture_lat},${elector.capture_lng}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: 'rgba(59,130,246,0.1)',
                        border: '1px solid rgba(59,130,246,0.2)',
                        borderRadius: '12px',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        color: 'var(--blue-400)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <MapPin size={16} />
                      <span>Ver Ubicación de Captura en Google Maps</span>
                    </a>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', opacity: 0.5 }}>
                      <MapPin size={16} style={{ color: 'var(--text-3)' }} />
                      <span style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>Ubicación geográfica no registrada</span>
                    </div>
                  )}
                </div>
              </div>
            )}
      
            <div className="card-cta-section">
              <button
                onClick={handleConfirm}
                disabled={isLoading || isReadOnly}
                className="btn btn-primary"
                style={{
                  width: '100%', height: '3.25rem',
                  fontSize: '0.9rem', letterSpacing: '0.06em',
                  borderRadius: '12px', fontFamily: 'var(--font-display)', gap: '0.6rem',
                  animation: (isLoading || isReadOnly) ? 'none' : 'glow-pulse 3s ease-in-out infinite',
                  opacity: isReadOnly ? 0.6 : 1,
                  background: isReadOnly ? 'var(--surface-3)' : undefined,
                  cursor: isReadOnly ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isLoading ? <Spinner size={20} /> : (
                  isReadOnly ? (
                    <><Search size={20} /> <span>Perfil Solo Consulta</span></>
                  ) : (elector.traffic_light && elector.coordinator_id === user?.id) ? (
                    <><Edit2 size={20} /> <span>Editar Mi Registro</span></>
                  ) : (
                    <><ClipboardCheck size={20} strokeWidth={2.5} /> <span>Registrar Elector</span></>
                  )
                )}
              </button>
            </div>
          </motion.article>
        )}
      
        {successMsg && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', damping: 22 }}
            style={{
              background: 'var(--surface)',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: '1.5rem',
              padding: '3rem 2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '1rem',
              boxShadow: '0 0 40px rgba(34,197,94,0.08)',
            }}
          >
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '22px',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--green)',
              boxShadow: '0 0 30px rgba(34,197,94,0.15)',
            }}>
              <CheckCheck size={42} strokeWidth={2.5} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', color: 'var(--text)', letterSpacing: '-0.01em' }}>
                Operación Exitosa
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: '0.4rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {successMsg}
              </p>
            </div>
            <button
              onClick={() => { setElector(null); setSuccessMsg(''); setCi(''); }}
              className="btn btn-primary"
              style={{ marginTop: '0.5rem', borderRadius: '10px', fontSize: '0.8rem', letterSpacing: '0.08em', fontFamily: 'var(--font-display)' }}
            >
              Nueva Consulta
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {!elector && !successMsg && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4rem 0',
            gap: '1rem',
            opacity: "0.35",
          }}
        >
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '20px',
            border: '2px dashed rgba(59,130,246,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Search size={30} style={{ color: 'var(--plra-300)' }} />
          </div>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-2)', fontFamily: 'var(--font-display)' }}>
            Ingrese una cédula para consultar
          </p>
        </motion.div>
      )}
      {/* ══ CAPTURE MODAL ══ */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000000,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              padding: '0 0 env(safe-area-inset-bottom)',
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <motion.div
              key="modal-sheet"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              style={{
                width: '100%', maxWidth: '480px',
                background: 'var(--surface)',
                borderTopLeftRadius: '2rem', borderTopRightRadius: '2rem',
                border: '1px solid var(--border-mid)', borderBottom: 'none',
                boxShadow: '0 -20px 60px rgba(0,0,0,0.7)', overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0 0' }}>
                <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--border)' }} />
              </div>

              <div style={{ padding: '1.25rem 3.5rem 1.5rem', textAlign: 'center', position: 'relative' }}>
                <button
                  onClick={() => setShowModal(false)}
                  style={{ position: 'absolute', top: '1rem', right: '1.25rem', width: '32px', height: '32px', borderRadius: '9px', background: 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
                <p style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-display)', marginBottom: '0.4rem' }}>
                  {editingCapture ? 'Editar Registro' : 'Calificación de Intención'}
                </p>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.35rem', color: 'var(--text)', letterSpacing: '-0.01em' }}>
                  {editingCapture ? 'Modificar Datos' : '¿Cuál es la intención de voto?'}
                </h3>
                {(elector || editingCapture) && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', padding: '0.3rem 0.85rem', background: 'rgba(0,71,171,0.15)', border: '1px solid var(--border-mid)', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--plra-200)', fontFamily: 'var(--font-display)' }}>
                    <User size={12} />
                    {(elector || editingCapture)?.nombre} {(elector || editingCapture)?.apellido}
                  </div>
                )}
              </div>

              {/* Phone input */}
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
                      style={{ position: 'absolute', left: '0.5rem', background: 'var(--accent-subtle)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--plra-300)', fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.4rem', cursor: 'pointer', zIndex: 10 }}
                    >
                      {telefono.startsWith('+55') ? '+55 🇧🇷' : '+595 🇵🇾'}
                    </button>
                    <input
                      type="text" inputMode="tel" placeholder="+595 9xx xxx xxx"
                      value={telefono}
                      onChange={(e) => handlePhoneChange(e.target.value, setTelefono)}
                      className="modern-input-premium-styled"
                      style={{ paddingLeft: '4.8rem', fontSize: '1rem', fontWeight: 700 }}
                    />
                  </div>
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontStyle: 'italic' }}>Formato automático para envío de mensajes.</p>
                </div>
              </div>

              {/* Transport toggle */}
              <div style={{ padding: '0 1.5rem 1.5rem' }}>
                <div
                  onClick={() => setNeedsTransport(!needsTransport)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: needsTransport ? 'var(--accent-subtle)' : 'var(--surface-light)', border: `1px solid ${needsTransport ? 'var(--plra-300)' : 'var(--border)'}`, borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Truck size={18} style={{ color: needsTransport ? 'var(--plra-300)' : 'var(--text-3)' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>Necesita Transporte</span>
                  </div>
                  <div style={{ width: '36px', height: '18px', borderRadius: '9px', background: needsTransport ? 'var(--plra-300)' : 'rgba(255,255,255,0.1)', position: 'relative' }}>
                    <motion.div animate={{ x: needsTransport ? 18 : 2 }} style={{ position: 'absolute', top: 2, left: 0, width: '14px', height: '14px', borderRadius: '7px', background: 'white' }} />
                  </div>
                </div>
              </div>

              {/* Semaphore buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', padding: '0 1.5rem 2rem' }}>
                {[
                  { color: 'GREEN',  bg: 'linear-gradient(160deg,#22C55E 0%,#15803D 100%)', glow: 'rgba(34,197,94,0.5)',  border: 'rgba(34,197,94,0.35)',  count: colorCounts?.green,  label: 'CASA' },
                  { color: 'YELLOW', bg: 'linear-gradient(160deg,#FBBF24 0%,#D97706 100%)', glow: 'rgba(251,191,36,0.5)', border: 'rgba(251,191,36,0.35)', count: colorCounts?.yellow, label: 'FAMILIARES' },
                  { color: 'RED',    bg: 'linear-gradient(160deg,#EF4444 0%,#B91C1C 100%)', glow: 'rgba(239,68,68,0.5)',  border: 'rgba(239,68,68,0.35)',  count: colorCounts?.red,    label: 'OTROS' },
                  { color: 'PURPLE', bg: 'linear-gradient(160deg,#A855F7 0%,#7E22CE 100%)', glow: 'rgba(168,85,247,0.5)', border: 'rgba(168,85,247,0.35)', count: colorCounts?.purple, label: 'VOLUNTARIO' },
                ].map(({ color, bg, glow, border, count, label }) => (
                  <motion.button
                    key={color}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => editingCapture ? handleUpdateCapture(color) : handleCapture(color as any)}
                    disabled={isLoading}
                    style={{ flex: 1, height: '5.5rem', background: bg, border: `1px solid ${border}`, borderRadius: '1rem', cursor: 'pointer', boxShadow: `0 8px 28px ${glow}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                  >
                    {isLoading ? <Spinner size={22} /> : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                        {color === 'GREEN' ? <ThumbsUp size={24} /> : color === 'YELLOW' ? <Users size={24} /> : color === 'RED' ? <HelpCircle size={24} /> : <AlertCircle size={24} />}
                        <span style={{ fontSize: '0.5rem', fontWeight: 900 }}>{label}</span>
                      </div>
                    )}
                    {!isLoading && count != null && (
                      <span style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(0,0,0,0.3)', color: 'white', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 900, padding: '0.15rem 0.4rem', minWidth: '1rem', textAlign: 'center' }}>{count}</span>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TabSearch;
