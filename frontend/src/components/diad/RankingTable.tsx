import React from 'react';
import type { TsjeListaResult } from '../../services/tsjeService';

interface Props {
  listas: TsjeListaResult[];
  totalVotos: number;
}

const RankingTable: React.FC<Props> = ({ listas, totalVotos }) => {
  const sorted = [...listas].sort((a, b) => b.votos - a.votos);

  if (sorted.length === 0) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: '0.75rem', padding: '0.75rem 0' }}>
        Sin candidatos publicados.
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Pos.', 'Lista', 'Movimiento', 'Votos', '%'].map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '0.4rem 0.6rem',
                color: 'var(--text-3)', fontWeight: 700,
                fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((l, i) => {
            const pct = totalVotos > 0 ? ((l.votos / totalVotos) * 100).toFixed(1) : '0.0';
            const isWinner = i === 0;
            return (
              <tr key={l.num_lista} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.45rem 0.6rem', color: 'var(--text-3)', fontWeight: 700 }}>
                  {i + 1}
                </td>
                <td style={{ padding: '0.45rem 0.6rem' }}>
                  <span style={{
                    display: 'inline-block', padding: '0.15rem 0.5rem',
                    borderRadius: '6px', background: 'rgba(255,255,255,0.07)',
                    fontWeight: 800, color: 'var(--text)',
                  }}>{l.num_lista}</span>
                </td>
                <td style={{ padding: '0.45rem 0.6rem', color: 'var(--text)', fontWeight: 600 }}>
                  {l.des_partido || l.sig_partido || '—'}
                  {isWinner && (
                    <span style={{
                      marginLeft: '0.5rem', padding: '0.1rem 0.4rem',
                      borderRadius: '4px', background: 'rgba(245,158,11,0.2)',
                      border: '1px solid rgba(245,158,11,0.4)',
                      color: '#F59E0B', fontSize: '0.55rem', fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>Primero</span>
                  )}
                </td>
                <td style={{
                  padding: '0.45rem 0.6rem', fontWeight: 800,
                  color: isWinner ? '#F59E0B' : 'var(--text)',
                  fontFamily: 'Space Grotesk, monospace',
                }}>
                  {l.votos.toLocaleString('es-PY')}
                </td>
                <td style={{ padding: '0.45rem 0.6rem', color: 'var(--text-2)', fontWeight: 700 }}>
                  {pct}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RankingTable;
