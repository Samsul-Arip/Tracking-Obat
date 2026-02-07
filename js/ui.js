import { fmtNum, fmtDate } from "./utils.js";
import { getTransactions, loadMonthData, getReportCache, setReportCache } from "./db.js";
import { db, colName } from "./config.js";
import { query, collection, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentViewType = 'all';
let currentPage = 1;
const itemsPerPage = 10;

function setView(view) {
    currentViewType = view;
    currentPage = 1;
    updateUI();
}

function changePage(delta) {
    currentPage += delta;
    updateUI();
}

function updateUI() {
    // Reset active states
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.card-summary').forEach(el => el.classList.remove('active-card'));

    // Mapping View
    if (currentViewType === 'report') {
        document.getElementById('nav-report').classList.add('active');
        document.getElementById('mob-report').classList.add('active');
        document.getElementById('view-transaction').classList.add('d-none');
        document.getElementById('view-report').classList.remove('d-none');
        document.getElementById('pageTitle').innerHTML = '<i class="bi bi-journal-text me-2"></i>Laporan Bulanan';
        renderStock(getFilteredData('all'));
    } else {
        document.getElementById('view-transaction').classList.remove('d-none');
        document.getElementById('view-report').classList.add('d-none');

        if (currentViewType === 'income') {
            document.getElementById('nav-income').classList.add('active');
            document.getElementById('mob-income').classList.add('active');
            document.getElementById('card-income').classList.add('active-card');
            document.getElementById('pageTitle').innerHTML = '<i class="bi bi-box-arrow-in-down me-2"></i>Data Pemasukan';
            document.getElementById('tableTitle').innerText = '📥 Daftar Barang Masuk';
        } else if (currentViewType === 'expense') {
            document.getElementById('nav-expense').classList.add('active');
            document.getElementById('mob-expense').classList.add('active');
            document.getElementById('card-expense').classList.add('active-card');
            document.getElementById('pageTitle').innerHTML = '<i class="bi bi-box-arrow-up me-2"></i>Data Pengeluaran';
            document.getElementById('tableTitle').innerText = '📤 Daftar Barang Keluar';
        } else {
            document.getElementById('nav-dashboard').classList.add('active');
            document.getElementById('mob-dashboard').classList.add('active');
            document.getElementById('card-all').classList.add('active-card');
            document.getElementById('pageTitle').innerHTML = '<i class="bi bi-grid-fill me-2"></i>Semua Transaksi';
            document.getElementById('tableTitle').innerText = '📅 Semua Riwayat';
        }
        renderHist(getFilteredData(currentViewType));
    }

    // Totals (Always based on filter only)
    const baseData = getFilteredData('all');
    const i = baseData.filter(x => x.type === 'income').reduce((a, b) => a + b.amount, 0);
    const e = baseData.filter(x => x.type === 'expense').reduce((a, b) => a + b.amount, 0);
    document.getElementById('totalIncome').innerText = fmtNum(i);
    document.getElementById('totalExpense').innerText = fmtNum(e);
    document.getElementById('netBalance').innerText = fmtNum(i - e);

    const fs = document.getElementById('filterStart').value, fe = document.getElementById('filterEnd').value;
    document.getElementById('periodeLabel').innerText = (fs && fe) ? `Periode: ${fmtDate(fs)} - ${fmtDate(fe)}` : "Periode: Semua Waktu";
}

function getFilteredData(forceType) {
    const transactions = getTransactions();
    const s = document.getElementById('filterStart').value, e = document.getElementById('filterEnd').value, n = document.getElementById('filterName').value.toLowerCase().trim();
    const typeToFilter = forceType || currentViewType;
    return transactions.filter(t => {
        let dm = true; if (s && e) { const d = new Date(t.date), ed = new Date(e); ed.setHours(23, 59, 59); dm = d >= new Date(s) && d <= ed; }
        const nm = (!n || t.desc.toLowerCase().includes(n));
        let tm = true;
        if (typeToFilter === 'income') tm = t.type === 'income';
        if (typeToFilter === 'expense') tm = t.type === 'expense';
        return dm && nm && tm;
    });
}

function renderHist(d) {
    const l = document.getElementById('transactionList'); l.innerHTML = '';
    const p = document.getElementById('paginationControls');

    if (d.length === 0) {
        document.getElementById('emptyStateHistory').style.display = 'block';
        p.classList.add('d-none');
        return;
    }
    document.getElementById('emptyStateHistory').style.display = 'none';

    // Sort Newest -> Oldest (No reverse needed)
    d.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Pagination Logic
    const totalPages = Math.ceil(d.length / itemsPerPage);
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const sliced = d.slice(start, end);

    sliced.forEach(x => {
        const c = x.type === 'income' ? 'text-success' : 'text-danger', s = x.type === 'income' ? '+' : '-', b = x.type === 'income' ? 'Masuk' : 'Keluar', bg = x.type === 'income' ? 'bg-success' : 'bg-danger';
        l.innerHTML += `<tr><td>${fmtDate(x.date)}</td><td class="fw-bold">${x.desc}</td><td><span class="badge ${bg}">${b}</span></td><td class="text-end fw-bold ${c}">${s} ${fmtNum(x.amount)}</td><td class="text-center"><button class="btn btn-sm text-danger" onclick="window.removeTransaction('${x.id}')"><i class="bi bi-trash"></i></button></td></tr>`;
    });

    // Update Pagination Controls
    if (totalPages > 1) {
        p.classList.remove('d-none');
        document.getElementById('pageIndicator').innerText = `Page ${currentPage} / ${totalPages}`;
        document.getElementById('btnPrev').disabled = currentPage === 1;
        document.getElementById('btnNext').disabled = currentPage === totalPages;
    } else {
        p.classList.add('d-none');
    }
}

function renderStock(d) {
    // NOTE: 'd' is ignored here because we generate structure statically for lazy loading
    const c = document.getElementById('yearAccordion'); c.innerHTML = '';
    document.getElementById('emptyStateStock').style.display = 'none';

    // Generate last 3 years
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];

    years.forEach((y, yi) => {
        const yid = `y-${y}`;
        const showYear = (yi === 0) ? 'show' : '';

        let h = `<button class="btn-year-custom ${(showYear ? '' : 'collapsed')}" type="button" data-bs-toggle="collapse" data-bs-target="#${yid}" aria-expanded="${showYear ? 'true' : 'false'}">
                    <span><i class="bi bi-calendar-week-fill me-2"></i> Tahun ${y}</span>
                    <i class="bi bi-chevron-down icon-rotate"></i>
                 </button>
                 <div id="${yid}" class="collapse ${showYear}">
                    <div class="year-content-body">`;

        // Months (Dec down to Jan)
        for (let m = 12; m >= 1; m--) {
            const mk = `${y}-${String(m).padStart(2, '0')}`;
            const mid = `m-${mk}`;
            const mName = new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long' });

            // Check if we should auto-expand (Current Month of Current Year)
            const isCurrentMonth = (y === currentYear && m === (new Date().getMonth() + 1));
            const showMonth = isCurrentMonth ? 'show' : '';

            h += `<div class="d-flex justify-content-between align-items-center mb-2">
                    <button class="btn-month-custom collapsed flex-grow-1 me-2" type="button" 
                        data-bs-toggle="collapse" data-bs-target="#${mid}" aria-expanded="false"
                        onclick="window.loadMonthData('${y}', '${mk}', '${mName}')">
                        <span><i class="bi bi-calendar-month me-2"></i> ${mName}</span>
                        <i class="bi bi-chevron-down icon-rotate"></i>
                    </button>
                    <button class="btn btn-success btn-sm" onclick="window.downloadExcel('${y}', '${mk}', '${mName}')" title="Export Excel">
                        <i class="bi bi-file-earmark-excel"></i>
                    </button>
                  </div>
                  <div id="${mid}" class="collapse mb-3">
                    <div id="content-${mk}" class="table-responsive ms-2 border rounded p-0 bg-white min-vh-25">
                        <div class="text-center py-4 text-muted small"><div class="spinner-border spinner-border-sm text-danger mb-2"></div><br>Memuat Data...</div>
                    </div>
                  </div>`;
        }
        h += `</div></div>`;
        c.insertAdjacentHTML('beforeend', h);
    });
}

