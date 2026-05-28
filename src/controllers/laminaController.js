const { registrarHistorial } = require('./historialLogger');
const historialPath = path.join(__dirname, '../data/historial.json');
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const diccionario = require('../data/diccionarioMundial'); 

const git = simpleGit();
const dataPath = path.join(__dirname, '../data/laminas.json');

// Fire-and-forget: responde al cliente al instante, guarda en GitHub en segundo plano
const guardarEnGitHub = () => {
    git.add([dataPath, historialPath]) // Añadido el log al commit
        .then(() => git.commit('Auto-update: Lote de láminas y log actualizado'))
        .then(() => git.push('origin', 'main'))
        .catch(err => console.error('Error Git:', err));
};

const obtenerDiccionario = (req, res) => res.json(diccionario);

const listarLaminas = (req, res) => {
    const laminas = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    res.status(200).json(laminas);
};

const agregarLamina = (req, res) => {
    try {
        const codigosRecibidos = req.body.codigos || (req.body.codigo ? [req.body.codigo] : []);
        
        if (!codigosRecibidos || codigosRecibidos.length === 0) {
            return res.status(400).json({ error: 'No se enviaron códigos' });
        }

        let laminas = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        let agregadas = 0;
        let errores = [];

        for (let codigoRaw of codigosRecibidos) {
            const match = codigoRaw.toUpperCase().replace(/\s+/g, '').match(/^([A-Z]{2,3})(00|\d{1,2})$/);
            if (!match) { errores.push(`${codigoRaw}: Formato inválido`); continue; }

            let prefijo = match[1];
            let numeroStr = match[2];
            let num = parseInt(numeroStr);
            if (numeroStr !== "00") numeroStr = numeroStr.padStart(2, '0');

            const codigoFormateado = `${prefijo} ${numeroStr}`;
            const paisInfo = diccionario[prefijo];

            if (!paisInfo) { errores.push(`${codigoFormateado}: País no existe`); continue; }
            if (numeroStr !== "00" && (num < 1 || num > paisInfo.max)) {
                errores.push(`${codigoFormateado}: Límite es ${paisInfo.max}`); continue;
            }
            if (numeroStr === "00" && (!paisInfo.extra || !paisInfo.extra.includes("00"))) {
                errores.push(`${codigoFormateado}: No tiene lámina 00`); continue;
            }

            const index = laminas.findIndex(l => l.codigo === codigoFormateado);
            if (index !== -1) {
                laminas[index].cantidad += 1;
                registrarHistorial({ tipo: 'edit', fuente: 'laminas', codigo: codigoFormateado, pais: paisInfo.nombre, cantidad: laminas[index].cantidad, detalle: `+1 - ahora ${laminas[index].cantidad}` });
            } else {
                laminas.push({ codigo: codigoFormateado, pais: paisInfo.nombre, cantidad: 1 });
                registrarHistorial({ tipo: 'add', fuente: 'laminas', codigo: codigoFormateado, pais: paisInfo.nombre, cantidad: 1, detalle: '+1 unidades' });
            }
            agregadas++;
        }

        if (agregadas > 0) {
            fs.writeFileSync(dataPath, JSON.stringify(laminas, null, 2));
            guardarEnGitHub(); // sin await — respuesta instantánea
        }

        res.status(200).json({ 
            mensaje: `Se agregaron ${agregadas} láminas.`, 
            errores: errores.length > 0 ? errores : null 
        });

    } catch (error) { 
        res.status(500).json({ error: 'Error del servidor' }); 
    }
};

const eliminarLamina = (req, res) => {
    const codigo = req.params.codigo;
    let laminas = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    // Buscar la lámina antes de eliminarla para registrar el evento
    const lamina = laminas.find(l => l.codigo === codigo);
    if (lamina) {
        registrarHistorial({ tipo: 'remove', fuente: 'laminas', codigo: lamina.codigo, pais: lamina.pais, cantidad: 0, detalle: 'Eliminada del stock' });
    }

    laminas = laminas.filter(l => l.codigo !== codigo);
    fs.writeFileSync(dataPath, JSON.stringify(laminas, null, 2));
    res.status(200).json({ mensaje: 'Eliminada' });
    guardarEnGitHub(); // sin await
};

const editarLamina = (req, res) => {
    const codigo = req.params.codigo;
    const { cantidad } = req.body;
    let laminas = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const index = laminas.findIndex(l => l.codigo === codigo);
    
    if (index !== -1) {
        const oldQty = laminas[index].cantidad;
        const delta = cantidad - oldQty;

        if (cantidad <= 0) {
            registrarHistorial({ tipo: 'remove', fuente: 'laminas', codigo: laminas[index].codigo, pais: laminas[index].pais, cantidad: 0, detalle: 'Eliminada del stock' });
            laminas.splice(index, 1);
        } else {
            laminas[index].cantidad = cantidad;
            registrarHistorial({ tipo: 'edit', fuente: 'laminas', codigo: laminas[index].codigo, pais: laminas[index].pais, cantidad: cantidad, detalle: `${delta > 0 ? '+' : ''}${delta} - ahora ${cantidad}` });
        }
        
        fs.writeFileSync(dataPath, JSON.stringify(laminas, null, 2));
        res.status(200).json({ mensaje: 'Actualizada' });
        guardarEnGitHub(); // sin await
    } else {
        res.status(404).json({ error: 'No encontrada' });
    }
};

module.exports = { listarLaminas, agregarLamina, eliminarLamina, editarLamina, obtenerDiccionario };