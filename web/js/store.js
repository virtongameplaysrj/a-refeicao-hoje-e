// Dados do aparelho (localStorage). Nada vai para servidor.
const PREFIXO = 'arh.';

export const PADROES = {
  favoritos: [],        // [{id, estrelas 1-5, nota, em}]
  historico: [],        // [{id, nome, em, estrelas, minutos}]
  ocultos: [],          // [id]
  meusPratos: [],       // pratos adicionados à mão
  lista: [],            // lista de compras: [{receitaId, nome, porcoes, itens:[{item, quantidade, unidade}]}]
  marcados: {},         // itens marcados na lista: {chave: true}
  filtros: { tipo: [], refeicao: [], tempo: null, dificuldade: [], custo: [], regiao: [], restricoes: [] },
  cozinhando: null,     // {id, inicio, passo, porcoes, timers:[{id, rotulo, fim, total, avisado}]}
  sorteio: { recusas: {}, ultimos: [] },
  rascunhoGosto: null,
  rascunhoMeuPrato: null,
};

const copia = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const ehObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const comId = (x) => ehObj(x) && typeof x.id === 'string' && x.id;

/** Itens que cada lista precisa ter para as telas não quebrarem; o que não serve é descartado. */
const ITEM_VALIDO = {
  favoritos: comId,
  historico: (x) => comId(x) && Number.isFinite(x.em),
  ocultos: (x) => typeof x === 'string',
  meusPratos: (x) => comId(x) && typeof x.nome === 'string',
  lista: (x) => ehObj(x) && typeof x.nome === 'string' && Array.isArray(x.itens) && x.itens.every((i) => ehObj(i) && typeof i.item === 'string'),
};

/**
 * Confere o tipo do valor guardado contra o padrão: dado corrompido ou de um backup estranho
 * volta ao padrão em vez de derrubar a tela. Devolve null se o valor não serve de jeito nenhum.
 */
export function sanear(chave, v) {
  const p = PADROES[chave];
  if (!(chave in PADROES)) return v;
  if (Array.isArray(p)) return Array.isArray(v) ? (ITEM_VALIDO[chave] ? v.filter(ITEM_VALIDO[chave]) : v) : null;
  if (chave === 'cozinhando') {
    if (!comId(v) || !Number.isFinite(v.inicio)) return null;
    return { ...v, passo: Number.isFinite(v.passo) ? v.passo : 0, timers: Array.isArray(v.timers) ? v.timers.filter((t) => ehObj(t) && Number.isFinite(t.fim)) : [] };
  }
  if (ehObj(p)) {
    if (!ehObj(v)) return null;
    const r = { ...copia(p), ...v };
    // Subcampos com o mesmo tipo do padrão (ex.: filtros.regiao precisa ser lista)
    for (const [k, pv] of Object.entries(p)) {
      if (Array.isArray(pv) && !Array.isArray(r[k])) r[k] = copia(pv);
      else if (ehObj(pv) && !ehObj(r[k])) r[k] = copia(pv);
    }
    return r;
  }
  return v; // rascunhos: objeto livre ou null
}

export function ler(chave) {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    if (bruto == null) return copia(PADROES[chave]);
    const v = sanear(chave, JSON.parse(bruto));
    return v === null && PADROES[chave] !== null ? copia(PADROES[chave]) : v;
  } catch { return copia(PADROES[chave]); }
}

export function gravar(chave, valor) {
  try {
    if (valor == null) localStorage.removeItem(PREFIXO + chave);
    else localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch (e) { console.warn('Falha ao gravar', chave, e); }
}

export function alterar(chave, fn) { const v = ler(chave); const r = fn(v); gravar(chave, r === undefined ? v : r); return r === undefined ? v : r; }

// ---------- Favoritos ----------
export const favorito = (id) => ler('favoritos').find((f) => f.id === id);
export function favoritar(id, estrelas = 3) {
  alterar('favoritos', (l) => { if (!l.some((f) => f.id === id)) l.unshift({ id, estrelas, nota: '', em: Date.now() }); });
}
export const desfavoritar = (id) => alterar('favoritos', (l) => l.filter((f) => f.id !== id));
export const atualizarFavorito = (id, campos) => alterar('favoritos', (l) => { const f = l.find((x) => x.id === id); if (f) Object.assign(f, campos); });

// ---------- Histórico ----------
export function registrarRefeicao(prato, estrelas, minutos) {
  alterar('historico', (l) => { l.unshift({ id: prato.id, nome: prato.nome, em: Date.now(), estrelas, minutos }); });
}
export function vezesFeito(id) { return ler('historico').filter((h) => h.id === id).length; }
export function ultimaVez(id) { const h = ler('historico').find((x) => x.id === id); return h ? h.em : null; }

// ---------- Backup ----------
export function exportarBackup() {
  const dados = {};
  for (const k of Object.keys(PADROES)) dados[k] = ler(k);
  return JSON.stringify({ app: 'a-refeicao-hoje-e', versao: 1, criadoEm: new Date().toISOString(), dados });
}
export function importarBackup(texto) {
  let obj;
  try { obj = JSON.parse(texto.trim()); } catch { throw new Error('O texto colado não é um backup válido.'); }
  if (!obj || obj.app !== 'a-refeicao-hoje-e' || !ehObj(obj.dados)) throw new Error('Esse texto não parece ser um backup deste app.');
  // Confere tudo antes de gravar qualquer coisa: backup estragado não pode apagar os dados atuais.
  const bons = {}, ruins = [];
  for (const k of Object.keys(PADROES)) {
    if (!(k in obj.dados)) continue;
    const v = sanear(k, obj.dados[k]);
    if (v === null && obj.dados[k] !== null) ruins.push(k); else bons[k] = v;
  }
  if (!Object.keys(bons).length) throw new Error('Esse backup está danificado; nada foi alterado.');
  for (const [k, v] of Object.entries(bons)) gravar(k, v);
  obj.ignorados = ruins;
  return obj;
}
