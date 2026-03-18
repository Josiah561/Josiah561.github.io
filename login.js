/**
 * login.js
 *
 * Handles everything on the login and registration pages.
 *
 * initRoleSelectPage() — nothing to do here, navigation is handled by HTML links
 * initLoginPage(role)  — wires up the Sign In button and register link for a given role
 * showRegisterModal()  — opens the registration form in a modal
 */


// Called on login.html — just the role selection landing page
function initRoleSelectPage() {
  // Navigation is handled by the <a> links in the HTML — nothing extra needed here
}


/**
 * Sets up the login form for a given role ('student', 'librarian', or 'admin').
 * Each role's page has differently named input fields — this maps them correctly.
 */
function initLoginPage(role) {
  const um = new UserManager();

  // Each login page has unique input IDs to avoid conflicts
  const fieldMap = {
    student: { id: '#studentId', pass: '#studentPass' },
    librarian: { id: '#librarianId', pass: '#librarianPass' },
    admin: { id: '#adminId', pass: '#adminPass' },
  };
  const { id: idSel, pass: passSel } = fieldMap[role];

  // Handle the Sign In button click
  $(document).on('click', '.login-btn', function () {
    const $card = $(this).closest('.login-card');
    clearErrors($card);

    const id = $(idSel).val().trim();
    const pass = $(passSel).val().trim();
    let valid = true;

    // Basic presence validation before hitting storage
    if (!id) { showError($(idSel), 'User ID is required.'); valid = false; }
    if (!pass) { showError($(passSel), 'Password is required.'); valid = false; }
    if (!valid) return;

    const user = um.authenticate(id, pass, role);
    if (!user) {
      // Wrong credentials — highlight both fields and show a toast
      $(idSel).addClass('is-invalid');
      $(passSel).addClass('is-invalid');
      notify('Invalid credentials. Please try again.', 'error');
      return;
    }

    // Credentials are good — save session and go to the dashboard
    Session.set(user);
    notify('Login successful! Redirecting…');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 900);
  });

  // Let users press Enter to submit instead of clicking the button
  $(document).on('keydown', `${idSel}, ${passSel}`, function (e) {
    if (e.key === 'Enter') $('.login-btn').trigger('click');
  });

  // Open the registration modal when "Register here" is clicked
  $(document).on('click', '.signup-link', function (e) {
    e.preventDefault();
    showRegisterModal(role, um);
  });
}


/**
 * Opens a modal registration form for the given role.
 * Staff IDs (librarian/admin) are auto-generated and read-only.
 * Student IDs are also auto-generated but shown for reference.
 */
function showRegisterModal(role, um) {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const isStaff = role !== 'student';

  openModal('registerModal', `
    <div class="modal fade" id="registerModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content els-modal">
          <div class="modal-header">
            <h5 class="modal-title">Register as ${roleLabel}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label">Full Name *</label>
                <input type="text" id="reg_name" class="form-control els-input" placeholder="e.g. Juan dela Cruz">
              </div>
              <div class="col-6">
                <label class="form-label">User ID *</label>
                <input type="text" id="reg_id" class="form-control els-input" placeholder="e.g. 2404050" ${isStaff ? 'readonly' : ''}>
              </div>
              <div class="col-6">
                <label class="form-label">Password *</label>
                <input type="password" id="reg_pass" class="form-control els-input" placeholder="Min 6 characters">
              </div>
              <div class="col-12">
                <label class="form-label">Email</label>
                <input type="email" id="reg_email" class="form-control els-input" placeholder="email@pnc.edu.ph">
              </div>
              <div class="col-6">
                <label class="form-label">Contact No.</label>
                <input type="text" id="reg_contact" class="form-control els-input" placeholder="09XXXXXXXXX">
              </div>
              <div class="col-6">
                <label class="form-label">Address</label>
                <input type="text" id="reg_address" class="form-control els-input" placeholder="City, Province">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn els-btn-outline" data-bs-dismiss="modal">Cancel</button>
            <button class="btn els-btn-primary" id="reg_submit">Create Account</button>
          </div>
        </div>
      </div>
    </div>
  `, (modal) => {

    // Pre-fill the ID field with an auto-generated value
    if (role === 'student') {
      $('#reg_id').val(um.generateStudentId());
    } else {
      $('#reg_id').val(um.generateStaffId(role));
    }

    $('#reg_submit').on('click', function () {
      const name = $('#reg_name').val().trim();
      const id = $('#reg_id').val().trim();
      const pass = $('#reg_pass').val().trim();
      const email = $('#reg_email').val().trim();
      const contact = $('#reg_contact').val().trim();
      const address = $('#reg_address').val().trim();

      // Validate required fields
      if (!name || !id || !pass) { notify('Name, ID and Password are required.', 'error'); return; }
      if (pass.length < 6) { notify('Password must be at least 6 characters.', 'error'); return; }

      const result = um.add({ id, name, role, password: pass, email, contact, address });
      if (!result.ok) { notify(result.msg, 'error'); return; }

      // Success — tell the user their new ID and let them log in
      notify(`Account created! ID: ${id} — You can now log in.`);
      modal.hide();
    });
  });
}
