// Boutique publique (/boutique/) : catalogue au prix public, panier, commande.
// - Catalogue et campagne : GET shop/catalog (Edge Function Supabase).
// - Commande : POST shop/checkout { items, buyer, origin: 'site' } ; le
//   serveur relit les prix en base, crée la commande et renvoie l'URL de
//   paiement HelloAsso.
// - Le panier est gardé dans le navigateur jusqu'à ce que la page de suivi
//   (/boutique/commande/) confirme le paiement : un abandon ou un retour
//   arrière ne le perd pas.
// Tout le texte venant du serveur est inséré avec textContent.
(function () {
  'use strict';

  var SHOP = window.JCC_SHOP;
  var root = document.getElementById('shop-products');
  if (!SHOP || !root) return;

  var MAX_LINE = 20;
  var MAX_ORDER = 50;

  var el = function (id) { return document.getElementById(id); };
  var loading = el('shop-loading');
  var errorBox = el('shop-error');
  var closedBox = el('shop-closed');
  var noticeBox = el('shop-notice');
  var cartSection = el('shop-cart');
  var cartTitle = el('shop-cart-title');
  var cartEmpty = el('shop-cart-empty');
  var cartLines = el('shop-cart-lines');
  var cartTotal = el('shop-cart-total');
  var form = el('shop-form');
  var formError = el('shop-form-error');
  var payBtn = el('shop-pay');
  var fab = el('shop-cart-fab');
  var fabCount = el('shop-cart-count');

  var products = [];
  var cart = SHOP.readCart();

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function show(n, visible) { if (n) n.hidden = !visible; }

  function productById(id) {
    for (var i = 0; i < products.length; i++) if (products[i].id === id) return products[i];
    return null;
  }

  function count() {
    return cart.reduce(function (s, l) { return s + l.quantity; }, 0);
  }

  // ─── Catalogue ──────────────────────────────────────────────────────────

  function renderProducts() {
    root.textContent = '';
    products.forEach(function (p) {
      var card = node('article', 'product shop-product');
      var gallery = node('div', 'product__gallery shop-product__gallery');
      if (p.image_url) {
        var img = node('img', 'product__img');
        img.src = p.image_url;
        img.alt = p.name;
        img.loading = 'lazy';
        gallery.appendChild(img);
      } else {
        gallery.appendChild(node('span', 'shop-product__placeholder', 'JCCR'));
        gallery.setAttribute('aria-hidden', 'true');
      }
      card.appendChild(gallery);

      var body = node('div', 'product__body');
      body.appendChild(node('h2', 'product__name', p.name));
      if (p.description) body.appendChild(node('p', 'product__desc', p.description));
      body.appendChild(node('p', 'shop-product__price', SHOP.euros(p.price_cents)));

      var controls = node('div', 'shop-product__controls');
      var sizeSelect = null;
      if (p.sizes && p.sizes.length) {
        var sizeField = node('div', 'product__size');
        var sizeId = 'size-' + p.id;
        var sizeLabel = node('label', '', 'Taille');
        sizeLabel.htmlFor = sizeId;
        sizeSelect = node('select', 'product__size-select');
        sizeSelect.id = sizeId;
        sizeSelect.appendChild(node('option', '', 'Choisir…')).value = '';
        p.sizes.forEach(function (s) { sizeSelect.appendChild(node('option', '', s)).value = s; });
        sizeField.appendChild(sizeLabel);
        sizeField.appendChild(sizeSelect);
        controls.appendChild(sizeField);
      }
      var qtyField = node('div', 'product__size');
      var qtyId = 'qty-' + p.id;
      var qtyLabel = node('label', '', 'Quantité');
      qtyLabel.htmlFor = qtyId;
      var qty = node('input', 'product__size-select shop-product__qty');
      qty.id = qtyId;
      qty.type = 'number';
      qty.min = '1';
      qty.max = String(MAX_LINE);
      qty.value = '1';
      qty.inputMode = 'numeric';
      qtyField.appendChild(qtyLabel);
      qtyField.appendChild(qty);
      controls.appendChild(qtyField);

      var add = node('button', 'btn btn--primary shop-product__add', 'Ajouter au panier');
      add.type = 'button';
      var err = node('p', 'shop-product__error');
      err.setAttribute('role', 'alert');
      err.hidden = true;
      add.addEventListener('click', function () {
        var result = addToCart(p, sizeSelect ? sizeSelect.value : null, parseInt(qty.value, 10));
        if (result) {
          err.textContent = result;
          err.hidden = false;
          (sizeSelect && !sizeSelect.value ? sizeSelect : qty).focus();
          return;
        }
        err.hidden = true;
        add.textContent = 'Ajouté ✓';
        setTimeout(function () { add.textContent = 'Ajouter au panier'; }, 1500);
      });
      body.appendChild(controls);
      body.appendChild(add);
      body.appendChild(err);
      card.appendChild(body);
      root.appendChild(card);
    });
  }

  // ─── Panier ─────────────────────────────────────────────────────────────

  /** Renvoie un message d'erreur, ou null si l'article est ajouté. */
  function addToCart(p, size, quantity) {
    if (!Number.isInteger(quantity) || quantity < 1) return 'Quantité invalide.';
    var hasSizes = p.sizes && p.sizes.length > 0;
    if (hasSizes && (!size || p.sizes.indexOf(size) < 0)) return 'Choisissez une taille.';
    var s = hasSizes ? size : null;
    if (count() + quantity > MAX_ORDER) return 'Pas plus de ' + MAX_ORDER + ' articles par commande.';
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].product_id === p.id && cart[i].size === s) {
        if (cart[i].quantity + quantity > MAX_LINE) return 'Pas plus de ' + MAX_LINE + ' exemplaires d\'un même article.';
        cart[i].quantity += quantity;
        save();
        return null;
      }
    }
    if (quantity > MAX_LINE) return 'Pas plus de ' + MAX_LINE + ' exemplaires d\'un même article.';
    cart.push({ product_id: p.id, size: s, quantity: quantity });
    save();
    return null;
  }

  function save() {
    SHOP.writeCart(cart);
    renderCart();
  }

  /** Retire du panier ce qui n'est plus au catalogue (produit ou taille). */
  function reconcile() {
    var dropped = [];
    cart = cart.filter(function (l) {
      var p = productById(l.product_id);
      var ok = p && ((p.sizes || []).length === 0 ? l.size === null : (!!l.size && p.sizes.indexOf(l.size) >= 0));
      if (!ok) dropped.push(p ? p.name + (l.size ? ' (' + l.size + ')' : '') : 'un article retiré du catalogue');
      return ok;
    });
    if (dropped.length) {
      noticeBox.textContent = 'Retiré de votre panier car plus disponible : ' + dropped.join(', ') + '.';
      show(noticeBox, true);
      SHOP.writeCart(cart);
    }
  }

  function renderCart() {
    var n = count();
    fabCount.textContent = String(n);
    show(fab, n > 0);
    show(cartEmpty, n === 0);
    show(form, n > 0);
    show(cartTotal, n > 0);
    cartTitle.textContent = n ? 'Votre panier (' + n + ' article' + (n > 1 ? 's' : '') + ')' : 'Votre panier';
    cartLines.textContent = '';
    var total = 0;
    cart.forEach(function (l, i) {
      var p = productById(l.product_id);
      if (!p) return;
      var lineTotal = p.price_cents * l.quantity;
      total += lineTotal;
      var li = node('li', 'shop-cart__line');
      li.appendChild(node('span', 'shop-cart__name', p.name + (l.size ? ' — ' + l.size : '')));
      var q = node('span', 'shop-cart__qty');
      var minus = node('button', 'shop-cart__btn', '−');
      minus.type = 'button';
      minus.setAttribute('aria-label', 'Retirer un exemplaire de ' + p.name + (l.size ? ' taille ' + l.size : ''));
      minus.addEventListener('click', function () {
        if (cart[i].quantity > 1) cart[i].quantity -= 1; else cart.splice(i, 1);
        save();
      });
      var plus = node('button', 'shop-cart__btn', '+');
      plus.type = 'button';
      plus.setAttribute('aria-label', 'Ajouter un exemplaire de ' + p.name + (l.size ? ' taille ' + l.size : ''));
      plus.disabled = l.quantity >= MAX_LINE || n >= MAX_ORDER;
      plus.addEventListener('click', function () { cart[i].quantity += 1; save(); });
      q.appendChild(minus);
      q.appendChild(node('span', 'shop-cart__count', String(l.quantity)));
      q.appendChild(plus);
      li.appendChild(q);
      li.appendChild(node('span', 'shop-cart__price', SHOP.euros(lineTotal)));
      cartLines.appendChild(li);
    });
    cartTotal.textContent = 'Total : ' + SHOP.euros(total);
    payBtn.textContent = 'Payer ' + SHOP.euros(total) + ' avec HelloAsso';
  }

  // ─── Commande ───────────────────────────────────────────────────────────

  function fieldValue(name) {
    var f = form.elements.namedItem(name);
    return f ? String(f.value || '').trim() : '';
  }

  function validate() {
    var nameRe = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' -]*[A-Za-zÀ-ÖØ-öø-ÿ]$/;
    var checks = [
      ['first_name', nameRe.test(fieldValue('first_name')), 'Prénom : lettres uniquement, 2 caractères minimum.'],
      ['last_name', nameRe.test(fieldValue('last_name')), 'Nom : lettres uniquement, 2 caractères minimum.'],
      ['email', /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fieldValue('email')), 'Adresse e-mail invalide.'],
      ['phone', !fieldValue('phone') || /^\+?[0-9 .-]{6,20}$/.test(fieldValue('phone')), 'Numéro de téléphone invalide.'],
    ];
    var first = null;
    var messages = [];
    checks.forEach(function (c) {
      var input = form.elements.namedItem(c[0]);
      if (input) input.setAttribute('aria-invalid', c[1] ? 'false' : 'true');
      if (!c[1]) {
        messages.push(c[2]);
        if (!first) first = input;
      }
    });
    if (messages.length) {
      formError.textContent = messages.join(' ');
      show(formError, true);
      if (first) first.focus();
      return false;
    }
    show(formError, false);
    return true;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (payBtn.disabled || !cart.length || !validate()) return;
    payBtn.disabled = true;
    var label = payBtn.textContent;
    payBtn.textContent = 'Redirection vers HelloAsso…';
    SHOP.call('checkout', {
      items: cart,
      buyer: {
        first_name: fieldValue('first_name'),
        last_name: fieldValue('last_name'),
        email: fieldValue('email'),
        phone: fieldValue('phone') || null,
        member_name: fieldValue('member_name') || null,
      },
      website: fieldValue('website'),
      origin: 'site',
    }).then(function (data) {
      if (!data || typeof data.redirect_url !== 'string' || data.redirect_url.indexOf('https://') !== 0) {
        throw new Error(SHOP.GENERIC_ERROR);
      }
      // Le panier reste enregistré jusqu'à la confirmation du paiement.
      window.location.assign(data.redirect_url);
    }).catch(function (err) {
      formError.textContent = err.message || SHOP.GENERIC_ERROR;
      show(formError, true);
      formError.setAttribute('tabindex', '-1');
      formError.focus();
      payBtn.disabled = false;
      payBtn.textContent = label;
    });
  });

  // ─── Chargement ─────────────────────────────────────────────────────────

  SHOP.call('catalog').then(function (data) {
    show(loading, false);
    if (!data || !data.open || !data.campaign) {
      show(closedBox, true);
      return;
    }
    var c = data.campaign;
    if (c.closes_at) {
      var d = new Date(c.closes_at);
      if (!isNaN(d.getTime())) {
        el('shop-campaign-text').textContent = 'commandes ouvertes jusqu\'au '
          + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
          + ', puis envoyées au fournisseur en une fois.';
      }
    }
    if (c.pickup_info) el('shop-pickup-text').textContent = c.pickup_info;
    products = Array.isArray(data.products) ? data.products : [];
    reconcile();
    renderProducts();
    show(root, true);
    show(cartSection, true);
    renderCart();
  }).catch(function (err) {
    show(loading, false);
    errorBox.textContent = 'Impossible de charger la boutique. ' + (err.message || SHOP.GENERIC_ERROR);
    show(errorBox, true);
  });
})();
