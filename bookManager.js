/**
 * bookManager.js
 *
 * Two managers live here — keep them together since they're tightly related.
 *
 * BookManager     → the catalog (book titles, authors, categories)
 * BookCopyManager → the physical copies on the shelf
 *
 * Think of it like: "Harry Potter" is a Book.
 * The three copies sitting on the shelf are BookCopies.
 */


/**
 * Manages book titles in the catalog.
 * Data lives in localStorage under 'els_books'.
 */
class BookManager {

  constructor() {
    this.KEY = 'els_books';
    this._seed(); // add sample books if the catalog is empty
  }

  /**
   * Fills the catalog with sample books on first run.
   * Skips silently if books already exist.
   */
  _seed() {
    if (this.getAll().length > 0) return;
    const defaults = [
      new Book({ id: 'BK001', title: 'Ang Matsing', author: 'Angel Baniago', category: 'Fantasy', isbn: '978-0001', publishedYear: '2015', description: 'A classic Filipino folk tale about a clever monkey.' }),
      new Book({ id: 'BK002', title: 'El Filibusterismo', author: 'Jose Rizal', category: 'Historical', isbn: '978-0002', publishedYear: '1891', description: 'The sequel to Noli Me Tangere by Jose Rizal.' }),
      new Book({ id: 'BK003', title: 'Romeo & Juliet', author: 'Ralph Baltazar', category: 'Romance', isbn: '978-0003', publishedYear: '2010', description: 'A Filipino adaptation of Shakespeare\'s timeless romance.' }),
      new Book({ id: 'BK004', title: 'Si Pagong at Matsing', author: 'Ralph Baltazar', category: 'Fantasy', isbn: '978-0004', publishedYear: '2012', description: 'The classic fable of the tortoise and the monkey.' }),
      new Book({ id: 'BK005', title: 'Harry Potter', author: 'J.K. Rowling', category: 'Fantasy', isbn: '978-0005', publishedYear: '1997', description: 'The boy who lived — a magical adventure series.' }),
      new Book({ id: 'BK006', title: 'Noli Me Tangere', author: 'Jose Rizal', category: 'Historical', isbn: '978-0006', publishedYear: '1887', description: 'Jose Rizal\'s landmark novel exposing colonial injustice.' }),
    ];
    StorageService.set(this.KEY, defaults);
  }

  // Returns every book in the catalog
  getAll() { return StorageService.get(this.KEY) || []; }

  // Finds a book by its ID. Returns null if not found.
  getById(id) { return this.getAll().find(b => b.id === id) || null; }

  // Unique, sorted list of authors — used to populate the filter dropdown
  getAuthors() { return [...new Set(this.getAll().map(b => b.author))].sort(); }

  // Unique, sorted list of categories — used to populate the filter dropdown
  getCategories() { return [...new Set(this.getAll().map(b => b.category))].sort(); }

  /**
   * Searches the catalog by title, author, or ISBN.
   * Optionally narrows results by exact author and/or category.
   * Passing no arguments returns all books.
   */
  search(query = '', author = '', category = '') {
    return this.getAll().filter(b => {
      const q = query.toLowerCase();
      const matchQ = !query || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || (b.isbn || '').includes(q);
      const matchA = !author || b.author === author;
      const matchCat = !category || b.category === category;
      return matchQ && matchA && matchCat;
    });
  }

  /**
   * Adds a new book to the catalog.
   * Auto-generates the next available ID (e.g. BK007).
   * Returns the created Book object.
   */
  add(bookData) {
    const books = this.getAll();
    const book = new Book({ ...bookData, id: this._generateId() });
    books.push(book);
    StorageService.set(this.KEY, books);
    return book;
  }

  // Saves edits to an existing book (matched by ID)
  update(updatedBook) {
    StorageService.set(this.KEY, this.getAll().map(b => b.id === updatedBook.id ? updatedBook : b));
  }

  // Permanently removes a book from the catalog
  delete(id) {
    StorageService.set(this.KEY, this.getAll().filter(b => b.id !== id));
  }

  // Generates the next book ID — finds the highest existing number and adds 1
  _generateId() {
    const nums = this.getAll().map(b => parseInt(b.id.replace('BK', '')) || 0);
    return 'BK' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
  }
}


