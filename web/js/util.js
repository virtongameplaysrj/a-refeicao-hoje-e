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

// ---------- Singular e plural de ingredientes contáveis ----------
// Só o começo do nome concorda com o número ("tomates picados", "ovo batido"); o que vem depois
// de uma preposição fica como está ("bifes de contrafilé", "cebola em rodelas").
const PREPOSICOES = new Set(['de', 'do', 'da', 'dos', 'das', 'em', 'para', 'com', 'sem', 'ou', 'e', 'a', 'ao', 'à', 'no', 'na', 'bem', 'por', 'pra', 'cerca']);
const INVARIAVEIS = new Set(['minas', 'mussarela', 'caipira', 'fresco', 'grosso']);
const PLURAL_IRREG = { 'pão': 'pães', 'alemão': 'alemães', 'mão': 'mãos', 'irmão': 'irmãos' };
const SINGULAR_IRREG = Object.fromEntries(Object.entries(PLURAL_IRREG).map(([s, p]) => [p, s]));

function pluralDe(w) {
  if (PLURAL_IRREG[w]) return PLURAL_IRREG[w];
  if (INVARIAVEIS.has(w) || /s$/.test(w) && !/ês$/.test(w)) return w;
  if (/ês$/.test(w)) return w.replace(/ês$/, 'eses');
  if (/ão$/.test(w)) return w.replace(/ão$/, 'ões');
  if (/[rz]$/.test(w)) return w + 'es';
  if (/m$/.test(w)) return w.replace(/m$/, 'ns');
  if (/al$|el$|ol$|ul$/.test(w)) return w.replace(/l$/, 'is');
  return w + 's';
}
function singularDe(w) {
  if (SINGULAR_IRREG[w]) return SINGULAR_IRREG[w];
  if (INVARIAVEIS.has(w) || !/s$/.test(w) || /ês$/.test(w)) return w;
  if (/eses$/.test(w)) return w.replace(/eses$/, 'ês');
  if (/ões$/.test(w)) return w.replace(/ões$/, 'ão');
  if (/[rz]es$/.test(w)) return w.slice(0, -2);
  if (/ns$/.test(w)) return w.replace(/ns$/, 'm');
  if (/ais$|éis$|óis$/.test(w)) return w.replace(/is$/, 'l').replace(/é(l)$/, 'e$1').replace(/ó(l)$/, 'o$1');
  return w.slice(0, -1);
}
/** Põe o começo do nome no singular ou no plural: "tomates picados" ↔ "tomate picado". */
export function concordar(item, plural) {
  const palavras = item.split(' ');
  let i = 0;
  for (; i < palavras.length; i++) {
    const w = palavras[i];
    if (PREPOSICOES.has(w.toLowerCase()) || /[()\d]/.test(w)) break;
    // "banana-nanica" → as duas partes concordam
    palavras[i] = w.split('-').map((p) => (/^[a-zà-ú]+$/i.test(p) ? (plural ? pluralDe(p) : singularDe(p)) : p)).join('-');
  }
  return palavras.join(' ');
}

// Contáveis que fazem sentido em pedaço (½ cebola, ¼ de pimentão); o resto (ovo, bife, bisteca...) é por inteiro.
const FRACIONAVEIS = /^(cebola|tomate|pimentão|pimentao|limão|limao|laranja|cenoura|batata|abobrinha|berinjela|maçã|maca|chuchu|mandioquinha|abóbora|abobora|repolho|pepino|beterraba|alho-poró|alho poro|maço|pé|cabeça|coco|mamão|manga|abacaxi|banana|lingui[çc]a|paio|cal?abresa)/i;
export function qtdContavel(q, item) {
  if (FRACIONAVEIS.test(singularDe(item.split(' ')[0].toLowerCase()))) return q;
  return Math.max(1, Math.round(q));
}

/** "2 xícaras de arroz", "3 ovos", "sal a gosto" — já multiplicado pelo fator de porções. */
export function textoIngrediente(ing, fator = 1) {
  const item = ing.item;
  if (ing.unidade === 'a gosto') return `${item} a gosto`;
  if (ing.quantidade == null) return item;
  let q = ing.quantidade * fator;
  if (!ing.unidade) q = qtdContavel(q, item);
  let txt = formatarQtd(q, ing.unidade), un = ing.unidade;
  if (txt.includes('|')) [txt, un] = txt.split('|');
  // Concorda com o número exibido (1,07 aparece como "1" → singular).
  const varios = !/^(1|¼|½|¾|⅓|⅔)$/.test(txt);
  if (!un) return `${txt} ${concordar(item, varios)}`;
  const plural = varios && PLURAIS[un] ? PLURAIS[un] : un;
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
