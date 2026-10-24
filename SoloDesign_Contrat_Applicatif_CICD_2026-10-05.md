# SoloDesign — Contrat des dépôts applicatifs & CI/CD

> **Référence : 2026-10-05**
>
> **But**
>
> Ce document décrit le contrat applicatif actuel attendu par la plateforme SoloDesign pour qu’un dépôt puisse être validé, testé, buildé, scanné, migré et déployé automatiquement en **DEV, PREPROD et PROD**.
>
> Il est conçu pour être donné tel quel à une IA ou à un développeur afin de préparer un dépôt compatible avec la plateforme.
>
> **Règle principale : ne pas inventer de clés, de conventions, de secrets, de réseaux, de tags d’images ou de workflows différents de ceux documentés ici.**
>
> Ce document remplace les anciennes versions du contrat, notamment l’ancien fonctionnement PostgreSQL basé sur une simple variable `DATABASE_URL` fournie par le projet applicatif.

---

# 1. Vue d’ensemble de la plateforme

La plateforme SoloDesign sépare clairement :

```text
dépôt applicatif
→ décrit l'application

pipeline centrale
→ orchestre CI/CD

composants CI réutilisables
→ exécutent validation/build/scan/DB/DNS/deploy/smoke

Portainer
→ exécute les stacks Docker

Traefik
→ publie les applications HTTP/HTTPS

PostgreSQL central
→ héberge les bases applicatives gérées
```

Un dépôt applicatif ne doit pas réimplémenter la logique de plateforme.

Le dépôt décrit uniquement :

- comment tester l’application ;
- comment construire son image ;
- comment démarrer le runtime ;
- son port ;
- son health endpoint ;
- ses besoins runtime ;
- ses besoins de stockage persistant ;
- ses besoins PostgreSQL éventuels ;
- ses domaines et ressources par environnement.

La plateforme centrale gère notamment :

- runners GitLab ;
- politique de branches/tags ;
- credentials ;
- GitLab Registry ;
- scans ;
- construction des images ;
- Portainer ;
- Docker ;
- Traefik ;
- DNS OVH ;
- ACME / Let's Encrypt ;
- PostgreSQL central ;
- création des bases/rôles ;
- secrets PostgreSQL applicatifs ;
- migrations DB ;
- backups pré-migration ;
- garde-fous de rollback ;
- promotion PREPROD → release ;
- smoke tests ;
- GitLab Environments.

---

# 2. Environnements et infrastructure

Trois environnements applicatifs existent :

```text
development
preproduction
production
```

Ils doivent toujours être nommés exactement ainsi dans `solodesign.yml`.

## 2.1 DEV

Le DEV est exécuté sur l’hôte Docker interne SoloDesign.

Références actuelles :

```text
Docker DEV
IP infrastructure : 192.168.50.70

Traefik / applications :
network = solodesign-proxy

PostgreSQL :
container = solodesign-postgres-dev
host Docker = postgres-dev
port = 5432
network = solodesign-db
volume = solodesign-postgres-dev-data
```

Le DNS DEV est géré par l’infrastructure interne / wildcard.

Convention :

```text
<app>.dev.solodesign.fr
```

Aucun record OVH n’est normalement créé pour DEV.

## 2.2 PREPROD

PREPROD est déployé sur le VPS de production, mais dans une stack, un domaine, des volumes et une base PostgreSQL séparés de PROD.

Convention :

```text
<app>.preprod.solodesign.fr
```

Le VPS de référence est actuellement :

```text
51.77.146.214
```

## 2.3 PROD

PROD est également déployé sur le VPS de production.

Exemples :

```text
<app>.solodesign.fr
app.client.fr
```

PREPROD et PROD utilisent le **même moteur PostgreSQL central de production**, mais jamais la même base ni le même rôle.

Architecture DB cible :

```text
Docker DEV
└── solodesign-postgres-dev
    ├── help_dev
    ├── app1_dev
    └── app2_dev

VPS PROD
└── solodesign-postgres-prod
    ├── help_preprod
    ├── help_prod
    ├── app1_preprod
    ├── app1_prod
    └── ...
```

Il n’existe donc pas de moteur `solodesign-postgres-preprod` séparé.

L’isolation PREPROD / PROD se fait au niveau :

```text
stack Docker
domaine
variables runtime
volume applicatif
database PostgreSQL
rôle PostgreSQL
```

---

# 3. Runners GitLab

Architecture actuelle :

```text
Runner CI / DEV
192.168.50.31

├── tag: ci
│   Docker executor
│   jobs CI non protégés
│
└── tag: deploy-dev
    Shell executor
    déploiements DEV

Runner protégé
192.168.50.32

└── tag: deploy-protected
    Shell executor
    PREPROD / PROD
    protected
```

Le dépôt applicatif ne choisit normalement pas lui-même les runners : la pipeline centrale le fait.

---

# 4. Composants CI centraux

La pipeline applicative centrale assemble les composants SoloDesign.

Composants actuels :

```text
validate
quality
test
build
scan
credentials
policy
database-postgres
dns-ovh
deploy-portainer
smoke
version
```

Les composants sont actuellement consommés depuis :

```text
SoloDesign/platform/components
```

et la pipeline applicative depuis :

```text
SoloDesign/platform/pipelines/application.yml
```

Tant que les composants ne sont pas publiés comme version stable du Catalog, les includes utilisent actuellement `@main`.

Lorsqu’une version stable sera figée, les projets devront être épinglés sur une version stable au lieu de suivre `main`.

---

# 5. Fichiers attendus dans un dépôt applicatif

Minimum :

```text
repo/
├── .gitlab-ci.yml
├── solodesign.yml
├── Dockerfile
├── .dockerignore
└── code application
```

Optionnels selon le projet :

```text
.trivyignore
package-lock.json
pnpm-lock.yaml
yarn.lock
prisma/
migrations/
.env.example
```

Obligatoire fonctionnellement :

- `.gitlab-ci.yml` ;
- `solodesign.yml` ;
- `Dockerfile` ;
- `.dockerignore` ;
- un target Docker `test` ;
- un target Docker `runtime` ;
- une route de healthcheck HTTP ;
- le code et les fichiers nécessaires au build ;
- si DB gérée avec migrations : les fichiers de migrations versionnés ;
- si DB gérée avec migrations : un target Docker de migration.

Ne jamais committer :

```text
.env
.env.production
mot de passe
token
clé API
DATABASE_URL réelle
DIRECT_URL réelle
credentials PostgreSQL
credentials Portainer
credentials OVH
```

---

