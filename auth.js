const ADMIN_USER = { username: 'admin', password: 'irongrind2025' };

function loadUsers() {
    try {
        const users = JSON.parse(localStorage.getItem('ig_users') || '[]');
        return Array.isArray(users) ? users : [];
    } catch {
        return [];
    }
}

function togglePassword() {
    const input = document.getElementById('loginPassword');
    const icon = document.getElementById('togglePwIcon');
    if (!input || !icon) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
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

    const username = document.getElementById('loginId').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('rememberMe').checked;
    if (!username || !password) {
        showError('Please fill in all fields.');
        return;
    }

    let session;
    if (username === ADMIN_USER.username && password === ADMIN_USER.password) {
        session = { role: 'admin', username, fullName: 'Administrator', loginTime: new Date().toISOString() };
    } else {
        const user = loadUsers().find(item => item.username?.toLowerCase() === username && item.password === password);
        if (user) {
            session = { role: 'customer', username, fullName: user.fullName || username, loginTime: new Date().toISOString() };
        } else {
            let pending = [];
            try {
                const saved = JSON.parse(localStorage.getItem('ig_pendingApprovals') || '[]');
                if (Array.isArray(saved)) pending = saved;
            } catch {
                // Ignore malformed pending data and show the normal login error.
            }
            showError(pending.some(item => item.username?.toLowerCase() === username)
                ? 'Your application is still pending approval.'
                : 'Invalid username or password.');
            return;
        }
    }

    localStorage.removeItem('irongrind_session');
    sessionStorage.removeItem('irongrind_session');
    (remember ? localStorage : sessionStorage).setItem('irongrind_session', JSON.stringify(session));
    window.location.replace(session.role === 'admin' ? 'admin.html' : 'customer.html');
}
