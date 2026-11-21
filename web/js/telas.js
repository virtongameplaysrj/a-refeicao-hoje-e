// Telas: Início, Eu gosto, Categorias, Prateleira (+ componentes compartilhados).
import { h, trocar, normalizar, toast, aoSegurar, aleatorioComSemente, embaralhar, youtubeBusca, formatarMinutos, diasDesde } from './util.js';
import { ler, gravar, alterar, favorito, favoritar, desfavoritar, atualizarFavorito } from './store.js';
import {
  CATEGORIAS, MEUS, categoriaPorNome, categoriaPorSlug, todos, porId, daCategoria, buscar, meusPratos, reindexar,
  fotoDe, arte, temFoto, totalCatalogo, GRUPOS_FILTRO, aplicarFiltros, contarFiltros, rotulosFiltros,
} from './catalogo.js';
import { montarPool } from './sorteio.js';
import { abrirRoleta } from './roleta.js';
import { confirmar } from './modal.js';
import { criarCarrossel } from './carrossel.js';
import { ir, voltar } from './nav.js';

// ---------- Componentes ----------
export function topo(titulo, { semVoltar = false, extra = null } = {}) {
  return h('header', { class: 'topo' },
    !semVoltar && h('button', { class: 'voltar', 'aria-label': 'Voltar', onClick: voltar }, '←'),
    h('h1', null, titulo), extra);
}
export function imgPrato(p, props = {}) {
  const img = h('img', { src: fotoDe(p), alt: p?.nome || '', loading: 'lazy', decoding: 'async', ...props });
  img.addEventListener('error', () => { if (img.src !== arte(p)) img.src = arte(p); }, { once: true });
  return img;
}
export function estrelasEl(valor, aoMudar, { grandes = false } = {}) {
  const box = h('div', { class: 'estrelas' + (grandes ? ' grandes' : ''), role: 'radiogroup', 'aria-label': 'Nota' });
  const pintar = (v) => [...box.children].forEach((b, i) => b.classList.toggle('on', i < v));
  for (let i = 1; i <= 5; i++) {
    box.append(h('button', { type: 'button', 'aria-label': `${i} estrela${i > 1 ? 's' : ''}`, onClick: (e) => { e.stopPropagation(); pintar(i); aoMudar(i); } }, '⭐'));
  }
  pintar(valor || 0);
  return box;
}
export function creditoFoto(p) {
  if (!temFoto(p)) return h('div', { class: 'credito' }, 'Ilustração gerada (prato sem foto)');
  const f = p.foto;
  if (!f.autor && !f.fonte) return null;
  return h('div', { class: 'credito' }, 'Foto: ', f.autor || 'autor desconhecido', f.licenca ? ` · ${f.licenca}` : '', ' · ',
    f.fonte ? h('a', { href: f.fonte, target: '_blank', rel: 'noopener' }, 'Wikimedia Commons') : 'Wikimedia');
}
export function linkYoutube(p) {
  const url = p.youtube || youtubeBusca(p.nome);
  return h('a', { class: 'yt', href: url, target: '_blank', rel: 'noopener' }, '▶️ Ver receita em vídeo no YouTube');
}
function colagem(pratos, n = 4, semente = 1) {
  const rnd = aleatorioComSemente(semente);
  const comFoto = pratos.filter(temFoto), resto = pratos.filter((p) => !temFoto(p));
  const ordem = [...comFoto.sort(() => rnd() - 0.5), ...resto].slice(0, n);
  const um = comFoto.length < n;   // sem fotos suficientes: uma imagem só, em vez de repetir a ilustração
  return h('div', { class: 'colagem' + (um ? ' um' : '') }, (um ? ordem.slice(0, 1) : ordem).map((p) => imgPrato(p, { alt: '' })));
}
const semeDia = () => Math.floor(Date.now() / 864e5);
function sortearComRoleta(opcoes, titulo) {
  const { pool, pesoDe, aviso } = montarPool(opcoes);
  if (!pool.length) { toast('Não há pratos para sortear aqui.'); return; }
  abrirRoleta({ pool, pesoDe, aviso, titulo, aoEscolher: (p) => ir('receita/' + encodeURIComponent(p.id)) });
}

