/* ============================================
   Dragon Cave – Interaktions- & Animationsschicht
   Nutzt GSAP + ScrollTrigger. Faellt sauber zurueck,
   falls die CDN-Skripte nicht laden.
   ============================================ */

(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';

  if (hasGsap && window.gsap.registerPlugin && window.ScrollTrigger) {
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initLoader();
    initHeaderScroll();
    initNavIndicator();
    if (!reduceMotion) {
      initScrollReveals();
      initStatCounters();
      if (canHover) {
        initCustomCursor();
        initCardTilt();
      }
    } else {
      // Ohne Bewegungsreduktion: Inhalte sofort sichtbar lassen.
    }
  });

  /* ---------- Loader ---------- */

  function initLoader() {
    var loader = document.getElementById('page-loader');
    if (!loader) return;

    document.documentElement.classList.add('is-loading');

    var finish = function () {
      document.documentElement.classList.remove('is-loading');
      if (hasGsap && !reduceMotion) {
        var tl = window.gsap.timeline();
        tl.to(loader.querySelectorAll('.loader-mark, .loader-word'), {
          opacity: 0, y: -10, duration: 0.4, ease: 'power2.in', stagger: 0.05
        }).to(loader, {
          opacity: 0, duration: 0.5, ease: 'power2.inOut',
          onComplete: function () { loader.style.display = 'none'; }
        }, '-=0.1');
        animateHeroIn();
      } else {
        loader.style.display = 'none';
        animateHeroIn();
      }
    };

    if (hasGsap && !reduceMotion) {
      window.gsap.set(loader.querySelectorAll('.loader-mark, .loader-word'), { opacity: 0, y: 10 });
      window.gsap.timeline()
        .to(loader.querySelectorAll('.loader-mark'), { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' })
        .to(loader.querySelectorAll('.loader-word'), { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.25');
    }

    // Minimum Anzeigedauer fuer ein ruhiges Markenmoment, plus Sicherheitsnetz.
    var minTimer = setTimeout(finish, 900);
    window.addEventListener('load', function () {
      clearTimeout(minTimer);
      setTimeout(finish, 350);
    }, { once: true });
    // Sicherheitsnetz: Loader nie laenger als 4s blockieren lassen.
    setTimeout(finish, 4000);
  }

  function animateHeroIn() {
    var content = document.querySelector('.hero-content');
    if (!content || !hasGsap) return;
    var targets = content.querySelectorAll('.eyebrow, h1, p, .hero-actions');
    window.gsap.fromTo(targets,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.12 }
    );
  }

  /* ---------- Header shrink on scroll ---------- */

  function initHeaderScroll() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var onScroll = function () {
      if (window.scrollY > 40) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Sliding nav indicator ---------- */

  function initNavIndicator() {
    var list = document.querySelector('.nav-links');
    if (!list) return;
    var indicator = document.createElement('li');
    indicator.className = 'nav-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    list.appendChild(indicator);

    var links = Array.prototype.slice.call(list.querySelectorAll('a')).filter(function (a) {
      return !a.classList.contains('btn-login');
    });

    var moveTo = function (el) {
      if (!el) { indicator.style.opacity = 0; return; }
      var listRect = list.getBoundingClientRect();
      var rect = el.getBoundingClientRect();
      indicator.style.opacity = 1;
      indicator.style.left = (rect.left - listRect.left) + 'px';
      indicator.style.width = rect.width + 'px';
    };

    var active = list.querySelector('a.active');
    moveTo(active);

    links.forEach(function (link) {
      link.addEventListener('mouseenter', function () { moveTo(link); });
    });
    list.addEventListener('mouseleave', function () { moveTo(active); });
    window.addEventListener('resize', function () { moveTo(document.activeElement.closest ? active : active); });
  }

  /* ---------- Scroll reveals ---------- */

  function initScrollReveals() {
    if (!hasGsap || !window.ScrollTrigger) return;
    var gsap = window.gsap;

    // Ueberschriften-Bloecke je Section
    gsap.utils.toArray('.section .eyebrow, .section .section-title, .section .section-subtitle').forEach(function (el) {
      if (el.closest('.hero-content')) return;
      gsap.from(el, {
        opacity: 0, y: 28, duration: 0.7, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%' }
      });
    });

    // Freie Ueberschriften ausserhalb von Cards (z.B. Kontakt-Spalte)
    Array.prototype.slice.call(document.querySelectorAll('.section h2, .section h3')).forEach(function (el) {
      if (el.closest('.card') || el.classList.contains('section-title')) return;
      gsap.from(el, {
        opacity: 0, y: 20, duration: 0.6, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%' }
      });
    });

    // Seiten-Hero der Unterseiten (sofort sichtbar, kein Scroll noetig)
    var pageHero = document.querySelector('.page-hero .container');
    if (pageHero) {
      gsap.from(pageHero.children, {
        opacity: 0, y: 22, duration: 0.7, ease: 'power3.out', stagger: 0.1, delay: 0.1
      });
    }

    // Grid-Gruppen (Cards & Spalten) im Stagger.
    // Formularkarten bleiben aussen vor — die werden weiter unten sofort
    // eingeblendet, und zwei Animationen auf demselben Element haben das
    // Kontaktformular schon einmal dauerhaft unsichtbar gemacht.
    gsap.utils.toArray('.grid').forEach(function (grid) {
      var kinder = Array.prototype.slice.call(grid.children).filter(function (kind) {
        return !kind.classList.contains('form-card');
      });
      if (!kinder.length) return;
      gsap.from(kinder, {
        opacity: 0, y: 32, duration: 0.6, ease: 'power2.out', stagger: 0.12,
        scrollTrigger: { trigger: grid, start: 'top 85%' }
      });
    });

    // Galerie
    var gallery = document.querySelector('.gallery-grid');
    if (gallery) {
      gsap.from(gallery.children, {
        opacity: 0, scale: 0.9, duration: 0.5, ease: 'back.out(1.6)', stagger: 0.06,
        scrollTrigger: { trigger: gallery, start: 'top 85%' }
      });
    }

    // Stundenplan-Zeilen
    var timetableRows = document.querySelectorAll('.timetable tbody tr');
    if (timetableRows.length) {
      gsap.from(timetableRows, {
        opacity: 0, x: -20, duration: 0.5, ease: 'power2.out', stagger: 0.06,
        scrollTrigger: { trigger: '.timetable', start: 'top 85%' }
      });
    }

    // Formularkarten werden bewusst NICHT animiert.
    //
    // Jede Einblendung setzt die Deckkraft zuerst auf 0. Laeuft die Animation
    // dann nicht — zwei Tweens auf demselben Element, ein ScrollTrigger der
    // nicht ausloest, eine Umgebung ohne Frames — bleibt das Formular
    // unsichtbar. Genau das ist zweimal passiert. Ein Kontakt- oder
    // Login-Formular ist Bedienelement, kein Deko-Element: Es ist einfach da.

    // Freistehende Cards ausserhalb von Grids
    Array.prototype.slice.call(document.querySelectorAll('.container > .card')).forEach(function (el) {
      if (el.parentElement && el.parentElement.classList.contains('grid')) return;
      gsap.fromTo(el,
        { opacity: 0, y: 30 },
        {
          opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%' }
        }
      );
    });

    // Member-Header (Mitgliederbereich)
    var memberHeader = document.querySelector('.member-header');
    if (memberHeader) {
      gsap.from(memberHeader.children, {
        opacity: 0, y: 20, duration: 0.6, ease: 'power2.out', stagger: 0.1
      });
    }
  }

  /* ---------- Stat counters ---------- */

  function initStatCounters() {
    var stats = document.querySelectorAll('.stat-number');
    if (!stats.length) return;

    stats.forEach(function (el) {
      var raw = el.textContent.trim();
      var match = raw.match(/^(\d+)(.*)$/);
      if (!match) return;
      var target = parseInt(match[1], 10);
      var suffix = match[2] || '';
      var proxy = { value: 0 };
      el.textContent = '0' + suffix;

      var run = function () {
        if (hasGsap) {
          window.gsap.to(proxy, {
            value: target, duration: 1.4, ease: 'power2.out',
            onUpdate: function () { el.textContent = Math.round(proxy.value) + suffix; }
          });
        } else {
          el.textContent = target + suffix;
        }
      };

      if (window.ScrollTrigger) {
        window.ScrollTrigger.create({
          trigger: el, start: 'top 90%', once: true, onEnter: run
        });
      } else if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { run(); io.disconnect(); }
          });
        }, { threshold: 0.4 });
        io.observe(el);
      } else {
        run();
      }
    });
  }

  /* ---------- Custom cursor ---------- */

  function initCustomCursor() {
    document.documentElement.classList.add('has-custom-cursor');

    var dot = document.createElement('div');
    dot.className = 'cursor-dot';
    var ring = document.createElement('div');
    ring.className = 'cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    var moveDot, moveRing;
    if (hasGsap) {
      moveDot = window.gsap.quickTo(dot, 'x', { duration: 0.05, ease: 'none' });
      var moveDotY = window.gsap.quickTo(dot, 'y', { duration: 0.05, ease: 'none' });
      moveRing = window.gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3.out' });
      var moveRingY = window.gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3.out' });
    }

    var shown = false;
    window.addEventListener('mousemove', function (e) {
      if (!shown) {
        shown = true;
        dot.style.opacity = 1;
        ring.style.opacity = 1;
      }
      if (hasGsap) {
        moveDot(e.clientX); moveDotY(e.clientY);
        moveRing(e.clientX); moveRingY(e.clientY);
      } else {
        dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px';
        ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
      }
    });

    var interactive = 'a, button, .btn, .card, input, textarea, .nav-toggle';
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest && e.target.closest(interactive)) {
        ring.classList.add('is-active');
      }
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest(interactive)) {
        ring.classList.remove('is-active');
      }
    });
  }

  /* ---------- Card 3D tilt ---------- */

  function initCardTilt() {
    var cards = document.querySelectorAll('.card');
    cards.forEach(function (card) {
      var setX, setY;
      if (hasGsap) {
        setX = window.gsap.quickTo(card, 'rotationX', { duration: 0.4, ease: 'power2.out' });
        setY = window.gsap.quickTo(card, 'rotationY', { duration: 0.4, ease: 'power2.out' });
        window.gsap.set(card, { transformPerspective: 800 });
      }
      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        if (hasGsap) {
          setX(py * -6);
          setY(px * 6);
        }
      });
      card.addEventListener('mouseleave', function () {
        if (hasGsap) { setX(0); setY(0); }
      });
    });
  }
})();
