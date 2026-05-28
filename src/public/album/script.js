// =====================================================
//  MI ÁLBUM - script.js (rediseñado)
// =====================================================

const DICCIONARIO = {
    "FWC": { nombre:"FIFA",           grupo:"FIFA", max:19, extra:["00"] },
    "MEX": { nombre:"México",         grupo:"A",  max:20 },
    "RSA": { nombre:"Sudáfrica",      grupo:"A",  max:20 },
    "KOR": { nombre:"Corea del Sur",  grupo:"A",  max:20 },
    "CZE": { nombre:"Rep. Checa",     grupo:"A",  max:20 },
    "CAN": { nombre:"Canadá",         grupo:"B",  max:20 },
    "BIH": { nombre:"Bosnia y Herz.", grupo:"B",  max:20 },
    "QAT": { nombre:"Catar",          grupo:"B",  max:20 },
    "SUI": { nombre:"Suiza",          grupo:"B",  max:20 },
    "BRA": { nombre:"Brasil",         grupo:"C",  max:20 },
    "MAR": { nombre:"Marruecos",      grupo:"C",  max:20 },
    "HAI": { nombre:"Haití",          grupo:"C",  max:20 },
    "SCO": { nombre:"Escocia",        grupo:"C",  max:20 },
    "USA": { nombre:"Estados Unidos", grupo:"D",  max:20 },
    "PAR": { nombre:"Paraguay",       grupo:"D",  max:20 },
    "AUS": { nombre:"Australia",      grupo:"D",  max:20 },
    "TUR": { nombre:"Turquía",        grupo:"D",  max:20 },
    "GER": { nombre:"Alemania",       grupo:"E",  max:20 },
    "CUW": { nombre:"Curazao",        grupo:"E",  max:20 },
    "CIV": { nombre:"Costa de Marfil",grupo:"E",  max:20 },
    "ECU": { nombre:"Ecuador",        grupo:"E",  max:20 },
    "NED": { nombre:"Países Bajos",   grupo:"F",  max:20 },
    "JPN": { nombre:"Japón",          grupo:"F",  max:20 },
    "SWE": { nombre:"Suecia",         grupo:"F",  max:20 },
    "TUN": { nombre:"Túnez",          grupo:"F",  max:20 },
    "BEL": { nombre:"Bélgica",        grupo:"G",  max:20 },
    "EGY": { nombre:"Egipto",         grupo:"G",  max:20 },
    "IRN": { nombre:"Irán",           grupo:"G",  max:20 },
    "NZL": { nombre:"Nueva Zelanda",  grupo:"G",  max:20 },
    "ESP": { nombre:"España",         grupo:"H",  max:20 },
    "CPV": { nombre:"Cabo Verde",     grupo:"H",  max:20 },
    "KSA": { nombre:"Arabia Saudita", grupo:"H",  max:20 },
    "URU": { nombre:"Uruguay",        grupo:"H",  max:20 },
    "FRA": { nombre:"Francia",        grupo:"I",  max:20 },
    "SEN": { nombre:"Senegal",        grupo:"I",  max:20 },
    "IRQ": { nombre:"Irak",           grupo:"I",  max:20 },
    "NOR": { nombre:"Noruega",        grupo:"I",  max:20 },
    "ARG": { nombre:"Argentina",      grupo:"J",  max:20 },
    "ALG": { nombre:"Argelia",        grupo:"J",  max:20 },
    "AUT": { nombre:"Austria",        grupo:"J",  max:20 },
    "JOR": { nombre:"Jordania",       grupo:"J",  max:20 },
    "POR": { nombre:"Portugal",       grupo:"K",  max:20 },
    "COD": { nombre:"R.D. del Congo", grupo:"K",  max:20 },
    "UZB": { nombre:"Uzbekistán",     grupo:"K",  max:20 },
    "COL": { nombre:"Colombia",       grupo:"K",  max:20 },
    "ENG": { nombre:"Inglaterra",     grupo:"L",  max:20 },
    "CRO": { nombre:"Croacia",        grupo:"L",  max:20 },
    "GHA": { nombre:"Ghana",          grupo:"L",  max:20 },
    "PAN": { nombre:"Panamá",         grupo:"L",  max:20 },
    "CC":  { nombre:"Coca-Cola",      grupo:"CC", max:14 }
};

