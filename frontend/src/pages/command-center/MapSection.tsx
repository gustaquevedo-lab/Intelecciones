import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Car, Radio, Target, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ICON_SVGS: Record<string, string> = {
  Landmark: `<polygon points="12 2 22 7 2 7 12 2"></polygon><line x1="3" y1="22" x2="21" y2="22"></line><line x1="6" y1="18" x2="6" y2="11"></line><line x1="10" y1="18" x2="10" y2="11"></line><line x1="14" y1="18" x2="14" y2="11"></line><line x1="18" y1="18" x2="18" y2="11"></line>`,
  School: `<path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>`,
  Building: `<rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22"></line><line x1="15" y1="22" x2="15" y2="22"></line><line x1="12" y1="18" x2="12" y2="18"></line><line x1="12" y1="14" x2="12" y2="14"></line><line x1="12" y1="10" x2="12" y2="10"></line><line x1="12" y1="6" x2="12" y2="6"></line><line x1="8" y1="18" x2="8" y2="18"></line><line x1="8" y1="14" x2="8" y2="14"></line><line x1="8" y1="10" x2="8" y2="10"></line><line x1="8" y1="6" x2="8" y2="6"></line><line x1="16" y1="18" x2="16" y2="18"></line><line x1="16" y1="14" x2="16" y2="14"></line><line x1="16" y1="10" x2="16" y2="10"></line><line x1="16" y1="6" x2="16" y2="6"></line>`,
  Home: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>`,
  MapPin: `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>`,
  Car: `<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.5C2.1 11 2 11.5 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle>`
};

const createCustomIcon = (color: string, iconName: string = 'Landmark', needsTransport: boolean = false, size: 'sm' | 'md' = 'md') => {
  const sz = size === 'sm' ? 28 : 36;
  const tailH = size === 'sm' ? 10 : 14;
  const totalH = sz + tailH;
  const icoSz = size === 'sm' ? 14 : 18;
  const resolvedColor = color.startsWith('var(') ? (
    color.includes('green') ? '#22C55E' :
      color.includes('yellow') ? '#EAB308' :
        color.includes('red') ? '#EF4444' :
          color.includes('plra-300') ? '#3B82F6' :
            color.includes('plra-500') ? '#0047AB' : '#3B82F6'
  ) : color;

  return L.divIcon({
    html: `
      <div style="position:relative;width:${sz}px;height:${totalH}px;filter:drop-shadow(0 4px 8px ${resolvedColor}60);">
        <div style="
          width:${sz}px;height:${sz}px;border-radius:${sz / 2}px ${sz / 2}px ${sz * 0.35}px ${sz * 0.35}px;
          background:${resolvedColor};
          border:2.5px solid rgba(255,255,255,0.9);
          box-shadow:0 0 0 3px ${resolvedColor}40,inset 0 2px 4px rgba(255,255,255,0.25);
          display:flex;align-items:center;justify-content:center;
          position:relative;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="${icoSz}" height="${icoSz}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            ${ICON_SVGS[needsTransport ? 'Car' : iconName] || ICON_SVGS.Landmark}
          </svg>
          ${needsTransport ? `
            <div style="position:absolute;top:-6px;right:-6px;background:#fff;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.3);">
              <div style="width:9px;height:9px;border-radius:50%;background:#3B82F6;"></div>
            </div>
          ` : ''}
        </div>
        <div style="
          position:absolute;bottom:0;left:50%;transform:translateX(-50%);
          width:0;height:0;
          border-left:${sz * 0.22}px solid transparent;
          border-right:${sz * 0.22}px solid transparent;
          border-top:${tailH}px solid ${resolvedColor};
        "></div>
      </div>
    `,
    className: '',
    iconSize: [sz, totalH],
    iconAnchor: [sz / 2, totalH],
    popupAnchor: [0, -totalH - 4],
  });
};

const FAST_ICONS: Record<string, L.Icon> = {};

const getFastPinIcon = (colorHex: string, needsTransport: boolean) => {
  const key = `${colorHex}-${needsTransport}`;
  if (FAST_ICONS[key]) return FAST_ICONS[key];
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="34" viewBox="0 0 24 34">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 7.5 10 20 10 20s10-12.5 10-20c0-5.52-4.48-10-10-10z" fill="${colorHex}" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="4.5" fill="#ffffff" opacity="0.8"/>
      ${needsTransport ? '<circle cx="19" cy="5" r="4.5" fill="#3B82F6" stroke="#ffffff" stroke-width="1.5"/>' : ''}
    </svg>
  `;
  
  const encodedSvg = encodeURIComponent(svg.trim());
  const dataUri = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
  
  const icon = L.icon({
    iconUrl: dataUri,
    iconSize: [22, 31],
    iconAnchor: [11, 31],
    popupAnchor: [0, -29],
  });
  
  FAST_ICONS[key] = icon;
  return icon;
};

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

