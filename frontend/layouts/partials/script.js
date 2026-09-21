document.addEventListener('DOMContentLoaded', function () {
      const hamburger = document.querySelector('.hamburger');
      const mobileNav = document.querySelector('.mobile-nav');
      const mobileLinks = document.querySelectorAll('.mobile-nav a');
      const topbar = document.querySelector('.topbar');

      if (!hamburger || !mobileNav) return;

      function triggerGlitch() {
        if (!topbar) return;
        topbar.classList.remove('glitch');
        void topbar.offsetWidth;
        topbar.classList.add('glitch');
        setTimeout(() => topbar.classList.remove('glitch'), 450);
      }

      hamburger.addEventListener('click', function (e) {
        e.stopPropagation();
        triggerGlitch();
        mobileNav.classList.toggle('open');
        hamburger.classList.toggle('active');
        hamburger.setAttribute(
          'aria-expanded',
          mobileNav.classList.contains('open')
        );
      });

      mobileLinks.forEach(link => {
        link.addEventListener('click', function () {
          if (!mobileNav.classList.contains('open')) return;
          triggerGlitch();
          mobileNav.classList.remove('open');
          hamburger.classList.remove('active');
          hamburger.setAttribute('aria-expanded', 'false');
        });
      });

      document.addEventListener('click', function (e) {
        if (
          mobileNav.classList.contains('open') &&
          !mobileNav.contains(e.target) &&
          !hamburger.contains(e.target)
        ) {
          triggerGlitch();
          mobileNav.classList.remove('open');
          hamburger.classList.remove('active');
          hamburger.setAttribute('aria-expanded', 'false');
        }
      });

      window.addEventListener('resize', function () {
        if (window.innerWidth > 700) {
          mobileNav.classList.remove('open');
          hamburger.classList.remove('active');
          hamburger.setAttribute('aria-expanded', 'false');
        }
      });
    });