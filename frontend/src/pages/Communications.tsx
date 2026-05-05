import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, QrCode, Send, Users, FileText, 
  CheckCircle2, AlertCircle, RefreshCw, Smartphone, 
  Clock, Settings, Search, Shield, Plus, Trash2, 
  Image as ImageIcon, Video, Mic, MapPin, X, Loader2,
  ChevronRight, Car, BarChart3, Activity
} from 'lucide-react';
import api from '../services/api';

const Communications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('session');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  const [templates, setTemplates] = useState<any[]>([]);
  const [broadcastLogs, setBroadcastLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  
  // Template Form State
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    content: '',
    media_url: '',
    media_type: 'TEXT',
    lat: -25.2637,
    lng: -57.5759
  });

  // Broadcast Form State
  const [broadcastSettings, setBroadcastSettings] = useState({
    template_id: '',
    target_type: 'ROLE', // 'ROLE' or 'TRAFFIC'
    target_role: 'ALL',
    traffic_light: 'ALL',
    target_list_id: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/whatsapp/status');
      setWsStatus(res.data.status);
      if (res.data.qr) setQrCode(res.data.qr);
    } catch (err) { console.error(err); }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/whatsapp/templates');
      setTemplates(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchLogs = async () => {
    try {
      const res = await api.get('/whatsapp/broadcast/logs');
      setBroadcastLogs(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchStatus();
    fetchTemplates();
    fetchLogs();
    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    setWsStatus('CONNECTING');
    try { await api.post('/whatsapp/connect'); } catch (err) { console.error(err); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    const formData = new FormData();
    formData.append('photo', file); // Reuse the generic upload-photo for simplicity

    try {
      const res = await api.post('/upload-photo', formData);
      setNewTemplate(prev => ({ ...prev, media_url: res.data.photo_url }));
    } catch (err) { console.error(err); }
    setIsLoading(false);
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/whatsapp/templates', newTemplate);
      setShowTemplateModal(false);
      setNewTemplate({ name: '', content: '', media_url: '', media_type: 'TEXT', lat: -25.2637, lng: -57.5759 });
      fetchTemplates();
    } catch (err) { console.error(err); }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('¿Seguro que desea eliminar esta plantilla?')) return;
    try {
      await api.delete(`/whatsapp/templates/${id}`);
      fetchTemplates();
    } catch (err) { console.error(err); }
  };

  const handleStartBroadcast = async () => {
    if (!broadcastSettings.template_id) return alert('Seleccione una plantilla');
    if (!confirm('¿Desea iniciar el envío masivo? Esto puede tardar varios minutos.')) return;
    
    setIsLoading(true);
    try {
      await api.post('/whatsapp/broadcast', {
        template_id: broadcastSettings.template_id,
        target_list_id: broadcastSettings.target_list_id || null,
        target_role: broadcastSettings.target_type === 'ROLE' ? broadcastSettings.target_role : null,
        traffic_light: broadcastSettings.target_type === 'TRAFFIC' ? broadcastSettings.traffic_light : null
      });
      fetchLogs();
      alert('Broadcast iniciado correctamente.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al iniciar broadcast');
    }
    setIsLoading(false);
  };

  return (
    <MainLayout title="Comunicaciones" userName={user?.nombre || ''} userPhoto={user?.photo_url}>
      <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        
        {/* Sidebar Mini - Refined */}
        <div style={{ width: '260px', background: 'rgba(2, 12, 27, 0.6)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '2rem 1.5rem' }}>
            <h2 style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--plra-300)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
              Canales Digitales
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {[
                { id: 'session', label: 'Conexión QR', icon: QrCode, color: 'var(--green)' },
                { id: 'templates', label: 'Plantillas Pro', icon: FileText, color: 'var(--plra-300)' },
                { id: 'broadcast', label: 'Centro de Envío', icon: Send, color: '#FBBF24' },
                { id: 'logs', label: 'Monitor de Actividad', icon: BarChart3, color: '#A855F7' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.85rem',
                    padding: '0.85rem 1rem', borderRadius: '12px',
                    background: activeTab === tab.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                    border: '1px solid',
                    borderColor: activeTab === tab.id ? 'var(--border)' : 'transparent',
                    color: activeTab === tab.id ? 'white' : 'var(--text-3)',
                    fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                    textAlign: 'left'
                  }}
                >
                  <tab.icon size={18} style={{ color: activeTab === tab.id ? tab.color : 'inherit' }} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button 
              onClick={() => navigate('/admin')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', borderRadius: '12px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
              }}
            >
              <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
              Volver al Panel
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ 
                width: '10px', height: '10px', borderRadius: '50%', 
                background: wsStatus === 'CONNECTED' ? 'var(--green)' : wsStatus === 'CONNECTING' ? 'var(--yellow)' : 'var(--red)',
                boxShadow: `0 0 8px ${wsStatus === 'CONNECTED' ? 'var(--green)' : 'var(--red)'}40`
              }} />
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-2)', textTransform: 'uppercase' }}>WhatsApp: {wsStatus}</span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem', background: 'linear-gradient(135deg, #020C1E 0%, #051937 100%)' }}>
          <AnimatePresence mode="wait">
            {activeTab === 'session' && (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
                  <div className="premium-card" style={{ padding: '3.5rem 2rem' }}>
                    <div style={{ 
                      width: '80px', height: '80px', borderRadius: '24px', 
                      background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 2rem', color: 'var(--green)',
                      boxShadow: '0 15px 35px rgba(34,197,94,0.15)'
                    }}>
                      <Smartphone size={40} />
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'white', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>Central de WhatsApp</h1>
                    <p style={{ color: 'var(--text-3)', marginBottom: '3rem', lineHeight: '1.6', fontSize: '0.95rem' }}>
                      Escanea el código para habilitar el motor de envío masivo de multimedia y geolocalización.
                    </p>

                    <div style={{ 
                      width: '320px', height: '320px', background: 'white', borderRadius: '28px',
                      margin: '0 auto', padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 30px 60px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden'
                    }}>
                      {qrCode ? (
                        <img src={qrCode} alt="QR Code" style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
                      ) : (
                        <div style={{ textAlign: 'center' }}>
                          <Loader2 className="animate-spin" size={48} style={{ color: 'var(--plra-500)', marginBottom: '1.25rem' }} />
                          <p style={{ fontSize: '0.75rem', color: '#666', fontWeight: 800, letterSpacing: '0.05em' }}>PREPARANDO QR...</p>
                        </div>
                      )}
                      
                      {wsStatus === 'CONNECTED' && (
                        <div style={{ 
                          position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.98)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem'
                        }}>
                          <div style={{ width: '72px', height: '72px', borderRadius: '22px', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 10px 25px rgba(34,197,94,0.3)' }}>
                            <CheckCircle2 size={36} />
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontWeight: 900, color: '#020C1E', fontSize: '1.1rem', letterSpacing: '-0.02em' }}>SISTEMA VINCULADO</p>
                            <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>Motor de envío operando correctamente</p>
                          </div>
                          <button 
                            onClick={() => api.post('/whatsapp/disconnect')}
                            style={{ 
                              marginTop: '1rem', padding: '0.6rem 1.25rem', borderRadius: '10px', 
                              background: 'rgba(239,68,68,0.1)', color: 'var(--red)', fontWeight: 800, 
                              fontSize: '0.7rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                          >
                            CERRAR SESIÓN
                          </button>
                        </div>
                      )}
                    </div>

                    {!qrCode && wsStatus === 'DISCONNECTED' && (
                      <button onClick={handleConnect} className="btn-primary" style={{ marginTop: '2rem', padding: '1rem 2.5rem' }}>
                        GENERAR NUEVA CONEXIÓN
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'templates' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                  <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', fontFamily: 'var(--font-display)' }}>Plantillas Multimedia</h1>
                    <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>Gestione los contenidos masivos con potencia personalizable.</p>
                  </div>
                  <button 
                    onClick={() => setShowTemplateModal(true)}
                    className="btn-primary" 
                    style={{ borderRadius: '12px', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                  >
                    <Plus size={20} /> NUEVA PLANTILLA
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  {templates.map(t => (
                    <motion.div key={t.id} layout className="premium-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--plra-300)' }}>
                            {t.media_type === 'IMAGE' && <ImageIcon size={20} />}
                            {t.media_type === 'VIDEO' && <Video size={20} />}
                            {t.media_type === 'VOICE' && <Mic size={20} />}
                            {t.media_type === 'LOCATION' && <MapPin size={20} />}
                            {t.media_type === 'TEXT' && <FileText size={20} />}
                          </div>
                          <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', margin: 0 }}>{t.name}</h3>
                            <span style={{ fontSize: '0.6rem', color: 'var(--plra-300)', fontWeight: 800, textTransform: 'uppercase' }}>{t.media_type}</span>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteTemplate(t.id)} style={{ color: 'rgba(239,68,68,0.5)', padding: '0.5rem', borderRadius: '8px', border: 'none', background: 'none', cursor: 'pointer' }}>
                          <Trash2 size={18} />
                        </button>
                      </div>

                      {t.media_url && (
                        <div style={{ width: '100%', height: '140px', borderRadius: '12px', overflow: 'hidden', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}>
                          {t.media_type === 'IMAGE' && <img src={t.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          {t.media_type === 'VIDEO' && <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Video size={40} style={{ opacity: 0.3 }} /></div>}
                          {t.media_type === 'VOICE' && <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Mic size={40} style={{ opacity: 0.3 }} /></div>}
                        </div>
                      )}

                      <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.5' }}>
                        {t.content}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'broadcast' && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                      {/* Configuration */}
                      <div className="premium-card" style={{ padding: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Send size={24} style={{ color: 'var(--green)' }} />
                          Nueva Campaña Masiva
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          <div className="form-group">
                            <label>Plantilla a Enviar</label>
                            <select 
                              className="modern-input-premium-styled" 
                              style={{ width: '100%' }}
                              value={broadcastSettings.template_id}
                              onChange={e => setBroadcastSettings(prev => ({ ...prev, template_id: e.target.value }))}
                            >
                              <option value="">Seleccione una plantilla...</option>
                              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>

                          <div className="form-group">
                            <label>Segmentación de Destinatarios</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                              <button 
                                onClick={() => setBroadcastSettings(prev => ({ ...prev, target_type: 'ROLE' }))}
                                style={{ 
                                  padding: '0.75rem', borderRadius: '10px', 
                                  background: broadcastSettings.target_type === 'ROLE' ? 'var(--plra-500)' : 'rgba(255,255,255,0.03)',
                                  border: '1px solid var(--border)', color: 'white', fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                Por Cargo
                              </button>
                              <button 
                                onClick={() => setBroadcastSettings(prev => ({ ...prev, target_type: 'TRAFFIC' }))}
                                style={{ 
                                  padding: '0.75rem', borderRadius: '10px', 
                                  background: broadcastSettings.target_type === 'TRAFFIC' ? 'var(--plra-500)' : 'rgba(255,255,255,0.03)',
                                  border: '1px solid var(--border)', color: 'white', fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                Por Semáforo
                              </button>
                            </div>
                          </div>

                          {broadcastSettings.target_type === 'ROLE' ? (
                            <div className="form-group">
                              <label>Filtrar por Cargo</label>
                              <select 
                                className="modern-input-premium-styled" 
                                style={{ width: '100%' }}
                                value={broadcastSettings.target_role}
                                onChange={e => setBroadcastSettings(prev => ({ ...prev, target_role: e.target.value }))}
                              >
                                <option value="ALL">Todos los Operadores</option>
                                <option value="COORDINADOR">Coordinadores de Campo</option>
                                <option value="PADRINO">Padrinos</option>
                                <option value="JEFE_CAMPANA">Jefes de Campaña</option>
                              </select>
                            </div>
                          ) : (
                            <div className="form-group">
                              <label>Filtrar por Intención de Voto</label>
                              <select 
                                className="modern-input-premium-styled" 
                                style={{ width: '100%' }}
                                value={broadcastSettings.traffic_light}
                                onChange={e => setBroadcastSettings(prev => ({ ...prev, traffic_light: e.target.value }))}
                              >
                                <option value="ALL">Todos los Captados</option>
                                <option value="GREEN">Verdes (Fidelizados)</option>
                                <option value="YELLOW">Amarillos (Dudosos)</option>
                                <option value="RED">Rojos (En Contra)</option>
                                <option value="PURPLE">Púrpura (Especiales)</option>
                              </select>
                            </div>
                          )}

                          <button 
                            onClick={handleStartBroadcast}
                            disabled={isLoading || wsStatus !== 'CONNECTED'}
                            className="btn-primary" 
                            style={{ height: '3.5rem', borderRadius: '14px', marginTop: '1rem', fontSize: '1rem' }}
                          >
                            {isLoading ? <Loader2 className="animate-spin" /> : 'INICIAR TRANSMISIÓN'}
                          </button>
                          
                          {wsStatus !== 'CONNECTED' && (
                            <p style={{ fontSize: '0.7rem', color: 'var(--red)', textAlign: 'center', fontWeight: 700 }}>
                              <AlertCircle size={12} /> WhatsApp debe estar vinculado para enviar.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Preview / Instructions */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                         <div className="premium-card" style={{ padding: '2rem', background: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.2)' }}>
                           <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--green)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                             <Shield size={18} /> Potencia e Integridad
                           </h3>
                           <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                             {[
                               { title: 'Simulación Personal', desc: 'Las notas de voz se envían como grabadas personalmente, aumentando la efectividad.' },
                               { title: 'Retraso Anti-Ban', desc: 'Sistema inteligente de pausas (2-5 seg) para proteger tu cuenta de bloqueos.' },
                               { title: 'Multimedia Premium', desc: 'Envía fotos, videos y ubicaciones reales para guiar a tu equipo.' }
                             ].map((item, idx) => (
                               <li key={idx} style={{ display: 'flex', gap: '1rem' }}>
                                 <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(34,197,94,0.2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)', fontSize: '0.6rem', fontWeight: 900 }}>{idx+1}</div>
                                 <div>
                                   <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'white', margin: 0 }}>{item.title}</p>
                                   <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', margin: '0.15rem 0 0' }}>{item.desc}</p>
                                 </div>
                               </li>
                             ))}
                           </ul>
                         </div>

                         <div style={{ padding: '1.5rem', borderRadius: '20px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                               <Activity size={32} style={{ color: 'var(--plra-300)' }} />
                               <div>
                                 <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>Monitoreo en Vivo</p>
                                 <p style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>Los envíos se procesan en segundo plano. Puedes cerrar esta pestaña sin interrumpirlos.</p>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'logs' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', marginBottom: '2.5rem', fontFamily: 'var(--font-display)' }}>Monitor de Transmisiones</h1>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {broadcastLogs.map(log => (
                    <div key={log.id} className="premium-card" style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div>
                          <span style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--plra-300)', letterSpacing: '0.1em' }}>ID #{log.id}</span>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', margin: '0.2rem 0' }}>{log.template_name}</h3>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>Iniciado el {new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <div style={{ 
                          padding: '0.4rem 0.85rem', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 900,
                          background: log.status === 'RUNNING' ? 'rgba(59,130,246,0.1)' : 'rgba(34,197,94,0.1)',
                          color: log.status === 'RUNNING' ? 'var(--plra-300)' : 'var(--green)',
                          border: '1px solid currentColor'
                        }}>
                          {log.status === 'RUNNING' ? 'PROCESANDO' : 'COMPLETADO'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-2)', fontWeight: 700 }}>
                          <span>Progreso del envío</span>
                          <span>{log.success_count + log.fail_count} / {log.target_count} ({Math.round(((log.success_count + log.fail_count) / log.target_count) * 100)}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${((log.success_count + log.fail_count) / log.target_count) * 100}%` }}
                            style={{ height: '100%', background: 'linear-gradient(90deg, var(--plra-500), var(--green))' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)' }} />
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>Exitosos: <strong>{log.success_count}</strong></span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--red)' }} />
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>Fallidos: <strong>{log.fail_count}</strong></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {broadcastLogs.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '5rem 0', opacity: 0.3 }}>
                      <BarChart3 size={64} style={{ margin: '0 auto 1.5rem' }} />
                      <p style={{ fontWeight: 800, letterSpacing: '0.1em' }}>NO HAY REGISTROS DE ACTIVIDAD</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Template Creation Modal */}
      <AnimatePresence>
        {showTemplateModal && (
          <div className="modal-overlay-premium" style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="premium-card"
              style={{ width: '95%', maxWidth: '600px', padding: '2rem', position: 'relative' }}
            >
              <button onClick={() => setShowTemplateModal(false)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
                <X size={24} />
              </button>

              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: '2rem' }}>Crear Plantilla Pro</h2>
              
              <form onSubmit={handleCreateTemplate}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Nombre Identificador</label>
                    <input 
                      className="modern-input-premium-styled" 
                      placeholder="Ej: Instrucciones Veedores" 
                      value={newTemplate.name}
                      onChange={e => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label>Tipo de Multimedia</label>
                    <select 
                      className="modern-input-premium-styled" 
                      value={newTemplate.media_type}
                      onChange={e => setNewTemplate(prev => ({ ...prev, media_type: e.target.value }))}
                    >
                      <option value="TEXT">Solo Texto</option>
                      <option value="IMAGE">Imagen</option>
                      <option value="VIDEO">Video</option>
                      <option value="VOICE">Nota de Voz (PTT)</option>
                      <option value="LOCATION">Ubicación GPS</option>
                    </select>
                  </div>

                  {newTemplate.media_type !== 'TEXT' && newTemplate.media_type !== 'LOCATION' && (
                    <div className="form-group">
                      <label>Archivo Multimedia</label>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        style={{ 
                          height: '42px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', 
                          border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', 
                          justifyContent: 'center', cursor: 'pointer', color: newTemplate.media_url ? 'var(--green)' : 'var(--text-3)',
                          fontSize: '0.75rem', fontWeight: 700
                        }}
                      >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : (newTemplate.media_url ? 'Archivo Listo ✓' : 'Subir Archivo')}
                      </div>
                      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                    </div>
                  )}

                  {newTemplate.media_type === 'LOCATION' && (
                    <>
                      <div className="form-group">
                        <label>Latitud</label>
                        <input className="modern-input-premium-styled" type="number" step="any" value={newTemplate.lat} onChange={e => setNewTemplate(prev => ({ ...prev, lat: parseFloat(e.target.value) }))} />
                      </div>
                      <div className="form-group">
                        <label>Longitud</label>
                        <input className="modern-input-premium-styled" type="number" step="any" value={newTemplate.lng} onChange={e => setNewTemplate(prev => ({ ...prev, lng: parseFloat(e.target.value) }))} />
                      </div>
                    </>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: '2rem' }}>
                  <label>{newTemplate.media_type === 'LOCATION' ? 'Descripción de Ubicación' : 'Cuerpo del Mensaje'}</label>
                  <textarea 
                    className="modern-input-premium-styled" 
                    style={{ minHeight: '120px', resize: 'none', padding: '1rem' }}
                    placeholder="Escribe el mensaje aquí..."
                    value={newTemplate.content}
                    onChange={e => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
                  />
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '0.5rem' }}>Usa <strong>{{nombre}}</strong> para personalizar.</p>
                </div>

                <div className="modal-footer-premium-styled">
                  <button type="button" onClick={() => setShowTemplateModal(false)} className="btn-cancel-styled">Cancelar</button>
                  <button type="submit" className="btn-confirm-styled" style={{ padding: '0 2rem' }}>Guardar Plantilla</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </MainLayout>
  );
};

export default Communications;
