// Page de suivi d'une commande (/boutique/commande/?t=<jeton>), aussi page
// de retour de HelloAsso. POST shop/order { token } : le serveur revérifie
// le paiement auprès de HelloAsso si la commande est encore en attente, puis
// renvoie une vue sans donnée personnelle (ni e-mail, ni nom de famille).
// Paiement confirmé → le panier de la boutique est vidé.
(function () {
  'use strict';

  var SHOP = window.JCC_SHOP;
  var panel = document.getElementById('order-panel');
  if (!SHOP || !panel) return;

  var el = function (id) { return document.getElementById(id); };
  var token = new URLSearchParams(window.location.search).get('t') || '';
  var PAID = ['paid', 'ordered', 'received', 'delivered'];
  var attempts = 0;

  function fail(message) {
    el('order-loading').hidden = true;
    el('order-error').textContent = message;
    el('order-error').hidden = false;
  }

  function render(o) {
    el('order-loading').hidden = true;
    el('order-error').hidden = true;
    var status = el('order-status');
    var paid = PAID.indexOf(o.status) >= 0;
    var pending = o.status === 'pending_payment';
    status.className = 'ag-feedback ' + (paid ? 'ag-feedback--success' : pending ? 'shop-order__pending' : 'ag-feedback--error');
    status.textContent = paid
      ? 'Merci' + (o.first_name ? ' ' + o.first_name : '') + ' ! Votre paiement est confirmé. Un récapitulatif vous a été envoyé par e-mail.'
      : pending
        ? 'Paiement pas encore confirmé par HelloAsso. Si vous venez de payer, la confirmation arrive en général en quelques instants. Si vous avez abandonné le paiement, votre panier vous attend dans la boutique.'
        : 'Cette commande n\'a pas abouti (' + String(o.status_label || '').toLowerCase() + '). Votre panier vous attend dans la boutique si vous voulez réessayer.';
    el('order-number').textContent = 'n° ' + o.number;
    el('order-status-label').textContent = o.status_label || o.status;
    var d = new Date(o.created_at);
    el('order-date').textContent = isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    el('order-total').textContent = SHOP.euros(o.total_cents);
    var list = el('order-items');
    list.textContent = '';
    (o.items || []).forEach(function (i) {
      var li = document.createElement('li');
      li.textContent = i.quantity + ' × ' + i.product_name + (i.size ? ' (' + i.size + ')' : '') + ' — ' + SHOP.euros(i.unit_price_cents * i.quantity);
      list.appendChild(li);
    });
    var pickup = el('order-pickup');
    if (paid && o.campaign && o.campaign.pickup_info) {
      pickup.textContent = o.campaign.pickup_info;
      pickup.hidden = false;
    }
    el('order-refresh').hidden = !pending;
    panel.hidden = false;
    if (paid) SHOP.writeCart([]);
    // Retour de HelloAsso : la confirmation peut avoir quelques secondes de retard.
    if (pending && attempts < 3) {
      attempts++;
      setTimeout(load, 4000 * attempts);
    }
  }

  function load() {
    SHOP.call('order', { token: token }).then(render).catch(function (err) {
      fail(err.message || SHOP.GENERIC_ERROR);
    });
  }

  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    fail('Lien de commande invalide. Vérifiez le lien reçu par e-mail.');
    return;
  }
  el('order-refresh').addEventListener('click', function () { attempts = 0; load(); });
  load();
})();
