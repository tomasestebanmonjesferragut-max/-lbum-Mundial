// =====================================================
//  REPETIDAS - script.js  (refactorizado)
// =====================================================

let todasLasLaminas = [];
let diccionario = {};
let modalModo = '';
let modalDatos = {};
let toastTimer = null;
let allLog = [];
let currentFilter = 'all';
let currentSearch = '';

// ── INIT ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/diccionario');
        if (res.ok) diccionario = await res.json();
    } catch(e) { console.warn('Error cargando diccionario'); }
    await cargarLaminas();
    configurarTeclado();
    setupControls();
});

// ── TECLADO ───────────────────────────────────────────
function configurarTeclado() {
    document.getElementById('codigoLamina').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); agregarLamina(); }
    });
    document.getElementById('modalInputNumero').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); document.getElementById('modalInputCantidad').focus(); }
    });
    document.getElementById('modalInputCantidad').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); procesarModal(); }
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') cerrarModal();
    });
}

// ── CARGAR LÁMINAS ────────────────────────────────────
async function cargarLaminas() {
    try {
        const res = await fetch('/api/laminas');
        if (res.ok) {
            todasLasLaminas = await res.json();
            filtrarLaminas();
        }
    } catch(e) { console.warn('Error cargando láminas'); }
}

// ── VERIFICADOR EN TIEMPO REAL ────────────────────────
function verificarPrefijo() {
    const input = document.getElementById('codigoLamina').value.toUpperCase();
    const ayuda = document.getElementById('ayudaPais');
    const matches = input.match(/[A-Z]{2,3}/g);
    if (matches && matches.length > 0) {
        const ult = matches[matches.length - 1];
        if (diccionario[ult]) {
            const info = diccionario[ult];
            const extra = info.extra ? ` (y ${info.extra.join(', ')})` : '';
            ayuda.innerHTML = `✅ <b>${info.nombre}:</b> 1–${info.max}${extra}`;
            ayuda.className = 'hint-text';
        } else if (ult.length >= 2) {
            ayuda.textContent = '❌ Prefijo desconocido';
            ayuda.className = 'hint-text err';
        } else {
            ayuda.textContent = '';
        }
    } else {
        ayuda.textContent = '';
    }
}

// ── PARSER DE ENTRADA ─────────────────────────────────
function analizarEntrada(inputStr) {
    const codigos = [];
    const partes = inputStr.split(',');
    let ultimoPrefijo = '';

    for (let parte of partes) {
        parte = parte.trim().toUpperCase().replace(/\s+/g, '');
        if (!parte) continue;

        const prefijoMatch = parte.match(/^[A-Z]{2,3}/);
        let prefijo = ultimoPrefijo;
        let numerosStr = parte;

        if (prefijoMatch) {
            prefijo = prefijoMatch[0];
            ultimoPrefijo = prefijo;
            numerosStr = parte.substring(prefijo.length).trim();
        }
        if (!prefijo) continue;

        if (numerosStr.includes('-')) {
            const [a, b] = numerosStr.split('-');
            const inicio = parseInt(a.trim());
            const fin = parseInt(b.trim());
            if (!isNaN(inicio) && !isNaN(fin) && inicio <= fin) {
                for (let i = inicio; i <= fin; i++) {
                    codigos.push(`${prefijo} ${i === 0 ? '00' : String(i).padStart(2, '0')}`);
                }
            }
        } else if (numerosStr !== '') {
            const num = numerosStr === '00' ? 0 : parseInt(numerosStr);
            if (!isNaN(num)) {
                codigos.push(`${prefijo} ${num === 0 ? '00' : String(num).padStart(2, '0')}`);
            }
        }
    }
    return codigos;
}

