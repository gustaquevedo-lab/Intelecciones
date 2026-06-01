import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, MapPin, User,
  Map, Building2, Home,
  ClipboardCheck, ArrowRight, AlertCircle, AlertTriangle,
  CheckCheck, ThumbsUp, HelpCircle, X, Shield, Share2, History, Edit2, Trash2, MessageSquare, Fingerprint, Landmark,
  UserPlus, Camera, LayoutList, Users, Mic, Square, ChevronRight,
  Car, Inbox, Truck, Download, Activity
} from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageCropperModal } from '../components/ImageCropperModal';
import { Skeleton } from '../components/Skeleton';

import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import api, { getImageUrl } from '../services/api';
import { savePadronOffline, searchElectorOffline, getOfflineStats } from '../services/offlineDb';
import { useSSE } from '../hooks/useSSE';
import { Virtuoso } from 'react-virtuoso';
import TabSearch from './coordinator/TabSearch';
import TabHistory from './coordinator/TabHistory';
import TabSupport from './coordinator/TabSupport';
import TabDisputes from './coordinator/TabDisputes';
import TabCoordinators from './coordinator/TabCoordinators';

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

const CoordinatorApp = () => {
  const { user, loading, activeDistrict } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [ci, setCi] = useState('');
  const [elector, setElector] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [needsTransport, setNeedsTransport] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'history' | 'support' | 'coordinators' | 'disputes'>('search');
  const [history, setHistory] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [editingCapture, setEditingCapture] = useState<any>(null);
  const [telefono, setTelefono] = useState('');
  const [trafficLight, setTrafficLight] = useState('');
  const [colorCounts, setColorCounts] = useState<any>(null);
  const [locationStats, setLocationStats] = useState<any[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  // States for active disputes tab
  const [disputes, setDisputes] = useState<any[]>([]);
  const [disputesSearchQuery, setDisputesSearchQuery] = useState('');
  const [isDisputesLoading, setIsDisputesLoading] = useState(false);

  const [showCoordModal, setShowCoordModal] = useState(false);
  const [newCoordCI, setNewCoordCI] = useState('');
  const [newCoordName, setNewCoordName] = useState('');
  const [newCoordRealName, setNewCoordRealName] = useState('');
  const [newCoordPhoto, setNewCoordPhoto] = useState<string | null>(null);

  // States for dynamic unregistered elector capture modal
  const [showUnregisteredModal, setShowUnregisteredModal] = useState(false);
  const [customElectorCI, setCustomElectorCI] = useState('');
  const [customElectorName, setCustomElectorName] = useState('');
  const [customElectorTelefono, setCustomElectorTelefono] = useState('');
  const [customActionPill, setCustomActionPill] = useState<'TRASLADO' | 'AFILIARSE' | 'GENERALES' | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [customIsSubmitted, setCustomIsSubmitted] = useState(false);
  
  const [photoFrente, setPhotoFrente] = useState<string | null>(null);
  const [photoVerso, setPhotoVerso] = useState<string | null>(null);
  const [isUploadingFrente, setIsUploadingFrente] = useState(false);
  const [isUploadingVerso, setIsUploadingVerso] = useState(false);
  
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Hoisted function to download padron
  async function handleDownloadPadron() {
    const targetDistrict = activeDistrict || user?.distrito;
    const confirmMsg = targetDistrict 
      ? `¿Desea descargar el padrón de ${targetDistrict.toUpperCase()} para uso offline?\n\nEsto optimizará el espacio en su móvil.`
      : '¿Desea descargar el padrón COMPLETO para uso offline?\n\nADVERTENCIA: Esto puede tardar varios minutos y consumir mucho espacio.';

    if (!window.confirm(confirmMsg)) return;
    setIsDownloading(true);
    setDownloadProgress(10);
    try {
      const targetDistrict = activeDistrict || user?.distrito;
      const res = await api.get('/offline/padron', { 
        params: { district: targetDistrict },
        timeout: 300000 
      });
      setDownloadProgress(60);
      if (!res.data || res.data.length === 0) {
        alert('No se encontraron electores para tu zona.');
        setIsDownloading(false);
        setDownloadProgress(0);
        return;
      }
      setDownloadProgress(75);
      await savePadronOffline(res.data, (pct) => {
        setDownloadProgress(75 + Math.floor(pct * 0.25));
      });
      setDownloadProgress(100);
      const count = await getOfflineStats();
      setOfflineCount(count);
      
      // Store current timestamp as the last synchronized version
      localStorage.setItem('last_padron_sync_timestamp', Date.now().toString());
      
      alert(`Padrón descargado con éxito: ${count} electores disponibles offline.`);
      setIsStatsLoading(false);
    } catch (err: any) {
      console.error('Download error:', err);
      setIsStatsLoading(false);
      alert('Error al descargar el padrón. Verifique su conexión.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }

  useEffect(() => {
    getOfflineStats().then(setOfflineCount);
    
    // Auto-detect padron updates in the background when online
    const checkPadronVersion = async () => {
      try {
        const res = await api.get('/offline/padron/status');
        const lastSync = localStorage.getItem('last_padron_sync_timestamp') || '0';
        const declinedVersion = localStorage.getItem('declined_padron_version') || '0';
        
        if (res.data.last_updated > parseInt(lastSync) && res.data.last_updated.toString() !== declinedVersion) {
          const confirmed = window.confirm(
            `📢 ¡Hay una nueva actualización del padrón electoral disponible!\n\nSe han cargado datos actualizados. ¿Deseas descargar la última versión para trabajar sin conexión?`
          );
          if (confirmed) {
            handleDownloadPadron();
          } else {
            localStorage.setItem('declined_padron_version', res.data.last_updated.toString());
          }
        }
      } catch (e) {
        console.log('Error checking padron version', e);
      }
    };
    
    const timer = setTimeout(checkPadronVersion, 3500);
    return () => clearTimeout(timer);
  }, [activeDistrict, user]);
  const [newCoordTelefono, setNewCoordTelefono] = useState('');
  const [isCoordVerified, setIsCoordVerified] = useState(false);
  
  const [teamStats, setTeamStats] = useState<any[]>([]);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [selectedCoordDetail, setSelectedCoordDetail] = useState<any>(null);
  const [coordCaptures, setCoordCaptures] = useState<any[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  const [myPadrinos, setMyPadrinos] = useState<any[]>([]);
  const [showPadrinoModal, setShowPadrinoModal] = useState(false);
  const [newPadrinoCI, setNewPadrinoCI] = useState('');
  const [newPadrinoRealName, setNewPadrinoRealName] = useState('');
  const [newPadrinoPhoto, setNewPadrinoPhoto] = useState<string | null>(null);
  const [newPadrinoTelefono, setNewPadrinoTelefono] = useState('');
  const [isPadrinoVerified, setIsPadrinoVerified] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const frontCameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const padrinoFileInputRef = React.useRef<HTMLInputElement>(null);
  const padrinoFrontCameraInputRef = React.useRef<HTMLInputElement>(null);
  const padrinoGalleryInputRef = React.useRef<HTMLInputElement>(null);
  
  const [showPhotoSource, setShowPhotoSource] = useState<'NONE' | 'COORD' | 'PADRINO'>('NONE');

  const [cropperData, setCropperData] = useState<{ image: string } | null>(null);

  const [requestMsg, setRequestMsg] = useState('');
  const [requestType, setRequestType] = useState('TRANSPORT');
  const [supportPhoto, setSupportPhoto] = useState<File | null>(null);
  const [supportAudio, setSupportAudio] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setSupportAudio(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) { alert("Acceso al micrófono denegado."); }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleSendRequest = async () => {
    if ((!requestMsg && !supportPhoto && !supportAudio) || !user) return;
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('coordinator_id', user.id.toString());
      formData.append('type', requestType);
      formData.append('description', requestMsg);
      formData.append('priority', 'NORMAL');
      formData.append('list_id', user.assigned_list_id?.toString() || '');
      if (supportPhoto) formData.append('photo', supportPhoto);
      if (supportAudio) formData.append('audio', supportAudio, 'voice_note.webm');

      await api.post('/coordinator/request', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccessMsg('Solicitud enviada al Comando Central.');
      setRequestMsg('');
      setSupportPhoto(null);
      setSupportAudio(null);
    } catch (err) {
      setError('No se pudo enviar la solicitud.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyCoordinators = async () => {
    if (!user) return;
    try {
      await api.get(`/users?parent_id=${user.id}`);
      // If we need to filter further, we do it here
    } catch {
      console.error("Error fetching my coordinators");
    }
  };

  const fetchMyPadrinoStats = async () => {
    if (!user) return;
    try {
      const res = await api.get(`/padrino/team-stats?padrino_id=${user.id}`);
      setTeamStats(res.data);
    } catch (err) {
      console.error("Error fetching my padrino stats", err);
    }
  };

  const fetchCoordinatorDetail = async (coord: any) => {
    setSelectedCoordDetail(coord);
    setIsLoading(true);
    try {
      const res = await api.get(`/coordinator/${coord.id}/captures`);
      setCoordCaptures(res.data);
      setShowDetailModal(true);
    } catch (err) {
      console.error("Error fetching detail", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCoordinator = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isCoordVerified) {
      setError('⚠️ Debe verificar la cédula primero.');
      return;
    }
    if (!newCoordPhoto) {
      setError('⚠️ Debe incluir una foto del miembro.');
      return;
    }
    if (!newCoordTelefono) {
      setError('⚠️ El número de WhatsApp es obligatorio.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/users', {
        username: newCoordName || newCoordCI,
        password: newCoordCI.replace(/\./g, ''), 
        nombre: newCoordRealName,
        role: 'COORDINADOR',
        parent_id: user?.id,
        photo_url: newCoordPhoto,
        telefono: newCoordTelefono,
        ci: newCoordCI,
        assigned_list_id: user?.assigned_list_id,
        assigned_campaign_id: user?.assigned_campaign_id
      });
      setSuccessMsg('✅ Miembro registrado correctamente.');
      setShowCoordModal(false);
      setNewCoordCI('');
      setNewCoordPhoto(null);
      setNewCoordRealName('');
      setNewCoordTelefono('');
      setIsCoordVerified(false);
      fetchMyCoordinators();
      fetchMyPadrinoStats();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear coordinador');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLookupCoordCI = async () => {
    if (!newCoordCI) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/electors/${newCoordCI}`);
      setNewCoordRealName(`${res.data.nombre} ${res.data.apellido}`);
      setNewCoordName(newCoordCI); 
      setIsCoordVerified(true);
      setError('');
    } catch (err) {
      setError('Cédula no encontrada en el padrón.');
      setIsCoordVerified(false);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyPadrinos = async () => {
    if (!user) return;
    try {
      const res = await api.get(`/users?parent_id=${user.id}`);
      setMyPadrinos(res.data.filter((u: any) => u.parent_id === user.id && u.role === 'PADRINO'));
    } catch (err) {
      console.error("Error fetching my padrinos", err);
    }
  };

  const handleLookupPadrinoCI = async () => {
    if (!newPadrinoCI) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/electors/${newPadrinoCI}`);
      setNewPadrinoRealName(`${res.data.nombre} ${res.data.apellido}`);
      setIsPadrinoVerified(true);
      setError('');
    } catch (err) {
      setError('Cédula no encontrada.');
      setIsPadrinoVerified(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePadrino = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPadrinoVerified || !newPadrinoPhoto || !newPadrinoTelefono) {
      setError('Verifique CI e incluya Foto y WhatsApp.');
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/users', {
        username: newPadrinoCI,
        password: newPadrinoCI.replace(/\./g, ''),
        nombre: newPadrinoRealName,
        role: 'PADRINO',
        parent_id: user?.id,
        photo_url: newPadrinoPhoto,
        telefono: newPadrinoTelefono,
        ci: newPadrinoCI,
        assigned_campaign_id: user?.assigned_campaign_id
      });
      setSuccessMsg('Padrino creado correctamente.');
      setShowPadrinoModal(false);
      setNewPadrinoCI('');
      setNewPadrinoPhoto(null);
      setNewPadrinoTelefono('');
      setIsPadrinoVerified(false);
      fetchMyPadrinos();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear padrino');
    } finally {
      setIsLoading(false);
    }
  };

  const isReadOnly = user?.role === 'CANDIDATO' || user?.role === 'CANDIDATE' || user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA';

  const saveElectorToHistory = (electorData: any) => {
    if (!electorData || !user?.id) return;
    try {
      const key = `query_history_${user.id}`;
      const saved = localStorage.getItem(key);
      let list = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(list)) list = [];
      
      // Evitar duplicados
      list = list.filter((item: any) => item.ci !== electorData.ci);
      
      // Agregar al principio con timestamp
      const newEntry = {
        ...electorData,
        queriedAt: new Date().toISOString()
      };
      
      list.unshift(newEntry);
      
      // Limitar a 50
      if (list.length > 50) {
        list = list.slice(0, 50);
      }
      
      localStorage.setItem(key, JSON.stringify(list));
      setHistory(list);
    } catch (err) {
      console.error("Error saving search history", err);
    }
  };

  const fetchDisputes = async () => {
    try {
      setIsDisputesLoading(true);
      const res = await api.get('/admin/conflicts');
      setDisputes(res.data || []);
    } catch (err) {
      console.error("Error fetching disputes", err);
    } finally {
      setIsDisputesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'coordinators') {
      if (user?.role === 'JEFE_CAMPANA') fetchMyPadrinos();
      else if (user?.role === 'PADRINO') fetchMyPadrinoStats();
    }
    if (activeTab === 'support') fetchRequests();
    if (activeTab === 'disputes') fetchDisputes();
  }, [activeTab, user]);

  const fetchRequests = async () => {
    if (!user) return;
    try {
      setIsStatsLoading(true);
      const res = await api.get('/admin/requests');
      const filtered = user.role === 'SUPERUSUARIO' || user.role === 'JEFE_CAMPANA' 
        ? res.data 
        : res.data.filter((r: any) => r.coordinator_id === user.id);
      setRequests(filtered);
    } catch (err) {
      console.error("Error fetching requests", err);
    }
  };

  useEffect(() => {
    const lookup = async () => {
      if (ci.length >= 5 && activeTab === 'search') {
        try {
          setIsLoading(true);
          const localResults = await searchElectorOffline(ci);
          if (localResults.length > 0) {
             setElector(localResults[0]);
             if (isReadOnly) saveElectorToHistory(localResults[0]);
             setError('');
             setIsLoading(false);
             return;
          }
          const res = await api.get(`/electors/${ci}`);
          setElector(res.data);
          if (isReadOnly) saveElectorToHistory(res.data);
          setError('');
        } catch {
          setElector(null);
        } finally {
          setIsLoading(false);
        }
      }
    };
    const timer = setTimeout(lookup, 600);
    return () => clearTimeout(timer);
  }, [ci, activeTab]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ci) return;
    setIsLoading(true);
    setError('');
    setElector(null);
    setSuccessMsg('');
    try {
      let electorData = null;
      const localResults = await searchElectorOffline(ci);
      if (localResults.length > 0) {
        electorData = localResults[0];
      } else {
        const res = await api.get(`/electors/${ci}`);
        electorData = res.data;
      }
      
      if (electorData) {
        setElector(electorData);
        if (isReadOnly) saveElectorToHistory(electorData);
        if (electorData.traffic_light) {
          if (!isReadOnly && electorData.coordinator_id !== user?.id) {
            setError(`Este elector ya fue captado por ${electorData.coordinator_name || 'otro coordinador'}.`);
          }
        }
      } else {
        setCustomElectorCI(ci);
        setCustomElectorName('');
        setCustomElectorTelefono('');
        setCustomActionPill(null);
        setIsConfirmed(false);
        setShowUnregisteredModal(true);
      }
    } catch {
      const localResults = await searchElectorOffline(ci);
      if (localResults.length > 0) {
        setElector(localResults[0]);
        if (isReadOnly) saveElectorToHistory(localResults[0]);
      } else {
        setCustomElectorCI(ci);
        setCustomElectorName('');
        setCustomElectorTelefono('');
        setCustomActionPill(null);
        setIsConfirmed(false);
        setShowUnregisteredModal(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (isReadOnly) return;
    if (elector?.traffic_light) {
      handleEditHistory(elector);
      return;
    }
    if (location) {
      setShowModal(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => setLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
          null,
          { enableHighAccuracy: false, timeout: 5000 }
        );
      }
      return;
    }

    if (!navigator.geolocation) {
      setError('La geolocalización no está disponible. Se registrará sin coordenadas.');
      setLocation({ lat: 0, lng: 0 });
      setShowModal(true);
      return;
    }

    setIsLoading(true);
    setError('');
    const geoOptions = { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 };
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setShowModal(true);
        setIsLoading(false);
      },
      () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setShowModal(true);
            setIsLoading(false);
          },
          () => {
            setError('No se pudo obtener la ubicación GPS.');
            setIsLoading(false);
          },
          { enableHighAccuracy: false, timeout: 5000 }
        );
      },
      geoOptions
    );
  };

  const handleUploadCustomElectorPhoto = async (file: File, type: 'FRENTE' | 'VERSO') => {
    if (type === 'FRENTE') setIsUploadingFrente(true);
    else setIsUploadingVerso(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await api.post('/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (type === 'FRENTE') {
        setPhotoFrente(res.data.photo_url);
      } else {
        setPhotoVerso(res.data.photo_url);
      }
    } catch (e: any) {
      console.error(e);
      setError('Error al subir la foto de la cédula. Intente de nuevo.');
    } finally {
      if (type === 'FRENTE') setIsUploadingFrente(false);
      else setIsUploadingVerso(false);
    }
  };

  const handleSaveCustomElector = async () => {
    if (!customElectorName.trim()) {
      setError('El nombre completo es obligatorio.');
      return;
    }
    if (!customElectorTelefono || customElectorTelefono.length < 10) {
      setError('El número de teléfono es obligatorio.');
      return;
    }
    if (!customActionPill) {
      setError('Por favor, selecciona una acción.');
      return;
    }

    setIsLoading(true);
    setError('');
    
    // Map custom category to traffic light and text category
    let color: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    let categoryText = '';
    
    if (customActionPill === 'TRASLADO') {
      color = 'RED';
      categoryText = 'AFILIADO - traslado/actualización';
    } else if (customActionPill === 'AFILIARSE') {
      color = 'YELLOW';
      categoryText = 'NO AFILIADO - necesita afiliarse';
    } else if (customActionPill === 'GENERALES') {
      color = 'GREEN';
      categoryText = 'NO AFILIADO - apoya generales';
    }

    const activeLocation = location || { lat: 0, lng: 0 };
    const captureData = {
      elector_ci: customElectorCI,
      coordinator_id: user?.id,
      lat: activeLocation.lat,
      lng: activeLocation.lng,
      traffic_light: color,
      needs_transport: false,
      telefono: customElectorTelefono.replace(/\s/g, ''),
      timestamp: new Date().toISOString(),
      elector_nombre: customElectorName.trim(),
      category: categoryText,
      photo_ci_frente: photoFrente,
      photo_ci_verso: photoVerso
    };

    try {
      const { safePost } = await import('../services/syncService');
      const res = await safePost('CAPTURE', '/captures', captureData);
      
      if (res.data.offline) {
        setSuccessMsg('⚠️ Sin conexión. Registro de campo encolado localmente.');
      } else {
        setSuccessMsg('¡Elector registrado y captado con éxito!');
        fetchHistory();
      }

      setShowUnregisteredModal(false);
      setCustomIsSubmitted(true);
      
      // Cleanup
      setTimeout(() => {
        setCi('');
        setElector(null);
        setSuccessMsg('');
        setCustomElectorCI('');
        setCustomElectorName('');
        setCustomElectorTelefono('');
        setCustomActionPill(null);
        setCustomIsSubmitted(false);
        setIsConfirmed(false);
        setPhotoFrente(null);
        setPhotoVerso(null);
      }, 2000);
    } catch (err) {
      console.error(err);
      setError('Error al registrar elector personalizado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCapture = async (color: 'GREEN' | 'YELLOW' | 'RED' | 'PURPLE') => {
    if (!elector || isReadOnly || !user) return;
    
    const activeLocation = location || { lat: 0, lng: 0 };
    if (!telefono || telefono.length < 10) {
      setError('El número de teléfono es obligatorio para registrar al elector.');
      return;
    }
    
    const captureData = {
      elector_ci: elector.ci,
      coordinator_id: user.id,
      lat: activeLocation.lat,
      lng: activeLocation.lng,
      traffic_light: color,
      needs_transport: needsTransport,
      telefono: telefono.replace(/\s/g, ''),
      timestamp: new Date().toISOString(),
      elector_nombre: elector.nombre + ' ' + (elector.apellido || '')
    };

    setIsLoading(true);
    try {
      const { safePost } = await import('../services/syncService');
      const res = await safePost('CAPTURE', '/captures', captureData);
      
      if (res.data.offline) {
        setSuccessMsg('⚠️ Sin conexión. El registro se guardó localmente y se sincronizará pronto.');
      } else {
        setSuccessMsg('¡Captura guardada correctamente!');
        fetchHistory();
      }
      
      setShowModal(false);
      
      // Cleanup
      setTimeout(() => {
        setCi(''); setElector(null); setSuccessMsg(''); setLocation(null); setNeedsTransport(false); setTelefono('');
      }, 2000);
    } catch (err: any) {
      console.error("Error saving capture", err);
      setError('Error al procesar la captura.');
    } finally {
      setIsLoading(false);
    }
  };


  const handleUpdateCapture = async (color: string) => {
    if (!editingCapture) return;
    if (telefono && telefono.replace(/\s/g, '').length < 10) {
      setError('El número de teléfono debe tener al menos 10 dígitos.');
      return;
    }
    try {
      setIsLoading(true);
      await api.put(`/captures/${editingCapture.id}`, {
        traffic_light: color,
        needs_transport: needsTransport,
        telefono: telefono ? telefono.replace(/\s/g, '') : ''
      });
      setSuccessMsg('Registro actualizado.');
      setShowModal(false);
      setEditingCapture(null);
      setNeedsTransport(false);
      fetchHistory();
      if (selectedCoordDetail) {
        fetchCoordinatorDetail(selectedCoordDetail);
        fetchMyPadrinoStats();
      }
    } catch (err) {
      setError('No se pudo actualizar.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchHistory();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // SSE: refresh history whenever a capture is created or history is updated
  useSSE(useCallback((event) => {
    if (event.type === 'capture.created' || event.type === 'history.updated') {
      fetchHistory();
    }
  }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'coordinators') {
      if (user?.role === 'PADRINO') fetchMyCoordinators();
      if (user?.role === 'JEFE_CAMPANA') fetchMyPadrinos();
    }
  }, [activeTab, user]);

  const fetchHistory = async () => {
    if (!user) return;
    setIsStatsLoading(true);
    if (isReadOnly) {
      try {
        const key = `query_history_${user.id}`;
        const saved = localStorage.getItem(key);
        let list = saved ? JSON.parse(saved) : [];
        if (!Array.isArray(list)) list = [];
        setHistory(list);
        
        const stats = { green: 0, yellow: 0, red: 0, purple: 0 };
        list.forEach((c: any) => {
          if (c.traffic_light === 'GREEN') stats.green++;
          else if (c.traffic_light === 'YELLOW') stats.yellow++;
          else if (c.traffic_light === 'RED') stats.red++;
          else if (c.traffic_light === 'PURPLE') stats.purple++;
        });
        setColorCounts(stats);
      } catch (err) {
        console.error("Error fetching local query history", err);
      }
      setIsStatsLoading(false);
      return;
    }

    try {
      const res = await api.get(`/coordinator/${user.id}/captures`);
      const data = res.data;
      
      if (!Array.isArray(data)) {
        console.warn("Ignored invalid history data (not an array)");
        setIsStatsLoading(false);
        return;
      }
      
      setHistory(data);
      
      // Calculate real stats from history
      const stats = { green: 0, yellow: 0, red: 0, purple: 0 };
      data.forEach((c: any) => {
        if (c.traffic_light === 'GREEN') stats.green++;
        else if (c.traffic_light === 'YELLOW') stats.yellow++;
        else if (c.traffic_light === 'RED') stats.red++;
        else if (c.traffic_light === 'PURPLE') stats.purple++;
      });
      setColorCounts(stats);

      // Fetch location stats
      const statsRes = await api.get('/stats/command');
      if (statsRes.data && typeof statsRes.data === 'object' && !Array.isArray(statsRes.data)) {
        if (statsRes.data.locations) {
          setLocationStats(statsRes.data.locations);
        }
      }
      setIsStatsLoading(false);
    } catch (err) {
      console.error("Error fetching history", err);
      setIsStatsLoading(false);
    }
  };

  const handleEditHistory = (cap: any) => {
    const preparedCap = {
      ...cap,
      id: cap.id || cap.capture_id,
      elector_ci: cap.ci || cap.elector_ci
    };
    setEditingCapture(preparedCap);
    setNeedsTransport(!!preparedCap.needs_transport);
    setTelefono(preparedCap.telefono || '');
    setShowModal(true);
  };

  const handleDeleteCapture = async (id: number, electorCi?: string) => {
    if (isReadOnly) {
      if (!confirm('¿Seguro que desea eliminar esta consulta del historial?')) return;
      try {
        const key = `query_history_${user?.id}`;
        const saved = localStorage.getItem(key);
        let list = saved ? JSON.parse(saved) : [];
        if (Array.isArray(list)) {
          list = list.filter((item: any) => item.ci !== electorCi && item.id !== id);
          localStorage.setItem(key, JSON.stringify(list));
          setHistory(list);
        }
      } catch (err) {
        console.error("Error deleting local query history item", err);
      }
      return;
    }

    if (!confirm('¿Seguro que desea eliminar este registro?')) return;
    try {
      setIsLoading(true);
      await api.delete(`/captures/${id}`);
      fetchHistory();
      if (selectedCoordDetail) {
        fetchCoordinatorDetail(selectedCoordDetail);
        fetchMyPadrinoStats();
      }
    } catch (err) {
      setError('No se pudo eliminar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!elector) return;
    const prefix = settings.share_message || '🔹 *DATOS ELECTORALES* 🔹';
    const footer = settings.share_message_footer || '#Intelecciones #PLRA #DíaD';
    const text = `${prefix}\n\n` +
                 `👤 *Nombre:* ${elector.nombre} ${elector.apellido || ''}\n` +
                 `🆔 *C.I.:* ${Number(elector.ci).toLocaleString('es-PY')}\n\n` +
                 `📍 *Local:* ${elector.local_votacion}\n` +
                 `🗳️ *Mesa:* ${elector.mesa}\n` +
                 `🔢 *Orden:* ${elector.orden}\n\n` +
                 `${footer}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Datos Electorales', text: text });
      } catch (err) { console.log('Share error:', err); }
    } else {
      navigator.clipboard.writeText(text);
      alert('Datos copiados al portapapeles');
    }
  };


  // tabProps: all state and handlers passed to sub-components
  const tabProps: any = {
    user, settings, activeDistrict, isReadOnly,
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
    history, setHistory, editingCapture, setEditingCapture,
    colorCounts, locationStats, isStatsLoading,
    disputes, disputesSearchQuery, setDisputesSearchQuery, isDisputesLoading,
    requests, requestMsg, setRequestMsg, requestType, setRequestType,
    supportPhoto, setSupportPhoto, supportAudio, setSupportAudio,
    isRecording, startRecording, stopRecording, handleSendRequest,
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
    isPadrinoVerified,
    showPhotoSource, setShowPhotoSource,
    cropperData, setCropperData,
    fileInputRef, frontCameraInputRef, galleryInputRef,
    padrinoFileInputRef, padrinoFrontCameraInputRef, padrinoGalleryInputRef,
    offlineCount, isDownloading, downloadProgress,
    handleDownloadPadron,
    handleCapture, handleUpdateCapture, handleDeleteCapture,
    handleCreateCoord, handleCreatePadrino,
    fetchHistory, fetchRequests, fetchDisputes, fetchTeamStats,
  };


  if (loading) return null;

  return (
    <MainLayout 
      title={isReadOnly ? "Consulta de Padrón" : "Gestión de Campo"} 
      userName={user?.nombre || "Coordinador"} 
      userPhoto={getImageUrl(user?.photo_url) || ''}
    >
      {isReadOnly && (
        <div style={{
          background: 'var(--accent-subtle)',
          borderBottom: '1px solid var(--border)',
          padding: '0.6rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem'
        }}>
          <Shield size={14} style={{ color: 'var(--plra-300)' }} />
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Modo Consulta (Solo Lectura)
          </span>
        </div>
      )}
      <div
        className="custom-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'clamp(0.75rem, 3vw, 2rem) clamp(0.75rem, 3vw, 1.25rem) 3rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          maxWidth: '640px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div style={{
          display: 'flex',
          gap: '0.25rem',
          border: '1px solid var(--border)',
          marginBottom: '0.75rem',
          padding: '0.25rem',
          borderRadius: '16px',
          background: 'var(--surface-light)',
          width: '100%',
        }}>
          {[
            { id: 'search', icon: <Search size={16} />, label: 'Consulta' },
            { id: 'history', icon: <History size={16} />, label: 'Historial' },
            ...(isReadOnly ? [{ id: 'disputes', icon: <AlertTriangle size={16} />, label: 'Disputas' }] : [{ id: 'support', icon: <HelpCircle size={16} />, label: 'Soporte' }]),
            ...((user?.role === 'PADRINO' || user?.role === 'JEFE_CAMPANA') ? [{ id: 'coordinators', icon: <Users size={16} />, label: user?.role === 'JEFE_CAMPANA' ? 'Padrinos' : 'Equipos' }] : [])
          ].map((item: any) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                padding: '0.5rem 0.25rem',
                borderRadius: '12px',
                fontSize: '0.6rem',
                fontWeight: 800,
                background: activeTab === item.id ? (item.id === 'support' ? 'var(--red)' : 'var(--plra-500)') : 'transparent',
                color: activeTab === item.id ? 'var(--white)' : 'var(--text-2)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'var(--font-display)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'search' && <TabSearch {...tabProps} />}
          {activeTab === 'history' && <TabHistory {...tabProps} />}
          {activeTab === 'support' && <TabSupport {...tabProps} />}
          {activeTab === 'disputes' && <TabDisputes {...tabProps} />}
          {activeTab === 'coordinators' && (user?.role === 'PADRINO' || user?.role === 'JEFE_CAMPANA') && <TabCoordinators {...tabProps} />}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {cropperData && (
          <ImageCropperModal 
            image={cropperData.image} 
            onCropComplete={(croppedBlob) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64data = reader.result as string;
                if (showPadrinoModal) {
                  setNewPadrinoPhoto(base64data);
                } else {
                  setNewCoordPhoto(base64data);
                }
                setCropperData(null);
              };
              reader.readAsDataURL(croppedBlob);
            }} 
            onCancel={() => setCropperData(null)} 
          />
        )}
      </AnimatePresence>
    </MainLayout>
  );
};

export default CoordinatorApp;
