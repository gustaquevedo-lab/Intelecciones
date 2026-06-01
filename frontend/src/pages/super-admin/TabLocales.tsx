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
};

export default TabLocales;
