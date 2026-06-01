import { useState, useCallback, useEffect } from 'react';
import { Printer, RefreshCw, Eye, EyeOff, Loader, CheckCircle } from 'lucide-react';
import api, { getImageUrl } from '../../services/api';

interface CopiatinElector {
  capture_id: number;
  elector_ci: string;
  nombre: string;
  apellido: string;
  local_votacion: string;
  mesa: number;
  orden: number;
  ciudad: string;
  coordinator_name: string;
  padrino_name: string | null;
  campaign_name: string | null;
  copiatin_printed_at: string | null;
}

interface CampaignList {
  id: number;
  type: string;
  list_number: string;
  option_number: string | null;
  candidate_nombre: string | null;
  candidate_alias: string | null;
  photo_url: string | null;
}

interface CopiatinesData {
  electors: CopiatinElector[];
  campaignLists: CampaignList[];
  filterPadrinos: { id: number; nombre: string }[];
  filterCoordinators: { id: number; nombre: string; parent_id: number }[];
}

const formatCI = (ci: string) => {
  if (!ci) return '';
  const c = ci.replace(/\D/g, '');
  if (c.length <= 3) return c;
  if (c.length <= 6) return c.slice(0, -3) + '.' + c.slice(-3);
  if (c.length <= 9) return c.slice(0, -6) + '.' + c.slice(-6, -3) + '.' + c.slice(-3);
  return c;
};

