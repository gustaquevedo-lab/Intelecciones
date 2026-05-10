import React, { useState, useEffect, useRef, useCallback } from 'react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, QrCode, Send, Users, FileText,
  CheckCircle2, AlertCircle, RefreshCw, Smartphone,
  Search, Plus, Trash2, Image as ImageIcon, Video,
  Mic, MapPin, X, Loader2, ChevronRight, ChevronDown,
  BarChart3, Paperclip, MoreVertical, Phone, Info,
  User, Tag, Hash, Calendar, ExternalLink, ChevronLeft,
  Star, Flag, Zap, Radio, Target, Eye, EyeOff,
  CheckSquare, Square, UserCheck, Users2, Volume2,
  ArrowLeft, Clock, TrendingUp, Wifi, WifiOff, Edit3,
  Copy, Play, Pause, CornerDownLeft
} from 'lucide-react';
import api from '../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Template {
  id: number;
  name: string;
  content: string;
  media_url?: string;
  media_type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'VOICE' | 'LOCATION' | 'CONTACT';
  lat?: number;
  lng?: number;
  contact_name?: string;
  contact_phone?: string;
}

interface Terminal {
  id: string;
  name: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';
  last_qr?: string;
}

interface Chat {
  contact_number: string;
  contact_name: string;
  last_message: string;
  timestamp: string;
  is_incoming: number;
  unread_count?: number;
}

interface Message {
  id: number;
  contact_number: string;
  contact_name?: string;
  body: string;
  type: string;
  media_url?: string;
  is_incoming: number;
  timestamp: string;
}

interface Coordinator {
  id: number;
  nombre: string;
  telefono: string;
  ci: string;
  distrito?: string;
  assigned_list_id?: number;
  list_number?: string;
  candidate_alias?: string;
  ciudad?: string;
  capture_count: number;
}

interface Padrino {
  id: number;
  nombre: string;
  telefono: string;
  ci: string;
  distrito?: string;
  assigned_list_id?: number;
  list_number?: string;
  candidate_alias?: string;
  ciudad?: string;
  coordinator_count: number;
  total_captures: number;
}

interface ElectorTarget {
  capture_id: number;
  elector_ci: string;
  telefono: string;
  traffic_light: string;
  nombre: string;
  apellido?: string;
  local_votacion: string;
  mesa: number;
  orden: number;
  coordinator_id?: number;
  coordinator_nombre?: string;
}

interface ContactIntel {
  type: 'ELECTOR' | 'USER';
  data: any;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ELECTORAL_TEMPLATES = [
  {
    name: '📍 Local de Votación',
    content: 'Hola {{nombre}}! 👋 Tu local de votación es *{{local}}*, Mesa N° *{{mesa}}*, Orden *{{orden}}*. ¡No olvides votar este domingo! 🗳️'
  },
  {
    name: '⏰ Recordatorio Día D',
    content: 'Buenos días {{nombre}}! 🌅 Hoy es el gran día. Las mesas abren a las 07:00 y cierran a las 17:00. Tu mesa: *{{local}}* — Mesa *{{mesa}}*. ¡Contamos contigo! 💪'
  },
  {
    name: '🚗 Transporte Disponible',
    content: 'Hola {{nombre}}! Te informamos que contamos con *transporte gratuito* hacia tu local de votación ({{local}}). Comunícate al número de tu coordinador para coordinar. ¡Tu voto importa! 🗳️'
  },
  {
    name: '✅ Confirmación de Apoyo',
    content: 'Gracias {{nombre}} por confirmar tu apoyo! 🙏 Recuerda: tu local es *{{local}}*, Mesa *{{mesa}}*, Orden *{{orden}}*. ¡Juntos ganaremos! 💙'
  },
  {
    name: '📢 Convocatoria Equipo',
    content: 'Hola {{nombre}}! 📣 Te convocamos a nuestra reunión de equipo. Por favor confirma tu asistencia respondiendo este mensaje. ¡Tu participación es fundamental! 🤝'
  },
  {
    name: '🎯 Acción Urgente',
    content: '⚡ URGENTE {{nombre}} — Necesitamos tu acción inmediata. Por favor comunícate con tu coordinador a la brevedad. ¡Gracias por tu compromiso! 💪'
  }
];

const TRAFFIC_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  VERDE:    { bg: 'rgba(34,197,94,0.15)',  text: '#22c55e', label: 'Verde' },
  AMARILLO: { bg: 'rgba(234,179,8,0.15)',  text: '#eab308', label: 'Amarillo' },
  ROJO:     { bg: 'rgba(239,68,68,0.15)',  text: '#ef4444', label: 'Rojo' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const colors = {
    CONNECTED: '#22c55e',
    CONNECTING: '#f59e0b',
    DISCONNECTED: '#6b7280'
  };
  return (
    <span style={{
      display: 'inline-block',
      width: '8px', height: '8px', borderRadius: '50%',
      background: colors[status as keyof typeof colors] || '#6b7280',
      boxShadow: status === 'CONNECTED' ? '0 0 6px #22c55e' : 'none'
    }} />
  );
};

const TrafficBadge: React.FC<{ light: string }> = ({ light }) => {
  const c = TRAFFIC_COLORS[light];
  if (!c) return null;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 800,
      background: c.bg, color: c.text, textTransform: 'uppercase'
    }}>{c.label}</span>
  );
};

// ─── Contact Intelligence Panel ──────────────────────────────────────────────

