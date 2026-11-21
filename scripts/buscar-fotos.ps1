<#
  Busca uma foto para cada prato no Wikimedia Commons (via API da Wikipédia),
  recorta/redimensiona para 600x900 e guarda URL, autor e licença em dados/fotos.json.

  Uso:  .\scripts\buscar-fotos.ps1               (só os pratos ainda sem registro)
        .\scripts\buscar-fotos.ps1 -Refazer      (refaz todos)
        .\scripts\buscar-fotos.ps1 -Ids pato-no-tucupi,tacaca
        .\scripts\buscar-fotos.ps1 -SemCommons   (pula a busca extra no Commons)

  Como funciona (poucas requisições, para não esbarrar no limite da Wikimedia):
    1. Para cada prato gera títulos candidatos ("Feijoada completa" -> "Feijoada completa", "Feijoada")
       e consulta TODOS em lotes de 50 títulos por requisição, seguindo redirecionamentos.
       Só vale artigo em categoria de culinária, e a imagem principal dele.
    2. Quem ficou sem foto: busca de arquivos no Commons (1 por prato, devagar).
    3. Metadados (autor, licença, URL) em lotes de 50 arquivos.
    4. Baixa a miniatura de 960 px, recorta "cover" para 600x900 e grava web/fotos/<id>.jpg.

  Escolhas manuais em dados/fotos-manual.json:  { "id-do-prato": "Arquivo no Commons.jpg", "outro-id": "" }
  ("" = sem foto; o app usa a arte gerada com o ícone da categoria e degradê).
  Ao final rode .\scripts\montar-catalogo.ps1 para gravar as fotos no pratos.json.
#>
param([switch]$Refazer, [string[]]$Ids, [switch]$SemCommons)
. "$PSScriptRoot\comum.ps1"
Add-Type -AssemblyName System.Drawing
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$UA = 'ARefeicaoHojeE-catalogo/1.0 (script pessoal, sem fins comerciais)'
$WP = 'https://pt.wikipedia.org/w/api.php'
$CM = 'https://commons.wikimedia.org/w/api.php'
$ArqManual = Join-Path $Raiz 'dados/fotos-manual.json'
if (-not (Test-Path $PastaFoto)) { New-Item -ItemType Directory -Force $PastaFoto | Out-Null }

$Culinaria = 'culin|prato|comida|doce|sobremesa|lanche|sandu|sopa|caldo|p[aã]es|bolo|salgad|gastronom|cozinha|alimento|petisco|frutos do mar|ensopad|massa|torta|churrasco|bebida|confeitaria'
$Ruins = 'svg$|\.gif$|\.tif|bandeira|flag|mapa|map[ _]|locator|location|bras[aã]o|coat[ _]of|logo|escudo|icon|selo|seal|montagem|collage|diagram'
$Genericas = @('arroz','feijao','carne','frango','galinha','peixe','sopa','caldo','bolo','pao','doce','torta','salada','creme','molho','farofa','pure',
  'cozido','ensopado','bife','porco','costela','costelinha','lombo','massa','mingau','file','camarao','pastel','queijo','banana','linguica','pato',
  'polenta','tapioca','cuscuz','carne-seca','carne-de-sol','bolinho','sanduiche','canja','moqueca','caldeirada','paçoca','pacoca')
$Ligacoes = @('de','da','do','das','dos','com','a','à','ao','no','na','nos','nas','e','em')

