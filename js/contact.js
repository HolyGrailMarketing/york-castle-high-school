/**
 * Contact form submission.
 *
 * The original markup was a Webflow form (data-wf-flow, method="get") with an
 * inline handler that deliberately did NOT preventDefault, on the assumption
 * that "Webflow handles the submission". This site is self-hosted, so nothing
 * handled it - submitting simply reloaded the page with the answers in the
 * query string and the message was never delivered to anyone.
 *
 * It now posts to the school's own request API, where it shows up in the admin
 * dashboard under Requests alongside every other enquiry.
 */
(function () {
  var API_BASE_URL = window.API_BASE_URL ||
    (window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api');

  var form = document.getElementById('contact-form');
  if (!form) return;

  var statusEl = document.getElementById('contact-status');
  var submitBtn = form.querySelector('button[type="submit"]');

  function showStatus(message, kind) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = 'form-status is-' + kind;
    statusEl.hidden = false;
    statusEl.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  }

  function value(name) {
    var el = form.elements[name];
    return el ? el.value.trim() : '';
  }

  function checked(name) {
    var el = form.elements[name];
    return Boolean(el && el.checked);
  }

  /* Consent is recorded separately so it is auditable under the Jamaican
     Data Protection Act. Failure here must not block the enquiry itself. */
  function recordConsents(email) {
    var consents = [
      {
        consentType: 'contact_data_processing',
        purpose: 'Processing contact form inquiry and providing response',
        granted: checked('contact_data_processing_consent'),
        email: email,
      },
      {
        consentType: 'contact_marketing',
        purpose: 'Receiving occasional school updates and information',
        granted: checked('contact_marketing_consent'),
        email: email,
      },
    ];

    consents.forEach(function (consent) {
      if (!consent.granted) return;
      fetch(API_BASE_URL + '/consent/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consent),
      }).catch(function (err) {
        console.warn('Consent recording failed:', err);
      });
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!form.reportValidity()) return;

    var firstName = value('First-name');
    var lastName = value('Last-name');
    var email = value('Email');
    var telephone = value('Telephone');
    var message = value('Message');
    var fullName = (firstName + ' ' + lastName).trim();

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.label = submitBtn.textContent;
      submitBtn.textContent = 'Sending…';
    }
    if (statusEl) statusEl.hidden = true;

    fetch(API_BASE_URL + '/requests/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        type: 'GENERAL',
        title: 'Website enquiry from ' + (fullName || email),
        description: message,
        metadata: {
          source: 'contact-us',
          firstName: firstName,
          lastName: lastName,
          email: email,
          telephone: telephone,
          marketingConsent: checked('contact_marketing_consent'),
          submittedAt: new Date().toISOString(),
        },
      }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Request failed: ' + response.status);
        return response.json();
      })
      .then(function () {
        recordConsents(email);
        form.reset();
        showStatus(
          'Thank you — your message has been received. Our administrative staff will ' +
          'respond as soon as possible.',
          'success'
        );
      })
      .catch(function (error) {
        console.error('Contact form submission failed:', error);
        showStatus(
          'Sorry, your message could not be sent just now. Please try again, or ' +
          'email us directly at yorkcastle.high.san@moey.gov.jm.',
          'error'
        );
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.label || 'Send message';
        }
      });
  });
})();
