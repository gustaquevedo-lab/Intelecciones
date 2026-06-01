import React from 'react';
import {
  Plus, Search, Trash2, Edit2, UserPlus, Flag,
  Users as UsersIcon, Database, Activity, CheckCircle2,
  X, Check, Users, Shield, Layout, Image, LayoutList,
  MapPin, Settings, AlertTriangle, FileText, Download,
  Truck, Clock, Save, Key, TrendingUp, TrendingDown,
  User, Copy, RefreshCw, ShieldCheck, ArrowRight, ArrowLeft
} from 'lucide-react';
import { ManagementTable } from '../../components/ManagementTable';
import { Skeleton, SkeletonTable } from '../../components/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import { Navigate } from 'react-router-dom';
import { getImageUrl } from '../../services/api';
import { ImageCropperModal } from '../../components/ImageCropperModal';
import L from 'leaflet';

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

const TabLocales = (props: any) => {
  // Destructure all state and handlers from SuperAdmin
  const {
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
    isUserVerified, isCandidateVerified, isVehicleDriverVerified,
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
    selectedSyncDistrict, setSelectedSyncDistrict,
    activeDistrict, setActiveDistrict,
    activeListId, setActiveListId,
    selectedCityForLists,
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
  } = props;

  return (
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
                    <strong>{l.nombre}</strong><br />
                    {l.direccion}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
  );
};

export default TabLocales;
