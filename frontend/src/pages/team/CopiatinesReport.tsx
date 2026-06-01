import { useState, useCallback, useEffect } from 'react';
import { Printer, RefreshCw, Eye, EyeOff, Loader, CheckCircle } from 'lucide-react';
import api, { API_BASE, getImageUrl } from '../../services/api';

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
  list_number: string | null;
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
  const clean = ci.replace(/\D/g, '');
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return clean.slice(0, -3) + '.' + clean.slice(-3);
  if (clean.length <= 9) return clean.slice(0, -6) + '.' + clean.slice(-6, -3) + '.' + clean.slice(-3);
  return clean;
};

const resolveImageUrl = (photoUrl: string | null): string => {
  if (!photoUrl) return '';
  const full = getImageUrl(photoUrl);
  return full || '';
};

function buildPrintHTML(electors: CopiatinElector[], campaignLists: CampaignList[]): string {
  const buildCandidateRows = (lists: CampaignList[]) => {
    if (lists.length === 0) return '<div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:8px;color:#64748b;">Sin candidatos configurados</div>';
    return lists.slice(0, 4).map((list, i) => {
      const isEmphasis = i < 2;
      const candidateName = (list.candidate_nombre || list.candidate_alias || '—').toUpperCase();
      const photoUrl = resolveImageUrl(list.photo_url);
      const hasOption = list.option_number && list.option_number !== '0' && list.option_number !== list.list_number;
      const bg = isEmphasis ? 'linear-gradient(90deg,#001b50 0%,#00297a 100%)' : 'linear-gradient(90deg,#00266f 0%,#003ba8 100%)';
      const border = isEmphasis ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.15)';
      const roleColor = isEmphasis ? '#ff9e00' : '#93c5fd';

      return `<div style="display:flex;align-items:center;background:${bg};border:${border};border-radius:4px;height:0.73cm;padding:1px 3px;color:white;position:relative;flex-shrink:0;">
        ${photoUrl ? `<div style="width:0.58cm;height:0.58cm;border-radius:3px;overflow:hidden;background:#e2e8f0;border:1px solid rgba(255,255,255,0.6);margin-right:4px;flex-shrink:0;"><img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;object-position:top center;"></div>` : `<div style="width:0.58cm;height:0.58cm;border-radius:3px;background:rgba(255,255,255,0.15);margin-right:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;">👤</div>`}
        <div style="flex-grow:1;display:flex;flex-direction:column;justify-content:center;line-height:1;min-width:0;">
          <span style="font-size:6.5px;font-weight:800;color:${roleColor};text-transform:uppercase;letter-spacing:0.2px;margin-bottom:0.5px;">${list.type || 'CANDIDATO'}</span>
          <span style="font-size:9.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${candidateName}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;background:#ffffff;color:#002d84;border-radius:4px;padding:0 4px;margin-left:auto;flex-shrink:0;border:1.8px solid #ff9e00;height:0.64cm;width:2.6cm;font-style:italic;">
          ${hasOption ? `<div style="display:flex;align-items:center;justify-content:space-around;width:100%;"><div style="display:flex;flex-direction:column;align-items:center;line-height:0.8;"><span style="font-size:5px;font-weight:900;color:#002d84;">LISTA</span><span style="font-size:14px;font-weight:900;color:#002d84;margin-top:1px;">${list.list_number}</span></div><div style="width:1.2px;height:0.5cm;background:#cbd5e1;margin:0 2px;"></div><div style="display:flex;flex-direction:column;align-items:center;line-height:0.8;"><span style="font-size:5px;font-weight:900;color:#002d84;">OPCIÓN</span><span style="font-size:14px;font-weight:900;color:#002d84;margin-top:1px;">${list.option_number}</span></div></div>` : `<div style="display:flex;align-items:center;justify-content:center;gap:4px;width:100%;"><span style="font-size:9px;font-weight:900;color:#002d84;letter-spacing:-0.2px;">LISTA</span><span style="font-size:19px;font-weight:900;color:#002d84;line-height:1;">${list.list_number}</span></div>`}
        </div>
      </div>`;
    }).join('');
  };

  const cards = electors.map(e => {
    const fullName = `${e.nombre} ${e.apellido}`.trim().toUpperCase();
    const ci = formatCI(e.elector_ci);
    const ciudad = (e.ciudad || '').toUpperCase();
    const local = (e.local_votacion || '—').toUpperCase();
    const campaign = (e.campaign_name || '').toUpperCase();

    return `<div style="width:9cm;height:5cm;background:#ffffff;border:0.3px dashed rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;padding:0.1cm 0.15cm;color:#000;font-family:'Montserrat',sans-serif;box-sizing:border-box;page-break-inside:avoid;">
      <div style="display:flex;flex-direction:column;height:1.38cm;border-bottom:2.2px solid #002d84;padding-bottom:2px;margin-bottom:3.5px;justify-content:space-between;">
        <div style="display:flex;justify-content:space-between;width:100%;height:1.0cm;">
          <div style="width:60%;display:flex;flex-direction:column;justify-content:flex-start;">
            <div style="font-size:6.5px;font-weight:900;color:#64748b;letter-spacing:0.5px;line-height:1;">ELECTOR REGISTRADO</div>
            <div style="font-size:10.5px;font-weight:900;color:#0f172a;line-height:1.1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin-top:1px;">${fullName}</div>
            <div style="font-size:8px;font-weight:700;color:#1e293b;margin-top:1px;">C.I. <span style="color:#64748b;font-weight:500;">N°</span> <strong>${ci}</strong></div>
          </div>
          <div style="width:40%;display:flex;flex-direction:column;justify-content:flex-start;align-items:flex-end;padding-left:2px;text-align:right;">
            <div style="font-size:8px;font-weight:900;color:#002d84;letter-spacing:0.5px;">${campaign}</div>
            <div style="font-size:7.5px;font-weight:900;color:#002d84;text-transform:uppercase;margin-top:0.5px;line-height:1;">${ciudad}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;width:100%;font-size:8px;line-height:1;height:0.38cm;border-top:1px dashed #cbd5e1;padding-top:1px;">
          <div style="display:flex;align-items:center;margin-right:8px;"><label style="color:#64748b;font-weight:700;font-size:7.5px;">MESA:</label><span style="font-size:8.5px;font-weight:900;color:#000;margin-left:2px;">${e.mesa || '—'}</span></div>
          <div style="display:flex;align-items:center;margin-right:8px;"><label style="color:#64748b;font-weight:700;font-size:7.5px;">ORDEN:</label><span style="font-size:8.5px;font-weight:900;color:#000;margin-left:2px;">${e.orden || '—'}</span></div>
          <div style="flex-grow:1;min-width:0;margin-left:4px;display:flex;align-items:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            <label style="color:#64748b;font-weight:700;font-size:7.5px;margin-right:2px;">LOCAL:</label>
            <span style="font-size:7.5px;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;">${local}</span>
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px;flex-grow:1;">
        ${buildCandidateRows(campaignLists)}
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Copiatines Electorales</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Montserrat', sans-serif; background: white; }
    .grid { display: grid; grid-template-columns: 9cm 9cm; justify-content: center; gap: 0; width: 210mm; }
  </style>
</head>
<body>
  <div class="grid">${cards}</div>
  <script>
    document.fonts.ready.then(function() { window.print(); });
  </script>
</body>
</html>`;
}

const selStyle: React.CSSProperties = {
  padding: '0.55rem 0.75rem', borderRadius: '10px',
  background: 'var(--input-bg)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: '0.8rem', outline: 'none', cursor: 'pointer',
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

  const handlePrint = async () => {
    if (!data || data.electors.length === 0) return;
    const ids = data.electors.map(e => e.capture_id);
    const html = buildPrintHTML(data.electors, data.campaignLists);
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onafterprint = async () => {
      printWindow.close();
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

  const labelStyle: React.CSSProperties = {
    fontSize: '0.62rem', fontWeight: 900, color: 'var(--text-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem', display: 'block',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Controls */}
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
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <label style={labelStyle}>Estado</label>
          <button
            onClick={() => setOnlyUnprinted(v => !v)}
            style={{
              ...selStyle,
              background: onlyUnprinted ? 'rgba(251,191,36,0.12)' : 'var(--input-bg)',
              border: `1px solid ${onlyUnprinted ? 'rgba(251,191,36,0.4)' : 'var(--border)'}`,
              color: onlyUnprinted ? '#fbbf24' : 'var(--text-3)',
              display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700,
            }}
          >
            {onlyUnprinted ? <EyeOff size={14} /> : <Eye size={14} />}
            {onlyUnprinted ? 'Solo no impresos' : 'Todos'}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <label style={{ ...labelStyle, opacity: 0 }}>Acción</label>
          <button
            onClick={load}
            disabled={loading}
            style={{ ...selStyle, display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }}
          >
            {loading ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />}
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats + Print */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text)' }}>{total}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Total</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10B981' }}>{printed}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Impresos</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fbbf24' }}>{unprinted}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Pendientes</div>
          </div>
        </div>

        <button
          onClick={handlePrint}
          disabled={loading || marking || total === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: (loading || marking || total === 0) ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#002d84,#0056b3)',
            border: 'none', borderRadius: '12px', color: 'white',
            padding: '0.75rem 1.5rem', fontSize: '0.88rem', fontWeight: 900, cursor: loading || marking || total === 0 ? 'not-allowed' : 'pointer',
            boxShadow: (loading || marking || total === 0) ? 'none' : '0 6px 20px rgba(0,45,132,0.4)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { if (!loading && !marking && total > 0) e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          {marking ? <><Loader size={16} className="spin" /> Marcando...</> : <><Printer size={16} /> Imprimir y Marcar ({total})</>}
        </button>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', color: '#EF4444', fontSize: '0.82rem', fontWeight: 700 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)' }}>
          <Loader size={28} className="spin" style={{ display: 'block', margin: '0 auto 1rem', color: '#002d84' }} />
          Cargando copiatines...
        </div>
      )}

      {/* Preview grid */}
      {!loading && data && data.electors.length === 0 && (
        <div style={{ padding: '3rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '16px', color: 'var(--text-3)' }}>
          <CheckCircle size={32} style={{ margin: '0 auto 1rem', display: 'block', color: '#10B981' }} />
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
            {onlyUnprinted ? 'Todos los copiatines ya fueron impresos.' : 'No hay electores registrados con los filtros seleccionados.'}
          </div>
        </div>
      )}

      {!loading && data && data.electors.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem' }}>
          {data.electors.map(e => (
            <div key={e.capture_id} style={{
              background: 'white', borderRadius: '6px', overflow: 'hidden',
              border: e.copiatin_printed_at ? '2px solid rgba(16,185,129,0.5)' : '1px solid #e2e8f0',
              opacity: e.copiatin_printed_at ? 0.6 : 1,
              position: 'relative', fontSize: '11px', color: '#0f172a',
              fontFamily: 'system-ui, sans-serif',
            }}>
              {e.copiatin_printed_at && (
                <div style={{
                  position: 'absolute', top: 4, right: 4, background: '#10B981',
                  borderRadius: '4px', padding: '2px 5px', fontSize: '9px', color: 'white', fontWeight: 900, zIndex: 1,
                }}>✓ IMPRESO</div>
              )}
              <div style={{ background: '#f8fafc', borderBottom: '1.5px solid #002d84', padding: '6px 8px 4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 900, color: '#64748b', letterSpacing: '0.5px' }}>ELECTOR REGISTRADO</div>
                    <div style={{ fontWeight: 900, fontSize: '13px', lineHeight: 1.1, color: '#0f172a' }}>
                      {e.nombre} {e.apellido}
                    </div>
                    <div style={{ fontSize: '10px', color: '#334155', fontWeight: 700 }}>
                      C.I. {formatCI(e.elector_ci)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '9px', fontWeight: 900, color: '#002d84' }}>
                    <div>{(e.campaign_name || '').toUpperCase()}</div>
                    <div style={{ fontSize: '8px', marginTop: 2 }}>{(e.ciudad || '').toUpperCase()}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '9px', borderTop: '1px dashed #cbd5e1', paddingTop: '3px' }}>
                  <span><b>Mesa:</b> {e.mesa || '—'}</span>
                  <span><b>Orden:</b> {e.orden || '—'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    <b>Local:</b> {(e.local_votacion || '—').toUpperCase()}
                  </span>
                </div>
              </div>
              <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {data.campaignLists.slice(0, 3).map((list, i) => (
                  <div key={list.id} style={{
                    display: 'flex', alignItems: 'center',
                    background: i < 2 ? 'linear-gradient(90deg,#001b50,#00297a)' : 'linear-gradient(90deg,#00266f,#003ba8)',
                    borderRadius: '3px', padding: '2px 4px', gap: '4px', color: 'white',
                  }}>
                    {list.photo_url && (
                      <img src={getImageUrl(list.photo_url) || ''} alt="" style={{ width: 16, height: 16, borderRadius: 2, objectFit: 'cover' }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '7px', fontWeight: 800, color: i < 2 ? '#ff9e00' : '#93c5fd', textTransform: 'uppercase' }}>{list.type}</div>
                      <div style={{ fontSize: '8px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(list.candidate_nombre || list.candidate_alias || '—').toUpperCase()}
                      </div>
                    </div>
                    <div style={{ background: 'white', borderRadius: 3, padding: '1px 5px', color: '#002d84', fontWeight: 900, fontSize: '11px', border: '1px solid #ff9e00', fontStyle: 'italic' }}>
                      {list.option_number && list.option_number !== '0' && list.option_number !== list.list_number
                        ? `${list.list_number}/${list.option_number}`
                        : list.list_number}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontStyle: 'italic', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
        Al imprimir, se abre una ventana con el diseño real (9cm × 5cm, 10 por hoja A4). Los copiatines se marcan como impresos automáticamente al cerrar la ventana de impresión.
      </div>
    </div>
  );
};

export default CopiatinesReport;
