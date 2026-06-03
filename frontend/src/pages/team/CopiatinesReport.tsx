import { useState, useCallback, useEffect } from 'react';
import { Printer, RefreshCw, Eye, EyeOff, Loader, CheckCircle, RotateCcw } from 'lucide-react';
import api, { getImageUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

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
  campaign_id: number | null;
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

// Resuelve URLs de fotos: rutas /assets/ van al frontend, el resto al backend (uploads)
const resolvePhotoUrl = (url: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/assets/') || url.startsWith('/favicon')) {
    return window.location.origin + url;
  }
  return getImageUrl(url) || '';
};

const DEFAULT_CAMPAIGN_LISTS: CampaignList[] = [
  {
    id: -1,
    type: 'INTENDENTE',
    list_number: '3',
    option_number: null,
    candidate_nombre: 'ARQ. MIGUEL ROJAS LEÓN',
    candidate_alias: 'ARQ. MIGUEL ROJAS LEÓN',
    photo_url: '/assets/miguel_rojas.png'
  },
  {
    id: -2,
    type: 'CONCEJAL MUNICIPAL',
    list_number: '3',
    option_number: '3',
    candidate_nombre: 'LOURDES AMARILLA',
    candidate_alias: 'LOURDES AMARILLA',
    photo_url: '/assets/lourdes_amarilla.png'
  },
  {
    id: -3,
    type: 'PRESIDENTE DEL PARTIDO',
    list_number: '3',
    option_number: null,
    candidate_nombre: 'ALCIDES RIVEROS',
    candidate_alias: 'ALCIDES RIVEROS',
    photo_url: '/assets/alcides_riveros.png'
  },
  {
    id: -4,
    type: 'MIEMBRO DIRECTORIO NAC.',
    list_number: '3',
    option_number: '13',
    candidate_nombre: 'PEDRO GONZALEZ',
    candidate_alias: 'PEDRO GONZALEZ',
    photo_url: '/assets/pedro_gonzalez.png'
  }
];

