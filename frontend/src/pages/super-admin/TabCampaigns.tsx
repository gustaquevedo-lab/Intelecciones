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

const TabCampaigns = (props: any) => {
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
                  <button 
                    className="icon-btn" 
                    onClick={() => handleTogglePause(c.id, c.status)}
                    style={{ background: c.status === 'PAUSED' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(220, 38, 38, 0.1)', color: c.status === 'PAUSED' ? 'var(--green)' : 'var(--red)', border: c.status === 'PAUSED' ? '1px solid var(--green)' : '1px solid var(--red)' }}
                    title={c.status === 'PAUSED' ? 'Reactivar' : 'Pausar'}
                  >
                    {c.status === 'PAUSED' ? <CheckCircle2 size={14} /> : <X size={14} />}
                  </button>
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
};

export default TabCampaigns;
