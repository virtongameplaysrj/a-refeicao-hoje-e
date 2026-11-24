// Catálogo: os 160 pratos do pratos.json + os pratos adicionados à mão; categorias, fotos e filtros.
import { ler } from './store.js';
import { normalizar } from './util.js';

export const CATEGORIAS = [
  { nome: 'Clássicos do dia a dia', slug: 'classicos', icone: '🍛', cores: ['#b8442c', '#f2c14e'] },
  { nome: 'Carne bovina', slug: 'bovina', icone: '🥩', cores: ['#7d2618', '#d9653b'] },
  { nome: 'Frango e aves', slug: 'aves', icone: '🍗', cores: ['#b86d00', '#f2c14e'] },
  { nome: 'Carne suína', slug: 'suina', icone: '🐖', cores: ['#9c4258', '#e9a07a'] },
  { nome: 'Peixes e frutos do mar', slug: 'peixes', icone: '🐟', cores: ['#17566b', '#5fb3c4'] },
  { nome: 'Cozidos e pratos de panela', slug: 'cozidos', icone: '🍲', cores: ['#6b3d20', '#c8853d'] },
  { nome: 'Sopas e caldos', slug: 'sopas', icone: '🥣', cores: ['#8e5814', '#e8b04a'] },
  { nome: 'Massas, tortas e forno', slug: 'massas', icone: '🥧', cores: ['#9a6f08', '#e6c35c'] },
  { nome: 'Vegetarianos e leguminosas', slug: 'vegetarianos', icone: '🥗', cores: ['#2f6322', '#8cc56b'] },
  { nome: 'Salgados e comida de rua', slug: 'salgados', icone: '🥟', cores: ['#9a4f1f', '#efa65a'] },
  { nome: 'Café da manhã e lanche', slug: 'cafe', icone: '☕', cores: ['#4a2f1c', '#b07a4a'] },
  { nome: 'Sobremesas', slug: 'sobremesas', icone: '🍮', cores: ['#86305a', '#f29bb5'] },
];
export const MEUS = { nome: 'Meus pratos', slug: 'meus-pratos', icone: '⭐', cores: ['#5a3f8a', '#b19cd9'] };
export const categoriaPorNome = (nome) => CATEGORIAS.find((c) => c.nome === nome) || MEUS;
export const categoriaPorSlug = (slug) => CATEGORIAS.find((c) => c.slug === slug) || (slug === MEUS.slug ? MEUS : null);

let base = [];
let indice = new Map();

export async function carregar() {
  let r;
  try { r = await fetch('data/pratos.json', { cache: 'no-cache' }); } catch { r = await fetch('data/pratos.json'); }
  if (!r.ok) throw new Error('Não consegui carregar o catálogo (' + r.status + ')');
  base = await r.json();
  reindexar();
}
export function reindexar() {
  indice = new Map();
  for (const p of base) indice.set(p.id, p);
  for (const p of meusPratos()) indice.set(p.id, p);
}

/** Pratos do usuário, completados com os campos que o resto do app espera. */
export function meusPratos() {
  return ler('meusPratos').map((p) => ({
    regiao: '', refeicao: [], restricoes: [], descricao: '', dica: '', curiosidade: '', dificuldade: '', custo: '',
    tempoMin: null, rendimento: 2, ingredientes: [], passos: [], ...p,
    categoria: p.categoria || MEUS.nome, foto: p.foto || { url: '' }, meu: true,
  }));
}

export function todos({ incluirOcultos = false } = {}) {
  const ocultos = new Set(ler('ocultos'));
  const lista = base.concat(meusPratos());
  return incluirOcultos ? lista : lista.filter((p) => !ocultos.has(p.id));
}
export const porId = (id) => indice.get(id) || meusPratos().find((p) => p.id === id) || null;
export const totalCatalogo = () => base.length;
export function daCategoria(slug) {
  const cat = categoriaPorSlug(slug);
  if (!cat) return [];
  return todos().filter((p) => (cat === MEUS ? p.meu : p.categoria === cat.nome));
}
export function buscar(texto, limite = 12) {
  const q = normalizar(texto);
  if (!q) return [];
  const termos = q.split(' ');
  return todos({ incluirOcultos: true })
    .map((p) => {
      const n = normalizar(p.nome);
      if (!termos.every((t) => n.includes(t))) return null;
      return { p, nota: (n.startsWith(q) ? 0 : 1) + n.length / 100 };
    })
    .filter(Boolean).sort((a, b) => a.nota - b.nota).slice(0, limite).map((x) => x.p);
}

