$ErrorActionPreference = 'Stop'

$zipUrl = "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.8.1%2B1/OpenJDK17U-jdk_x64_windows_hotspot_17.0.8.1_1.zip"
$zipPath = "C:\Users\user\jdk.zip"
$tempDir = "C:\Users\user\.bubblewrap\temp_jdk"
$destDir = "C:\Users\user\.bubblewrap\jdk"

Write-Output "Downloading JDK 17..."
curl.exe -L -o $zipPath $zipUrl

Write-Output "Cleaning up destination directories..."
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
if (Test-Path $destDir) { Remove-Item -Recurse -Force $destDir }
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
New-Item -ItemType Directory -Path $destDir -Force | Out-Null

Write-Output "Extracting JDK archive..."
Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

Write-Output "Moving JDK files to destination..."
$subfolder = Get-ChildItem -Path $tempDir -Directory | Select-Object -First 1 -ExpandProperty FullName
Get-ChildItem -Path $subfolder | ForEach-Object {
    Move-Item -Path $_.FullName -Destination $destDir -Force
}

Write-Output "Cleaning up temporary files..."
Remove-Item $zipPath -Force
Remove-Item -Recurse -Force $tempDir

Write-Output "JDK 17 installed successfully!"
