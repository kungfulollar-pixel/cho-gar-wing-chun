document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');

  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
    });
  }

  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(function (link) {
    var href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
    }
  });

  /*
    Newsletter sign-up, double opt-in: this only requests the confirmation mail.
    The address counts as subscribed once the link in that mail is opened, so the
    message says "check your inbox" rather than "thank you for subscribing".
  */
  document.querySelectorAll('.newsletter-form').forEach(function (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var success = form.parentElement.querySelector('.newsletter-success');
      var input = form.querySelector('input[type="email"]');
      var button = form.querySelector('button');
      var email = input ? input.value.trim() : '';

      if (!email) {
        return;
      }

      button.disabled = true;

      var response;
      try {
        response = await fetch('/api/newsletter/subscribe', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email })
        });
      } catch (err) {
        response = null;
      }

      button.disabled = false;

      if (!success) {
        return;
      }

      if (response && response.ok) {
        success.textContent = 'Almost done — please confirm the link we just e-mailed to you.';
        success.style.display = 'block';
        form.reset();
        return;
      }

      var data = {};
      try {
        data = response ? await response.json() : {};
      } catch (err) {
        /* Keep the fallback message below. */
      }
      success.textContent = data.error || 'Your subscription could not be saved. Please try again later.';
      success.style.display = 'block';
    });
  });
});
