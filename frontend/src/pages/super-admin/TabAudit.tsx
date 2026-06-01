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

const TabAudit = (props: any) => {
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
};

export default TabAudit;