// ─── CSS exacto del modelo (scratch/copiatin_diseno.html) ─────────────────────
const CARD_CSS = `
  :root {
    --primary-blue: #002d84;
    --light-blue: #0056b3;
    --accent-yellow: #ff9e00;
    --accent-orange: #f26200;
  }
  @page { size: A4 portrait; margin: 3cm 0 0 0; }
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
    height: 1.45cm;
    border-bottom: 2.2px solid var(--primary-blue);
    padding-bottom: 2px;
    margin-bottom: 3.5px;
    justify-content: space-between;
  }
  .top-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    height: auto;
    min-height: 1.05cm;
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
    margin-left: 2px;
    display: flex; align-items: center;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .local-info-inline label { color: #64748b; font-weight: 700; margin-right: 2px; font-size: 7.5px; }
  .local-info-inline span { font-size: 9px; font-weight: 900; color: #0f172a; }

  .candidates-list { display: flex; flex-direction: column; gap: 2px; flex-grow: 1; }

  .candidate-card {
    display: flex; align-items: center;
    background: #ffffff;
    border: 1.2px solid var(--primary-blue);
    border-radius: 4px;
    height: 0.73cm;
    padding: 1px 3px;
    color: var(--primary-blue);
    position: relative;
  }
  .candidate-card.emphasis {
    background: #ffffff;
    border: 1.5px solid var(--primary-blue);
  }
  .candidate-photo-frame {
    width: 0.58cm; height: 0.58cm;
    border-radius: 3px; overflow: hidden;
    background: #f8fafc;
    border: 1px solid var(--primary-blue);
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
    font-size: 6.5px; font-weight: 900; color: #d97706; /* cargo en amarillo */
    text-transform: uppercase; letter-spacing: 0.2px; margin-bottom: 0.5px;
  }
  .candidate-card.emphasis .candidate-role { color: #d97706; }
  .candidate-name {
    font-size: 9.5px; font-weight: 900; color: var(--primary-blue); /* nombre del candidato en azul */
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .badge-container {
    display: flex; align-items: center; justify-content: center;
    background: #ffffff; color: var(--primary-blue);
    border-radius: 4px; padding: 0 4px;
    margin-left: auto; flex-shrink: 0;
    border: 1.8px solid var(--accent-yellow);
    height: 0.64cm; width: 2.8cm;
  }
  .badge-single { display: flex; align-items: center; justify-content: center; gap: 5px; width: 100%; }
  .badge-single .label-main { font-size: 8.5px; font-weight: 900; color: var(--primary-blue); letter-spacing: -0.1px; }
  .badge-single .val-huge { font-size: 22px; font-weight: 900; color: var(--primary-blue); line-height: 1; }
  .badge-double { display: flex; align-items: center; justify-content: space-around; width: 100%; gap: 1px; }
  .badge-row { display: flex; align-items: center; gap: 2px; }
  .badge-row .label-sub { font-size: 8px; font-weight: 900; color: #64748b; letter-spacing: -0.1px; }
  .badge-row .val-large { font-size: 16px; font-weight: 900; color: var(--primary-blue); line-height: 1; }
  .badge-divider { width: 1.2px; height: 0.5cm; background-color: #cbd5e1; }

  .coordinator-info-box {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 2px 4px;
    font-size: 8px;
    margin-bottom: 3.5px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 0.58cm;
  }
  .coordinator-info-box label {
    color: #64748b;
    font-weight: 800;
  }
  .coordinator-info-box strong {
    color: #0f172a;
    font-weight: 900;
    margin-left: 4px;
    flex-grow: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: left;
  }
  .coordinator-info-box .padrino-sub {
    color: #475569;
    font-size: 7.5px;
    font-weight: 600;
    margin-left: 4px;
  }
  .generic-candidates-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .generic-candidates-list .candidate-card {
    height: 1.05cm;
    padding: 3px 4px;
  }
  .generic-candidates-list .candidate-photo-frame {
    width: 0.85cm;
    height: 0.85cm;
  }
  .generic-candidates-list .badge-container {
    height: 0.85cm;
  }

  /* Compact layout for cards to fit 4 candidates + coordinator box */
  .compact-card .coordinator-info-box {
    height: 0.50cm;
    padding: 1px 3px;
    margin-bottom: 2px;
    font-size: 7.5px;
  }
  .compact-card .candidate-card {
    height: 0.58cm;
    padding: 1px 2.5px;
    border-width: 1px;
  }
  .compact-card .candidate-photo-frame {
    width: 0.44cm;
    height: 0.44cm;
    margin-right: 3px;
  }
  .compact-card .candidate-name {
    font-size: 8.5px;
  }
  .compact-card .candidate-role {
    font-size: 5.5px;
    margin-bottom: 0px;
  }
  .compact-card .badge-container {
    height: 0.48cm;
    width: 2.2cm;
    border-width: 1.2px;
  }
  .compact-card .badge-single .label-main {
    font-size: 7px;
  }
  .compact-card .badge-single .val-huge {
    font-size: 15px;
  }
  .compact-card .badge-double .val-large {
    font-size: 11px;
  }
  .compact-card .badge-double .label-sub {
    font-size: 7px;
  }
  .compact-card .badge-divider {
    height: 0.38cm;
  }
  .compact-card .candidates-list {
    gap: 1.5px;
  }
`;

