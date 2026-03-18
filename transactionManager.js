/**
 * transactionManager.js
 *
 * Records and queries borrow/return transactions.
 * Every time someone borrows or returns a book, a Transaction gets logged here.
 * This is the backbone of the Reports page.
 *
 * Data lives in localStorage under 'els_transactions'.
 */
class TransactionManager {

  constructor() {
    this.KEY = 'els_transactions';
  }

  // Returns the full transaction history (oldest first)
  getAll() {
    return StorageService.get(this.KEY) || [];
  }

  // Finds one transaction by its ID
  getById(id) {
    return this.getAll().find(t => t.id === id) || null;
  }

  // All transactions made by a specific user (for their profile history)
  getByUser(userId) {
    return this.getAll().filter(t => t.userId === userId);
  }

  // All transactions involving a specific book
  getByBook(bookId) {
    return this.getAll().filter(t => t.bookId === bookId);
  }

  // Just the borrow events — used for counting total borrows in reports
  getBorrowHistory() {
    return this.getAll().filter(t => t.type === 'borrow');
  }

  // Just the return events — used for counting total returns in reports
  getReturnHistory() {
    return this.getAll().filter(t => t.type === 'return');
  }

  /**
   * Finds all copies that are currently borrowed (not yet returned).
   *
   * How it works: for each unique copyId in the transaction log,
   * we find its most recent transaction. If that transaction is a 'borrow',
   * the copy is still out. If it's a 'return', it's back on the shelf.
   *
   * Note: Reports page uses BookCopyManager directly for live counts —
   * this is used when you need the full transaction context (e.g. who has it).
   */
  getActiveBorrows() {
    const all = this.getAll();
    const byClopy = {};

    all.forEach(t => {
      const existing = byClopy[t.copyId];
      // Keep whichever transaction is more recent
      if (!existing || new Date(t.date) > new Date(existing.date)) {
        byClopy[t.copyId] = t;
      }
    });

    return Object.values(byClopy).filter(t => t.type === 'borrow');
  }

  /**
   * Creates and saves a new transaction record.
   * The ID is auto-generated based on the current max in storage.
   */
  record(data) {
    const transactions = this.getAll();
    const tx = new Transaction({
      ...data,
      id: this._generateId()
    });
    transactions.push(tx);
    StorageService.set(this.KEY, transactions);
    return tx;
  }

  /**
   * Shorthand for recording a borrow event.
   * Automatically sets type to 'borrow' and calculates a 14-day due date.
   */
  recordBorrow({ userId, userName, bookId, bookTitle, copyId, copyNumber }) {
    const due = new Date();
    due.setDate(due.getDate() + 14);
    return this.record({
      userId, userName, bookId, bookTitle, copyId, copyNumber,
      type: 'borrow',
      dueDate: due.toISOString()
    });
  }

  /**
   * Shorthand for recording a return event.
   * Automatically sets type to 'return' and stamps the return date.
   */
  recordReturn({ userId, userName, bookId, bookTitle, copyId, copyNumber }) {
    return this.record({
      userId, userName, bookId, bookTitle, copyId, copyNumber,
      type: 'return',
      returnDate: new Date().toISOString()
    });
  }

  /**
   * Returns the top N most-borrowed books, sorted by borrow count.
   * Used for the "Most Borrowed Books" list in Reports.
   */
  getMostBorrowed(limit = 5) {
    const counts = {};
    this.getBorrowHistory().forEach(t => {
      counts[t.bookId] = counts[t.bookId] || { bookId: t.bookId, title: t.bookTitle, count: 0 };
      counts[t.bookId].count++;
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Returns the N most recent transactions (any type).
   * Used for the "Recent Activity" feed in Reports.
   */
  getRecentActivity(limit = 10) {
    return [...this.getAll()]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }

  // Generates the next transaction ID (e.g. TX00042) based on the current max
  _generateId() {
    const all = this.getAll();
    const nums = all.map(t => parseInt(t.id.replace('TX', '')) || 0);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return 'TX' + String(next).padStart(5, '0');
  }
}