# 6. `.gitlab-ci.yml` du dépôt applicatif

Le dépôt applicatif ne recopie jamais la pipeline centrale.

Format actuel :

```yaml
spec:

  inputs:

    action:

      description: "auto = normal ; preprod = valider une nouvelle version ; prod = déployer ou rollback une version validée"

      default: auto

      options:

        - auto
        - preprod
        - prod


    version:

      description: "Version SemVer sans v. Exemple : 1.2.3. Utilisée pour PREPROD."

      default: ""

      regex: '^([0-9]+\.[0-9]+\.[0-9]+)?$'

---

include:

  - project: "solodesign/platform/pipelines"

    ref: main

    file: "/application.yml"

    inputs:

      action: $[[ inputs.action ]]

      version: $[[ inputs.version ]]
```

Le dépôt applicatif ne doit pas ajouter lui-même :

- credentials Portainer ;
- credentials OVH ;
- token plateforme GitLab ;
- logique DNS ;
- logique de promotion des images ;
- logique de création des tags ;
- logique de provisioning PostgreSQL ;
- mot de passe administrateur PostgreSQL ;
- commandes de déploiement Portainer.

---

# 7. Workflow CI/CD

## 7.1 DEV

Toute branche différente de `main`, avec `action=auto`.

Flow logique :

```text
push branche
→ validate
→ quality
→ test
→ build runtime dev-<SHA>
→ éventuellement build migration dev-db-<SHA>
→ scan runtime
→ éventuellement scan migration
→ database:development
→ deploy:development
→ smoke:development
→ GitLab Environment development
```

Pour une application sans DB gérée :

```text
database stage
→ no-op / non applicable selon configuration
```

Pour une application PostgreSQL gérée :

```text
database:development
→ provision DB/rôle
→ backup si nouvelle migration
→ migration
→ déploiement application
```

Image runtime DEV :

```text
registry.../<project>:dev-<CI_COMMIT_SHA>
```

Image migration DEV, si nécessaire :

```text
registry.../<project>:dev-db-<CI_COMMIT_SHA>
```

Stack :

```text
<app.name>-dev
```

Il n’existe qu’une stack DEV par application.

Un nouveau push remplace la stack DEV existante.

---

## 7.2 Push normal sur `main`

Un push classique sur `main` avec `action=auto` valide le code mais ne publie pas une release.

Flow actuel :

```text
credentials / policy
→ validate
→ quality
→ test
```

Il ne déclenche pas automatiquement PREPROD ou PROD.

---

## 7.3 PREPROD

Déclenchement volontaire :

```text
Run pipeline
ref = main
action = preprod
version = X.Y.Z
```

Flow :

```text
guards / policy
→ validate
→ quality
→ test
→ build runtime rc-X.Y.Z-<SHA>
→ éventuellement build migration rc-db-X.Y.Z-<SHA>
→ scan runtime
→ éventuellement scan migration
→ database:preproduction
→ DNS PREPROD
→ deploy PREPROD
→ smoke PREPROD
→ promotion exacte des images
→ création tag Git vX.Y.Z
```

Image runtime candidate :

```text
rc-X.Y.Z-<SHA>
```

Image migration candidate :

```text
rc-db-X.Y.Z-<SHA>
```

Si PREPROD échoue :

```text
pas de release vX.Y.Z finale
pas de tag Git final vX.Y.Z
```

La même version `X.Y.Z` peut être retentée sur un autre SHA tant que le tag final `vX.Y.Z` n’existe pas.

Après validation :

```text
rc-X.Y.Z-SHA
→ vX.Y.Z

rc-db-X.Y.Z-SHA
→ db-vX.Y.Z
```

Aucun rebuild n’est effectué pendant la promotion.

Les images validées en PREPROD sont exactement celles éligibles à PROD.

---

## 7.4 PROD

PROD se lance depuis une release validée en PREPROD.

```text
New pipeline
ref = vX.Y.Z
action = prod
version = vide
```

GitLab fournit :

```text
CI_COMMIT_TAG=vX.Y.Z
CI_COMMIT_SHA=<SHA release>
```

La pipeline vérifie notamment :

```text
tag SemVer vX.Y.Z
tag protégé v*
SHA correspondant à une release validée
historique PREPROD successful
garde-fous DB
credentials
```

Flow :

```text
guard production
→ database:production
→ DNS production
→ deploy production
→ smoke production
```

Image runtime :

```text
vX.Y.Z
```

Image migration :

```text
db-vX.Y.Z
```

Stack :

```text
<app.name>-prod
```

Il n’y a pas de rebuild de l’application en PROD.

---

## 7.5 Rollback PROD

Le rollback applicatif utilise un ancien tag validé :

```text
PROD actuelle = v1.4.0

Run pipeline
ref = v1.2.3
action = prod
```

Le runtime cible devient :

```text
v1.2.3
```

Mais une base de données introduit une contrainte supplémentaire.

La plateforme ne suppose jamais qu’un rollback applicatif implique automatiquement un rollback du schéma SQL.

Politique DB par défaut :

```yaml
rollback:
  policy: safe
```

Avec `safe`, si la base PROD est déjà associée à une version de schéma plus récente que la version applicative ciblée, le déploiement ancien est bloqué.

Exemple :

```text
DB courante = 1.4.0
application cible = 1.2.3

policy=safe
→ blocage
```

La plateforme ne fait pas automatiquement :

```text
migration DOWN
restore automatique du dump
destruction du schéma
```

La politique `allow` existe pour des cas explicitement maîtrisés, mais elle ne constitue pas une migration DOWN. Elle signifie uniquement qu’une application plus ancienne est autorisée à être redéployée contre le schéma existant lorsque la compatibilité est connue.

---

# 8. Contrat du Dockerfile

## 8.1 Targets obligatoires

Pour toutes les applications :

```text
test
runtime
```

Pour une application utilisant une DB gérée et des migrations :

```text
migration
```

Le nom peut être configuré via `database.migrations.target`, mais la convention standard est :

```text
migration
```

## 8.2 Structure générique

```dockerfile
FROM <image> AS dependencies

WORKDIR /app

# installer dépendances


FROM dependencies AS source

WORKDIR /app

COPY . .


FROM source AS test

RUN <tests>


FROM source AS build

RUN <build production>


FROM source AS migration

CMD ["<migration-client>", "<arguments>"]


FROM <runtime minimal> AS runtime

WORKDIR /app

COPY --from=build ...

USER <non-root>

EXPOSE <app.port>

CMD ["<runtime>"]
```

Tous les projets n’ont pas besoin d’un stage `build` distinct.

