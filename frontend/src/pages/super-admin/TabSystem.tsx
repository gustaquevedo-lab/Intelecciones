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

const TabSystem = (props: any) => {
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
    (
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
};

export default TabSystem;
