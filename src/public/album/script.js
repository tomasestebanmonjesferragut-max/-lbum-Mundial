const DICCIONARIO = {
    "FWC": { nombre:"FIFA",           grupo:"FIFA", max:19, extra:["00"] },
    "MEX": { nombre:"México",         grupo:"A",  max:20 },
    "RSA": { nombre:"Sudáfrica",        grupo:"A",  max:20 },
    "KOR": { nombre:"Corea del Sur",    grupo:"A",  max:20 },
    "CZE": { nombre:"Rep. Checa",        grupo:"A",  max:20 },
    "CAN": { nombre:"Canadá",           grupo:"B",  max:20 },
    "BIH": { nombre:"Bosnia y Herz.",    grupo:"B",  max:20 },
    "QAT": { nombre:"Catar",            grupo:"B",  max:20 },
    "SUI": { nombre:"Suiza",            grupo:"B",  max:20 },
    "BRA": { nombre:"Brasil",           grupo:"C",  max:20 },
    "MAR": { nombre:"Marruecos",        grupo:"C",  max:20 },
    "HAI": { nombre:"Haití",            grupo:"C",  max:20 },
    "SCO": { nombre:"Escocia",          grupo:"C",  max:20 },
    "USA": { nombre:"Estados Unidos",    grupo:"D",  max:20 },
    "PAR": { nombre:"Paraguay",          grupo:"D",  max:20 },
    "AUS": { nombre:"Australia",        grupo:"D",  max:20 },
    "TUR": { nombre:"Turquía",          grupo:"D",  max:20 },
    "GER": { nombre:"Alemania",          grupo:"E",  max:20 },
    "CUW": { nombre:"Curazao",          grupo:"E",  max:20 },
    "CIV": { nombre:"Costa de Marfil",  grupo:"E",  max:20 },
    "ECU": { nombre:"Ecuador",          grupo:"E",  max:20 },
    "NED": { nombre:"Países Bajos",      grupo:"F",  max:20 },
    "JPN": { nombre:"Japón",            grupo:"F",  max:20 },
    "SWE": { nombre:"Suecia",           grupo:"F",  max:20 },
    "TUN": { nombre:"Túnez",            grupo:"F",  max:20 },
    "BEL": { nombre:"Bélgica",          grupo:"G",  max:20 },
    "EGY": { nombre:"Egipto",           grupo:"G",  max:20 },
    "IRN": { nombre:"Irán",             grupo:"G",  max:20 },
    "NZL": { nombre:"Nueva Zelanda",    grupo:"G",  max:20 },
    "ESP": { nombre:"España",           grupo:"H",  max:20 },
    "CPV": { nombre:"Cabo Verde",        grupo:"H",  max:20 },
    "KSA": { nombre:"Arabia Saudita",    grupo:"H",  max:20 },
    "URU": { nombre:"Uruguay",          grupo:"H",  max:20 },
    "FRA": { nombre:"Francia",          grupo:"I",  max:20 },
    "SEN": { nombre:"Senegal",          grupo:"I",  max:20 },
    "IRQ": { nombre:"Irak",             grupo:"I",  max:20 },
    "NOR": { nombre:"Noruega",          grupo:"I",  max:20 },
    "ARG": { nombre:"Argentina",        grupo:"J",  max:20 },
    "ALG": { nombre:"Argelia",          grupo:"J",  max:20 },
    "AUT": { nombre:"Austria",          grupo:"J",  max:20 },
    "JOR": { nombre:"Jordania",          grupo:"J",  max:20 },
    "POR": { nombre:"Portugal",          grupo:"K",  max:20 },
    "COD": { nombre:"R.D. del Congo",    grupo:"K",  max:20 },
    "UZB": { nombre:"Uzbekistán",        grupo:"K",  max:20 },
    "COL": { nombre:"Colombia",          grupo:"K",  max:20 },
    "ENG": { nombre:"Inglaterra",        grupo:"L",  max:20 },
    "CRO": { nombre:"Croacia",          grupo:"L",  max:20 },
    "GHA": { nombre:"Ghana",            grupo:"L",  max:20 },
    "PAN": { nombre:"Panamá",           grupo:"L",  max:20 },
    "CC":  { nombre:"Coca-Cola",        grupo:"CC", max:14 }
};

let albumSet = new Set();
let sortMode = 'default'; // 'default', 'desc' (Mayor), 'asc' (Menor)
let toastTimer = null;

async function init() {
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

async function toggleLamina(codigo, el) {
    const tengo = albumSet.has(codigo);
    if (tengo) {
        albumSet.delete(codigo);
        el.className = 'sticker s-miss';
        showToast(`❌  ${codigo} — quitada`, 'rem');
        try { await fetch(`/api/album/${encodeURIComponent(codigo)}`, { method:'DELETE' }); } catch(e) {}
    } else {
        albumSet.add(codigo);
        el.className = 'sticker s-have';
        showToast(`✅  ${codigo} — pegada`, 'add');
        try {
            await fetch('/api/album', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ codigos:[codigo] })
            });
        } catch(e) {}
    }
    const card = el.closest('.team-card');
    if (card) {
        const total = card.querySelectorAll('.sticker').length;
        const now   = card.querySelectorAll('.s-have').length;
        card.querySelector('.team-count').innerHTML = `<b>${now}</b>/${total}`;
    }
    updateStats();
}