Les stages intermédiaires peuvent être adaptés au framework :

```text
dependencies
source
lint
test
build
migration
runtime
```

## 8.3 Target `test`

Il doit réellement échouer si les tests échouent.

Correct :

```dockerfile
FROM source AS test
RUN npm test
```

Interdit :

```dockerfile
RUN npm test || true
```

## 8.4 Target `runtime`

Il doit :

- contenir uniquement ce qui est nécessaire à l’exécution ;
- être multi-stage lorsque pertinent ;
- fonctionner non-root lorsque possible ;
- écouter sur `app.port` ;
- fournir `app.health` ;
- ne jamais embarquer de secrets réels ;
- ne pas nécessiter des outils de build inutiles ;
- idéalement ne pas embarquer `npm`, `npx`, compilateurs ou CLI de migration si le runtime n’en a pas besoin.

Un Docker `HEALTHCHECK` est recommandé mais ne remplace pas le smoke test externe.

## 8.5 Target `migration`

Une image de migration est un artefact distinct du runtime.

Elle doit contenir :

- le client/CLI de migration ;
- les migrations versionnées ;
- les dépendances requises ;
- rien de secret ;
- aucune `DATABASE_URL` réelle au build.

Elle reçoit `DATABASE_URL` uniquement au runtime lors de l’exécution du job de migration.

Pour Prisma, convention recommandée :

```dockerfile
FROM source AS migration

CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]
```

Éviter de dépendre de `npx` dans l’image de migration si le binaire local peut être invoqué directement.

## 8.6 Alpine

Si une image Alpine est utilisée :

```dockerfile
RUN apk upgrade --no-cache
```

est recommandé lorsque cela permet d’intégrer les correctifs disponibles.

Ne pas utiliser Alpine `edge` simplement pour masquer une CVE.

## 8.7 Build-time placeholders

Les valeurs fictives strictement nécessaires à un build sont autorisées si elles sont clairement non sensibles.

Exemple :

```dockerfile
ENV API_HOST=placeholder.invalid
```

Aucune valeur de production réelle ne doit être présente dans le Dockerfile.

---

# 9. `.dockerignore`

Minimum recommandé :

```text
.git
.gitlab
node_modules
.next
dist
build
coverage
.env
.env.*
*.log
.trivycache
```

Adapter à la technologie.

Ne jamais exclure un fichier requis par le build.

Exemple avec Prisma :

```text
prisma/
```

ne doit pas être exclu si le Docker build construit l’image de migration.

---

# 10. `solodesign.yml`

`solodesign.yml` décrit l’application.

Il ne décrit pas l’infrastructure centrale.

## 10.1 Application sans PostgreSQL géré

```yaml
version: 1

app:

  name: myapp

  port: 3000

  health: /api/health


ci:

  docker:

    test_enabled: true

    test_target: test

    runtime_target: runtime


runtime:

  env_required: true


database:

  type: none


environments:

  development:

    domain: myapp.dev.solodesign.fr

    dns:

      provider: none

    resources:

      memory: 512m

      cpus: "0.5"


  preproduction:

    domain: myapp.preprod.solodesign.fr

    dns:

      provider: ovh

      target: 51.77.146.214

      allow_replace: false

    resources:

      memory: 512m

      cpus: "0.5"


  production:

    domain: myapp.solodesign.fr

    dns:

      provider: ovh

      target: 51.77.146.214

      allow_replace: false

    resources:

      memory: 512m

      cpus: "0.5"
```

## 10.2 Application avec PostgreSQL géré + Prisma

```yaml
version: 1

app:

  name: myapp

  port: 3000

  health: /api/health


ci:

  docker:

    test_enabled: true

    test_target: test

    runtime_target: runtime


runtime:

  # false si la DB gérée est le seul besoin de configuration runtime.
  # DATABASE_URL et DIRECT_URL sont injectées par la plateforme.
  env_required: false


database:

  type: postgres

  mode: managed

  connection_limit: 5

  migrations:

    provider: prisma

    target: migration

    path: prisma/migrations

    command: ./node_modules/.bin/prisma migrate deploy

  backup:

    before_migrate: true

    retention_days: 14

  rollback:

    policy: safe


environments:

  development:

    domain: myapp.dev.solodesign.fr

    dns:

      provider: none

    resources:

      memory: 512m

      cpus: "0.5"


  preproduction:

    domain: myapp.preprod.solodesign.fr

    dns:

      provider: ovh

      target: 51.77.146.214

      allow_replace: false

    resources:

      memory: 512m

      cpus: "0.5"


  production:

    domain: myapp.solodesign.fr

    dns:

      provider: ovh

      target: 51.77.146.214

      allow_replace: false

    resources:

      memory: 512m

      cpus: "0.5"
```

---

# 11. Référence `solodesign.yml`

## 11.1 `version`

```yaml
version: 1
```

Version actuelle du contrat :

```text
1
```

## 11.2 `app.name`

```yaml
app:
  name: webmail
```

Identifiant stable.

Il sert notamment aux noms de stacks et aux noms DB dérivés.

Recommandations :

- minuscules ;
- chiffres autorisés ;
- tirets autorisés ;
- pas d’espace ;
- stable dans le temps.

Changer `app.name` après mise en service peut conduire à la création de nouvelles ressources au lieu de réutiliser les anciennes.

## 11.3 `app.port`

Port TCP interne du conteneur.

Exemple :

```yaml
app:
  port: 3000
```

Ce n’est pas un port public du VPS.

Traefik route vers ce port sur le réseau Docker.

## 11.4 `app.health`

Exemple :

```yaml
app:
  health: /api/health
```

Doit répondre en HTTP `2xx`, normalement `200`, quand l’application est saine.

Pour une application fortement dépendante de PostgreSQL, le health endpoint peut vérifier une requête légère telle que `SELECT 1`.

---

# 12. `ci.docker`

Format :

```yaml
ci:

  docker:

    test_enabled: true

    test_target: test

    runtime_target: runtime
```

`test_enabled` doit normalement rester à `true`.

Convention :

```text
test_target = test
runtime_target = runtime
```

---

# 13. Configuration runtime

## 13.1 `runtime.env_required`

```yaml
runtime:
  env_required: true
```

Si `true`, le déploiement attend une configuration runtime applicative.

Utiliser `true` pour des variables comme :

```text
NEXTAUTH_SECRET
SMTP_HOST
IMAP_HOST
API_URL
S3_ENDPOINT
SESSION_SECRET
```

Utiliser `false` si aucune variable applicative additionnelle n’est requise.

