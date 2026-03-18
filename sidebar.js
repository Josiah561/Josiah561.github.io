/**
 * sidebar.js
 *
 * Handles the responsive sidebar drawer behaviour for all protected pages
 * (dashboard, profile, reports). Uses jQuery and an OOP class pattern.
 *
 * Responsibilities:
 *   - Toggle the sidebar open/closed when the hamburger button is clicked
 *   - Close the sidebar when the overlay is clicked
 *   - Close the sidebar when a nav link inside it is clicked (mobile UX)
 *   - Close the sidebar on Escape key
 */

class SidebarController {

  /**
   * @param {string} toggleSelector  - jQuery selector for the hamburger button
   * @param {string} sidebarSelector - jQuery selector for the aside.sidebar
   * @param {string} overlaySelector - jQuery selector for the overlay div
   */
  constructor(toggleSelector, sidebarSelector, overlaySelector) {
    this.$toggle  = $(toggleSelector);
    this.$sidebar = $(sidebarSelector);
    this.$overlay = $(overlaySelector);

    // Only initialise if all elements exist on this page
    if (!this.$toggle.length || !this.$sidebar.length || !this.$overlay.length) return;

    this._bindEvents();
  }

  // ── Private ────────────────────────────────────────────────

  _bindEvents() {
    // Hamburger button click -> toggle drawer
    this.$toggle.on('click', () => this.toggle());

    // Overlay click -> close drawer
    this.$overlay.on('click', () => this.close());

    // Clicking a sidebar nav link closes the drawer on mobile
    this.$sidebar.find('.sidebar-nav a').on('click', () => this.close());

    // Escape key closes the drawer
    $(document).on('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  // ── Public ─────────────────────────────────────────────────

  open() {
    this.$sidebar.addClass('open');
    this.$overlay.addClass('open');
    this.$toggle.attr('aria-expanded', 'true');
  }

  close() {
    this.$sidebar.removeClass('open');
    this.$overlay.removeClass('open');
    this.$toggle.attr('aria-expanded', 'false');
  }

  toggle() {
    if (this.$sidebar.hasClass('open')) {
      this.close();
    } else {
      this.open();
    }
  }
}


// ── Boot ──────────────────────────────────────────────────────
// Runs on every protected page after jQuery and the DOM are ready.
$(document).ready(function () {
  new SidebarController('#sidebarToggle', '.sidebar', '#sidebarOverlay');
});