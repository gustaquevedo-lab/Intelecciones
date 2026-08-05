import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  UserPlus,
  Flag,
  Users as UsersIcon,
  Database,
  Activity,
  CheckCircle2,
  X,
  Check,
  Users,
  Shield,
  Layout,
  Image,
  LayoutList,
  MapPin,
  Settings,
  AlertTriangle,
  FileText,
  Download,
  Truck,
  Clock,
  Save,
  Key,
  TrendingUp,
  TrendingDown,
  User,
  Copy,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { AdminSidebar } from '../components/AdminSidebar';
import { ManagementTable } from '../components/ManagementTable';
import { Skeleton, SkeletonTable } from '../components/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageCropperModal } from '../components/ImageCropperModal';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getImageUrl } from '../services/api';
import { CIUDADES_PARAGUAY } from '../constants/cities';
import TabOverview from './super-admin/TabOverview';
import TabCampaigns from './super-admin/TabCampaigns';
import TabLists from './super-admin/TabLists';
import TabAudit from './super-admin/TabAudit';
import TabLocales from './super-admin/TabLocales';
import TabSettings from './super-admin/TabSettings';
import TabPadrones from './super-admin/TabPadrones';
import TabSystem from './super-admin/TabSystem';
import TabUsers from './super-admin/TabUsers';
import TabLogistics from './super-admin/TabLogistics';
import BulkImportAssistantsModal from './super-admin/BulkImportAssistantsModal';

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

// --- Types ---
interface Campaign {
  id: number;
  name: string;
  status: string;
  distrito?: string;
  goal?: number;
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
  candidate_alias?: string;
  ciudad?: string;
}

import { useSettings } from '../context/SettingsContext';

// Helper component for dynamic map repositioning
const MapRecenter = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
};


interface User {
  id: number;
  username: string;
  role: string;
  nombre: string;
  assigned_list_id?: number;
  assigned_campaign_id?: number;
  list_number?: string;
  effective_campaign_id?: number;
  user_district?: string;
}

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

