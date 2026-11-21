# Funções e tabelas compartilhadas pelos scripts do catálogo.
# Uso: . "$PSScriptRoot\comum.ps1"

$ErrorActionPreference = 'Stop'
$Raiz      = Split-Path $PSScriptRoot -Parent
$PastaLote = Join-Path $Raiz 'dados/lotes'
$ArqFotos  = Join-Path $Raiz 'dados/fotos.json'
$ArqSaida  = Join-Path $Raiz 'web/data/pratos.json'
$PastaFoto = Join-Path $Raiz 'web/fotos'

# Arquivo do lote => categoria e quantidade esperada
$Categorias = [ordered]@{
  '01-classicos'   = @{ nome = 'Clássicos do dia a dia';        qtd = 11 }
  '02-bovina'      = @{ nome = 'Carne bovina';                  qtd = 17 }
  '03-aves'        = @{ nome = 'Frango e aves';                 qtd = 13 }
  '04-suina'       = @{ nome = 'Carne suína';                   qtd = 11 }
  '05-peixes'      = @{ nome = 'Peixes e frutos do mar';        qtd = 20 }
  '06-cozidos'     = @{ nome = 'Cozidos e pratos de panela';    qtd = 8 }
  '07-sopas'       = @{ nome = 'Sopas e caldos';                qtd = 10 }
  '08-massas'      = @{ nome = 'Massas, tortas e forno';        qtd = 10 }
  '09-vegetarianos'= @{ nome = 'Vegetarianos e leguminosas';    qtd = 8 }
  '10-salgados'    = @{ nome = 'Salgados e comida de rua';      qtd = 20 }
  '11-cafe'        = @{ nome = 'Café da manhã e lanche';        qtd = 14 }
  '12-sobremesas'  = @{ nome = 'Sobremesas';                    qtd = 18 }
}
$TotalEsperado = 160

$Regioes     = @('São Paulo','Minas Gerais','Rio de Janeiro','Santos')
# Quantos pratos cada lugar deve ter no catálogo
$MetaRegiao  = @{ 'São Paulo' = 50; 'Minas Gerais' = 50; 'Rio de Janeiro' = 40; 'Santos' = 20 }
$Refeicoes   = @{ cafe='Café da manhã'; almoco='Almoço'; jantar='Jantar'; lanche='Lanche'; sobremesa='Sobremesa' }
$Dificuldade = @{ F='Fácil'; M='Média'; D='Difícil' }
$Custo       = @{ '1'='Barato'; '2'='Médio'; '3'='Caro' }
$Restricao   = @{ v='vegetariano'; l='sem-lactose'; g='sem-gluten' }
$Unidades    = @('', 'a gosto', 'xícara', 'colher de sopa', 'colher de chá', 'g', 'kg', 'ml', 'l',
                 'dente', 'pitada', 'maço', 'fatia', 'lata', 'pacote', 'ramo', 'folha', 'pedaço', 'copo', 'vidro', 'espiga')

function Remove-Acentos([string]$s) {
  $n = $s.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object Text.StringBuilder
  foreach ($ch in $n.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
  }
  $sb.ToString().Normalize([Text.NormalizationForm]::FormC)
}

# Nome normalizado para detectar repetidos: sem acentos, artigos, preposições e "enfeites".
$PalavrasIgnoradas = @('o','a','os','as','um','uma','de','da','do','das','dos','d','e','em','na','no','nas','nos','ao','com',
                       'caseiro','caseira','tradicional','tradicionais','vovo','vo','especial','simples','classico','classica','moda','facil','gostoso','gostosa')
function Get-NomeNormalizado([string]$nome) {
  $s = (Remove-Acentos $nome).ToLowerInvariant() -replace "[^a-z0-9 ]", ' '
  ($s -split '\s+' | Where-Object { $_ -and ($PalavrasIgnoradas -notcontains $_) }) -join ' '
}

function Get-Slug([string]$nome) {
  $s = (Remove-Acentos $nome).ToLowerInvariant() -replace "[^a-z0-9]+", '-'
  $s.Trim('-')
}

function Read-Json([string]$caminho) {
  # No PS 5.1 o ConvertFrom-Json devolve o array inteiro como UM objeto; desembrulhamos aqui.
  $o = [IO.File]::ReadAllText($caminho, [Text.Encoding]::UTF8) | ConvertFrom-Json
  if ($o -is [array]) { foreach ($e in $o) { $e } } else { $o }
}
function Write-Json($obj, [string]$caminho, [int]$prof = 12) {
  $dir = Split-Path $caminho -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  $json = $obj | ConvertTo-Json -Depth $prof -Compress
  # PS 5.1 escapa < > ' & como \u00XX: é JSON válido, mas desfazemos por legibilidade.
  $json = $json -replace '\\u0027', "'" -replace '\\u0026', '&' -replace '\\u003c', '<' -replace '\\u003e', '>'
  [IO.File]::WriteAllText($caminho, $json, (New-Object Text.UTF8Encoding($false)))
}

