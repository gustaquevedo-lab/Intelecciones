import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const CIUDADES_PARAGUAY: Record<string, { lat: number; lng: number; zoom: number }> = {
  'PEDRO JUAN CABALLERO': { lat: -22.545, lng: -55.72, zoom: 14 },
  'ASUNCION': { lat: -25.2637, lng: -57.5759, zoom: 13 },
  'ASUNCIÓN': { lat: -25.2637, lng: -57.5759, zoom: 13 },
  'CIUDAD DEL ESTE': { lat: -25.5097, lng: -54.6111, zoom: 13 },
  'ENCARNACION': { lat: -27.3308, lng: -55.8667, zoom: 14 },
  'ENCARNACIÓN': { lat: -27.3308, lng: -55.8667, zoom: 14 },
  'LUQUE': { lat: -25.2708, lng: -57.4872, zoom: 14 },
  'SAN LORENZO': { lat: -25.3400, lng: -57.5094, zoom: 14 },
  'LAMBARE': { lat: -25.3469, lng: -57.6064, zoom: 14 },
  'LAMBARÉ': { lat: -25.3469, lng: -57.6064, zoom: 14 },
  'FERNANDO DE LA MORA': { lat: -25.3390, lng: -57.5230, zoom: 14 },
  'CAPIATA': { lat: -25.3556, lng: -57.4437, zoom: 14 },
  'CAPIATÁ': { lat: -25.3556, lng: -57.4437, zoom: 14 },
  'ITAUGUA': { lat: -25.3889, lng: -57.3536, zoom: 14 },
  'ITAUGUÁ': { lat: -25.3889, lng: -57.3536, zoom: 14 },
  'CAAGUAZU': { lat: -25.4722, lng: -56.0178, zoom: 14 },
  'CAAGUAZÚ': { lat: -25.4722, lng: -56.0178, zoom: 14 },
  'CORONEL OVIEDO': { lat: -25.4492, lng: -56.4419, zoom: 14 },
  'VILLARRICA': { lat: -25.7500, lng: -56.4333, zoom: 14 },
  'CONCEPCION': { lat: -23.4055, lng: -57.4340, zoom: 14 },
  'CONCEPCIÓN': { lat: -23.4055, lng: -57.4340, zoom: 14 },
  'MARIANO ROQUE ALONSO': { lat: -25.2017, lng: -57.5275, zoom: 14 },
  'ÑEMBY': { lat: -25.3964, lng: -57.5383, zoom: 14 },
  'VILLA ELISA': { lat: -25.3750, lng: -57.5917, zoom: 14 },
  'LIMPIO': { lat: -25.1667, lng: -57.4833, zoom: 14 },
  'AREGUA': { lat: -25.3130, lng: -57.3900, zoom: 14 },
  'AREGUÁ': { lat: -25.3130, lng: -57.3900, zoom: 14 },
  'PILAR': { lat: -26.8625, lng: -58.3125, zoom: 14 },
  'SALTO DEL GUAIRA': { lat: -24.0611, lng: -54.3067, zoom: 14 },
  'SALTO DEL GUAIRÁ': { lat: -24.0611, lng: -54.3067, zoom: 14 },
  'HERNANDARIAS': { lat: -25.3971, lng: -54.6430, zoom: 14 },
  'PRESIDENTE FRANCO': { lat: -25.5500, lng: -54.6167, zoom: 14 },
  'MINGA GUAZU': { lat: -25.4833, lng: -54.7667, zoom: 14 },
  'MINGA GUAZÚ': { lat: -25.4833, lng: -54.7667, zoom: 14 },
  'SAN ESTANISLAO': { lat: -24.0000, lng: -56.4333, zoom: 14 },
  'SAN PEDRO DE YCUAMANDIYU': { lat: -24.0933, lng: -57.0828, zoom: 14 },
  'SAN PEDRO DE YCUAMANDIYÚ': { lat: -24.0933, lng: -57.0828, zoom: 14 },
  'SAN LAZARO': { lat: -22.1833, lng: -57.9333, zoom: 14 },
};

