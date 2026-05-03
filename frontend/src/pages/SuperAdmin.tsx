import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  UserPlus, 
  Flag, 
  Users as UsersIcon, 
  ListOrdered, 
  Activity,
  CheckCircle2,
  XCircle,
  Building2,
  Home,
  Check,
  ChevronRight,
  User,
  ShieldCheck,
  Layout,
  Camera,
  Shield,
  History,
  LayoutList,
  Users,
  MapPin,
  Map,
  Landmark,
  School,
  Building,
  Settings,
  AlertTriangle,
  FileText,
  Download,
  Calendar,
  Truck,
  Clock,
  PlusCircle,
  Save,
  Key
} from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { AdminSidebar } from '../components/AdminSidebar';
import { ManagementTable } from '../components/ManagementTable';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageCropperModal } from '../components/ImageCropperModal';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CountdownCard } from '../components/CountdownCard';
import api from '../services/api';

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ICON_SVGS: Record<string, string> = {
  Landmark: `<polygon points="12 2 22 7 2 7 12 2"></polygon><line x1="3" y1="22" x2="21" y2="22"></line><line x1="6" y1="18" x2="6" y2="11"></line><line x1="10" y1="18" x2="10" y2="11"></line><line x1="14" y1="18" x2="14" y2="11"></line><line x1="18" y1="18" x2="18" y2="11"></line>`,
  School: `<path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>`,
  Building: `<rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22"></line><line x1="15" y1="22" x2="15" y2="22"></line><line x1="12" y1="18" x2="12" y2="18"></line><line x1="12" y1="14" x2="12" y2="14"></line><line x1="12" y1="10" x2="12" y2="10"></line><line x1="12" y1="6" x2="12" y2="6"></line><line x1="8" y1="18" x2="8" y2="18"></line><line x1="8" y1="14" x2="8" y2="14"></line><line x1="8" y1="10" x2="8" y2="10"></line><line x1="8" y1="6" x2="8" y2="6"></line><line x1="16" y1="18" x2="16" y2="18"></line><line x1="16" y1="14" x2="16" y2="14"></line><line x1="16" y1="10" x2="16" y2="10"></line><line x1="16" y1="6" x2="16" y2="6"></line>`,
  Home: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>`,
  MapPin: `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>`,
  Truck: `<path d="M10 17h4V5H2v12h3m15 0h2v-3.34a2 2 0 0 0-.73-1.5l-2.47-1.96A2 2 0 0 0 15 12.71V17h2m-7 0a2 2 0 1 1-4 0m10 0a2 2 0 1 1-4 0"></path>`
};

const createCustomIcon = (color: string, iconName: string = 'Landmark', size: number = 30) => {
  const svgSize = Math.floor(size * 0.6);
  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: ${size > 24 ? '8px' : '50%'};
        border: 1.5px solid rgba(255,255,255,0.8);
        box-shadow: 0 3px 10px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.2);
        transition: transform 0.2s;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          ${ICON_SVGS[iconName || 'Landmark'] || ICON_SVGS.Landmark}
        </svg>
      </div>
    `,
    className: 'custom-div-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
};

const BLUE_ICON = createCustomIcon('var(--plra-500)');

// --- Types ---
interface Campaign {
  id: number;
  name: string;
  status: string;
}

interface List {
  id: number;
  campaign_id: number;
  campaign_name?: string;
  type: string;
  list_number: string;
  option_number: string;
  candidate_ci: string;
  candidate_nombre?: string;
  candidate_apellido?: string;
}

import { useSettings } from '../context/SettingsContext';

interface User {
  id: number;
  username: string;
  role: string;
  nombre: string;
  assigned_list_id?: number;
  list_number?: string;
}