Important pour une DB gérée :

```text
DATABASE_URL
DIRECT_URL
```

sont injectées automatiquement par la plateforme.

Elles ne doivent donc pas être utilisées comme raison unique pour mettre `env_required: true`.

## 13.2 Variables GitLab runtime

La plateforme cherche :

```text
DEV        → APP_ENV_DEV
PREPROD    → APP_ENV_PREPROD
PROD       → APP_ENV_PROD
```

avec fallback :

```text
APP_ENV
```

Contenu attendu :

```dotenv
KEY=value
ANOTHER_KEY=value
```

Une variable GitLab de type `File` peut être utilisée.

Une variable multi-ligne de type `File` ne peut pas toujours être `Masked` à cause des contraintes GitLab.

Ne jamais afficher le contenu des variables runtime dans les logs.

## 13.3 Variables DB réservées

Pour une DB PostgreSQL gérée, les variables suivantes appartiennent à la plateforme :

```text
DATABASE_URL
DIRECT_URL
```

Ne pas les définir dans `APP_ENV_*`.

La plateforme les génère depuis le rôle, le mot de passe et la DB provisionnés.

---

# 14. Volumes applicatifs persistants

Sans stockage persistant, la section peut être absente.

Avec stockage :

```yaml
runtime:

  persistent_volume:

    enabled: true

    target: /app/data

    names:

      development: app-dev-data

      preproduction: app-preprod-data

      production: app-prod-data
```

Règles :

- un volume par environnement ;
- jamais de volume PROD utilisé en DEV/PREPROD ;
- ne pas supprimer un volume en même temps qu’une stack si ses données doivent être conservées ;
- pour une application existante, réutiliser exactement le nom historique du volume.

Le stockage PostgreSQL n’est pas déclaré ici.

Il est géré par la plateforme PostgreSQL centrale.

---

# 15. PostgreSQL géré — architecture

## 15.1 Principe

Une application ne déploie pas son propre conteneur PostgreSQL.

La plateforme possède deux moteurs centraux :

```text
DEV
solodesign-postgres-dev
host = postgres-dev

PREPROD + PROD
solodesign-postgres-prod
host = postgres-prod
```

Tous deux sont accessibles uniquement via :

```text
network Docker = solodesign-db
port interne = 5432
```

Aucun port PostgreSQL ne doit être publié sur l’hôte.

Donc :

```text
Internet      ─X→ PostgreSQL
VPS:5432      ─X→ PostgreSQL
application   → solodesign-db → postgres-*:5432
```

## 15.2 Isolation

Chaque application et environnement obtient sa propre DB et son propre rôle.

Exemple avec :

```yaml
app:
  name: help
```

Résultat :

```text
development:
DB   = help_dev
ROLE = help_dev
HOST = postgres-dev

preproduction:
DB   = help_preprod
ROLE = help_preprod
HOST = postgres-prod

production:
DB   = help_prod
ROLE = help_prod
HOST = postgres-prod
```

PREPROD et PROD sont donc dans le même moteur central sur le VPS, mais avec des identités SQL séparées.

## 15.3 Provisioning

Le job `database-postgres` ne se connecte pas directement au port PostgreSQL depuis le runner.

Il utilise l’API Portainer / Docker pour exécuter les opérations administratives dans le conteneur PostgreSQL central.

Flow simplifié :

```text
GitLab protected job
→ Portainer API
→ Docker exec dans solodesign-postgres-*
→ psql local
→ création / validation rôle
→ création / validation database
```

Le secret administrateur PostgreSQL reste dans le projet d’infrastructure `platform/postgres`.

Il n’est jamais transmis au dépôt applicatif.

## 15.4 Password applicatif

Le composant génère un mot de passe applicatif fort lors du premier provisioning.

Le secret est persistant dans le volume PostgreSQL :

```text
/var/lib/postgresql/data/solodesign/secrets/<database>.password
```

Le fichier est protégé par des permissions restrictives.

Lors des exécutions suivantes :

```text
secret existant
→ réutilisé
→ password du rôle resynchronisé avec ce secret
```

Cela évite de changer la credential DB à chaque pipeline.

Le dépôt applicatif et GitLab n’ont pas besoin de conserver ce password.

## 15.5 `DATABASE_URL`

Au déploiement, `deploy-portainer` relit le secret via Portainer et construit la connexion.

Forme logique :

```text
postgresql://<role>:<password>@<host>:5432/<db>?schema=public&connection_limit=<N>
```

Puis la plateforme injecte automatiquement :

```text
DATABASE_URL
DIRECT_URL
```

dans la stack applicative.

Le password n’est jamais écrit dans Git.

## 15.6 `connection_limit`

Exemple :

```yaml
database:
  connection_limit: 5
```

Valeur prévue :

```text
1 à 100
```

Une valeur modérée est recommandée pour éviter qu’une multitude d’applications consomment toutes les connexions du moteur partagé.

---

# 16. PostgreSQL géré — configuration

## 16.1 Pas de DB

```yaml
database:
  type: none
```

## 16.2 PostgreSQL sans migration automatique

Utiliser explicitement :

```yaml
database:

  type: postgres

  mode: managed

  connection_limit: 5

  migrations:

    provider: none

  rollback:

    policy: safe
```

La plateforme peut provisionner DB/rôle/password même sans outil de migration.

La DB sera simplement créée sans modification de schéma par la CI.

## 16.3 Prisma

```yaml
database:

  type: postgres

  mode: managed

  connection_limit: 5

  migrations:

    provider: prisma

    target: migration

    path: prisma/migrations

    command: ./node_modules/.bin/prisma migrate deploy

  backup:

    before_migrate: true

    retention_days: 14

  rollback:

    policy: safe
```

## 16.4 Provider custom

Un projet peut utiliser un autre système de migration.

Exemple conceptuel :

```yaml
database:

  type: postgres

  mode: managed

  migrations:

    provider: custom

    target: migration

    path: db/migrations

    command: ./scripts/migrate.sh

  backup:

    before_migrate: true

    retention_days: 14

  rollback:

    policy: safe
```

Avec `custom`, `path` et `command` doivent correspondre au fonctionnement réel du projet.

Ne jamais inventer une commande de migration qui n’existe pas.

---

# 17. Prisma — contrat de développement

`schema.prisma` n’est pas, à lui seul, la migration de production.

Il décrit le modèle attendu.

Workflow de développement recommandé :

```text
modifier schema.prisma
→ générer une migration localement
→ vérifier migration.sql
→ commit migration.sql
→ push
```

Exemple local :

