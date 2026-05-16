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
import { motion, AnimatePresence } from 'framer-motion';
import { ImageCropperModal } from '../components/ImageCropperModal';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getImageUrl } from '../services/api';

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

// Paraguayan cities with coordinates for map auto-centering
const CIUDADES_PARAGUAY: Record<string, { lat: number; lng: number; zoom: number }> = {
  'PEDRO JUAN CABALLERO': { lat: -22.545, lng: -55.72, zoom: 14 },
  'ASUNCION': { lat: -25.2637, lng: -57.5759, zoom: 13 },
  'ASUNCIÓN': { lat: -25.2637, lng: -57.5759, zoom: 13 },
  'CIUDAD DEL ESTE': { lat: -25.5097, lng: -54.6111, zoom: 13 },
  'ENCARNACION': { lat: -27.3308, lng: -55.8667, zoom: 14 },
  'ENCARNACIÓN': { lat: -27.3308, lng: -55.8667, zoom: 14 },
  'LUQUE': { lat: -25.2708, lng: -57.4872, zoom: 14 },
  'SAN LORENZO': { lat: -25.3400, lng: -57.5094, zoom: 14 },
  'LAMBARE': { lat: -25.3469, lng: -57.6064, zoom: 14 },
  'LAMBARÉ': { lat: -25.3469, lng: -57.6064, zoom: 14 },
  'FERNANDO DE LA MORA': { lat: -25.3390, lng: -57.5230, zoom: 14 },
  'CAPIATA': { lat: -25.3556, lng: -57.4437, zoom: 14 },
  'CAPIATÁ': { lat: -25.3556, lng: -57.4437, zoom: 14 },
  'ITAUGUA': { lat: -25.3889, lng: -57.3536, zoom: 14 },
  'ITAUGUÁ': { lat: -25.3889, lng: -57.3536, zoom: 14 },
  'CAAGUAZU': { lat: -25.4722, lng: -56.0178, zoom: 14 },
  'CAAGUAZÚ': { lat: -25.4722, lng: -56.0178, zoom: 14 },
  'CORONEL OVIEDO': { lat: -25.4492, lng: -56.4419, zoom: 14 },
  'VILLARRICA': { lat: -25.7500, lng: -56.4333, zoom: 14 },
  'CONCEPCION': { lat: -23.4055, lng: -57.4340, zoom: 14 },
  'CONCEPCIÓN': { lat: -23.4055, lng: -57.4340, zoom: 14 },
  'MARIANO ROQUE ALONSO': { lat: -25.2017, lng: -57.5275, zoom: 14 },
  'ÑEMBY': { lat: -25.3964, lng: -57.5383, zoom: 14 },
  'VILLA ELISA': { lat: -25.3750, lng: -57.5917, zoom: 14 },
  'LIMPIO': { lat: -25.1667, lng: -57.4833, zoom: 14 },
  'AREGUA': { lat: -25.3130, lng: -57.3900, zoom: 14 },
  'AREGUÁ': { lat: -25.3130, lng: -57.3900, zoom: 14 },
  'PILAR': { lat: -26.8625, lng: -58.3125, zoom: 14 },
  'SALTO DEL GUAIRA': { lat: -24.0611, lng: -54.3067, zoom: 14 },
  'SALTO DEL GUAIRÁ': { lat: -24.0611, lng: -54.3067, zoom: 14 },
  'HERNANDARIAS': { lat: -25.3971, lng: -54.6430, zoom: 14 },
  'PRESIDENTE FRANCO': { lat: -25.5500, lng: -54.6167, zoom: 14 },
  'MINGA GUAZU': { lat: -25.4833, lng: -54.7667, zoom: 14 },
  'MINGA GUAZÚ': { lat: -25.4833, lng: -54.7667, zoom: 14 },
  'SAN ESTANISLAO': { lat: -24.0000, lng: -56.4333, zoom: 14 },
  'SAN PEDRO DE YCUAMANDIYU': { lat: -24.0933, lng: -57.0828, zoom: 14 },
  'SAN PEDRO DE YCUAMANDIYÚ': { lat: -24.0933, lng: -57.0828, zoom: 14 },
  'SAN LAZARO': { lat: -22.1833, lng: -57.9333, zoom: 14 },
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
  const [isUserVerified, setIsUserVerified] = useState(false);
  const [isCandidateVerified, setIsCandidateVerified] = useState(false);
  const [isVehicleDriverVerified, setIsVehicleDriverVerified] = useState(false);
  const [apiError, setApiError] = useState<{ message: string; details?: string } | null>(null);

  const cities = Array.from(new Set([
    ...(Array.isArray(lists) ? lists.map(l => l.ciudad) : []),
    ...(Array.isArray(locales) ? locales.map(l => l.ciudad || l.distrito) : []),
    ...(Array.isArray(campaigns) ? campaigns.map(c => c.distrito) : [])
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
  const [listCityFilter, setListCityFilter] = useState('');
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
    } catch (err) { console.error('Error uploading cropped image:', err); }
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
      fetchData();
    } catch (err) { console.error(err); }
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
      fetchData();
    } catch (err: any) { 
      console.error(err); 
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
      console.error(err); 
      alert('Error al actualizar usuario.');
    }
  };

  const handleDeleteUser = async (id: number) => {
    const userToDelete = users.find(u => u.id === id);
    if (userToDelete?.username === 'admin') {
      alert('No se puede eliminar al administrador maestro del sistema.');
      return;
    }
    if (!window.confirm('¿Está seguro de eliminar este operador?')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchData();
    } catch (err: any) { 
      console.error(err); 
      alert('No se pudo eliminar el usuario: ' + (err.response?.data?.error || 'Error interno del servidor'));
    }
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
      fetchData();
    } catch (err) { console.error(err); }
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
    } catch (err) { console.error(err); }
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
      console.error('[LOCALE SAVE ERROR]', err); 
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
    } catch (err) { console.error(err); }
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
    } catch (err) { console.error(err); }
  }, [auditFilterAction]);

  const fetchSystemHealth = useCallback(async () => {
    try {
      const res = await api.get('/admin/system/health');
      setSystemStats(res.data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchLoginAttempts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/login-attempts');
      setLoginAttempts(data);
    } catch (err) {
      console.error('Error fetching login attempts:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    if (authUser) fetchData();
  }, [authUser, activeTab, activeListId, activeDistrict]);

  if (loading) return null;

  const handleSyncLocales = async () => {
    try {
      const res = await api.post('/admin/locales/sync-from-padron');
      alert(`Sincronización completada. Se agregaron ${res.data.added} nuevos locales.`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error al sincronizar locales.');
    }
  };

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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'overview') {
        const [summary, predictionsRes, allCaptures, allLocales, allUsers, allLists, allCamps] = await Promise.all([
          api.get('/stats/summary'),
          api.get('/stats/predictions'),
          api.get('/captures'),
          api.get('/voting-locations'),
          api.get('/users'),
          api.get('/lists'),
          api.get('/campaigns')
        ]);
        setStats(summary.data || null);
        setPredictions(predictionsRes.data || null);
        setCaptures(Array.isArray(allCaptures.data) ? allCaptures.data : []);
        setLocales(Array.isArray(allLocales.data) ? allLocales.data : []);
        setUsers(Array.isArray(allUsers.data) ? allUsers.data : []);
        setLists(Array.isArray(allLists.data) ? allLists.data : []);
        setCampaigns(Array.isArray(allCamps.data) ? allCamps.data : []);
      } else if (activeTab === 'campaigns') {
        const res = await api.get('/campaigns');
        setCampaigns(Array.isArray(res.data) ? res.data : []);
      } else if (activeTab === 'lists') {
        const res = await api.get('/lists');
        setLists(Array.isArray(res.data) ? res.data : []);
        const camps = await api.get('/campaigns');
        setCampaigns(Array.isArray(camps.data) ? camps.data : []);
      } else if (activeTab === 'users') {
        const [res, lts, camps] = await Promise.all([
          api.get('/users'),
          api.get('/lists'),
          api.get('/campaigns')
        ]);
        setUsers(Array.isArray(res.data) ? res.data : []);
        setLists(Array.isArray(lts.data) ? lts.data : []);
        setCampaigns(Array.isArray(camps.data) ? camps.data : []);
      } else if (activeTab === 'audit') {
        await fetchAuditData();
      } else if (activeTab === 'logistics') {
        const [v, p] = await Promise.all([
          api.get('/vehicles'),
          api.get('/logistics/pending')
        ]);
        setVehicles(Array.isArray(v.data) ? v.data : []);
        setPendingLogistics(Array.isArray(p.data) ? p.data : []);
        const lts = await api.get('/lists');
        setLists(Array.isArray(lts.data) ? lts.data : []);
      } else if (activeTab === 'locales') {
        const res = await api.get('/voting-locations');
        setLocales(Array.isArray(res.data) ? res.data : []);
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
        if (res.data.app_name) setAppPlatformName(res.data.app_name);
        if (res.data.app_logo_url) setAppLogoUrl(res.data.app_logo_url);
        if (res.data.share_message) setShareMessage(res.data.share_message);
        if (res.data.share_message_footer) setShareMessageFooter(res.data.share_message_footer);
      }
    } catch (err) {
      console.error("Error fetching data", err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderOverview = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', 
        border: '1px solid var(--border)', marginBottom: '2rem' 
      }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', margin: 0 }}>Panel Global SaaS</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: 0 }}>Administración Central de Multi-Tenancy</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => {
              setActiveDistrict(null);
              setActiveListId(null);
              setSelectedCampaignId('all');
            }}
            className="mini-btn"
            style={{ 
              background: (activeDistrict || activeListId) ? 'var(--plra-500)' : 'rgba(255,255,255,0.05)',
              color: 'white',
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Shield size={12} />
            { (activeDistrict || activeListId) ? 'LIMPIAR FILTROS GLOBALES' : 'VISTA GLOBAL ACTIVA' }
          </button>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <select 
              className="mini-input" 
              style={{ width: '220px', background: 'rgba(255,255,255,0.05)' }}
              value={selectedCampaignId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCampaignId(val);
                if (val === 'all') {
                  setActiveDistrict(null);
                  setActiveListId(null);
                } else {
                  const camp = campaigns.find(c => c.id.toString() === val);
                  if (camp) {
                    setActiveDistrict(camp.distrito);
                    setTimeout(fetchData, 100); // Trigger auto-sync
                  }
                }
              }}
            >
              <option value="all">Todas las Campañas</option>
              {Array.isArray(campaigns) && campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button className="action-btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }} onClick={fetchData}>
            <Activity size={14} /> Sincronizar Datos
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
        <StatCard 
          icon={Database} 
          label="Padrón Total" 
          value={selectedCampaignId === 'all' ? (stats?.electors || 0) : '—'} 
          color="var(--text-3)" 
        />
        <StatCard 
          icon={UsersIcon} 
          label="Usuarios Activos" 
          value={selectedCampaignId === 'all' ? (stats?.users || 0) : (Array.isArray(users) ? users.filter(u => u.assigned_campaign_id?.toString() === selectedCampaignId).length : 0)} 
          color="var(--plra-300)" 
        />
        <StatCard 
          icon={Activity} 
          label="Capturas Totales" 
          value={selectedCampaignId === 'all' ? (stats?.captures || 0) : (Array.isArray(captures) ? captures.filter(c => c.campaign_id?.toString() === selectedCampaignId).length : 0)} 
          color="var(--plra-100)" 
        />
        <StatCard 
          icon={CheckCircle2} 
          label="Electores CASA" 
          value={selectedCampaignId === 'all' ? (stats?.green || 0) : (Array.isArray(captures) ? captures.filter(c => c.campaign_id?.toString() === selectedCampaignId && c.traffic_light === 'GREEN').length : 0)} 
          color="var(--green)" 
        />
        <StatCard 
          icon={Flag} 
          label="Familiares" 
          value={selectedCampaignId === 'all' ? (stats?.yellow || 0) : (Array.isArray(captures) ? captures.filter(c => c.campaign_id?.toString() === selectedCampaignId && c.traffic_light === 'YELLOW').length : 0)} 
          color="var(--yellow)" 
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <div className="card-premium-styled" style={{ background: 'var(--accent-subtle)', border: '1px solid rgba(59,130,246,0.15)', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <Activity size={24} style={{ color: 'var(--plra-300)' }} />
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Velocidad de Carga</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white' }}>{predictions?.velocity || 0}</p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>capturas / hora</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginTop: 'auto' }}>
            {predictions?.trend === 'up' ? <TrendingUp size={14} color="var(--green)" /> : <TrendingDown size={14} color="var(--red)" />}
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: predictions?.trend === 'up' ? 'var(--green)' : 'var(--red)' }}>
              {predictions?.trend === 'up' ? 'Ritmo en Aumento (+12%)' : 'Ritmo en Descenso'}
            </span>
          </div>
        </div>

        <div className="card-premium-styled" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <Flag size={24} style={{ color: 'var(--green)' }} />
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Proyección Final</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white' }}>{predictions?.projected_total || 0}</p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>total proyectado</span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', margin: 0, marginTop: 'auto', paddingTop: '0.5rem' }}>Basado en el ritmo de los últimos 60 minutos</p>
        </div>

        <div className="card-premium-styled" style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.03)', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <Shield size={24} style={{ color: 'var(--red)' }} />
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Zona de Seguridad</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: '0.2rem' }}>Control Maestro de Datos</p>
            </div>
          </div>
          <button 
            onClick={handleWipeCaptures}
            className="action-btn-danger"
            style={{ 
              width: '100%', padding: '1rem', borderRadius: '10px', 
              background: 'rgba(239,68,68,0.1)', color: 'var(--red)', 
              border: '1px solid var(--red)', fontSize: '0.75rem', 
              fontWeight: 800, cursor: 'pointer', marginTop: 'auto'
            }}
          >
            PURGAR DATOS DE CAMPO
          </button>
        </div>
      </div>

      <div style={{ height: '450px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <MapContainer center={[-22.545, -55.72]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <ZoomControl position="bottomright" />
          <MarkerClusterGroup>
            {(Array.isArray(captures) ? captures : [])
              .filter(c => c.lat && (selectedCampaignId === 'all' || c.campaign_id?.toString() === selectedCampaignId))
              .map(c => (
              <Marker 
                key={`cap-${c.id}`} 
                position={[c.lat, c.lng]} 
                icon={createCustomIcon(
                  c.traffic_light === 'GREEN' ? 'var(--green)' : 
                  c.traffic_light === 'YELLOW' ? 'var(--yellow)' : 
                  c.traffic_light === 'PURPLE' ? '#A855F7' : 'var(--red)',
                  c.needs_transport === 1 ? 'Truck' : 'MapPin',
                  20
                )}
              >
                <Popup>
                  <div style={{ color: 'black' }}>
                    <strong>{c.nombre} {c.apellido}</strong><br/>
                    Status: {c.traffic_light}<br/>
                    {c.needs_transport === 1 ? '🚗 REQUIERE TRASLADO' : '🚶 Sin traslado'}<br/>
                    <small>Por: {c.coordinator_name || 'Sistema'}</small>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
          {(Array.isArray(locales) ? locales : []).filter(l => l.lat).map(l => (
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

      <div className="card-premium-styled" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', margin: 0 }}>Rendimiento Comparativo de Campañas</h3>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', margin: 0 }}>Monitoreo de tracción por cliente SaaS</p>
          </div>
          <div style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--plra-300)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800 }}>
            {Array.isArray(campaigns) ? campaigns.length : 0} CLIENTES ACTIVOS
          </div>
        </div>
        <ManagementTable 
          isLoading={isLoading}
          data={(Array.isArray(campaigns) ? campaigns : []).map(camp => {
            const campCaptures = (Array.isArray(captures) ? captures : []).filter(c => c.campaign_id === camp.id).length;
            const campUsers = (Array.isArray(users) ? users : []).filter(u => u.assigned_campaign_id === camp.id).length;
            const progress = camp.goal ? Math.min(100, (campCaptures / camp.goal) * 100) : 0;
            return { ...camp, campCaptures, campUsers, progress };
          })}
          columns={[
            { header: 'Campaña / Tenant', accessor: 'name' },
            { header: 'Usuarios', accessor: (row: any) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={14} style={{ color: 'var(--text-3)' }} />
                <span style={{ fontWeight: 700 }}>{row.campUsers}</span>
              </div>
            )},
            { header: 'Capturas', accessor: (row: any) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={14} style={{ color: 'var(--plra-300)' }} />
                <span style={{ fontWeight: 700 }}>{row.campCaptures}</span>
              </div>
            )},
            { header: 'Progreso', accessor: (row: any) => (
              <div style={{ width: '100%', minWidth: '120px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', marginBottom: '4px', fontWeight: 700 }}>
                  <span style={{ color: 'var(--text-3)' }}>{row.campCaptures} / {row.goal || '∞'}</span>
                  <span style={{ color: 'var(--plra-300)' }}>{row.progress.toFixed(1)}%</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.progress}%`, background: 'var(--plra-400)', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )}
          ]}
        />
      </div>
    </div>
  );

  const renderCampaigns = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>Gestión de Campañas</h2>
        <button className="action-btn-primary" onClick={() => {
          setEditingCampaign(null);
          setNewCampaignName('');
          setNewCampaignSlogan('');
          setNewCampaignPhotoUrl('');
          setNewCampaignGoal(1000);
          setNewCampaignDistrito('');
          setNewCampaignModules([
            'COMMAND_CENTER', 'CC_FIELD_REQUESTS', 'CC_ELECTOR_REGISTRY', 'CC_RANKINGS', 'CC_HEATMAP',
            'REGISTRY', 'REG_CAPTURE', 'REG_LOOKUP', 'REG_SHARE',
            'LOGISTICS', 'LOG_VEHICLES', 'LOG_ROUTES', 'LOG_ZONES', 'LOG_TRANSPORT',
            'WHATSAPP', 'WA_BROADCAST', 'WA_CONTACTS', 'WA_TEMPLATES',
            'DIAD', 'DD_COUNTDOWN', 'DD_VEEDORES', 'DD_ACTAS', 'DD_RESULTS'
          ]);
          setShowModal('campaign');
        }}>
          <Plus size={18} /> Nueva Campaña
        </button>
      </div>
      <ManagementTable 
        isLoading={isLoading}
        columns={[
          { header: 'ID', accessor: 'id', width: '80px', sortKey: 'id' },
          { header: 'Nombre', accessor: 'name', sortKey: 'name' },
          { 
            header: 'Módulos', 
            accessor: (c: any) => (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {(c.enabled_modules || 'COMMAND_CENTER,REGISTRY').split(',').map((m: string) => (
                  <div 
                    key={m} 
                    style={{ 
                      padding: '2px 6px', 
                      borderRadius: '4px', 
                      fontSize: '0.6rem', 
                      background: 'rgba(59,130,246,0.1)', 
                      color: 'var(--plra-300)',
                      border: '1px solid rgba(59,130,246,0.2)'
                    }}
                  >
                    {m.replace('_', ' ')}
                  </div>
                ))}
              </div>
            )
          },
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
                  setNewCampaignSlogan((c as any).slogan || '');
                  setNewCampaignGoal((c as any).goal || 1000);
                  setNewCampaignDistrito((c as any).distrito || '');
                  setNewCampaignModules((c as any).enabled_modules ? (c as any).enabled_modules.split(',') : []);
                  setShowModal('edit-campaign'); 
                }}><Edit2 size={14} /></button>
                <button className="icon-btn delete" onClick={() => handleDeleteCampaign(c.id)}><Trash2 size={14} /></button>
              </div>
            )
          }
        ]}
        data={Array.isArray(campaigns) ? campaigns : []}
      />
    </div>
  );

  const renderLists = () => {
    // 1. Group lists by city for the overview
    const listsByCity = (Array.isArray(lists) ? lists : []).reduce((acc: Record<string, any[]>, list) => {
      const city = list.ciudad || 'GENERAL';
      if (!acc[city]) acc[city] = [];
      acc[city].push(list);
      return acc;
    }, {});

    const cityStats = Object.keys(listsByCity).map(city => ({
      name: city,
      count: listsByCity[city].length,
      intendentes: (Array.isArray(listsByCity[city]) ? listsByCity[city] : []).filter(l => l.type === 'INTENDENTE').length,
      concejales: (Array.isArray(listsByCity[city]) ? listsByCity[city] : []).filter(l => l.type === 'CONCEJAL').length
    })).sort((a, b) => a.name.localeCompare(b.name));

    const filteredLists = (Array.isArray(lists) ? lists : []).filter(l => {
      const matchesSearch = !listSearchTerm || 
        l.candidate_nombre?.toLowerCase().includes(listSearchTerm.toLowerCase()) ||
        (l as any).candidate_alias?.toLowerCase().includes(listSearchTerm.toLowerCase()) ||
        l.list_number?.toString().includes(listSearchTerm);
      const matchesCity = selectedCityForLists ? l.ciudad === selectedCityForLists : (!listCityFilter || l.ciudad === listCityFilter);
      const matchesType = !listTypeFilter || l.type === listTypeFilter;
      return matchesSearch && matchesCity && matchesType;
    });

    if (!selectedCityForLists) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', marginBottom: '0.4rem' }}>Listas Electorales</h2>
              <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>Distribución geográfica de candidatos y listas por distrito</p>
            </div>
            <button className="action-btn-primary" onClick={() => {
              setEditingList(null);
              setNewListCiudad('');
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
              <Plus size={18} /> Registrar Nueva Lista
            </button>
          </div>

            {(Array.isArray(cityStats) ? cityStats : []).map(city => (
              <motion.div 
                key={city.name}
                whileHover={{ y: -5, scale: 1.02 }}
                onClick={() => setSelectedCityForLists(city.name)}
                className="card-premium-styled"
                style={{ 
                  cursor: 'pointer',
                  padding: '2rem',
                  borderLeft: '4px solid var(--plra-400)',
                  background: 'linear-gradient(145deg, var(--surface), rgba(59, 130, 246, 0.05))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ position: 'absolute', right: '-10px', top: '-10px', opacity: 0.05 }}>
                  <MapPin size={120} />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', marginBottom: '0.25rem' }}>{city.name}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Distrito Electoral</p>
                  </div>
                  <div style={{ 
                    background: 'rgba(59, 130, 246, 0.1)', color: 'var(--plra-300)', 
                    padding: '0.5rem 1rem', borderRadius: '12px', fontWeight: 900, fontSize: '1.2rem'
                  }}>
                    {city.count}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Intendentes</p>
                    <p style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--plra-200)' }}>{city.intendentes}</p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Concejales</p>
                    <p style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--yellow)' }}>{city.concejales}</p>
                  </div>
                </div>

                <div style={{ 
                  marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', 
                  color: 'var(--plra-400)', fontWeight: 800, fontSize: '0.8rem' 
                }}>
                  Gestionar Listas <ArrowRight size={14} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <button 
              onClick={() => setSelectedCityForLists(null)}
              className="icon-btn"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '0.75rem' }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white' }}>
                Listas en <span style={{ color: 'var(--plra-300)' }}>{selectedCityForLists}</span>
              </h2>
              <p style={{ color: 'var(--text-3)', fontSize: '0.8rem', fontWeight: 700 }}>{filteredLists.length} CANDIDATOS REGISTRADOS</p>
            </div>
          </div>
          <button className="action-btn-primary" onClick={() => {
            setEditingList(null);
            setNewListCiudad(selectedCityForLists || '');
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

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 200px auto', 
          gap: '1rem', 
          padding: '1rem', 
          background: 'rgba(255,255,255,0.02)', 
          borderRadius: '16px', 
          border: '1px solid var(--border)',
          alignItems: 'center'
        }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', zIndex: 1 }} />
            <input 
              className="modern-input-premium-styled" 
              style={{ paddingLeft: '2.75rem', marginBottom: 0 }}
              placeholder="Buscar por candidato, alias o lista..." 
              value={listSearchTerm}
              onChange={e => setListSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="modern-input-premium-styled" 
            style={{ marginBottom: 0 }}
            value={listTypeFilter} 
            onChange={e => setListTypeFilter(e.target.value)}
          >
            <option value="">Todos los Tipos</option>
            <option value="INTENDENTE">INTENDENTE</option>
            <option value="CONCEJAL">CONCEJAL</option>
          </select>
          {(listSearchTerm || listTypeFilter) && (
            <button 
              className="icon-btn" 
              onClick={() => { setListSearchTerm(''); setListTypeFilter(''); }}
              style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <X size={18} />
            </button>
          )}
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
                    {l.photo_url ? <img src={getImageUrl(l.photo_url) || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <User size={16} style={{ margin: '8px', color: 'var(--text-3)' }} />}
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
                    setNewListCiudad(l.ciudad || '');
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
          data={filteredLists}
        />
      </div>
    );
  };


  const renderAudit = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>Auditoría de Sistema</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className={activeAuditTab === 'logs' ? 'tab-btn active' : 'tab-btn'} 
            onClick={() => setActiveAuditTab('logs')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
          >
            <Activity size={16} /> Logs de Actividad
          </button>
          <button 
            className={activeAuditTab === 'security' ? 'tab-btn active' : 'tab-btn'} 
            onClick={() => setActiveAuditTab('security')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
          >
            <Shield size={16} /> Seguridad (Logins)
          </button>
        </div>
      </div>
      
      {activeAuditTab === 'logs' ? (
        <>
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
              { header: 'Distrito', accessor: (row: any) => row.user_district || 'SISTEMA' },
              { header: 'Acción', accessor: 'action', sortKey: 'action' },
              { header: 'Detalles', accessor: 'details', sortKey: 'details' }
            ]}
            data={Array.isArray(auditLogs) ? auditLogs : []}
          />
        </>
      ) : (
        <ManagementTable 
          isLoading={isLoading}
          columns={[
            { header: 'Fecha', accessor: (row: any) => new Date(row.timestamp).toLocaleString(), sortKey: 'timestamp', width: '180px' },
            { header: 'Usuario', accessor: 'username', sortKey: 'username' },
            { header: 'Distrito', accessor: (row: any) => row.user_district || 'N/A' },
            { 
              header: 'Estado', 
              accessor: (row: any) => (
                <span style={{ 
                  padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800,
                  background: row.status === 'SUCCESS' ? 'rgba(37,200,130,0.1)' : 'rgba(239,68,68,0.1)',
                  color: row.status === 'SUCCESS' ? 'var(--green)' : 'var(--red)'
                }}>
                  {row.status}
                </span>
              )
            },
            { header: 'IP', accessor: 'ip', width: '120px' },
            { 
              header: 'Dispositivo / Navegador', 
              accessor: (row: any) => (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.user_agent}>
                  {row.user_agent}
                </div>
              )
            },
            { 
              header: 'GPS', 
              accessor: (row: any) => (
                row.lat ? (
                  <a 
                    href={`https://www.google.com/maps?q=${row.lat},${row.lng}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: 'var(--plra-300)', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <MapPin size={12} /> Ver Mapa
                  </a>
                ) : (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>No disponible</span>
                )
              )
            }
          ]}
          data={Array.isArray(loginAttempts) ? loginAttempts : []}
        />
      )}
    </div>
  );

  const renderLocales = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>Locales de Votación</h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="action-btn-secondary" onClick={handleSyncLocales}>
            <Activity size={18} /> Sincronizar desde Padrón
          </button>
          <button className="action-btn-primary" onClick={() => {
            setEditingLocale(null);
            setNewLocaleCod('');
            setNewLocaleNombre('');
            setNewLocaleDireccion('');
            setNewLocaleLat('');
            setNewLocaleLng('');
            setNewLocaleIcon('Landmark');
            setNewLocaleCiudad('');
            setShowModal('locale');
          }}>
            <Plus size={18} /> Registrar Local
          </button>
        </div>
      </div>
      
      <div className="filter-bar-premium">
        <div className="search-input-wrapper-premium" style={{ maxWidth: '300px' }}>
          <Search size={18} />
          <input 
            className="modern-input-premium-styled" 
            placeholder="Buscar local por nombre..." 
            value={localeSearchTerm} 
            onChange={e => setLocaleSearchTerm(e.target.value)} 
            style={{ marginBottom: 0 }}
          />
        </div>
        <select 
          className="modern-input-premium-styled" 
          style={{ width: '200px', marginBottom: 0 }}
          value={localeCityFilter} 
          onChange={e => setLocaleCityFilter(e.target.value)}
        >
          <option value="">Todas las Ciudades</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(localeSearchTerm || localeCityFilter) && (
          <button 
            className="icon-btn" 
            onClick={() => { setLocaleSearchTerm(''); setLocaleCityFilter(''); }}
            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      <ManagementTable 
        isLoading={isLoading}
        columns={[
          { header: 'Código', accessor: 'cod_local', width: '80px' },
          { header: 'Ciudad', accessor: 'ciudad', sortKey: 'ciudad' },
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
                  const currentCity = l.distrito || l.ciudad || '';
                  setNewLocaleCiudad(currentCity);
                  if (currentCity && CIUDADES_PARAGUAY[currentCity]) {
                    setMapCenter([CIUDADES_PARAGUAY[currentCity].lat, CIUDADES_PARAGUAY[currentCity].lng]);
                    setMapZoom(CIUDADES_PARAGUAY[currentCity].zoom);
                  }
                  setShowModal('locale'); 
                }}><Edit2 size={14} /></button>
                <button className="icon-btn delete" onClick={() => handleDeleteLocale(l.cod_local)}><Trash2 size={14} /></button>
              </div>
            )
          }
        ]}
        data={(Array.isArray(locales) ? locales : []).filter(l => {
          const matchesSearch = l.nombre.toLowerCase().includes(localeSearchTerm.toLowerCase());
          const matchesCity = !localeCityFilter || l.ciudad === localeCityFilter || l.distrito === localeCityFilter;
          return matchesSearch && matchesCity;
        })}
      />

      <div style={{ height: '400px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <ZoomControl position="bottomright" />
          <MapRecenter center={mapCenter} zoom={mapZoom} />
          {(Array.isArray(locales) ? locales : []).filter(l => l.lat).map(l => (
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
              <input className="modern-input-premium-styled" value={appPlatformName} onChange={e => setAppPlatformName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Logo de la App (URL)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input className="modern-input-premium-styled" value={appLogoUrl} onChange={e => setAppLogoUrl(e.target.value)} />
                <button className="icon-btn" onClick={() => fileInputRef.current?.click()}><Image size={18} /></button>
              </div>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Encabezado de Mensaje Compartir (WhatsApp/Share)</label>
              <textarea 
                className="modern-input-premium-styled" 
                value={shareMessage} 
                onChange={e => setShareMessage(e.target.value)}
                style={{ height: '60px', paddingTop: '0.75rem' }}
                placeholder="Ej: 🔹 *DATOS ELECTORALES* 🔹"
              />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Pie de Mensaje Compartir (Hashtags)</label>
              <textarea 
                className="modern-input-premium-styled" 
                value={shareMessageFooter} 
                onChange={e => setShareMessageFooter(e.target.value)}
                style={{ height: '60px', paddingTop: '0.75rem' }}
                placeholder="Ej: #Intelecciones #PLRA"
              />
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

  const handleImportPadron = async (file: File) => {
    if (!importCity) {
      alert('Por favor, ingresa el nombre de la ciudad para este padrón.');
      return;
    }
    
    setImportingPadron(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ciudad', importCity);

    try {
      const res = await api.post('/admin/import-padron', formData);
      alert(`¡Éxito! Se han importado ${res.data.count} electores para ${importCity}.`);
      setImportCity('');
      loadPadronStats();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al importar padrón');
    } finally {
      setImportingPadron(false);
    }
  };

  const loadPadronStats = async () => {
    try {
      const res = await api.get('/admin/electors/stats');
      setPadronStats(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (activeTab === 'padrones') loadPadronStats();
  }, [activeTab]);

  const renderPadrones = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', maxWidth: '1000px' }}>
      <section>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--plra-300)', letterSpacing: '0.1em', marginBottom: '1.5rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FileText size={18} /> Importación de Padrones (Excel)
        </h3>
        
        <div className="card-premium-styled" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="form-group">
              <label>Nombre de la Ciudad</label>
              <input 
                className="modern-input-premium-styled" 
                placeholder="Ej: Pedro Juan Caballero, Asunción..." 
                value={importCity}
                onChange={e => setImportCity(e.target.value)}
              />
              <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.5rem' }}>
                * Este nombre se usará para aislar los datos. Solo usuarios asignados a locales de esta ciudad podrán consultarlos.
              </p>
            </div>

            <div 
              style={{
                border: '2px dashed var(--border-mid)',
                borderRadius: '16px',
                padding: '3rem 2rem',
                textAlign: 'center',
                background: 'rgba(59,130,246,0.02)',
                cursor: importingPadron ? 'wait' : 'pointer',
                transition: 'all 0.3s ease'
              }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                if (importingPadron) return;
                const file = e.dataTransfer.files[0];
                if (file) handleImportPadron(file);
              }}
              onClick={() => {
                if (importingPadron) return;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.xlsx, .xls, .csv';
                input.onchange = (e: any) => {
                  const file = e.target.files[0];
                  if (file) handleImportPadron(file);
                };
                input.click();
              }}
            >
              {importingPadron ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid var(--plra-300)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                  <p style={{ fontWeight: 800, color: 'var(--plra-300)' }}>Procesando archivo... por favor espera.</p>
                </div>
              ) : (
                <>
                  <Download size={40} style={{ color: 'var(--plra-300)', marginBottom: '1rem' }} />
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>Suelta tu archivo Excel aquí</h4>
                  <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>O haz clic para seleccionar desde tu computadora</p>
                  <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={14} style={{ color: 'var(--green)' }} /> Formato .xlsx / .xls
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={14} style={{ color: 'var(--green)' }} /> Mapeo automático de columnas
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--plra-300)', letterSpacing: '0.1em', marginBottom: '1.5rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <LayoutList size={18} /> Resumen de Registros por Ciudad
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {(Array.isArray(padronStats) ? padronStats : []).map(stat => (
            <div key={stat.ciudad} className="card-premium-styled" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>CIUDAD</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>{stat.ciudad || 'Sin Asignar'}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--plra-300)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>TOTAL ELECTORES</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--plra-200)' }}>{stat.count.toLocaleString()}</p>
              </div>
            </div>
          ))}
          {(Array.isArray(padronStats) ? padronStats : []).length === 0 && (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-3)', padding: '2rem' }}>No hay padrones cargados aún.</p>
          )}
        </div>
      </section>
    </div>
  );

  const renderSystem = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'white', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>Estado del Sistema</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', fontWeight: 500 }}>Métricas de rendimiento y salud de la plataforma en tiempo real.</p>
        </div>
        <button 
          className="btn-primary" 
          onClick={fetchSystemHealth}
          style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', fontSize: '0.8rem' }}
        >
          <RefreshCw size={16} /> Actualizar Diagnóstico
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem' }}>
        <div className="card-premium-styled" style={{ 
          padding: '1.75rem', 
          borderLeft: '5px solid var(--plra-400)',
          background: 'linear-gradient(145deg, var(--surface), rgba(59, 130, 246, 0.05))'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--plra-300)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Infraestructura DB</p>
              <h3 style={{ fontSize: '2.2rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'white' }}>
                {systemStats?.database?.electors?.toLocaleString() || '---'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: 500 }}>Electores en padrón total</p>
            </div>
            <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--plra-400)' }}>
              <Database size={24} />
            </div>
          </div>
          <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, letterSpacing: '0.05em' }}>CAPTURES</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--plra-200)' }}>{systemStats?.database?.captures?.toLocaleString()}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, letterSpacing: '0.05em' }}>USUARIOS</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--plra-200)' }}>{systemStats?.database?.users?.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card-premium-styled" style={{ 
          padding: '1.75rem', 
          borderLeft: '5px solid var(--green)',
          background: 'linear-gradient(145deg, var(--surface), rgba(34, 197, 94, 0.05))'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Entorno de Ejecución</p>
              <h3 style={{ fontSize: '2.2rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'white' }}>
                {systemStats?.system?.status || 'Online'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: 500 }}>
                Uptime: {Math.floor((systemStats?.system?.uptime || 0) / 3600)}h {Math.floor(((systemStats?.system?.uptime || 0) % 3600) / 60)}m
              </p>
            </div>
            <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--green)' }}>
              <Activity size={24} />
            </div>
          </div>
          <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, letterSpacing: '0.05em' }}>MEMORIA</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 900, color: '#86efac' }}>{systemStats?.system?.memory || '---'}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, letterSpacing: '0.05em' }}>NODE.JS</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 900, color: '#86efac' }}>{systemStats?.system?.node || '---'}</p>
            </div>
          </div>
        </div>

        <div className="card-premium-styled" style={{ 
          padding: '1.75rem', 
          borderLeft: '5px solid var(--yellow)',
          background: 'linear-gradient(145deg, var(--surface), rgba(245, 158, 11, 0.05))'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Centro de Auditoría</p>
              <h3 style={{ fontSize: '2.2rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'white' }}>
                {systemStats?.database?.logs?.toLocaleString() || '0'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: 500 }}>Eventos de seguridad registrados</p>
            </div>
            <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--yellow)' }}>
              <Shield size={24} />
            </div>
          </div>
          <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <button 
              className="btn" 
              style={{ 
                width: '100%', 
                gap: '0.5rem', 
                background: 'rgba(245, 158, 11, 0.1)', 
                color: 'var(--yellow)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '10px',
                padding: '0.7rem'
              }} 
              onClick={() => setActiveTab('audit')}
            >
              Consultar Logs Forenses <FileText size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="card-premium-styled" style={{ 
        padding: '3rem 2rem', 
        textAlign: 'center', 
        background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.03) 0%, rgba(2, 12, 30, 0.5) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.1)'
      }}>
        <div style={{ 
          width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--plra-400)',
          margin: '0 auto 1.5rem'
        }}>
          <ShieldCheck size={32} />
        </div>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '0.75rem', color: 'white' }}>Operaciones de Mantenimiento</h3>
        <p style={{ color: 'var(--text-2)', maxWidth: '640px', margin: '0 auto 2.5rem', lineHeight: 1.7, fontSize: '0.95rem' }}>
          Realiza limpiezas preventivas o reseteos controlados de la información de campo antes del inicio de una nueva jornada electoral para asegurar la integridad de los datos.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <button 
            className="btn" 
            onClick={handleWipeCaptures}
            style={{ 
              background: 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)',
              color: 'white',
              padding: '0.9rem 2rem',
              borderRadius: '12px',
              boxShadow: '0 8px 20px rgba(239, 68, 68, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}
          >
            <Trash2 size={20} /> Purgar Datos (RESET)
          </button>
          <button 
            className="btn" 
            onClick={() => setActiveTab('padrones')}
            style={{ 
              background: 'linear-gradient(135deg, var(--plra-500) 0%, var(--plra-700) 100%)',
              color: 'white',
              padding: '0.9rem 2rem',
              borderRadius: '12px',
              boxShadow: '0 8px 20px rgba(0, 71, 171, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}
          >
            <Database size={20} /> Gestionar Padrones
          </button>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => {
    const filteredUsers = (Array.isArray(users) ? users : []).filter(u => {
      const matchesSearch = !userSearchTerm || 
        u.username?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        u.nombre?.toLowerCase().includes(userSearchTerm.toLowerCase());
      const matchesRole = !userRoleFilter || u.role === userRoleFilter;
      const matchesCampaign = !userCampaignFilter || 
        u.assigned_campaign_id?.toString() === userCampaignFilter ||
        u.effective_campaign_id?.toString() === userCampaignFilter;
      return matchesSearch && matchesRole && matchesCampaign;
    });

    return (
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
            setNewUserParent('');
            setNewUserTelefono('');
            setNewUserDistrito('');
            setUserProfilePreview(null);
            setIsUserVerified(false);
            setShowModal('user');
          }}>
            <UserPlus size={18} /> Crear Usuario
          </button>
        </div>

        {/* FILTERS BAR */}
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', 
          borderRadius: '12px', border: '1px solid var(--border)' 
        }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginBottom: '0.4rem' }}>Buscador (Nombre / CI)</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input 
                className="mini-input" 
                style={{ paddingLeft: '30px', width: '100%' }}
                placeholder="Buscar usuario..." 
                value={userSearchTerm} 
                onChange={e => setUserSearchTerm(e.target.value)} 
              />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginBottom: '0.4rem' }}>Filtrar por Rol</label>
            <select className="mini-input" value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)}>
              <option value="">Todos los Roles</option>
              <option value="SUPERUSUARIO">SuperUsuario</option>
              <option value="JEFE_CAMPANA">Jefe Campaña</option>
              <option value="PADRINO">Padrino</option>
              <option value="SUBJEFE">Subjefe</option>
              <option value="COORDINADOR">Coordinador</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginBottom: '0.4rem' }}>Filtrar por Campaña</label>
            <select className="mini-input" value={userCampaignFilter} onChange={e => setUserCampaignFilter(e.target.value)}>
              <option value="">Todas las Campañas</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <ManagementTable 
          isLoading={isLoading}
          maxHeight="calc(100vh - 350px)"
          stickyHeader={true}
          columns={[
            { header: 'CI', accessor: 'username', width: '120px' },
            { header: 'Nombre', accessor: 'nombre' },
            { header: 'Campaña / Cliente', accessor: (u: any) => {
              const c = campaigns.find(camp => camp.id === u.assigned_campaign_id);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c ? 'var(--plra-300)' : 'var(--text-3)' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: c ? 'white' : 'var(--text-3)' }}>
                    {c ? c.name : 'SISTEMA GLOBAL'}
                  </span>
                </div>
              );
            }},
            { 
              header: 'Rol', 
              accessor: (u: any) => (
                <span style={{ 
                  padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800,
                  background: u.role === 'SUPERUSUARIO' ? 'var(--accent-subtle)' : 'var(--surface-light)',
                  color: u.role === 'SUPERUSUARIO' ? 'var(--plra-300)' : 'var(--text-2)'
                }}>{u.role}</span>
              )
            },
            {
              header: 'Dependencia (Superior)',
              accessor: (u: any) => u.parent_name || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>N/A</span>,
              sortKey: 'parent_name'
            },
            { 
              header: 'Lista Asignada', 
              accessor: (u: any) => {
                if (!u.assigned_list_id) return <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Sin asignar</span>;
                const list = lists?.find(l => l.id === u.assigned_list_id);
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
                    setNewUserParent(u.parent_id?.toString() || '');
                    setNewUserTelefono(u.telefono || '');
                    setNewUserDistrito(u.distrito || '');
                    setUserProfilePreview({ photo_url: u.photo_url, nombre: u.nombre });
                    setIsUserVerified(!!u.ci);
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
                  <button className="icon-btn delete" onClick={() => handleDeleteUser(u.id)} disabled={u.username === 'admin'} title="Eliminar Operador"><Trash2 size={14} /></button>
                </div>
              )
            }
          ]}
          data={filteredUsers}
        />
      </div>
    );
  };


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
            {(Array.isArray(pendingLogistics) ? pendingLogistics : []).filter(p => !p.assigned_vehicle_id).map(cap => (
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
            {(Array.isArray(pendingLogistics) ? pendingLogistics : []).filter(p => !p.assigned_vehicle_id).length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem', padding: '1rem' }}>No hay traslados pendientes</p>
            )}
          </div>
        </div>

        <div className="card-premium-styled">
          <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={18} style={{ color: 'var(--green)' }} /> Flota de Vehículos
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(Array.isArray(vehicles) ? vehicles : []).map(v => {
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
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'campaigns' && renderCampaigns()}
              {activeTab === 'lists' && renderLists()}
              {activeTab === 'users' && renderUsers()}
              {activeTab === 'logistics' && renderLogistics()}
              {activeTab === 'system' && renderSystem()}
              {activeTab === 'audit' && renderAudit()}
              {activeTab === 'locales' && renderLocales()}
              {activeTab === 'padrones' && renderPadrones()}
              {activeTab === 'whatsapp' && <Navigate to="/comunicaciones" />}
              {activeTab === 'settings' && renderSettings()}
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
                          <input 
                            className="modern-input-premium-styled" 
                            value={newCampaignDistrito} 
                            onChange={e => setNewCampaignDistrito(e.target.value.toUpperCase())} 
                            placeholder="Ej: ASUNCION" 
                            list="districts-list"
                          />
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
                            { key: 'COMMAND_CENTER', label: 'Centro de Mando', icon: '🎯', desc: 'Panel de comando operativo y KPIs en tiempo real', subs: [
                              { key: 'CC_FIELD_REQUESTS', label: 'Solicitudes de Campo' },
                              { key: 'CC_ELECTOR_REGISTRY', label: 'Registro de Electores' },
                              { key: 'CC_RANKINGS', label: 'Rankings de Coordinadores' },
                              { key: 'CC_HEATMAP', label: 'Mapa de Calor' }
                            ]},
                            { key: 'REGISTRY', label: 'Registro Electoral', icon: '📋', desc: 'Captura y verificación de adherentes en campo', subs: [
                              { key: 'REG_CAPTURE', label: 'Captura de Adherentes' },
                              { key: 'REG_LOOKUP', label: 'Consulta por Cédula' },
                              { key: 'REG_SHARE', label: 'Compartir Constancias' }
                            ]},
                            { key: 'LOGISTICS', label: 'Logística', icon: '🚛', desc: 'Gestión de vehículos, rutas y traslados del Día D', subs: [
                              { key: 'LOG_VEHICLES', label: 'Gestión de Vehículos' },
                              { key: 'LOG_ROUTES', label: 'Planificación de Rutas' },
                              { key: 'LOG_ZONES', label: 'Cobertura de Zonas' },
                              { key: 'LOG_TRANSPORT', label: 'Traslado de Electores' }
                            ]},
                            { key: 'WHATSAPP', label: 'Comunicaciones', icon: '💬', desc: 'Mensajería masiva y gestión de contactos', subs: [
                              { key: 'WA_BROADCAST', label: 'Mensajes Masivos' },
                              { key: 'WA_CONTACTS', label: 'Gestión de Contactos' },
                              { key: 'WA_TEMPLATES', label: 'Plantillas de Mensaje' }
                            ]},
                            { key: 'DIAD', label: 'Día D', icon: '🗳️', desc: 'Operación electoral del día de la votación', subs: [
                              { key: 'DD_COUNTDOWN', label: 'Cuenta Regresiva' },
                              { key: 'DD_VEEDORES', label: 'Gestión de Veedores' },
                              { key: 'DD_ACTAS', label: 'Carga de Actas' },
                              { key: 'DD_RESULTS', label: 'Resultados en Vivo' }
                            ]}
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
                            { key: 'COMMAND_CENTER', label: 'Centro de Mando', icon: '🎯', desc: 'Panel de comando operativo y KPIs en tiempo real', subs: [
                              { key: 'CC_FIELD_REQUESTS', label: 'Solicitudes de Campo' },
                              { key: 'CC_ELECTOR_REGISTRY', label: 'Registro de Electores' },
                              { key: 'CC_RANKINGS', label: 'Rankings de Coordinadores' },
                              { key: 'CC_HEATMAP', label: 'Mapa de Calor' }
                            ]},
                            { key: 'REGISTRY', label: 'Registro Electoral', icon: '📋', desc: 'Captura y verificación de adherentes en campo', subs: [
                              { key: 'REG_CAPTURE', label: 'Captura de Adherentes' },
                              { key: 'REG_LOOKUP', label: 'Consulta por Cédula' },
                              { key: 'REG_SHARE', label: 'Compartir Constancias' }
                            ]},
                            { key: 'LOGISTICS', label: 'Logística', icon: '🚛', desc: 'Gestión de vehículos, rutas y traslados del Día D', subs: [
                              { key: 'LOG_VEHICLES', label: 'Gestión de Vehículos' },
                              { key: 'LOG_ROUTES', label: 'Planificación de Rutas' },
                              { key: 'LOG_ZONES', label: 'Cobertura de Zonas' },
                              { key: 'LOG_TRANSPORT', label: 'Traslado de Electores' }
                            ]},
                            { key: 'WHATSAPP', label: 'Comunicaciones', icon: '💬', desc: 'Mensajería masiva y gestión de contactos', subs: [
                              { key: 'WA_BROADCAST', label: 'Mensajes Masivos' },
                              { key: 'WA_CONTACTS', label: 'Gestión de Contactos' },
                              { key: 'WA_TEMPLATES', label: 'Plantillas de Mensaje' }
                            ]},
                            { key: 'DIAD', label: 'Día D', icon: '🗳️', desc: 'Operación electoral del día de la votación', subs: [
                              { key: 'DD_COUNTDOWN', label: 'Cuenta Regresiva' },
                              { key: 'DD_VEEDORES', label: 'Gestión de Veedores' },
                              { key: 'DD_ACTAS', label: 'Carga de Actas' },
                              { key: 'DD_RESULTS', label: 'Resultados en Vivo' }
                            ]}
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
                          <input className="modern-input-premium-styled" value={newUserTelefono} placeholder="+595" onChange={e => {
                            let v = e.target.value;
                            if (v.length >= 2 && !v.startsWith('+')) {
                              let d = v.replace(/\D/g, '');
                              if (d.startsWith('09')) v = '+595' + d.substring(1);
                              else if (d.startsWith('9')) v = '+595' + d;
                              else if (d.length > 5) v = '+' + d;
                            }
                            setNewUserTelefono(v);
                          }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                          <label>Rol del Operador</label>
                          <select className="modern-input-premium-styled" value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
                            <option value="COORDINADOR">Coordinador de Campo</option>
                            <option value="PADRINO">Padrino</option>
                            <option value="SUBJEFE">Sub-Jefe (Líder de Lista)</option>
                            <option value="JEFE_CAMPANA">Jefe de Campaña</option>
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
                              <input 
                                className="modern-input-premium-styled" 
                                placeholder="Ej: PEDRO JUAN CABALLERO" 
                                value={newUserDistrito} 
                                onChange={e => setNewUserDistrito(e.target.value.toUpperCase())}
                                list="districts-list"
                              />
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
                          <input 
                            className="modern-input-premium-styled" 
                            placeholder="Ej: PEDRO JUAN CABALLERO" 
                            value={newListCiudad} 
                            onChange={e => setNewListCiudad(e.target.value.toUpperCase())} 
                            list="districts-list"
                            required 
                          />
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
