// Sorteio inteligente.
// - Catálogo: prato nunca feito tem 3x mais chance.
// - Favoritos: nota maior = mais chance (estrelas²) e rodízio: quanto mais tempo sem fazer, mais chance.
// - "Hoje não" derruba a chance por 3 dias (recupera aos poucos).
// - Prato feito não volta por 7 dias; o sorteado fica fora das próximas 3 rodadas.
import { ler, gravar, alterar } from './store.js';
import { todos, porId, aplicarFiltros } from './catalogo.js';
import { escolherPonderado, diasDesde, clamp } from './util.js';

const DIAS_RECUSA = 3, DIAS_FEITO = 7, RODADAS_FORA = 3;

function contexto() {
  const hist = ler('historico');
  const vezes = new Map(), ultima = new Map();
  for (const h of hist) { vezes.set(h.id, (vezes.get(h.id) || 0) + 1); if (!ultima.has(h.id)) ultima.set(h.id, h.em); }
  const s = ler('sorteio');
  return { vezes, ultima, recusas: s.recusas || {}, ultimos: s.ultimos || [] };
}

function fatorRecusa(id, ctx) {
  const em = ctx.recusas[id];
  if (!em) return 1;
  const d = diasDesde(em);
  return d >= DIAS_RECUSA ? 1 : 0.08 + 0.92 * (d / DIAS_RECUSA);
}

export function peso(p, modo, ctx, fav) {
  let w;
  if (modo === 'favoritos') {
    const estrelas = fav?.estrelas || 3;
    const ult = ctx.ultima.get(p.id);
    const rodizio = ult == null ? 2 : clamp(diasDesde(ult) / 14, 0.3, 2);
    w = estrelas * estrelas * rodizio;
  } else {
    w = (ctx.vezes.get(p.id) || 0) === 0 ? 3 : 1;
  }
  return w * fatorRecusa(p.id, ctx);
}

/**
 * Monta o conjunto sorteável. modo: 'catalogo' | 'favoritos'. lista: pratos de origem (opcional).
 * Devolve {pool, aviso}. Se as regras esvaziarem tudo, afrouxa (e avisa).
 */
export function montarPool({ modo = 'catalogo', lista = null, usarFiltros = true } = {}) {
  const ctx = contexto();
  const favs = new Map(ler('favoritos').map((f) => [f.id, f]));
  let origem = lista || (modo === 'favoritos' ? [...favs.keys()].map(porId).filter(Boolean) : todos());
  let aviso = '';
  if (usarFiltros) {
    const filtrados = aplicarFiltros(origem);
    if (filtrados.length) origem = filtrados;
    else if (origem.length) aviso = 'Nenhum prato passa nos filtros; sorteando entre todos.';
  }
  const feitoRecente = (p) => { const u = ctx.ultima.get(p.id); return u != null && diasDesde(u) < DIAS_FEITO; };
  const ultimos = new Set(ctx.ultimos);
  let pool = origem.filter((p) => !feitoRecente(p) && !ultimos.has(p.id));
  if (!pool.length) { pool = origem.filter((p) => !ultimos.has(p.id)); if (pool.length) aviso ||= 'Você já fez todos esta semana; liberei os recentes.'; }
  if (!pool.length) pool = origem.slice();
  const pesoDe = (p) => peso(p, modo, ctx, favs.get(p.id));
  return { pool, aviso, pesoDe, modo };
}

export function sortear(pool, pesoDe) { return pool.length ? escolherPonderado(pool, pesoDe) : null; }

export function registrarSorteado(id) {
  alterar('sorteio', (s) => { s.ultimos = [id, ...(s.ultimos || []).filter((x) => x !== id)].slice(0, RODADAS_FORA); });
}
export function registrarRecusa(id) {
  alterar('sorteio', (s) => { s.recusas = s.recusas || {}; s.recusas[id] = Date.now(); });
}
/** Limpa recusas vencidas (chamado na inicialização). */
export function faxinaSorteio() {
  const s = ler('sorteio');
  for (const [id, em] of Object.entries(s.recusas || {})) if (diasDesde(em) >= DIAS_RECUSA) delete s.recusas[id];
  gravar('sorteio', s);
}
