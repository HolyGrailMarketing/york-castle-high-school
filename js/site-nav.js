/**
 * Site navigation behaviour: the mobile menu toggle and its backdrop.
 *
 * This was inlined in all 13 pages using the shared header, in three different
 * variants - six of them dimmed the page behind the open menu and the rest,
 * including index, did not. The richer version wins here, so every page now gets
 * tap-outside-to-close.
 *
 * The dropdowns open on hover and focus in CSS, so with JavaScript off the menu
 * still works with a pointer; only the small-screen toggle needs this file.
 */
document.addEventListener('DOMContentLoaded', function () {
  const menuToggle = document.querySelector('.mobile-menu-toggle');
  const navMenu = document.querySelector('.nav-menu');
  // Optional - guarded everywhere below, so a page without it still works.
  const backdrop = document.getElementById('nav-backdrop');
  const dropdowns = document.querySelectorAll('.nav-dropdown');
  function openNav() { menuToggle.setAttribute('aria-expanded', 'true'); navMenu.setAttribute('aria-expanded', 'true'); if (backdrop) backdrop.classList.add('open'); }
  function closeNav() { menuToggle.setAttribute('aria-expanded', 'false'); navMenu.setAttribute('aria-expanded', 'false'); if (backdrop) backdrop.classList.remove('open'); }
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', function () { menuToggle.getAttribute('aria-expanded') === 'true' ? closeNav() : openNav(); });
    if (backdrop) backdrop.addEventListener('click', closeNav);
  }
  dropdowns.forEach(function (dropdown) {
    const btn = dropdown.querySelector('.dropdown-btn');
    if (btn) {
      btn.addEventListener('click', function (ev) {
        if (window.innerWidth <= 991) {
          ev.preventDefault();
          const isExpanded = dropdown.getAttribute('aria-expanded') === 'true';
          dropdown.setAttribute('aria-expanded', !isExpanded);
        }
      });
    }
  });
});