# ---------- Rede ----------
function Wait-Limite($err, [int]$tentativa) {
  $cod = 0; $ra = 0
  try { $cod = [int]$err.Exception.Response.StatusCode; $ra = [int]$err.Exception.Response.Headers['Retry-After'] } catch {}
  $seg = if ($ra -gt 0) { $ra + 2 } elseif ($cod -eq 429) { 60 * ($tentativa + 1) } else { 4 * ($tentativa + 1) }
  Write-Host "    (HTTP $cod, aguardando $seg s)" -ForegroundColor DarkGray
  Start-Sleep -Seconds $seg
}
function Invoke-Api([string]$base, [hashtable]$q, [int]$pausaMs = 1500) {
  $q.format = 'json'; $q.formatversion = '2'
  $qs = ($q.GetEnumerator() | ForEach-Object { "$($_.Key)=$([uri]::EscapeDataString([string]$_.Value))" }) -join '&'
  for ($t = 0; $t -lt 6; $t++) {
    Start-Sleep -Milliseconds $pausaMs
    try { return Invoke-RestMethod -Uri "$base`?$qs" -UserAgent $UA -TimeoutSec 40 } catch { Wait-Limite $_ $t }
  }
  $null
}
function Get-Tokens([string]$s) { @((Get-NomeNormalizado $s) -split ' ' | Where-Object { $_.Length -ge 3 }) }

# ---------- Catálogo e estado ----------
$pratos = foreach ($k in $Categorias.Keys) { foreach ($p in (Read-Json (Join-Path $PastaLote "$k.json"))) { [pscustomobject]@{ id = Get-Slug $p.n; nome = $p.n } } }
$fotos = [ordered]@{}
if (Test-Path $ArqFotos) { (Read-Json $ArqFotos).PSObject.Properties | ForEach-Object { $fotos[$_.Name] = $_.Value } }
$manual = @{}
if (Test-Path $ArqManual) { (Read-Json $ArqManual).PSObject.Properties | ForEach-Object { $manual[$_.Name] = [string]$_.Value } }

$alvo = @($pratos | Where-Object {
  if ($Ids) { $Ids -contains $_.id } elseif ($Refazer) { $true } else { -not $fotos.Contains($_.id) }
})
Write-Host "Pratos a processar: $($alvo.Count)" -ForegroundColor Cyan
if (-not $alvo.Count) { return }

# ---------- 1. Títulos candidatos, consultados em lotes de 50 ----------
function Get-Titulos([string]$nome) {
  $pal = @($nome -split '\s+')
  $lista = New-Object Collections.ArrayList
  [void]$lista.Add($nome)
  for ($k = $pal.Count - 1; $k -ge 1; $k--) {
    $ultima = $pal[$k - 1].ToLower()
    if ($Ligacoes -contains $ultima) { continue }
    if ($k -eq 1 -and $Genericas -contains (Remove-Acentos $ultima)) { continue }
    [void]$lista.Add(($pal[0..($k - 1)] -join ' '))
  }
  @($lista | Select-Object -Unique)
}
$escolha = @{}   # id -> nome do arquivo
$candidatosPorPrato = @{}
$todosTitulos = New-Object Collections.Generic.HashSet[string]
foreach ($p in $alvo) {
  if ($manual.ContainsKey($p.id)) { $escolha[$p.id] = $manual[$p.id]; continue }
  $t = Get-Titulos $p.nome; $candidatosPorPrato[$p.id] = $t
  foreach ($x in $t) { [void]$todosTitulos.Add($x) }
}
$titulos = @($todosTitulos)
Write-Host "Consultando $($titulos.Count) títulos na Wikipédia em $([Math]::Ceiling($titulos.Count / 50)) lotes..."
$mapa = @{}     # título pedido -> título final (após normalizar/redirecionar)
$paginas = @{}  # título final -> @{ imagem; cats }
for ($i = 0; $i -lt $titulos.Count; $i += 50) {
  $lote = $titulos[$i..([Math]::Min($i + 49, $titulos.Count - 1))]
  $q = @{ action = 'query'; titles = ($lote -join '|'); redirects = '1'; prop = 'pageimages|categories'; piprop = 'name'; cllimit = 'max'; clshow = '!hidden' }
  $cont = $null
  do {
    $qq = $q.Clone(); if ($cont) { foreach ($k in $cont.PSObject.Properties.Name) { $qq[$k] = $cont.$k } }
    $r = Invoke-Api $WP $qq
    if (-not $r) { break }
    foreach ($n in @($r.query.normalized)) { if ($n) { $mapa[$n.from] = $n.to } }
    foreach ($n in @($r.query.redirects)) { if ($n) { $mapa[$n.from] = $n.to } }
    foreach ($pg in @($r.query.pages)) {
      if (-not $pg -or $pg.missing) { continue }
      if (-not $paginas.ContainsKey($pg.title)) { $paginas[$pg.title] = @{ imagem = $null; cats = '' } }
      if ($pg.pageimage) { $paginas[$pg.title].imagem = $pg.pageimage }
      if ($pg.categories) { $paginas[$pg.title].cats += ' ' + ((@($pg.categories) | ForEach-Object { $_.title }) -join ' ') }
    }
    $cont = $r.continue
  } while ($cont)
}
function Resolve-Titulo([string]$t) { $x = $t; for ($k = 0; $k -lt 4 -and $mapa.ContainsKey($x); $k++) { $x = $mapa[$x] }; $x }