// ---------- 2. Início ----------
export function telaInicio() {
  const coz = ler('cozinhando'), pc = coz && porId(coz.id);
  const favs = ler('favoritos').map((f) => porId(f.id)).filter(Boolean);
  const lista = ler('lista');
  const nItens = lista.reduce((n, r) => n + r.itens.length, 0);
  let aviso = null, relogio = null;
  if (pc) {
    const sub = h('small');
    const atualizar = () => { sub.textContent = `há ${formatarMinutos(Math.max(1, Math.round((Date.now() - coz.inicio) / 60000)))} · toque para continuar`; };
    atualizar(); relogio = setInterval(atualizar, 30000);
    aviso = h('div', { class: 'aviso-cozinhando', role: 'button', onClick: () => ir('cozinhando') },
      h('span', { class: 'fogo' }, '🔥'), h('div', null, h('b', null, `Cozinhando agora: ${pc.nome}`), sub));
  }
  const el = h('main', { class: 'tela' },
    h('div', { class: 'marca' }, h('h1', null, 'A refeição hoje é...'), h('p', null, 'Deixa que eu escolho por você 🍽️')),
    aviso,
    h('button', { class: 'grande', onClick: () => ir('gosto') },
      colagem(favs.length ? favs : todos(), 4, semeDia() + 7),
      h('div', { class: 'rotulo' }, h('b', null, '❤️ Eu gosto'), h('span', null, favs.length ? `${favs.length} prato${favs.length > 1 ? 's' : ''} favorito${favs.length > 1 ? 's' : ''}` : 'Monte a lista dos seus favoritos'))),
    h('button', { class: 'grande', onClick: () => ir('categorias') },
      colagem(todos(), 4, semeDia()),
      h('div', { class: 'rotulo' }, h('b', null, '📚 Todas as categorias'), h('span', null, `${totalCatalogo()} pratos típicos em 12 categorias`))),
    h('div', { class: 'btns dois' },
      h('button', { class: 'btn', onClick: () => ir('historico') }, '📖 Meu histórico'),
      h('button', { class: 'btn', onClick: () => ir('lista') }, `🛒 Lista de compras${nItens ? ` (${nItens})` : ''}`)),
  );
  return { el, limpar: () => clearInterval(relogio) };
}