// ── AGREGAR LÁMINAS ───────────────────────────────────
async function agregarLamina() {
    const input = document.getElementById('codigoLamina');
    const valor = input.value.trim();
    if (!valor) return;

    const codigos = analizarEntrada(valor);
    if (codigos.length === 0) {
        showToast('⚠️ Formato inválido. Ej: MEX1, ARG12', 'err');
        return;
    }

    const invalidos = [];
    const validos = [];
    for (const cod of codigos) {
        const [pref, numStr] = cod.split(' ');
        const info = diccionario[pref];
        if (!info) { invalidos.push(`${cod}: país desconocido`); continue; }
        const num = parseInt(numStr);
        if (numStr === '00') {
            if (!info.extra || !info.extra.includes('00')) { invalidos.push(`${cod}: no tiene lámina 00`); continue; }
        } else if (num < 1 || num > info.max) {
            invalidos.push(`${cod}: fuera de rango (1–${info.max})`); continue;
        }
        validos.push(cod);
    }

    if (invalidos.length > 0) showToast(`❌ ${invalidos.slice(0,2).join(', ')}${invalidos.length > 2 ? '...' : ''}`, 'err');
    if (validos.length === 0) return;

    try {
        const btn = document.getElementById('btnAgregar');
        btn.disabled = true;
        const res = await fetch('/api/laminas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codigos: validos })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(`✅ ${data.mensaje}`, 'ok');
            input.value = '';
            document.getElementById('ayudaPais').textContent = '';
            await cargarLaminas();
        } else {
            showToast('❌ Error del servidor', 'err');
        }
        btn.disabled = false;
    } catch(e) {
        showToast('❌ Sin conexión', 'err');
        document.getElementById('btnAgregar').disabled = false;
    }
}

// ── MODAL MODIFICAR ───────────────────────────────────
function abrirModificarManual() {
    modalModo = 'manual';
    modalDatos = {};
    document.getElementById('modalTitulo').textContent = 'Modificar Lámina';
    document.getElementById('modalMensaje').textContent = 'Ingresá el código y la nueva cantidad. Con 0 se elimina.';
    document.getElementById('bloqueNumero').style.display = 'block';
    document.getElementById('modalInputNumero').value = '';
    document.getElementById('modalInputCantidad').value = '';
    document.getElementById('modalModificar').classList.add('open');
    document.getElementById('modalInputNumero').focus();

    document.getElementById('modalInputNumero').oninput = () => {
        const val = document.getElementById('modalInputNumero').value.trim().toUpperCase().replace(/\s+/g,'');
        const match = val.match(/^([A-Z]{2,3})(\d{1,2}|00)$/);
        if (match) {
            const cod = `${match[1]} ${match[2] === '00' ? '00' : String(parseInt(match[2])).padStart(2,'0')}`;
            const existe = todasLasLaminas.find(l => l.codigo === cod);
            document.getElementById('modalInputCantidad').value = existe ? existe.cantidad : '';
        }
    };
}

function abrirModificar(codigo, cantidadActual) {
    modalModo = 'especifica';
    modalDatos = { codigo, cantidadActual };
    document.getElementById('modalTitulo').textContent = `Modificar ${codigo}`;
    document.getElementById('modalMensaje').textContent = 'Cambiá la cantidad. Con 0 se elimina del registro.';
    document.getElementById('bloqueNumero').style.display = 'none';
    const inputCant = document.getElementById('modalInputCantidad');
    inputCant.value = cantidadActual;
    document.getElementById('modalModificar').classList.add('open');
    inputCant.focus();
    inputCant.select();
}

function cerrarModal() {
    document.getElementById('modalModificar').classList.remove('open');
}

async function procesarModal() {
    const cantVal = parseInt(document.getElementById('modalInputCantidad').value);
    if (isNaN(cantVal) || cantVal < 0) {
        showToast('❌ Cantidad inválida', 'err');
        return;
    }

    let codigo = '';
    if (modalModo === 'especifica') {
        codigo = modalDatos.codigo;
    } else {
        const val = document.getElementById('modalInputNumero').value.trim().toUpperCase().replace(/\s+/g,'');
        const match = val.match(/^([A-Z]{2,3})(\d{1,2}|00)$/);
        if (!match) { showToast('❌ Código inválido', 'err'); return; }
        codigo = `${match[1]} ${match[2] === '00' ? '00' : String(parseInt(match[2])).padStart(2,'0')}`;
        const info = diccionario[match[1]];
        if (!info) { showToast('❌ País no existe', 'err'); return; }
    }

    cerrarModal();

    if (cantVal === 0) {
        try {
            const res = await fetch(`/api/laminas/${encodeURIComponent(codigo)}`, { method: 'DELETE' });
            if (res.ok) { showToast(`🗑️ ${codigo} eliminada`, 'warn'); await cargarLaminas(); }
        } catch(e) { showToast('❌ Error', 'err'); }
    } else {
        const existe = todasLasLaminas.find(l => l.codigo === codigo);
        if (existe) {
            try {
                const res = await fetch(`/api/laminas/${encodeURIComponent(codigo)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cantidad: cantVal })
                });
                if (res.ok) { showToast(`✅ ${codigo} → x${cantVal}`, 'ok'); await cargarLaminas(); }
            } catch(e) { showToast('❌ Error', 'err'); }
        } else if (cantVal > 0) {
            try {
                await fetch('/api/laminas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ codigos: [codigo] })
                });
                if (cantVal > 1) {
                    await fetch(`/api/laminas/${encodeURIComponent(codigo)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cantidad: cantVal })
                    });
                }
                showToast(`✅ ${codigo} creada x${cantVal}`, 'ok');
                await cargarLaminas();
            } catch(e) { showToast('❌ Error', 'err'); }
        }
    }
}