$usados = @{}
foreach ($p in $alvo) {
  if ($escolha.ContainsKey($p.id)) { continue }
  foreach ($t in $candidatosPorPrato[$p.id]) {
    $pg = $paginas[(Resolve-Titulo $t)]
    if (-not $pg -or -not $pg.imagem -or $pg.imagem -match $Ruins) { continue }
    if ($pg.cats -notmatch $Culinaria) { continue }
    if ($usados[$pg.imagem]) { continue }
    $escolha[$p.id] = $pg.imagem; $usados[$pg.imagem] = $true
    break
  }
}
Write-Host "Wikipédia: $($escolha.Count) de $($alvo.Count) pratos com imagem."

# ---------- 2. Busca extra no Commons para quem ficou sem ----------
if (-not $SemCommons) {
  $faltam = @($alvo | Where-Object { -not $escolha.ContainsKey($_.id) })
  Write-Host "Commons: buscando $($faltam.Count) pratos (devagar, para respeitar o limite)..."
  foreach ($p in $faltam) {
    $tok = Get-Tokens $p.nome
    if (-not $tok.Count) { continue }
    $minimo = if ($tok.Count -le 2) { $tok.Count } else { [Math]::Ceiling($tok.Count * 0.6) }
    $r = Invoke-Api $CM @{ action = 'query'; list = 'search'; srsearch = "$($p.nome) filetype:bitmap"; srnamespace = '6'; srlimit = '10'; srprop = '' } 2500
    foreach ($s in @($r.query.search)) {
      if (-not $s) { continue }
      $arq = $s.title -replace '^(File|Arquivo|Ficheiro):', ''
      if ($arq -match $Ruins -or $usados[$arq]) { continue }
      $ta = Get-Tokens ($arq -replace '\.\w+$', '' -replace '[_-]', ' ')
      $comum = @($tok | Where-Object { $ta -contains $_ }).Count
      if ($ta -contains $tok[0] -and $comum -ge $minimo) { $escolha[$p.id] = $arq; $usados[$arq] = $true; Write-Host "    $($p.nome) -> $arq"; break }
    }
  }
}

# ---------- 3. Metadados em lotes de 50 arquivos ----------
$arquivos = @($escolha.Values | Where-Object { $_ } | Select-Object -Unique)
$info = @{}
for ($i = 0; $i -lt $arquivos.Count; $i += 50) {
  $lote = $arquivos[$i..([Math]::Min($i + 49, $arquivos.Count - 1))] | ForEach-Object { "File:$_" }
  $r = Invoke-Api $CM @{ action = 'query'; titles = ($lote -join '|'); prop = 'imageinfo'; iiprop = 'url|size|extmetadata|mime'; iiurlwidth = '960' }
  $norm = @{}; foreach ($n in @($r.query.normalized)) { if ($n) { $norm[$n.to] = $n.from } }
  foreach ($pg in @($r.query.pages)) {
    if (-not $pg -or -not $pg.imageinfo) { continue }
    $ii = $pg.imageinfo[0]
    if ($ii.mime -notmatch 'jpeg|png|webp' -or $ii.width -lt 400 -or $ii.height -lt 300) { continue }
    $m = $ii.extmetadata
    $autor = if ($m.Artist) { [Net.WebUtility]::HtmlDecode(($m.Artist.value -replace '<[^>]+>', '')).Trim() } else { 'Desconhecido' }
    $autor = ($autor -replace '\s+', ' ')
    if ($autor.Length -gt 80) { $autor = $autor.Substring(0, 77) + '...' }
    $lic = if ($m.LicenseShortName) { $m.LicenseShortName.value } else { 'ver página' }
    $nomeArq = ($pg.title -replace '^(File|Arquivo|Ficheiro):', '')
    $dados = [pscustomobject]@{ thumb = $(if ($ii.thumburl) { $ii.thumburl } else { $ii.url }); autor = $autor; licenca = $lic; fonte = $ii.descriptionurl }
    $info[$nomeArq] = $dados
    $info[($nomeArq -replace ' ', '_')] = $dados
    if ($norm[$pg.title]) { $info[($norm[$pg.title] -replace '^File:', '')] = $dados }
  }
}

