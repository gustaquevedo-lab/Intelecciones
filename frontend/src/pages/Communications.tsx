import React, { useState, useEffect } from 'react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, QrCode, Send, Users, FileText, CheckCircle2, AlertCircle, RefreshCw, Smartphone, Clock, Settings, Search, Shield } from 'lucide-react';
import api from '../services/api';

const Communications = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('session');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  const [templates, setTemplates] = useState<any[]>([]);
  const [electors, setElectors] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await api.get('/whatsapp/status');
      setWsStatus(res.data.status);
      if (res.data.qr) setQrCode(res.data.qr);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    setWsStatus('CONNECTING');
    try {
      await api.post('/whatsapp/connect');
    } catch (err) { console.error(err); }
  };

  return (
    <MainLayout title="Comunicaciones" userName={user?.nombre || ''} userPhoto={user?.photo_url}>
      <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        
        {/* Sidebar Mini */}
        <div style={{ width: '240px', background: 'rgba(4, 20, 40, 0.4)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <MessageSquare size={20} style={{ color: 'var(--green)' }} />
              WhatsApp Hub
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { id: 'session', label: 'Conexión QR', icon: QrCode },
                { id: 'broadcast', label: 'Envío Masivo', icon: Send },
                { id: 'templates', label: 'Plantillas', icon: FileText },
                { id: 'logs', label: 'Historial', icon: Clock },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 1rem', borderRadius: '12px',
                    background: activeTab === tab.id ? 'rgba(34,197,94,0.1)' : 'transparent',
                    border: '1px solid',
                    borderColor: activeTab === tab.id ? 'rgba(34,197,94,0.2)' : 'transparent',
                    color: activeTab === tab.id ? 'var(--green)' : 'var(--text-3)',
                    fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                    textAlign: 'left',
                    gap: '0.75rem' // Added gap
                  }}
                >
                  <tab.icon size={18} style={{ marginRight: '0.25rem' }} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--text-3)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: wsStatus === 'CONNECTED' ? 'var(--green)' : 'var(--red)' }} />
              Status: {wsStatus}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', background: 'var(--surface-dark)' }}>
          <AnimatePresence mode="wait">
            {activeTab === 'session' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
                  <div style={{ 
                    width: '80px', height: '80px', borderRadius: '20px', 
                    background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 2rem', color: 'var(--green)'
                  }}>
                    <Smartphone size={40} />
                  </div>
                  <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', marginBottom: '1rem' }}>Vincula tu WhatsApp</h1>
                  <p style={{ color: 'var(--text-3)', marginBottom: '2.5rem', lineHeight: '1.6' }}>
                    Escanea el código QR desde tu aplicación de WhatsApp en el teléfono (Configuración {'>'} Dispositivos vinculados) para habilitar el envío de mensajes desde la plataforma.
                  </p>

                  <div style={{ 
                    width: '320px', height: '320px', background: 'white', borderRadius: '24px',
                    margin: '0 auto', padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)', position: 'relative', overflow: 'hidden'
                  }}>
                    {qrCode ? (
                      <img src={qrCode} alt="QR Code" style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <RefreshCw className="animate-spin" size={48} style={{ color: 'var(--plra-500)', marginBottom: '1rem' }} />
                        <p style={{ fontSize: '0.75rem', color: '#666', fontWeight: 700 }}>Generando código...</p>
                      </div>
                    )}
                    
                    {wsStatus === 'CONNECTED' && (
                      <div style={{ 
                        position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.95)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem'
                      }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                          <CheckCircle2 size={32} />
                        </div>
                        <p style={{ fontWeight: 800, color: '#1a1a1a' }}>DISPOSITIVO VINCULADO</p>
                        <button 
                          onClick={() => api.post('/whatsapp/disconnect')}
                          style={{ fontSize: '0.7rem', color: 'var(--red)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Desvincular cuenta
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                      <Shield size={14} style={{ color: 'var(--plra-300)' }} />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700 }}>Encriptación Extremo a Extremo</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'broadcast' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                  
                  {/* Message Composer */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '24px', border: '1px solid var(--border)', padding: '2rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={18} style={{ color: 'var(--plra-300)' }} />
                      Redactar Campaña
                    </h3>

                    <div className="form-group">
                      <label>Elegir Plantilla</label>
                      <select className="modern-input" style={{ width: '100%' }}>
                        <option>Mensaje de Bienvenida</option>
                        <option>Propuesta Salud 2026</option>
                        <option>Información Día D</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginTop: '1.5rem' }}>
                      <label>Contenido del Mensaje</label>
                      <div style={{ position: 'relative' }}>
                        <textarea 
                          style={{ 
                            width: '100%', minHeight: '200px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
                            borderRadius: '12px', padding: '1rem', color: 'white', fontSize: '0.85rem', outline: 'none', resize: 'none'
                          }}
                          placeholder="Hola {{nombre}}, queremos compartir contigo..."
                        />
                        <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', display: 'flex', gap: '0.4rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', background: 'var(--plra-500)', borderRadius: '4px', fontSize: '0.6rem', color: 'white', fontWeight: 700, cursor: 'pointer' }}>+ Nombre</span>
                          <span style={{ padding: '0.2rem 0.5rem', background: 'var(--plra-500)', borderRadius: '4px', fontSize: '0.6rem', color: 'white', fontWeight: 700, cursor: 'pointer' }}>+ Local</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                      <button className="btn-primary" style={{ flex: 1, height: '48px' }}>
                        <Send size={18} /> Iniciar Envío Masivo
                      </button>
                    </div>
                  </div>

                  {/* Recipients / Preview */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '24px', border: '1px solid var(--border)', padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={18} style={{ color: 'var(--green)' }} />
                        Destinatarios (1,240)
                      </h3>
                      <div className="search-input-wrapper-premium" style={{ marginBottom: '1rem' }}>
                        <Search size={14} style={{ position: 'absolute', left: '12px', color: 'var(--text-3)' }} />
                        <input className="modern-input-premium-styled" placeholder="Filtrar por local o lista..." style={{ paddingLeft: '2.5rem' }} />
                      </div>
                      <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[1,2,3,4,5].map(i => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--plra-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'white', fontWeight: 800 }}>JP</div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>Juan Perez</p>
                              <p style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>0981 123 456</p>
                            </div>
                            <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.2)' }}>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <AlertCircle size={20} style={{ color: 'var(--yellow)', flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--yellow)', marginBottom: '0.25rem' }}>Aviso de Seguridad</p>
                          <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', lineHeight: '1.4' }}>
                            Se aplicará un retraso aleatorio de 8-15 segundos entre cada mensaje para prevenir el baneo de la cuenta.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MainLayout>
  );
};

export default Communications;
