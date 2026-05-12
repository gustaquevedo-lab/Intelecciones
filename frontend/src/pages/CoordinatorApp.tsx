import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, MapPin, User,
  Map, Building2, Home,
  ClipboardCheck, ArrowRight, AlertCircle,
  CheckCheck, ThumbsUp, HelpCircle, X, Shield, Share2, History, Edit2, Trash2, MessageSquare, Fingerprint, Landmark,
  UserPlus, Camera, LayoutList, Users, Mic, Square, ChevronRight,
  Car, Inbox, Truck, Download, Activity
} from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageCropperModal } from '../components/ImageCropperModal';

import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import api, { getImageUrl } from '../services/api';
import { savePadronOffline, searchElectorOffline, getOfflineStats } from '../services/offlineDb';

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
  // Remove everything except digits
  let clean = value.replace(/\D/g, '');
  
  // If starts with 595, keep only what follows to normalize
  if (clean.startsWith('595')) {
    clean = clean.substring(3);
  }
  
  // If starts with 0, remove it (Paraguayan mobile standard)
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  
  // Re-apply prefix if there's any number
  if (clean.length > 0) {
    setter(`+595 ${clean}`);
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
  const [activeTab, setActiveTab] = useState<'search' | 'history' | 'support' | 'coordinators'>('search');
  const [history, setHistory] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [editingCapture, setEditingCapture] = useState<any>(null);
  const [telefono, setTelefono] = useState('');
  const [colorCounts, setColorCounts] = useState<{green: number, yellow: number, red: number, purple: number}>({green: 0, yellow: 0, red: 0, purple: 0});
  const [locationStats, setLocationStats] = useState<any[]>([]);

  const [showCoordModal, setShowCoordModal] = useState(false);
  const [newCoordCI, setNewCoordCI] = useState('');
  const [newCoordName, setNewCoordName] = useState('');
  const [newCoordRealName, setNewCoordRealName] = useState('');
  const [newCoordPhoto, setNewCoordPhoto] = useState<string | null>(null);
  
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    getOfflineStats().then(setOfflineCount);
  }, []);

  const handleDownloadPadron = async () => {
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
      alert(`Padrón descargado con éxito: ${count} electores disponibles offline.`);
    } catch (err: any) {
      console.error('Download error:', err);
      alert('Error al descargar el padrón. Verifique su conexión.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };
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

  const isReadOnly = user?.role === 'CANDIDATO' || user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA';

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'coordinators') {
      if (user?.role === 'JEFE_CAMPANA') fetchMyPadrinos();
      else if (user?.role === 'PADRINO') fetchMyPadrinoStats();
    }
    if (activeTab === 'support') fetchRequests();
  }, [activeTab, user]);

  const fetchRequests = async () => {
    if (!user) return;
    try {
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
             setError('');
             setIsLoading(false);
             return;
          }
          const res = await api.get(`/electors/${ci}`);
          setElector(res.data);
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
        if (electorData.traffic_light) {
          setError(`Este elector ya fue captado (Semáforo: ${electorData.traffic_light})`);
        }
      } else {
        setError('Elector no encontrado en el padrón.');
      }
    } catch {
      const localResults = await searchElectorOffline(ci);
      if (localResults.length > 0) {
        setElector(localResults[0]);
      } else {
        setError('Error al buscar elector. Verifique su conexión.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (isReadOnly) return;
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
    if (!telefono || telefono.length < 10) {
      setError('El número de teléfono es obligatorio.');
      return;
    }
    const activeLocation = location || { lat: editingCapture.lat || 0, lng: editingCapture.lng || 0 };
    try {
      setIsLoading(true);
      await api.put(`/captures/${editingCapture.id}`, {
        lat: activeLocation.lat,
        lng: activeLocation.lng,
        traffic_light: color,
        needs_transport: needsTransport,
        telefono: telefono.replace(/\s/g, '')
      });
      setSuccessMsg('Registro actualizado.');
      setShowModal(false);
      setEditingCapture(null);
      setNeedsTransport(false);
      fetchHistory();
    } catch (err) {
      setError('No se pudo actualizar.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'coordinators') {
      if (user?.role === 'PADRINO') fetchMyCoordinators();
      if (user?.role === 'JEFE_CAMPANA') fetchMyPadrinos();
    }
  }, [activeTab, user]);

  const fetchHistory = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/coordinator/${user.id}/captures`);
      const data = res.data;
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
      if (statsRes.data.locations) {
        setLocationStats(statsRes.data.locations);
      }
    } catch (err) {
      console.error("Error fetching history", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditHistory = (cap: any) => {
    setEditingCapture(cap);
    setNeedsTransport(!!cap.needs_transport);
    setLocation({ lat: cap.lat, lng: cap.lng });
    setTelefono(cap.telefono || '');
    setShowModal(true);
  };

  const handleDeleteCapture = async (id: number) => {
    if (!confirm('¿Seguro que desea eliminar este registro?')) return;
    try {
      setIsLoading(true);
      await api.delete(`/captures/${id}`);
      fetchHistory();
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
            { id: 'support', icon: <HelpCircle size={16} />, label: 'Soporte' },
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

        {activeTab === 'search' ? (
          <>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}>
          {[
            { label: 'Casa', val: colorCounts.green, color: 'var(--green)', bg: 'rgba(34,197,94,0.15)', icon: '🏠' },
            { label: 'Familia', val: colorCounts.yellow, color: 'var(--yellow)', bg: 'rgba(234,179,8,0.12)', icon: '👨‍👩‍👧' },
            { label: 'Otros', val: colorCounts.red, color: 'var(--red)', bg: 'rgba(239,68,68,0.12)', icon: '📍' },
            { label: 'Voluntarios', val: colorCounts.purple, color: '#A855F7', bg: 'rgba(168,85,247,0.15)', icon: '✨' },
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
              {/* Subtle glow effect */}
              <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '40%', height: '40%', background: stat.color, filter: 'blur(20px)', opacity: 0.15 }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                  {stat.icon}
                </div>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>{stat.val}</span>
              </div>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: stat.color, textTransform: 'uppercase', letterSpacing: '0.12em', position: 'relative', zIndex: 1 }}>{stat.label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <SectionLabel icon={<MapPin size={13} />} text="Avance por Local" />
          <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', margin: '0 -0.25rem' }} className="no-scrollbar">
            {locationStats.filter(loc => loc.total_captures > 0).map((loc: any) => (
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
                <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 600, margin: 0, textAlign: 'center' }}>
                  Total Local: {loc.total_electors.toLocaleString('es-PY')}
                </p>
              </div>
            ))}
            {locationStats.filter(loc => loc.total_captures > 0).length === 0 && (
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)', borderRadius: '12px', width: '100%', textAlign: 'center' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 600 }}>Inicia una captura para ver estadísticas.</p>
              </div>
            )}
          </div>
        </div>

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
        </>
        ) : activeTab === 'history' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <SectionLabel icon={<History size={13} />} text="Mis Capturas Recientes" />
            {history.length === 0 && !isLoading && (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', opacity: 0.5 }}>
                <ClipboardCheck size={40} style={{ marginBottom: '1rem', color: 'var(--text-3)' }} />
                <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>Aún no has registrado ningún elector.</p>
              </div>
            )}
            {history.map((cap) => (
              <motion.div key={cap.id} layout style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: cap.traffic_light === 'GREEN' ? 'rgba(34,197,94,0.1)' : cap.traffic_light === 'YELLOW' ? 'rgba(245,158,11,0.1)' : cap.traffic_light === 'PURPLE' ? 'rgba(168,85,247,0.1)' : 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: cap.traffic_light === 'GREEN' ? 'var(--green)' : cap.traffic_light === 'YELLOW' ? 'var(--yellow)' : cap.traffic_light === 'PURPLE' ? '#A855F7' : 'var(--red)', border: '1px solid currentColor' }}>
                   <User size={20} />
                 </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>{cap.nombre} {cap.apellido}</h4>
                    {cap.needs_transport === 1 && <span style={{ fontSize: '0.55rem', fontWeight: 800, background: 'var(--plra-300)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>🚗 TRANSPORTE</span>}
                  </div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>CI: {Number(cap.elector_ci).toLocaleString('es-PY')} • {cap.local_votacion}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleEditHistory(cap)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem', color: 'var(--text-2)', cursor: 'pointer' }}><Edit2 size={14} /></button>
                  <button onClick={() => handleDeleteCapture(cap.id)} style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '0.5rem', color: 'var(--red)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : activeTab === 'support' ? (
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
        ) : null}
        
        {activeTab === 'coordinators' && (user?.role === 'PADRINO' || user?.role === 'JEFE_CAMPANA') && (
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
        )}
      </div>

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
                      
                      {cap.telefono && (
                        <a 
                          href={`https://wa.me/${formatWhatsApp(cap.telefono)}`} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ background: '#25D366', color: 'white', padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                          <MessageSquare size={12} /> WHATSAPP
                        </a>
                      )}
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
              zIndex: 9000,
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
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text"
                      inputMode="tel"
                      placeholder="+595 9xx xxx xxx"
                      value={telefono}
                      onChange={(e) => handlePhoneChange(e.target.value, setTelefono)}
                      className="modern-input-premium-styled"
                      style={{ paddingLeft: '2.8rem', fontSize: '1rem', fontWeight: 700 }}
                    />
                    <MessageSquare size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--plra-300)' }} />
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
              <form onSubmit={handleCreateCoordinator}>
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
                      <input 
                        className="modern-input-premium-styled" 
                        style={{ height: '44px', fontSize: '0.9rem' }} 
                        placeholder="+595 9xx xxx xxx"
                        value={newCoordTelefono}
                        onChange={e => handlePhoneChange(e.target.value, setNewCoordTelefono)}
                      />
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
                    <input 
                      className="modern-input-premium-styled" 
                      placeholder="+595 9xx xxx xxx"
                      value={newPadrinoTelefono} 
                      onChange={e => handlePhoneChange(e.target.value, setNewPadrinoTelefono)} 
                      required
                    />
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
