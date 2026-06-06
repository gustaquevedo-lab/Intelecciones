import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, UserCheck, History, User, MapPin, CheckCircle, AlertTriangle, Search, Camera, RefreshCw, X } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const ValidatorApp = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const ciParam = searchParams.get('ci');

  const [ci, setCi] = useState('');
  const [loading, setLoading] = useState(false);
  const [elector, setElector] = useState<any>(null);
  const [validations, setValidations] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [scanning, setScanning] = useState(false);
  const [myValidations, setMyValidations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'scan' | 'history'>('scan');

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Search/verify elector info by CI
  const verifyElector = async (ciToVerify: string) => {
    if (!ciToVerify.trim()) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.get(`/dia-d/validate/${ciToVerify}`);
      setElector(res.data.elector);
      setValidations(res.data.validations || []);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Elector no encontrado en el padrón o error del servidor.');
      setElector(null);
    } finally {
      setLoading(false);
    }
  };

  // Perform vote validation
  const handleValidate = async () => {
    if (!elector) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post('/dia-d/validate', {
        elector_ci: elector.ci,
        validator_id: user?.id
      });
      if (res.data.success) {
        setSuccessMsg(`¡Voto de ${elector.nombre} ${elector.apellido || ''} validado con éxito!`);
        // Refresh validation logs for this elector
        verifyElector(elector.ci);
        // Refresh validator history list
        loadMyHistory();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al guardar la validación.');
    } finally {
      setLoading(false);
    }
  };

  // Load validations performed by current user
  const loadMyHistory = async () => {
    try {
      // We can query all validations or simple fallback locally from what has been validated,
      // or implement custom history query. Let's do a request to check current status.
      // If we don't have a specific endpoint, we can load a general log or store it in state.
      // Let's create a local cache/history or query the database if possible.
      // For this, we'll keep a list in localStorage or state since there are many validators.
      // Let's check local storage to persist my validations history across loads.
      const localHistory = localStorage.getItem(`validator_hist_${user?.id}`);
      if (localHistory) {
        setMyValidations(JSON.parse(localHistory));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Append validated elector to local history log
  useEffect(() => {
    if (successMsg && elector) {
      const newEntry = {
        ci: elector.ci,
        nombre: `${elector.nombre} ${elector.apellido || ''}`,
        local: elector.local_votacion,
        mesa: elector.mesa,
        timestamp: new Date().toISOString()
      };
      setMyValidations(prev => {
        const updated = [newEntry, ...prev.filter(x => x.ci !== elector.ci)].slice(0, 100);
        localStorage.setItem(`validator_hist_${user?.id}`, JSON.stringify(updated));
        return updated;
      });
    }
  }, [successMsg]);

  // Load history on mount
  useEffect(() => {
    if (user?.id) {
      loadMyHistory();
    }
  }, [user]);

  // Auto-verify if CI parameter is present in URL
  useEffect(() => {
    if (ciParam) {
      setCi(ciParam);
      verifyElector(ciParam);
      // Remove query param to clean URL
      searchParams.delete('ci');
      setSearchParams(searchParams);
    }
  }, [ciParam]);

  // Setup camera scanner
  const startScanner = () => {
    setScanning(true);
    setElector(null);
    setError('');
    setSuccessMsg('');

    // Wait for the div element to be rendered
    setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          'qr-reader',
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true
          },
          false
        );

        scanner.render(
          (decodedText) => {
            // URL parse or direct text
            console.log('Scanned text:', decodedText);
            let targetCI = decodedText;
            if (decodedText.includes('ci=')) {
              const url = new URL(decodedText);
              targetCI = url.searchParams.get('ci') || decodedText;
            } else if (decodedText.startsWith('http')) {
              // Try parsing last path segment
              const parts = decodedText.split('/');
              const lastSegment = parts[parts.length - 1];
              if (/^\d+$/.test(lastSegment)) {
                targetCI = lastSegment;
              }
            }
            
            setCi(targetCI);
            verifyElector(targetCI);
            
            // Stop scanning on success
            scanner.clear();
            setScanning(false);
          },
          (errorMessage) => {
            // quiet warning logs
          }
        );
        scannerRef.current = scanner;
      } catch (err) {
        console.error('Failed to start scanner:', err);
        setError('No se pudo acceder a la cámara o inicializar el escáner.');
        setScanning(false);
      }
    }, 200);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, []);

  return (
    <MainLayout title="Validador de Votos" userName={user?.nombre || 'Validador'}>
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', padding: '4px', border: '1px solid var(--border)' }}>
          <button
            onClick={() => { setActiveTab('scan'); stopScanner(); }}
            style={{
              flex: 1, padding: '0.65rem', borderRadius: '10px', border: 'none',
              background: activeTab === 'scan' ? 'var(--plra-500)' : 'transparent',
              color: activeTab === 'scan' ? 'white' : 'var(--text-3)',
              fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
            }}
          >
            <QrCode size={16} /> Escanear / Validar
          </button>
          <button
            onClick={() => { setActiveTab('history'); stopScanner(); }}
            style={{
              flex: 1, padding: '0.65rem', borderRadius: '10px', border: 'none',
              background: activeTab === 'history' ? 'var(--plra-500)' : 'transparent',
              color: activeTab === 'history' ? 'white' : 'var(--text-3)',
              fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
            }}
          >
            <History size={16} /> Mis Validaciones ({myValidations.length})
          </button>
        </div>

        {activeTab === 'scan' ? (
          <>
            {/* Input Search Group */}
            {!scanning && (
              <div className="card-premium-styled" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', margin: 0 }}>
                  Ingreso de Elector
                </h4>
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="C.I. del Elector (ej: 4850921)"
                      value={ci}
                      onChange={(e) => setCi(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && verifyElector(ci)}
                      style={{
                        width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.25rem', borderRadius: '12px',
                        border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)',
                        color: 'white', fontWeight: 700, fontSize: '0.9rem'
                      }}
                    />
                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                  </div>
                  
                  <button
                    onClick={() => verifyElector(ci)}
                    disabled={loading}
                    style={{
                      padding: '0.75rem 1.25rem', borderRadius: '12px', border: 'none',
                      background: 'var(--plra-500)', color: 'white', fontWeight: 900,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem'
                    }}
                  >
                    {loading ? <RefreshCw className="animate-spin" size={16} /> : 'Buscar'}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0 0' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 800 }}>O BIEN</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                </div>

                <button
                  onClick={startScanner}
                  style={{
                    width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--plra-300)',
                    background: 'rgba(0,71,171,0.05)', color: 'var(--plra-300)', fontWeight: 900,
                    fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    cursor: 'pointer'
                  }}
                >
                  <Camera size={18} /> ESCANEAR CÓDIGO QR
                </button>
              </div>
            )}

            {/* Camera QR Reader Container */}
            {scanning && (
              <div className="card-premium-styled" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', margin: 0 }}>
                    Escáner Activo
                  </h4>
                  <button
                    onClick={stopScanner}
                    style={{ background: 'transparent', border: 'none', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800 }}
                  >
                    <X size={14} /> Cancelar
                  </button>
                </div>
                
                <div id="qr-reader" style={{ width: '100%', overflow: 'hidden', borderRadius: '12px' }} />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-premium-styled"
                style={{ padding: '1rem', borderLeft: '4px solid var(--red)', background: 'rgba(239,68,68,0.05)', display: 'flex', alignItems: 'start', gap: '0.75rem' }}
              >
                <AlertTriangle size={20} style={{ color: 'var(--red)', flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: '0 0 0.25rem', color: 'white', fontWeight: 900, fontSize: '0.85rem' }}>Ocurrió un error</h4>
                  <p style={{ margin: 0, color: 'var(--text-3)', fontSize: '0.75rem', lineHeight: '1.3' }}>{error}</p>
                </div>
              </motion.div>
            )}

            {/* Success Message */}
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card-premium-styled"
                style={{ padding: '1.25rem', borderLeft: '4px solid var(--green)', background: 'rgba(34,197,94,0.05)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}
              >
                <CheckCircle size={40} style={{ color: 'var(--green)' }} />
                <h4 style={{ margin: 0, color: 'white', fontWeight: 900, fontSize: '1.1rem' }}>Registro Guardado</h4>
                <p style={{ margin: 0, color: 'var(--text-3)', fontSize: '0.8rem' }}>{successMsg}</p>
              </motion.div>
            )}

            {/* Elector Details Panel */}
            <AnimatePresence>
              {elector && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="card-premium-styled"
                  style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                >
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                      <User size={24} style={{ color: 'var(--plra-300)' }} />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase' }}>ELECTOR ENCONTRADO</span>
                      <h3 style={{ margin: 0, color: 'white', fontWeight: 900, fontSize: '1.1rem' }}>
                        {elector.nombre} {elector.apellido}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--plra-300)', fontWeight: 800 }}>C.I. {elector.ci}</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', display: 'block', fontWeight: 800 }}>LOCAL DE VOTACIÓN</span>
                      <span style={{ fontSize: '0.75rem', color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.15rem' }}>
                        <MapPin size={12} style={{ color: 'var(--plra-300)' }} /> {elector.local_votacion}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', display: 'block', fontWeight: 800 }}>MESA Y ORDEN</span>
                      <span style={{ fontSize: '0.75rem', color: 'white', fontWeight: 700, display: 'block', marginTop: '0.15rem' }}>
                        Mesa: {elector.mesa} · Orden: {elector.orden}
                      </span>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', display: 'block', fontWeight: 800 }}>DISTRITO</span>
                      <span style={{ fontSize: '0.75rem', color: 'white', fontWeight: 700, display: 'block', marginTop: '0.15rem' }}>
                        {elector.distrito}
                      </span>
                    </div>
                  </div>

                  {/* Previous Validations Log */}
                  <div>
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', margin: '0 0 0.5rem' }}>
                      Historial de validación
                    </h5>
                    {validations.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--green)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        ● Aún sin validar para este evento.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {validations.map((v: any, index: number) => (
                          <div key={index} style={{ fontSize: '0.72rem', color: 'white', background: 'rgba(255,255,255,0.01)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Validado por: <strong>{v.validator_name}</strong></span>
                            <span style={{ color: 'var(--text-3)' }}>
                              {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleValidate}
                    disabled={loading}
                    style={{
                      width: '100%', padding: '0.85rem', borderRadius: '12px', border: 'none',
                      background: 'linear-gradient(135deg, #22C47E, #16a34a)', color: 'white', fontWeight: 900,
                      fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      cursor: 'pointer', boxShadow: '0 4px 15px rgba(34,197,94,0.3)'
                    }}
                  >
                    <UserCheck size={18} /> {loading ? 'PROCESANDO...' : 'REGISTRAR ASISTENCIA / VOTO'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          /* History Tab content */
          <div className="card-premium-styled" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', margin: 0 }}>
              Mis registros del día
            </h4>
            
            {myValidations.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                Aún no has validado ningún voto hoy.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                {myValidations.map((entry, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setCi(entry.ci);
                      verifyElector(entry.ci);
                      setActiveTab('scan');
                    }}
                    style={{
                      padding: '0.75rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)',
                      borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', display: 'block' }}>{entry.nombre}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>C.I. {entry.ci} · Mesa {entry.mesa}</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--plra-300)', fontWeight: 800 }}>
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ValidatorApp;