function ConvertTo-Quantidade([string]$q) {
  $q = $q.Trim()
  if ($q -eq '') { return $null }
  $total = 0.0
  foreach ($parte in ($q -split '\s+')) {
    if ($parte -match '^(\d+)/(\d+)$') { $total += [double]$matches[1] / [double]$matches[2] }
    elseif ($parte -match '^\d+([.,]\d+)?$') { $total += [double]($parte -replace ',', '.') }
    else { throw "quantidade inválida: '$q'" }
  }
  [Math]::Round($total, 3)
}

# Converte um prato do formato compacto do lote para o formato final do catálogo.
function ConvertTo-Prato($p, [string]$categoria, $fotos) {
  $id = Get-Slug $p.n
  $ings = foreach ($linha in $p.i) {
    $partes = $linha -split '\|'
    if ($partes.Count -ne 3) { throw "ingrediente mal formado em '$($p.n)': '$linha' (use quantidade|unidade|item)" }
    [ordered]@{ item = $partes[2].Trim(); quantidade = (ConvertTo-Quantidade $partes[0]); unidade = $partes[1].Trim() }
  }
  $foto = $null
  if ($fotos -and $fotos.PSObject.Properties[$id]) { $foto = $fotos.$id }
  if (-not $foto) { $foto = [ordered]@{ url = ''; autor = ''; licenca = ''; fonte = '' } }
  [ordered]@{
    id          = $id
    nome        = $p.n
    categoria   = $categoria
    regiao      = $p.r
    refeicao    = [object[]]@($p.ref | ForEach-Object { $Refeicoes[$_] })
    tempoMin    = [int]$p.t
    dificuldade = $Dificuldade[[string]$p.d]
    custo       = $Custo[[string]$p.c]
    restricoes  = [object[]]@(([string]$p.x).ToCharArray() | ForEach-Object { $Restricao[[string]$_] })
    rendimento  = [int]$p.p
    descricao   = $p.desc
    ingredientes= [object[]]@($ings)
    passos      = [object[]]@($p.s)
    dica        = $p.dica
    curiosidade = $p.cur
    foto        = $foto
  }
}

# Confere um prato compacto; devolve a lista de problemas encontrados.
function Test-Prato($p) {
  $erros = @()
  foreach ($campo in 'n','r','ref','t','d','c','p','desc','i','s','dica','cur') {
    $v = $p.PSObject.Properties[$campo]
    if (-not $v -or $null -eq $v.Value -or ([string]$v.Value).Trim() -eq '') { $erros += "campo '$campo' vazio" }
  }
  if ($Regioes -notcontains $p.r) { $erros += "região inválida '$($p.r)'" }
  foreach ($r in @($p.ref)) { if (-not $Refeicoes.ContainsKey([string]$r)) { $erros += "refeição inválida '$r'" } }
  if (-not $Dificuldade.ContainsKey([string]$p.d)) { $erros += "dificuldade inválida '$($p.d)'" }
  if (-not $Custo.ContainsKey([string]$p.c)) { $erros += "custo inválido '$($p.c)'" }
  foreach ($ch in ([string]$p.x).ToCharArray()) { if (-not $Restricao.ContainsKey([string]$ch)) { $erros += "restrição inválida '$ch'" } }
  if ([int]$p.t -le 0) { $erros += 'tempo deve ser > 0' }
  if ([int]$p.p -le 0) { $erros += 'rendimento deve ser > 0' }
  if (@($p.i).Count -lt 3) { $erros += "só $(@($p.i).Count) ingredientes (mínimo 3)" }
  if (@($p.s).Count -lt 3) { $erros += "só $(@($p.s).Count) passos (mínimo 3)" }
  foreach ($linha in @($p.i)) {
    $partes = $linha -split '\|'
    if ($partes.Count -ne 3) { $erros += "ingrediente mal formado '$linha'"; continue }
    try { [void](ConvertTo-Quantidade $partes[0]) } catch { $erros += $_.Exception.Message }
    if ($Unidades -notcontains $partes[1].Trim()) { $erros += "unidade fora do padrão '$($partes[1])' em '$linha'" }
    if ($partes[2].Trim() -eq '') { $erros += "ingrediente sem nome '$linha'" }
  }
  $erros
}