const ORDER = ['FIFA','A','B','C','D','E','F','G','H','I','J','K','L','CC'];

let albumSet = new Set();
let sortMode = 'default';
let currentFilter = 'all';
let toastTimer = null;

// ── INIT ─────────────────────────────────────────────
async function init() {
    document.getElementById('albumContent').innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Cargando álbum...</p>
        </div>`;
    try {
        const res = await fetch('/api/album');
        if (res.ok) {
            const data = await res.json();
            for (const l of data) albumSet.add(l.codigo.trim().toUpperCase());
        }
    } catch(e) { console.warn('Sin servidor'); }
    renderAlbum();
    updateStats();
}

function getCodigos(prefijo, info) {
    const list = [];
    if (info.extra) for (const ex of info.extra) list.push(`${prefijo} ${ex}`);
    for (let i = 1; i <= info.max; i++) list.push(`${prefijo} ${String(i).padStart(2,'0')}`);
    return list;
}

// ── TOGGLE LÁMINA ────────────────────────────────────
async function toggleLamina(codigo, el) {
    const tengo = albumSet.has(codigo);
    if (tengo) {
        albumSet.delete(codigo);
        el.className = 'sticker s-miss';
        showToast(`${codigo} — quitada`, 'rem');
        try { await fetch(`/api/album/${encodeURIComponent(codigo)}`, { method:'DELETE' }); } catch(e) {}
    } else {
        albumSet.add(codigo);
        el.className = 'sticker s-have';
        showToast(`${codigo} — pegada ✓`, 'add');
        try {
            await fetch('/api/album', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ codigos:[codigo] })
            });
        } catch(e) {}
    }
    // Actualizar contador y badge de la card
    const card = el.closest('.team-card');
    if (card) {
        const total = card.querySelectorAll('.sticker').length;
        const now   = card.querySelectorAll('.s-have').length;
        card.querySelector('.team-count').innerHTML = `<b>${now}</b>/${total}`;
        if (now === total) {
            card.classList.add('complete');
            if (!card.querySelector('.complete-badge')) {
                card.querySelector('.team-meta').insertAdjacentHTML('beforeend',
                    '<span class="complete-badge">✓ Completo</span>');
            }
        } else {
            card.classList.remove('complete');
            const badge = card.querySelector('.complete-badge');
            if (badge) badge.remove();
        }
    }
    updateStats();
}

// ── RENDER ────────────────────────────────────────────
function renderAlbum() {
    const grupos = {};
    for (const [pref, info] of Object.entries(DICCIONARIO)) {
        if (!grupos[info.grupo]) grupos[info.grupo] = [];
        grupos[info.grupo].push({ pref, info });
    }

    const listaGrupos = Object.keys(grupos).map(grupo => {
        const equipos = grupos[grupo];
        let totalG = 0, tengoG = 0;
        for (const {pref, info} of equipos) {
            const c = getCodigos(pref, info);
            totalG += c.length;
            tengoG += c.filter(cod => albumSet.has(cod)).length;
        }
        return { nombre: grupo, equipos, totalG, tengoG };
    });

    if (sortMode === 'desc') {
        listaGrupos.sort((a,b) => b.tengoG - a.tengoG);
    } else if (sortMode === 'asc') {
        listaGrupos.sort((a,b) => a.tengoG - b.tengoG);
    } else {
        listaGrupos.sort((a,b) => ORDER.indexOf(a.nombre) - ORDER.indexOf(b.nombre));
    }

    let html = '<div class="album-grid">';

    for (const {nombre, equipos, totalG, tengoG} of listaGrupos) {
        const label = nombre === 'FIFA' ? 'Sección FIFA' : nombre === 'CC' ? 'Coca-Cola' : `Grupo ${nombre}`;

        html += `<div class="group-section" data-grupo="${nombre}">
            <div class="group-header">
                <span class="group-badge">${nombre === 'FIFA' || nombre === 'CC' ? nombre : 'GRP ' + nombre}</span>
                <span class="group-title">${label}</span>
                <span class="group-count"><b>${tengoG}</b>/${totalG}</span>
            </div>
            <div class="teams-row">`;

        for (const {pref, info} of equipos) {
            const codigos = getCodigos(pref, info);
            const tengo = codigos.filter(c => albumSet.has(c)).length;
            const isComplete = tengo === codigos.length;

            let stickers = codigos.map(cod => {
                const cls = albumSet.has(cod) ? 's-have' : 's-miss';
                const num = cod.replace(pref,'').trim();
                return `<div class="sticker ${cls}" onclick="toggleLamina('${cod}',this)" title="${cod}">${num === '00' ? '00' : parseInt(num)}</div>`;
            }).join('');

            html += `<div class="team-card${isComplete ? ' complete' : ''}" data-search="${info.nombre.toLowerCase()} ${pref.toLowerCase()}">
                <div class="team-header">
                    <div>
                        <span class="team-name">${info.nombre}</span>
                        <div class="team-meta">
                            <span class="team-code">${pref}</span>
                            <span class="team-grupo">${nombre === 'FIFA' || nombre === 'CC' ? nombre : 'G-' + nombre}</span>
                            ${isComplete ? '<span class="complete-badge">✓ Completo</span>' : ''}
                        </div>
                    </div>
                    <span class="team-count"><b>${tengo}</b>/${codigos.length}</span>
                </div>
                <div class="team-stickers">${stickers}</div>
            </div>`;
        }
        html += '</div></div>';
    }
    html += '</div>';

    document.getElementById('albumContent').innerHTML = html;
    applySearch();
}

function updateStats() {
    let total=0, tengo=0;
    for (const [pref,info] of Object.entries(DICCIONARIO)) {
        const c = getCodigos(pref,info);
        total += c.length;
        tengo += c.filter(cod=>albumSet.has(cod)).length;
    }
    const pct = total>0 ? Math.round((tengo/total)*100) : 0;
    document.getElementById('statTotal').textContent  = total;
    document.getElementById('statTengo').textContent  = tengo;
    document.getElementById('statFaltan').textContent = total - tengo;
    document.getElementById('progBar').style.width    = pct+'%';
    document.getElementById('statPct').textContent    = pct+'%';
}

// ── FILTROS ───────────────────────────────────────────
function setFilter(tipo, btn) {
    currentFilter = tipo;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('albumContent').className = `filter-${tipo}`;
}

function applySearch() {
    const q = document.getElementById('searchInput').value.toLowerCase().trim();
    document.querySelectorAll('.team-card').forEach(card => {
        const match = !q || card.dataset.search.includes(q);
        card.style.display = match ? '' : 'none';
    });
    document.querySelectorAll('.group-section').forEach(sec => {
        const hasVisible = [...sec.querySelectorAll('.team-card')].some(c => c.style.display !== 'none');
        sec.style.display = hasVisible ? '' : 'none';
    });
}

function toggleSort() {
    const btn = document.getElementById('btnSort');
    if (sortMode === 'default') {
        sortMode = 'desc';
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M6 12h12M9 18h6"/></svg> Más tengo`;
    } else if (sortMode === 'desc') {
        sortMode = 'asc';
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M6 12h12M9 18h6"/></svg> Menos tengo`;
    } else {
        sortMode = 'default';
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M6 12h12M9 18h6"/></svg> Defecto`;
    }
    renderAlbum();
}

function showToast(msg, tipo) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast t-${tipo} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{ t.className='toast'; }, 1700);
}

init();