---
title: "Assemblée Générale"
description: "Assemblée générale du Judo Club Cattenom Rodemack : vendredi 9 octobre 2026 à 19h, Fort du Galgenberg à Cattenom. Merci de répondre avant le 2 octobre 2026."
---

<div class="ag-infobar" role="group" aria-label="Informations sur l'assemblée générale">
  <div class="ag-infobar__item">
    <span class="ag-infobar__label">Date</span>
    <span class="ag-infobar__value">Vendredi 9 octobre 2026</span>
  </div>
  <div class="ag-infobar__item">
    <span class="ag-infobar__label">Heure</span>
    <span class="ag-infobar__value">19h00</span>
  </div>
  <div class="ag-infobar__item">
    <span class="ag-infobar__label">Lieu</span>
    <span class="ag-infobar__value">Fort du Galgenberg, Cattenom</span>
  </div>
  <div class="ag-infobar__item ag-infobar__item--deadline">
    <span class="ag-infobar__label">Réponse attendue avant le</span>
    <span class="ag-infobar__value">2 octobre 2026</span>
  </div>
</div>

Merci de nous indiquer si vous serez présent·e à l'assemblée générale, si vous donnez procuration à quelqu'un d'autre, ou si vous ne pourrez pas venir. Une réponse par licencié·e.

<form id="ag-form" novalidate>

  <div id="ag-error-summary" class="ag-feedback ag-feedback--error" role="alert" hidden></div>

  <label class="ag-field" for="ag-nom">
    Nom et prénom du licencié qui répond <span class="ag-required" aria-hidden="true">*</span>
  </label>
  <input class="ag-input" type="text" id="ag-nom" name="nom_licencie" autocomplete="name" required>

  <label class="ag-field" for="ag-email">
    Adresse email <span class="ag-required" aria-hidden="true">*</span>
    <span class="ag-field__hint">Pour vous envoyer la confirmation</span>
  </label>
  <input class="ag-input" type="email" id="ag-email" name="email" autocomplete="email" required>

  <fieldset class="ag-fieldset">
    <legend>Votre réponse <span class="ag-required" aria-hidden="true">*</span></legend>
    <label class="ag-radio">
      <input type="radio" name="statut" value="present" required>
      <span>Je viens</span>
    </label>
    <label class="ag-radio">
      <input type="radio" name="statut" value="procuration" required>
      <span>Je donne procuration</span>
    </label>
    <label class="ag-radio">
      <input type="radio" name="statut" value="absent" required>
      <span>Je ne viens pas</span>
    </label>
  </fieldset>

  <div id="ag-conditional-mineur" class="ag-block" hidden>
    <label class="ag-checkbox">
      <input type="checkbox" id="ag-mineur">
      <span>Le licencié est mineur</span>
    </label>
  </div>

  <div id="ag-procuration-block" class="ag-block" hidden>
    <label class="ag-field" for="ag-procuration-a">
      Nom et prénom de la personne à qui la procuration est donnée <span class="ag-required" aria-hidden="true">*</span>
    </label>
    <input class="ag-input" type="text" id="ag-procuration-a" name="procuration_a" autocomplete="off">
  </div>

  <fieldset id="ag-personnes-block" class="ag-block ag-fieldset" hidden>
    <legend>Personne(s) représentée(s)</legend>
    <p class="ag-field__hint">Par exemple un enfant mineur. Obligatoire si le licencié est mineur.</p>
    <div id="ag-personnes-list"></div>
    <button type="button" id="ag-add-personne" class="btn btn--ghost ag-add-btn">+ Ajouter une personne</button>
  </fieldset>

  <div class="ag-hp">
    <label for="ag-site">Site web (laisser ce champ vide)</label>
    <input type="text" id="ag-site" name="site_web" tabindex="-1" autocomplete="off">
  </div>

  <p class="ag-rgpd">
    Ces informations sont utilisées uniquement pour l'organisation de l'assemblée générale (émargement et procurations) et seront supprimées après l'AG. Elles ne sont pas transmises à des tiers.
  </p>

  <button type="submit" id="ag-submit" class="btn btn--primary btn--lg">Envoyer ma réponse</button>
</form>

<div id="ag-success" class="ag-feedback ag-feedback--success" hidden></div>

<script src="/js/ag-rsvp.js" defer></script>
