import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '../components/Logo';
import { PLRABackground } from '../components/PLRABackground';
import api, { getImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ElectorDetails {
  ci: string;
  nombre: string;
  apellido: string;
  local_votacion: string;
  mesa: number;
  orden: number;
  distrito: string;
}

interface Assistant {
  id: number;
  ci: string;
  nombre: string;
  apellido: string;
  distrito: string;
  cargo: string;
  telefono: string;
  photo_url?: string;
  timestamp: string;
  registered_by_name?: string;
}

const Attendance: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'register' | 'list'>('register');
  const [ciSearch, setCiSearch] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [elector, setElector] = useState<ElectorDetails | null>(null);
  const [searchError, setSearchError] = useState('');
  
  // Registration Form Modal
  const [showModal, setShowModal] = useState(false);
  const [cargo, setCargo] = useState<'APODERADO' | 'MIEMBRO_DE_MESA'>('MIEMBRO_DE_MESA');
  const [telefono, setTelefono] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorRegister, setErrorRegister] = useState('');

  // Refs for camera upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // List & Bulk Actions
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCis, setSelectedCis] = useState<string[]>([]);
  const [targetRole, setTargetRole] = useState<'MIEMBRO_DE_MESA' | 'APODERADO' | 'VEEDOR' | 'COORDINADOR'>('MIEMBRO_DE_MESA');
  const [loadingBulk, setLoadingBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchAssistants();
    }
  }, [activeTab]);

  const fetchAssistants = async () => {
    setLoadingList(true);
    setListError('');
    try {
      const { data } = await api.get('/attendance/list');
      setAssistants(data);
    } catch (err: any) {
      setListError(err.response?.data?.error || 'Error al obtener la lista de asistentes.');
    } finally {
      setLoadingList(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ciSearch.trim()) return;

    setLoadingSearch(true);
    setSearchError('');
    setElector(null);
    setSuccessMsg('');

    try {
      const cleanCI = ciSearch.replace(/\./g, '').trim();
      const { data } = await api.get(`/attendance/search/${cleanCI}`);
      setElector(data);
      setTelefono('');
      setPhotoUrl('');
    } catch (err: any) {
      setSearchError(err.response?.data?.error || 'Cédula no encontrada en el padrón de su distrito.');
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleOpenRegister = () => {
    if (!elector) return;
    setErrorRegister('');
    setCargo('MIEMBRO_DE_MESA');
    setTelefono('');
    setPhotoUrl('');
    setShowModal(true);
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setErrorRegister('');
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const { data } = await api.post('/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPhotoUrl(data.photo_url);
    } catch (err: any) {
      setErrorRegister('Error al subir la foto del asistente.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRegisterAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!elector) return;
    if (!telefono.trim()) {
      setErrorRegister('El teléfono es obligatorio.');
      return;
    }

    setLoadingRegister(true);
    setErrorRegister('');

    try {
      await api.post('/attendance/register', {
        ci: elector.ci,
        nombre: elector.nombre,
        apellido: elector.apellido,
        distrito: elector.distrito,
        cargo,
        telefono,
        photo_url: photoUrl
      });

      setSuccessMsg(`¡Presencia confirmada con éxito para ${elector.nombre} ${elector.apellido}!`);
      setElector(null);
      setCiSearch('');
      setShowModal(false);
      
      // Auto-hide success after 5 seconds
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorRegister(err.response?.data?.error || 'Error al registrar la asistencia.');
    } finally {
      setLoadingRegister(false);
    }
  };

  const handleSelectAssistant = (ci: string) => {
    setSelectedCis(prev => 
      prev.includes(ci) ? prev.filter(c => c !== ci) : [...prev, ci]
    );
  };

  const handleSelectAll = (filteredList: Assistant[]) => {
    const filteredCis = filteredList.map(a => a.ci);
    const allSelected = filteredCis.every(ci => selectedCis.includes(ci));
    
    if (allSelected) {
      setSelectedCis(prev => prev.filter(ci => !filteredCis.includes(ci)));
    } else {
      setSelectedCis(prev => Array.from(new Set([...prev, ...filteredCis])));
    }
  };

  const handleBulkAssign = async () => {
    if (selectedCis.length === 0) return;
    setLoadingBulk(true);
    setBulkResult(null);

    try {
      const { data } = await api.post('/attendance/assign-massively', {
        cis: selectedCis,
        role: targetRole
      });
      setBulkResult(data);
      setSelectedCis([]);
      fetchAssistants(); // Refresh table
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error en la asignación masiva.');
    } finally {
      setLoadingBulk(false);
    }
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const rowsHtml = filteredAssistants.map(a => `
      <tr>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          <img src="${a.photo_url ? getImageUrl(a.photo_url) : 'https://i.pravatar.cc/100?u=' + a.ci}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0;" />
        </td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${a.nombre} ${a.apellido || ''}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; color: #475569; font-family: monospace; font-size: 14px;">${parseInt(a.ci).toLocaleString('es-PY')}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; color: #2563eb;">${a.telefono}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; color: #475569;">${a.distrito}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0;">
          <span style="background: ${a.cargo === 'APODERADO' ? '#fee2e2' : '#dbeafe'}; color: ${a.cargo === 'APODERADO' ? '#991b1b' : '#1e40af'}; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; border: 1px solid ${a.cargo === 'APODERADO' ? '#fca5a5' : '#bfdbfe'};">
            ${a.cargo}
          </span>
        </td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
          ${new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Reporte Premium de Asistentes</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; color: #334155; margin: 40px; }
            .report-card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); padding: 30px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #1A5FB4; padding-bottom: 20px; margin-bottom: 25px; }
            .title { font-size: 26px; font-weight: 850; color: #1e3a8a; letter-spacing: -0.02em; }
            .meta { font-size: 13px; color: #64748b; text-align: right; line-height: 1.4; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #1e3a8a; color: white; padding: 12px 10px; text-align: left; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
            tr:nth-child(even) { background-color: #f8fafc; }
          </style>
        </head>
        <body>
          <div class="report-card">
            <div class="header">
              <div>
                <div class="title">INTELECCIONES</div>
                <div style="font-size: 15px; color: #059669; font-weight: 700; margin-top: 4px;">Reporte Premium de Asistencia - Día D</div>
              </div>
              <div class="meta">
                <div><strong>Generado por:</strong> ${user?.nombre || 'Superusuario'}</div>
                <div><strong>Fecha:</strong> ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div><strong>Distrito:</strong> ${user?.distrito || 'Global'}</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 70px; text-align: center;">Avatar</th>
                  <th>Nombre</th>
                  <th>Cédula</th>
                  <th>Teléfono</th>
                  <th>Distrito</th>
                  <th>Cargo</th>
                  <th>Presencia</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 800);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredAssistants = assistants.filter(a => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${a.nombre} ${a.apellido || ''}`.toLowerCase();
    return fullName.includes(searchLower) || a.ci.includes(searchLower) || a.telefono.includes(searchLower);
  });

  return (
    <div style={{ minHeight: '100vh', color: 'white', position: 'relative', overflowX: 'hidden', paddingBottom: '4rem' }}>
      <PLRABackground />

      {/* Header Panel */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <Logo size="default" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>{user?.nombre}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Distrito: <span style={{ color: 'var(--green)', fontWeight: 800 }}>{user?.distrito || 'SUPERUSUARIO'}</span>
            </p>
          </div>
          <a href="/" style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '0.5rem 1rem',
            borderRadius: '10px',
            fontSize: '0.8rem',
            fontWeight: 700,
            textDecoration: 'none',
            color: 'white',
            transition: 'all 0.2s'
          }}>
            Panel Principal
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1rem' }}>
        
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{ 
            fontFamily: 'var(--font-display, "Space Grotesk", sans-serif)', 
            fontSize: '2rem', 
            fontWeight: 800, 
            letterSpacing: '-0.02em', 
            margin: '0 0 0.5rem' 
          }}>
            <span style={{ color: 'var(--plra-400)' }}>Asistencia</span> Día D
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: '0.95rem' }}>
            Registro de miembros de mesa y apoderados designados.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          background: 'rgba(15, 23, 42, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '14px',
          padding: '0.3rem',
          marginBottom: '2rem'
        }}>
          <button 
            onClick={() => setActiveTab('register')}
            style={{
              flex: 1,
              background: activeTab === 'register' ? 'var(--plra-600)' : 'transparent',
              border: 'none',
              padding: '0.8rem',
              borderRadius: '10px',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Registrar Presencia
          </button>
          <button 
            onClick={() => setActiveTab('list')}
            style={{
              flex: 1,
              background: activeTab === 'list' ? 'var(--plra-600)' : 'transparent',
              border: 'none',
              padding: '0.8rem',
              borderRadius: '10px',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Asistentes Registrados
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'register' ? (
            <motion.div
              key="register-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              {successMsg && (
                <div style={{
                  background: 'rgba(34, 196, 126, 0.15)',
                  border: '1px solid rgba(34, 196, 126, 0.3)',
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  color: '#86EFAC',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>✓</span> {successMsg}
                </div>
              )}

              {/* CI Search Input Form */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
              }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700 }}>Buscar por Número de Cédula</h3>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    type="text"
                    placeholder="Ej: 4.123.456"
                    value={ciSearch}
                    onChange={(e) => setCiSearch(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '0.8rem 1rem',
                      color: 'white',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'border 0.2s'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={loadingSearch || !ciSearch.trim()}
                    style={{
                      background: 'var(--plra-500)',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '0.8rem 1.5rem',
                      color: 'white',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'opacity 0.2s'
                    }}
                  >
                    {loadingSearch ? 'Buscando...' : 'Consultar'}
                  </button>
                </form>

                {searchError && (
                  <p style={{ color: '#FCA5A5', fontSize: '0.85rem', marginTop: '1rem', margin: 0 }}>
                    ⚠ {searchError}
                  </p>
                )}
              </div>

              {/* Elector Data Card Display */}
              <AnimatePresence>
                {elector && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    style={{
                      marginTop: '2rem',
                      background: 'linear-gradient(135deg, rgba(30, 58, 110, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)',
                      border: '1px solid rgba(46, 132, 240, 0.25)',
                      borderRadius: '20px',
                      padding: '2rem',
                      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <span style={{
                          background: 'rgba(34, 197, 94, 0.1)',
                          border: '1px solid rgba(34, 197, 94, 0.2)',
                          color: '#4ADE80',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          letterSpacing: '0.05em'
                        }}>
                          CI ENCONTRADO
                        </span>
                        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.5rem 0 0.2rem' }}>
                          {elector.nombre} {elector.apellido}
                        </h2>
                        <p style={{ color: 'var(--text-3)', margin: 0, fontSize: '0.9rem' }}>
                          Cédula de Identidad: <strong style={{ color: 'white' }}>{parseInt(elector.ci).toLocaleString('es-PY')}</strong>
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', margin: 0 }}>Distrito</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--green)', margin: 0 }}>{elector.distrito}</p>
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '1rem',
                      background: 'rgba(0,0,0,0.2)',
                      padding: '1.25rem',
                      borderRadius: '12px',
                      marginBottom: '1.5rem'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Local de Votación</span>
                        <p style={{ margin: '0.2rem 0 0', fontWeight: 700, fontSize: '0.95rem' }}>{elector.local_votacion}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Mesa</span>
                        <p style={{ margin: '0.2rem 0 0', fontWeight: 700, fontSize: '0.95rem' }}>{elector.mesa}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Orden</span>
                        <p style={{ margin: '0.2rem 0 0', fontWeight: 700, fontSize: '0.95rem' }}>{elector.orden}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={handleOpenRegister}
                        style={{
                          background: 'linear-gradient(90deg, #2E84F0 0%, #1A5FB4 100%)',
                          border: 'none',
                          padding: '0.8rem 2rem',
                          borderRadius: '12px',
                          color: 'white',
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(46, 132, 240, 0.4)',
                          transition: 'all 0.2s'
                        }}
                      >
                        Confirmar Presencia
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="list-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              {/* Search list and filters */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Buscar en la lista por nombre, C.I. o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '250px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '0.6rem 1rem',
                    color: 'white',
                    outline: 'none'
                  }}
                />
                
                <button
                  onClick={handlePrintReport}
                  disabled={filteredAssistants.length === 0}
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.65rem 1.25rem',
                    color: 'white',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(4, 120, 87, 0.3)',
                    transition: 'all 0.2s'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                  Reporte Premium
                </button>
              </div>

              {bulkResult && (
                <div style={{
                  background: 'rgba(46, 132, 240, 0.15)',
                  border: '1px solid rgba(46, 132, 240, 0.3)',
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  color: '#93C5FD'
                }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', fontWeight: 800 }}>Resultados de la Asignación Masiva:</h4>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                    <li>Usuarios creados: <strong>{bulkResult.created}</strong></li>
                    <li>Usuarios omitidos (ya existían): <strong>{bulkResult.skipped}</strong></li>
                    {bulkResult.errors.length > 0 && (
                      <li style={{ color: '#FCA5A5', marginTop: '0.3rem' }}>
                        Errores: {bulkResult.errors.join(', ')}
                      </li>
                    )}
                  </ul>
                  <button 
                    onClick={() => setBulkResult(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'white',
                      textDecoration: 'underline',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      marginTop: '0.5rem',
                      padding: 0
                    }}
                  >
                    Cerrar aviso
                  </button>
                </div>
              )}

              {/* Table Container */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                overflowX: 'auto',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
              }}>
                {loadingList ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem', width: '30px', height: '30px' }} />
                    Cargando asistentes...
                  </div>
                ) : listError ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#FCA5A5' }}>
                    {listError}
                  </div>
                ) : filteredAssistants.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)' }}>
                    No se encontraron asistentes registrados.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(255,255,255,0.02)' }}>
                        {user?.role === 'SUPERUSUARIO' && (
                          <th style={{ padding: '1rem', width: '40px', textAlign: 'center' }}>
                            <input 
                              type="checkbox"
                              checked={filteredAssistants.length > 0 && filteredAssistants.every(a => selectedCis.includes(a.ci))}
                              onChange={() => handleSelectAll(filteredAssistants)}
                              style={{ cursor: 'pointer' }}
                            />
                          </th>
                        )}
                        <th style={{ padding: '1rem', width: '50px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-3)' }}>Foto</th>
                        <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-3)' }}>Nombre</th>
                        <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-3)' }}>Cédula</th>
                        <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-3)' }}>Teléfono</th>
                        <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-3)' }}>Distrito</th>
                        <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-3)' }}>Cargo</th>
                        <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-3)' }}>Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssistants.map((assistant) => (
                        <tr 
                          key={assistant.id}
                          style={{ 
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            background: selectedCis.includes(assistant.ci) ? 'rgba(46, 132, 240, 0.08)' : 'transparent',
                            transition: 'background 0.2s'
                          }}
                        >
                          {user?.role === 'SUPERUSUARIO' && (
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                              <input 
                                type="checkbox"
                                checked={selectedCis.includes(assistant.ci)}
                                onChange={() => handleSelectAssistant(assistant.ci)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                          )}
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <img 
                              src={assistant.photo_url ? getImageUrl(assistant.photo_url) || '' : `https://i.pravatar.cc/100?u=${assistant.ci}`}
                              alt={assistant.nombre}
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '2px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                              }}
                            />
                          </td>
                          <td style={{ padding: '1rem', fontWeight: 600 }}>
                            {assistant.nombre} {assistant.apellido}
                          </td>
                          <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{parseInt(assistant.ci).toLocaleString('es-PY')}</td>
                          <td style={{ padding: '1rem', color: '#60A5FA' }}>{assistant.telefono}</td>
                          <td style={{ padding: '1rem' }}>{assistant.distrito}</td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{
                              background: assistant.cargo === 'APODERADO' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: assistant.cargo === 'APODERADO' ? '#FCA5A5' : '#93C5FD',
                              border: `1px solid ${assistant.cargo === 'APODERADO' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                              padding: '0.2rem 0.6rem',
                              borderRadius: '20px',
                              fontSize: '0.75rem',
                              fontWeight: 700
                            }}>
                              {assistant.cargo}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-3)' }}>
                            {new Date(assistant.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Confirmation Modal */}
      {showModal && elector && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              background: 'rgba(30, 41, 59, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '460px',
              padding: '2rem',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              position: 'relative'
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 800 }}>Confirmar Asistencia</h3>
            <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Define el cargo asignado, número de contacto y foto del asistente.
            </p>

            <form onSubmit={handleRegisterAttendance}>
              {/* Photo Capture Section */}
              <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', display: 'block', marginBottom: '0.5rem', textAlign: 'left' }}>
                  Foto del Asistente
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  {photoUrl ? (
                    <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                      <img 
                        src={getImageUrl(photoUrl) || ''} 
                        alt="Previsualización" 
                        style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--green)' }}
                      />
                      <button 
                        type="button"
                        onClick={() => setPhotoUrl('')}
                        style={{
                          position: 'absolute', top: 0, right: 0,
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: '#EF4444', border: 'none', color: 'white',
                          fontWeight: 'bold', fontSize: '12px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        width: '90px', height: '90px', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.05)', border: '2px dashed rgba(255,255,255,0.2)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', hover: { border: '2px dashed var(--green)' }, transition: 'all 0.2s'
                      }}
                    >
                      {uploadingPhoto ? (
                        <div className="spinner" style={{ width: '20px', height: '20px' }} />
                      ) : (
                        <>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                          </svg>
                          <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px', fontWeight: 700 }}>CAMARA</span>
                        </>
                      )}
                    </div>
                  )}

                  <input 
                    type="file"
                    accept="image/*"
                    capture="user"
                    ref={fileInputRef}
                    onChange={handlePhotoCapture}
                    style={{ display: 'none' }}
                  />
                  
                  {!photoUrl && (
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '0.4rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        color: 'white',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Tomar con Cámara Frontal
                    </button>
                  )}
                </div>
              </div>

              {/* Cargo pills */}
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', display: 'block', marginBottom: '0.5rem' }}>Rol / Cargo asignado</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setCargo('MIEMBRO_DE_MESA')}
                    style={{
                      flex: 1,
                      background: cargo === 'MIEMBRO_DE_MESA' ? 'var(--plra-500)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${cargo === 'MIEMBRO_DE_MESA' ? 'var(--plra-400)' : 'rgba(255,255,255,0.1)'}`,
                      padding: '0.6rem',
                      borderRadius: '10px',
                      color: 'white',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Miembro de Mesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setCargo('APODERADO')}
                    style={{
                      flex: 1,
                      background: cargo === 'APODERADO' ? 'var(--plra-500)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${cargo === 'APODERADO' ? 'var(--plra-400)' : 'rgba(255,255,255,0.1)'}`,
                      padding: '0.6rem',
                      borderRadius: '10px',
                      color: 'white',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Apoderado
                  </button>
                </div>
              </div>

              {/* Phone number */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-3)', display: 'block', marginBottom: '0.5rem' }}>
                  Teléfono (Formato WhatsApp)
                </label>
                <input
                  type="tel"
                  placeholder="Ej: 0981123456"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '0.7rem 1rem',
                    color: 'white',
                    fontSize: '1rem',
                    outline: 'none'
                  }}
                />
              </div>

              {errorRegister && (
                <p style={{ color: '#FCA5A5', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                  ⚠ {errorRegister}
                </p>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '0.7rem 1.5rem',
                    borderRadius: '10px',
                    color: 'var(--text-3)',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingRegister || uploadingPhoto}
                  style={{
                    background: 'var(--green)',
                    border: 'none',
                    padding: '0.7rem 1.5rem',
                    borderRadius: '10px',
                    color: 'var(--plra-950)',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'opacity 0.2s'
                  }}
                >
                  {loadingRegister ? 'Registrando...' : 'Confirmar Presencia'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Floating Superuser Action Bar */}
      {user?.role === 'SUPERUSUARIO' && selectedCis.length > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(46, 132, 240, 0.3)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            padding: '1rem 2rem',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            zIndex: 900,
            maxWidth: '90%',
            width: 'fit-content'
          }}
        >
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
            {selectedCis.length} asistente{selectedCis.length > 1 ? 's' : ''} seleccionado{selectedCis.length > 1 ? 's' : ''}
          </span>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Asignar Rol:</span>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as any)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                padding: '0.35rem 0.75rem',
                color: 'white',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="MIEMBRO_DE_MESA" style={{ background: '#1e293b' }}>Miembro de Mesa</option>
              <option value="APODERADO" style={{ background: '#1e293b' }}>Apoderado</option>
              <option value="VEEDOR" style={{ background: '#1e293b' }}>Veedor</option>
              <option value="COORDINADOR" style={{ background: '#1e293b' }}>Coordinador</option>
            </select>
          </div>

          <button
            onClick={handleBulkAssign}
            disabled={loadingBulk}
            style={{
              background: 'linear-gradient(90deg, #2E84F0 0%, #1A5FB4 100%)',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '10px',
              color: 'white',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(46, 132, 240, 0.3)',
              transition: 'opacity 0.2s'
            }}
          >
            {loadingBulk ? 'Asignando...' : 'Asignar Masivamente'}
          </button>

          <button
            onClick={() => setSelectedCis([])}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-3)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              padding: 0
            }}
          >
            Deseleccionar
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default Attendance;
