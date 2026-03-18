/**
 * utils.js
 *
 * Shared helpers used across every page.
 * Nothing here is page-specific — if you need it everywhere, it lives here.
 *
 * What's inside:
 *   Session       — login state management
 *   notify()      — toast pop-up messages
 *   showError()   — inline form validation feedback
 *   openModal()   — Bootstrap modal launcher with auto-cleanup
 *   fmtDate()     — date formatting helpers
 *   isOverdue()   — checks if a due date has passed
 *   availBadge()  — renders an availability badge for the books table
 *   populateFilters()  — fills the author/category dropdowns
 *   populateNavUser()  — fills the navbar/sidebar with the logged-in user's info
 *   injectPageIcons()  — drops Lucide SVG icons into their placeholder elements
 */


// ── Session ───────────────────────────────────────────────────
// Wraps the current user in storage so any page can check who's logged in.
const Session = {
  set(user) { StorageService.set('els_session', user); },
  get() { return StorageService.get('els_session'); },
  clear() { StorageService.remove('els_session'); },

  /**
   * Use this on protected pages. Checks if there's a session and if the
   * user's role is allowed. Redirects to login if either check fails.
   * Returns the user object if all good, null otherwise.
   */
  require(allowedRoles = []) {
    const u = this.get();
    if (!u) { window.location.href = 'login.html'; return null; }
    if (allowedRoles.length && !allowedRoles.includes(u.role)) {
      window.location.href = 'login.html'; return null;
    }
    return u;
  }
};


// ── Toast Notifications ───────────────────────────────────────
/**
 * Shows a small pop-up message at the bottom-right of the screen.
 * Disappears automatically after 3 seconds.
 *
 * type: 'success' | 'error' | 'warning' | 'info'
 *
 * Note: iconMap is declared before iconHtml to avoid a Temporal Dead Zone
 * issue — never use `const icon = ...` here since `icon` is a global function.
 */
function notify(msg, type = 'success') {
  const colors = { success: '#198754', error: '#c9184a', warning: '#e9c46a', info: '#1d3557' };
  const iconMap = { success: icon('checkCircle', 'sm'), error: icon('xCircle', 'sm'), warning: icon('alertTriangle', 'sm'), info: icon('info', 'sm') };
  const color = colors[type] || colors.success;
  const iconHtml = iconMap[type] || iconMap.success;

  const $toast = $(`
    <div class="els-toast" style="
      position:fixed;bottom:24px;right:24px;z-index:99999;
      background:${color};color:#fff;
      padding:12px 18px 12px 14px;border-radius:10px;
      font-size:13px;font-family:'DM Sans',sans-serif;font-weight:500;
      box-shadow:0 8px 24px rgba(0,0,0,.25);
      display:flex;align-items:center;gap:10px;
      max-width:320px;opacity:0;transform:translateY(10px);
      transition:all .25s ease;
    ">
      <span style="font-size:16px;flex-shrink:0">${iconHtml}</span>
      <span>${msg}</span>
    </div>
  `).appendTo('body');

  // Trigger the fade-in on the next paint cycle
  requestAnimationFrame(() => {
    $toast.css({ opacity: 1, transform: 'translateY(0)' });
  });

  // Fade out after 3 seconds, then remove from DOM
  setTimeout(() => {
    $toast.css({ opacity: 0, transform: 'translateY(10px)' });
    setTimeout(() => $toast.remove(), 300);
  }, 3000);
}


// ── Form Validation ───────────────────────────────────────────

// Marks a field as invalid and shows a message below it
function showError($el, msg) {
  $el.addClass('is-invalid');
  let $fb = $el.next('.invalid-feedback');
  if (!$fb.length) $fb = $('<div class="invalid-feedback"></div>').insertAfter($el);
  $fb.text(msg);
}

// Clears all validation errors inside a container (e.g. a modal or card)
function clearErrors($container) {
  $container.find('.is-invalid').removeClass('is-invalid');
  $container.find('.invalid-feedback').remove();
}

// Loops through a set of fields and flags any that are empty. Returns false if any fail.
function validateRequired($fields) {
  let valid = true;
  $fields.each(function () {
    if (!$(this).val().trim()) {
      showError($(this), 'This field is required.');
      valid = false;
    }
  });
  return valid;
}


// ── Modal Helper ──────────────────────────────────────────────
/**
 * Opens a Bootstrap modal from an HTML string.
 * Removes any existing modal with the same ID first to avoid duplicates.
 * Automatically cleans up the DOM and backdrop when the modal closes.
 *
 * onReady(modal, $modal) is called once the modal is visible — put your
 * event listeners and setup logic in there.
 */