// ---------- Fotos ----------
const cacheArte = new Map();
/** Arte gerada para prato sem foto: degradê nas cores da categoria + ícone. */
export function arte(p) {
  const cat = categoriaPorNome(p?.categoria);
  if (cacheArte.has(cat.slug)) return cacheArte.get(cat.slug);
  const [a, b] = cat.cores;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<radialGradient id="l" cx=".5" cy=".42" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="600" height="900" fill="url(#g)"/>
<g fill="#fff" opacity=".08"><circle cx="90" cy="120" r="70"/><circle cx="520" cy="210" r="110"/><circle cx="130" cy="760" r="130"/><circle cx="500" cy="820" r="60"/></g>
<circle cx="300" cy="400" r="230" fill="url(#l)"/>
<text x="300" y="470" font-size="220" text-anchor="middle">${cat.icone}</text></svg>`;
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  cacheArte.set(cat.slug, url);
  return url;
}
export const fotoDe = (p) => (p?.foto?.url ? p.foto.url : arte(p));
export const temFoto = (p) => !!p?.foto?.url;

// ---------- Tipo (papel do prato na refeição) ----------
export const TIPOS = [
  ['principal', '🍽️ Prato principal'], ['acompanhamento', '🍚 Acompanhamento'], ['petisco', '🍢 Petisco / porção'],
  ['lanche', '🥪 Lanche e salgado'], ['doce', '🍮 Doce'], ['bebida', '🥤 Bebida'],
];
export const ROTULO_TIPO = Object.fromEntries(TIPOS);
/** Pratos do usuário (sem tipo) contam como prato principal. */
export const tipoDe = (p) => p?.tipo || 'principal';
/**
 * Tipos que o sorteio geral usa quando a pessoa não escolheu nenhum no filtro "Tipo":
 * sempre o prato principal; com café/lanche marcado entram lanches e petiscos; com sobremesa, os doces.
 * Acompanhamento e bebida só entram se escolhidos de propósito.
 */
export function tiposDoSorteio(f = ler('filtros')) {
  const ok = new Set(['principal']);
  const r = f.refeicao || [];
  if (r.includes('Café da manhã') || r.includes('Lanche')) { ok.add('lanche'); ok.add('petisco'); }
  if (r.includes('Sobremesa')) ok.add('doce');
  return ok;
}

// ---------- Filtros ----------
export const GRUPOS_FILTRO = [
  { chave: 'tipo', titulo: 'Tipo', opcoes: TIPOS },
  { chave: 'refeicao', titulo: 'Refeição', opcoes: [['Café da manhã', '☕ Café da manhã'], ['Almoço', '🍽️ Almoço'], ['Jantar', '🌙 Jantar'], ['Lanche', '🥪 Lanche'], ['Sobremesa', '🍮 Sobremesa']] },
  { chave: 'tempo', titulo: 'Tempo de preparo', unico: true, opcoes: [['30', '⚡ Até 30 min'], ['60', '⏱️ Até 1 hora'], ['mais', '🐢 Mais de 1 hora']] },
  { chave: 'dificuldade', titulo: 'Dificuldade', opcoes: [['Fácil', 'Fácil'], ['Média', 'Média'], ['Difícil', 'Difícil']] },
  { chave: 'custo', titulo: 'Custo', opcoes: [['Barato', '$ Barato'], ['Médio', '$$ Médio'], ['Caro', '$$$ Caro']] },
  { chave: 'regiao', titulo: 'Região', opcoes: [['São Paulo', 'São Paulo'], ['Minas Gerais', 'Minas Gerais'], ['Rio de Janeiro', 'Rio de Janeiro'], ['Santos', 'Santos']] },
  { chave: 'restricoes', titulo: 'Restrições', todos: true, opcoes: [['vegetariano', '🌱 Vegetariano'], ['sem-lactose', '🥛 Sem lactose'], ['sem-gluten', '🌾 Sem glúten']] },
];

export function passaFiltros(p, f) {
  if (f.tipo?.length && !f.tipo.includes(tipoDe(p))) return false;
  if (f.refeicao?.length && p.refeicao?.length && !p.refeicao.some((r) => f.refeicao.includes(r))) return false;
  if (f.tempo && p.tempoMin) {
    if (f.tempo === '30' && p.tempoMin > 30) return false;
    if (f.tempo === '60' && p.tempoMin > 60) return false;
    if (f.tempo === 'mais' && p.tempoMin <= 60) return false;
  }
  for (const k of ['dificuldade', 'custo', 'regiao']) if (f[k]?.length && p[k] && !f[k].includes(p[k])) return false;
  if (f.restricoes?.length && !f.restricoes.every((r) => (p.restricoes || []).includes(r))) return false;
  return true;
}
export const aplicarFiltros = (lista, f = ler('filtros')) => lista.filter((p) => passaFiltros(p, f));
export function contarFiltros(f = ler('filtros')) {
  return GRUPOS_FILTRO.reduce((n, g) => n + (g.unico ? (f[g.chave] ? 1 : 0) : (f[g.chave]?.length || 0)), 0);
}
export function rotulosFiltros(f = ler('filtros')) {
  const r = [];
  for (const g of GRUPOS_FILTRO) for (const [v, rot] of g.opcoes) if (g.unico ? f[g.chave] === v : f[g.chave]?.includes(v)) r.push({ grupo: g.chave, valor: v, rotulo: rot });
  return r;
}