const MapHandler = ({ center, selectedLocalId, activeDistrict, locales }: { center: [number, number] | null, selectedLocalId: string | null, activeDistrict?: string, locales?: any[] }) => {
  const map = useMap();
  const [lastId, setLastId] = useState<string | null>(null);
  const [lastDistrict, setLastDistrict] = useState<string | null>(null);

  useEffect(() => {
    if (selectedLocalId && selectedLocalId !== lastId && center) {
      map.flyTo(center, 16, { duration: 1.5 });
      setLastId(selectedLocalId);
    } else if (!selectedLocalId && lastId) {
      setLastId(null);
    }

    if (activeDistrict && activeDistrict !== lastDistrict) {
      const city = activeDistrict.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (CIUDADES_PARAGUAY[city]) {
        map.flyTo([CIUDADES_PARAGUAY[city].lat, CIUDADES_PARAGUAY[city].lng], CIUDADES_PARAGUAY[city].zoom, { duration: 2 });
        setLastDistrict(activeDistrict);
      } else if (locales && locales.length > 0) {
        const validLocales = locales.filter(l => l.lat != null && l.lng != null);
        if (validLocales.length > 0) {
          const bounds = L.latLngBounds(validLocales.map(l => [l.lat, l.lng]));
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          setLastDistrict(activeDistrict);
        } else {
          setLastDistrict(activeDistrict);
        }
      }
    }
  }, [center, selectedLocalId, lastId, map, activeDistrict, lastDistrict, locales]);
  return null;
};

interface MapSectionProps {
  locales: any[];
  selectedLocal: string | null;
  effectiveDistrict: string;
  commandStats: any;
  handleLocalClick: (codLocal: string) => void;
  clearLocalFilter: () => void;
  isClusteringEnabled: boolean;
  setIsClusteringEnabled: (val: boolean) => void;
  captures: any[];
  trafficLightFilter: string | null;
  setTrafficLightFilter: (val: string | null) => void;
  needsTransportFilter: boolean;
  setNeedsTransportFilter: (val: boolean) => void;
  selectedPadrinoLayers: string[];
  setSelectedPadrinoLayers: React.Dispatch<React.SetStateAction<string[]>>;
  selectedCoordLayers: string[];
  setSelectedCoordLayers: React.Dispatch<React.SetStateAction<string[]>>;
  coordinators: any[];
  structureData: any[];
  showVehicles: boolean;
  setShowVehicles: (val: boolean) => void;
  vehicles: any[];
  isMobile: boolean;
  showSidebar: boolean;
  conflictsCount: number;
}

