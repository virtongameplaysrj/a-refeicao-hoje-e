// Todos os sons são sintetizados na hora com Web Audio — nenhum arquivo de áudio.
let ctx = null, mestre = null, bufRuido = null;

export function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    mestre = ctx.createGain(); mestre.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    mestre.connect(comp); comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
/** Desbloqueia o áudio no primeiro toque (navegadores exigem gesto). */
export function prepararDesbloqueio() {
  const f = () => { audio(); };
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, f, { capture: true, passive: true }));
}
export const audioLiberado = () => !!ctx && ctx.state === 'running';

function ruido() {
  if (!bufRuido) {
    bufRuido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = bufRuido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource(); s.buffer = bufRuido; s.loop = true; return s;
}
function env(g, t, a, pico, dur, fim = 0.0001) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + a);
  g.gain.exponentialRampToValueAtTime(fim, t + a + dur);
}
function osc(tipo, freq, t, dur, vol, destino = mestre, a = 0.005) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = tipo; o.frequency.setValueAtTime(freq, t);
  env(g, t, a, vol, dur);
  o.connect(g); g.connect(destino); o.start(t); o.stop(t + a + dur + 0.05);
  return o;
}
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// ---------- Efeitos curtos ----------
export function tique(vol = 0.18) {
  if (!audio()) return; const t = ctx.currentTime;
  osc('square', 1900, t, 0.025, vol); osc('triangle', 950, t, 0.03, vol * 0.6);
}
export function tampa(vol = 0.35) {
  if (!audio()) return; const t = ctx.currentTime;
  osc('triangle', 2350 + Math.random() * 300, t, 0.07, vol);
  osc('sine', 3700 + Math.random() * 400, t, 0.05, vol * 0.5);
  const n = ruido(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 3;
  env(g, t, 0.002, vol * 0.4, 0.04); n.connect(bp); bp.connect(g); g.connect(mestre); n.start(t); n.stop(t + 0.08);
}

/** Rufar de caixa: rajadas de ruído cada vez mais fortes, terminando num golpe. */
export function rufar(dur = 1.5) {
  if (!audio()) return; const t0 = ctx.currentTime;
  const n = ruido(), hp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  hp.type = 'highpass'; hp.frequency.value = 900; bp.type = 'peaking'; bp.frequency.value = 2500; bp.gain.value = 6;
  n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(mestre);
  g.gain.setValueAtTime(0.0001, t0);
  const passo = 1 / 26;
  for (let t = 0; t < dur; t += passo) {
    const v = 0.05 + 0.3 * (t / dur) ** 1.6 * (0.8 + Math.random() * 0.4);
    g.gain.setValueAtTime(v, t0 + t); g.gain.exponentialRampToValueAtTime(v * 0.15, t0 + t + passo * 0.9);
  }
  g.gain.setValueAtTime(0.5, t0 + dur); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.35);
  n.start(t0); n.stop(t0 + dur + 0.4);
  osc('sine', 110, t0 + dur, 0.35, 0.6); osc('triangle', 70, t0 + dur, 0.4, 0.4);
}

/** Ta-dá: dois acordes de metais (dente-de-serra filtrado) + prato. */
export function taDa() {
  if (!audio()) return; const t = ctx.currentTime;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.connect(mestre);
  const acorde = (notas, ini, dur, vol) => notas.forEach((m) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = hz(m); vib.frequency.value = 5.5; vg.gain.value = hz(m) * 0.006;
    vib.connect(vg); vg.connect(o.frequency);
    env(g, t + ini, 0.02, vol, dur); o.connect(g); g.connect(lp);
    o.start(t + ini); vib.start(t + ini); o.stop(t + ini + dur + 0.1); vib.stop(t + ini + dur + 0.1);
  });
  acorde([67, 72, 76], 0, 0.14, 0.09);
  acorde([72, 76, 79, 84], 0.18, 1.3, 0.1);
  const n = ruido(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
  hp.type = 'highpass'; hp.frequency.value = 5000; env(g, t + 0.18, 0.005, 0.25, 1.1);
  n.connect(hp); hp.connect(g); g.connect(mestre); n.start(t + 0.18); n.stop(t + 1.5);
}