// ---------- 3. Eu gosto ----------
export function telaGosto() {
  const el = h('main', { class: 'tela' });
  const rasc = ler('rascunhoGosto') || { busca: '' };
  const campo = h('input', { class: 'campo', type: 'search', placeholder: '🔎 Buscar no catálogo ou digitar um prato', value: rasc.busca || '', autocomplete: 'off', enterkeyhint: 'search' });
  const resultados = h('div', { class: 'resultados oculto' });
  const lista = h('div');

  const salvarRascunho = () => gravar('rascunhoGosto', { ...(ler('rascunhoGosto') || {}), busca: campo.value });
  function mostrarResultados() {
    const q = campo.value.trim();
    trocar(resultados);
    if (!q) { resultados.classList.add('oculto'); return; }
    for (const p of buscar(q, 8)) {
      const ja = !!favorito(p.id);
      resultados.append(h('button', { onClick: () => adicionar(p) }, imgPrato(p, { alt: '' }),
        h('div', null, p.nome, h('small', null, ja ? '✓ já está nos favoritos' : categoriaPorNome(p.categoria).nome))));
    }
    const existe = buscar(q, 50).some((p) => normalizar(p.nome) === normalizar(q));
    if (!existe) resultados.append(h('button', { onClick: () => adicionarNovo(q) }, h('span', { style: { fontSize: '28px' } }, '＋'),
      h('div', null, `Adicionar “${q}”`, h('small', null, 'prato que não está no catálogo'))));
    resultados.classList.remove('oculto');
  }
  function limparBusca() { campo.value = ''; salvarRascunho(); mostrarResultados(); }
  function adicionar(p) {
    if (!favorito(p.id)) { favoritar(p.id, 3); toast(`❤️ ${p.nome} entrou nos favoritos`); }
    limparBusca(); desenharLista();
  }
  function adicionarNovo(nome) {
    nome = nome.trim().replace(/^./, (c) => c.toUpperCase());
    const id = 'meu-' + Date.now().toString(36);
    alterar('meusPratos', (l) => { l.push({ id, nome, categoria: MEUS.nome, foto: { url: '' }, criadoEm: Date.now() }); });
    reindexar(); adicionar(porId(id));
  }
  campo.addEventListener('input', () => { salvarRascunho(); mostrarResultados(); });
  campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') resultados.querySelector('button')?.click(); });

  function desenharLista() {
    const favs = ler('favoritos').map((f) => ({ f, p: porId(f.id) })).filter((x) => x.p)
      .sort((a, b) => b.f.estrelas - a.f.estrelas || a.p.nome.localeCompare(b.p.nome));
    const hist = ler('historico');
    btnSortear.disabled = favs.length < 2;
    btnSortear.textContent = favs.length < 2 ? '🎲 Adicione 2 ou mais favoritos para sortear' : '🎲 Sortear entre meus favoritos';
    if (!favs.length) {
      trocar(lista, h('div', { class: 'vazio' }, h('div', { class: 'grande-ico' }, '💛'),
        h('p', null, 'Você ainda não tem favoritos. Busque acima um prato do catálogo ou digite um que você goste.')));
      return;
    }
    trocar(lista, ...favs.map(({ f, p }) => {
      const vezes = hist.filter((x) => x.id === p.id).length;
      const nota = h('textarea', { class: 'nota-texto', rows: 1, placeholder: '📝 Anotação (ex.: com mais pimenta)' });
      nota.value = f.nota || '';
      let t = 0;
      nota.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => atualizarFavorito(p.id, { nota: nota.value }), 300); });
      nota.addEventListener('blur', () => atualizarFavorito(p.id, { nota: nota.value }));
      return h('div', { class: 'card' },
        h('div', { class: 'linha-fav' },
          h('button', { style: { border: 0, padding: 0, background: 'none', cursor: 'pointer' }, onClick: () => ir('receita/' + encodeURIComponent(p.id)), 'aria-label': 'Abrir receita' }, imgPrato(p, { class: 'miniatura' })),
          h('div', null, h('h3', null, p.nome),
            h('div', { class: 'sub' }, vezes ? `feito ${vezes}x` : 'ainda não fiz', ' · ', categoriaPorNome(p.categoria).icone),
            estrelasEl(f.estrelas, (v) => atualizarFavorito(p.id, { estrelas: v }))),
          h('button', { class: 'icone-btn', 'aria-label': 'Remover dos favoritos', onClick: () => {
            const copia = { ...f }; desfavoritar(p.id); desenharLista();
            toast(`${p.nome} saiu dos favoritos`, { acao: 'Desfazer', aoAcao: () => { alterar('favoritos', (l) => { l.unshift(copia); }); desenharLista(); } });
          } }, '✕')),
        nota);
    }));
  }
  const btnSortear = h('button', { class: 'btn primario bloco', onClick: () => sortearComRoleta({ modo: 'favoritos' }, 'Sorteando entre seus favoritos...') });
  el.append(topo('❤️ Eu gosto'), h('div', { class: 'busca' }, campo, resultados), btnSortear, lista);
  desenharLista();
  if (campo.value) setTimeout(mostrarResultados, 50);
  const fora = (e) => { if (!el.querySelector('.busca').contains(e.target)) resultados.classList.add('oculto'); };
  document.addEventListener('pointerdown', fora);
  return { el, limpar: () => document.removeEventListener('pointerdown', fora) };
}

