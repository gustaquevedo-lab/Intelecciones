import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, MapPin, User, CheckCircle2,
  Map, Building2, Home, Briefcase,
  ClipboardCheck, ArrowRight, AlertCircle,
  CheckCheck, ThumbsUp, HelpCircle, ThumbsDown, X, Shield, Share2, History, Edit2, Trash2, Phone, MessageSquare,
  UserPlus, Camera, Settings, LayoutList, CheckCircle
} from 'lucide-react';
import axios from 'axios';
import MainLayout from '../components/MainLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageCropperModal } from '../components/ImageCropperModal';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';

/* ─── tiny reusable pieces ─────────────────────────────── */

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
    <div className={`icon-box icon-box-md icon-box-${iconColor}`} style={{ borderRadius: '10px', marginTop: '2px' }}>
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

/* ─── main component ────────────────────────────────────── */

const CoordinatorApp = () => {
  const { user, loading } = useAuth();
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
  const [requestMsg, setRequestMsg] = useState('');
  const [requestType, setRequestType] = useState('RESOURCES');
  const [colorCounts, setColorCounts] = useState<{green: number, yellow: number, red: number, purple: number}>({green: 0, yellow: 0, red: 0, purple: 0});
  
  // Padrino specifics
  const [myCoordinators, setMyCoordinators] = useState<any[]>([]);
  const [showCoordModal, setShowCoordModal] = useState(false);
  const [newCoordCI, setNewCoordCI] = useState('');
  const [newCoordName, setNewCoordName] = useState('');
  const [newCoordRealName, setNewCoordRealName] = useState('');
  const [newCoordPhoto, setNewCoordPhoto] = useState<string | null>(null);
  const [newCoordTelefono, setNewCoordTelefono] = useState('');
  const [isCoordVerified, setIsCoordVerified] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Jefe de Campaña specifics
  const [myPadrinos, setMyPadrinos] = useState<any[]>([]);
  const [showPadrinoModal, setShowPadrinoModal] = useState(false);
  const [newPadrinoCI, setNewPadrinoCI] = useState('');
  const [newPadrinoRealName, setNewPadrinoRealName] = useState('');
  const [newPadrinoPhoto, setNewPadrinoPhoto] = useState<string | null>(null);
  const [newPadrinoTelefono, setNewPadrinoTelefono] = useState('');
  const [isPadrinoVerified, setIsPadrinoVerified] = useState(false);

  // Cropper states
  const [cropperData, setCropperData] = useState<{ image: string } | null>(null);

  const onCropComplete = (croppedImage: string) => {
    setNewCoordPhoto(croppedImage);
    setCropperData(null);
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  const handleSendRequest = async () => {
    if (!requestMsg || !user) return;
    setIsLoading(true);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      await axios.post(`${API_URL}/api/coordinator/request`, {
        coordinator_id: user.id,
        type: requestType,
        description: requestMsg,
        priority: 'NORMAL'
      });
      setSuccessMsg('Solicitud enviada al Comando Central.');
      setRequestMsg('');
      setActiveTab('search');
    } catch (err) {
      setError('No se pudo enviar la solicitud.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyCoordinators = async () => {
    if (!user) return;
    try {
      const res = await api.get(`/users?parent_id=${user.id}`);
      // The backend /api/users returns all users, so we filter here if needed, 
      // but I should ideally have an endpoint for this.
      // For now, let's assume we can filter or the backend supports the query param.
      setMyCoordinators(res.data.filter((u: any) => u.parent_id === user.id));
    } catch (err) {
      console.error("Error fetching my coordinators", err);
    }
  };

  useEffect(() => {
    if (user?.role === 'PADRINO' && activeTab === 'history') {
      fetchMyCoordinators();
    }
  }, [user, activeTab]);

  const handleLookupCoordCI = async () => {
    if (!newCoordCI) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/electors/${newCoordCI}`);
      setNewCoordRealName(`${res.data.nombre} ${res.data.apellido}`);
      setNewCoordName(newCoordCI); // Default username is CI
      setIsCoordVerified(true);
      setError('');
    } catch (err) {
      setError('Cédula no encontrada en el padrón.');
      setIsCoordVerified(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCoordinator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCoordVerified || !newCoordPhoto) {
      setError('Debe verificar la cédula e incluir una foto.');
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/users', {
        username: newCoordName,
        password: newCoordCI, // Default password is CI
        nombre: newCoordRealName,
        role: 'COORDINADOR',
        parent_id: user?.id,
        photo_url: newCoordPhoto,
        telefono: newCoordTelefono,
        assigned_list_id: user?.assigned_list_id,
        assigned_campaign_id: user?.assigned_campaign_id
      });
      setSuccessMsg('Coordinador creado correctamente.');
      setShowCoordModal(false);
      setNewCoordCI('');
      setNewCoordPhoto(null);
      setNewCoordRealName('');
      setNewCoordTelefono('');
      setIsCoordVerified(false);
      fetchMyCoordinators();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear coordinador');
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
        password: newPadrinoCI,
        nombre: newPadrinoRealName,
        role: 'PADRINO',
        parent_id: user?.id,
        photo_url: newPadrinoPhoto,
        telefono: newPadrinoTelefono,
        assigned_campaign_id: user?.assigned_campaign_id
      });
      setSuccessMsg('Padrino creado correctamente.');
      setShowPadrinoModal(false);
      setNewPadrinoCI('');
      setNewPadrinoPhoto(null);
      setNewPadrinoTelefono('');
      setIsPadrinoVerified(false);
      fetchMyPadrinos();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear padrino');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) return null;

  const isReadOnly = user?.role === 'CANDIDATO' || user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA';

  useEffect(() => {
    const lookup = async () => {
      if (ci.length >= 5 && activeTab === 'search') {
        try {
          setIsLoading(true);
          const res = await api.get(`/electors/${ci}`);
          setElector(res.data);
          setError('');
        } catch (err: any) {
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
      const res = await api.get(`/electors/${ci}`);
      setElector(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Cédula no encontrada en el padrón.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (isReadOnly) return;
    setIsLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setShowModal(true);
        setIsLoading(false);
      },
      () => {
        setError('Debes permitir el acceso a tu ubicación GPS para capturar el voto.');
        setIsLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleCapture = async (color: 'GREEN' | 'YELLOW' | 'RED' | 'PURPLE') => {
    if (!elector || !location || isReadOnly || !user) return;
    if (!telefono || telefono.length < 10) {
      setError('El número de teléfono es obligatorio para registrar al elector.');
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/captures', {
        elector_ci: elector.ci,
        coordinator_id: user.id,
        lat: location.lat,
        lng: location.lng,
        traffic_light: color,
        needs_transport: needsTransport,
        telefono: telefono.replace(/\s/g, '')
      });
      setSuccessMsg('¡Captura guardada correctamente!');
      setShowModal(false);
      setTimeout(() => {
        setCi(''); setElector(null); setSuccessMsg(''); setLocation(null); setNeedsTransport(false); setTelefono('');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar la captura');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/coordinators/${user.id}/history`);
      setHistory(res.data);
    } catch (err) {
      console.error("Error fetching history", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
    if (activeTab === 'coordinators') {
      fetchMyCoordinators();
    }
    if (activeTab === 'coordinators' && user?.role === 'JEFE_CAMPANA') {
      fetchMyPadrinos();
    }
  }, [activeTab]);

  useEffect(() => {
    if (showModal && user?.id) {
      api.get(`/coordinators/${user.id}/stats`)
        .then(res => {
          setColorCounts({
            green: res.data.green || 0,
            yellow: res.data.yellow || 0,
            red: res.data.red || 0,
            purple: res.data.purple || 0
          });
        })
        .catch(err => console.error('Error fetching color counts', err));
    }
  }, [showModal, user?.id]);

  const handleEditHistory = (cap: any) => {
    setEditingCapture(cap);
    setNeedsTransport(!!cap.needs_transport);
    setLocation({ lat: cap.lat, lng: cap.lng });
    setTelefono(cap.telefono || '');
    setShowModal(true);
  };

  const handleUpdateCapture = async (color: string) => {
    if (!editingCapture || !location) return;
    if (!telefono || telefono.length < 10) {
      setError('El número de teléfono es obligatorio.');
      return;
    }
    try {
      setIsLoading(true);
      await api.put(`/captures/${editingCapture.id}`, {
        lat: location.lat,
        lng: location.lng,
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
    const text = `🔹 *DATOS ELECTORALES - INTELECCIONES 2026* 🔹\n\n` +
                 `👤 *Nombre:* ${elector.nombre}\n` +
                 `🆔 *C.I.:* ${Number(elector.ci).toLocaleString('es-PY')}\n\n` +
                 `📍 *Local:* ${elector.local_votacion}\n` +
                 `🗳️ *Mesa:* ${elector.mesa}\n` +
                 `🔢 *Orden:* ${elector.orden}\n\n` +
                 `#Intelecciones #PLRA #DíaD`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Datos Electorales',
          text: text
        });
      } catch (err) { console.log('Share error:', err); }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(text);
      alert('Datos copiados al portapapeles');
    }
  };

  const formatWhatsApp = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    if (cleaned.startsWith('09')) {
      cleaned = '5959' + cleaned.substring(2);
    } else if (cleaned.startsWith('9')) {
      cleaned = '595' + cleaned;
    } else if (cleaned.startsWith('595')) {
      // ok
    } 
    
    if (cleaned.length > 0) {
      setTelefono('+' + cleaned);
    } else {
      setTelefono('');
    }
  };

  /* ─── render ──────────────────────────────────────────── */
  return (
    <MainLayout 
      title={isReadOnly ? "Consulta de Padrón" : "Gestión de Campo"} 
      userName={user?.nombre || "Coordinador"} 
      userPhoto={user?.photo_url}
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
          background: 'rgba(2,8,20,0.4)',
          borderRadius: '16px',
          padding: '0.4rem',
          gap: '0.4rem',
          border: '1px solid var(--border)',
          marginBottom: '0.5rem'
        }}>
          <button
            onClick={() => setActiveTab('search')}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 800,
              background: activeTab === 'search' ? 'var(--plra-300)' : 'transparent',
              color: activeTab === 'search' ? 'white' : 'var(--text-3)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}
          >
            <Search size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Consulta
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 800,
              background: activeTab === 'history' ? 'var(--plra-300)' : 'transparent',
              color: activeTab === 'history' ? 'white' : 'var(--text-3)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}
          >
            <History size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Historial
          </button>
          <button
            onClick={() => setActiveTab('support')}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 800,
              background: activeTab === 'support' ? 'var(--red)' : 'transparent',
              color: activeTab === 'support' ? 'white' : 'var(--text-3)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}
          >
            <HelpCircle size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Soporte
          </button>
          {user?.role === 'PADRINO' && (
            </button>
          )}
          {user?.role === 'JEFE_CAMPANA' && (
            <button
              onClick={() => setActiveTab('coordinators')}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 800,
                background: activeTab === 'coordinators' ? 'var(--blue-lt)' : 'transparent',
                color: activeTab === 'coordinators' ? 'white' : 'var(--text-3)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'var(--font-display)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
              }}
            >
              <UsersIcon size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Padrinos
            </button>
          )}
        </div>

        {activeTab === 'search' ? (
          <>

        {/* ══════════════════════════════════════
            SEARCH PANEL
        ══════════════════════════════════════ */}
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
          {/* Overline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <div style={{ width: '3px', height: '16px', borderRadius: '2px', background: 'var(--plra-300)', boxShadow: '0 0 8px var(--plra-300)' }} />
            <span style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-display)' }}>
              Consulta de Padrón Electoral
            </span>
          </div>

          {/* Search form */}
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

          {/* Error */}
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

        {/* ══════════════════════════════════════
            ELECTOR CARD
        ══════════════════════════════════════ */}
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

              {/* ── Card Header: Identity ── */}
              <div className="card-header-section" style={{
                background: 'linear-gradient(135deg, rgba(0,47,120,0.6) 0%, rgba(7,29,56,0.8) 100%)',
                borderBottom: '1px solid var(--border-mid)',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Watermark */}
                <div style={{
                  position: 'absolute', right: '-0.5rem', bottom: '-1rem',
                  fontSize: '4.5rem', fontWeight: 900, color: 'rgba(59,130,246,0.04)',
                  fontFamily: 'var(--font-display)', letterSpacing: '-0.05em',
                  userSelect: 'none', pointerEvents: 'none', lineHeight: 1,
                }}>PLRA</div>

                {/* Status badge */}
                <div className="badge badge-green" style={{ position: 'absolute', top: '0.85rem', right: '0.85rem' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--green)', animation: 'pulse-dot 2s infinite', display: 'inline-block' }} />
                  Activo
                </div>

                {/* Avatar + Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', paddingRight: '4.5rem' }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--plra-500) 0%, var(--plra-400) 100%)',
                    border: '2px solid rgba(59,130,246,0.4)',
                    boxShadow: '0 6px 18px rgba(0,71,171,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem', fontWeight: 800, color: 'rgba(255,255,255,0.9)',
                    fontFamily: 'var(--font-display)',
                  }}>
                    {elector.nombre?.charAt(0) ?? <User size={24} />}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 }}>
                    <h2 style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700,
                      fontSize: 'clamp(0.95rem, 3.5vw, 1.3rem)',
                      color: 'var(--text)', lineHeight: 1.2,
                      textTransform: 'uppercase', letterSpacing: '-0.01em',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {elector.nombre} {elector.apellido}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.2rem 0.65rem',
                        background: 'rgba(0,71,171,0.25)', border: '1px solid rgba(59,130,246,0.35)',
                        borderRadius: '7px', width: 'fit-content',
                      }}>
                        <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--plra-200)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}>C.I.</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', letterSpacing: '0.05em' }}>
                          {Number(elector.ci).toLocaleString('es-PY')}
                        </span>
                      </div>
                      
                      {/* JLRA TAG */}
                      {(elector.edad && elector.edad <= 30) && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.2rem 0.75rem',
                          background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', // Gold/Orange for JLRA visibility
                          border: '1px solid rgba(255,255,255,0.3)',
                          borderRadius: '7px',
                          boxShadow: '0 4px 12px rgba(255,165,0,0.3)',
                        }}>
                          <span style={{ 
                            fontSize: '0.65rem', 
                            fontWeight: 900, 
                            color: '#002F78', 
                            letterSpacing: '0.15em', 
                            fontFamily: 'var(--font-display)' 
                          }}>
                            JLRA
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Share Button — top right */}
                <button
                  onClick={handleShare}
                  style={{
                    position: 'absolute',
                    top: '3.5rem',
                    right: '1rem',
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'var(--plra-200)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    zIndex: 5
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                >
                  <Share2 size={18} />
                </button>
              </div>

              {/* ── Section 1: Voting Location ── */}
              <div className="card-section">
                <SectionLabel icon={<Map size={13} />} text="Asignación de Local" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <DataItem icon={<Building2 size={16} />} iconColor="blue" label="Establecimiento de Votación" value={elector.local_votacion} />
                  <div style={{ display: 'flex', gap: '0.65rem' }}>
                    <NumberBadge label="Mesa No." value={elector.mesa} />
                    <NumberBadge label="Orden No." value={elector.orden} />
                  </div>
                </div>
              </div>

              {/* ── Section 2: Territory ── */}
              <div className="card-section">
                <SectionLabel icon={<MapPin size={13} />} text="Ubicación Territorial" color="var(--green)" />
                <div className="territory-grid">
                  <DataItem icon={<Home size={16} />} iconColor="green" label="Barrio / Residencia" value={elector.barrio || 'San Antonio'} />
                  <DataItem icon={<Briefcase size={16} />} iconColor="teal" label="Comité / Distrito" value={elector.distrito || 'Distrito 1'} />
                </div>
              </div>

              {/* ── CTA Button ── */}
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
                    cursor: isReadOnly ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isLoading ? <Spinner size={20} /> : (
                    isReadOnly ? (
                      <><Search size={20} /> Perfil Solo Consulta</>
                    ) : (
                      <><ClipboardCheck size={20} strokeWidth={2.5} />Registrar Elector</>
                    )
                  )}
                </button>
              </div>
            </motion.article>
          )}

          {/* ══════════════════════════════════════
              SUCCESS STATE
          ══════════════════════════════════════ */}
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

        {/* ══════════════════════════════════════
            EMPTY STATE
        ══════════════════════════════════════ */}
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
              opacity: 0.35,
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
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <SectionLabel icon={<HelpCircle size={13} />} text="Solicitar Apoyo al Comando" />
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '1.5rem' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '1.25rem' }}>Describe brevemente lo que necesitas. Tu solicitud llegará al Comando Central.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <button onClick={() => setRequestType('TRANSPORT')} style={{ padding: '0.75rem', borderRadius: '10px', background: requestType === 'TRANSPORT' ? 'var(--plra-500)' : 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Logística</button>
                <button onClick={() => setRequestType('RESOURCES')} style={{ padding: '0.75rem', borderRadius: '10px', background: requestType === 'RESOURCES' ? 'var(--plra-500)' : 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Recursos</button>
              </div>

              <textarea 
                value={requestMsg}
                onChange={(e) => setRequestMsg(e.target.value)}
                placeholder="Escribe aquí tu solicitud..."
                style={{ width: '100%', height: '120px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', color: 'white', fontSize: '0.9rem', outline: 'none', resize: 'none', marginBottom: '1.5rem' }}
              />

              <button 
                onClick={handleSendRequest}
                disabled={!requestMsg || isLoading}
                className="btn btn-primary" 
                style={{ width: '100%', borderRadius: '12px', height: '3.5rem' }}
              >
                {isLoading ? <Spinner /> : 'Enviar Solicitud'}
              </button>
            </div>
          </motion.div>
        )}
        
        {activeTab === 'coordinators' && (user?.role === 'PADRINO' || user?.role === 'JEFE_CAMPANA') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionLabel 
                icon={<UsersIcon size={13} />} 
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

            {(user?.role === 'JEFE_CAMPANA' ? myPadrinos : myCoordinators).length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed var(--border)' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Aún no tienes registros bajo tu cargo.</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              {(user?.role === 'JEFE_CAMPANA' ? myPadrinos : myCoordinators).map(c => (
                <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '45px', height: '45px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    {c.photo_url ? (
                      <img src={c.photo_url} alt={c.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'var(--surface-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={20} style={{ color: 'var(--text-3)' }} />
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h5 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{c.nombre}</h5>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', margin: 0 }}>CI: {Number(c.username).toLocaleString('es-PY')} {c.telefono && `• ${c.telefono}`}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-green" style={{ fontSize: '0.5rem' }}>{c.role === 'PADRINO' ? 'Padrino' : 'Activo'}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          SEMAPHORE MODAL
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showModal && (
          <motion.div
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
              <div style={{ padding: '1.25rem 1.75rem 1.5rem', textAlign: 'center', position: 'relative' }}>
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
                    {(elector || editingCapture).nombre} {(elector || editingCapture).apellido}
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
                      onChange={(e) => formatWhatsApp(e.target.value)}
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
                    <Briefcase size={18} style={{ color: needsTransport ? 'var(--plra-300)' : 'var(--text-3)' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>Necesita Transporte 🚗</span>
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
                   { color: 'GREEN',  bg: 'linear-gradient(160deg, #22C55E 0%, #15803D 100%)', glow: 'rgba(34,197,94,0.5)',  border: 'rgba(34,197,94,0.35)', count: colorCounts.green },
                   { color: 'YELLOW', bg: 'linear-gradient(160deg, #FBBF24 0%, #D97706 100%)', glow: 'rgba(251,191,36,0.5)', border: 'rgba(251,191,36,0.35)', count: colorCounts.yellow },
                   { color: 'RED',    bg: 'linear-gradient(160deg, #EF4444 0%, #B91C1C 100%)', glow: 'rgba(239,68,68,0.5)',  border: 'rgba(239,68,68,0.35)', count: colorCounts.red },
                   { color: 'PURPLE', bg: 'linear-gradient(160deg, #A855F7 0%, #7E22CE 100%)', glow: 'rgba(168,85,247,0.5)', border: 'rgba(168,85,247,0.35)', count: colorCounts.purple },
                 ].map(({ color, bg, glow, border, count }) => (
                    <motion.button
                      key={color}
                      whileHover={{ scale: 1.04, y: -3 }}
                      whileTap={{ scale: 0.94 }}
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
                          {color === 'GREEN' ? <ThumbsUp size={24} /> : color === 'YELLOW' ? <HelpCircle size={24} /> : color === 'RED' ? <ThumbsDown size={24} /> : <AlertCircle size={24} />}
                          <span style={{ fontSize: '0.5rem', fontWeight: 900 }}>{color === 'PURPLE' ? 'ATENCIÓN' : color}</span>
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay-premium"
            style={{ zIndex: 9999 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-content-premium-styled"
              style={{ maxWidth: '500px', width: '100%', padding: 0 }}
            >
              <form onSubmit={handleCreateCoordinator}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', background: 'linear-gradient(to bottom, rgba(0,71,171,0.05), transparent)' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Registrar Miembro de Equipo</h3>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>ASIGNACIÓN DIRECTA BAJO TU LIDERAZGO</p>
                </div>

                <div style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      style={{ 
                        width: '100px', height: '100px', borderRadius: '15px', 
                        background: 'var(--surface-light)', border: '2px dashed var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', overflow: 'hidden', position: 'relative'
                      }}
                    >
                      {newCoordPhoto ? (
                        <img src={newCoordPhoto} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Camera size={32} style={{ color: 'var(--text-3)' }} />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--plra-300)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Cédula de Identidad</label>
                      <div className="search-input-wrapper-premium">
                        <input 
                          className="modern-input-premium-styled" 
                          value={newCoordCI}
                          onChange={e => setNewCoordCI(e.target.value)}
                          placeholder="Buscar CI..."
                        />
                        <button type="button" onClick={handleLookupCoordCI} className="search-btn-action">BUSCAR</button>
                      </div>
                    </div>
                  </div>

                  {isCoordVerified && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="form-group">
                      <label style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--plra-300)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Nombre Completo</label>
                      <input className="modern-input-premium-styled" value={newCoordRealName} readOnly style={{ opacity: 0.8 }} />
                    </motion.div>
                  )}

                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--plra-300)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Teléfono (WhatsApp)</label>
                    <input 
                      className="modern-input-premium-styled" 
                      placeholder="+595 9xx xxx xxx"
                      value={newCoordTelefono} 
                      onChange={e => setNewCoordTelefono(e.target.value)} 
                    />
                  </div>

                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept="image/*" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setCropperData({ image: event.target?.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }} 
                  />
                </div>

                <div className="modal-footer-premium-styled" style={{ padding: '1.25rem 2rem' }}>
                  <button type="button" onClick={() => setShowCoordModal(false)} className="btn-cancel-styled">Cancelar</button>
                  <button type="submit" className="btn-confirm-styled" disabled={!isCoordVerified || !newCoordPhoto || isLoading}>
                    {isLoading ? <Spinner size={16} /> : 'Crear Usuario'}
                  </button>
                </div>
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay-premium"
            style={{ zIndex: 9999 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-content-premium-styled"
              style={{ maxWidth: '500px', width: '100%', padding: 0 }}
            >
              <form onSubmit={handleCreatePadrino}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', background: 'linear-gradient(to bottom, rgba(0,71,171,0.05), transparent)' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Registrar Nuevo Padrino</h3>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>ADMINISTRADOR DE EQUIPO BAJO TU CARGO</p>
                </div>

                <div style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
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
                          onChange={e => setNewPadrinoCI(e.target.value)}
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
                      onChange={e => setNewPadrinoTelefono(e.target.value)} 
                      required
                    />
                  </div>

                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept="image/*" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setCropperData({ image: event.target?.result as string });
                        };
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
            onCropComplete={(croppedImage) => {
              if (showPadrinoModal) {
                setNewPadrinoPhoto(croppedImage);
              } else {
                setNewCoordPhoto(croppedImage);
              }
              setCropperData(null);
            }} 
            onCancel={() => setCropperData(null)} 
          />
        )}
      </AnimatePresence>
    </MainLayout>
  );
};

export default CoordinatorApp;
