/* TruSelv: deliberately small, progressively enhanced interactions. */
(() => {
  'use strict';
  const config = window.TRUSELV_CONFIG || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const money = value => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
  const number = value => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value);
  const params = new URLSearchParams(location.search);

  const menu = $('.menu-toggle');
  const navigation = $('#navigation');
  const closeMenu = () => { navigation?.classList.remove('is-open'); menu?.setAttribute('aria-expanded', 'false'); };
  menu?.addEventListener('click', () => {
    const opened = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(opened));
    navigation.classList.toggle('is-open', opened);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (navigation?.classList.contains('is-open')) { closeMenu(); menu.focus(); }
      $$('.nav-products[open]').forEach(el => { el.open = false; $('summary', el).focus(); });
    }
  });
  document.addEventListener('click', event => {
    $$('.nav-products[open]').forEach(el => { if (!el.contains(event.target)) el.open = false; });
    if (navigation?.classList.contains('is-open') && !event.target.closest('.site-header')) closeMenu();
  });
  window.matchMedia('(min-width: 821px)').addEventListener('change', closeMenu);

  const cookieDialog = $('#cookie-dialog');
  $$('[data-cookie-settings]').forEach(el => el.addEventListener('click', () => cookieDialog.showModal()));
  $$('[data-close-dialog]').forEach(el => el.addEventListener('click', () => el.closest('dialog').close()));
  cookieDialog?.addEventListener('click', event => { if (event.target === cookieDialog) { const r = cookieDialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) cookieDialog.close(); } });

  const film = $('#welcome-video');
  if (film) {
    const toggle = $('#video-toggle');
    const sound = $('#video-sound');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { toggle.textContent = film.paused ? 'Play film' : 'Pause film'; sound.textContent = film.muted ? 'Sound off' : 'Sound on'; sound.setAttribute('aria-pressed', String(!film.muted)); };
    toggle.addEventListener('click', () => { if (film.paused) film.play().catch(update); else film.pause(); });
    sound.addEventListener('click', () => { film.muted = !film.muted; update(); });
    film.addEventListener('play', update); film.addEventListener('pause', update); film.addEventListener('volumechange', update);
    if (!reduced.matches && !navigator.connection?.saveData) film.play().catch(update);
    reduced.addEventListener('change', event => { if (event.matches) film.pause(); });
    // Do not restart a visitor-paused video automatically.
    document.addEventListener('visibilitychange', () => { if (document.hidden) film.pause(); });
    new IntersectionObserver(entries => { if (!entries[0].isIntersecting) film.pause(); }, { threshold: 0.1 }).observe(film);
    film.addEventListener('error', () => { toggle.textContent = 'Film unavailable'; toggle.disabled = true; sound.hidden = true; });
  }

  $$('[data-gallery]').forEach(button => button.addEventListener('click', () => {
    $('#gallery-image').src = button.dataset.gallery;
    $('#gallery-image').alt = button.dataset.alt;
    $$('[data-gallery]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
  }));

  let resourceCategory = 'All';
  function filterResources() {
    const term = ($('#resource-search')?.value || '').trim().toLowerCase();
    let count = 0;
    $$('.resource-card[data-category]').forEach(card => {
      const visible = (resourceCategory === 'All' || card.dataset.category === resourceCategory) && card.textContent.toLowerCase().includes(term);
      card.hidden = !visible;
      if (visible) count++;
    });
    if ($('#resource-count')) $('#resource-count').textContent = `${count} resource${count === 1 ? '' : 's'}`;
    if ($('#no-resources')) $('#no-resources').hidden = count !== 0;
  }
  $$('[data-filter]').forEach(button => button.addEventListener('click', () => {
    resourceCategory = button.dataset.filter;
    $$('[data-filter]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
    filterResources();
  }));
  $('#resource-search')?.addEventListener('input', filterResources);

  function setOption(select, value) {
    if (!select || !value) return;
    const option = [...select.options].find(o => o.value.toLowerCase() === value.toLowerCase());
    if (option) select.value = option.value;
  }
  setOption($('#product'), params.get('product'));
  const topic = params.get('topic');
  if (topic) {
    setOption($('#topic'), topic);
    if ($('#topic') && !$('#topic').value) {
      if (/app/i.test(topic)) setOption($('#topic'), 'TESS app availability');
      else setOption($('#topic'), 'General enquiry');
      if ($('#message')) $('#message').value = `I would like to ask about ${topic.slice(0, 150)}. `;
    }
  }

  function emailReview(container, subject, body) {
    // User-supplied strings are assigned with textContent/value, never HTML.
    container.hidden = false;
    container.replaceChildren();
    const heading = document.createElement('h3'); heading.textContent = 'Ready to send from your email app.';
    const explanation = document.createElement('p'); explanation.textContent = 'Nothing has been sent yet. Review your message below, then open your email app and send it. You can also copy the message and email it to ' + config.email + '.';
    const label = document.createElement('label'); label.textContent = 'Your prepared message';
    const preview = document.createElement('textarea'); preview.readOnly = true; preview.value = body; preview.setAttribute('aria-label', 'Your prepared email message');
    const actions = document.createElement('div'); actions.className = 'actions';
    const send = document.createElement('a'); send.className = 'btn'; send.textContent = 'Open email app ↗'; send.href = `mailto:${config.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn outline'; copy.textContent = 'Copy message';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(`To: ${config.email}\nSubject: ${subject}\n\n${body}`); copy.textContent = 'Copied'; }
      catch { preview.focus(); preview.select(); copy.textContent = 'Select and copy the message'; }
    });
    actions.append(send, copy); container.append(heading, explanation, label, preview, actions);
    heading.tabIndex = -1; heading.focus();
  }

  async function sendInquiry(data) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(config.inquiryEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: controller.signal });
      if (!response.ok) throw new Error('The request could not be delivered. Please try again or email ' + config.email + '.');
      const result = await response.json();
      if (result.accepted !== true) throw new Error('Delivery could not be confirmed. Please email ' + config.email + '.');
      return result;
    } finally { clearTimeout(timeout); }
  }

  $$('form[data-inquiry]').forEach(form => {
    if (config.inquiryEndpoint) {
      $('[data-form-submit]', form).textContent = form.dataset.inquiry === 'demo' ? 'Send demo request ↗' : 'Send enquiry ↗';
      $('[data-form-delivery]', form).textContent = 'Your request will be sent to TruSelv. Demo times are agreed by email.';
    }
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form));
      if (data.website) return;
      data.kind = form.dataset.inquiry;
      const result = $('.form-result', form), error = $('.error-message', form), submit = $('[data-form-submit]', form);
      error.hidden = true;
      const names = { name: 'Name', email: 'Email', organisation: 'Organisation', postcode: 'Postcode / ODS code', role: 'Role', product: 'Product', topic: 'Enquiry', message: 'Message', source: 'Heard about TruSelv via' };
      const body = Object.entries(names).filter(([key]) => data[key]).map(([key, label]) => `${label}: ${data[key]}`).join('\n\n');
      if (!config.inquiryEndpoint) { emailReview(result, data.kind === 'demo' ? `TruSelv demo request — ${data.product}` : `TruSelv enquiry — ${data.topic}`, body); return; }
      submit.disabled = true;
      try {
        await sendInquiry(data); result.hidden = false; result.textContent = 'Your request has been sent to TruSelv. We will reply by email. A demo is only booked when a time is agreed.'; form.reset(); result.tabIndex = -1; result.focus();
      } catch (e) { error.hidden = false; error.textContent = e.name === 'AbortError' ? 'Delivery timed out. Please email us or try again. Your details are still here.' : e.message; }
      finally { submit.disabled = false; }
    });
  });

  const roiForm = $('#roi-form');
  function calculate() {
    const valid = [...roiForm.querySelectorAll('input')].every(input => input.validity.valid && input.value !== '' && Number.isFinite(input.valueAsNumber));
    $('#roi-error').hidden = valid;
    if (!valid) { $('#roi-hours').textContent = 'Check inputs'; $('#roi-value').textContent = '—'; $('#roi-net').textContent = '—'; $('#roi-return').textContent = 'Enter valid assumptions to update the estimate.'; $('#roi-payback').textContent = ''; $('#roi-time-detail').textContent = ''; return; }
    const values = Object.fromEntries([...new FormData(roiForm)].map(([key, value]) => [key, Number(value)]));
    const hours = values.beds * values.occupancy / 100 * values.days * (values.manual - values.digital) / 60;
    const value = hours * values.hourly;
    const benefit = value + values.consumables - values.annual;
    const net = benefit - values.upfront;
    const cost = values.upfront + values.annual;
    $('#roi-hours').textContent = number(hours) + ' hours';
    $('#roi-time-detail').textContent = number(hours / values.days) + ' hours per operating day';
    $('#roi-value').textContent = money(value);
    $('#roi-net').textContent = cost > 0 ? money(net) : 'Add project costs';
    $('#roi-return').textContent = cost > 0 ? `${number(net / cost * 100)}% first-year modelled ROI` : 'Enter a supplier quote to calculate ROI and payback.';
    $('#roi-payback').textContent = values.upfront > 0 ? (benefit > 0 ? `Simple payback: ${number(values.upfront / benefit * 12)} months. Assumes benefits accrue evenly.` : 'No payback at these assumptions: annual net benefit is zero or negative.') : '';
  }
  if (roiForm) { roiForm.addEventListener('input', calculate); roiForm.addEventListener('reset', () => setTimeout(calculate, 0)); calculate(); }
  $('#print-roi')?.addEventListener('click', () => window.print());

  const quantity = $('#quantity');
  if (quantity) {
    let orderQuantity = 1;
    const updateQuantity = () => {
      const n = Number(quantity.value);
      const valid = quantity.value !== '' && Number.isInteger(n) && n >= 1 && n <= 50;
      $('#quantity-error').hidden = valid;
      $('#shop-subtotal').textContent = valid ? money(n * config.tessUnitPrice) : '—';
      return valid;
    };
    quantity.addEventListener('input', updateQuantity);
    $('#qty-minus').addEventListener('click', () => { quantity.value = Math.max(1, Math.min(50, (Number(quantity.value) || 1) - 1)); updateQuantity(); });
    $('#qty-plus').addEventListener('click', () => { quantity.value = Math.min(50, Math.max(1, (Number(quantity.value) || 1) + 1)); updateQuantity(); });
    const showStep = step => {
      [1, 2, 3].forEach(i => { $(`#shop-step-${i}`).hidden = step !== i; const el = $(`[data-shop-step-label="${i}"]`); if (step === i) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current'); });
      if (step !== 1) $(`#shop-step-${step} h2`).focus();
    };
    $('#review-order').addEventListener('click', () => {
      if (!updateQuantity()) { quantity.focus(); return; }
      orderQuantity = Number(quantity.value);
      $('#review-quantity').textContent = orderQuantity;
      $('#review-price').textContent = $('#review-subtotal').textContent = money(orderQuantity * config.tessUnitPrice);
      showStep(2);
    });
    $$('[data-shop-back]').forEach(el => el.addEventListener('click', () => { showStep(1); $('#review-order').focus(); }));
    const checkoutEnabled = Boolean(config.checkoutEndpoint && config.stripePublishableKey);
    const country = $('#order-country');
    if (country && config.shippingCountries) {
      const names = new Intl.DisplayNames(['en-GB'], { type: 'region' });
      config.shippingCountries.filter(code => code !== 'GB').sort((a,b) => names.of(a).localeCompare(names.of(b))).forEach(code => country.add(new Option(names.of(code), code)));
    }
    let stripeScript;
    function loadStripe() {
      if (window.Stripe) return Promise.resolve();
      if (!stripeScript) stripeScript = new Promise((resolve,reject) => {
        const script = document.createElement('script'); script.src = 'https://js.stripe.com/dahlia/stripe.js';
        const timer = setTimeout(() => reject(new Error('Stripe could not load. Reload this page to try again.')), 15000);
        script.onload = () => { clearTimeout(timer); resolve(); };
        script.onerror = () => { clearTimeout(timer); reject(new Error('Stripe could not load. Reload this page to try again.')); };
        document.head.append(script);
      });
      return stripeScript;
    }
    let embeddedCheckout;
    if (checkoutEnabled) {
      $('#checkout-button').textContent = 'Continue to secure checkout ↗';
      $('#checkout-explanation').textContent = (config.checkoutTestMode ? 'Test checkout — no real payment will be taken. ' : '') + 'Review the total and delivery address in the secure Stripe form before paying. Card details go directly to Stripe.';
    } else if (config.inquiryEndpoint) $('#checkout-button').textContent = 'Send order enquiry ↗';
    $('#order-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form));
      const error = $('.error-message', form), submit = $('#checkout-button');
      error.hidden = true;
      const body = `TESS tablet order enquiry\n\nName: ${data['order-name']}\nEmail: ${data['order-email']}\nOrganisation: ${data['order-organisation'] || 'Individual'}\nDelivery address: ${[data['order-line1'], data['order-line2'], data['order-city'], data['order-state'], data['order-postcode'], data['order-country']].filter(Boolean).join(', ')}\nQuantity: ${orderQuantity}\nProduct subtotal: ${money(orderQuantity * config.tessUnitPrice)}\nOffer: One tablet per tablet.\n\nPlease confirm availability, final hardware/accessories, VAT, delivery cost and timing, setup and support details, legal seller and the full payable price before purchase.\n\nThis is an enquiry, not a confirmed purchase.`;
      if (!checkoutEnabled && !config.inquiryEndpoint) { showStep(3); emailReview($('#order-result'), 'TESS tablet order enquiry', body); return; }
      submit.disabled = true;
      try {
        if (checkoutEnabled) {
          await loadStripe();
          const response = await fetch(config.checkoutEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: orderQuantity, email: data['order-email'], termsAccepted: true, shippingAddress: { line1: data['order-line1'], city: data['order-city'], postal_code: data['order-postcode'], country: data['order-country'] } }), signal: AbortSignal.timeout(15000) });
          const result = await response.json();
          if (!response.ok || !result.client_secret || !result.session_id) throw new Error(result.error || 'Checkout could not be opened. Please contact us.');
          if (embeddedCheckout) embeddedCheckout.destroy();
          const stripe = window.Stripe(config.stripePublishableKey, { betas: ['custom_checkout_payment_form_1'] });
          const checkout = stripe.initCheckoutFormSdk({ clientSecret: result.client_secret,
            appearance: { theme: 'stripe', labels: 'floating', inputs: 'spaced', variables: { borderRadius: '4px', colorBackground: '#ffffff', colorDanger: '#df1b41', colorPrimary: '#0570de', colorSuccess: '#00c853', colorText: '#30313d', fontFamily: 'default', fontSizeBase: '16px', spacingUnit: '4px' } },
            defaultValues: { email: data['order-email'], shippingAddress: { name: data['order-name'], address: { line1: data['order-line1'], line2: data['order-line2'], city: data['order-city'], state: data['order-state'], postal_code: data['order-postcode'], country: data['order-country'] } } }
          });
          const loaded = await checkout.loadActions();
          if (loaded.type !== 'success') throw new Error('Secure checkout could not load. Please try again.');
          embeddedCheckout = checkout.createForm({ layout: 'expanded' });
          showStep(3); $('#order-result').textContent = config.checkoutTestMode ? 'Stripe test checkout. Use a test card only.' : 'Complete your purchase securely with Stripe.';
          $('#payment-error').hidden = true;
          embeddedCheckout.mount('#checkout-form');
          let confirming = false;
          embeddedCheckout.on('confirm', async event => {
            if (confirming) return; confirming = true;
            try {
              const confirmation = await loaded.actions.confirm({ formConfirmEvent: event, returnUrl: new URL(`order-status.html?session_id=${encodeURIComponent(result.session_id)}`, location.href).href, redirect: 'if_required' });
              if (confirmation?.type === 'error') throw new Error(confirmation.error?.message || 'Payment could not be confirmed. Check the form.');
              location.assign(`order-status.html?session_id=${encodeURIComponent(result.session_id)}`);
            } catch (e) { $('#payment-error').hidden = false; $('#payment-error').textContent = e.message || 'Payment status is uncertain. Contact support before paying again.'; }
            finally { confirming = false; }
          });
        } else {
          await sendInquiry({ kind: 'order', name: data['order-name'], email: data['order-email'], organisation: data['order-organisation'], message: body, privacy: 'on' });
          showStep(3); $('#order-result').textContent = 'Your order enquiry has been sent. We will confirm the full offer by email before you decide to purchase. No payment has been taken.';
        }
      } catch (e) { error.hidden = false; error.textContent = e.name === 'TimeoutError' ? 'The connection timed out. Please try again or contact us.' : e.message; }
      finally { submit.disabled = false; }
    });
  }

  if ($('#order-status') && config.orderStatusEndpoint && params.get('session_id')) {
    const status = $('#order-status');
    status.textContent = 'Checking your payment status…';
    fetch(`${config.orderStatusEndpoint}?session_id=${encodeURIComponent(params.get('session_id'))}`, { signal: AbortSignal.timeout(15000) })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => { status.textContent = result.paid === true ? 'Payment confirmed. Keep your payment receipt. TruSelv will follow up with your order and delivery details.' : 'Payment is not confirmed. If you have a receipt, contact TruSelv before attempting another payment.'; })
      .catch(() => { status.textContent = 'We could not verify payment here. Check your payment receipt or contact TruSelv before paying again.'; });
  }
})();