// ---------- 4. Categorias ----------
function barraFiltrosAtivos(aoLimpar) {
  const n = contarFiltros();
  if (!n) return null;
  return h('div', { class: 'filtros-ativos' },
    h('span', null, `🔎 ${n} filtro${n > 1 ? 's' : ''}: `, rotulosFiltros().map((r) => r.rotulo).join(', ')),
    h('button', { class: 'btn pequeno', onClick: () => { gravar('filtros', null); aoLimpar(); } }, 'Limpar'));
}
export function telaCategorias() {
  const el = h('main', { class: 'tela' });
  function montar() {
    const cats = [...CATEGORIAS]; if (meusPratos().length) cats.push(MEUS);
    const ocultos = ler('ocultos').length;
    const btnMeu = h('button', { class: 'btn fantasma', onClick: () => ir('meu-prato') }, '＋ Meu prato');
    aoSegurar(btnMeu, 700, async () => {
      if (!ler('ocultos').length) { toast('Nenhum prato oculto para restaurar.'); return; }
      if (await confirmar('Restaurar pratos ocultos?', `${ler('ocultos').length} prato(s) voltarão às prateleiras e aos sorteios.`, 'Restaurar')) {
        gravar('ocultos', []); toast('Pratos restaurados ✨'); montar();
      }
    });
    trocar(el, 
      topo('📚 Categorias', { extra: h('span', { class: 'contador' }, `${todos().length} pratos`) }),
      barraFiltrosAtivos(montar),
      h('div', { class: 'btns dois' },
        h('button', { class: 'btn primario', onClick: () => sortearComRoleta({ modo: 'catalogo' }, 'Me surpreenda!') }, '🎲 Me surpreenda'),
        btnMeu),
      ocultos ? h('p', { class: 'credito', style: { textAlign: 'center' } }, `${ocultos} prato(s) oculto(s) · segure “＋ Meu prato” para restaurar`) : null,
      h('div', { class: 'grade' }, cats.map((c, i) => {
        const pratos = daCategoria(c.slug), visiveis = aplicarFiltros(pratos);
        return h('button', { class: 'cat', onClick: () => ir('cat/' + c.slug) },
          colagem(pratos, 4, semeDia() + i * 13),
          h('span', { class: 'ico' }, c.icone),
          h('div', { class: 'rotulo' }, h('b', null, c.nome), h('small', null, contarFiltros() ? `${visiveis.length} de ${pratos.length}` : `${pratos.length} pratos`)));
      })),
    );
  }
  montar();
  return { el };
}

// ---------- 5. Prateleira ----------
function painelFiltros(aoMudar) {
  const f = ler('filtros');
  return h('div', { class: 'painel-filtros card' }, GRUPOS_FILTRO.map((g) => h('div', { class: 'chips-grupo' },
    h('small', null, g.titulo),
    h('div', { class: 'chips' }, g.opcoes.map(([valor, rotulo]) => {
      const on = g.unico ? f[g.chave] === valor : f[g.chave]?.includes(valor);
      return h('button', { class: 'chip' + (on ? ' on' : ''), 'aria-pressed': String(!!on), onClick: () => {
        alterar('filtros', (x) => {
          if (g.unico) x[g.chave] = x[g.chave] === valor ? null : valor;
          else x[g.chave] = x[g.chave]?.includes(valor) ? x[g.chave].filter((v) => v !== valor) : [...(x[g.chave] || []), valor];
        });
        aoMudar();
      } }, rotulo);
    })))));
}
function removerFiltro(grupo, valor) {
  alterar('filtros', (x) => { if (Array.isArray(x[grupo])) x[grupo] = x[grupo].filter((v) => v !== valor); else x[grupo] = null; });
}