const ContactIntelPanel: React.FC<{ phone: string; onClose: () => void }> = ({ phone, onClose }) => {
  const [intel, setIntel] = useState<ContactIntel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/admin/verify-phone/${phone}`)
      .then(r => setIntel(r.data))
      .catch(() => setIntel(null))
      .finally(() => setLoading(false));
  }, [phone]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      style={{
        width: '260px', flexShrink: 0,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--plra-300)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Inteligencia de Contacto
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: '1rem', flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--plra-300)' }} />
          </div>
        ) : !intel ? (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: '0.75rem', padding: '1.5rem 0' }}>
            <UserCheck size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
            <p>Contacto no registrado</p>
          </div>
        ) : intel.type === 'ELECTOR' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{
              padding: '0.75rem', borderRadius: '10px',
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)'
            }}>
              <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Elector Registrado
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)' }}>
                {intel.data.nombre} {intel.data.apellido || ''}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-2)', marginTop: '0.15rem' }}>CI: {intel.data.ci}</div>
            </div>
            {intel.data.traffic_light && <TrafficBadge light={intel.data.traffic_light} />}
            {[
              { icon: MapPin, label: 'Local', value: intel.data.local_votacion },
              { icon: Hash, label: 'Mesa', value: intel.data.mesa },
              { icon: Tag, label: 'Orden', value: intel.data.orden },
              { icon: UserCheck, label: 'Coordinador', value: intel.data.coordinator_name || '—' }
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon size={12} style={{ color: 'var(--plra-300)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{
              padding: '0.75rem', borderRadius: '10px',
              background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)'
            }}>
              <div style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--plra-300)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                {intel.data.role}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)' }}>
                {intel.data.nombre}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-2)' }}>CI: {intel.data.ci}</div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Inbox Tab ────────────────────────────────────────────────────────────────

const InboxTab: React.FC<{ terminalId: string }> = ({ terminalId }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [composerMsg, setComposerMsg] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [showIntel, setShowIntel] = useState(false);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadChats = useCallback(() => {
    api.get('/whatsapp/chats').then(r => setChats(r.data)).catch(() => {});
  }, []);

  const loadMessages = useCallback((number: string) => {
    api.get('/whatsapp/messages').then(r => {
      setMessages(r.data.filter((m: Message) => m.contact_number === number));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadChats();
    const t = setInterval(loadChats, 10000);
    return () => clearInterval(t);
  }, [loadChats]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat);
      const t = setInterval(() => loadMessages(selectedChat), 5000);
      return () => clearInterval(t);
    }
  }, [selectedChat, loadMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!composerMsg.trim() || !selectedChat || sending) return;
    setSending(true);
    try {
      await api.post('/whatsapp/direct-message', {
        number: selectedChat, message: composerMsg, terminalId
      });
      setComposerMsg('');
      loadMessages(selectedChat);
      loadChats();
    } catch {}
    setSending(false);
  };

  const filteredChats = chats.filter(c =>
    !searchQ || c.contact_name.toLowerCase().includes(searchQ.toLowerCase()) ||
    c.contact_number.includes(searchQ)
  );

  const selectedChatData = chats.find(c => c.contact_number === selectedChat);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday
      ? d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('es', { day: '2-digit', month: 'short' });
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
      {/* Chat list */}
      <div style={{
        width: '280px', flexShrink: 0,
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--surface)'
      }}>
        <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'var(--input-bg)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '0.4rem 0.6rem'
          }}>
            <Search size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Buscar conversación..."
              style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontSize: '0.75rem', color: 'var(--text)' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredChats.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.75rem' }}>
              <MessageSquare size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
              Sin conversaciones
            </div>
          ) : filteredChats.map(chat => (
            <button
              key={chat.contact_number}
              onClick={() => { setSelectedChat(chat.contact_number); setShowIntel(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: selectedChat === chat.contact_number
                  ? 'rgba(59,130,246,0.1)' : 'transparent',
                borderLeft: selectedChat === chat.contact_number
                  ? '3px solid var(--plra-300)' : '3px solid transparent',
                transition: 'background 0.15s'
              }}
            >
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--plra-500), var(--plra-300))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', fontWeight: 800, color: 'white'
              }}>
                {chat.contact_name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {chat.contact_name}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', flexShrink: 0, marginLeft: '0.3rem' }}>
                    {formatTime(chat.timestamp)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}>
                  {!chat.is_incoming && <CornerDownLeft size={10} style={{ color: 'var(--text-3)', flexShrink: 0 }} />}
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {chat.last_message}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat view */}
      {!selectedChat ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', flexDirection: 'column', gap: '0.5rem' }}>
          <MessageSquare size={40} style={{ opacity: 0.2 }} />
          <span style={{ fontSize: '0.8rem' }}>Selecciona una conversación</span>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Chat header */}
            <div style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              background: 'var(--surface)'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--plra-500), var(--plra-300))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 800, color: 'white', flexShrink: 0
              }}>
                {selectedChatData?.contact_name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)' }}>
                  {selectedChatData?.contact_name}
                </div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>{selectedChat}</div>
              </div>
              <button
                onClick={() => setShowIntel(!showIntel)}
                title="Ver inteligencia de contacto"
                style={{
                  background: showIntel ? 'rgba(59,130,246,0.15)' : 'var(--surface-light)',
                  border: '1px solid var(--border)', borderRadius: '8px',
                  color: showIntel ? 'var(--plra-300)' : 'var(--text-2)',
                  padding: '0.4rem', cursor: 'pointer', display: 'flex'
                }}
              >
                <Info size={15} />
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {messages.map(msg => (
                <div key={msg.id} style={{
                  display: 'flex',
                  justifyContent: msg.is_incoming ? 'flex-start' : 'flex-end'
                }}>
                  <div style={{
                    maxWidth: '70%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: msg.is_incoming ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                    background: msg.is_incoming
                      ? 'var(--surface-light)'
                      : 'linear-gradient(135deg, var(--plra-500), var(--plra-400))',
                    color: msg.is_incoming ? 'var(--text)' : 'white',
                    fontSize: '0.8rem', lineHeight: '1.4'
                  }}>
                    {msg.media_url && (
                      <a href={msg.media_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginBottom: '0.25rem', color: 'inherit', opacity: 0.8, fontSize: '0.7rem' }}>
                        <Paperclip size={10} style={{ display: 'inline', marginRight: '0.25rem' }} />
                        Archivo adjunto
                      </a>
                    )}
                    <div>{msg.body}</div>
                    <div style={{ fontSize: '0.55rem', opacity: 0.6, marginTop: '0.25rem', textAlign: 'right' }}>
                      {new Date(msg.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Composer */}
            <div style={{
              padding: '0.75rem', borderTop: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex', gap: '0.5rem', alignItems: 'flex-end'
            }}>
              <textarea
                value={composerMsg}
                onChange={e => setComposerMsg(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter nueva línea)"
                rows={2}
                style={{
                  flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '0.5rem 0.75rem',
                  color: 'var(--text)', fontSize: '0.8rem', outline: 'none',
                  resize: 'none', lineHeight: '1.4', fontFamily: 'var(--font-body)'
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!composerMsg.trim() || sending}
                style={{
                  background: 'var(--plra-500)', border: 'none', borderRadius: '10px',
                  color: 'white', padding: '0.6rem 0.9rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: !composerMsg.trim() || sending ? 0.5 : 1
                }}
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>

          {/* Contact Intel Sidebar */}
          <AnimatePresence>
            {showIntel && (
              <ContactIntelPanel phone={selectedChat} onClose={() => setShowIntel(false)} />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

// ─── Recipient Selector ───────────────────────────────────────────────────────

interface RecipientSelectorProps {
  selected: Set<string>;
  onToggle: (phone: string, meta?: any) => void;
  onSelectAll: (phones: string[], meta?: any[]) => void;
  onClearAll: () => void;
}

const RecipientSelector: React.FC<RecipientSelectorProps> = ({ selected, onToggle, onSelectAll, onClearAll }) => {
  const [mode, setMode] = useState<'role' | 'padrino' | 'coordinator' | 'search'>('role');
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [padrinos, setPadrinos] = useState<Padrino[]>([]);
  const [expandedPadrino, setExpandedPadrino] = useState<number | null>(null);
  const [padrinoTeam, setPadrinoTeam] = useState<{ coordinators: Coordinator[]; electors: ElectorTarget[] } | null>(null);
  const [coordElectors, setCoordElectors] = useState<Record<number, ElectorTarget[]>>({});
  const [expandedCoord, setExpandedCoord] = useState<number | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<{ users: any[]; electors: any[] } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    api.get('/whatsapp/recipients/coordinators').then(r => setCoordinators(r.data)).catch(() => {});
    api.get('/whatsapp/recipients/padrinos').then(r => setPadrinos(r.data)).catch(() => {});
  }, []);

  const loadPadrinoTeam = async (id: number) => {
    if (expandedPadrino === id) { setExpandedPadrino(null); setPadrinoTeam(null); return; }
    setExpandedPadrino(id);
    const r = await api.get(`/whatsapp/recipients/padrinos/${id}/team`);
    setPadrinoTeam(r.data);
  };

  const loadCoordElectors = async (id: number) => {
    if (expandedCoord === id) { setExpandedCoord(null); return; }
    setExpandedCoord(id);
    if (!coordElectors[id]) {
      const r = await api.get(`/whatsapp/recipients/coordinator/${id}/electors`);
      setCoordElectors(prev => ({ ...prev, [id]: r.data }));
    }
  };

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults(null); return; }
    setSearchLoading(true);
    try {
      const r = await api.get(`/whatsapp/recipients/search?q=${encodeURIComponent(q)}`);
      setSearchResults(r.data);
    } catch {}
    setSearchLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQ), 400);
    return () => clearTimeout(t);
  }, [searchQ, doSearch]);

  const MODES = [
    { id: 'role', label: 'Por Rol', icon: Users },
    { id: 'padrino', label: 'Padrinos', icon: Star },
    { id: 'coordinator', label: 'Coordinadores', icon: UserCheck },
    { id: 'search', label: 'Buscar', icon: Search },
  ] as const;

  const allCoordPhones = coordinators.filter(c => c.telefono).map(c => c.telefono);
  const allPadrinoPhones = padrinos.filter(p => p.telefono).map(p => p.telefono);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Mode switcher */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--surface-light)', padding: '3px', borderRadius: '10px' }}>
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
              padding: '0.4rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700,
              background: mode === m.id ? 'var(--plra-500)' : 'transparent',
              color: mode === m.id ? 'white' : 'var(--text-2)',
              transition: 'all 0.15s'
            }}
          >
            <m.icon size={12} />
            <span className="hidden-mobile">{m.label}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>
          <strong style={{ color: 'var(--plra-300)' }}>{selected.size}</strong> destinatario{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
        </span>
        {selected.size > 0 && (
          <button onClick={onClearAll} style={{ fontSize: '0.65rem', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Limpiar todo
          </button>
        )}
      </div>

      {/* Role mode */}
      {mode === 'role' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { role: 'ALL', label: '🌎 Todos los usuarios con teléfono', count: null },
            { role: 'PADRINO', label: '⭐ Todos los Padrinos', phones: allPadrinoPhones },
            { role: 'COORDINADOR', label: '👤 Todos los Coordinadores', phones: allCoordPhones },
          ].map(item => (
            <div key={item.role} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.6rem 0.75rem', borderRadius: '8px',
              background: 'var(--surface-light)', border: '1px solid var(--border)'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>{item.label}</span>
              {item.phones && (
                <button
                  onClick={() => onSelectAll(item.phones!)}
                  style={{
                    padding: '0.25rem 0.6rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    background: 'var(--plra-500)', color: 'white', fontSize: '0.65rem', fontWeight: 700
                  }}
                >
                  Seleccionar ({item.phones.length})
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Padrino tree */}
      {mode === 'padrino' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '380px', overflowY: 'auto' }}>
          {padrinos.map(p => (
            <div key={p.id}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.75rem', borderRadius: '8px',
                background: expandedPadrino === p.id ? 'rgba(59,130,246,0.08)' : 'var(--surface-light)',
                border: `1px solid ${expandedPadrino === p.id ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={!!p.telefono && selected.has(p.telefono)}
                  onChange={() => p.telefono && onToggle(p.telefono, { nombre: p.nombre })}
                  style={{ cursor: 'pointer', accentColor: 'var(--plra-500)' }}
                  onClick={e => e.stopPropagation()}
                />
                <div style={{ flex: 1 }} onClick={() => loadPadrinoTeam(p.id)}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>{p.nombre}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>
                    {p.coordinator_count} coordinadores · {p.total_captures} capturas
                    {p.telefono ? ` · ${p.telefono}` : ' · Sin teléfono'}
                  </div>
                </div>
                <div onClick={() => loadPadrinoTeam(p.id)} style={{ color: 'var(--text-3)' }}>
                  {expandedPadrino === p.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </div>

              {expandedPadrino === p.id && padrinoTeam && (
                <div style={{ marginLeft: '1rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {/* Coordinators */}
                  {padrinoTeam.coordinators.map((c: Coordinator) => (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.4rem 0.6rem', borderRadius: '6px',
                      background: 'var(--surface)', border: '1px solid var(--border)'
                    }}>
                      <input type="checkbox" checked={!!c.telefono && selected.has(c.telefono)}
                        onChange={() => c.telefono && onToggle(c.telefono, { nombre: c.nombre })}
                        style={{ cursor: 'pointer', accentColor: 'var(--plra-500)' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text)' }}>{c.nombre}</div>
                        <div style={{ fontSize: '0.58rem', color: 'var(--text-3)' }}>
                          Coordinador · {c.capture_count} capturas{c.telefono ? ` · ${c.telefono}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Electors with phones */}
                  {padrinoTeam.electors.length > 0 && (
                    <div style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-2)' }}>
                          Electores registrados ({padrinoTeam.electors.length})
                        </span>
                        <button
                          onClick={() => onSelectAll(padrinoTeam!.electors.map(e => e.telefono), padrinoTeam!.electors)}
                          style={{ fontSize: '0.6rem', padding: '0.15rem 0.4rem', borderRadius: '4px', border: 'none', background: 'var(--plra-500)', color: 'white', cursor: 'pointer' }}
                        >
                          Todos
                        </button>
                      </div>
                      {padrinoTeam.electors.map((e: ElectorTarget) => (
                        <div key={e.capture_id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0' }}>
                          <input type="checkbox" checked={selected.has(e.telefono)}
                            onChange={() => onToggle(e.telefono, e)}
                            style={{ cursor: 'pointer', accentColor: 'var(--plra-500)' }} />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text)' }}>{e.nombre} {e.apellido || ''}</span>
                            <span style={{ fontSize: '0.58rem', color: 'var(--text-3)', marginLeft: '0.3rem' }}>{e.telefono}</span>
                          </div>
                          <TrafficBadge light={e.traffic_light} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Coordinator tree */}
      {mode === 'coordinator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '380px', overflowY: 'auto' }}>
          {coordinators.map(c => (
            <div key={c.id}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.75rem', borderRadius: '8px',
                background: expandedCoord === c.id ? 'rgba(59,130,246,0.08)' : 'var(--surface-light)',
                border: `1px solid ${expandedCoord === c.id ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
              }}>
                <input type="checkbox" checked={!!c.telefono && selected.has(c.telefono)}
                  onChange={() => c.telefono && onToggle(c.telefono, { nombre: c.nombre })}
                  style={{ cursor: 'pointer', accentColor: 'var(--plra-500)' }} />
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => loadCoordElectors(c.id)}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>{c.nombre}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>
                    {c.capture_count} capturas · L-{c.list_number || '—'}
                    {c.telefono ? ` · ${c.telefono}` : ' · Sin teléfono'}
                  </div>
                </div>
                <div onClick={() => loadCoordElectors(c.id)} style={{ color: 'var(--text-3)', cursor: 'pointer' }}>
                  {expandedCoord === c.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </div>

              {expandedCoord === c.id && coordElectors[c.id] && (
                <div style={{ marginLeft: '1rem', marginTop: '0.25rem', padding: '0.5rem', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-2)' }}>
                      Electores con teléfono ({coordElectors[c.id].length})
                    </span>
                    {coordElectors[c.id].length > 0 && (
                      <button
                        onClick={() => onSelectAll(coordElectors[c.id].map(e => e.telefono), coordElectors[c.id])}
                        style={{ fontSize: '0.6rem', padding: '0.15rem 0.4rem', borderRadius: '4px', border: 'none', background: 'var(--plra-500)', color: 'white', cursor: 'pointer' }}
                      >
                        Todos
                      </button>
                    )}
                  </div>
                  {coordElectors[c.id].length === 0 ? (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Sin electores registrados con teléfono</div>
                  ) : coordElectors[c.id].map((e: ElectorTarget) => (
                    <div key={e.capture_id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0' }}>
                      <input type="checkbox" checked={selected.has(e.telefono)}
                        onChange={() => onToggle(e.telefono, e)}
                        style={{ cursor: 'pointer', accentColor: 'var(--plra-500)' }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text)' }}>{e.nombre} {e.apellido || ''}</span>
                        <span style={{ fontSize: '0.58rem', color: 'var(--text-3)', marginLeft: '0.3rem' }}>{e.telefono}</span>
                      </div>
                      <TrafficBadge light={e.traffic_light} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Search mode */}
      {mode === 'search' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'var(--input-bg)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '0.5rem 0.75rem'
          }}>
            <Search size={14} style={{ color: 'var(--text-3)' }} />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Nombre, CI o teléfono..."
              style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontSize: '0.75rem', color: 'var(--text)' }}
            />
            {searchLoading && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--text-3)' }} />}
          </div>

          {searchResults && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {searchResults.users.map((u: any) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '8px', background: 'var(--surface-light)', border: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={selected.has(u.telefono)}
                    onChange={() => onToggle(u.telefono, u)}
                    style={{ cursor: 'pointer', accentColor: 'var(--plra-500)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>{u.nombre}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>{u.role} · {u.telefono}</div>
                  </div>
                </div>
              ))}
              {searchResults.electors.map((e: any) => (
                <div key={e.elector_ci} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '8px', background: 'var(--surface-light)', border: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={selected.has(e.telefono)}
                    onChange={() => onToggle(e.telefono, e)}
                    style={{ cursor: 'pointer', accentColor: 'var(--plra-500)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>{e.nombre} {e.apellido || ''}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>Elector · {e.telefono}</div>
                  </div>
                  <TrafficBadge light={e.traffic_light} />
                </div>
              ))}
              {searchResults.users.length === 0 && searchResults.electors.length === 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', padding: '0.75rem', textAlign: 'center' }}>Sin resultados</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Broadcast Tab ────────────────────────────────────────────────────────────

const BroadcastTab: React.FC<{ terminalId: string }> = ({ terminalId }) => {
  const [step, setStep] = useState<'recipients' | 'compose' | 'preview' | 'sending'>('recipients');
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [recipientMeta, setRecipientMeta] = useState<Record<string, any>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [mediaType, setMediaType] = useState<'TEXT' | 'IMAGE' | 'VIDEO' | 'VOICE'>('TEXT');
  const [mediaUrl, setMediaUrl] = useState('');
  const [broadcastLog, setBroadcastLog] = useState<{ logId: number; total: number; sent: number; failed: number; status: string } | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    api.get('/whatsapp/templates').then(r => setTemplates(r.data)).catch(() => {});
    api.get('/whatsapp/broadcast/logs').then(r => setLogs(r.data)).catch(() => {});
  }, []);

  const toggleRecipient = (phone: string, meta?: any) => {
    setSelectedPhones(prev => {
      const next = new Set(prev);
      next.has(phone) ? next.delete(phone) : next.add(phone);
      return next;
    });
    if (meta) setRecipientMeta(prev => ({ ...prev, [phone]: meta }));
  };

  const selectAll = (phones: string[], metas?: any[]) => {
    setSelectedPhones(prev => {
      const next = new Set(prev);
      phones.forEach(p => next.add(p));
      return next;
    });
    if (metas) {
      const metaMap: Record<string, any> = {};
      phones.forEach((p, i) => { if (metas[i]) metaMap[p] = metas[i]; });
      setRecipientMeta(prev => ({ ...prev, ...metaMap }));
    }
  };

  const clearAll = () => setSelectedPhones(new Set());

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const composedMessage = selectedTemplate ? selectedTemplate.content : customMessage;

  const previewMessage = (phone: string) => {
    const meta = recipientMeta[phone];
    return composedMessage
      .replace(/{{nombre}}/g, meta?.nombre || 'Amigo/a')
      .replace(/{{ci}}/g, meta?.elector_ci || meta?.ci || '')
      .replace(/{{local}}/g, meta?.local_votacion || 'No especificado')
      .replace(/{{mesa}}/g, meta?.mesa?.toString() || '-')
      .replace(/{{orden}}/g, meta?.orden?.toString() || '-');
  };

  const sendBroadcast = async () => {
    if (selectedPhones.size === 0 || !composedMessage.trim()) return;
    setStep('sending');

    // Use direct-message loop for individual sending
    const phones = Array.from(selectedPhones);
    const total = phones.length;
    let sent = 0; let failed = 0;
    setBroadcastLog({ logId: 0, total, sent: 0, failed: 0, status: 'RUNNING' });

    for (const phone of phones) {
      try {
        const msg = previewMessage(phone);
        await api.post('/whatsapp/direct-message', {
          number: phone, message: msg,
          media_url: mediaUrl || undefined,
          media_type: mediaType !== 'TEXT' ? mediaType : undefined,
          terminalId
        });
        sent++;
      } catch { failed++; }
      setBroadcastLog({ logId: 0, total, sent, failed, status: 'RUNNING' });
      // Brief anti-spam delay
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
    }

    setBroadcastLog(prev => prev ? { ...prev, status: 'COMPLETED' } : null);
    api.get('/whatsapp/broadcast/logs').then(r => setLogs(r.data)).catch(() => {});
  };

  const STEPS = [
    { id: 'recipients', label: 'Destinatarios', icon: Users },
    { id: 'compose', label: 'Mensaje', icon: Edit3 },
    { id: 'preview', label: 'Previsualizar', icon: Eye },
  ];

  if (step === 'sending') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            maxWidth: '480px', width: '100%', padding: '2rem',
            background: 'var(--surface)', borderRadius: '16px',
            border: '1px solid var(--border)', textAlign: 'center'
          }}
        >
          {broadcastLog?.status === 'RUNNING' ? (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <Radio size={40} style={{ color: 'var(--plra-300)', margin: '0 auto' }} className="animate-pulse" />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' }}>Enviando difusión...</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginBottom: '1.5rem' }}>
                {broadcastLog.sent + broadcastLog.failed} de {broadcastLog.total} enviados
              </p>
              <div style={{ background: 'var(--surface-light)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                <motion.div
                  animate={{ width: `${((broadcastLog.sent + broadcastLog.failed) / broadcastLog.total) * 100}%` }}
                  style={{ height: '100%', background: 'linear-gradient(90deg, var(--plra-500), var(--plra-300))', borderRadius: '999px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#22c55e' }}>✓ {broadcastLog.sent} enviados</span>
                <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>✗ {broadcastLog.failed} fallidos</span>
              </div>
            </>
          ) : (
            <>
              <CheckCircle2 size={48} style={{ color: '#22c55e', margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' }}>¡Difusión completada!</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginBottom: '1.5rem' }}>
                {broadcastLog?.sent} enviados · {broadcastLog?.failed} fallidos de {broadcastLog?.total} total
              </p>
              <button
                onClick={() => { setStep('recipients'); clearAll(); setBroadcastLog(null); setSelectedTemplateId(null); setCustomMessage(''); }}
                style={{ padding: '0.6rem 1.5rem', borderRadius: '10px', border: 'none', background: 'var(--plra-500)', color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Nueva difusión
              </button>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          {STEPS.map((s, i) => {
            const stepIndex = STEPS.findIndex(x => x.id === step);
            const isDone = i < stepIndex;
            const isActive = s.id === step;
            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => setStep(s.id as any)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.4rem 0.75rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: isActive ? 'var(--plra-500)' : isDone ? 'rgba(34,197,94,0.15)' : 'var(--surface-light)',
                    color: isActive ? 'white' : isDone ? '#22c55e' : 'var(--text-2)',
                    fontSize: '0.7rem', fontWeight: 700, transition: 'all 0.15s'
                  }}
                >
                  {isDone ? <CheckCircle2 size={13} /> : <s.icon size={13} />}
                  {s.label}
                </button>
                {i < STEPS.length - 1 && (
                  <div style={{ width: '24px', height: '1px', background: 'var(--border)', margin: '0 4px' }} />
                )}
              </React.Fragment>
            );
          })}
          <div style={{ flex: 1 }} />
          {step === 'preview' && selectedPhones.size > 0 && composedMessage.trim() && (
            <button
              onClick={sendBroadcast}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1.25rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                background: 'var(--plra-500)', color: 'white', fontSize: '0.75rem', fontWeight: 800
              }}
            >
              <Radio size={14} />
              Enviar a {selectedPhones.size} contacto{selectedPhones.size !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Recipients step */}
        {step === 'recipients' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Seleccionar Destinatarios</h3>
              {selectedPhones.size > 0 && (
                <button
                  onClick={() => setStep('compose')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.45rem 0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: 'var(--plra-500)', color: 'white', fontSize: '0.72rem', fontWeight: 700
                  }}
                >
                  Continuar <ChevronRight size={13} />
                </button>
              )}
            </div>
            <RecipientSelector
              selected={selectedPhones}
              onToggle={toggleRecipient}
              onSelectAll={selectAll}
              onClearAll={clearAll}
            />
          </div>
        )}

        {/* Compose step */}
        {step === 'compose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Componer Mensaje</h3>
              {composedMessage.trim() && (
                <button
                  onClick={() => setStep('preview')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.45rem 0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: 'var(--plra-500)', color: 'white', fontSize: '0.72rem', fontWeight: 700
                  }}
                >
                  Previsualizar <Eye size={13} />
                </button>
              )}
            </div>

            {/* Quick templates */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-2)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Plantillas Rápidas Electorales
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.4rem' }}>
                {ELECTORAL_TEMPLATES.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => { setCustomMessage(t.content); setSelectedTemplateId(null); }}
                    style={{
                      padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)',
                      background: customMessage === t.content ? 'rgba(59,130,246,0.12)' : 'var(--surface-light)',
                      color: 'var(--text)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                      textAlign: 'left', transition: 'all 0.15s',
                      borderColor: customMessage === t.content ? 'var(--plra-300)' : 'var(--border)'
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Saved templates */}
            {templates.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-2)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Plantillas Guardadas
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTemplateId(selectedTemplateId === t.id ? null : t.id); setCustomMessage(''); }}
                      style={{
                        padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border)',
                        background: selectedTemplateId === t.id ? 'var(--plra-500)' : 'var(--surface-light)',
                        color: selectedTemplateId === t.id ? 'white' : 'var(--text-2)',
                        fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message editor */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-2)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Texto del Mensaje
              </div>
              <textarea
                value={selectedTemplate ? selectedTemplate.content : customMessage}
                onChange={e => { setCustomMessage(e.target.value); setSelectedTemplateId(null); }}
                rows={6}
                placeholder="Escribe tu mensaje... Usa {{nombre}}, {{local}}, {{mesa}}, {{orden}} para personalizar"
                style={{
                  width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '0.75rem', color: 'var(--text)', fontSize: '0.8rem',
                  outline: 'none', resize: 'vertical', lineHeight: '1.5', fontFamily: 'var(--font-body)',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {['{{nombre}}', '{{local}}', '{{mesa}}', '{{orden}}', '{{ci}}'].map(v => (
                  <button
                    key={v}
                    onClick={() => {
                      const base = selectedTemplate ? selectedTemplate.content : customMessage;
                      setCustomMessage(base + v);
                      setSelectedTemplateId(null);
                    }}
                    style={{
                      padding: '0.2rem 0.5rem', borderRadius: '5px', border: '1px solid var(--border)',
                      background: 'var(--surface-light)', color: 'var(--plra-300)',
                      fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace'
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Media type */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-2)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Tipo de Contenido
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {([
                  { id: 'TEXT', icon: FileText, label: 'Solo texto' },
                  { id: 'IMAGE', icon: ImageIcon, label: 'Imagen' },
                  { id: 'VIDEO', icon: Video, label: 'Video' },
                  { id: 'VOICE', icon: Mic, label: 'Audio' },
                ] as const).map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMediaType(m.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                      padding: '0.4rem 0.7rem', borderRadius: '8px', border: '1px solid var(--border)',
                      background: mediaType === m.id ? 'var(--plra-500)' : 'var(--surface-light)',
                      color: mediaType === m.id ? 'white' : 'var(--text-2)',
                      fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    <m.icon size={12} />
                    {m.label}
                  </button>
                ))}
              </div>
              {mediaType !== 'TEXT' && (
                <input
                  value={mediaUrl}
                  onChange={e => setMediaUrl(e.target.value)}
                  placeholder="URL del archivo multimedia..."
                  style={{
                    marginTop: '0.5rem', width: '100%', background: 'var(--input-bg)',
                    border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.75rem',
                    color: 'var(--text)', fontSize: '0.75rem', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Preview step */}
        {step === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                Previsualizar — {selectedPhones.size} destinatario{selectedPhones.size !== 1 ? 's' : ''}
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '500px', overflowY: 'auto' }}>
              {Array.from(selectedPhones).slice(0, 10).map(phone => {
                const meta = recipientMeta[phone];
                return (
                  <div key={phone} style={{
                    padding: '0.75rem', borderRadius: '10px',
                    background: 'var(--surface-light)', border: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--plra-500), var(--plra-300))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.6rem', fontWeight: 800, color: 'white'
                      }}>
                        {(meta?.nombre || phone).slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)' }}>{meta?.nombre || phone}</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>{phone}</div>
                      </div>
                      {meta?.traffic_light && <TrafficBadge light={meta.traffic_light} />}
                    </div>
                    <div style={{
                      background: 'var(--surface)', padding: '0.5rem 0.75rem', borderRadius: '8px',
                      fontSize: '0.75rem', color: 'var(--text)', lineHeight: '1.4',
                      borderLeft: '3px solid var(--plra-300)', whiteSpace: 'pre-wrap'
                    }}>
                      {previewMessage(phone)}
                    </div>
                  </div>
                );
              })}
              {selectedPhones.size > 10 && (
                <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-3)', padding: '0.5rem' }}>
                  + {selectedPhones.size - 10} más no mostrados
                </div>
              )}
            </div>
          </div>
        )}

        {/* Broadcast history */}
        {logs.length > 0 && step === 'recipients' && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-2)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Historial Reciente
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {logs.slice(0, 5).map((log: any) => (
                <div key={log.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.6rem 0.75rem', borderRadius: '8px',
                  background: 'var(--surface-light)', border: '1px solid var(--border)'
                }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: log.status === 'COMPLETED' ? '#22c55e' : log.status === 'RUNNING' ? '#f59e0b' : '#6b7280'
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)' }}>{log.template_name}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>
                      {log.success_count}/{log.target_count} enviados · {new Date(log.timestamp).toLocaleDateString('es')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Templates Tab ────────────────────────────────────────────────────────────

const TemplatesTab: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', content: '', media_url: '', media_type: 'TEXT' as Template['media_type'],
    lat: -25.2637, lng: -57.5759, contact_name: '', contact_phone: ''
  });
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/whatsapp/templates').then(r => setTemplates(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.post('/whatsapp/templates', form);
      setForm({ name: '', content: '', media_url: '', media_type: 'TEXT', lat: -25.2637, lng: -57.5759, contact_name: '', contact_phone: '' });
      setShowForm(false);
      load();
    } catch {}
    setSaving(false);
  };

  const del = async (id: number) => {
    if (!confirm('¿Eliminar plantilla?')) return;
    await api.delete(`/whatsapp/templates/${id}`);
    load();
  };

  const MEDIA_ICONS: Record<string, any> = {
    TEXT: FileText, IMAGE: ImageIcon, VIDEO: Video, VOICE: Mic, LOCATION: MapPin
  };

  return (
    <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Plantillas de Mensajes</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.45rem 0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: 'var(--plra-500)', color: 'white', fontSize: '0.72rem', fontWeight: 700
          }}
        >
          <Plus size={13} /> Nueva plantilla
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: '1.25rem' }}
          >
            <div style={{
              padding: '1.25rem', borderRadius: '12px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: '0.75rem'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-2)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>Nombre</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ej: Recordatorio Local"
                    style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.45rem 0.6rem', color: 'var(--text)', fontSize: '0.75rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-2)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>Tipo de Media</label>
                  <select value={form.media_type} onChange={e => setForm(p => ({ ...p, media_type: e.target.value as any }))}
                    style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.45rem 0.6rem', color: 'var(--text)', fontSize: '0.75rem', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="TEXT">Texto</option>
                    <option value="IMAGE">Imagen</option>
                    <option value="VIDEO">Video</option>
                    <option value="VOICE">Audio/Voz</option>
                    <option value="LOCATION">Ubicación</option>
                    <option value="CONTACT">Contacto</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-2)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                  Contenido del Mensaje
                  <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: '0.5rem' }}>Variables: {`{{nombre}} {{local}} {{mesa}} {{orden}}`}</span>
                </label>
                <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  rows={4} placeholder="Escribe el mensaje aquí..."
                  style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.6rem', color: 'var(--text)', fontSize: '0.75rem', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }} />
              </div>
              {form.media_type !== 'TEXT' && form.media_type !== 'LOCATION' && form.media_type !== 'CONTACT' && (
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-2)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>URL del Archivo</label>
                  <input value={form.media_url} onChange={e => setForm(p => ({ ...p, media_url: e.target.value }))}
                    placeholder="https://..."
                    style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.45rem 0.6rem', color: 'var(--text)', fontSize: '0.75rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}
              {form.media_type === 'CONTACT' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-2)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>Nombre del Contacto</label>
                    <input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))}
                      style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.45rem 0.6rem', color: 'var(--text)', fontSize: '0.75rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-2)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>Teléfono del Contacto</label>
                    <input value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))}
                      style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.45rem 0.6rem', color: 'var(--text)', fontSize: '0.75rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowForm(false)}
                  style={{ padding: '0.45rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: '0.72rem', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={save} disabled={saving || !form.name.trim()}
                  style={{ padding: '0.45rem 0.9rem', borderRadius: '8px', border: 'none', background: 'var(--plra-500)', color: 'white', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Guardando...' : 'Guardar Plantilla'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pre-built templates info */}
      <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--plra-300)', marginBottom: '0.4rem' }}>💡 Plantillas Electorales Incorporadas</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-2)' }}>
          El módulo de difusión ya incluye 6 plantillas electorales listas para usar (local de votación, recordatorio Día D, transporte, confirmación de apoyo, convocatoria de equipo, acción urgente). Accede a ellas desde la tab <strong>Difusión</strong>.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
            <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.25 }} />
            <div style={{ fontSize: '0.8rem' }}>Sin plantillas guardadas</div>
            <div style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>Crea tu primera plantilla personalizada</div>
          </div>
        ) : templates.map(t => {
          const Icon = MEDIA_ICONS[t.media_type] || FileText;
          return (
            <div key={t.id} style={{
              padding: '0.875rem 1rem', borderRadius: '10px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Icon size={15} style={{ color: 'var(--plra-300)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.25rem' }}>{t.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', lineHeight: '1.4', whiteSpace: 'pre-wrap', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>
                  {t.content}
                </div>
                {t.media_url && (
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>📎 {t.media_url}</div>
                )}
              </div>
              <button onClick={() => del(t.id)}
                style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: '0.2rem', flexShrink: 0 }}>
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Lines Tab ────────────────────────────────────────────────────────────────

const LinesTab: React.FC = () => {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const loadTerminals = useCallback(async () => {
    try {
      const r = await api.get('/whatsapp/terminals');
      setTerminals(r.data);
      for (const t of r.data) {
        const s = await api.get(`/whatsapp/status?terminalId=${t.id}`);
        setTerminals(prev => prev.map(p => p.id === t.id ? { ...p, status: s.data.status } : p));
        if (s.data.qr) setQrCodes(prev => ({ ...prev, [t.id]: s.data.qr }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadTerminals();
    const t = setInterval(loadTerminals, 8000);
    return () => clearInterval(t);
  }, [loadTerminals]);

  const connect = async (id: string) => {
    await api.post('/whatsapp/connect', { terminalId: id });
    setTimeout(loadTerminals, 2000);
  };

  const disconnect = async (id: string) => {
    await api.post('/whatsapp/disconnect', { terminalId: id });
    setTimeout(loadTerminals, 1000);
  };

  const addTerminal = async () => {
    if (!newId.trim() || !newName.trim()) return;
    setAdding(true);
    try {
      await api.post('/whatsapp/terminals', { id: newId.trim(), name: newName.trim() });
      setNewId(''); setNewName('');
      loadTerminals();
    } catch {}
    setAdding(false);
  };

  return (
    <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Líneas WhatsApp</h3>
        <button onClick={loadTerminals}
          style={{ background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.4rem', cursor: 'pointer', color: 'var(--text-2)', display: 'flex' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {terminals.map(terminal => (
          <div key={terminal.id} style={{
            padding: '1.25rem', borderRadius: '14px',
            background: 'var(--surface)', border: `1px solid ${terminal.status === 'CONNECTED' ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
            boxShadow: terminal.status === 'CONNECTED' ? '0 0 20px rgba(34,197,94,0.06)' : 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
                background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Smartphone size={20} style={{ color: '#25d366' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)' }}>{terminal.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                  <StatusDot status={terminal.status} />
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>{terminal.status}</span>
                </div>
              </div>
            </div>

            {terminal.status === 'CONNECTING' && qrCodes[terminal.id] && (
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginBottom: '0.5rem', fontWeight: 700 }}>Escanea con tu WhatsApp</div>
                <img src={qrCodes[terminal.id]} alt="QR" style={{ width: '160px', height: '160px', borderRadius: '8px' }} />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {terminal.status !== 'CONNECTED' ? (
                <button onClick={() => connect(terminal.id)} style={{
                  flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: 'rgba(37,211,102,0.15)', color: '#25d366', fontSize: '0.72rem', fontWeight: 700
                }}>
                  Conectar
                </button>
              ) : (
                <button onClick={() => disconnect(terminal.id)} style={{
                  flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.72rem', fontWeight: 700
                }}>
                  Desconectar
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add new line card */}
        <div style={{
          padding: '1.25rem', borderRadius: '14px',
          background: 'var(--surface)', border: '1px dashed var(--border)',
          display: 'flex', flexDirection: 'column', gap: '0.6rem'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.25rem' }}>
            + Nueva Línea
          </div>
          <input value={newId} onChange={e => setNewId(e.target.value)}
            placeholder="ID (ej: linea2)"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.4rem 0.6rem', color: 'var(--text)', fontSize: '0.72rem', outline: 'none' }} />
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Nombre (ej: Línea Pedro Juan)"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.4rem 0.6rem', color: 'var(--text)', fontSize: '0.72rem', outline: 'none' }} />
          <button onClick={addTerminal} disabled={adding || !newId.trim() || !newName.trim()}
            style={{
              padding: '0.45rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: 'var(--plra-500)', color: 'white', fontSize: '0.72rem', fontWeight: 700,
              opacity: adding || !newId.trim() || !newName.trim() ? 0.5 : 1
            }}>
            {adding ? 'Agregando...' : 'Agregar Línea'}
          </button>
        </div>
      </div>

      <div style={{ padding: '0.875rem 1rem', borderRadius: '10px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#eab308', marginBottom: '0.35rem' }}>⚠️ Buenas Prácticas Anti-Baneo</div>
        <ul style={{ fontSize: '0.68rem', color: 'var(--text-2)', margin: 0, paddingLeft: '1rem', lineHeight: '1.7' }}>
          <li>No envíes más de 200 mensajes por línea en 24h</li>
          <li>Usa múltiples líneas para difusiones grandes</li>
          <li>Personaliza cada mensaje con {`{{nombre}}`} para evitar spam</li>
          <li>Mantén intervalos de 2-5 segundos entre mensajes (ya configurado)</li>
        </ul>
      </div>
    </div>
  );
};

// ─── Main Communications Component ───────────────────────────────────────────

const Communications: React.FC = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('inbox');
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState('default');
  const [terminalStatus, setTerminalStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'>('DISCONNECTED');

  useEffect(() => {
    api.get('/whatsapp/terminals')
      .then(r => { setTerminals(r.data); if (r.data.length > 0) setActiveTerminalId(r.data[0].id); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await api.get(`/whatsapp/status?terminalId=${activeTerminalId}`);
        setTerminalStatus(r.data.status);
      } catch {}
    };
    poll();
    const t = setInterval(poll, 8000);
    return () => clearInterval(t);
  }, [activeTerminalId]);

  const TABS = [
    { id: 'inbox', label: 'Bandeja', icon: MessageSquare },
    { id: 'broadcast', label: 'Difusión', icon: Radio },
    { id: 'templates', label: 'Plantillas', icon: FileText },
    { id: 'lines', label: 'Líneas', icon: Smartphone },
  ];

  return (
    <MainLayout
      title="Centro de Comunicaciones"
      userName={user?.nombre || user?.username || 'Usuario'}
      userPhoto={user?.photo_url}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 102px)', overflow: 'hidden' }}>
        {/* Header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 1rem',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0, flexWrap: 'wrap'
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.2rem', flex: 1 }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.4rem 0.8rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: activeTab === tab.id
                    ? (isDark ? 'rgba(59,130,246,0.15)' : 'rgba(0,71,171,0.08)')
                    : 'transparent',
                  color: activeTab === tab.id ? 'var(--plra-300)' : 'var(--text-2)',
                  fontSize: '0.72rem', fontWeight: activeTab === tab.id ? 800 : 600,
                  transition: 'all 0.15s'
                }}
              >
                <tab.icon size={13} strokeWidth={activeTab === tab.id ? 2.2 : 1.5} />
                <span className="hidden-mobile">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Terminal selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <StatusDot status={terminalStatus} />
            {terminals.length > 1 ? (
              <select
                value={activeTerminalId}
                onChange={e => setActiveTerminalId(e.target.value)}
                style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '7px', padding: '0.3rem 0.5rem', color: 'var(--text)', fontSize: '0.7rem', outline: 'none' }}
              >
                {terminals.map(t => (
                  <option key={t.id} value={t.id} style={{ background: 'var(--surface)' }}>{t.name}</option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-2)', fontWeight: 700 }}>
                {terminals[0]?.name || 'Línea Principal'}
              </span>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              style={{ flex: 1, display: 'flex', overflow: 'hidden' }}
            >
              {activeTab === 'inbox' && <InboxTab terminalId={activeTerminalId} />}
              {activeTab === 'broadcast' && <BroadcastTab terminalId={activeTerminalId} />}
              {activeTab === 'templates' && <TemplatesTab />}
              {activeTab === 'lines' && <LinesTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MainLayout>
  );
};

export default Communications;
