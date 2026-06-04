import React, { useState, useEffect } from 'react';
import { Award, BarChart3, Users, Award as AwardIcon } from 'lucide-react';
import api from '../../services/api';
import { DHondtService, type Candidate } from '../../services/DHondtService';

const TabDHondt = () => {
  const [bancas, setBancas] = useState(12);
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState('');

  const fetchResults = async () => {
    try {
      setLoading(true);
      const res = await api.get('/diad/results');
      // Format results into Candidate objects
      const formatted = res.data.map((r: any) => ({
        id: r.id,
        list_number: r.list_number,
        option_number: parseInt(r.option_number) || 0,
        candidate_nombre: r.candidate_nombre || '',
        candidate_alias: r.candidate_alias || '',
        votos: r.votos || 0
      }));
      setCandidates(formatted);
    } catch (err) {
      setError('Error al cargar la proyección D\'Hondt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const projections = React.useMemo(() => {
    // Only calculate for CONCEJAL list items
    const concejales = candidates.filter(c => c.list_number);
    return DHondtService.calcularProyeccion(concejales, bancas);
  }, [candidates, bancas]);

  const LIST_COLORS = [
    '#2E84F0', '#25C882', '#F59E0B', '#A855F7',
    '#EF4444', '#06B6D4', '#84CC16', '#F97316',
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="loading-spinner" style={{ margin: '0 auto' }} />
        <p style={{ marginTop: '1rem', color: 'var(--text-3)' }}>Calculando proyección electoral...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Title block */}
      <div className="card-premium-styled" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 900, color: 'white', margin: '0 0 0.2rem' }}>
            Proyección de Bancas D'Hondt
          </h3>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', margin: 0 }}>
            Cómputo en vivo con desbloqueo de listas (voto preferencial).
          </p>
        </div>
        
        {/* Seats configuration */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 800 }}>BANCAS:</span>
          <input
            type="number"
            min={1}
            max={50}
            value={bancas}
            onChange={e => setBancas(Math.max(1, parseInt(e.target.value) || 1))}
            style={{
              width: '60px', padding: '0.35rem', borderRadius: '8px', border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 900, textAlign: 'center',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {projections.length === 0 ? (
        <div className="card-premium-styled" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)' }}>
          <BarChart3 size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p style={{ fontWeight: 800 }}>No hay votos cargados para calcular la proyección.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {projections.map((p, idx) => {
            const color = LIST_COLORS[idx % LIST_COLORS.length];
            return (
              <div 
                key={p.list_number} 
                className="card-premium-styled" 
                style={{ 
                  padding: '1.25rem', 
                  border: p.bancas_ganadas > 0 ? `1px solid ${color}40` : '1px solid var(--border)',
                  background: p.bancas_ganadas > 0 ? `${color}05` : 'transparent'
                }}
              >
                {/* List Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'white' }}>
                      Lista {p.list_number} - {p.list_name}
                    </span>
                  </div>
                  <span style={{ fontSize: '1.1rem', fontWeight: 900, color: color, fontFamily: 'Space Grotesk' }}>
                    {p.bancas_ganadas} Banca{p.bancas_ganadas !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Vote breakdown */}
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                  <span>Votos Lista: <strong>{p.votos_lista_pura}</strong></span>
                  <span>Votos Preferencias: <strong>{p.votos_preferenciales_candidatos}</strong></span>
                  <span style={{ marginLeft: 'auto', color: 'white', fontWeight: 800 }}>Total: {p.votos_totales}</span>
                </div>

                {/* Winning candidates */}
                {p.bancas_ganadas > 0 && (
                  <div>
                    <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                      Candidatos que ingresan (Desbloqueados)
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {p.candidatos_ganadores.map((cand, cIdx) => (
                        <div 
                          key={cand.id} 
                          style={{ 
                            display: 'flex', alignItems: 'center', gap: '0.5rem', 
                            padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', 
                            borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' 
                          }}
                        >
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: color, width: '20px' }}>#{cIdx + 1}</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', flex: 1 }}>
                            Opción {cand.option_number}: {cand.candidate_nombre || cand.candidate_alias}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                            {cand.votos} votos pref.
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TabDHondt;
