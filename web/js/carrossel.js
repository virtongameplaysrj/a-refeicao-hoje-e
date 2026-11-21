// Carrossel de cartões 3D arrastável com inércia e "encaixe" no cartão mais próximo.
import { h, clamp } from './util.js';

/**
 * criarCarrossel(itens, {inicial, render(item)->el, aoMudar(i), aoParar(i), aoTocar(i)})
 * Devolve {el, irPara(i), destruir()}
 */
export function criarCarrossel(itens, { inicial = 0, render, aoMudar, aoParar, aoTocar }) {
  const el = h('div', { class: 'carrossel', tabindex: '0', role: 'listbox', 'aria-label': 'Pratos' });
  const cards = itens.map((it, i) => { const c = h('div', { class: 'item', role: 'option' }, render(it)); c.dataset.i = i; el.append(c); return c; });
  const n = itens.length;
  let pos = clamp(inicial, 0, Math.max(0, n - 1)), vel = 0, arrastando = false, animando = false, atual = -1, raf = 0;
  let x0 = 0, pos0 = 0, amostras = [], moveu = 0, alvo = null, parado = true;
  const espaco = () => Math.min(130, Math.max(84, el.clientWidth * 0.26));   // px por cartão

  function layout() {
    for (let i = 0; i < n; i++) {
      const d = i - pos, ad = Math.abs(d), c = cards[i];
      if (ad > 4.5) { c.style.visibility = 'hidden'; continue; }
      c.style.visibility = 'visible';
      const x = d * espaco() * (ad > 1 ? 0.8 + 0.2 / ad : 1);
      c.style.transform = `translateX(${x}px) translateZ(${-ad * 130}px) rotateY(${clamp(-d, -1.4, 1.4) * 40}deg) scale(${1 - Math.min(ad, 3) * 0.05})`;
      c.style.zIndex = String(100 - Math.round(ad * 10));
      c.style.opacity = String(clamp(1.2 - (ad - 2.6) * 0.6, 0, 1));
      c.style.filter = ad > 0.5 ? `brightness(${1 - Math.min(ad, 3) * 0.17})` : 'none';
    }
    const r = clamp(Math.round(pos), 0, n - 1);
    if (r !== atual) {
      cards[atual]?.classList.remove('atual'); atual = r; cards[r]?.classList.add('atual');
      aoMudar?.(r);
    }
  }

  function passo() {
    raf = 0;
    if (arrastando) return;
    if (alvo == null) {
      pos += vel; vel *= 0.93;
      if (pos < 0 || pos > n - 1) vel *= 0.6;          // elástico nas pontas
      if (Math.abs(vel) < 0.012) alvo = clamp(Math.round(pos + vel * 4), 0, n - 1);
    }
    if (alvo != null) {
      pos += (alvo - pos) * 0.18;
      if (Math.abs(alvo - pos) < 0.002) { pos = alvo; layout(); animando = false; alvo = null; vel = 0; if (!parado) { parado = true; aoParar?.(atual); } return; }
    }
    layout();
    raf = requestAnimationFrame(passo);
  }
  const animar = () => { animando = true; parado = false; if (!raf) raf = requestAnimationFrame(passo); };

  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    arrastando = true; moveu = 0; x0 = e.clientX; pos0 = pos; vel = 0; alvo = null; amostras = [[e.timeStamp, e.clientX]];
    el.setPointerCapture?.(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!arrastando) return;
    const dx = e.clientX - x0; moveu = Math.max(moveu, Math.abs(dx));
    let p = pos0 - dx / espaco();
    if (p < 0) p *= 0.35; if (p > n - 1) p = n - 1 + (p - (n - 1)) * 0.35;
    if (moveu > 3 && parado) parado = false;
    pos = p; amostras.push([e.timeStamp, e.clientX]); if (amostras.length > 6) amostras.shift();
    layout();
  });
  const soltar = (e) => {
    if (!arrastando) return; arrastando = false;
    if (moveu < 6) {                                       // foi um toque
      const card = e.target.closest?.('.item');
      const i = card ? +card.dataset.i : atual;
      if (i === atual && card) { aoTocar?.(i); parado = true; return; }
      alvo = i; animar(); return;
    }
    const [t0, xa] = amostras[0], [t1, xb] = amostras[amostras.length - 1];
    const vpx = (xb - xa) / Math.max(16, t1 - t0);          // px/ms
    vel = clamp((-vpx * 16) / espaco(), -1.2, 1.2);         // cartões por quadro
    animar();
  };
  el.addEventListener('pointerup', soltar);
  el.addEventListener('pointercancel', soltar);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { alvo = clamp(atual + 1, 0, n - 1); animar(); }
    if (e.key === 'ArrowLeft') { alvo = clamp(atual - 1, 0, n - 1); animar(); }
    if (e.key === 'Enter') aoTocar?.(atual);
  });
  const aoRedim = () => layout();
  window.addEventListener('resize', aoRedim);

  requestAnimationFrame(() => { layout(); aoParar?.(atual); });
  return {
    el,
    irPara(i) { alvo = clamp(i, 0, n - 1); animar(); },
    get atual() { return atual; },
    destruir() { cancelAnimationFrame(raf); window.removeEventListener('resize', aoRedim); },
  };
}
