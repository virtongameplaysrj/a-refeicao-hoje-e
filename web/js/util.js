// Utilitários gerais: DOM, texto, números, datas, sorteio ponderado.

export const $ = (s, r = document) => r.querySelector(s);

/** Cria elementos: h('div', {class:'x', onClick: fn}, filhos...) */
export function h(tag, props, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat(Infinity)) {
    if (f == null || f === false) continue;
    el.append(f.nodeType ? f : document.createTextNode(String(f)));
  }
  return el;
}

/** Como replaceChildren, mas ignora null/false e achata arrays (igual ao h()). */
export function trocar(alvo, ...filhos) {
  alvo.replaceChildren(...filhos.flat(Infinity).filter((f) => f != null && f !== false).map((f) => (f.nodeType ? f : document.createTextNode(String(f)))));
  return alvo;
}

/** Normaliza para busca: sem acentos, minúsculo, só letras/números. */
export function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Quantidades no padrão brasileiro ----------
const FRACOES = [[0, ''], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, '']];
const PLURAIS = {
  'xícara': 'xícaras', 'colher de sopa': 'colheres de sopa', 'colher de chá': 'colheres de chá', dente: 'dentes',
  pitada: 'pitadas', 'maço': 'maços', fatia: 'fatias', lata: 'latas', pacote: 'pacotes', ramo: 'ramos', folha: 'folhas',
  'pedaço': 'pedaços', copo: 'copos', vidro: 'vidros', espiga: 'espigas',
};
const METRICAS = ['g', 'kg', 'ml', 'l'];

export function formatarQtd(q, unidade = '') {
  if (q == null || isNaN(q)) return '';
  if (METRICAS.includes(unidade)) {
    if (unidade === 'g' || unidade === 'ml') {
      if (q >= 1000) return (q / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + (unidade === 'g' ? '|kg' : '|l');
      const r = q >= 50 ? Math.round(q / 5) * 5 : Math.round(q);
      return String(Math.max(r, 1));
    }
    return q.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }
  if (q >= 10) return String(Math.round(q));
  let inteiro = Math.floor(q), resto = q - inteiro, melhor = FRACOES[0];
  for (const f of FRACOES) if (Math.abs(f[0] - resto) < Math.abs(melhor[0] - resto)) melhor = f;
  if (melhor[0] === 1) { inteiro += 1; melhor = FRACOES[0]; }
  if (inteiro === 0 && !melhor[1]) return '¼';
  return (inteiro ? String(inteiro) : '') + melhor[1];
}

/** Plural simples, só para item de uma palavra ("cebola" → "cebolas"); frases ficam como estão. */
function pluralPalavra(item) {
  if (/\s/.test(item) || /s$/i.test(item)) return item;
  if (/ão$/.test(item)) return item.replace(/ão$/, 'ões');
  if (/[rz]$/.test(item)) return item + 'es';
  if (/l$/.test(item)) return item.replace(/l$/, 'is');
  return item + 's';
}
/** "2 xícaras de arroz", "3 ovos", "sal a gosto" — já multiplicado pelo fator de porções. */
export function textoIngrediente(ing, fator = 1) {
  const item = ing.item;
  if (ing.unidade === 'a gosto') return `${item} a gosto`;
  if (ing.quantidade == null) return item;
  const q = ing.quantidade * fator;
  let txt = formatarQtd(q, ing.unidade), un = ing.unidade;
  if (txt.includes('|')) [txt, un] = txt.split('|');
  if (!un) return `${txt} ${q > 1.01 ? pluralPalavra(item) : item}`;
  const plural = q > 1.01 && PLURAIS[un] ? PLURAIS[un] : un;
  return `${txt} ${plural} de ${item}`;
}

// ---------- Datas ----------
export const DIA = 86400000;
export const diasDesde = (ms) => (Date.now() - ms) / DIA;
export function formatarData(ms) {
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function formatarRelogio(seg) {
  seg = Math.max(0, Math.floor(seg));
  const hh = Math.floor(seg / 3600), mm = Math.floor(seg / 60) % 60, ss = seg % 60;
  const p = (n) => String(n).padStart(2, '0');
  return hh ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}`;
}
export function formatarMinutos(min) {
  if (min < 60) return `${min} min`;
  if (min >= 1440) { const d = Math.round(min / 1440); return `${d} dia${d > 1 ? 's' : ''}`; }
  const hh = Math.floor(min / 60), mm = min % 60;
  return mm ? `${hh}h${String(mm).padStart(2, '0')}` : `${hh}h`;
}

// ---------- Aleatoriedade ----------
export function escolherPonderado(itens, pesoDe) {
  const pesos = itens.map((x) => Math.max(0, pesoDe(x)));
  const total = pesos.reduce((a, b) => a + b, 0);
  if (!total) return itens[Math.floor(Math.random() * itens.length)];
  let r = Math.random() * total;
  for (let i = 0; i < itens.length; i++) { r -= pesos[i]; if (r <= 0) return itens[i]; }
  return itens[itens.length - 1];
}
export function embaralhar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Aleatório com semente (colagens estáveis durante o dia). */
export function aleatorioComSemente(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---------- Interface ----------
let toastAtual = null;
export function toast(msg, { acao, aoAcao, ms = 3200 } = {}) {
  toastAtual?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, h('span', null, msg),
    acao && h('button', { onClick: () => { el.remove(); aoAcao?.(); } }, acao));
  document.body.append(el);
  toastAtual = el;
  setTimeout(() => el.remove(), ms);
}

export const youtubeBusca = (nome) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent('receita de ' + nome);

/** Ponte com o app Android (casca WebView), com alternativas para o navegador. */
const ponte = () => window.AndroidApp;
let wakeLock = null;
export async function manterTelaAcesa(ligar) {
  try { if (ponte()) { ponte().telaAcesa(!!ligar); return; } } catch {}
  try {
    if (ligar && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => (wakeLock = null)); }
    if (!ligar && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}
export function vibrar(ms) {
  try { if (ponte()?.vibrar) return ponte().vibrar(ms); } catch {}
  try { navigator.vibrate?.(ms); } catch {}
}
export async function compartilharTexto(texto, titulo = 'A refeição hoje é...') {
  try { if (ponte()?.compartilhar) { ponte().compartilhar(texto); return 'ok'; } } catch {}
  try { if (navigator.share) { await navigator.share({ title: titulo, text: texto }); return 'ok'; } } catch (e) { if (e?.name === 'AbortError') return 'cancelado'; }
  return (await copiarTexto(texto)) ? 'copiado' : 'falhou';
}
export async function copiarTexto(texto) {
  try { if (ponte()?.copiar) { ponte().copiar(texto); return true; } } catch {}
  try { await navigator.clipboard.writeText(texto); return true; } catch {}
  try {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }); ta.value = texto; document.body.append(ta);
    ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}

/** Liga um "segurar" (toque longo) num elemento; devolve true no clique se foi toque longo. */
export function aoSegurar(el, ms, fn) {
  let t = null, longo = false;
  const iniciar = () => { longo = false; t = setTimeout(() => { longo = true; vibrar(40); fn(); }, ms); };
  const cancelar = () => clearTimeout(t);
  el.addEventListener('pointerdown', iniciar);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => el.addEventListener(e, cancelar));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('click', (e) => { if (longo) { e.stopImmediatePropagation(); e.preventDefault(); longo = false; } }, true);
}
