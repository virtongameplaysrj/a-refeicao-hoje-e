// Navegação por hash (#/rota/param). Cada troca cria uma entrada no histórico,
// então o botão Voltar do Android (WebView.goBack) volta de tela em tela.
let navegacoes = 0;
window.addEventListener('hashchange', () => { navegacoes++; });

export const ir = (rota) => { location.hash = '#/' + rota; };
export const substituir = (rota) => { location.replace('#/' + rota); };
export function voltar() {
  if (navegacoes > 0 && history.length > 1) history.back();
  else substituir('inicio');
}
