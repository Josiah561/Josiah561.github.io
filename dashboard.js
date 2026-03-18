/**
 * dashboard.js
 *
 * Controls the main Book Catalog page — the heart of the system.
 * Handles book listing, searching, filtering, and all the modals:
 *   - Add / Edit a book
 *   - View & manage copies
 *   - Borrow a book
 *   - Delete confirmation
 *
 * Staff (librarians/admins) see extra controls: Add Book, Edit, Delete.
 * Students only see Borrow and Copies.
 */


/**
 * Main controller for dashboard.html.
 * Sets up the table, search/filter bar, and all button click handlers.
 */
function initDashboard() {
  const session = Session.require(['student', 'librarian', 'admin']);
  if (!session) return;

  const bm = new BookManager();
  const bcm = new BookCopyManager();
  const um = new UserManager();
  const tm = new TransactionManager();

  // Fill in the user's name, role, and ID across the navbar and sidebar
  $('.user-name').text(session.name);
  $('.user-role').text(session.role.charAt(0).toUpperCase() + session.role.slice(1));
  $('.user-id').text('ID: ' + session.id);

  // Students don't get access to staff-only buttons (Add, Edit, Delete, Reports)
  const isStaff = session.role !== 'student';
  if (!isStaff) $('.staff-only').hide();

  // Load the page — populate dropdowns then render the full book list
  populateFilters(bm);
  renderBooks(bm.getAll());


  // ── Search & Filter ─────────────────────────────────────────
  // Reads all three filter inputs and re-renders the table
  function applyFilters() {
    const q = $('#searchInput').val().trim();
    const author = $('.filter-author').val();
    const cat = $('.filter-category').val();
    renderBooks(bm.search(q, author, cat));
  }

  // Live search as the user types
  $('#searchInput').on('input', applyFilters);

  // Re-filter when a dropdown changes
  $('.filter-author, .filter-category').on('change', applyFilters);

  // Clear all filters and show all books
  $('#clearFilters').on('click', function () {
    $('#searchInput').val('');
    $('.filter-author, .filter-category').val('');
    renderBooks(bm.getAll());
  });


  // ── Add Book (staff only) ───────────────────────────────────
  $(document).on('click', '#addBookBtn', function () {
    showBookModal(null, bm, bcm, function () {
      populateFilters(bm); // refresh dropdowns in case new author/category was added
      applyFilters();
    });
  });


  // ── Table Action Buttons ────────────────────────────────────
  // These are delegated to $(document) because the table rows are rendered dynamically

  // Edit button — opens the book modal pre-filled with existing data
  $(document).on('click', '.update-btn', function () {
    const book = bm.getById($(this).data('id'));
    showBookModal(book, bm, bcm, function () {
      populateFilters(bm);
      applyFilters();
    });
  });

  // Delete button — asks for confirmation before wiping the book and all its copies
  $(document).on('click', '.delete-btn', function () {
    const book = bm.getById($(this).data('id'));
    if (!book) return;
    showConfirm(`Delete "${book.title}" and all its copies?`, () => {
      bcm.deleteByBookId(book.id); // remove copies first
      bm.delete(book.id);          // then remove the book
      notify(`"${book.title}" deleted.`, 'error');
      populateFilters(bm);
      applyFilters();
    });
  });

  // Borrow button — opens the borrow modal for the selected book
  $(document).on('click', '.borrow-btn', function () {
    const book = bm.getById($(this).data('id'));
    if (!book) return;
    showBorrowModal(book, bcm, um, tm, session, applyFilters);
  });

  // Copies button — opens a modal showing all physical copies of this book
  $(document).on('click', '.copies-btn', function () {
    const book = bm.getById($(this).data('id'));
    if (!book) return;
    showCopiesModal(book, bcm, um, isStaff, applyFilters);
  });


  // ── Render Books Table ──────────────────────────────────────
  /**
   * Clears and rebuilds the books table from the given array of books.
   * Each row fades in for a subtle animation effect.
   * Staff rows include Edit and Delete buttons; student rows do not.
   */
  function renderBooks(books) {
    const $tbody = $('#booksTable tbody');
    $tbody.empty();

    if (!books.length) {
      $tbody.append(`<tr><td colspan="6" class="text-center py-4 text-muted">
        ${icon("bookOpen", "xl")} <div class="mt-2">No books found.</div></td></tr>`);
      return;
    }

    books.forEach(book => {
      const total = bcm.getTotalByBookId(book.id);
      const avail = bcm.getAvailableCountByBookId(book.id);
      const canBorrow = avail > 0; // disable the borrow button if no copies are available

      const $tr = $(`
        <tr class="book-row" data-id="${book.id}">
          <td>
            <!-- Colored thumbnail using the book's auto-assigned cover color -->
            <div class="book-thumb" style="background:${book.coverColor}">
              ${book.title.charAt(0)}
            </div>
          </td>
          <td>
            <div class="book-title-text">${book.title}</div>
            <div class="book-sub">${book.isbn || '—'} · ${book.publishedYear || '—'}</div>
          </td>
          <td>${book.author}</td>
          <td><span class="cat-badge">${book.category}</span></td>
          <td>${availBadge(avail, total)}</td>
          <td>
            <div class="action-btns">
              <button class="btn els-btn-sm els-btn-primary borrow-btn ${!canBorrow ? 'disabled' : ''}"
                data-id="${book.id}" ${!canBorrow ? 'disabled' : ''} title="Borrow">
                ${icon("bookMarked", "sm")} Borrow
              </button>
              <button class="btn els-btn-sm els-btn-outline copies-btn" data-id="${book.id}" title="View Copies">
                ${icon("copy", "sm")} Copies
              </button>
              ${isStaff ? `
              <button class="btn els-btn-sm els-btn-warning update-btn" data-id="${book.id}" title="Edit">
                ${icon("pencil", "sm")}
              </button>
              <button class="btn els-btn-sm els-btn-danger delete-btn" data-id="${book.id}" title="Delete">
                ${icon("trash", "sm")}
              </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `);
      $tbody.append($tr.hide().fadeIn(250)); // fade each row in for a smooth load feel
    });
  }
}


// ── Book Add / Edit Modal ─────────────────────────────────────
/**
 * Opens a modal for adding a new book or editing an existing one.
 * Pass `book = null` to open in Add mode; pass an existing book to Edit.
 *
 * When adding, the form also asks for initial copy quantity and condition.
 * When editing, only the book's info fields are shown (copies are managed separately).
 *
 * onSave() is called after a successful save so the caller can refresh the table.
 */
function showBookModal(book, bm, bcm, onSave) {
  const isEdit = !!book;

  openModal('bookModal', `
    <div class="modal fade" id="bookModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content els-modal">
          <div class="modal-header">
            <h5 class="modal-title">${isEdit ? `${icon("pencil", "sm", "me-1")} Edit Book` : `${icon("plus", "sm", "me-1")} Add New Book`}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-8">
                <label class="form-label">Title *</label>
                <input type="text" id="bk_title" class="form-control els-input" value="${isEdit ? book.title : ''}">
              </div>
              <div class="col-4">
                <label class="form-label">Category *</label>
                <!-- datalist gives suggestions but still allows free typing -->
                <input type="text" id="bk_cat" class="form-control els-input" value="${isEdit ? book.category : ''}" list="categoryList">
                <datalist id="categoryList">
                  <option>Fantasy</option><option>Romance</option><option>Historical</option>
                  <option>Science</option><option>Technology</option><option>Self-Help</option>
                  <option>Biography</option><option>Fiction</option><option>Non-Fiction</option>
                </datalist>
              </div>
              <div class="col-6">
                <label class="form-label">Author *</label>
                <input type="text" id="bk_author" class="form-control els-input" value="${isEdit ? book.author : ''}">
              </div>
              <div class="col-3">
                <label class="form-label">ISBN</label>
                <input type="text" id="bk_isbn" class="form-control els-input" value="${isEdit ? book.isbn : ''}">
              </div>
              <div class="col-3">
                <label class="form-label">Year Published</label>
                <input type="text" id="bk_year" class="form-control els-input" value="${isEdit ? book.publishedYear : ''}">
              </div>
              <div class="col-12">
                <label class="form-label">Description</label>
                <textarea id="bk_desc" class="form-control els-input" rows="2">${isEdit ? book.description : ''}</textarea>
              </div>
              ${!isEdit ? `
              <!-- These fields only appear when adding a new book -->
              <div class="col-6">
                <label class="form-label">Initial Copies *</label>
                <input type="number" id="bk_qty" class="form-control els-input" value="1" min="1" max="50">
              </div>
              <div class="col-6">
                <label class="form-label">Condition</label>
                <select id="bk_condition" class="form-select els-input">
                  <option>Good</option><option>Fair</option><option>Poor</option>
                </select>
              </div>
              ` : ''}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn els-btn-outline" data-bs-dismiss="modal">Cancel</button>
            <button class="btn els-btn-primary" id="bk_save">${isEdit ? 'Save Changes' : 'Add Book'}</button>
          </div>
        </div>
      </div>
    </div>
  `, (modal) => {
    $('#bk_save').on('click', function () {
      const title = $('#bk_title').val().trim();
      const author = $('#bk_author').val().trim();
      const cat = $('#bk_cat').val().trim();

      if (!title || !author || !cat) {
        notify('Title, Author and Category are required.', 'error');
        return;
      }

      if (isEdit) {
        // Re-fetch the book from storage to avoid overwriting other fields
        const fresh = bm.getById(book.id);
        fresh.title = title;
        fresh.author = author;
        fresh.category = cat;
        fresh.isbn = $('#bk_isbn').val().trim();
        fresh.publishedYear = $('#bk_year').val().trim();
        fresh.description = $('#bk_desc').val().trim();
        bm.update(fresh);
        notify('Book updated!');
      } else {
        // Add the book first, then attach copies to it
        const qty = parseInt($('#bk_qty').val()) || 1;
        const condition = $('#bk_condition').val();
        const newBook = bm.add({
          title, author, category: cat,
          isbn: $('#bk_isbn').val().trim(),
          publishedYear: $('#bk_year').val().trim(),
          description: $('#bk_desc').val().trim()
        });
        bcm.addCopies(newBook.id, qty, condition);
        notify(`Book added with ${qty} cop${qty > 1 ? 'ies' : 'y'}!`);
      }

      modal.hide();
      if (onSave) onSave();
    });
  });
}


// ── Copies Modal ──────────────────────────────────────────────
/**
 * Shows all physical copies of a book in a table.
 * Staff can add more copies or delete individual available ones.
 * Students see the list as read-only.
 *
 * Deletion requires confirmation (via showConfirm) before removing a copy.
 */
function showCopiesModal(book, bcm, um, isStaff, onClose) {
  openModal('copiesModal', `
    <div class="modal fade" id="copiesModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content els-modal">
          <div class="modal-header">
            <h5 class="modal-title">${icon("copy", "sm")} Copies — ${book.title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            ${isStaff ? `
            <!-- Staff-only: add more copies to this book -->
            <div class="d-flex gap-2 mb-3">
              <input type="number" id="addQty" class="form-control els-input" value="1" min="1" max="20" style="width:100px">
              <select id="addCondition" class="form-select els-input" style="width:130px">
                <option>Good</option><option>Fair</option><option>Poor</option>
              </select>
              <button class="btn els-btn-primary" id="addCopiesBtn">${icon("plus", "sm")} Add Copies</button>
            </div>` : ''}
            <div id="copiesTableWrap"></div>
          </div>
          <div class="modal-footer">
            <button class="btn els-btn-outline" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  `, (modal) => {

    // Renders (or re-renders) the copies table inside the modal
    function renderCopies() {
      const copies = bcm.getByBookId(book.id);
      if (!copies.length) {
        $('#copiesTableWrap').html('<p class="text-muted text-center py-3">No copies found.</p>');
        return;
      }
      const rows = copies.map(c => {
        const borrower = c.borrowedBy ? um.getById(c.borrowedBy) : null;
        const overdue = isOverdue(c.dueDate) && c.status === 'Borrowed';
        return `
          <tr>
            <td>Copy #${c.copyNumber}</td>
            <td><span class="cond-badge cond-${c.condition.toLowerCase()}">${c.condition}</span></td>
            <td>${c.status === 'Borrowed'
            ? `<span class="els-badge badge-none">Borrowed</span>`
            : `<span class="els-badge badge-avail">Available</span>`}
            </td>
            <td>${borrower ? borrower.name : '—'}</td>
            <td>${fmtDate(c.dueDate)} ${overdue ? '<span class="badge bg-danger">Overdue</span>' : ''}</td>
            <!-- Only available copies can be deleted — can't delete a copy that's out -->
            <td>${isStaff && c.status === 'Available' ? `
              <button class="btn els-btn-sm els-btn-danger del-copy-btn" data-id="${c.id}">
                ${icon("trash", "sm")}
              </button>
            ` : '—'}</td>
          </tr>`;
      }).join('');

      $('#copiesTableWrap').html(`
        <table class="table els-table">
          <thead>
            <tr><th>Copy</th><th>Condition</th><th>Status</th><th>Borrower</th><th>Due Date</th><th></th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`);
    }

    renderCopies(); // initial render when modal opens

    if (isStaff) {

      // Add copies button — creates new copies and refreshes the table
      $('#addCopiesBtn').on('click', function () {
        const qty = parseInt($('#addQty').val()) || 1;
        const cond = $('#addCondition').val();
        bcm.addCopies(book.id, qty, cond);
        notify(`${qty} cop${qty > 1 ? 'ies' : 'y'} added!`);
        renderCopies();
        if (onClose) onClose(); // refresh the main table availability badge
      });

      // Delete copy button — confirms which copy before removing it
      $(document).on('click', '.del-copy-btn', function () {
        const copyId = $(this).data('id');
        const copy = bcm.getById(copyId);
        if (!copy) return;
        showConfirm(`Delete Copy #${copy.copyNumber} (${copy.condition})?`, () => {
          bcm.delete(copyId);
          notify(`Copy #${copy.copyNumber} removed.`, 'warning');
          renderCopies();
          if (onClose) onClose();
        });
      });
    }
  });
}