```bash
npx prisma migrate dev --name add_customer_status
```

Cela produit :

```text
prisma/migrations/<timestamp>_add_customer_status/migration.sql
```

Ce dossier doit être committé.

En CI :

```text
interdit comme stratégie de déploiement :
prisma migrate dev
prisma db push

utilisé :
prisma migrate deploy
```

La CI applique les migrations déjà versionnées.

Elle ne doit pas inventer un nouveau schéma au moment du déploiement.

La preuve Prisma de l’application d’une migration est notamment enregistrée dans :

```text
_prisma_migrations
```

---

# 18. Build des migrations

Quand :

```yaml
database:
  type: postgres
  migrations:
    provider: prisma
```

ou un provider custom avec migrations activées, le build produit deux artefacts Docker.

DEV :

```text
runtime:
dev-<SHA>

migration:
dev-db-<SHA>
```

PREPROD :

```text
runtime:
rc-X.Y.Z-<SHA>

migration:
rc-db-X.Y.Z-<SHA>
```

Release :

```text
runtime:
vX.Y.Z

migration:
db-vX.Y.Z
```

Le build renseigne les métadonnées nécessaires dans son artifact `build.env`.

Une release DB n’est pas reconstruite après PREPROD :

```text
rc-db-X.Y.Z-SHA
→ même image
→ db-vX.Y.Z
```

---

# 19. Scan de l’image de migration

L’image runtime et l’image de migration sont scannées séparément.

La migration peut contenir davantage d’outils que le runtime ; elle reste malgré tout soumise aux règles de sécurité.

Politique :

```text
HIGH     → bloquant
CRITICAL → bloquant
```

Les vulnérabilités non corrigées peuvent être traitées selon la politique Trivy existante, mais il ne faut pas neutraliser le scan globalement.

Exemple de jobs logiques :

```text
scan:development
scan:database:development

scan:preproduction
scan:database:preproduction
```

Le job DB ne doit commencer qu’après les scans nécessaires.

---

# 20. Détection des nouvelles migrations

La plateforme calcule un hash déterministe du chemin configuré :

```yaml
migrations:
  path: prisma/migrations
```

Le hash porte sur les fichiers de migration versionnés.

Conséquence :

```text
modification du code uniquement
→ hash migration identique
→ pas de migration DB

modification schema.prisma uniquement
sans nouveau fichier migration
→ hash migration identique
→ pas de migration DB

nouveau migration.sql
→ hash différent
→ backup + migration
```

C’est volontaire.

Pour Prisma, modifier uniquement `schema.prisma` sans produire de migration n’est pas considéré comme un changement DB déployable.

---

# 21. Backup pré-migration

Si :

```yaml
backup:
  before_migrate: true
```

et si une nouvelle migration doit réellement être appliquée :

```text
DB existante
→ pg_dump -Fc
→ validation du dump avec pg_restore -l
→ SHA256
→ migration
```

Les backups pré-migration sont stockés dans le volume PostgreSQL central, sous une arborescence de type :

```text
/var/lib/postgresql/data/solodesign/backups/<database>/
```

Une somme SHA256 est conservée à côté du dump.

Rétention :

```yaml
retention_days: 14
```

Valeur prévue :

```text
1 à 365 jours
```

## Limite importante

Ce mécanisme protège contre :

```text
migration applicative défectueuse
besoin de récupération rapide
```

mais ce n’est **pas un backup disaster recovery complet**, car le dump est stocké sur le même stockage central PostgreSQL.

Si le VPS et son volume sont perdus simultanément, le backup local peut être perdu avec la DB.

La plateforme doit donc également disposer d’une stratégie de backup externe au VPS pour être considérée comme protégée contre une perte complète d’hôte.

Cette stratégie infrastructure est indépendante du contrat d’un dépôt applicatif.

---

# 22. Exécution d’une migration

Lorsqu’une nouvelle migration est détectée :

```text
provision DB/rôle
→ backup pré-migration
→ validation backup
→ création stack de migration temporaire
→ connexion à solodesign-db
→ DATABASE_URL injectée
→ exécution command
→ attente fin conteneur
→ lecture exit code
→ nettoyage stack temporaire
→ sauvegarde de l’état migration
```

Le composant attend explicitement la fin du conteneur de migration.

Une migration qui dépasse le délai prévu est considérée en erreur.

En cas d’échec :

```text
logs migration affichés
→ pipeline échoue
→ application nouvelle NON déployée
→ backup conservé
```

La plateforme ne restaure pas automatiquement le dump.

Le runtime précédent continue donc de rester la référence tant que le nouveau déploiement n’a pas eu lieu.

---

# 23. État DB et rollback

La plateforme conserve un état de migration permettant notamment de suivre :

- hash des migrations ;
- version applicative/release associée lorsque disponible ;
- dernier état connu.

En PROD, la politique par défaut :

```yaml
rollback:
  policy: safe
```

empêche un rollback applicatif dangereux vers une version antérieure lorsque le schéma DB a déjà avancé.

Important :

```text
safe rollback
≠ migration DOWN automatique
≠ restore automatique
```

C’est un garde-fou de compatibilité.

---

# 24. Réseau DB dans les stacks applicatives

Une application sans PostgreSQL géré rejoint normalement :

```text
solodesign-proxy
```

Une application avec PostgreSQL géré rejoint :

```text
solodesign-proxy
solodesign-db
```

Traefik utilise `solodesign-proxy`.

PostgreSQL utilise `solodesign-db`.

Le réseau DB est déclaré external côté stack applicative.

Le moteur PostgreSQL central n’a pas besoin d’être présent sur le réseau proxy.

---

# 25. PostgreSQL central — sécurité

Le moteur central suit les principes suivants :

```text
aucun port host 5432 publié
network solodesign-db internal=true
volume Docker persistant
auth TCP SCRAM-SHA-256
no-new-privileges
healthcheck
ressources limitées
logs Docker rotatifs
```

Le compte :

```text
solodesign_admin
```

est un compte de plateforme.

Une application ne doit jamais utiliser ce compte.

Elle utilise son propre rôle, par exemple :

```text
help_prod
```

Le mot de passe admin DEV / PROD appartient au dépôt :

```text
SoloDesign/platform/postgres
```

et non aux projets applicatifs.

---

# 26. DNS

Providers actuels :

```text
none
ovh
```

## DEV

```yaml
dns:
  provider: none
```

Le wildcard interne prend en charge les domaines DEV.

## PREPROD / PROD

Exemple :

```yaml
dns:

  provider: ovh

  target: 51.77.146.214

  allow_replace: false
```

