let currentLoginRole = 'admin';
const ADMIN_USER = { username: 'admin', password: 'irongrind2025' };

function loadUsers() {
    try { return JSON.parse(localStorage.getItem('ig_users')) || []; }
    catch { return []; }
}

function selectLoginRole(role) {
    currentLoginRole = role;
    const adminTab = document.getElementById('tabAdmin');
    const customerTab = document.getElementById('tabCustomer');
    const idLabel = document.getElementById('loginIdLabel');
    const idInput = document.getElementById('loginId');
    const hint = document.getElementById('loginHint');
    const registerCta = document.querySelector('.register-cta');

    if (role === 'admin') {
        adminTab.classList.add('active');
        customerTab.classList.remove('active');
        idLabel.textContent = 'Admin Username';
        idInput.placeholder = 'Enter your admin username';
        hint.innerHTML = 'Demo admin — <strong>admin</strong> / <strong>irongrind2025</strong>';
        if (registerCta) registerCta.style.display = 'none';
    } else {
        customerTab.classList.add('active');
        adminTab.classList.remove('active');
        idLabel.textContent = 'Member Username';
        idInput.placeholder = 'Enter your member username';
        hint.innerHTML = 'Don\'t have an account yet? Register below.';
        if (registerCta) registerCta.style.display = 'block';
    }
    hideError();
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

    if (!id || !password) { showError('Please fill in all fields.'); return; }

    let session = null;

    if (currentLoginRole === 'admin') {
        if (id === ADMIN_USER.username && password === ADMIN_USER.password) {
            session = { role: 'admin', username: id, loginTime: new Date().toISOString() };
        } else {
            showError('Invalid admin credentials.');
            return;
        }
    } else {
        const users = loadUsers();
        const user = users.find(u => u.username === id && u.password === password);
        if (user) {
            session = { role: 'customer', username: id, fullName: user.fullName, loginTime: new Date().toISOString() };
        } else {
            const pending = JSON.parse(localStorage.getItem('ig_pendingApprovals') || '[]');
            if (pending.find(p => p.username === id)) {
                showError('Your application is still pending admin approval.');
            } else {
                showError('Invalid username or password. New here? Register first.');
            }
            return;
        }
    }

    if (remember) localStorage.setItem('irongrind_session', JSON.stringify(session));
    else sessionStorage.setItem('irongrind_session', JSON.stringify(session));

    window.location.href = session.role === 'admin' ? 'admin.html' : 'customer.html';
}

window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role');
    if (role === 'customer' || role === 'admin') selectLoginRole(role);
});