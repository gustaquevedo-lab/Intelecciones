import React, { useState, useEffect } from 'react';
import { Plus, Check, Flag, Search, UserPlus, Shield, ChevronRight, MapPin, Layers, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, apiFetch } from '../context/AuthContext';

const Campaigns: React.FC = () => {
    const { user } = useAuth();
    const [tenants, setTenants] = useState<any[]>([]);
    const [step, setStep] = useState(1);
    const [showNewModal, setShowNewModal] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [successData, setSuccessData] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: '',
        party: 'ANR',
        candidate_ci: '',
        election_type: 'Municipales',
        position: 'Intendente',
        list_number: '',
        option_number: '',
        city: '',
        department: ''
    });

    useEffect(() => {
        fetchTenants();
    }, []);

    const fetchTenants = async () => {
        try {
            const res = await apiFetch('http://localhost:5000/api/admin/tenants_list'); 
            if (res.ok) {
                const data = await res.json();
                setTenants(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const isPlurinominal = ['Concejal', 'Senador', 'Diputado', 'Junta Departamental'].includes(formData.position);

    useEffect(() => {
        const lookup = async () => {
            if (formData.candidate_ci.length >= 5) {
                try {
                    const res = await apiFetch(`http://localhost:5000/api/admin/verify-candidate/${formData.candidate_ci}`);
                    if (res.ok) {
                        const data = await res.json();
                        setFormData({
                            ...formData,
                            name: data.nombre,
                            city: data.distrito,
                            department: data.departamento
                        });
                        if (step === 1) setStep(2);
                    }
                } catch (err) { }
            }
        };
        const timer = setTimeout(lookup, 500);
        return () => clearTimeout(timer);
    }, [formData.candidate_ci]);

    const handleVerifyCI = async () => {
        if (!formData.candidate_ci) return;
        setVerifying(true);
        try {
            const res = await apiFetch(`http://localhost:5000/api/admin/verify-candidate/${formData.candidate_ci}`);
            if (res.ok) {
                const data = await res.json();
                setFormData({
                    ...formData,
                    name: data.nombre,
                    city: data.distrito,
                    department: data.departamento
                });
                setStep(2);
            } else {
                alert('CI no encontrado en el padrón.');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setVerifying(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await apiFetch('http://localhost:5000/api/admin/tenants', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                const result = await res.json();
                setSuccessData({ ...formData, tenant_id: result.tenant_id });
                setStep(4); // Pantalla de éxito
                fetchTenants(); // Recargar lista
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (user?.role !== 'SUPERUSUARIO') {
        return <div className="container" style={{ paddingTop: '100px' }}>Acceso restringido. Solo Superusuario.</div>;
    }

    return (
        <div className="container" style={{ paddingTop: '100px', paddingBottom: '60px' }}>
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 style={{ fontSize: '2.75rem', fontWeight: 900, letterSpacing: '-0.03em' }}>Gestión de Candidatos (SaaS)</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Control global de identidades electorales y despliegue territorial.</p>
                </div>
                <button 
                    onClick={() => { setStep(1); setShowNewModal(true); }}
                    className="btn-primary" 
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '1rem 2rem', borderRadius: '16px', fontWeight: 700, fontSize: '1rem' }}
                >
                    <UserPlus size={22} /> Registrar Candidato
                </button>
            </div>

            {/* Modal de Registro Avanzado */}
            <AnimatePresence>
                {showNewModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card" style={{ width: '100%', maxWidth: '600px', padding: '3rem' }}>
                            
                            {/* Stepper Progress */}
                            <div className="flex gap-2 mb-8">
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ flex: 1, height: '4px', background: step >= i ? 'var(--primary)' : 'var(--border)', borderRadius: '2px' }} />
                                ))}
                            </div>

                            {step === 1 && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                    <h2 className="mb-2">Verificación de Candidato</h2>
                                    <p className="mb-8 text-muted" style={{ fontSize: '0.9rem' }}>Ingrese el C.I. para validar la residencia electoral y nombre legal.</p>
                                    <div className="flex flex-col gap-6">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 700 }}>C.I. DEL CANDIDATO</label>
                                            <div className="flex gap-2">
                                                <input type="text" placeholder="Ej. 1234567" value={formData.candidate_ci} onChange={e => setFormData({...formData, candidate_ci: e.target.value})} style={{ flex: 1, padding: '1rem', borderRadius: '12px', background: 'var(--background)', border: '1px solid var(--border)', color: 'white', fontSize: '1.1rem' }} />
                                                <button onClick={handleVerifyCI} disabled={verifying} style={{ background: 'var(--primary)', color: 'white', padding: '0 1.5rem', borderRadius: '12px' }}>
                                                    {verifying ? '...' : <Search />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                    <div className="flex items-center gap-3 mb-6 p-4 bg-primary" style={{ background: 'rgba(var(--primary-rgb), 0.1)', borderRadius: '12px', border: '1px solid var(--primary)' }}>
                                        <MapPin size={20} color="var(--primary)" />
                                        <div>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700 }}>Residencia Detectada</p>
                                            <p style={{ fontWeight: 600 }}>{formData.name} - {formData.city}, {formData.department}</p>
                                        </div>
                                    </div>

                                    <form className="flex flex-col gap-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 700 }}>TIPO DE ELECCIÓN</label>
                                                <select value={formData.election_type} onChange={e => setFormData({...formData, election_type: e.target.value})} style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--background)', border: '1px solid var(--border)', color: 'white' }}>
                                                    <option>Municipales</option>
                                                    <option>Generales</option>
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 700 }}>CARGO EN PUGNA</label>
                                                <select value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--background)', border: '1px solid var(--border)', color: 'white' }}>
                                                    {formData.election_type === 'Municipales' ? (
                                                        <>
                                                            <option>Intendente</option>
                                                            <option>Concejal</option>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <option>Presidente</option>
                                                            <option>Senador</option>
                                                            <option>Diputado</option>
                                                            <option>Gobernador</option>
                                                            <option>Junta Departamental</option>
                                                        </>
                                                    )}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 700 }}>N° DE LISTA</label>
                                                <input type="text" placeholder="Ej. 1" value={formData.list_number} onChange={e => setFormData({...formData, list_number: e.target.value})} style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--background)', border: '1px solid var(--border)', color: 'white' }} />
                                            </div>
                                            {isPlurinominal && (
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 700 }}>OPCIÓN</label>
                                                    <input type="text" placeholder="Ej. 5" value={formData.option_number} onChange={e => setFormData({...formData, option_number: e.target.value})} style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--background)', border: '1px solid var(--border)', color: 'white' }} />
                                                </div>
                                            )}
                                        </div>

                                        <button type="button" onClick={() => setStep(3)} className="btn-primary" style={{ padding: '1rem', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            Siguiente Paso <ChevronRight size={18} />
                                        </button>
                                    </form>
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                    <h2 className="mb-8">Identidad del Partido</h2>
                                    <div className="grid grid-cols-2 gap-4 mb-10">
                                        <button onClick={() => setFormData({...formData, party: 'ANR'})} style={{ padding: '2rem', borderRadius: '16px', border: '2px solid', borderColor: formData.party === 'ANR' ? '#dc2626' : 'var(--border)', background: formData.party === 'ANR' ? 'rgba(220, 38, 38, 0.1)' : 'transparent', color: formData.party === 'ANR' ? '#dc2626' : 'var(--text-muted)', fontWeight: 800 }}>ANR</button>
                                        <button onClick={() => setFormData({...formData, party: 'PLRA'})} style={{ padding: '2rem', borderRadius: '16px', border: '2px solid', borderColor: formData.party === 'PLRA' ? '#2563eb' : 'var(--border)', background: formData.party === 'PLRA' ? 'rgba(37, 99, 235, 0.1)' : 'transparent', color: formData.party === 'PLRA' ? '#2563eb' : 'var(--text-muted)', fontWeight: 800 }}>PLRA</button>
                                    </div>
                                    <div className="flex gap-4">
                                        <button onClick={handleCreate} className="btn-primary" style={{ flex: 1, padding: '1.25rem', fontWeight: 800 }}>CONFIRMAR Y ACTIVAR SAAS</button>
                                        <button onClick={() => setShowNewModal(false)} style={{ padding: '1.25rem', color: 'var(--text-muted)' }}>Cancelar</button>
                                    </div>
                                </motion.div>
                            )}

                            {step === 4 && (
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                                    <div className="flex flex-col items-center text-center p-8">
                                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                                            <Check size={40} color="#22c55e" />
                                        </div>
                                        <h2 className="mb-2">¡Campaña Activada!</h2>
                                        <p className="text-muted mb-8">El tenant {successData?.tenant_id} ha sido creado exitosamente.</p>
                                        <button onClick={() => setShowNewModal(false)} className="btn-primary" style={{ padding: '1rem 2rem' }}>Finalizar</button>
                                    </div>
                                </motion.div>
                            )}

                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Admin Status Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card" 
                    style={{ border: '2px solid var(--primary)', background: 'rgba(var(--primary-rgb), 0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 8px 16px rgba(var(--primary-rgb), 0.3)' }}>
                            <Shield size={28} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Master Admin</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sesión Global Activa</p>
                        </div>
                    </div>
                    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        Estás administrando <strong>{tenants.length}</strong> campañas activas en todo el territorio nacional.
                    </div>
                </motion.div>

                {/* Tenant Cards */}
                <AnimatePresence>
                    {tenants.map(t => (
                        <motion.div 
                            key={t.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="card"
                            style={{ position: 'relative', overflow: 'hidden' }}
                        >
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: t.party === 'ANR' ? '#dc2626' : '#2563eb' }} />
                            
                            <div className="flex justify-between items-start mb-6">
                                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: t.party === 'ANR' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Flag size={20} color={t.party === 'ANR' ? '#dc2626' : '#2563eb'} />
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                                    LISTA {t.list_number || '-'}
                                </div>
                            </div>

                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '4px' }}>{t.name}</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{t.position} • {t.election_type}</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div className="flex items-center gap-2" style={{ fontSize: '0.85rem' }}>
                                    <MapPin size={16} color="var(--primary)" />
                                    <span>{t.city}, {t.department}</span>
                                </div>
                                <div className="flex items-center gap-2" style={{ fontSize: '0.85rem' }}>
                                    <Layers size={16} color="var(--text-muted)" />
                                    <span>Sistema Electoral {t.election_type}</span>
                                </div>
                            </div>

                            <button style={{ width: '100%', marginTop: '2rem', padding: '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 600, fontSize: '0.85rem' }}>
                                Administrar Campaña
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Campaigns;
