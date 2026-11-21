<#
  Confere um lote (uma categoria) do catálogo.
  Uso:  .\scripts\validar-lote.ps1 -Lote 01-classicos
        .\scripts\validar-lote.ps1 -Todos

  Verifica: quantidade certa, campos obrigatórios, ao menos 3 ingredientes e 3 passos,
  unidades no padrão e nenhum nome/id repetido no catálogo INTEIRO (todos os lotes já escritos).
#>
param([string]$Lote, [switch]$Todos)
. "$PSScriptRoot\comum.ps1"

$arquivos = Get-ChildItem $PastaLote -Filter '*.json' | Sort-Object Name
if (-not $Todos -and -not $Lote) { throw 'Informe -Lote <nome> ou -Todos' }
$alvos = if ($Todos) { $arquivos.BaseName } else { @($Lote) }

# Índice global de nomes normalizados e ids (de todos os lotes existentes)
$porNome = @{}; $porId = @{}
foreach ($arq in $arquivos) {
  foreach ($p in (Read-Json $arq.FullName)) {
    $k = Get-NomeNormalizado $p.n; $id = Get-Slug $p.n
    if (-not $porNome[$k]) { $porNome[$k] = @() }; $porNome[$k] += "$($arq.BaseName): $($p.n)"
    if (-not $porId[$id])  { $porId[$id] = @() };  $porId[$id]  += "$($arq.BaseName): $($p.n)"
  }
}

$falhas = 0
foreach ($nomeLote in $alvos) {
  if (-not $Categorias.Contains($nomeLote)) { throw "Lote desconhecido: $nomeLote" }
  $cat = $Categorias[$nomeLote]
  $pratos = @(Read-Json (Join-Path $PastaLote "$nomeLote.json"))
  Write-Host "== $nomeLote ($($cat.nome)) ==" -ForegroundColor Cyan

  if ($pratos.Count -ne $cat.qtd) { Write-Host "  ERRO quantidade: $($pratos.Count) (esperado $($cat.qtd))" -ForegroundColor Red; $falhas++ }
  else { Write-Host "  quantidade ok: $($pratos.Count)" }

  foreach ($p in $pratos) {
    foreach ($e in (Test-Prato $p)) { Write-Host "  ERRO [$($p.n)] $e" -ForegroundColor Red; $falhas++ }
    $k = Get-NomeNormalizado $p.n
    if ($porNome[$k].Count -gt 1) { Write-Host "  ERRO nome repetido '$k': $($porNome[$k] -join ' | ')" -ForegroundColor Red; $falhas++ }
    $id = Get-Slug $p.n
    if ($porId[$id].Count -gt 1) { Write-Host "  ERRO id repetido '$id': $($porId[$id] -join ' | ')" -ForegroundColor Red; $falhas++ }
  }
  $reg = $pratos | Group-Object r | ForEach-Object { "$($_.Name)=$($_.Count)" }
  Write-Host "  regiões: $($reg -join ', ')"
}

$total = 0; foreach ($arq in $arquivos) { $total += @(Read-Json $arq.FullName).Count }
Write-Host "Catálogo até agora: $total de $TotalEsperado pratos em $($arquivos.Count) lotes."
if ($falhas) { Write-Host "$falhas problema(s) encontrado(s)." -ForegroundColor Red; exit 1 }
Write-Host 'Tudo certo.' -ForegroundColor Green