// ── FILTRAR / RENDERIZAR ──────────────────────────────
function filtrarLaminas() {
    const q = document.getElementById('buscador').value.toUpperCase().trim();
    const filtradas = q
        ? todasLasLaminas.filter(l => l.codigo.toUpperCase().includes(q) || (l.pais && l.pais.toUpperCase().includes(q)))
        : [...todasLasLaminas];
    renderizarLaminas(filtradas);
}

function renderizarLaminas(laminas) {
    const contenedor = document.getElementById('listaLaminas');

    // Actualizar contador
    const agrupadas = {};
    (laminas || todasLasLaminas).forEach(l => {
        const [prefijo] = l.codigo.split(' ');
        if (!agrupadas[prefijo]) agrupadas[prefijo] = 0;
        agrupadas[prefijo]++;
    });
    document.getElementById('contadorTotal').textContent = Object.keys(
        todasLasLaminas.reduce((acc, l) => { const [p] = l.codigo.split(' '); acc[p] = 1; return acc; }, {})
    ).length + ' países';

    if (!laminas || laminas.length === 0) {
        contenedor.innerHTML = `
            <div class="empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <p>No hay láminas registradas aún.<br>Ingresá códigos arriba para comenzar.</p>
            </div>`;
        return;
    }

    // Agrupar por prefijo
    const grupos = {};
    laminas.forEach(l => {
        const [prefijo, num] = l.codigo.split(' ');
        if (!grupos[prefijo]) grupos[prefijo] = { pais: l.pais || prefijo, prefijo, numeros: [] };
        grupos[prefijo].numeros.push({ numero: num, cantidad: l.cantidad, codigoCompleto: l.codigo });
    });

    const lista = Object.values(grupos).sort((a, b) => a.pais.localeCompare(b.pais));

    let html = `<div class="tabla-header">
        <div>País</div>
        <div>Números (click para editar)</div>
    </div>`;

    lista.forEach(grupo => {
        grupo.numeros.sort((a, b) => {
            if (a.numero === '00') return -1;
            if (b.numero === '00') return 1;
            return parseInt(a.numero) - parseInt(b.numero);
        });

        const chips = grupo.numeros.map(n => {
            const mult = n.cantidad > 1 ? `<span class="mult">(x${n.cantidad})</span>` : '';
            return `<span class="chip"
                onclick="abrirModificar('${n.codigoCompleto}', ${n.cantidad})"
                title="Editar ${n.codigoCompleto}">
                <span class="num">${parseInt(n.numero)}</span>${mult}
            </span>`;
        }).join('');

        html += `<div class="pais-row">
            <div class="pais-info">
                <span class="pais-nombre">${grupo.pais}</span>
                <span class="pais-codigo">${grupo.prefijo}</span>
            </div>
            <div class="numeros-area">${chips}</div>
        </div>`;
    });

    contenedor.innerHTML = html;
}

