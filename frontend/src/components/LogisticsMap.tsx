import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, Layers, Check, ChevronDown } from 'lucide-react';

// Resolve CSS variable colors to hex
const resolveColor = (color: string) => {
    if (!color.startsWith('var(')) return color;
    if (color.includes('green')) return '#22C55E';
    if (color.includes('yellow')) return '#FBBF24';
    if (color.includes('red')) return '#EF4444';
    if (color.includes('purple')) return '#A855F7';
    if (color.includes('plra-300')) return '#3B82F6';
    if (color.includes('plra-500')) return '#0047AB';
    if (color.includes('plra-600')) return '#003580';
    return '#3B82F6';
};

const ICON_SVGS: Record<string, string> = {
  Landmark: `<polygon points="12 2 22 7 2 7 12 2"></polygon><line x1="3" y1="22" x2="21" y2="22"></line><line x1="6" y1="18" x2="6" y2="11"></line><line x1="10" y1="18" x2="10" y2="11"></line><line x1="14" y1="18" x2="14" y2="11"></line><line x1="18" y1="18" x2="18" y2="11"></line>`,
  School: `<path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>`,
  Building: `<rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22"></line><line x1="15" y1="22" x2="15" y2="22"></line><line x1="12" y1="18" x2="12" y2="18"></line><line x1="12" y1="14" x2="12" y2="14"></line><line x1="12" y1="10" x2="12" y2="10"></line><line x1="12" y1="6" x2="12" y2="6"></line><line x1="8" y1="18" x2="8" y2="18"></line><line x1="8" y1="14" x2="8" y2="14"></line><line x1="8" y1="10" x2="8" y2="10"></line><line x1="8" y1="6" x2="8" y2="6"></line><line x1="16" y1="18" x2="16" y2="18"></line><line x1="16" y1="14" x2="16" y2="14"></line><line x1="16" y1="10" x2="16" y2="10"></line><line x1="16" y1="6" x2="16" y2="6"></line>`,
  Home: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>`,
  MapPin: `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>`,
  Car: `<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.5C2.1 11 2 11.5 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle>`
};

const TRAFFIC_COLORS: Record<string, string> = {
  GREEN: '#22C55E',
  YELLOW: '#FBBF24',
  RED: '#EF4444',
  PURPLE: '#A855F7',
};

const createCustomIcon = (color: string, iconName: string = 'MapPin', needsTransport: boolean = false, size: 'sm' | 'md' = 'md') => {
  const resolvedColor = resolveColor(color);
  const sz = size === 'sm' ? 28 : 34;
  const tailH = size === 'sm' ? 10 : 12;
  const totalH = sz + tailH;
  const icoSz = size === 'sm' ? 14 : 17;

  return L.divIcon({
    html: `
      <div style="position:relative;width:${sz}px;height:${totalH}px;filter:drop-shadow(0 3px 6px ${resolvedColor}50);">
        <div style="
          width:${sz}px;height:${sz}px;border-radius:${sz / 2}px ${sz / 2}px ${sz * 0.3}px ${sz * 0.3}px;
          background:${resolvedColor};
          border:2.2px solid white;
          display:flex;align-items:center;justify-content:center;
          position:relative;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="${icoSz}" height="${icoSz}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${ICON_SVGS[iconName] || ICON_SVGS.MapPin}
          </svg>
          ${needsTransport ? `
            <div style="position:absolute;top:-5px;right:-5px;background:white;border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.3);">
              <div style="width:8px;height:8px;border-radius:50%;background:#3B82F6;"></div>
            </div>
          ` : ''}
        </div>
        <div style="
          position:absolute;bottom:0;left:50%;transform:translateX(-50%);
          width:0;height:0;
          border-left:${sz * 0.2}px solid transparent;
          border-right:${sz * 0.2}px solid transparent;
          border-top:${tailH}px solid ${resolvedColor};
        "></div>
      </div>
    `,
    className: '',
    iconSize: [sz, totalH],
    iconAnchor: [sz / 2, totalH],
    popupAnchor: [0, -totalH]
  });
};

const MapHandler = ({ district, locales }: { district: string | undefined, locales?: any[] }) => {
  const map = useMap();
  const [lastDistrict, setLastDistrict] = useState<string | null>(null);

  useEffect(() => {
    if (district && district !== lastDistrict) {
      const city = district.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
        'CAPITAN BADO': { lat: -23.2652, lng: -55.5323, zoom: 14 },
        'CAPITÁN BADO': { lat: -23.2652, lng: -55.5323, zoom: 14 },
        'BELLA VISTA NORTE': { lat: -22.1287, lng: -56.5204, zoom: 14 },
        'ZANJA PYTA': { lat: -22.6186, lng: -55.6795, zoom: 14 },
        'ZANJA PYTÃ': { lat: -22.6186, lng: -55.6795, zoom: 14 },
        'KARAPAI': { lat: -23.4194, lng: -55.8458, zoom: 14 },
        'KARAPAÍ': { lat: -23.4194, lng: -55.8458, zoom: 14 },
      };

      if (CIUDADES_PARAGUAY[city]) {
        map.flyTo([CIUDADES_PARAGUAY[city].lat, CIUDADES_PARAGUAY[city].lng], CIUDADES_PARAGUAY[city].zoom, { duration: 2 });
        setLastDistrict(district);
      } else if (locales && locales.length > 0) {
        const validLocales = locales.filter(l => l.lat != null && l.lng != null);
        if (validLocales.length > 0) {
          const bounds = L.latLngBounds(validLocales.map(l => [parseFloat(l.lat), parseFloat(l.lng)]));
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          setLastDistrict(district);
        } else {
          setLastDistrict(district);
        }
      }
    }
  }, [district, map, lastDistrict, locales]);
  return null;
};

interface LogisticsMapProps {
  pendingRequests: any[];
  vehicles: any[];
  clusters: any[];
  activeDistrict?: string;
  locales?: any[];
  onUpdateLocalGeo?: (cod: string, lat: number, lng: number) => void;
  users?: any[];
}

const LogisticsMap: React.FC<LogisticsMapProps> = ({ 
    pendingRequests, vehicles, clusters, activeDistrict, locales = [], onUpdateLocalGeo, users = [] 
}) => {
  const defaultCenter: [number, number] = [-22.5411, -55.7283];
  
  const [trafficFilter, setTrafficFilter] = useState<string | null>(null);
  const [selectedPadrinos, setSelectedPadrinos] = useState<number[]>([]);
  const [selectedCoords, setSelectedCoords] = useState<number[]>([]);
  const [showLayers, setShowLayers] = useState(false);

  const padrinos = useMemo(() => users.filter(u => u.role === 'PADRINO'), [users]);
  const coordinators = useMemo(() => users.filter(u => u.role === 'COORDINADOR'), [users]);

  const filteredRequests = useMemo(() => {
    return pendingRequests.filter(r => {
        if (trafficFilter && r.traffic_light !== trafficFilter) return false;
        
        if (selectedPadrinos.length > 0 || selectedCoords.length > 0) {
            if (selectedCoords.includes(r.coordinator_id)) return true;
            const coord = coordinators.find(c => c.id === r.coordinator_id);
            if (coord?.parent_id && selectedPadrinos.includes(coord.parent_id)) return true;
            return false;
        }
        
        return true;
    });
  }, [pendingRequests, trafficFilter, selectedPadrinos, selectedCoords, coordinators]);

  // Counts for filters
  const counts = useMemo(() => {
    const res: any = { GREEN: 0, YELLOW: 0, RED: 0, PURPLE: 0 };
    pendingRequests.forEach(r => {
        if (r.traffic_light && res[r.traffic_light] !== undefined) {
            res[r.traffic_light]++;
        }
    });
    return res;
  }, [pendingRequests]);

  const handleTogglePadrino = (id: number) => {
    setSelectedPadrinos(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleToggleCoord = (id: number) => {
    setSelectedCoords(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer center={defaultCenter} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <ZoomControl position="bottomright" />
        <MapHandler district={activeDistrict} locales={locales} />

        {/* Locales de Votación */}
        {locales
          .filter(l => l.lat && l.lng)
          .map(local => (
            <Marker 
              key={`local-${local.cod_local}`} 
              position={[parseFloat(local.lat), parseFloat(local.lng)]}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    if (onUpdateLocalGeo) {
                        onUpdateLocalGeo(local.cod_local, position.lat, position.lng);
                    }
                }
              }}
              icon={createCustomIcon('var(--plra-600)', local.icon || 'Landmark')}
            >
              <Popup>
                <div style={{ padding: '0.2rem' }}>
                  <p style={{ fontWeight: 800, margin: 0, color: 'var(--plra-600)', fontSize: '0.7rem' }}>LOCAL DE VOTACIÓN</p>
                  <p style={{ margin: '0.25rem 0', fontWeight: 800, fontSize: '0.9rem' }}>{local.nombre}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-3)' }}>{local.direccion}</p>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.65rem', color: 'var(--text-3)', fontStyle: 'italic' }}>Puedes arrastrar este pin para corregir su posición.</p>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Solicitudes de Transporte (Electores) */}
        {filteredRequests
          .filter(r => r.lat && r.lng)
          .map((req, idx) => {
            // Apply jitter to avoid overlap
            const jitter = 0.00003 * Math.sqrt(idx);
            const angle = idx * 137.5;
            const lat = parseFloat(req.lat) + (Math.cos(angle * (Math.PI / 180)) * jitter);
            const lng = parseFloat(req.lng) + (Math.sin(angle * (Math.PI / 180)) * jitter);

            return (
                <Marker 
                key={`req-${req.id}`} 
                position={[lat, lng]}
                icon={createCustomIcon(TRAFFIC_COLORS[req.traffic_light] || 'var(--blue)', 'MapPin', true, 'sm')}
                >
                <Popup>
                    <div style={{ padding: '0.2rem', minWidth: '180px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: TRAFFIC_COLORS[req.traffic_light] || 'var(--blue)' }} />
                        <p style={{ fontWeight: 800, margin: 0 }}>{req.nombre} {req.apellido}</p>
                    </div>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.8rem' }}>Destino: <span style={{ fontWeight: 700 }}>{req.local_votacion}</span></p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-3)' }}>Barrio: {req.barrio}</p>
                    <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-3)' }}>Captado por: <strong>{req.coordinator_name || 'Desconocido'}</strong></p>
                    </div>
                    </div>
                </Popup>
                </Marker>
            );
          })}

        {/* Clusters */}
        {clusters.map((cluster, idx) => (
          <Circle
            key={`cluster-${idx}`}
            center={[parseFloat(cluster.lat), parseFloat(cluster.lng)]}
            radius={250}
            pathOptions={{ color: 'var(--plra-400)', fillColor: 'var(--plra-400)', fillOpacity: 0.1 }}
          />
        ))}

        {/* Vehicles */}
        {vehicles.filter(v => v.lat && v.lng).map(v => {
          const defaultDriverPhoto = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
          const defaultCoordPhoto = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80';
          
          const driverPhoto = v.driver_photo || defaultDriverPhoto;
          const coordPhoto = v.coordinator_photo || defaultCoordPhoto;

          return (
            <Marker 
              key={`v-${v.id}`} 
              position={[parseFloat(v.lat), parseFloat(v.lng)]}
              icon={createCustomIcon('#10B981', 'Car')}
            >
              <Popup>
                <div style={{ 
                  fontFamily: 'Outfit, sans-serif',
                  padding: '0.4rem', 
                  minWidth: '260px',
                  color: 'white',
                  borderRadius: '12px'
                }}>
                  {/* Header Title */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.4rem' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'white', letterSpacing: '0.5px' }}>
                        Móvil: {v.plate || 'CHOFER'}
                      </h4>
                      <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{v.description}</span>
                    </div>
                    <span style={{ 
                      fontSize: '0.65rem', 
                      fontWeight: 800, 
                      padding: '0.15rem 0.4rem', 
                      borderRadius: '6px', 
                      background: v.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                      color: v.status === 'AVAILABLE' ? '#10B981' : '#F59E0B',
                      border: `1px solid ${v.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                    }}>
                      {v.status === 'AVAILABLE' ? 'DISPONIBLE' : 'EN RUTA'}
                    </span>
                  </div>

                  {/* Team Avatars Section */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    {/* Driver Card */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ position: 'relative', width: '36px', height: '36px', borderRadius: '50%', border: '2px solid #10B981', overflow: 'hidden', marginBottom: '0.25rem' }}>
                        <img src={driverPhoto} alt={v.driver_name || 'Chofer'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase' }}>Chofer</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'white', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{v.driver_name || 'Sin Asignar'}</span>
                    </div>

                    {/* Coordinator Card */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ position: 'relative', width: '36px', height: '36px', borderRadius: '50%', border: '2px solid #3B82F6', overflow: 'hidden', marginBottom: '0.25rem' }}>
                        <img src={coordPhoto} alt={v.coordinator_name || 'Coordinador'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase' }}>Coordinador</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'white', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{v.coordinator_name || 'Sin Asignar'}</span>
                    </div>
                  </div>

                  {/* Electoral Uber Trip Card */}
                  {v.passengers_in_transit ? (
                    <div style={{ 
                      background: 'rgba(16, 185, 129, 0.08)', 
                      border: '1px solid rgba(16, 185, 129, 0.2)', 
                      borderRadius: '8px', 
                      padding: '0.5rem 0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                        <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Llevando en Viaje</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>
                        {v.passengers_in_transit}
                      </p>
                    </div>
                  ) : v.passengers_pending ? (
                    <div style={{ 
                      background: 'rgba(59, 130, 246, 0.08)', 
                      border: '1px solid rgba(59, 130, 246, 0.2)', 
                      borderRadius: '8px', 
                      padding: '0.5rem 0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3B82F6' }} />
                        <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Buscando a</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>
                        {v.passengers_pending}
                      </p>
                    </div>
                  ) : (
                    <div style={{ 
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid rgba(255,255,255,0.05)', 
                      borderRadius: '8px', 
                      padding: '0.5rem 0.75rem',
                      textAlign: 'center'
                    }}>
                      <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Vehículo sin viajes asignados</span>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* OVERLAYS */}
      <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        
        {/* Color Filters */}
        <div style={{ 
            background: 'rgba(10, 20, 40, 0.85)', 
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '0.75rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            minWidth: '160px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Filter size={14} color="var(--plra-300)" />
                <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Filtrar Color</span>
            </div>
            {[
                { id: 'GREEN', label: 'CASA', color: '#22C55E' },
                { id: 'YELLOW', label: 'FAMILIARES', color: '#FBBF24' },
                { id: 'RED', label: 'OTROS', color: '#EF4444' },
                { id: 'PURPLE', label: 'VOLUNTARIO', color: '#A855F7' }
            ].map(item => (
                <div 
                    key={item.id}
                    onClick={() => setTrafficFilter(trafficFilter === item.id ? null : item.id)}
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: trafficFilter === item.id ? `${item.color}20` : 'transparent',
                        border: `1px solid ${trafficFilter === item.id ? item.color : 'transparent'}`,
                        transition: 'all 0.2s'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: item.color }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: trafficFilter === item.id ? 'white' : 'var(--text-2)' }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.6 }}>{counts[item.id] || 0}</span>
                </div>
            ))}
            {trafficFilter && (
                <button 
                    onClick={() => setTrafficFilter(null)}
                    style={{ marginTop: '0.25rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-3)', fontSize: '0.65rem', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}
                >
                    Limpiar Filtro
                </button>
            )}
        </div>

        {/* Layers (Padrinos / Coordinadores) */}
        <div style={{ position: 'relative' }}>
            <button 
                onClick={() => setShowLayers(!showLayers)}
                style={{ 
                    background: 'rgba(10, 20, 40, 0.85)', 
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '0.6rem 1rem',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                }}
            >
                <Layers size={18} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Capas de Equipo</span>
                <ChevronDown size={14} style={{ transform: showLayers ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            <AnimatePresence>
                {showLayers && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        style={{ 
                            position: 'absolute', top: '100%', left: 0, marginTop: '0.5rem',
                            background: 'rgba(10, 20, 40, 0.95)', backdropFilter: 'blur(20px)',
                            border: '1px solid var(--border)', borderRadius: '16px',
                            width: '240px', maxHeight: '400px', overflowY: 'auto',
                            padding: '1rem', boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                        }}
                    >
                        <div style={{ marginBottom: '1rem' }}>
                            <p style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--plra-300)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Padrinos</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {padrinos.map(p => (
                                    <div 
                                        key={p.id}
                                        onClick={() => handleTogglePadrino(p.id)}
                                        style={{ 
                                            display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer',
                                            padding: '0.4rem', borderRadius: '8px',
                                            background: selectedPadrinos.includes(p.id) ? 'rgba(59,130,246,0.15)' : 'transparent'
                                        }}
                                    >
                                        <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {selectedPadrinos.includes(p.id) && <Check size={12} color="var(--plra-300)" />}
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: 'white' }}>{p.nombre}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--plra-300)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Coordinadores</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {coordinators.map(c => (
                                    <div 
                                        key={c.id}
                                        onClick={() => handleToggleCoord(c.id)}
                                        style={{ 
                                            display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer',
                                            padding: '0.4rem', borderRadius: '8px',
                                            background: selectedCoords.includes(c.id) ? 'rgba(168,85,247,0.15)' : 'transparent'
                                        }}
                                    >
                                        <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {selectedCoords.includes(c.id) && <Check size={12} color="#A855F7" />}
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: 'white' }}>{c.nombre}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {(selectedPadrinos.length > 0 || selectedCoords.length > 0) && (
                            <button 
                                onClick={() => { setSelectedPadrinos([]); setSelectedCoords([]); }}
                                style={{ width: '100%', marginTop: '1rem', background: 'var(--red)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                            >
                                Limpiar Capas
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default LogisticsMap;
