export type DhondtList = { num_lista: string; votos: number };
export type DhondtResult = { num_lista: string; bancas: number };

export function dhondt(lists: DhondtList[], bancas: number): DhondtResult[] {
  if (bancas <= 0 || lists.length === 0) return lists.map(l => ({ num_lista: l.num_lista, bancas: 0 }));

  const result: Record<string, number> = {};
  lists.forEach(l => { result[l.num_lista] = 0; });

  const quotients: { num_lista: string; q: number }[] = [];
  lists.forEach(l => {
    for (let k = 1; k <= bancas; k++) {
      quotients.push({ num_lista: l.num_lista, q: l.votos / k });
    }
  });

  quotients.sort((a, b) => b.q - a.q);

  for (let i = 0; i < Math.min(bancas, quotients.length); i++) {
    result[quotients[i].num_lista]++;
  }

  return lists.map(l => ({ num_lista: l.num_lista, bancas: result[l.num_lista] ?? 0 }));
}
