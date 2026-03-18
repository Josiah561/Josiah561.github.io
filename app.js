/**
 * app.js
 *
 * The entry point and page router for the whole application.
 * This file runs on every page. It figures out which page we're on,
 * guards protected pages behind a login check, then hands control
 * off to the right controller.
 *
 * Script load order — this must always be loaded LAST in the HTML:
 *   icons.js → storage.js → models.js → userManager.js → bookManager.js
 *   → transactionManager.js → utils.js → login.js → dashboard.js
 *   → profile.js → reports.js → app.js  ← you are here
 */

$(document).ready(function () {

  // Grab just the filename from the URL, lowercase, no query strings or hashes
  const raw = window.location.pathname.split('/').pop() || 'login.html';
  const page = raw.toLowerCase().split('?')[0].split('#')[0];

  // Render all Lucide SVG icons into their placeholder elements on this page
  injectPageIcons();

  // These pages require a logged-in user — redirect to login if there's no session
  const protectedPages = ['dashboard.html', 'profile.html', 'reports.html'];
  if (protectedPages.includes(page)) {
    if (!Session.get()) {
      window.location.href = 'login.html';
      return; // stop here — no point initializing anything without a session
    }
    populateNavUser(); // fill in the name/role shown in the navbar and sidebar
  }

  // Route to the correct page controller
  if (page === 'student_login.html') initLoginPage('student');
  else if (page === 'librarian_login.html') initLoginPage('librarian');
  else if (page === 'admin_login.html') initLoginPage('admin');
  else if (page === 'login.html' || page === '') initRoleSelectPage();
  else if (page === 'dashboard.html') initDashboard();
  else if (page === 'profile.html') initProfilePage();
  else if (page === 'reports.html') initReportsPage();

});
