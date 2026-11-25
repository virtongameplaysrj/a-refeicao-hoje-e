// Telas: Receita, Cozinhando agora, Lista de compras, Meu histórico, Meu prato.
import { h, trocar, normalizar, toast, textoIngrediente, formatarMinutos, formatarRelogio, formatarData, copiarTexto, compartilharTexto, clamp, concordar } from './util.js';
import { ler, gravar, alterar, favorito, favoritar, desfavoritar, registrarRefeicao, exportarBackup, importarBackup } from './store.js';
import { CATEGORIAS, MEUS, categoriaPorNome, porId, reindexar, meusPratos, fotoDe, tipoDe, ROTULO_TIPO, TIPOS, esperaHoras, textoEspera, tempoTotal } from './catalogo.js';
import { dialogo, confirmar } from './modal.js';
import { temposNoPasso, iniciarCozinha, juntarPanela, tirarPanela, criarTimer, removerTimer, pararAlarme } from './cozinha.js';
import { topo, imgPrato, estrelasEl, creditoFoto, linkYoutube } from './telas.js';
import { ir, voltar, substituir } from './nav.js';

const porcoesTxt = (n) => `${n} porç${n > 1 ? 'ões' : 'ão'}`;
const ROT_RESTR = { vegetariano: '🌱 vegetariano', 'sem-lactose': 'sem lactose', 'sem-gluten': 'sem glúten' };
const naoEncontrado = (t) => ({ el: h('main', { class: 'tela' }, topo(t), h('div', { class: 'vazio' }, h('div', { class: 'grande-ico' }, '🤷'), h('p', null, 'Prato não encontrado.'))) });

// ---------- 7. Receita ----------
export function telaReceita(id) {
  const p = porId(id);
  if (!p) return naoEncontrado('Receita');
  const rend = p.rendimento || 2;
  let porcoes = +(sessionStorage.getItem('porcoes.' + p.id) || rend);
  const ings = h('ul', { class: 'ings' });
  const valorPorcoes = h('b');
  const desenharIngs = () => {
    valorPorcoes.textContent = porcoes;
    trocar(ings, ...p.ingredientes.map((i) => h('li', null, textoIngrediente(i, porcoes / rend))));
  };
  const mudar = (d) => { porcoes = clamp(porcoes + d, 1, 40); sessionStorage.setItem('porcoes.' + p.id, porcoes); desenharIngs(); };
  const temReceita = p.ingredientes.length || p.passos.length;
  const escolhidos = new Set((p.vaiBemCom || []).filter((id) => porId(id)));   // todos marcados de início
  const btnCozinhar = h('button', { class: 'btn primario bloco', onClick: () => comecar(p, porcoes, [...escolhidos].map(porId).filter(Boolean)) });
  const pintarCozinhar = () => { const n = escolhidos.size; btnCozinhar.textContent = n ? `🔥 Cozinhar com ${n} acompanhamento${n > 1 ? 's' : ''}` : '🔥 Começar a cozinhar'; };
  pintarCozinhar();
  const cat = categoriaPorNome(p.categoria);

  const btnFav = h('button', { class: 'btn' });
  const pintarFav = () => { const f = favorito(p.id); btnFav.textContent = f ? '❤️ Nos favoritos' : '🤍 Favoritar'; btnFav.classList.toggle('milho', !!f); };
  btnFav.addEventListener('click', () => {
    if (favorito(p.id)) { desfavoritar(p.id); toast('Removido dos favoritos'); } else { favoritar(p.id, 3); toast('❤️ Adicionado aos favoritos'); }
    pintarFav();
  });
  pintarFav();

  const el = h('main', { class: 'tela receita' },
    h('div', { class: 'heroi' }, imgPrato(p, { loading: 'eager' }), h('button', { class: 'voltar', 'aria-label': 'Voltar', onClick: voltar }, '←')),
    h('h1', null, p.nome),
    h('div', { class: 'etiquetas' },
      h('button', { class: 'etq', style: { border: 0, cursor: 'pointer' }, onClick: () => ir('cat/' + cat.slug) }, `${cat.icone} ${cat.nome}`),
      tipoDe(p) !== 'principal' && h('span', { class: 'etq' }, ROTULO_TIPO[tipoDe(p)]),
      p.regiao && h('span', { class: 'etq' }, `📍 ${p.regiao}`),
      (p.refeicao || []).map((r) => h('span', { class: 'etq' }, r)),
      (p.restricoes || []).map((r) => h('span', { class: 'etq verde' }, ROT_RESTR[r] || r))),
    p.descricao && h('p', { class: 'desc' }, p.descricao),
    esperaHoras(p) ? h('div', { class: 'caixa dica' }, h('b', null, `⏳ ${textoEspera(esperaHoras(p)).replace(/^\+/, '').replace(/^./, (c) => c.toUpperCase())}`),
      `${p.tempoMin ? `Além dos ${formatarMinutos(p.tempoMin)} de preparo, esta` : 'Esta'} receita pede ${esperaHoras(p) >= 36 ? `${Math.round(esperaHoras(p) / 24)} dias` : `${esperaHoras(p)} horas`} de espera (molho, marinada ou geladeira). Planeje antes de começar.`) : null,
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', null, p.tempoMin ? formatarMinutos(p.tempoMin) : '—'), h('small', null, 'tempo')),
      h('div', { class: 'stat' }, h('b', null, p.dificuldade || '—'), h('small', null, 'dificuldade')),
      h('div', { class: 'stat' }, h('b', null, { Barato: '$', 'Médio': '$$', Caro: '$$$' }[p.custo] || '—'), h('small', null, p.custo || 'custo')),
      h('div', { class: 'stat' }, h('b', null, rend), h('small', null, 'porções'))),
    temReceita ? null : h('div', { class: 'card' }, h('p', null, 'Esta receita ainda não foi escrita. Veja um vídeo no YouTube ou edite o prato para anotar a sua.')),
    p.ingredientes.length ? [
      h('h2', { class: 'secao' }, '🧺 Ingredientes'),
      h('div', { class: 'porcoes' }, h('span', null, 'Porções'),
        h('div', { class: 'ctrl' }, h('button', { 'aria-label': 'Menos porções', onClick: () => mudar(-1) }, '−'), valorPorcoes, h('button', { 'aria-label': 'Mais porções', onClick: () => mudar(1) }, '+'))),
      ings] : null,
    blocoVaiBemCom(p, escolhidos, pintarCozinhar),
    p.passos.length ? [h('h2', { class: 'secao' }, '👩‍🍳 Modo de preparo'), h('ol', { class: 'passos' }, p.passos.map((s) => h('li', null, s)))] : null,
    p.dica && h('div', { class: 'caixa dica' }, h('b', null, '💡 Dica do chef'), p.dica),
    p.curiosidade && h('div', { class: 'caixa curio' }, h('b', null, '📜 Curiosidade'), p.curiosidade),
    creditoFoto(p), linkYoutube(p),
    p.meu && h('div', { class: 'btns dois' },
      h('button', { class: 'btn pequeno', onClick: () => ir('meu-prato/' + encodeURIComponent(p.id)) }, '✏️ Editar'),
      h('button', { class: 'btn pequeno fantasma', onClick: () => excluirMeuPrato(p) }, '🗑️ Excluir')),
    h('div', { class: 'acoes-fixas' },
      h('div', { class: 'btns dois', style: { margin: 0 } }, btnFav,
        h('button', { class: 'btn', disabled: !p.ingredientes.length, onClick: () => adicionarNaLista(p, porcoes, [...escolhidos].map(porId).filter(Boolean)) }, '🛒 Lista')),
      btnCozinhar),
  );
  desenharIngs();
  return { el };
}

