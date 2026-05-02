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
  PlusCircle
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
  const [newCampaignModules, setNewCampaignModules] = useState<string[]>(['COMMAND_CENTER', 'REGISTRY']);
  const [newUserName, setNewUserName] = useState('');
  const [newVehicleDesc, setNewVehicleDesc] = useState('');
  const [newVehicleDriver, setNewVehicleDriver] = useState('');
  const [newVehiclePhone, setNewVehiclePhone] = useState('');
  const [newVehicleList, setNewVehicleList] = useState('');
  const [newVehicleDriverCI, setNewVehicleDriverCI] = useState('');
  const [newVehicleCapacity, setNewVehicleCapacity] = useState(4);
  const [newVehicleStatus, setNewVehicleStatus] = useState('AVAILABLE');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState('COORDINADOR');
  const [newUserRealName, setNewUserRealName] = useState('');
  const [newUserCI, setNewUserCI] = useState('');
  const [newUserList, setNewUserList] = useState('');
  const [userProfilePreview, setUserProfilePreview] = useState<any>(null);
  
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
  const [cropperData, setCropperData] = useState<{ image: string, type: 'user' | 'list' | 'app' } | null>(null);

  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            resolve(blob as Blob);
          }, 'image/jpeg', 0.85);
        };
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'user' | 'list' | 'app') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setCropperData({ image: reader.result as string, type });
      // Reset input value to allow re-selecting same file
      e.target.value = '';
    };
  };

  const onCropComplete = async (croppedBlob: Blob) => {
    if (!cropperData) return;
    const type = cropperData.type;
    setCropperData(null);

    try {
      const formData = new FormData();
      formData.append('photo', croppedBlob, 'photo.jpg');

      const res = await api.post('/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (type === 'user') {
        setUserProfilePreview((prev: any) => ({ ...prev, photo_url: res.data.photo_url }));
        if (editingUser?.id === authUser?.id) {
          updateUser({ photo_url: res.data.photo_url });
        }
      } else if (type === 'list') {
        setListPhotoUrl(res.data.photo_url);
        setCandidatePreview((prev: any) => ({ ...prev, photo_url: res.data.photo_url }));
      } else if (type === 'app') {
        updateSettings({ app_logo_url: res.data.photo_url });
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/campaigns', { 
        name: newCampaignName,
        enabled_modules: newCampaignModules 
      });
      setShowModal(null);
      setNewCampaignName('');
      setNewCampaignModules(['COMMAND_CENTER', 'REGISTRY']);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;
    try {
      await api.put(`/campaigns/${editingCampaign.id}`, { 
        name: newCampaignName,
        enabled_modules: newCampaignModules
      });
      setShowModal(null);
      setEditingCampaign(null);
      setNewCampaignName('');
      setNewCampaignModules(['COMMAND_CENTER', 'REGISTRY']);
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
    console.log("Updating list with data:", {
      id: editingList.id,
      goal: newListGoal,
      photo_url: candidatePreview?.photo_url || listPhotoUrl,
      type: newListType,
      list_number: newListNumber,
      option_number: newListOption,
      campaign_id: newListCampaign,
      candidate_alias: newListAlias,
      candidate_nombre: candidatePreview?.nombre
    });

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
        ci: newUserCI,
        list_id: newUserList,
        photo_url: userProfilePreview?.photo_url
      });
      setShowModal(null);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await api.put(`/users/${editingUser.id}`, {
        role: newUserRole,
        nombre: newUserRealName,
        assigned_list_id: newUserList,
        photo_url: userProfilePreview?.photo_url
      });
      setShowModal(null);
      setEditingUser(null);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await api.delete(`/users/${id}`);
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

  const handleAssignVehicle = async (capture_id: number, vehicle_id: string) => {
    try {
      await api.post('/logistics/assign', { capture_id, vehicle_id });
      fetchData();
    } catch (err) { console.error(err); }
  };

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

  const handleUpdateLocaleIcon = async (cod_local: string, icon: string) => {
    try {
      await api.put(`/voting-locations/${cod_local}/icon`, { icon });
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

  const fetchVehicles = async () => {
    try {
      const res = await api.get('/vehicles');
      setVehicles(res.data);
    } catch (err) { console.error(err); }
  };

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
        const res = await api.get('/users');
        setUsers(res.data);
        const lts = await api.get('/lists');
        setLists(lts.data);
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
          background: 'rgba(59,130,246,0.05)',
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
          { header: 'ID', accessor: 'id', width: '80px' },
          { header: 'Nombre', accessor: 'name' },
          { 
            header: 'Estado', 
            accessor: (c: Campaign) => (
              <span style={{ 
                padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                background: c.status === 'ACTIVE' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
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
          { header: 'Nº', accessor: 'list_number', width: '80px' },
          { 
            header: 'Candidato / Apodo', 
            accessor: (l: any) => (
              <div>
                <div style={{ fontWeight: 800, color: 'white' }}>{l.candidate_alias || l.candidate_nombre}</div>
                {l.candidate_alias && <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{l.candidate_nombre}</div>}
              </div>
            )
          },
          { header: 'Campaña', accessor: 'campaign_name' },
          { header: 'Tipo', accessor: 'type' },
          { header: 'Meta', accessor: 'goal' },
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
          { header: 'Fecha', accessor: (row: any) => new Date(row.timestamp).toLocaleString() },
          { header: 'Usuario', accessor: 'username' },
          { header: 'Acción', accessor: 'action' },
          { header: 'Detalles', accessor: 'details' }
        ]}
        data={auditLogs}
      />
    </div>
  );

  const renderLocales = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>Locales de Votación</h2>
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
                  {l.lat ? `${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}` : 'No ubicado'}
                </span>
              </div>
            )
          },
          {
            header: 'Icono Mapa',
            accessor: (l: any) => (
              <select 
                className="mini-input" 
                value={l.icon || 'Landmark'} 
                onChange={(e) => handleUpdateLocaleIcon(l.cod_local, e.target.value)}
              >
                <option value="Landmark">Institucional</option>
                <option value="School">Escuela</option>
                <option value="Building">Edificio</option>
                <option value="Home">Casa/Local</option>
                <option value="MapPin">Pin</option>
              </select>
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
            <Marker key={l.cod_local} position={[l.lat, l.lng]} icon={createCustomIcon('var(--plra-500)', l.icon, 28)}>
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
      
      {/* Group 1: General Info & Brand */}
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

      {/* Group 2: D-Day Logistics */}
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

      {/* Group 3: Multitenancy / SaaS Center */}
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
              <div key={c.id} style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

      {/* Group 4: Security & Master Key */}
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
          { header: 'Nombre', accessor: 'nombre' },
          { header: 'Usuario', accessor: 'username' },
          { 
            header: 'Rol', 
            accessor: (u: any) => (
              <span style={{ 
                padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                background: u.role === 'SUPERUSUARIO' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.05)',
                color: u.role === 'SUPERUSUARIO' ? 'var(--plra-300)' : 'var(--text-2)'
              }}>
                {u.role}
              </span>
            )
          },
          { header: 'Lista Asignada', accessor: 'list_number' },
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
                  setUserProfilePreview({ photo_url: u.photo_url, nombre: u.nombre });
                  setIsUserVerified(true);
                  setShowModal('user'); 
                }}><Edit2 size={14} /></button>
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
        {/* Column 1: Pending Requests */}
        <div className="card-premium-styled">
          <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} style={{ color: 'var(--plra-300)' }} /> Solicitudes Pendientes
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingLogistics.filter(p => !p.assigned_vehicle_id).map(cap => (
              <div key={cap.id} style={{ 
                padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', 
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
                <select 
                  className="mini-input" 
                  onChange={(e) => handleAssignVehicle(cap.id, e.target.value)}
                  defaultValue=""
                  style={{ width: '120px' }}
                >
                  <option value="" disabled>Asignar...</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.description}</option>
                  ))}
                </select>
              </div>
            ))}
            {pendingLogistics.filter(p => !p.assigned_vehicle_id).length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem', padding: '1rem' }}>No hay traslados pendientes</p>
            )}
          </div>
        </div>

        {/* Column 2: Fleet Status */}
        <div className="card-premium-styled">
          <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={18} style={{ color: 'var(--green)' }} /> Flota de Vehículos
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {vehicles.map(v => {
              const assignedCount = pendingLogistics.filter(p => p.assigned_vehicle_id === v.id).length;
              const statusColor = v.status === 'AVAILABLE' ? 'var(--green)' : v.status === 'IN_TRANSIT' ? 'var(--yellow)' : 'var(--red)';
              const statusLabel = v.status === 'AVAILABLE' ? 'Disponible' : v.status === 'IN_TRANSIT' ? 'En Ruta' : 'Mantenimiento';
              
              return (
              <div key={v.id} style={{ 
                padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', 
                borderRadius: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <p style={{ fontSize: '0.9rem', fontWeight: 800 }}>{v.description}</p>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', marginTop: '0.2rem' }}>
                      Chofer: <strong>{v.driver_name}</strong> {v.driver_ci && <span style={{ opacity: 0.7 }}>(CI: {v.driver_ci})</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                    <span style={{ 
                      fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                      background: `rgba(${v.status === 'AVAILABLE' ? '34,197,94' : v.status === 'IN_TRANSIT' ? '234,179,8' : '239,68,68'}, 0.15)`,
                      color: statusColor
                    }}>
                      {statusLabel}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>
                      Capacidad: {assignedCount} / {v.capacity || 4}
                    </span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  {pendingLogistics.filter(p => p.assigned_vehicle_id === v.id).map(cap => (
                    <div key={cap.id} style={{ 
                      padding: '0.2rem 0.5rem', background: 'rgba(34,197,94,0.1)', 
                      border: '1px solid rgba(34,197,94,0.2)', borderRadius: '6px', 
                      fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem'
                    }}>
                      <User size={10} /> {cap.nombre}
                    </div>
                  ))}
                  {assignedCount === 0 && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontStyle: 'italic' }}>Sin traslados asignados</span>
                  )}
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

      {/* --- MODALS --- */}
      <AnimatePresence>
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(null)}>
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              {showModal === 'campaign' && (
                <form onSubmit={handleCreateCampaign} style={{ padding: '2rem', maxWidth: '500px' }}>
                  <h3>Nueva Campaña</h3>
                  <div className="form-group">
                    <label>Nombre de la Campaña</label>
                    <input autoFocus className="modern-input-premium-styled" value={newCampaignName} onChange={e => setNewCampaignName(e.target.value)} placeholder="Ej: Municipales 2026" required />
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
                          padding: '0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)',
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
              )}

              {showModal === 'edit-campaign' && (
                <form onSubmit={handleUpdateCampaign} style={{ padding: '2rem', maxWidth: '500px' }}>
                  <h3>Editar Campaña</h3>
                  <div className="form-group">
                    <label>Nombre de la Campaña</label>
                    <input autoFocus className="modern-input-premium-styled" value={newCampaignName} onChange={e => setNewCampaignName(e.target.value)} required />
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
                          padding: '0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)',
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
                  {/* Header: User Profile with precise alignment */}
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

                  {/* Body: Structured Form Grid */}
                  <div style={{ padding: '2.5rem 2rem' }}>
                    <div className="form-grid">
                      
                      {/* Row 1: Identity Lookup & Internal Username */}
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

                      {/* Row 2: Personal Info & Access Role */}
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
                          <option value="CANDIDATO">Candidato (Solo Lectura)</option>
                          <option value="SUPERUSUARIO">Súper Usuario</option>
                        </select>
                      </div>

                      {/* Row 3: Assignment (Conditional, Full Width) */}
                      {(newUserRole === 'COORDINADOR' || newUserRole === 'CANDIDATO') && (
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label>Lista Electoral Asignada</label>
                          <select className="modern-input-premium-styled" value={newUserList} onChange={e => setNewUserList(e.target.value)} required>
                            <option value="">Seleccione la lista para este coordinador...</option>
                            {lists.map(l => (
                              <option key={l.id} value={l.id}>Lista {l.list_number} — {l.candidate_nombre}</option>
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
                  <style>{`
                    .premium-avatar-container-main { position: relative; cursor: pointer; transition: transform 0.2s; }
                    .premium-avatar-frame-v2 { width: 80px; height: 80px; border-radius: 18px; background: rgba(255,255,255,0.03); border: 2px solid var(--border-mid); overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative; box-shadow: 0 12px 30px rgba(0,0,0,0.4); }
                    .premium-avatar-frame-v2 img { width: 100%; height: 100%; object-fit: cover; }
                    .avatar-edit-badge { position: absolute; bottom: -4px; right: -4px; width: 32px; height: 32px; background: var(--plra-500); border: 3px solid #0a0e17; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 2; }
                    .verified-status-tag { display: flex; align-items: center; gap: 4px; background: rgba(34,197,94,0.15); color: #4ade80; padding: 2px 8px; border-radius: 4px; font-size: 0.6rem; font-weight: 900; letter-spacing: 0.05em; }
                  `}</style>
                  {/* Header: Candidate Identity with precise alignment */}
                  <div style={{ 
                    padding: '1rem 1.25rem', 
                    background: 'linear-gradient(to bottom, rgba(37,99,235,0.08), transparent)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: '1rem' 
                  }}>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, 'list')} />
                    <div className="premium-avatar-container-main" onClick={() => fileInputRef.current?.click()}>
                      <div className="premium-avatar-frame-v2">
                        {candidatePreview?.photo_url ? (
                          <img src={candidatePreview.photo_url} alt="Candidato" />
                        ) : (
                          <User size={40} style={{ color: 'var(--text-3)' }} />
                        )}
                        <div className="avatar-edit-badge">
                          <Camera size={14} />
                        </div>
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                        <span style={{ 
                          fontSize: '0.65rem', fontWeight: 800, color: 'var(--plra-300)', 
                          letterSpacing: '0.15em', textTransform: 'uppercase',
                          background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '4px'
                        }}>
                          Perfil del Candidato
                        </span>
                        {candidatePreview?.nombre && (
                          <div className="verified-status-tag">
                            <ShieldCheck size={12} />
                            <span>VERIFICADO</span>
                          </div>
                        )}
                      </div>
                      <h2 style={{ 
                        margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'white',
                        fontFamily: 'var(--font-display)', letterSpacing: '-0.02em',
                        lineHeight: 1.1
                      }}>
                        {candidatePreview?.nombre ? `${candidatePreview.nombre} ${candidatePreview.apellido || ''}` : 'Esperando Verificación'}
                      </h2>
                      <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ opacity: 0.5 }}>C.I. Nº</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{newListCandidateCI || '---'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Body: Optimized Grid for Space and Flow */}
                  <div style={{ padding: '1rem 1.25rem' }}>
                    <div className="form-grid" style={{ gap: '0.5rem' }}>
                      
                      {/* Row 1: Identity & Alias */}
                      <div className="form-group">
                        <label>Documento de Identidad</label>
                        <div className="search-input-wrapper-premium">
                          <input 
                            className="modern-input-premium-styled" 
                            placeholder="C.I. Nº"
                            value={newListCandidateCI} 
                            onChange={e => setNewListCandidateCI(e.target.value)} 
                            required 
                          />
                          <button type="button" onClick={handleLookupCandidate} className="search-btn-action">
                            VERIFICAR
                          </button>
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Nombre de Campaña / Apodo</label>
                        <input 
                          className="modern-input-premium-styled" 
                          placeholder="Ej: El León del Norte"
                          value={newListAlias}
                          onChange={(e) => setNewListAlias(e.target.value)}
                        />
                      </div>

                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label>Jerarquía</label>
                        <select 
                          className="modern-input-premium-styled" 
                          value={newListType} 
                          onChange={e => setNewListType(e.target.value)}
                        >
                          <option value="INTENDENTE">Intendente</option>
                          <option value="CONCEJAL">Concejal</option>
                        </select>
                      </div>

                      {/* Row 2: Campaign (Full Width) */}
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label>Campaña Electoral</label>
                        <select 
                          className="modern-input-premium-styled" 
                          value={newListCampaign} 
                          onChange={e => setNewListCampaign(e.target.value)} 
                          required
                        >
                          <option value="">Seleccione Campaña de Destino</option>
                          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>

                      {/* Row 3: List Number and Option */}
                      <div className="form-group">
                        <label>Número de Lista</label>
                        <input 
                          className="modern-input-premium-styled" 
                          value={newListNumber} 
                          onChange={e => setNewListNumber(e.target.value)} 
                          placeholder="Ej: 100"
                          required 
                        />
                      </div>

                      <div className="form-group">
                        <label>{newListType === 'CONCEJAL' ? 'Opción / Posición' : 'Restricción'}</label>
                        <input 
                          className="modern-input-premium-styled" 
                          style={{ 
                            opacity: newListType === 'CONCEJAL' ? 1 : 0.5,
                            background: newListType === 'CONCEJAL' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.1)'
                          }}
                          value={newListOption} 
                          onChange={e => setNewListOption(e.target.value)} 
                          placeholder={newListType === 'CONCEJAL' ? 'Número de Opción' : 'N/A para Intendente'}
                          disabled={newListType !== 'CONCEJAL'}
                        />
                      </div>

                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label>Meta de Votos (Capturas Objetivo)</label>
                        <input 
                          type="number"
                          className="modern-input-premium-styled" 
                          value={newListGoal} 
                          onChange={e => setNewListGoal(parseInt(e.target.value))} 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer-premium-styled">
                    <button type="button" onClick={() => setShowModal(null)} className="btn-cancel-styled">
                      Descartar
                    </button>
                    <button type="submit" className="btn-confirm-styled" disabled={!isCandidateVerified}>
                      Registrar Lista <ChevronRight size={18} />
                    </button>
                  </div>
                </form>
              )}

              {showModal === 'vehicle' && (
                <form onSubmit={handleCreateVehicle} style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
                  <h3 style={{ marginBottom: '1.5rem', color: 'var(--text)' }}>Registrar Nuevo Vehículo</h3>
                  <div className="form-group">
                    <label>Descripción del Vehículo</label>
                    <input className="modern-input-premium-styled" placeholder="Ej: Camioneta Blanca - Chapa ABC 123" value={newVehicleDesc} onChange={e => setNewVehicleDesc(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>C.I. del Chofer</label>
                    <div className="search-input-wrapper-premium">
                      <input className="modern-input-premium-styled" placeholder="Nº de Cédula" value={newVehicleDriverCI} onChange={e => setNewVehicleDriverCI(e.target.value)} required />
                      <button type="button" onClick={handleLookupDriverCI} className="search-btn-action">VERIFICAR</button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Nombre del Chofer</label>
                    <input className="modern-input-premium-styled" value={newVehicleDriver} onChange={e => setNewVehicleDriver(e.target.value)} placeholder="Autocompletado o Manual" required />
                  </div>
                  <div className="form-group">
                    <label>Teléfono del Chofer (WhatsApp)</label>
                    <input 
                      className="modern-input-premium-styled" 
                      value={newVehiclePhone} 
                      onChange={e => formatPhone(e.target.value)} 
                      placeholder="+595 9xx xxx xxx"
                      required 
                    />
                  </div>
                  <div className="form-grid" style={{ gap: '1rem' }}>
                    <div className="form-group">
                      <label>Capacidad (Pasajeros)</label>
                      <input type="number" className="modern-input-premium-styled" value={newVehicleCapacity} onChange={e => setNewVehicleCapacity(parseInt(e.target.value))} required />
                    </div>
                    <div className="form-group">
                      <label>Estado</label>
                      <select className="modern-input-premium-styled" value={newVehicleStatus} onChange={e => setNewVehicleStatus(e.target.value)}>
                        <option value="AVAILABLE">Disponible</option>
                        <option value="IN_TRANSIT">En Ruta</option>
                        <option value="MAINTENANCE">Mantenimiento</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Asignar a Lista (Opcional)</label>
                    <select className="modern-input-premium-styled" value={newVehicleList} onChange={e => setNewVehicleList(e.target.value)}>
                      <option value="">Uso General (Sin lista fija)</option>
                      {lists.map(l => <option key={l.id} value={l.id}>Lista {l.list_number} - {l.candidate_nombre}</option>)}
                    </select>
                  </div>
                  <div className="modal-footer-premium-styled">
                    <button type="button" onClick={() => setShowModal(null)} className="btn-cancel-styled">Cancelar</button>
                    <button type="submit" className="btn-confirm-styled" disabled={!isVehicleDriverVerified}>Guardar Vehículo <ChevronRight size={18} /></button>
                  </div>
                </form>
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
    background: 'rgba(255,255,255,0.02)',
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