function renderMonthTable(data, container, year, monthKey, openingStocks = {}) {
    if (data.length === 0 && Object.keys(openingStocks).length === 0) {
        container.innerHTML = `<div class="text-center py-4 text-muted fst-italic">Tidak ada transaksi bulan ini.</div>`;
        return;
    }

    const daysInMonth = new Date(year, parseInt(monthKey.split('-')[1]), 0).getDate();
    // Combine unique meds from current month data AND opening stocks (some meds might have stock but no transactions this month)
    const uniqueMeds = [...new Set([...data.map(t => t.desc), ...Object.keys(openingStocks)])].sort();

    let h = `<table class="table table-bordered table-sm mb-0" style="font-size:0.75rem; min-width: 1200px;">
                <thead class="table-light text-center align-middle">
                    <tr>
                        <th rowspan="2" style="min-width:150px; position:sticky; left:0; z-index:10; background:#f8f9fa;">Nama Obat</th>
                        <th rowspan="2" style="min-width:80px; background:#e3f2fd;">Stok Awal</th>
                        <th colspan="${daysInMonth}">Tanggal</th>
                        <th colspan="2">Total</th>
                        <th rowspan="2" style="min-width:80px;">Sisa (Akhir)</th>
                    </tr>
                    <tr>`;

    for (let i = 1; i <= daysInMonth; i++) h += `<th style="min-width:30px;">${i}</th>`;
    h += `<th>Masuk</th><th>Keluar</th></tr></thead><tbody>`;

    uniqueMeds.forEach(med => {
        // Monthly Totals
        const monthTrans = data.filter(t => t.desc === med);
        const totInMonth = monthTrans.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
        const totOutMonth = monthTrans.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);

        const stokAwal = openingStocks[med] || 0;
        const sisa = stokAwal + totInMonth - totOutMonth;

        // Hide rows with 0 start, 0 in, 0 out (inactive)
        if (stokAwal === 0 && totInMonth === 0 && totOutMonth === 0) return;

        h += `<tr>
                <td class="fw-bold" style="position:sticky; left:0; background:white; z-index:5;">${med}</td>
                <td class="text-center fw-bold bg-light text-primary bg-opacity-10">${fmtNum(stokAwal)}</td>`;

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${monthKey}-${String(i).padStart(2, '0')}`;
            const dayTrans = monthTrans.filter(t => t.date === dateStr);
            let cellContent = '';
            if (dayTrans.length > 0) {
                const dIn = dayTrans.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
                const dOut = dayTrans.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
                if (dIn > 0) cellContent += `<div class="text-success">+${dIn}</div>`;
                if (dOut > 0) cellContent += `<div class="text-danger">-${dOut}</div>`;
            }
            h += `<td class="text-center p-1">${cellContent}</td>`;
        }

        h += `<td class="text-center fw-bold text-success bg-success bg-opacity-10">${totInMonth > 0 ? fmtNum(totInMonth) : '-'}</td>
              <td class="text-center fw-bold text-danger bg-danger bg-opacity-10">${totOutMonth > 0 ? fmtNum(totOutMonth) : '-'}</td>
              <td class="text-center fw-bold bg-light">${fmtNum(sisa)}</td>
              </tr>`;
    });

    h += `</tbody></table>`;
    container.innerHTML = h;
}

function setupAutocomplete(inputId, boxId) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(boxId);

    function showSuggestions(val) {
        const transactions = getTransactions();
        const unique = [...new Set(transactions.map(t => t.desc))].sort();
        const matches = unique.filter(n => n.toLowerCase().includes(val.toLowerCase()));

        box.innerHTML = '';
        if (matches.length > 0) {
            matches.forEach(name => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `<i class="bi bi-capsule"></i> ${name}`;
                div.onclick = () => {
                    input.value = name;
                    box.style.display = 'none';
                    if (inputId === 'filterName') updateUI(); // Auto search if filter
                };
                box.appendChild(div);
            });
            box.style.display = 'block';
        } else {
            box.style.display = 'none';
        }
    }

    input.addEventListener('input', (e) => showSuggestions(e.target.value));
    input.addEventListener('focus', (e) => showSuggestions(e.target.value)); // Show on click even if empty

    // Hide when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !box.contains(e.target)) {
            box.style.display = 'none';
        }
    });
}

async function downloadExcel(year, monthKey, monthName) {
    // Ensure data is loaded
    let data = getReportCache(monthKey);
    let openingStocks = {}; // We need to re-calculate this for excel

    // Recalculate opening stocks from global transactions
    const allTrans = getTransactions();
    const startOfThisMonth = `${monthKey}-01`;
    const historical = allTrans.filter(t => t.date < startOfThisMonth);
    historical.forEach(t => {
        if (!openingStocks[t.desc]) openingStocks[t.desc] = 0;
        if (t.type === 'income') openingStocks[t.desc] += t.amount;
        else openingStocks[t.desc] -= t.amount;
    });


    if (!data) {
        // Fetch if not cached
        try {
            const daysInMonth = new Date(year, parseInt(monthKey.split('-')[1]), 0).getDate();
            const startStr = `${monthKey}-01`;
            const endStr = `${monthKey}-${daysInMonth}`;
            const q = query(collection(db, colName), where("date", ">=", startStr), where("date", "<=", endStr));
            const snap = await getDocs(q);
            data = [];
            snap.forEach(d => data.push({ ...d.data(), id: d.id }));

            // Note: We don't cache here because db.js handles caching, but we need data now.
        } catch (e) {
            alert("Gagal mengambil data untuk export.");
            return;
        }
    }

    const daysInMonth = new Date(year, parseInt(monthKey.split('-')[1]), 0).getDate();

    // Combine med names
    const uniqueMeds = [...new Set([...data.map(t => t.desc), ...Object.keys(openingStocks)])].sort();

    // Prepare Headers (2 Rows)
    const header1 = ["Nama Obat", "Stok Awal", "Tanggal"];
    for (let i = 1; i < daysInMonth; i++) header1.push(""); // Spacers for Tanggal
    header1.push("Total", "", "Sisa Akhir");

    const header2 = ["", ""]; // Spacer for Nama Obat & Stok Awal
    for (let i = 1; i <= daysInMonth; i++) header2.push(`${i}`);
    header2.push("Masuk", "Keluar", ""); // Spacer for Sisa

    const excelData = [header1, header2];

    // Merges
    const merges = [
        { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // Nama Obat
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Stok Awal
        { s: { r: 0, c: 2 }, e: { r: 0, c: daysInMonth + 1 } }, // Tanggal (1 to N)
        { s: { r: 0, c: daysInMonth + 2 }, e: { r: 0, c: daysInMonth + 3 } }, // Total
        { s: { r: 0, c: daysInMonth + 4 }, e: { r: 1, c: daysInMonth + 4 } } // Sisa
    ];

    uniqueMeds.forEach(med => {
        const stokAwal = openingStocks[med] || 0;

        // Monthly Totals
        const monthTrans = data.filter(t => t.desc === med);
        const totInMonth = monthTrans.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
        const totOutMonth = monthTrans.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);

        // Filter out inactive
        if (stokAwal === 0 && totInMonth === 0 && totOutMonth === 0) return;

        const row = [med, stokAwal];

        // Daily Data
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${monthKey}-${String(i).padStart(2, '0')}`;
            const dayTrans = monthTrans.filter(t => t.date === dateStr);
            const dIn = dayTrans.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
            const dOut = dayTrans.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);

            let cellVal = "";
            if (dIn > 0) cellVal += `+${dIn}\n`;
            if (dOut > 0) cellVal += `-${dOut}`;
            row.push(cellVal.trim());
        }

        // Cumulative Sisa
        const sisa = stokAwal + totInMonth - totOutMonth;

        row.push(totInMonth, totOutMonth, sisa);
        excelData.push(row);
    });

    // Create Workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Apply Merges
    ws['!merges'] = merges;

    // Freeze Panes
    ws['!freeze'] = { xSplit: 2, ySplit: 2, topLeftCell: "C3", activePane: "bottomRight", state: "frozen" };

    // Auto-width
    const wscols = [{ wch: 25 }, { wch: 10 }]; // Name, Stok Awal
    for (let i = 0; i < daysInMonth; i++) wscols.push({ wch: 5 }); // Dates
    wscols.push({ wch: 12 }, { wch: 12 }, { wch: 10 }); // Totals
    ws['!cols'] = wscols;

    // STYLING
    const range = XLSX.utils.decode_range(ws['!ref']);

    const borderStyle = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

    const headerStyle = {
        font: { bold: true, color: { rgb: "880E4F" } },
        fill: { fgColor: { rgb: "FCE4EC" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: borderStyle
    };

    const cellStyle = {
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: borderStyle
    };

    const nameStyle = {
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        border: borderStyle,
        font: { bold: true }
    };

    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = { c: C, r: R };
            const cell_ref = XLSX.utils.encode_cell(cell_address);

            if (!ws[cell_ref]) continue;

            // Apply Styles
            if (R < 2) {
                ws[cell_ref].s = headerStyle;
            } else if (C === 0) {
                ws[cell_ref].s = nameStyle;
            } else {
                ws[cell_ref].s = cellStyle;
            }
        }
    }

    XLSX.utils.book_append_sheet(wb, ws, monthName);
    XLSX.writeFile(wb, `Laporan_Stok_${monthName}_${year}.xlsx`);
}

export { updateUI, renderHist, renderStock, renderMonthTable, setupAutocomplete, downloadExcel, setView, changePage };