# ---------- 4. Download e recorte 600x900 ----------
$Codec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
function Save-Retrato([string]$urlImg, [string]$destino) {
  $tmp = [IO.Path]::GetTempFileName()
  try {
    $baixou = $false
    for ($t = 0; $t -lt 5 -and -not $baixou; $t++) {
      Start-Sleep -Milliseconds 1200
      try { Invoke-WebRequest -Uri $urlImg -UserAgent $UA -OutFile $tmp -UseBasicParsing -TimeoutSec 60; $baixou = $true } catch { Wait-Limite $_ $t }
    }
    if (-not $baixou) { throw 'download falhou' }
    $src = [Drawing.Image]::FromFile($tmp)
    try {
      $W = 600; $H = 900
      $esc = [Math]::Max($W / $src.Width, $H / $src.Height)
      $cw = $W / $esc; $ch = $H / $esc
      $cx = ($src.Width - $cw) / 2; $cy = [Math]::Max(0, ($src.Height - $ch) / 2.4)
      $bmp = New-Object Drawing.Bitmap $W, $H
      $g = [Drawing.Graphics]::FromImage($bmp)
      $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
      $g.DrawImage($src, (New-Object Drawing.RectangleF 0, 0, $W, $H), (New-Object Drawing.RectangleF $cx, $cy, $cw, $ch), [Drawing.GraphicsUnit]::Pixel)
      $par = New-Object Drawing.Imaging.EncoderParameters 1
      $par.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), 80L
      $bmp.Save($destino, $Codec, $par)
      $g.Dispose(); $bmp.Dispose()
    } finally { $src.Dispose() }
    $true
  } catch { Write-Host "    falha: $($_.Exception.Message)" -ForegroundColor DarkYellow; $false }
  finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
}

$ok = 0; $sem = 0; $n = 0
foreach ($p in $alvo) {
  $n++
  $arq = $escolha[$p.id]; $dados = if ($arq) { $info[$arq] } else { $null }
  $dest = Join-Path $PastaFoto "$($p.id).jpg"
  if ($dados -and (Save-Retrato $dados.thumb $dest)) {
    $fotos[$p.id] = [ordered]@{ url = "fotos/$($p.id).jpg"; autor = $dados.autor; licenca = $dados.licenca; fonte = $dados.fonte; arquivo = $arq }
    $ok++; Write-Host ("[{0}/{1}] {2} <- {3}" -f $n, $alvo.Count, $p.nome, $arq) -ForegroundColor Green
  } else {
    $fotos[$p.id] = [ordered]@{ url = ''; autor = ''; licenca = ''; fonte = ''; arquivo = '' }
    Remove-Item $dest -ErrorAction SilentlyContinue
    $sem++; Write-Host ("[{0}/{1}] {2} -> arte gerada" -f $n, $alvo.Count, $p.nome) -ForegroundColor DarkYellow
  }
  Write-Json $fotos $ArqFotos 4
}
Write-Host "Concluído: $ok com foto, $sem com arte gerada. Rode montar-catalogo.ps1 em seguida." -ForegroundColor Cyan
