// Roleta do sorteio: sobe com rufar, gira com marchinha; ao tocar (ou após 15 s) desacelera
// e para EXATAMENTE no prato sorteado. "Vou fazer este!" ou "Hoje não, escolha outro".
import { h, embaralhar, clamp, vibrar } from './util.js';
import { rufar, marchinha, tique, taDa, audio } from './audio.js';
import { abrirModal, fecharModal } from './modal.js';
import { categoriaPorNome, esperaHoras, textoEspera } from './catalogo.js';
import { sortear, registrarSorteado, registrarRecusa } from './sorteio.js';

const CORES = ['#c8553d', '#f2c14e', '#6aa84f', '#8c5a3c', '#e07a5f', '#d9a441', '#4f8a3c', '#a8432e'];
const ESCURAS = new Set(['#c8553d', '#6aa84f', '#8c5a3c', '#4f8a3c', '#a8432e', '#e07a5f']);
const PONTEIRO = -Math.PI / 2;
const AUTO_PARAR = 15000;
const FATIAS = 30;
const ease3 = (x) => 1 - Math.pow(1 - x, 3);

/**
 * Abre a roleta. {pool, pesoDe, titulo, aviso, aoEscolher(prato)}
 */
export function abrirRoleta({ pool, pesoDe, titulo = 'Sorteando...', aviso = '', aoEscolher }) {
  audio();
  let candidatos = pool.slice();
  const canvas = h('canvas', { 'aria-label': 'Roleta' });
  const nomeAtual = h('div', { class: 'nome-atual' }, '');
  const dicaToque = h('div', { class: 'dica-toque' }, 'Toque na tela para parar');
  const resultado = h('div', { class: 'resultado oculto' });
  const fechar = h('button', { class: 'voltar fechar', 'aria-label': 'Fechar', onClick: (e) => { e.stopPropagation(); fecharModal(); } }, '✕');
  const el = h('div', { class: 'roleta' }, fechar, h('div', { class: 'titulo-roleta' }, titulo), aviso && h('small', { style: { color: '#e9c9a8' } }, aviso),
    canvas, nomeAtual, dicaToque, resultado);
  const g = canvas.getContext('2d');

  let tam, dpr, segs = [], ang = 0, vel = 0, estado = 'subindo', vencedor = null, raf = 0, ultimoT = 0, autoTimer = 0;
  let desac = null, segAnterior = -1, musica = null, vivo = true;

  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    tam = Math.min(window.innerWidth - 32, window.innerHeight * 0.5, 440);
    canvas.style.width = canvas.style.height = tam + 'px';
    canvas.width = canvas.height = Math.round(tam * dpr);
  }

  function montarSegmentos() {
    vencedor = sortear(candidatos, pesoDe);
    // Fatias novas a cada giro: o vencedor + 29 pratos sorteados na hora entre os candidatos.
    const outros = embaralhar(candidatos.filter((p) => p !== vencedor));
    let lista = [vencedor, ...outros.slice(0, FATIAS - 1)];
    // Poucos pratos (filtros apertados): repete os outros, embaralhados, até completar a roda.
    for (let i = 0; lista.length < FATIAS && outros.length; i++) lista.push(outros[i % outros.length]);
    while (lista.length < 8) lista.push(vencedor);
    segs = embaralhar(lista);
    segs.idxVencedor = segs.indexOf(vencedor);
  }

  const segNoPonteiro = () => {
    const a = (2 * Math.PI) / segs.length;
    let rel = (PONTEIRO - ang) % (2 * Math.PI); if (rel < 0) rel += 2 * Math.PI;
    return Math.floor(rel / a) % segs.length;
  };

  function desenhar(t) {
    const R = tam / 2, n = segs.length, a = (2 * Math.PI) / n;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, tam, tam);
    g.save(); g.translate(R, R);
    // aro com lâmpadas de circo
    g.fillStyle = '#5a2414'; g.beginPath(); g.arc(0, 0, R - 2, 0, 2 * Math.PI); g.fill();
    const nl = 24;
    for (let i = 0; i < nl; i++) {
      const aa = (i / nl) * 2 * Math.PI, on = (Math.floor(t / 180) + i) % 2 === 0;
      g.fillStyle = on ? '#ffe9a8' : '#7a4a20'; g.shadowColor = '#ffd36b'; g.shadowBlur = on ? 10 : 0;
      g.beginPath(); g.arc(Math.cos(aa) * (R - 10), Math.sin(aa) * (R - 10), 4.2, 0, 2 * Math.PI); g.fill();
    }
    g.shadowBlur = 0;
    const r = R - 20;
    for (let i = 0; i < n; i++) {
      const a0 = ang + i * a, cor = CORES[i % CORES.length];
      g.fillStyle = cor; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, a0, a0 + a); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(40,15,5,.5)'; g.lineWidth = 2; g.stroke();
      g.save(); g.rotate(a0 + a / 2);
      g.fillStyle = ESCURAS.has(cor) ? '#fff8ee' : '#2a1a0e';
      g.textAlign = 'right'; g.textBaseline = 'middle';
      // A letra não pode ser mais alta que a fatia na ponta de dentro do texto (com 30 fatias elas são finas).
      const max = r * 0.56, interno = r - 34 - max;
      const fs = clamp(Math.min(r * 0.075, interno * a * 0.95), 8, 17);
      g.font = `700 ${fs}px system-ui, sans-serif`;
      let nome = segs[i].nome;
      while (g.measureText(nome).width > max && nome.length > 4) nome = nome.slice(0, -2).trimEnd() + '…';
      g.fillText(nome, r - 34, 0);
      g.font = `${fs * 1.3}px system-ui`; g.fillText(categoriaPorNome(segs[i].categoria).icone, r - 8, 0);
      g.restore();
    }
    // miolo
    const mg = g.createRadialGradient(-6, -6, 2, 0, 0, r * 0.2);
    mg.addColorStop(0, '#fff2c4'); mg.addColorStop(1, '#c98a1e');
    g.fillStyle = mg; g.beginPath(); g.arc(0, 0, r * 0.17, 0, 2 * Math.PI); g.fill();
    g.font = `${r * 0.16}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🍽️', 0, 2);
    g.restore();
    // ponteiro
    g.fillStyle = '#fff8ee'; g.strokeStyle = '#5a2414'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(R - 14, 2); g.lineTo(R + 14, 2); g.lineTo(R, 34); g.closePath(); g.fill(); g.stroke();
  }

  function laco(agora) {
    if (!vivo) return;
    const dt = ultimoT ? Math.min(0.05, (agora - ultimoT) / 1000) : 0; ultimoT = agora;
    if (estado === 'girando') { vel = Math.min(vel + dt * 9, 2.4 * Math.PI); ang += vel * dt; }
    else if (estado === 'parando') {
      const k = clamp((agora - desac.t0) / desac.T, 0, 1);
      ang = desac.a0 + desac.D * ease3(k);
      musica?.tempo(Math.max(0.35, 1 - k));
      if (k >= 1) concluir();
    }
    const s = segNoPonteiro();
    if (s !== segAnterior) { segAnterior = s; nomeAtual.textContent = segs[s]?.nome || ''; if (estado !== 'subindo') tique(estado === 'parando' ? 0.22 : 0.1); }
    desenhar(agora);
    raf = requestAnimationFrame(laco);
  }

  function girar() {
    estado = 'girando'; vel = 0.5;
    resultado.classList.add('oculto'); dicaToque.classList.remove('oculto'); nomeAtual.classList.remove('oculto');
    musica?.parar(0.1); musica = marchinha();
    clearTimeout(autoTimer); autoTimer = setTimeout(parar, AUTO_PARAR);
  }

  /** Desacelera com velocidade inicial contínua e para no centro do segmento vencedor. */
  function parar() {
    if (estado !== 'girando') return;
    clearTimeout(autoTimer);
    estado = 'parando'; dicaToque.classList.add('oculto');
    const a = (2 * Math.PI) / segs.length, w = segs.idxVencedor;
    const jitter = (Math.random() - 0.5) * a * 0.5;
    let alvo = PONTEIRO - (w + 0.5) * a + jitter;            // ângulo final (módulo 2π)
    const T0 = 3.0, D0 = (vel * T0) / 3;                      // easeOutCubic: v0 = 3D/T
    let extra = (alvo - (ang + D0)) % (2 * Math.PI); if (extra < 0) extra += 2 * Math.PI;
    const D = D0 + extra, T = (3 * D) / vel;
    desac = { t0: performance.now(), a0: ang, D, T: T * 1000 };
  }

  function concluir() {
    estado = 'parado';
    musica?.parar(0.3); musica = null;
    taDa(); vibrar(80);
    registrarSorteado(vencedor.id);
    nomeAtual.classList.add('oculto');
    resultado.replaceChildren(
      h('div', { class: 'frase' }, 'A refeição hoje é...'),
      h('div', { class: 'vencedor' }, vencedor.nome + '!'),
      esperaHoras(vencedor) ? h('small', { style: { color: '#f2c14e', display: 'block', marginTop: '-4px', marginBottom: '10px' } }, `⏳ Atenção: ${textoEspera(esperaHoras(vencedor))}`) : null,
      h('div', { class: 'btns' },
        h('button', { class: 'btn primario bloco', onClick: (e) => { e.stopPropagation(); const p = vencedor; fecharModal(() => aoEscolher?.(p)); } }, '😋 Vou fazer este!'),
        h('button', { class: 'btn fantasma bloco', onClick: (e) => { e.stopPropagation(); outro(); } }, '🙅 Hoje não, escolha outro')),
    );
    resultado.classList.remove('oculto');
  }

  function outro() {
    registrarRecusa(vencedor.id);
    candidatos = candidatos.filter((p) => p !== vencedor);
    if (!candidatos.length) {
      resultado.replaceChildren(h('div', { class: 'frase' }, 'Acabaram as opções por aqui 😅'),
        h('div', { class: 'btns' }, h('button', { class: 'btn bloco', onClick: (e) => { e.stopPropagation(); fecharModal(); } }, 'Voltar')));
      return;
    }
    montarSegmentos(); segAnterior = -1; girar();
  }

  el.addEventListener('pointerdown', () => { audio(); if (estado === 'girando') parar(); });

  medir(); montarSegmentos();
  window.addEventListener('resize', medir);
  abrirModal(el, {
    semFundo: true,
    aoFechar: () => {
      vivo = false; cancelAnimationFrame(raf); clearTimeout(autoTimer); musica?.parar(0.2);
      window.removeEventListener('resize', medir);
    },
  });
  raf = requestAnimationFrame(laco);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visivel')));
  rufar(1.3);
  setTimeout(() => { if (vivo && estado === 'subindo') girar(); }, 1350);
}
