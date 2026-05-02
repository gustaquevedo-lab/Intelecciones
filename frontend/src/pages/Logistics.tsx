import React, { useState, useEffect } from 'react';
import { Truck, User, MapPin, CheckCircle, Clock, AlertTriangle, ChevronRight, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth, apiFetch } from '../context/AuthContext';

const Logistics: React.FC = () => {
    const { user } = useAuth();
    const [units, setUnits] = useState<any[]>([]);
    const [pendingElectors, setPendingElectors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const [unitsRes, electorsRes] = await Promise.all([
                apiFetch('http://localhost:5000/api/units'),
                apiFetch('http://localhost:5000/api/electors')
            ]);
            const unitsData = await unitsRes.json();
            const electorsData = await electorsRes.json();
            
            setUnits(unitsData);
            setPendingElectors(electorsData.filter((e: any) => e.needs_transport === 1 && e.tenant_status !== 'Voto Realizado'));
            setLoading(false);
        };
        fetchData();
    }, []);

    // Grouping by Neighborhood (Barrio) and Local de Votación
    const groupedElectors = pendingElectors.reduce((acc: any, curr: any) => {
        const key = curr.barrio || 'Sin Barrio Especificado';
        if (!acc[key]) acc[key] = [];
        acc[key].push(curr);
        return acc;
    }, {});

    return (
        <div className="container" style={{ paddingTop: '100px', paddingBottom: '40px' }}>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 style={{ fontSize: '2rem' }}>Logística "Uber Electoral"</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Gestión de flota y rutas eficientes en Pedro Juan Caballero.</p>
                </div>
                <div className="flex gap-3">
                    <button className="card flex items-center gap-2" style={{ padding: '0.75rem 1.25rem' }}>
                        <UserPlus size={18} /> Nuevo Chofer
                    </button>
                    <button className="btn-primary flex items-center gap-2">
                        <Truck size={18} /> Añadir Vehículo
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 grid-cols-3 gap-8">
                {/* Fleet Overview */}
                <div className="col-span-1">
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Truck size={20} color="var(--primary)" /> Flota Activa
                    </h3>
                    <div className="flex flex-col gap-4">
                        {units.map(unit => (
                            <div key={unit.id} className="card" style={{ borderLeft: '4px solid var(--success)' }}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 style={{ fontSize: '1.1rem' }}>{unit.driver_name}</h4>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{unit.plate} • Capacidad: {unit.capacity}</p>
                                    </div>
                                    <span style={{ 
                                        fontSize: '0.7rem', 
                                        background: 'rgba(16, 185, 129, 0.1)', 
                                        color: 'var(--success)',
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '4px'
                                    }}>{unit.status}</span>
                                </div>
                                <div className="flex justify-between items-center mt-4">
                                    <span style={{ fontSize: '0.8rem' }}>{unit.phone}</span>
                                    <button style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600 }}>Asignar Ruta</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Logistics Intelligence: Groups */}
                <div className="col-span-2">
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={20} color="var(--accent)" /> Clusters de Transporte por Barrio
                    </h3>
                    
                    <div className="flex flex-col gap-6">
                        {Object.entries(groupedElectors).map(([barrio, electors]: any) => (
                            <div key={barrio} className="card">
                                <div className="flex justify-between items-center mb-4 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                                    <div>
                                        <h4 style={{ color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>{barrio}</h4>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{electors.length} electores solicitaron transporte</p>
                                    </div>
                                    <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                                        Asignar Móvil
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Sort by Mesa then Orden automatically suggests AZ behavior */}
                                    {electors.sort((a: any, b: any) => a.mesa - b.mesa || a.orden - b.orden).map((e: any) => (
                                        <div key={e.ci} className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-hover transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div style={{ 
                                                    width: '32px', 
                                                    height: '32px', 
                                                    borderRadius: '50%', 
                                                    background: 'rgba(255,255,255,0.05)', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold'
                                                }}>
                                                    #{e.orden}
                                                </div>
                                                <div>
                                                    <p style={{ fontSize: '0.875rem' }}>{e.nombre}</p>
                                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{e.local_votacion} • Mesa {e.mesa}</p>
                                                </div>
                                            </div>
                                            {e.is_priority && (
                                                <div title="Adulto Mayor / Discapacidad">
                                                    <AlertTriangle size={16} color="var(--accent)" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {Object.keys(groupedElectors).length === 0 && (
                            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                No hay electores pendientes de movilización.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Logistics;
