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

const TabUsers = (props: any) => {
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
            <button className="action-btn-primary" style={{ background: 'var(--green)' }} onClick={async () => {
              if (!confirm('¿Resetear TODOS los flags de cambio de contraseña?')) return;
              try {
                const res = await api.post('/admin/reset-password-flags', {});
                alert(`Flags reseteados: ${res.data.updated} usuarios`);
                fetchData();
              } catch {
                alert('Error al resetear flags');
              }
            }}>
              Resetear Flags
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
              {
                header: 'Campaña / Cliente', accessor: (u: any) => {
                  const c = campaigns.find(camp => camp.id === u.assigned_campaign_id);
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c ? 'var(--plra-300)' : 'var(--text-3)' }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: c ? 'white' : 'var(--text-3)' }}>
                        {c ? c.name : 'SISTEMA GLOBAL'}
                      </span>
                    </div>
                  );
                }
              },
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

export default TabUsers;
