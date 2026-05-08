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
  Smile, MoreVertical, Phone, Info, CornerDownLeft,
  User, Tag, Hash, Calendar, Map, ExternalLink,
  ChevronLeft, ThumbsUp, Heart, Star, Flag
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
  const [contactIntel, setContactIntel] = useState<any>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [terminals, setTerminals] = useState<any[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState('default');
  const [showNewTerminalModal, setShowNewTerminalModal] = useState(false);
  const [newTerminalData, setNewTerminalData] = useState({ id: '', name: '' });
  
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
      const [statusRes, tempRes, logRes, chatRes, msgRes, termRes] = await Promise.all([
        api.get(`/whatsapp/status?terminalId=${activeTerminalId}`),
        api.get('/whatsapp/templates'),
        api.get('/whatsapp/broadcast/logs'),
        api.get('/whatsapp/chats'),
        api.get('/whatsapp/messages'),
        api.get('/whatsapp/terminals')
      ]);
      
      setWsStatus(statusRes.data.status);
      if (statusRes.data.qr) setQrCode(statusRes.data.qr);
      else setQrCode(null);
      setTemplates(tempRes.data);
      setBroadcastLogs(logRes.data);
      setChats(chatRes.data);
      setMessages(msgRes.data);
      setTerminals(termRes.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedChat]);

  useEffect(() => {
    const fetchIntel = async () => {
      if (!selectedChat) {
        setContactIntel(null);
        return;
      }
      try {
        const cleanPhone = selectedChat.split('@')[0];
        const res = await api.get(`/admin/verify-phone/${cleanPhone}`);
        setContactIntel(res.data);
      } catch (err) { 
        setContactIntel(null); 
      }
    };
    fetchIntel();
  }, [selectedChat]);

  const handleConnect = async () => {
    setWsStatus('CONNECTING');
    try { await api.post('/whatsapp/connect', { terminalId: activeTerminalId }); } catch (err) { console.error(err); }
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
        
        {/* PANEL 1: NAV TABS (ULTRA DARK - NO MORE TOO WHITE) */}
        <div style={{ 
          width: '72px', 
          background: '#020C1E', 
          borderRight: '1px solid rgba(255,255,255,0.05)', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          padding: '1.5rem 0',
          gap: '0.8rem',
          zIndex: 20
        }}>
          {[
            { id: 'inbox', icon: MessageSquare, label: 'Inbox' },
            { id: 'broadcast', icon: Send, label: 'Broadcast' },
            { id: 'templates', icon: FileText, label: 'Plantillas' },
            { id: 'logs', icon: BarChart3, label: 'Auditoría' },
            { id: 'session', icon: QrCode, label: 'QR' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                width: '44px', height: '44px', borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: activeTab === tab.id ? 'var(--plra-500)' : 'transparent',
                color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.4)',
                border: 'none', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative'
              }}
              title={tab.label}
            >
              <tab.icon size={20} strokeWidth={2} />
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTabMarker" 
                  style={{ 
                    position: 'absolute', left: '-12px', width: '4px', height: '16px', 
                    background: 'white', borderRadius: '0 4px 4px 0' 
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
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <ChevronLeft size={18} />
              </button>
          </div>
        </div>

        {/* PANEL 2: CHAT LIST / CONTENT NAV */}
        <div style={{ 
          width: '320px', 
          background: 'var(--surface)', 
          borderRight: '1px solid var(--border)', 
          display: 'flex', 
          flexDirection: 'column',
          zIndex: 10,
          boxShadow: '10px 0 15px rgba(0,0,0,0.02)'
        }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                  {activeTab === 'inbox' ? 'Bandeja de Entrada' : activeTab.toUpperCase()}
                </h2>
                <div style={{ padding: '4px 8px', borderRadius: '6px', background: 'var(--accent-subtle)', color: 'var(--plra-500)', fontSize: '0.65rem', fontWeight: 800 }}>
                  V 2.0
                </div>
             </div>              <div style={{ position: 'relative' }}>
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                   <select 
                      value={activeTerminalId} 
                      onChange={(e) => setActiveTerminalId(e.target.value)}
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.75rem', fontWeight: 700 }}
                   >
                      {terminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                   </select>
                   <button 
                      onClick={() => setShowNewTerminalModal(true)}
                      style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--plra-500)', border: 'none', color: 'white', cursor: 'pointer' }}
                   >
                      <Plus size={16} />
                   </button>
                </div>
                <Search size={14} style={{ position: 'absolute', left: '12px', bottom: '1rem', color: 'var(--text-3)' }} />
                <input 
                  placeholder="Buscar conversaciones..." 
                  style={{ 
                    width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: '12px', color: 'var(--text)', fontSize: '0.8rem', outline: 'none',
                    transition: 'all 0.2s'
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
                      padding: '1.25rem 1.5rem', display: 'flex', gap: '1rem', cursor: 'pointer',
                      background: selectedChat === chat.contact_number ? 'var(--accent-subtle)' : 'transparent',
                      borderLeft: selectedChat === chat.contact_number ? '4px solid var(--plra-500)' : '4px solid transparent',
                      transition: 'all 0.2s', borderBottom: '1px solid var(--border)',
                      position: 'relative'
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      <div style={{ 
                        width: '48px', height: '48px', borderRadius: '15px', 
                        background: 'linear-gradient(135deg, var(--plra-600), var(--plra-400))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1rem',
                        boxShadow: '0 4px 10px rgba(0, 71, 171, 0.2)'
                      }}>
                        {(chat.contact_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ 
                        position: 'absolute', bottom: '-2px', right: '-2px', width: '14px', height: '14px', 
                        background: 'var(--green)', borderRadius: '50%', border: '2px solid var(--surface)' 
                      }} />
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 800, color: 'var(--text)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {chat.contact_name || chat.contact_number.split('@')[0]}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700 }}>
                          {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {chat.is_incoming === 0 && <CheckCircle2 size={12} style={{ color: 'var(--green)' }} />}
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                          {chat.last_message || 'Archivo multimedia'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                         <span style={{ padding: '2px 6px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--green)', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 800 }}>VOTO</span>
                         {chat.contact_number.includes('595') && <span style={{ padding: '2px 6px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--plra-500)', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 800 }}>LOCAL</span>}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                   <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'var(--surface-2)', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
                      <MessageSquare size={32} strokeWidth={1} />
                   </div>
                   <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', fontWeight: 600 }}>No hay conversaciones en esta terminal</p>
                </div>
              )
            ) : (
               <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ 
                    padding: '1.25rem', borderRadius: '16px', background: 'linear-gradient(135deg, var(--plra-600), var(--plra-800))', color: 'white',
                    boxShadow: 'var(--shadow-md)'
                  }}>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 900 }}>CENTRO OPERATIVO</h4>
                    <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.8, lineHeight: '1.5' }}>Gestiona el despliegue de mensajes estratégicos y monitorea el flujo de información de campo.</p>
                  </div>
                  <div style={{ padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <Activity size={16} color="var(--green)" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Estado de Red</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.5rem' }}>
                        <span color="var(--text-3)">Latencia</span>
                        <span style={{ color: 'var(--green)', fontWeight: 800 }}>45ms</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                        <span color="var(--text-3)">Uptime</span>
                        <span style={{ fontWeight: 800 }}>99.9%</span>
                     </div>
                  </div>
               </div>
            )}
          </div>
        </div>

        {/* PANEL 3: MAIN CHAT VIEW / TAB CONTENT */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          background: 'var(--bg)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Authentic WhatsApp-style background pattern */}
          <div style={{
            position: 'absolute', inset: 0, 
            backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
            backgroundSize: '400px', opacity: isDark ? 0.05 : 0.08, zIndex: 0, pointerEvents: 'none',
            filter: isDark ? 'invert(1)' : 'none'
          }} />
          
          <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: showRightPanel ? '1px solid var(--border)' : 'none' }}>
              {activeTab === 'inbox' ? (
                selectedChat ? (
                  <>
                    {/* Chat Header */}
                    <div style={{ 
                      padding: '0.75rem 2rem', 
                      background: 'var(--glass-bg)', 
                      borderBottom: '1px solid var(--border)', 
                      display: 'flex', alignItems: 'center', gap: '1rem', 
                      backdropFilter: 'blur(20px)', zIndex: 10,
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <div 
                        onClick={() => setShowRightPanel(!showRightPanel)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem' }}
                      >
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--plra-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, boxShadow: '0 4px 12px rgba(0, 71, 171, 0.3)' }}>
                          {(activeChatInfo?.contact_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                            {activeChatInfo?.contact_name || selectedChat.split('@')[0]}
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 10px var(--green)' }} />
                            <span style={{ fontSize: '0.65rem', color: 'var(--green)', fontWeight: 900, letterSpacing: '0.05em' }}>SISTEMA ACTIVO</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
                        <button className="icon-btn" style={{ borderRadius: '10px' }}><Phone size={18} /></button>
                        <button className="icon-btn" style={{ borderRadius: '10px' }}><Video size={18} /></button>
                        <button className="icon-btn" style={{ borderRadius: '10px' }} onClick={() => setShowRightPanel(!showRightPanel)}><Info size={18} /></button>
                      </div>
                    </div>

                    {/* Messages Area */}
                    <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ alignSelf: 'center', background: 'var(--accent-subtle)', padding: '6px 16px', borderRadius: '20px', fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 800, marginBottom: '2rem', border: '1px solid var(--border)' }}>
                        HOY
                      </div>
                      {activeChatMessages.map((msg, idx) => {
                        const showTime = idx === 0 || new Date(msg.timestamp).getMinutes() !== new Date(activeChatMessages[idx-1].timestamp).getMinutes();
                        return (
                          <div 
                            key={msg.id} 
                            style={{ 
                              maxWidth: '65%', 
                              alignSelf: msg.is_incoming ? 'flex-start' : 'flex-end',
                              marginBottom: idx < activeChatMessages.length - 1 && activeChatMessages[idx+1].is_incoming === msg.is_incoming ? '2px' : '12px'
                            }}
                          >
                            <motion.div 
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              style={{ 
                                background: msg.is_incoming ? 'var(--surface)' : 'var(--plra-500)',
                                padding: '0.75rem 1rem',
                                borderRadius: msg.is_incoming 
                                  ? (idx > 0 && activeChatMessages[idx-1].is_incoming ? '10px 18px 18px 10px' : '0 18px 18px 18px')
                                  : (idx > 0 && !activeChatMessages[idx-1].is_incoming ? '18px 10px 10px 18px' : '18px 0 18px 18px'),
                                color: msg.is_incoming ? 'var(--text)' : 'white', 
                                border: msg.is_incoming ? '1px solid var(--border)' : 'none',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                position: 'relative'
                              }}
                            >
                              {msg.media_url && (
                                <div style={{ marginBottom: '0.6rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                  {msg.type === 'image' && <img src={msg.media_url} style={{ width: '100%', maxHeight: '350px', objectFit: 'cover' }} />}
                                  {(msg.type === 'video') && <div style={{ background: '#000', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Video size={48} color="white" /></div>}
                                  {(msg.type === 'audio' || msg.type === 'ptt') && (
                                    <div style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                      <Mic size={24} color={msg.is_incoming ? 'var(--plra-500)' : 'white'} />
                                      <audio controls src={msg.media_url} style={{ height: '32px', width: '200px' }} />
                                    </div>
                                  )}
                                </div>
                              )}
                              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5', fontWeight: 500 }}>{msg.body}</p>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                <span style={{ fontSize: '0.6rem', opacity: 0.6, fontWeight: 700 }}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {!msg.is_incoming && <CheckCircle2 size={10} style={{ color: 'rgba(255,255,255,0.8)' }} />}
                              </div>
                            </motion.div>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Quick Replies Bar */}
                    <div style={{ 
                      padding: '0.5rem 2rem', background: 'var(--surface-2)', borderTop: '1px solid var(--border)',
                      display: 'flex', gap: '0.5rem', overflowX: 'auto'
                    }} className="no-scrollbar">
                       {['¿Dónde votas?', 'Confirmar asistencia', 'Solicitar transporte', 'Gracias'].map(text => (
                         <button 
                           key={text}
                           onClick={() => setComposerMessage(text)}
                           style={{ 
                             whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: '8px', 
                             background: 'var(--surface)', border: '1px solid var(--border)',
                             fontSize: '0.7rem', fontWeight: 700, color: 'var(--plra-500)', cursor: 'pointer'
                           }}
                         >
                           {text}
                         </button>
                       ))}
                    </div>

                    {/* Composer Area */}
                    <div style={{ 
                      padding: '1.5rem 2rem', 
                      background: 'var(--surface)', 
                      borderTop: '1px solid var(--border)', 
                      display: 'flex', alignItems: 'center', gap: '1.5rem', 
                      backdropFilter: 'blur(20px)' 
                    }}>
                       <div style={{ display: 'flex', gap: '0.8rem', color: 'var(--text-3)' }}>
                          <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><Smile size={24} /></button>
                          <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}><Paperclip size={24} /></button>
                          <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><MapPin size={24} /></button>
                       </div>
                       <div style={{ flex: 1, position: 'relative' }}>
                          <input 
                            placeholder="Escribe una respuesta estratégica..."
                            value={composerMessage}
                            onChange={e => setComposerMessage(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                            style={{ 
                              width: '100%',
                              background: 'var(--surface-light)', 
                              borderRadius: '16px', 
                              padding: '1rem 1.5rem', 
                              border: '1.5px solid var(--border)',
                              color: 'var(--text)',
                              outline: 'none',
                              fontFamily: 'inherit',
                              fontSize: '0.9rem',
                              transition: 'all 0.2s'
                            }}
                          />
                          <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                             <button 
                                onClick={() => setShowTemplateModal(true)}
                                style={{ 
                                  background: 'var(--plra-500)', border: 'none', borderRadius: '8px', 
                                  padding: '5px 12px', fontSize: '0.65rem', color: 'white', 
                                  fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0, 71, 171, 0.2)'
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
                           width: '54px', height: '54px', borderRadius: '18px', 
                           background: 'var(--plra-500)', 
                           border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                           cursor: 'pointer', boxShadow: '0 10px 25px rgba(0, 71, 171, 0.3)',
                           transition: 'all 0.2s'
                         }}
                         onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                         onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                       >
                         <Send size={24} strokeWidth={2.5} />
                       </button>
                       <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => handleFileUpload(e)} />
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      style={{ textAlign: 'center' }}
                    >
                      <div style={{ 
                        width: '140px', height: '140px', borderRadius: '40px', 
                        background: 'linear-gradient(135deg, var(--plra-600), var(--plra-400))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2.5rem',
                        boxShadow: '0 20px 40px rgba(0, 71, 171, 0.2)', margin: '0 auto 2.5rem'
                      }}>
                         <Smartphone size={72} color="white" strokeWidth={1.5} />
                      </div>
                      <h2 style={{ color: 'var(--text)', fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-display)', marginBottom: '1rem', letterSpacing: '-0.03em' }}>Intelecciones Communications</h2>
                      <p style={{ color: 'var(--text-3)', textAlign: 'center', maxWidth: '380px', fontSize: '0.95rem', lineHeight: '1.6', margin: '0 auto' }}>
                        Conectando el comando central con la estructura de campo en tiempo real. Selecciona un chat para iniciar.
                      </p>
                    </motion.div>
                  </div>
                )
              ) : (
                /* TAB CONTENT: BROADCAST, TEMPLATES, LOGS, SESSION */
                <div style={{ padding: window.innerWidth < 768 ? '1.5rem' : '4rem', flex: 1, overflowY: 'auto' }}>
                   <AnimatePresence mode="wait">
                      {activeTab === 'session' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                          <div style={{ 
                            maxWidth: '640px', margin: '0 auto', padding: '4rem', 
                            background: 'var(--surface)', border: '1px solid var(--border)', 
                            borderRadius: '32px', textAlign: 'center', boxShadow: 'var(--shadow-lg)',
                            position: 'relative', overflow: 'hidden'
                          }}>
                             <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'var(--plra-500)' }} />
                             <div style={{ 
                               width: '80px', height: '80px', borderRadius: '24px', background: 'var(--accent-subtle)',
                               display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: 'var(--plra-500)'
                             }}>
                               <QrCode size={40} />
                             </div>
                             <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', marginBottom: '1rem', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>Enlace de Terminal</h1>
                             <p style={{ color: 'var(--text-3)', marginBottom: '4rem', fontSize: '1rem', fontWeight: 500 }}>Escanea el código para autorizar este nodo de comunicación.</p>
                             
                             <div style={{ 
                                width: '300px', height: '300px', background: 'white', borderRadius: '24px', margin: '0 auto',
                                padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                border: '2px solid var(--border)', boxShadow: 'var(--shadow-md)',
                                position: 'relative'
                             }}>
                                {qrCode ? (
                                  <img src={qrCode} style={{ width: '100%', borderRadius: '12px' }} />
                                ) : (
                                  wsStatus === 'CONNECTED' ? (
                                    <div style={{ textAlign: 'center', color: '#020C1E' }}>
                                       <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', margin: '0 auto 1.5rem', boxShadow: '0 10px 20px rgba(34, 197, 94, 0.3)' }}>
                                          <CheckCircle2 size={48} strokeWidth={3} />
                                       </div>
                                       <p style={{ fontWeight: 900, fontSize: '1.1rem', letterSpacing: '0.1em' }}>TERMINAL VINCULADA</p>
                                    </div>
                                  ) : <Loader2 className="animate-spin" size={64} color="var(--plra-500)" strokeWidth={3} />
                                )}
                             </div>

                             {wsStatus === 'CONNECTED' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                                   <div style={{ background: 'rgba(34, 197, 94, 0.05)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                      <p style={{ color: 'var(--green)', fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>
                                         ✓ Nodo Operativo. Todos los mensajes se están procesando desde esta terminal vinculada.
                                      </p>
                                   </div>
                                   <button 
                                      onClick={() => api.post('/whatsapp/disconnect')} 
                                      style={{ 
                                        background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
                                        color: 'var(--red)', padding: '1rem 3rem', borderRadius: '16px', fontWeight: 900, cursor: 'pointer', fontSize: '0.9rem' 
                                      }}
                                    >
                                      DESCONECTAR NODO
                                    </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
                                   <div style={{ textAlign: 'left', background: 'var(--surface-2)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border)' }}>
                                      <h4 style={{ fontSize: '0.8rem', fontWeight: 900, marginBottom: '0.75rem', color: 'var(--text)' }}>Guía de Conexión:</h4>
                                      <ol style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.8rem', color: 'var(--text-3)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                         <li>Haz clic en <strong>Generar QR</strong>.</li>
                                         <li>Abre WhatsApp en tu celular.</li>
                                         <li>Ve a <strong>Dispositivos vinculados</strong>.</li>
                                         <li>Escanea el código que aparecerá arriba.</li>
                                      </ol>
                                   </div>
                                   <button 
                                      onClick={handleConnect} 
                                      disabled={wsStatus === 'CONNECTING' && !qrCode}
                                      style={{ 
                                        width: '100%', background: 'var(--plra-500)', border: 'none',
                                        color: 'white', padding: '1.25rem', borderRadius: '16px', fontWeight: 900, cursor: 'pointer',
                                        boxShadow: '0 15px 35px rgba(0, 71, 171, 0.3)', fontSize: '1rem', letterSpacing: '0.02em',
                                        opacity: (wsStatus === 'CONNECTING' && !qrCode) ? 0.6 : 1
                                      }}
                                    >
                                      {wsStatus === 'CONNECTING' ? 'INICIALIZANDO...' : 'GENERAR QR DE ACCESO'}
                                    </button>
                                </div>
                              )}
                          </div>
                        </motion.div>
                      )}

                      {activeTab === 'broadcast' && (
                        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '4rem' }}>
                              <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'var(--plra-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 8px 20px rgba(0, 71, 171, 0.3)' }}>
                                 <Send size={28} />
                              </div>
                              <div>
                                <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', margin: 0 }}>Broadcast Estratégico</h2>
                                <p style={{ margin: 0, color: 'var(--text-3)', fontWeight: 600 }}>Envío masivo segmentado de alta precisión</p>
                              </div>
                           </div>
                           
                           <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2.5rem' }}>
                              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '2.5rem', boxShadow: 'var(--shadow-md)' }}>
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                    <div>
                                       <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Seleccionar Plantilla Táctica</label>
                                       <select 
                                         style={{ 
                                           width: '100%', padding: '1rem', borderRadius: '12px', background: 'var(--surface-2)', 
                                           border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 700,
                                           appearance: 'none', cursor: 'pointer'
                                         }}
                                         value={broadcastSettings.template_id}
                                         onChange={e => setBroadcastSettings(prev => ({ ...prev, template_id: e.target.value }))}
                                       >
                                         <option value="" style={{ background: 'var(--surface)', color: 'var(--text)' }}>Elegir mensaje pre-diseñado...</option>
                                         {templates.map(t => <option key={t.id} value={t.id} style={{ background: 'var(--surface)', color: 'var(--text)' }}>{t.name}</option>)}
                                       </select>
                                    </div>
                                    <div>
                                       <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Criterio de Segmentación</label>
                                       <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                          <button 
                                            onClick={() => setBroadcastSettings(p => ({ ...p, target_type: 'ROLE' }))} 
                                            style={{ 
                                              flex: 1, padding: '1rem', borderRadius: '12px', border: '1.5px solid var(--border)', 
                                              background: broadcastSettings.target_type === 'ROLE' ? 'var(--plra-500)' : 'var(--surface-2)', 
                                              color: broadcastSettings.target_type === 'ROLE' ? 'white' : 'var(--text-2)',
                                              fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
                                            }}
                                          >JERARQUÍA</button>
                                          <button 
                                            onClick={() => setBroadcastSettings(p => ({ ...p, target_type: 'TRAFFIC' }))} 
                                            style={{ 
                                              flex: 1, padding: '1rem', borderRadius: '12px', border: '1.5px solid var(--border)', 
                                              background: broadcastSettings.target_type === 'TRAFFIC' ? 'var(--plra-500)' : 'var(--surface-2)', 
                                              color: broadcastSettings.target_type === 'TRAFFIC' ? 'white' : 'var(--text-2)',
                                              fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
                                            }}
                                          >ESTATUS (SEMÁFORO)</button>
                                       </div>
                                       {broadcastSettings.target_type === 'ROLE' ? (
                                         <select style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: 'var(--surface-2)', border: '1.5px solid var(--border)', color: 'var(--text)', fontWeight: 700 }} value={broadcastSettings.target_role} onChange={e => setBroadcastSettings(p => ({ ...p, target_role: e.target.value }))}>
                                           <option value="ALL">Todo el Contingente Electoral</option>
                                           <option value="COORDINADOR">Solo Coordinadores de Zona</option>
                                           <option value="PADRINO">Solo Padrinos de Voto</option>
                                         </select>
                                       ) : (
                                         <select style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: 'var(--surface-2)', border: '1.5px solid var(--border)', color: 'var(--text)', fontWeight: 700 }} value={broadcastSettings.traffic_light} onChange={e => setBroadcastSettings(p => ({ ...p, traffic_light: e.target.value }))}>
                                           <option value="ALL">Todo el Padrón Identificado</option>
                                           <option value="GREEN">Simpatizantes (Verdes)</option>
                                           <option value="YELLOW">Indecisos (Amarillos)</option>
                                         </select>
                                       )}
                                    </div>
                                 </div>
                                 <button 
                                    onClick={async () => {
                                      if (!broadcastSettings.template_id) return alert('Elige una plantilla');
                                      await api.post('/whatsapp/broadcast', broadcastSettings);
                                      alert('Transmisión Iniciada');
                                      setActiveTab('logs');
                                    }}
                                    style={{ 
                                      width: '100%', marginTop: '3.5rem', height: '4.5rem', 
                                      background: 'var(--plra-500)', border: 'none', color: 'white',
                                      borderRadius: '16px', fontWeight: 900, fontSize: '1.1rem', letterSpacing: '0.05em',
                                      cursor: 'pointer', boxShadow: '0 15px 35px rgba(0, 71, 171, 0.3)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem'
                                    }}
                                  >
                                    <Send size={24} /> DESPLEGAR OPERATIVO
                                  </button>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                 <div style={{ background: '#020C1E', borderRadius: '24px', padding: '2rem', color: 'white' }}>
                                    <h4 style={{ margin: '0 0 1.5rem', fontSize: '1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                       <Shield size={20} color="var(--green)" /> Protocolo de Seguridad
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                       {[
                                         'Delay aleatorio inteligente entre envíos.',
                                         'Variables dinámicas por contacto.',
                                         'Rotación de terminales activa.',
                                         'Monitoreo de reportes en tiempo real.'
                                       ].map(tip => (
                                         <div key={tip} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                            <CheckCircle2 size={16} color="var(--green)" style={{ marginTop: '2px' }} />
                                            <span style={{ fontSize: '0.85rem', opacity: 0.8, lineHeight: '1.4' }}>{tip}</span>
                                         </div>
                                       ))}
                                    </div>
                                 </div>
                                 <div style={{ background: 'var(--accent-subtle)', borderRadius: '24px', padding: '2rem', border: '1px dashed var(--border)' }}>
                                    <h4 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 800 }}>Métricas de Alcance</h4>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-3)', lineHeight: '1.5' }}>Tu capacidad actual de envío es de <strong>2,500 mensajes/día</strong> basado en la reputación de tu terminal.</p>
                                 </div>
                              </div>
                           </div>
                        </motion.div>
                      )}

                      {/* TEMPLATES & LOGS Overhaul */}
                      {activeTab === 'templates' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                 <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--plra-500)' }}>
                                    <FileText size={28} />
                                 </div>
                                 <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>Biblioteca de Estrategias</h2>
                              </div>
                              <button 
                                onClick={() => setShowTemplateModal(true)} 
                                style={{ 
                                  padding: '1rem 2rem', borderRadius: '16px', background: 'var(--plra-500)', 
                                  border: 'none', color: 'white', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem',
                                  boxShadow: '0 10px 20px rgba(0, 71, 171, 0.2)'
                                }}
                              >
                                 <Plus size={20} /> NUEVA ESTRATEGIA
                              </button>
                           </div>
                           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '2rem' }}>
                              {templates.map(t => (
                                <div key={t.id} style={{ 
                                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '2rem',
                                  boxShadow: 'var(--shadow-sm)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                  position: 'relative'
                                }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                         <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--plra-500)' }}>
                                            {t.media_type === 'IMAGE' && <ImageIcon size={22} />}
                                            {t.media_type === 'TEXT' && <FileText size={22} />}
                                         </div>
                                         <span style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{t.name}</span>
                                      </div>
                                      <button onClick={() => api.delete(`/whatsapp/templates/${t.id}`).then(fetchData)} style={{ background: 'none', border: 'none', color: 'var(--red)', opacity: 0.3, cursor: 'pointer' }}><Trash2 size={20} /></button>
                                   </div>
                                   <div style={{ 
                                     padding: '1.25rem', borderRadius: '16px', background: 'var(--surface-2)', border: '1px solid var(--border)',
                                     fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: '1.7', fontStyle: 'italic', position: 'relative'
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
                           <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '4rem' }}>
                              <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
                                 <BarChart3 size={28} />
                              </div>
                              <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>Centro de Inteligencia</h2>
                           </div>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                              {broadcastLogs.map(log => (
                                <div key={log.id} style={{ 
                                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '2rem',
                                  boxShadow: 'var(--shadow-sm)', display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '2rem', alignItems: 'center'
                                }}>
                                   <div>
                                      <h4 style={{ margin: 0, color: 'var(--text)', fontSize: '1.1rem', fontWeight: 900 }}>{log.template_name}</h4>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                                         <Clock size={14} style={{ color: 'var(--text-3)' }} />
                                         <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 700 }}>{new Date(log.timestamp).toLocaleDateString()}</span>
                                      </div>
                                   </div>
                                   <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.6rem' }}>
                                         <span style={{ color: 'var(--text-3)', fontWeight: 800 }}>EFECTIVIDAD DE ENTREGA</span>
                                         <span style={{ color: 'var(--text)', fontWeight: 900 }}>{Math.round((log.success_count / log.target_count) * 100)}%</span>
                                      </div>
                                      <div style={{ width: '100%', height: '10px', background: 'var(--surface-2)', borderRadius: '5px', overflow: 'hidden' }}>
                                         <motion.div initial={{ width: 0 }} animate={{ width: `${(log.success_count / log.target_count) * 100}%` }} style={{ height: '100%', background: 'linear-gradient(90deg, var(--plra-500), var(--green))' }} />
                                      </div>
                                   </div>
                                   <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'flex-end' }}>
                                      <div style={{ textAlign: 'right' }}>
                                         <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-3)' }}>ENTREGADOS</div>
                                         <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--green)' }}>{log.success_count}</div>
                                      </div>
                                      <div style={{ textAlign: 'right' }}>
                                         <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-3)' }}>FALLIDOS</div>
                                         <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--red)' }}>{log.fail_count}</div>
                                      </div>
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

            {/* RIGHT PANEL: CONTACT INTELLIGENCE (WHATICKET STYLE) */}
            <AnimatePresence>
              {showRightPanel && selectedChat && (
                <motion.div 
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 340, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  style={{ 
                    background: 'var(--surface)', 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowX: 'hidden'
                  }}
                >
                  <div className="custom-scrollbar" style={{ width: 340, padding: '2.5rem', flex: 1, overflowY: 'auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                       <div style={{ 
                         width: '100px', height: '100px', borderRadius: '30px', 
                         background: 'linear-gradient(135deg, var(--plra-500), var(--plra-300))',
                         display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                         fontSize: '2.5rem', fontWeight: 900, margin: '0 auto 1.5rem',
                         boxShadow: '0 10px 25px rgba(0, 71, 171, 0.2)'
                       }}>
                         {(activeChatInfo?.contact_name || 'U').charAt(0).toUpperCase()}
                       </div>
                       <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)' }}>
                         {activeChatInfo?.contact_name || selectedChat.split('@')[0]}
                       </h3>
                       <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-3)', fontWeight: 600 }}>{selectedChat.split('@')[0]}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2.5rem' }}>
                       <button style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer' }}><Phone size={18} color="var(--text-3)" /></button>
                       <button style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer' }}><Video size={18} color="var(--text-3)" /></button>
                       <button style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer' }}><Star size={18} color="var(--yellow)" /></button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                       <div>
                          <h4 style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Inteligencia de Campo</h4>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {contactIntel ? (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '12px', background: 'var(--accent-subtle)' }}>
                                     <MapPin size={16} color="var(--plra-500)" />
                                     <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{contactIntel.data.local_votacion || 'S/D'}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.05)' }}>
                                     <Hash size={16} color="var(--green)" />
                                     <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>CI: {contactIntel.data.ci || contactIntel.data.username}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '12px', background: 'var(--surface-light)' }}>
                                     <Activity size={16} color="var(--plra-300)" />
                                     <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Mesa {contactIntel.data.mesa || '-'} / Orden {contactIntel.data.orden || '-'}</span>
                                  </div>
                                  {contactIntel.data.coordinator_name && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.05)' }}>
                                      <User size={16} color="var(--plra-500)" />
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{contactIntel.data.coordinator_name}</span>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 700 }}>{contactIntel.data.coordinator_role}</span>
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div style={{ padding: '1rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '12px' }}>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontStyle: 'italic' }}>Contacto no identificado en el padrón</span>
                                </div>
                              )}
                           </div>
                        </div>
                       </div>

                       <div>
                          <h4 style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Etiquetas Tácticas</h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                             {['PADRÓN', 'MOVILIZADOR', 'LÍDER', 'ZONA A'].map(tag => (
                               <div key={tag} style={{ padding: '4px 10px', borderRadius: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-2)' }}>
                                 {tag}
                               </div>
                             ))}
                             <button style={{ padding: '4px 8px', borderRadius: '6px', background: 'none', border: '1px dashed var(--border)', color: 'var(--text-3)', cursor: 'pointer' }}><Plus size={12} /></button>
                          </div>
                       </div>

                       <div>
                          <h4 style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Historial de Campañas</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                             <div style={{ fontSize: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', color: 'var(--text-2)' }}>• Lanzamiento Regional (24/04)</div>
                             <div style={{ fontSize: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', color: 'var(--text-2)' }}>• Invitación Comité (02/05)</div>
                          </div>
                        </div>
                     </div>
                 </motion.div>
               )}
            </AnimatePresence>
            </div>
          </div>
        </div>

      {/* MODAL: CREATE TEMPLATE */}
      <AnimatePresence>
        {showTemplateModal && (
          <div style={{ 
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', 
            backdropFilter: 'blur(12px)', zIndex: 10000, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' 
          }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ 
                width: '100%', maxWidth: '560px', background: 'var(--surface)', 
                border: '1px solid var(--border)', borderRadius: '32px', padding: '3rem',
                boxShadow: 'var(--shadow-lg)', position: 'relative'
              }}
            >
               <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text)', marginBottom: '2.5rem', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>Nueva Estrategia de Mensaje</h2>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Identificador de Campaña</label>
                    <input 
                      style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: 'var(--surface-2)', border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: '0.95rem', fontWeight: 700 }}
                      placeholder="Ej: Invitación Mitín Central"
                      value={newTemplate.name} 
                      onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))} 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Tipo de Contenido</label>
                    <select 
                      style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: 'var(--surface-2)', border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: '0.95rem', fontWeight: 700 }}
                      value={newTemplate.media_type} 
                      onChange={e => setNewTemplate(p => ({ ...p, media_type: e.target.value }))}
                    >
                       <option value="TEXT" style={{ background: 'var(--surface)', color: 'var(--text)' }}>Solo Texto Estratégico</option>
                       <option value="IMAGE" style={{ background: 'var(--surface)', color: 'var(--text)' }}>Imagen de Campaña</option>
                       <option value="VIDEO" style={{ background: 'var(--surface)', color: 'var(--text)' }}>Video de Candidato</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Cuerpo del Mensaje (Soporta {"{{nombre}}, {{ci}}, {{local}}, {{mesa}}, {{orden}}"})</label>
                    <textarea 
                      style={{ width: '100%', height: '150px', padding: '1rem', borderRadius: '12px', background: 'var(--surface-2)', border: '1.5px solid var(--border)', color: 'var(--text)', resize: 'none', fontSize: '0.95rem', fontWeight: 600, lineHeight: '1.6' }}
                      placeholder="Hola {{nombre}}, te invitamos a ser parte del cambio..."
                      value={newTemplate.content} 
                      onChange={e => setNewTemplate(p => ({ ...p, content: e.target.value }))} 
                    />
                  </div>
               </div>

               <div style={{ display: 'flex', gap: '1.25rem', marginTop: '3.5rem' }}>
                  <button 
                    onClick={() => setShowTemplateModal(false)} 
                    style={{ flex: 1, padding: '1.25rem', borderRadius: '16px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)', fontWeight: 800, cursor: 'pointer' }}
                  >CANCELAR</button>
                  <button 
                    onClick={async () => {
                      if (!newTemplate.name || !newTemplate.content) return alert('Completa los campos estratégicos');
                      await api.post('/whatsapp/templates', newTemplate);
                      setShowTemplateModal(false);
                      setNewTemplate({ name: '', content: '', media_url: '', media_type: 'TEXT', lat: -25.2637, lng: -57.5759, contact_name: '', contact_phone: '' });
                      fetchData();
                    }}
                    style={{ flex: 1, padding: '1.25rem', borderRadius: '16px', background: 'var(--plra-500)', border: 'none', color: 'white', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 25px rgba(0, 71, 171, 0.3)' }}
                  >GUARDAR ESTRATEGIA</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>




          {/* NEW TERMINAL MODAL */}
          {showNewTerminalModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '2rem' }}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ width: '100%', maxWidth: '400px', background: 'var(--surface)', borderRadius: '24px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>Nueva Terminal de WhatsApp</h3>
                  <button onClick={() => setShowNewTerminalModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>ID Unico (ej: prensa, logística)</label>
                    <input 
                      type="text" 
                      value={newTerminalData.id} 
                      onChange={e => setNewTerminalData(p => ({ ...p, id: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                      placeholder="id_de_la_linea"
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'white' }} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Nombre de la Terminal</label>
                    <input 
                      type="text" 
                      value={newTerminalData.name} 
                      onChange={e => setNewTerminalData(p => ({ ...p, name: e.target.value }))}
                      placeholder="Ej: Terminal de Prensa"
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'white' }} 
                    />
                  </div>
                </div>
                <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', display: 'flex', gap: '1rem' }}>
                  <button onClick={() => setShowNewTerminalModal(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', fontWeight: 800 }}>Cancelar</button>
                  <button 
                    onClick={async () => {
                      if (!newTerminalData.id || !newTerminalData.name) return;
                      await api.post('/whatsapp/terminals', newTerminalData);
                      fetchData();
                      setShowNewTerminalModal(false);
                      setNewTerminalData({ id: '', name: '' });
                    }} 
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', background: 'var(--plra-500)', border: 'none', color: 'white', fontWeight: 900 }}
                  >
                    CREAR TERMINAL
                  </button>
                </div>
              </motion.div>
            </div>
          )}
      </MainLayout>
    );
};

export default Communications;