/**
 * Manages the physical copies of books on the shelf.
 * Each copy has its own status, condition, and borrow record.
 * Data lives in localStorage under 'els_copies'.
 */
class BookCopyManager {

  constructor() {
    this.KEY = 'els_copies';
    this._seed(); // add default copies if none exist
  }

  /**
   * Seeds default copies for the sample books on first run.
   * Each book gets a different starting quantity.
   */
  _seed() {
    if (this.getAll().length > 0) return;
    const copies = [];
    const counts = { BK001: 3, BK002: 2, BK003: 3, BK004: 2, BK005: 4, BK006: 2 };
    let counter = 1;
    for (const [bookId, qty] of Object.entries(counts)) {
      for (let i = 1; i <= qty; i++) {
        copies.push(new BookCopy({
          id: 'CP' + String(counter++).padStart(4, '0'),
          bookId,
          copyNumber: i,
          condition: 'Good',
          status: 'Available'
        }));
      }
    }
    StorageService.set(this.KEY, copies);
  }

  // Returns all copies across every book
  getAll() { return StorageService.get(this.KEY) || []; }

  // Finds a single copy by its copy ID
  getById(id) { return this.getAll().find(c => c.id === id) || null; }

  // All copies of a specific book (available or borrowed)
  getByBookId(bookId) { return this.getAll().filter(c => c.bookId === bookId); }

  // Only the available copies of a book — used to populate the borrow dropdown
  getAvailableByBookId(bookId) { return this.getByBookId(bookId).filter(c => c.status === 'Available'); }

  // Total copy count for a book (available + borrowed combined)
  getTotalByBookId(bookId) { return this.getByBookId(bookId).length; }

  // How many copies of a book can be borrowed right now
  getAvailableCountByBookId(bookId) { return this.getAvailableByBookId(bookId).length; }

  /**
   * Adds new physical copies to an existing book.
   *
   * Important: we save each copy to storage one at a time inside the loop.
   * This ensures _generateId() always reads the latest max from storage,
   * preventing duplicate or inflated copy IDs.
   */
  addCopies(bookId, quantity, condition = 'Good') {
    const existing = this.getByBookId(bookId);
    const startNum = existing.length + 1; // continue numbering from where we left off
    const newCopies = [];

    for (let i = 0; i < quantity; i++) {
      const copy = new BookCopy({
        id: this._generateId(), // re-reads storage each time to get true next ID
        bookId,
        copyNumber: startNum + i,
        condition,
        status: 'Available'
      });
      StorageService.set(this.KEY, [...this.getAll(), copy]); // save before next iteration
      newCopies.push(copy);
    }
    return newCopies;
  }

  // Saves edits to an existing copy (matched by ID)
  update(updatedCopy) {
    StorageService.set(this.KEY, this.getAll().map(c => c.id === updatedCopy.id ? updatedCopy : c));
  }

  // Permanently removes a single copy
  delete(id) {
    StorageService.set(this.KEY, this.getAll().filter(c => c.id !== id));
  }

  // Removes all copies of a book — called when the book itself gets deleted
  deleteByBookId(bookId) {
    StorageService.set(this.KEY, this.getAll().filter(c => c.bookId !== bookId));
  }

  /**
   * Marks a copy as borrowed.
   * Sets status to 'Borrowed', records who took it and when,
   * and calculates a due date 14 days from today.
   * Returns null if the copy isn't available.
   */
  borrow(copyId, userId) {
    const copy = this.getById(copyId);
    if (!copy || copy.status !== 'Available') return null;

    const due = new Date();
    due.setDate(due.getDate() + 14);

    copy.status = 'Borrowed';
    copy.borrowedBy = userId;
    copy.borrowedAt = new Date().toISOString();
    copy.dueDate = due.toISOString();
    this.update(copy);
    return copy;
  }

  /**
   * Marks a copy as returned.
   * Clears all borrow-related fields and sets status back to 'Available'.
   */
  returnCopy(copyId) {
    const copy = this.getById(copyId);
    if (!copy) return null;

    copy.status = 'Available';
    copy.borrowedBy = null;
    copy.borrowedAt = null;
    copy.dueDate = null;
    this.update(copy);
    return copy;
  }

  // Generates the next copy ID by finding the current max in storage and adding 1
  _generateId() {
    const nums = this.getAll().map(c => parseInt(c.id.replace('CP', '')) || 0);
    return 'CP' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
  }
}
