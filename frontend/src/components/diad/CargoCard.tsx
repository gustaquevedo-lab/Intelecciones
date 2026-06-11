import React from 'react';
import RankingTable from './RankingTable';
import DhondtTable from './DhondtTable';
import type { TsjeResultado } from '../../services/tsjeService';

const NIV_LABEL: Record<number, string> = { 0: 'Nacional', 1: 'Departamental', 2: 'Distrital' };
const TIP_LABEL: Record<number, string> = { 1: 'Nominal', 2: 'Plurinominal' };

interface Props {
  resultado: TsjeResultado;
  bancas: number;
  onBancasChange: (cod: number, v: number) => void;
}

const parsePY = (dt: string | null | undefined) => {
  if (!dt) return null;
  return new Date(dt.includes('Z') ? dt : dt + 'Z');
};

const fmtDateTime = (dt: string | null | undefined) => {
  const d = parsePY(dt);
  if (!d) return '';
  return d.toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Asuncion' });
};

const CargoCard: React.FC<Props> = ({ resultado, bancas, onBancasChange }) => {
  const r = resultado;
  const mesasPct = r.total_mesas > 0 ? ((r.mesas_publicadas / r.total_mesas) * 100).toFixed(0) : '0';
  const participPct = r.electores > 0 ? ((r.total_votos / r.electores) * 100).toFixed(1) : '0.0';

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '16px', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.85rem 1.1rem',
        background: 'linear-gradient(135deg, rgba(21,88,176,0.12), rgba(13,61,122,0.08))',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{
              padding: '0.1rem 0.45rem', borderRadius: '5px',
              background: 'rgba(46,132,240,0.2)', border: '1px solid rgba(46,132,240,0.3)',
              color: '#2E84F0', fontSize: '0.6rem', fontWeight: 800,
            }}>{r.cod_cargo}</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)' }}>
              {r.des_cargo}
            </span>
            <span style={{ padding: '0.1rem 0.45rem', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-3)', fontSize: '0.6rem', fontWeight: 700 }}>
              {TIP_LABEL[r.tip_cargo] ?? '?'}
            </span>
            <span style={{ padding: '0.1rem 0.45rem', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-3)', fontSize: '0.6rem', fontWeight: 700 }}>
              {NIV_LABEL[r.niv_cargo] ?? '?'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
              Mesas <strong style={{ color: 'var(--text-2)' }}>{r.mesas_publicadas}/{r.total_mesas}</strong> ({mesasPct}%)
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
              Electores <strong style={{ color: 'var(--text-2)' }}>{r.electores.toLocaleString('es-PY')}</strong>
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
              Votos <strong style={{ color: 'var(--text-2)' }}>{r.total_votos.toLocaleString('es-PY')}</strong> ({participPct}%)
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
              Blancos <strong style={{ color: 'var(--text-2)' }}>{r.blancos.toLocaleString('es-PY')}</strong>
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
              Nulos <strong style={{ color: 'var(--text-2)' }}>{r.nulos.toLocaleString('es-PY')}</strong>
            </span>
          </div>
        </div>
        {r.fetched_at && (
          <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
            TSJE {fmtDateTime(r.fetched_at)}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '1rem 1.1rem' }}>
        {r.tip_cargo === 1 ? (
          <RankingTable listas={r.listas} totalVotos={r.total_votos} />
        ) : (
          <DhondtTable
            codCargo={r.cod_cargo}
            listas={r.listas}
            preferentes={r.preferentes}
            totalVotos={r.total_votos}
            bancas={bancas}
            onBancasChange={v => onBancasChange(r.cod_cargo, v)}
          />
        )}
      </div>
    </div>
  );
};

export default CargoCard;
