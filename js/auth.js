const ADMIN_USER = { username: 'admin', password: 'irongrind2025' };

function loadUsers() {
    try { return JSON.parse(localStorage.getItem('ig_users')) || []; }
    catch { return []; }
}

function togglePassword() {
    const pwInput = document.getElementById('loginPassword');
    const icon = document.getElementById('togglePwIcon');
    if (pwInput.type === 'password') {
        pwInput.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        pwInput.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function showError(message) {
    document.getElementById('loginErrorText').textContent = message;
    document.getElementById('loginError').classList.remove('hidden');
}

function hideError() {
    document.getElementById('loginError').classList.add('hidden');
}

function handleLogin(event) {
    event.preventDefault();
    hideError();

    const id = document.getElementById('loginId').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('rememberMe').checked;
    const submitBtn = document.getElementById('loginBtn');

    if (!id || !password) { showError('Please fill in all fields.'); return; }
    submitBtn.classList.add('btn-loading');

    setTimeout(() => {
        let session = null;

        // 1. Admin check
        if (id === ADMIN_USER.username && password === ADMIN_USER.password) {
            session = {
                role: 'admin',
                username: id,
                fullName: 'Administrator',
                loginTime: new Date().toISOString()
            };
        } 
        // 2. Member check
        else {
            const users = loadUsers();
            const user = users.find(u => u.username === id && u.password === password);
            if (user) {
                session = {
                    role: 'customer',
                    username: id,
                    fullName: user.fullName || id,
                    loginTime: new Date().toISOString()
                };
            } else {
                submitBtn.classList.remove('btn-loading');
                const pending = JSON.parse(localStorage.getItem('ig_pendingApprovals') || '[]');
                if (pending.find(p => p.username === id)) {
                    showError('Your application is still pending admin approval.');
                } else {
                    showError('Invalid username or password.');
                }
                return;
            }
        }

        // 3. Write session FIRST
        try {
            if (remember) localStorage.setItem('irongrind_session', JSON.stringify(session));
            else sessionStorage.setItem('irongrind_session', JSON.stringify(session));
        } catch (e) {
            console.error('Session save failed:', e);
            showError('Browser storage blocked. Enable cookies/localStorage.');
            submitBtn.classList.remove('btn-loading');
            return;
        }

        // 4. Then redirect (using href, not replace, to keep history clean)
        console.log('Login OK. Redirecting as', session.role);
        window.location.href = session.role === 'admin' ? './admin.html' : './customer.html';
    }, 600);
}

/* ========== FORGOT PASSWORD ========== */
function openForgotPasswordModal(e) {
    if (e) e.preventDefault();
    document.getElementById('modalContent').innerHTML = `
        <h3><i class="fas fa-key"></i> Reset Password</h3>
        <p class="modal-sub">Enter your username and we'll send a reset link to the registered email.</p>
        <div class="form-group">
            <label>Username</label>
            <input type="text" id="resetUsername" placeholder="Enter your username" required>
        </div>
        <div class="modal-actions">
            <button class="btn-sm" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" id="resetBtn" onclick="submitForgotPassword()">Send Reset Link</button>
        </div>`;
    document.getElementById('modalOverlay').classList.remove('hidden');
}

function submitForgotPassword() {
    const username = document.getElementById('resetUsername').value.trim().toLowerCase();
    const btn = document.getElementById('resetBtn');
    if (!username) return;
    btn.classList.add('btn-loading');
    setTimeout(() => {
        btn.classList.remove('btn-loading');
        document.getElementById('modalContent').innerHTML = `
            <div style="text-align:center; padding:8px 0;">
                <div style="width:72px; height:72px; border-radius:50%; background:rgba(61,220,151,0.15); color:#3ddc97; display:flex; align-items:center; justify-content:center; font-size:2rem; margin:0 auto 16px;">
                    <i class="fas fa-paper-plane"></i>
                </div>
                <h3 style="justify-content:center; display:flex;">Check your email</h3>
                <p class="modal-sub" style="text-align:center;">If an account exists for <strong>${username}</strong>, a reset link was sent.</p>
                <button class="btn-primary" style="width:100%; justify-content:center;" onclick="closeModal()">Back to Login</button>
            </div>`;
    }, 700);
}

function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
}