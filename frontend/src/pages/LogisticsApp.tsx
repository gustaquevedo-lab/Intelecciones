import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Truck, Plus, Clock, User, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';

const API_BASE = 'http://localhost:5000/api';

const LogisticsApp: React.FC = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [pendingLogistics, setPendingLogistics] = useState<any[]>([]);
  const [showModal, setShowModal] = useState<string | null>(null);

  const [newVehicleDesc, setNewVehicleDesc] = useState('');
  const [newVehicleDriver, setNewVehicleDriver] = useState('');
  const [newVehiclePhone, setNewVehiclePhone] = useState('');
  const [newVehicleDriverCI, setNewVehicleDriverCI] = useState('');
  const [newVehicleCapacity, setNewVehicleCapacity] = useState(4);
  const [newVehicleStatus, setNewVehicleStatus] = useState('AVAILABLE');
  const [newVehicleUser, setNewVehicleUser] = useState('');
  const [newVehicleType, setNewVehicleType] = useState('');
  const [newVehiclePlate, setNewVehiclePlate] = useState('');

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [v, p, u] = await Promise.all([
        axios.get(`${API_BASE}/vehicles`),
        axios.get(`${API_BASE}/logistics/pending`),
        axios.get(`${API_BASE}/users`)
      ]);
      setVehicles(v.data);
      setPendingLogistics(p.data);
      setUsers(u.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const lookup = async () => {
      if (newVehicleDriverCI.length >= 5) {
        try {
          const res = await axios.get(`${API_BASE}/electors/${newVehicleDriverCI}`);
          if (res.data) {
            setNewVehicleDriver(`${res.data.nombre} ${res.data.apellido}`);
          }
        } catch (err) { /* ignore not found while typing */ }
      }
    };
    const timer = setTimeout(lookup, 500);
    return () => clearTimeout(timer);
  }, [newVehicleDriverCI]);

  const handleLookupDriverCI = async () => {
    // Manual override if needed
    if (!newVehicleDriverCI) return;
    try {
      const res = await axios.get(`${API_BASE}/electors/${newVehicleDriverCI}`);
      if (res.data) {
        setNewVehicleDriver(`${res.data.nombre} ${res.data.apellido}`);
      } else {
        alert('C.I. no encontrado en el padrón');
      }
    } catch (err) { alert('C.I. no encontrado en el padrón'); }
  };

  const handleAssignVehicle = async (capture_id: number, vehicle_id: string) => {
    try {
      await axios.post(`${API_BASE}/logistics/assign`, { capture_id, vehicle_id });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const formatPhone = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    if (cleaned.startsWith('09')) {
      cleaned = '5959' + cleaned.substring(2);
    } else if (cleaned.startsWith('9')) {
      cleaned = '595' + cleaned;
    } 
    
    if (cleaned.length > 0) {
      setNewVehiclePhone('+' + cleaned);
    } else {
      setNewVehiclePhone('');
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/vehicles`, {
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
      setNewVehicleDesc('');
      setNewVehicleDriver('');
      setNewVehiclePhone('');
      setNewVehicleDriverCI('');
      setNewVehicleCapacity(4);
      setNewVehicleStatus('AVAILABLE');
      setNewVehicleUser('');
      setNewVehicleType('');
      setNewVehiclePlate('');
      fetchData();
    } catch (err) { console.error(err); }
  };

  return (
    <MainLayout title="Logística Operativa" userName={user?.nombre || user?.username || ''} userPhoto={user?.photo_url}>
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <span style={{ color: 'var(--text-3)' }}>Cargando datos logísticos...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>Logística de Transporte</h2>
                <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>Gestión de flota y asignación de traslados en tiempo real</p>
              </div>
              <button className="action-btn-primary" onClick={() => setShowModal('vehicle')}>
                <Plus size={18} /> Registrar Vehículo
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
              {/* Column 1: Pending Requests */}
              <div className="card-premium-styled">
                <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={18} style={{ color: 'var(--plra-300)' }} /> Solicitudes Pendientes
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {pendingLogistics.filter(p => !p.assigned_vehicle_id).map(cap => (
                    <div key={cap.id} style={{ 
                      padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', 
                      borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem'
                    }}>
                      <div style={{ 
                        width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--plra-300)'
                      }}>
                        <User size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>{cap.nombre} {cap.apellido}</p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Local: {cap.local_votacion}</p>
                      </div>
                      <select 
                        className="mini-input" 
                        onChange={(e) => handleAssignVehicle(cap.id, e.target.value)}
                        defaultValue=""
                        style={{ width: '120px' }}
                      >
                        <option value="" disabled>Asignar...</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.description}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {pendingLogistics.filter(p => !p.assigned_vehicle_id).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed var(--border)', borderRadius: '12px' }}>
                      <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>No hay solicitudes de traslado pendientes.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 2: Fleet Status */}
              <div className="card-premium-styled">
                <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Truck size={18} style={{ color: 'var(--green)' }} /> Flota de Vehículos
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {vehicles.map(v => {
                    const assignedCount = pendingLogistics.filter(p => p.assigned_vehicle_id === v.id).length;
                    const statusColor = v.status === 'AVAILABLE' ? 'var(--green)' : v.status === 'IN_TRANSIT' ? 'var(--yellow)' : 'var(--red)';
                    const statusLabel = v.status === 'AVAILABLE' ? 'Disponible' : v.status === 'IN_TRANSIT' ? 'En Ruta' : 'Mantenimiento';
                    
                    return (
                    <div key={v.id} style={{ 
                      padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', 
                      borderRadius: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div>
                          <p style={{ fontSize: '0.9rem', fontWeight: 800 }}>
                            {v.description} {v.type && <span style={{ opacity: 0.6, fontSize: '0.75rem', fontWeight: 400 }}>({v.type})</span>}
                          </p>
                          {v.plate && (
                            <div style={{ 
                              display: 'inline-block', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', 
                              border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.65rem', 
                              fontWeight: 700, marginTop: '0.2rem', color: 'var(--text-2)' 
                            }}>
                              PLATE: {v.plate}
                            </div>
                          )}
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', marginTop: '0.2rem' }}>
                            Chofer: <strong>{v.driver_name}</strong> {v.driver_ci && <span style={{ opacity: 0.7 }}>(CI: {v.driver_ci})</span>}
                            {v.coordinator_name && (
                              <div style={{ marginTop: '0.25rem', fontSize: '0.65rem', color: 'var(--plra-300)', fontWeight: 700 }}>
                                Responsable: {v.coordinator_name} (Lista {v.list_number})
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                          <span style={{ 
                            fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                            background: `rgba(${v.status === 'AVAILABLE' ? '34,197,94' : v.status === 'IN_TRANSIT' ? '234,179,8' : '239,68,68'}, 0.15)`,
                            color: statusColor
                          }}>
                            {statusLabel}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>
                            Capacidad: {assignedCount} / {v.capacity || 4}
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                        {pendingLogistics.filter(p => p.assigned_vehicle_id === v.id).map(cap => (
                          <div key={cap.id} style={{ 
                            padding: '0.2rem 0.5rem', background: 'rgba(34,197,94,0.1)', 
                            border: '1px solid rgba(34,197,94,0.2)', borderRadius: '6px', 
                            fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem'
                          }}>
                            <User size={10} /> {cap.nombre}
                          </div>
                        ))}
                        {assignedCount === 0 && (
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontStyle: 'italic' }}>Sin traslados asignados</span>
                        )}
                      </div>
                    </div>
                  )})} 
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal - Vehicle Registration */}
      <AnimatePresence>
        {showModal === 'vehicle' && (
          <div className="modal-overlay" onClick={() => setShowModal(null)}>
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <form onSubmit={handleCreateVehicle} style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ color: 'var(--text)', margin: 0 }}>Registrar Nuevo Vehículo</h3>
                  <button type="button" onClick={() => setShowModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                <div className="form-group">
                  <label>Nombre Identificador (Ej: Camioneta Blanca)</label>
                  <input className="modern-input-premium-styled" placeholder="Nombre descriptivo" value={newVehicleDesc} onChange={e => setNewVehicleDesc(e.target.value)} required />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Tipo de Vehículo</label>
                    <input className="modern-input-premium-styled" placeholder="Ej: Hilux, Corolla, etc." value={newVehicleType} onChange={e => setNewVehicleType(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Número de Chapa</label>
                    <input className="modern-input-premium-styled" placeholder="Ej: ABC 123" value={newVehiclePlate} onChange={e => setNewVehiclePlate(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label>C.I. del Chofer</label>
                  <div className="search-input-wrapper-premium">
                    <input className="modern-input-premium-styled" placeholder="Nº de Cédula" value={newVehicleDriverCI} onChange={e => setNewVehicleDriverCI(e.target.value)} required />
                    <button type="button" onClick={handleLookupDriverCI} className="search-btn-action">VERIFICAR</button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Nombre del Chofer</label>
                  <input className="modern-input-premium-styled" value={newVehicleDriver} onChange={e => setNewVehicleDriver(e.target.value)} placeholder="Autocompletado o Manual" required />
                </div>
                <div className="form-group">
                  <label>Teléfono del Chofer (WhatsApp)</label>
                  <input 
                    type="text" 
                    inputMode="tel" 
                    className="modern-input-premium-styled" 
                    value={newVehiclePhone} 
                    onChange={e => formatPhone(e.target.value)} 
                    placeholder="+595 9xx xxx xxx"
                    required 
                  />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Capacidad (Pasajeros)</label>
                    <input type="number" className="modern-input-premium-styled" value={newVehicleCapacity} onChange={e => setNewVehicleCapacity(parseInt(e.target.value))} required />
                  </div>
                  <div className="form-group">
                    <label>Estado</label>
                    <select className="modern-input-premium-styled" value={newVehicleStatus} onChange={e => setNewVehicleStatus(e.target.value)}>
                      <option value="AVAILABLE">Disponible</option>
                      <option value="IN_TRANSIT">En Ruta</option>
                      <option value="MAINTENANCE">Mantenimiento</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Asignar a Coordinador Responsable</label>
                  <select className="modern-input-premium-styled" value={newVehicleUser} onChange={e => setNewVehicleUser(e.target.value)} required>
                    <option value="">Seleccione un Coordinador...</option>
                    {users.filter(u => u.role === 'COORDINADOR').map(u => (
                      <option key={u.id} value={u.id}>
                        {u.nombre} (Lista {u.list_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="modal-footer">
                  <button type="button" onClick={() => setShowModal(null)} className="btn-cancel-styled">
                    Descartar
                  </button>
                  <button type="submit" className="btn-confirm-styled">
                    Registrar Vehículo <ChevronRight size={18} />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
};

export default LogisticsApp;
