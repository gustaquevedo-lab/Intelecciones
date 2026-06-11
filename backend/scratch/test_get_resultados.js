const { getResultados } = require('../dist/services/tsjeSync');
const res = getResultados(45, 13, 0);
console.log("Returned cargos count:", res.cargos.length);
for (const c of res.cargos) {
  console.log(`Cargo ${c.cod_cargo} (${c.des_cargo}): niv_cargo=${c.niv_cargo}, scopes=dpto:${c.cod_dpto}/dist:${c.cod_distrito}, total_votos=${c.total_votos}, listas_len=${c.listas.length}`);
}
