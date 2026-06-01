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

const TabOverview = (props: any) => {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {serverWaking && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '1rem 1.5rem', borderRadius: '14px',
            background: 'rgba(0, 71, 171, 0.08)',
            border: '1px solid rgba(0, 71, 171, 0.2)'
          }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2.5px solid var(--plra-400)', borderTopColor: 'transparent', flexShrink: 0, animation: 'spin 0.8s linear infinite' }} />
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--plra-200)' }}>Conectando con el servidor...</p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-3)' }}>El servidor está iniciando. Los datos cargarán en unos segundos.</p>
            </div>
            <button onClick={() => fetchData()} style={{ marginLeft: 'auto', padding: '0.4rem 0.9rem', borderRadius: '8px', border: '1px solid rgba(0,71,171,0.3)', background: 'transparent', color: 'var(--plra-300)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
              Reintentar
            </button>
          </div>
        )}
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
              {(activeDistrict || activeListId) ? 'LIMPIAR FILTROS GLOBALES' : 'VISTA GLOBAL ACTIVA'}
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
            <button className="action-btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }} onClick={() => fetchData()}>
              <Activity size={14} /> Sincronizar Datos
            </button>
          </div>
        </div>
    
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          <StatCard
            icon={Database}
            label="Padrón Total"
            value={stats?.electors || 0}
            color="var(--text-3)"
          />
          <StatCard
            icon={UsersIcon}
            label="Usuarios Activos"
            value={stats?.users || 0}
            color="var(--plra-300)"
          />
          <StatCard
            icon={Activity}
            label="Capturas Totales"
            value={stats?.captures || 0}
            color="var(--plra-100)"
          />
          <StatCard
            icon={CheckCircle2}
            label="Electores CASA"
            value={stats?.green || 0}
            color="var(--green)"
          />
          <StatCard
            icon={Flag}
            label="Familiares"
            value={stats?.yellow || 0}
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
                        <strong>{c.nombre} {c.apellido}</strong><br />
                        Status: {c.traffic_light}<br />
                        {c.needs_transport === 1 ? '🚗 REQUIERE TRASLADO' : '🚶 Sin traslado'}<br />
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
                    <strong>{l.nombre}</strong><br />
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
            data={(Array.isArray(campaigns) ? campaigns : []).map((camp: any) => {
              const progress = camp.goal ? Math.min(100, (camp.campCaptures / camp.goal) * 100) : 0;
              return { ...camp, progress };
            })}
            columns={[
              { header: 'Campaña / Tenant', accessor: 'name' },
              {
                header: 'Usuarios', accessor: (row: any) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={14} style={{ color: 'var(--text-3)' }} />
                    <span style={{ fontWeight: 700 }}>{row.campUsers}</span>
                  </div>
                )
              },
              {
                header: 'Capturas', accessor: (row: any) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={14} style={{ color: 'var(--plra-300)' }} />
                    <span style={{ fontWeight: 700 }}>{row.campCaptures}</span>
                  </div>
                )
              },
              {
                header: 'Progreso', accessor: (row: any) => (
                  <div style={{ width: '100%', minWidth: '120px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', marginBottom: '4px', fontWeight: 700 }}>
                      <span style={{ color: 'var(--text-3)' }}>{row.campCaptures} / {row.goal || '∞'}</span>
                      <span style={{ color: 'var(--plra-300)' }}>{row.progress.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${row.progress}%`, background: 'var(--plra-400)', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                )
              }
            ]}
          />
        </div>
      </div>
  );
};

export default TabOverview;
