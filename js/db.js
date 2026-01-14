import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, colName } from "./config.js";

let transactions = [];
let unsubscribe;
let reportCache = {};

let onUpdateUI = () => { };
let onRenderMonth = () => { };

export function setupDBCallbacks(updateUICb, renderMonthCb) {
    onUpdateUI = updateUICb;
    onRenderMonth = renderMonthCb;
}

function initData() {
    document.getElementById('loadingSpinner').style.display = 'block';
    // Lazy Load: Limit initial fetch to 100
    if (unsubscribe) unsubscribe();
    unsubscribe = onSnapshot(query(collection(db, colName), orderBy("date", "desc")), (s) => {
        transactions = [];
        s.docs.forEach(d => transactions.push({ ...d.data(), id: d.id }));
        document.getElementById('loadingSpinner').style.display = 'none';
        if (onUpdateUI) onUpdateUI();
    });
}

function getTransactions() {
    return transactions;
}

async function addTransaction(date, type, desc, amount) {
    await addDoc(collection(db, colName), { date, type, desc, amount, timestamp: Date.now() });
}

async function removeTransaction(id) {
    await deleteDoc(doc(db, colName, id));
}

function getStock(n) {
    const f = transactions.filter(t => t.desc.toLowerCase() === n.toLowerCase().trim());
    const i = f.filter(x => x.type === 'income').reduce((a, b) => a + b.amount, 0);
    const e = f.filter(x => x.type === 'expense').reduce((a, b) => a + b.amount, 0);
    return { cur: i - e };
}

async function loadMonthData(year, monthKey, monthName) {
    const container = document.getElementById(`content-${monthKey}`);
    if (!container) return;

    // If already loaded (check cache), do nothing (or re-render if needed)
    if (reportCache[monthKey]) {
        if (onRenderMonth) onRenderMonth(reportCache[monthKey], container, year, monthKey);
        return;
    }

    // Fetch
    try {
        const daysInMonth = new Date(year, parseInt(monthKey.split('-')[1]), 0).getDate();
        const startStr = `${monthKey}-01`;
        const endStr = `${monthKey}-${daysInMonth}`;

        const q = query(collection(db, colName), where("date", ">=", startStr), where("date", "<=", endStr));
        const snap = await getDocs(q);

        const data = [];
        snap.forEach(d => data.push({ ...d.data(), id: d.id }));

        reportCache[monthKey] = data;
        if (onRenderMonth) onRenderMonth(data, container, year, monthKey);

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="text-center py-3 text-danger">Gagal memuat data.</div>`;
    }
}

function getReportCache(key) {
    return reportCache[key];
}

function setReportCache(key, data) {
    reportCache[key] = data;
}

export { initData, getTransactions, addTransaction, removeTransaction, getStock, loadMonthData, getReportCache, setReportCache };