const SuperAdmin = () => {
  const { user: authUser, loading, updateUser } = useAuth();
  const { settings: globalSettings, updateSettings, refreshSettings } = useSettings();
  const navigate = useNavigate();
  console.log("SuperAdmin - authUser:", authUser, "loading:", loading);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [locales, setLocales] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditStats, setAuditStats] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any>(null);
  const [pendingLogistics, setPendingLogistics] = useState<any[]>([]);
  const [captures, setCaptures] = useState<any[]>([]);
  
  // Audit Filters
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditFilterUser, setAuditFilterUser] = useState('');
  const [auditFilterStart, setAuditFilterStart] = useState('');
  const [auditFilterEnd, setAuditFilterEnd] = useState('');
  const [electionDate, setElectionDate] = useState('2026-06-07T07:00:00');
  const [electionEndTime, setElectionEndTime] = useState('17:00');
  const [globalGoal, setGlobalGoal] = useState(10000);
  const [masterKey, setMasterKey] = useState('');
  const [appName, setAppName] = useState('INTELECCIONES 2026');
  const [appLogoUrl, setAppLogoUrl] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isUserVerified, setIsUserVerified] = useState(false);
  const [isCandidateVerified, setIsCandidateVerified] = useState(false);
  const [isVehicleDriverVerified, setIsVehicleDriverVerified] = useState(false);

  // Vehicle states
  const [newVehicleDesc, setNewVehicleDesc] = useState('');
  const [newVehicleDriver, setNewVehicleDriver] = useState('');
  const [newVehiclePhone, setNewVehiclePhone] = useState('');
  const [newVehicleDriverCI, setNewVehicleDriverCI] = useState('');
  const [newVehicleCapacity, setNewVehicleCapacity] = useState(4);
  const [newVehicleStatus, setNewVehicleStatus] = useState<'AVAILABLE' | 'IN_TRANSIT' | 'MAINTENANCE'>('AVAILABLE');
  const [newVehicleList, setNewVehicleList] = useState('');

  // Locale State
  const [editingLocale, setEditingLocale] = useState<any>(null);
  const [newLocaleCod, setNewLocaleCod] = useState('');
  const [newLocaleNombre, setNewLocaleNombre] = useState('');
  const [newLocaleDireccion, setNewLocaleDireccion] = useState('');
  const [newLocaleLat, setNewLocaleLat] = useState<string>('');
  const [newLocaleLng, setNewLocaleLng] = useState<string>('');
  const [newLocaleIcon, setNewLocaleIcon] = useState('Landmark');

  const formatPhone = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    if (cleaned.startsWith('09')) {
      cleaned = '5959' + cleaned.substring(2);
    } else if (cleaned.startsWith('9')) {
      cleaned = '595' + cleaned;
    } 
    
    if (cleaned.length > 0) {
      setNewVehiclePhone('+' + cleaned);
    } else {
      setNewVehiclePhone('');
    }
  };

  const handleWipeCaptures = async () => {
    const confirm1 = confirm(
      "🛑 SISTEMA DE SEGURIDAD CRÍTICA\n\n" +
      "Esta acción realizará un RESETEO TOTAL de los datos de campo:\n" +
      "• Se borrarán TODAS las capturas realizadas por coordinadores.\n" +
      "• Se eliminará el historial de traslados y logística.\n" +
      "• Se reiniciarán los estados de electores a 'Pendiente'.\n\n" +
      "¿Está ABSOLUTAMENTE SEGURO de que desea proceder?"
    );
    if (!confirm1) return;

    const key = prompt('NIVEL DE SEGURIDAD 2: Ingrese la LLAVE MAESTRA para autorizar la purga:');
    if (!key) return;
    
    const finalCheck = prompt('CONFIRMACIÓN FINAL: Escriba "LIMPIAR SISTEMA" para ejecutar la acción irreversible:');
    if (finalCheck !== "LIMPIAR SISTEMA") {
      alert("Operación cancelada.");
      return;
    }

    try {
      setIsLoading(true);
      await api.post('/admin/system/wipe-captures', { key });
      alert('✅ SISTEMA LIMPIO: Todas las capturas de prueba han sido eliminadas.');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Llave Maestra incorrecta');
    } finally {
      setIsLoading(false);
    }
  };

  // Form states
  const [showModal, setShowModal] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editingList, setEditingList] = useState<List | null>(null);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignSlogan, setNewCampaignSlogan] = useState('');
  const [newCampaignPhotoUrl, setNewCampaignPhotoUrl] = useState('');
  const [newCampaignModules, setNewCampaignModules] = useState<string[]>(['COMMAND_CENTER', 'REGISTRY', 'LOGISTICS', 'WHATSAPP']);
  const [newUserName, setNewUserName] = useState('');
  const [takenOptions, setTakenOptions] = useState<number[]>([]);
  const [hasIntendente, setHasIntendente] = useState(false);
  const [intendenteListNumber, setIntendenteListNumber] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState('COORDINADOR');
  const [newUserRealName, setNewUserRealName] = useState('');
  const [newUserCI, setNewUserCI] = useState('');
  const [newUserList, setNewUserList] = useState('');
  const [newUserCampaign, setNewUserCampaign] = useState('');
  const [userProfilePreview, setUserProfilePreview] = useState<any>(null);
  const [newUserLocal, setNewUserLocal] = useState('');
  const [newUserMesa, setNewUserMesa] = useState<number | null>(null);
  // List Form
  const [newListCampaign, setNewListCampaign] = useState('');
  const [newListType, setNewListType] = useState('INTENDENTE');
  const [newListNumber, setNewListNumber] = useState('');
  const [newListOption, setNewListOption] = useState('');
  const [newListCandidateCI, setNewListCandidateCI] = useState('');
  const [newListAlias, setNewListAlias] = useState('');
  const [candidatePreview, setCandidatePreview] = useState<any>(null);
  const [newListGoal, setNewListGoal] = useState(1000);
  const [listPhotoUrl, setListPhotoUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropperData, setCropperData] = useState<{ image: string, type: 'user' | 'list' | 'app' | 'campaign' } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'user' | 'list' | 'app' | 'campaign') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setCropperData({ image: reader.result as string, type });
      e.target.value = '';
    };
  };

  const onCropComplete = async (croppedImage: string) => {
    if (!cropperData) return;
    const { type } = cropperData;
    setCropperData(null);

    try {
      // Convert base64 to blob for upload
      const response = await fetch(croppedImage);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append('photo', blob, 'photo.jpg');

      const res = await api.post('/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const photoUrl = res.data.photo_url;

      if (type === 'user') {
        setUserProfilePreview((prev: any) => ({ ...(prev || {}), photo_url: photoUrl }));
      } else if (type === 'list') {
        setListPhotoUrl(photoUrl);
        setCandidatePreview((prev: any) => ({ ...(prev || {}), photo_url: photoUrl }));
      } else if (type === 'campaign') {
        setNewCampaignPhotoUrl(photoUrl);
      }
    } catch (err) { console.error('Error uploading cropped image:', err); }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/campaigns', { 
        name: newCampaignName,
        slogan: newCampaignSlogan,
        photo_url: newCampaignPhotoUrl,
        enabled_modules: newCampaignModules 
      });
      setShowModal(null);
      setNewCampaignName('');
      setNewCampaignSlogan('');
      setNewCampaignPhotoUrl('');
      setNewCampaignModules(['COMMAND_CENTER', 'REGISTRY', 'LOGISTICS', 'WHATSAPP']);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;
    try {
      await api.put(`/campaigns/${editingCampaign.id}`, { 
        name: newCampaignName,
        slogan: newCampaignSlogan,
        photo_url: newCampaignPhotoUrl,
        enabled_modules: newCampaignModules
      });
      setShowModal(null);
      setEditingCampaign(null);
      setNewCampaignName('');
      setNewCampaignSlogan('');
      setNewCampaignPhotoUrl('');
      setNewCampaignModules(['COMMAND_CENTER', 'REGISTRY', 'LOGISTICS', 'WHATSAPP']);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteCampaign = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta campaña y TODAS sus listas y coordinadores asociados?')) return;
    try {
      await api.delete(`/campaigns/${id}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/lists', {
        campaign_id: newListCampaign,
        type: newListType,
        list_number: newListNumber,
        option_number: newListOption,
        candidate_ci: newListCandidateCI,
        candidate_nombre: candidatePreview?.nombre,
        candidate_alias: newListAlias,
        goal: newListGoal,
        photo_url: listPhotoUrl
      });
      setShowModal(null);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleUpdateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingList) return;
    try {
      const res = await api.put(`/lists/${editingList.id}`, {
        goal: newListGoal,
        photo_url: candidatePreview?.photo_url || listPhotoUrl,
        type: newListType,
        list_number: newListNumber,
        option_number: newListOption,
        campaign_id: newListCampaign,
        candidate_alias: newListAlias,
        candidate_nombre: candidatePreview?.nombre
      });
      
      if (res.data.success) {
        setShowModal(null);
        setEditingList(null);
        fetchData();
      } else {
        alert("Error al actualizar: " + (res.data.error || "Desconocido"));
      }
    } catch (err: any) { 
      console.error("Update failed:", err);
      alert("Error de conexión al actualizar la lista.");
    }
  };

  const handleDeleteList = async (id: number) => {
    if (!confirm('¿Eliminar esta lista?')) return;
    try {
      await api.delete(`/lists/${id}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users', { 
        username: newUserName || newUserCI, 
        password: newUserPass || newUserCI, 
        role: newUserRole,
        nombre: newUserRealName,
        assigned_list_id: newUserList || null,
        assigned_campaign_id: newUserCampaign || null,
        assigned_local: newUserLocal || null,
        assigned_mesa: newUserMesa || null,
        photo_url: userProfilePreview?.photo_url
      });
      setShowModal(null);
      setNewUserLocal('');
      setNewUserMesa(null);
      fetchData();
    } catch (err) { 
      console.error(err); 
      alert('Error al crear usuario. Verifique los datos.');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await api.put(`/users/${editingUser.id}`, {
        role: newUserRole,
        nombre: newUserRealName,
        assigned_list_id: newUserList || null,
        assigned_campaign_id: newUserCampaign || null,
        assigned_local: newUserLocal || null,
        assigned_mesa: newUserMesa || null,
        photo_url: userProfilePreview?.photo_url
      });
      setShowModal(null);
      setEditingUser(null);
      setNewUserLocal('');
      setNewUserMesa(null);
      fetchData();
    } catch (err) { 
      console.error(err); 
      alert('Error al actualizar usuario.');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleResetPassword = async (id: number) => {
    if (!confirm('¿Forzar a este usuario a cambiar su contraseña en el próximo ingreso?')) return;
    try {
      await api.post(`/admin/users/${id}/reset-password`);
      alert('Reset exitoso. El usuario deberá asignar una nueva clave al entrar.');
      fetchData();
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const lookup = async () => {
      if (newUserCI.length >= 5) {
        try {
          const res = await api.get(`/admin/verify-user/${newUserCI}`);
          if (res.data) {
            setNewUserRealName(`${res.data.nombre} ${res.data.apellido}`);
            setUserProfilePreview({ photo_url: res.data.photo_url, nombre: res.data.nombre, apellido: res.data.apellido });
            setIsUserVerified(true);
          } else {
            setIsUserVerified(false);
          }
        } catch (err) { setIsUserVerified(false); }
      } else {
        setIsUserVerified(false);
      }
    };
    const timer = setTimeout(lookup, 500);
    return () => clearTimeout(timer);
  }, [newUserCI]);

  const handleLookupUserCI = async () => {
    if (!newUserCI) return;
    try {
      const res = await api.get(`/admin/verify-user/${newUserCI}`);
      if (res.data) {
        setNewUserRealName(`${res.data.nombre} ${res.data.apellido}`);
        setUserProfilePreview(res.data);
        setIsUserVerified(true);
      }
    } catch (err) { 
      alert('C.I. no encontrado'); 
      setIsUserVerified(false);
    }
  };

  useEffect(() => {
    const lookup = async () => {
      if (newListCandidateCI.length >= 5) {
        try {
          const res = await api.get(`/admin/verify-candidate/${newListCandidateCI}`);
          if (res.data) {
            setCandidatePreview({ photo_url: res.data.photo_url, nombre: res.data.nombre, apellido: res.data.apellido });
            setIsCandidateVerified(true);
          } else {
            setIsCandidateVerified(false);
          }
        } catch (err) { setIsCandidateVerified(false); }
      } else {
        setIsCandidateVerified(false);
      }
    };
    const timer = setTimeout(lookup, 500);
    return () => clearTimeout(timer);
  }, [newListCandidateCI]);

  const handleLookupCandidate = async () => {
    if (!newListCandidateCI) return;
    try {
      const res = await api.get(`/admin/verify-candidate/${newListCandidateCI}`);
      if (res.data) {
        setCandidatePreview(res.data);
        setIsCandidateVerified(true);
      }
    } catch (err) { 
      alert('C.I. no encontrado'); 
      setIsCandidateVerified(false);
    }
  };

  const handleLookupDriverCI = async () => {
    if (!newVehicleDriverCI) return;
    try {
      const res = await api.get(`/electors/${newVehicleDriverCI}`);
      if (res.data) {
        setNewVehicleDriver(`${res.data.nombre} ${res.data.apellido}`);
        setIsVehicleDriverVerified(true);
      }
    } catch (err) { 
      alert('C.I. no encontrado en el padrón'); 
      setIsVehicleDriverVerified(false);
    }
  };

  useEffect(() => {
    if (newListCampaign) {
      const campaignLists = lists.filter(l => l.campaign_id?.toString() === newListCampaign.toString());
      const intendant = campaignLists.find(l => l.type === 'INTENDENTE');
      setHasIntendente(!!intendant);
      if (intendant) setIntendenteListNumber(intendant.list_number);
      else setIntendenteListNumber('');
      
      const options = campaignLists
        .filter(l => l.type === 'CONCEJAL')
        .map(l => parseInt(l.option_number || '0'))
        .filter(n => n > 0);
      setTakenOptions(options);

      if (newListType === 'CONCEJAL' && intendant && !editingList) {
        setNewListNumber(intendant.list_number);
      }
    }
  }, [newListCampaign, newListType, lists, editingList]);

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/vehicles', {
        description: newVehicleDesc,
        driver_name: newVehicleDriver,
        driver_phone: newVehiclePhone,
        driver_ci: newVehicleDriverCI,
        capacity: newVehicleCapacity,
        status: newVehicleStatus,
        assigned_list_id: newVehicleList ? parseInt(newVehicleList) : null
      });
      setShowModal(null);
      setNewVehicleDesc('');
      setNewVehicleDriver('');
      setNewVehiclePhone('');
      setNewVehicleDriverCI('');
      setNewVehicleCapacity(4);
      setNewVehicleStatus('AVAILABLE');
      setNewVehicleList('');
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleExportAudit = () => {
    window.open(`${API_BASE}/audit/export`, '_blank');
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/settings', {
        election_date: electionDate,
        election_end_time: electionEndTime,
        global_goal: globalGoal.toString(),
        master_key: masterKey,
        app_name: appName,
        app_logo_url: appLogoUrl
      });
      refreshSettings();
      alert('Configuración guardada correctamente.');
    } catch (err) { console.error(err); }
  };

  const handleCreateLocale = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { 
        cod_local: newLocaleCod, 
        nombre: newLocaleNombre, 
        direccion: newLocaleDireccion, 
        lat: parseFloat(newLocaleLat), 
        lng: parseFloat(newLocaleLng), 
        icon: newLocaleIcon 
      };
      if (editingLocale) {
        await api.put(`/locales/${newLocaleCod}`, payload);
      } else {
        await api.post('/locales', payload);
      }
      setShowModal(null);
      fetchData();
    } catch (err) { 
      console.error(err); 
      alert('Error al guardar el local. Verifique el código único.');
    }
  };

  const handleDeleteLocale = async (cod: string) => {
    if (!confirm('¿Seguro que desea eliminar este local?')) return;
    try {
      await api.delete(`/locales/${cod}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const fetchAuditData = async () => {
    try {
      const [logs, stats] = await Promise.all([
        api.get('/audit/logs', {
          params: {
            action: auditFilterAction,
            user_id: auditFilterUser,
            start_date: auditFilterStart,
            end_date: auditFilterEnd
          }
        }),
        api.get('/audit/stats')
      ]);
      setAuditLogs(logs.data);
      setAuditStats(stats.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (!loading && !authUser) {
      navigate('/login');
    } else if (authUser && authUser.role === 'COORDINADOR') {
      navigate('/coordinador');
    }
  }, [authUser, loading, navigate]);

  useEffect(() => {
    if (authUser) fetchData();
  }, [authUser, activeTab]);

  if (loading) return null;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'overview') {
        const [summary, predictionsRes, allCaptures, allLocales] = await Promise.all([
          api.get('/stats/summary'),
          api.get('/stats/predictions'),
          api.get('/captures'),
          api.get('/voting-locations')
        ]);
        setStats(summary.data);
        setPredictions(predictionsRes.data);
        setCaptures(allCaptures.data);
        setLocales(allLocales.data);
      } else if (activeTab === 'campaigns') {
        const res = await api.get('/campaigns');
        setCampaigns(res.data);
      } else if (activeTab === 'lists') {
        const res = await api.get('/lists');
        setLists(res.data);
        const camps = await api.get('/campaigns');
        setCampaigns(camps.data);
      } else if (activeTab === 'users') {
        const [res, lts, camps] = await Promise.all([
          api.get('/users'),
          api.get('/lists'),
          api.get('/campaigns')
        ]);
        setUsers(res.data);
        setLists(lts.data);
        setCampaigns(camps.data);
      } else if (activeTab === 'audit') {
        await fetchAuditData();
      } else if (activeTab === 'logistics') {
        const [v, p] = await Promise.all([
          api.get('/vehicles'),
          api.get('/logistics/pending')
        ]);
        setVehicles(v.data);
        setPendingLogistics(p.data);
        const lts = await api.get('/lists');
        setLists(lts.data);
      } else if (activeTab === 'locales') {
        const res = await api.get('/voting-locations');
        setLocales(res.data);
      } else if (activeTab === 'settings') {
        const res = await api.get('/settings');
        if (res.data.election_date) {
          const dateOnly = res.data.election_date.split('T')[0];
          setElectionDate(dateOnly);
        }
        if (res.data.election_end_time) setElectionEndTime(res.data.election_end_time);
        const goal = parseInt(res.data.global_goal);
        setGlobalGoal(isNaN(goal) ? 10000 : goal);
        if (res.data.master_key) setMasterKey(res.data.master_key);
        if (res.data.app_name) setAppName(res.data.app_name);
        if (res.data.app_logo_url) setAppLogoUrl(res.data.app_logo_url);
      }
    } catch (err) {
      console.error("Error fetching data", err);
    } finally {
      setIsLoading(false);
    }
  };
  const renderOverview = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        <StatCard icon={UsersIcon} label="Usuarios Totales" value={stats?.users || 0} color="var(--plra-300)" />
        <StatCard icon={ListOrdered} label="Listas Registradas" value={stats?.lists || 0} color="var(--plra-400)" />
        <StatCard icon={Activity} label="Capturas Totales" value={stats?.captures || 0} color="var(--plra-100)" />
        <StatCard icon={CheckCircle2} label="Electores Únicos" value={stats?.electors || 0} color="var(--green)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <div style={{
          background: 'var(--accent-subtle)',
          border: '1px solid rgba(59,130,246,0.15)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem'
        }}>
          <div style={{ 
            width: '48px', height: '48px', borderRadius: '12px', 
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--plra-300)'
          }}>
            <Activity size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Velocidad de Carga</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <p style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{predictions?.velocity || 0}</p>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)' }}>capturas / hora</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
              {predictions?.trend === 'up' ? (
                <CheckCircle2 size={12} style={{ color: 'var(--green)' }} />
              ) : (
                <AlertTriangle size={12} style={{ color: 'var(--red)' }} />
              )}
              <span style={{ fontSize: '0.7rem', color: predictions?.trend === 'up' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                {predictions?.trend === 'up' ? 'Ritmo en Aumento' : 'Ritmo en Descenso'}
              </span>
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(34,197,94,0.05)',
          border: '1px solid rgba(34,197,94,0.15)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem'
        }}>
          <div style={{ 
            width: '48px', height: '48px', borderRadius: '12px', 
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--green)'
          }}>
            <Flag size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Proyección Final</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <p style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{predictions?.projected_total || 0}</p>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)' }}>total proyectado</span>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>Basado en el ritmo actual de carga</p>
          </div>
        </div>
      </div>

      <div style={{ height: '450px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <MapContainer center={[-22.545, -55.72]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <ZoomControl position="bottomright" />
          {captures.filter(c => c.lat).map(c => (
            <Marker 
              key={`cap-${c.id}`} 
              position={[c.lat, c.lng]} 
              icon={createCustomIcon(
                c.traffic_light === 'GREEN' ? 'var(--green)' : c.traffic_light === 'YELLOW' ? 'var(--yellow)' : 'var(--red)',
                c.needs_transport === 1 ? 'Truck' : 'MapPin',
                20
              )}
            >
              <Popup>
                <div style={{ color: 'black' }}>
                  <strong>{c.nombre} {c.apellido}</strong><br/>
                  Status: {c.traffic_light}<br/>
                  {c.needs_transport === 1 ? '🚗 REQUIERE TRASLADO' : '🚶 Sin traslado'}<br/>
                  <small>Por: {c.coordinator_name}</small>
                </div>
              </Popup>
            </Marker>
          ))}
          {locales.filter(l => l.lat).map(l => (
            <Marker 
              key={`loc-${l.cod_local}`} 
              position={[l.lat, l.lng]} 
              icon={createCustomIcon('var(--plra-500)', l.icon || 'Landmark', 28)}
            >
              <Popup>
                <div style={{ color: 'black' }}>
                  <strong>{l.nombre}</strong><br/>
                  {l.direccion}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );

  const renderCampaigns = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>Gestión de Campañas</h2>
        <button className="action-btn-primary" onClick={() => setShowModal('campaign')}>
          <Plus size={18} /> Nueva Campaña
        </button>
      </div>
      <ManagementTable 
        isLoading={isLoading}
        columns={[
          { header: 'ID', accessor: 'id', width: '80px', sortKey: 'id' },
          { header: 'Nombre', accessor: 'name', sortKey: 'name' },
          { 
            header: 'Estado', 
            accessor: (c: Campaign) => (
              <span style={{ 
                padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                background: c.status === 'ACTIVE' ? 'var(--accent-subtle)' : 'var(--surface-light)',
                color: c.status === 'ACTIVE' ? 'var(--green)' : 'var(--text-3)'
              }}>
                {c.status}
              </span>
            )
          },
          {
            header: 'Acciones',
            accessor: (c: Campaign) => (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="icon-btn" onClick={() => { 
                  setEditingCampaign(c); 
                  setNewCampaignName(c.name); 
                  setNewCampaignModules((c as any).enabled_modules ? (c as any).enabled_modules.split(',') : []);
                  setShowModal('edit-campaign'); 
                }}><Edit2 size={14} /></button>
                <button className="icon-btn delete" onClick={() => handleDeleteCampaign(c.id)}><Trash2 size={14} /></button>
              </div>
            )
          }
        ]}
        data={campaigns}
      />
    </div>
  );

  const renderLists = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>Listas Electorales</h2>
        <button className="action-btn-primary" onClick={() => {
          setEditingList(null);
          setNewListNumber('');
          setNewListCandidateCI('');
          setCandidatePreview(null);
          setListPhotoUrl('');
          setNewListCampaign(campaigns[0]?.id?.toString() || '');
          setNewListType('INTENDENTE');
          setNewListOption('');
          setNewListGoal(1000);
          setNewListAlias('');
          setIsCandidateVerified(false);
          setShowModal('list');
        }}>
          <UserPlus size={18} /> Registrar Lista
        </button>
      </div>
      <ManagementTable 
        isLoading={isLoading}
        columns={[
          { 
            header: 'Lista / Opción', 
            accessor: (l: any) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 800, color: 'var(--plra-300)', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px' }}>L {l.list_number}</span>
                {l.type === 'CONCEJAL' && (
                  <span style={{ fontWeight: 700, color: 'var(--yellow)', background: 'rgba(234,179,8,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Op {l.option_number}</span>
                )}
              </div>
            ),
            sortKey: 'list_number',
            width: '140px'
          },
          { 
            header: 'Candidato (Identidad)', 
            accessor: (l: any) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', background: 'var(--surface-light)', border: '1px solid var(--border)', flexShrink: 0 }}>
                  {l.photo_url ? <img src={l.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <User size={16} style={{ margin: '8px', color: 'var(--text-3)' }} />}
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: 'white', fontSize: '0.85rem' }}>{l.candidate_alias || l.candidate_nombre}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase' }}>{l.candidate_nombre}</div>
                </div>
              </div>
            ),
            sortKey: 'candidate_alias'
          },
          { header: 'Campaña', accessor: 'campaign_name', sortKey: 'campaign_name' },
          { 
            header: 'Tipo', 
            accessor: (l: any) => (
              <span style={{ 
                padding: '4px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800,
                background: l.type === 'INTENDENTE' ? 'var(--accent-subtle)' : 'var(--surface-light)',
                color: l.type === 'INTENDENTE' ? 'var(--plra-300)' : 'var(--text-3)'
              }}>
                {l.type}
              </span>
            ),
            sortKey: 'type'
          },
          { 
            header: 'Meta', 
            accessor: (l: any) => (
              <div style={{ fontWeight: 700, color: 'var(--text-2)', fontSize: '0.85rem' }}>{l.goal} <span style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>votos</span></div>
            ),
            sortKey: 'goal'
          },
          {
            header: 'Acciones',
            accessor: (l: any) => (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="icon-btn" onClick={() => { 
                  setEditingList(l); 
                  setNewListGoal(l.goal || 1000); 
                  setNewListCandidateCI(l.candidate_ci || '');
                  setNewListAlias(l.candidate_alias || '');
                  setCandidatePreview({ 
                    photo_url: l.photo_url, 
                    nombre: l.candidate_nombre,
                    apellido: l.candidate_apellido
                  });
                  setNewListType(l.type);
                  setNewListNumber(l.list_number);
                  setNewListOption(l.option_number || '');
                  setNewListCampaign(l.campaign_id?.toString() || '');
                  setIsCandidateVerified(true);
                  setShowModal('list'); 
                }}><Edit2 size={14} /></button>
                <button className="icon-btn delete" onClick={() => handleDeleteList(l.id)}><Trash2 size={14} /></button>
              </div>
            )
          }
        ]}
        data={lists}
      />
    </div>
  );

  const renderAudit = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>Auditoría de Sistema</h2>
        <button className="action-btn-primary" onClick={handleExportAudit}>
          <Download size={18} /> Exportar CSV
        </button>
      </div>
      
      <div style={{ 
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', 
        borderRadius: '12px', border: '1px solid var(--border)' 
      }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Acción</label>
          <select className="mini-input" value={auditFilterAction} onChange={e => setAuditFilterAction(e.target.value)}>
            <option value="">Todas</option>
            <option value="CREATE">Creación</option>
            <option value="UPDATE">Edición</option>
            <option value="DELETE">Eliminación</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Desde</label>
          <input type="date" className="mini-input" value={auditFilterStart} onChange={e => setAuditFilterStart(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Hasta</label>
          <input type="date" className="mini-input" value={auditFilterEnd} onChange={e => setAuditFilterEnd(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button className="action-btn-primary" onClick={fetchAuditData} style={{ width: '100%', height: '38px', justifyContent: 'center' }}>
            <Search size={16} /> Filtrar
          </button>
        </div>
      </div>

      <ManagementTable 
        isLoading={isLoading}
        columns={[
          { header: 'Fecha', accessor: (row: any) => new Date(row.timestamp).toLocaleString(), sortKey: 'timestamp' },
          { header: 'Usuario', accessor: 'username', sortKey: 'username' },
          { header: 'Acción', accessor: 'action', sortKey: 'action' },
          { header: 'Detalles', accessor: 'details', sortKey: 'details' }
        ]}
        data={auditLogs}
      />
    </div>
  );

  const renderLocales = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>Locales de Votación</h2>
        <button className="action-btn-primary" onClick={() => {
          setEditingLocale(null);
          setNewLocaleCod('');
          setNewLocaleNombre('');
          setNewLocaleDireccion('');
          setNewLocaleLat('');
          setNewLocaleLng('');
          setNewLocaleIcon('Landmark');
          setShowModal('locale');
        }}>
          <Plus size={18} /> Registrar Local
        </button>
      </div>
      
      <ManagementTable 
        isLoading={isLoading}
        columns={[
          { header: 'Código', accessor: 'cod_local', width: '80px' },
          { header: 'Nombre', accessor: 'nombre' },
          { header: 'Dirección', accessor: 'direccion' },
          { 
            header: 'Ubicación', 
            accessor: (l: any) => (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ 
                  width: '8px', height: '8px', borderRadius: '50%', 
                  background: l.lat ? 'var(--green)' : 'var(--red)'
                }} />
                <span style={{ fontSize: '0.7rem', color: l.lat ? 'var(--text)' : 'var(--text-3)' }}>
                  {l.lat ? `${parseFloat(l.lat).toFixed(4)}, ${parseFloat(l.lng).toFixed(4)}` : 'No ubicado'}
                </span>
              </div>
            )
          },
          {
            header: 'Icono',
            accessor: (l: any) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--plra-300)' }}>{l.icon || 'Landmark'}</span>
              </div>
            )
          },
          {
            header: 'Acciones',
            accessor: (l: any) => (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="icon-btn" onClick={() => { 
                  setEditingLocale(l); 
                  setNewLocaleCod(l.cod_local);
                  setNewLocaleNombre(l.nombre);
                  setNewLocaleDireccion(l.direccion || '');
                  setNewLocaleLat(l.lat?.toString() || '');
                  setNewLocaleLng(l.lng?.toString() || '');
                  setNewLocaleIcon(l.icon || 'Landmark');
                  setShowModal('locale'); 
                }}><Edit2 size={14} /></button>
                <button className="icon-btn delete" onClick={() => handleDeleteLocale(l.cod_local)}><Trash2 size={14} /></button>
              </div>
            )
          }
        ]}
        data={locales}
      />

      <div style={{ height: '400px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <MapContainer center={[-22.545, -55.72]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <ZoomControl position="bottomright" />
          {locales.filter(l => l.lat).map(l => (
            <Marker key={l.cod_local} position={[parseFloat(l.lat), parseFloat(l.lng)]} icon={createCustomIcon('var(--plra-500)', l.icon, 28)}>
              <Popup>
                <div style={{ color: 'black' }}>
                  <strong>{l.nombre}</strong><br/>
                  {l.direccion}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', maxWidth: '1000px' }}>
      
      <section>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--plra-300)', letterSpacing: '0.1em', marginBottom: '1.5rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Settings size={18} /> Identidad & Marca
        </h3>
        <div className="card-premium-styled" style={{ padding: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label>Nombre de la Plataforma</label>
              <input className="modern-input-premium-styled" value={appName} onChange={e => setAppName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Logo de la Institución (URL)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input className="modern-input-premium-styled" value={appLogoUrl} onChange={e => setAppLogoUrl(e.target.value)} />
                <button className="icon-btn" onClick={() => fileInputRef.current?.click()}><Camera size={18} /></button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--plra-300)', letterSpacing: '0.1em', marginBottom: '1.5rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Clock size={18} /> Logística del Día D
        </h3>
        <div className="card-premium-styled" style={{ padding: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            <div className="form-group">
              <label>Fecha de Elección</label>
              <input type="date" className="modern-input-premium-styled" value={electionDate} onChange={e => setElectionDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Hora de Cierre</label>
              <input type="time" className="modern-input-premium-styled" value={electionEndTime} onChange={e => setElectionEndTime(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Meta Global de Capturas</label>
              <input type="number" className="modern-input-premium-styled" value={globalGoal} onChange={e => setGlobalGoal(parseInt(e.target.value))} />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--plra-300)', letterSpacing: '0.1em', marginBottom: '1.5rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Shield size={18} /> Control de Multitenancia (SaaS)
        </h3>
        <div className="card-premium-styled" style={{ padding: '2rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '1.5rem' }}>
            Administración centralizada de campañas y niveles de acceso por inquilino.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {campaigns.map(c => (
              <div key={c.id} style={{ padding: '1rem', borderRadius: '12px', background: 'var(--surface-light)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white' }}>{c.name}</p>
                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                    {c.enabled_modules?.split(',').map((m: string) => (
                      <div key={m} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--plra-300)' }} title={m} />
                    ))}
                  </div>
                </div>
                <button className="icon-btn" onClick={() => { 
                  setEditingCampaign(c); 
                  setNewCampaignName(c.name); 
                  setNewCampaignModules(c.enabled_modules ? c.enabled_modules.split(',') : []);
                  setShowModal('edit-campaign'); 
                }}><Edit2 size={14} /></button>
              </div>
            ))}
            <button 
              onClick={() => { setNewCampaignName(''); setNewCampaignModules(['COMMAND_CENTER', 'REGISTRY']); setShowModal('campaign'); }}
              style={{ padding: '1rem', borderRadius: '12px', border: '1px dashed var(--plra-500)', background: 'transparent', color: 'var(--plra-300)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <Plus size={14} /> Nueva Campaña
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--red)', letterSpacing: '0.1em', marginBottom: '1.5rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertTriangle size={18} /> Seguridad Crítica
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div className="card-premium-styled" style={{ padding: '2rem', borderColor: 'rgba(239,68,68,0.1)' }}>
            <div className="form-group">
              <label style={{ color: 'var(--red)' }}>Llave Maestra del Sistema</label>
              <input 
                type="password" 
                className="modern-input-premium-styled" 
                placeholder="Inviolable"
                value={masterKey} 
                onChange={e => setMasterKey(e.target.value)} 
                style={{ borderBottomColor: 'rgba(239,68,68,0.3)' }}
              />
              <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '0.75rem', lineHeight: '1.4' }}>
                Requerida para el borrado masivo de datos de prueba antes de salir a producción.
              </p>
            </div>
          </div>

          <div className="card-premium-styled" style={{ padding: '2rem', background: 'rgba(239,68,68,0.02)', borderColor: 'rgba(239,68,68,0.2)' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1.25rem' }}>
              Acción irreversible: Elimina todas las capturas de todos los coordinadores en todas las listas.
            </p>
            <button onClick={handleWipeCaptures} className="btn-wipe" style={{ 
              width: '100%', padding: '1rem', borderRadius: '10px', background: 'var(--red)', color: 'white', border: 'none', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
            }}>
              <Trash2 size={16} /> EJECUTAR WIPE DEL SISTEMA
            </button>
          </div>
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        <button onClick={handleUpdateSettings} className="btn-confirm-styled" style={{ width: 'auto', padding: '1rem 2.5rem' }}>
          <Save size={20} /> Guardar Todo
        </button>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>Usuarios y Accesos</h2>
        <button className="action-btn-primary" onClick={() => {
          setEditingUser(null);
          setNewUserCI('');
          setNewUserRealName('');
          setNewUserName('');
          setNewUserPass('');
          setNewUserRole('COORDINADOR');
          setNewUserList('');
          setNewUserCampaign('');
          setUserProfilePreview(null);
          setIsUserVerified(false);
          setShowModal('user');
        }}>
          <UserPlus size={18} /> Crear Usuario
        </button>
      </div>
      <ManagementTable 
        isLoading={isLoading}
        columns={[
          { header: 'Nombre', accessor: 'nombre', sortKey: 'nombre' },
          { header: 'Usuario', accessor: 'username', sortKey: 'username' },
          { 
            header: 'Rol', 
            accessor: (u: any) => (
              <span style={{ 
                padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                background: u.role === 'SUPERUSUARIO' ? 'var(--accent-subtle)' : 'var(--surface-light)',
                color: u.role === 'SUPERUSUARIO' ? 'var(--plra-300)' : 'var(--text-2)'
              }}>
                {u.role}
              </span>
            ),
            sortKey: 'role'
          },
          { 
            header: 'Lista Asignada', 
            accessor: (u: any) => {
              if (!u.assigned_list_id) return <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Sin asignar</span>;
              const list = lists.find(l => l.id === u.assigned_list_id);
              if (!list) return <span style={{ color: 'var(--red)' }}>ID: {u.assigned_list_id}</span>;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontWeight: 800, color: 'var(--plra-300)' }}>L{list.list_number}</span>
                  {list.type === 'CONCEJAL' && <span style={{ color: 'var(--yellow)', fontSize: '0.7rem' }}>Op{list.option_number}</span>}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>— {list.candidate_alias || list.candidate_nombre}</span>
                </div>
              );
            },
            sortKey: 'list_number'
          },
          {
            header: 'Acciones',
            accessor: (u: any) => (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="icon-btn" onClick={() => { 
                  setEditingUser(u); 
                  setNewUserCI(u.ci || ''); 
                  setNewUserRealName(u.nombre || ''); 
                  setNewUserName(u.username || ''); 
                  setNewUserRole(u.role);
                  setNewUserList(u.assigned_list_id?.toString() || '');
                  setNewUserCampaign(u.assigned_campaign_id?.toString() || '');
                  setNewUserLocal(u.assigned_local || '');
                  setNewUserMesa(u.assigned_mesa || null);
                  setUserProfilePreview({ photo_url: u.photo_url, nombre: u.nombre });
                  setIsUserVerified(true);
                  setShowModal('user'); 
                }}><Edit2 size={14} /></button>
                <button 
                  className="icon-btn" 
                  style={{ color: 'var(--yellow)' }} 
                  onClick={() => handleResetPassword(u.id)}
                  title="Resetear Contraseña (Forzar Cambio)"
                >
                  <Key size={14} />
                </button>
                <button className="icon-btn delete" onClick={() => handleDeleteUser(u.id)} disabled={u.username === 'admin'}><Trash2 size={14} /></button>
              </div>
            )
          }
        ]}
        data={users}
      />
    </div>
  );

  const renderLogistics = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>Logística de Transporte</h2>
        <button className="action-btn-primary" onClick={() => {
          setNewVehicleDesc('');
          setNewVehicleDriver('');
          setNewVehiclePhone('');
          setNewVehicleDriverCI('');
          setNewVehicleCapacity(4);
          setNewVehicleStatus('AVAILABLE');
          setNewVehicleList('');
          setIsVehicleDriverVerified(false);
          setShowModal('vehicle');
        }}>
          <Plus size={18} /> Registrar Vehículo
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        <div className="card-premium-styled">
          <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} style={{ color: 'var(--plra-300)' }} /> Solicitudes Pendientes
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingLogistics.filter(p => !p.assigned_vehicle_id).map(cap => (
              <div key={cap.id} style={{ 
                padding: '1rem', background: 'var(--surface-light)', border: '1px solid var(--border)', 
                borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem'
              }}>
                <div style={{ 
                  width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--plra-300)'
                }}>
                  <User size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>{cap.nombre} {cap.apellido}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Local: {cap.local_votacion}</p>
                </div>
              </div>
            ))}
            {pendingLogistics.filter(p => !p.assigned_vehicle_id).length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem', padding: '1rem' }}>No hay traslados pendientes</p>
            )}
          </div>
        </div>

        <div className="card-premium-styled">
          <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={18} style={{ color: 'var(--green)' }} /> Flota de Vehículos
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {vehicles.map(v => {
              const statusColor = v.status === 'AVAILABLE' ? 'var(--green)' : v.status === 'IN_TRANSIT' ? 'var(--yellow)' : 'var(--red)';
              const statusLabel = v.status === 'AVAILABLE' ? 'Disponible' : v.status === 'IN_TRANSIT' ? 'En Ruta' : 'Mantenimiento';
              return (
              <div key={v.id} style={{ padding: '1rem', background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.9rem', fontWeight: 800 }}>{v.description}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>Chofer: {v.driver_name}</p>
                  </div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: statusColor }}>{statusLabel}</span>
                </div>
              </div>
            )})} 
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <MainLayout 
      title="Panel de Administración" 
      userName={authUser?.nombre || "Usuario"} 
      userPhoto={authUser?.photo_url}
    >
      <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
        <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <main style={{ 
          flex: 1, 
          padding: '2rem', 
          overflowY: 'auto',
          background: 'linear-gradient(to bottom, transparent, rgba(0,71,171,0.03))'
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'campaigns' && renderCampaigns()}
              {activeTab === 'lists' && renderLists()}
              {activeTab === 'users' && renderUsers()}
              {activeTab === 'logistics' && renderLogistics()}
              {activeTab === 'audit' && renderAudit()}
              {activeTab === 'locales' && renderLocales()}
              {activeTab === 'settings' && renderSettings()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="modal-overlay" style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }} onClick={() => setShowModal(null)}>
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ width: 'auto', maxWidth: '95vw', padding: 0, overflowY: 'auto', maxHeight: '90vh' }}
            >
              {showModal === 'campaign' && (
                <div style={{ maxWidth: '500px', width: '100%' }}>
                  <div className="modal-header-section">
                    <h3>Nueva Campaña</h3>
                  </div>
                  <form onSubmit={handleCreateCampaign} style={{ padding: '1.5rem' }}>
                    <div className="form-group">
                      <label>Nombre de la Campaña</label>
                      <input autoFocus className="modern-input-premium-styled" value={newCampaignName} onChange={e => setNewCampaignName(e.target.value)} placeholder="Ej: Municipales 2026" required />
                    </div>
                    <div className="form-group">
                      <label>Eslogan</label>
                      <input className="modern-input-premium-styled" value={newCampaignSlogan} onChange={e => setNewCampaignSlogan(e.target.value)} placeholder="Ej: Por un cambio real" />
                    </div>
                    <div className="form-group">
                      <label>Imagen Splash</label>
                      <div className="search-input-wrapper-premium">
                        <input className="modern-input-premium-styled" value={newCampaignPhotoUrl} onChange={e => setNewCampaignPhotoUrl(e.target.value)} placeholder="URL o subir archivo..." />
                        <button type="button" onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e: any) => handleFileUpload(e, 'campaign');
                          input.click();
                        }} className="search-btn-action">SUBIR</button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '1rem', color: 'var(--plra-300)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Módulos Habilitados (SaaS)</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        {[
                          { id: 'COMMAND_CENTER', label: 'Centro de Comando' },
                          { id: 'REGISTRY', label: 'Padrón / Campo' },
                          { id: 'LOGISTICS', label: 'Logística / Traslados' },
                          { id: 'COMMUNICATIONS', label: 'WhatsApp Hub' }
                        ].map(mod => (
                          <label key={mod.id} style={{ 
                            display: 'flex', alignItems: 'center', gap: '0.75rem', 
                            padding: '0.75rem', borderRadius: '10px', background: 'var(--surface-light)',
                            border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s'
                          }}>
                            <input 
                              type="checkbox" 
                              checked={newCampaignModules.includes(mod.id)} 
                              onChange={(e) => {
                                if (e.target.checked) setNewCampaignModules([...newCampaignModules, mod.id]);
                                else setNewCampaignModules(newCampaignModules.filter(m => m !== mod.id));
                              }}
                              style={{ accentColor: 'var(--plra-300)' }}
                            />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)' }}>{mod.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="modal-footer-premium-styled">
                      <button type="button" onClick={() => setShowModal(null)} className="btn-cancel-styled">Cancelar</button>
                      <button type="submit" className="btn-confirm-styled">Crear Campaña <ChevronRight size={18} /></button>
                    </div>
                  </form>
                </div>
              )}

              {showModal === 'edit-campaign' && (
                <form onSubmit={handleUpdateCampaign} style={{ padding: '2rem', maxWidth: '500px' }}>
                  <h3>Editar Campaña</h3>
                  <div className="form-group">
                    <label>Nombre de la Campaña</label>
                    <input autoFocus className="modern-input-premium-styled" value={newCampaignName} onChange={e => setNewCampaignName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Eslogan</label>
                    <input className="modern-input-premium-styled" value={newCampaignSlogan} onChange={e => setNewCampaignSlogan(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Imagen (URL)</label>
                    <div className="search-input-wrapper-premium">
                      <input className="modern-input-premium-styled" value={newCampaignPhotoUrl} onChange={e => setNewCampaignPhotoUrl(e.target.value)} />
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="search-btn-action">SUBIR</button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '1rem', color: 'var(--plra-300)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Módulos Habilitados (SaaS)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      {[
                        { id: 'COMMAND_CENTER', label: 'Centro de Comando' },
                        { id: 'REGISTRY', label: 'Padrón / Campo' },
                        { id: 'LOGISTICS', label: 'Logística / Traslados' },
                        { id: 'COMMUNICATIONS', label: 'WhatsApp Hub' }
                      ].map(mod => (
                        <label key={mod.id} style={{ 
                          display: 'flex', alignItems: 'center', gap: '0.75rem', 
                          padding: '0.75rem', borderRadius: '10px', background: 'var(--surface-light)',
                          border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s'
                        }}>
                          <input 
                            type="checkbox" 
                            checked={newCampaignModules.includes(mod.id)} 
                            onChange={(e) => {
                              if (e.target.checked) setNewCampaignModules([...newCampaignModules, mod.id]);
                              else setNewCampaignModules(newCampaignModules.filter(m => m !== mod.id));
                            }}
                            style={{ accentColor: 'var(--plra-300)' }}
                          />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)' }}>{mod.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="modal-footer-premium-styled">
                    <button type="button" onClick={() => { setShowModal(null); setEditingCampaign(null); }} className="btn-cancel-styled">Cancelar</button>
                    <button type="submit" className="btn-confirm-styled">Guardar Cambios <ChevronRight size={18} /></button>
                  </div>
                </form>
              )}

              {showModal === 'user' && (
                <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} style={{ maxWidth: '650px', width: '100%', padding: 0 }}>
                  <div style={{ 
                    padding: '2rem', 
                    borderBottom: '1px solid var(--border)',
                    background: 'linear-gradient(to bottom, rgba(0,71,171,0.05), transparent)',
                    display: 'flex', alignItems: 'center', gap: '1.5rem'
                  }}>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      style={{ display: 'none' }} 
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'user')}
                    />
                    <div 
                      className="premium-avatar-frame-compact" 
                      style={{ flexShrink: 0, cursor: 'pointer', position: 'relative' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {userProfilePreview?.photo_url ? (
                        <img src={userProfilePreview.photo_url} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <UsersIcon size={32} style={{ color: 'var(--text-3)' }} />
                      )}
                      <div className="avatar-edit-overlay">
                        <Camera size={14} />
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontSize: '0.6rem', fontWeight: 900, color: 'var(--plra-300)', 
                        letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.25rem' 
                      }}>
                        Perfil de Operador
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {userProfilePreview?.nombre ? `${userProfilePreview.nombre} ${userProfilePreview.apellido || ''}` : 'Sin Verificar'}
                      </h3>
                      {userProfilePreview?.nombre && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                          <span className="verified-badge-compact" style={{ width: '20px', height: '20px' }}>
                            <ShieldCheck size={12} />
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>C.I. Nº {newUserCI}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: '2.5rem 2rem' }}>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Documento de Identidad</label>
                        <div className="search-input-wrapper-premium">
                          <input 
                            className="modern-input-premium-styled" 
                            placeholder="C.I. del Padrón"
                            value={newUserCI} 
                            onChange={e => setNewUserCI(e.target.value)} 
                          />
                          <button type="button" onClick={handleLookupUserCI} className="search-btn-action">
                            BUSCAR
                          </button>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Nombre de Usuario</label>
                        <input 
                          className="modern-input-premium-styled" 
                          placeholder="Opcional: C.I. por defecto"
                          value={newUserName} 
                          onChange={e => setNewUserName(e.target.value)} 
                          disabled={!!editingUser}
                          style={{ opacity: editingUser ? 0.6 : 1 }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Nombre Completo</label>
                        <input 
                          className="modern-input-premium-styled" 
                          value={newUserRealName} 
                          onChange={e => setNewUserRealName(e.target.value)} 
                          required 
                        />
                      </div>
                      <div className="form-group">
                        <label>Rol de Sistema</label>
                        <select className="modern-input-premium-styled" value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
                          <option value="JEFE_CAMPANA">Jefe de Campaña</option>
                          <option value="COORDINADOR">Coordinador de Campo</option>
                          <option value="MIEMBRO_DE_MESA">Miembro de Mesa</option>
                          <option value="CANDIDATO">Candidato (Solo Lectura)</option>
                          <option value="SUPERUSUARIO">Súper Usuario</option>
                        </select>
                      </div>
                      {newUserRole === 'MIEMBRO_DE_MESA' && (
                        <>
                          <div className="form-group">
                            <label>Local de Votación Asignado</label>
                            <select 
                              className="modern-input-premium-styled" 
                              value={newUserLocal || ''} 
                              onChange={e => setNewUserLocal(e.target.value)}
                              required
                            >
                              <option value="">Seleccione local...</option>
                              {locales.map(l => (
                                <option key={l.cod_local} value={l.nombre}>{l.nombre}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Número de Mesa</label>
                            <input 
                              type="number"
                              className="modern-input-premium-styled" 
                              placeholder="Ej: 5"
                              value={newUserMesa || ''} 
                              onChange={e => setNewUserMesa(parseInt(e.target.value))}
                              required
                            />
                          </div>
                        </>
                      )}
                      {(newUserRole === 'COORDINADOR' || newUserRole === 'CANDIDATO') && (
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label>Lista Electoral Asignada</label>
                          <select className="modern-input-premium-styled" value={newUserList} onChange={e => setNewUserList(e.target.value)} required>
                            <option value="">Seleccione la lista para este coordinador...</option>
                            {lists.map(l => (
                              <option key={l.id} value={l.id}>
                                {l.list_number} {l.type === 'CONCEJAL' ? `Op${l.option_number}` : '(Int.)'} — {l.candidate_alias || l.candidate_nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {newUserRole === 'JEFE_CAMPANA' && (
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label>Campaña que Administra</label>
                          <select className="modern-input-premium-styled" value={newUserCampaign} onChange={e => setNewUserCampaign(e.target.value)} required>
                            <option value="">Seleccione la campaña para este jefe...</option>
                            {campaigns.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="modal-footer-premium-styled">
                    <button type="button" onClick={() => setShowModal(null)} className="btn-cancel-styled">
                      Cancelar
                    </button>
                    <button type="submit" className="btn-confirm-styled" disabled={!isUserVerified}>
                      Finalizar Registro <ChevronRight size={18} />
                    </button>
                  </div>
                </form>
              )}

              {showModal === 'list' && (

                <form onSubmit={editingList ? handleUpdateList : handleCreateList} style={{ maxWidth: '600px', width: '100%', padding: 0 }}>
                  <div style={{ 
                    padding: '1.5rem', 
                    background: 'linear-gradient(to bottom, rgba(37,99,235,0.1), transparent)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: '1.5rem' 
                  }}>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, 'list')} />
                    <div style={{ 
                      width: '90px', height: '90px', borderRadius: '20px', 
                      background: 'rgba(255,255,255,0.03)', border: '2px solid var(--border-mid)', 
                      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      position: 'relative', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.3)' 
                    }} onClick={() => fileInputRef.current?.click()}>
                      {candidatePreview?.photo_url ? (
                        <img src={candidatePreview.photo_url} alt="Candidato" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <User size={44} style={{ color: 'var(--text-3)' }} />
                      )}
                      <div className="avatar-edit-overlay" style={{ background: 'rgba(0,0,0,0.6)' }}>
                        <Camera size={16} />
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--plra-300)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                        {editingList ? 'Actualizar Lista' : 'Registro de Lista Electoral'}
                      </div>
                      <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {candidatePreview?.nombre ? `${candidatePreview.nombre} ${candidatePreview.apellido || ''}` : 'Identificación de Candidato'}
                      </h2>
                      {isCandidateVerified && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                          <span className="verified-badge-compact"><ShieldCheck size={12} /></span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Ciudadano Verificado (C.I. {newListCandidateCI})</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: '0.75rem 1.25rem' }}>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>

                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '0.6rem', marginBottom: '0.15rem', display: 'block' }}>Campaña Electoral</label>
                        <select className="modern-input-premium-styled" value={newListCampaign} onChange={e => setNewListCampaign(e.target.value)} required>
                          <option value="">Seleccione una campaña...</option>
                          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>

                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '0.6rem', marginBottom: '0.15rem', display: 'block' }}>Candidato (C.I.)</label>
                        <div className="search-input-wrapper-premium">
                          <input 
                            className="modern-input-premium-styled" 
                            placeholder="Buscar en padrón..."
                            value={newListCandidateCI} 
                            onChange={e => setNewListCandidateCI(e.target.value)} 
                            required 
                          />
                          <button type="button" onClick={handleLookupCandidate} className="search-btn-action">BUSCAR</button>
                        </div>
                      </div>

                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '0.6rem', marginBottom: '0.15rem', display: 'block' }}>Tipo de Candidatura</label>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {['INTENDENTE', 'CONCEJAL'].map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setNewListType(t)}
                              style={{
                                flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid',
                                fontSize: '0.6rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                                background: newListType === t ? 'var(--blue-lt)' : 'rgba(255,255,255,0.03)',
                                borderColor: newListType === t ? 'var(--blue-lt)' : 'var(--border)',
                                color: newListType === t ? 'white' : 'var(--text-3)',
                              }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="form-group">
                        <label style={{ fontSize: '0.6rem', marginBottom: '0.15rem', display: 'block' }}>Número de Lista</label>
                        {newListType === 'INTENDENTE' ? (
                          <input 
                            className="modern-input-premium-styled" 
                            placeholder="Ej: 2"
                            value={newListNumber} 
                            onChange={e => setNewListNumber(e.target.value)} 
                            required 
                          />
                        ) : (
                          <select 
                            className="modern-input-premium-styled" 
                            value={newListNumber} 
                            onChange={e => setNewListNumber(e.target.value)}
                            required
                          >
                            <option value="">Lista de Intendente...</option>
                            {lists.filter(l => l.type === 'INTENDENTE' && l.campaign_id?.toString() === newListCampaign.toString()).map(l => (
                              <option key={l.id} value={l.list_number}>{l.list_number} — {l.candidate_alias || l.candidate_nombre}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="form-group">
                        <label style={{ fontSize: '0.6rem', marginBottom: '0.15rem', display: 'block' }}>Meta de Votos</label>
                        <input 
                          type="number"
                          className="modern-input-premium-styled" 
                          value={newListGoal} 
                          onChange={e => setNewListGoal(parseInt(e.target.value))} 
                        />
                      </div>

                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label style={{ fontSize: '0.6rem', marginBottom: '0.15rem', display: 'block' }}>Opción (Posición)</label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.15rem' }}>
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => {
                              const isTaken = takenOptions.includes(n);
                              const isSelected = newListOption === n.toString();
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  disabled={isTaken && !isSelected}
                                  onClick={() => setNewListOption(n.toString())}
                                  style={{
                                    height: '22px', borderRadius: '4px', border: '1px solid',
                                    fontSize: '0.6rem', fontWeight: 800, cursor: isTaken ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.1s',
                                    background: isSelected ? 'var(--blue-lt)' : isTaken ? 'rgba(255,0,0,0.1)' : 'rgba(255,255,255,0.03)',
                                    borderColor: isSelected ? 'var(--blue-lt)' : isTaken ? 'rgba(255,0,0,0.2)' : 'var(--border)',
                                    color: isSelected ? 'white' : isTaken ? 'var(--red)' : 'var(--text-3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}
                                >
                                  {n}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '0.6rem', marginBottom: '0.15rem', display: 'block' }}>Alias del Candidato</label>
                        <input 
                          className="modern-input-premium-styled" 
                          placeholder="Ej: El Líder"
                          value={newListAlias} 
                          onChange={e => setNewListAlias(e.target.value)} 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer-premium-styled" style={{ padding: '0.75rem 2rem', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button type="button" onClick={() => { setShowModal(null); setEditingList(null); }} className="btn-cancel-styled">DESCARTAR</button>
                    <button type="submit" className="btn-confirm-styled" disabled={!isCandidateVerified}>
                      {editingList ? 'GUARDAR' : 'REGISTRAR'} <ChevronRight size={14} />
                    </button>
                  </div>
                </form>
              )}




              {showModal === 'vehicle' && (
                <form onSubmit={handleCreateVehicle} style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
                  <h3 style={{ marginBottom: '1.5rem', color: 'var(--text)' }}>Registrar Nuevo Vehículo</h3>
                  <div className="form-group">
                    <label>Descripción</label>
                    <input className="modern-input-premium-styled" value={newVehicleDesc} onChange={e => setNewVehicleDesc(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>C.I. del Chofer</label>
                    <div className="search-input-wrapper-premium">
                      <input className="modern-input-premium-styled" value={newVehicleDriverCI} onChange={e => setNewVehicleDriverCI(e.target.value)} required />
                      <button type="button" onClick={handleLookupDriverCI} className="search-btn-action">VERIFICAR</button>
                    </div>
                  </div>
                  <div className="modal-footer-premium-styled">
                    <button type="button" onClick={() => setShowModal(null)} className="btn-cancel-styled">Cancelar</button>
                    <button type="submit" className="btn-confirm-styled" disabled={!isVehicleDriverVerified}>Guardar Vehículo <ChevronRight size={18} /></button>
                  </div>
                </form>
              )}

              {showModal === 'locale' && (
                <div style={{ maxWidth: '500px', width: '100%' }}>
                  <div className="modal-header-section">
                    <h3>{editingLocale ? 'Editar Local' : 'Nuevo Local de Votación'}</h3>
                  </div>
                  <form onSubmit={handleCreateLocale} style={{ padding: '1.5rem' }}>
                    <div className="form-group">
                      <label>Código de Local</label>
                      <input className="modern-input-premium-styled" value={newLocaleCod} onChange={e => setNewLocaleCod(e.target.value)} placeholder="Ej: 101" required disabled={!!editingLocale} />
                    </div>
                    <div className="form-group">
                      <label>Nombre de la Institución</label>
                      <input className="modern-input-premium-styled" value={newLocaleNombre} onChange={e => setNewLocaleNombre(e.target.value)} placeholder="Ej: Escuela Graduada Nro 1" required />
                    </div>
                    <div className="form-group">
                      <label>Dirección</label>
                      <input className="modern-input-premium-styled" value={newLocaleDireccion} onChange={e => setNewLocaleDireccion(e.target.value)} placeholder="Ej: Calle Principal c/ Ayolas" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label>Latitud</label>
                        <input className="modern-input-premium-styled" value={newLocaleLat} onChange={e => setNewLocaleLat(e.target.value)} placeholder="-22.5447" required />
                      </div>
                      <div className="form-group">
                        <label>Longitud</label>
                        <input className="modern-input-premium-styled" value={newLocaleLng} onChange={e => setNewLocaleLng(e.target.value)} placeholder="-55.7333" required />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Icono</label>
                      <select className="modern-input-premium-styled" value={newLocaleIcon} onChange={e => setNewLocaleIcon(e.target.value)}>
                        <option value="Landmark">Institucional</option>
                        <option value="School">Escuela</option>
                        <option value="Building">Edificio</option>
                        <option value="Home">Casa/Local</option>
                        <option value="MapPin">Pin</option>
                      </select>
                    </div>
                    <div className="modal-footer-premium-styled">
                      <button type="button" onClick={() => setShowModal(null)} className="btn-cancel-styled">Cancelar</button>
                      <button type="submit" className="btn-confirm-styled">{editingLocale ? 'Guardar Cambios' : 'Crear Local'}</button>
                    </div>
                  </form>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {cropperData && (
          <ImageCropperModal 
            image={cropperData.image} 
            onCropComplete={onCropComplete} 
            onCancel={() => setCropperData(null)} 
          />
        )}
      </AnimatePresence>
    </MainLayout>
  );
};

const StatCard = ({ icon: Icon, label, value, color }: any) => (
  <div style={{
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  }}>
    <div style={{ 
      width: '32px', height: '32px', borderRadius: '8px', 
      background: `${color}15`, border: `1px solid ${color}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <Icon size={16} style={{ color }} />
    </div>
    <div>
      <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
      <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>{value}</p>
    </div>
  </div>
);

export default SuperAdmin;
