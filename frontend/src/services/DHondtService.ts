export interface Candidate {
  id: number;
  list_number: string;
  option_number: number; // 0 or null for the list itself, >= 1 for candidate preference
  candidate_nombre: string;
  candidate_alias?: string;
  photo_url?: string;
  votos: number;
}

export interface ListProjection {
  list_number: string;
  list_name: string;
  votos_lista_pura: number;
  votos_preferenciales_candidatos: number;
  votos_totales: number;
  bancas_ganadas: number;
  candidates_ordenados: Candidate[];
  candidatos_ganadores: Candidate[];
}

export const DHondtService = {
  /**
   * Calculates the seats (bancas) distribution using the D'Hondt method
   * combined with list unlocking (Voto Preferencial) based on Paraguayan TSJE standards.
   */
  calcularProyeccion: (
    rawCandidates: Candidate[],
    bancasDisponibles: number
  ): ListProjection[] => {
    if (bancasDisponibles <= 0 || rawCandidates.length === 0) return [];

    // Group candidates by list_number
    const listsMap: Record<string, Candidate[]> = {};
    rawCandidates.forEach(cand => {
      const listNum = cand.list_number || 'SIN LISTA';
      if (!listsMap[listNum]) {
        listsMap[listNum] = [];
      }
      listsMap[listNum].push(cand);
    });

    const projections: ListProjection[] = [];

    // Process each list for Fase 1 (Desbloqueo) and aggregate votes
    Object.entries(listsMap).forEach(([listNum, items]) => {
      // Split list-only votes (option_number = 0 or null) and individual candidate preferences (option_number > 0)
      const listOnlyItem = items.find(i => !i.option_number || i.option_number === 0);
      const candidatesOnly = items.filter(i => i.option_number && i.option_number > 0);

      const votos_lista_pura = listOnlyItem ? listOnlyItem.votos : 0;
      const votos_preferenciales_candidatos = candidatesOnly.reduce((acc, curr) => acc + curr.votos, 0);
      const votos_totales = votos_lista_pura + votos_preferenciales_candidatos;

      // Fase 1: Order candidates by preference votes (highest to lowest).
      // On tie, order by option_number ascending (original list order)
      const candidates_ordenados = [...candidatesOnly].sort((a, b) => {
        if (b.votos !== a.votos) {
          return b.votos - a.votos;
        }
        return (a.option_number || 0) - (b.option_number || 0);
      });

      projections.push({
        list_number: listNum,
        list_name: listOnlyItem?.candidate_alias || listOnlyItem?.candidate_nombre || `Lista ${listNum}`,
        votos_lista_pura,
        votos_preferenciales_candidatos,
        votos_totales,
        bancas_ganadas: 0,
        candidates_ordenados,
        candidatos_ganadores: []
      });
    });

    // Fase 2: D'Hondt Quotient Division
    const cocientes: { listNum: string; cociente: number }[] = [];
    projections.forEach(p => {
      for (let d = 1; d <= bancasDisponibles; d++) {
        cocientes.push({
          listNum: p.list_number,
          cociente: p.votos_totales / d
        });
      }
    });

    // Sort quotients descending
    cocientes.sort((a, b) => b.cociente - a.cociente);

    // Assign seats
    const totalToAssign = Math.min(bancasDisponibles, cocientes.length);
    for (let i = 0; i < totalToAssign; i++) {
      const winner = cocientes[i];
      const proj = projections.find(p => p.list_number === winner.listNum);
      if (proj) {
        proj.bancas_ganadas++;
      }
    }

    // Allocate winning candidates based on bancas won
    projections.forEach(proj => {
      proj.candidatos_ganadores = proj.candidates_ordenados.slice(0, proj.bancas_ganadas);
    });

    // Sort lists by total votes descending
    return projections.sort((a, b) => b.votos_totales - a.votos_totales);
  }
};