// ── Borrow Modal ──────────────────────────────────────────────
/**
 * Opens the borrow confirmation modal for a specific book.
 * Shows available copies in a dropdown and displays the auto-calculated due date.
 *
 * On confirm:
 *   1. Marks the copy as Borrowed in BookCopyManager
 *   2. Adds the copy ID to the user's borrowedCopies list
 *   3. Logs a 'borrow' transaction
 *
 * onDone() is called after a successful borrow to refresh the table.
 */
function showBorrowModal(book, bcm, um, tm, session, onDone) {
  const copies = bcm.getAvailableByBookId(book.id);
  if (!copies.length) { notify('No available copies.', 'error'); return; }

  // Build the copy selection dropdown options
  const copyOptions = copies.map(c =>
    `<option value="${c.id}">Copy #${c.copyNumber} — ${c.condition}</option>`
  ).join('');

  // Pre-calculate the due date to show the user before they confirm
  const due = new Date();
  due.setDate(due.getDate() + 14);

  openModal('borrowModal', `
    <div class="modal fade" id="borrowModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content els-modal">
          <div class="modal-header">
            <h5 class="modal-title">${icon("bookMarked", "sm")} Borrow Book</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <!-- Visual book card using the book's cover color -->
            <div class="borrow-book-card mb-3" style="background:${book.coverColor}">
              <div class="borrow-book-initial">${book.title.charAt(0)}</div>
              <div>
                <div class="fw-bold">${book.title}</div>
                <div style="opacity:.8;font-size:.85rem">${book.author} · ${book.category}</div>
              </div>
            </div>
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label">Select Copy *</label>
                <select id="borrow_copy" class="form-select els-input">${copyOptions}</select>
              </div>
              <div class="col-12">
                <label class="form-label">Due Date</label>
                <!-- Read-only — always 14 days from today -->
                <input type="text" class="form-control els-input" value="${fmtDate(due.toISOString())}" readonly>
                <div class="form-text">Loan period: 14 days</div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn els-btn-outline" data-bs-dismiss="modal">Cancel</button>
            <button class="btn els-btn-primary" id="confirm_borrow">Confirm Borrow</button>
          </div>
        </div>
      </div>
    </div>
  `, (modal) => {
    $('#confirm_borrow').on('click', function () {
      const copyId = $('#borrow_copy').val();
      const copy = bcm.borrow(copyId, session.id); // marks copy as Borrowed in storage

      // Edge case: someone else borrowed this copy between modal open and confirm
      if (!copy) { notify('This copy is no longer available.', 'error'); return; }

      // Update the user's borrowed list and log the transaction
      um.addBorrowedCopy(session.id, copyId);
      tm.recordBorrow({
        userId: session.id, userName: session.name,
        bookId: book.id, bookTitle: book.title,
        copyId: copy.id, copyNumber: copy.copyNumber
      });

      notify(`"${book.title}" (Copy #${copy.copyNumber}) borrowed! Due: ${fmtDate(copy.dueDate)}`);
      modal.hide();
      if (onDone) onDone();
    });
  });
}


// ── Confirm Dialog ────────────────────────────────────────────
/**
 * A reusable "Are you sure?" dialog.
 * Accepts a custom message and a callback to run if the user confirms.
 * Used for deletions and other destructive actions.
 */
function showConfirm(message, onConfirm) {
  openModal('confirmModal', `
    <div class="modal fade" id="confirmModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content els-modal">
          <div class="modal-body text-center py-4">
            <div class="confirm-icon">${icon("alertTriangle", "xl")}</div>
            <p class="mt-2 mb-0">${message}</p>
          </div>
          <div class="modal-footer justify-content-center">
            <button class="btn els-btn-outline" data-bs-dismiss="modal">Cancel</button>
            <button class="btn els-btn-danger" id="confirmYes">Yes, Delete</button>
          </div>
        </div>
      </div>
    </div>
  `, (modal) => {
    $('#confirmYes').on('click', function () {
      modal.hide();
      if (onConfirm) onConfirm();
    });
  });
}
