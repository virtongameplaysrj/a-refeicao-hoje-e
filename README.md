# 🍽️ A refeição hoje é...

App Android, em português do Brasil, que tira de você o peso de escolher o que comer: sorteia entre **160 pratos típicos** de São Paulo, Minas Gerais, Rio de Janeiro e Santos e mostra a receita completa, com modo "Cozinhando agora", timers, lista de compras e histórico.

- **Site (a interface do app):** https://virtongameplaysrj.github.io/a-refeicao-hoje-e/
- **APK:** pasta [`entregas/`](entregas/) ou gerado com as instruções abaixo.

## Como funciona

| Parte | O que é |
|---|---|
| `web/` | A interface inteira, em HTML/CSS/JS puro (sem framework). Publicada no **GitHub Pages** a cada `git push` por um **GitHub Actions** — as mudanças chegam ao celular sem reinstalar o app. |
| `android/` | Uma **casca WebView** (um único `MainActivity.java`) que abre o site. O botão Voltar do Android volta no histórico do WebView. Uma ponte JS (`window.AndroidApp`) mantém a **tela acesa** enquanto uma receita ou o modo Cozinhando estão abertos, compartilha a lista de compras, copia o backup e vibra nos alarmes. |
| `dados/lotes/` | Os 160 pratos, escritos **um arquivo por categoria** (12 lotes). |
| `scripts/` | Scripts **PowerShell** que validam os lotes, montam o `web/data/pratos.json` e buscam as fotos no Wikimedia Commons. |

Os dados de quem usa ficam **só no aparelho** (`localStorage`), sem servidor: favoritos e notas, histórico, pratos ocultos, pratos adicionados à mão, lista de compras, filtros e a sessão "Cozinhando agora". Em **Meu histórico → Backup** dá para copiar tudo como texto e restaurar colando.

O site tem um *service worker* "rede primeiro": com internet sempre pega a versão nova; sem internet usa a última cópia.

## Telas

1. **Abertura** (15 s, canvas, toca sempre que o app abre; um toque pula): panela de barro sobre fogão a lenha, a tampa chacoalha e o vapor forma "A REFEIÇÃO HOJE É...".
2. **Início** — "Eu gosto", "Todas as categorias", "Meu histórico", "Lista de compras" e aviso de preparo em andamento.
3. **Eu gosto** — favoritos com nota de 1 a 5 ⭐ e anotação; busca que ignora acentos; dá para digitar um prato fora do catálogo; "🎲 Sortear entre meus favoritos". O texto da busca e as anotações são salvos enquanto você digita.
4. **Categorias** — 12 categorias com colagem de fotos, "🎲 Me surpreenda" e "＋ Meu prato" (**segure** esse botão para restaurar pratos ocultos).
5. **Prateleira** — palco com a foto (zoom lento "Ken Burns" ao parar ~0,9 s), carrossel 3D arrastável com inércia, filtros (tipo, refeição, tempo, dificuldade, custo, região, vegetariano/sem lactose/sem glúten), "Ver receita", "Sortear daqui", "Ocultar prato" e link de vídeo no YouTube.
6. **Roleta** — sobe com rufar de tambor, gira com marchinha de circo; toque (ou 15 s) e ela para **exatamente** no prato sorteado. "Vou fazer este!" ou "Hoje não, escolha outro". Os filtros ativos valem para o sorteio.
7. **Receita** — porções que recalculam as quantidades, ingredientes, **"Vai bem com"** (acompanhamentos sugeridos, que vão para a lista de compras junto com o prato), passos, dica do chef e curiosidade.
8. **Cozinhando agora** — cronômetro que continua com o app fechado (guarda a hora de início), um passo por vez em letra grande, timers automáticos quando o passo cita um tempo ("asse por 40 minutos") com alarme sonoro, "✅ Terminei" com nota; mais de 4 h pergunta "Esqueceu de terminar?".
9. **Lista de compras** — ingredientes somados (ou por receita), caixinhas, "Limpar marcados" e "Compartilhar como texto".
10. **Meu histórico** — refeições, notas, quantas vezes fez cada prato e backup.

**Sorteio inteligente:** o "Me surpreenda" e o sorteio dos favoritos usam só **pratos principais** (arroz, feijão, couve, farofa e petiscos ficam de fora); marcando café/lanche entram lanches e petiscos, marcando sobremesa entram os doces, e o filtro **Tipo** escolhe à mão. O "Sortear daqui" de uma categoria usa tudo o que está nela. No catálogo, prato nunca feito tem 3× mais chance; nos favoritos, chance ∝ estrelas² e cresce com o tempo sem fazer (rodízio). "Hoje não" derruba a chance por 3 dias. Prato feito não volta por 7 dias e o sorteado fica fora das 3 rodadas seguintes.

