import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, User, MapPin, CheckCircle, Clock, AlertTriangle,
  ChevronRight, UserPlus, Plus, Phone, Users, ShieldAlert,
  Calendar, Check, X, FileText, CheckCircle2
} from 'lucide-react';
import MainLayout from '../components/MainLayout';
import api from '../services/api';

interface Vehicle {
  id: number;
  description: string;
  driver_name: string;
  driver_phone: string;
  driver_ci: string;
  capacity: number;
  status: 'AVAILABLE' | 'IN_TRANSIT' | 'MAINTENANCE';
  plate: string;
  coordinator_name?: string;
  current_passengers?: number;
  passengers_pending?: string;
  passengers_in_transit?: string;
}

interface Elector {
  id: number;
  elector_ci: string;
  nombre: string;
  apellido: string;
  local_votacion: string;
  barrio: string;
  is_priority: number;
  assigned_vehicle_id: number | null;
  transport_status: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED';
  vehicle_desc?: string;
}

const Logistics: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pendingElectors, setPendingElectors] = useState<Elector[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'flota' | 'mapa-barrios'>('flota');

  // Modals / Form States
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverCI, setDriverCI] = useState('');
  const [vehicleDesc, setVehicleDesc] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleCapacity, setVehicleCapacity] = useState(4);
  const [savingDriver, setSavingDriver] = useState(false);

  // Assignment State
  const [assigningElector, setAssigningElector] = useState<Elector | null>(null);

  const fetchData = async () => {
    try {
      const [vehiclesRes, pendingRes] = await Promise.all([
        api.get('/vehicles'),
        api.get('/logistics/pending')
      ]);
      setVehicles(vehiclesRes.data);
      setPendingElectors(pendingRes.data);
    } catch (err) {
      console.error('Error fetching logistics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName || !driverPhone || !vehicleDesc || !vehiclePlate) {
      alert('Por favor, complete todos los campos obligatorios.');
      return;
    }
    setSavingDriver(true);
    try {
      await api.post('/vehicles', {
        description: vehicleDesc,
        driver_name: driverName,
        driver_phone: driverPhone,
        driver_ci: driverCI,
        capacity: vehicleCapacity,
        plate: vehiclePlate,
        status: 'AVAILABLE'
      });
      
      // Reset Form
      setDriverName('');
      setDriverPhone('');
      setDriverCI('');
      setVehicleDesc('');
      setVehiclePlate('');
      setVehicleCapacity(4);
      setShowAddDriver(false);
      
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Error al registrar el chofer.');
    } finally {
      setSavingDriver(false);
    }
  };

  const handleAssignVehicle = async (vehicleId: number) => {
    if (!assigningElector) return;
    try {
      await api.post('/logistics/assign', {
        capture_id: assigningElector.id,
        vehicle_id: vehicleId
      });
      setAssigningElector(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Error al asignar el móvil.');
    }
  };

  const handleCompleteTrip = async (vehicleId: number) => {
    try {
      await api.post('/logistics/complete-trip', { vehicle_id: vehicleId });
      await fetchData();
      alert('¡Viajes completados con éxito para este móvil!');
    } catch (err) {
      console.error(err);
      alert('Error al completar el viaje.');
    }
  };

  // Group electors by Neighborhood (Barrio)
  const groupedElectors = pendingElectors.reduce<Record<string, Elector[]>>((acc, curr) => {
    const key = curr.barrio ? curr.barrio.toUpperCase() : 'SIN BARRIO ESPECIFICADO';
    if (!acc[key]) acc[key] = [];
    acc[key].push(curr);
    return acc;
  }, {});

  return (
    <MainLayout>
      <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', boxSizing: 'border-box' }}>
        
        {/* Title Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 850, color: 'var(--text)', margin: 0, fontFamily: 'Space Grotesk' }}>
              Logística y Movilización "Uber Electoral"
            </h1>
            <p style={{ color: 'var(--text-3)', fontSize: '0.8rem', margin: '0.3rem 0 0 0' }}>
              Pedro Juan Caballero — Control total en tiempo real de flota, traslados y semáforos de votación.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => setShowAddDriver(true)}
              style={{
                background: 'var(--plra-500)', color: 'white', border: 'none',
                borderRadius: '8px', padding: '0.6rem 1.1rem', fontSize: '0.75rem',
                fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem',
                cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
              }}
            >
              <UserPlus size={15} /> Registrar Móvil / Chofer
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border)', gap: '1.5rem', paddingBottom: '0.2rem'
        }}>
          <button
            onClick={() => setActiveTab('flota')}
            style={{
              background: 'none', border: 'none', borderBottom: activeTab === 'flota' ? '2px solid var(--plra-400)' : 'none',
              padding: '0.5rem 0.2rem', color: activeTab === 'flota' ? 'var(--text)' : 'var(--text-3)',
              fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            Flota Activa ({vehicles.length})
          </button>
          <button
            onClick={() => setActiveTab('mapa-barrios')}
            style={{
              background: 'none', border: 'none', borderBottom: activeTab === 'mapa-barrios' ? '2px solid var(--plra-400)' : 'none',
              padding: '0.5rem 0.2rem', color: activeTab === 'mapa-barrios' ? 'var(--text)' : 'var(--text-3)',
              fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            Demanda por Barrio ({pendingElectors.length} Electores)
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-3)', fontSize: '0.85rem' }}>
            Cargando centro de despacho de logística...
          </div>
        ) : (
          <div style={{ width: '100%' }}>
            {activeTab === 'flota' && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem'
              }}>
                {vehicles.map(v => (
                  <div
                    key={v.id}
                    style={{
                      background: 'var(--surface-light)', border: '1px solid var(--border)',
                      borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column',
                      gap: '1rem', position: 'relative', overflow: 'hidden'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '10px',
                          background: 'rgba(59, 130, 246, 0.1)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Truck size={20} style={{ color: 'var(--plra-400)' }} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--text)' }}>
                            {v.driver_name}
                          </h4>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
                            Chapa: {v.plate} • Capacidad: {v.capacity}
                          </span>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '0.6rem', fontWeight: 800,
                        background: v.status === 'AVAILABLE' ? 'rgba(37,99,235,0.1)' : v.status === 'IN_TRANSIT' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                        color: v.status === 'AVAILABLE' ? 'var(--plra-300)' : v.status === 'IN_TRANSIT' ? '#F59E0B' : '#EF4444',
                        padding: '0.25rem 0.5rem', borderRadius: '6px'
                      }}>
                        {v.status === 'AVAILABLE' ? 'DISPONIBLE' : v.status === 'IN_TRANSIT' ? 'EN VIAJE' : 'MANTENIMIENTO'}
                      </span>
                    </div>

                    <div style={{
                      background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '10px',
                      fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '0.4rem',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-2)' }}>
                        <span>Vehículo:</span>
                        <span style={{ fontWeight: 700 }}>{v.description}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-2)' }}>
                        <span>Contacto:</span>
                        <a href={`tel:${v.driver_phone}`} style={{ textDecoration: 'none', color: 'var(--plra-350)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Phone size={11} /> {v.driver_phone}
                        </a>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-2)' }}>
                        <span>Asignaciones Activas:</span>
                        <span style={{ fontWeight: 700, color: 'var(--plra-300)' }}>{v.current_passengers} pasajeros</span>
                      </div>
                    </div>

                    {v.passengers_in_transit && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#F59E0B', textTransform: 'uppercase' }}>En Tránsito:</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-2)', lineHeight: 1.3 }}>{v.passengers_in_transit}</span>
                      </div>
                    )}

                    {v.passengers_pending && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase' }}>Pendientes de Recogida:</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', lineHeight: 1.3 }}>{v.passengers_pending}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                      <button
                        onClick={() => handleCompleteTrip(v.id)}
                        disabled={v.current_passengers === 0}
                        style={{
                          flex: 1, background: 'none', border: '1px solid var(--border)',
                          borderRadius: '8px', padding: '0.5rem', color: v.current_passengers === 0 ? 'var(--text-3)' : 'var(--text)',
                          fontSize: '0.7rem', fontWeight: 700, cursor: v.current_passengers === 0 ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                          transition: 'all 0.2s'
                        }}
                      >
                        <CheckCircle size={13} /> Finalizar Viaje
                      </button>
                    </div>
                  </div>
                ))}

                {vehicles.length === 0 && (
                  <div style={{
                    gridColumn: '1 / -1', background: 'var(--surface-light)', padding: '3rem',
                    borderRadius: '16px', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-3)'
                  }}>
                    <Truck size={36} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>No hay vehículos ni conductores registrados.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'mapa-barrios' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {Object.entries(groupedElectors).map(([barrio, electors]) => (
                  <div
                    key={barrio}
                    style={{
                      background: 'var(--surface-light)', border: '1px solid var(--border)',
                      borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem'
                    }}
                  >
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem'
                    }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 850, color: 'var(--text)' }}>
                          Barrio: {barrio}
                        </h4>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
                          {electors.length} electores pendientes de transporte.
                        </span>
                      </div>
                    </div>

                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem'
                    }}>
                      {electors.map(e => (
                        <div
                          key={e.id}
                          style={{
                            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                            borderRadius: '12px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', gap: '0.5rem'
                          }}
                        >
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '50%',
                              background: e.is_priority ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.7rem', fontWeight: 800, color: e.is_priority ? '#F59E0B' : 'var(--text-2)'
                            }}>
                              {e.is_priority ? '⚠' : '#'}
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800, color: 'var(--text)' }}>
                                {e.nombre} {e.apellido}
                              </p>
                              <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-3)' }}>
                                {e.local_votacion} • Mesa {e.mesa} • CI: {e.elector_ci}
                              </p>
                            </div>
                          </div>

                          <div>
                            {e.assigned_vehicle_id ? (
                              <span style={{
                                fontSize: '0.62rem', fontWeight: 700, color: '#25C882',
                                background: 'rgba(37,200,130,0.1)', padding: '0.2rem 0.4rem', borderRadius: '4px'
                              }}>
                                Móvil: {e.vehicle_desc || 'Asignado'}
                              </span>
                            ) : (
                              <button
                                onClick={() => setAssigningElector(e)}
                                style={{
                                  background: 'none', border: '1px solid var(--plra-400)',
                                  borderRadius: '6px', padding: '0.25rem 0.5rem', color: 'var(--plra-300)',
                                  fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                Asignar Móvil
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {Object.keys(groupedElectors).length === 0 && (
                  <div style={{
                    background: 'var(--surface-light)', padding: '3rem',
                    borderRadius: '16px', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-3)'
                  }}>
                    <CheckCircle2 size={36} style={{ marginBottom: '0.75rem', color: '#25C882', opacity: 0.8 }} />
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>No hay traslados pendientes de movilización.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Driver Registration Modal */}
      <AnimatePresence>
        {showAddDriver && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)'
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                width: '100%', maxWidth: '440px', background: 'var(--surface-light)',
                border: '1px solid var(--border)', borderRadius: '20px', padding: '1.5rem',
                display: 'flex', flexDirection: 'column', gap: '1.25rem', boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'Space Grotesk' }}>
                  Registrar Chofer y Vehículo
                </h3>
                <button onClick={() => setShowAddDriver(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateDriver} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-2)', fontWeight: 600 }}>Nombre del Chofer *</span>
                  <input
                    required
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    style={{
                      background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px',
                      padding: '0.5rem 0.75rem', color: 'var(--text)', fontSize: '0.75rem', outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-2)', fontWeight: 600 }}>C.I. Chofer</span>
                    <input
                      value={driverCI}
                      onChange={e => setDriverCI(e.target.value)}
                      placeholder="Ej. 3456789"
                      style={{
                        background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px',
                        padding: '0.5rem 0.75rem', color: 'var(--text)', fontSize: '0.75rem', outline: 'none'
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-2)', fontWeight: 600 }}>Celular *</span>
                    <input
                      required
                      value={driverPhone}
                      onChange={e => setDriverPhone(e.target.value)}
                      placeholder="Ej. 0981555666"
                      style={{
                        background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px',
                        padding: '0.5rem 0.75rem', color: 'var(--text)', fontSize: '0.75rem', outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-2)', fontWeight: 600 }}>Descripción del Vehículo *</span>
                  <input
                    required
                    value={vehicleDesc}
                    onChange={e => setVehicleDesc(e.target.value)}
                    placeholder="Ej. Toyota Hilux Gris"
                    style={{
                      background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px',
                      padding: '0.5rem 0.75rem', color: 'var(--text)', fontSize: '0.75rem', outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-2)', fontWeight: 600 }}>Número de Chapa *</span>
                    <input
                      required
                      value={vehiclePlate}
                      onChange={e => setVehiclePlate(e.target.value)}
                      placeholder="Ej. AAA 123 PY"
                      style={{
                        background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px',
                        padding: '0.5rem 0.75rem', color: 'var(--text)', fontSize: '0.75rem', outline: 'none'
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-2)', fontWeight: 600 }}>Capacidad Pasajeros *</span>
                    <input
                      required
                      type="number"
                      min={1}
                      max={40}
                      value={vehicleCapacity}
                      onChange={e => setVehicleCapacity(parseInt(e.target.value) || 4)}
                      style={{
                        background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px',
                        padding: '0.5rem 0.75rem', color: 'var(--text)', fontSize: '0.75rem', outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingDriver}
                  style={{
                    background: 'var(--plra-500)', color: 'white', border: 'none',
                    borderRadius: '8px', padding: '0.65rem', fontSize: '0.78rem',
                    fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                    marginTop: '0.5rem'
                  }}
                >
                  {savingDriver ? 'Registrando...' : 'Registrar Chofer y Vehículo'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Vehicle Assignment Selection Modal */}
      <AnimatePresence>
        {assigningElector && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)'
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                width: '100%', maxWidth: '420px', background: 'var(--surface-light)',
                border: '1px solid var(--border)', borderRadius: '20px', padding: '1.5rem',
                display: 'flex', flexDirection: 'column', gap: '1.25rem', boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'Space Grotesk' }}>
                    Asignar Móvil de Traslado
                  </h3>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.7rem', color: 'var(--text-3)' }}>
                    Pasajero: {assigningElector.nombre} {assigningElector.apellido} (Barrio: {assigningElector.barrio})
                  </p>
                </div>
                <button onClick={() => setAssigningElector(null)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{
                maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem'
              }}>
                {vehicles.filter(v => v.status === 'AVAILABLE').map(v => (
                  <div
                    key={v.id}
                    onClick={() => handleAssignVehicle(v.id)}
                    style={{
                      padding: '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border)', cursor: 'pointer', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s'
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800, color: 'var(--text)' }}>
                        {v.driver_name}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-3)' }}>
                        {v.description} • Pasajeros: {v.current_passengers}/{v.capacity}
                      </p>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-3)' }} />
                  </div>
                ))}

                {vehicles.filter(v => v.status === 'AVAILABLE').length === 0 && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', textAlign: 'center', padding: '1rem' }}>
                    No hay vehículos disponibles en este momento.
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </MainLayout>
  );
};

export default Logistics;
