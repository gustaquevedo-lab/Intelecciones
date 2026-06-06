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
import api, { getImageUrl } from '../../services/api';
import { ImageCropperModal } from '../../components/ImageCropperModal';
import L from 'leaflet';

const TabPadrones = (props: any) => {
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
  } = props;

  const handleImportPadron = async (file: File) => {
    if (!importCity.trim()) {
      alert('Por favor, especifique el nombre de la ciudad/distrito antes de importar.');
      return;
    }
    
    setImportingPadron(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('distrito', importCity.trim().toUpperCase());
    if (selectedCampaignId && selectedCampaignId !== 'all') {
      formData.append('campaign_id', selectedCampaignId);
    }

    try {
      const response = await api.post('/admin/import-padron', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      alert(`Padrón importado con éxito: ${response.data.count} electores cargados.`);
      setImportCity('');
      if (fetchData) fetchData();
    } catch (err: any) {
      console.error('[IMPORT PADRON ERROR]', err);
      alert('Error al importar el padrón: ' + (err.response?.data?.error || err.message));
    } finally {
      setImportingPadron(false);
    }
  };

  return (
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
};

export default TabPadrones;
