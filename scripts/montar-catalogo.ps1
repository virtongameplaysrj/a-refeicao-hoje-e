<#
  Junta os 12 lotes no catálogo final web/data/pratos.json.
  Uso: .\scripts\montar-catalogo.ps1

  Valida tudo de novo, exige EXATAMENTE 300 pratos, confere o equilíbrio entre regiões
  e incorpora as fotos já baixadas (dados/fotos.json).
#>
. "$PSScriptRoot\comum.ps1"

& "$PSScriptRoot\validar-lote.ps1" -Todos
if ($LASTEXITCODE) { throw 'Validação falhou; corrija os lotes antes de montar.' }

$fotos = if (Test-Path $ArqFotos) { Read-Json $ArqFotos } else { $null }
$catalogo = New-Object Collections.ArrayList
foreach ($chave in $Categorias.Keys) {
  $arq = Join-Path $PastaLote "$chave.json"
  if (-not (Test-Path $arq)) { throw "Falta o lote $chave" }
  foreach ($p in (Read-Json $arq)) { [void]$catalogo.Add((ConvertTo-Prato $p $Categorias[$chave].nome $fotos)) }
}

if ($catalogo.Count -ne $TotalEsperado) { throw "Total $($catalogo.Count) — esperado exatamente $TotalEsperado" }

# Equilíbrio: nenhuma região abaixo de 12% nem acima de 30% do catálogo
$falhou = $false
Write-Host 'Distribuição por região:'
foreach ($r in $Regioes) {
  $n = @($catalogo | Where-Object { $_.regiao -eq $r }).Count
  $pct = [Math]::Round(100 * $n / $catalogo.Count, 1)
  $cor = if ($pct -lt 12 -or $pct -gt 30) { $falhou = $true; 'Red' } else { 'Gray' }
  Write-Host ("  {0,-13} {1,3}  ({2}%)" -f $r, $n, $pct) -ForegroundColor $cor
}
if ($falhou) { throw 'Regiões desequilibradas (limites: 12% a 30%).' }

$comFoto = @($catalogo | Where-Object { $_.foto.url }).Count
Write-Json ([object[]]$catalogo.ToArray()) $ArqSaida
$kb = [Math]::Round((Get-Item $ArqSaida).Length / 1KB)
Write-Host "OK: $($catalogo.Count) pratos gravados em web/data/pratos.json ($kb KB). Com foto: $comFoto; com arte gerada: $($catalogo.Count - $comFoto)." -ForegroundColor Green
