import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, Users, MapPin, Play, Square, Settings, RefreshCw, AlertCircle } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { LocationService } from '../services/LocationService';
import { OfflineQueueService } from '../services/OfflineQueueService';

const DriverApp = () => {
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<any>(null);
  const [passengers, setPassengers] = useState<any[]>([]);
  const [status, setStatus] = useState<'AVAILABLE' | 'IN_TRANSIT' | 'MAINTENANCE'>('AVAILABLE');
  const [tracking, setTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('');

  const loadVehicle = async () => {
    try {
      setLoading(true);
      // Attempt to load assigned vehicle from backend
      const res = await api.get('/vehicles');
      // Find matching driver vehicle
      const myVehicle = res.data.find((v: any) => v.driver_ci === user?.ci || v.assigned_user_id === user?.id);
      if (myVehicle) {
        setVehicle(myVehicle);
        setStatus(myVehicle.status);
        
        // Load passengers
        const passRes = await api.get(`/vehicles/${myVehicle.id}/passengers`);
        setPassengers(passRes.data);
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

  if (!vehicle) {
    return (
      <MainLayout title="Consola Chofer" userName={user?.nombre || 'Chofer'}>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>
          <AlertCircle size={48} style={{ color: 'var(--yellow)', marginBottom: '1rem' }} />
          <h3>Vehículo no Asignado</h3>
          <p>No tienes ningún vehículo asignado a tu número de C.I. ({user?.ci}) en el sistema.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Consola Chofer" userName={user?.nombre || 'Chofer'}>
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Vehicle metadata */}
        <div className="card-premium-styled" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Truck size={24} style={{ color: 'var(--plra-300)' }} />
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 900, color: 'white', margin: 0 }}>
                {vehicle.description} ({vehicle.plate})
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: 0 }}>
                Capacidad: {vehicle.capacity} personas
              </p>
            </div>
          </div>
        </div>

        {/* State Controllers */}
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
            Pasajeros Asignados
          </h4>
          <button onClick={loadVehicle} style={{ background: 'transparent', border: 'none', color: 'var(--plra-300)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
            <RefreshCw size={12} /> Refrescar
          </button>
        </div>

        {passengers.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)', fontSize: '0.8rem' }}>
            No tienes pasajeros asignados.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {passengers.map(p => (
              <div key={p.capture_id} className="card-premium-styled" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'white', display: 'block' }}>
                    {p.nombre} {p.apellido}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <MapPin size={12} /> {p.local_votacion} · Mesa {p.mesa}
                  </span>
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: '6px', fontSize: '0.55rem', fontWeight: 950,
                  background: p.transport_status === 'COMPLETED' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: p.transport_status === 'COMPLETED' ? 'var(--green)' : 'var(--red)',
                  border: `1px solid ${p.transport_status === 'COMPLETED' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`
                }}>
                  {p.transport_status}
                </span>
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
              🏁 CONFIRMAR LLEGADA DE PASAJEROS
            </button>
          </div>
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
