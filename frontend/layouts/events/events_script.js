const carousel = document.getElementById('carousel');
const wrapper = document.querySelector('.carousel-wrapper');

function updateFades() {
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    const scrollPos = carousel.scrollLeft;

    wrapper.classList.toggle('show-left', scrollPos > 5);

    wrapper.classList.toggle('show-right', scrollPos < maxScroll - 5);
}

carousel.addEventListener('scroll', updateFades);
window.addEventListener('load', updateFades);

function scrollCarouselLeft() {
    const carousel = document.getElementById('carousel');
    carousel.scrollBy({ left: -220, behavior: 'smooth' });
}

function scrollCarouselRight() {
    const carousel = document.getElementById('carousel');
    carousel.scrollBy({ left: 220, behavior: 'smooth' });
}

fetch('../partials/index.html')
  .then(res => res.text())
  .then(html => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const header = doc.querySelector('header.topbar');
    const mobileNav = doc.querySelector('nav.mobile-nav');
    const footer = doc.querySelector('footer.footer');

    if (header) document.getElementById('header-placeholder').outerHTML = header.outerHTML;
    if (mobileNav) document.getElementById('mobilenav-placeholder').outerHTML = mobileNav.outerHTML;
    if (footer) document.getElementById('footer-placeholder').outerHTML = footer.outerHTML;
    
    document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(link => {
    link.classList.remove('active');
    if (link.textContent.trim() === 'Events') {
        link.classList.add('active');
    }
    });

    const script = document.createElement('script');
    script.src = '../partials/script.js';
    document.body.appendChild(script);
  });
