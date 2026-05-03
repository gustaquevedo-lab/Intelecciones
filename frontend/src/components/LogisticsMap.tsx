import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface LogisticsMapProps {
  pendingRequests: any[];
  vehicles: any[];
  clusters: any[];
}

const LogisticsMap: React.FC<LogisticsMapProps> = ({ pendingRequests, vehicles, clusters }) => {
  const center: [number, number] = [-22.5411, -55.7283]; // PJC Center

  return (
    <div style={{ height: '100%', width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Clusters (Neighborhoods) */}
        {clusters.map((cluster, idx) => (
          <Circle
            key={`cluster-${idx}`}
            center={[cluster.lat, cluster.lng]}
            radius={300}
            pathOptions={{ color: 'var(--plra-400)', fillColor: 'var(--plra-400)', fillOpacity: 0.2 }}
          >
            <Popup>
              <strong>{cluster.barrio}</strong><br />
              {cluster.count} solicitudes pendientes
            </Popup>
          </Circle>
        ))}

        {/* Individual Pending Requests (if priority) */}
        {pendingRequests.filter(r => r.is_priority).map(req => (
          <Marker key={req.id} position={[req.lat, req.lng]}>
            <Popup>
              <strong>{req.nombre} {req.apellido}</strong><br />
              {req.local_votacion}<br />
              <span style={{ color: 'var(--red)', fontWeight: 'bold' }}>⚠️ PRIORITARIO</span>
            </Popup>
          </Marker>
        ))}

        {/* Vehicles (Simulated or actual if lat/lng exists) */}
        {vehicles.filter(v => v.lat && v.lng).map(v => (
          <Marker 
            key={v.id} 
            position={[v.lat, v.lng]}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: var(--green); width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            })}
          >
            <Popup>
              <strong>{v.description}</strong><br />
              Estado: {v.status}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default LogisticsMap;
