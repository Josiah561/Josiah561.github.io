/**
 * profile.js
 *
 * Controls the Profile page — shows the logged-in user's personal info,
 * their currently borrowed books, and their full borrowing history.
 *
 * From here a user can:
 *   - Edit their own name, email, contact, address, and password
 *   - Return a book they currently have borrowed
 *   - Delete their own account (with confirmation)
 */


function initProfilePage() {
  const session = Session.require(['student', 'librarian', 'admin']);
  if (!session) return;

  const um  = new UserManager();
  const bm  = new BookManager();
  const bcm = new BookCopyManager();
  const tm  = new TransactionManager();

  renderProfile(); // draw everything on page load


  // ── Full Profile Render ─────────────────────────────────────
  /**
   * Pulls fresh user data from storage and updates every element on the page.
   * Called on load and again after any change (edit, return) to stay in sync.
   */
  function renderProfile() {
    const user = um.getById(session.id);
    if (!user) return;

    // Fill in the hero card info
    $('.profile-name').text(user.name);
    $('.profile-role').text(user.role.charAt(0).toUpperCase() + user.role.slice(1));
    $('.profile-id').text(user.id);
    $('.profile-email').text(user.email    || '—');
    $('.profile-contact').text(user.contact || '—');
    $('.profile-address').text(user.address || '—');
    $('.profile-since').text('Member since ' + fmtDate(user.createdAt));

    renderActiveBorrows(user);
    renderBorrowHistory(user);
  }


  // ── Active Borrows Table ────────────────────────────────────
  /**
   * Shows all copies the user currently has checked out.
   * Flags overdue items with a red badge.
   * Each row has a Return button.
   */
  function renderActiveBorrows(user) {
    const $tbody = $('#activeBorrowsTable tbody');
    $tbody.empty();

    // Get the actual copy objects (filter out any stale IDs where the copy no longer exists)
    const borrowedCopies = (user.borrowedCopies || [])
      .map(cid => bcm.getById(cid))
      .filter(c => c && c.status === 'Borrowed');

    if (!borrowedCopies.length) {
      $tbody.append(`<tr><td colspan="5" class="text-center py-3 text-muted">No active borrows.</td></tr>`);
      $('#activeBorrowCount').text('0');
      return;
    }

    $('#activeBorrowCount').text(borrowedCopies.length);

    borrowedCopies.forEach(copy => {
      const book    = bm.getById(copy.bookId);
      const overdue = isOverdue(copy.dueDate);

      $tbody.append(`
        <tr>
          <td>
            <span class="book-chip" style="background:${book ? book.coverColor : '#999'}">
              ${book ? book.title.charAt(0) : '?'}
            </span>
            ${book ? book.title : 'Unknown'}
          </td>
          <td>Copy #${copy.copyNumber}</td>
          <td>${fmtDate(copy.borrowedAt)}</td>
          <td>
            ${fmtDate(copy.dueDate)}
            ${overdue ? '<span class="badge bg-danger ms-1">Overdue</span>' : ''}
          </td>
          <td>
            <button class="btn els-btn-sm els-btn-warning return-btn"
              data-copy-id="${copy.id}" data-book-id="${copy.bookId}">
              ${icon("returnBook","sm")} Return
            </button>
          </td>
        </tr>
      `);
    });
  }


  // ── Borrow History Table ────────────────────────────────────
  /**
   * Shows every borrow and return transaction for this user, newest first.
   * This is a read-only log — no actions available here.
   */
  function renderBorrowHistory(user) {
    const $tbody = $('#historyTable tbody');
    $tbody.empty();

    // Reverse to show most recent transactions at the top
    const history = tm.getByUser(user.id).reverse();

    if (!history.length) {
      $tbody.append(`<tr><td colspan="5" class="text-center py-3 text-muted">No history yet.</td></tr>`);
      return;
    }

    history.forEach(tx => {
      const typeBadge = tx.type === 'borrow'
        ? '<span class="els-badge badge-borrow">Borrowed</span>'
        : '<span class="els-badge badge-return">Returned</span>';

      $tbody.append(`
        <tr>
          <td>${tx.bookTitle}</td>
          <td>Copy #${tx.copyNumber}</td>
          <td>${typeBadge}</td>
          <td>${fmtDateTime(tx.date)}</td>
          <td>${tx.type === 'borrow' ? fmtDate(tx.dueDate) : fmtDate(tx.returnDate)}</td>
        </tr>
      `);
    });
  }


  // ── Return a Book ───────────────────────────────────────────
  /**
   * Handles the Return button in the active borrows table.
   * Updates the copy status, removes it from the user's list,
   * and logs a 'return' transaction — then re-renders everything.
   */
  $(document).on('click', '.return-btn', function () {
    const copyId = $(this).data('copy-id');
    const bookId = $(this).data('book-id');
    const book   = bm.getById(bookId);
    const copy   = bcm.getById(copyId);
    if (!copy) return;

    // Mark the copy as available again
    bcm.returnCopy(copyId);

    // Remove from the user's borrowed list
    um.removeBorrowedCopy(session.id, copyId);

    // Update the session so the navbar/sidebar stay current
    const user = um.getById(session.id);
    Session.set(user);

    // Log the return in the transaction history
    tm.recordReturn({
      userId: session.id, userName: session.name,
      bookId, bookTitle: book ? book.title : 'Unknown',
      copyId, copyNumber: copy.copyNumber
    });

    notify(`"${book ? book.title : 'Book'}" returned successfully!`);
    renderProfile(); // refresh both tables
  });


  // ── Edit Profile ────────────────────────────────────────────
  /**
   * Opens a modal to edit the user's name, email, contact, address, and password.
   * Password field is optional — leave blank to keep the current one.
   */
  $(document).on('click', '#editProfileBtn', function () {
    const user = um.getById(session.id);

    openModal('editProfileModal', `
      <div class="modal fade" id="editProfileModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content els-modal">
            <div class="modal-header">
              <h5 class="modal-title">${icon("pencil","xs","me-1")} Edit Profile</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-12">
                  <label class="form-label">Full Name *</label>
                  <input type="text" id="ep_name" class="form-control els-input" value="${user.name}">
                </div>
                <div class="col-12">
                  <label class="form-label">Email</label>
                  <input type="email" id="ep_email" class="form-control els-input" value="${user.email || ''}">
                </div>
                <div class="col-6">
                  <label class="form-label">Contact No.</label>
                  <input type="text" id="ep_contact" class="form-control els-input" value="${user.contact || ''}">
                </div>
                <div class="col-6">
                  <label class="form-label">Address</label>
                  <input type="text" id="ep_address" class="form-control els-input" value="${user.address || ''}">
                </div>
                <div class="col-12">
                  <label class="form-label">New Password <small class="text-muted">(leave blank to keep current)</small></label>
                  <input type="password" id="ep_pass" class="form-control els-input" placeholder="Min 6 characters">
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn els-btn-outline" data-bs-dismiss="modal">Cancel</button>
              <button class="btn els-btn-primary" id="ep_save">Save Changes</button>
            </div>
          </div>
        </div>
      </div>
    `, (modal) => {
      $('#ep_save').on('click', function () {
        const name = $('#ep_name').val().trim();
        if (!name) { notify('Name is required.', 'error'); return; }

        const pass = $('#ep_pass').val().trim();
        if (pass && pass.length < 6) { notify('Password must be at least 6 characters.', 'error'); return; }

        // Apply changes to the user object
        user.name    = name;
        user.email   = $('#ep_email').val().trim();
        user.contact = $('#ep_contact').val().trim();
        user.address = $('#ep_address').val().trim();
        if (pass) user.password = pass; // only update password if a new one was entered

        um.update(user);
        Session.set(user); // keep session in sync with the updated name
        notify('Profile updated!');
        modal.hide();
        renderProfile();
      });
    });
  });


  // ── Delete Profile ──────────────────────────────────────────
  /**
   * Permanently deletes the user's account after confirmation.
   * Clears the session and sends them back to the login page.
   */
  $(document).on('click', '#deleteProfileBtn', function () {
    openModal('delProfileModal', `
      <div class="modal fade" id="delProfileModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content els-modal">
            <div class="modal-body text-center py-4">
              ${icon("alertTriangle","xl")}
              <p class="mt-2 mb-1 fw-bold">Delete your profile?</p>
              <p class="text-muted small">This cannot be undone.</p>
            </div>
            <div class="modal-footer justify-content-center">
              <button class="btn els-btn-outline" data-bs-dismiss="modal">Cancel</button>
              <button class="btn els-btn-danger" id="confirmDeleteProfile">Yes, Delete</button>
            </div>
          </div>
        </div>
      </div>
    `, (modal) => {
      $('#confirmDeleteProfile').on('click', function () {
        um.delete(session.id);
        Session.clear();
        notify('Profile deleted.', 'error');
        setTimeout(() => { window.location.href = 'login.html'; }, 900);
      });
    });
  });
}