/** Põe o prato (e os acompanhamentos escolhidos, na mesma quantidade de porções) na lista de compras. */
function adicionarNaLista(p, porcoes, extras = []) {
  alterar('lista', (l) => {
    for (const x of [p, ...extras]) {
      if (!x.ingredientes.length) continue;
      const fator = porcoes / (x.rendimento || 2);
      const itens = x.ingredientes.map((i) => ({ item: i.item, unidade: i.unidade, quantidade: i.quantidade == null ? null : +(i.quantidade * fator).toFixed(3) }));
      const r = { receitaId: x.id, nome: x.nome, porcoes, itens };
      const k = l.findIndex((y) => y.receitaId === x.id);
      if (k >= 0) l[k] = r; else l.push(r);
    }
  });
  const mais = extras.length ? ` + ${extras.length} acompanhamento${extras.length > 1 ? 's' : ''}` : '';
  toast(`🛒 ${p.nome}${mais} na lista`, { acao: 'Ver lista', aoAcao: () => ir('lista') });
}

/** "Vai bem com": acompanhamentos sugeridos, cada um com caixinha para ir junto para a lista. */
function blocoVaiBemCom(p, escolhidos, aoMudar) {
  const acomp = (p.vaiBemCom || []).map(porId).filter(Boolean);
  if (!acomp.length) return null;
  return [
    h('h2', { class: 'secao' }, '🍽️ Vai bem com'),
    h('div', { class: 'card vai-bem' },
      acomp.map((a) => {
        const cb = h('input', { type: 'checkbox', checked: escolhidos.has(a.id), 'aria-label': `Levar ${a.nome} para a lista` });
        cb.addEventListener('click', (e) => e.stopPropagation());
        cb.addEventListener('change', () => { if (cb.checked) escolhidos.add(a.id); else escolhidos.delete(a.id); aoMudar?.(); });
        return h('div', { class: 'hist-item', role: 'button', style: { cursor: 'pointer' }, onClick: () => ir('receita/' + encodeURIComponent(a.id)) },
          imgPrato(a),
          h('div', null, a.nome, h('small', null, [ROTULO_TIPO[tipoDe(a)], a.tempoMin && formatarMinutos(a.tempoMin),
            esperaHoras(a) && `⏳ ${textoEspera(esperaHoras(a))}`].filter(Boolean).join(' · '))),
          cb);
      }),
      h('small', { style: { display: 'block', color: 'var(--suave)', marginTop: '8px' } }, 'Os marcados vão junto para a 🛒 Lista e para o 🔥 preparo, na mesma quantidade de porções. Toque no nome para ver a receita.')),
  ];
}

/** Começa a cozinhar o prato e os acompanhamentos marcados; se já houver preparo, oferece juntar ou trocar. */
async function comecar(p, porcoes, extras = []) {
  const atual = ler('cozinhando');
  const novos = [p, ...extras];
  if (atual && !atual.panelas.some((pa) => pa.id === p.id)) {
    const nomes = atual.panelas.map((pa) => porId(pa.id)?.nome).filter(Boolean).join(', ');
    const r = await dialogo({
      titulo: 'Já tem panela no fogo! 🔥', texto: `Você está cozinhando ${nomes || 'outro prato'}. Quer juntar ${p.nome}${extras.length ? ' e os acompanhamentos' : ''} a esse preparo?`,
      botoes: [{ rotulo: '➕ Juntar ao preparo', classe: 'primario', valor: 'juntar' }, { rotulo: 'Começar do zero', valor: 'trocar' }, { rotulo: 'Cancelar', classe: 'fantasma', valor: false }],
    });
    if (!r) return;
    if (r === 'juntar') { for (const x of novos.slice().reverse()) juntarPanela(x, porcoes); ir('cozinhando'); return; }
  }
  if (!atual || !atual.panelas.some((pa) => pa.id === p.id)) {
    pararAlarme();
    // Foco na panela que demora mais: é por ela que se começa.
    const ordem = novos.slice().sort((a, b) => tempoTotal(b) - tempoTotal(a));
    iniciarCozinha(ordem, porcoes);
  }
  ir('cozinhando');
}

