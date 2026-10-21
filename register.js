function loadDB(key) { try { return JSON.parse(localStorage.getItem('ig_' + key)) || []; } catch { return []; } }
function saveDB(key, data) { localStorage.setItem('ig_' + key, JSON.stringify(data)); }

function submitRegistration(e) {
    e.preventDefault();
    const fn = document.getElementById('regFullName').value;
    const u = document.getElementById('regUsername').value;
    const p = document.getElementById('regPassword').value;
    const plan = document.getElementById('regPlan').value.split('|')[0];

    const pending = loadDB('pendingApprovals');
    pending.push({ id: 'APP'+Date.now(), fullName: fn, username: u, password: p, plan: plan, endDate: new Date().toISOString().slice(0,10), status: 'pending' });
    saveDB('pendingApprovals', pending);

    document.getElementById('modalContent').innerHTML = `<div style="text-align:center;"><h3>Submitted!</h3><p>Wait for admin approval.</p><a href="index.html" class="btn-primary" style="display:inline-block; margin-top:16px; padding:10px 20px; text-decoration:none;">Go to Login</a></div>`;
    document.getElementById('modalOverlay').classList.remove('hidden');
}