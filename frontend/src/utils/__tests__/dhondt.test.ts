import { describe, it, expect } from 'vitest';
import { dhondt } from '../dhondt';

describe('dhondt', () => {
  it('reparte 10 bancas entre 4 listas correctamente', () => {
    const lists = [
      { num_lista: '9',  votos: 340 },
      { num_lista: '3',  votos: 280 },
      { num_lista: '15', votos: 160 },
      { num_lista: '7',  votos: 60  },
    ];
    const result = dhondt(lists, 10);
    const map = Object.fromEntries(result.map(r => [r.num_lista, r.bancas]));

    // Cocientes D'Hondt para 10 bancas (orden desc):
    // 340/1=340, 280/1=280, 340/2=170, 160/1=160, 280/2=140,
    // 340/3=113.3, 280/3=93.3, 160/2=80, 340/4=85, 280/4=70
    // Lista 9: 340(1°), 170(3°), 113.3(6°), 85(9°) → 4 bancas
    // Lista 3: 280(2°), 140(5°), 93.3(7°), 70(10°) → 4 bancas
    // Lista 15: 160(4°), 80(8°) → 2 bancas
    // Lista 7: 60 → 0 bancas
    expect(map['9']).toBe(4);
    expect(map['3']).toBe(4);
    expect(map['15']).toBe(2);
    expect(map['7']).toBe(0);
    expect(result.reduce((s, r) => s + r.bancas, 0)).toBe(10);
  });

  it('bancas=0 retorna array con 0 bancas para cada lista', () => {
    const lists = [{ num_lista: '1', votos: 100 }, { num_lista: '2', votos: 50 }];
    const result = dhondt(lists, 0);
    result.forEach(r => expect(r.bancas).toBe(0));
  });

  it('lista con 0 votos recibe 0 bancas', () => {
    const lists = [
      { num_lista: '1', votos: 500 },
      { num_lista: '2', votos: 0   },
    ];
    const result = dhondt(lists, 5);
    const map = Object.fromEntries(result.map(r => [r.num_lista, r.bancas]));
    expect(map['1']).toBe(5);
    expect(map['2']).toBe(0);
  });

  it('listas vacías retorna array vacío', () => {
    expect(dhondt([], 10)).toEqual([]);
  });

  it('1 lista recibe todas las bancas', () => {
    const result = dhondt([{ num_lista: 'A', votos: 999 }], 7);
    expect(result[0].bancas).toBe(7);
  });

  it('empate de cocientes: total de bancas sigue siendo correcto', () => {
    // Empate exacto: dos listas con los mismos votos
    const lists = [
      { num_lista: '1', votos: 100 },
      { num_lista: '2', votos: 100 },
    ];
    const result = dhondt(lists, 4);
    const total = result.reduce((s, r) => s + r.bancas, 0);
    // No importa cómo se resuelve el empate, el total debe ser 4
    expect(total).toBe(4);
  });
});
