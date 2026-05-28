// ===== HISTORIAL · Mundial 2026 =====
// Compara snapshots actuales de laminas.json y album.json con
// una copia guardada en localStorage para generar un log de cambios.

const STORAGE_KEY_LAMINAS = 'historial_laminas_snapshot';
const STORAGE_KEY_ALBUM = 'historial_album_snapshot';
const STORAGE_KEY_LOG = 'historial_log';

async function fetchLaminas() {
    try {
        const res = await fetch('/api/laminas');
        return res.ok ? await res.json() : [];
    } catch(e) { return []; }
}

async function fetchAlbum() {
    try {
        const res = await fetch('/api/album');
        return res.ok ? await res.json() : [];
    } catch(e) { return []; }
}

let allLog = [];
let currentFilter = 'all';
let currentSearch = '';

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
    await cargarHistorial();
    renderLog();
    setupControls();
});

// ============ FETCH DATA ============
async function cargarHistorial() {
    try {
        const res = await fetch('/api/historial');
        allLog = res.ok ? await res.json() : [];
        updateStats();
    } catch(e) {
        console.warn('No se pudo cargar el historial del servidor.');
        allLog = [];
    }
}

// ============ SYNC & BUILD LOG ============
async function syncAndBuild() {
    const [laminasActuales, albumActuales] = await Promise.all([fetchLaminas(), fetchAlbum()]);

    const snapshotLaminas = JSON.parse(localStorage.getItem(STORAGE_KEY_LAMINAS) || '[]');
    const snapshotAlbum   = JSON.parse(localStorage.getItem(STORAGE_KEY_ALBUM)   || '[]');
    let log               = JSON.parse(localStorage.getItem(STORAGE_KEY_LOG)      || '[]');

    const now = Date.now();

    // --- Detectar cambios en LÁMINAS REPETIDAS ---
    const mapaAntes = Object.fromEntries(snapshotLaminas.map(l => [l.codigo, l.cantidad]));
    const mapaAhora = Object.fromEntries(laminasActuales.map(l => [l.codigo, l.cantidad]));

    for (const l of laminasActuales) {
        const antes = mapaAntes[l.codigo];
        if (antes === undefined) {
            log.unshift({ id: uid(), ts: now, tipo: 'add', fuente: 'laminas', codigo: l.codigo, pais: l.pais, cantidad: l.cantidad, detalle: `+${l.cantidad} unidades` });
        } else if (antes !== l.cantidad) {
            const delta = l.cantidad - antes;
            log.unshift({ id: uid(), ts: now, tipo: 'edit', fuente: 'laminas', codigo: l.codigo, pais: l.pais, cantidad: l.cantidad, detalle: `${delta > 0 ? '+' : ''}${delta} → ahora ${l.cantidad}` });
        }
    }
    for (const l of snapshotLaminas) {
        if (mapaAhora[l.codigo] === undefined) {
            log.unshift({ id: uid(), ts: now, tipo: 'remove', fuente: 'laminas', codigo: l.codigo, pais: l.pais, cantidad: 0, detalle: 'Eliminada del stock' });
        }
    }

    // --- Detectar cambios en ÁLBUM ---
    const setAntes = new Set(snapshotAlbum.map(l => l.codigo));
    const setAhora = new Set(albumActuales.map(l => l.codigo));

    for (const l of albumActuales) {
        if (!setAntes.has(l.codigo)) {
            log.unshift({ id: uid(), ts: now, tipo: 'album-add', fuente: 'album', codigo: l.codigo, pais: l.pais, detalle: 'Pegada en el álbum' });
        }
    }
    for (const l of snapshotAlbum) {
        if (!setAhora.has(l.codigo)) {
            log.unshift({ id: uid(), ts: now, tipo: 'album-remove', fuente: 'album', codigo: l.codigo, pais: l.pais, detalle: 'Quitada del álbum' });
        }
    }

    // Guardar snapshot actualizado + log (máx 500 entradas)
    log = log.slice(0, 500);
    localStorage.setItem(STORAGE_KEY_LAMINAS, JSON.stringify(laminasActuales));
    localStorage.setItem(STORAGE_KEY_ALBUM,   JSON.stringify(albumActuales));
    localStorage.setItem(STORAGE_KEY_LOG,     JSON.stringify(log));

    allLog = log;
    updateStats();
}

