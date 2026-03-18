/**
 * models.js
 *
 * All the data blueprints (classes) used throughout the system.
 * Think of these as the "shapes" of our data — every user, book,
 * copy, and transaction follows one of these templates.
 */


/**
 * Represents a person who uses the system.
 * Could be a student, librarian, or admin — the `role` field tells us which.
 * `borrowedCopies` tracks the IDs of copies this user currently has checked out.
 */
class User {
  constructor({ id, name, role, password, email = '', contact = '', address = '', createdAt = new Date().toISOString(), borrowedCopies = [] }) {
    this.id = id;
    this.name = name;
    this.role = role;           // 'student' | 'librarian' | 'admin'
    this.password = password;
    this.email = email;
    this.contact = contact;
    this.address = address;
    this.createdAt = createdAt;
    this.borrowedCopies = borrowedCopies; // array of BookCopy IDs currently borrowed
  }
}


/**
 * Represents a book title in the catalog.
 * This is the book's info — not the physical copy on the shelf.
 * For actual copies and availability, see BookCopy.
 *
 * Each book gets a random cover color for the UI thumbnail
 * since we don't store cover images.
 */
class Book {
  constructor({ id, title, author, category, description = '', isbn = '', publishedYear = '', coverColor = null, createdAt = new Date().toISOString() }) {
    this.id = id;
    this.title = title;
    this.author = author;
    this.category = category;
    this.description = description;
    this.isbn = isbn;
    this.publishedYear = publishedYear;
    this.coverColor = coverColor || Book.randomColor(); // auto-assigned if not provided
    this.createdAt = createdAt;
  }

  // Picks a random color from a curated palette for the book cover thumbnail
  static randomColor() {
    const c = ['#2d6a4f', '#1b4332', '#40916c', '#52b788', '#1d3557', '#457b9d', '#6d2b3d', '#c9184a', '#7b2d8b', '#6a4c93'];
    return c[Math.floor(Math.random() * c.length)];
  }
}


/**
 * Represents one physical copy of a book.
 * A single Book title can have multiple BookCopies (e.g. 3 copies of Harry Potter).
 *
 * When borrowed: status → 'Borrowed', borrowedBy/borrowedAt/dueDate get filled in.
 * When returned: status → 'Available', those fields go back to null.
 */
class BookCopy {
  constructor({ id, bookId, copyNumber, condition = 'Good', status = 'Available', borrowedBy = null, borrowedAt = null, dueDate = null }) {
    this.id = id;
    this.bookId = bookId;       // links back to the parent Book
    this.copyNumber = copyNumber;   // e.g. Copy #1, Copy #2
    this.condition = condition;    // 'Good' | 'Fair' | 'Poor'
    this.status = status;       // 'Available' | 'Borrowed'
    this.borrowedBy = borrowedBy;   // User ID of the borrower (null if available)
    this.borrowedAt = borrowedAt;   // ISO timestamp when borrowed
    this.dueDate = dueDate;      // ISO timestamp for return deadline
  }
}


/**
 * Represents a single borrow or return event.
 * Every time someone borrows or returns a book, one Transaction is created.
 * This is how we build the history log and generate reports.
 *
 * `type` is either 'borrow' or 'return'.
 *
 * We snapshot user name and book title here so history stays accurate
 * even if the user or book is later edited or deleted.
 */
class Transaction {
  constructor({ id, userId, userName, bookId, bookTitle, copyId, copyNumber, type, date = new Date().toISOString(), dueDate = null, returnDate = null, notes = '' }) {
    this.id = id;
    this.userId = userId;
    this.userName = userName;     // snapshot of name at time of transaction
    this.bookId = bookId;
    this.bookTitle = bookTitle;    // snapshot of title at time of transaction
    this.copyId = copyId;
    this.copyNumber = copyNumber;
    this.type = type;         // 'borrow' | 'return'
    this.date = date;         // when this transaction happened
    this.dueDate = dueDate;      // set on borrows (14 days out)
    this.returnDate = returnDate;   // set when the book is actually returned
    this.notes = notes;        // optional staff notes
  }
}
