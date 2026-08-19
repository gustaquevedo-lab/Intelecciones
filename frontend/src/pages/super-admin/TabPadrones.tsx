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

  const [downloadingCity, setDownloadingCity] = React.useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = React.useState<'pdf' | 'xlsx' | null>(null);
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [exportCity, setExportCity] = React.useState('');
  const [exportLocales, setExportLocales] = React.useState<string[]>([]);
  const [exportSelectedLocale, setExportSelectedLocale] = React.useState('ALL');
  const [exportMesa, setExportMesa] = React.useState('');
  const [exportSearch, setExportSearch] = React.useState('');
  const [loadingLocales, setLoadingLocales] = React.useState(false);

  const fetchLocalesForCity = async (cityName: string) => {
    if (!cityName || cityName === 'Sin Asignar') {
      setExportLocales([]);
      return;
    }
    setLoadingLocales(true);
    try {
      const res = await api.get(`/reports/padron/locales?ciudad=${encodeURIComponent(cityName)}`);
      setExportLocales(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error loading locales for city:', err);
      setExportLocales([]);
    } finally {
      setLoadingLocales(false);
    }
  };

  const handleOpenExportModal = (cityName?: string) => {
    const city = cityName || (Array.isArray(padronStats) && padronStats[0]?.ciudad) || '';
    setExportCity(city);
    setExportSelectedLocale('ALL');
    setExportMesa('');
    setExportSearch('');
    setShowExportModal(true);
    if (city) fetchLocalesForCity(city);
  };

  const handleDownloadPadron = async (cityName: string, format: 'pdf' | 'xlsx', customOptions?: { local?: string; mesa?: string; search?: string }) => {
    if (!cityName || cityName === 'Sin Asignar') {
      alert('Por favor seleccione una ciudad válida.');
      return;
    }

    setDownloadingCity(cityName);
    setDownloadingFormat(format);

    try {
      const params = new URLSearchParams();
      params.append('ciudad', cityName);
      
      const local = customOptions?.local || (cityName === exportCity ? exportSelectedLocale : 'ALL');
      const mesa = customOptions?.mesa || (cityName === exportCity ? exportMesa : '');
      const search = customOptions?.search || (cityName === exportCity ? exportSearch : '');

      if (local && local !== 'ALL') params.append('local', local);
      if (mesa && mesa.trim()) params.append('mesa', mesa.trim());
      if (search && search.trim()) params.append('search', search.trim());

      const res = await api.get(`/reports/padron/export/${format}?${params.toString()}`, {
        responseType: 'blob',
      });

      const safeCity = cityName.toLowerCase().replace(/[^a-z0-9]/gi, '_');
      const extension = format === 'pdf' ? 'pdf' : 'xlsx';
      const mimeType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `padron_${safeCity}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('[DOWNLOAD PADRON ERROR]', err);
      alert('Error al generar el archivo: ' + (err.response?.data?.error || err.message));
    } finally {
      setDownloadingCity(null);
      setDownloadingFormat(null);
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--plra-300)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
              <LayoutList size={18} /> Resumen de Registros y Exportación por Ciudad
            </h3>
            
            <button
              onClick={() => handleOpenExportModal()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.3))',
                border: '1px solid rgba(59,130,246,0.4)', borderRadius: '10px',
                color: '#60A5FA', padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 800,
                cursor: 'pointer', transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Download size={15} /> Exportar con Filtros Avanzados
            </button>
          </div>
    
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {(Array.isArray(padronStats) ? padronStats : []).map(stat => {
              const isBusyPdf = downloadingCity === stat.ciudad && downloadingFormat === 'pdf';
              const isBusyXlsx = downloadingCity === stat.ciudad && downloadingFormat === 'xlsx';

              return (
                <div key={stat.ciudad} className="card-premium-styled" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>CIUDAD / DISTRITO</p>
                      <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', wordBreak: 'break-word' }}>{stat.ciudad || 'Sin Asignar'}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--plra-300)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>TOTAL ELECTORES</p>
                      <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--plra-200)' }}>{stat.count.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Action Buttons for this city */}
                  <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                      onClick={() => handleDownloadPadron(stat.ciudad, 'pdf')}
                      disabled={isBusyPdf || isBusyXlsx}
                      title="Descargar Padrón en PDF Ultra-Compacto Paginado (2 columnas por página)"
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '8px', color: '#F87171', padding: '0.45rem 0.6rem',
                        fontSize: '0.75rem', fontWeight: 800, cursor: (isBusyPdf || isBusyXlsx) ? 'wait' : 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {isBusyPdf ? (
                        <div className="animate-spin" style={{ width: '12px', height: '12px', border: '2px solid #F87171', borderTopColor: 'transparent', borderRadius: '50%' }} />
                      ) : (
                        <FileText size={13} />
                      )}
                      <span>PDF Compacto</span>
                    </button>

                    <button
                      onClick={() => handleDownloadPadron(stat.ciudad, 'xlsx')}
                      disabled={isBusyPdf || isBusyXlsx}
                      title="Descargar Padrón completo en Excel (.xlsx)"
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                        background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                        borderRadius: '8px', color: '#4ADE80', padding: '0.45rem 0.6rem',
                        fontSize: '0.75rem', fontWeight: 800, cursor: (isBusyPdf || isBusyXlsx) ? 'wait' : 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {isBusyXlsx ? (
                        <div className="animate-spin" style={{ width: '12px', height: '12px', border: '2px solid #4ADE80', borderTopColor: 'transparent', borderRadius: '50%' }} />
                      ) : (
                        <Download size={13} />
                      )}
                      <span>Excel (XLS)</span>
                    </button>

                    <button
                      onClick={() => handleOpenExportModal(stat.ciudad)}
                      title="Filtrar por local de votación o mesa"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '8px', color: 'var(--text-3)', padding: '0.45rem 0.6rem',
                        fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'white'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
                    >
                      <Settings size={13} />
                    </button>
                  </div>
                </div>
              );
            })}

            {(Array.isArray(padronStats) ? padronStats : []).length === 0 && (
              <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-3)', padding: '2rem' }}>No hay padrones cargados aún.</p>
            )}
          </div>
        </section>

        {/* Modal de Exportación Avanzada */}
        {showExportModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem'
          }}>
            <div className="card-premium-styled" style={{ maxWidth: '520px', width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Download size={18} style={{ color: 'var(--plra-300)' }} /> Exportar Padrón Electoral
                </h3>
                <button
                  onClick={() => setShowExportModal(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: '0.35rem', display: 'block' }}>Ciudad / Distrito</label>
                  <select
                    className="modern-input-premium-styled"
                    value={exportCity}
                    onChange={e => {
                      setExportCity(e.target.value);
                      fetchLocalesForCity(e.target.value);
                    }}
                    style={{ width: '100%' }}
                  >
                    <option value="">Seleccione una ciudad...</option>
                    {(Array.isArray(padronStats) ? padronStats : []).map(s => (
                      <option key={s.ciudad} value={s.ciudad}>{s.ciudad} ({s.count.toLocaleString()} electores)</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: '0.35rem', display: 'block' }}>
                    Local de Votación (Opcional)
                  </label>
                  <select
                    className="modern-input-premium-styled"
                    value={exportSelectedLocale}
                    onChange={e => setExportSelectedLocale(e.target.value)}
                    disabled={loadingLocales || exportLocales.length === 0}
                    style={{ width: '100%' }}
                  >
                    <option value="ALL">Todos los locales de la ciudad ({exportLocales.length} disponibles)</option>
                    {exportLocales.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: '0.35rem', display: 'block' }}>Mesa (Opcional)</label>
                    <input
                      type="number"
                      className="modern-input-premium-styled"
                      placeholder="Ej: 1"
                      value={exportMesa}
                      onChange={e => setExportMesa(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: '0.35rem', display: 'block' }}>Filtro de búsqueda</label>
                    <input
                      className="modern-input-premium-styled"
                      placeholder="Nombre o CI..."
                      value={exportSearch}
                      onChange={e => setExportSearch(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '10px', padding: '0.85rem' }}>
                  <p style={{ fontSize: '0.72rem', color: '#93C5FD', margin: 0, lineHeight: 1.4 }}>
                    💡 <strong>PDF Ultra-Compacto:</strong> Genera ~100 electores por página en 2 columnas con Cédula, Nombre y Apellido, Local, Mesa y Orden, numerado de página completo (Página X de Y).
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => handleDownloadPadron(exportCity, 'pdf')}
                  disabled={!exportCity || downloadingCity === exportCity}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    background: 'linear-gradient(135deg, #DC2626, #B91C1C)', border: 'none', borderRadius: '10px',
                    color: 'white', padding: '0.85rem', fontSize: '0.85rem', fontWeight: 800,
                    cursor: (!exportCity || downloadingCity === exportCity) ? 'not-allowed' : 'pointer',
                    opacity: (!exportCity || downloadingCity === exportCity) ? 0.6 : 1
                  }}
                >
                  <FileText size={16} /> Descargar PDF Paginado
                </button>

                <button
                  onClick={() => handleDownloadPadron(exportCity, 'xlsx')}
                  disabled={!exportCity || downloadingCity === exportCity}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    background: 'linear-gradient(135deg, #16A34A, #15803D)', border: 'none', borderRadius: '10px',
                    color: 'white', padding: '0.85rem', fontSize: '0.85rem', fontWeight: 800,
                    cursor: (!exportCity || downloadingCity === exportCity) ? 'not-allowed' : 'pointer',
                    opacity: (!exportCity || downloadingCity === exportCity) ? 0.6 : 1
                  }}
                >
                  <Download size={16} /> Descargar Excel (XLS)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

export default TabPadrones;
