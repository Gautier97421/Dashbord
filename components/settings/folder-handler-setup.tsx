'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, FolderOpen } from 'lucide-react';
import { FOLDER_HANDLER_INSTALLER, isFolderHandlerEnabled, setFolderHandlerEnabled } from '@/lib/project-links';

// Active l'ouverture des dossiers de projets dans l'Explorateur Windows (protocole "dashlife-open:")
export function FolderHandlerSetup() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isFolderHandlerEnabled());
  }, []);

  const downloadInstaller = () => {
    const blob = new Blob([FOLDER_HANDLER_INSTALLER], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashlife-dossiers.ps1';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="size-5" /> Ouvrir les dossiers de projets
        </CardTitle>
        <CardDescription>
          Un navigateur ne peut pas ouvrir un dossier de ton ordinateur tout seul. Installe une fois ce petit
          raccourci Windows pour que le bouton « Explorateur » des liens de projets fonctionne.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
          <li>Télécharge l'installateur.</li>
          <li>Clic droit sur <code className="text-foreground">dashlife-dossiers.ps1</code> → « Exécuter avec PowerShell ».</li>
          <li>Coche la case ci-dessous. Au premier clic, le navigateur te demandera d'autoriser l'ouverture.</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Installation pour ton compte Windows uniquement, sans droits administrateur. Le raccourci ne fait qu'afficher un
          dossier : il n'ouvre ni n'exécute jamais un fichier.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button variant="outline" size="sm" onClick={downloadInstaller}>
            <Download className="size-4 mr-2" />
            Télécharger l'installateur
          </Button>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={enabled}
              onCheckedChange={(checked) => {
                setEnabled(checked === true);
                setFolderHandlerEnabled(checked === true);
              }}
            />
            C'est installé sur cet ordinateur
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Sans l'installer, les liens de dossiers s'ouvrent dans VS Code ou se copient pour les coller dans l'Explorateur.
        </p>
      </CardContent>
    </Card>
  );
}