`allow_replace: false` est le comportement normal.

Si un domaine existe déjà avec une autre IP, la pipeline bloque au lieu de le remplacer silencieusement.

Utiliser `allow_replace: true` uniquement pendant une migration DNS explicitement maîtrisée.

---

# 27. Traefik

Aucun fichier Traefik ne doit être ajouté au dépôt applicatif.

Le composant de déploiement génère automatiquement les labels nécessaires.

Conceptuellement :

```text
traefik.enable=true
Host(`<domain>`)
entrypoint=websecure
tls=true
certresolver=ovh
secure-headers@file
port=<app.port>
```

Lorsqu’un conteneur apparaît :

```text
labels
→ Traefik détecte
→ route active
```

Lorsqu’une stack disparaît :

```text
labels disparaissent
→ route disparaît
```

Le DNS est indépendant et peut rester présent.

---

# 28. TLS

Traefik gère :

```text
ACME
→ Let's Encrypt
→ certificat
→ renouvellement
```

Le dépôt applicatif ne configure pas lui-même le certificat.

---

# 29. Portainer

Le dépôt applicatif ne contient pas de configuration Portainer.

Stacks :

```text
DEV       <app>-dev
PREPROD   <app>-preprod
PROD      <app>-prod
```

La pipeline :

```text
cherche stack
→ vérifie absence de doublon
→ CREATE si absente
→ UPDATE si présente
```

Le GitLab Registry privé est configuré côté infrastructure.

Le fonctionnement normal doit rester piloté par GitLab.

Éviter les modifications manuelles de stack dans Portainer, car elles créent du drift par rapport à la CI.

---

# 30. Registry et tags

Conventions runtime :

```text
DEV
dev-<SHA>

PREPROD
rc-X.Y.Z-<SHA>

RELEASE
vX.Y.Z
```

Conventions migration :

```text
DEV
dev-db-<SHA>

PREPROD
rc-db-X.Y.Z-<SHA>

RELEASE
db-vX.Y.Z
```

Les images finales :

```text
vX.Y.Z
db-vX.Y.Z
```

doivent rester immuables.

Une release `vX.Y.Z` représente un couple cohérent :

```text
runtime validé
+
migration image validée si DB
+
PREPROD validée
+
smoke réussi
```

---

# 31. Cleanup Registry

Images temporaires :

```text
dev-*
rc-*
```

incluent également :

```text
dev-db-*
rc-db-*
```

et peuvent être soumises à la politique de rétention.

Politique actuelle prévue :

```text
cadence environ quotidienne
older_than environ 7 jours
keep_n plusieurs images récentes
```

Images de release à conserver :

```text
v*
db-v*
```

Elles sont nécessaires à la traçabilité et aux rollbacks.

---

# 32. Sécurité et scans

## 32.1 Source

Trivy analyse notamment :

```text
secrets
misconfiguration
```

Les findings bloquants stoppent la pipeline.

## 32.2 Dockerfile

Hadolint analyse le Dockerfile.

Les erreurs configurées comme bloquantes doivent être corrigées.

## 32.3 Images

Trivy analyse l’image runtime et, si présente, l’image migration.

Politique :

```text
HIGH     bloquant
CRITICAL bloquant
```

Ne jamais affaiblir les scans pour faire passer une pipeline.

---

# 33. `.trivyignore`

`.trivyignore` est optionnel.

Il ne doit servir qu’à une exception :

- précise ;
- identifiée par CVE ;
- temporaire ;
- justifiée ;
- avec expiration.

Exemple :

```text
# Fix indisponible dans la branche actuellement supportée.
CVE-2026-14456 exp:2026-11-01
```

Ne jamais créer une liste permanente de CVE simplement pour obtenir une pipeline verte.

Dès qu’un correctif existe :

```text
upgrade
→ rebuild
→ scan
→ suppression ignore
```

---

# 34. Gestion des dépendances

Un lockfile est fortement recommandé.

Node :

```text
package-lock.json
pnpm-lock.yaml
yarn.lock
```

Le build doit être reproductible.

Lorsque le lockfile existe, utiliser le mode d’installation correspondant (`npm ci`, etc.) plutôt qu’une résolution flottante.

Les overrides de dépendances peuvent être utilisés pour corriger une vulnérabilité transitive seulement après validation de compatibilité.

Ils doivent rester visibles dans le manifeste et être retirés lorsque l’upstream intègre la correction.

---

# 35. Resources

Exemple :

```yaml
resources:

  memory: 512m

  cpus: "0.5"
```

`memory` :

```text
256m
512m
768m
1g
2g
```

`cpus` :

```text
"0.25"
"0.5"
"1.0"
"2.0"
```

Utiliser une chaîne YAML pour `cpus`.

Dimensionner raisonnablement.

La base PostgreSQL centrale est dimensionnée séparément par l’infrastructure.

---

# 36. Health et smoke

Le runtime doit fournir un endpoint correspondant à :

```yaml
app:
  health: /api/health
```

Le smoke test vérifie l’application après déploiement.

Pour une application DB, un endpoint de health peut valider :

```text
serveur HTTP disponible
+
requête DB légère
```

Exemple :

```sql
SELECT 1
```

Ne pas faire de traitement lourd dans le healthcheck.

---

# 37. Validation des fichiers

## `.gitlab-ci.yml`

GitLab doit pouvoir compiler la configuration.

## `solodesign.yml`

Les composants parsèrent et valident les clés attendues.

Une configuration DB incohérente doit bloquer.

## `Dockerfile`

Validé par :

```text
Hadolint
+
Docker build réel
```

## tests

Le target `test` doit retourner un exit code non nul si les tests échouent.

## runtime

L’image doit être scannée avant déploiement.

## migration

L’image migration doit être scannée avant exécution.

## déploiement

PREPROD n’est considérée validée qu’après smoke successful.

---

# 38. Ce qu’une application avec DB ne doit jamais faire

Ne pas :

```text
déployer son propre postgres
ouvrir 5432 publiquement
committer DATABASE_URL
committer DIRECT_URL
connaitre POSTGRES_ADMIN_PASSWORD
utiliser solodesign_admin
créer sa DB via prisma migrate dev en CI
faire prisma db push en PROD
appliquer une migration avant backup quand backup activé
faire une migration DOWN automatique pendant un rollback
partager la DB DEV/PREPROD/PROD
partager le rôle DB DEV/PREPROD/PROD
réutiliser le volume PROD en DEV
```

La création de la **database** et du **rôle** appartient à SoloDesign.

