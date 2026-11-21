// Abertura de 15 s em canvas: panela de barro sobre fogão a lenha; a tampa chacoalha,
// o vapor sobe, rodopia diante da câmera e forma "A REFEIÇÃO HOJE É...". Um toque pula.
import { h, clamp } from './util.js';
import { chiado, tampa } from './audio.js';

const DURACAO = 15;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, k) => a + (b - a) * k;

function sprite(cor, tam = 64) {
  const c = document.createElement('canvas'); c.width = c.height = tam;
  const g = c.getContext('2d'), r = tam / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, cor.replace('A', '1')); gr.addColorStop(0.35, cor.replace('A', '.55')); gr.addColorStop(1, cor.replace('A', '0'));
  g.fillStyle = gr; g.fillRect(0, 0, tam, tam); return c;
}

export function tocarAbertura() {
  return new Promise((resolver) => {
    const canvas = h('canvas');
    const el = h('div', { class: 'abertura', 'aria-label': 'Abertura. Toque para pular.' }, canvas, h('div', { class: 'pular' }, 'toque para pular'));
    document.body.append(el);
    const g = canvas.getContext('2d');
    let W, H, dpr;
    const medir = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    };
    medir(); window.addEventListener('resize', medir);

    const vapor = sprite('rgba(255,250,242,A)'), dourado = sprite('rgba(255,224,150,A)'), brasa = sprite('rgba(255,140,40,A)', 32);
    const textura = criarTextura();
    const parts = [], fagulhas = [];
    let alvos = null, inicio = performance.now(), ultimo = inicio, encerrado = false, faseTampa = 0;
    const som = chiado();

    // Geometria da cena (coordenadas de "mundo" = tela com zoom 1)
    const cena = () => {
      const SW = Math.min(W * 0.92, 560), sx = (W - SW) / 2, topo = H * 0.64;
      const pw = SW * 0.44, ph = pw * 0.72, pcx = sx + SW * 0.56;
      return { SW, sx, topo, pw, ph, pcx, base: topo, borda: topo - ph };
    };

    function camera(t, c) {
      const fx0 = W / 2, fy0 = H / 2, fx1 = c.pcx, fy1 = c.borda - c.ph * 0.15;
      if (t < 6) { const z = 1 + 0.07 * (t / 6); return { z, fx: fx0, fy: fy0, ax: W / 2, ay: H / 2 }; }
      const k = ease(clamp((t - 6) / 4.5, 0, 1));
      return { z: lerp(1.07, 2.5, k), fx: lerp(fx0, fx1, k), fy: lerp(fy0, fy1, k), ax: W / 2, ay: lerp(H / 2, H * 0.66, k) };
    }
    const naTela = (cam, x, y) => [cam.ax + (x - cam.fx) * cam.z, cam.ay + (y - cam.fy) * cam.z];

    function estadoTampa(t) {
      if (t < 3.2) return { dy: 0, ang: 0, amp: 0, dx: 0 };
      if (t < 7) {
        const amp = Math.pow((t - 3.2) / 3.8, 1.4);
        return { dy: -Math.abs(Math.sin(t * 36)) * amp * 7, ang: Math.sin(t * 29) * amp * 0.07, amp, dx: Math.sin(t * 23) * amp * 2 };
      }
      const k = easeOut(clamp((t - 7) / 0.7, 0, 1)), bal = Math.sin(t * 6) * 0.03;
      return { dy: -k * 70, ang: -k * 0.42 + bal, amp: 1, dx: -k * 34 };
    }

    function emitir(t, cam, c, dt) {
      let taxa = t < 3.2 ? 5 : t < 7 ? 14 + 30 * Math.pow((t - 3.2) / 3.8, 2) : t < 10.4 ? 260 : 0;
      let n = taxa * dt; const tamp = estadoTampa(t);
      while (n > 0 && parts.length < 2600) {
        if (n < 1 && Math.random() > n) break; n -= 1;
        const lado = Math.random() < 0.5 ? -1 : 1;
        const wx = c.pcx + (t < 7 ? lado * c.pw * (0.25 + Math.random() * 0.2) : (Math.random() - 0.5) * c.pw * 0.8);
        const wy = c.borda + tamp.dy * 0.6 - 4;
        const [x, y] = naTela(cam, wx, wy);
        const forte = t >= 7;
        parts.push({ x, y, vx: (Math.random() - 0.5) * 30 * cam.z, vy: -(forte ? 80 + Math.random() * 120 : 25 + Math.random() * 35) * cam.z,
          r: (forte ? 18 : 7) * cam.z * (0.6 + Math.random() * 0.8), a: 0, amax: forte ? 0.5 : 0.26, vida: 0,
          max: forte ? 3.6 + Math.random() * 2 : 2.2 + Math.random(), seed: Math.random() * 6.28 });
      }
    }

    function prepararLetras() {
      const off = document.createElement('canvas'); off.width = W; off.height = H;
      const o = off.getContext('2d');
      const fs = Math.min(W * 0.13, H * 0.085, 86);
      o.fillStyle = '#fff'; o.textAlign = 'center'; o.textBaseline = 'middle';
      o.font = `900 ${fs}px Georgia, 'Noto Serif', serif`;
      o.fillText('A REFEIÇÃO', W / 2, H * 0.4);
      o.fillText('HOJE É...', W / 2, H * 0.4 + fs * 1.3);
      const passo = Math.max(3, Math.round(fs / 12)), d = o.getImageData(0, 0, W, H).data, pts = [];
      for (let y = 0; y < H; y += passo) for (let x = 0; x < W; x += passo) if (d[(y * W + x) * 4 + 3] > 140) pts.push([x, y]);
      for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
      // garante partículas suficientes: cria novas dentro da nuvem
      while (parts.length < pts.length) {
        const b = parts[Math.floor(Math.random() * parts.length)] || { x: W / 2, y: H / 2, r: 20 };
        parts.push({ ...b, x: b.x + (Math.random() - 0.5) * 80, y: b.y + (Math.random() - 0.5) * 80, a: 0.2, vida: 0, max: 99, seed: Math.random() * 6.28 });
      }
      parts.forEach((p, i) => {
        if (i < pts.length) { p.tx = pts[i][0]; p.ty = pts[i][1]; p.sx = p.x; p.sy = p.y; p.sr = p.r; p.sa = Math.max(p.a, 0.15); p.rf = passo * 1.15; }
        else p.solto = true;
      });
      alvos = pts.length;
    }

    function quadro(agora) {
      if (encerrado) return;
      const t = (agora - inicio) / 1000, dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
      const c = cena(), cam = camera(t, c), tamp = estadoTampa(t), fogo = 0.78 + 0.12 * Math.sin(t * 13) + 0.1 * Math.sin(t * 31 + 1.3);

      // sons sincronizados
      if (t > 3.2 && t < 7) {
        const fase = Math.floor(t * 36 / Math.PI);
        if (fase !== faseTampa) { faseTampa = fase; if (Math.random() < tamp.amp * 0.85) tampa(0.12 + tamp.amp * 0.3); }
      }
      som.intensidade(t < 3.2 ? 0.25 : t < 7 ? 0.25 + 0.5 * tamp.amp : t < 10.5 ? 1 : 0.4);
      if (t > 7 && t < 7.05 && !quadro.estalou) { quadro.estalou = true; tampa(0.5); }

      // ---- cena em coordenadas de mundo ----
      g.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (cam.ax - cam.fx * cam.z), dpr * (cam.ay - cam.fy * cam.z));
      desenharFundo(g, c, fogo, textura);
      desenharFogao(g, c, t, fogo, fagulhas, brasa, dt);
      desenharPanela(g, c, tamp);

      // ---- vapor e letras em coordenadas de tela ----
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const escurece = clamp((t - 9.6) / 1.4, 0, 1) * 0.78;
      if (escurece > 0) { g.fillStyle = `rgba(14,7,3,${escurece})`; g.fillRect(0, 0, W, H); }
      if (t < 10.4) emitir(t, cam, c, dt);
      if (t >= 10.4 && !alvos) prepararLetras();

      const vx = W / 2 + Math.sin(t * 0.9) * W * 0.1, vy = lerp(H * 0.6, H * 0.36, clamp((t - 7) / 3, 0, 1));
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vida += dt;
        if (alvos && p.tx != null) {
          const q = ease(clamp((t - 10.4) / 2.0, 0, 1)), giro = (1 - q) * (1 - q) * 90, ang = p.seed + q * 7;
          p.x = lerp(p.sx, p.tx, q) + Math.cos(ang) * giro; p.y = lerp(p.sy, p.ty, q) + Math.sin(ang) * giro;
          if (t > 12.4) { p.x += Math.sin(t * 3 + p.seed * 5) * 0.6; p.y += Math.cos(t * 2.5 + p.seed * 3) * 0.6; }
          p.r = lerp(p.sr, p.rf, q); p.a = lerp(p.sa, 0.95, q);
          g.globalAlpha = p.a * (1 - q); g.drawImage(vapor, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
          g.globalAlpha = p.a * q; g.drawImage(dourado, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
          continue;
        }
        // redemoinho em volta de um vórtice que sobe e se aproxima
        const dx = p.x - vx, dy = p.y - vy, dist = Math.hypot(dx, dy) + 60;
        const forca = t > 7 ? 5200 : 1200;
        p.vx += (-dy / dist) * forca / dist * dt * 6 - dx * 0.15 * dt; p.vy += (dx / dist) * forca / dist * dt * 6 - 8 * dt;
        p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.r += dt * (t > 8.5 ? 26 : 9) * cam.z;          // cresce: vem para perto da câmera
        const vidaRel = p.vida / p.max;
        p.a = vidaRel < 0.15 ? p.amax * vidaRel / 0.15 : p.amax * (1 - (vidaRel - 0.15) / 0.85);
        if (p.solto) p.a *= clamp(1 - (t - 10.4) / 0.8, 0, 1);
        if (p.vida > p.max || p.a <= 0.002) { parts.splice(i, 1); continue; }
        g.globalAlpha = p.a; g.drawImage(vapor, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
      g.globalAlpha = 1;
      const entrada = clamp(1 - t / 1.1, 0, 1), saida = clamp((t - 14.2) / 0.8, 0, 1);
      if (entrada + saida > 0) { g.fillStyle = `rgba(0,0,0,${Math.max(entrada, saida)})`; g.fillRect(0, 0, W, H); }

      if (t >= DURACAO) return terminar();
      requestAnimationFrame(quadro);
    }

    function terminar() {
      if (encerrado) return; encerrado = true;
      som.parar(0.5);
      el.classList.add('saindo');
      window.removeEventListener('resize', medir);
      // a camada continua capturando toques durante o fade, evitando "toques fantasmas" na tela de baixo
      setTimeout(() => { el.remove(); resolver(); }, 650);
    }
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); terminar(); });
    el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
    requestAnimationFrame(quadro);
  });
}

