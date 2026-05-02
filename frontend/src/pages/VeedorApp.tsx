import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, AlertTriangle, RefreshCcw, User, ChevronRight, Filter, Hash, CheckSquare, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, apiFetch } from '../context/AuthContext';

const VeedorApp: React.FC = () => {
    const { user } = useAuth();
    const [electors, setElectors] = useState<any[]>([]);
    const [mesaFilter, setMesaFilter] = useState('');
    const [ordenFilter, setOrdenFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [activeTab, setActiveTab] = useState<'veedores' | 'escrutinio'>('veedores');
    
    const [resultForm, setResultForm] = useState({
        mesa: '',
        local: '',
        nuestro: 0,
        op1: 0,
        op2: 0,
        otros: 0,
        nulos: 0,
        blancos: 0
    });

    useEffect(() => {
        fetchElectors();
    }, []);

    const fetchElectors = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('http://localhost:5000/api/electors/search');
            const data = await res.json();
            setElectors(data);
            localStorage.setItem('electors_cache', JSON.stringify(data));
        } catch (err) {
            const cached = localStorage.getItem('electors_cache');
            if (cached) setElectors(JSON.parse(cached));
        } finally {
            setLoading(false);
        }
    };

    const handleRecordVote = async (ci: string) => {
        const previousElectors = [...electors];
        setElectors(electors.map(e => e.ci === ci ? { ...e, tenant_status: 'Voto Realizado' } : e));

        try {
            const res = await apiFetch('http://localhost:5000/api/dia-d/vote', {
                method: 'POST',
                body: JSON.stringify({ elector_ci: ci })
            });
            if (!res.ok) throw new Error('Failed to sync');
        } catch (err) {
            setElectors(previousElectors);
            alert('Error al sincronizar voto.');
        }
    };

    const handleSaveResults = async (e: React.FormEvent) => {
        e.preventDefault();
        setSyncing(true);
        try {
            const res = await apiFetch('http://localhost:5000/api/escrutinio', {
                method: 'POST',
                body: JSON.stringify({
                    mesa: parseInt(resultForm.mesa),
                    local_votacion: resultForm.local,
                    votos_nuestro: resultForm.nuestro,
                    votos_oponente_1: resultForm.op1,
                    votos_oponente_2: resultForm.op2,
                    votos_otros: resultForm.otros,
                    votos_nulos: resultForm.nulos,
                    votos_blancos: resultForm.blancos,
                    foto_acta_url: 'mock_url'
                })
            });
            if (res.ok) {
                alert('Acta cargada con éxito');
                setResultForm({ mesa: '', local: '', nuestro: 0, op1: 0, op2: 0, otros: 0, nulos: 0, blancos: 0 });
            }
        } catch (err) {
            alert('Error al cargar acta');
        } finally {
            setSyncing(false);
        }
    };

    const filteredElectors = electors.filter(e => {
        const matchesMesa = !mesaFilter || e.mesa.toString() === mesaFilter;
        const matchesOrden = !ordenFilter || e.orden.toString() === ordenFilter;
        const matchesQuery = !searchQuery || e.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || e.ci.includes(searchQuery);
        return matchesMesa && matchesOrden && matchesQuery;
    });

    const turnoutStats = {
        totalOurPeople: filteredElectors.length,
        votedOurPeople: filteredElectors.filter(e => e.tenant_status === 'Voto Realizado').length
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 1.5rem 40px', minHeight: '100vh' }}>
            <header className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Día D: Veedor App</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Monitoreo de mesa en tiempo real</p>
                    </div>
                    <button 
                        onClick={fetchElectors} 
                        className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-border"
                        disabled={loading}
                    >
                        <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
                
                <div className="flex gap-2 p-1 bg-background rounded-xl border border-border">
                    <button 
                        onClick={() => setActiveTab('veedores')}
                        style={{ flex: 1, padding: '10px', borderRadius: '10px', background: activeTab === 'veedores' ? 'var(--primary)' : 'transparent', fontSize: '0.8rem', fontWeight: 700, color: activeTab === 'veedores' ? 'white' : 'var(--text-muted)' }}
                    >REGISTRO VOTOS</button>
                    <button 
                        onClick={() => setActiveTab('escrutinio')}
                        style={{ flex: 1, padding: '10px', borderRadius: '10px', background: activeTab === 'escrutinio' ? 'var(--primary)' : 'transparent', fontSize: '0.8rem', fontWeight: 700, color: activeTab === 'escrutinio' ? 'white' : 'var(--text-muted)' }}
                    >CARGA DE ACTA</button>
                </div>
            </header>

            {activeTab === 'veedores' ? (
                <>
                    {/* Quick Filters */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="card" style={{ padding: '0.75rem', background: 'var(--background)' }}>
                            <div className="flex items-center gap-2">
                                <Hash size={16} color="var(--primary)" />
                                <input type="number" placeholder="N° Mesa" value={mesaFilter} onChange={(e) => setMesaFilter(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }} />
                            </div>
                        </div>
                        <div className="card" style={{ padding: '0.75rem', background: 'var(--background)' }}>
                            <div className="flex items-center gap-2">
                                <Filter size={16} color="var(--primary)" />
                                <input type="number" placeholder="N° Orden" value={ordenFilter} onChange={(e) => setOrdenFilter(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }} />
                            </div>
                        </div>
                    </div>

                    <div className="card mb-6" style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Search size={20} color="var(--text-muted)" />
                        <input type="text" placeholder="Buscar por Nombre o C.I..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', width: '100%', outline: 'none' }} />
                    </div>

                    {mesaFilter && (
                        <div className="card mb-6" style={{ background: 'rgba(var(--primary-rgb), 0.1)', border: '1px solid var(--primary)' }}>
                            <div className="flex justify-between items-center mb-2">
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Participación Mesa {mesaFilter}</span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{turnoutStats.votedOurPeople} / {turnoutStats.totalOurPeople}</span>
                            </div>
                            <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                <motion.div initial={{ width: 0 }} animate={{ width: `${(turnoutStats.votedOurPeople / (turnoutStats.totalOurPeople || 1)) * 100}%` }} style={{ height: '100%', background: 'var(--primary)' }} />
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        {filteredElectors.map(e => (
                            <motion.div key={e.ci} className="card" style={{ padding: '1.25rem', borderLeft: e.tenant_status === 'Voto Realizado' ? '6px solid var(--success)' : '6px solid transparent' }}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Mesa {e.mesa} • Orden {e.orden}</span>
                                            {e.needs_transport === 1 && <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '2px 6px', borderRadius: '4px' }}>MOVILIZADO</span>}
                                        </div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{e.nombre}</h3>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>C.I. {e.ci}</p>
                                    </div>
                                    <button onClick={() => handleRecordVote(e.ci)} disabled={e.tenant_status === 'Voto Realizado'} style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: e.tenant_status === 'Voto Realizado' ? 'rgba(16, 185, 129, 0.1)' : 'var(--primary)', color: e.tenant_status === 'Voto Realizado' ? 'var(--success)' : 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {e.tenant_status === 'Voto Realizado' ? <><CheckCircle size={18} /> VOTÓ</> : <><CheckSquare size={18} /> MARCAR</>}
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </>
            ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
                    <h2 className="mb-6 flex items-center gap-2" style={{ color: 'var(--primary)' }}>
                        <CheckSquare size={24} /> Resultados de Mesa
                    </h2>
                    <form onSubmit={handleSaveResults} className="flex flex-col gap-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>N° Mesa</label>
                                <input type="number" required value={resultForm.mesa} onChange={e => setResultForm({...resultForm, mesa: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--background)', border: '1px solid var(--border)', color: 'white' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Local</label>
                                <input type="text" required value={resultForm.local} onChange={e => setResultForm({...resultForm, local: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--background)', border: '1px solid var(--border)', color: 'white' }} />
                            </div>
                        </div>

                        <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--primary)' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>Nuestro Candidato</label>
                            <input type="number" required value={resultForm.nuestro} onChange={e => setResultForm({...resultForm, nuestro: parseInt(e.target.value) || 0})} style={{ width: '100%', fontSize: '2rem', fontWeight: 800, background: 'transparent', border: 'none', color: 'white', outline: 'none' }} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Oponente 1</label>
                                <input type="number" value={resultForm.op1} onChange={e => setResultForm({...resultForm, op1: parseInt(e.target.value) || 0})} style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', outline: 'none' }} />
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Oponente 2</label>
                                <input type="number" value={resultForm.op2} onChange={e => setResultForm({...resultForm, op2: parseInt(e.target.value) || 0})} style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', outline: 'none' }} />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Otros</label>
                                <input type="number" value={resultForm.otros} onChange={e => setResultForm({...resultForm, otros: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Nulos</label>
                                <input type="number" value={resultForm.nulos} onChange={e => setResultForm({...resultForm, nulos: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Blancos</label>
                                <input type="number" value={resultForm.blancos} onChange={e => setResultForm({...resultForm, blancos: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white' }} />
                            </div>
                        </div>

                        <button type="submit" disabled={syncing} className="btn-primary" style={{ padding: '1.25rem', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <Save size={20} />
                            {syncing ? 'GUARDANDO ACTA...' : 'SUBIR RESULTADOS FINALES'}
                        </button>
                    </form>
                </motion.div>
            )}
        </div>
    );
};

export default VeedorApp;
