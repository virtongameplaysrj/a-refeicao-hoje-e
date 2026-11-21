<#
  Publica uma nova versão do APK como GitHub Release (é de lá que o Obtainium baixa e atualiza).

  Uso:  .\scripts\publicar-apk.ps1 -Notas "O que mudou nesta versão"
        .\scripts\publicar-apk.ps1 -SemSubirVersao      (publica a versão atual, sem incrementar)

  Passos: sobe versionCode (+1) e versionName (x.y.z -> x.y.z+1) em android/app/build.gradle,
  compila o APK assinado, confere a assinatura, copia para entregas/, faz commit + push
  e cria a release vX.Y.Z com o APK anexado.

  Só é preciso quando algo em android/ mudar: mudanças em web/ chegam pelo GitHub Pages.
#>
param([string]$Notas = 'Atualização do app.', [switch]$SemSubirVersao)
$ErrorActionPreference = 'Stop'
$Raiz = Split-Path $PSScriptRoot -Parent
$env:PATH = "E:\Dev\git\cmd;E:\Dev\gh\bin;$env:PATH"
$env:GRADLE_USER_HOME = 'E:\Dev\gradle-home'
$env:ANDROID_HOME = 'E:\Dev\Android\Sdk'
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot' }
$utf8 = New-Object Text.UTF8Encoding($false)

# 1. Versão
$gradle = Join-Path $Raiz 'android/app/build.gradle'
$txt = [IO.File]::ReadAllText($gradle)
$code = [int]([regex]::Match($txt, 'versionCode (\d+)').Groups[1].Value)
$nome = [regex]::Match($txt, "versionName '([\d\.]+)'").Groups[1].Value
if (-not $SemSubirVersao) {
  $partes = $nome.Split('.'); $partes[-1] = [string]([int]$partes[-1] + 1)
  $code++; $nome = $partes -join '.'
  $txt = [regex]::Replace($txt, 'versionCode \d+', "versionCode $code")
  $txt = [regex]::Replace($txt, "versionName '[\d\.]+'", "versionName '$nome'")
  [IO.File]::WriteAllText($gradle, $txt, $utf8)
}
$tag = "v$nome"
Write-Host "Versão $nome (código $code)" -ForegroundColor Cyan

# 2. Compilar
Push-Location (Join-Path $Raiz 'android')
try { & .\gradlew.bat assembleRelease --no-daemon -q; if ($LASTEXITCODE) { throw 'Falha ao compilar o APK' } } finally { Pop-Location }
$apk = Join-Path $Raiz 'android/app/build/outputs/apk/release/app-release.apk'

# 3. Assinatura (o Obtainium/Android recusam atualizar se a chave mudar)
$apksigner = Get-ChildItem 'E:\Dev\Android\Sdk\build-tools' -Directory | Sort-Object Name -Descending | Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName 'apksigner.bat' }
& $apksigner verify $apk
if ($LASTEXITCODE) { throw 'APK sem assinatura válida. A chave está em E:\Dev\keystores\a-refeicao-hoje-e\ ?' }

# 4. Copiar, commit e push
$entrega = Join-Path $Raiz 'entregas/a-refeicao-hoje-e.apk'
Copy-Item $apk $entrega -Force
Set-Location $Raiz
$msg = [IO.Path]::GetTempFileName()
[IO.File]::WriteAllText($msg, "APK $tag`n`n$Notas`n", $utf8)
git add android/app/build.gradle entregas/a-refeicao-hoje-e.apk
git diff --cached --quiet; if ($LASTEXITCODE) { git commit -q -F $msg }
git push -q

# 5. Release com o APK (nome com a versão, para o Obtainium identificar)
$anexo = Join-Path ([IO.Path]::GetTempPath()) "a-refeicao-hoje-e-$tag.apk"
Copy-Item $apk $anexo -Force
[IO.File]::WriteAllText($msg, $Notas, $utf8)
gh release create $tag $anexo --title "A refeição hoje é... $tag" --notes-file $msg
if ($LASTEXITCODE) { throw 'Falha ao criar a release no GitHub' }
Remove-Item $msg, $anexo -ErrorAction SilentlyContinue
Write-Host "Publicado: https://github.com/virtongameplaysrj/a-refeicao-hoje-e/releases/tag/$tag" -ForegroundColor Green
