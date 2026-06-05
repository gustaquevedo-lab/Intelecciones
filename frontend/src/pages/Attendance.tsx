import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '../components/Logo';
import { PLRABackground } from '../components/PLRABackground';
import api, { getImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ImageCropperModal } from '../components/ImageCropperModal';

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
  attended?: number;
}

const Attendance: React.FC = () => {
  const { user } = useAuth();

  if (!user || !['SUPERUSUARIO', 'JEFE_CAMPANA', 'PADRINO'].includes(user.role)) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--plra-900)',
        color: 'white',
        fontFamily: 'sans-serif',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FCA5A5', marginBottom: '1rem' }}>Acceso Restringido</h2>
        <p style={{ fontSize: '1rem', opacity: 0.8, maxWidth: '500px', lineHeight: 1.5 }}>
          Solo Superusuario, Jefe de Campaña y Padrinos acceden a este módulo.
        </p>
        <a href="/" style={{
          marginTop: '1.5rem',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '0.6rem 1.2rem',
          borderRadius: '10px',
          color: 'white',
          textDecoration: 'none',
          fontWeight: 700
        }}>
          Volver al Inicio
        </a>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'register' | 'register_absent' | 'list'>('register');
  const [filterPresence, setFilterPresence] = useState<'all' | 'present' | 'absent'>('all');
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

  // Validation feedback state
  const [validationTried, setValidationTried] = useState(false);

  // Image Cropper State
  const [cropperImage, setCropperImage] = useState<string | null>(null);

  // Editing Assistant
  const [editingAssistant, setEditingAssistant] = useState<Assistant | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Refs for camera upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

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
    fetchAssistants();
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

  // Live formatter for phone inputs
  const formatPhone = (val: string): string => {
    // Keep only numbers and '+' sign
    let digits = val.replace(/[^\d+]/g, '');
    
    // Normalize to digits only to analyze zero prefixing
    let plain = digits.replace(/\+/g, '');

    // Check if it starts with 595
    if (plain.startsWith('595')) {
      let suffix = plain.substring(3);
      if (suffix.startsWith('0')) {
        suffix = suffix.substring(1);
      }
      return '+595' + suffix;
    }

    // Check if it starts with 0
    if (plain.startsWith('0')) {
      plain = plain.substring(1);
    }

    // Prefix with +595
    return '+595' + plain;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefono(formatPhone(e.target.value));
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
      setValidationTried(false);
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
    setTelefono('+595');
    setPhotoUrl('');
    setValidationTried(false);
    setShowModal(true);
  };

  const handleOpenEdit = (assistant: Assistant) => {
    setErrorRegister('');
    setEditingAssistant(assistant);
    setCargo(assistant.cargo as any);
    setTelefono(assistant.telefono);
    setPhotoUrl(assistant.photo_url || '');
    setValidationTried(false);
    setShowEditModal(true);
  };

  // Close warning helpers
  const getMissingFields = (isAbsent = activeTab === 'register_absent') => {
    const missing = [];
    if (!photoUrl && !isAbsent) missing.push('Foto');
    const digitsOnly = telefono.replace(/\D/g, '');
    // Minimum digits for a phone suffix after 595 (should be at least 6 digits, e.g. 595981123456)
    if (!telefono.trim() || telefono === '+595' || digitsOnly.length <= 5) {
      missing.push('Teléfono');
    }
    return missing;
  };

  const handleCloseRegisterModal = () => {
    const missing = getMissingFields();
    if (missing.length > 0) {
      setValidationTried(true);
      const confirmClose = window.confirm(
        `Atención: Para guardar la asistencia es obligatorio completar todos los campos.\n\nDatos faltantes: ${missing.join(', ')}.\n\n¿Está seguro de que desea cerrar y descartar los cambios?`
      );
      if (!confirmClose) return;
    }
    setShowModal(false);
    setValidationTried(false);
  };

  const handleCloseEditModal = () => {
    const missing = getMissingFields(editingAssistant?.attended === 0);
    if (missing.length > 0) {
      setValidationTried(true);
      const confirmClose = window.confirm(
        `Atención: Para guardar los cambios es obligatorio completar todos los campos.\n\nDatos faltantes: ${missing.join(', ')}.\n\n¿Está seguro de que desea cerrar y descartar los cambios?`
      );
      if (!confirmClose) return;
    }
    setShowEditModal(false);
    setEditingAssistant(null);
    setValidationTried(false);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setCropperImage(reader.result as string);
      e.target.value = ''; // Reset input to allow selecting the same file
    };
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropperImage(null);
    setUploadingPhoto(true);
    setErrorRegister('');

    const formData = new FormData();
    formData.append('photo', croppedBlob, 'assistant_photo.jpg');

    try {
      const { data } = await api.post('/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPhotoUrl(data.photo_url);
    } catch (err: any) {
      setErrorRegister('Error al subir la foto recortada.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRegisterAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!elector) return;
    setValidationTried(true);

    const missing = getMissingFields();
    if (missing.length > 0) {
      setErrorRegister(`Todos los campos son obligatorios. Falta completar: ${missing.join(', ')}.`);
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
        photo_url: photoUrl,
        attended: activeTab === 'register_absent' ? 0 : 1
      });

      setSuccessMsg(`¡Presencia confirmada con éxito para ${elector.nombre} ${elector.apellido}!`);
      setElector(null);
      setCiSearch('');
      setShowModal(false);
      setValidationTried(false);
      fetchAssistants();
      
      // Auto-hide success after 5 seconds
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorRegister(err.response?.data?.error || 'Error al registrar la asistencia.');
    } finally {
      setLoadingRegister(false);
    }
  };

  const handleUpdateAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssistant) return;
    setValidationTried(true);

    const missing = getMissingFields();
    if (missing.length > 0) {
      setErrorRegister(`Todos los campos son obligatorios. Falta completar: ${missing.join(', ')}.`);
      return;
    }

    setLoadingRegister(true);
    setErrorRegister('');

    try {
      await api.put(`/attendance/${editingAssistant.id}`, {
        cargo,
        telefono,
        photo_url: photoUrl
      });

      setSuccessMsg(`¡Asistente ${editingAssistant.nombre} actualizado con éxito!`);
      setEditingAssistant(null);
      setShowEditModal(false);
      setValidationTried(false);
      fetchAssistants();

      // Auto-hide success after 5 seconds
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorRegister(err.response?.data?.error || 'Error al actualizar los datos.');
    } finally {
      setLoadingRegister(false);
    }
  };

  const handleDeleteAssistant = async (id: number, nombre: string) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar el registro de presencia de ${nombre}?`)) {
      return;
    }

    try {
      await api.delete(`/attendance/${id}`);
      setSuccessMsg(`Asistente eliminado con éxito del historial.`);
      fetchAssistants();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar el registro.');
    }
  };

  const handleWipeData = async () => {
    const confirmWipe = window.confirm(
      '⚠️ ATENCIÓN MÁXIMA ⚠️\n\n¿Está absolutamente seguro de que desea borrar TODOS los registros de asistencia registrados?\nEsta acción no se puede deshacer.'
    );
    if (!confirmWipe) return;

    const doubleConfirm = window.confirm(
      '¿Confirmar eliminación masiva? Se borrarán de forma definitiva todas las presencias de todas las listas.'
    );
    if (!doubleConfirm) return;

    try {
      const { data } = await api.post('/attendance/wipe');
      setSuccessMsg(data.message || 'Todos los datos de asistencia han sido eliminados.');
      fetchAssistants();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al realizar el vaciado de datos.');
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
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          <img src="${a.photo_url ? getImageUrl(a.photo_url) : 'https://i.pravatar.cc/100?u=' + a.ci}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1.5px solid #cbd5e1;" />
        </td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b; font-size: 11px;">${a.nombre} ${a.apellido || ''}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #475569; font-family: monospace; font-size: 11px;">${parseInt(a.ci).toLocaleString('es-PY')}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #2563eb; font-size: 11px;">${a.telefono}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 11px;">${a.distrito}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          <span style="background: ${a.cargo === 'APODERADO' ? '#fee2e2' : '#dbeafe'}; color: ${a.cargo === 'APODERADO' ? '#991b1b' : '#1e40af'}; padding: 2px 6px; border-radius: 12px; font-size: 9px; font-weight: 700; border: 1px solid ${a.cargo === 'APODERADO' ? '#fca5a5' : '#bfdbfe'}; display: inline-block;">
            ${a.cargo.replace(/_/g, ' ')}
          </span>
        </td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          <span style="background: ${(a.attended === undefined || a.attended === null || a.attended === 1) ? '#d1fae5' : '#dbeafe'}; color: ${(a.attended === undefined || a.attended === null || a.attended === 1) ? '#065f46' : '#1e40af'}; padding: 2px 6px; border-radius: 12px; font-size: 9px; font-weight: 700; border: 1px solid ${(a.attended === undefined || a.attended === null || a.attended === 1) ? '#a7f3d0' : '#bfdbfe'}; display: inline-block;">
            ${(a.attended === undefined || a.attended === null || a.attended === 1) ? 'Asistente' : 'Miembro de Mesa'}
          </span>
        </td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 11px;">
          ${new Date(a.timestamp).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Asuncion' })}
        </td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Reporte Premium de Asistentes</title>
          <style>
            @page {
              size: A4;
              margin: 12mm 10mm;
            }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              background: #ffffff; 
              color: #1e293b; 
              margin: 0; 
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .report-card { 
              background: white; 
              padding: 0; 
            }
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              border-bottom: 3px solid #1e3a8a; 
              padding-bottom: 10px; 
              margin-bottom: 15px; 
            }
            .title { 
              font-size: 20px; 
              font-weight: 800; 
              color: #1e3a8a; 
              letter-spacing: -0.02em; 
            }
            .meta { 
              font-size: 11px; 
              color: #64748b; 
              text-align: right; 
              line-height: 1.3; 
            }
            .summary-box {
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              margin-bottom: 15px; 
              background: #eff6ff; 
              padding: 8px 12px; 
              border-radius: 8px; 
              border: 1px solid #bfdbfe; 
              font-family: sans-serif;
              font-size: 12px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 10px; 
            }
            th { 
              background: #1e3a8a !important; 
              color: white !important; 
              padding: 8px 6px; 
              text-align: left; 
              font-size: 11px; 
              text-transform: uppercase; 
              letter-spacing: 0.05em; 
            }
            tr {
              page-break-inside: avoid;
            }
            tr:nth-child(even) { 
              background-color: #f8fafc !important; 
            }
          </style>
        </head>
        <body>
          <div class="report-card">
            <div class="header">
              <div>
                <div class="title">INTELECCIONES</div>
                <div style="font-size: 12px; color: #059669; font-weight: 700; margin-top: 2px;">Reporte Premium de Asistencia - Día D</div>
              </div>
              <div class="meta">
                <div><strong>Generado por:</strong> ${user?.nombre || 'Superusuario'}</div>
                <div><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-PY', { timeZone: 'America/Asuncion' })} a las ${new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Asuncion' })}</div>
                <div><strong>Distrito:</strong> ${user?.distrito || 'Global'}</div>
              </div>
            </div>
            <div class="summary-box">
              <span style="color: #1e3a8a; font-weight: 700;">Resumen de la Reunión General:</span>
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 4px;">
                <span style="background: #1e3a8a; color: white; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700;">
                  Total: ${filteredAssistants.length}
                </span>
                <span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700;">
                  Asistentes: ${filteredAssistants.filter(a => a.attended === undefined || a.attended === null || a.attended === 1).length}
                </span>
                <span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700;">
                  Miembros de Mesa: ${filteredAssistants.filter(a => a.attended === 0).length}
                </span>
                ${filteredAssistants.filter(a => a.cargo === 'MIEMBRO_DE_MESA').length > 0 ? `
                <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; border: 1px solid #bfdbfe;">
                  Mesa: ${filteredAssistants.filter(a => a.cargo === 'MIEMBRO_DE_MESA').length}
                </span>` : ''}
                ${filteredAssistants.filter(a => a.cargo === 'APODERADO').length > 0 ? `
                <span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; border: 1px solid #fca5a5;">
                  Apoderados: ${filteredAssistants.filter(a => a.cargo === 'APODERADO').length}
                </span>` : ''}
                ${filteredAssistants.filter(a => a.cargo === 'VEEDOR').length > 0 ? `
                <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; border: 1px solid #fde68a;">
                  Veedores: ${filteredAssistants.filter(a => a.cargo === 'VEEDOR').length}
                </span>` : ''}
                ${filteredAssistants.filter(a => a.cargo === 'COORDINADOR').length > 0 ? `
                <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; border: 1px solid #bae6fd;">
                  Coordinadores: ${filteredAssistants.filter(a => a.cargo === 'COORDINADOR').length}
                </span>` : ''}
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 50px; text-align: center;">Avatar</th>
                  <th>Nombre</th>
                  <th style="width: 90px;">Cédula</th>
                  <th style="width: 110px;">Teléfono</th>
                  <th>Distrito</th>
                  <th style="width: 110px; text-align: center;">Cargo</th>
                  <th style="width: 80px; text-align: center;">Estado</th>
                  <th style="width: 80px;">Presencia</th>
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
    const matchesSearch = fullName.includes(searchLower) || a.ci.includes(searchLower) || a.telefono.includes(searchLower);
    if (!matchesSearch) return false;

    const isPresent = a.attended === undefined || a.attended === null || a.attended === 1;
    if (filterPresence === 'present') return isPresent;
    if (filterPresence === 'absent') return !isPresent;
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', color: 'var(--text)', position: 'relative', overflowX: 'hidden', paddingBottom: '4rem' }}>
      <PLRABackground />

      {/* Header Panel */}
      <header style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
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
            <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>{user?.nombre}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Distrito: <span style={{ color: 'var(--green)', fontWeight: 800 }}>{user?.distrito || 'SUPERUSUARIO'}</span>
            </p>
          </div>
          <a href="/" style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--border-mid)',
            padding: '0.5rem 1rem',
            borderRadius: '10px',
            fontSize: '0.8rem',
            fontWeight: 700,
            textDecoration: 'none',
            color: 'var(--text)',
            transition: 'all 0.2s'
          }}>
            Panel Principal
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1100px', margin: '2rem auto', padding: '0 1rem' }}>
        
        {/* Title */}
        <div className="attendance-title-container" style={{
          padding: window.innerWidth < 768 ? '1.5rem 1rem' : '2.5rem 1.5rem',
        }}>
          <span style={{
            background: 'linear-gradient(90deg, #3B82F6 0%, #10B981 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: window.innerWidth < 768 ? '0.7rem' : '0.85rem',
            fontWeight: 800,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            display: 'block',
            marginBottom: '0.5rem'
          }}>
            Operativo Presencial
          </span>
          <h1 className="attendance-title-h1" style={{ fontSize: window.innerWidth < 768 ? '1.8rem' : '3rem' }}>
            Reunión General
          </h1>
          <h2 className="attendance-title-h2" style={{ fontSize: window.innerWidth < 768 ? '1.1rem' : '1.75rem' }}>
            Preparativos Día D — Miembros de Mesa
          </h2>
          <div style={{
            width: '60px',
            height: '3px',
            background: 'linear-gradient(90deg, #3B82F6, #10B981)',
            borderRadius: '2px',
            margin: '1rem auto 0'
          }} />
        </div>

        {/* Counter of Assistants */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '2rem',
          flexWrap: 'wrap'
        }}>
          {/* Total card */}
          <div className="card-premium-styled" style={{
            padding: '0.8rem 1.5rem',
            textAlign: 'center',
            minWidth: '130px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
            border: '1px solid var(--border-mid)',
            borderRadius: '14px',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>
              Registrados
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text)', margin: 0, padding: 0, lineHeight: 1 }}>
              {assistants.length}
            </div>
          </div>

          {/* Present card */}
          <div className="card-premium-styled" style={{
            padding: '0.8rem 1.5rem',
            textAlign: 'center',
            minWidth: '130px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '14px',
            boxShadow: '0 8px 32px 0 rgba(16, 185, 129, 0.07)',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>
              Asistentes
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--green)', margin: 0, padding: 0, lineHeight: 1 }}>
              {assistants.filter(a => a.attended === undefined || a.attended === null || a.attended === 1).length}
            </div>
          </div>

          {/* Miembros de Mesa card */}
          <div className="card-premium-styled" style={{
            padding: '0.8rem 1.5rem',
            textAlign: 'center',
            minWidth: '130px',
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '14px',
            boxShadow: '0 8px 32px 0 rgba(59, 130, 246, 0.07)',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>
              Miembros (Sin Foto)
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#3b82f6', margin: 0, padding: 0, lineHeight: 1 }}>
              {assistants.filter(a => a.attended === 0).length}
            </div>
          </div>

          {/* Breakdown cards */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '0.5rem 0.8rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '85px'
            }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 600 }}>Miembros</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#3B82F6' }}>
                {assistants.filter(a => a.cargo === 'MIEMBRO_DE_MESA').length}
              </span>
            </div>

            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '0.5rem 0.8rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '85px'
            }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 600 }}>Apoderados</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#EF4444' }}>
                {assistants.filter(a => a.cargo === 'APODERADO').length}
              </span>
            </div>

            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '0.5rem 0.8rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '85px'
            }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 600 }}>Veedores</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F59E0B' }}>
                {assistants.filter(a => a.cargo === 'VEEDOR').length}
              </span>
            </div>

            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '0.5rem 0.8rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '85px'
            }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 600 }}>Coordinadores</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10B981' }}>
                {assistants.filter(a => a.cargo === 'COORDINADOR').length}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="attendance-tab-switcher" style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface-light)', padding: '0.4rem', borderRadius: '14px', marginBottom: '2rem' }}>
          <button 
            onClick={() => setActiveTab('register')}
            style={{
              flex: 1,
              background: activeTab === 'register' ? 'var(--plra-600)' : 'transparent',
              border: 'none',
              padding: '0.75rem',
              borderRadius: '10px',
              color: activeTab === 'register' ? 'white' : 'var(--text-3)',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Registrar Presencia
          </button>
          <button 
            onClick={() => {
              setActiveTab('register_absent');
              setElector(null);
              setCiSearch('');
            }}
            style={{
              flex: 1,
              background: activeTab === 'register_absent' ? 'var(--plra-600)' : 'transparent',
              border: 'none',
              padding: '0.75rem',
              borderRadius: '10px',
              color: activeTab === 'register_absent' ? 'white' : 'var(--text-3)',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Miembros de Mesa
          </button>
          <button 
            onClick={() => setActiveTab('list')}
            style={{
              flex: 1,
              background: activeTab === 'list' ? 'var(--plra-600)' : 'transparent',
              border: 'none',
              padding: '0.75rem',
              borderRadius: '10px',
              color: activeTab === 'list' ? 'white' : 'var(--text-3)',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Historial Registrado
          </button>
        </div>

        <AnimatePresence mode="wait">
          {(activeTab === 'register' || activeTab === 'register_absent') ? (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              {successMsg && (
                <div className="attendance-alert-success" style={{
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
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
              <div className="attendance-card">
                <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>
                  {activeTab === 'register' ? 'Registrar Presencia (Con Foto)' : 'Registro de Miembros de Mesa (Sin Foto)'}
                </h3>
                <form onSubmit={handleSearch} className="attendance-search-form">
                  <input
                    type="text"
                    placeholder="Ej: 4.123.456"
                    value={ciSearch}
                    onChange={(e) => setCiSearch(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-mid)',
                      borderRadius: '12px',
                      padding: '0.8rem 1rem',
                      color: 'var(--text)',
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
                  <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginTop: '1rem', margin: 0 }}>
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
                    className="attendance-elector-card"
                  >
                    <div style={{ display: 'flex', justifyStyle: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <span className="attendance-badge-success" style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          letterSpacing: '0.05em'
                        }}>
                          CI ENCONTRADO
                        </span>
                        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.5rem 0 0.2rem', color: 'var(--text)' }}>
                          {elector.nombre} {elector.apellido}
                        </h2>
                        <p style={{ color: 'var(--text-3)', margin: 0, fontSize: '0.9rem' }}>
                          Cédula de Identidad: <strong style={{ color: 'var(--text)' }}>{parseInt(elector.ci).toLocaleString('es-PY')}</strong>
                        </p>
                      </div>
                      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', margin: 0 }}>Distrito</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--green)', margin: 0 }}>{elector.distrito}</p>
                      </div>
                    </div>

                    <div className="attendance-elector-grid">
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Local de Votación</span>
                        <p style={{ margin: '0.2rem 0 0', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{elector.local_votacion}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Mesa</span>
                        <p style={{ margin: '0.2rem 0 0', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{elector.mesa}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Orden</span>
                        <p style={{ margin: '0.2rem 0 0', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{elector.orden}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                    onClick={handleOpenRegister}
                    style={{
                      background: activeTab === 'register' ? 'linear-gradient(90deg, #2E84F0 0%, #1A5FB4 100%)' : 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
                      border: 'none',
                      padding: '0.8rem 2rem',
                      borderRadius: '12px',
                      color: 'white',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: activeTab === 'register' ? '0 4px 14px rgba(46, 132, 240, 0.4)' : '0 4px 14px rgba(16, 185, 129, 0.4)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {activeTab === 'register' ? 'Confirmar Presencia' : 'Confirmar Miembro de Mesa'}
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
              {successMsg && (
                <div className="attendance-alert-success" style={{
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  fontWeight: 600,
                  fontSize: '0.9rem'
                }}>
                  {successMsg}
                </div>
              )}

              {/* Search list and filters */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, display: 'flex', gap: '0.75rem', minWidth: '280px' }}>
                  <input
                    type="text"
                    placeholder="Buscar en la lista por nombre, C.I. o teléfono..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-mid)',
                      borderRadius: '10px',
                      padding: '0.6rem 1rem',
                      color: 'var(--text)',
                      outline: 'none'
                    }}
                  />
                  
                  <select
                    value={filterPresence}
                    onChange={(e) => setFilterPresence(e.target.value as any)}
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-mid)',
                      borderRadius: '10px',
                      padding: '0.6rem 1rem',
                      color: 'var(--text)',
                      outline: 'none',
                      fontWeight: 650,
                      cursor: 'pointer'
                    }}
                  >
                    <option value="all">Filtro: Todos</option>
                    <option value="present">Filtro: Asistentes</option>
                    <option value="absent">Filtro: Miembros de Mesa</option>
                  </select>
                </div>
                
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

                {user?.role === 'SUPERUSUARIO' && (
                  <button
                    onClick={handleWipeData}
                    style={{
                      background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '0.65rem 1.25rem',
                      color: 'white',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    Limpiar Asistencia (Wipe)
                  </button>
                )}
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
                      <li style={{ color: 'var(--red)', marginTop: '0.3rem' }}>
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
              <div className="attendance-table-container">
                {loadingList ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem', width: '30px', height: '30px' }} />
                    Cargando asistentes...
                  </div>
                ) : listError ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--red)' }}>
                    {listError}
                  </div>
                ) : filteredAssistants.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)' }}>
                    No se encontraron asistentes registrados.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-light)' }}>
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
                        <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-3)' }}>Estado</th>
                        <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-3)' }}>Hora</th>
                        <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-3)', textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssistants.map((assistant) => (
                        <tr 
                          key={assistant.id}
                          style={{ 
                            borderBottom: '1px solid var(--border)',
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
                                border: '2px solid var(--border)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                              }}
                            />
                          </td>
                          <td style={{ padding: '1rem', fontWeight: 600 }}>
                            {assistant.nombre} {assistant.apellido}
                          </td>
                          <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{parseInt(assistant.ci).toLocaleString('es-PY')}</td>
                          <td style={{ padding: '1rem', color: 'var(--primary-g)' }}>{assistant.telefono}</td>
                          <td style={{ padding: '1rem' }}>{assistant.distrito}</td>
                          <td style={{ padding: '1rem' }}>
                            <span className={assistant.cargo === 'APODERADO' ? 'attendance-role-apoderado' : 'attendance-role-miembro'}>
                              {assistant.cargo}
                            </span>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <span className={(assistant.attended === undefined || assistant.attended === null || assistant.attended === 1) ? 'attendance-role-miembro' : 'attendance-role-apoderado'} style={{
                              background: (assistant.attended === undefined || assistant.attended === null || assistant.attended === 1) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: (assistant.attended === undefined || assistant.attended === null || assistant.attended === 1) ? 'var(--green)' : '#3b82f6',
                              border: `1px solid ${(assistant.attended === undefined || assistant.attended === null || assistant.attended === 1) ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                              padding: '0.2rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}>
                              {(assistant.attended === undefined || assistant.attended === null || assistant.attended === 1) ? 'Asistente' : 'Miembro de Mesa'}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-3)' }}>
                            {new Date(assistant.timestamp).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Asuncion' })}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                              <button
                                onClick={() => handleOpenEdit(assistant)}
                                style={{
                                  background: 'var(--input-bg)',
                                  border: '1px solid var(--border-mid)',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  color: 'var(--primary-g)',
                                  fontSize: '0.75rem',
                                  fontWeight: 650,
                                  cursor: 'pointer'
                                }}
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteAssistant(assistant.id, `${assistant.nombre} ${assistant.apellido || ''}`)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  color: '#EF4444',
                                  fontSize: '0.75rem',
                                  fontWeight: 650,
                                  cursor: 'pointer'
                                }}
                              >
                                Eliminar
                              </button>
                            </div>
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
            className="attendance-modal-content"
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 800 }}>
              {activeTab === 'register' ? 'Confirmar Presencia' : 'Confirmar Miembro de Mesa'}
            </h3>
            <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              {activeTab === 'register' 
                ? 'Define el cargo asignado, número de contacto y foto del asistente.'
                : 'Define el cargo asignado y número de contacto (la foto es opcional).'}
            </p>

            <form onSubmit={handleRegisterAttendance}>
              {/* Photo Capture Section */}
              <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <span style={{ 
                  fontSize: '0.8rem', 
                  color: (validationTried && !photoUrl && activeTab !== 'register_absent') ? 'var(--red)' : 'var(--text-3)', 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  textAlign: 'left', 
                  fontWeight: (validationTried && !photoUrl && activeTab !== 'register_absent') ? 750 : 'normal' 
                }}>
                  Foto del Asistente {activeTab === 'register_absent' ? '(Opcional)' : '*'} {(validationTried && !photoUrl && activeTab !== 'register_absent') && '(Requerido)'}
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
                        background: 'var(--input-bg)', 
                        border: (validationTried && !photoUrl && activeTab !== 'register_absent') ? '2px dashed #EF4444' : '2px dashed var(--border-mid)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: (validationTried && !photoUrl && activeTab !== 'register_absent') ? '0 0 10px rgba(239, 68, 68, 0.3)' : 'none'
                      }}
                    >
                      {uploadingPhoto ? (
                        <div className="spinner" style={{ width: '20px', height: '20px' }} />
                      ) : (
                        <>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={(validationTried && !photoUrl && activeTab !== 'register_absent') ? '#EF4444' : 'var(--text-3)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                          </svg>
                          <span style={{ fontSize: '0.62rem', color: (validationTried && !photoUrl && activeTab !== 'register_absent') ? '#EF4444' : 'var(--text-3)', marginTop: '4px', fontWeight: 700 }}>CAMARA</span>
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
                        background: 'var(--input-bg)',
                        border: (validationTried && !photoUrl && activeTab !== 'register_absent') ? '1px solid #EF4444' : '1px solid var(--border-mid)',
                        padding: '0.4rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        color: (validationTried && !photoUrl && activeTab !== 'register_absent') ? '#EF4444' : 'var(--text)',
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
                <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', display: 'block', marginBottom: '0.5rem' }}>Rol / Cargo asignado *</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setCargo('MIEMBRO_DE_MESA')}
                    style={{
                      flex: 1,
                      background: cargo === 'MIEMBRO_DE_MESA' ? 'var(--plra-500)' : 'var(--input-bg)',
                      border: `1px solid ${cargo === 'MIEMBRO_DE_MESA' ? 'var(--plra-400)' : 'var(--border-mid)'}`,
                      padding: '0.6rem',
                      borderRadius: '10px',
                      color: cargo === 'MIEMBRO_DE_MESA' ? 'white' : 'var(--text)',
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
                      background: cargo === 'APODERADO' ? 'var(--plra-500)' : 'var(--input-bg)',
                      border: `1px solid ${cargo === 'APODERADO' ? 'var(--plra-400)' : 'var(--border-mid)'}`,
                      padding: '0.6rem',
                      borderRadius: '10px',
                      color: cargo === 'APODERADO' ? 'white' : 'var(--text)',
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
                <label style={{ fontSize: '0.8rem', color: validationTried && (!telefono.trim() || telefono === '+595' || telefono.replace(/\D/g, '').length <= 5) ? 'var(--red)' : 'var(--text-3)', display: 'block', marginBottom: '0.5rem', fontWeight: validationTried && (!telefono.trim() || telefono === '+595' || telefono.replace(/\D/g, '').length <= 5) ? 750 : 'normal' }}>
                  Teléfono (Formato WhatsApp) * {validationTried && (!telefono.trim() || telefono === '+595' || telefono.replace(/\D/g, '').length <= 5) && '(Requerido - Formato válido)'}
                </label>
                <input
                  type="tel"
                  placeholder="Ej: 0981123456"
                  value={telefono}
                  onChange={handlePhoneChange}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'var(--input-bg)',
                    border: validationTried && (!telefono.trim() || telefono === '+595' || telefono.replace(/\D/g, '').length <= 5) ? '1px solid #EF4444' : '1px solid var(--border-mid)',
                    borderRadius: '10px',
                    padding: '0.7rem 1rem',
                    color: 'var(--text)',
                    fontSize: '1rem',
                    outline: 'none',
                    boxShadow: validationTried && (!telefono.trim() || telefono === '+595' || telefono.replace(/\D/g, '').length <= 5) ? '0 0 10px rgba(239, 68, 68, 0.2)' : 'none'
                  }}
                />
              </div>

              {errorRegister && (
                <p style={{ color: 'var(--red)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                  ⚠ {errorRegister}
                </p>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCloseRegisterModal}
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

      {/* Edit Modal */}
      {showEditModal && editingAssistant && (
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
            className="attendance-modal-content"
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 800 }}>Editar Asistente</h3>
            <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Modifica los datos de registro de <strong>{editingAssistant.nombre} {editingAssistant.apellido}</strong>.
            </p>

            <form onSubmit={handleUpdateAssistant}>
              {/* Photo Capture Section */}
              <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: validationTried && !photoUrl ? 'var(--red)' : 'var(--text-3)', display: 'block', marginBottom: '0.5rem', textAlign: 'left', fontWeight: validationTried && !photoUrl ? 750 : 'normal' }}>
                  Foto del Asistente * {validationTried && !photoUrl && '(Requerido)'}
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
                          background: 'var(--red)', border: 'none', color: 'white',
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
                      onClick={() => editFileInputRef.current?.click()}
                      style={{
                        width: '90px', height: '90px', borderRadius: '50%',
                        background: 'var(--input-bg)', 
                        border: validationTried && !photoUrl ? '2px dashed var(--red)' : '2px dashed var(--border-mid)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: validationTried && !photoUrl ? '0 0 10px rgba(239, 68, 68, 0.3)' : 'none'
                      }}
                    >
                      {uploadingPhoto ? (
                        <div className="spinner" style={{ width: '20px', height: '20px' }} />
                      ) : (
                        <>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={validationTried && !photoUrl ? 'var(--red)' : 'var(--text-3)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                          </svg>
                          <span style={{ fontSize: '0.62rem', color: validationTried && !photoUrl ? 'var(--red)' : 'var(--text-3)', marginTop: '4px', fontWeight: 700 }}>CAMARA</span>
                        </>
                      )}
                    </div>
                  )}

                  <input 
                    type="file"
                    accept="image/*"
                    capture="user"
                    ref={editFileInputRef}
                    onChange={handlePhotoCapture}
                    style={{ display: 'none' }}
                  />
                  
                  {!photoUrl && (
                    <button 
                      type="button" 
                      onClick={() => editFileInputRef.current?.click()}
                      style={{
                        background: 'var(--input-bg)',
                        border: validationTried && !photoUrl ? '1px solid var(--red)' : '1px solid var(--border-mid)',
                        padding: '0.4rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        color: validationTried && !photoUrl ? 'var(--red)' : 'var(--text)',
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
                <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', display: 'block', marginBottom: '0.5rem' }}>Rol / Cargo asignado *</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setCargo('MIEMBRO_DE_MESA')}
                    style={{
                      flex: 1,
                      background: cargo === 'MIEMBRO_DE_MESA' ? 'var(--plra-500)' : 'var(--input-bg)',
                      border: `1px solid ${cargo === 'MIEMBRO_DE_MESA' ? 'var(--plra-400)' : 'var(--border-mid)'}`,
                      padding: '0.6rem',
                      borderRadius: '10px',
                      color: cargo === 'MIEMBRO_DE_MESA' ? 'white' : 'var(--text)',
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
                      background: cargo === 'APODERADO' ? 'var(--plra-500)' : 'var(--input-bg)',
                      border: `1px solid ${cargo === 'APODERADO' ? 'var(--plra-400)' : 'var(--border-mid)'}`,
                      padding: '0.6rem',
                      borderRadius: '10px',
                      color: cargo === 'APODERADO' ? 'white' : 'var(--text)',
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
                <label style={{ fontSize: '0.8rem', color: validationTried && (!telefono.trim() || telefono === '+595' || telefono.replace(/\D/g, '').length <= 5) ? 'var(--red)' : 'var(--text-3)', display: 'block', marginBottom: '0.5rem', fontWeight: validationTried && (!telefono.trim() || telefono === '+595' || telefono.replace(/\D/g, '').length <= 5) ? 750 : 'normal' }}>
                  Teléfono (Formato WhatsApp) * {validationTried && (!telefono.trim() || telefono === '+595' || telefono.replace(/\D/g, '').length <= 5) && '(Requerido - Formato válido)'}
                </label>
                <input
                  type="tel"
                  placeholder="Ej: 0981123456"
                  value={telefono}
                  onChange={handlePhoneChange}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'var(--input-bg)',
                    border: validationTried && (!telefono.trim() || telefono === '+595' || telefono.replace(/\D/g, '').length <= 5) ? '1px solid var(--red)' : '1px solid var(--border-mid)',
                    borderRadius: '10px',
                    padding: '0.7rem 1rem',
                    color: 'var(--text)',
                    fontSize: '1rem',
                    outline: 'none',
                    boxShadow: validationTried && (!telefono.trim() || telefono === '+595' || telefono.replace(/\D/g, '').length <= 5) ? '0 0 10px rgba(239, 68, 68, 0.2)' : 'none'
                  }}
                />
              </div>

              {errorRegister && (
                <p style={{ color: 'var(--red)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                  ⚠ {errorRegister}
                </p>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCloseEditModal}
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
                  {loadingRegister ? 'Guardando...' : 'Guardar Cambios'}
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
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-mid)',
            boxShadow: 'var(--shadow-lg)',
            padding: '1rem 2rem',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            zIndex: 900,
            maxWidth: '90%',
            width: 'fit-content',
            color: 'var(--text)'
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
                background: 'var(--input-bg)',
                border: '1px solid var(--border-mid)',
                borderRadius: '8px',
                padding: '0.35rem 0.75rem',
                color: 'var(--text)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="MIEMBRO_DE_MESA" style={{ background: 'var(--surface)' }}>Miembro de Mesa</option>
              <option value="APODERADO" style={{ background: 'var(--surface)' }}>Apoderado</option>
              <option value="VEEDOR" style={{ background: 'var(--surface)' }}>Veedor</option>
              <option value="COORDINADOR" style={{ background: 'var(--surface)' }}>Coordinador</option>
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
              boxShadow: '0 4px 12px rgba(4, 120, 87, 0.3)',
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

      <AnimatePresence>
        {cropperImage && (
          <ImageCropperModal
            image={cropperImage}
            onCropComplete={handleCropComplete}
            onCancel={() => setCropperImage(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Attendance;
