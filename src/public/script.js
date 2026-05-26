let todasLasLaminas = [];
let diccionario = {};

let modalModo = ''; 
let modalDatos = {}; 

document.addEventListener("DOMContentLoaded", async () => {
    const resDic = await fetch('/api/diccionario');
    if (resDic.ok) diccionario = await resDic.json();
    cargarLaminas();
    
    // Activar los eventos del teclado
    configurarTeclado();
});

function configurarTeclado() {
    // 1. Enter para agregar lámina principal
    document.getElementById('codigoLamina').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            agregarLamina();
        }
    });

    // 2. Enter en el input de número del Modal para pasar a la cantidad
    document.getElementById('modalInputNumero').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('modalInputCantidad').focus();
        }
    });

    // 3. Enter en el input de cantidad del Modal para guardar
    document.getElementById('modalInputCantidad').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            procesarModal();
        }
    });

    // 4. Escape para cerrar el Modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('modalModificar');
            if (modal.style.display === 'flex') {
                cerrarModal();
            }
        }
    });
}

async function cargarLaminas() {
    const res = await fetch('/api/laminas');
    if (res.ok) {
        todasLasLaminas = await res.json();
        filtrarLaminas(); 
    }
}

// --- TRADUCTOR DE TEXTO INTELIGENTE ---
function analizarEntradaLaminas(inputStr) {
    const codigos = [];
    const partes = inputStr.split(',');
    let ultimoPrefijo = "";

    for (let parte of partes) {
        parte = parte.trim().toUpperCase();
        if (!parte) continue;

        // Extraer las letras si es que hay (Ej: "ALG")
        const prefijoMatch = parte.match(/^[A-Z]{2,3}/);
        let prefijo = ultimoPrefijo;
        let numerosStr = parte;

        if (prefijoMatch) {
            prefijo = prefijoMatch[0];
            ultimoPrefijo = prefijo; // Lo guardamos por si la siguiente parte solo tiene números
            numerosStr = parte.substring(prefijo.length).trim();
        }

        if (!prefijo) continue; // Si no hay país definido, se ignora

        // Detectar si es un rango (Ej: 18 - 23)
        if (numerosStr.includes('-')) {
            const [inicioStr, finStr] = numerosStr.split('-');
            const inicio = parseInt(inicioStr.trim());
            const fin = parseInt(finStr.trim());

            if (!isNaN(inicio) && !isNaN(fin) && inicio <= fin) {
                for (let i = inicio; i <= fin; i++) {
                    let numFormat = i === 0 ? "00" : i.toString().padStart(2, '0');
                    codigos.push(`${prefijo} ${numFormat}`);
                }
            }
        } else {
            // Es un número suelto
            let numStr = numerosStr.trim();
            if (numStr !== "") {
                let num = parseInt(numStr);
                if (!isNaN(num) || numStr === "00") {
                    let numFormat = (numStr === "00" || num === 0) ? "00" : num.toString().padStart(2, '0');
                    codigos.push(`${prefijo} ${numFormat}`);
                }
            }
        }
    }
    return codigos;
}

// --- VERIFICADOR INTELIGENTE ---
function verificarPrefijo() {
    const input = document.getElementById('codigoLamina').value.toUpperCase();
    const ayuda = document.getElementById('ayudaPais');
    
    // Buscar el ÚLTIMO prefijo que se esté escribiendo
    const matches = input.match(/[A-Z]{2,3}/g);
    
    if (matches && matches.length > 0) {
        const ultimoPrefijo = matches[matches.length - 1];
        if (diccionario[ultimoPrefijo]) {
            const info = diccionario[ultimoPrefijo];
            let extra = info.extra ? ` (y ${info.extra.join(', ')})` : '';
            ayuda.innerHTML = `✅ <b>${info.nombre}:</b> del 1 al ${info.max}${extra}. <span style="color:#fbbf24;">Soporta: 18-23, o 5,8,10</span>`;
        } else {
            ayuda.textContent = "❌ Prefijo desconocido";
        }
    } else {
        ayuda.textContent = "";
    }
}

