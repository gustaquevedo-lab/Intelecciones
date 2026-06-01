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

const TabDisputes = (props: any) => {
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

  } = props;

  return (
    <>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <SectionLabel icon={<AlertTriangle size={13} />} text="Disputas Activas de Captación" color="var(--red)" />
          
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input
              type="text"
              placeholder="Buscar elector en disputa..."
              value={disputesSearchQuery}
              onChange={(e) => setDisputesSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '1rem 1rem 1rem 2.75rem',
                borderRadius: '16px',
                background: 'var(--surface-light)',
                border: '1px solid var(--border)',
                color: 'white',
                fontSize: '0.85rem',
                fontWeight: 600,
                outline: 'none',
                boxShadow: 'var(--shadow-sm)',
                fontFamily: 'var(--font-sans)',
                transition: 'all 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--plra-500)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
      
          {isDisputesLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[0, 1, 2].map(i => (
                <Skeleton key={i} height={120} borderRadius="20px" />
              ))}
            </div>
          ) : disputes.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'var(--surface)', borderRadius: '24px', border: '1px dashed var(--border)' }}>
              <CheckCheck size={40} style={{ color: 'var(--green)', marginBottom: '1.5rem', opacity: 0.5 }} />
              <h3 style={{ color: 'var(--text)', fontSize: '1rem', marginBottom: '0.5rem', fontWeight: 700 }}>Territorio Controlado</h3>
              <p style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>No hay disputas activas registradas en este distrito.</p>
            </div>
          ) : (
            (() => {
              const filteredDisputes = disputes.filter(d => 
                !disputesSearchQuery || 
                `${d.elector_nombre} ${d.elector_apellido} ${d.elector_ci}`.toUpperCase().includes(disputesSearchQuery.toUpperCase())
              );
              if (filteredDisputes.length === 0) {
                return (
                  <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                    No se encontraron resultados para la búsqueda.
                  </div>
                );
              }
              return filteredDisputes.map((d: any) => (
                <motion.div
                  key={d.conflict_id}
                  layout
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '20px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white', margin: 0 }}>
                        {d.elector_nombre} {d.elector_apellido}
                      </h4>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', margin: '2px 0 0' }}>CI: {Number(d.elector_ci).toLocaleString('es-PY')}</p>
                    </div>
                    <span style={{
                      background: 'rgba(239,68,68,0.1)',
                      color: 'var(--red)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.62rem',
                      fontWeight: 900,
                      textTransform: 'uppercase'
                    }}>
                      Disputa Activa
                    </span>
                  </div>
      
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase' }}>Captura Inicial</span>
                      <p style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', margin: 0 }}>{d.coord_a || 'Coordinador A'}</p>
                      {d.padrino_a && <p style={{ fontSize: '0.68rem', color: 'var(--plra-300)', margin: 0 }}>Padrino: {d.padrino_a}</p>}
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <span style={{
                          background: d.tl_a === 'GREEN' ? 'rgba(34,197,94,0.15)' : d.tl_a === 'YELLOW' ? 'rgba(245,158,11,0.15)' : d.tl_a === 'PURPLE' ? 'rgba(168,85,247,0.15)' : 'rgba(239,68,68,0.15)',
                          color: d.tl_a === 'GREEN' ? 'var(--green)' : d.tl_a === 'YELLOW' ? 'var(--yellow)' : d.tl_a === 'PURPLE' ? '#A855F7' : 'var(--red)',
                          fontSize: '0.55rem', fontWeight: 900, padding: '0.1rem 0.35rem', borderRadius: '4px'
                        }}>
                          {d.tl_a}
                        </span>
                        {d.transport_a === 1 && (
                          <span style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--blue-400)', fontSize: '0.55rem', fontWeight: 900, padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                            🚗 TRANSPORTE
                          </span>
                        )}
                      </div>
                    </div>
      
                    <div style={{ background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase' }}>Última Captura</span>
                      <p style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', margin: 0 }}>{d.coord_b || 'Coordinador B'}</p>
                      {d.padrino_b && <p style={{ fontSize: '0.68rem', color: 'var(--plra-300)', margin: 0 }}>Padrino: {d.padrino_b}</p>}
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <span style={{
                          background: d.tl_b === 'GREEN' ? 'rgba(34,197,94,0.15)' : d.tl_b === 'YELLOW' ? 'rgba(245,158,11,0.15)' : d.tl_b === 'PURPLE' ? 'rgba(168,85,247,0.15)' : 'rgba(239,68,68,0.15)',
                          color: d.tl_b === 'GREEN' ? 'var(--green)' : d.tl_b === 'YELLOW' ? 'var(--yellow)' : d.tl_b === 'PURPLE' ? '#A855F7' : 'var(--red)',
                          fontSize: '0.55rem', fontWeight: 900, padding: '0.1rem 0.35rem', borderRadius: '4px'
                        }}>
                          {d.tl_b}
                        </span>
                        {d.transport_b === 1 && (
                          <span style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--blue-400)', fontSize: '0.55rem', fontWeight: 900, padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                            🚗 TRANSPORTE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ));
            })()
          )}
        </motion.div>
      ) : null}
    </>
  );
};

export default TabDisputes;
