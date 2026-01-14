import { initAuth, login, logout } from "./auth.js";
import { fetchServerDate, serverDate, showToast, showAlert } from "./utils.js";
import { addTransaction, removeTransaction, getStock, loadMonthData, getTransactions, setupDBCallbacks } from "./db.js";
import { updateUI, setupAutocomplete, downloadExcel, setView, changePage, renderMonthTable } from "./ui.js";

// Setup DB Callbacks (Break Circular Dependency)
setupDBCallbacks(updateUI, renderMonthTable);

// Initialize Auth
initAuth();

// Initialize Server Date
fetchServerDate();

// Setup Global Functions (for onclicks in HTML)
window.setView = setView;
window.changePage = changePage;
window.doLogout = logout;
window.removeTransaction = removeTransaction;
window.loadMonthData = loadMonthData;
window.downloadExcel = downloadExcel;
window.applyFilter = () => { window.setView('all'); }; // Re-using setView triggers updateUI and resets page
window.resetFilter = () => {
    document.getElementById('filterStart').value = '';
    document.getElementById('filterEnd').value = '';
    document.getElementById('filterName').value = '';
    window.setView('all');
};

// Setup Autocomplete
setupAutocomplete('filterName', 'filterSuggestions');
setupAutocomplete('descInput', 'formSuggestions');

// Event Listeners
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await login(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
    } catch (e) {
        document.getElementById('loginError').innerText = "Login Gagal: " + e.message;
        document.getElementById('loginError').classList.remove('d-none');
    }
});

document.getElementById('transactionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = document.getElementById('dateInput').value;
    const desc = document.getElementById('descInput').value.trim();
    const type = document.getElementById('typeInput').value;
    const amount = +document.getElementById('amountInput').value;

    // Validate Date
    if (d > serverDate) {
        showToast("Tanggal/Bulan/Tahun yang di input tidak boleh lebih dari hari ini");
        return;
    }

    if (!desc || amount <= 0) return showAlert("Data tidak valid");

    if (type === 'expense') {
        // Check Valid Name
        const transactions = getTransactions();
        const exists = transactions.some(tr => tr.type === 'income' && tr.desc.toLowerCase() === desc.toLowerCase());
        if (!exists) return showAlert(`Obat "${desc}" tidak dikenali / belum ada stok masuk.`);

        // Check Stock
        const st = getStock(desc);
        if (st.cur <= 0) return showAlert(`Stok "${desc}" Kosong.`);
        if (amount > st.cur) return showAlert(`Stok kurang! Sisa: ${st.cur}`);
    }

    const btn = document.querySelector('#transactionForm button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true; btn.innerText = 'Menyimpan...';

    try {
        await addTransaction(d, type, desc, amount);

        document.getElementById('descInput').value = '';
        document.getElementById('amountInput').value = '';

        // Reset Search
        document.getElementById('filterName').value = '';
        document.getElementById('filterStart').value = '';
        document.getElementById('filterEnd').value = '';
        updateUI();

    } catch (e) {
        showAlert("Gagal simpan");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
});