const getConcepcionLists = (
  campaignLists: CampaignList[],
  electorCampaignId?: number | null,
  userListId?: number
): CampaignList[] => {
  const filteredLists = electorCampaignId
    ? campaignLists.filter(l => (l as any).campaign_id === electorCampaignId)
    : campaignLists;

  const intendente = filteredLists.find(l => l.type?.toUpperCase() === 'INTENDENTE') || 
                     campaignLists.find(l => l.type?.toUpperCase() === 'INTENDENTE') || {
    id: -10,
    type: 'INTENDENTE',
    list_number: '3',
    option_number: null,
    candidate_nombre: 'ALEJANDRO URBIETA',
    candidate_alias: 'ALEJANDRO URBIETA',
    photo_url: '/assets/alejandro_urbieta.png'
  };

  let concejal = (userListId && filteredLists.some(l => l.id === userListId))
    ? filteredLists.find(l => l.id === userListId && l.type?.toUpperCase().includes('CONCEJAL'))
    : null;

  if (!concejal) {
    concejal = filteredLists.find(l => l.type?.toUpperCase().includes('CONCEJAL'));
  }
  if (!concejal) {
    concejal = campaignLists.find(l => l.type?.toUpperCase().includes('CONCEJAL'));
  }
  if (!concejal) {
    concejal = DEFAULT_CAMPAIGN_LISTS[1];
  }

  const presidente = DEFAULT_CAMPAIGN_LISTS.find(l => l.type?.toUpperCase() === 'PRESIDENTE DEL PARTIDO') || DEFAULT_CAMPAIGN_LISTS[2];
  
  const directorioDept: CampaignList = {
    id: -5,
    type: 'DIRECTORIO DEPARTAMENTAL',
    list_number: '3',
    option_number: null,
    candidate_nombre: 'EMILIO PAVON',
    candidate_alias: 'EMILIO PAVON',
    photo_url: '/assets/emilio_pavon.png'
  };
  
  return [intendente, concejal, presidente, directorioDept];
};

const getCerroCoraOrBellaVistaLists = (): CampaignList[] => {
  const presidente = DEFAULT_CAMPAIGN_LISTS.find(l => l.type?.toUpperCase() === 'PRESIDENTE DEL PARTIDO') || DEFAULT_CAMPAIGN_LISTS[2];
  const directorioNac = DEFAULT_CAMPAIGN_LISTS.find(l => l.type?.toUpperCase() === 'MIEMBRO DIRECTORIO NAC.') || DEFAULT_CAMPAIGN_LISTS[3];
  return [presidente, directorioNac];
};

const getGenericLists = (campaignLists: CampaignList[]): CampaignList[] => {
  const intendente = campaignLists.find(l => l.type?.toUpperCase() === 'INTENDENTE');
  const concejal = campaignLists.find(l => l.type?.toUpperCase().includes('CONCEJAL'));
  
  const result: CampaignList[] = [];
  if (intendente) result.push(intendente);
  if (concejal) result.push(concejal);
  
  if (result.length === 0 && campaignLists.length > 0) {
    result.push(...campaignLists.slice(0, 2));
  }
  return result;
};

