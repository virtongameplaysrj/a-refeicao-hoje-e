// Ponto de entrada: carrega o catálogo, toca a abertura e cuida das rotas.
import { h, $, manterTelaAcesa } from './util.js';
import { carregar } from './catalogo.js';
import { faxinaSorteio } from './sorteio.js';
import { prepararDesbloqueio } from './audio.js';
import { verificarTimers } from './cozinha.js';
import { tocarAbertura } from './abertura.js';
import { modalAberto } from './modal.js';
import { ir } from './nav.js';
import { telaInicio, telaGosto, telaCategorias, telaPrateleira } from './telas.js';
import { telaReceita, telaCozinhando, telaLista, telaHistorico, telaMeuPrato } from './telas2.js';

export const VERSAO = '1.0.0';

const ROTAS = {
  inicio: telaInicio, gosto: telaGosto, categorias: telaCategorias, cat: telaPrateleira, receita: telaReceita,
  cozinhando: telaCozinhando, lista: telaLista, historico: telaHistorico, 'meu-prato': telaMeuPrato,
};
const TELA_ACESA = new Set(['receita', 'cozinhando']);

const app = $('#app');
let atual = null, hashAtual = '';
const rolagens = new Map();

function render() {
  const hash = location.hash || '#/inicio';
  if (hash === hashAtual) return;
  rolagens.set(hashAtual, window.scrollY);
  hashAtual = hash;
  const [nome, ...resto] = hash.replace(/^#\/?/, '').split('/');
  const fn = ROTAS[nome] || telaInicio;
  try { atual?.limpar?.(); } catch {}
  let r;
  try { r = fn(decodeURIComponent(resto.join('/'))); }
  catch (e) { console.error(e); r = { el: h('main', { class: 'tela vazio' }, h('p', null, 'Ops, algo deu errado nesta tela.'), h('button', { class: 'btn', onClick: () => ir('inicio') }, 'Voltar ao início')) }; }
  atual = r;
  app.replaceChildren(r.el);
  const y = rolagens.get(hash) || 0;
  requestAnimationFrame(() => window.scrollTo(0, y));
  manterTelaAcesa(TELA_ACESA.has(nome));
}

async function iniciar() {
  prepararDesbloqueio();
  if (history.state?.modalId) history.replaceState(null, '');
  if (!location.hash || location.hash === '#' || location.hash === '#/') history.replaceState(null, '', '#/inicio');
  const abertura = tocarAbertura();
  try { await carregar(); }
  catch (e) {
    await abertura;
    app.replaceChildren(h('main', { class: 'tela vazio' }, h('div', { class: 'grande-ico' }, '📡'),
      h('h2', null, 'Não consegui carregar os pratos'), h('p', null, 'Confira a internet e tente de novo.'),
      h('button', { class: 'btn primario', onClick: () => location.reload() }, 'Tentar de novo')));
    return;
  }
  faxinaSorteio();
  await abertura;
  window.addEventListener('hashchange', render);
  render();
  setInterval(() => verificarTimers(ir), 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) verificarTimers(ir); });
}

// Rede primeiro, cópia local quando estiver sem internet
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
window.__arh = { versao: VERSAO, modalAberto };
iniciar();
