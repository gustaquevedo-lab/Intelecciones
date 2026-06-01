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

const TabSupport = (props: any) => {
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
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <SectionLabel icon={<HelpCircle size={13} />} text="Solicitar Apoyo al Comando" />
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '1.5rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '1.25rem' }}>Describe brevemente lo que necesitas.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <button onClick={() => setRequestType('TRANSPORT')} style={{ padding: '0.75rem', borderRadius: '10px', background: requestType === 'TRANSPORT' ? 'var(--plra-500)' : 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Logística</button>
              <button onClick={() => setRequestType('RESOURCES')} style={{ padding: '0.75rem', borderRadius: '10px', background: requestType === 'RESOURCES' ? 'var(--plra-500)' : 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Recursos</button>
            </div>
      
            <textarea 
              value={requestMsg}
              onChange={(e) => setRequestMsg(e.target.value)}
              placeholder="Escribe aquí tu solicitud..."
              style={{ width: '100%', height: '100px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', color: 'white', fontSize: '0.9rem', outline: 'none', resize: 'none', marginBottom: '1rem' }}
            />
      
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSupportPhoto(file);
                  }}
                  style={{ display: 'none' }}
                  id="support-photo-input"
                />
                <label 
                  htmlFor="support-photo-input"
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    padding: '0.75rem', borderRadius: '12px', background: supportPhoto ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                    border: supportPhoto ? '1px solid var(--green)' : '1px solid var(--border)',
                    color: supportPhoto ? 'var(--green)' : 'var(--text-2)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700
                  }}
                >
                  <Camera size={16} /> {supportPhoto ? 'Foto Lista' : 'Tomar Foto'}
                </label>
                {supportPhoto && (
                  <button 
                    onClick={() => setSupportPhoto(null)}
                    style={{ position: 'absolute', top: '-8px', right: '-8px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--red)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
      
              <div style={{ flex: 1, position: 'relative' }}>
                <button 
                  onClick={isRecording ? stopRecording : startRecording}
                  style={{ 
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    padding: '0.75rem', borderRadius: '12px', 
                    background: isRecording ? 'rgba(239,68,68,0.1)' : (supportAudio ? 'var(--plra-800)' : 'rgba(255,255,255,0.05)'),
                    border: isRecording ? '1px solid var(--red)' : (supportAudio ? '1px solid var(--plra-300)' : '1px solid var(--border)'),
                    color: isRecording ? 'var(--red)' : (supportAudio ? 'var(--plra-200)' : 'var(--text-2)'), cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700
                  }}
                >
                  {isRecording ? <Square size={16} /> : <Mic size={16} />}
                  {isRecording ? 'Grabando...' : (supportAudio ? 'Audio Listo' : 'Nota de Voz')}
                </button>
                {supportAudio && !isRecording && (
                  <button 
                    onClick={() => setSupportAudio(null)}
                    style={{ position: 'absolute', top: '-8px', right: '-8px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--red)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
      
            <button 
              onClick={handleSendRequest}
              disabled={(!requestMsg && !supportPhoto && !supportAudio) || isLoading || isRecording}
              className="btn btn-primary" 
              style={{ width: '100%', borderRadius: '12px', height: '3.5rem' }}
            >
              {isLoading ? <Spinner /> : 'Enviar Solicitud'}
            </button>
          </div>
      
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <SectionLabel icon={<History size={13} />} text="Mis Solicitudes Anteriores" />
            {requests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>No tienes solicitudes registradas.</p>
              </div>
            ) : requests.map((req) => (
              <div key={req.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ 
                      padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.55rem', fontWeight: 900,
                      background: req.status === 'PENDING' ? 'rgba(245,158,11,0.1)' : req.status === 'APPROVED' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color: req.status === 'PENDING' ? 'var(--yellow)' : req.status === 'APPROVED' ? 'var(--green)' : 'var(--red)',
                      border: '1px solid currentColor'
                    }}>
                      {req.status === 'PENDING' ? 'PENDIENTE' : req.status === 'APPROVED' ? 'APROBADO' : 'RECHAZADO'}
                    </span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--plra-300)' }}>{req.type}</span>
                  </div>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>{new Date(req.timestamp).toLocaleDateString()}</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: '0 0 1rem 0', lineHeight: '1.4' }}>{req.description}</p>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {req.photo_url && (
                    <div 
                      onClick={() => window.open(getImageUrl(req.photo_url) || '', '_blank')}
                      style={{ width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer', position: 'relative' }}
                    >
                      <img src={getImageUrl(req.photo_url) || ''} alt="Evidencia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0 }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0"}>
                        <Search size={16} color="white" />
                      </div>
                    </div>
                  )}
                  {req.audio_url && (
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <Mic size={10} style={{ color: 'var(--plra-300)' }} />
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-3)' }}>Nota de voz</span>
                      </div>
                      <audio controls src={req.audio_url} style={{ width: '100%', height: '32px' }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
    </>
  );
};

export default TabSupport;
