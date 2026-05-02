import React, { useState, useEffect } from 'react';
import { Search, MapPin, Bus, CheckCircle2, User, Home, Save, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, apiFetch } from '../context/AuthContext';

const ColectorApp: React.FC = () => {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [electors, setElectors] = useState<any[]>([]);
    const [selectedElector, setSelectedElector] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isHome, setIsHome] = useState(false);
    const [needsTransport, setNeedsTransport] = useState(false);

    useEffect(() => {
        if (searchTerm.length > 2) {
            const delayDebounceFn = setTimeout(() => {
                searchElectors();
            }, 500);
            return () => clearTimeout(delayDebounceFn);
        } else {
            setElectors([]);
        }
    }, [searchTerm]);

    const searchElectors = async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`http://localhost:5000/api/electors`);
            const data = await res.json();
            const filtered = data.filter((e: any) => 
                e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                e.ci.includes(searchTerm)
            );
            setElectors(filtered);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectElector = (elector: any) => {
        setSelectedElector(elector);
        setIsHome(elector.is_verified_address === 1);
        setNeedsTransport(elector.needs_transport === 1);
        
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            });
        }
    };

    const handleSaveVisit = async () => {
        if (!location || !selectedElector) return;

        try {
            const response = await apiFetch('http://localhost:5000/api/visits', {
                method: 'POST',
                body: JSON.stringify({
                    elector_ci: selectedElector.ci,
                    lat: location.lat,
                    lng: location.lng,
                    is_home: isHome,
                    needs_transport: needsTransport
                })
            });

            if (response.ok) {
                setSelectedElector(null);
                setSearchTerm('');
                alert('Visita registrada con éxito');
            }
        } catch (err) {
            alert('Error al guardar la visita');
        }
    };

    return (
        <div style={{ maxWidth: '500px', margin: '0 auto', padding: '80px 1rem 40px', minHeight: '100vh' }}>
            <header className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--primary)' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '1px', color: 'var(--text-muted)' }}>
                        RECORRIDO TERRITORIAL - {user?.party || 'SISTEMA'}
                    </span>
                </div>
                <h1 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Colecta de Datos</h1>
            </header>

            {/* Search Box */}
            <div className="card mb-6" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Search size={20} color="var(--text-muted)" />
                <input 
                    type="text" 
                    placeholder="Buscar por C.I. o Nombre..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text)', width: '100%', padding: '0.75rem 0', outline: 'none', fontSize: '1rem' }}
                />
            </div>

            {/* Results */}
            <div className="flex flex-col gap-3">
                {loading && <div style={{ textAlign: 'center', padding: '2rem' }}>Buscando en padrón...</div>}
                
                {electors.map(e => (
                    <motion.div 
                        key={e.ci}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="card"
                        onClick={() => handleSelectElector(e)}
                        style={{ cursor: 'pointer', borderLeft: e.tenant_status === 'Visitado' ? '4px solid var(--success)' : '1px solid var(--border)' }}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{e.nombre}</h3>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>C.I.: {e.ci}</div>
                                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <MapPin size={12} /> {e.local_votacion}
                                </div>
                            </div>
                            {e.tenant_status === 'Visitado' && <CheckCircle2 size={20} color="var(--success)" />}
                        </div>
                    </motion.div>
                ))}

                {searchTerm.length > 2 && electors.length === 0 && !loading && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No se encontró al elector en esta jurisdicción.
                    </div>
                )}
            </div>

            {/* Visit Modal */}
            <AnimatePresence>
                {selectedElector && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setSelectedElector(null)}
                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, backdropFilter: 'blur(4px)' }}
                        />
                        <motion.div 
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            style={{ 
                                position: 'fixed', bottom: 0, left: 0, right: 0, 
                                background: 'var(--surface)', padding: '2rem', 
                                borderTopLeftRadius: '24px', borderTopRightRadius: '24px', zIndex: 3001 
                            }}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div style={{ background: 'var(--primary)', padding: '0.75rem', borderRadius: '12px' }}>
                                        <User color="white" />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '1.25rem' }}>{selectedElector.nombre}</h2>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mesa: {selectedElector.mesa} | Orden: {selectedElector.orden}</p>
                                    </div>
                                </div>
                                <div style={{ 
                                    background: user?.party === 'ANR' ? '#dc2626' : '#2563eb', 
                                    color: 'white', 
                                    padding: '4px 12px', 
                                    borderRadius: '6px', 
                                    fontSize: '0.8rem', 
                                    fontWeight: 'bold' 
                                }}>
                                    {user?.party}
                                </div>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '16px', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Navigation size={18} color="var(--primary)" />
                                        <span style={{ fontSize: '0.9rem' }}>Ubicación Capturada</span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: location ? 'var(--success)' : 'var(--error)' }}>
                                        {location ? '✓ GEO OK' : 'Capturando GPS...'}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <label className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <Home size={18} color={isHome ? 'var(--primary)' : 'var(--text-muted)'} />
                                            <span>¿Es su domicilio real?</span>
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            checked={isHome} 
                                            onChange={(e) => setIsHome(e.target.checked)} 
                                            style={{ width: '20px', height: '20px' }}
                                        />
                                    </label>

                                    <label className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <Bus size={18} color={needsTransport ? 'var(--primary)' : 'var(--text-muted)'} />
                                            <span>¿Necesita transporte?</span>
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            checked={needsTransport} 
                                            onChange={(e) => setNeedsTransport(e.target.checked)} 
                                            style={{ width: '20px', height: '20px' }}
                                        />
                                    </label>
                                </div>
                            </div>

                            <button 
                                onClick={handleSaveVisit}
                                disabled={!location}
                                className="btn-primary"
                                style={{ width: '100%', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                <Save size={20} />
                                GUARDAR VISITA
                            </button>
                            
                            <button 
                                onClick={() => setSelectedElector(null)}
                                style={{ width: '100%', marginTop: '1rem', color: 'var(--text-muted)', background: 'transparent' }}
                            >
                                Cancelar
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ColectorApp;