export function telaPrateleira(slug) {
  const cat = categoriaPorSlug(slug);
  const el = h('main', { class: 'tela' });
  if (!cat) { el.append(topo('Categoria'), h('div', { class: 'vazio' }, 'Categoria não encontrada.')); return { el }; }
  let carrossel = null, kb = 0;
  const chavePos = 'pos.' + slug;
  let painelAberto = sessionStorage.getItem('filtrosAbertos') === '1';

  function montar() {
    carrossel?.destruir(); clearTimeout(kb);
    const doCat = daCategoria(slug), lista = aplicarFiltros(doCat);
    const nf = contarFiltros();
    const btnFiltros = h('button', { class: 'btn pequeno' + (nf ? ' milho' : ''), onClick: () => { painelAberto = !painelAberto; sessionStorage.setItem('filtrosAbertos', painelAberto ? '1' : '0'); montar(); } },
      `⚙️ Filtros${nf ? ` (${nf})` : ''}`);
    const cabeca = [
      topo(`${cat.icone} ${cat.nome}`, { extra: h('span', { class: 'contador' }, `${lista.length} de ${doCat.length}`) }),
      h('div', { class: 'barra-filtros' }, btnFiltros,
        h('span', { class: 'resumo' }, nf ? rotulosFiltros().map((r) => r.rotulo).join(' · ') : 'Arraste os cartões para escolher'),
        nf ? h('button', { class: 'btn pequeno fantasma', onClick: () => { gravar('filtros', null); montar(); } }, 'Limpar') : null),
      painelAberto ? painelFiltros(montar) : null,
    ];

    if (!lista.length) {
      trocar(el, ...cabeca, h('div', { class: 'vazio card' },
        h('div', { class: 'grande-ico' }, '🍳'),
        h('h2', null, doCat.length ? 'Nenhum prato combina com tudo isso' : 'Nada por aqui ainda'),
        h('p', null, doCat.length ? 'Que tal afrouxar algum filtro? Toque num deles para tirar:' : 'Use “＋ Meu prato” na tela de categorias para adicionar.'),
        h('div', { class: 'chips', style: { justifyContent: 'center' } }, rotulosFiltros().map((r) =>
          h('button', { class: 'chip on', onClick: () => { removerFiltro(r.grupo, r.valor); montar(); } }, '✕ ' + r.rotulo))),
        nf ? h('div', { class: 'btns' }, h('button', { class: 'btn', onClick: () => { gravar('filtros', null); montar(); } }, 'Limpar todos os filtros')) : null));
      return;
    }

    const salvo = sessionStorage.getItem(chavePos);
    let ini = Math.max(0, lista.findIndex((p) => p.id === salvo));
    const fotoPalco = h('img', { alt: '', decoding: 'async' });
    const nomePalco = h('h2'), regPalco = h('span');
    const palco = h('div', { class: 'palco' }, fotoPalco, h('div', { class: 'nome' }, regPalco, nomePalco));
    const info = h('section');
    let atual = null;

    function mostrar(i) {
      const p = lista[i]; atual = p; sessionStorage.setItem(chavePos, p.id);
      clearTimeout(kb);
      fotoPalco.classList.remove('kenburns', 'troca'); void fotoPalco.offsetWidth;
      fotoPalco.onerror = () => { fotoPalco.onerror = null; fotoPalco.src = arte(p); };
      fotoPalco.src = fotoDe(p); fotoPalco.classList.add('troca');
      nomePalco.textContent = p.nome;
      regPalco.textContent = [p.regiao, categoriaPorNome(p.categoria) === MEUS ? 'Meu prato' : ''].filter(Boolean).join(' · ') || cat.nome;
      const etq = [p.regiao && `📍 ${p.regiao}`, p.tempoMin && `⏱️ ${formatarMinutos(p.tempoMin)}`, p.dificuldade && `👩‍🍳 ${p.dificuldade}`, p.custo && `💰 ${p.custo}`].filter(Boolean);
      trocar(info, 
        h('div', { class: 'etiquetas' }, etq.map((t) => h('span', { class: 'etq' }, t)),
          (p.restricoes || []).map((r) => h('span', { class: 'etq verde' }, { vegetariano: '🌱 vegetariano', 'sem-lactose': 'sem lactose', 'sem-gluten': 'sem glúten' }[r] || r))),
        p.descricao ? h('p', { class: 'desc' }, p.descricao) : null,
        creditoFoto(p), linkYoutube(p),
        h('div', { class: 'btns' },
          h('button', { class: 'btn primario bloco', onClick: () => ir('receita/' + encodeURIComponent(p.id)) }, '📖 Ver receita'),
          h('div', { class: 'btns dois', style: { margin: 0 } },
            h('button', { class: 'btn milho', onClick: () => sortearComRoleta({ modo: 'catalogo', lista: doCat }, `Sorteando em ${cat.nome}...`) }, '🎲 Sortear daqui'),
            h('button', { class: 'btn fantasma', onClick: () => ocultar(p) }, '🙈 Ocultar prato'))));
    }
    function ocultar(p) {
      alterar('ocultos', (l) => { if (!l.includes(p.id)) l.push(p.id); });
      const i = lista.indexOf(p), prox = lista[i + 1] || lista[i - 1];
      if (prox) sessionStorage.setItem(chavePos, prox.id);
      montar();
      toast(`🙈 ${p.nome} foi ocultado`, { acao: 'Desfazer', aoAcao: () => { alterar('ocultos', (l) => l.filter((x) => x !== p.id)); sessionStorage.setItem(chavePos, p.id); montar(); } });
    }

    carrossel = criarCarrossel(lista, {
      inicial: ini,
      render: (p) => [imgPrato(p, { alt: '', draggable: 'false' }), h('span', null, p.nome)],
      aoMudar: mostrar,
      aoParar: () => { clearTimeout(kb); kb = setTimeout(() => fotoPalco.classList.add('kenburns'), 900); },
      aoTocar: (i) => ir('receita/' + encodeURIComponent(lista[i].id)),
    });
    trocar(el, ...cabeca, palco, carrossel.el, info);
  }
  montar();
  return { el, limpar: () => { carrossel?.destruir(); clearTimeout(kb); } };
}