// ─── CSS exacto del modelo (scratch/copiatin_diseno.html) ─────────────────────
const CARD_CSS = `
  :root {
    --primary-blue: #002d84;
    --light-blue: #0056b3;
    --accent-yellow: #ff9e00;
    --accent-orange: #f26200;
  }
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Montserrat', sans-serif; background: white; }

  .print-grid {
    display: grid;
    grid-template-columns: 9cm 9cm;
    justify-content: center;
    gap: 0;
  }

  .copiatin-card {
    width: 9cm;
    height: 5cm;
    background-color: #ffffff;
    border: 0.5px dashed #94a3b8;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 0.1cm 0.15cm;
    color: #000000;
    font-family: 'Montserrat', sans-serif;
    page-break-inside: avoid;
  }

  .top-band-new {
    display: flex;
    flex-direction: column;
    height: 1.38cm;
    border-bottom: 2.2px solid var(--primary-blue);
    padding-bottom: 2px;
    margin-bottom: 3.5px;
    justify-content: space-between;
  }
  .top-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    height: 1.0cm;
  }
  .bottom-row {
    display: flex;
    align-items: center;
    width: 100%;
    font-size: 8px;
    line-height: 1;
    height: 0.38cm;
    border-top: 1px dashed #cbd5e1;
    padding-top: 1px;
  }
  .elector-main {
    width: 60%;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
  .elector-header {
    font-size: 6.5px;
    font-weight: 900;
    color: #64748b;
    letter-spacing: 0.5px;
    line-height: 1;
  }
  .elector-name {
    font-size: 10.5px;
    font-weight: 900;
    color: #0f172a;
    line-height: 1.1;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-top: 1px;
  }
  .elector-ci {
    font-size: 8px;
    font-weight: 700;
    color: #1e293b;
    margin-top: 1px;
  }
  .elector-ci span { color: #64748b; font-weight: 500; }
  .elector-footer-item {
    display: flex;
    align-items: center;
    margin-right: 8px;
  }
  .elector-footer-item span { font-size: 8.5px; font-weight: 900; color: #000; margin-left: 2px; }
  .elector-footer-item label { color: #64748b; font-weight: 700; font-size: 7.5px; }

  .campaign-main {
    width: 40%;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-end;
    padding-left: 2px;
    text-align: right;
  }
  .campaign-logos { display: flex; align-items: center; gap: 4px; line-height: 1; }
  .logo-img { width: 28px; height: 28px; object-fit: contain; }
  .campaign-brand { display: flex; flex-direction: column; align-items: flex-end; }
  .campaign-brand .brand-plra {
    font-family: 'Outfit', sans-serif;
    font-size: 8px; font-weight: 900;
    color: var(--primary-blue); letter-spacing: 0.5px;
  }
  .campaign-brand .brand-mov {
    font-size: 4px; font-weight: 800;
    color: var(--accent-orange); text-transform: uppercase;
  }
  .city-label {
    font-size: 7.5px; font-weight: 900;
    color: var(--primary-blue); text-transform: uppercase;
    margin-top: 0.5px; line-height: 1;
  }
  .local-info-inline {
    flex-grow: 1; min-width: 0;
    margin-left: 12px;
    display: flex; align-items: center;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .local-info-inline label { color: #64748b; font-weight: 700; margin-right: 2px; font-size: 7.5px; }
  .local-info-inline span { font-size: 9px; font-weight: 900; color: #0f172a; }

  .candidates-list { display: flex; flex-direction: column; gap: 2px; flex-grow: 1; }

  .candidate-card {
    display: flex; align-items: center;
    background: linear-gradient(90deg, #00266f 0%, #003ba8 100%);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 4px;
    height: 0.73cm;
    padding: 1px 3px;
    color: white;
    position: relative;
  }
  .candidate-card.emphasis {
    background: linear-gradient(90deg, #001b50 0%, #00297a 100%);
    border: 1px solid #3b82f6;
  }
  .candidate-photo-frame {
    width: 0.58cm; height: 0.58cm;
    border-radius: 3px; overflow: hidden;
    background: #e2e8f0;
    border: 1px solid rgba(255,255,255,0.6);
    margin-right: 4px; flex-shrink: 0;
  }
  .candidate-photo-frame img {
    width: 100%; height: 100%;
    object-fit: cover; object-position: top center;
  }
  .candidate-info {
    flex-grow: 1; display: flex; flex-direction: column;
    justify-content: center; line-height: 1; min-width: 0;
  }
  .candidate-role {
    font-size: 6.5px; font-weight: 800; color: #93c5fd;
    text-transform: uppercase; letter-spacing: 0.2px; margin-bottom: 0.5px;
  }
  .candidate-card.emphasis .candidate-role { color: var(--accent-yellow); }
  .candidate-name {
    font-size: 9.5px; font-weight: 800;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .badge-container {
    display: flex; align-items: center; justify-content: center;
    background: #ffffff; color: #002d84;
    border-radius: 4px; padding: 0 4px;
    margin-left: auto; flex-shrink: 0;
    border: 1.8px solid var(--accent-yellow);
    height: 0.64cm; width: 2.6cm;
    font-style: italic;
  }
  .badge-single { display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%; }
  .badge-single .label-main { font-size: 9px; font-weight: 900; color: var(--primary-blue); letter-spacing: -0.2px; }
  .badge-single .val-huge { font-size: 19px; font-weight: 900; color: var(--primary-blue); line-height: 1; }
  .badge-double { display: flex; align-items: center; justify-content: space-around; width: 100%; }
  .badge-col { display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 0.8; }
  .badge-col .label-sub { font-size: 5px; font-weight: 900; color: var(--primary-blue); letter-spacing: -0.1px; }
  .badge-col .val-large { font-size: 14px; font-weight: 900; color: var(--primary-blue); margin-top: 1px; }
  .badge-divider { width: 1.2px; height: 0.5cm; background-color: #cbd5e1; margin: 0 2px; }
`;