async function excluirMeuPrato(p) {
  if (!(await confirmar('Excluir este prato?', `“${p.nome}” sairá dos seus pratos, dos favoritos e da lista de compras.`, 'Excluir'))) return;
  alterar('meusPratos', (l) => l.filter((x) => x.id !== p.id));
  alterar('favoritos', (l) => l.filter((x) => x.id !== p.id));
  alterar('lista', (l) => l.filter((x) => x.receitaId !== p.id));
  reindexar(); toast('Prato excluído'); substituir('categorias');
}

// ---------- 8. Cozinhando agora ----------
// Uma sessão pode ter várias panelas (bife + arroz + feijão): uma aba por prato, cada uma com o seu passo;
// cronômetro e timers são da sessão inteira.
export function telaCozinhando() {
  const el = h('main', { class: 'tela' }, topo('🔥 Cozinhando agora'));
  const pratosDe = (c) => (c?.panelas || []).map((pa) => ({ pa, p: porId(pa.id) })).filter((x) => x.p);
  const coz0 = ler('cozinhando');
  if (!pratosDe(coz0).length) {
    el.append(h('div', { class: 'vazio' }, h('div', { class: 'grande-ico' }, '🍳'), h('p', null, 'Nenhum preparo em andamento.'),
      h('button', { class: 'btn primario', onClick: () => ir('categorias') }, 'Escolher um prato')));
    if (coz0) gravar('cozinhando', null);
    return { el };
  }
  const relogio = h('div', { class: 'cronometro', 'aria-live': 'off' });
  const inicioTxt = new Date(coz0.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const abas = h('div', { class: 'panelas' });
  const cabeca = h('div', { class: 'coz-topo' });
  const dicaOrdem = h('div');
  const passoBox = h('div', { class: 'passo-grande' });
  const timersBox = h('div', { class: 'timers' });
  const ingsBox = h('div');

  const estado = () => {
    const c = ler('cozinhando'); const lista = pratosDe(c);
    return { c, lista, sel: lista.find((x) => x.pa.id === c?.ativa) || lista[0] };
  };
  const focar = (id) => { alterar('cozinhando', (c) => { c.ativa = id; }); desenhar(); };

  function desenhar() {
    const { c, lista, sel } = estado();
    if (!sel) { substituir('inicio'); return; }
    const varias = lista.length > 1;
    trocar(abas, varias ? lista.map(({ pa, p }) => h('button', {
      class: 'panela' + (pa.id === sel.pa.id ? ' on' : '') + (pa.pronto ? ' pronta' : ''), 'aria-pressed': String(pa.id === sel.pa.id), onClick: () => focar(pa.id) },
      imgPrato(p), h('span', null, p.nome),
      h('small', null, pa.pronto ? '✅ pronto' : `passo ${Math.min(pa.passo + 1, p.passos.length || 1)}/${p.passos.length || 1}`))) : null);
    trocar(cabeca, imgPrato(sel.p), h('div', { style: { flex: 1 } }, h('h2', null, sel.p.nome),
      h('small', { style: { color: 'var(--suave)' } }, porcoesTxt(sel.pa.porcoes)),
      varias ? h('button', { class: 'btn pequeno fantasma', style: { marginTop: '6px', display: 'block' }, onClick: () => tirar(sel) }, 'Tirar do preparo') : null));
    // Antes de qualquer passo: dica de por onde começar (o que demora mais).
    const comecando = varias && lista.every(({ pa }) => !pa.passo && !pa.pronto);
    const maisLongo = lista.slice().sort((a, b) => tempoTotal(b.p) - tempoTotal(a.p))[0];
    trocar(dicaOrdem, comecando ? h('div', { class: 'caixa dica' }, h('b', null, '💡 Por onde começar'),
      `Comece por ${maisLongo.p.nome} (${esperaHoras(maisLongo.p) ? textoEspera(esperaHoras(maisLongo.p)) : formatarMinutos(maisLongo.p.tempoMin || 0)}): é o que mais demora. Toque nas abas para alternar entre as panelas.`) : null);
    desenharPasso(sel, lista); desenharIngs(sel);
  }

  function desenharPasso({ pa, p }, lista) {
    const n = p.passos.length;
    if (!n) { trocar(passoBox, h('p', null, 'Este prato não tem passos cadastrados.'), linkYoutube(p)); return; }
    const i = clamp(pa.passo || 0, 0, n - 1), texto = p.passos[i], varias = lista.length > 1;
    const ultimo = i === n - 1;
    const proxima = lista.find((x) => x.pa.id !== pa.id && !x.pa.pronto);
    trocar(passoBox,
      h('div', { class: 'num' }, `${varias ? p.nome + ' · ' : ''}Passo ${i + 1} de ${n}`),
      h('p', null, texto),
      temposNoPasso(texto).map((t) => h('button', { class: 'btn milho bloco', style: { marginBottom: '8px' }, onClick: () => {
        const ok = criarTimer(t.seg, `${varias ? p.nome + ' · ' : ''}Passo ${i + 1}: ${t.rotulo}`);
        toast(ok ? `⏱️ Timer de ${formatarMinutos(Math.round(t.seg / 60))} ligado` : 'Esse timer já está correndo ⏱️'); desenharTimers(); } },
        `⏱️ Timer de ${formatarMinutos(Math.round(t.seg / 60))}`)),
      ultimo && !varias ? h('small', { style: { color: 'var(--suave)', marginBottom: '8px' } }, 'Último passo! Toque em “Terminei” quando acabar.') : null,
      ultimo && varias && !pa.pronto ? h('button', { class: 'btn folha bloco', style: { marginBottom: '8px' }, onClick: () => marcarPronto(pa.id, proxima) },
        `✅ ${p.nome} pronto${proxima ? ` · ir para ${proxima.p.nome}` : ''}`) : null,
      h('div', { class: 'btns dois', style: { margin: 0 } },
        h('button', { class: 'btn', disabled: i === 0, onClick: () => irPasso(pa.id, i - 1) }, '◀ Anterior'),
        h('button', { class: 'btn primario', disabled: ultimo, onClick: () => irPasso(pa.id, i + 1) }, 'Próximo ▶')));
  }
  const irPasso = (id, i) => {
    alterar('cozinhando', (c) => { const pa = c.panelas.find((x) => x.id === id); if (pa) pa.passo = i; });
    desenhar(); window.scrollTo({ top: passoBox.offsetTop - 70, behavior: 'smooth' });
  };
  function marcarPronto(id, proxima) {
    alterar('cozinhando', (c) => { const pa = c.panelas.find((x) => x.id === id); if (pa) pa.pronto = true; if (proxima) c.ativa = proxima.pa.id; });
    toast(proxima ? `✅ Pronto! Agora: ${proxima.p.nome}` : '✅ Tudo pronto! Toque em “Terminei” para registrar.');
    desenhar();
  }
  async function tirar({ pa, p }) {
    if (!(await confirmar(`Tirar ${p.nome} do preparo?`, 'As outras panelas continuam como estão.', 'Tirar', 'Manter'))) return;
    tirarPanela(pa.id); desenhar();
  }

  function desenharIngs({ pa, p }) {
    trocar(ingsBox, p.ingredientes.length ? h('details', { class: 'card' }, h('summary', null, `🧺 Ingredientes${pratosDe(ler('cozinhando')).length > 1 ? ` · ${p.nome}` : ''}`),
      h('ul', { class: 'ings' }, p.ingredientes.map((i) => h('li', null, textoIngrediente(i, pa.porcoes / (p.rendimento || 2)))))) : null);
  }

  function desenharTimers() {
    const c = ler('cozinhando');
    trocar(timersBox, ...(c?.timers || []).map((t) => {
      const resta = (t.fim - Date.now()) / 1000, toca = resta <= 0;
      return h('div', { class: 'timer' + (toca ? ' tocando' : '') },
        h('b', null, toca ? '⏰' : formatarRelogio(resta)), h('span', null, toca ? `Tempo! ${t.rotulo}` : t.rotulo),
        h('button', { class: 'btn pequeno' + (toca ? ' milho' : ''), onClick: () => { removerTimer(t.id); desenharTimers(); } }, toca ? '✋ Parar' : '✕'));
    }));
  }
  const tique = () => {
    const c = ler('cozinhando'); if (!c) return;
    relogio.textContent = formatarRelogio((Date.now() - c.inicio) / 1000);
    desenharTimers();
  };

  async function terminar() {
    const { c, lista } = estado();
    // O histórico guarda a refeição (os pratos principais); arroz e feijão de acompanhamento não contam como "prato feito".
    const principais = lista.filter((x) => tipoDe(x.p) === 'principal');
    const registrar = (principais.length ? principais : lista).map((x) => x.p);
    let minutos = Math.max(1, Math.round((Date.now() - c.inicio) / 60000));
    if (minutos > 240) {
      const campo = h('input', { class: 'campo', type: 'number', inputmode: 'numeric', min: '1', value: String(registrar[0].tempoMin || 60) });
      const r = await dialogo({
        titulo: 'Esqueceu de terminar? 😄', texto: `O cronômetro marcou ${formatarMinutos(minutos)}. Quantos minutos levou de verdade?`, conteudo: campo,
        botoes: [{ rotulo: 'Corrigir', classe: 'primario', valor: () => { const v = parseInt(campo.value, 10); return v > 0 ? v : undefined; } },
          { rotulo: `Manter ${formatarMinutos(minutos)}`, classe: 'fantasma', valor: minutos }],
      });
      if (r == null) return;
      minutos = r;
    }
    let nota = 0;
    const est = estrelasEl(0, (v) => { nota = v; }, { grandes: true });
    const r = await dialogo({
      titulo: 'Ficou bom? 😋', texto: registrar.map((p) => p.nome).join(' + '), conteudo: h('div', { style: { textAlign: 'center', margin: '8px 0' } }, est),
      botoes: [{ rotulo: 'Salvar', classe: 'primario', valor: () => { if (!nota) { toast('Toque nas estrelas para dar a nota'); return undefined; } return nota; } },
        { rotulo: 'Pular a nota', classe: 'fantasma', valor: 0 }],
    });
    if (r == null) return;
    for (const p of registrar) registrarRefeicao(p, r || null, minutos);
    pararAlarme(); gravar('cozinhando', null);
    const semFav = registrar.filter((p) => !favorito(p.id));
    if (r >= 4 && semFav.length) {
      const nomes = semFav.map((p) => p.nome).join(' e ');
      if (await confirmar('Que delícia!', `Quer adicionar ${nomes} aos seus favoritos?`, '❤️ Sim, adicionar', 'Agora não')) semFav.forEach((p) => favoritar(p.id, r));
    }
    toast('Refeição registrada no histórico 📖');
    substituir('historico');
  }
  async function cancelar() {
    if (!(await confirmar('Cancelar o preparo?', 'O cronômetro, as panelas e os timers serão descartados (nada vai para o histórico).', 'Cancelar preparo', 'Continuar cozinhando'))) return;
    pararAlarme(); gravar('cozinhando', null); substituir('inicio');
  }

  el.append(
    abas, cabeca,
    relogio, h('small', null, `de preparo · começou às ${inicioTxt}`),
    dicaOrdem, passoBox, timersBox, ingsBox,
    h('div', { class: 'btns' },
      h('button', { class: 'btn folha bloco', onClick: terminar }, '✅ Terminei'),
      h('button', { class: 'btn pequeno fantasma', onClick: cancelar }, 'Cancelar preparo')),
  );
  desenhar(); tique();
  const id = setInterval(tique, 1000);
  return { el, limpar: () => clearInterval(id) };
}

// ---------- 9. Lista de compras ----------
const CORTES = /\s(em|picad|ralad|fatiad|cozid|desfiad|amassad|dessalgad|para|sem|com|maduras?|bem|fresc|limp|inteir|cortad|moíd|moid|batid|triturad|torrad|escorrid)\S*.*$/;
function chaveItem(i) {
  // No singular, para "1 cebola" e "2 cebolas picadas" virarem a mesma linha.
  const base = normalizar(concordar(i.item.replace(/\(.*?\)/g, '').trim(), false)).replace(CORTES, '').trim();
  return base + '|' + (i.unidade || '');
}
// Água não se compra; sal, óleo e companhia quase todo mundo tem: viram só um lembrete, sem somar.
const NAO_COMPRA = /^(agua|agua fervente|agua quente|agua gelada|agua morna)\|/;
const DESPENSA = /^(sal|sal grosso|sal fino|oleo|oleo de soja|azeite|azeite de oliva|pimenta do reino|pimenta do reino moida)\|/;
function somar(lista) {
  const mapa = new Map();
  for (const r of lista) for (const i of r.itens) {
    const k = chaveItem(i);
    if (NAO_COMPRA.test(k)) continue;
    const s = mapa.get(k) || { chave: k, item: i.item.replace(/\s*\(.*?\)/g, ''), unidade: i.unidade, quantidade: 0, semQtd: false, receitas: new Set() };
    if (i.quantidade == null) s.semQtd = true; else s.quantidade += i.quantidade;
    if (i.item.length < s.item.length) s.item = i.item.replace(/\s*\(.*?\)/g, '');
    s.receitas.add(r.nome); mapa.set(k, s);
  }
  const todos = [...mapa.values()].sort((a, b) => a.item.localeCompare(b.item));
  // Despensa: um item por nome (sal de 3 receitas com unidades diferentes vira uma linha só).
  const despensa = new Map();
  for (const s of todos) if (DESPENSA.test(s.chave)) { const nome = s.chave.split('|')[0]; if (!despensa.has(nome)) despensa.set(nome, { ...s, chave: nome + '|despensa', unidade: 'a gosto' }); }
  return { compras: todos.filter((s) => !DESPENSA.test(s.chave)), despensa: [...despensa.values()] };
}
const textoSomado = (s) => s.unidade === 'a gosto' ? `${s.item} a gosto` : s.quantidade ? textoIngrediente({ item: s.item, unidade: s.unidade, quantidade: s.quantidade }) : s.item;

export function telaLista() {
  const el = h('main', { class: 'tela' });
  let aba = sessionStorage.getItem('abaLista') || 'somado';
  function montar() {
    const lista = ler('lista'), marcados = ler('marcados');
    const cab = topo('🛒 Lista de compras', { extra: lista.length ? h('span', { class: 'contador' }, `${lista.length} receita${lista.length > 1 ? 's' : ''}`) : null });
    if (!lista.length) {
      trocar(el, cab, h('div', { class: 'vazio' }, h('div', { class: 'grande-ico' }, '🧺'), h('p', null, 'Sua lista está vazia. Abra uma receita e toque em “🛒 Lista”.'),
        h('button', { class: 'btn primario', onClick: () => ir('categorias') }, 'Ver categorias')));
      return;
    }
    const linha = (chave, texto, sub) => {
      const ok = !!marcados[chave];
      const cb = h('input', { type: 'checkbox', checked: ok, 'aria-label': texto });
      const row = h('label', { class: 'item-compra' + (ok ? ' feito' : '') }, cb, h('div', { class: 'txt' }, texto, sub && h('small', null, sub)));
      cb.addEventListener('change', () => { alterar('marcados', (m) => { if (cb.checked) m[chave] = true; else delete m[chave]; }); montar(); });
      return row;
    };
    let corpo;
    if (aba === 'somado') {
      const { compras, despensa } = somar(lista);
      corpo = h('div', null,
        h('div', { class: 'card' }, compras.map((s) => linha(s.chave, textoSomado(s), s.receitas.size > 1 ? `para ${[...s.receitas].join(', ')}` : null))),
        despensa.length ? h('div', { class: 'card' }, h('h3', { style: { margin: '0 0 6px' } }, '🧂 Despensa ', h('small', { style: { color: 'var(--suave)', fontSize: '14px' } }, '— confira se tem em casa')),
          despensa.map((s) => linha(s.chave, s.item))) : null);
    } else {
      corpo = h('div', null, lista.map((r) => h('div', { class: 'grupo-receita card' },
        h('h3', null, h('span', null, `${r.nome} `, h('small', { style: { color: 'var(--suave)', fontSize: '14px' } }, `(${porcoesTxt(r.porcoes)})`)),
          h('button', { class: 'icone-btn', 'aria-label': 'Tirar receita da lista', onClick: () => { alterar('lista', (l) => l.filter((x) => x.receitaId !== r.receitaId)); montar(); } }, '✕')),
        r.itens.map((i) => linha(chaveItem(i), textoIngrediente(i))))));
    }
    const nMarc = Object.keys(marcados).length;
    trocar(el, cab,
      h('div', { class: 'abas' },
        h('button', { class: aba === 'somado' ? 'on' : '', onClick: () => { aba = 'somado'; sessionStorage.setItem('abaLista', aba); montar(); } }, 'Tudo somado'),
        h('button', { class: aba === 'receita' ? 'on' : '', onClick: () => { aba = 'receita'; sessionStorage.setItem('abaLista', aba); montar(); } }, 'Por receita')),
      corpo,
      h('div', { class: 'btns' },
        h('button', { class: 'btn primario bloco', onClick: compartilhar }, '📤 Compartilhar como texto'),
        h('div', { class: 'btns dois', style: { margin: 0 } },
          h('button', { class: 'btn', disabled: !nMarc, onClick: limparMarcados }, `🧹 Limpar marcados${nMarc ? ` (${nMarc})` : ''}`),
          h('button', { class: 'btn fantasma', onClick: esvaziar }, '🗑️ Esvaziar'))));
  }
  function limparMarcados() {
    const m = ler('marcados');
    alterar('lista', (l) => l.map((r) => ({ ...r, itens: r.itens.filter((i) => { const k = chaveItem(i); return !m[k] && !m[k.split('|')[0] + '|despensa']; }) })).filter((r) => r.itens.length));
    gravar('marcados', {}); toast('Itens marcados removidos'); montar();
  }
  async function esvaziar() {
    if (!(await confirmar('Esvaziar a lista?', 'Todas as receitas e itens sairão da lista de compras.', 'Esvaziar'))) return;
    gravar('lista', []); gravar('marcados', {}); montar();
  }
  async function compartilhar() {
    const lista = ler('lista'), m = ler('marcados');
    const { compras, despensa } = somar(lista);
    const linhas = compras.map((s) => `${m[s.chave] ? '☑' : '☐'} ${textoSomado(s)}`);
    const desp = despensa.length ? `\n\n🧂 Despensa (confira se tem em casa): ${despensa.map((s) => s.item).join(', ')}` : '';
    const texto = `🛒 Lista de compras — A refeição hoje é...\n\n${linhas.join('\n')}${desp}\n\nReceitas: ${lista.map((r) => `${r.nome} (${porcoesTxt(r.porcoes)})`).join('; ')}`;
    const r = await compartilharTexto(texto, 'Lista de compras');
    if (r === 'copiado') toast('📋 Lista copiada — é só colar no WhatsApp');
    else if (r === 'falhou') toast('Não consegui compartilhar 😕');
  }
  montar();
  return { el };
}

// ---------- 10. Meu histórico ----------
const POR_PAGINA = 30;
export function telaHistorico() {
  const el = h('main', { class: 'tela' });
  let mostrar = POR_PAGINA;
  function montar() {
    const hist = ler('historico');
    const porPrato = new Map();
    for (const x of hist) {
      const a = porPrato.get(x.id) || { id: x.id, nome: x.nome, vezes: 0, soma: 0, notas: 0, ultima: x.em };
      a.vezes++; if (x.estrelas) { a.soma += x.estrelas; a.notas++; } a.ultima = Math.max(a.ultima, x.em);
      porPrato.set(x.id, a);
    }
    const ranking = [...porPrato.values()].sort((a, b) => b.vezes - a.vezes || b.ultima - a.ultima);
    const pratoDe = (id, nome) => porId(id) || { id, nome, categoria: '', foto: { url: '' } };
    trocar(el, 
      topo('📖 Meu histórico'),
      h('div', { class: 'resumo-hist' },
        h('div', { class: 'stat' }, h('b', null, hist.length), h('small', null, hist.length === 1 ? 'refeição feita' : 'refeições feitas')),
        h('div', { class: 'stat' }, h('b', null, porPrato.size), h('small', null, 'pratos diferentes'))),
      hist.length ? [
        h('h2', { class: 'secao' }, '🏆 Mais feitos'),
        h('div', { class: 'card' }, ranking.map((a) => h('div', { class: 'hist-item', role: 'button', style: { cursor: 'pointer' }, onClick: () => porId(a.id) && ir('receita/' + encodeURIComponent(a.id)) },
          imgPrato(pratoDe(a.id, a.nome)),
          h('div', null, a.nome, h('small', null, `última vez: ${formatarData(a.ultima)}${a.notas ? ` · média ${'⭐'.repeat(Math.round(a.soma / a.notas))}` : ''}`)),
          h('span', { class: 'vezes' }, `${a.vezes}x`)))),
        h('h2', { class: 'secao' }, '🗓️ Refeições'),
        h('div', { class: 'card' }, hist.slice(0, mostrar).map((x, i) => h('div', { class: 'hist-item' },
          imgPrato(pratoDe(x.id, x.nome)),
          h('div', null, x.nome, h('small', null, `${formatarData(x.em)}${x.minutos ? ` · ${formatarMinutos(x.minutos)}` : ''} · ${x.estrelas ? '⭐'.repeat(x.estrelas) : 'sem nota'}`)),
          h('button', { class: 'icone-btn', 'aria-label': 'Apagar registro', onClick: async () => {
            if (await confirmar('Apagar este registro?', `${x.nome} em ${formatarData(x.em)}`, 'Apagar')) { alterar('historico', (l) => { l.splice(i, 1); }); montar(); }
          } }, '✕'))),
          // Muitos anos de uso = milhares de linhas: mostra aos poucos para a tela abrir rápido.
          hist.length > mostrar ? h('button', { class: 'btn pequeno bloco', style: { marginTop: '10px' }, onClick: () => { const y = window.scrollY; mostrar += POR_PAGINA; montar(); window.scrollTo(0, y); } },
            `Ver mais ${Math.min(POR_PAGINA, hist.length - mostrar)} (de ${hist.length - mostrar} restantes)`) : null),
      ] : h('div', { class: 'vazio' }, h('div', { class: 'grande-ico' }, '🍽️'), h('p', null, 'Quando terminar de cozinhar um prato, ele aparece aqui.')),
      h('h2', { class: 'secao' }, '💾 Backup'),
      h('div', { class: 'card' },
        h('p', { style: { marginTop: 0 } }, 'Seus dados ficam só neste aparelho. Copie o backup e guarde (num e-mail ou bloco de notas) para restaurar em outro celular.'),
        h('div', { class: 'btns dois', style: { margin: 0 } },
          h('button', { class: 'btn', onClick: copiarBackup }, '📋 Copiar backup'),
          h('button', { class: 'btn', onClick: restaurar }, '📥 Restaurar'))),
    );
  }
  async function copiarBackup() {
    const txt = exportarBackup();
    if (await copiarTexto(txt)) { toast('📋 Backup copiado'); return; }
    const ta = h('textarea', { class: 'backup', readonly: true }); ta.value = txt;
    await dialogo({ titulo: 'Copie o texto abaixo', texto: 'Não consegui copiar sozinho. Segure no texto e escolha “Copiar”.', conteudo: ta });
  }
  async function restaurar() {
    const ta = h('textarea', { class: 'backup', placeholder: 'Cole aqui o texto do backup' });
    const v = await dialogo({ titulo: 'Restaurar backup', texto: 'Cole o texto do backup. Os dados atuais deste aparelho serão substituídos.', conteudo: ta,
      botoes: [{ rotulo: 'Restaurar', classe: 'primario', valor: () => ta.value.trim() || undefined }, { rotulo: 'Cancelar', classe: 'fantasma', valor: false }] });
    if (!v) return;
    try { const b = importarBackup(v); reindexar(); toast(`✅ Backup de ${formatarData(Date.parse(b.criadoEm) || Date.now())} restaurado${b.ignorados.length ? ` (${b.ignorados.length} parte${b.ignorados.length > 1 ? 's' : ''} danificada${b.ignorados.length > 1 ? 's' : ''} ignorada${b.ignorados.length > 1 ? 's' : ''})` : ''}`, { ms: 5000 }); montar(); }
    catch (e) { toast(e.message); }
  }
  montar();
  return { el };
}

// ---------- Meu prato (adicionar/editar) ----------
// Unidades escritas à mão → unidade do catálogo ("2 xícaras de arroz" → 2 | xícara | arroz).
const UNIDADES_TEXTO = [
  [/^x[íi]caras?( de ch[áa])?/i, 'xícara'], [/^colher(es)? de sopa/i, 'colher de sopa'], [/^colher(es)? de ch[áa]/i, 'colher de chá'],
  [/^(kg|quilos?)\b/i, 'kg'], [/^(g|gramas?)\b/i, 'g'], [/^ml\b/i, 'ml'], [/^(l|litros?)\b/i, 'l'],
  [/^dentes?/i, 'dente'], [/^pitadas?/i, 'pitada'], [/^ma[çc]os?/i, 'maço'], [/^fatias?/i, 'fatia'], [/^latas?/i, 'lata'],
  [/^pacotes?/i, 'pacote'], [/^ramos?/i, 'ramo'], [/^folhas?(?= de )/i, 'folha'], [/^peda[çc]os?/i, 'pedaço'], [/^copos?/i, 'copo'],
  [/^vidros?/i, 'vidro'], [/^espigas?/i, 'espiga'],
];
function lerIngrediente(linha) {
  const txt = linha.trim().replace(/^(\d+(?:[.,]\d+)?)(kg|g|ml|l)\b/i, '$1 $2');   // "500g" → "500 g"
  const gosto = txt.match(/^(.+?)\s+a gosto$/i);
  if (gosto) return { item: gosto[1], quantidade: null, unidade: 'a gosto' };
  const m = txt.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|½|¼|¾)\s+(.+)$/);
  if (!m) return { item: txt, quantidade: null, unidade: '' };
  const frac = { '½': 0.5, '¼': 0.25, '¾': 0.75 };
  let q = 0;
  for (const parte of m[1].split(/\s+/)) q += frac[parte] ?? (parte.includes('/') ? parte.split('/').reduce((a, b) => a / b) : parseFloat(parte.replace(',', '.')));
  let resto = m[2], unidade = '';
  for (const [re, un] of UNIDADES_TEXTO) {
    const u = resto.match(re);
    if (u) { unidade = un; resto = resto.slice(u[0].length).replace(/^\s*(de\s+)?/i, ''); break; }
  }
  return { item: resto || m[2], quantidade: q, unidade };
}
const ingredienteParaLinha = (i) => (i.quantidade == null ? i.item : textoIngrediente(i));

