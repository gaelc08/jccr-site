// Configuration commune aux pages de la boutique (/boutique/ et
// /boutique/commande/) : Edge Function Supabase `shop`, clé « anon »
// publique par conception (même clé que event-register.js et ag-rsvp.js ;
// les données ne sont accessibles qu'à travers la fonction serveur), et
// petits utilitaires partagés.
window.JCC_SHOP = (function () {
  'use strict';

  var FUNCTION_URL = 'https://ajbpzueanpeukozjhkiv.supabase.co/functions/v1/shop';
  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYnB6dWVhbnBldWtvempoa2l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTQyMTAsImV4cCI6MjA4ODQ3MDIxMH0.1i1nJ3DlHGVPIWKNjD64ZyHj3cxG4o-ikju-sO0T67A';
  var CART_KEY = 'jcc_shop_cart_site';
  var GENERIC_ERROR = "Une erreur est survenue. Merci de réessayer ou d'écrire à contact@judo-cattenom.fr.";

  function call(route, body) {
    var opts = {
      method: body === undefined ? 'GET' : 'POST',
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY },
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(FUNCTION_URL + '/' + route, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || GENERIC_ERROR);
        return data;
      });
    }, function () {
      throw new Error('Connexion impossible. Vérifiez votre connexion Internet et réessayez.');
    });
  }

  function euros(cents) {
    return (Math.round(cents) / 100).toFixed(2).replace('.', ',') + ' €';
  }

  function readCart() {
    try {
      var data = JSON.parse(window.localStorage.getItem(CART_KEY) || '[]');
      if (!Array.isArray(data)) return [];
      return data.filter(function (l) {
        return l && typeof l.product_id === 'string' && /^[0-9a-f-]{36}$/i.test(l.product_id)
          && Number.isInteger(l.quantity) && l.quantity >= 1 && l.quantity <= 20
          && (l.size === null || (typeof l.size === 'string' && l.size.length <= 20));
      }).slice(0, 20);
    } catch (e) {
      return [];
    }
  }

  function writeCart(cart) {
    try {
      if (cart.length) window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
      else window.localStorage.removeItem(CART_KEY);
    } catch (e) { /* navigation privée : panier gardé en mémoire seulement */ }
  }

  return { call: call, euros: euros, readCart: readCart, writeCart: writeCart, GENERIC_ERROR: GENERIC_ERROR };
})();