const MapSection: React.FC<MapSectionProps> = ({
  locales,
  selectedLocal,
  effectiveDistrict,
  commandStats,
  handleLocalClick,
  clearLocalFilter,
  isClusteringEnabled,
  setIsClusteringEnabled,
  captures,
  trafficLightFilter,
  setTrafficLightFilter,
  needsTransportFilter,
  setNeedsTransportFilter,
  selectedPadrinoLayers,
  setSelectedPadrinoLayers,
  selectedCoordLayers,
  setSelectedCoordLayers,
  coordinators,
  structureData,
  showVehicles,
  setShowVehicles,
  vehicles,
  isMobile,
  showSidebar,
  conflictsCount,
}) => {
  const [showLayerSelector, setShowLayerSelector] = useState(false);
  const [expandedLayerPadrinos, setExpandedLayerPadrinos] = useState<string[]>([]);

  const mapCenter = (() => {
    if (!selectedLocal) return null;
    const l = locales.find(l => l.cod_local === selectedLocal);
    if (l && l.lat != null && l.lng != null) return [l.lat, l.lng] as [number, number];
    return null;
  })();

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: '1rem', right: '1rem', zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: '0.5rem'
      }}>
        <button
          onClick={() => setShowVehicles(!showVehicles)}
          style={{
            padding: '0.45rem 0.8rem', borderRadius: '8px',
            background: showVehicles ? 'var(--plra-500)' : 'rgba(8, 14, 28, 0.85)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.15)', fontSize: '0.62rem', fontWeight: 900,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)'
          }}
        >
          <Radio size={12} style={{ color: showVehicles ? 'white' : 'var(--plra-300)' }} /> Logística: {showVehicles ? 'ON' : 'OFF'}
        </button>

        <button
          onClick={() => setIsClusteringEnabled(!isClusteringEnabled)}
          style={{
            padding: '0.45rem 0.8rem', borderRadius: '8px',
            background: isClusteringEnabled ? 'var(--plra-500)' : 'rgba(8, 14, 28, 0.85)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.15)', fontSize: '0.62rem', fontWeight: 900,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)'
          }}
        >
          <Target size={12} style={{ color: isClusteringEnabled ? 'white' : 'var(--plra-300)' }} /> Agrupar: {isClusteringEnabled ? 'SI' : 'NO'}
        </button>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowLayerSelector(!showLayerSelector)}
            style={{
              padding: '0.45rem 0.8rem', borderRadius: '8px',
              background: (selectedPadrinoLayers.length > 0 || selectedCoordLayers.length > 0) ? 'var(--plra-500)' : 'rgba(8, 14, 28, 0.85)',
              color: 'white', border: '1px solid rgba(255,255,255,0.15)', fontSize: '0.62rem', fontWeight: 900,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', width: '100%'
            }}
          >
            <Users size={12} style={{ color: (selectedPadrinoLayers.length > 0 || selectedCoordLayers.length > 0) ? 'white' : 'var(--plra-300)' }} />
            Capas: {selectedPadrinoLayers.length === 0 && selectedCoordLayers.length === 0 ? 'Global' : `${selectedPadrinoLayers.length}P ${selectedCoordLayers.length}C`}
          </button>
          {showLayerSelector && (
            <div style={{
              position: 'absolute', top: 0, right: 'calc(100% + 8px)', width: '240px', maxHeight: '340px',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.6)', zIndex: 2000, overflowY: 'auto', padding: '0.6rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0.4rem 0.6rem', borderBottom: '1px solid var(--border)', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Capas por Padrino</span>
                <button onClick={() => { setSelectedPadrinoLayers([]); setSelectedCoordLayers([]); }} style={{ fontSize: '0.55rem', color: 'var(--plra-300)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Limpiar</button>
              </div>
              {structureData.map((p: any) => {
                const pCoords = coordinators.filter(c => c.parent_id === p.id);
                const pSelected = selectedPadrinoLayers.includes(p.id);
                const expanded = expandedLayerPadrinos.includes(p.id);
                return (
                  <div key={p.id} style={{ marginBottom: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.5rem', borderRadius: '8px', cursor: 'pointer', background: pSelected ? 'rgba(59,130,246,0.12)' : 'transparent' }}>
                      <div
                        onClick={() => setSelectedPadrinoLayers(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                        style={{ width: '13px', height: '13px', borderRadius: '4px', border: `1.5px solid ${pSelected ? 'var(--plra-300)' : 'var(--border)'}`, background: pSelected ? 'var(--plra-300)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        {pSelected && <div style={{ width: '6px', height: '6px', background: 'white', borderRadius: '1px' }} />}
                      </div>
                      <span onClick={() => setSelectedPadrinoLayers(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])} style={{ fontSize: '0.72rem', fontWeight: 700, color: pSelected ? 'var(--text)' : 'var(--text-2)', flex: 1 }}>{p.nombre}</span>
                      {pCoords.length > 0 && (
                        <button onClick={() => setExpandedLayerPadrinos(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: '0', display: 'flex' }}>
                          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      )}
                    </div>
                    {expanded && pCoords.map(c => {
                      const cSelected = selectedCoordLayers.includes(c.id);
                      return (
                        <div key={c.id} onClick={() => setSelectedCoordLayers(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.5rem 0.35rem 1.6rem', borderRadius: '6px', cursor: 'pointer', background: cSelected ? 'rgba(59,130,246,0.08)' : 'transparent' }}>
                          <div style={{ width: '11px', height: '11px', borderRadius: '3px', border: `1.5px solid ${cSelected ? 'var(--plra-300)' : 'var(--border)'}`, background: cSelected ? 'var(--plra-300)' : 'transparent', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.67rem', color: cSelected ? 'var(--text)' : 'var(--text-3)', fontWeight: 600 }}>{c.nombre}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {selectedLocal && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: '0.6rem 1rem', borderRadius: '10px',
              background: 'var(--accent-subtle)',
              color: 'var(--plra-200)',
              border: '1px solid var(--plra-300)', fontSize: '0.7rem', fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)'
            }}
          >
            <MapPin size={14} /> FILTRO: {locales.find(l => l.cod_local === selectedLocal)?.nombre}
            <button
              onClick={clearLocalFilter}
              style={{ background: 'var(--plra-500)', border: 'none', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 800 }}
            >
              LIMPIAR
            </button>
          </motion.div>
        )}
      </div>

      <MapContainer center={[-22.5422, -55.7336]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false} preferCanvas={true}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <ZoomControl position="bottomright" />
        <MapHandler
          center={mapCenter}
          selectedLocalId={selectedLocal}
          activeDistrict={effectiveDistrict}
          locales={locales}
        />

        {locales.filter(l => l.lat != null && l.lng != null).map((l: any) => {
          const locStat = commandStats?.locations?.find((s: any) => s.cod_local === l.cod_local);
          const color = locStat?.percentage > 70 ? 'var(--green)' : locStat?.percentage > 30 ? 'var(--yellow)' : 'var(--red)';
          const isSelected = selectedLocal === l.cod_local;

          return (
            <Marker
              key={l.cod_local}
              position={[l.lat, l.lng]}
              icon={createCustomIcon(isSelected ? 'white' : color, l.icon, isSelected)}
              eventHandlers={{
                click: () => handleLocalClick(l.cod_local)
              }}
            >
              <Popup>
                <div style={{ padding: '0.5rem' }}>
                  <p style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{l.nombre}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Progreso: <strong>{locStat?.percentage || 0}%</strong></p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{locStat?.total_captures || 0} / {locStat?.total_electors || 0} captados</p>
                  <button
                    onClick={() => handleLocalClick(l.cod_local)}
                    style={{ width: '100%', marginTop: '0.5rem', padding: '0.3rem', borderRadius: '4px', background: 'var(--plra-500)', color: 'white', border: 'none', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Filtrar este local
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {isClusteringEnabled ? (
          <MarkerClusterGroup disableClusteringAtZoom={15} maxClusterRadius={40}>
            {captures
              .filter(cap => cap.lat != null && cap.lng != null)
              .filter(cap => !selectedLocal || cap.local_votacion === locales.find(l => l.cod_local === selectedLocal)?.nombre)
              .filter(cap => !trafficLightFilter || cap.traffic_light === trafficLightFilter)
              .filter(cap => !needsTransportFilter || cap.needs_transport === 1)
              .filter(cap => {
                if (selectedPadrinoLayers.length === 0 && selectedCoordLayers.length === 0) return true;
                const coord = coordinators.find((c: any) => c.id === cap.coordinator_id);
                if (selectedCoordLayers.includes(cap.coordinator_id)) return true;
                if (coord?.parent_id && selectedPadrinoLayers.includes(coord.parent_id)) return true;
                return false;
              })
              .map((cap, idx) => {
                const jitter = 0.00003 * Math.sqrt(idx);
                const angle = idx * 137.5;
                const lat = cap.lat + (Math.cos(angle * (Math.PI / 180)) * jitter);
                const lng = cap.lng + (Math.sin(angle * (Math.PI / 180)) * jitter);
                const colorHex = cap.traffic_light === 'GREEN' ? '#22C55E' : 
                                 cap.traffic_light === 'YELLOW' ? '#EAB308' : 
                                 cap.traffic_light === 'PURPLE' ? '#A855F7' : '#EF4444';
                return (
                  <Marker
                    key={`cap-${cap.id}`}
                    position={[lat, lng]}
                    icon={getFastPinIcon(colorHex, cap.needs_transport === 1)}
                  >
                    <Popup className="premium-popup">
                      <div style={{ minWidth: '230px', maxWidth: '265px' }}>
                        <div style={{ padding: '0.75rem 0.9rem 0.55rem', background: 'linear-gradient(135deg,#081526,#0d1f3c)', borderBottom: '1px solid rgba(59,130,246,0.18)' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.35rem' }}>
                            <div style={{
                              width: '10px', height: '10px', borderRadius: '50%', marginTop: '3px', flexShrink: 0,
                              background: cap.traffic_light === 'GREEN' ? '#22C55E' : cap.traffic_light === 'YELLOW' ? '#EAB308' : cap.traffic_light === 'PURPLE' ? '#A855F7' : '#EF4444',
                              boxShadow: `0 0 8px ${cap.traffic_light === 'GREEN' ? '#22C55E80' : cap.traffic_light === 'YELLOW' ? '#EAB30880' : cap.traffic_light === 'PURPLE' ? '#A855F780' : '#EF444480'}`
                            }} />
                            <p style={{ fontSize: '0.95rem', fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.15, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                              {cap.nombre} {cap.apellido}
                            </p>
                          </div>
                          <span style={{ fontSize: '0.55rem', fontWeight: 900, padding: '1px 6px', borderRadius: '4px', background: '#0047AB', color: 'white', letterSpacing: '0.06em', marginLeft: '1.5rem' }}>
                            L-{cap.list_number}
                          </span>
                        </div>
                        <div style={{ padding: '0.6rem 0.9rem 0.75rem', background: '#0a1525' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '7px', background: 'rgba(59,130,246,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: '#3B82F6', flexShrink: 0 }}>
                              {cap.coordinator_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em' }}>CAPTADO POR</p>
                              <p style={{ fontSize: '0.72rem', color: 'white', margin: 0, fontWeight: 800 }}>{cap.coordinator_name}</p>
                            </div>
                          </div>
                          {(cap.padrino_name || cap.parent_name) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                              <div style={{ width: '24px', height: '24px', borderRadius: '7px', background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: '#A855F7', flexShrink: 0 }}>
                                {(cap.padrino_name || cap.parent_name)?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em' }}>SUPERIOR</p>
                                <p style={{ fontSize: '0.72rem', color: '#A855F7', margin: 0, fontWeight: 800 }}>{cap.padrino_name || cap.parent_name}</p>
                              </div>
                            </div>
                          )}
                          <div style={{ padding: '0.4rem 0.55rem', background: 'rgba(255,255,255,0.03)', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.06)', marginTop: '0.15rem' }}>
                            <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.3 }}>{cap.local_votacion}</p>
                            {cap.needs_transport === 1 && (
                              <span style={{ display: 'inline-block', marginTop: '0.3rem', fontSize: '0.52rem', color: '#93C5FD', fontWeight: 900, background: 'rgba(59,130,246,0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                                🚌 REQUIERE TRANSPORTE
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          </MarkerClusterGroup>
        ) : (
          captures
            .filter(cap => cap.lat != null && cap.lng != null)
            .filter(cap => !selectedLocal || cap.local_votacion === locales.find(l => l.cod_local === selectedLocal)?.nombre)
            .filter(cap => !trafficLightFilter || cap.traffic_light === trafficLightFilter)
            .filter(cap => !needsTransportFilter || cap.needs_transport === 1)
            .filter(cap => {
              if (selectedPadrinoLayers.length === 0 && selectedCoordLayers.length === 0) return true;
              const coord = coordinators.find((c: any) => c.id === cap.coordinator_id);
              if (selectedCoordLayers.includes(cap.coordinator_id)) return true;
              if (coord?.parent_id && selectedPadrinoLayers.includes(coord.parent_id)) return true;
              return false;
            })
            .map((cap, idx) => {
              const jitter = 0.00003 * Math.sqrt(idx);
              const angle = idx * 137.5;
              const lat = cap.lat + (Math.cos(angle * (Math.PI / 180)) * jitter);
              const lng = cap.lng + (Math.sin(angle * (Math.PI / 180)) * jitter);
              const colorHex = cap.traffic_light === 'GREEN' ? '#22C55E' : 
                               cap.traffic_light === 'YELLOW' ? '#EAB308' : 
                               cap.traffic_light === 'PURPLE' ? '#A855F7' : '#EF4444';
              return (
                <Marker
                  key={`cap-raw-${cap.id}`}
                  position={[lat, lng]}
                  icon={getFastPinIcon(colorHex, cap.needs_transport === 1)}
                >
                  <Popup className="premium-popup">
                    <div style={{ minWidth: '230px', maxWidth: '265px' }}>
                      <div style={{ padding: '0.75rem 0.9rem 0.55rem', background: 'linear-gradient(135deg,#081526,#0d1f3c)', borderBottom: '1px solid rgba(59,130,246,0.18)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.35rem' }}>
                          <div style={{
                            width: '10px', height: '10px', borderRadius: '50%', marginTop: '3px', flexShrink: 0,
                            background: cap.traffic_light === 'GREEN' ? '#22C55E' : cap.traffic_light === 'YELLOW' ? '#EAB308' : cap.traffic_light === 'PURPLE' ? '#A855F7' : '#EF4444',
                            boxShadow: `0 0 8px ${cap.traffic_light === 'GREEN' ? '#22C55E80' : cap.traffic_light === 'YELLOW' ? '#EAB30880' : cap.traffic_light === 'PURPLE' ? '#A855F780' : '#EF444480'}`
                          }} />
                          <p style={{ fontSize: '0.95rem', fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.15, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                            {cap.nombre} {cap.apellido}
                          </p>
                        </div>
                        <span style={{ fontSize: '0.55rem', fontWeight: 900, padding: '1px 6px', borderRadius: '4px', background: '#0047AB', color: 'white', letterSpacing: '0.06em', marginLeft: '1.5rem' }}>
                          L-{cap.list_number}
                        </span>
                      </div>
                      <div style={{ padding: '0.6rem 0.9rem 0.75rem', background: '#0a1525' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '7px', background: 'rgba(59,130,246,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: '#3B82F6', flexShrink: 0 }}>
                            {cap.coordinator_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em' }}>CAPTADO POR</p>
                            <p style={{ fontSize: '0.72rem', color: 'white', margin: 0, fontWeight: 800 }}>{cap.coordinator_name}</p>
                          </div>
                        </div>
                        {(cap.padrino_name || cap.parent_name) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '7px', background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: '#A855F7', flexShrink: 0 }}>
                              {(cap.padrino_name || cap.parent_name)?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em' }}>SUPERIOR</p>
                              <p style={{ fontSize: '0.72rem', color: '#A855F7', margin: 0, fontWeight: 800 }}>{cap.padrino_name || cap.parent_name}</p>
                            </div>
                          </div>
                        )}
                        <div style={{ padding: '0.4rem 0.55rem', background: 'rgba(255,255,255,0.03)', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.06)', marginTop: '0.15rem' }}>
                          <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.3 }}>{cap.local_votacion}</p>
                          {cap.needs_transport === 1 && (
                            <span style={{ display: 'inline-block', marginTop: '0.3rem', fontSize: '0.52rem', color: '#93C5FD', fontWeight: 900, background: 'rgba(59,130,246,0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                              🚌 REQUIERE TRANSPORTE
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })
        )}
        {showVehicles && vehicles.filter(v => v.lat != null && v.lng != null).map((v) => (
          <Marker key={`veh-${v.id}`} position={[v.lat, v.lng]} icon={createCustomIcon('var(--plra-300)', 'Car')}>
            <Popup>
              <div style={{ padding: '0.5rem' }}>
                <p style={{ fontWeight: 800, fontSize: '0.8rem' }}>Vehículo: {v.id}</p>
                <p style={{ fontSize: '0.7rem' }}>Capacidad: {v.capacity} personas</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--green)' }}>Estado: {v.status}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {isMobile && !showSidebar && (
        <div style={{
          position: 'absolute', bottom: '1.5rem', left: '1rem', right: '1rem', zIndex: 1100,
          background: 'rgba(10, 14, 23, 0.85)', backdropFilter: 'blur(12px)',
          border: '1px solid var(--border)', borderRadius: '16px', padding: '0.75rem 1rem',
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}>
          <div
            onClick={() => setTrafficLightFilter(trafficLightFilter === 'GREEN' ? null : 'GREEN')}
            style={{ textAlign: 'center', cursor: 'pointer', opacity: !trafficLightFilter || trafficLightFilter === 'GREEN' ? 1 : 0.4 }}
          >
            <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>CASA</p>
            <p style={{ fontSize: '1.1rem', color: 'var(--green)', fontWeight: 900 }}>{commandStats?.green || 0}</p>
          </div>
          <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Progreso</p>
            <p style={{ fontSize: '1.1rem', color: 'white', fontWeight: 900 }}>{commandStats?.percentage || 0}%</p>
          </div>
          <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
          <div
            onClick={() => setTrafficLightFilter(trafficLightFilter === 'RED' ? null : 'RED')}
            style={{ textAlign: 'center', cursor: 'pointer', opacity: !trafficLightFilter || trafficLightFilter === 'RED' ? 1 : 0.4 }}
          >
            <p style={{ fontSize: '0.55rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>OTROS</p>
            <p style={{ fontSize: '1.1rem', color: 'var(--red)', fontWeight: 900 }}>{conflictsCount > 0 ? conflictsCount : (commandStats?.red || 0)}</p>
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute', bottom: isMobile ? '7rem' : '2rem', left: '1rem', zIndex: 1000,
        background: 'rgba(8, 14, 26, 0.92)', backdropFilter: 'blur(16px)',
        padding: '0.85rem 0.9rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        minWidth: '150px'
      }}>
        <div style={{ fontSize: '0.52rem', fontWeight: 900, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Estado del elector</div>
        {[
          { id: 'GREEN', label: 'CASA', color: '#22C55E' },
          { id: 'YELLOW', label: 'FAMILIARES', color: '#EAB308' },
          { id: 'RED', label: 'OTROS', color: '#EF4444' },
          { id: 'PURPLE', label: 'VOLUNTARIO', color: '#A855F7' },
        ].map(item => {
          const active = trafficLightFilter === item.id;
          const dimmed = !!trafficLightFilter && !active;
          return (
            <div key={item.id} onClick={() => setTrafficLightFilter(active ? null : item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer',
                opacity: dimmed ? 0.28 : 1, transition: 'opacity 0.2s, background 0.15s',
                background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                padding: '0.28rem 0.5rem', borderRadius: '7px', margin: '0 -0.3rem'
              }}
            >
              <div style={{
                width: '13px', height: '13px', borderRadius: '50%', flexShrink: 0,
                background: item.color,
                boxShadow: active ? `0 0 8px ${item.color}` : 'none',
                border: active ? `2px solid rgba(255,255,255,0.6)` : '2px solid transparent'
              }} />
              <span style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.9)', fontWeight: active ? 900 : 700 }}>
                {item.label} <span style={{ opacity: 0.6, marginLeft: '4px' }}>({commandStats?.[item.id.toLowerCase() as keyof typeof commandStats] || 0})</span>
              </span>
              {active && <div style={{ marginLeft: 'auto', width: '5px', height: '5px', borderRadius: '50%', background: item.color }} />}
            </div>
          );
        })}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '0.5rem', marginTop: '0.15rem' }}>
          <div
            onClick={() => setNeedsTransportFilter(!needsTransportFilter)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer',
              background: needsTransportFilter ? 'rgba(59,130,246,0.15)' : 'transparent',
              padding: '0.28rem 0.5rem', borderRadius: '7px', margin: '0 -0.3rem',
              border: needsTransportFilter ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
              transition: 'all 0.15s'
            }}
          >
            <div style={{ width: '13px', height: '13px', borderRadius: '50%', flexShrink: 0, border: `2.5px solid #3B82F6`, background: needsTransportFilter ? '#3B82F650' : 'transparent' }} />
            <span style={{ fontSize: '0.62rem', color: needsTransportFilter ? '#93C5FD' : 'rgba(255,255,255,0.6)', fontWeight: 800 }}>
              {needsTransportFilter ? '✓ ' : ''}TRANSPORTE <span style={{ opacity: 0.6, marginLeft: '4px' }}>({commandStats?.transport_needed || 0})</span>
            </span>
          </div>
        </div>

        {(trafficLightFilter || needsTransportFilter) && (
          <button onClick={() => { setTrafficLightFilter(null); setNeedsTransportFilter(false); }}
            style={{ marginTop: '0.15rem', padding: '0.3rem', borderRadius: '7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: '0.55rem', fontWeight: 800, cursor: 'pointer', letterSpacing: '0.05em' }}>
            LIMPIAR FILTROS
          </button>
        )}
      </div>
    </div>
  );
};

export default MapSection;