export function telaMeuPrato(id) {
  const existente = id ? meusPratos().find((p) => p.id === id) : null;
  const rasc = ler('rascunhoMeuPrato');
  const base = rasc && rasc.idEditado === (id || null) ? rasc : existente ? {
    nome: existente.nome, categoria: existente.categoria, tipo: tipoDe(existente), foto: existente.foto?.url || '', fotoFonte: existente.foto?.fonte || '', youtube: existente.youtube || '',
    tempo: existente.tempoMin || '', rendimento: existente.rendimento || 2,
    ingredientes: existente.ingredientes.map(ingredienteParaLinha).join('\n'), passos: existente.passos.join('\n'),
  } : { nome: '', categoria: CATEGORIAS[0].nome, foto: '', fotoFonte: '', youtube: '', tempo: '', rendimento: 4, ingredientes: '', passos: '' };
  const dados = { ...base, idEditado: id || null };
  const salvarRasc = () => gravar('rascunhoMeuPrato', dados);

  const campo = (k, props = {}) => {
    const tag = props.multi ? 'textarea' : 'input';
    const c = h(tag, { class: 'campo', ...props, multi: null });
    c.value = dados[k] ?? '';
    c.addEventListener('input', () => { dados[k] = c.value; salvarRasc(); });
    return c;
  };
  const sel = h('select', { class: 'campo' }, [...CATEGORIAS, MEUS].map((c) => h('option', { value: c.nome, selected: c.nome === dados.categoria }, `${c.icone} ${c.nome}`)));
  sel.addEventListener('change', () => { dados.categoria = sel.value; salvarRasc(); });
  const selTipo = h('select', { class: 'campo' }, TIPOS.map(([v, rot]) => h('option', { value: v, selected: v === (dados.tipo || 'principal') }, rot)));
  selTipo.addEventListener('change', () => { dados.tipo = selTipo.value; salvarRasc(); });

  const previa = h('img', { class: 'miniatura', style: { width: '96px', height: '128px' }, alt: 'Foto escolhida' });
  const pintarPrevia = () => { previa.src = dados.foto || fotoDe({ categoria: dados.categoria, foto: { url: '' } }); };
  sel.addEventListener('change', pintarPrevia);
  const linkFoto = campo('foto', { type: 'url', placeholder: 'ou cole o link de uma imagem' });
  linkFoto.addEventListener('input', () => { dados.fotoFonte = ''; pintarPrevia(); });
  const buscaFoto = h('input', { class: 'campo', type: 'search', placeholder: 'Nome para buscar a foto' });
  const gradeFotos = h('div', { class: 'grade', style: { gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '8px' } });
  async function buscarFotos() {
    const q = buscaFoto.value.trim() || dados.nome.trim();
    if (!q) { toast('Digite o nome do prato primeiro'); return; }
    trocar(gradeFotos, h('p', null, 'Buscando na Wikipédia...'));
    try {
      const url = 'https://pt.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&generator=search&gsrlimit=12&prop=pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=600&gsrsearch=' + encodeURIComponent(q);
      const r = await (await fetch(url)).json();
      const pags = (r.query?.pages || []).filter((pg) => pg.thumbnail?.source && !/\.svg/i.test(pg.thumbnail.source)).sort((a, b) => a.index - b.index);
      if (!pags.length) { trocar(gradeFotos, h('p', null, 'Nenhuma foto encontrada. Tente outro nome ou cole um link.')); return; }
      trocar(gradeFotos, ...pags.slice(0, 9).map((pg) => h('button', { style: { border: 0, padding: 0, borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', height: '110px', background: 'var(--card)' },
        onClick: () => { dados.foto = pg.thumbnail.source; dados.fotoFonte = pg.fullurl || ''; linkFoto.value = dados.foto; salvarRasc(); pintarPrevia(); toast('Foto escolhida ✓'); } },
      h('img', { src: pg.thumbnail.source, alt: pg.title, style: { width: '100%', height: '100%', objectFit: 'cover' } }))));
    } catch { trocar(gradeFotos, h('p', null, 'Sem internet para buscar fotos agora.')); }
  }

  function salvar() {
    const nome = (dados.nome || '').trim();
    if (!nome) { toast('Dê um nome ao prato'); return; }
    const novoId = id || 'meu-' + Date.now().toString(36);
    const prato = {
      id: novoId, nome, categoria: dados.categoria || MEUS.nome, tipo: dados.tipo || 'principal',
      foto: { url: (dados.foto || '').trim(), autor: dados.fotoFonte ? 'Wikipédia' : '', licenca: '', fonte: dados.fotoFonte || '' },
      youtube: (dados.youtube || '').trim(), tempoMin: parseInt(dados.tempo, 10) || null, rendimento: parseInt(dados.rendimento, 10) || 2,
      ingredientes: (dados.ingredientes || '').split('\n').map((l) => l.trim()).filter(Boolean).map(lerIngrediente),
      passos: (dados.passos || '').split('\n').map((l) => l.trim()).filter(Boolean),
      criadoEm: existente?.criadoEm || Date.now(),
    };
    alterar('meusPratos', (l) => { const k = l.findIndex((x) => x.id === novoId); if (k >= 0) l[k] = prato; else l.push(prato); });
    reindexar(); gravar('rascunhoMeuPrato', null);
    toast(id ? 'Prato atualizado ✓' : '⭐ Prato adicionado');
    substituir('receita/' + encodeURIComponent(novoId));
  }
  const descartar = () => { gravar('rascunhoMeuPrato', null); voltar(); };

  const el = h('main', { class: 'tela' },
    topo(id ? '✏️ Editar prato' : '＋ Meu prato'),
    rasc && rasc.idEditado === (id || null) ? h('div', { class: 'filtros-ativos' }, h('span', null, '📝 Rascunho recuperado'), h('button', { class: 'btn pequeno', onClick: descartar }, 'Descartar')) : null,
    h('label', { class: 'rot' }, 'Nome do prato *'), campo('nome', { placeholder: 'Ex.: Frango da tia Lurdes', autocomplete: 'off' }),
    h('label', { class: 'rot' }, 'Categoria'), sel,
    h('label', { class: 'rot' }, 'Tipo'), selTipo,
    h('label', { class: 'rot' }, 'Foto'),
    h('div', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start' } }, previa,
      h('div', { style: { flex: 1, display: 'grid', gap: '8px' } }, buscaFoto, h('button', { class: 'btn pequeno', onClick: buscarFotos }, '🔎 Buscar foto na Wikipédia'), linkFoto)),
    gradeFotos,
    h('label', { class: 'rot' }, 'Link do YouTube (opcional)'), campo('youtube', { type: 'url', placeholder: 'https://youtube.com/...' }),
    h('div', { class: 'btns dois', style: { margin: 0 } },
      h('div', null, h('label', { class: 'rot' }, 'Tempo (min)'), campo('tempo', { type: 'number', inputmode: 'numeric', min: '1' })),
      h('div', null, h('label', { class: 'rot' }, 'Porções'), campo('rendimento', { type: 'number', inputmode: 'numeric', min: '1' }))),
    h('label', { class: 'rot' }, 'Ingredientes (opcional, um por linha)'), campo('ingredientes', { multi: true, rows: 5, placeholder: '2 xícaras de arroz\n1 cebola picada\nsal a gosto' }),
    h('label', { class: 'rot' }, 'Modo de preparo (opcional, um passo por linha)'), campo('passos', { multi: true, rows: 6, placeholder: 'Refogue a cebola.\nJunte o arroz e cozinhe por 15 minutos.' }),
    h('div', { class: 'btns' }, h('button', { class: 'btn primario bloco', onClick: salvar }, '💾 Salvar prato'), h('button', { class: 'btn fantasma bloco', onClick: descartar }, 'Cancelar')),
  );
  pintarPrevia();
  return { el };
}
