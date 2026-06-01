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

const TabSettings = (props: any) => {
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
};

export default TabSettings;
