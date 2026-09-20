// Formulaire de réponse à l'assemblée générale (/assemblee-generale/).
// Validation côté client (confort) + appel à l'Edge Function Supabase
// `ag-rsvp` qui revalide tout côté serveur avant d'enregistrer.
(function () {
  'use strict';

  var form = document.getElementById('ag-form');
  if (!form) return;

  var AG_FUNCTION_URL = 'https://ajbpzueanpeukozjhkiv.supabase.co/functions/v1/ag-rsvp';
  // Clé "anon" Supabase : publique par conception (les données ne sont
  // accessibles qu'à travers la fonction serveur, qui seule détient la clé
  // service_role). Même clé déjà publiée dans le dépôt jccr-gestion.
  var AG_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYnB6dWVhbnBldWtvempoa2l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTQyMTAsImV4cCI6MjA4ODQ3MDIxMH0.1i1nJ3DlHGVPIWKNjD64ZyHj3cxG4o-ikju-sO0T67A';

  var nomInput = document.getElementById('ag-nom');
  var emailInput = document.getElementById('ag-email');
  var siteInput = document.getElementById('ag-site');
  var mineurBlock = document.getElementById('ag-conditional-mineur');
  var mineurCheckbox = document.getElementById('ag-mineur');
  var procurationBlock = document.getElementById('ag-procuration-block');
  var procurationInput = document.getElementById('ag-procuration-a');
  var personnesBlock = document.getElementById('ag-personnes-block');
  var personnesList = document.getElementById('ag-personnes-list');
  var addPersonBtn = document.getElementById('ag-add-personne');
  var errorSummary = document.getElementById('ag-error-summary');
  var successPanel = document.getElementById('ag-success');
  var submitBtn = document.getElementById('ag-submit');

  var personCount = 0;

  function currentStatut() {
    var checked = form.querySelector('input[name="statut"]:checked');
    return checked ? checked.value : '';
  }

  function updateRemoveButtons() {
    var rows = personnesList.querySelectorAll('.ag-personne-row');
    rows.forEach(function (row) {
      var btn = row.querySelector('.ag-personne-remove');
      btn.hidden = rows.length <= 1;
    });
  }

  function addPersonRow(focus) {
    personCount++;
    var id = 'ag-personne-' + personCount;
    var row = document.createElement('div');
    row.className = 'ag-personne-row';
    row.innerHTML =
      '<label for="' + id + '">Nom et prénom du licencié représenté</label>' +
      '<div class="ag-personne-row__inner">' +
      '<input class="ag-input" type="text" id="' + id + '" name="personne_nom" autocomplete="off">' +
      '<button type="button" class="ag-personne-remove" aria-label="Retirer cette personne">&times;</button>' +
      '</div>';
    personnesList.appendChild(row);
    row.querySelector('.ag-personne-remove').addEventListener('click', function () {
      row.remove();
      updateRemoveButtons();
    });
    if (focus) row.querySelector('input').focus();
    updateRemoveButtons();
  }

  addPersonBtn.addEventListener('click', function () {
    addPersonRow(true);
  });

  function updateConditionalFields() {
    var statut = currentStatut();
    var needsPersonnes = statut === 'present' || statut === 'procuration';
    mineurBlock.hidden = !needsPersonnes;
    personnesBlock.hidden = !needsPersonnes;
    procurationBlock.hidden = statut !== 'procuration';
    procurationInput.required = statut === 'procuration';
    if (!needsPersonnes) {
      mineurCheckbox.checked = false;
    }
  }

  form.querySelectorAll('input[name="statut"]').forEach(function (radio) {
    radio.addEventListener('change', updateConditionalFields);
  });
  mineurCheckbox.addEventListener('change', updateConditionalFields);

  // Une première ligne prête à l'emploi.
  addPersonRow(false);
  updateConditionalFields();

  function collectPersonnes() {
    return Array.prototype.slice
      .call(personnesList.querySelectorAll('input[name="personne_nom"]'))
      .map(function (input) { return input.value.trim(); })
      .filter(function (v) { return v.length > 0; })
      .map(function (nom) { return { nom: nom }; });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function showErrors(messages) {
    errorSummary.innerHTML =
      '<p>Merci de corriger les points suivants :</p><ul>' +
      messages.map(function (m) { return '<li>' + escapeHtml(m) + '</li>'; }).join('') +
      '</ul>';
    errorSummary.hidden = false;
    errorSummary.setAttribute('tabindex', '-1');
    errorSummary.focus();
  }

  function clearErrors() {
    errorSummary.hidden = true;
    errorSummary.innerHTML = '';
  }

  function validateClientSide(data) {
    var errors = [];
    if (!data.nom_licencie || data.nom_licencie.length < 2) {
      errors.push('Votre nom et prénom sont obligatoires.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push("L'adresse email n'est pas valide.");
    }
    if (!data.statut) {
      errors.push('Merci de choisir une réponse : je viens, je donne procuration, ou je ne viens pas.');
    }
    if ((data.statut === 'present' || data.statut === 'procuration') && data.est_mineur && data.personnes_representees.length === 0) {
      errors.push("Vous répondez pour un licencié mineur : merci d'indiquer le nom et prénom d'au moins un licencié représenté.");
    }
    if (data.statut === 'procuration' && (!data.procuration_a || data.procuration_a.length < 2)) {
      errors.push("Merci d'indiquer le nom et prénom de la personne à qui la procuration est donnée.");
    }
    return errors;
  }

  var STATUT_LABELS = {
    present: "Vous viendrez à l'assemblée générale.",
    procuration: 'Vous donnez procuration.',
    absent: 'Vous ne viendrez pas.',
  };

  function renderRecap(data) {
    var html = '<h2>Merci, votre réponse est enregistrée</h2>';
    html += '<p><strong>Répondant :</strong> ' + escapeHtml(data.nom_licencie) + '</p>';
    html += '<p><strong>Réponse :</strong> ' + STATUT_LABELS[data.statut] + '</p>';
    if (data.statut === 'procuration') {
      html += '<p><strong>Procuration donnée à :</strong> ' + escapeHtml(data.procuration_a) + '</p>';
    }
    if (data.personnes_representees.length > 0) {
      html +=
        '<p><strong>Licencié(s) représenté(s) :</strong></p><ul>' +
        data.personnes_representees.map(function (p) { return '<li>' + escapeHtml(p.nom) + '</li>'; }).join('') +
        '</ul>';
    }
    html += '<p>Un email de confirmation vous a été envoyé à ' + escapeHtml(data.email) + '.</p>';
    return html;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();

    var data = {
      nom_licencie: nomInput.value.trim(),
      email: emailInput.value.trim(),
      statut: currentStatut(),
      est_mineur: !!mineurCheckbox.checked,
      personnes_representees: collectPersonnes(),
      procuration_a: procurationInput.value.trim(),
      site_web: siteInput.value,
    };

    var clientErrors = validateClientSide(data);
    if (clientErrors.length > 0) {
      showErrors(clientErrors);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours…';

    fetch(AG_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: AG_SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + AG_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok, body: body };
        }).catch(function () {
          return { ok: res.ok, body: null };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          var messages =
            (result.body && result.body.errors) ||
            (result.body && result.body.error && [result.body.error]) ||
            ["Une erreur est survenue. Merci de réessayer ou d'écrire à contact@judo-cattenom.fr."];
          showErrors(messages);
          submitBtn.disabled = false;
          submitBtn.textContent = 'Envoyer ma réponse';
          return;
        }
        form.hidden = true;
        successPanel.innerHTML = renderRecap(data);
        successPanel.hidden = false;
        successPanel.setAttribute('tabindex', '-1');
        successPanel.focus();
      })
      .catch(function () {
        showErrors(["Impossible de contacter le serveur. Vérifiez votre connexion et réessayez, ou écrivez à contact@judo-cattenom.fr."]);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer ma réponse';
      });
  });
})();
