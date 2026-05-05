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
  ChevronRight, Car, BarChart3, Activity, Paperclip,
  Smile, MoreVertical, Phone, Info, CornerDownLeft
} from 'lucide-react';
import api from '../services/api';

const Communications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('inbox');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  const [templates, setTemplates] = useState<any[]>([]);
  const [broadcastLogs, setBroadcastLogs] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [composerMessage, setComposerMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Template Form State
  const [newTemplate, setNewTemplate] = useState({
    name: '', content: '', media_url: '', media_type: 'TEXT',
    lat: -25.2637, lng: -57.5759, contact_name: '', contact_phone: ''
  });

  // Broadcast Form State
  const [broadcastSettings, setBroadcastSettings] = useState({
    template_id: '', target_type: 'ROLE', target_role: 'ALL', 
    traffic_light: 'ALL', target_list_id: ''
  });

  const fetchData = async () => {
    try {
      const [statusRes, tempRes, logRes, chatRes, msgRes] = await Promise.all([
        api.get('/whatsapp/status'),
        api.get('/whatsapp/templates'),
        api.get('/whatsapp/broadcast/logs'),
        api.get('/whatsapp/chats'),
        api.get('/whatsapp/messages')
      ]);
      
      setWsStatus(statusRes.data.status);
      if (statusRes.data.qr) setQrCode(statusRes.data.qr);
      setTemplates(tempRes.data);
      setBroadcastLogs(logRes.data);
      setChats(chatRes.data);
      setMessages(msgRes.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedChat]);

  const handleConnect = async () => {
    setWsStatus('CONNECTING');
    try { await api.post('/whatsapp/connect'); } catch (err) { console.error(err); }
  };

  const handleSendMessage = async () => {
    if (!composerMessage.trim() || !selectedChat) return;
    try {
      await api.post('/whatsapp/direct-message', {
        number: selectedChat,
        message: composerMessage
      });
      setComposerMessage('');
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isTemplate = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const res = await api.post('/upload-photo', formData);
      if (isTemplate) {
        setNewTemplate(prev => ({ ...prev, media_url: res.data.photo_url }));
      } else if (selectedChat) {
        await api.post('/whatsapp/direct-message', {
          number: selectedChat,
          media_url: res.data.photo_url,
          media_type: file.type.startsWith('image') ? 'IMAGE' : 'VIDEO'
        });
        fetchData();
      }
    } catch (err) { console.error(err); }
    setIsLoading(false);
  };

  const activeChatMessages = messages.filter(m => m.contact_number === selectedChat);
  const activeChatInfo = chats.find(c => c.contact_number === selectedChat);

  return (
    <MainLayout title="Centro de WhatsApp" userName={user?.nombre || ''} userPhoto={user?.photo_url}>
      <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: '#020C1E', overflow: 'hidden' }}>
        
        {/* PANEL 1: NAV TABS */}
        <div style={{ width: '70px', background: 'rgba(2, 12, 27, 0.8)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem 0' }}>
          {[
            { id: 'inbox', icon: MessageSquare, label: 'Inbox' },
            { id: 'broadcast', icon: Send, label: 'Broadcast' },
            { id: 'templates', icon: FileText, label: 'Plantillas' },
            { id: 'logs', icon: BarChart3, label: 'Logs' },
            { id: 'session', icon: QrCode, label: 'QR' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                width: '45px', height: '45px', borderRadius: '12px', marginBottom: '1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: activeTab === tab.id ? 'var(--plra-500)' : 'transparent',
                color: activeTab === tab.id ? 'white' : 'var(--text-3)',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
              }}
              title={tab.label}
            >
              <tab.icon size={22} />
              {activeTab === tab.id && <motion.div layoutId="activeTab" style={{ position: 'absolute', left: '-15px', width: '4px', height: '20px', background: 'var(--plra-500)', borderRadius: '0 4px 4px 0' }} />}
            </button>
          ))}
          <button 
            onClick={() => navigate('/admin')}
            style={{ marginTop: 'auto', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <ChevronRight size={24} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>

        {/* PANEL 2: CHAT LIST OR TAB CONTENT */}
        <div style={{ width: '350px', background: 'rgba(5, 25, 55, 0.3)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', marginBottom: '1rem' }}>
              {activeTab === 'inbox' ? 'Chats Recientes' : activeTab.toUpperCase()}
            </h2>
            <div className="search-input-wrapper-premium">
              <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-3)' }} />
              <input 
                placeholder="Buscar conversación..." 
                className="modern-input-premium-styled" 
                style={{ paddingLeft: '2.5rem', height: '40px', fontSize: '0.8rem' }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {activeTab === 'inbox' && (
              chats.map(chat => (
                <div 
                  key={chat.contact_number}
                  onClick={() => setSelectedChat(chat.contact_number)}
                  style={{
                    padding: '1rem 1.5rem', display: 'flex', gap: '1rem', cursor: 'pointer',
                    background: selectedChat === chat.contact_number ? 'rgba(255,255,255,0.05)' : 'transparent',
                    borderLeft: selectedChat === chat.contact_number ? '4px solid var(--plra-500)' : '4px solid transparent',
                    transition: 'all 0.2s', borderBottom: '1px solid rgba(255,255,255,0.02)'
                  }}
                >
                  <div style={{ 
                    width: '48px', height: '48px', borderRadius: '14px', 
                    background: 'linear-gradient(45deg, var(--plra-700), var(--plra-500))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1rem'
                  }}>
                    {(chat.contact_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, color: 'white', fontSize: '0.9rem' }}>{chat.contact_name || chat.contact_number.split('@')[0]}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>{new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {chat.is_incoming === 0 && <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px', color: 'var(--green)' }} />}
                      {chat.last_message || 'Archivo multimedia'}
                    </p>
                  </div>
                </div>
              ))
            )}

            {activeTab !== 'inbox' && (
               <div style={{ padding: '1.5rem' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Selecciona una opción del menú lateral para gestionar el sistema de WhatsApp.</p>
               </div>
            )}
          </div>
        </div>

        {/* PANEL 3: CHAT VIEW / TAB VIEW */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: activeTab === 'inbox' ? 'url("https://w0.peakpx.com/wallpaper/508/606/HD-wallpaper-whatsapp-dark-patterns-thumbnail.jpg")' : '#020C1E' }}>
          
          {activeTab === 'inbox' ? (
            selectedChat ? (
              <>
                {/* Chat Header */}
                <div style={{ padding: '0.75rem 2rem', background: 'rgba(5, 25, 55, 0.95)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem', backdropFilter: 'blur(10px)', zIndex: 10 }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--plra-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>
                    {(activeChatInfo?.contact_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'white' }}>{activeChatInfo?.contact_name || selectedChat.split('@')[0]}</h3>
                    <span style={{ fontSize: '0.65rem', color: 'var(--green)', fontWeight: 800 }}>EN LÍNEA</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-3)' }}>
                    <Phone size={18} style={{ cursor: 'pointer' }} />
                    <Info size={18} style={{ cursor: 'pointer' }} />
                    <MoreVertical size={18} style={{ cursor: 'pointer' }} />
                  </div>
                </div>

                {/* Messages View */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeChatMessages.map(msg => (
                    <div 
                      key={msg.id} 
                      style={{ 
                        maxWidth: '70%', 
                        alignSelf: msg.is_incoming ? 'flex-start' : 'flex-end',
                        background: msg.is_incoming ? 'rgba(30, 41, 59, 0.9)' : 'var(--plra-600)',
                        padding: '0.75rem 1rem',
                        borderRadius: msg.is_incoming ? '0 18px 18px 18px' : '18px 0 18px 18px',
                        color: 'white', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', position: 'relative'
                      }}
                    >
                      {msg.media_url && (
                        <div style={{ marginBottom: '0.5rem', borderRadius: '10px', overflow: 'hidden' }}>
                          {msg.type === 'image' && <img src={msg.media_url} style={{ width: '100%', maxHeight: '300px', objectFit: 'cover' }} />}
                          {(msg.type === 'video' || msg.type === 'video') && <div style={{ background: '#000', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Video size={40} /></div>}
                        </div>
                      )}
                      <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4' }}>{msg.body}</p>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {!msg.is_incoming && <CheckCircle2 size={10} style={{ color: 'var(--green)' }} />}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Composer */}
                <div style={{ padding: '1.25rem 2rem', background: 'rgba(5, 25, 55, 0.95)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem', backdropFilter: 'blur(10px)' }}>
                   <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--text-3)' }}>
                      <Smile size={22} style={{ cursor: 'pointer' }} />
                      <Paperclip size={22} style={{ cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()} />
                   </div>
                   <div style={{ flex: 1, position: 'relative' }}>
                      <input 
                        className="modern-input-premium-styled"
                        placeholder="Escribe un mensaje..."
                        value={composerMessage}
                        onChange={e => setComposerMessage(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                        style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '24px', padding: '0.75rem 1.5rem', border: 'none' }}
                      />
                      <div style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '0.5rem' }}>
                         <button 
                            onClick={() => setShowTemplateModal(true)}
                            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '0.6rem', color: 'white', fontWeight: 800, cursor: 'pointer' }}
                         >
                           PLANTILLAS
                         </button>
                      </div>
                   </div>
                   <button 
                     onClick={handleSendMessage}
                     disabled={!composerMessage.trim()}
                     style={{ 
                       width: '45px', height: '45px', borderRadius: '50%', background: 'var(--plra-500)', 
                       border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                       cursor: 'pointer', boxShadow: '0 4px 15px rgba(37,99,235,0.3)'
                     }}
                   >
                     <Send size={20} />
                   </button>
                   <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => handleFileUpload(e)} />
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                <div style={{ width: '100px', height: '100px', borderRadius: '30px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                   <Smartphone size={50} />
                </div>
                <h2 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 800 }}>Selecciona un Chat</h2>
                <p style={{ color: 'var(--text-3)', textAlign: 'center', maxWidth: '300px' }}>Selecciona una conversación de la izquierda para comenzar a mensajear.</p>
              </div>
            )
          ) : (
            /* TAB CONTENT: BROADCAST, TEMPLATES, LOGS, SESSION */
            <div style={{ padding: '3rem', flex: 1, overflowY: 'auto' }}>
               <AnimatePresence mode="wait">
                  {activeTab === 'session' && (
                    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                      <div className="premium-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem', textAlign: 'center' }}>
                         <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'white', marginBottom: '1rem' }}>Conexión WhatsApp</h1>
                         <p style={{ color: 'var(--text-3)', marginBottom: '3rem' }}>Vincula tu cuenta para habilitar el envío masivo y la recepción de mensajes.</p>
                         
                         <div style={{ 
                            width: '300px', height: '300px', background: 'white', borderRadius: '24px', margin: '0 auto',
                            padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
                         }}>
                            {qrCode ? (
                              <img src={qrCode} style={{ width: '100%' }} />
                            ) : (
                              wsStatus === 'CONNECTED' ? (
                                <div style={{ textAlign: 'center', color: '#1a1a1a' }}>
                                   <CheckCircle2 size={64} style={{ color: 'var(--green)', marginBottom: '1rem' }} />
                                   <p style={{ fontWeight: 900 }}>VINCULADO</p>
                                </div>
                              ) : <Loader2 className="animate-spin" size={48} color="#666" />
                            )}
                         </div>

                         {wsStatus === 'CONNECTED' ? (
                           <button onClick={() => api.post('/whatsapp/disconnect')} className="btn-secondary" style={{ marginTop: '2rem', color: 'var(--red)' }}>Cerrar Sesión</button>
                         ) : (
                           <button onClick={handleConnect} className="btn-primary" style={{ marginTop: '2rem' }}>Generar QR</button>
                         )}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'broadcast' && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                       <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', marginBottom: '2.5rem' }}>Envío Masivo (Broadcast)</h2>
                       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                          <div className="premium-card" style={{ padding: '2rem' }}>
                             <div className="form-group">
                                <label>Seleccionar Plantilla</label>
                                <select 
                                  className="modern-input-premium-styled"
                                  value={broadcastSettings.template_id}
                                  onChange={e => setBroadcastSettings(prev => ({ ...prev, template_id: e.target.value }))}
                                >
                                  <option value="">Elegir...</option>
                                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                             </div>
                             <div className="form-group" style={{ marginTop: '1.5rem' }}>
                                <label>Destinatarios</label>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                   <button onClick={() => setBroadcastSettings(p => ({ ...p, target_type: 'ROLE' }))} style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: broadcastSettings.target_type === 'ROLE' ? 'var(--plra-500)' : 'none', color: 'white' }}>Por Rol</button>
                                   <button onClick={() => setBroadcastSettings(p => ({ ...p, target_type: 'TRAFFIC' }))} style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: broadcastSettings.target_type === 'TRAFFIC' ? 'var(--plra-500)' : 'none', color: 'white' }}>Por Semáforo</button>
                                </div>
                                {broadcastSettings.target_type === 'ROLE' ? (
                                  <select className="modern-input-premium-styled" value={broadcastSettings.target_role} onChange={e => setBroadcastSettings(p => ({ ...p, target_role: e.target.value }))}>
                                    <option value="ALL">Todos los Usuarios</option>
                                    <option value="COORDINADOR">Coordinadores</option>
                                    <option value="PADRINO">Padrinos</option>
                                  </select>
                                ) : (
                                  <select className="modern-input-premium-styled" value={broadcastSettings.traffic_light} onChange={e => setBroadcastSettings(p => ({ ...p, traffic_light: e.target.value }))}>
                                    <option value="ALL">Todos los Captados</option>
                                    <option value="GREEN">Verdes</option>
                                    <option value="YELLOW">Amarillos</option>
                                  </select>
                                )}
                             </div>
                             <button 
                                onClick={async () => {
                                  if (!broadcastSettings.template_id) return alert('Elige una plantilla');
                                  await api.post('/whatsapp/broadcast', broadcastSettings);
                                  alert('Broadcast iniciado');
                                  setActiveTab('logs');
                                }}
                                className="btn-primary" 
                                style={{ width: '100%', marginTop: '2rem', height: '3.5rem' }}
                             >
                               INICIAR TRANSMISIÓN
                             </button>
                          </div>
                          <div className="premium-card" style={{ padding: '2rem', background: 'rgba(34,197,94,0.05)' }}>
                             <h4 style={{ color: 'var(--green)', margin: '0 0 1rem' }}>Sugerencias de Seguridad</h4>
                             <ul style={{ padding: 0, margin: 0, color: 'var(--text-3)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                               <li>• Se aplica un delay aleatorio de 2-5 seg entre envíos.</li>
                               <li>• Los mensajes personalizados con <strong>{"{{nombre}}"}</strong> reducen el riesgo de baneo.</li>
                               <li>• No envíes a más de 500 contactos nuevos por día.</li>
                             </ul>
                          </div>
                       </div>
                    </motion.div>
                  )}

                  {activeTab === 'templates' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white' }}>Gestión de Plantillas</h2>
                          <button onClick={() => setShowTemplateModal(true)} className="btn-primary"><Plus size={18} /> NUEVA</button>
                       </div>
                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                          {templates.map(t => (
                            <div key={t.id} className="premium-card" style={{ padding: '1.5rem' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                     <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--plra-300)' }}>
                                        {t.media_type === 'IMAGE' && <ImageIcon size={18} />}
                                        {t.media_type === 'CONTACT' && <Users size={18} />}
                                        {t.media_type === 'TEXT' && <FileText size={18} />}
                                        {t.media_type === 'VOICE' && <Mic size={18} />}
                                     </div>
                                     <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'white' }}>{t.name}</span>
                                  </div>
                                  <button onClick={() => api.delete(`/whatsapp/templates/${t.id}`).then(fetchData)} style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.5)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                               </div>
                               <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', lineHeight: '1.5' }}>{t.content}</p>
                            </div>
                          ))}
                       </div>
                    </motion.div>
                  )}

                  {activeTab === 'logs' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                       <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', marginBottom: '2.5rem' }}>Historial de Campañas</h2>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {broadcastLogs.map(log => (
                            <div key={log.id} className="premium-card" style={{ padding: '1.5rem' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                  <div>
                                     <h4 style={{ margin: 0, color: 'white' }}>{log.template_name}</h4>
                                     <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>{new Date(log.timestamp).toLocaleString()}</span>
                                  </div>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 900, color: log.status === 'COMPLETED' ? 'var(--green)' : 'var(--yellow)' }}>{log.status}</span>
                               </div>
                               <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ width: `${(log.success_count / log.target_count) * 100}%`, height: '100%', background: 'var(--green)' }} />
                               </div>
                               <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-3)' }}>
                                  <span>Total: {log.target_count}</span>
                                  <span>Éxito: {log.success_count}</span>
                                  <span>Error: {log.fail_count}</span>
                               </div>
                            </div>
                          ))}
                       </div>
                    </motion.div>
                  )}
               </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: CREATE TEMPLATE */}
      <AnimatePresence>
        {showTemplateModal && (
          <div className="modal-overlay-premium" style={{ zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div className="premium-card" style={{ width: '500px', padding: '2rem' }}>
               <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: '1.5rem' }}>Nueva Plantilla</h2>
               <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label>Nombre</label>
                  <input className="modern-input-premium-styled" value={newTemplate.name} onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))} />
               </div>
               <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label>Tipo Media</label>
                  <select className="modern-input-premium-styled" value={newTemplate.media_type} onChange={e => setNewTemplate(p => ({ ...p, media_type: e.target.value }))}>
                     <option value="TEXT">Texto</option>
                     <option value="IMAGE">Imagen</option>
                     <option value="VIDEO">Video</option>
                     <option value="VOICE">Voz (PTT)</option>
                     <option value="LOCATION">Ubicación</option>
                     <option value="CONTACT">Contacto</option>
                  </select>
               </div>
               <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>Contenido</label>
                  <textarea className="modern-input-premium-styled" style={{ height: '100px' }} value={newTemplate.content} onChange={e => setNewTemplate(p => ({ ...p, content: e.target.value }))} />
               </div>
               <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => setShowTemplateModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cerrar</button>
                  <button 
                    onClick={async () => {
                      await api.post('/whatsapp/templates', newTemplate);
                      setShowTemplateModal(false);
                      fetchData();
                    }}
                    className="btn-primary" 
                    style={{ flex: 1 }}
                  >
                    Guardar
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </MainLayout>
  );
};

export default Communications;
