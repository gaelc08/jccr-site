// Formulaire d'inscription à un événement (/inscriptions/<slug>/).
// Charge les informations de l'événement (date, lieu, créneaux, date limite)
// depuis l'Edge Function Supabase `event-register`, puis envoie l'inscription
// à la même fonction, qui revalide tout côté serveur avant d'enregistrer.
(function () {
  'use strict';

  var form = document.getElementById('evt-form');
  if (!form) return;

  var EVENT_FUNCTION_URL = 'https://ajbpzueanpeukozjhkiv.supabase.co/functions/v1/event-register';
  // Clé "anon" Supabase : publique par conception (même clé que ag-rsvp.js ;
  // les données ne sont accessibles qu'à travers la fonction serveur).
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYnB6dWVhbnBldWtvempoa2l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTQyMTAsImV4cCI6MjA4ODQ3MDIxMH0.1i1nJ3DlHGVPIWKNjD64ZyHj3cxG4o-ikju-sO0T67A';
  var HEADERS = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
  };
  var GENERIC_ERROR = "Une erreur est survenue. Merci de réessayer ou d'écrire à contact@judo-cattenom.fr.";

  var slug = form.getAttribute('data-event-slug') || '';

  var loading = document.getElementById('evt-loading');
  var loadError = document.getElementById('evt-load-error');
  var infobar = document.getElementById('evt-infobar');
  var closedNotice = document.getElementById('evt-closed');
  var errorSummary = document.getElementById('evt-error-summary');
  var successPanel = document.getElementById('evt-success');
  var successText = document.getElementById('evt-success-text');
  var againBtn = document.getElementById('evt-again');
  var submitBtn = document.getElementById('evt-submit');
  var SUBMIT_LABEL = submitBtn.textContent;

  var firstNameInput = document.getElementById('evt-first-name');
  var lastNameInput = document.getElementById('evt-last-name');
  var dobInput = document.getElementById('evt-dob');
  var dobField = document.getElementById('evt-dob-field');
  var respondentNameInput = document.getElementById('evt-respondent-name');
  var emailInput = document.getElementById('evt-email');
  var phoneInput = document.getElementById('evt-phone');
  var commentInput = document.getElementById('evt-comment');
  var websiteInput = document.getElementById('evt-website');

  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  // 'YYYY-MM-DD' -> « Samedi 14 novembre 2026 » (sans passer par UTC).
  function formatEventDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return iso || '';
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    var s = DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // 'HH:MM' -> '14h00'
  function formatTime(hhmm) {
    return String(hhmm || '').replace(':', 'h');
  }

  // Horaires d'une session, en texte brut (à échapper selon l'usage) :
  // - infobar : « 15h00 – 16h30 » / « à partir de 15h00 » / « Horaire à confirmer »
  // - sentence : « de 15h00 à 16h30 » / « à partir de 15h00 » / « horaire à confirmer »
  function formatSessionHours(start, end) {
    if (start && end) {
      return {
        infobar: formatTime(start) + ' – ' + formatTime(end),
        sentence: 'de ' + formatTime(start) + ' à ' + formatTime(end)
      };
    }
    if (start) {
      return {
        infobar: 'à partir de ' + formatTime(start),
        sentence: 'à partir de ' + formatTime(start)
      };
    }
    return { infobar: 'Horaire à confirmer', sentence: 'horaire à confirmer' };
  }

  // Date limite ISO -> « 10 novembre 2026 à 23h59 », en heure de Paris.
  function formatDeadline(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso || '';
    try {
      var date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
      var time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
      return date + ' à ' + time.replace(':', 'h');
    } catch (e) {
      return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ' à ' + pad(d.getHours()) + 'h' + pad(d.getMinutes());
    }
  }

  // [2021, 2022] -> « (nés en 2021-2022) » ; [2021, 2023] -> « (nés en 2021, 2023) » ; [] -> ''
  function formatBirthYears(years) {
    if (!years || years.length === 0) return '';
    var sorted = years.slice().sort(function (a, b) { return a - b; });
    var consecutive = true;
    for (var i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        consecutive = false;
        break;
      }
    }
    var text;
    if (sorted.length === 1) {
      text = String(sorted[0]);
    } else if (consecutive) {
      text = sorted[0] + '-' + sorted[sorted.length - 1];
    } else {
      text = sorted.join(', ');
    }
    return '(nés en ' + text + ')';
  }

  // Ligne de détail d'une session : catégories, suivies des années de naissance si précisées.
  function formatSessionDetail(s) {
    var detail = (s.categories || []).join(', ');
    var years = formatBirthYears(s.birth_years);
    if (years) detail = detail ? detail + ' ' + years : years;
    return detail;
  }

  function renderInfobar(evt) {
    document.getElementById('evt-date').textContent = formatEventDate(evt.event_date);
    document.getElementById('evt-location').textContent = evt.location || '';
    document.getElementById('evt-address').textContent = evt.address || '';
    document.getElementById('evt-deadline').textContent = formatDeadline(evt.registration_deadline);

    var sessions = evt.sessions || [];
    if (sessions.length > 0) {
      document.getElementById('evt-sessions').innerHTML = sessions.map(function (s) {
        return (
          '<div class="evt-session">' +
          '<span class="ag-infobar__value">' + escapeHtml(s.label) + ' : ' +
          escapeHtml(formatSessionHours(s.start_time, s.end_time).infobar) + '</span>' +
          '<span class="evt-infobar__detail">' + escapeHtml(formatSessionDetail(s)) + '</span>' +
          '</div>'
        );
      }).join('');
      document.getElementById('evt-sessions-item').hidden = false;
    }
    infobar.hidden = false;
  }

  function showLoadError(notFound) {
    loading.hidden = true;
    loadError.innerHTML =
      '<p>' + (notFound
        ? 'Cet événement est introuvable.'
        : "Impossible de charger les informations de l'événement pour le moment. Merci de réessayer plus tard.") +
      ' Pour toute question, <a href="/contact/">contactez-nous</a>.</p>';
    loadError.hidden = false;
  }

  function loadEvent() {
    if (!slug) {
      showLoadError(true);
      return;
    }
    fetch(EVENT_FUNCTION_URL + '?slug=' + encodeURIComponent(slug), { method: 'GET', headers: HEADERS })
      .then(function (res) {
        if (!res.ok) {
          showLoadError(res.status === 404);
          return null;
        }
        return res.json();
      })
      .then(function (evt) {
        if (!evt) return;
        loading.hidden = true;
        renderInfobar(evt);
        if (evt.open) {
          form.hidden = false;
        } else {
          closedNotice.hidden = false;
        }
      })
      .catch(function () {
        showLoadError(false);
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

  function showServerError(message) {
    errorSummary.innerHTML = '<p>' + escapeHtml(message) + '</p>';
    errorSummary.hidden = false;
    errorSummary.setAttribute('tabindex', '-1');
    errorSummary.focus();
  }

  function clearErrors() {
    errorSummary.hidden = true;
    errorSummary.innerHTML = '';
  }

  // input type=date renvoie 'YYYY-MM-DD' ; sur un navigateur sans sélecteur
  // de date, on accepte aussi la saisie 'JJ/MM/AAAA'.
  function normalizeDate(value) {
    var v = value.trim();
    var fr = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(v);
    if (fr) v = fr[3] + '-' + pad(+fr[2]) + '-' + pad(+fr[1]);
    return v;
  }

  function isValidPastDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return false;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] &&
      +m[1] >= 1900 && d.getTime() < Date.now();
  }

  function validateClientSide(data) {
    var errors = [];
    if (!data.first_name) errors.push('Le prénom du judoka est obligatoire.');
    if (!data.last_name) errors.push('Le nom du judoka est obligatoire.');
    // La date n'est vérifiée que si le champ est affiché (homonymes).
    if (!dobField.hidden && !isValidPastDate(data.date_of_birth)) {
      errors.push("La date de naissance du judoka n'est pas valide.");
    }
    if (!data.respondent_name || data.respondent_name.length < 2) {
      errors.push('Votre nom et prénom sont obligatoires.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.respondent_email)) {
      errors.push("L'adresse email n'est pas valide.");
    }
    if (data.respondent_phone && !/^[0-9+().\s-]{6,}$/.test(data.respondent_phone)) {
      errors.push("Le numéro de téléphone n'est pas valide.");
    }
    return errors;
  }

  // La date de naissance est reprise de la licence FFJDA : le champ reste
  // masqué et n'est demandé que si le serveur signale des homonymes
  // (réponse `need_dob: true`). Il devient alors obligatoire.
  function showDobField() {
    dobField.hidden = false;
    dobInput.required = true;
  }

  function hideDobField() {
    dobField.hidden = true;
    dobInput.required = false;
    dobInput.value = '';
  }

  function resetSubmit() {
    submitBtn.disabled = false;
    submitBtn.textContent = SUBMIT_LABEL;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();

    var data = {
      slug: slug,
      first_name: firstNameInput.value.trim(),
      last_name: lastNameInput.value.trim(),
      date_of_birth: dobField.hidden ? null : normalizeDate(dobInput.value),
      respondent_name: respondentNameInput.value.trim(),
      respondent_email: emailInput.value.trim(),
      respondent_phone: phoneInput.value.trim(),
      comment: commentInput.value.trim(),
      website: websiteInput.value,
    };

    var clientErrors = validateClientSide(data);
    if (clientErrors.length > 0) {
      showErrors(clientErrors);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours…';

    fetch(EVENT_FUNCTION_URL, {
      method: 'POST',
      headers: HEADERS,
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
        if (!result.ok || !result.body || !result.body.success) {
          var needDob = !!(result.body && result.body.need_dob);
          if (needDob) showDobField();
          showServerError((result.body && result.body.error) || GENERIC_ERROR);
          resetSubmit();
          if (needDob) dobInput.focus();
          return;
        }
        var r = result.body;
        var schedule = ', ' + formatSessionHours(r.start_time, r.end_time).sentence;
        successText.textContent =
          (r.first_name || data.first_name) + ' est inscrit(e) — ' + r.session_label +
          schedule + '. Un e-mail de confirmation vous a été envoyé.';
        form.hidden = true;
        resetSubmit();
        successPanel.hidden = false;
        successPanel.setAttribute('tabindex', '-1');
        successPanel.focus();
      })
      .catch(function () {
        showServerError('Impossible de contacter le serveur. Vérifiez votre connexion et réessayez, ou écrivez à contact@judo-cattenom.fr.');
        resetSubmit();
      });
  });

  // Prénom ou nom modifié après l'apparition du champ date : il s'agit d'un
  // autre judoka, on masque à nouveau le champ et on vide la date.
  function onNameInput() {
    if (!dobField.hidden) hideDobField();
  }
  firstNameInput.addEventListener('input', onNameInput);
  lastNameInput.addEventListener('input', onNameInput);

  // Nouvelle inscription : on vide le bloc Judoka (et le commentaire, propre
  // à chaque judoka) et on masque à nouveau la date de naissance, mais on
  // garde les coordonnées du répondant.
  againBtn.addEventListener('click', function () {
    firstNameInput.value = '';
    lastNameInput.value = '';
    hideDobField();
    commentInput.value = '';
    clearErrors();
    successPanel.hidden = true;
    form.hidden = false;
    firstNameInput.focus();
  });

  // Pré-remplissage depuis l'onglet Famille de l'app de gestion :
  // /inscriptions/<slug>/#prenom=Léo&nom=DUPONT&email=parent@exemple.fr
  // Le fragment (#) n'est jamais envoyé au serveur ; on l'efface de l'adresse
  // après lecture pour qu'il ne reste ni dans l'historique ni dans un partage.
  function prefillFromHash() {
    var hash = (window.location.hash || '').replace(/^#/, '');
    if (!hash || hash.indexOf('=') === -1) return;
    var params = {};
    hash.split('&').forEach(function (pair) {
      var i = pair.indexOf('=');
      if (i <= 0) return;
      try {
        params[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' ')).slice(0, 120);
      } catch (e) { /* paramètre mal formé : ignoré */ }
    });
    if (params.prenom) firstNameInput.value = params.prenom;
    if (params.nom) lastNameInput.value = params.nom;
    if (params.email) emailInput.value = params.email;
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  prefillFromHash();
  loadEvent();
})();