function buildPrintHTML(
  electors: CopiatinElector[],
  campaignLists: CampaignList[],
  logoUrl: string
): string {
  const buildBadge = (list: CampaignList) => {
    const hasOption = list.option_number && list.option_number !== '0';
    if (hasOption) {
      return `<div class="badge-double">
        <div class="badge-col"><span class="label-sub">LISTA</span><span class="val-large">${list.list_number || '—'}</span></div>
        <div class="badge-divider"></div>
        <div class="badge-col"><span class="label-sub">OPCIÓN</span><span class="val-large">${list.option_number}</span></div>
      </div>`;
    }
    return `<div class="badge-single">
      <span class="label-main">LISTA</span>
      <span class="val-huge">${list.list_number || '—'}</span>
    </div>`;
  };

  const buildCandidateRows = (lists: CampaignList[]) => lists.slice(0, 4).map((list, i) => {
    const isEmphasis = i < 2;
    const name = (list.candidate_nombre || list.candidate_alias || '—').toUpperCase();
    const photoUrl = list.photo_url ? (getImageUrl(list.photo_url) || '') : '';
    const photoHtml = photoUrl
      ? `<div class="candidate-photo-frame"><img src="${photoUrl}" alt="${name}"></div>`
      : `<div class="candidate-photo-frame" style="display:flex;align-items:center;justify-content:center;font-size:12px;color:rgba(255,255,255,0.4);">?</div>`;

    return `<div class="candidate-card${isEmphasis ? ' emphasis' : ''}">
      ${photoHtml}
      <div class="candidate-info">
        <span class="candidate-role">${(list.type || 'CANDIDATO').toUpperCase()}</span>
        <span class="candidate-name">${name}</span>
      </div>
      <div class="badge-container">${buildBadge(list)}</div>
    </div>`;
  }).join('');

  const buildCard = (e: CopiatinElector) => {
    const fullName = `${e.nombre} ${e.apellido}`.trim().toUpperCase();
    const ci = formatCI(e.elector_ci);
    const ciudad = (e.ciudad || '').toUpperCase();
    const local = (e.local_votacion || '—').toUpperCase();
    const campaign = (e.campaign_name || 'CAMPAÑA').toUpperCase();
    const candidateRows = buildCandidateRows(campaignLists);

    return `<div class="copiatin-card">
      <div class="top-band-new">
        <div class="top-row">
          <div class="elector-main">
            <div class="elector-header">ELECTOR REGISTRADO</div>
            <div class="elector-name">${fullName}</div>
            <div class="elector-ci">C.I. <span>N°</span> <strong>${ci}</strong></div>
          </div>
          <div class="campaign-main">
            <div class="campaign-logos">
              ${logoUrl ? `<img class="logo-img" src="${logoUrl}" alt="Logo">` : ''}
              <div class="campaign-brand">
                <span class="brand-plra">${campaign}</span>
              </div>
            </div>
            <div class="city-label">${ciudad}</div>
          </div>
        </div>
        <div class="bottom-row">
          <div class="elector-footer-item"><label>MESA:</label> <span>${e.mesa || '—'}</span></div>
          <div class="elector-footer-item"><label>ORDEN:</label> <span>${e.orden || '—'}</span></div>
          <div class="local-info-inline">
            <label>LOCAL:</label> <span>${local}</span>
          </div>
        </div>
      </div>
      <div class="candidates-list">${candidateRows}</div>
    </div>`;
  };

  const cards = electors.map(buildCard).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Copiatines Electorales</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Outfit:wght@500;600;700;800;900&display=swap" rel="stylesheet">
  <style>${CARD_CSS}</style>
</head>
<body>
  <div class="print-grid">${cards}</div>
  <script>
    document.fonts.ready.then(function() { window.print(); });
  </script>
</body>
</html>`;
}

// ─── Versión pantalla del copiatín (usa las mismas clases CSS) ────────────────
const SCREEN_CARD_STYLE = `
  .sc-grid { display:flex; flex-wrap:wrap; gap:16px; }
  ${CARD_CSS.replace(/@page[^}]+}/g, '').replace(/body[^}]+}/g, '')}
  .copiatin-card { box-shadow: 0 8px 24px rgba(0,0,0,0.25); border-color: #cbd5e1; }
  .copiatin-card.printed { opacity: 0.5; }
  .printed-badge {
    position: absolute; top: 3px; right: 3px; z-index: 10;
    background: #10b981; color: white; font-size: 6px; font-weight: 900;
    border-radius: 3px; padding: 1px 4px; letter-spacing: 0.5px;
  }
`;

const selStyle: React.CSSProperties = {
  padding: '0.55rem 0.75rem', borderRadius: '10px',
  background: 'var(--input-bg)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', width: '100%',
};
const labelStyle: React.CSSProperties = {
  fontSize: '0.62rem', fontWeight: 900, color: 'var(--text-3)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem', display: 'block',
};

const CopiatinesReport = () => {
  const [data, setData] = useState<CopiatinesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [padrinoFilter, setPadrinoFilter] = useState('ALL');
  const [coordinatorFilter, setCoordinatorFilter] = useState('ALL');
  const [onlyUnprinted, setOnlyUnprinted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (padrinoFilter !== 'ALL') params.set('padrino_id', padrinoFilter);
      if (coordinatorFilter !== 'ALL') params.set('coordinator_id', coordinatorFilter);
      if (onlyUnprinted) params.set('only_unprinted', '1');
      const res = await api.get(`/my-team/copiatines?${params.toString()}`);
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error al cargar copiatines');
    } finally {
      setLoading(false);
    }
  }, [padrinoFilter, coordinatorFilter, onlyUnprinted]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => {
    if (!data || data.electors.length === 0) return;
    const ids = data.electors.map(e => e.capture_id);
    const logoUrl = window.location.origin + '/favicon.svg';
    const html = buildPrintHTML(data.electors, data.campaignLists, logoUrl);
    const pw = window.open('', '_blank', 'width=900,height=700');
    if (!pw) return;
    pw.document.write(html);
    pw.document.close();
    pw.onafterprint = async () => {
      pw.close();
      setMarking(true);
      try {
        await api.post('/my-team/copiatines/mark-printed', { capture_ids: ids });
        load();
      } catch {}
      setMarking(false);
    };
  };

  const printed = data?.electors.filter(e => e.copiatin_printed_at).length ?? 0;
  const total = data?.electors.length ?? 0;
  const unprinted = total - printed;

  const filteredCoordinators = data?.filterCoordinators.filter(c =>
    padrinoFilter === 'ALL' || String(c.parent_id) === padrinoFilter
  ) ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Inyectar CSS del modelo para la vista en pantalla */}
      <style>{SCREEN_CARD_STYLE}</style>

      {/* Controles */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem',
        padding: '1.25rem', background: 'var(--surface-hover)', borderRadius: '16px',
        border: '1px solid var(--border)',
      }}>
        {(data?.filterPadrinos?.length ?? 0) > 0 && (
          <div>
            <label style={labelStyle}>Padrino</label>
            <select value={padrinoFilter} onChange={e => { setPadrinoFilter(e.target.value); setCoordinatorFilter('ALL'); }} style={selStyle}>
              <option value="ALL">Todos ({data?.filterPadrinos.length})</option>
              {data?.filterPadrinos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        )}
        <div>
          <label style={labelStyle}>Coordinador</label>
          <select value={coordinatorFilter} onChange={e => setCoordinatorFilter(e.target.value)} style={selStyle}>
            <option value="ALL">Todos ({filteredCoordinators.length})</option>
            {filteredCoordinators.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Estado</label>
          <button
            onClick={() => setOnlyUnprinted(v => !v)}
            style={{ ...selStyle, background: onlyUnprinted ? 'rgba(251,191,36,0.12)' : 'var(--input-bg)', border: `1px solid ${onlyUnprinted ? 'rgba(251,191,36,0.4)' : 'var(--border)'}`, color: onlyUnprinted ? '#fbbf24' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
          >
            {onlyUnprinted ? <EyeOff size={14} /> : <Eye size={14} />}
            {onlyUnprinted ? 'Solo pendientes' : 'Todos'}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <label style={{ ...labelStyle, opacity: 0 }}>_</label>
          <button onClick={load} disabled={loading} style={{ ...selStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 700, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }}>
            {loading ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />} Actualizar
          </button>
        </div>
      </div>

      {/* Stats + botón imprimir */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '2rem' }}>
          {[{ label: 'Total', val: total, color: 'var(--text)' }, { label: 'Impresos', val: printed, color: '#10B981' }, { label: 'Pendientes', val: unprinted, color: '#fbbf24' }].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <button
          onClick={handlePrint}
          disabled={loading || marking || total === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: (loading || marking || total === 0) ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#002d84,#0056b3)',
            border: 'none', borderRadius: '12px', color: 'white',
            padding: '0.75rem 1.5rem', fontSize: '0.88rem', fontWeight: 900,
            cursor: total === 0 ? 'not-allowed' : 'pointer',
            boxShadow: total === 0 ? 'none' : '0 6px 20px rgba(0,45,132,0.4)',
          }}
        >
          {marking ? <><Loader size={16} className="spin" /> Marcando...</> : <><Printer size={16} /> Imprimir y Marcar ({total})</>}
        </button>
      </div>

      {error && <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', color: '#EF4444', fontSize: '0.82rem', fontWeight: 700 }}>{error}</div>}

      {loading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)' }}>
          <Loader size={28} className="spin" style={{ display: 'block', margin: '0 auto 1rem', color: '#002d84' }} />
          Cargando copiatines...
        </div>
      )}

      {/* Vista previa con diseño real */}
      {!loading && data && data.electors.length === 0 && (
        <div style={{ padding: '3rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '16px', color: 'var(--text-3)' }}>
          <CheckCircle size={32} style={{ margin: '0 auto 1rem', display: 'block', color: '#10b981' }} />
          <div style={{ fontWeight: 700 }}>
            {onlyUnprinted ? 'Todos los copiatines ya fueron impresos.' : 'Sin electores con los filtros seleccionados.'}
          </div>
        </div>
      )}

      {!loading && data && data.electors.length > 0 && (
        <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
          <div className="sc-grid">
            {data.electors.map(e => {
              const logoUrl = window.location.origin + '/favicon.svg';
              return (
                <div key={e.capture_id} className={`copiatin-card${e.copiatin_printed_at ? ' printed' : ''}`}>
                  {e.copiatin_printed_at && <div className="printed-badge">✓ IMPRESO</div>}
                  <div className="top-band-new">
                    <div className="top-row">
                      <div className="elector-main">
                        <div className="elector-header">ELECTOR REGISTRADO</div>
                        <div className="elector-name">{`${e.nombre} ${e.apellido}`.toUpperCase()}</div>
                        <div className="elector-ci">C.I. <span>N°</span> <strong>{formatCI(e.elector_ci)}</strong></div>
                      </div>
                      <div className="campaign-main">
                        <div className="campaign-logos">
                          <img className="logo-img" src={logoUrl} alt="Logo" onError={ev => (ev.currentTarget.style.display = 'none')} />
                          <div className="campaign-brand">
                            <span className="brand-plra">{(e.campaign_name || 'CAMPAÑA').toUpperCase()}</span>
                          </div>
                        </div>
                        <div className="city-label">{(e.ciudad || '').toUpperCase()}</div>
                      </div>
                    </div>
                    <div className="bottom-row">
                      <div className="elector-footer-item"><label>MESA:</label> <span>{e.mesa || '—'}</span></div>
                      <div className="elector-footer-item"><label>ORDEN:</label> <span>{e.orden || '—'}</span></div>
                      <div className="local-info-inline">
                        <label>LOCAL:</label> <span>{(e.local_votacion || '—').toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="candidates-list">
                    {data.campaignLists.slice(0, 4).map((list, i) => {
                      const isEmphasis = i < 2;
                      const name = (list.candidate_nombre || list.candidate_alias || '—').toUpperCase();
                      const photoUrl = list.photo_url ? getImageUrl(list.photo_url) : null;
                      const hasOption = list.option_number && list.option_number !== '0';
                      return (
                        <div key={list.id} className={`candidate-card${isEmphasis ? ' emphasis' : ''}`}>
                          <div className="candidate-photo-frame">
                            {photoUrl
                              ? <img src={photoUrl} alt={name} />
                              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>?</div>
                            }
                          </div>
                          <div className="candidate-info">
                            <span className="candidate-role">{(list.type || 'CANDIDATO').toUpperCase()}</span>
                            <span className="candidate-name">{name}</span>
                          </div>
                          <div className="badge-container">
                            {hasOption
                              ? <div className="badge-double">
                                  <div className="badge-col"><span className="label-sub">LISTA</span><span className="val-large">{list.list_number}</span></div>
                                  <div className="badge-divider" />
                                  <div className="badge-col"><span className="label-sub">OPCIÓN</span><span className="val-large">{list.option_number}</span></div>
                                </div>
                              : <div className="badge-single">
                                  <span className="label-main">LISTA</span>
                                  <span className="val-huge">{list.list_number || '—'}</span>
                                </div>
                            }
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontStyle: 'italic', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
        Imprime 10 copiatines por hoja A4 (2 columnas × 5 filas, 9×5cm c/u). Los copiatines se marcan automáticamente al cerrar la ventana de impresión.
      </div>
    </div>
  );
};

export default CopiatinesReport;
