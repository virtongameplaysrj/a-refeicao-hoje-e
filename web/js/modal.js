// Camadas sobre a tela (roleta, diálogos) integradas ao histórico:
// cada camada empilha uma entrada no history, então o "Voltar" do Android fecha a camada.
import { h } from './util.js';

const pilha = [];
const depois = [];
let seq = 0;

export function abrirModal(el, { aoFechar, semFundo = false } = {}) {
  const raiz = semFundo ? el : h('div', { class: 'modal-fundo' }, el);
  if (!semFundo) raiz.addEventListener('click', (e) => { if (e.target === raiz) fecharModal(); });
  document.body.append(raiz);
  const id = ++seq;
  pilha.push({ id, raiz, aoFechar });
  history.pushState({ modalId: id }, '');
  return id;
}

/** Fecha a camada do topo (via history.back). `entao` roda depois que ela realmente fechou. */
export function fecharModal(entao) {
  if (entao) depois.push(entao);
  if (pilha.length) history.back();
  else rodarDepois();
}
export const modalAberto = () => pilha.length > 0;

function rodarDepois() { while (depois.length) { try { depois.shift()(); } catch (e) { console.error(e); } } }

window.addEventListener('popstate', (e) => {
  const id = e.state?.modalId;
  const manter = id ? pilha.findIndex((m) => m.id === id) + 1 : 0;
  while (pilha.length > manter) {
    const m = pilha.pop();
    m.raiz.remove();
    try { m.aoFechar?.(); } catch (err) { console.error(err); }
  }
  if (!pilha.length) setTimeout(rodarDepois, 0);
});

/** Diálogo simples. botoes: [{rotulo, valor, classe}] — valor pode ser função (undefined = não fecha). */
export function dialogo({ titulo, texto, conteudo, botoes = [{ rotulo: 'OK', valor: true, classe: 'primario' }] }) {
  return new Promise((resolver) => {
    let valor = null;
    const caixa = h('div', { class: 'dialogo', role: 'dialog', 'aria-modal': 'true' },
      h('h2', null, titulo), texto && h('p', null, texto), conteudo,
      h('div', { class: 'btns' }, botoes.map((b) => h('button', {
        class: 'btn bloco ' + (b.classe || ''),
        onClick: () => { const v = typeof b.valor === 'function' ? b.valor() : b.valor; if (v === undefined) return; valor = v; fecharModal(); },
      }, b.rotulo))));
    abrirModal(caixa, { aoFechar: () => resolver(valor) });
  });
}
export const confirmar = (titulo, texto, sim = 'Sim', nao = 'Cancelar') =>
  dialogo({ titulo, texto, botoes: [{ rotulo: sim, valor: true, classe: 'primario' }, { rotulo: nao, valor: false, classe: 'fantasma' }] }).then((v) => v === true);