// ── DESCARGAR IMAGEN COMPACTA ─────────────────────────
async function descargarImagen() {
    if (todasLasLaminas.length === 0) {
        showToast('⚠️ No hay láminas para exportar', 'warn');
        return;
    }
    showToast('📸 Generando imagen...', 'ok');

    // Agrupar
    const grupos = {};
    todasLasLaminas.forEach(l => {
        const [prefijo, num] = l.codigo.split(' ');
        if (!grupos[prefijo]) grupos[prefijo] = { pais: l.pais || prefijo, prefijo, numeros: [] };
        grupos[prefijo].numeros.push({ numero: num, cantidad: l.cantidad });
    });
    const lista = Object.values(grupos).sort((a, b) => a.pais.localeCompare(b.pais));

    // Construir tabla compacta
    const rows = lista.map(g => {
        g.numeros.sort((a, b) => (parseInt(a.numero)||0) - (parseInt(b.numero)||0));
        const nums = g.numeros.map(n => {
            const label = parseInt(n.numero);
            return n.cantidad > 1
                ? `<span style="background:#1e2a3a;border:1px solid #334;border-radius:5px;padding:3px 7px;font-size:11px;font-weight:700;color:#f1f5f9">${label} <span style="color:#f59e0b;font-size:10px">x${n.cantidad}</span></span>`
                : `<span style="background:#1e2a3a;border:1px solid #334;border-radius:5px;padding:3px 7px;font-size:11px;font-weight:600;color:#f1f5f9">${label}</span>`;
        }).join('');
        return `<tr>
            <td style="padding:7px 12px;border-bottom:1px solid #1a2235;white-space:nowrap">
                <div style="font-size:12px;font-weight:700;color:#f1f5f9">${g.pais}</div>
                <div style="font-size:10px;color:#475569;margin-top:1px">${g.prefijo}</div>
            </td>
            <td style="padding:7px 12px;border-bottom:1px solid #1a2235">
                <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">${nums}</div>
            </td>
        </tr>`;
    }).join('');

    const now = new Date();
    const fecha = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;

    const html = `
    <div style="background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px 20px 16px;width:520px;border-radius:12px">
        <div style="text-align:center;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #1e2636">
            <div style="font-size:18px;font-weight:800;color:#f1f5f9;letter-spacing:-0.3px">Mis Láminas Repetidas</div>
            <div style="font-size:11px;color:#475569;margin-top:3px;letter-spacing:0.5px">MUNDIAL 2026 · ${fecha}</div>
        </div>
        <table style="width:100%;border-collapse:collapse">
            <thead>
                <tr>
                    <th style="padding:6px 12px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #1e2636">País</th>
                    <th style="padding:6px 12px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #1e2636">Números</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <div style="text-align:center;margin-top:14px;font-size:9px;color:#2d3748;letter-spacing:0.5px">Generado por GhostDev Gestor</div>
    </div>`;

    const container = document.getElementById('exportContainer');
    container.innerHTML = html;
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.position = 'fixed';

    const el = container.firstElementChild;

    try {
        const canvas = await html2canvas(el, {
            scale: 2.5,
            backgroundColor: '#0d1117',
            useCORS: true,
            logging: false
        });
        const link = document.createElement('a');
        link.download = `repetidas-mundial2026-${fecha.replace(/\//g,'-')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('✅ Imagen descargada', 'ok');
    } catch(e) {
        showToast('❌ Error al generar imagen', 'err');
    } finally {
        container.innerHTML = '';
    }
}

// ── TOAST ─────────────────────────────────────────────
function showToast(msg, tipo) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast t-${tipo} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, 2800);
}

// ── SETUP CONTROLS ────────────────────────────────────
function setupControls() {
    const input = document.getElementById('codigoLamina');
    const buscador = document.getElementById('buscador');
    const btnAgregar = document.getElementById('btnAgregar');
    const btnModificar = document.getElementById('btnModificar');
    const btnDescargar = document.getElementById('btnDescargar');
    const btnModalAceptar = document.getElementById('btnModalAceptar');
    const btnModalCancelar = document.getElementById('btnModalCancelar');
    
    if (input) input.addEventListener('input', verificarPrefijo);
    if (buscador) buscador.addEventListener('input', filtrarLaminas);
    if (btnAgregar) btnAgregar.addEventListener('click', agregarLamina);
    if (btnModificar) btnModificar.addEventListener('click', abrirModificarManual);
    if (btnDescargar) btnDescargar.addEventListener('click', descargarImagen);
    if (btnModalAceptar) btnModalAceptar.addEventListener('click', procesarModal);
    if (btnModalCancelar) btnModalCancelar.addEventListener('click', cerrarModal);
}