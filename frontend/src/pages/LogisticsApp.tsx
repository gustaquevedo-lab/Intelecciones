import React, { useState, useEffect } from 'react';
import { Truck, Plus, Clock, User, X, AlertTriangle, CheckCircle, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import LogisticsMap from '../components/LogisticsMap';
import api from '../services/api';

const LogisticsApp: React.FC = () => {
  const { user, activeDistrict } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [pendingLogistics, setPendingLogistics] = useState<any[]>([]);
  const [locales, setLocales] = useState<any[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showModal, setShowModal] = useState<string | null>(null);


  // Form states
  const [newVehicleDesc, setNewVehicleDesc] = useState('');
  const [newVehicleDriver, setNewVehicleDriver] = useState('');
  const [newVehiclePhone, setNewVehiclePhone] = useState('');
  const [newVehicleDriverCI, setNewVehicleDriverCI] = useState('');
  const [newVehicleCapacity, setNewVehicleCapacity] = useState(4);
  const [newVehicleStatus, setNewVehicleStatus] = useState('AVAILABLE');
  const [newVehicleUser, setNewVehicleUser] = useState('');
  const [newVehicleType, setNewVehicleType] = useState('');
  const [newVehiclePlate, setNewVehiclePlate] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [activeDistrict]);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (activeDistrict) params.append('district', activeDistrict);
      const queryStr = params.toString();

      const [v, p, u, s, c, l] = await Promise.all([
        api.get(`/vehicles?${queryStr}`),
        api.get(`/logistics/pending?${queryStr}`),
        api.get(`/users?${queryStr}`),
        api.get(`/logistics/stats?${queryStr}`),
        api.get(`/logistics/clusters?${queryStr}`),
        api.get('/voting-locations')
      ]);
      setVehicles(v.data);
      setPendingLogistics(p.data);
      setUsers(u.data);
      setStats(s.data);
      setClusters(c.data);
      setLocales(l.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteTrip = async (vehicleId: number) => {
    if (!window.confirm('¿Confirmar que los pasajeros llegaron a destino? Esto liberará los asientos del móvil.')) return;
    try {
      await api.post('/logistics/complete-trip', { vehicle_id: vehicleId });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleAssignVehicle = async (capture_id: number, vehicle_id: string) => {
    try {
      await api.post('/logistics/assign', { capture_id, vehicle_id });
      fetchData();
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const lookup = async () => {
      if (newVehicleDriverCI.length >= 5) {
        try {
          const res = await api.get(`/electors/${newVehicleDriverCI}`);
          if (res.data) {
            setNewVehicleDriver(`${res.data.nombre} ${res.data.apellido}`);
          }
        } catch (err) { /* ignore */ }
      }
    };
    const timer = setTimeout(lookup, 500);
    return () => clearTimeout(timer);
  }, [newVehicleDriverCI]);

  const handleLookupDriverCI = async () => {
    if (!newVehicleDriverCI) return;
    try {
      const res = await api.get(`/electors/${newVehicleDriverCI}`);
      if (res.data) {
        setNewVehicleDriver(`${res.data.nombre} ${res.data.apellido}`);
      }
    } catch (err) { alert('C.I. no encontrado'); }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/vehicles', {
        description: newVehicleDesc,
        driver_name: newVehicleDriver,
        driver_phone: newVehiclePhone,
        driver_ci: newVehicleDriverCI,
        capacity: newVehicleCapacity,
        status: newVehicleStatus,
        assigned_user_id: newVehicleUser ? parseInt(newVehicleUser) : null,
        type: newVehicleType,
        plate: newVehiclePlate
      });
      setShowModal(null);
      resetForm();
      fetchData();
    } catch (err) { console.error(err); }
  };

  const resetForm = () => {
    setNewVehicleDesc('');
    setNewVehicleDriver('');
    setNewVehiclePhone('');
    setNewVehicleDriverCI('');
    setNewVehicleCapacity(4);
    setNewVehicleStatus('AVAILABLE');
    setNewVehicleUser('');
    setNewVehicleType('');
    setNewVehiclePlate('');
  };

  const handleUpdateLocalGeo = async (cod: string, lat: number, lng: number) => {
    try {
      await api.post(`/voting-locations/${cod}/geo`, { lat, lng });
    } catch (err) { console.error(err); }
  };

  const isMobile = window.innerWidth < 1024;

  return (
    <MainLayout title="Logística Operativa" userName={user?.nombre || user?.username || ''} userPhoto={user?.photo_url}>
      <div style={{ 
        padding: 'clamp(1rem, 3vw, 1.5rem)', 
        maxWidth: '1600px', 
        margin: '0 auto', 
        width: '100%', 
        minHeight: 'calc(100vh - 80px)', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1.5rem' 
      }}>
        
        {/* TOP STATS BAR */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'Móviles Totales', value: stats?.total_vehicles || 0, icon: Truck, color: 'var(--plra-300)' },
            { label: 'Móviles Disponibles', value: stats?.available || 0, icon: CheckCircle, color: 'var(--green)' },
            { label: 'Pendientes', value: stats?.total_requests || 0, icon: Clock, color: 'var(--yellow)' },
            { label: 'Prioritarios', value: stats?.priority || 0, icon: AlertTriangle, color: 'var(--red)' }
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="card-premium-styled" 
              style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}
            >
              <div style={{ padding: '0.75rem', borderRadius: '12px', background: `${stat.color}15`, color: stat.color }}>
                <stat.icon size={24} />
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>{stat.label}</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text)' }}>{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : '1fr 400px', 
          gap: '1.5rem', 
          flex: 1, 
          minHeight: isMobile ? 'auto' : 0 
        }}>
          
          {/* LEFT COLUMN: MAP & CLUSTERS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: 0 }}>
            <div style={{ 
              height: isMobile ? '400px' : 'auto',
              flex: 1, 
              position: 'relative',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)'
            }}>
              <LogisticsMap 
                pendingRequests={pendingLogistics} 
                vehicles={vehicles} 
                clusters={clusters} 
                activeDistrict={activeDistrict || user?.distrito}
                locales={locales}
                onUpdateLocalGeo={handleUpdateLocalGeo}
                users={users}
              />
              <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 1000 }}>
                <button className="action-btn-primary" onClick={() => setShowModal('vehicle')}>
                  <Plus size={18} /> Registrar Móvil
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem', WebkitOverflowScrolling: 'touch' }}>
              {clusters.map((cluster, i) => (
                <div key={i} className="card-premium-styled" style={{ minWidth: '220px', padding: '1rem', background: 'var(--glass-bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--plra-300)' }}>{cluster.barrio || 'GENERAL'}</span>
                    <span className="badge badge-blue">{cluster.count}</span>
                  </div>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>Zona con alta demanda de transporte</p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN: LISTS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: 0 }}>
            
            {/* PENDING REQUESTS */}
            <div className="card-premium-styled" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={18} style={{ color: 'var(--yellow)' }} /> Solicitudes
                </h3>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)' }}>{pendingLogistics.length} Pendientes</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pendingLogistics.map(req => (
                  <motion.div 
                    layout
                    key={req.id} 
                    style={{ 
                      padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', 
                      borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--plra-900)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={16} color="var(--plra-300)" />
                        </div>
                        <div>
                          <p style={{ fontSize: '0.8rem', fontWeight: 700 }}>{req.nombre} {req.apellido}</p>
                          <p style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>{req.barrio || 'Sin Barrio'}</p>
                        </div>
                      </div>
                      {req.is_priority === 1 && <AlertTriangle size={14} style={{ color: 'var(--red)' }} />}
                    </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <select 
                          className="mini-input" 
                          style={{ flex: 1, fontSize: '0.7rem' }}
                          onChange={(e) => handleAssignVehicle(req.id, e.target.value)}
                          defaultValue=""
                        >
                          <option value="" disabled>Asignar Móvil...</option>
                          {vehicles.map(v => (
                            <option key={v.id} value={v.id} disabled={(v.current_passengers || 0) >= v.capacity}>
                              {v.description} ({(v.current_passengers || 0)}/{v.capacity})
                            </option>
                          ))}
                        </select>
                      </div>
                  </motion.div>
                ))}
                {pendingLogistics.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                    No hay solicitudes pendientes.
                  </div>
                )}
              </div>
            </div>

            {/* ACTIVE FLEET */}
            <div className="card-premium-styled" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Truck size={18} style={{ color: 'var(--green)' }} /> Flota Activa
                </h3>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {vehicles.map(v => (
                  <div key={v.id} style={{ 
                    padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', 
                    borderRadius: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0 }}>{v.description}</p>
                          <span style={{ 
                            fontSize: '0.65rem', fontWeight: 800, color: (v.current_passengers || 0) >= v.capacity ? 'var(--red)' : 'var(--green)'
                          }}>
                            {v.current_passengers || 0} / {v.capacity} ASIENTOS
                          </span>
                        </div>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>
                          {v.driver_name} • {v.plate || 'Sin Chapa'}
                        </p>
                        
                        {/* Progress Bar */}
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '0.5rem', overflow: 'hidden' }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${Math.min(100, ((v.current_passengers || 0) / v.capacity) * 100)}%`,
                            background: (v.current_passengers || 0) >= v.capacity ? 'var(--red)' : 'var(--plra-400)',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                          {v.driver_phone && (
                            <a 
                              href={`https://wa.me/${v.driver_phone.replace(/\+/g, '')}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="action-btn-secondary"
                              style={{ flex: 1, textDecoration: 'none', fontSize: '0.65rem', padding: '0.4rem', justifyContent: 'center', minHeight: '32px' }}
                            >
                              <MessageSquare size={12} /> WhatsApp
                            </a>
                          )}
                          {(v.current_passengers || 0) > 0 && (
                            <button 
                              onClick={() => handleCompleteTrip(v.id)}
                              className="action-btn-primary"
                              style={{ flex: 1, fontSize: '0.65rem', padding: '0.4rem', background: 'var(--green)', minHeight: '32px' }}
                            >
                              <CheckCircle size={12} /> Llegaron
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* MODAL VEHICLE */}
      <AnimatePresence>
        {showModal === 'vehicle' && (
          <div className="modal-overlay" onClick={() => setShowModal(null)}>
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '90%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', padding: 0 }}
            >
              <div className="modal-header-section" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--blue-lt-10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue-lt)' }}>
                      <Truck size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Registrar Nuevo Móvil</h3>
                      <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-3)' }}>Asignación de logística electoral</p>
                    </div>
                  </div>
                  <button onClick={() => setShowModal(null)} style={{ background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-3)', cursor: 'pointer', padding: '0.5rem' }}>
                    <X size={18} />
                  </button>
                </div>
              </div>
              
              <div style={{ padding: '1.5rem' }}>
                <form onSubmit={handleCreateVehicle}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                    
                    {/* --- Grupo: Vehículo --- */}
                    <div style={{ gridColumn: 'span 2' }}>
                      <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--blue-lt)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Información del Vehículo</p>
                    </div>
                    <div className="form-group">
                      <label>Identificador / Descripción</label>
                      <input className="modern-input-premium-styled" value={newVehicleDesc} onChange={e => setNewVehicleDesc(e.target.value)} placeholder="Ej: Camioneta Blanca" required />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label>Chapa</label>
                        <input className="modern-input-premium-styled" value={newVehiclePlate} onChange={e => setNewVehiclePlate(e.target.value)} placeholder="ABC 123" />
                      </div>
                      <div className="form-group">
                        <label>Capacidad</label>
                        <input type="number" className="modern-input-premium-styled" value={newVehicleCapacity} onChange={e => setNewVehicleCapacity(parseInt(e.target.value))} />
                      </div>
                    </div>

                    {/* --- Grupo: Chofer --- */}
                    <div style={{ gridColumn: 'span 2', marginTop: '0.5rem' }}>
                      <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--blue-lt)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Datos del Chofer</p>
                    </div>
                    <div className="form-group">
                      <label>C.I. Chofer</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input className="modern-input-premium-styled" style={{ flex: 1 }} value={newVehicleDriverCI} onChange={e => setNewVehicleDriverCI(e.target.value)} placeholder="Nº de Cédula" required />
                        <button type="button" onClick={handleLookupDriverCI} className="action-btn-primary" style={{ padding: '0 1rem', height: '42px', fontSize: '0.7rem' }}>VERIFICAR</button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Nombre Completo</label>
                      <input className="modern-input-premium-styled" value={newVehicleDriver} onChange={e => setNewVehicleDriver(e.target.value)} placeholder="Chofer..." required />
                    </div>
                    <div className="form-group">
                      <label>WhatsApp Chofer</label>
                      <input className="modern-input-premium-styled" value={newVehiclePhone} onChange={e => setNewVehiclePhone(e.target.value)} placeholder="+595 9xx..." required />
                    </div>

                    {/* --- Grupo: Asignación --- */}
                    <div className="form-group">
                      <label>Coordinador Responsable</label>
                      <select 
                        className="modern-input-premium-styled" 
                        value={newVehicleUser} 
                        onChange={e => setNewVehicleUser(e.target.value)} 
                        required
                      >
                        <option value="">Seleccione un Coordinador...</option>
                        {users.filter(u => u.role === 'COORDINADOR').map(u => (
                          <option key={u.id} value={u.id}>
                            {u.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                  </div>

                  <div className="modal-footer-premium-styled" style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button type="button" onClick={() => setShowModal(null)} className="btn-cancel-styled" style={{ padding: '0.75rem 1.5rem' }}>Cancelar</button>
                    <button type="submit" className="btn-confirm-styled" style={{ padding: '0.75rem 2rem' }}>GUARDAR MÓVIL</button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
};

export default LogisticsApp;
