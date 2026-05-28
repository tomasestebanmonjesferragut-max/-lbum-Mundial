// =====================================================
//  REPETIDAS - script.js
//  Validación: usa diccionario del servidor (/api/diccionario)
// =====================================================

let todasLasLaminas = [];
let diccionario = {};       // Cargado desde el servidor
let modalModo = '';
let modalDatos = {};
let toastTimer = null;

// ── INIT ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar diccionario desde el servidor (NO desde el script público)
    try {
        const resDic = await fetch('/api/diccionario');
        if (resDic.ok) diccionario = await resDic.json();
    } catch(e) { console.warn('No se pudo cargar el diccionario'); }

    // 2. Cargar láminas
    await cargarLaminas();

    // 3. Eventos de teclado
    configurarTeclado();
});

// ── TECLADO ───────────────────────────────────────────
function configurarTeclado() {
    // Enter en input principal → agregar
    document.getElementById('codigoLamina').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); agregarLamina(); }
    });
    // Enter en modal número → ir a cantidad
    document.getElementById('modalInputNumero').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); document.getElementById('modalInputCantidad').focus(); }
    });
    // Enter en modal cantidad → guardar
    document.getElementById('modalInputCantidad').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); procesarModal(); }
    });
    // Escape → cerrar modal
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            const m = document.getElementById('modalModificar');
            if (m.style.display === 'flex') cerrarModal();
        }
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

// ── VERIFICADOR DE PREFIJO EN TIEMPO REAL ────────────
function verificarPrefijo() {
    const input = document.getElementById('codigoLamina').value.toUpperCase();
    const ayuda = document.getElementById('ayudaPais');
    const matches = input.match(/[A-Z]{2,3}/g);
    if (matches && matches.length > 0) {
        const ult = matches[matches.length - 1];
        if (diccionario[ult]) {
            const info = diccionario[ult];
            const extra = info.extra ? ` (y ${info.extra.join(', ')})` : '';
            ayuda.innerHTML = `✅ <b>${info.nombre}:</b> 1 al ${info.max}${extra} — Ej: MEX1, SCO5-8`;
        } else if (ult.length >= 2) {
            ayuda.textContent = '❌ Prefijo desconocido';
        } else {
            ayuda.textContent = '';
        }
    } else {
        ayuda.textContent = '';
    }
}

// ── ANALIZADOR DE ENTRADA ─────────────────────────────
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

        // Rango (ej: 5-8)
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

    // Validar contra el diccionario del servidor ANTES de enviar
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
            invalidos.push(`${cod}: número fuera de rango (1-${info.max})`); continue;
        }
        validos.push(cod);
    }

    if (invalidos.length > 0) {
        showToast(`❌ Errores: ${invalidos.join(', ')}`, 'err');
    }
    if (validos.length === 0) return;

    try {
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
    } catch(e) {
        showToast('❌ Sin conexión con el servidor', 'err');
    }
}