// ---------- Desenho ----------
function criarTextura() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,220,180' : '20,8,2'},${Math.random() * 0.06})`;
    const s = 1 + Math.random() * 3; g.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  return c;
}

function desenharFundo(g, c, fogo, textura) {
  const W = g.canvas.width, H = g.canvas.height; // área grande o bastante sob qualquer zoom
  const gr = g.createLinearGradient(0, -200, 0, c.topo + 300);
  gr.addColorStop(0, '#1c0e07'); gr.addColorStop(0.6, '#3b2013'); gr.addColorStop(1, '#2a160c');
  g.fillStyle = gr; g.fillRect(-W, -H, W * 3, H * 3);
  g.save(); g.globalAlpha = 0.9; g.fillStyle = g.createPattern(textura, 'repeat'); g.fillRect(-W, -H, W * 3, H * 3); g.restore();
  // brilho quente do fogo na parede
  const cx = c.sx + c.SW * 0.3, cy = c.topo + c.SW * 0.18;
  const luz = g.createRadialGradient(cx, cy, 10, cx, cy, c.SW * 1.1);
  luz.addColorStop(0, `rgba(255,140,50,${0.32 * fogo})`); luz.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = luz; g.fillRect(-W, -H, W * 3, H * 3);
  // prateleira com potes ao fundo (silhuetas)
  g.fillStyle = 'rgba(15,6,2,.55)';
  g.fillRect(c.sx - 20, c.topo - c.ph * 2.45, c.SW * 0.55, 8);
  [[0.05, 34, 46], [0.17, 26, 36], [0.27, 40, 30], [0.4, 22, 44]].forEach(([fx, w, hh]) => {
    const x = c.sx + c.SW * fx; g.beginPath(); g.ellipse(x + w / 2, c.topo - c.ph * 2.45 - hh / 2, w / 2, hh / 2, 0, 0, Math.PI * 2); g.fill();
  });
}

