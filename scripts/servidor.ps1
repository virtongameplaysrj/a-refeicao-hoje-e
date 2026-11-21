<#
  Servidor estático simples para testar o site localmente (sem Node/Python).
  Uso: .\scripts\servidor.ps1 [-Porta 8765]   e abra http://localhost:8765/
#>
param([int]$Porta = 8765)
$raiz = Join-Path (Split-Path $PSScriptRoot -Parent) 'web'
$tipos = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.json'='application/json; charset=utf-8'; '.svg'='image/svg+xml'; '.jpg'='image/jpeg'; '.png'='image/png';
  '.webmanifest'='application/manifest+json'; '.ico'='image/x-icon' }
$http = New-Object Net.HttpListener
$http.Prefixes.Add("http://localhost:$Porta/")
$http.Start()
Write-Host "Servindo $raiz em http://localhost:$Porta/"
try {
  while ($http.IsListening) {
    $ctx = $http.GetContext()
    $caminho = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if (-not $caminho) { $caminho = 'index.html' }
    $arq = Join-Path $raiz $caminho
    $resp = $ctx.Response
    try {
      if ((Test-Path $arq -PathType Leaf) -and ([IO.Path]::GetFullPath($arq).StartsWith($raiz))) {
        $bytes = [IO.File]::ReadAllBytes($arq)
        $ext = [IO.Path]::GetExtension($arq).ToLower()
        $resp.ContentType = if ($tipos[$ext]) { $tipos[$ext] } else { 'application/octet-stream' }
        $resp.Headers.Add('Cache-Control', 'no-cache')
        $resp.OutputStream.Write($bytes, 0, $bytes.Length)
      } else { $resp.StatusCode = 404 }
    } catch { $resp.StatusCode = 500 } finally { $resp.Close() }
  }
} finally { $http.Stop() }