// ============ RENDER ============
function renderLog() {
    const container = document.getElementById('logContainer');
    const empty     = document.getElementById('emptyState');

    let filtered = allLog.filter(entry => {
        if (currentFilter === 'laminas' && entry.fuente !== 'laminas') return false;
        if (currentFilter === 'album'   && entry.fuente !== 'album')   return false;
        if (currentFilter === 'add'     && entry.tipo !== 'add' && entry.tipo !== 'album-add') return false;
        if (currentFilter === 'remove'  && entry.tipo !== 'remove' && entry.tipo !== 'album-remove') return false;
        if (currentFilter === 'edit'    && entry.tipo !== 'edit') return false;
        if (currentSearch) {
            const q = currentSearch.toLowerCase();
            if (!entry.codigo.toLowerCase().includes(q) && !entry.pais.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    // Group by date
    let html = '';
    let lastDate = '';
    for (const entry of filtered) {
        const dateLabel = formatDate(entry.ts);
        if (dateLabel !== lastDate) {
            html += `<div class="date-separator"><span class="date-line"></span><span>${dateLabel}</span><span class="date-line"></span></div>`;
            lastDate = dateLabel;
        }
        html += buildEntry(entry);
    }

    container.innerHTML = html;
}

function buildEntry(e) {
    const time = formatTime(e.ts);
    const { badgeClass, badgeText } = getBadge(e.tipo);
    const sourceClass = e.fuente === 'laminas' ? 'source-laminas' : 'source-album';
    const sourceText  = e.fuente === 'laminas' ? 'REPETIDAS' : 'ÁLBUM';
    const sub = e.cantidad !== undefined ? `${e.detalle}` : e.detalle;

    return `<div class="log-entry" data-id="${e.id}">
        <span class="log-time">${time}</span>
        <span class="log-badge ${badgeClass}">${badgeText}</span>
        <div class="log-content">
            <div class="log-main">${e.pais} · <span style="font-family:var(--font-mono);font-size:0.82em;color:var(--accent)">${e.codigo}</span></div>
            <div class="log-sub">${sub}</div>
        </div>
        <span class="log-source ${sourceClass}">${sourceText}</span>
    </div>`;
}

function getBadge(tipo) {
    switch (tipo) {
        case 'add':          return { badgeClass: 'badge-add',          badgeText: '+ ADD' };
        case 'remove':       return { badgeClass: 'badge-remove',       badgeText: '− DEL' };
        case 'edit':         return { badgeClass: 'badge-edit',         badgeText: '~ EDIT' };
        case 'album-add':    return { badgeClass: 'badge-album-add',    badgeText: '⊕ PEG' };
        case 'album-remove': return { badgeClass: 'badge-album-remove', badgeText: '⊖ QUI' };
        default:             return { badgeClass: '', badgeText: '?' };
    }
}


// ============ STATS ============
function updateStats() {
    const total  = allLog.length;
    const added  = allLog.filter(e => e.tipo === 'add' || e.tipo === 'album-add').length;
    const removed = allLog.filter(e => e.tipo === 'remove' || e.tipo === 'album-remove').length;
    const edited = allLog.filter(e => e.tipo === 'edit').length;

    document.getElementById('stat-total').textContent  = total;
    document.getElementById('stat-add').textContent    = added;
    document.getElementById('stat-remove').textContent = removed;
    document.getElementById('stat-edit').textContent   = edited;
}

// ============ CONTROLS ============
function setupControls() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderLog();
        });
    });

    document.getElementById('searchInput').addEventListener('input', e => {
        currentSearch = e.target.value.trim();
        renderLog();
    });
}

// ============ HELPERS ============
function uid() { return Math.random().toString(36).slice(2, 9); }

function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

// ============ AUTO-SYNC ============
setInterval(syncAndBuild, 10000); // Auto-sync every 10 seconds