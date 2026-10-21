let session = JSON.parse(localStorage.getItem('irongrind_session') || sessionStorage.getItem('irongrind_session') || 'null');
if (!session || session.role !== 'customer') window.location.href = 'index.html';

function loadDB(key) { try { return JSON.parse(localStorage.getItem('ig_' + key)) || []; } catch { return []; } }
function saveDB(key, data) { localStorage.setItem('ig_' + key, JSON.stringify(data)); }
function formatPeso(n) { return '₱' + Number(n).toLocaleString('en-PH'); }
function toast(msg) { const el = document.getElementById('toast'); el.textContent = msg; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'), 3000); }
function logout() { localStorage.removeItem('irongrind_session'); sessionStorage.removeItem('irongrind_session'); window.location.href='index.html'; }

function submitMembershipForm(e) {
    e.preventDefault();
    toast('Renewal submitted for approval!');
    e.target.reset();
}

function renderStore() {
    const products = loadDB('products');
    const grid = document.getElementById('customerStoreGrid');
    grid.innerHTML = products.length ? products.map(p => `
        <div class="supplement-card">
            <span class="tag">${p.category}</span><h4>${p.name}</h4>
            <div class="price-row"><span class="price">${formatPeso(p.price)}</span><span class="stock-badge">${p.stock} left</span></div>
            <button class="btn-reserve-lg" onclick="toast('Reserved!')">Reserve</button>
        </div>`).join('') : '<div class="empty-state">No products.</div>';
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('currentUserName').textContent = session.username;
    document.getElementById('heroName').textContent = (session.fullName || session.username).split(' ')[0];
    renderStore();
});

window.addEventListener('load', () => { setTimeout(() => { document.getElementById('page-loader').classList.add('hidden-loader'); }, 500); });