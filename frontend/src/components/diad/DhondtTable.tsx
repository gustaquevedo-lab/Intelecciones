import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { dhondt } from '../../utils/dhondt';
import type { TsjeListaResult, TsjePrefResult } from '../../services/tsjeService';

const TOP_PREF = 20;

interface Props {
  codCargo: number;
  listas: TsjeListaResult[];
  preferentes: TsjePrefResult[];
  totalVotos: number;
  bancas: number;
  onBancasChange: (v: number) => void;
}

const TH: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' }> = ({ children, align = 'left' }) => (
  <th style={{
    textAlign: align, padding: '0.4rem 0.6rem',
    color: 'var(--text-3)', fontWeight: 700,
    fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em',
  }}>{children}</th>
);

const TD: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <td style={{ padding: '0.45rem 0.6rem', ...style }}>{children}</td>
);

const CARGOS_SIN_PREF = [6, 7, 11, 12];

const DhondtTable: React.FC<Props> = ({ codCargo, listas, preferentes, totalVotos, bancas, onBancasChange }) => {
  const [showAllPref, setShowAllPref] = useState(false);

  const sortedListas = useMemo(() => [...listas].sort((a, b) => b.votos - a.votos), [listas]);

  const dhondtResults = useMemo(() => {
    const input = listas.map(l => ({ num_lista: l.num_lista, votos: l.votos }));
    return dhondt(input, bancas);
  }, [listas, bancas]);

  const bancasMap = useMemo(() => {
    const m: Record<string, number> = {};
    dhondtResults.forEach(r => { m[r.num_lista] = r.bancas; });
    return m;
  }, [dhondtResults]);

  const totalBancas = dhondtResults.reduce((s, r) => s + r.bancas, 0);

  const hasPref = !CARGOS_SIN_PREF.includes(codCargo) && preferentes.length > 0;
  const sortedPref = useMemo(() => [...preferentes].sort((a, b) => b.votos - a.votos), [preferentes]);
  const visiblePref = showAllPref ? sortedPref : sortedPref.slice(0, TOP_PREF);

  const handleBancasInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (!Number.isFinite(v)) return;
    onBancasChange(Math.max(0, Math.min(100, v)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* b.1 Votos por lista */}
      <div>
        <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
          Votos por lista
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <TH>Lista</TH>
                <TH>Movimiento</TH>
                <TH align="right">Votos</TH>
                <TH align="right">%</TH>
              </tr>
            </thead>
            <tbody>
              {sortedListas.map(l => {
                const pct = totalVotos > 0 ? ((l.votos / totalVotos) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={l.num_lista} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <TD>
                      <span style={{
                        display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '6px',
                        background: 'rgba(255,255,255,0.07)', fontWeight: 800, color: 'var(--text)',
                      }}>{l.num_lista}</span>
                    </TD>
                    <TD style={{ color: 'var(--text)', fontWeight: 600 }}>{l.des_partido || l.sig_partido || '—'}</TD>
                    <TD style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text)', fontFamily: 'Space Grotesk, monospace' }}>
                      {l.votos.toLocaleString('es-PY')}
                    </TD>
                    <TD style={{ textAlign: 'right', color: 'var(--text-2)', fontWeight: 700 }}>{pct}%</TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* b.2 D'Hondt simulator */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Simulador D'Hondt
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700 }}>Bancas:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <button
                onClick={() => onBancasChange(Math.max(0, bancas - 1))}
                style={{ padding: '0.2rem 0.4rem', borderRadius: '4px 0 0 4px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '0.7rem' }}
              ><ChevronDown size={10} /></button>
              <input
                type="number" min={0} max={100} value={bancas}
                onChange={handleBancasInput}
                style={{
                  width: '52px', textAlign: 'center', padding: '0.2rem 0.4rem',
                  border: '1px solid var(--border)', borderLeft: 'none', borderRight: 'none',
                  background: 'rgba(255,255,255,0.06)', color: 'var(--text)',
                  fontSize: '0.8rem', fontWeight: 800, fontFamily: 'Space Grotesk, monospace',
                }}
              />
              <button
                onClick={() => onBancasChange(Math.min(100, bancas + 1))}
                style={{ padding: '0.2rem 0.4rem', borderRadius: '0 4px 4px 0', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '0.7rem' }}
              ><ChevronUp size={10} /></button>
            </div>
          </div>
        </div>

        {bancas === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>0 bancas asignadas.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <TH>Lista</TH>
                  <TH>Movimiento</TH>
                  <TH align="right">Votos</TH>
                  <TH align="right">Bancas</TH>
                  <TH align="right">% bancas</TH>
                </tr>
              </thead>
              <tbody>
                {sortedListas.map(l => {
                  const b = bancasMap[l.num_lista] ?? 0;
                  const pctB = totalBancas > 0 ? ((b / totalBancas) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={l.num_lista} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <TD>
                        <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.07)', fontWeight: 800, color: 'var(--text)' }}>{l.num_lista}</span>
                      </TD>
                      <TD style={{ color: 'var(--text)', fontWeight: 600 }}>{l.des_partido || l.sig_partido || '—'}</TD>
                      <TD style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-2)', fontFamily: 'Space Grotesk, monospace' }}>
                        {l.votos.toLocaleString('es-PY')}
                      </TD>
                      <TD style={{ textAlign: 'right', fontWeight: 800, color: b > 0 ? '#2E84F0' : 'var(--text-3)', fontFamily: 'Space Grotesk, monospace' }}>
                        {b}
                      </TD>
                      <TD style={{ textAlign: 'right', color: 'var(--text-2)', fontWeight: 700 }}>{pctB}%</TD>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '2px solid var(--border)' }}>
                  <TD style={{ fontWeight: 800, color: 'var(--text)', fontSize: '0.7rem' }} colSpan={3 as any}>Total bancas</TD>
                  <TD style={{ textAlign: 'right', fontWeight: 800, color: '#2E84F0', fontFamily: 'Space Grotesk, monospace' }}>{totalBancas}</TD>
                  <TD />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* b.3 Preferentes */}
      {CARGOS_SIN_PREF.includes(codCargo) ? (
        <p style={{ color: 'var(--text-3)', fontSize: '0.7rem', fontStyle: 'italic' }}>
          Voto preferente disponible en V2 (decodificacion QR)
        </p>
      ) : hasPref ? (
        <div>
          <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            Top candidatos por voto preferente
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <TH>Pos.</TH>
                  <TH>Lista</TH>
                  <TH>Candidato</TH>
                  <TH align="right">Votos pref.</TH>
                </tr>
              </thead>
              <tbody>
                {visiblePref.map((p, i) => (
                  <tr key={`${p.num_lista}-${p.ord_candidato}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <TD style={{ color: 'var(--text-3)', fontWeight: 700 }}>{i + 1}</TD>
                    <TD>
                      <span style={{ display: 'inline-block', padding: '0.15rem 0.4rem', borderRadius: '6px', background: 'rgba(255,255,255,0.07)', fontWeight: 800, color: 'var(--text)', fontSize: '0.7rem' }}>{p.num_lista}</span>
                    </TD>
                    <TD style={{ color: 'var(--text)', fontWeight: 600 }}>{p.nom_candidato}</TD>
                    <TD style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text)', fontFamily: 'Space Grotesk, monospace' }}>
                      {p.votos.toLocaleString('es-PY')}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedPref.length > TOP_PREF && (
            <button
              onClick={() => setShowAllPref(v => !v)}
              style={{
                marginTop: '0.5rem', padding: '0.3rem 0.75rem', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-3)', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}
            >
              {showAllPref ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showAllPref ? 'Ver menos' : `Ver todos (${sortedPref.length})`}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default DhondtTable;
