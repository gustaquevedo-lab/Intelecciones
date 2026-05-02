import React from 'react';
import { Users, MapPin, Truck, AlertCircle, TrendingUp, Search, Activity, Layout, CheckSquare, BarChart, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, apiFetch } from '../context/AuthContext';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [electors, setElectors] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState<any[]>([]);
  const [results, setResults] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<'planning' | 'live'>('planning');

  React.useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchData = () => {
      Promise.all([
        apiFetch('http://localhost:5000/api/electors/search').then(res => res.json()),
        apiFetch('http://localhost:5000/api/stats/neighborhoods').then(res => res.json()),
        apiFetch('http://localhost:5000/api/stats/results').then(res => res.json())
      ]).then(([electorsData, statsData, resultsData]) => {
        setElectors(electorsData);
        setStats(statsData);
        setResults(resultsData);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  const visitedCount = electors.filter(e => e.tenant_status === 'Visitado').length;
  const votedCount = electors.filter(e => e.tenant_status === 'Voto Realizado').length;
  const transportCount = electors.filter(e => e.needs_transport === 1).length;
  const totalCount = electors.length || 1;
  
  const coverageRate = Math.round((visitedCount / totalCount) * 100);
  const turnoutRate = Math.round((votedCount / totalCount) * 100);

  return (
    <div className="container" style={{ paddingTop: '100px', paddingBottom: '60px' }}>
      {/* Header Section */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Command Center</h1>
            <div className="flex p-1 bg-surface rounded-xl border border-border shadow-lg">
              <button 
                onClick={() => setViewMode('planning')}
                style={{ 
                  padding: '6px 16px', 
                  borderRadius: '10px', 
                  fontSize: '0.75rem', 
                  fontWeight: 700,
                  background: viewMode === 'planning' ? 'var(--primary)' : 'transparent',
                  color: viewMode === 'planning' ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
              >PLANEAMIENTO</button>
              <button 
                onClick={() => setViewMode('live')}
                style={{ 
                  padding: '6px 16px', 
                  borderRadius: '10px', 
                  fontSize: '0.75rem', 
                  fontWeight: 700,
                  background: viewMode === 'live' ? 'var(--error)' : 'transparent',
                  color: viewMode === 'live' ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
              >DÍA D (LIVE)</button>
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
            Elecciones Internas 2026 • Pedro Juan Caballero, Amambay
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link to="/colector" className="btn-primary" style={{ textDecoration: 'none', padding: '0.75rem 1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
            <Layout size={18} /> Lanzar Colector
          </Link>
          <div className="glass-morphism" style={{ padding: '0.75rem 1.25rem', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border)' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Estado</p>
              <p style={{ fontSize: '0.9rem', fontWeight: 700, color: viewMode === 'live' ? 'var(--error)' : 'var(--success)' }}>
                ● {viewMode === 'live' ? 'LIVE' : 'SYNC OK'}
              </p>
            </div>
            <Activity color={viewMode === 'live' ? 'var(--error)' : 'var(--success)'} size={24} />
          </div>
        </div>
      </div>

      {/* Live Results Panel */}
      {viewMode === 'live' && results && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="card mb-8" 
          style={{ background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.1), rgba(0,0,0,0.3))', border: '1px solid var(--primary)', padding: '2rem' }}
        >
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>RESULTADOS PARCIALES (Centro de Cómputos)</h2>
              <p style={{ color: 'var(--text-muted)' }}>{results.mesas_escrutadas} mesas cargadas de 150 totales</p>
            </div>
            <div style={{ background: 'var(--error)', padding: '4px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800 }}>LIVE FEED</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Nuestro Candidato</p>
              <h2 style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--primary)' }}>{results.nuestro?.toLocaleString() || 0}</h2>
              <div style={{ height: '4px', background: 'var(--primary)', borderRadius: '2px', width: '100%' }} />
            </div>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Oponente 1</p>
              <h2 style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--text-muted)', opacity: 0.5 }}>{results.oponente_1?.toLocaleString() || 0}</h2>
              <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', width: '100%' }} />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>BRECHA ACTUAL</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>+{(results.nuestro - results.oponente_1) || 0} votos</h3>
            </div>
          </div>
        </motion.div>
      )}

      {/* KPI Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {viewMode === 'planning' ? (
          <>
            <StatCard icon={<Users />} label="Cobertura Territorial" value={`${coverageRate}%`} subtext={`${visitedCount} de ${totalCount}`} color="var(--primary)" progress={coverageRate} />
            <StatCard icon={<MapPin />} label="Georeferencias" value={electors.filter(e => e.is_verified_address).length} subtext="Direcciones validadas" color="var(--success)" progress={Math.round((electors.filter(e => e.is_verified_address).length / totalCount) * 100)} />
            <StatCard icon={<Truck />} label="Movilización" value={transportCount} subtext="Requieren transporte" color="var(--accent)" progress={Math.round((transportCount / (visitedCount || 1)) * 100)} />
            <StatCard icon={<AlertCircle />} label="Alertas" value="12" subtext="Pendientes" color="#ef4444" progress={10} />
          </>
        ) : (
          <>
            <StatCard icon={<CheckSquare />} label="Participación Real" value={`${turnoutRate}%`} subtext={`${votedCount} confirmados`} color="var(--error)" progress={turnoutRate} />
            <StatCard icon={<TrendingUp />} label="Velocidad" value="42 v/h" subtext="Votos por hora" color="var(--success)" progress={75} />
            <StatCard icon={<BarChart />} label="Mesas" value="128/150" subtext="Reportando" color="var(--primary)" progress={85} />
            <StatCard icon={<Clock />} label="Cierre Estimado" value="17:00" subtext="Hora pico superada" color="var(--accent)" progress={100} />
          </>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 card p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Monitor de Electorado</h3>
            <div className="flex items-center gap-2 p-2 bg-background border border-border rounded-lg" style={{ width: '300px' }}>
              <Search size={18} color="var(--text-muted)" />
              <input placeholder="Buscar por CI o nombre..." style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%' }} />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0 1rem' }}>Elector</th>
                  <th style={{ padding: '0 1rem' }}>Ubicación</th>
                  <th style={{ padding: '0 1rem' }}>Transporte</th>
                  <th style={{ padding: '0 1rem' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {electors.slice(0, 10).map((e: any) => (
                  <tr key={e.ci} style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '1rem', borderRadius: '12px 0 0 12px' }}>
                      <div style={{ fontWeight: 600 }}>{e.nombre}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CI: {e.ci}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontSize: '0.85rem' }}>{e.local_votacion}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mesa {e.mesa}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {e.needs_transport === 1 ? <Truck size={16} color="var(--accent)" /> : '-'}
                    </td>
                    <td style={{ padding: '1rem', borderRadius: '0 12px 12px 0' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: e.tenant_status === 'Voto Realizado' ? 'var(--success)' : e.tenant_status === 'Visitado' ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {e.tenant_status || 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div className="card p-6">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Desglose Territorial</h3>
            <div className="flex flex-col gap-6">
              {stats.map((s, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-2">
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.barrio || 'Sin Barrio'}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.visited} / {s.total}</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${(s.visited/s.total)*100}%`, height: '100%', background: 'var(--primary)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Feed de Actividad</h3>
            <div className="flex flex-col gap-4">
              <ActivityLog user="Veedor Mesa 12" action="Reportó 145 votos" time="2m" />
              <ActivityLog user="Colector Centro" action="Visitó a Carlos Benitez" time="8m" />
              <ActivityLog user="Logística" action="Bus #04 en camino" time="15m" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode, label: string, value: any, subtext: string, color: string, progress: number }> = ({ icon, label, value, subtext, color, progress }) => (
  <motion.div whileHover={{ y: -5 }} className="card p-6" style={{ borderLeft: `4px solid ${color}` }}>
    <div className="flex justify-between items-start mb-4">
      <div style={{ background: `${color}15`, color, padding: '10px', borderRadius: '12px' }}>{icon}</div>
      <div style={{ fontSize: '0.7rem', fontWeight: 800, color }}>{progress}%</div>
    </div>
    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</p>
    <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{value}</h2>
    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{subtext}</p>
    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '12px' }}>
      <div style={{ width: `${progress}%`, height: '100%', background: color, borderRadius: '2px' }} />
    </div>
  </motion.div>
);

const ActivityLog: React.FC<{ user: string, action: string, time: string }> = ({ user, action, time }) => (
  <div className="flex items-start gap-3">
    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', marginTop: '6px' }} />
    <div>
      <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user}</p>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{action}</p>
      <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{time}</p>
    </div>
  </div>
);

export default Dashboard;