function openModal(id, htmlContent, onReady) {
  $(`#${id}`).remove(); // remove stale instance if it exists
  const $modal = $(htmlContent).appendTo('body');
  const modal = new bootstrap.Modal($modal[0], { backdrop: 'static' });
  modal.show();

  // Clean up after the modal fully closes
  $modal[0].addEventListener('hidden.bs.modal', () => {
    modal.dispose();
    $modal.remove();
    $('.modal-backdrop').remove();
    $('body').removeClass('modal-open').css('padding-right', '');
  });

  if (onReady) onReady(modal, $modal);
  return { modal, $modal };
}


// ── Date Formatters ───────────────────────────────────────────

// Formats an ISO date string to a readable date (e.g. "Jan 15, 2025")
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Formats an ISO date string to date + time (e.g. "Jan 15, 2025, 02:30 PM")
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Returns true if the due date has already passed
function isOverdue(dueDateIso) {
  if (!dueDateIso) return false;
  return new Date(dueDateIso) < new Date();
}


// ── Availability Badge ────────────────────────────────────────
// Returns an HTML badge showing how many copies are available (e.g. "2/4 Available")
function availBadge(available, total) {
  const cls = available > 0 ? 'badge-avail' : 'badge-none';
  return `<span class="els-badge ${cls}">${available}/${total} Available</span>`;
}


// ── Filter Dropdowns ──────────────────────────────────────────
/**
 * Repopulates the Author and Category dropdowns from live book data.
 * Preserves the currently selected value so filters don't reset mid-search.
 */
function populateFilters(bm) {
  const $author = $('.filter-author');
  const $cat = $('.filter-category');
  const curAuthor = $author.val();
  const curCat = $cat.val();

  $author.find('option:not(:first)').remove();
  bm.getAuthors().forEach(a => $author.append(`<option ${a === curAuthor ? 'selected' : ''}>${a}</option>`));

  $cat.find('option:not(:first)').remove();
  bm.getCategories().forEach(c => $cat.append(`<option ${c === curCat ? 'selected' : ''}>${c}</option>`));
}


// ── Nav / Sidebar User Info ───────────────────────────────────
/**
 * Fills in the logged-in user's name, role, and ID across the navbar and sidebar.
 * Also hides staff-only UI elements for students.
 * Also wires up the logout button (shared across all protected pages).
 *
 * Call this once per protected page load (app.js handles this).
 */
function populateNavUser() {
  const session = Session.get();
  if (!session) return;

  $('.user-name').text(session.name);
  $('.user-role').text(session.role.charAt(0).toUpperCase() + session.role.slice(1));
  $('.user-id').text('ID: ' + session.id);

  // Students shouldn't see Add Book, Delete, Reports, etc.
  if (session.role === 'student') {
    $('.staff-only').hide();
  }

  // Wire up the logout button — same behavior on every page
  $(document).on('click', '#logoutBtn', function () {
    Session.clear();
    notify('Logged out successfully.');
    setTimeout(() => { window.location.href = 'login.html'; }, 800);
  });
}


// ── Icon Injection ────────────────────────────────────────────
/**
 * Drops Lucide SVG icons into their placeholder elements.
 * Each HTML page has empty <span> or <div> elements with specific IDs —
 * this function fills them all in one shot.
 *
 * Called once by app.js on every page load.
 */
function injectPageIcons() {

  // Navbar brand logo
  $('#nav-brand-icon').html(icon('library', 'lg'));

  // Sidebar
  $('#sidebar-avatar-icon').html(icon('user', 'xl'));
  $('#nav-books-icon').html(icon('book', 'sm'));
  $('#nav-profile-icon').html(icon('user', 'sm'));
  $('#nav-reports-icon').html(icon('barChart', 'sm'));

  // Login page role selection icons
  $('#ri-student').html(icon('graduationCap', 'md'));
  $('#ri-librarian').html(icon('book', 'md'));
  $('#ri-admin').html(icon('shield', 'md'));

  // Dashboard search bar
  $('#search-icon-el').html(icon('search', 'sm'));
  $('#clear-icon-el').html(icon('x', 'sm'));
  $('#add-icon-el').html(icon('plus', 'sm'));

  // Profile page
  $('#profile-avatar-icon').html(icon('user', '2xl'));
  $('#profile-role-icon').html(icon('graduationCap', 'sm'));
  $('#profile-email-icon').html(icon('mail', 'sm'));
  $('#profile-phone-icon').html(icon('phone', 'sm'));
  $('#profile-map-icon').html(icon('mapPin', 'sm'));
  $('#edit-profile-icon').html(icon('pencil', 'sm'));
  $('#del-profile-icon').html(icon('trash', 'sm'));
  $('#borrow-section-icon').html(icon('bookOpen', 'sm'));
  $('#history-section-icon').html(icon('clock', 'sm'));

  // Reports page
  $('#trophy-icon').html(icon('trophy', 'sm'));
  $('#activity-icon').html(icon('activity', 'sm'));
  $('#clipboard-icon').html(icon('clipboardList', 'sm'));
}
