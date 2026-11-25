// Sessão "Cozinhando agora": guarda a hora de início (o cronômetro continua com o app fechado)
// e os timers de passo com alarme sonoro.
import { ler, gravar, alterar } from './store.js';
import { alarme } from './audio.js';
import { toast, vibrar } from './util.js';

/** Encontra tempos citados num passo: "asse por 40 minutos", "1 hora e meia", "de 30 a 40 min". */
export function temposNoPasso(txt) {
  const achados = [];
  const re = /(\d+)(?:\s*(?:a|ou|-|–)\s*(\d+))?\s*(horas?|h\b|minutos?|min\b)(\s*e\s*meia)?/gi;
  let m;
  while ((m = re.exec(txt))) {
    const n = Math.max(+m[1], +(m[2] || 0)), hora = /^h/i.test(m[3]);
    let seg = n * (hora ? 3600 : 60);
    if (m[4] && hora) seg += 1800;
    if (seg >= 60 && seg <= 6 * 3600) achados.push({ seg, rotulo: m[0].trim() });
  }
  if (!achados.length && /meia hora/i.test(txt)) achados.push({ seg: 1800, rotulo: 'meia hora' });
  const vistos = new Set();
  return achados.filter((a) => (vistos.has(a.seg) ? false : vistos.add(a.seg)));
}

// ---------- Sessão com várias panelas (ex.: bife + arroz + feijão) ----------
/** Começa um preparo novo com estes pratos, todos com o mesmo número de porções. O primeiro fica em foco. */
export function iniciarCozinha(pratos, porcoes) {
  const lista = [].concat(pratos);
  gravar('cozinhando', { inicio: Date.now(), ativa: lista[0].id, panelas: lista.map((p) => ({ id: p.id, porcoes, passo: 0, pronto: false })), timers: [] });
}
/** Põe mais uma panela no preparo em andamento (sem zerar o cronômetro). */
export function juntarPanela(prato, porcoes) {
  alterar('cozinhando', (c) => {
    if (!c) return;
    if (!c.panelas.some((pa) => pa.id === prato.id)) c.panelas.push({ id: prato.id, porcoes, passo: 0, pronto: false });
    c.ativa = prato.id;
  });
}
export function tirarPanela(id) {
  alterar('cozinhando', (c) => {
    if (!c) return;
    c.panelas = c.panelas.filter((pa) => pa.id !== id);
    if (c.ativa === id) c.ativa = c.panelas[0]?.id;
  });
  if (!ler('cozinhando')?.panelas.length) gravar('cozinhando', null);
}
export const panelasEmPreparo = () => ler('cozinhando')?.panelas || [];
/** Liga um timer; devolve false se esse mesmo timer já está correndo (toque repetido no botão). */
export function criarTimer(seg, rotulo) {
  let criou = false;
  alterar('cozinhando', (c) => {
    if (!c || c.timers.some((t) => t.rotulo === rotulo && t.fim > Date.now())) return;
    c.timers.push({ id: Date.now(), rotulo, total: seg, fim: Date.now() + seg * 1000, avisado: false }); criou = true;
  });
  return criou;
}

let tocando = null;
const tocandoIds = new Set();
export const timerTocando = (id) => tocandoIds.has(id);

export function removerTimer(id) {
  alterar('cozinhando', (c) => { if (c) c.timers = c.timers.filter((t) => t.id !== id); });
  tocandoIds.delete(id);
  if (!tocandoIds.size) { tocando?.parar(); tocando = null; }
}
export function pararAlarme() { tocando?.parar(); tocando = null; tocandoIds.clear(); }

/** Chamado a cada segundo pelo app: dispara alarmes vencidos. */
export function verificarTimers(ir) {
  const c = ler('cozinhando');
  if (!c?.timers?.length) return;
  let mudou = false;
  for (const t of c.timers) {
    if (Date.now() >= t.fim && !tocandoIds.has(t.id)) {
      tocandoIds.add(t.id);
      if (!tocando) tocando = alarme();
      vibrar(600);
      if (!t.avisado) {
        t.avisado = true; mudou = true;
        if (!location.hash.startsWith('#/cozinhando')) toast(`⏰ Acabou o tempo: ${t.rotulo}`, { acao: 'Ver', aoAcao: () => ir('cozinhando'), ms: 9000 });
      }
    }
  }
  if (mudou) gravar('cozinhando', c);
}
