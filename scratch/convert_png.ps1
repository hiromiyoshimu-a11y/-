Add-Type -AssemblyName System.Drawing

$src = (Get-Item "public\icon-192.png").FullName
$dest192 = (Join-Path (Get-Location) "public\icon-192.png")
$dest512 = (Join-Path (Get-Location) "public\icon-512.png")
$destPng = (Join-Path (Get-Location) "public\icon.png")

$bytes = [System.IO.File]::ReadAllBytes($src)
$ms = New-Object System.IO.MemoryStream(,$bytes)
$img = [System.Drawing.Image]::FromStream($ms)

$img.Save($dest192, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Save($dest512, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Save($destPng, [System.Drawing.Imaging.ImageFormat]::Png)

$img.Dispose()
$ms.Dispose()

Write-Host "PNG CONVERSION SUCCESSFUL!"
