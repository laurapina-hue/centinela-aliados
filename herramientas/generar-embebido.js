#!/usr/bin/env node
/* =====================================================================
   Genera js/embebido.js con una copia de data/ y contexto/.
   Sirve para abrir index.html con doble clic (sin servidor), porque los
   navegadores bloquean fetch() de archivos locales.
   En GitHub Pages no es necesario: el sitio lee los archivos reales.
   Uso:  node herramientas/generar-embebido.js
   (La acción de GitHub .github/workflows/embebido.yml lo ejecuta sola
    cada vez que cambian data/ o contexto/.)
   ===================================================================== */
const fs = require("fs");
const path = require("path");
const raiz = path.join(__dirname, "..");
const leer = p => fs.readFileSync(path.join(raiz, p), "utf8");

const contexto = {};
fs.readdirSync(path.join(raiz, "contexto")).filter(f => f.endsWith(".md")).sort()
  .forEach(f => (contexto[f] = leer("contexto/" + f)));

const datos = {
  indicadores: leer("data/indicadores_semanales.csv"),
  incumplimientos: leer("data/incumplimientos.csv"),
  proveedores: JSON.parse(leer("data/proveedores.json")),
  metas: JSON.parse(leer("data/metas.json")),
};

const salida = `/* ARCHIVO GENERADO AUTOMÁTICAMENTE por herramientas/generar-embebido.js
   No lo edites a mano: edita data/ y contexto/ y vuelve a generarlo. */
window.EMBEBIDO = ${JSON.stringify({ generado: new Date().toISOString(), contexto, datos })};
`;
fs.writeFileSync(path.join(raiz, "js/embebido.js"), salida);
console.log(`js/embebido.js generado (${(salida.length / 1024).toFixed(1)} KB, ${Object.keys(contexto).length} archivos de contexto)`);
