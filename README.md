# Site web — Judo Club Cattenom Rodemack (`jccr-site`)

Site officiel du **Judo Club Cattenom Rodemack** (`https://judo-cattenom.fr/`), généré avec **Hugo** et le thème sur mesure `jccattenom-theme`.

---

## Pages & fonctionnalités

- **Accueil (`/`)** : présentation du club, disciplines (Judo, Taïso, Iaïdo), horaires des cours aux dojos de Cattenom et Rodemack, encadrement, actualités et accès rapide à la boutique.
- **Tarifs & Adhésion (`/tarifs/`)** : cotisations de la saison, réductions familiales, dispositifs d'aide (Pass'Sport) et inscription en ligne via HelloAsso.
- **Calendrier (`/calendrier/`)** : planning des cours et événements du club synchronisé depuis le calendrier Nextcloud du club (`static/calendar/events.ics`).
- **Événements (`/inscriptions/`)** : inscription en ligne des licenciés du club aux entraînements départementaux, stages et interclubs (`static/js/event-register.js` → Edge Function Supabase `event-register`, avec vérification de la licence FFJDA de la saison et de la catégorie d'âge).
- **Boutique (`/boutique/`)** : équipements et textiles du club en précommande, au prix public (`static/js/boutique.js` → Edge Function Supabase `shop` : catalogue, commande, paiement HelloAsso). Suivi de commande et retour de paiement sur `/boutique/commande/?t=<jeton>` (`static/js/boutique-commande.js`). Catalogue, campagnes et commandes se gèrent dans la gestion (onglet Admin · Boutique).
- **Espace Membre (`/espace-membre/`)** : connexion SSO OIDC PKCE (`static/js/auth.js`, `static/js/pkce-utils.js`) vers Keycloak (`auth.judo-cattenom.fr`) et module d'invitation réservé aux membres du bureau (`static/js/invite.js` → `/api/invite`).
- **Bénévoles (`/benevoles/`)** : inscription sans compte sur les créneaux horaires d'un événement auquel le club participe (`static/js/benevoles.js` → Edge Function Supabase `volunteer-signup`). `/benevoles/` liste les appels en cours ; `/benevoles/?e=<slug>` affiche les créneaux, le nombre d'inscrits et leurs « Prénom N. » ; le lien reçu par e-mail (`&t=<jeton>`) permet de modifier ses créneaux ou de se désinscrire. Page non indexée et absente du menu : le lien se partage. Événements et créneaux se gèrent dans la gestion (onglet Admin · Bénévoles).
- **Assemblée Générale (`/assemblee-generale/`)** : formulaire de présence et de procuration en ligne (`static/js/ag-rsvp.js` → Edge Function Supabase `ag-rsvp`).
- **Contact (`/contact/`)** & **Politique de confidentialité (`/politique-de-confidentialite/`)**.

---

## Charte graphique (source de vérité)

Les couleurs du site servent de référence à l'ensemble des outils du club :
- Fond principal : `#0a0f1c`
- Accent (or JCC) : `#e2b13c`
- Texte principal : `#e8ecf4`

---

## Structure du dépôt

- `hugo.toml` — Configuration Hugo (menus, paramètres du club, SEO).
- `content/` — Contenus Markdown des pages et des événements (`content/inscriptions/*.md`).
- `layouts/` — Templates HTML sur mesure (accueil, boutique, événements, calendrier, espace membre).
- `static/` — Feuilles de style (`static/css/style.css`), scripts JS (`static/js/`), images et calendrier ICS.
- `themes/jccattenom-theme/` — Thème de base Hugo du club.

---

## Développement & déploiement

```bash
# Serveur local Hugo
hugo server -D

# Build de production minifié (génère public/)
hugo --minify
```

Déploiement :
- **Test** (`https://test.judo-cattenom.fr/`) : `~/scripts/deploy.sh jccr-site <branche> test` (validation obligatoire avant merge).
- **Production** (`https://judo-cattenom.fr/`) : après merge sur `main`, déployé via `/opt/jccr-infra/scripts/deploy-jccr-site.sh` (ou automatiquement par le webhook `jcc-webhook`).
