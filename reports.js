/**
 * reports.js
 *
 * Controls the Reports & Analytics page — visible to librarians and admins only.
 *
 * Shows:
 *   - Live stats (total borrows, returns, active borrows, book/copy counts)
 *   - Top 5 most borrowed books
 *   - Recent activity feed (last 8 transactions)
 *   - Full searchable/filterable transaction history table
 *
 * Important: copy counts (active borrows, available, total) are read directly
 * from BookCopyManager — the live source of truth — not from transaction logs.
 * Transaction logs are only used for historical counts (total borrows/returns).
 */


function initReportsPage() {
  const session = Session.require(['librarian', 'admin']);
  if (!session) return;

  const tm  = new TransactionManager();
  const bm  = new BookManager();
  const bcm = new BookCopyManager();
  const um  = new UserManager();

  // Render everything on page load
  renderStats();
  renderRecentActivity();
  renderMostBorrowed();
  renderFullHistory();


  // ── Stats Cards ─────────────────────────────────────────────
  /**
   * Fills in the six stat cards at the top of the page.
   *
   * Total Borrows / Returns → from transaction log (historical count)
   * Active Borrows / Available / Total Copies → from BookCopyManager (real-time state)
   *
   * We deliberately use BookCopyManager for live counts because transaction logs
   * can drift if copies are deleted or data is modified directly.
   */
  function renderStats() {
    const borrows = tm.getBorrowHistory().length;
    const returns = tm.getReturnHistory().length;

    // Read copy states directly — this is the ground truth for what's on the shelf
    const allCopies    = bcm.getAll();
    const totalCopies  = allCopies.length;
    const availCopies  = allCopies.filter(c => c.status === 'Available').length;
    const activeCopies = allCopies.filter(c => c.status === 'Borrowed').length;

    const totalBooks = bm.getAll().length;

    $('#stat_borrows').text(borrows);
    $('#stat_returns').text(returns);
    $('#stat_active').text(activeCopies);
    $('#stat_books').text(totalBooks);
    $('#stat_copies').text(totalCopies);
    $('#stat_avail').text(availCopies);
  }


  // ── Most Borrowed Books ─────────────────────────────────────
  /**
   * Shows the top 5 most borrowed book titles, ranked by borrow count.
   * Uses the transaction log to count how many times each book was borrowed.
   */
  function renderMostBorrowed() {
    const top = tm.getMostBorrowed(5);
    const $el = $('#mostBorrowedList');
    $el.empty();

    if (!top.length) {
      $el.html('<li class="list-group-item text-muted">No data yet.</li>');
      return;
    }

    top.forEach((item, i) => {
      const book = bm.getById(item.bookId);
      $el.append(`
        <li class="list-group-item d-flex align-items-center gap-3">
          <span class="rank-badge">#${i + 1}</span>
          ${book ? `<span class="book-chip-sm" style="background:${book.coverColor}">${book.title.charAt(0)}</span>` : ''}
          <span class="flex-grow-1">${item.title}</span>
          <span class="els-badge badge-avail">${item.count} borrow${item.count > 1 ? 's' : ''}</span>
        </li>
      `);
    });
  }


  // ── Recent Activity Feed ────────────────────────────────────
  /**
   * Shows the 8 most recent borrow/return events across all users.
   * Each item shows who did what, which book, and when.
   */
  function renderRecentActivity() {
    const recent = tm.getRecentActivity(8);
    const $el    = $('#recentActivity');
    $el.empty();

    if (!recent.length) {
      $el.html('<li class="list-group-item text-muted">No activity yet.</li>');
      return;
    }

    recent.forEach(tx => {
      const txIcon = tx.type === 'borrow' ? icon('bookMarked','sm') : icon('returnBook','sm');
      const cls    = tx.type === 'borrow' ? 'badge-borrow' : 'badge-return';

      $el.append(`
        <li class="list-group-item d-flex align-items-center gap-2">
          <span>${txIcon}</span>
          <span class="flex-grow-1">
            <strong>${tx.userName}</strong>
            ${tx.type === 'borrow' ? 'borrowed' : 'returned'}
            <em>${tx.bookTitle}</em> (Copy #${tx.copyNumber})
          </span>
          <span class="els-badge ${cls}" style="font-size:.7rem">${fmtDate(tx.date)}</span>
        </li>
      `);
    });
  }


  // ── Full Transaction History Table ──────────────────────────
  /**
   * Renders every transaction ever recorded, newest first.
   * The search and filter controls below act on this table live (client-side).
   */
  function renderFullHistory() {
    const $tbody = $('#fullHistoryTable tbody');
    const all    = [...tm.getAll()].reverse(); // newest first
    $tbody.empty();

    if (!all.length) {
      $tbody.append('<tr><td colspan="6" class="text-center py-3 text-muted">No transactions yet.</td></tr>');
      return;
    }

    all.forEach(tx => {
      const typeBadge = tx.type === 'borrow'
        ? '<span class="els-badge badge-borrow">Borrowed</span>'
        : '<span class="els-badge badge-return">Returned</span>';

      $tbody.append(`
        <tr>
          <td>${tx.id}</td>
          <td>${tx.userName} <small class="text-muted">(${tx.userId})</small></td>
          <td>${tx.bookTitle}</td>
          <td>Copy #${tx.copyNumber}</td>
          <td>${typeBadge}</td>
          <td>${fmtDateTime(tx.date)}</td>
        </tr>
      `);
    });
  }


  // ── Search History ──────────────────────────────────────────
  // Hides rows that don't contain the search term (checks all cell text)
  $('#historySearch').on('input', function () {
    const q = $(this).val().toLowerCase();
    $('#fullHistoryTable tbody tr').each(function () {
      $(this).toggle($(this).text().toLowerCase().includes(q));
    });
  });


  // ── Filter by Type ──────────────────────────────────────────
  // Shows only Borrowed or Returned rows depending on the dropdown selection
  $('#historyFilter').on('change', function () {
    const val = $(this).val();
    $('#fullHistoryTable tbody tr').each(function () {
      if (!val) { $(this).show(); return; } // empty = show all
      $(this).toggle($(this).find('.els-badge').text().toLowerCase().includes(val));
    });
  });

}