function desenharFogao(g, c, t, fogo, fagulhas, brasa, dt) {
  const { sx, SW, topo } = c, alt = SW * 0.95;
  // chaminé
  const chx = sx + SW * 0.86;
  const cg = g.createLinearGradient(chx - 22, 0, chx + 22, 0);
  cg.addColorStop(0, '#1a1513'); cg.addColorStop(0.5, '#3a322d'); cg.addColorStop(1, '#141010');
  g.fillStyle = cg; g.fillRect(chx - 20, topo - c.ph * 4, 40, c.ph * 4);
  // corpo de alvenaria caiada
  const corpo = g.createLinearGradient(0, topo, 0, topo + alt);
  corpo.addColorStop(0, '#c9784a'); corpo.addColorStop(1, '#7c3a1f');
  g.fillStyle = corpo; roundRect(g, sx, topo + 6, SW, alt, 14); g.fill();
  // tijolinhos
  g.strokeStyle = 'rgba(70,25,10,.35)'; g.lineWidth = 2;
  for (let y = topo + 30, l = 0; y < topo + alt; y += 24, l++) {
    g.beginPath(); g.moveTo(sx + 4, y); g.lineTo(sx + SW - 4, y); g.stroke();
    for (let x = sx + (l % 2 ? 26 : 0); x < sx + SW; x += 52) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 24); g.stroke(); }
  }
  // chapa de ferro
  g.fillStyle = '#26201d'; roundRect(g, sx - 10, topo - 4, SW + 20, 20, 6); g.fill();
  g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(sx - 6, topo - 3, SW + 12, 3);
  g.strokeStyle = '#4a3f39'; g.lineWidth = 3;
  [[0.22, 0.13], [c.pcx - sx, 0]].forEach(([fx], i) => {
    const x = i ? c.pcx : sx + SW * fx; g.beginPath(); g.ellipse(x, topo + 4, SW * 0.14, 5, 0, 0, Math.PI * 2); g.stroke();
  });
  // boca da fornalha com fogo
  const bx = sx + SW * 0.1, bw = SW * 0.36, by = topo + alt * 0.18, bh = alt * 0.3;
  g.save();
  g.beginPath(); g.moveTo(bx, by + bh); g.lineTo(bx, by + bw / 2); g.arc(bx + bw / 2, by + bw / 2, bw / 2, Math.PI, 0); g.lineTo(bx + bw, by + bh); g.closePath();
  g.fillStyle = '#120704'; g.fill(); g.clip();
  const lg = g.createRadialGradient(bx + bw / 2, by + bh, 4, bx + bw / 2, by + bh, bw);
  lg.addColorStop(0, `rgba(255,170,60,${0.9 * fogo})`); lg.addColorStop(1, 'rgba(120,30,0,0)');
  g.fillStyle = lg; g.fillRect(bx, by, bw, bh);
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 7; k++) {
    const fx = bx + bw * (0.15 + k * 0.12), alt2 = bh * (0.45 + 0.3 * Math.sin(t * (7 + k) + k * 1.7) * 0.5 + 0.25 * Math.sin(t * 17 + k));
    const fl = g.createLinearGradient(0, by + bh, 0, by + bh - alt2);
    fl.addColorStop(0, 'rgba(255,230,140,.9)'); fl.addColorStop(0.45, 'rgba(255,130,30,.75)'); fl.addColorStop(1, 'rgba(200,40,0,0)');
    g.fillStyle = fl;
    const lw = bw * 0.11, sway = Math.sin(t * 5 + k) * lw * 0.6;
    g.beginPath(); g.moveTo(fx - lw, by + bh);
    g.quadraticCurveTo(fx - lw * 1.1 + sway, by + bh - alt2 * 0.55, fx + sway * 1.6, by + bh - alt2);
    g.quadraticCurveTo(fx + lw * 1.1 + sway, by + bh - alt2 * 0.55, fx + lw, by + bh); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  // lenha
  g.fillStyle = '#3a1f10';
  g.save(); g.translate(bx + bw * 0.5, by + bh - 8); g.rotate(-0.18); roundRect(g, -bw * 0.38, -7, bw * 0.76, 14, 6); g.fill(); g.restore();
  g.save(); g.translate(bx + bw * 0.5, by + bh - 6); g.rotate(0.22); roundRect(g, -bw * 0.36, -6, bw * 0.72, 12, 6); g.fill(); g.restore();
  g.restore();
  // moldura da boca
  g.strokeStyle = '#2a120a'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(bx, by + bh); g.lineTo(bx, by + bw / 2); g.arc(bx + bw / 2, by + bw / 2, bw / 2, Math.PI, 0); g.lineTo(bx + bw, by + bh); g.stroke();
  // porta do cinzeiro
  g.fillStyle = '#2b2420'; roundRect(g, bx + bw * 0.15, by + bh + alt * 0.1, bw * 0.7, alt * 0.12, 5); g.fill();
  // fagulhas
  if (Math.random() < dt * 9) fagulhas.push({ x: bx + bw * (0.3 + Math.random() * 0.4), y: by + bh * 0.6, vy: -20 - Math.random() * 30, vx: (Math.random() - 0.5) * 12, v: 0 });
  g.globalCompositeOperation = 'lighter';
  for (let i = fagulhas.length - 1; i >= 0; i--) {
    const f = fagulhas[i]; f.v += dt; f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.v > 1.4 || f.y < by + 4) { fagulhas.splice(i, 1); continue; }
    g.globalAlpha = 1 - f.v / 1.4; g.drawImage(brasa, f.x - 4, f.y - 4, 8, 8);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

function desenharPanela(g, c, tamp) {
  const { pcx: cx, base, pw: w, ph: hh } = c, borda = base - hh;
  // sombra
  g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(cx, base + 2, w * 0.46, 7, 0, 0, Math.PI * 2); g.fill();
  // alças
  g.strokeStyle = '#8f4122'; g.lineWidth = Math.max(5, w * 0.045); g.lineCap = 'round';
  [[-1], [1]].forEach(([s]) => { g.beginPath(); g.ellipse(cx + s * w * 0.55, borda + hh * 0.3, w * 0.07, hh * 0.1, 0, s < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, s < 0 ? Math.PI * 1.5 : Math.PI * 0.5); g.stroke(); });
  // corpo bojudo
  g.beginPath();
  g.moveTo(cx - w * 0.36, base);
  g.bezierCurveTo(cx - w * 0.64, base - hh * 0.12, cx - w * 0.6, borda + hh * 0.12, cx - w * 0.45, borda);
  g.lineTo(cx + w * 0.45, borda);
  g.bezierCurveTo(cx + w * 0.6, borda + hh * 0.12, cx + w * 0.64, base - hh * 0.12, cx + w * 0.36, base);
  g.closePath();
  const corpo = g.createLinearGradient(cx - w * 0.6, 0, cx + w * 0.6, 0);
  corpo.addColorStop(0, '#5a220d'); corpo.addColorStop(0.3, '#b9572c'); corpo.addColorStop(0.42, '#e4925c');
  corpo.addColorStop(0.6, '#b4512a'); corpo.addColorStop(1, '#4e1d0b');
  g.fillStyle = corpo; g.fill();
  // faixa pintada (pontinhos e ondas brancas)
  g.save(); g.clip();
  g.strokeStyle = 'rgba(250,230,200,.55)'; g.lineWidth = 2.5;
  const fy = borda + hh * 0.42;
  g.beginPath();
  for (let x = cx - w * 0.62; x <= cx + w * 0.62; x += 4) g.lineTo(x, fy + Math.sin((x - cx) / (w * 0.05)) * hh * 0.035);
  g.stroke();
  g.fillStyle = 'rgba(250,230,200,.6)';
  for (let x = cx - w * 0.55; x <= cx + w * 0.55; x += w * 0.085) { g.beginPath(); g.arc(x, fy + hh * 0.13, 2.4, 0, Math.PI * 2); g.fill(); }
  g.restore();
  // borda
  g.fillStyle = '#9b4421'; g.beginPath(); g.ellipse(cx, borda, w * 0.47, hh * 0.085, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a0f05'; g.beginPath(); g.ellipse(cx, borda, w * 0.41, hh * 0.055, 0, 0, Math.PI * 2); g.fill();
  // tampa
  g.save();
  g.translate(cx + tamp.dx, borda + tamp.dy); g.rotate(tamp.ang);
  const tg = g.createLinearGradient(-w * 0.45, 0, w * 0.45, 0);
  tg.addColorStop(0, '#5e240e'); tg.addColorStop(0.4, '#cf7140'); tg.addColorStop(1, '#5a210c');
  g.fillStyle = tg;
  g.beginPath(); g.ellipse(0, -2, w * 0.44, hh * 0.075, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(0, -2, w * 0.4, hh * 0.3, 0, Math.PI, 0); g.fill();
  g.fillStyle = 'rgba(255,220,180,.18)'; g.beginPath(); g.ellipse(-w * 0.12, -hh * 0.17, w * 0.12, hh * 0.06, -0.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#7a3014'; g.beginPath(); g.ellipse(0, -hh * 0.31, w * 0.075, hh * 0.06, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#b75a2d'; g.beginPath(); g.ellipse(0, -hh * 0.33, w * 0.06, hh * 0.035, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

function roundRect(g, x, y, w, hh, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r);
  g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