La création/modification des **tables, indexes, relations et contraintes** appartient aux migrations de l’application.

---

# 39. Exemple conceptuel Prisma complet

Structure :

```text
repo/
├── .gitlab-ci.yml
├── solodesign.yml
├── Dockerfile
├── .dockerignore
├── package.json
├── package-lock.json
├── src/
└── prisma/
    ├── schema.prisma
    └── migrations/
        ├── 202610010001_init/
        │   └── migration.sql
        └── 202610050001_add_status/
            └── migration.sql
```

Responsabilités :

```text
schema.prisma
→ représentation modèle

migration.sql
→ changement SQL versionné

database-postgres
→ database + rôle + secret

prisma migrate deploy
→ applique migration.sql

deploy-portainer
→ injecte DATABASE_URL / DIRECT_URL

runtime
→ utilise @prisma/client
```

---

# 40. Exemple d’évolution DB

Version 1 :

```prisma
model Customer {
  id    Int    @id @default(autoincrement())
  email String @unique
}
```

Migration initiale committée.

Puis besoin d’un status :

```prisma
model Customer {
  id     Int    @id @default(autoincrement())
  email  String @unique
  status String @default("active")
}
```

Développement :

```text
générer migration
→ vérifier SQL
→ commit
→ push
```

Pipeline DEV :

```text
nouveau hash migration
→ backup DB DEV
→ migrate deploy
→ deploy runtime
```

Pipeline PREPROD :

```text
nouvelle DB ou DB existante preprod
→ backup
→ migrate
→ deploy
→ smoke
→ promotion runtime + migration
```

Pipeline PROD :

```text
backup DB PROD
→ exécuter image db-vX.Y.Z
→ déployer image vX.Y.Z
→ smoke
```

---

# 41. Observabilité PostgreSQL

Les bases sont réellement séparées et inspectables.

Exemples administratifs :

```sql
\l
```

pour les DB.

```sql
\du
```

pour les rôles.

```sql
\c help_dev
```

pour se connecter à une DB.

```sql
\dt
```

pour les tables.

Prisma :

```sql
SELECT
  migration_name,
  started_at,
  finished_at,
  rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at;
```

Ces commandes sont des opérations d’administration plateforme, pas des étapes à intégrer au dépôt applicatif.

Une interface type pgAdmin peut être ajoutée à l’infrastructure, mais elle doit rester privée derrière le réseau/VPN d’administration ; elle ne change pas le contrat applicatif.

---

# 42. Backups et responsabilité applicative

Le développeur de l’application doit fournir des migrations compatibles et déterministes.

La plateforme prend en charge le backup pré-migration.

Cependant :

```text
backup pré-migration
≠ backup externe
≠ PRA complet
```

Les backups hors VPS, la restauration catastrophe, la rétention longue et les tests périodiques de restore sont des responsabilités de plateforme.

---

# 43. Règles absolues

1. Ne jamais committer un secret.
2. Ne jamais intégrer une vraie credential au Dockerfile.
3. Garder les targets `test` et `runtime`.
4. Ajouter un target `migration` si la DB utilise des migrations automatisées.
5. Les tests doivent réellement bloquer.
6. Le runtime doit écouter sur `app.port`.
7. `app.health` doit être réel.
8. DEV, PREPROD et PROD doivent être isolés.
9. Ne jamais utiliser le volume PROD en DEV/PREPROD.
10. Ne jamais fournir manuellement `DATABASE_URL` ou `DIRECT_URL` pour une DB gérée.
11. Ne jamais utiliser le compte `solodesign_admin` depuis une application.
12. Toute modification Prisma de schéma déployable doit avoir une migration versionnée.
13. La CI utilise `migrate deploy`, jamais `migrate dev`.
14. Les images runtime et migration doivent passer leurs scans.
15. Ne pas désactiver les scans.
16. Toute exception Trivy doit être temporaire.
17. `vX.Y.Z` et `db-vX.Y.Z` sont immuables.
18. PROD utilise uniquement une release validée en PREPROD.
19. Un rollback PROD utilise un ancien tag validé.
20. Avec DB, respecter la policy de rollback.
21. Aucun rollback de schéma automatique n’est supposé.
22. GitLab reste la source de vérité du déploiement.
23. Ne pas modifier Portainer manuellement en fonctionnement normal.
24. Ne pas supprimer les volumes persistants par erreur.
25. Garder `allow_replace: false` par défaut pour DNS.
26. PostgreSQL ne doit jamais exposer `5432` publiquement.

---

# 44. Checklist application sans DB

```text
[ ] .gitlab-ci.yml
[ ] solodesign.yml
[ ] Dockerfile
[ ] .dockerignore
[ ] lockfile si applicable
[ ] target test
[ ] target runtime
[ ] tests bloquants
[ ] app.port correct
[ ] app.health HTTP 2xx
[ ] runtime non-root si possible
[ ] aucun secret dans Git
[ ] aucun secret dans l'image
[ ] APP_ENV_* si nécessaire
[ ] volume persistant si nécessaire
[ ] domain development
[ ] domain preproduction
[ ] domain production
[ ] DNS cohérent
[ ] resources cohérentes
[ ] scan source clean
[ ] scan runtime clean
```

---

# 45. Checklist application avec PostgreSQL géré

En plus de la checklist générale :

```text
[ ] database.type = postgres
[ ] database.mode = managed
[ ] connection_limit défini raisonnablement
[ ] migrations.provider exact
[ ] target migration présent si provider != none
[ ] migrations.path correct
[ ] migrations.command réellement exécutable
[ ] fichiers de migration committés
[ ] aucune DATABASE_URL dans Git
[ ] aucune DIRECT_URL dans Git
[ ] aucune credential PostgreSQL admin
[ ] runtime utilise DATABASE_URL injectée
[ ] app rejoint DB uniquement via la plateforme
[ ] backup.before_migrate configuré
[ ] retention_days configuré
[ ] rollback.policy = safe par défaut
[ ] image migration scannée
[ ] migrations testées en DEV
[ ] migration PREPROD réussie avant release
[ ] rollback compatibilité évaluée avant PROD si nécessaire
```

---

# 46. Checklist avant release PREPROD

```text
[ ] main est propre
[ ] tests passent
[ ] version X.Y.Z choisie
[ ] migrations committées
[ ] migrations reproductibles
[ ] aucune migration destructrice non revue
[ ] runtime scan clean
[ ] migration scan clean si DB
[ ] domain PREPROD correct
[ ] DNS cible correcte
[ ] allow_replace volontaire
[ ] resources correctes
[ ] APP_ENV_PREPROD disponible si nécessaire
[ ] migration PREPROD passe
[ ] smoke PREPROD passe
[ ] vX.Y.Z créé uniquement après succès
[ ] db-vX.Y.Z promue si DB
```