const MapHandler = ({ district }: { district: string | undefined }) => {
  const map = useMap();
  useEffect(() => {
    if (district) {
      const city = district.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (CIUDADES_PARAGUAY[city]) {
        map.flyTo([CIUDADES_PARAGUAY[city].lat, CIUDADES_PARAGUAY[city].lng], CIUDADES_PARAGUAY[city].zoom, { duration: 2 });
      }
    }
  }, [district, map]);
  return null;
};

const createCustomIcon = (color: string, icon: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${color}; 
        width: 32px; height: 32px; 
        border-radius: 50%; 
        border: 2.5px solid white; 
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        color: white;
        font-size: 16px;
      ">
        ${icon}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

interface LogisticsMapProps {
  pendingRequests: any[];
  vehicles: any[];
  clusters: any[];
  activeDistrict?: string;
  locales?: any[];
}

const LogisticsMap: React.FC<LogisticsMapProps> = ({ pendingRequests, vehicles, clusters, activeDistrict, locales = [] }) => {
  const defaultCenter: [number, number] = [-22.5411, -55.7283]; // PJC Default

  return (
    <div style={{ height: '100%', width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <MapContainer center={defaultCenter} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapHandler district={activeDistrict} />

        {/* Locales de Votación del Distrito */}
        {locales
          .filter(l => l.distrito === activeDistrict && l.lat && l.lng)
          .map(local => (
            <Marker 
              key={`local-${local.cod_local}`} 
              position={[local.lat, local.lng]}
              icon={createCustomIcon('var(--plra-600)', '🏛️')}
            >
              <Popup>
                <div style={{ padding: '0.2rem' }}>
                  <p style={{ fontWeight: 800, margin: 0, color: 'var(--plra-600)' }}>LOCAL DE VOTACIÓN</p>
                  <p style={{ margin: '0.25rem 0', fontWeight: 700 }}>{local.nombre}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-3)' }}>{local.direccion}</p>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Solicitudes de Transporte (Electores) */}
        {pendingRequests
          .filter(r => r.lat && r.lng)
          .map(req => (
            <Marker 
              key={`req-${req.id}`} 
              position={[req.lat, req.lng]}
              icon={createCustomIcon(req.is_priority ? 'var(--red)' : 'var(--blue)', '👤')}
            >
              <Popup>
                <div style={{ padding: '0.2rem' }}>
                  <p style={{ fontWeight: 800, margin: 0 }}>{req.nombre} {req.apellido}</p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.8rem' }}>Destino: <span style={{ fontWeight: 700 }}>{req.local_votacion}</span></p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-3)' }}>Barrio: {req.barrio}</p>
                  {req.is_priority === 1 && <p style={{ margin: '0.5rem 0 0', color: 'var(--red)', fontWeight: 800, fontSize: '0.7rem' }}>⚠️ PRIORIDAD ALTA</p>}
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Clusters (Neighborhoods) */}
        {clusters.map((cluster, idx) => (
          <Circle
            key={`cluster-${idx}`}
            center={[cluster.lat, cluster.lng]}
            radius={300}
            pathOptions={{ color: 'var(--plra-400)', fillColor: 'var(--plra-400)', fillOpacity: 0.15 }}
          >
            <Popup>
              <strong>{cluster.barrio}</strong><br />
              {cluster.count} solicitudes pendientes
            </Popup>
          </Circle>
        ))}

        {/* Vehicles */}
        {vehicles.filter(v => v.lat && v.lng).map(v => (
          <Marker 
            key={`v-${v.id}`} 
            position={[v.lat, v.lng]}
            icon={createCustomIcon('var(--green)', '🚚')}
          >
            <Popup>
              <div style={{ padding: '0.2rem' }}>
                <p style={{ fontWeight: 800, margin: 0 }}>Móvil: {v.description}</p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.8rem' }}>Chofer: {v.driver_name}</p>
                <span className={`badge ${v.status === 'AVAILABLE' ? 'badge-green' : 'badge-yellow'}`}>
                  {v.status === 'AVAILABLE' ? 'DISPONIBLE' : 'EN RUTA'}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default LogisticsMap;