// --- ENVÍO DE DATOS EN LOTE ---
async function agregarLamina() {
    const input = document.getElementById('codigoLamina');
    const codigosGenerados = analizarEntradaLaminas(input.value);

    if (codigosGenerados.length === 0) {
        alert('Ingresa al menos un formato válido. Ej: ALG 18-23 o SCO 05, GHA 03');
        return;
    }

    const res = await fetch('/api/laminas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigos: codigosGenerados })
    });

    const data = await res.json();
    if (res.ok) {
        if (data.errores && data.errores.length > 0) {
            alert(`✅ Se guardaron algunas láminas, pero hubo errores en estas:\n\n${data.errores.join('\n')}`);
        }
        input.value = '';
        document.getElementById('ayudaPais').textContent = '';
        cargarLaminas();
    } else {
        alert("Error: " + data.error);
    }
}

// ----- LÓGICA DE LA VENTANA MODAL -----

function abrirModificar(codigo, cantidadActual) {
    modalModo = 'especifica';
    modalDatos = { codigo, cantidadActual };

    document.getElementById('modalTitulo').textContent = `Modificar ${codigo}`;
    document.getElementById('modalMensaje').textContent = "Si pones la cantidad en 0, la lámina se eliminará del registro.";
    
    document.getElementById('bloqueNumero').style.display = 'none';
    
    const inputCantidad = document.getElementById('modalInputCantidad');
    inputCantidad.value = cantidadActual;

    document.getElementById('modalModificar').style.display = 'flex';
    inputCantidad.focus();
}

function abrirModificarPais(prefijo) {
    modalModo = 'pais';
    modalDatos = { prefijo };

    const info = diccionario[prefijo];
    const nombrePais = info ? info.nombre : prefijo;

    document.getElementById('modalTitulo').textContent = `Modificar ${nombrePais}`;
    document.getElementById('modalMensaje').textContent = "Ingresa el número de la lámina y la cantidad.";
    
    document.getElementById('bloqueNumero').style.display = 'block';
    
    const inputNum = document.getElementById('modalInputNumero');
    const inputCantidad = document.getElementById('modalInputCantidad');
    
    inputNum.value = '';
    inputCantidad.value = '';

    document.getElementById('modalModificar').style.display = 'flex';
    inputNum.focus();

    inputNum.oninput = () => {
        let num = inputNum.value.trim();
        if(num !== "00" && num.length > 0) num = num.padStart(2, '0');
        const codigoBuscado = `${prefijo} ${num}`;
        const existe = todasLasLaminas.find(l => l.codigo === codigoBuscado);
        if(existe) {
            inputCantidad.value = existe.cantidad;
        } else {
            inputCantidad.value = ''; 
        }
    };
}

function cerrarModal() {
    document.getElementById('modalModificar').style.display = 'none';
}

function procesarModal() {
    const inputCantidad = document.getElementById('modalInputCantidad').value;
    const nuevaCantidad = parseInt(inputCantidad);

    if (isNaN(nuevaCantidad) || nuevaCantidad < 0) {
        alert("❌ Por favor, ingresa una cantidad válida.");
        return;
    }

    if (modalModo === 'especifica') {
        const { codigo, cantidadActual } = modalDatos;
        ejecutarModificacion(codigo, nuevaCantidad, cantidadActual);
    } 
    else if (modalModo === 'pais') {
        let num = document.getElementById('modalInputNumero').value.trim();
        if (!num) return alert("❌ Debes ingresar un número de lámina.");
        if (num !== "00") num = num.padStart(2, '0');
        
        const codigo = `${modalDatos.prefijo} ${num}`;
        const laminaExistente = todasLasLaminas.find(l => l.codigo === codigo);
        const cantidadActual = laminaExistente ? laminaExistente.cantidad : 0;
        
        ejecutarModificacion(codigo, nuevaCantidad, cantidadActual);
    }
    cerrarModal();
}

function ejecutarModificacion(codigo, nuevaCantidad, cantidadActual) {
    if (nuevaCantidad === 0 && cantidadActual > 0) {
        eliminarLamina(codigo, true); 
    } else if (nuevaCantidad !== cantidadActual) {
        actualizarCantidadEnBackend(codigo, nuevaCantidad);
    }
}

