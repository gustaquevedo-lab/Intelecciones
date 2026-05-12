import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, Truck } from 'lucide-react';

// Fix for default marker icon in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

import { useAuth, apiFetch } from '../context/AuthContext';

const TerritoryMap: React.FC = () => {
    const { user } = useAuth();
    const [electors, setElectors] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'visited' | 'pending'>('all');
    const [filterTransport, setFilterTransport] = useState(false);

    useEffect(() => {
        apiFetch('http://localhost:5000/api/electors')
            .then(res => res.json())
            .then(data => {
                setElectors(data.filter((e: any) => e.lat && e.lng));
            })
            .catch(err => console.error(err));
    }, []);

    const filteredElectors = electors.filter(e => {
        const matchesSearch = e.nombre.toLowerCase().includes(search.toLowerCase()) || e.ci.includes(search);
        const matchesStatus = filterStatus === 'all' || (filterStatus === 'visited' ? e.tenant_status === 'Visitado' : e.tenant_status !== 'Visitado');
        const matchesTransport = !filterTransport || e.needs_transport === 1;
        return matchesSearch && matchesStatus && matchesTransport;
    });

    return (
        <div style={{ height: 'calc(100vh - 64px)', marginTop: '64px', display: 'flex' }}>
            {/* Sidebar Control */}
            <div className="glass-morphism" style={{ 
                width: '380px', 
                padding: '1.5rem', 
                borderRight: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                zIndex: 1001
            }}>
                <div className="flex items-center gap-2">
                    <MapPin size={20} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.25rem' }}>Inteligencia Territorial</h2>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="card" style={{ padding: '0.75rem', background: 'var(--background)' }}>
                        <div className="flex items-center gap-2">
                            <Search size={18} color="var(--text-muted)" />
                            <input 
                                type="text" 
                                placeholder="Buscar por CI o Nombre..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none', width: '100%' }}
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={() => setFilterStatus('all')}
                            style={{ flex: 1, fontSize: '0.7rem', padding: '0.5rem', background: filterStatus === 'all' ? 'var(--primary)' : 'var(--surface)', color: filterStatus === 'all' ? 'white' : 'var(--text-muted)' }}
                        >TODOS</button>
                        <button 
                            onClick={() => setFilterStatus('visited')}
                            style={{ flex: 1, fontSize: '0.7rem', padding: '0.5rem', background: filterStatus === 'visited' ? 'var(--primary)' : 'var(--surface)', color: filterStatus === 'visited' ? 'white' : 'var(--text-muted)' }}
                        >VISITADOS</button>
                    </div>

                    <label className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border cursor-pointer">
                        <div className="flex items-center gap-2">
                            <Truck size={16} color={filterTransport ? 'var(--primary)' : 'var(--text-muted)'} />
                            <span style={{ fontSize: '0.85rem' }}>Solo con Transporte</span>
                        </div>
                        <input 
                            type="checkbox" 
                            checked={filterTransport} 
                            onChange={(e) => setFilterTransport(e.target.checked)} 
                            style={{ width: '18px', height: '18px' }}
                        />
                    </label>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Resultados Filtrados ({filteredElectors.length})
                    </h3>
                    <div className="flex flex-col gap-2">
                        {filteredElectors.map(e => (
                            <div key={e.ci} className="card" style={{ padding: '0.85rem', cursor: 'pointer', borderLeft: e.status === 'Visitado' ? '4px solid var(--success)' : '1px solid var(--border)' }}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>{e.nombre}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>C.I.: {e.ci}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        {e.needs_transport === 1 && <Truck size={14} color="var(--accent)" />}
                                        {e.is_verified_address === 1 && <MapPin size={14} color="var(--primary)" />}
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                                    {e.barrio || 'Sin Barrio'} • Mesa {e.mesa}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Map Container */}
            <div style={{ flex: 1, position: 'relative' }}>
                <MapContainer 
                    center={[-22.540, -55.729]} 
                    zoom={14} 
                    style={{ height: '100%', width: '100%', zIndex: 1 }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MarkerClusterGroup chunkedLoading>
                        {filteredElectors.map(e => (
                            <Marker 
                                key={e.ci} 
                                position={[e.lat, e.lng]}
                                icon={L.divIcon({
                                    className: 'custom-div-icon',
                                    html: `
                                        <div style="
                                            background-color: ${
                                                e.traffic_light === 'GREEN' ? 'var(--green)' : 
                                                e.traffic_light === 'YELLOW' ? 'var(--yellow)' : 
                                                e.traffic_light === 'PURPLE' ? '#A855F7' : 
                                                e.traffic_light === 'RED' ? 'var(--red)' : 
                                                e.tenant_status === 'Visitado' ? 'var(--primary)' : '#64748b'
                                            }; 
                                            width: 14px; 
                                            height: 14px; 
                                            border: 2px solid white; 
                                            border-radius: 50%; 
                                            box-shadow: 0 0 10px rgba(0,0,0,0.4);
                                        "></div>
                                    `,
                                    iconSize: [14, 14],
                                    iconAnchor: [7, 7]
                                })}
                            >
                                <Popup>
                                    <div style={{ minWidth: '220px', fontFamily: 'var(--font-main)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1rem' }}>{e.nombre}</h4>
                                            <span style={{ 
                                                background: user?.party === 'ANR' ? '#dc2626' : '#2563eb', 
                                                color: 'white', 
                                                fontSize: '0.65rem', 
                                                padding: '2px 6px', 
                                                borderRadius: '4px',
                                                fontWeight: 'bold'
                                            }}>{user?.party || 'ANR'}</span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <p style={{ margin: 0 }}><strong>Local:</strong> {e.local_votacion}</p>
                                            <p style={{ margin: 0 }}><strong>Barrio:</strong> {e.barrio || 'No especificado'}</p>
                                            <p style={{ margin: 0 }}><strong>Estado:</strong> <span style={{ 
                                                color: e.traffic_light === 'GREEN' ? 'var(--green)' : 
                                                       e.traffic_light === 'YELLOW' ? '#d97706' : 
                                                       e.traffic_light === 'PURPLE' ? '#7c3aed' : 
                                                       e.traffic_light === 'RED' ? 'var(--red)' : '#64748b',
                                                fontWeight: 800
                                            }}>{e.traffic_light ? (
                                                e.traffic_light === 'GREEN' ? 'CASA' :
                                                e.traffic_light === 'YELLOW' ? 'FAMILIARES' :
                                                e.traffic_light === 'RED' ? 'OTROS' :
                                                e.traffic_light === 'PURPLE' ? 'VOLUNTARIO' : e.traffic_light
                                            ) : e.tenant_status || 'Pendiente'}</span></p>
                                        </div>
                                        
                                        <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px' }}>
                                            {e.needs_transport === 1 && (
                                                <div style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Truck size={10} /> BUS REQUERIDO
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MarkerClusterGroup>
                    <MapController center={filteredElectors.length > 0 ? [filteredElectors[0].lat, filteredElectors[0].lng] : [-22.540, -55.729]} />
                </MapContainer>

                {/* Dashboard Overlay */}
                <div style={{ 
                    position: 'absolute', 
                    top: '20px', 
                    right: '20px', 
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    <div className="glass-morphism" style={{ padding: '0.75rem 1rem', borderRadius: '12px' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vista Activa</p>
                        <p style={{ fontWeight: 600 }}>Densidad de Electores</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper to re-center map
const MapController = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
        if (center) map.setView(center);
    }, [center, map]);
    return null;
};

export default TerritoryMap;