// ── QUITAR LÁMINA (botón - QUITAR en la vista) ────────
async function quitarLaminaChip(codigo, cantidadActual) {
    const nuevaCantidad = cantidadActual - 1;
    if (nuevaCantidad <= 0) {
        // Eliminar completamente
        try {
            const res = await fetch(`/api/laminas/${encodeURIComponent(codigo)}`, { method: 'DELETE' });
            if (res.ok) { showToast(`🗑️ ${codigo} eliminada`, 'warn'); await cargarLaminas(); }
        } catch(e) { showToast('❌ Error', 'err'); }
    } else {
        // Reducir cantidad
        try {
            const res = await fetch(`/api/laminas/${encodeURIComponent(codigo)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cantidad: nuevaCantidad })
            });
            if (res.ok) { showToast(`➖ ${codigo} → x${nuevaCantidad}`, 'warn'); await cargarLaminas(); }
        } catch(e) { showToast('❌ Error', 'err'); }
    }
}

// ── MODAL MODIFICAR (botón MODIFICAR abre ingreso manual) ──
function abrirModificarManual() {
    modalModo = 'manual';
    modalDatos = {};
    document.getElementById('modalTitulo').textContent = 'Modificar Lámina';
    document.getElementById('modalMensaje').textContent = 'Ingresá el código (ej: MEX1) y la nueva cantidad. Si ponés 0, se elimina.';
    document.getElementById('bloqueNumero').style.display = 'block';
    document.getElementById('modalInputNumero').value = '';
    document.getElementById('modalInputCantidad').value = '';
    document.getElementById('modalModificar').style.display = 'flex';
    document.getElementById('modalInputNumero').focus();

    // Auto-completar cantidad al escribir el código
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
    document.getElementById('modalMensaje').textContent = 'Cambiá la cantidad. Si ponés 0, se elimina del registro.';
    document.getElementById('bloqueNumero').style.display = 'none';
    const inputCant = document.getElementById('modalInputCantidad');
    inputCant.value = cantidadActual;
    document.getElementById('modalModificar').style.display = 'flex';
    inputCant.focus();
    inputCant.select();
}

function cerrarModal() {
    document.getElementById('modalModificar').style.display = 'none';
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
    } else if (modalModo === 'manual') {
        const val = document.getElementById('modalInputNumero').value.trim().toUpperCase().replace(/\s+/g,'');
        const match = val.match(/^([A-Z]{2,3})(\d{1,2}|00)$/);
        if (!match) { showToast('❌ Código inválido', 'err'); return; }
        codigo = `${match[1]} ${match[2] === '00' ? '00' : String(parseInt(match[2])).padStart(2,'0')}`;

        // Validar contra diccionario
        const pref = match[1];
        const numStr = String(parseInt(match[2])).padStart(2,'0');
        const info = diccionario[pref];
        if (!info) { showToast('❌ País no existe en el diccionario', 'err'); return; }
    }

    cerrarModal();

    if (cantVal === 0) {
        // Eliminar
        try {
            const res = await fetch(`/api/laminas/${encodeURIComponent(codigo)}`, { method: 'DELETE' });
            if (res.ok) { showToast(`🗑️ ${codigo} eliminada`, 'warn'); await cargarLaminas(); }
        } catch(e) { showToast('❌ Error', 'err'); }
    } else {
        // Actualizar o crear
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
            // No existe, hay que crearla primero
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
    if (!laminas || laminas.length === 0) {
        contenedor.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:20px;">No hay láminas guardadas.</p>';
        return;
    }

    // Agrupar por prefijo
    const agrupadas = {};
    laminas.forEach(l => {
        const [prefijo, num] = l.codigo.split(' ');
        if (!agrupadas[prefijo]) agrupadas[prefijo] = { pais: l.pais || prefijo, prefijo, numeros: [] };
        agrupadas[prefijo].numeros.push({ numero: num, cantidad: l.cantidad, codigoCompleto: l.codigo });
    });

    const lista = Object.values(agrupadas).sort((a, b) => a.pais.localeCompare(b.pais));

    let html = `<div class="laminas-grid">
        <div class="tabla-header">
            <div style="padding-left:8px;">País</div>
            <div>Láminas (click para editar · - para quitar una)</div>
        </div>`;

    lista.forEach(grupo => {
        grupo.numeros.sort((a, b) => {
            if (a.numero === '00') return -1;
            if (b.numero === '00') return 1;
            return parseInt(a.numero) - parseInt(b.numero);
        });

        const chips = grupo.numeros.map(n => {
            const mult = n.cantidad > 1 ? `<span class="mult">x${n.cantidad}</span>` : '';
            return `<span class="chip"
                onclick="abrirModificar('${n.codigoCompleto}', ${n.cantidad})"
                title="Editar ${n.codigoCompleto}">
                <span class="num">${n.numero}</span>${mult}
            </span><span class="chip chip-minus"
                onclick="event.stopPropagation(); quitarLaminaChip('${n.codigoCompleto}', ${n.cantidad})"
                title="Quitar una de ${n.codigoCompleto}"
                style="padding:6px 7px; background:rgba(239,68,68,0.08); border-color:rgba(239,68,68,0.3);">
                <span style="color:#ef4444;font-weight:700;font-size:0.85rem;">−</span>
            </span>`;
        }).join('');

        html += `<div class="pais-row">
            <div class="pais-info">
                <span class="pais-nombre">${grupo.pais}</span>
                <span class="pais-codigo">(${grupo.prefijo})</span>
            </div>
            <div class="numeros-area">${chips}</div>
        </div>`;
    });

    html += '</div>';
    contenedor.innerHTML = html;
}

// ── TOAST ─────────────────────────────────────────────
function showToast(msg, tipo) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast t-${tipo} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, 2500);
}