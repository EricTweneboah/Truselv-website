
  $(function () {

    // MENU
    $('.nav-link').on('click',function(){
      $(".navbar-collapse").collapse('hide');
    });


    // AOS ANIMATION
    AOS.init({
      disable: 'mobile',
      duration: 800,
      anchorPlacement: 'center-bottom'
    });


    // SMOOTH SCROLL (only for in-page anchors)
    $(function() {
      $('.navbar .nav-link[href^="#"]').on('click', function(event) {
        var targetId = $(this).attr('href');
        if (!targetId || targetId === '#') {
          return;
        }

        var $target = $(targetId);
        if (!$target.length) {
          return;
        }

        event.preventDefault();
        $('html, body').stop().animate({
          scrollTop: $target.offset().top
        }, 1000);
      });
    });


    // PROJECT SLIDE
    $('#project-slide').owlCarousel({
      loop: true,
      center: true,
      autoplayHoverPause: false,
      autoplay: true,
      margin: 30,
      responsiveClass:true,
      responsive:{
          0:{
              items:1,
          },
          768:{
              items:2,
          }
      }
    });


    // COOKIE CONSENT
    (function initCookieConsent() {
      var storageKey = 'truselv-cookie-consent';
      var cookieName = 'truselv_cookie_preference';

      function readCookie(name) {
        var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : null;
      }

      function rememberDecision(value) {
        try {
          localStorage.setItem(storageKey, value);
        } catch (err) {
          // Ignore storage errors (e.g., private mode)
        }
        var expires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
        document.cookie = cookieName + '=' + value + '; expires=' + expires.toUTCString() + '; path=/; SameSite=Lax';
      }

      function getStoredDecision() {
        try {
          var stored = localStorage.getItem(storageKey);
          if (stored) {
            return stored;
          }
        } catch (err) {
          // Ignore and fall back to cookies
        }
        return readCookie(cookieName);
      }

      if (getStoredDecision()) {
        return;
      }

      var privacyLink = 'privacy.html';
      var inferredLink = document.querySelector('a[href$="privacy.html"]');
      if (inferredLink) {
        privacyLink = inferredLink.getAttribute('href');
      } else if (window.location && window.location.pathname) {
        privacyLink = (window.location.pathname.charAt(0) === '/' ? '/' : '') + 'privacy.html';
      }

      var banner = document.createElement('section');
      banner.className = 'cookie-banner';
      banner.setAttribute('role', 'dialog');
      banner.setAttribute('aria-live', 'polite');
      banner.setAttribute('aria-label', 'Cookie consent banner');
      banner.innerHTML = '\
        <div class="cookie-banner__content">\
          <p class="cookie-banner__title">We use cookies</p>\
          <p class="cookie-banner__text">We use essential cookies to keep things running and optional ones to help us understand how the site is used. Choose what works for you. See our <a class="cookie-banner__link" href="' + privacyLink + '">privacy policy</a>.</p>\
        </div>\
        <div class="cookie-banner__actions">\
          <button type="button" class="cookie-banner__button cookie-banner__button--decline" data-cookie-reject>Reject optional</button>\
          <button type="button" class="cookie-banner__button cookie-banner__button--accept" data-cookie-accept>Accept all</button>\
        </div>';

      document.body.appendChild(banner);
      requestAnimationFrame(function () {
        banner.classList.add('is-visible');
      });

      function dismissBanner(decision) {
        rememberDecision(decision);
        banner.classList.remove('is-visible');
        setTimeout(function () {
          if (banner && banner.parentNode) {
            banner.parentNode.removeChild(banner);
          }
        }, 350);
      }

      banner.querySelector('[data-cookie-accept]').addEventListener('click', function () {
        dismissBanner('accepted');
      });

      banner.querySelector('[data-cookie-reject]').addEventListener('click', function () {
        dismissBanner('rejected');
      });
    })();

  });


    
