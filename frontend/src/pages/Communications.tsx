import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
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
  const { isDark } = useTheme();
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
      <div style={{ display: 'flex', height: 'calc(100vh - 110px)', background: 'var(--bg)', overflow: 'hidden' }}>
        
        {/* PANEL 1: NAV TABS (GLASS SIDEBAR) */}
        <div style={{ 
          width: '72px', 
          background: 'var(--glass-bg)', 
          backdropFilter: 'blur(12px)',
          borderRight: '1px solid var(--border)', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          padding: '1.5rem 0',
          gap: '0.5rem',
          zIndex: 10
        }}>
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
                width: '48px', height: '48px', borderRadius: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: activeTab === tab.id ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 71, 171, 0.1)') : 'transparent',
                color: activeTab === tab.id ? 'var(--plra-300)' : 'var(--text-3)',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
              }}
              title={tab.label}
            >
              <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 1.5} />
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTabMarker" 
                  style={{ 
                    position: 'absolute', left: '-12px', width: '4px', height: '20px', 
                    background: 'var(--plra-400)', borderRadius: '0 4px 4px 0' 
                  }} 
                />
              )}
            </button>
          ))}
          <div style={{ marginTop: 'auto', paddingBottom: '1rem' }}>
             <button 
                onClick={() => navigate('/admin')}
                style={{ 
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'var(--surface-light)', border: '1px solid var(--border)',
                  color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
              </button>
          </div>
        </div>

        {/* PANEL 2: CHAT LIST OR TAB CONTENT */}
        <div style={{ 
          width: '320px', 
          background: 'var(--surface)', 
          borderRight: '1px solid var(--border)', 
          display: 'flex', 
          flexDirection: 'column',
          zIndex: 5
        }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ 
              fontSize: '1rem', fontWeight: 800, color: 'var(--text)', 
              fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: '1rem' 
            }}>
              {activeTab === 'inbox' ? 'Chats Recientes' : activeTab}
            </h2>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input 
                placeholder="Buscar..." 
                style={{ 
                  width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem',
                  background: 'var(--surface-light)', border: '1px solid var(--border)',
                  borderRadius: '10px', color: 'var(--text)', fontSize: '0.8rem', outline: 'none'
                }}
              />
            </div>
          </div>

          <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
            {activeTab === 'inbox' ? (
              chats.length > 0 ? (
                chats.map(chat => (
                  <div 
                    key={chat.contact_number}
                    onClick={() => setSelectedChat(chat.contact_number)}
                    style={{
                      padding: '1rem 1.25rem', display: 'flex', gap: '1rem', cursor: 'pointer',
                      background: selectedChat === chat.contact_number ? 'var(--accent-subtle)' : 'transparent',
                      borderLeft: selectedChat === chat.contact_number ? '3px solid var(--plra-400)' : '3px solid transparent',
                      transition: 'all 0.2s', borderBottom: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ 
                      width: '44px', height: '44px', borderRadius: '12px', 
                      background: 'linear-gradient(135deg, var(--plra-600), var(--plra-400))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.9rem'
                    }}>
                      {(chat.contact_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.85rem' }}>{chat.contact_name || chat.contact_number.split('@')[0]}</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 600 }}>{new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {chat.is_incoming === 0 && <CheckCircle2 size={10} style={{ display: 'inline', marginRight: '4px', color: 'var(--green)' }} />}
                        {chat.last_message || 'Archivo multimedia'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '3rem 2rem', textAlign: 'center', opacity: 0.5 }}>
                   <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontWeight: 600 }}>No hay conversaciones activas</p>
                </div>
              )
            ) : (
               <div style={{ padding: '1.5rem' }}>
                  <div style={{ 
                    padding: '1rem', borderRadius: '12px', background: 'var(--accent-subtle)', border: '1px solid var(--border)',
                    fontSize: '0.75rem', color: 'var(--text-2)', lineHeight: '1.5'
                  }}>
                    Gestiona tus campañas de comunicación masiva, plantillas de respuesta rápida y el estado de la sesión de WhatsApp desde este panel táctico.
                  </div>
               </div>
            )}
          </div>
        </div>

        {/* PANEL 3: CHAT VIEW / TAB VIEW */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          background: 'var(--bg)',
          position: 'relative'
        }}>
          {/* Subtle background pattern */}
          <div style={{
            position: 'absolute', inset: 0, 
            backgroundImage: isDark ? 'radial-gradient(var(--plra-800) 1px, transparent 1px)' : 'radial-gradient(#e2e8f0 1px, transparent 1px)',
            backgroundSize: '24px 24px', opacity: 0.4, zIndex: 0, pointerEvents: 'none'
          }} />
          
          <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'inbox' ? (
              selectedChat ? (
                <>
                  {/* Chat Header */}
                  <div style={{ 
                    padding: '0.8rem 2rem', 
                    background: 'var(--surface)', 
                    borderBottom: '1px solid var(--border)', 
                    display: 'flex', alignItems: 'center', gap: '1rem', 
                    backdropFilter: 'blur(12px)', zIndex: 10,
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--plra-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>
                      {(activeChatInfo?.contact_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                        {activeChatInfo?.contact_name || selectedChat.split('@')[0]}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                         <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)' }} />
                         <span style={{ fontSize: '0.65rem', color: 'var(--green)', fontWeight: 800, letterSpacing: '0.05em' }}>EN LÍNEA</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-3)' }}>
                      <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><Phone size={18} /></button>
                      <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><Info size={18} /></button>
                      <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><MoreVertical size={18} /></button>
                    </div>
                  </div>

                  {/* Messages View */}
                  <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {activeChatMessages.map(msg => (
                      <div 
                        key={msg.id} 
                        style={{ 
                          maxWidth: '70%', 
                          alignSelf: msg.is_incoming ? 'flex-start' : 'flex-end',
                          background: msg.is_incoming ? 'var(--surface)' : 'var(--plra-600)',
                          padding: '0.85rem 1.1rem',
                          borderRadius: msg.is_incoming ? '0 20px 20px 20px' : '20px 0 20px 20px',
                          color: msg.is_incoming ? 'var(--text)' : 'white', 
                          border: msg.is_incoming ? '1px solid var(--border)' : 'none',
                          boxShadow: 'var(--shadow-sm)', 
                          position: 'relative'
                        }}
                      >
                        {msg.media_url && (
                          <div style={{ marginBottom: '0.6rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {msg.type === 'image' && <img src={msg.media_url} style={{ width: '100%', maxHeight: '300px', objectFit: 'cover' }} />}
                            {(msg.type === 'video') && <div style={{ background: '#000', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Video size={40} color="white" /></div>}
                          </div>
                        )}
                        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>{msg.body}</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                          <span style={{ fontSize: '0.6rem', opacity: 0.6, fontWeight: 700 }}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {!msg.is_incoming && <CheckCircle2 size={10} style={{ color: msg.is_incoming ? 'var(--green)' : 'rgba(255,255,255,0.8)' }} />}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Composer */}
                  <div style={{ 
                    padding: '1.25rem 2rem', 
                    background: 'var(--surface)', 
                    borderTop: '1px solid var(--border)', 
                    display: 'flex', alignItems: 'center', gap: '1.25rem', 
                    backdropFilter: 'blur(12px)' 
                  }}>
                     <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-3)' }}>
                        <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><Smile size={22} /></button>
                        <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}><Paperclip size={22} /></button>
                     </div>
                     <div style={{ flex: 1, position: 'relative' }}>
                        <input 
                          placeholder="Escribe un mensaje..."
                          value={composerMessage}
                          onChange={e => setComposerMessage(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                          style={{ 
                            width: '100%',
                            background: 'var(--surface-light)', 
                            borderRadius: '24px', 
                            padding: '0.8rem 1.5rem', 
                            border: '1px solid var(--border)',
                            color: 'var(--text)',
                            outline: 'none',
                            fontFamily: 'inherit'
                          }}
                        />
                        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                           <button 
                              onClick={() => setShowTemplateModal(true)}
                              style={{ 
                                background: 'var(--plra-100)', border: 'none', borderRadius: '6px', 
                                padding: '4px 8px', fontSize: '0.6rem', color: 'var(--plra-600)', 
                                fontWeight: 800, cursor: 'pointer' 
                              }}
                           >
                             PLANTILLAS
                           </button>
                        </div>
                     </div>
                     <button 
                       onClick={handleSendMessage}
                       disabled={!composerMessage.trim()}
                       style={{ 
                         width: '48px', height: '48px', borderRadius: '50%', 
                         background: 'var(--plra-500)', 
                         border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                         cursor: 'pointer', boxShadow: '0 8px 20px rgba(0, 71, 171, 0.3)',
                         transition: 'all 0.2s'
                       }}
                       onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                       onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                     >
                       <Send size={20} strokeWidth={2.5} />
                     </button>
                     <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => handleFileUpload(e)} />
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
                  <div style={{ 
                    width: '120px', height: '120px', borderRadius: '32px', 
                    background: 'var(--accent-subtle)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem',
                    color: 'var(--plra-300)'
                  }}>
                     <Smartphone size={56} strokeWidth={1.5} />
                  </div>
                  <h2 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>Intelecciones WhatsApp</h2>
                  <p style={{ color: 'var(--text-3)', textAlign: 'center', maxWidth: '320px', fontSize: '0.85rem', lineHeight: '1.6' }}>
                    Selecciona una conversación para gestionar las comunicaciones de campo en tiempo real.
                  </p>
                </div>
              )
            ) : (
              /* TAB CONTENT: BROADCAST, TEMPLATES, LOGS, SESSION */
              <div style={{ padding: window.innerWidth < 768 ? '1.5rem' : '4rem', flex: 1, overflowY: 'auto' }}>
                 <AnimatePresence mode="wait">
                    {activeTab === 'session' && (
                      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                        <div style={{ 
                          maxWidth: '600px', margin: '0 auto', padding: '3rem', 
                          background: 'var(--surface)', border: '1px solid var(--border)', 
                          borderRadius: '24px', textAlign: 'center', boxShadow: 'var(--shadow-lg)'
                        }}>
                           <div style={{ 
                             width: '64px', height: '64px', borderRadius: '18px', background: 'var(--accent-subtle)',
                             display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'var(--plra-300)'
                           }}>
                             <QrCode size={32} />
                           </div>
                           <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>Conexión Estratégica</h1>
                           <p style={{ color: 'var(--text-3)', marginBottom: '3rem', fontSize: '0.9rem' }}>Vincula tu terminal para habilitar el motor de envío masivo del sistema.</p>
                           
                           <div style={{ 
                              width: '280px', height: '280px', background: 'white', borderRadius: '20px', margin: '0 auto',
                              padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                              border: '1px solid var(--border)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.05)',
                              position: 'relative'
                           }}>
                              {qrCode ? (
                                <img src={qrCode} style={{ width: '100%', borderRadius: '8px' }} />
                              ) : (
                                wsStatus === 'CONNECTED' ? (
                                  <div style={{ textAlign: 'center', color: '#1a1a1a' }}>
                                     <CheckCircle2 size={64} style={{ color: 'var(--green)', marginBottom: '1.25rem' }} />
                                     <p style={{ fontWeight: 900, letterSpacing: '0.1em' }}>TERMINAL VINCULADA</p>
                                  </div>
                                ) : <Loader2 className="animate-spin" size={48} color="var(--plra-500)" />
                              )}
                           </div>

                           {wsStatus === 'CONNECTED' ? (
                             <button 
                                onClick={() => api.post('/whatsapp/disconnect')} 
                                style={{ 
                                  marginTop: '2.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                                  color: 'var(--red)', padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' 
                                }}
                              >
                                DESVINCULAR CUENTA
                              </button>
                           ) : (
                             <button 
                                onClick={handleConnect} 
                                style={{ 
                                  marginTop: '2.5rem', background: 'var(--plra-500)', border: 'none',
                                  color: 'white', padding: '1rem 2.5rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer',
                                  boxShadow: '0 10px 25px rgba(0, 71, 171, 0.3)'
                                }}
                              >
                                GENERAR CÓDIGO QR
                              </button>
                           )}
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'broadcast' && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--plra-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--plra-600)' }}>
                               <Send size={24} />
                            </div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>Transmisión Masiva</h2>
                         </div>
                         
                         <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
                            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '2rem' }}>
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                  <div>
                                     <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Plantilla de Mensaje</label>
                                     <select 
                                       style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', background: 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text)' }}
                                       value={broadcastSettings.template_id}
                                       onChange={e => setBroadcastSettings(prev => ({ ...prev, template_id: e.target.value }))}
                                     >
                                       <option value="">Seleccionar diseño...</option>
                                       {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                     </select>
                                  </div>
                                  <div>
                                     <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Filtro de Destinatarios</label>
                                     <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <button 
                                          onClick={() => setBroadcastSettings(p => ({ ...p, target_type: 'ROLE' }))} 
                                          style={{ 
                                            flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)', 
                                            background: broadcastSettings.target_type === 'ROLE' ? 'var(--plra-500)' : 'var(--surface-light)', 
                                            color: broadcastSettings.target_type === 'ROLE' ? 'white' : 'var(--text-2)',
                                            fontWeight: 700, cursor: 'pointer'
                                          }}
                                        >Por Jerarquía</button>
                                        <button 
                                          onClick={() => setBroadcastSettings(p => ({ ...p, target_type: 'TRAFFIC' }))} 
                                          style={{ 
                                            flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)', 
                                            background: broadcastSettings.target_type === 'TRAFFIC' ? 'var(--plra-500)' : 'var(--surface-light)', 
                                            color: broadcastSettings.target_type === 'TRAFFIC' ? 'white' : 'var(--text-2)',
                                            fontWeight: 700, cursor: 'pointer'
                                          }}
                                        >Por Estatus</button>
                                     </div>
                                     {broadcastSettings.target_type === 'ROLE' ? (
                                       <select style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', background: 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text)' }} value={broadcastSettings.target_role} onChange={e => setBroadcastSettings(p => ({ ...p, target_role: e.target.value }))}>
                                         <option value="ALL">Todo el Equipo de Trabajo</option>
                                         <option value="COORDINADOR">Coordinadores de Campo</option>
                                         <option value="PADRINO">Estructura de Padrinos</option>
                                       </select>
                                     ) : (
                                       <select style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', background: 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text)' }} value={broadcastSettings.traffic_light} onChange={e => setBroadcastSettings(p => ({ ...p, traffic_light: e.target.value }))}>
                                         <option value="ALL">Todo el Padrón Captado</option>
                                         <option value="GREEN">Simpatizantes Confirmados</option>
                                         <option value="YELLOW">Votos en Disputa</option>
                                       </select>
                                     )}
                                  </div>
                               </div>
                               <button 
                                  onClick={async () => {
                                    if (!broadcastSettings.template_id) return alert('Elige una plantilla');
                                    await api.post('/whatsapp/broadcast', broadcastSettings);
                                    alert('Broadcast iniciado');
                                    setActiveTab('logs');
                                  }}
                                  style={{ 
                                    width: '100%', marginTop: '2.5rem', height: '3.75rem', 
                                    background: 'var(--plra-500)', border: 'none', color: 'white',
                                    borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.05em',
                                    cursor: 'pointer', boxShadow: '0 10px 25px rgba(0, 71, 171, 0.3)'
                                  }}
                                >
                                  DESPLEGAR COMUNICACIÓN
                                </button>
                            </div>
                            <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border)', borderRadius: '20px', padding: '2rem' }}>
                               <h4 style={{ color: 'var(--text)', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                  <Shield size={16} style={{ color: 'var(--green)' }} /> Normas de Seguridad
                               </h4>
                               <ul style={{ padding: 0, margin: 0, color: 'var(--text-2)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '1rem', listStyle: 'none' }}>
                                 <li style={{ display: 'flex', gap: '0.75rem' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', marginTop: '6px' }} />
                                    <span>Se aplica un retraso aleatorio entre mensajes para emular comportamiento humano.</span>
                                 </li>
                                 <li style={{ display: 'flex', gap: '0.75rem' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', marginTop: '6px' }} />
                                    <span>El uso de variables personalizadas reduce drásticamente el riesgo de bloqueo.</span>
                                 </li>
                                 <li style={{ display: 'flex', gap: '0.75rem' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', marginTop: '6px' }} />
                                    <span>Recomendamos no exceder los 300 envíos por hora en cuentas nuevas.</span>
                                 </li>
                               </ul>
                            </div>
                         </div>
                      </motion.div>
                    )}

                    {activeTab === 'templates' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                               <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--plra-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--plra-600)' }}>
                                  <FileText size={24} />
                               </div>
                               <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>Plantillas</h2>
                            </div>
                            <button 
                              onClick={() => setShowTemplateModal(true)} 
                              style={{ 
                                padding: '0.8rem 1.5rem', borderRadius: '12px', background: 'var(--plra-500)', 
                                border: 'none', color: 'white', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem' 
                              }}
                            >
                               <Plus size={18} /> CREAR NUEVA
                            </button>
                         </div>
                         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                            {templates.map(t => (
                              <div key={t.id} style={{ 
                                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '1.75rem',
                                boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s'
                              }}>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                       <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--plra-300)' }}>
                                          {t.media_type === 'IMAGE' && <ImageIcon size={20} />}
                                          {t.media_type === 'CONTACT' && <Users size={20} />}
                                          {t.media_type === 'TEXT' && <FileText size={20} />}
                                          {t.media_type === 'VOICE' && <Mic size={20} />}
                                       </div>
                                       <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{t.name}</span>
                                    </div>
                                    <button 
                                      onClick={() => api.delete(`/whatsapp/templates/${t.id}`).then(fetchData)} 
                                      style={{ background: 'none', border: 'none', color: 'var(--red)', opacity: 0.4, cursor: 'pointer' }}
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                 </div>
                                 <div style={{ 
                                   padding: '1rem', borderRadius: '12px', background: 'var(--surface-light)', border: '1px solid var(--border)',
                                   fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: '1.6', fontStyle: 'italic'
                                 }}>
                                   "{t.content}"
                                 </div>
                              </div>
                            ))}
                         </div>
                      </motion.div>
                    )}

                    {activeTab === 'logs' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--plra-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--plra-600)' }}>
                               <BarChart3 size={24} />
                            </div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>Auditoría de Envíos</h2>
                         </div>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {broadcastLogs.map(log => (
                              <div key={log.id} style={{ 
                                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '1.75rem',
                                boxShadow: 'var(--shadow-sm)'
                              }}>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                    <div>
                                       <h4 style={{ margin: 0, color: 'var(--text)', fontSize: '1.1rem', fontWeight: 800 }}>{log.template_name}</h4>
                                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                                          <Clock size={12} style={{ color: 'var(--text-3)' }} />
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 600 }}>{new Date(log.timestamp).toLocaleString()}</span>
                                       </div>
                                    </div>
                                    <div style={{ 
                                      padding: '0.3rem 0.8rem', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 900,
                                      background: log.status === 'COMPLETED' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                                      color: log.status === 'COMPLETED' ? 'var(--green)' : 'var(--yellow)',
                                      border: `1px solid ${log.status === 'COMPLETED' ? 'var(--green)' : 'var(--yellow)'}40`
                                    }}>
                                      {log.status}
                                    </div>
                                 </div>
                                 <div style={{ marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                                       <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>Progreso de Entrega</span>
                                       <span style={{ color: 'var(--text)', fontWeight: 800 }}>{Math.round((log.success_count / log.target_count) * 100)}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', background: 'var(--surface-light)', borderRadius: '4px', overflow: 'hidden' }}>
                                       <motion.div 
                                         initial={{ width: 0 }}
                                         animate={{ width: `${(log.success_count / log.target_count) * 100}%` }}
                                         style={{ height: '100%', background: 'linear-gradient(90deg, var(--plra-500), var(--green))' }} 
                                       />
                                    </div>
                                 </div>
                                 <div style={{ display: 'flex', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                       <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase' }}>Total</span>
                                       <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>{log.target_count}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                       <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase' }}>Éxito</span>
                                       <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--green)' }}>{log.success_count}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                       <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--red)', textTransform: 'uppercase' }}>Fallidos</span>
                                       <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--red)' }}>{log.fail_count}</span>
                                    </div>
                                 </div>
                              </div>
                            ))}
                            {broadcastLogs.length === 0 && (
                               <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.3 }}>
                                  <BarChart3 size={48} style={{ margin: '0 auto 1rem' }} />
                                  <p style={{ fontWeight: 700 }}>No hay historial de transmisiones</p>
                               </div>
                            )}
                         </div>
                      </motion.div>
                    )}
                 </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: CREATE TEMPLATE */}
      <AnimatePresence>
        {showTemplateModal && (
          <div style={{ 
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', 
            backdropFilter: 'blur(8px)', zIndex: 10000, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' 
          }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ 
                width: '100%', maxWidth: '540px', background: 'var(--surface)', 
                border: '1px solid var(--border)', borderRadius: '24px', padding: '2.5rem',
                boxShadow: 'var(--shadow-lg)'
              }}
            >
               <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', marginBottom: '2rem', fontFamily: 'var(--font-display)' }}>Nueva Plantilla Táctica</h2>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Nombre Identificador</label>
                    <input 
                      style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', background: 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      placeholder="Ej: Invitación Voto"
                      value={newTemplate.name} 
                      onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))} 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Categoría de Media</label>
                    <select 
                      style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', background: 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      value={newTemplate.media_type} 
                      onChange={e => setNewTemplate(p => ({ ...p, media_type: e.target.value }))}
                    >
                       <option value="TEXT">Texto Puro</option>
                       <option value="IMAGE">Imagen Adjunta</option>
                       <option value="VIDEO">Video Adjunto</option>
                       <option value="VOICE">Nota de Voz (Simulada)</option>
                       <option value="LOCATION">Ubicación Geográfica</option>
                       <option value="CONTACT">Tarjeta de Contacto</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Cuerpo del Mensaje</label>
                    <textarea 
                      style={{ width: '100%', height: '120px', padding: '0.8rem', borderRadius: '10px', background: 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text)', resize: 'none' }}
                      placeholder="Hola {{nombre}}, te invitamos a..."
                      value={newTemplate.content} 
                      onChange={e => setNewTemplate(p => ({ ...p, content: e.target.value }))} 
                    />
                  </div>
               </div>

               <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                  <button 
                    onClick={() => setShowTemplateModal(false)} 
                    style={{ flex: 1, padding: '1rem', borderRadius: '12px', background: 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text-2)', fontWeight: 700, cursor: 'pointer' }}
                  >CANCELAR</button>
                  <button 
                    onClick={async () => {
                      if (!newTemplate.name || !newTemplate.content) return alert('Completa los campos');
                      await api.post('/whatsapp/templates', newTemplate);
                      setShowTemplateModal(false);
                      setNewTemplate({ name: '', content: '', media_url: '', media_type: 'TEXT', lat: -25.2637, lng: -57.5759, contact_name: '', contact_phone: '' });
                      fetchData();
                    }}
                    style={{ flex: 1, padding: '1rem', borderRadius: '12px', background: 'var(--plra-500)', border: 'none', color: 'white', fontWeight: 800, cursor: 'pointer' }}
                  >GUARDAR PLANTILLA</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </MainLayout>
  );
};

export default Communications;
