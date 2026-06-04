import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, Users, MapPin, Play, Square, Settings, RefreshCw, AlertCircle, Check, Map } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { LocationService } from '../services/LocationService';
import { OfflineQueueService } from '../services/OfflineQueueService';

const DriverApp = () => {
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<any>(null);
  const [allVehicles, setAllVehicles] = useState<any[]>([]);
  const [passengers, setPassengers] = useState<any[]>([]);
  const [status, setStatus] = useState<'AVAILABLE' | 'IN_TRANSIT' | 'MAINTENANCE'>('AVAILABLE');
  const [tracking, setTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('');
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);

  const loadVehicle = async () => {
    try {
      setLoading(true);
      const res = await api.get('/vehicles');
      setAllVehicles(res.data);
      
      const myVehicle = res.data.find((v: any) => v.driver_ci === user?.ci || v.assigned_user_id === user?.id);
      if (myVehicle) {
        setVehicle(myVehicle);
        setStatus(myVehicle.status);
        
        // Load passengers
        const passRes = await api.get(`/vehicles/${myVehicle.id}/passengers`);
        setPassengers(passRes.data);
      } else {
        setVehicle(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicle();
  }, [user]);

  const handleSelectVehicle = async (vehicleId: number) => {
    try {
      setLoading(true);
      await api.put(`/vehicles/${vehicleId}/driver`, {
        driver_name: user?.nombre || '',
        driver_ci: user?.ci || '',
        driver_phone: user?.telefono || ''
      });
      await loadVehicle();
      setShowVehicleSelector(false);
    } catch (e) {
      alert('Error al asignar el vehículo. Intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeselectVehicle = async () => {
    if (!vehicle) return;
    if (!window.confirm('¿Desea desvincularse de este vehículo?')) return;
    try {
      setLoading(true);
      await api.put(`/vehicles/${vehicle.id}/driver`, {
        driver_name: null,
        driver_ci: null,
        driver_phone: null
      });
      setVehicle(null);
      await loadVehicle();
    } catch (e) {
      alert('Error al desvincular el vehículo.');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: 'AVAILABLE' | 'IN_TRANSIT' | 'MAINTENANCE') => {
    setStatus(newStatus);
    if (!vehicle) return;
    try {
      const payload = { status: newStatus };
      if (navigator.onLine) {
        await api.put(`/vehicles/${vehicle.id}/status`, payload);
      } else {
        await OfflineQueueService.enqueue({
          type: 'VEHICLE_STATUS',
          url: `/vehicles/${vehicle.id}/status`,
          method: 'PUT',
          data: payload
        });
        setSyncStatus('Estado encolado offline.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updatePassengerStatus = async (captureId: number, nextStatus: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED') => {
    try {
      // Optimistic update
      setPassengers(prev => prev.map(p => p.capture_id === captureId ? { ...p, transport_status: nextStatus } : p));
      
      const payload = { status: nextStatus };
      if (navigator.onLine) {
        await api.post(`/diad/electors/${captureId}/transport`, payload);
      } else {
        await OfflineQueueService.enqueue({
          type: 'PASSENGER_STATUS',
          url: `/diad/electors/${captureId}/transport`,
          method: 'POST',
          data: payload
        });
        setSyncStatus('Estado del pasajero encolado offline.');
      }
    } catch (e) {
      alert('Error al actualizar el estado del pasajero.');
      loadVehicle(); // Rollback
    }
  };

  const startRoute = async () => {
    if (!vehicle) return;
    setTracking(true);
    updateStatus('IN_TRANSIT');
    
    LocationService.startTracking(async (coords) => {
      const payload = { lat: coords.latitude, lng: coords.longitude };
      try {
        if (navigator.onLine) {
          await api.post(`/vehicles/${vehicle.id}/location`, payload);
        } else {
          await OfflineQueueService.enqueue({
            type: 'GPS_PING',
            url: `/vehicles/${vehicle.id}/location`,
            method: 'POST',
            data: payload
          });
        }
      } catch (err) {
        console.error(err);
      }
    });
  };

  const stopRoute = () => {
    setTracking(false);
    LocationService.stopTracking();
    updateStatus('AVAILABLE');
  };

  const completeTrip = async () => {
    if (!vehicle) return;
    if (!window.confirm('¿Confirmar llegada de todos los electores a destino?')) return;

    try {
      if (navigator.onLine) {
        await api.post('/logistics/complete-trip', { vehicle_id: vehicle.id });
      } else {
        await OfflineQueueService.enqueue({
          type: 'COMPLETE_TRIP',
          url: '/logistics/complete-trip',
          method: 'POST',
          data: { vehicle_id: vehicle.id }
        });
      }
      loadVehicle();
    } catch (e) {
      alert('Error completando viaje.');
    }
  };

  if (loading) {
    return (
      <MainLayout title="Consola Chofer" userName={user?.nombre || 'Chofer'}>
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="loading-spinner" style={{ margin: '0 auto' }} />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Consola Chofer" userName={user?.nombre || 'Chofer'}>
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Vehicle Info Card */}
        {vehicle ? (
          <div className="card-premium-styled" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Truck size={24} style={{ color: 'var(--plra-300)' }} />
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 900, color: 'white', margin: 0 }}>
                    {vehicle.description} ({vehicle.plate})
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', margin: 0 }}>
                    Capacidad: {vehicle.capacity} personas
                  </p>
                </div>
              </div>
              <button
                onClick={handleDeselectVehicle}
                style={{
                  padding: '0.35rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.03)', color: 'var(--red)', fontSize: '0.65rem',
                  fontWeight: 800, cursor: 'pointer'
                }}
              >
                Cambiar Vehículo
              </button>
            </div>
          </div>
        ) : (
          <div className="card-premium-styled" style={{ padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <AlertCircle size={40} style={{ color: 'var(--yellow)' }} />
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white', margin: '0 0 0.25rem' }}>Vehículo no Asignado</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', margin: 0 }}>
                Debe seleccionar un vehículo de la flota para iniciar operaciones y el geoseguimiento.
              </p>
            </div>
            
            <button
              onClick={() => setShowVehicleSelector(true)}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '12px', border: 'none',
                background: 'var(--plra-500)', color: 'white', fontWeight: 900, fontSize: '0.8rem',
                cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,71,171,0.3)'
              }}
            >
              SELECCIONAR MI VEHÍCULO
            </button>
          </div>
        )}

        {/* Vehicle Selector Drawer */}
        {showVehicleSelector && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            zIndex: 99999, display: 'flex', alignItems: 'flex-end'
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '40%' }} onClick={() => setShowVehicleSelector(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              style={{
                width: '100%', height: '60%', background: 'var(--surface-light)',
                borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ color: 'white', fontWeight: 900, margin: 0 }}>Seleccionar Vehículo de la Flota</h4>
                <button onClick={() => setShowVehicleSelector(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)' }}>
                  <X size={20} />
                </button>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {allVehicles.map(v => (
                  <div
                    key={v.id}
                    onClick={() => handleSelectVehicle(v.id)}
                    style={{
                      padding: '1rem', background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border)', borderRadius: '12px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                    }}
                  >
                    <div>
                      <span style={{ color: 'white', fontWeight: 800, display: 'block' }}>{v.description}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Chapa: {v.plate} · Capacidad: {v.capacity}</span>
                    </div>
                    {v.driver_name ? (
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>Conductor: {v.driver_name}</span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--green)', fontWeight: 800 }}>✓ Libre</span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* State Controllers */}
        {vehicle && (
          <>
            <div className="card-premium-styled" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', margin: 0 }}>
                Estado de Operación
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                {[
                  { id: 'AVAILABLE', label: 'Disponible', color: 'var(--green)' },
                  { id: 'IN_TRANSIT', label: 'En Viaje', color: 'var(--plra-300)' },
                  { id: 'MAINTENANCE', label: 'Taller', color: 'var(--red)' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => updateStatus(opt.id as any)}
                    style={{
                      padding: '0.6rem 0.5rem',
                      borderRadius: '10px',
                      border: status === opt.id ? `2px solid ${opt.color}` : '1px solid var(--border)',
                      background: status === opt.id ? `${opt.color}15` : 'transparent',
                      color: status === opt.id ? opt.color : 'var(--text-3)',
                      fontWeight: 900,
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                {tracking ? (
                  <button
                    onClick={stopRoute}
                    style={{
                      width: '100%', padding: '0.85rem', borderRadius: '12px', border: 'none',
                      background: 'var(--red)', color: 'white', fontWeight: 900, fontSize: '0.85rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer'
                    }}
                  >
                    <Square size={16} /> DETENER SEGUIMIENTO GPS
                  </button>
                ) : (
                  <button
                    onClick={startRoute}
                    style={{
                      width: '100%', padding: '0.85rem', borderRadius: '12px', border: 'none',
                      background: 'var(--green)', color: 'white', fontWeight: 900, fontSize: '0.85rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer'
                    }}
                  >
                    <Play size={16} /> INICIAR VIAJE & GPS TRACKING
                  </button>
                )}
              </div>
            </div>

            {/* Elector lists */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', margin: 0 }}>
                Confirmación de Pasajeros
              </h4>
              <button onClick={loadVehicle} style={{ background: 'transparent', border: 'none', color: 'var(--plra-300)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                <RefreshCw size={12} /> Refrescar
              </button>
            </div>

            {passengers.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                No tienes pasajeros asignados para traslado.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '2rem' }}>
                {passengers.map(p => (
                  <div key={p.capture_id} className="card-premium-styled" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'white', display: 'block' }}>
                          {p.nombre} {p.apellido}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                          <MapPin size={12} /> {p.local_votacion} · Mesa {p.mesa}
                        </span>
                      </div>
                      
                      {/* Current Status Badge */}
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px', fontSize: '0.55rem', fontWeight: 900,
                        background: p.transport_status === 'COMPLETED' ? 'rgba(34,197,94,0.1)' : p.transport_status === 'IN_TRANSIT' ? 'rgba(217,119,6,0.1)' : 'rgba(239,68,68,0.1)',
                        color: p.transport_status === 'COMPLETED' ? 'var(--green)' : p.transport_status === 'IN_TRANSIT' ? 'var(--yellow)' : 'var(--red)',
                        border: `1px solid ${p.transport_status === 'COMPLETED' ? 'rgba(34,197,94,0.2)' : p.transport_status === 'IN_TRANSIT' ? 'rgba(217,119,6,0.2)' : 'rgba(239,68,68,0.2)'}`
                      }}>
                        {p.transport_status === 'COMPLETED' ? 'ENTREGADO' : p.transport_status === 'IN_TRANSIT' ? 'RECOGIDO' : 'PENDIENTE'}
                      </span>
                    </div>

                    {/* Individual Status Actions */}
                    <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.6rem' }}>
                      <button
                        onClick={() => updatePassengerStatus(p.capture_id, 'PENDING')}
                        style={{
                          flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border)',
                          background: p.transport_status === 'PENDING' ? 'rgba(255,255,255,0.05)' : 'transparent',
                          color: 'var(--text-3)', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer'
                        }}
                      >
                        Pendiente
                      </button>
                      <button
                        onClick={() => updatePassengerStatus(p.capture_id, 'IN_TRANSIT')}
                        style={{
                          flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)',
                          background: p.transport_status === 'IN_TRANSIT' ? 'rgba(245,158,11,0.08)' : 'transparent',
                          color: 'var(--yellow)', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer'
                        }}
                      >
                        Recoger (En Viaje)
                      </button>
                      <button
                        onClick={() => updatePassengerStatus(p.capture_id, 'COMPLETED')}
                        style={{
                          flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)',
                          background: p.transport_status === 'COMPLETED' ? 'rgba(34,197,94,0.08)' : 'transparent',
                          color: 'var(--green)', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer'
                        }}
                      >
                        Entregado
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={completeTrip}
                  style={{
                    width: '100%', padding: '0.85rem', borderRadius: '12px', border: 'none',
                    background: 'linear-gradient(135deg, #22C47E, #16a34a)', color: 'white', fontWeight: 900,
                    fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(34,197,94,0.2)'
                  }}
                >
                  🏁 CONFIRMAR TODOS ENTREGADOS
                </button>
              </div>
            )}
          </>
        )}

        {syncStatus && (
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--yellow)', margin: 0 }}>
            {syncStatus}
          </p>
        )}
      </div>
    </MainLayout>
  );
};

export default DriverApp;