const SuperAdmin = () => {
  const {
    user: authUser,
    loading,
    activeListId,
    setActiveListId,
    activeDistrict,
    setActiveDistrict
  } = useAuth();
  const { refreshSettings } = useSettings();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [localeSearchTerm, setLocaleSearchTerm] = useState('');
  const [localeCityFilter, setLocaleCityFilter] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [stats, setStats] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [locales, setLocales] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<any[]>([]);
  const [activeAuditTab, setActiveAuditTab] = useState<'logs' | 'security'>('logs');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any>(null);
  const [pendingLogistics, setPendingLogistics] = useState<any[]>([]);
  const [captures, setCaptures] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [selectedCityForLists, setSelectedCityForLists] = useState<string | null>(null);

  // Audit Filters
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditFilterStart, setAuditFilterStart] = useState('');
  const [auditFilterEnd, setAuditFilterEnd] = useState('');
  const [electionDate, setElectionDate] = useState('2026-06-07T07:00:00');
  const [electionEndTime, setElectionEndTime] = useState('17:00');
  const [globalGoal, setGlobalGoal] = useState(10000);
  const [masterKey, setMasterKey] = useState('');
  const [appPlatformName, setAppPlatformName] = useState('Intelecciones');
  const [appLogoUrl, setAppLogoUrl] = useState('');
  const [shareMessage, setShareMessage] = useState('🔹 *DATOS ELECTORALES* 🔹');
  const [shareMessageFooter, setShareMessageFooter] = useState('#Intelecciones #PLRA #DíaD');

  const [isLoading, setIsLoading] = useState(true);
  const [serverWaking, setServerWaking] = useState(false);
  const [isUserVerified, setIsUserVerified] = useState(false);
  const [isCandidateVerified, setIsCandidateVerified] = useState(false);
  const [isVehicleDriverVerified, setIsVehicleDriverVerified] = useState(false);
  const [apiError, setApiError] = useState<{ message: string; details?: string } | null>(null);
  const [apiCriticalError, setApiCriticalError] = useState<Error | null>(null);

  const cities = Array.from(new Set([
    'PEDRO J. CABALLERO',
    'CONCEPCION',
    'ASUNCION',
    'CIUDAD DEL ESTE',
    'ENCARNACION',
    'LUQUE',
    'SAN LORENZO',
    'CORONEL OVIEDO',
    ...(Array.isArray(lists) ? lists.map(l => l.ciudad === 'PEDRO JUAN CABALLERO' ? 'PEDRO J. CABALLERO' : l.ciudad) : []),
    ...(Array.isArray(locales) ? locales.map(l => (l.ciudad || l.distrito) === 'PEDRO JUAN CABALLERO' ? 'PEDRO J. CABALLERO' : (l.ciudad || l.distrito)) : []),
    ...(Array.isArray(campaigns) ? campaigns.map(c => c.distrito === 'PEDRO JUAN CABALLERO' ? 'PEDRO J. CABALLERO' : c.distrito) : [])
  ].filter(Boolean))).sort();

  const handleCopyDiagnostic = (error: any) => {
    const report = `--- API ERROR REPORT ---
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}
Message: ${error.message || 'Unknown'}
Server Response: ${JSON.stringify(error.response?.data || 'No data')}
Status: ${error.response?.status || 'N/A'}
-----------------------`;
    navigator.clipboard.writeText(report);
    alert('Reporte diagnóstico copiado al portapapeles. Pégalo en el chat de soporte.');
  };

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
  const [newLocaleCiudad, setNewLocaleCiudad] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>([-22.545, -55.72]);
  const [mapZoom, setMapZoom] = useState(14);
  const [padronStats, setPadronStats] = useState<any[]>([]);
  const [importingPadron, setImportingPadron] = useState(false);
  const [importCity, setImportCity] = useState('');

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

    const distritos = Array.from(new Set((Array.isArray(campaigns) ? campaigns : []).map(c => c.distrito).filter(Boolean)));
    const distMsg = distritos.length > 0
      ? `Distritos detectados: ${distritos.join(', ')}.\n\n`
      : '';

    const distritoInput = prompt(
      `NIVEL DE SEGURIDAD 3: ¿Qué datos desea purgar?\n\n` +
      `${distMsg}` +
      `Escriba el nombre EXACTO del distrito (ej. "PEDRO JUAN CABALLERO") o escriba "TODOS" para una limpieza global.`
    );

    if (!distritoInput) return;
    const targetDistrito = distritoInput.trim();

    const finalCheck = prompt(`CONFIRMACIÓN FINAL: Escriba "LIMPIAR ${targetDistrito.toUpperCase()}" para ejecutar la acción:`);
    if (finalCheck?.toUpperCase() !== `LIMPIAR ${targetDistrito.toUpperCase()}`) {
      alert("Operación cancelada. El texto de confirmación no coincide.");
      return;
    }

    try {
      setIsLoading(true);
      const res = await api.post('/admin/system/wipe-captures', {
        key,
        distrito: targetDistrito.toUpperCase() === 'TODOS' ? 'ALL' : targetDistrito
      });
      alert(`✅ PROCESO FINALIZADO: ${res.data.message || 'Purga completada.'}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error en la autorización o proceso');
    } finally {
      setIsLoading(false);
    }
  };

  // Form states
  const [showModal, setShowModal] = useState<string | null>(null);
  const [selectedSyncDistrict, setSelectedSyncDistrict] = useState('');
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editingList, setEditingList] = useState<List | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userCampaignFilter, setUserCampaignFilter] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignSlogan, setNewCampaignSlogan] = useState('');
  const [newCampaignGoal, setNewCampaignGoal] = useState<number>(1000);
  const [newCampaignDistrito, setNewCampaignDistrito] = useState('');
  const [newCampaignPhotoUrl, setNewCampaignPhotoUrl] = useState('');
  const [newCampaignModules, setNewCampaignModules] = useState<string[]>([
    'COMMAND_CENTER', 'CC_FIELD_REQUESTS', 'CC_ELECTOR_REGISTRY', 'CC_RANKINGS', 'CC_HEATMAP',
    'REGISTRY', 'REG_CAPTURE', 'REG_LOOKUP', 'REG_SHARE',
    'LOGISTICS', 'LOG_VEHICLES', 'LOG_ROUTES', 'LOG_ZONES', 'LOG_TRANSPORT',
    'WHATSAPP', 'WA_BROADCAST', 'WA_CONTACTS', 'WA_TEMPLATES',
    'DIAD', 'DD_COUNTDOWN', 'DD_VEEDORES', 'DD_ACTAS', 'DD_RESULTS'
  ]);
  const [newUserName, setNewUserName] = useState('');
  const [takenOptions, setTakenOptions] = useState<number[]>([]);
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState('COORDINADOR');
  const [newUserRealName, setNewUserRealName] = useState('');
  const [newUserCI, setNewUserCI] = useState('');
  const [newUserList, setNewUserList] = useState('');
  const [newUserCampaign, setNewUserCampaign] = useState('');
  const [userProfilePreview, setUserProfilePreview] = useState<any>(null);
  const [newUserLocal, setNewUserLocal] = useState('');
  const [newUserMesa, setNewUserMesa] = useState<number | null>(null);
  const [newUserParent, setNewUserParent] = useState('');
  const [newUserTelefono, setNewUserTelefono] = useState('');
  const [newUserDistrito, setNewUserDistrito] = useState('');
  // List Form
  const [newListCiudad, setNewListCiudad] = useState('');
  const [newListCampaign, setNewListCampaign] = useState('');
  const [newListType, setNewListType] = useState('INTENDENTE');
  const [newListNumber, setNewListNumber] = useState('');
  const [newListOption, setNewListOption] = useState('');
  const [newListCandidateCI, setNewListCandidateCI] = useState('');
  const [newListAlias, setNewListAlias] = useState('');
  const [candidatePreview, setCandidatePreview] = useState<any>(null);
  const [newListGoal, setNewListGoal] = useState(1000);
  const [listPhotoUrl, setListPhotoUrl] = useState('');

  // List Filters
  const [listSearchTerm, setListSearchTerm] = useState('');
  const [listCityFilter] = useState('');
  const [listTypeFilter, setListTypeFilter] = useState('');

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

  const onCropComplete = async (croppedBlob: Blob) => {
    if (!cropperData) return;
    const { type } = cropperData;
    setCropperData(null);

    try {
      const formData = new FormData();
      formData.append('photo', croppedBlob, 'photo.jpg');

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
    } catch (err: any) {
      alert('Error al subir la imagen: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/campaigns', {
        name: newCampaignName,
        slogan: newCampaignSlogan,
        goal: newCampaignGoal,
        distrito: newCampaignDistrito,
        photo_url: newCampaignPhotoUrl,
        enabled_modules: newCampaignModules
      });
      setShowModal(null);
      setNewCampaignName('');
      setNewCampaignSlogan('');
      setNewCampaignGoal(1000);
      setNewCampaignDistrito('');
      setNewCampaignPhotoUrl('');
      setNewCampaignModules([
        'COMMAND_CENTER', 'CC_FIELD_REQUESTS', 'CC_ELECTOR_REGISTRY', 'CC_RANKINGS', 'CC_HEATMAP',
        'REGISTRY', 'REG_CAPTURE', 'REG_LOOKUP', 'REG_SHARE',
        'LOGISTICS', 'LOG_VEHICLES', 'LOG_ROUTES', 'LOG_ZONES', 'LOG_TRANSPORT',
        'WHATSAPP', 'WA_BROADCAST', 'WA_CONTACTS', 'WA_TEMPLATES',
        'DIAD', 'DD_COUNTDOWN', 'DD_VEEDORES', 'DD_ACTAS', 'DD_RESULTS'
      ]);
      fetchData(true);
    } catch (err: any) {
      alert('Error al crear la campaña: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;
    try {
      await api.put(`/campaigns/${editingCampaign.id}`, {
        name: newCampaignName,
        slogan: newCampaignSlogan,
        goal: newCampaignGoal,
        distrito: newCampaignDistrito,
        photo_url: newCampaignPhotoUrl,
        enabled_modules: newCampaignModules
      });
      setShowModal(null);
      setEditingCampaign(null);
      setNewCampaignName('');
      setNewCampaignSlogan('');
      setNewCampaignGoal(1000);
      setNewCampaignDistrito('');
      setNewCampaignPhotoUrl('');
      setNewCampaignModules([
        'COMMAND_CENTER', 'CC_FIELD_REQUESTS', 'CC_ELECTOR_REGISTRY', 'CC_RANKINGS', 'CC_HEATMAP',
        'REGISTRY', 'REG_CAPTURE', 'REG_LOOKUP', 'REG_SHARE',
        'LOGISTICS', 'LOG_VEHICLES', 'LOG_ROUTES', 'LOG_ZONES', 'LOG_TRANSPORT',
        'WHATSAPP', 'WA_BROADCAST', 'WA_CONTACTS', 'WA_TEMPLATES',
        'DIAD', 'DD_COUNTDOWN', 'DD_VEEDORES', 'DD_ACTAS', 'DD_RESULTS'
      ]);
      fetchData(true);
    } catch (err: any) {
      alert('Error al actualizar la campaña: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteCampaign = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta campaña y TODAS sus listas y coordinadores asociados?')) return;
    try {
      await api.delete(`/campaigns/${id}`);
      fetchData(true);
    } catch (err: any) {
      alert('Error al eliminar la campaña: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/lists', {
        ciudad: newListCiudad,
        campaign_id: newListCampaign,
        type: newListType,
        list_number: newListNumber,
        option_number: newListOption,
        candidate_ci: newListCandidateCI,
        candidate_nombre: candidatePreview?.nombre,
        candidate_alias: newListAlias,
        goal: newListGoal,
        photo_url: candidatePreview?.photo_url || listPhotoUrl
      });
      setShowModal(null);
      fetchData(true);
    } catch (err: any) {
      alert('Error al crear la lista: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingList) return;
    try {
      const res = await api.put(`/lists/${editingList.id}`, {
        ciudad: newListCiudad,
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
        fetchData(true);
      } else {
        alert("Error al actualizar: " + (res.data.error || "Desconocido"));
      }
    } catch (err: any) {
      alert("Error de conexión al actualizar la lista.");
    }
  };

  const handleDeleteList = async (id: number) => {
    if (!confirm('¿Eliminar esta lista?')) return;
    try {
      await api.delete(`/lists/${id}`);
      fetchData(true);
    } catch (err: any) {
      alert('Error al eliminar la lista: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalNombre = newUserRealName.trim();
    const finalRole = newUserRole;
    const finalUsername = (newUserName || newUserCI).trim();
    const finalPassword = (newUserPass || newUserCI).trim().replace(/\./g, '');

    if (!finalNombre || !finalRole || !finalUsername) {
      alert('⚠️ Faltan datos obligatorios. Asegúrese de verificar la C.I. para cargar el nombre.');
      return;
    }

    try {
      await api.post('/users', {
        username: finalUsername,
        password: finalPassword,
        role: finalRole,
        nombre: finalNombre,
        ci: newUserCI,
        assigned_list_id: newUserList || null,
        assigned_campaign_id: newUserCampaign || null,
        assigned_local: newUserLocal || null,
        assigned_mesa: newUserMesa || null,
        photo_url: userProfilePreview?.photo_url,
        parent_id: newUserParent || null,
        telefono: newUserTelefono || null,
        distrito: newUserDistrito || activeDistrict || null
      });
      setShowModal(null);
      setNewUserLocal('');
      setNewUserMesa(null);
      setNewUserTelefono('');
      fetchData(true);
    } catch (err: any) {
      alert('Error: ' + (err.response?.data?.error || 'No se pudo crear el usuario.'));
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await api.put(`/users/${editingUser.id}`, {
        role: newUserRole,
        nombre: newUserRealName,
        ci: newUserCI,
        assigned_list_id: newUserList || null,
        assigned_campaign_id: newUserCampaign || null,
        assigned_local: newUserLocal || null,
        assigned_mesa: newUserMesa || null,
        photo_url: userProfilePreview?.photo_url,
        parent_id: newUserParent || null,
        telefono: newUserTelefono || null,
        distrito: newUserDistrito || null
      });
      setShowModal(null);
      setEditingUser(null);
      setNewUserLocal('');
      setNewUserMesa(null);
      setNewUserTelefono('');
      fetchData();
    } catch (err) {
      alert('Error al actualizar usuario.');
    }
  };

  const handleDeleteUser = async (id: number) => {
    const userToDelete = users.find(u => u.id === id);
    if (userToDelete?.username === 'admin') {
      alert('No se puede eliminar al administrador maestro del sistema.');
      return;
    }
    if (!window.confirm('¿Está seguro de eliminar este operador? Esta acción no se puede deshacer.')) return;
    
    const deleteCaptures = window.confirm(
      `¿Desea ELIMINAR también todas las capturas (electores) de este usuario?\n\n` +
      `[ Aceptar ] -> Eliminar capturas.\n` +
      `[ Cancelar ] -> NO eliminar (serán heredadas por su superior).`
    );
    
    const action = deleteCaptures ? 'delete' : 'inherit';

    try {
      await api.delete(`/users/${id}?action=${action}`);
      fetchData(true);
    } catch (err: any) {
      alert('No se pudo eliminar el usuario: ' + (err.response?.data?.error || 'Error interno del servidor'));
    }
  };

  const handleResetPassword = async (id: number) => {
    if (!confirm('¿Forzar a este usuario a cambiar su contraseña en el próximo ingreso?')) return;
    try {
      await api.post(`/admin/users/${id}/reset-password`);
      alert('Reset exitoso. El usuario deberá asignar una nueva clave al entrar.');
      fetchData(true);
    } catch (err: any) {
      alert('Error al resetear contraseña: ' + (err.response?.data?.error || err.message));
    }
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
            const fullName = `${res.data.nombre} ${res.data.apellido || ''}`.trim();
            setCandidatePreview({ photo_url: res.data.photo_url, nombre: fullName, apellido: res.data.apellido || '' });
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
        const fullName = `${res.data.nombre} ${res.data.apellido || ''}`.trim();
        setCandidatePreview({ photo_url: res.data.photo_url, nombre: fullName, apellido: res.data.apellido || '' });
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
      const campaignLists = (Array.isArray(lists) ? lists : []).filter(l => l.campaign_id?.toString() === newListCampaign.toString());

      // Filter taken options ONLY for the currently selected list number
      const options = campaignLists
        .filter(l => l.type === 'CONCEJAL' && l.list_number === newListNumber)
        .map(l => parseInt(l.option_number || '0'))
        .filter(n => n > 0);
      setTakenOptions(options);
    }
  }, [newListCampaign, newListNumber, newListType, lists, editingList]);

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
      fetchData(true);
    } catch (err: any) {
      alert('Error al crear el vehículo: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/settings', {
        election_date: electionDate,
        election_end_time: electionEndTime,
        global_goal: globalGoal.toString(),
        master_key: masterKey,
        app_name: appPlatformName,
        app_logo_url: appLogoUrl,
        share_message: shareMessage,
        share_message_footer: shareMessageFooter
      });
      refreshSettings();
      alert('Configuración guardada correctamente.');
    } catch (err: any) {
      alert('Error al guardar configuración: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCreateLocale = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanLat = newLocaleLat?.toString().replace(',', '.') || '';
      const cleanLng = newLocaleLng?.toString().replace(',', '.') || '';

      const payload = {
        cod_local: newLocaleCod,
        nombre: newLocaleNombre,
        direccion: newLocaleDireccion,
        lat: cleanLat ? parseFloat(cleanLat) : null,
        lng: cleanLng ? parseFloat(cleanLng) : null,
        icon: newLocaleIcon,
        ciudad: newLocaleCiudad,
        distrito: newLocaleCiudad
      };

      if (editingLocale) {
        await api.put(`/locales/${encodeURIComponent(editingLocale.cod_local)}`, payload);
      } else {
        await api.post('/locales', payload);
      }
      setShowModal(null);
      fetchData();
    } catch (err: any) {
      const serverError = err.response?.data?.error || err.message;
      setApiError({
        message: 'Error al guardar el local',
        details: serverError
      });
    }
  };

  const handleDeleteLocale = async (cod: string) => {
    if (!confirm('¿Seguro que desea eliminar este local?')) return;
    try {
      await api.delete(`/locales/${cod}`);
      fetchData();
    } catch (err: any) {
      alert('Error al eliminar el local de votación: ' + (err.response?.data?.error || err.message));
    }
  };

  const fetchAuditData = useCallback(async () => {
    try {
      const res = await api.get('/admin/audit', {
        params: {
          action: auditFilterAction,
          limit: 200
        }
      });
      setAuditLogs(res.data);
    } catch (err) { /* data fetch - errors handled by empty state UI */ }
  }, [auditFilterAction]);

  const fetchSystemHealth = useCallback(async () => {
    try {
      const res = await api.get('/admin/system/health');
      setSystemStats(res.data);
    } catch (err) { /* polling fetch - expected to fail occasionally */ }
  }, []);

  const fetchLoginAttempts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/login-attempts');
      setLoginAttempts(data);
    } catch (err) {
      /* ignore - background fetch */
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setApiError(null);
    try {
      let hasErrors = false;
      let lastErrorMessage = '';

      const safeGet = async (url: string, fallback: any = null, retries = 0) => {
        for (let attempt = 1; attempt <= retries + 1; attempt++) {
          try {
            const res = await api.get(url, { timeout: 6000 });
            if (serverWaking) setServerWaking(false);
            return res.data;
          } catch (err: any) {
            if (attempt <= retries) {
              const isNetworkOrTimeout = !err.response;
              if (isNetworkOrTimeout) setServerWaking(true);
              const delay = isNetworkOrTimeout ? 1000 : Math.pow(2, attempt) * 150;
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            hasErrors = true;
            lastErrorMessage = err.response?.data?.error || err.message || 'Error de conexión';
            return fallback;
          }
        }
      };

      if (activeTab === 'overview') {
        let summaryUrl = '/stats/summary';
        if (selectedCampaignId && selectedCampaignId !== 'all') {
          summaryUrl += `?campaign_id=${selectedCampaignId}`;
        }

        // Parallel requests — cut load time 4x
        const [summary, predictionsRes, allLocales, allCamps] = await Promise.all([
          safeGet(summaryUrl),
          safeGet('/stats/predictions'),
          safeGet('/voting-locations', []),
          safeGet('/campaigns', []),
        ]);

        if (summary) {
          setStats(summary);
          setServerWaking(false);
        } else if (!silent) {
          setServerWaking(true);
        }

        if (predictionsRes) setPredictions(predictionsRes);
        setLocales(Array.isArray(allLocales) ? allLocales : []);
        setUsers([]);
        setLists([]);
        setCampaigns(Array.isArray(allCamps) ? allCamps : []);
      } else if (activeTab === 'campaigns') {
        const res = await safeGet('/campaigns', []);
        setCampaigns(Array.isArray(res) ? res : []);
      } else if (activeTab === 'lists') {
        const [lts, camps] = await Promise.all([
          safeGet('/lists', []),
          safeGet('/campaigns', [])
        ]);
        setLists(Array.isArray(lts) ? lts : []);
        setCampaigns(Array.isArray(camps) ? camps : []);
      } else if (activeTab === 'users') {
        const [res, lts, camps] = await Promise.all([
          safeGet('/users', []),
          safeGet('/lists', []),
          safeGet('/campaigns', [])
        ]);
        setUsers(Array.isArray(res) ? res : []);
        setLists(Array.isArray(lts) ? lts : []);
        setCampaigns(Array.isArray(camps) ? camps : []);
      } else if (activeTab === 'audit') {
        await fetchAuditData();
      } else if (activeTab === 'logistics') {
        const [v, p, lts] = await Promise.all([
          safeGet('/vehicles', []),
          safeGet('/logistics/pending', []),
          safeGet('/lists', [])
        ]);
        setVehicles(Array.isArray(v) ? v : []);
        setPendingLogistics(Array.isArray(p) ? p : []);
        setLists(Array.isArray(lts) ? lts : []);
      } else if (activeTab === 'locales') {
        const res = await safeGet('/voting-locations', []);
        setLocales(Array.isArray(res) ? res : []);
      } else if (activeTab === 'settings') {
        const res = await safeGet('/settings');
        if (res) {
          if (res.election_date) {
            const dateOnly = res.election_date.split('T')[0];
            setElectionDate(dateOnly);
          }
          if (res.election_end_time) setElectionEndTime(res.election_end_time);
          const goal = parseInt(res.global_goal);
          setGlobalGoal(isNaN(goal) ? 10000 : goal);
          if (res.master_key) setMasterKey(res.master_key);
          if (res.app_name) setAppPlatformName(res.app_name);
          if (res.app_logo_url) setAppLogoUrl(res.app_logo_url);
          if (res.share_message) setShareMessage(res.share_message);
          if (res.share_message_footer) setShareMessageFooter(res.share_message_footer);
        }
      }

      if (hasErrors && !silent) {
        setApiCriticalError(new Error(
          `API_ERROR: Algunos datos del panel no pudieron cargarse de forma completa.\n` +
          `Servidor: ${lastErrorMessage || 'Error de sincronización o concurrencia SQLite'}\n` +
          `Timestamp: ${new Date().toISOString()}`
        ));
      }
    } catch (err: any) {
      setApiCriticalError(new Error(
        `API_CRITICAL_ERROR: Ocurrió un error crítico inesperado al procesar los datos de administración.\n` +
        `Detalles: ${err.message || 'Error desconocido'}\n` +
        `Stack: ${err.stack || 'No disponible'}`
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncLocales = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/campaigns');
      const camps = Array.isArray(res.data) ? res.data : [];
      setCampaigns(camps);
      
      const distritos = Array.from(new Set(camps.map(c => c.distrito).filter(Boolean)));
      if (distritos.length === 0) {
        alert('No hay distritos configurados en las campañas. Cree una campaña con su distrito primero.');
        setIsLoading(false);
        return;
      }
      
      setSelectedSyncDistrict(distritos[0]);
      setShowModal('sync-distrito');
    } catch (err) {
      alert('Error al cargar campañas y distritos.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSyncLocales = async () => {
    if (!selectedSyncDistrict) {
      alert('Por favor, seleccione un distrito.');
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await api.post('/admin/locales/sync-from-padron', { district: selectedSyncDistrict });
      alert(`Sincronización completada para el distrito ${selectedSyncDistrict}. Se agregaron ${res.data.added} nuevos locales.`);
      setShowModal(null);
      fetchData();
    } catch (err) {
      alert('Error al sincronizar locales.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePause = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
    try {
      await api.put(`/campaigns/${id}`, { status: newStatus });
      fetchData();
    } catch (err) {
      alert('Error al cambiar el estado de la campaña.');
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      if (activeAuditTab === 'logs') fetchAuditData();
      else fetchLoginAttempts();
    }
  }, [activeTab, activeAuditTab, fetchAuditData, fetchLoginAttempts]);

  useEffect(() => {
    if (!loading && !authUser) {
      navigate('/login');
    } else if (authUser && authUser.role === 'COORDINADOR') {
      navigate('/coordinador');
    }
  }, [authUser, loading, navigate]);

  useEffect(() => {
    if (authUser) {
      setCaptures([]); // reset so lazy loader re-runs on tab change
      fetchData();
    }
  }, [authUser, activeTab, activeListId, activeDistrict]);

  // Auto-retry when server is waking up
  useEffect(() => {
    if (!serverWaking) return;
    const t = setTimeout(() => {
      if (authUser) fetchData();
    }, 8000);
    return () => clearTimeout(t);
  }, [serverWaking]);

  // Load capture map markers lazily — after stats are shown, not before
  useEffect(() => {
    if (activeTab !== 'overview' || !stats || captures.length > 0) return;
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/captures');
        const d = res.data;
        setCaptures(Array.isArray(d) ? d : (d && Array.isArray(d.data) ? d.data : []));
      } catch { /* silent — map markers are non-critical */ }
    }, 1500);
    return () => clearTimeout(t);
  }, [activeTab, stats]);

  useEffect(() => {
    if (selectedCampaignId === 'all') return;
    const campaign = campaigns.find(c => c.id.toString() === selectedCampaignId);
    if (campaign && campaign.distrito) {
      const city = campaign.distrito.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (CIUDADES_PARAGUAY[city]) {
        setMapCenter([CIUDADES_PARAGUAY[city].lat, CIUDADES_PARAGUAY[city].lng]);
        setMapZoom(CIUDADES_PARAGUAY[city].zoom);
      }
    }
  }, [selectedCampaignId, campaigns]);

  // Tab props: pass all state and handlers to tab sub-components
  const tabProps = {
    stats, campaigns, lists, users, locales, vehicles,
    auditLogs, loginAttempts, captures, pendingLogistics,
    systemStats, predictions, padronStats, isLoading,
    serverWaking, activeTab, activeAuditTab, setActiveAuditTab,
    selectedCampaignId, setSelectedCampaignId,
    showModal, setShowModal,
    editingCampaign, setEditingCampaign,
    editingUser, setEditingUser,
    editingList, setEditingList,
    editingLocale, setEditingLocale,
    newCampaignName, setNewCampaignName,
    newCampaignSlogan, setNewCampaignSlogan,
    newCampaignGoal, setNewCampaignGoal,
    newCampaignDistrito, setNewCampaignDistrito,
    newCampaignPhotoUrl, setNewCampaignPhotoUrl,
    newCampaignModules, setNewCampaignModules,
    newUserName, setNewUserName,
    newUserPass, setNewUserPass,
    newUserRole, setNewUserRole,
    newUserRealName, setNewUserRealName,
    newUserCI, setNewUserCI,
    newUserList, setNewUserList,
    newUserCampaign, setNewUserCampaign,
    newUserParent, setNewUserParent,
    newUserTelefono, setNewUserTelefono,
    newUserDistrito, setNewUserDistrito,
    newUserLocal, setNewUserLocal,
    newUserMesa, setNewUserMesa,
    userProfilePreview, setUserProfilePreview,
    userSearchTerm, setUserSearchTerm,
    userRoleFilter, setUserRoleFilter,
    userCampaignFilter, setUserCampaignFilter,
    isUserVerified, setIsUserVerified, isCandidateVerified, setIsCandidateVerified, isVehicleDriverVerified, setIsVehicleDriverVerified,
    newListCiudad, setNewListCiudad,
    newListCampaign, setNewListCampaign,
    newListType, setNewListType,
    newListNumber, setNewListNumber,
    newListOption, setNewListOption,
    newListCandidateCI, setNewListCandidateCI,
    newListAlias, setNewListAlias,
    newListGoal, setNewListGoal,
    listPhotoUrl, setListPhotoUrl,
    candidatePreview, setCandidatePreview,
    listSearchTerm, setListSearchTerm,
    listCityFilter,
    listTypeFilter, setListTypeFilter,
    takenOptions,
    localeSearchTerm, setLocaleSearchTerm,
    localeCityFilter, setLocaleCityFilter,
    newLocaleCod, setNewLocaleCod,
    newLocaleNombre, setNewLocaleNombre,
    newLocaleDireccion, setNewLocaleDireccion,
    newLocaleLat, setNewLocaleLat,
    newLocaleLng, setNewLocaleLng,
    newLocaleIcon, setNewLocaleIcon,
    newLocaleCiudad, setNewLocaleCiudad,
    mapCenter, mapZoom,
    auditFilterAction, setAuditFilterAction,
    auditFilterStart, setAuditFilterStart,
    auditFilterEnd, setAuditFilterEnd,
    electionDate, setElectionDate,
    electionEndTime, setElectionEndTime,
    globalGoal, setGlobalGoal,
    masterKey, setMasterKey,
    appPlatformName, setAppPlatformName,
    appLogoUrl, setAppLogoUrl,
    shareMessage, setShareMessage,
    shareMessageFooter, setShareMessageFooter,
    importingPadron, setImportingPadron,
    importCity, setImportCity,
    newVehicleDesc, setNewVehicleDesc,
    newVehicleDriver, setNewVehicleDriver,
    newVehiclePhone, setNewVehiclePhone,
    newVehicleDriverCI, setNewVehicleDriverCI,
    newVehicleCapacity, setNewVehicleCapacity,
    newVehicleStatus, setNewVehicleStatus,
    newVehicleList, setNewVehicleList,
    activeDistrict, setActiveDistrict,
    activeListId, setActiveListId,
    selectedSyncDistrict, setSelectedSyncDistrict,
    selectedCityForLists, setSelectedCityForLists,
    cities, fileInputRef, cropperData,
    fetchData,
    handleCreateCampaign, handleUpdateCampaign, handleDeleteCampaign, handleTogglePause,
    handleCreateList, handleUpdateList, handleDeleteList,
    handleCreateUser, handleUpdateUser, handleDeleteUser, handleResetPassword,
    handleCreateLocale, handleDeleteLocale,
    handleCreateVehicle,
    handleUpdateSettings,
    handleSyncLocales, handleConfirmSyncLocales,
    handleWipeCaptures,
    handleFileUpload, onCropComplete,
    handleLookupUserCI, handleLookupCandidate, handleLookupDriverCI,
    fetchAuditData,
  };

  if (loading) return null;

  return (
    <MainLayout
      title="Panel de Administración"
      userName={authUser?.nombre || "Usuario"}
      userPhoto={authUser?.photo_url}
    >
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'visible', position: 'relative' }}>
        <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main style={{
          flex: 1,
          padding: window.innerWidth < 768 ? '1rem' : '2rem',
          overflowY: 'auto',
          overflowX: 'hidden',
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
              {isLoading ? (
                <SkeletonTable rows={8} columns={5} />
              ) : (
                <>
                  {activeTab === 'overview' && <TabOverview {...tabProps} />}
                  {activeTab === 'campaigns' && <TabCampaigns {...tabProps} />}
                  {activeTab === 'lists' && <TabLists {...tabProps} />}
                  {activeTab === 'users' && <TabUsers {...tabProps} />}
                  {activeTab === 'logistics' && <TabLogistics {...tabProps} />}
                  {activeTab === 'system' && <TabSystem {...tabProps} />}
                  {activeTab === 'audit' && <TabAudit {...tabProps} />}
                  {activeTab === 'locales' && <TabLocales {...tabProps} />}
                  {activeTab === 'padrones' && <TabPadrones {...tabProps} />}
                  {activeTab === 'whatsapp' && <Navigate to="/comunicaciones" />}
                  {activeTab === 'settings' && <TabSettings {...tabProps} />}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {showModal && (
          <div
            className="modal-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) setShowModal(null); }}
          >
            <motion.div
              className="modal-content-premium"
              initial={{ scale: 0.9, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: -20 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: 'auto',
                maxWidth: '95vw',
                padding: 0,
                overflowY: 'auto',   // Permitir scroll interno
                maxHeight: '90vh',   // Aumentar un poco el espacio útil
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                borderRadius: '20px'
              }}
            >
              {showModal === 'campaign' && (
                <div style={{ width: '680px', maxWidth: '95vw' }}>
                  <div className="modal-header-premium">
                    <h2>Nueva Campaña</h2>
                    <button className="icon-btn" onClick={() => setShowModal(null)}><X size={20} /></button>
                  </div>
                  <form onSubmit={handleCreateCampaign}>
                    <div className="modal-body-premium">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label>Nombre de la Campaña</label>
                          <input autoFocus className="modern-input-premium-styled" value={newCampaignName} onChange={e => setNewCampaignName(e.target.value.toUpperCase())} required />
                        </div>
                        <div className="form-group">
                          <label>Eslogan</label>
                          <input className="modern-input-premium-styled" value={newCampaignSlogan} onChange={e => setNewCampaignSlogan(e.target.value.toUpperCase())} />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                        <div className="form-group">
                          <label>Meta de Capturas (Goal)</label>
                          <input type="number" className="modern-input-premium-styled" value={newCampaignGoal} onChange={e => setNewCampaignGoal(parseInt(e.target.value))} required />
                        </div>
                        <div className="form-group">
                          <label>Distrito</label>
                          <select
                            className="modern-input-premium-styled"
                            value={newCampaignDistrito === 'PEDRO JUAN CABALLERO' ? 'PEDRO J. CABALLERO' : newCampaignDistrito}
                            onChange={e => setNewCampaignDistrito(e.target.value.toUpperCase())}
                            required
                          >
                            <option value="">Seleccione Distrito...</option>
                            {cities.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <datalist id="districts-list">
                        {cities.map(c => <option key={c} value={c} />)}
                      </datalist>

                      <div style={{ marginTop: '1.5rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                          <Layout size={14} /> Módulos y Submódulos del Tenant
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {[
                            {
                              key: 'COMMAND_CENTER', label: 'Centro de Mando', icon: '🎯', desc: 'Panel de comando operativo y KPIs en tiempo real', subs: [
                                { key: 'CC_FIELD_REQUESTS', label: 'Solicitudes de Campo' },
                                { key: 'CC_ELECTOR_REGISTRY', label: 'Registro de Electores' },
                                { key: 'CC_RANKINGS', label: 'Rankings de Coordinadores' },
                                { key: 'CC_HEATMAP', label: 'Mapa de Calor' }
                              ]
                            },
                            {
                              key: 'REGISTRY', label: 'Registro Electoral', icon: '📋', desc: 'Captura y verificación de adherentes en campo', subs: [
                                { key: 'REG_CAPTURE', label: 'Captura de Adherentes' },
                                { key: 'REG_LOOKUP', label: 'Consulta por Cédula' },
                                { key: 'REG_SHARE', label: 'Compartir Constancias' }
                              ]
                            },
                            {
                              key: 'LOGISTICS', label: 'Logística', icon: '🚛', desc: 'Gestión de vehículos, rutas y traslados del Día D', subs: [
                                { key: 'LOG_VEHICLES', label: 'Gestión de Vehículos' },
                                { key: 'LOG_ROUTES', label: 'Planificación de Rutas' },
                                { key: 'LOG_ZONES', label: 'Cobertura de Zonas' },
                                { key: 'LOG_TRANSPORT', label: 'Traslado de Electores' }
                              ]
                            },
                            {
                              key: 'WHATSAPP', label: 'Comunicaciones', icon: '💬', desc: 'Mensajería masiva y gestión de contactos', subs: [
                                { key: 'WA_BROADCAST', label: 'Mensajes Masivos' },
                                { key: 'WA_CONTACTS', label: 'Gestión de Contactos' },
                                { key: 'WA_TEMPLATES', label: 'Plantillas de Mensaje' }
                              ]
                            },
                            {
                              key: 'DIAD', label: 'Día D', icon: '🗳️', desc: 'Operación electoral del día de la votación', subs: [
                                { key: 'DD_COUNTDOWN', label: 'Cuenta Regresiva' },
                                { key: 'DD_VEEDORES', label: 'Gestión de Veedores' },
                                { key: 'DD_ACTAS', label: 'Carga de Actas' },
                                { key: 'DD_RESULTS', label: 'Resultados en Vivo' }
                              ]
                            }
                          ].map(mod => {
                            const isModActive = newCampaignModules.includes(mod.key);
                            return (
                              <div key={mod.key} style={{
                                background: isModActive ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${isModActive ? 'rgba(59,130,246,0.25)' : 'var(--border)'}`,
                                borderRadius: '14px', padding: '1rem', transition: 'all 0.2s ease'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                                  onClick={() => {
                                    if (isModActive) {
                                      setNewCampaignModules(prev => prev.filter(m => m !== mod.key && !mod.subs.some(s => s.key === m)));
                                    } else {
                                      setNewCampaignModules(prev => [...prev, mod.key, ...mod.subs.map(s => s.key)]);
                                    }
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '1.3rem' }}>{mod.icon}</span>
                                    <div>
                                      <p style={{ fontSize: '0.85rem', fontWeight: 800, color: isModActive ? 'white' : 'var(--text-2)', margin: 0 }}>{mod.label}</p>
                                      <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', margin: 0 }}>{mod.desc}</p>
                                    </div>
                                  </div>
                                  <div style={{
                                    width: '40px', height: '22px', borderRadius: '11px', position: 'relative',
                                    background: isModActive ? 'var(--plra-400)' : 'rgba(255,255,255,0.1)',
                                    transition: 'background 0.2s ease', cursor: 'pointer', flexShrink: 0
                                  }}>
                                    <div style={{
                                      width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                                      position: 'absolute', top: '2px', left: isModActive ? '20px' : '2px',
                                      transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                    }} />
                                  </div>
                                </div>
                                {isModActive && mod.subs.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                    {mod.subs.map(sub => {
                                      const isSubActive = newCampaignModules.includes(sub.key);
                                      return (
                                        <div
                                          key={sub.key}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setNewCampaignModules(prev =>
                                              isSubActive ? prev.filter(m => m !== sub.key) : [...prev, sub.key]
                                            );
                                          }}
                                          style={{
                                            padding: '4px 10px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700,
                                            cursor: 'pointer', transition: 'all 0.15s ease', userSelect: 'none',
                                            background: isSubActive ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                                            color: isSubActive ? 'var(--plra-300)' : 'var(--text-3)',
                                            border: `1px solid ${isSubActive ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}`
                                          }}
                                        >
                                          {isSubActive ? '✓ ' : ''}{sub.label}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '0.75rem', textAlign: 'right' }}>
                          {newCampaignModules.length} permisos activos
                        </p>
                      </div>
                    </div>
                    <div className="modal-footer-premium-styled">
                      <button type="button" onClick={() => setShowModal(null)} className="btn-cancel-styled">Cancelar</button>
                      <button type="submit" className="btn-confirm-styled">Crear Campaña <Plus size={18} /></button>
                    </div>
                  </form>
                </div>
              )}

              {showModal === 'edit-campaign' && (
                <div style={{ width: '680px', maxWidth: '95vw' }}>
                  <div className="modal-header-premium">
                    <h2>Editar Campaña</h2>
                    <button className="icon-btn" onClick={() => setShowModal(null)}><X size={20} /></button>
                  </div>
                  <form onSubmit={handleUpdateCampaign}>
                    <div className="modal-body-premium">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label>Nombre</label>
                          <input className="modern-input-premium-styled" value={newCampaignName} onChange={e => setNewCampaignName(e.target.value)} required />
                        </div>
                        <div className="form-group">
                          <label>Eslogan</label>
                          <input className="modern-input-premium-styled" value={newCampaignSlogan} onChange={e => setNewCampaignSlogan(e.target.value)} />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                        <div className="form-group">
                          <label>Meta de Capturas (Goal)</label>
                          <input type="number" className="modern-input-premium-styled" value={newCampaignGoal} onChange={e => setNewCampaignGoal(parseInt(e.target.value))} required />
                        </div>
                        <div className="form-group">
                          <label>Distrito</label>
                          <input className="modern-input-premium-styled" value={newCampaignDistrito} onChange={e => setNewCampaignDistrito(e.target.value.toUpperCase())} placeholder="Ej: ASUNCION" />
                        </div>
                      </div>

                      <div style={{ marginTop: '1.5rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                          <Layout size={14} /> Módulos y Submódulos del Tenant
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {[
                            {
                              key: 'COMMAND_CENTER', label: 'Centro de Mando', icon: '🎯', desc: 'Panel de comando operativo y KPIs en tiempo real', subs: [
                                { key: 'CC_FIELD_REQUESTS', label: 'Solicitudes de Campo' },
                                { key: 'CC_ELECTOR_REGISTRY', label: 'Registro de Electores' },
                                { key: 'CC_RANKINGS', label: 'Rankings de Coordinadores' },
                                { key: 'CC_HEATMAP', label: 'Mapa de Calor' }
                              ]
                            },
                            {
                              key: 'REGISTRY', label: 'Registro Electoral', icon: '📋', desc: 'Captura y verificación de adherentes en campo', subs: [
                                { key: 'REG_CAPTURE', label: 'Captura de Adherentes' },
                                { key: 'REG_LOOKUP', label: 'Consulta por Cédula' },
                                { key: 'REG_SHARE', label: 'Compartir Constancias' }
                              ]
                            },
                            {
                              key: 'LOGISTICS', label: 'Logística', icon: '🚛', desc: 'Gestión de vehículos, rutas y traslados del Día D', subs: [
                                { key: 'LOG_VEHICLES', label: 'Gestión de Vehículos' },
                                { key: 'LOG_ROUTES', label: 'Planificación de Rutas' },
                                { key: 'LOG_ZONES', label: 'Cobertura de Zonas' },
                                { key: 'LOG_TRANSPORT', label: 'Traslado de Electores' }
                              ]
                            },
                            {
                              key: 'WHATSAPP', label: 'Comunicaciones', icon: '💬', desc: 'Mensajería masiva y gestión de contactos', subs: [
                                { key: 'WA_BROADCAST', label: 'Mensajes Masivos' },
                                { key: 'WA_CONTACTS', label: 'Gestión de Contactos' },
                                { key: 'WA_TEMPLATES', label: 'Plantillas de Mensaje' }
                              ]
                            },
                            {
                              key: 'DIAD', label: 'Día D', icon: '🗳️', desc: 'Operación electoral del día de la votación', subs: [
                                { key: 'DD_COUNTDOWN', label: 'Cuenta Regresiva' },
                                { key: 'DD_VEEDORES', label: 'Gestión de Veedores' },
                                { key: 'DD_ACTAS', label: 'Carga de Actas' },
                                { key: 'DD_RESULTS', label: 'Resultados en Vivo' }
                              ]
                            }
                          ].map(mod => {
                            const isModActive = newCampaignModules.includes(mod.key);
                            return (
                              <div key={mod.key} style={{
                                background: isModActive ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${isModActive ? 'rgba(59,130,246,0.25)' : 'var(--border)'}`,
                                borderRadius: '14px', padding: '1rem', transition: 'all 0.2s ease'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                                  onClick={() => {
                                    if (isModActive) {
                                      setNewCampaignModules(prev => prev.filter(m => m !== mod.key && !mod.subs.some(s => s.key === m)));
                                    } else {
                                      setNewCampaignModules(prev => [...prev, mod.key, ...mod.subs.map(s => s.key)]);
                                    }
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '1.3rem' }}>{mod.icon}</span>
                                    <div>
                                      <p style={{ fontSize: '0.85rem', fontWeight: 800, color: isModActive ? 'white' : 'var(--text-2)', margin: 0 }}>{mod.label}</p>
                                      <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', margin: 0 }}>{mod.desc}</p>
                                    </div>
                                  </div>
                                  <div style={{
                                    width: '40px', height: '22px', borderRadius: '11px', position: 'relative',
                                    background: isModActive ? 'var(--plra-400)' : 'rgba(255,255,255,0.1)',
                                    transition: 'background 0.2s ease', cursor: 'pointer', flexShrink: 0
                                  }}>
                                    <div style={{
                                      width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                                      position: 'absolute', top: '2px', left: isModActive ? '20px' : '2px',
                                      transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                    }} />
                                  </div>
                                </div>
                                {isModActive && mod.subs.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                    {mod.subs.map(sub => {
                                      const isSubActive = newCampaignModules.includes(sub.key);
                                      return (
                                        <div
                                          key={sub.key}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setNewCampaignModules(prev =>
                                              isSubActive ? prev.filter(m => m !== sub.key) : [...prev, sub.key]
                                            );
                                          }}
                                          style={{
                                            padding: '4px 10px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700,
                                            cursor: 'pointer', transition: 'all 0.15s ease', userSelect: 'none',
                                            background: isSubActive ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                                            color: isSubActive ? 'var(--plra-300)' : 'var(--text-3)',
                                            border: `1px solid ${isSubActive ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}`
                                          }}
                                        >
                                          {isSubActive ? '✓ ' : ''}{sub.label}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '0.75rem', textAlign: 'right' }}>
                          {newCampaignModules.length} permisos activos
                        </p>
                      </div>
                    </div>
                    <div className="modal-footer-premium-styled">
                      <button type="button" onClick={() => setShowModal(null)} className="btn-cancel-styled">Cancelar</button>
                      <button type="submit" className="btn-confirm-styled">Guardar Cambios <Save size={18} /></button>
                    </div>
                  </form>
                </div>
              )}

              {showModal === 'user' && (
                <div style={{ width: '650px', maxWidth: '95vw' }}>
                  <div className="modal-header-premium">
                    <h2>{editingUser ? 'Editar Operador' : 'Nuevo Operador'}</h2>
                    <button className="icon-btn" onClick={() => { setShowModal(null); setEditingUser(null); }}><X size={20} /></button>
                  </div>

                  <div className="modal-body-premium">
                    <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser}>
                      {/* Cabecera de Perfil Compacta */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem', background: 'rgba(0,71,171,0.04)', borderRadius: '16px', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
                        <div className="premium-avatar-frame-compact" style={{ width: '60px', height: '60px', flexShrink: 0, border: '2px solid white', boxShadow: 'var(--shadow-sm)' }} onClick={() => fileInputRef.current?.click()}>
                          {userProfilePreview?.photo_url ? <img src={getImageUrl(userProfilePreview.photo_url) || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="P" /> : <UsersIcon size={24} style={{ opacity: 0.5 }} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{newUserRealName || 'Identidad no verificada'}</h3>
                          <div style={{ fontSize: '0.75rem', color: 'var(--plra-300)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Shield size={12} /> C.I. {newUserCI || '---'}
                          </div>
                        </div>
                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={e => handleFileUpload(e, 'user')} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                          <label>Cédula de Identidad</label>
                          <div className="search-input-wrapper-premium">
                            <input className="modern-input-premium-styled" value={newUserCI} onChange={e => setNewUserCI(e.target.value)} required disabled={!!editingUser} />
                            {!editingUser && <button type="button" onClick={handleLookupUserCI} className="search-btn-action">BUSCAR</button>}
                          </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                          <label>Nombre Completo</label>
                          <input className="modern-input-premium-styled" value={newUserRealName} onChange={e => setNewUserRealName(e.target.value)} required />
                        </div>
                        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                          <label>WhatsApp</label>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const currentDigits = newUserTelefono.replace(/\D/g, '');
                                let base = currentDigits;
                                if (currentDigits.startsWith('595')) base = currentDigits.substring(3);
                                else if (currentDigits.startsWith('55')) base = currentDigits.substring(2);
                                if (base.startsWith('0')) base = base.substring(1);
                                
                                const newPrefix = newUserTelefono.startsWith('+55') ? '+595' : '+55';
                                setNewUserTelefono(base ? `${newPrefix} ${base}` : `${newPrefix} `);
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
                              {newUserTelefono.startsWith('+55') ? '+55 🇧🇷' : '+595 🇵🇾'}
                            </button>
                            <input 
                              className="modern-input-premium-styled" 
                              value={newUserTelefono} 
                              placeholder="+595" 
                              onChange={e => {
                                let v = e.target.value;
                                let clean = v.replace(/[^\d+]/g, '');
                                let prefix = '+595';
                                if (clean.startsWith('+55') || clean.startsWith('55')) {
                                  prefix = '+55';
                                  clean = clean.startsWith('+55') ? clean.substring(3) : clean.substring(2);
                                } else if (clean.startsWith('+595') || clean.startsWith('595')) {
                                  prefix = '+595';
                                  clean = clean.startsWith('+595') ? clean.substring(4) : clean.substring(3);
                                }
                                clean = clean.replace(/\D/g, '');
                                if (clean.startsWith('0')) {
                                  clean = clean.substring(1);
                                }
                                setNewUserTelefono(clean ? `${prefix} ${clean}` : '');
                              }} 
                              style={{ paddingLeft: '4.8rem' }}
                            />
                          </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                          <label>Rol del Operador</label>
                          <select className="modern-input-premium-styled" value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
                            <option value="COORDINADOR">Coordinador de Campo</option>
                            <option value="PADRINO">Padrino</option>
                            <option value="SUBJEFE">Sub-Jefe (Líder de Lista)</option>
                            <option value="JEFE_CAMPANA">Jefe de Campaña</option>
                            <option value="APODERADO">Apoderado de Local</option>
                            <option value="MIEMBRO_MESA">Miembro de Mesa</option>
                            <option value="SUPERUSUARIO">Súper Admin</option>
                          </select>
                        </div>

                        {newUserRole === 'JEFE_CAMPANA' && (
                          <>
                            <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: '0.5rem' }}>
                              <label>Campaña Principal</label>
                              <select className="modern-input-premium-styled" value={newUserCampaign} onChange={e => setNewUserCampaign(e.target.value)} required>
                                <option value="">Seleccione Campaña...</option>
                                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: '0.5rem' }}>
                              <label>Distrito bajo su mando (Opcional)</label>
                              <select
                                className="modern-input-premium-styled"
                                value={newUserDistrito === 'PEDRO JUAN CABALLERO' ? 'PEDRO J. CABALLERO' : newUserDistrito}
                                onChange={e => setNewUserDistrito(e.target.value.toUpperCase())}
                              >
                                <option value="">Seleccione Distrito...</option>
                                {cities.map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                              <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', marginTop: '0.3rem' }}>
                                Si asigna un distrito, este Jefe podrá ver TODAS las campañas y listas de esa ciudad.
                              </p>
                            </div>
                          </>
                        )}

                        {(newUserRole === 'PADRINO' || newUserRole === 'COORDINADOR' || newUserRole === 'SUBJEFE') && (
                          <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: '0.5rem' }}>
                            <label>
                              {newUserRole === 'SUBJEFE' ? 'Superior (Jefe de Campaña)' :
                                newUserRole === 'PADRINO' ? 'Superior (Jefe de Campaña)' :
                                  'Superior (Padrino o Sub-Jefe)'}
                            </label>
                            <select className="modern-input-premium-styled" value={newUserParent} onChange={e => setNewUserParent(e.target.value)} required>
                              <option value="">Seleccione Superior...</option>
                              {users.filter(u => {
                                if (newUserRole === 'SUBJEFE') return u.role === 'JEFE_CAMPANA';
                                if (newUserRole === 'PADRINO') return u.role === 'JEFE_CAMPANA';
                                return u.role === 'PADRINO' || u.role === 'SUBJEFE';
                              }).map(u => (
                                <option key={u.id} value={u.id}>{u.nombre} ({u.role})</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {newUserRole !== 'SUPERUSUARIO' && (
                          <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: '0.5rem' }}>
                            <label>Lista Electoral Asignada <span style={{ color: 'var(--red)' }}>*</span></label>
                            <select className="modern-input-premium-styled" value={newUserList} onChange={e => setNewUserList(e.target.value)} required>
                              <option value="">Seleccione una lista...</option>
                              {lists.map(l => (
                                <option key={l.id} value={l.id}>
                                  {l.list_number} {l.type === 'CONCEJAL' ? `Op${l.option_number}` : '(Int.)'} — {l.candidate_alias || l.candidate_nombre}
                                </option>
                              ))}
                            </select>
                            <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                              Obligatorio: Todos los operadores deben pertenecer a una lista.
                            </p>
                          </div>
                        )}

                        {(newUserRole === 'APODERADO' || newUserRole === 'MIEMBRO_MESA') && (
                          <>
                            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                              <label>Local Asignado</label>
                              <select className="modern-input-premium-styled" value={newUserLocal} onChange={e => setNewUserLocal(e.target.value)} required>
                                <option value="">Seleccione Local...</option>
                                {locales.map((l: any) => <option key={l.cod_local} value={l.nombre}>{l.nombre}</option>)}
                              </select>
                            </div>
                            {newUserRole === 'MIEMBRO_MESA' && (
                              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                <label>Mesa Nro.</label>
                                <input type="number" className="modern-input-premium-styled" value={newUserMesa || ''} onChange={e => setNewUserMesa(parseInt(e.target.value) || null)} required />
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="modal-footer-premium-styled" style={{ marginTop: '1.5rem', marginInline: '-2rem', marginBottom: '-2rem' }}>
                        <button type="button" onClick={() => { setShowModal(null); setEditingUser(null); }} className="btn-cancel-styled">Cancelar</button>
                        <button type="submit" className="btn-confirm-styled" disabled={!isUserVerified && !editingUser}>
                          {editingUser ? 'Guardar Cambios' : 'Crear Operador'} <Save size={18} />
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {showModal === 'list' && (
                <div style={{ width: '600px', maxWidth: '95vw' }}>
                  <div className="modal-header-premium">
                    <h2>{editingList ? 'Actualizar Lista' : 'Registro de Lista Electoral'}</h2>
                    <button className="icon-btn" onClick={() => { setShowModal(null); setEditingList(null); }}><X size={20} /></button>
                  </div>

                  <div className="modal-body-premium">
                    <form onSubmit={editingList ? handleUpdateList : handleCreateList}>
                      <div style={{
                        padding: '1.25rem',
                        background: 'rgba(37,99,235,0.04)',
                        borderRadius: '16px',
                        border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', gap: '1.5rem',
                        marginBottom: '1.5rem'
                      }}>
                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, 'list')} />
                        <div style={{
                          width: '90px', height: '90px', borderRadius: '24px',
                          background: 'white', border: '2px solid var(--plra-300)',
                          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative', cursor: 'pointer', boxShadow: 'var(--shadow-sm)'
                        }} onClick={() => fileInputRef.current?.click()}>
                          {candidatePreview?.photo_url ? (
                            <img src={getImageUrl(candidatePreview.photo_url) || ''} alt="Candidato" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Users size={40} style={{ color: 'var(--text-3)', opacity: 0.5 }} />
                          )}
                          <div className="avatar-edit-overlay" style={{ background: 'rgba(0,0,0,0.4)' }}>
                            <Image size={16} />
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {candidatePreview?.nombre ? `${candidatePreview.nombre} ${candidatePreview.apellido || ''}` : 'Identidad del Candidato'}
                          </h3>
                          {isCandidateVerified ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem' }}>
                              <Shield size={12} style={{ color: 'var(--green)' }} />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600 }}>C.I. {newListCandidateCI}</span>
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.3rem' }}>Busque al candidato en el padrón</div>
                          )}
                        </div>
                      </div>

                      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label>Ciudad / Distrito</label>
                          <select
                            className="modern-input-premium-styled"
                            value={newListCiudad === 'PEDRO JUAN CABALLERO' ? 'PEDRO J. CABALLERO' : newListCiudad}
                            onChange={e => setNewListCiudad(e.target.value.toUpperCase())}
                            required
                          >
                            <option value="">Seleccione Distrito...</option>
                            {cities.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label>Campaña Electoral</label>
                          <select className="modern-input-premium-styled" value={newListCampaign} onChange={e => setNewListCampaign(e.target.value)} required>
                            <option value="">Seleccione una campaña...</option>
                            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>

                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label>Candidato (C.I.)</label>
                          <div className="search-input-wrapper-premium">
                            <input className="modern-input-premium-styled" placeholder="Buscar en padrón..." value={newListCandidateCI} onChange={e => setNewListCandidateCI(e.target.value)} required />
                            <button type="button" onClick={handleLookupCandidate} className="search-btn-action">BUSCAR</button>
                          </div>
                        </div>

                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label>Alias del Candidato</label>
                          <input className="modern-input-premium-styled" placeholder="Ej: EL LIDER" value={newListAlias} onChange={e => setNewListAlias(e.target.value.toUpperCase())} />
                        </div>

                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label>Tipo de Candidatura</label>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {['INTENDENTE', 'CONCEJAL'].map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setNewListType(t)}
                                style={{
                                  flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid',
                                  fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                                  background: newListType === t ? 'var(--plra-500)' : 'var(--surface-light)',
                                  borderColor: newListType === t ? 'var(--plra-500)' : 'var(--border)',
                                  color: newListType === t ? 'white' : 'var(--text-3)',
                                }}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Número de Lista</label>
                          <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                            <input
                              className="modern-input-premium-styled"
                              placeholder="Ej: 2"
                              value={newListNumber}
                              onChange={e => setNewListNumber(e.target.value)}
                              required
                            />
                            {newListType === 'CONCEJAL' && (
                              <select
                                className="modern-input-premium-styled"
                                style={{ fontSize: '0.65rem', padding: '0.4rem', height: 'auto', background: 'rgba(255,255,255,0.02)' }}
                                onChange={e => {
                                  const val = e.target.value;
                                  if (!val) return;
                                  setNewListNumber(val);
                                  const linkedList = lists.find(l => l.type === 'INTENDENTE' && l.list_number === val && (!newListCiudad || l.ciudad === newListCiudad));
                                  if (linkedList) {
                                    if (linkedList.campaign_id) setNewListCampaign(linkedList.campaign_id.toString());
                                    if (linkedList.ciudad) setNewListCiudad(linkedList.ciudad);
                                  }
                                }}
                              >
                                <option value="">Auto-vínculo con Intendente...</option>
                                {lists.filter(l =>
                                  l.type === 'INTENDENTE' &&
                                  (newListCiudad ? l.ciudad?.toUpperCase() === newListCiudad.toUpperCase() : true)
                                ).map(l => (
                                  <option key={l.id} value={l.list_number}>Usar # de Lista {l.list_number} ({l.candidate_alias || l.candidate_nombre})</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Meta de Votos</label>
                          <input type="number" className="modern-input-premium-styled" value={newListGoal} onChange={e => setNewListGoal(parseInt(e.target.value))} />
                        </div>

                        {newListType === 'CONCEJAL' && (
                          <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label>Opción (Posición)</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.25rem' }}>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => {
                                const isTaken = takenOptions.includes(n);
                                const isSelected = newListOption === n.toString();
                                return (
                                  <button
                                    key={n}
                                    type="button"
                                    disabled={isTaken && !isSelected}
                                    onClick={() => setNewListOption(n.toString())}
                                    style={{
                                      height: '32px', borderRadius: '8px', border: '1px solid',
                                      fontSize: '0.7rem', fontWeight: 800, cursor: isTaken ? 'not-allowed' : 'pointer',
                                      transition: 'all 0.1s',
                                      background: isSelected ? 'var(--plra-500)' : isTaken ? 'rgba(239,68,68,0.1)' : 'var(--surface-light)',
                                      borderColor: isSelected ? 'var(--plra-500)' : isTaken ? 'rgba(239,68,68,0.2)' : 'var(--border)',
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
                        )}
                      </div>

                      <div className="modal-footer-premium-styled" style={{ marginTop: '1.5rem', marginInline: '-2rem', marginBottom: '-2rem' }}>
                        <button type="button" onClick={() => { setShowModal(null); setEditingList(null); }} className="btn-cancel-styled">Cancelar</button>
                        <button type="submit" className="btn-confirm-styled" disabled={!isCandidateVerified}>
                          {editingList ? 'Guardar Cambios' : 'Registrar Lista'} <Save size={18} />
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}




              {showModal === 'vehicle' && (
                <div style={{ width: '500px', maxWidth: '95vw' }}>
                  <div className="modal-header-premium">
                    <h2>Registrar Nuevo Vehículo</h2>
                    <button className="icon-btn" onClick={() => setShowModal(null)}><X size={20} /></button>
                  </div>
                  <form onSubmit={handleCreateVehicle}>
                    <div className="modal-body-premium">
                      <div className="form-group">
                        <label>Descripción del Vehículo</label>
                        <input className="modern-input-premium-styled" placeholder="Ej: Camioneta Toyota Hilux Blanca" value={newVehicleDesc} onChange={e => setNewVehicleDesc(e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>C.I. del Chofer</label>
                        <div className="search-input-wrapper-premium">
                          <input className="modern-input-premium-styled" placeholder="Buscar chofer..." value={newVehicleDriverCI} onChange={e => setNewVehicleDriverCI(e.target.value)} required />
                          <button type="button" onClick={handleLookupDriverCI} className="search-btn-action">VERIFICAR</button>
                        </div>
                        {isVehicleDriverVerified && (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--green)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Check size={14} /> Chofer: {newVehicleDriver}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="modal-footer-premium-styled">
                      <button type="button" onClick={() => setShowModal(null)} className="btn-cancel-styled">Cancelar</button>
                      <button type="submit" className="btn-confirm-styled" disabled={!isVehicleDriverVerified}>Registrar Vehículo <Truck size={18} /></button>
                    </div>
                  </form>
                </div>
              )}

              {showModal === 'locale' && (
                <div style={{ width: '600px', maxWidth: '95vw' }}>
                  <div className="modal-header-premium">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ padding: '8px', background: 'rgba(59,130,246,0.1)', borderRadius: '10px', color: 'var(--plra-300)' }}>
                        <MapPin size={20} />
                      </div>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{editingLocale ? 'Editar Local' : 'Nuevo Local de Votación'}</h2>
                        <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 600 }}>Configure la ubicación táctica del centro de votación</p>
                      </div>
                    </div>
                    <button className="icon-btn" onClick={() => setShowModal(null)}><X size={20} /></button>
                  </div>
                  <form onSubmit={handleCreateLocale}>
                    <div className="modal-body-premium" style={{ maxHeight: 'none', overflow: 'visible' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label>Código de Local</label>
                          <input
                            className="modern-input-premium-styled"
                            value={newLocaleCod}
                            onChange={e => setNewLocaleCod(e.target.value.toUpperCase())}
                            placeholder="Ej: 101"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Ciudad / Distrito</label>
                          <input
                            className="modern-input-premium-styled"
                            value={newLocaleCiudad}
                            placeholder="Ej: ASUNCION"
                            list="districts-list"
                            onChange={e => {
                              const city = e.target.value.toUpperCase();
                              setNewLocaleCiudad(city);
                              if (CIUDADES_PARAGUAY[city]) {
                                setMapCenter([CIUDADES_PARAGUAY[city].lat, CIUDADES_PARAGUAY[city].lng]);
                                setMapZoom(CIUDADES_PARAGUAY[city].zoom);
                              }
                            }}
                            required
                          />
                        </div>

                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label>Nombre de la Institución</label>
                          <input className="modern-input-premium-styled" value={newLocaleNombre} onChange={e => setNewLocaleNombre(e.target.value.toUpperCase())} placeholder="Ej: ESCUELA GRADUADA NRO 1" required />
                        </div>

                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label>Dirección de Referencia</label>
                          <input className="modern-input-premium-styled" value={newLocaleDireccion} onChange={e => setNewLocaleDireccion(e.target.value)} placeholder="Ej: Calle Principal c/ Ayolas" />
                        </div>

                        <div className="form-group">
                          <label>Latitud (Decimal)</label>
                          <input className="modern-input-premium-styled" value={newLocaleLat} onChange={e => setNewLocaleLat(e.target.value)} placeholder="-22.5447" required />
                        </div>
                        <div className="form-group">
                          <label>Longitud (Decimal)</label>
                          <input className="modern-input-premium-styled" value={newLocaleLng} onChange={e => setNewLocaleLng(e.target.value)} placeholder="-55.7333" required />
                        </div>

                        <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                          <label>Icono Representativo</label>
                          <select className="modern-input-premium-styled" value={newLocaleIcon} onChange={e => setNewLocaleIcon(e.target.value)}>
                            <option value="Landmark">🏛️ Institucional (Gobierno)</option>
                            <option value="School">🎓 Educación (Escuela/Colegio)</option>
                            <option value="Building">🏢 Edificio Público</option>
                            <option value="Home">🏠 Local Privado / Casa</option>
                            <option value="MapPin">📍 Marcador Estándar</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="modal-footer-premium-styled">
                      <button type="button" onClick={() => setShowModal(null)} className="btn-cancel-styled">Cancelar</button>
                      <button type="submit" className="btn-confirm-styled" style={{ minWidth: '160px' }}>
                        {editingLocale ? 'Guardar Cambios' : 'Crear Local'} <Save size={18} style={{ marginLeft: '8px' }} />
                      </button>
                    </div>
                  </form>
                </div>
              )}
              {showModal === 'sync-distrito' && (
                <div style={{ padding: '0.5rem' }}>
                  <div className="modal-header-premium-styled">
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Sincronizar Locales desde el Padrón</h2>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-3)' }}>Seleccione el distrito para el cual desea importar los locales electorales</p>
                    </div>
                    <button className="icon-btn" onClick={() => setShowModal(null)}><X size={20} /></button>
                  </div>
                  <div className="modal-body-premium-styled" style={{ marginTop: '1rem' }}>
                    <div className="form-group">
                      <label>Distrito Electoral</label>
                      <select
                        className="modern-input-premium-styled"
                        value={selectedSyncDistrict}
                        onChange={e => setSelectedSyncDistrict(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        {Array.from(new Set(campaigns.map(c => c.distrito).filter(Boolean))).map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="modal-footer-premium-styled" style={{ marginTop: '1.5rem' }}>
                    <button type="button" onClick={() => setShowModal(null)} className="btn-cancel-styled">Cancelar</button>
                    <button
                      type="button"
                      onClick={handleConfirmSyncLocales}
                      className="btn-confirm-styled"
                      style={{ minWidth: '160px' }}
                    >
                      Sincronizar <Activity size={18} style={{ marginLeft: '8px' }} />
                    </button>
                  </div>
                </div>
              )}

              {showModal === 'bulk-import-assistants' && (
                <BulkImportAssistantsModal
                  lists={lists}
                  users={users}
                  campaigns={campaigns}
                  onClose={() => setShowModal(null)}
                  onSuccess={() => {
                    setShowModal(null);
                    fetchData(true);
                  }}
                />
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

      <AnimatePresence>
        {apiError && (
          <div className="modal-overlay" style={{ zIndex: 1000000 }}>
            <motion.div
              className="modal-content-premium"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ maxWidth: '450px', padding: '2rem', textAlign: 'center' }}
            >
              <div style={{ width: '64px', height: '64px', background: 'rgba(239,68,68,0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#EF4444' }}>
                <AlertTriangle size={32} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' }}>Incidencia Detectada</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: '1.5rem' }}>{apiError.message}</p>

              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', textAlign: 'left', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--red)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Detalle Técnico:</p>
                <code style={{ fontSize: '0.75rem', color: 'var(--text)', wordBreak: 'break-all' }}>{apiError.details}</code>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  className="btn-confirm-styled"
                  onClick={() => handleCopyDiagnostic({ message: apiError.message, response: { data: apiError.details } })}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Copy size={18} /> Copiar Diagnóstico
                </button>
                <button
                  className="btn-cancel-styled"
                  onClick={() => setApiError(null)}
                  style={{ width: '100%' }}
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
};


export default SuperAdmin;
