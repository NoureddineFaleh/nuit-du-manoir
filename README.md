# Parent Game Show — 100% Twensa

Recueil de jeux de société d'horreur pour 3 à 5 joueurs (écran partagé + un téléphone par joueur), en français ou en dialecte tunisien. La page d'accueil `/` (logo interactif : les yeux suivent le curseur, un clic zappe la télé) liste les jeux ; chaque jeu vit à `/g/<id>`.

| Jeu | Joueurs | Principe |
|---|---|---|
| La Nuit du Manoir (`/g/manoir`) | 4–5 | Déduction sociale : deux alliés secrets, défis, vote, Raison qui s'éteint |
| Le Village maudit (`/g/village`) | 3–5 | Loup-garou version horreur : Bête, Guetteur, Guérisseur, villageois |
| La Crypte (`/g/crypte`) | 3–5 | Coopération : chacun détient des indices différents pour trouver le code avant que les torches s'éteignent |

En tunisien, aucun jeu n'a de voix off : seulement la musique d'ambiance et les bruitages.

## La Nuit du Manoir

Jeu d'horreur et de déduction sociale pour **4 ou 5 joueurs**. Un écran partagé (ordinateur ou TV) anime la partie ; chaque joueur joue sur **son téléphone** en scannant un QR code.

## Lancer

```bash
npm install
npm start
```

Ouvre **http://localhost:3000** sur l'ordinateur branché à l'écran/vidéoprojecteur. Choisis 4 ou 5 joueurs, puis chacun scanne le QR code (téléphones sur le **même Wi-Fi**). L'adresse du réseau local est détectée automatiquement.

Variables d'environnement :

| Variable | Rôle |
|---|---|
| `PORT` | Port du serveur (défaut 3000) |
| `PUBLIC_URL` | URL publique utilisée dans le QR code (ex. `https://mon-jeu.example.com`) |
| `TIME_SCALE` | Accélère les durées (0.1 = 10× plus rapide), utile pour tester |

Les polices viennent de Google Fonts : sans internet, des polices système prennent le relais.

## Langues

Le salon de l'écran propose **Français** ou **تونسي** (dialecte tunisien, lettres arabes, affichage de droite à gauche). Le choix s'applique à toute la partie, écran et téléphones, et ne peut plus changer une fois la partie lancée.

Tous les textes sont dans `src/lang/fr.js` et `src/lang/aeb.js` (rôles, objets, narration, questions du quiz, anecdotes du bluff, messages, interface). Pour corriger une tournure ou ajouter une question, modifie ces fichiers. Pour ajouter une langue, copie un de ces fichiers et déclare-le dans `src/lang/index.js`.

En français, la voix du narrateur utilise la synthèse vocale du navigateur (désactivable). En tunisien, **il n'y a pas de voix off** : seulement la musique d'ambiance et les bruitages, le texte reste affiché (réglage `voice: false` dans `src/lang/aeb.js`).

## Règles en bref

- Chacun a **3 Raison** (bougies). À 0, on devient **Hanté** : on ne joue plus mais on peut maudire les vivants.
- **2 Liés** (alliés secrets, qui ne se connaissent pas) contre les **Solitaires** (chacun pour soi). Les rôles ne sont révélés qu'à la fin.
- Chaque nuit : **Crépuscule** (défi : quiz, mémoire, réflexes ou bluff) → **Podium** → **Minuit** (le Marqueur attaque en secret, objets, murmures, Pacte) → **Veillée** (discussion) → **Rituel** (vote) → **Aube** (bilan des pertes).
- Trois actes (I, II, III) de plus en plus cruels ; à l'acte III le Rituel est mortel. La nuit 9 est funeste pour tous.
- Victoire : **les Liés** si tous les Solitaires sont tombés, sinon **le dernier Solitaire**.

## Équilibrage

Tous les réglages (Raison, durées, probabilités, événements, questions, objets, malédictions) sont dans `src/content.js`.

## Tests

```bash
npm test            # simulations logiques (Manoir, Village, Crypte)
npm run test:kit    # parties complètes Village + Crypte par WebSocket (fr + tunisien)
npm run test:e2e    # parties complètes via WebSocket avec bots, reconnexion incluse
npm run bots CODE 3 # remplit une salle de 3 bots pour tester seul avec ton téléphone
```

## Déploiement

Sur Render : pousse le dépôt sur GitHub, puis New → Blueprint (ou Web Service) et choisis le dépôt ; `render.yaml` configure tout. Le QR code utilise automatiquement l'adresse HTTPS publique (pas besoin de `PUBLIC_URL`). Sur l'offre gratuite, le serveur s'endort après inactivité : ouvre la page une minute avant de jouer.

Sur un serveur public, mets-le derrière HTTPS (le WebSocket passe alors en `wss://` automatiquement) et définis `PUBLIC_URL`.

## Ajouter un jeu

Plus simple : hérite de `src/kit/base.js` (salon, joueurs, langue, phases) et ajoute un fichier d'interface `public/kit/games/<id>.js` (voir `village` et `crypte`) ; le salon, le QR code et la reconnexion sont déjà gérés.

Sinon, en détail :

1. Crée une classe de jeu avec la même interface que `src/game.js` (`setTarget`, `setLang`, `start`, `restart`, `skip`, `tick`, `addPlayer`, `removePlayer`, `setConnected`, `byId`, `handle`, `screenView`, `viewFor`, `players`, `phase`).
2. Déclare-la dans `src/games/index.js` (titre fr/tunisien, nombre de joueurs, durée).
3. Ajoute ses pages `public/<id>/screen.html` et `play.html` (ou utilise le socle `public/kit/`). Elle apparaît alors sur la page d'accueil.

## Règles des jeux

Chaque jeu a sa page de règles (FR / tunisien, vue « En bref » et « Tout en détail ») : `/rules/manoir`, `/rules/village`, `/rules/crypte`. Le contenu est dans `src/games/rules.js`.
