let serverDate = new Date().toISOString().split('T')[0]; // Fallback to local

async function fetchServerDate() {
    try {
        const res = await fetch('https://worldtimeapi.org/api/timezone/Asia/Jakarta');
        const data = await res.json();
        serverDate = data.datetime.split('T')[0];
        const dateInput = document.getElementById('dateInput');
        if (dateInput) dateInput.max = serverDate;
    } catch (e) {
        console.error("Failed to fetch server time, using local time fallback.", e);
        const dateInput = document.getElementById('dateInput');
        if (dateInput) dateInput.max = serverDate;
    }
}

function fmtNum(n) { return new Intl.NumberFormat('id-ID').format(n) }
function fmtDate(d) { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) }
function fmtShort(d) { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) }

function showAlert(m) {
    const a = document.getElementById('alertMessage');
    a.innerText = m;
    a.classList.remove('d-none');
    setTimeout(() => a.classList.add('d-none'), 3000)
}

function showToast(msg) {
    const x = document.getElementById("customToast");
    document.getElementById("toastMessage").innerText = msg;
    x.className = "show";
    setTimeout(function () { x.className = x.className.replace("show", ""); }, 3000);
}

export { serverDate, fetchServerDate, fmtNum, fmtDate, fmtShort, showAlert, showToast };
