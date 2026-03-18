/**
 * userManager.js
 *
 * Handles everything to do with user accounts — creating, reading,
 * updating, deleting, and authenticating them.
 *
 * All user data lives in localStorage under the key 'els_users'.
 */
class UserManager {

  constructor() {
    this.KEY = 'els_users';
    this._seed(); // load demo accounts if the system is brand new
  }

  /**
   * Populates the system with sample accounts on first launch.
   * Won't run if users already exist — safe to call every time.
   */
  _seed() {
    if (this.getAll().length > 0) return;
    const defaults = [
      new User({ id: '2404048', name: 'John Doe', role: 'student', password: 'pass123', email: 'john@pnc.edu.ph', contact: '09171234567' }),
      new User({ id: '2404049', name: 'Jane Smith', role: 'student', password: 'pass123', email: 'jane@pnc.edu.ph', contact: '09181234567' }),
      new User({ id: 'LIB001', name: 'Maria Santos', role: 'librarian', password: 'lib123', email: 'maria@pnc.edu.ph', contact: '09191234567' }),
      new User({ id: 'LIB002', name: 'Pedro Cruz', role: 'librarian', password: 'lib123', email: 'pedro@pnc.edu.ph', contact: '09201234567' }),
      new User({ id: 'ADM001', name: 'Admin User', role: 'admin', password: 'admin123', email: 'admin@pnc.edu.ph', contact: '09211234567' }),
    ];
    StorageService.set(this.KEY, defaults);
  }

  // Returns every user in the system
  getAll() {
    return StorageService.get(this.KEY) || [];
  }

  // Finds one user by their ID. Returns null if nobody matches.
  getById(id) {
    return this.getAll().find(u => u.id === id) || null;
  }

  // Filters users by role — handy for listing staff or generating IDs
  getByRole(role) {
    return this.getAll().filter(u => u.role === role);
  }

  /**
   * Validates login credentials. All three must match: ID, password, and role.
   * Returns the user object on success, null on failure.
   */
  authenticate(id, password, role) {
    const user = this.getById(id);
    if (user && user.password === password && user.role === role) return user;
    return null;
  }

  /**
   * Registers a new user account.
   * Returns { ok: true } on success, or { ok: false, msg } if the ID is taken.
   */
  add(userData) {
    const users = this.getAll();
    if (users.find(u => u.id === userData.id)) {
      return { ok: false, msg: 'User ID already exists.' };
    }
    users.push(new User(userData));
    StorageService.set(this.KEY, users);
    return { ok: true };
  }

  // Saves edits to an existing user account (matched by ID)
  update(updatedUser) {
    const users = this.getAll().map(u => u.id === updatedUser.id ? updatedUser : u);
    StorageService.set(this.KEY, users);
  }

  // Permanently deletes a user account
  delete(id) {
    const users = this.getAll().filter(u => u.id !== id);
    StorageService.set(this.KEY, users);
  }

  /**
   * Records that a user has borrowed a copy.
   * Adds the copy ID to their borrowedCopies list (no duplicates).
   */
  addBorrowedCopy(userId, copyId) {
    const user = this.getById(userId);
    if (!user) return;
    if (!user.borrowedCopies) user.borrowedCopies = [];
    if (!user.borrowedCopies.includes(copyId)) {
      user.borrowedCopies.push(copyId);
      this.update(user);
    }
  }

  /**
   * Removes a copy from the user's borrowed list when they return it.
   */
  removeBorrowedCopy(userId, copyId) {
    const user = this.getById(userId);
    if (!user) return;
    user.borrowedCopies = (user.borrowedCopies || []).filter(id => id !== copyId);
    this.update(user);
  }

  /**
   * Generates the next student ID (plain numbers like 2404050).
   * Falls back to 2404049 as the base if no students exist yet.
   */
  generateStudentId() {
    const nums = this.getByRole('student').map(u => parseInt(u.id)).filter(n => !isNaN(n));
    const max = nums.length ? Math.max(...nums) : 2404049;
    return String(max + 1);
  }

  /**
   * Generates the next staff ID with the right prefix.
   * Librarians → LIB001, LIB002... | Admins → ADM001, ADM002...
   */
  generateStaffId(role) {
    const prefix = role === 'librarian' ? 'LIB' : 'ADM';
    const nums = this.getAll()
      .filter(u => u.id.startsWith(prefix))
      .map(u => parseInt(u.id.replace(prefix, '')) || 0);
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return prefix + String(next).padStart(3, '0');
  }
}
