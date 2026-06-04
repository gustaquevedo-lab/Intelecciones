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

const TabLists = (props: any) => {
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
    selectedSyncDistrict, setSelectedSyncDistrict,
    activeDistrict, setActiveDistrict,
    activeListId, setActiveListId,
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
  } = props;

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
    
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
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

export default TabLists;