---

# 47. Checklist PROD

```text
[ ] lancer depuis tag vX.Y.Z
[ ] action=prod
[ ] tag protégé
[ ] PREPROD de ce SHA validée
[ ] image vX.Y.Z existante
[ ] image db-vX.Y.Z existante si DB
[ ] APP_ENV_PROD disponible si nécessaire
[ ] DNS PROD correct
[ ] DB PROD séparée de PREPROD
[ ] backup pré-migration réussi
[ ] migration PROD réussie
[ ] runtime déployé
[ ] smoke PROD réussi
[ ] aucun port DB public
```

---

# 48. Instruction prête à donner à une IA

Copier le bloc suivant avec le dépôt applicatif.

```text
Tu dois préparer ou vérifier ce dépôt pour la plateforme CI/CD SoloDesign.

Respecte strictement le contrat SoloDesign fourni.

Ne crée aucune convention non documentée.

Objectifs :
- produire/corriger .gitlab-ci.yml
- produire/corriger solodesign.yml
- produire/corriger Dockerfile
- produire/corriger .dockerignore
- produire/corriger les migrations DB si le projet en utilise déjà ou si le besoin est explicitement défini
- ajouter .trivyignore uniquement si une exception CVE temporaire, précise et justifiée est nécessaire

Avant toute modification, analyse réellement le projet :
1. framework et runtime ;
2. gestionnaire de paquets ;
3. lockfile ;
4. commande d'installation ;
5. commande de test ;
6. commande de build ;
7. commande de démarrage production ;
8. port runtime ;
9. health endpoint ;
10. variables runtime nécessaires ;
11. stockage persistant ;
12. présence d'une DB ;
13. ORM / query builder utilisé ;
14. mécanisme de migration existant ;
15. migrations déjà versionnées ;
16. compatibilité avec PostgreSQL géré SoloDesign.

Contraintes générales :
- jamais de secret réel dans Git
- jamais de secret réel dans le Dockerfile
- Dockerfile multi-stage quand pertinent
- target test obligatoire
- target runtime obligatoire
- tests réellement bloquants
- runtime minimal et non-root si possible
- app.port cohérent
- app.health réel
- ne pas inventer de clés solodesign.yml
- DEV/PREPROD/PROD séparés
- ne jamais réutiliser le volume PROD ailleurs
- ne pas contourner Trivy/Hadolint

Si database.type=postgres et mode=managed :
- ne pas ajouter de conteneur PostgreSQL dans le repo applicatif
- ne pas définir DATABASE_URL ou DIRECT_URL dans APP_ENV
- ne jamais demander POSTGRES_ADMIN_PASSWORD au projet applicatif
- utiliser le rôle/DB créés automatiquement par SoloDesign
- ajouter un target migration si migrations.provider != none
- le target migration doit contenir les migrations et leur CLI
- le target runtime ne doit pas contenir inutilement la CLI de migration
- pour Prisma, utiliser des migrations versionnées
- la CI applique prisma migrate deploy
- ne jamais utiliser prisma migrate dev ou prisma db push pour déployer
- une modification schema.prisma doit être accompagnée d'une migration versionnée
- rollback.policy doit rester safe sauf justification de compatibilité explicite

Conventions images :
DEV runtime = dev-SHA
DEV migration = dev-db-SHA
PREPROD runtime = rc-X.Y.Z-SHA
PREPROD migration = rc-db-X.Y.Z-SHA
release runtime = vX.Y.Z
release migration = db-vX.Y.Z

Workflow :
branche DEV
→ validate
→ quality
→ test
→ build
→ scans
→ DB/migration si applicable
→ deploy DEV
→ smoke

main normal
→ policy
→ validate
→ quality
→ test

PREPROD
→ main + action=preprod + version=X.Y.Z
→ build candidate
→ scans
→ DB preprod/migration
→ DNS
→ deploy
→ smoke
→ promotion exacte
→ tag vX.Y.Z

PROD
→ ref vX.Y.Z + action=prod
→ guard
→ DB prod/migration
→ DNS
→ deploy image vX.Y.Z
→ smoke

Rollback PROD :
→ ancien vX.Y.Z déjà validé
→ aucun rebuild
→ respecter le guard DB
→ aucune migration DOWN automatique supposée

Retour attendu :
- explique brièvement les choix détectés dans le projet
- signale les hypothèses qui ne peuvent pas être vérifiées
- retourne les fichiers complets prêts à remplacer
- ne retourne pas seulement des patches
- ne modifie pas un comportement métier sans le signaler
```

---

# 49. Résumé opérationnel

```text
.gitlab-ci.yml
→ inclut seulement la pipeline centrale

solodesign.yml
→ contrat de l'application

Dockerfile
→ test + runtime
→ migration si DB

APP_ENV_*
→ secrets/config applicatifs uniquement

DATABASE_URL / DIRECT_URL
→ créées automatiquement si PostgreSQL managed

DEV
→ dev-SHA
→ dev-db-SHA si migration
→ DB <app>_dev sur postgres-dev

PREPROD
→ rc-X.Y.Z-SHA
→ rc-db-X.Y.Z-SHA
→ DB <app>_preprod sur postgres-prod

PREPROD OK
→ runtime vX.Y.Z
→ migration db-vX.Y.Z
→ Git tag vX.Y.Z

PROD
→ runtime vX.Y.Z
→ migration db-vX.Y.Z
→ DB <app>_prod sur postgres-prod

Rollback
→ ancien vX.Y.Z
→ guard DB safe
→ pas de DOWN automatique
```

---

# 50. Séparation des responsabilités

```text
Application
├── code métier
├── Dockerfile
├── tests
├── health
├── migrations
└── solodesign.yml

SoloDesign CI/CD
├── validation
├── scans
├── build
├── release
├── DNS
├── Portainer
├── migrations
├── smoke
└── guards

PostgreSQL central
├── moteur
├── volumes
├── DB par app/env
├── rôle par app/env
├── password persistant
├── backups pré-migration
└── état migration

Infrastructure
├── VPS
├── runners
├── Traefik
├── Portainer
├── Registry
├── WireGuard
├── firewall
└── backups disaster recovery
```

Le principe à retenir est :

> **L’application décrit ce dont elle a besoin. La plateforme provisionne, sécurise, migre et déploie ces besoins de manière standardisée.**
