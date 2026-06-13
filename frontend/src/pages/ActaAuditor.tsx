import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, CheckCircle, AlertTriangle, RefreshCw, 
  ChevronRight, ArrowLeft, Save, Eye, Check, X, Loader
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface CandidateVote {
  num_lista: string;
  ord_candidato: number;
  nom_candidato: string;
  des_partido: string;
  votos: number;
}

interface ListTotal {
  numLista: string;
  votos: number;
  desPartido: string;
}

export default function ActaAuditor() {
  const navigate = useNavigate();
  const [dpto, setDpto] = useState('13'); // Amambay
  const [distrito, setDistrito] = useState('0'); // PJC
  const [mesa, setMesa] = useState('1');
  const [candidatura, setCandidatura] = useState('4'); // Directorio Nacional
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [actaImage, setActaImage] = useState<string | null>(null);
  const [cabecera, setCabecera] = useState<any>(null);
  const [detalleListas, setDetalleListas] = useState<ListTotal[]>([]);
  const [candidateVotes, setCandidateVotes] = useState<CandidateVote[]>([]);
  const [ocrText, setOcrText] = useState<string | null>(null);

  // Bulk import states
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMesas, setBulkMesas] = useState<number[]>([]);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkLogs, setBulkLogs] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const distritosAmambay = [
    { code: '0', name: 'PEDRO JUAN CABALLERO' },
    { code: '1', name: 'BELLA VISTA NORTE' },
    { code: '3', name: 'CAPITAN BADO' },
    { code: '4', name: 'ZANJA PYTA' },
    { code: '5', name: 'KARAPAI' },
    { code: '6', name: 'CERRO CORA' }
  ];

  const [localVotacion, setLocalVotacion] = useState<string>('');
  const [localesList, setLocalesList] = useState<string[]>([]);

  useEffect(() => {
    const loadLocales = async () => {
      try {
        const districtName = distritosAmambay.find(d => d.code === distrito)?.name || '';
        if (!districtName) return;
        const res = await api.get('/diad/locales', { params: { distrito: districtName } });
        setLocalesList(res.data);
        if (res.data.length > 0) {
          setLocalVotacion(res.data[0]);
        } else {
          setLocalVotacion('');
        }
      } catch (err) {
        console.error('Error loading locales:', err);
      }
    };
    loadLocales();
  }, [distrito]);

  const candidaturasPlurinominales = [
    { code: '4', name: 'DIRECTORIO NACIONAL' },
    { code: '5', name: 'DIRECTORIO DEPARTAMENTAL' }
  ];

  const startBulkImport = async () => {
    setBulkLoading(true);
    setBulkLogs([]);
    setBulkProgress(0);
    setShowBulkModal(true);
    
    try {
      const res = await api.get('/diad/mesas-to-import', {
        params: {
          departamento: parseInt(dpto),
          distrito: parseInt(distrito),
          candidatura: parseInt(candidatura)
        }
      });
      
      const mesas = res.data;
      setBulkMesas(mesas);
      
      if (mesas.length === 0) {
        setBulkLogs(['No se encontraron mesas para este distrito.']);
        setBulkLoading(false);
        return;
      }
      
      for (let i = 0; i < mesas.length; i++) {
        const mesaNum = mesas[i];
        setBulkProgress(i + 1);
        setBulkLogs(prev => [...prev, `Procesando Mesa ${mesaNum} de ${mesas.length}...`]);
        
        try {
          const importRes = await api.post('/diad/process-acta', {
            departamento: parseInt(dpto),
            distrito: parseInt(distrito),
            mesa: mesaNum,
            candidatura: parseInt(candidatura),
            autoSave: true
          });
          
          if (importRes.data.saved) {
            setBulkLogs(prev => [...prev.slice(0, -1), `✓ Mesa ${mesaNum}: Importada con éxito (Validada automáticamente)`]);
          } else {
            setBulkLogs(prev => [...prev.slice(0, -1), `⚠ Mesa ${mesaNum}: Requiere revisión manual`]);
          }
        } catch (err) {
          setBulkLogs(prev => [...prev.slice(0, -1), `✗ Mesa ${mesaNum}: Error de conexión`]);
        }
      }
      
      setBulkLogs(prev => [...prev, `\n¡Proceso de importación finalizado! Revise de forma manual las mesas marcadas con advertencia.`]);
    } catch (err: any) {
      setBulkLogs(prev => [...prev, `Error general: ${err.message}`]);
    } finally {
      setBulkLoading(false);
    }
  };

  const fetchActa = async () => {
    setLoading(true);
    setError(null);
    setActaImage(null);
    setCabecera(null);
    setDetalleListas([]);
    setCandidateVotes([]);
    setOcrText(null);

    try {
      // 1. Fetch TSJE data and run OCR
      const res = await api.post('/diad/process-acta', {
        departamento: parseInt(dpto),
        distrito: parseInt(distrito),
        mesa: parseInt(mesa),
        candidatura: parseInt(candidatura),
        local_votacion: localVotacion
      });

      const { jpeg, cabecera, detalle, ocr } = res.data;
      setActaImage(jpeg);
      setCabecera(cabecera);
      setOcrText(ocr?.rawText || '');
      setDetalleListas(detalle || []);

      // 2. Fetch existing candidates structure or votes from DB
      // To get the complete candidate list structure, we fetch the candidates consolidated at national (dpto 0, dist 0) or departmental (dpto 13, dist -1).
      const metaRes = await api.get('/diad/tsje-results', {
        params: {
          dpto: parseInt(candidatura) === 4 ? 0 : parseInt(dpto),
          distrito: parseInt(candidatura) === 4 ? 0 : -1,
          cargo: parseInt(candidatura)
        }
      });

      const candidatesList: any[] = [];
      const parentCands = metaRes.data?.candidatos || [];
      
      parentCands.forEach((list: any) => {
        const listNum = String(list.numLista);
        const listName = list.desPartido || '';
        
        (list.candidatosPref || []).forEach((c: any) => {
          candidatesList.push({
            num_lista: listNum,
            ord_candidato: c.ordCandidato,
            nom_candidato: c.nomCandidato,
            des_partido: listName,
            votos: 0
          });
        });
      });

      // Fetch currently saved votes for this specific mesa from tsje_resultado_preferente_mesa if any
      const mesaSavedRes = await api.get(`/diad/results-mesa`, {
        params: {
          dpto: parseInt(dpto),
          distrito: parseInt(distrito),
          mesa: parseInt(mesa),
          cargo: parseInt(candidatura)
        }
      }).catch(() => null);

      if (mesaSavedRes && Array.isArray(mesaSavedRes.data) && mesaSavedRes.data.length > 0) {
        // Map saved votes to the candidates list
        const savedMap = new Map();
        mesaSavedRes.data.forEach((item: any) => {
          savedMap.set(`${item.num_lista}_${item.ord_candidato}`, item.votos);
        });

        const initialized = candidatesList.map(c => ({
          ...c,
          votos: savedMap.get(`${c.num_lista}_${c.ord_candidato}`) || 0
        }));
        setCandidateVotes(initialized);
      } else {
        setCandidateVotes(candidatesList);
      }

    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || err.message || 'Error al procesar acta.');
    } finally {
      setLoading(false);
    }
  };

  const handleVoteChange = (numLista: string, ordCandidato: number, val: string) => {
    const numericVal = Math.max(0, parseInt(val) || 0);
    setCandidateVotes(prev => prev.map(c => 
      c.num_lista === numLista && c.ord_candidato === ordCandidato
        ? { ...c, votos: numericVal }
        : c
    ));
  };

  const saveVotes = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post('/diad/save-preferente-votos', {
        departamento: parseInt(dpto),
        distrito: parseInt(distrito),
        mesa: parseInt(mesa),
        candidatura: parseInt(candidatura),
        votos: candidateVotes.map(c => ({
          num_lista: c.num_lista,
          ord_candidato: c.ord_candidato,
          votos: c.votos
        }))
      });
      alert('Votos preferentes validados y consolidados exitosamente.');
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || err.message || 'Error al guardar los votos.');
    } finally {
      setSaving(false);
    }
  };

  // Group candidate inputs by list
  const listsFromCandidates = Array.from(new Set(candidateVotes.map(c => c.num_lista)))
    .sort((a, b) => parseInt(a) - parseInt(b));

  // Calculate sum of candidate votes for each list
  const getListSum = (numLista: string) => {
    return candidateVotes
      .filter(c => c.num_lista === numLista)
      .reduce((sum, c) => sum + c.votos, 0);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, var(--plra-900) 0%, #050b14 100%)',
      color: '#f8fafc',
      fontFamily: '"Outfit", sans-serif',
      padding: '2rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => navigate('/diad')}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '0.6rem',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Auditor de Actas y OCR
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
              Verificación y transcripción manual de votos preferentes
            </p>
          </div>
        </div>
      </div>

      {/* Selectors Panel */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '24px',
        padding: '1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.5rem',
        alignItems: 'flex-end'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1 1 200px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Departamento
          </label>
          <select 
            value={dpto} 
            onChange={(e) => setDpto(e.target.value)}
            style={{
              background: '#090e16',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '0.8rem',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none'
            }}>
            <option value="13">13 - AMAMBAY</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1 1 200px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Distrito
          </label>
          <select 
            value={distrito} 
            onChange={(e) => setDistrito(e.target.value)}
            style={{
              background: '#090e16',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '0.8rem',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none'
            }}>
            {distritosAmambay.map(d => (
              <option key={d.code} value={d.code}>{d.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1 1 250px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Local de Votación
          </label>
          <select 
            value={localVotacion} 
            onChange={(e) => setLocalVotacion(e.target.value)}
            style={{
              background: '#090e16',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '0.8rem',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none'
            }}>
            {localesList.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1 1 120px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Mesa Nº
          </label>
          <input 
            type="number"
            value={mesa} 
            onChange={(e) => setMesa(e.target.value)}
            min="1"
            style={{
              background: '#090e16',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '0.8rem',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1 1 250px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Cargo Plurinominal
          </label>
          <select 
            value={candidatura} 
            onChange={(e) => setCandidatura(e.target.value)}
            style={{
              background: '#090e16',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '0.8rem',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none'
            }}>
            {candidaturasPlurinominales.map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={fetchActa}
            disabled={loading || bulkLoading}
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              border: 'none',
              borderRadius: '12px',
              padding: '0.85rem 2rem',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(37,99,235,0.2)',
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1
            }}>
            {loading ? <Loader size={18} className="spin" /> : <Eye size={18} />}
            {loading ? 'Cargando...' : 'Cargar Acta'}
          </button>

          <button 
            onClick={startBulkImport}
            disabled={loading || bulkLoading}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              border: 'none',
              borderRadius: '12px',
              padding: '0.85rem 2rem',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(139,92,246,0.2)',
              transition: 'all 0.2s',
              opacity: bulkLoading ? 0.7 : 1
            }}>
            {bulkLoading ? <Loader size={18} className="spin" /> : <RefreshCw size={18} />}
            {bulkLoading ? 'Procesando...' : 'Importar Lote TSJE'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '16px',
          padding: '1rem',
          color: '#f87171',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Split View */}
      {cabecera && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr',
          gap: '2rem',
          alignItems: 'start'
        }}>
          {/* Left Panel: Image */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '24px',
            padding: '1.5rem',
            position: 'sticky',
            top: '2rem'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} style={{ color: '#3b82f6' }} /> Imagen Oficial del Acta (TSJE)
            </h3>
            {actaImage ? (
              <div style={{
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)',
                background: '#090e16',
                display: 'flex',
                justifyContent: 'center',
                maxHeight: '75vh'
              }}>
                <img 
                  src={`data:image/jpeg;base64,${actaImage}`}
                  alt="Acta Electoral"
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    objectFit: 'contain'
                  }}
                />
              </div>
            ) : (
              <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090e16', borderRadius: '16px' }}>
                <p style={{ color: '#64748b' }}>Cargando imagen...</p>
              </div>
            )}
          </div>

          {/* Right Panel: Data & Verification Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header info card */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '24px',
              padding: '1.5rem'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 0, marginBottom: '1rem' }}>
                Información de Cabecera
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
                <div><strong>Local:</strong> {cabecera.desLocal}</div>
                <div><strong>Mesa:</strong> {cabecera.numMesa}</div>
                <div><strong>Votos Blancos:</strong> {cabecera.blancos}</div>
                <div><strong>Votos Nulos:</strong> {cabecera.nulos}</div>
                <div style={{ gridColumn: 'span 2' }}>
                  <strong>Total General de la Mesa:</strong> {cabecera.totProg}
                </div>
              </div>
            </div>

            {/* Verification Form */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '24px',
              padding: '1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                  Transcripción de Votos Preferentes
                </h3>
                <button
                  onClick={saveVotes}
                  disabled={saving}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.6rem 1.5rem',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(16,185,129,0.2)'
                  }}>
                  {saving ? <Loader size={16} className="spin" /> : <Save size={16} />}
                  Guardar Votos
                </button>
              </div>

              {listsFromCandidates.map(numLista => {
                const officialDet = detalleListas.find(d => String(d.numLista) === numLista);
                const officialVotos = officialDet?.votos || 0;
                const sumCandidateVotos = getListSum(numLista);
                const isMatching = sumCandidateVotos === officialVotos;

                return (
                  <div key={numLista} style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '16px',
                    padding: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    {/* List Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      paddingBottom: '0.75rem',
                      marginBottom: '1rem'
                    }}>
                      <div>
                        <span style={{
                          background: 'var(--plra-500)',
                          color: '#fff',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          marginRight: '0.5rem'
                        }}>
                          LISTA {numLista}
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>
                          {officialDet?.desPartido || 'PARTIDO'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          Oficial TSJE: <strong>{officialVotos}</strong>
                        </span>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          background: isMatching ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          border: `1px solid ${isMatching ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                          color: isMatching ? '#34d399' : '#f87171',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}>
                          {isMatching ? <Check size={12} /> : <X size={12} />}
                          Suma Preferentes: {sumCandidateVotos}
                        </div>
                      </div>
                    </div>

                    {/* Candidates inputs list */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      {candidateVotes
                        .filter(c => c.num_lista === numLista)
                        .map(c => (
                          <div key={c.ord_candidato} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '8px',
                            padding: '0.5rem 0.75rem',
                            border: '1px solid rgba(255,255,255,0.02)'
                          }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginRight: '0.4rem' }}>
                                #{c.ord_candidato}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: '#f1f5f9' }}>
                                {c.nom_candidato}
                              </span>
                            </div>
                            <input 
                              type="number"
                              value={c.votos || ''}
                              onChange={(e) => handleVoteChange(c.num_lista, c.ord_candidato, e.target.value)}
                              min="0"
                              style={{
                                background: '#090e16',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                padding: '0.3rem 0.5rem',
                                color: '#fff',
                                width: '50px',
                                textAlign: 'center',
                                fontSize: '0.85rem'
                              }}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Bulk Import Progress Modal */}
      {showBulkModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
        }}>
          <div style={{
            width: '100%', maxWidth: '600px',
            background: '#090e16', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '24px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RefreshCw size={22} className={bulkLoading ? "spin" : ""} style={{ color: '#8b5cf6' }} /> 
                Importando Lote de Actas TSJE
              </h3>
              {!bulkLoading && (
                <button 
                  onClick={() => setShowBulkModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%',
                    padding: '0.5rem', cursor: 'pointer', display: 'flex', color: '#fff'
                  }}>
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Progress bar */}
            {bulkMesas.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#94a3b8' }}>
                  <span>Progreso: {bulkProgress} de {bulkMesas.length} mesas</span>
                  <span>{Math.round((bulkProgress / bulkMesas.length) * 100)}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${(bulkProgress / bulkMesas.length) * 100}%`,
                    height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}

            {/* Logs console */}
            <div style={{
              background: '#020617', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '16px', padding: '1rem', height: '250px', overflowY: 'auto',
              fontFamily: 'monospace', fontSize: '0.8rem', color: '#cbd5e1', display: 'flex',
              flexDirection: 'column', gap: '0.4rem'
            }}>
              {bulkLogs.map((log, idx) => (
                <div key={idx} style={{
                  whiteSpace: 'pre-wrap',
                  color: log.startsWith('✓') ? '#34d399' : log.startsWith('⚠') ? '#fbbf24' : log.startsWith('✗') ? '#f87171' : '#cbd5e1'
                }}>
                  {log}
                </div>
              ))}
            </div>

            {!bulkLoading && (
              <button
                onClick={() => setShowBulkModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px', padding: '0.8rem', color: '#fff', fontWeight: 700, cursor: 'pointer',
                  textAlign: 'center'
                }}>
                Cerrar y Ver Resultados
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
