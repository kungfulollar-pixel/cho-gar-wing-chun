/*
  Gallery lightbox: opens photos and videos full screen, with previous/next
  buttons, arrow keys, swipe and Escape. Without JavaScript every tile is still a
  plain link to the full-size file.
*/
document.addEventListener('DOMContentLoaded', function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('.gallery-link'));
  if (!links.length) {
    return;
  }

  var box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Gallery');
  box.innerHTML =
    '<button class="lightbox-close" aria-label="Close">&times;</button>' +
    '<button class="lightbox-prev" aria-label="Previous">&#8249;</button>' +
    '<div class="lightbox-stage"></div>' +
    '<button class="lightbox-next" aria-label="Next">&#8250;</button>' +
    '<p class="lightbox-caption"></p>';
  document.body.appendChild(box);

  var stage = box.querySelector('.lightbox-stage');
  var caption = box.querySelector('.lightbox-caption');
  var current = -1;
  var lastFocus = null;

  function show(index) {
    current = (index + links.length) % links.length;
    var link = links[current];
    stage.innerHTML = '';

    var media;
    if (link.dataset.type === 'video') {
      media = document.createElement('video');
      media.src = link.getAttribute('href');
      media.controls = true;
      media.autoplay = true;
      media.playsInline = true;
      media.preload = 'metadata';
      var poster = link.querySelector('img');
      if (poster) {
        media.poster = poster.getAttribute('src');
      }
    } else {
      media = document.createElement('img');
      media.src = link.getAttribute('href');
      media.alt = link.dataset.caption || '';
    }
    stage.appendChild(media);
    caption.textContent = link.dataset.caption || '';
  }

  function open(index) {
    lastFocus = document.activeElement;
    box.classList.add('open');
    document.body.classList.add('lightbox-open');
    show(index);
    box.querySelector('.lightbox-close').focus();
  }

  function close() {
    box.classList.remove('open');
    document.body.classList.remove('lightbox-open');
    stage.innerHTML = '';
    current = -1;
    if (lastFocus) {
      lastFocus.focus();
    }
  }

  links.forEach(function (link, index) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      open(index);
    });
  });

  box.querySelector('.lightbox-close').addEventListener('click', close);
  box.querySelector('.lightbox-prev').addEventListener('click', function () { show(current - 1); });
  box.querySelector('.lightbox-next').addEventListener('click', function () { show(current + 1); });

  box.addEventListener('click', function (e) {
    if (e.target === box || e.target === stage) {
      close();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (current < 0) {
      return;
    }
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowLeft') {
      show(current - 1);
    } else if (e.key === 'ArrowRight') {
      show(current + 1);
    }
  });

  var touchX = null;
  box.addEventListener('touchstart', function (e) {
    touchX = e.touches[0].clientX;
  }, { passive: true });
  box.addEventListener('touchend', function (e) {
    if (touchX === null) {
      return;
    }
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) {
      show(current + (dx < 0 ? 1 : -1));
    }
  });
});
