document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});


// =========================
// TEAM PHOTO CAROUSEL
// =========================

document.addEventListener('DOMContentLoaded', () => {

    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.carousel-dot');
    const prevBtn = document.querySelector('.carousel-prev');
    const nextBtn = document.querySelector('.carousel-next');
    const track = document.querySelector('.carousel-track');

    if (!slides.length) return;

    let current = 0;
    let touchStartX = 0;
    let touchEndX = 0;

    function showSlide(index) {
        if (index < 0) index = slides.length - 1;
        if (index >= slides.length) index = 0;

        slides.forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
        });

        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });

        current = index;
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => showSlide(current - 1));
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => showSlide(current + 1));
    }

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const index = parseInt(dot.dataset.slide, 10);
            showSlide(index);
        });
    });

    // =========================
    // TOUCH / SWIPE SUPPORT (mobile)
    // =========================

    function handleTouchStart(e) {
        touchStartX = e.changedTouches[0].screenX;
    }

    function handleTouchEnd(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }

    function handleSwipe() {
        const swipeThreshold = 50; // minimum px para ituring na swipe
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) < swipeThreshold) return;

        if (diff > 0) {
            showSlide(current + 1);
        } else {
            showSlide(current - 1);
        }
    }

    if (track) {
        track.addEventListener('touchstart', handleTouchStart, { passive: true });
        track.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    // =========================
    // KEYBOARD SUPPORT (desktop)
    // =========================

    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') {
            showSlide(current - 1);
        } else if (e.key === 'ArrowRight') {
            showSlide(current + 1);
        }
    });

    // =========================
    // RESIZE HANDLER (para sa responsive layout)
    // =========================

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            showSlide(current);
        }, 150);
    });

    // =========================
    // AUTO-PLAY (opsyonal — alisin ang // para gumana)
    // =========================

    // let autoPlay = setInterval(() => showSlide(current + 1), 5000);
    //
    // // I-pause ang auto-play kapag nag-hover o nag-touch
    // const carouselWrap = document.querySelector('.team-carousel-wrap');
    // if (carouselWrap) {
    //     carouselWrap.addEventListener('mouseenter', () => clearInterval(autoPlay));
    //     carouselWrap.addEventListener('mouseleave', () => {
    //         autoPlay = setInterval(() => showSlide(current + 1), 5000);
    //     });
    // }

});


// =========================
// ACTIVE NAV LINK (para sa scroll position)
// =========================

document.addEventListener('DOMContentLoaded', () => {

    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('section[id]');

    if (!navLinks.length || !sections.length) return;

    function getOffset() {
        if (window.innerWidth <= 700) return 80;
        if (window.innerWidth <= 1000) return 100;
        return 120;
    }

    function updateActiveLink() {
        let currentSection = '';
        const offset = getOffset();

        sections.forEach(section => {
            const sectionTop = section.offsetTop - offset;
            if (window.scrollY >= sectionTop) {
                currentSection = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            if (href === '#' + currentSection) {
                link.classList.add('active');
            }
        });
    }

    window.addEventListener('scroll', updateActiveLink, { passive: true });
    window.addEventListener('load', updateActiveLink);
    window.addEventListener('resize', updateActiveLink);

    // Smooth scroll na may active state
    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });

                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    });

});


// =========================
// MOBILE NAV — i-hide ang ilang links sa maliit na screen
// =========================

document.addEventListener('DOMContentLoaded', () => {

    function handleMobileNav() {
        const navLinks = document.querySelectorAll('.nav-links a');
        const width = window.innerWidth;

        navLinks.forEach((link, index) => {
            // Sa <=430px, itago ang ika-5 at ika-6 na link
            if (width <= 430) {
                if (index === 4 || index === 5) {
                    link.style.display = 'none';
                } else {
                    link.style.display = '';
                }
            } else {
                link.style.display = '';
            }
        });
    }

    handleMobileNav();
    window.addEventListener('resize', handleMobileNav);

});

// =========================
// GALLERY FILTER (Captured Moments)
// =========================

document.addEventListener('DOMContentLoaded', () => {

    const tags = document.querySelectorAll('.tag[data-filter]');
    const moments = document.querySelectorAll('.moment[data-category]');

    if (!tags.length || !moments.length) return;

    tags.forEach(tag => {
        tag.addEventListener('click', () => {

            // Alisin ang active sa lahat ng tag
            tags.forEach(t => t.classList.remove('active'));
            // Gawing active ang clinick
            tag.classList.add('active');

            const filter = tag.dataset.filter;

            // I-filter ang mga moments
            moments.forEach(moment => {
                const category = moment.dataset.category;

                if (filter === 'all' || category === filter) {
                    moment.classList.remove('hidden');
                    moment.classList.remove('fade-in');
                    // Force reflow para umulit ang animation
                    void moment.offsetWidth;
                    moment.classList.add('fade-in');
                } else {
                    moment.classList.add('hidden');
                    moment.classList.remove('fade-in');
                }
            });

        });
    });

});