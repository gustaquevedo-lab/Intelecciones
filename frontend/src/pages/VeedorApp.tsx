import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Users, MapPin, Hash, Info, Search } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const VeedorApp = () => {
  const { user } = useAuth();
  const [electors, setElectors] = useState<any[]>([]);
  const [votedOrders, setVotedOrders] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState<number | null>(null);
  const [tableInfo, setTableInfo] = useState({ local: '', mesa: '', total: 0 });

  useEffect(() => {
    if (user?.role !== 'MIEMBRO_DE_MESA' && user?.role !== 'SUPERUSUARIO' && user?.role !== 'JEFE_CAMPANA') {
      // Access allowed for management too
    }
    loadTableData();
  }, [user]);

  const loadTableData = async () => {
    try {
      setLoading(true);
      // Get the observer's assigned table data
      const res = await api.get('/veedor/table-status');
      setTableInfo(res.data.info);
      
      // Initialize the voted orders from existing captures
      const voted = new Set<number>(res.data.votedOrders);
      setVotedOrders(voted);
      
      // Generate the grid based on total electors
      const grid = Array.from({ length: res.data.info.total }, (_, i) => i + 1);
      setElectors(grid);
    } catch (err) {
      console.error('Error loading table data:', err);
    } finally {
      setLoading(false);
    }
  };

  const markVote = async (order: number) => {
    if (votedOrders.has(order)) return;

    try {
      setShowSuccess(order);
      await api.post('/veedor/mark-vote', { order });
      
      setVotedOrders(prev => new Set(prev).add(order));
      
      // Hide success after 1 second
      setTimeout(() => setShowSuccess(null), 1000);
    } catch (err) {
      console.error('Error marking vote:', err);
      setShowSuccess(null);
    }
  };

  return (
    <MainLayout title="Control de Veeduría" userName={user?.nombre || 'Veedor'}>
      <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto', paddingBottom: '5rem' }}>
        
        {/* Header Táctico */}
        <header className="card-premium-styled" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <MapPin size={14} style={{ color: tableInfo.local === 'SIN ASIGNACIÓN' ? 'var(--red)' : 'var(--plra-300)' }} />
              <h2 style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text)' }}>
                {tableInfo.local || 'Cargando...'}
                {tableInfo.local === 'SIN ASIGNACIÓN' && <span style={{ color: 'var(--red)', marginLeft: '0.5rem', fontSize: '0.7rem' }}>(CONTACTE COORDINADOR)</span>}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 700 }}>
                MESA: <span style={{ color: 'var(--plra-200)' }}>{tableInfo.mesa || '—'}</span>
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 700 }}>
                TOTAL: <span style={{ color: 'var(--text)' }}>{tableInfo.total} electores</span>
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--green)' }}>
              {tableInfo.total > 0 ? Math.round((votedOrders.size / tableInfo.total) * 100) : 0}%
            </p>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase' }}>Participación</p>
          </div>
        </header>

        {/* Cuadrícula Tactil */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem' }}>
            <div className="loading-spinner" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-3)' }}>Configurando mesa...</p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', 
            gap: '0.5rem',
            background: 'var(--surface-light)',
            padding: '0.5rem',
            borderRadius: '12px'
          }}>
            {electors.map((order) => {
              const isVoted = votedOrders.has(order);
              return (
                <motion.button
                  key={order}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => markVote(order)}
                  style={{
                    height: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                    border: '1px solid',
                    cursor: isVoted ? 'default' : 'pointer',
                    background: isVoted ? 'var(--plra-500)' : 'var(--surface-light)',
                    borderColor: isVoted ? 'var(--plra-300)' : 'var(--border)',
                    position: 'relative',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{ 
                    fontSize: '0.65rem', 
                    fontWeight: 900, 
                    color: isVoted ? 'rgba(0,0,0,0.3)' : 'var(--text-3)',
                    position: 'absolute',
                    top: '4px', left: '4px'
                  }}>
                    #{order}
                  </span>
                  
                  {isVoted ? (
                    <Check size={20} style={{ color: 'white' }} />
                  ) : (
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>{order}</span>
                  )}

                  <AnimatePresence>
                    {showSuccess === order && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: 0 }}
                        animate={{ opacity: 1, scale: 1.5, y: -20 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        style={{
                          position: 'absolute',
                          zIndex: 10,
                          background: 'var(--green)',
                          borderRadius: '50%',
                          padding: '4px',
                          boxShadow: '0 4px 15px rgba(34,197,94,0.4)'
                        }}
                      >
                        <Check size={20} color="white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default VeedorApp;
