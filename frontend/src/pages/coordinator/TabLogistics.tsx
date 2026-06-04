import React, { useState, useEffect } from 'react';
import { Truck, MapPin, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import LogisticsMap from '../../components/LogisticsMap';

const TabLogistics = ({ activeDistrict }: { activeDistrict?: string }) => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [electors, setElectors] = useState<any[]>([]);
  const [locales, setLocales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [vRes, cRes, lRes] = await Promise.all([
        api.get('/vehicles'),
        api.get('/captures'),
        api.get('/diad/coverage')
      ]);

      setVehicles(vRes.data || []);
      
      // Filter electors who need transport and are not completed
      const pendingElectors = (cRes.data || []).filter(
        (e: any) => e.needs_transport && e.transport_status !== 'COMPLETED'
      );
      setElectors(pendingElectors);

      if (lRes.data && lRes.data.mesas) {
        // Build locales list from coverage mesas
        const uniqueLocales: any[] = [];
        const seen = new Set();
        lRes.data.mesas.forEach((m: any) => {
          const key = m.local;
          if (key && !seen.has(key)) {
            seen.add(key);
            uniqueLocales.push({
              cod_local: key,
              nombre: key,
              lat: m.lat,
              lng: m.lng
            });
          }
        });
        setLocales(uniqueLocales);
      }
    } catch (e) {
      console.error('[COORDINATOR_LOGISTICS_TAB]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh logistics every 30 seconds for live updates
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="loading-spinner" style={{ margin: '0 auto' }} />
        <p style={{ marginTop: '1rem', color: 'var(--text-3)' }}>Cargando mapa y logística de vehículos...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Map view container */}
      <div className="card-premium-styled" style={{ padding: '0.5rem', height: '350px', position: 'relative', overflow: 'hidden', borderRadius: '16px' }}>
        <LogisticsMap 
          pendingRequests={electors}
          vehicles={vehicles}
          clusters={[]}
          activeDistrict={activeDistrict}
          locales={locales}
        />
      </div>

      {/* Header text with refresh button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
        <div>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 900, color: 'white', margin: 0, textTransform: 'uppercase' }}>
            Electores Pendientes de Recogida ({electors.length})
          </h4>
        </div>
        <button
          onClick={fetchData}
          disabled={refreshing}
          style={{ background: 'transparent', border: 'none', color: 'var(--plra-300)', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
        >
          <RefreshCw size={12} className={refreshing ? 'spin-animation' : ''} /> {refreshing ? 'Refrescando...' : 'Refrescar'}
        </button>
      </div>

      {/* List of pending electors */}
      {electors.length === 0 ? (
        <div className="card-premium-styled" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>
          <AlertCircle size={32} style={{ color: 'var(--green)', marginBottom: '0.5rem', display: 'inline-block' }} />
          <p style={{ fontSize: '0.8rem', margin: 0, fontWeight: 700 }}>¡Todo despejado! No hay electores pendientes de recogida.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {electors.map(e => (
            <div key={e.id} className="card-premium-styled" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'white', display: 'block' }}>
                  {e.elector_nombre || 'Elector'} (C.I. {e.elector_ci})
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                  <MapPin size={12} /> Destino: {e.local_votacion}
                </span>
              </div>
              
              <span style={{
                padding: '2px 8px', borderRadius: '6px', fontSize: '0.55rem', fontWeight: 900,
                background: e.transport_status === 'IN_TRANSIT' ? 'rgba(217,119,6,0.1)' : 'rgba(239,68,68,0.1)',
                color: e.transport_status === 'IN_TRANSIT' ? 'var(--yellow)' : 'var(--red)',
                border: `1px solid ${e.transport_status === 'IN_TRANSIT' ? 'rgba(217,119,6,0.2)' : 'rgba(239,68,68,0.2)'}`
              }}>
                {e.transport_status === 'IN_TRANSIT' ? 'EN VIAJE' : 'PENDIENTE'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TabLogistics;