**Sons:** todos sintetizados na hora com Web Audio (rufar, marchinha original, tique da roleta, ta-dá, chiado da panela, alarme) — nenhum arquivo de áudio.

---

## Instalar e atualizar pelo Obtainium (recomendado)

O [Obtainium](https://github.com/ImranR98/Obtainium) instala o APK direto das **Releases** deste repositório e avisa quando sai versão nova.

1. Instale o Obtainium no celular (pelo F-Droid ou pelas releases do GitHub dele).
2. No Obtainium, toque em **Adicionar app** e cole: `https://github.com/virtongameplaysrj/a-refeicao-hoje-e`
3. Toque em **Adicionar** e depois em **Instalar**. Permita "instalar apps desta fonte" quando o Android pedir.

Daí em diante o Obtainium confere as releases e oferece a atualização sozinho.

> Telas e pratos novos **não** precisam de atualização do APK: chegam pelo site. Release nova só sai quando a parte Android muda.

**Publicar uma nova versão do APK** (quem mantém o app):

```powershell
.\scripts\publicar-apk.ps1 -Notas "O que mudou nesta versão"
```

O script sobe a versão (`versionCode`/`versionName`), compila, confere a assinatura, faz commit e cria a release `vX.Y.Z` com o APK.

## Instalar o app no celular sem o Obtainium

1. Copie `entregas/a-refeicao-hoje-e.apk` para o celular (cabo, Google Drive, WhatsApp para você mesmo...).
2. Abra o arquivo e permita "instalar apps desta fonte" quando o Android pedir.
3. Na primeira abertura é preciso internet (para baixar os pratos); depois funciona offline.

Ou, com o celular ligado por cabo e a depuração USB ativa:

```powershell
$env:ANDROID_USER_HOME='E:\Dev\Android\user-home'; E:\Dev\Android\Sdk\platform-tools\adb.exe install -r entregas\a-refeicao-hoje-e.apk
```

## Compilar o APK

Pré-requisitos (já instalados neste PC): JDK 17, Android SDK em `E:\Dev\Android\Sdk`, Gradle (o projeto traz o *wrapper*).

```powershell
cd android
$env:GRADLE_USER_HOME='E:\Dev\gradle-home'; $env:ANDROID_HOME='E:\Dev\Android\Sdk'
.\gradlew.bat assembleRelease
```

O APK sai em `android/app/build/outputs/apk/release/app-release.apk`.

**Assinatura:** a chave fica **fora do projeto**, em `E:\Dev\keystores\a-refeicao-hoje-e\` (`a-refeicao-hoje-e.jks` + `keystore.properties`). Guarde uma cópia dessa pasta: atualizações do app precisam ser assinadas com a mesma chave. Para usar outro caminho: `.\gradlew.bat assembleRelease -PassinaturaProps=C:\caminho\keystore.properties`. Sem a chave, o Gradle gera um APK sem assinatura.

**Endereço do site:** está em `android/app/build.gradle` (`SITE_URL`). Só muda se o repositório mudar de nome/dono.

> Só é preciso recompilar o APK quando mudar algo em `android/`. Mudanças em `web/` chegam sozinhas pelo GitHub Pages.

## Publicar mudanças no site

Qualquer `git push` na branch `main` dispara o workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml), que **valida o catálogo** e publica a pasta `web/`. Acompanhe em *Actions* no GitHub. No celular, feche e abra o app (o WebView pode guardar o site por alguns minutos).

Para testar no PC antes de publicar:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\servidor.ps1
```

e abra http://localhost:8765/ no navegador.

---

## Adicionar ou editar pratos

Os pratos **não** são editados direto no `web/data/pratos.json`: ele é gerado a partir dos lotes em `dados/lotes/` (um por categoria). Cada lote usa um formato compacto, mais fácil de escrever:

```json
{"n":"Feijão tropeiro","r":"Minas Gerais","ref":["almoco","jantar"],"t":60,"d":"M","c":2,"x":"lg","p":6,"tp":"A",
 "desc":"Feijão misturado com farinha de mandioca, torresmo, linguiça, ovos e couve.",
 "i":["2|xícara|feijão carioca cozido","200|g|linguiça","1||cebola picada","|a gosto|sal"],
 "s":["Cozinhe o feijão...","Frite a linguiça...","Junte a farinha..."],
 "dica":"Junte a farinha aos poucos, com o fogo baixo.",
 "cur":"Era a comida dos tropeiros que levavam mercadorias pelo interior de Minas."}
```

| Campo | Significado | Valores |
|---|---|---|
| `n` | nome (o `id` é gerado dele: `baiao-de-dois`) | texto |
| `r` | região | `São Paulo`, `Minas Gerais`, `Rio de Janeiro`, `Santos` |
| `ref` | refeições | `cafe`, `almoco`, `jantar`, `lanche`, `sobremesa` |
| `t` | tempo de preparo em minutos | número |
| `d` | dificuldade | `F` fácil, `M` média, `D` difícil |
| `c` | custo | `1` barato, `2` médio, `3` caro |
| `x` | restrições atendidas | letras juntas: `v` vegetariano, `l` sem lactose, `g` sem glúten (ex.: `"vlg"`, ou `""`) |
| `p` | rendimento (porções) | número |
| `vb` | vai bem com (opcional) | lista de ids de acompanhamentos (`A`) ou petiscos (`E`), ex.: `["arroz-branco-soltinho","couve-refogada-a-mineira"]` |
| `tp` | papel na refeição | `P` prato principal, `A` acompanhamento, `E` petisco/porção, `L` lanche/salgado, `D` doce, `B` bebida |
| `i` | ingredientes: `quantidade\|unidade\|item` | quantidade `2`, `1/2`, `1 1/2` ou vazio; unidade vazia = contável ("3 ovos") |
| `s` | passos (mínimo 3) | textos |
| `desc`, `dica`, `cur` | descrição, dica do chef, curiosidade | textos |

Unidades aceitas: `xícara`, `colher de sopa`, `colher de chá`, `g`, `kg`, `ml`, `l`, `dente`, `pitada`, `maço`, `fatia`, `lata`, `pacote`, `ramo`, `folha`, `pedaço`, `copo`, `vidro`, `espiga`, `a gosto` ou vazio.

Depois de editar:

```powershell
.\scripts\validar-lote.ps1 -Lote 02-bovina      # confere um lote (quantidade, campos, repetidos no catálogo inteiro)
.\scripts\buscar-fotos.ps1                      # busca foto só para pratos novos
.\scripts\montar-catalogo.ps1                   # valida tudo, exige 160 pratos e grava web/data/pratos.json
git add -A; git commit -m "Novo prato"; git push
```

Regras do validador: quantidade certa por categoria (a soma tem que dar **exatamente 160** — para incluir um prato, troque por outro ou ajuste `$Categorias` em `scripts/comum.ps1`), todos os campos preenchidos, ao menos 3 ingredientes e 3 passos, unidades no padrão e **nenhum nome repetido** no catálogo inteiro (comparando sem acentos, artigos e enfeites como "caseiro", "tradicional", "da vovó"). O `montar-catalogo.ps1` também confere a meta de cada lugar (`$MetaRegiao`: 50 SP, 50 MG, 40 RJ, 20 Santos).

**Pratos só seus** não precisam de nada disso: use "＋ Meu prato" no app (ficam no aparelho e entram no backup).

### Fotos

`scripts/buscar-fotos.ps1` procura a foto de cada prato no Wikimedia Commons via API da Wikipédia (em lotes, para respeitar o limite de requisições), recorta para **600×900** e grava em `web/fotos/<id>.jpg`, guardando **autor, licença e link** em `dados/fotos.json` (o app mostra o crédito embaixo da foto). Prato sem foto adequada recebe no app uma **arte gerada** com o ícone da categoria e degradê.

Para escolher a foto à mão, edite `dados/fotos-manual.json` com o nome exato do arquivo no Commons (ou `""` para usar a arte) e rode o script para esse prato:

```json
{ "prato-feito-com-bife-e-ovo": "Prato feito.jpg", "arroz-branco-soltinho": "" }
```

```powershell
.\scripts\buscar-fotos.ps1 -Ids prato-feito-com-bife-e-ovo
.\scripts\montar-catalogo.ps1
```

## Estrutura

```
android/            casca WebView (Java) + Gradle wrapper
dados/lotes/        os 12 lotes de pratos (formato compacto)
dados/fotos.json    crédito das fotos (gerado)
scripts/            validar, montar, buscar fotos, servidor local
web/                o site: index.html, css/, js/, data/pratos.json, fotos/
.github/workflows/  publicação no GitHub Pages
entregas/           APK pronto
```

## Limitações conhecidas

- Os **timers** tocam enquanto o app está aberto (ou ao voltar para ele): o Android pausa o JavaScript em segundo plano. O cronômetro de preparo não depende disso, porque guarda a hora de início.
- Na primeira abertura é preciso internet.
