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

export function ler(chave) {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    if (bruto == null) return copia(PADROES[chave]);
    const v = JSON.parse(bruto);
    // Garante campos novos em objetos com padrão
    const p = PADROES[chave];
    if (p && typeof p === 'object' && !Array.isArray(p) && v && typeof v === 'object') return { ...copia(p), ...v };
    return v;
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
  if (!obj || obj.app !== 'a-refeicao-hoje-e' || !obj.dados) throw new Error('Esse texto não parece ser um backup deste app.');
  for (const k of Object.keys(PADROES)) if (k in obj.dados) gravar(k, obj.dados[k]);
  return obj;
}
