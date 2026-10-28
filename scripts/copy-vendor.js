// Copia Bootstrap e Bootstrap Icons de node_modules para public/vendor,
// para que o sistema funcione sem acesso à internet.
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const destino = path.join(raiz, 'public', 'vendor');

const copias = [
  ['node_modules/bootstrap/dist/css/bootstrap.min.css', 'bootstrap/css/bootstrap.min.css'],
  ['node_modules/bootstrap/dist/css/bootstrap.min.css.map', 'bootstrap/css/bootstrap.min.css.map'],
  ['node_modules/bootstrap/dist/js/bootstrap.bundle.min.js', 'bootstrap/js/bootstrap.bundle.min.js'],
  ['node_modules/bootstrap/dist/js/bootstrap.bundle.min.js.map', 'bootstrap/js/bootstrap.bundle.min.js.map'],
  ['node_modules/bootstrap-icons/font/bootstrap-icons.min.css', 'bootstrap-icons/bootstrap-icons.min.css'],
  ['node_modules/bootstrap-icons/font/fonts', 'bootstrap-icons/fonts'],
];

for (const [origem, alvo] of copias) {
  const de = path.join(raiz, origem);
  const para = path.join(destino, alvo);
  fs.mkdirSync(path.dirname(para), { recursive: true });
  fs.cpSync(de, para, { recursive: true });
  console.log(`copiado: ${origem} -> public/vendor/${alvo}`);
}

// Fontes (Atkinson Hyperlegible Next e JetBrains Mono): só woff2 latin e latin-ext,
// num único fontes.css com caminhos locais
const FONTES = [
  ['atkinson-hyperlegible-next', ['400', '700']],
  ['jetbrains-mono', ['500', '700']],
];
const pastaFontes = path.join(destino, 'fonts');
fs.rmSync(pastaFontes, { recursive: true, force: true });
fs.mkdirSync(pastaFontes, { recursive: true });
let css = '/* Gerado por scripts/copy-vendor.js — não editar */\n';
for (const [familia, pesos] of FONTES) {
  const pacote = path.join(raiz, 'node_modules/@fontsource', familia);
  for (const peso of pesos) {
    const original = fs.readFileSync(path.join(pacote, `${peso}.css`), 'utf8');
    for (const bloco of original.match(/\/\*[^*]*\*\/\s*@font-face\s*{[^}]*}/g)) {
      if (!/-latin(-ext)?-\d+-normal \*\//.test(bloco)) continue;
      const arquivo = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(bloco)[1];
      fs.copyFileSync(path.join(pacote, 'files', arquivo), path.join(pastaFontes, arquivo));
      css += `${bloco.replace(/src:[^;]+;/, `src: url(./${arquivo}) format('woff2');`)}\n`;
    }
  }
}
fs.writeFileSync(path.join(pastaFontes, 'fontes.css'), css);
console.log('fontes copiadas para public/vendor/fonts');