function renderAlbum() {
    const grupos = {};
    for (const [pref, info] of Object.entries(DICCIONARIO)) {
        if (!grupos[info.grupo]) grupos[info.grupo] = [];
        grupos[info.grupo].push({ pref, info });
    }

    // Preparar array de grupos con su cuenta total para poder ordenar
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

    // Lógica de Ordenamiento Dinámico
    if (sortMode === 'desc') {
        listaGrupos.sort((a, b) => b.tengoG - a.tengoG); // Mayor a Menor
    } else if (sortMode === 'asc') {
        listaGrupos.sort((a, b) => a.tengoG - b.tengoG); // Menor a Mayor
    } else {
        const ORDER = ['FIFA','A','B','C','D','E','F','G','H','I','J','K','L','CC'];
        listaGrupos.sort((a, b) => ORDER.indexOf(a.nombre) - ORDER.indexOf(b.nombre)); // Por defecto
    }

    let html = '';
    for (const {nombre, equipos, totalG, tengoG} of listaGrupos) {
        const label = nombre === 'FIFA' ? 'Sección FIFA' : nombre === 'CC' ? 'Coca-Cola' : `Grupo ${nombre}`;
        const badge = (nombre === 'FIFA' || nombre === 'CC') ? nombre : 'GRUPO';

        html += `<div class="group-section" data-grupo="${nombre}">
            <div class="group-header">
                <span class="group-badge">${badge}</span>
                <span class="group-title">${label}</span>
                <span class="group-count"><b>${tengoG}</b> / ${totalG}</span>
            </div>
            <div class="teams-grid">`;

        for (const {pref, info} of equipos) {
            const codigos = getCodigos(pref, info);
            const tengo = codigos.filter(c => albumSet.has(c)).length;
            let stk = '';
            
            for (let i = 0; i < codigos.length; i++) {
                const cod = codigos[i];
                const cls = albumSet.has(cod) ? 's-have' : 's-miss';
                const num = cod.replace(pref, '').trim();
                
                if (i === 10) stk += `<div style="flex-basis: 100%; height: 0;"></div>`;
                
                stk += `<div class="sticker ${cls}" onclick="toggleLamina('${cod}',this)" title="${cod}">${num}</div>`;
            }

            html += `<div class="team-card" data-search="${info.nombre.toLowerCase()} ${pref.toLowerCase()}">
                <div class="team-card-hd">
                    <span class="team-prefix">${pref}</span>
                    <span class="team-name">${info.nombre}</span>
                    <span class="team-count"><b>${tengo}</b>/${codigos.length}</span>
                </div>
                <div class="sticker-grid">${stk}</div>
            </div>`;
        }
        html += `</div></div>`;
    }
    document.getElementById('albumContent').innerHTML = html;
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
    document.getElementById('statPct').textContent    = pct+'%'; // <-- Aquí está el cambio
}

// NUEVO FILTRO VISUAL: En lugar de ocultar, cambiamos la clase del contenedor maestro
function setFilter(tipo, btn) {
    // Quitar clases a botones
    document.querySelectorAll('.tb-btn:not(#btnSort)').forEach(b => {
        b.classList.remove('f-all', 'f-have', 'f-miss');
    });
    const map = {all:'f-all', have:'f-have', miss:'f-miss'};
    if (btn) btn.classList.add(map[tipo]);

    // Cambiar cómo se comportan las cajitas vía CSS
    document.getElementById('albumContent').className = `filter-${tipo}`;
}

// BUSCADOR: Este SÍ sigue ocultando las cartas que no hacen match con el texto
function applyFilters() {
    const q = document.getElementById('searchInput').value.toLowerCase().trim();
    document.querySelectorAll('.team-card').forEach(card => {
        const matchQ = !q || card.dataset.search.includes(q);
        card.classList.toggle('hidden', !matchQ);
    });
    // Ocultar sección si no hay equipos visibles
    document.querySelectorAll('.group-section').forEach(sec => {
        sec.style.display = sec.querySelectorAll('.team-card:not(.hidden)').length === 0 ? 'none' : '';
    });
}

// LOGICA DE ORDENAMIENTO DE MAYOR/MENOR
function toggleSort() {
    const btn = document.getElementById('btnSort');
    if (sortMode === 'default') {
        sortMode = 'desc';
        btn.textContent = '↓ MAYOR CANTIDAD';
        btn.classList.add('f-sort');
    } else if (sortMode === 'desc') {
        sortMode = 'asc';
        btn.textContent = '↑ MENOR CANTIDAD';
        btn.classList.add('f-sort');
    } else {
        sortMode = 'default';
        btn.textContent = '↕ ORDEN: DEFECTO';
        btn.classList.remove('f-sort');
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