// ---------------------------------------------

async function actualizarCantidadEnBackend(codigo, nuevaCantidad) {
    const existe = todasLasLaminas.find(l => l.codigo === codigo);
    if (!existe) {
        if (nuevaCantidad > 0) {
            await fetch('/api/laminas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo }) });
            if (nuevaCantidad > 1) {
                await fetch(`/api/laminas/${codigo}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cantidad: nuevaCantidad }) });
            }
            cargarLaminas();
        }
        return;
    }
    const res = await fetch(`/api/laminas/${codigo}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cantidad: nuevaCantidad }) });
    if (res.ok) cargarLaminas();
}

async function eliminarLamina(codigo, omitirConfirmacion = false) {
    if(omitirConfirmacion || confirm(`⚠️ ¿Estás seguro de que deseas eliminar la lámina ${codigo} de tus repetidas?`)) {
        const res = await fetch(`/api/laminas/${codigo}`, { method: 'DELETE' });
        if (res.ok) cargarLaminas();
    }
}

function filtrarLaminas() {
    const textoBuscado = document.getElementById('buscador').value.toUpperCase();
    const laminasFiltradas = todasLasLaminas.filter(l => l.codigo.includes(textoBuscado) || (l.pais && l.pais.toUpperCase().includes(textoBuscado)));
    renderizarTabla(laminasFiltradas);
}

async function descargarImagen() {
    // 1. Crear un contenedor temporal (una "hoja blanca" invisible)
    const hojaBlanca = document.createElement('div');
    hojaBlanca.style.position = 'absolute';
    hojaBlanca.style.left = '-9999px'; // Esconderlo fuera de la pantalla
    hojaBlanca.style.top = '0';
    hojaBlanca.style.width = '800px'; // Ancho de la hoja
    hojaBlanca.style.backgroundColor = '#ffffff'; // Fondo blanco
    hojaBlanca.style.color = '#000000'; // Texto negro
    hojaBlanca.style.padding = '40px';
    hojaBlanca.style.fontFamily = 'Arial, sans-serif';

    // 2. Armar el encabezado de la hoja
    let html = `
        <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #000; margin: 0; font-size: 26px;">Mis Láminas Repetidas - Mundial 2026</h1>
            <p style="color: #555; margin: 5px 0; font-size: 14px;">Generado por GhostDev Gestor</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
                <th style="border: 2px solid #333; padding: 12px; background-color: #f1f5f9; color: #000; width: 25%;">País</th>
                <th style="border: 2px solid #333; padding: 12px; background-color: #f1f5f9; color: #000; width: 75%;">Números</th>
            </tr>`;

    // 3. Agrupar las láminas exactamente igual que en la tabla principal
    const agrupadas = {};
    todasLasLaminas.forEach(l => {
        const [prefijo, num] = l.codigo.split(' ');
        if (!agrupadas[prefijo]) agrupadas[prefijo] = { pais: l.pais || prefijo, prefijo: prefijo, numeros: [] };
        agrupadas[prefijo].numeros.push({ numero: num, cantidad: l.cantidad });
    });

    const listaPaises = Object.values(agrupadas).sort((a, b) => a.pais.localeCompare(b.pais));

    // 4. Llenar la tabla limpia (sin botones, sin neón)
    listaPaises.forEach(grupo => {
        grupo.numeros.sort((a, b) => {
            if (a.numero === "00") return -1;
            if (b.numero === "00") return 1;
            return parseInt(a.numero) - parseInt(b.numero);
        });

        let numerosHtml = grupo.numeros.map(n => {
            // El multiplicador "x2" saldrá en rojo para que resalte en el papel blanco
            let multiplicador = n.cantidad > 1 ? `<span style="color: #dc2626; font-weight: bold; font-size: 0.9em; margin-left: 2px;">(x${n.cantidad})</span>` : '';
            return `<span style="display: inline-block; border: 1px solid #cbd5e1; padding: 4px 8px; border-radius: 4px; margin: 4px; background-color: #f8fafc; color: #0f172a; font-weight: bold;">
                        ${n.numero} ${multiplicador}
                    </span>`;
        }).join(' ');

        html += `
            <tr>
                <td style="border: 1px solid #94a3b8; padding: 12px; font-weight: bold; text-align: center; color: #000;">
                    ${grupo.pais} <br>
                    <span style="color: #64748b; font-size: 0.8em;">(${grupo.prefijo})</span>
                </td>
                <td style="border: 1px solid #94a3b8; padding: 12px; line-height: 2;">
                    ${numerosHtml}
                </td>
            </tr>`;
    });
    html += '</table>';

    // 5. Agregar la hoja al documento, tomar foto y eliminarla
    hojaBlanca.innerHTML = html;
    document.body.appendChild(hojaBlanca);

    const canvas = await html2canvas(hojaBlanca, {
        backgroundColor: '#ffffff',
        scale: 2 // Alta resolución
    });

    const link = document.createElement('a');
    link.download = 'Mis_Laminas_Mundial2026.png';
    link.href = canvas.toDataURL('image/png');
    link.click();

    // Destruir la hoja blanca virtual para no ensuciar tu página
    document.body.removeChild(hojaBlanca);
}

function renderizarTabla(laminas) {
    const contenedor = document.getElementById('listaLaminas');
    if (laminas.length === 0) {
        contenedor.innerHTML = '<p style="color: var(--text-dim);">No hay láminas guardadas.</p>';
        return;
    }

    const agrupadas = {};
    laminas.forEach(l => {
        const [prefijo, num] = l.codigo.split(' ');
        if (!agrupadas[prefijo]) agrupadas[prefijo] = { pais: l.pais || prefijo, prefijo: prefijo, numeros: [] };
        agrupadas[prefijo].numeros.push({ numero: num, cantidad: l.cantidad, codigoCompleto: l.codigo });
    });

    const listaPaises = Object.values(agrupadas).sort((a, b) => a.pais.localeCompare(b.pais));

    let html = `
        <table>
            <tr>
                <th style="width: 25%;">País</th>
                <th style="width: 55%;">Números</th>
                <th style="width: 20%;">Acciones</th>
            </tr>`;
    
    listaPaises.forEach(grupo => {
        grupo.numeros.sort((a, b) => {
            if (a.numero === "00") return -1;
            if (b.numero === "00") return 1;
            return parseInt(a.numero) - parseInt(b.numero);
        });

        let numerosHtml = grupo.numeros.map(n => {
            let multiplicador = n.cantidad > 1 ? `<span style="color: #fbbf24; font-weight: bold; margin-left: 4px; font-size: 0.9em;">x${n.cantidad}</span>` : '';
            return `<span onclick="abrirModificar('${n.codigoCompleto}', ${n.cantidad})" 
                          style="display: inline-block; background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.3); padding: 5px 10px; border-radius: 6px; margin: 4px; cursor: pointer; transition: 0.2s;"
                          onmouseover="this.style.background='rgba(0, 242, 254, 0.2)'"
                          onmouseout="this.style.background='rgba(0, 242, 254, 0.05)'"
                          title="Click para editar ${n.codigoCompleto}">
                        ${n.numero}${multiplicador}
                    </span>`;
        }).join(' ');

        html += `
            <tr>
                <td style="color: var(--neon-cyan); font-weight: bold; font-size: 1.1em; text-align: center;">
                    ${grupo.pais} <br>
                    <span style="color: var(--text-dim); font-size: 0.8em;">(${grupo.prefijo})</span>
                </td>
                <td style="text-align: left; line-height: 1.8; padding: 10px;">
                    ${numerosHtml}
                </td>
                <td>
                    <button onclick="abrirModificarPais('${grupo.prefijo}')" style="padding: 8px 15px; background: #ea580c; font-size: 0.9em; border-radius: 6px; width: 100%;">Modificar</button>
                </td>
            </tr>`;
    });
    html += '</table>';
    contenedor.innerHTML = html;
}