const carousel = document.getElementById('carousel');
const wrapper = document.querySelector('.carousel-wrapper');
const leftArrow = document.querySelector('.carousel-arrow-left');
const rightArrow = document.querySelector('.carousel-arrow-right');

function updateFades() {
    if (carousel.scrollWidth <= carousel.clientWidth) {
        wrapper.classList.remove('show-left', 'show-right');
        return;
    }
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    const scrollPos = carousel.scrollLeft;
    wrapper.classList.toggle('show-left', scrollPos > 5);
    wrapper.classList.toggle('show-right', scrollPos < maxScroll - 5);
}

function renderEvents(events) {
    carousel.innerHTML = '';

    if (!events || events.length === 0) {
        wrapper.classList.add('carousel-empty');
        wrapper.classList.remove('show-left', 'show-right');
        leftArrow.style.display = 'none';
        rightArrow.style.display = 'none';

        carousel.innerHTML = `
            <div class="carousel-empty-state">
                <p>No upcoming events right now. We're cooking up something</p>
                <p>exciting for the next sprint! Follow our socials or check
                back soon!</p>
                <a href="#" class="register" style="margin-top: 30px; width: 300px;">
                    Follow our community <span class="arrow-diagonal">↗</span></a>
            </div>
        `;
        return;
    }

    wrapper.classList.remove('carousel-empty');
    leftArrow.style.display = '';
    rightArrow.style.display = '';

    events.forEach(event => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img src="${event.image}" alt="${event.title}">
            <h3>${event.title}</h3>
            <p>${event.date}</p>
        `;
        carousel.appendChild(card);
    });

    updateFades();
}

carousel.addEventListener('scroll', updateFades);
window.addEventListener('load', updateFades);

function scrollCarouselLeft() {
    if (!carousel.children.length) return;
    carousel.scrollBy({ left: -220, behavior: 'smooth' });
}

function scrollCarouselRight() {
    if (!carousel.children.length) return;
    carousel.scrollBy({ left: 220, behavior: 'smooth' });
}

fetch('../data/events.json')
    .then(res => res.json())
    .then(events => renderEvents(events))
    .catch(err => {
        console.error('Failed to load events:', err);
        renderEvents([]);
    });

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