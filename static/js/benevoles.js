// Inscription des bénévoles sur les créneaux d'un événement (/benevoles/).
//
// - /benevoles/            : liste des événements qui cherchent du monde ;
// - /benevoles/?e=<slug>   : créneaux de l'événement, inscrits (« Prénom N. »)
//                            et formulaire d'inscription, sans compte ;
// - /benevoles/?e=<slug>&t=<jeton> : lien personnel reçu par e-mail, pour
//                            modifier ses créneaux ou se désinscrire.
//
// Tout passe par l'Edge Function Supabase `volunteer-signup`, qui revalide la
// saisie côté serveur. Le jeton est aussi gardé sur l'appareil (localStorage)
// après une inscription : revenir sur la page permet de modifier ses créneaux
// sans chercher l'e-mail.
(function () {
  'use strict';

  var root = document.getElementById('vol-root');
  if (!root) return;

  var FUNCTION_URL = 'https://ajbpzueanpeukozjhkiv.supabase.co/functions/v1/volunteer-signup';
  // Clé "anon" Supabase : publique par conception (même clé que ag-rsvp.js et
  // event-register.js ; les données ne sont accessibles qu'à travers la
  // fonction serveur).
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYnB6dWVhbnBldWtvempoa2l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTQyMTAsImV4cCI6MjA4ODQ3MDIxMH0.1i1nJ3DlHGVPIWKNjD64ZyHj3cxG4o-ikju-sO0T67A';
  var HEADERS = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
  };
  var GENERIC_ERROR = "Une erreur est survenue. Merci de réessayer ou d'écrire à contact@judo-cattenom.fr.";
  var NETWORK_ERROR = 'Connexion impossible. Vérifiez votre connexion Internet et réessayez.';
  var TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  var params = new URLSearchParams(window.location.search);
  var slug = (params.get('e') || '').trim().toLowerCase();
  var urlToken = (params.get('t') || '').trim();
  var baseUrl = root.getAttribute('data-base-url') || '/benevoles/';

  var loading = document.getElementById('vol-loading');
  var loadError = document.getElementById('vol-load-error');
  var listPanel = document.getElementById('vol-list');
  var eventPanel = document.getElementById('vol-event');
  var title = document.getElementById('vol-title');
  var closedNotice = document.getElementById('vol-closed');
  var tokenInvalid = document.getElementById('vol-token-invalid');
  var successPanel = document.getElementById('vol-success');
  var successTitle = document.getElementById('vol-success-title');
  var successText = document.getElementById('vol-success-text');
  var form = document.getElementById('vol-form');
  var mineBanner = document.getElementById('vol-mine');
  var errorSummary = document.getElementById('vol-error-summary');
  var slotsBox = document.getElementById('vol-slots');
  var firstNameInput = document.getElementById('vol-first-name');
  var lastNameInput = document.getElementById('vol-last-name');
  var emailInput = document.getElementById('vol-email');
  var phoneInput = document.getElementById('vol-phone');
  var commentInput = document.getElementById('vol-comment');
  var websiteInput = document.getElementById('vol-website');
  var submitBtn = document.getElementById('vol-submit');
  var cancelBtn = document.getElementById('vol-cancel');

  // Jeton de l'inscription en cours de modification (null = nouvelle inscription).
  var token = null;
  var busy = false;

  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // 'YYYY-MM-DD' -> « Samedi 5 décembre 2026 » (sans passer par UTC).
  function formatDate(iso, withYear) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return iso || '';
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    var s = DAYS[d.getDay()] + ' ' + (d.getDate() === 1 ? '1er' : d.getDate()) + ' ' + MONTHS[d.getMonth()]
      + (withYear === false ? '' : ' ' + d.getFullYear());
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // « Samedi 5 décembre 2026 » ou « Du samedi 5 au dimanche 6 décembre 2026 ».
  function formatDateRange(first, last) {
    if (!first) return '';
    if (!last || last === first) return formatDate(first);
    var sameMonth = first.slice(0, 7) === last.slice(0, 7);
    var start = formatDate(first, false).toLowerCase();
    if (sameMonth) start = start.replace(/ [^ ]+$/, ''); // « samedi 5 » : le mois est donné par la fin
    return 'Du ' + start + ' au ' + formatDate(last).toLowerCase();
  }

  // '10:00' -> '10h', '10:30' -> '10h30'
  function formatTime(hhmm) {
    var m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '');
    if (!m) return hhmm || '';
    return Number(m[1]) + 'h' + (m[2] === '00' ? '' : m[2]);
  }

  function plural(n, one, many) {
    return n + ' ' + (n > 1 ? many : one);
  }

  // ── Jeton gardé sur l'appareil ─────────────────────────────────────────────
  function storageKey() {
    return 'jcc_vol_' + slug;
  }

  function readStoredToken() {
    try {
      var value = window.localStorage.getItem(storageKey()) || '';
      return TOKEN_RE.test(value) ? value : '';
    } catch (e) {
      return '';
    }
  }

  function storeToken(value) {
    try {
      if (value) window.localStorage.setItem(storageKey(), value);
      else window.localStorage.removeItem(storageKey());
    } catch (e) { /* navigation privée : pas de mémorisation, le lien e-mail reste valable */ }
  }

  // ── Appels à la fonction ───────────────────────────────────────────────────
  function request(query, body) {
    var opts = { method: body === undefined ? 'GET' : 'POST', headers: HEADERS };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(FUNCTION_URL + query, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || GENERIC_ERROR);
          err.status = res.status;
          throw err;
        }
        return data;
      });
    }, function () {
      throw new Error(NETWORK_ERROR);
    });
  }

  function showLoadError(notFound) {
    loading.hidden = true;
    loadError.innerHTML =
      '<p>' + (notFound
        ? 'Cet événement est introuvable.'
        : 'Impossible de charger la page pour le moment. Merci de réessayer plus tard.') +
      ' <a href="' + escapeHtml(baseUrl) + '">Voir les événements en cours</a> ou <a href="/contact/">contactez-nous</a>.</p>';
    loadError.hidden = false;
  }

  // ── Liste des événements ───────────────────────────────────────────────────
  function renderList(events) {
    var list = document.getElementById('vol-events');
    list.innerHTML = events.map(function (evt) {
      var parts = [formatDateRange(evt.first_date, evt.last_date)];
      if (evt.location) parts.push(evt.location);
      parts.push(evt.slots_needed > 0
        ? plural(evt.slots_needed, 'créneau à pourvoir', 'créneaux à pourvoir')
        : 'tous les créneaux ont assez de monde, renfort bienvenu');
      return '<li class="event-list__item">' +
        '<a class="event-list__link" href="' + escapeHtml(baseUrl + '?e=' + encodeURIComponent(evt.slug)) + '">' + escapeHtml(evt.title) + '</a>' +
        '<p class="event-list__desc">' + escapeHtml(parts.join(' · ')) + '</p></li>';
    }).join('');
    document.getElementById('vol-no-events').hidden = events.length > 0;
    loading.hidden = true;
    listPanel.hidden = false;
  }

  // ── Un événement ───────────────────────────────────────────────────────────
  var STATE_TEXT = {
    needed: function (s) { return 'Encore ' + plural(s.needed_min - s.count, 'bénévole recherché', 'bénévoles recherchés'); },
    ok: function () { return 'Assez de monde, renfort bienvenu'; },
    full: function () { return 'Équipe au complet'; },
  };

  function slotHtml(slot, checked) {
    var names = slot.names && slot.names.length
      ? escapeHtml(slot.names.join(', '))
      : 'Personne pour l\'instant';
    var need = slot.needed_min === slot.needed_max ? slot.needed_min : slot.needed_min + ' à ' + slot.needed_max;
    return '<label class="vol-slot vol-slot--' + escapeHtml(slot.state) + (slot.past ? ' vol-slot--past' : '') + '">' +
      '<input type="checkbox" name="slot" value="' + escapeHtml(slot.id) + '"' +
        (checked ? ' checked' : '') + (slot.past ? ' disabled' : '') + '>' +
      '<span class="vol-slot__body">' +
        '<span class="vol-slot__hours">' + escapeHtml(formatTime(slot.start) + ' – ' + formatTime(slot.end)) +
          (slot.label ? ' <span class="vol-slot__label">' + escapeHtml(slot.label) + '</span>' : '') + '</span>' +
        '<span class="vol-slot__names' + (slot.count ? '' : ' vol-slot__names--empty') + '">' + names + '</span>' +
      '</span>' +
      '<span class="vol-slot__status">' +
        '<span class="vol-slot__count" aria-label="' + escapeHtml(plural(slot.count, 'inscrit', 'inscrits') + ' pour ' + need + ' souhaités') + '">' +
          slot.count + ' / ' + escapeHtml(String(need)) + '</span>' +
        '<span class="vol-slot__state">' + escapeHtml(slot.past ? 'Terminé' : STATE_TEXT[slot.state](slot)) + '</span>' +
      '</span>' +
    '</label>';
  }

  function checkedSlotIds() {
    var ids = [];
    var boxes = slotsBox.querySelectorAll('input[name="slot"]');
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].checked) ids.push(boxes[i].value);
    }
    return ids;
  }

  // Affiche les créneaux ; `selected` = identifiants à cocher.
  function renderSlots(slots, selected) {
    var html = '';
    var day = null;
    slots.forEach(function (slot) {
      if (slot.date !== day) {
        if (day !== null) html += '</div>';
        day = slot.date;
        html += '<div class="vol-day"><h3 class="vol-day__title">' + escapeHtml(formatDate(slot.date)) + '</h3>';
      }
      html += slotHtml(slot, selected.indexOf(slot.id) !== -1);
    });
    if (day !== null) html += '</div>';
    slotsBox.innerHTML = html || '<p class="ag-field__hint">Aucun créneau n\'est encore proposé.</p>';
  }

  function renderEvent(evt, selected) {
    title.textContent = evt.title;
    document.title = evt.title + ' — bénévoles | Judo Club Cattenom Rodemack';

    var upcoming = evt.slots.filter(function (s) { return !s.past; });
    var dated = upcoming.length ? upcoming : evt.slots;
    document.getElementById('vol-dates').textContent = dated.length
      ? formatDateRange(dated[0].date, dated[dated.length - 1].date) : 'À préciser';
    document.getElementById('vol-location').textContent = evt.location || '';
    document.getElementById('vol-location-item').hidden = !evt.location;
    var needed = upcoming.filter(function (s) { return s.state === 'needed'; }).length;
    document.getElementById('vol-needed').textContent = upcoming.length === 0 ? '—'
      : needed === 0 ? 'Tous ont assez de monde' : needed + ' sur ' + upcoming.length;

    var description = document.getElementById('vol-description');
    description.textContent = evt.description || '';
    description.hidden = !evt.description;

    renderSlots(evt.slots, selected);
    closedNotice.hidden = evt.open;
    // Événement clos : les créneaux restent consultables, plus de saisie.
    form.querySelector('.vol-identity').hidden = !evt.open;
    form.querySelector('.ag-rgpd').hidden = !evt.open;
    form.querySelector('.vol-actions').hidden = !evt.open;
    form.querySelector('.evt-help').hidden = !evt.open;
    if (!evt.open) {
      var boxes = slotsBox.querySelectorAll('input[name="slot"]');
      for (var i = 0; i < boxes.length; i++) boxes[i].disabled = true;
    }
  }

  // Bascule entre « nouvelle inscription » et « modification de la mienne ».
  function setMine(mine) {
    if (mine) {
      firstNameInput.value = mine.first_name || '';
      lastNameInput.value = mine.last_name || '';
      emailInput.value = mine.email || '';
      phoneInput.value = mine.phone || '';
      commentInput.value = mine.comment || '';
      mineBanner.textContent = 'Vous modifiez l\'inscription de ' + mine.first_name + ' ' + mine.last_name
        + '. Cochez ou décochez des créneaux, puis enregistrez.';
    }
    mineBanner.hidden = !mine;
    emailInput.readOnly = !!mine;
    emailInput.classList.toggle('vol-readonly', !!mine);
    cancelBtn.hidden = !mine;
    submitBtn.textContent = mine ? 'Enregistrer mes créneaux' : 'Je m\'inscris';
  }

  function showErrors(messages) {
    errorSummary.innerHTML = messages.length === 1
      ? '<p>' + escapeHtml(messages[0]) + '</p>'
      : '<ul>' + messages.map(function (m) { return '<li>' + escapeHtml(m) + '</li>'; }).join('') + '</ul>';
    errorSummary.hidden = false;
    errorSummary.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function setBusy(value) {
    busy = value;
    submitBtn.disabled = value;
    cancelBtn.disabled = value;
    if (value) submitBtn.textContent = 'Envoi en cours…';
  }

  function validate(slotIds) {
    var errors = [];
    if (!token && slotIds.length === 0) errors.push('Choisissez au moins un créneau.');
    if (firstNameInput.value.trim().length < 2) errors.push('Votre prénom est obligatoire.');
    if (lastNameInput.value.trim().length < 2) errors.push('Votre nom est obligatoire.');
    if (!token && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) errors.push('L\'adresse e-mail n\'est pas valide.');
    return errors;
  }

  function send(slotIds) {
    if (busy) return;
    errorSummary.hidden = true;
    successPanel.hidden = true;
    tokenInvalid.hidden = true;
    setBusy(true);

    request('', {
      slug: slug,
      token: token,
      first_name: firstNameInput.value,
      last_name: lastNameInput.value,
      email: emailInput.value,
      phone: phoneInput.value,
      comment: commentInput.value,
      slot_ids: slotIds,
      website: websiteInput.value,
    }).then(function (res) {
      setBusy(false);
      var mine = null;
      if (res.status === 'created' || res.status === 'updated') {
        token = res.token || token;
        storeToken(token);
        mine = {
          first_name: firstNameInput.value.trim(), last_name: lastNameInput.value.trim(), email: emailInput.value.trim(),
          phone: phoneInput.value.trim(), comment: commentInput.value.trim(),
        };
      } else {
        // Désinscription, ou créneaux ajoutés à une adresse déjà inscrite (le
        // lien de modification n'est envoyé que par e-mail) : formulaire vierge.
        if (res.status === 'cancelled') storeToken('');
        token = null;
        form.reset();
      }
      if (res.event) renderEvent(res.event, mine ? (res.slot_ids || []) : []);
      setMine(mine);

      successTitle.textContent = res.status === 'cancelled' ? 'Désinscription enregistrée'
        : res.status === 'merged' ? 'Créneaux ajoutés' : 'Merci !';
      successText.textContent = (res.message || 'C\'est enregistré.')
        + (res.status === 'created' ? ' Un e-mail de confirmation vous a été envoyé : il contient le lien pour modifier vos créneaux.' : '');
      successPanel.hidden = false;
      successPanel.focus();
      successPanel.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, function (err) {
      setBusy(false);
      setMine(token ? currentMine() : null);
      if (err.status === 404 && token) {
        // Inscription retirée entre-temps : on repart d'une inscription neuve.
        token = null;
        storeToken('');
        setMine(null);
      }
      showErrors([err.message || GENERIC_ERROR]);
    });
  }

  // Identité affichée pendant une modification (pour rétablir les libellés après une erreur).
  function currentMine() {
    return {
      first_name: firstNameInput.value.trim(), last_name: lastNameInput.value.trim(), email: emailInput.value.trim(),
      phone: phoneInput.value.trim(), comment: commentInput.value.trim(),
    };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var slotIds = checkedSlotIds();
    var errors = validate(slotIds);
    if (errors.length) { showErrors(errors); return; }
    if (token && slotIds.length === 0
      && !window.confirm('Aucun créneau n\'est coché : cela vous désinscrit de cet événement. Continuer ?')) return;
    send(slotIds);
  });

  cancelBtn.addEventListener('click', function () {
    if (!window.confirm('Vous désinscrire de tous vos créneaux pour cet événement ?')) return;
    // Les créneaux déjà passés sont conservés par le serveur.
    send([]);
  });

  // ── Chargement ─────────────────────────────────────────────────────────────
  function loadList() {
    request('').then(function (data) {
      renderList(data.events || []);
    }, function () {
      showLoadError(false);
    });
  }

  function loadEvent() {
    if (!SLUG_RE.test(slug)) { showLoadError(true); return; }
    var fromUrl = TOKEN_RE.test(urlToken);
    var candidate = fromUrl ? urlToken : readStoredToken();
    request('?slug=' + encodeURIComponent(slug) + (candidate ? '&token=' + encodeURIComponent(candidate) : ''))
      .then(function (evt) {
        loading.hidden = true;
        var mine = evt.mine || null;
        if (mine) {
          token = candidate;
          storeToken(token);
        } else if (candidate) {
          storeToken('');
          tokenInvalid.hidden = !(fromUrl && evt.open);
        }
        renderEvent(evt, mine ? mine.slot_ids || [] : []);
        setMine(mine);
        eventPanel.hidden = false;
      }, function (err) {
        showLoadError(err.status === 404);
      });
  }

  if (slug) loadEvent();
  else loadList();
})();
