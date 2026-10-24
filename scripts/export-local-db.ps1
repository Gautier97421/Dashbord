# Exporte la base DashLife locale (Docker sur le PC) dans dashlife-local.sql, pour la reprendre sur le VPS.
# Usage (PowerShell, depuis le dossier du projet) :  .\scripts\export-local-db.ps1
# Le fichier contient toutes tes données : ne le partage pas et supprime-le après la restauration.
$ErrorActionPreference = 'Stop'
$container = 'dashboard_postgres'
$out = Join-Path (Get-Location) 'dashlife-local.sql'

# pg_dump écrit dans le conteneur puis on copie le fichier (une redirection PowerShell
# réencoderait le texte et corromprait l'export)
docker exec $container pg_dump -U dashboard_user -d dashboard_db --no-owner --no-acl -f /tmp/dashlife-local.sql
docker cp "${container}:/tmp/dashlife-local.sql" $out
docker exec $container rm -f /tmp/dashlife-local.sql

$size = [math]::Round((Get-Item $out).Length / 1KB)
Write-Host "Export terminé : $out ($size Ko)"
Write-Host "Copie-le sur le serveur, par exemple : scp dashlife-local.sql utilisateur@ton-vps:~/dashlife/"