/** Chiado de panela: ruído agudo com estalinhos e borbulhas. Devolve {intensidade(v), parar()} */
export function chiado() {
  if (!audio()) return { intensidade() {}, parar() {} };
  const t = ctx.currentTime;
  const n = ruido(), hp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  hp.type = 'highpass'; hp.frequency.value = 2800;
  g.gain.value = 0.0001; lfo.frequency.value = 7; lg.gain.value = 0.015;
  lfo.connect(lg); lg.connect(g.gain);
  n.connect(hp); hp.connect(g); g.connect(mestre); n.start(t); lfo.start(t);
  let nivel = 0.2, vivo = true;
  g.gain.setTargetAtTime(0.03 * nivel, t, 0.3);
  const pops = setInterval(() => {
    if (!vivo) return;
    const agora = ctx.currentTime;
    if (Math.random() < 0.35 + nivel * 0.5) { // estalinho de gordura
      const s = ruido(), f = ctx.createBiquadFilter(), gg = ctx.createGain();
      f.type = 'bandpass'; f.frequency.value = 3000 + Math.random() * 4000; f.Q.value = 2;
      env(gg, agora, 0.001, 0.05 + nivel * 0.12, 0.02 + Math.random() * 0.03);
      s.connect(f); f.connect(gg); gg.connect(mestre); s.start(agora); s.stop(agora + 0.08);
    }
    if (Math.random() < 0.25 + nivel * 0.4) { // borbulha
      const o = ctx.createOscillator(), gg = ctx.createGain(), f0 = 180 + Math.random() * 260;
      o.type = 'sine'; o.frequency.setValueAtTime(f0, agora); o.frequency.exponentialRampToValueAtTime(f0 * 2.2, agora + 0.06);
      env(gg, agora, 0.004, 0.04 + nivel * 0.06, 0.06); o.connect(gg); gg.connect(mestre); o.start(agora); o.stop(agora + 0.1);
    }
  }, 70);
  return {
    intensidade(v) { nivel = v; g.gain.setTargetAtTime(0.012 + 0.07 * v, ctx.currentTime, 0.25); },
    parar(fade = 0.6) {
      vivo = false; clearInterval(pops);
      const a = ctx.currentTime; g.gain.cancelScheduledValues(a); g.gain.setTargetAtTime(0.0001, a, fade / 3);
      n.stop(a + fade + 0.2); lfo.stop(a + fade + 0.2);
    },
  };
}

/** Alarme do timer: bipes repetidos até parar(). */
export function alarme() {
  if (!audio()) return { parar() {} };
  const tocar = () => { const t = ctx.currentTime; [0, 0.18, 0.36].forEach((d, i) => osc('square', i === 2 ? 1320 : 880, t + d, 0.12, 0.16)); };
  tocar(); const id = setInterval(tocar, 1100);
  return { parar() { clearInterval(id); } };
}

// ---------- Marchinha de circo (melodia original) ----------
// Compasso 2/4 em colcheias. -1 = sustenta a nota anterior, 0 = pausa.
const MELODIA = [
  67, 69, 71, 72, 76, -1, 74, 72, 74, 76, 74, 71, 67, -1, -1, 0,
  69, 71, 72, 74, 77, -1, 76, 74, 76, 79, 78, 79, 72, -1, -1, 0,
  76, 75, 76, 79, 84, -1, 83, 81, 79, 78, 79, 76, 72, -1, -1, 0,
  74, 73, 74, 77, 81, -1, 79, 77, 76, 74, 67, 71, 72, -1, 84, 0,
];
// Acorde por compasso (fundamental MIDI + tríade)
const C = [48, [60, 64, 67]], G7 = [43, [59, 62, 65]], F = [41, [60, 65, 69]], Am = [45, [60, 64, 69]], Dm = [50, [62, 65, 69]];
const ACORDES = [C, C, G7, G7, F, G7, C, C, C, Am, C, C, Dm, Dm, G7, C];

export function marchinha() {
  if (!audio()) return { tempo() {}, parar() {} };
  const saida = ctx.createGain(); saida.gain.value = 0.85; saida.connect(mestre);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(saida);
  let fator = 1, passo = 0, proxima = ctx.currentTime + 0.05, vivo = true;
  const colcheia = () => (60 / 168) / 2 / fator;
  const agendar = (i, t) => {
    const m = MELODIA[i % MELODIA.length];
    if (m > 0) {
      let dur = colcheia() * 0.85, k = i + 1;
      while (MELODIA[k % MELODIA.length] === -1) { dur += colcheia(); k++; }
      osc('square', hz(m), t, dur * 0.9, 0.055, lp, 0.01);
      osc('triangle', hz(m + 12), t, dur * 0.6, 0.02, lp, 0.01);
    }
    const [raiz, triade] = ACORDES[Math.floor(i / 4) % ACORDES.length];
    const pos = i % 4;
    if (pos === 0 || pos === 2) osc('triangle', hz(pos === 0 ? raiz : raiz + 7), t, colcheia() * 0.8, 0.22, saida, 0.005); // "pum"
    else triade.forEach((n) => osc('sawtooth', hz(n), t, colcheia() * 0.45, 0.018, lp, 0.004));          // "pá"
    if (pos === 0 && Math.floor(i / 4) % 2 === 0) { // prato leve
      const s = ruido(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = 7000;
      env(g, t, 0.002, 0.05, 0.12); s.connect(f); f.connect(g); g.connect(saida); s.start(t); s.stop(t + 0.2);
    }
  };
  const relogio = setInterval(() => {
    if (!vivo) return;
    while (proxima < ctx.currentTime + 0.15) { agendar(passo, proxima); proxima += colcheia(); passo++; }
  }, 30);
  return {
    tempo(f) { fator = Math.max(0.3, f); },
    parar(fade = 0.4) {
      vivo = false; clearInterval(relogio);
      const t = ctx.currentTime; saida.gain.setTargetAtTime(0.0001, t, fade / 3);
      setTimeout(() => saida.disconnect(), (fade + 0.5) * 1000);
    },
  };
}