function buildPrintHTML(
  electors: CopiatinElector[],
  campaignLists: CampaignList[],
  userListId?: number
): string {
  const logoUrl = window.location.origin + '/assets/intelecciones-logo.svg';
  const buildBadge = (list: CampaignList) => {
    const hasOption = list.option_number && list.option_number !== '0';
    if (hasOption) {
      return `<div class="badge-double">
        <div class="badge-row"><span class="label-sub">L.</span><span class="val-large">${list.list_number || '—'}</span></div>
        <div class="badge-divider"></div>
        <div class="badge-row"><span class="label-sub">OP.</span><span class="val-large">${list.option_number}</span></div>
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
    const photoUrl = resolvePhotoUrl(list.photo_url);
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
    const electorIsPJC = e.ciudad?.toUpperCase().includes('PEDRO JUAN CABALLERO') || e.ciudad?.toUpperCase().includes('PJC');
    const electorIsConcepcion = e.ciudad?.toUpperCase().includes('CONCEPCION') || e.ciudad?.toUpperCase().includes('CONCEPCIÓN');
    const electorIsCerroCoraOrBellaVista = e.ciudad?.toUpperCase().includes('CERRO CORA') || e.ciudad?.toUpperCase().includes('CERRO CORÁ') || e.ciudad?.toUpperCase().includes('BELLA VISTA');
    const fullName = `${e.nombre} ${e.apellido}`.trim().toUpperCase();
    const ci = formatCI(e.elector_ci);
    const ciudad = (e.ciudad || '').toUpperCase();
    const local = (e.local_votacion || '—').toUpperCase();
    const campaign = (e.campaign_name || 'CAMPAÑA').toUpperCase();

    if (electorIsPJC) {
      const candidateRows = buildCandidateRows(DEFAULT_CAMPAIGN_LISTS);
      return `<div class="copiatin-card compact-card">
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
        
        <div class="coordinator-info-box">
          <label>COORDINADOR ASIGNADO:</label> <strong>${(e.coordinator_name || '—').toUpperCase()}</strong>
          ${e.padrino_name ? `<span class="padrino-sub">(${e.padrino_name.toUpperCase()})</span>` : ''}
        </div>
        
        <div class="candidates-list">${candidateRows}</div>
      </div>`;
    } else if (electorIsCerroCoraOrBellaVista) {
      const cerroCoraOrBellaVistaLists = getCerroCoraOrBellaVistaLists();
      const candidateRows = buildCandidateRows(cerroCoraOrBellaVistaLists);
      return `<div class="copiatin-card generic-card">
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
        
        <div class="coordinator-info-box">
          <label>COORDINADOR ASIGNADO:</label> <strong>${(e.coordinator_name || '—').toUpperCase()}</strong>
          ${e.padrino_name ? `<span class="padrino-sub">(${e.padrino_name.toUpperCase()})</span>` : ''}
        </div>
        
        <div class="generic-candidates-list">${candidateRows}</div>
      </div>`;
    } else if (electorIsConcepcion) {
      const concepcionLists = getConcepcionLists(campaignLists, e.campaign_id, userListId);
      const candidateRows = buildCandidateRows(concepcionLists);
      return `<div class="copiatin-card compact-card">
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
        
        <div class="coordinator-info-box">
          <label>COORDINADOR ASIGNADO:</label> <strong>${(e.coordinator_name || '—').toUpperCase()}</strong>
          ${e.padrino_name ? `<span class="padrino-sub">(${e.padrino_name.toUpperCase()})</span>` : ''}
        </div>
        
        <div class="candidates-list">${candidateRows}</div>
      </div>`;
    } else {
      const genericLists = getGenericLists(campaignLists);
      const candidateRows = buildCandidateRows(genericLists.length > 0 ? genericLists : DEFAULT_CAMPAIGN_LISTS.slice(0, 2));
      return `<div class="copiatin-card generic-card">
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
        
        <div class="coordinator-info-box">
          <label>COORDINADOR ASIGNADO:</label> <strong>${(e.coordinator_name || '—').toUpperCase()}</strong>
          ${e.padrino_name ? `<span class="padrino-sub">(${e.padrino_name.toUpperCase()})</span>` : ''}
        </div>
        
        <div class="generic-candidates-list">${candidateRows}</div>
      </div>`;
    }
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
    window.addEventListener('load', function() {
      document.fonts.ready.then(function() {
        setTimeout(function() {
          window.print();
        }, 800);
      });
    });
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
  const { user } = useAuth();
  const isSuperOrJefe = user?.role === 'SUPERUSUARIO' || user?.role === 'JEFE_CAMPANA' || user?.role === 'SUBJEFE';

  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CopiatinElector[]>([]);
  const [searching, setSearching] = useState(false);
  const [basket, setBasket] = useState<CopiatinElector[]>([]);

  // Missing States
  const [data, setData] = useState<CopiatinesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [padrinoFilter, setPadrinoFilter] = useState('ALL');
  const [coordinatorFilter, setCoordinatorFilter] = useState('ALL');
  const [printedFilter, setPrintedFilter] = useState<'ALL' | 'PENDING' | 'PRINTED'>('PENDING');

  // Load Copiatines Data
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (printedFilter !== 'ALL') {
        params.append('printed_status', printedFilter.toLowerCase());
      }
      if (padrinoFilter !== 'ALL') {
        params.append('padrino_id', padrinoFilter);
      }
      if (coordinatorFilter !== 'ALL') {
        params.append('coordinator_id', coordinatorFilter);
      }
      const res = await api.get(`/my-team/copiatines?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      console.error('Error al cargar copiatines:', err);
    } finally {
      setLoading(false);
    }
  }, [printedFilter, padrinoFilter, coordinatorFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCustomSearch = async () => {
    if (!customSearchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.get(`/my-team/copiatines?search=${encodeURIComponent(customSearchQuery)}`);
      setSearchResults(res.data?.electors || []);
    } catch (err) {
      console.error('Error en búsqueda de electores para copiatines:', err);
    } finally {
      setSearching(false);
    }
  };

  const addToBasket = (elector: CopiatinElector) => {
    if (basket.some(b => b.capture_id === elector.capture_id)) return;
    setBasket(prev => [...prev, elector]);
  };

  const removeFromBasket = (captureId: number) => {
    setBasket(prev => prev.filter(b => b.capture_id !== captureId));
  };

  const handlePrintBasket = () => {
    if (basket.length === 0) return;
    const ids = basket.map(e => e.capture_id);
    const html = buildPrintHTML(basket, data?.campaignLists || [], user?.assigned_list_id);
    const pw = window.open('', '_blank', 'width=900,height=700');
    if (!pw) return;
    pw.document.write(html);
    pw.document.close();
    pw.onafterprint = async () => {
      pw.close();
      setMarking(true);
      try {
        await api.post('/my-team/copiatines/mark-printed', { capture_ids: ids });
        setBasket([]);
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

      {/* Robust Elector Search & Basket System for Reprints */}
      <div style={{
        padding: '1.25rem', background: 'var(--surface-hover)', borderRadius: '16px',
        border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1rem'
      }}>
        <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: 'white', textTransform: 'uppercase', margin: 0 }}>
          🔍 Armador de Página de Impresión Personalizada (Electores con Copiatín Perdido)
        </h4>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            className="modern-input-premium-styled"
            placeholder="Buscar elector por nombre, apellido o C.I..."
            value={customSearchQuery}
            onChange={e => setCustomSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustomSearch()}
            style={{ flex: 1, fontSize: '0.82rem' }}
          />
          <button 
            onClick={handleCustomSearch}
            disabled={searching}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '10px', border: 'none',
              background: 'var(--plra-500)', color: 'white', fontWeight: 800, cursor: 'pointer'
            }}
          >
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {/* Search results select dropdown / list */}
        {searchResults.length > 0 && (
          <div style={{
            background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '10px',
            maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem'
          }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>
              Resultados de Búsqueda ({searchResults.length}):
            </p>
            {searchResults.map(e => (
              <div key={e.capture_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', padding: '0.25rem 0' }}>
                <span style={{ color: 'white', fontWeight: 700 }}>
                  {e.nombre} {e.apellido} (C.I. {formatCI(e.elector_ci)})
                </span>
                <button
                  onClick={() => addToBasket(e)}
                  style={{
                    padding: '2px 8px', borderRadius: '4px', border: 'none',
                    background: 'var(--green)', color: 'white', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer'
                  }}
                >
                  + Agregar a la Hoja
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Custom Printing Basket */}
        <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'white' }}>
              📋 Copiatines en esta Hoja ({basket.length} de 10 recomendados)
            </span>
            {basket.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => setBasket([])}
                  style={{ background: 'transparent', border: 'none', color: 'var(--red)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Vaciar Hoja
                </button>
                <button 
                  onClick={handlePrintBasket}
                  style={{
                    padding: '0.35rem 1rem', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
                    fontSize: '0.72rem', fontWeight: 900, cursor: 'pointer'
                  }}
                >
                  🖨️ Imprimir Hoja Seleccionada
                </button>
              </div>
            )}
          </div>
          {basket.length === 0 ? (
            <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontStyle: 'italic', margin: 0 }}>
              Busque electores arriba y agréguelos aquí para componer una hoja de impresión combinada y no desperdiciar hojas A4.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {basket.map(e => (
                <div 
                  key={e.capture_id}
                  style={{
                    padding: '4px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                    borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'white'
                  }}
                >
                  <span>{e.nombre} {e.apellido.slice(0, 1)}.</span>
                  <button 
                    onClick={() => removeFromBasket(e.capture_id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--red)', fontWeight: 900, cursor: 'pointer', padding: '0 2px' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
            {padrinoFilter !== 'ALL' && (
              <option value={padrinoFilter}>Solo Padrino (Personal)</option>
            )}
            {filteredCoordinators.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Estado</label>
          <select 
            value={printedFilter} 
            onChange={e => setPrintedFilter(e.target.value as any)} 
            style={selStyle}
          >
            <option value="ALL">Todos</option>
            <option value="PENDING">Pendientes</option>
            <option value="PRINTED">Impresos</option>
          </select>
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
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isSuperOrJefe && printed > 0 && (
            <button
              onClick={handleUnmarkAll}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', color: '#EF4444',
                padding: '0.75rem 1.5rem', fontSize: '0.88rem', fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={16} /> Desmarcar Impresos ({printed})
            </button>
          )}
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
            {printedFilter === 'PENDING' ? 'Todos los copiatines ya fueron impresos.' : 'Sin electores con los filtros seleccionados.'}
          </div>
        </div>
      )}
      {!loading && data && data.electors.length > 0 && (
        <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
          <div className="sc-grid">
            {data.electors.map(e => {
              const logoUrl = window.location.origin + '/assets/intelecciones-logo.svg';
              const electorIsPJC = e.ciudad?.toUpperCase().includes('PEDRO JUAN CABALLERO') || e.ciudad?.toUpperCase().includes('PJC');
              const electorIsConcepcion = e.ciudad?.toUpperCase().includes('CONCEPCION') || e.ciudad?.toUpperCase().includes('CONCEPCIÓN');
              const electorIsCerroCoraOrBellaVista = e.ciudad?.toUpperCase().includes('CERRO CORA') || e.ciudad?.toUpperCase().includes('CERRO CORÁ') || e.ciudad?.toUpperCase().includes('BELLA VISTA');
              
              let candidatesToUse: CampaignList[] = [];
              let cardClass = "copiatin-card";
              
              if (electorIsPJC) {
                candidatesToUse = DEFAULT_CAMPAIGN_LISTS;
                cardClass = "copiatin-card compact-card";
              } else if (electorIsCerroCoraOrBellaVista) {
                candidatesToUse = getCerroCoraOrBellaVistaLists();
                cardClass = "copiatin-card generic-card";
              } else if (electorIsConcepcion) {
                candidatesToUse = getConcepcionLists(data.campaignLists, e.campaign_id, user?.assigned_list_id);
                cardClass = "copiatin-card compact-card";
              } else {
                const genericLists = getGenericLists(data.campaignLists);
                candidatesToUse = genericLists.length > 0 ? genericLists : DEFAULT_CAMPAIGN_LISTS.slice(0, 2);
                cardClass = "copiatin-card generic-card";
              }

              return (
                 <div key={e.capture_id} className={`${cardClass}${e.copiatin_printed_at ? ' printed' : ''}`} style={{ position: 'relative' }}>
                   {e.copiatin_printed_at && (
                     <div className="printed-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                       ✓ IMPRESO
                       {isSuperOrJefe && (
                         <button
                           title="Desmarcar para volver a imprimir"
                           onClick={(ev) => {
                             ev.stopPropagation();
                             handleUnmarkOne(e.capture_id);
                           }}
                           style={{
                             background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '4px',
                             color: 'white', cursor: 'pointer', padding: '1px 3px', display: 'inline-flex',
                             alignItems: 'center', justifyContent: 'center'
                           }}
                         >
                           <RotateCcw size={8} />
                         </button>
                       )}
                     </div>
                   )}
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
                  
                  <div className="coordinator-info-box">
                    <label>COORDINADOR ASIGNADO:</label> <strong>{(e.coordinator_name || '—').toUpperCase()}</strong>
                    {e.padrino_name && <span className="padrino-sub">({e.padrino_name.toUpperCase()})</span>}
                  </div>

                  <div className={electorIsPJC || electorIsConcepcion ? "candidates-list" : "generic-candidates-list"}>
                    {candidatesToUse.map((list, i) => {
                      const isEmphasis = i < 2;
                      const name = (list.candidate_nombre || list.candidate_alias || '—').toUpperCase();
                      const photoUrl = resolvePhotoUrl(list.photo_url) || null;
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
                                  <div className="badge-row"><span className="label-sub">L.</span><span className="val-large">{list.list_number}</span></div>
                                  <div className="badge-divider" />
                                  <div className="badge-row"><span className="label-sub">OP.</span><span className="val-large">{list.option_number}</span></div>
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
