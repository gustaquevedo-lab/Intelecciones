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

const TabHistory = (props: any) => {
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
    handleEditHistory,

  } = props;

  return (
    <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* STATS MOVED HERE */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.75rem',
            marginBottom: '0.5rem'
          }}>
            {isStatsLoading ? (
              <>
                {[0, 1, 2, 3].map(i => (
                  <Skeleton key={i} height={100} borderRadius="20px" />
                ))}
              </>
            ) : (
              [
                { label: 'Casa', val: colorCounts?.green, color: 'var(--green)', bg: 'rgba(34,197,94,0.15)', icon: '🏠' },
                { label: 'Familia', val: colorCounts?.yellow, color: 'var(--yellow)', bg: 'rgba(234,179,8,0.12)', icon: '👨‍👩‍👧' },
                { label: 'Otros', val: colorCounts?.red, color: 'var(--red)', bg: 'rgba(239,68,68,0.12)', icon: '📍' },
                { label: 'Voluntarios', val: colorCounts?.purple, color: '#A855F7', bg: 'rgba(168,85,247,0.15)', icon: '✨' },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: stat.bg,
                  border: `1px solid ${stat.color}25`,
                  borderRadius: '20px',
                  padding: '1rem 0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: `0 4px 15px -3px ${stat.color}15`,
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '40%', height: '40%', background: stat.color, filter: 'blur(20px)', opacity: 0.15 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                      {stat.icon}
                    </div>
                    <span style={{
                      fontSize: '1.25rem',
                      fontWeight: 900,
                      color: 'white',
                      fontFamily: 'var(--font-display)',
                      letterSpacing: '-0.02em',
                    }}>
                      {stat.val ?? 0}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: stat.color, textTransform: 'uppercase', letterSpacing: '0.12em', position: 'relative', zIndex: 1 }}>{stat.label}</span>
                </div>
              ))
            )}
          </div>
      
          {/* LOCATION STATS MOVED HERE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <SectionLabel icon={<MapPin size={13} />} text="Avance por Local" />
            <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', margin: '0 -0.25rem' }} className="no-scrollbar">
              {isStatsLoading ? (
                <>
                  {[0, 1, 2].map(i => (
                    <Skeleton key={i} width={180} height={120} borderRadius="16px" />
                  ))}
                </>
              ) : locationStats.filter(loc => loc.total_captures > 0).length > 0 ? (
                locationStats.filter(loc => loc.total_captures > 0).map((loc: any) => (
                  <div key={loc.cod_local} style={{
                    minWidth: '180px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem'
                  }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loc.nombre}</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <p style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--plra-300)', margin: 0 }}>{loc.total_captures}</p>
                        <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Captados</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-2)', margin: 0 }}>{loc.percentage}%</p>
                        <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Meta</p>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${loc.percentage}%`, height: '100%', background: 'var(--plra-500)', boxShadow: '0 0 10px var(--plra-500)' }} />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)', borderRadius: '12px', width: '100%', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 600 }}>Sin capturas por local.</p>
                </div>
              )}
            </div>
          </div>
      
          <SectionLabel icon={<History size={13} />} text={isReadOnly ? "Historial de Consultas" : "Mis Capturas Recientes"} />
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[0, 1, 2].map(i => (
                <Skeleton key={i} height={80} borderRadius="16px" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', opacity: 0.5 }}>
              <ClipboardCheck size={40} style={{ marginBottom: '1rem', color: 'var(--text-3)' }} />
              <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {isReadOnly ? "Aún no has realizado ninguna consulta." : "Aún no has registrado ningún elector."}
              </p>
            </div>
          ) : (
            <Virtuoso
              style={{ height: Math.min(history.length * 100, 480) }}
              totalCount={history.length}
              itemContent={(index) => {
                const cap = history[index];
                return (
                  <motion.div key={cap.ci || cap.elector_ci || cap.id} layout style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: cap.traffic_light === 'GREEN' ? 'rgba(34,197,94,0.1)' : cap.traffic_light === 'YELLOW' ? 'rgba(245,158,11,0.1)' : cap.traffic_light === 'PURPLE' ? 'rgba(168,85,247,0.1)' : cap.traffic_light === 'RED' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: cap.traffic_light === 'GREEN' ? 'var(--green)' : cap.traffic_light === 'YELLOW' ? 'var(--yellow)' : cap.traffic_light === 'PURPLE' ? '#A855F7' : cap.traffic_light === 'RED' ? 'var(--red)' : 'var(--text-3)', border: '1px solid currentColor' }}>
                      <User size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>{cap.nombre} {cap.apellido}</h4>
                        {cap.needs_transport === 1 && <span style={{ fontSize: '0.55rem', fontWeight: 800, background: 'var(--plra-300)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>🚗 TRANSPORTE</span>}
                      </div>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>CI: {Number(cap.ci || cap.elector_ci).toLocaleString('es-PY')} • {cap.local_votacion || cap.local}</p>
                      {isReadOnly && cap.traffic_light && (
                        <p style={{ fontSize: '0.65rem', color: 'var(--yellow)', marginTop: '0.2rem' }}>
                          Captado por: {cap.coordinator_name || 'Otro coordinador'} {cap.padrino_name ? `• Padrino: ${cap.padrino_name}` : ''}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {!isReadOnly && <button onClick={() => handleEditHistory(cap)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem', color: 'var(--text-2)', cursor: 'pointer' }}><Edit2 size={14} /></button>}
                      <button onClick={() => handleDeleteCapture(cap.id, cap.ci || cap.elector_ci)} style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '0.5rem', color: 'var(--red)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                    </div>
                  </motion.div>
                );
              }}
            />
          )}
        </div>
    </>
  );
};

export default TabHistory;
