'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Download, Share, Smartphone, SquarePlus } from 'lucide-react';
import { isIos, isStandalone, promptInstall, useInstallState } from '@/lib/pwa-install';

export function InstallAppCard() {
  const { canPrompt, installed } = useInstallState();
  // Détection côté client uniquement (évite un décalage d'hydratation)
  const [env, setEnv] = useState<{ standalone: boolean; ios: boolean } | null>(null);

  useEffect(() => {
    setEnv({ standalone: isStandalone(), ios: isIos() });
  }, []);

  if (!env) return null;

  const alreadyInstalled = installed || env.standalone;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-5" /> Application
        </CardTitle>
        <CardDescription>
          Installe DashLife sur ton téléphone ou ton ordinateur pour l'ouvrir comme une vraie app, en plein écran.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {alreadyInstalled ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" /> L'application est installée sur cet appareil.
          </p>
        ) : canPrompt ? (
          <Button className="w-full sm:w-auto" onClick={() => promptInstall()}>
            <Download className="size-4 mr-2" />
            Installer l'application
          </Button>
        ) : env.ios ? (
          <ol className="space-y-2 text-muted-foreground">
            <li className="flex items-center gap-2">
              1. Dans Safari, appuie sur <Share className="size-4 text-foreground" /> <strong className="text-foreground">Partager</strong>
            </li>
            <li className="flex items-center gap-2">
              2. Choisis <SquarePlus className="size-4 text-foreground" /> <strong className="text-foreground">Sur l'écran d'accueil</strong>
            </li>
          </ol>
        ) : (
          <p className="text-muted-foreground">
            Utilise l'option <strong className="text-foreground">« Installer l'application »</strong> du menu de ton
            navigateur (Chrome, Edge…). L'installation nécessite une connexion HTTPS.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
