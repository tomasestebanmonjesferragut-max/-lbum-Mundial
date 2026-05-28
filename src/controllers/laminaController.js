const fs = require('fs');
const path = require('path');
const { registrarHistorial } = require('./historialLogger');
const simpleGit = require('simple-git');
const diccionario = require('../data/diccionarioMundial'); 

const historialPath = path.join(__dirname, '../data/historial.json');
const dataPath = path.join(__dirname, '../data/laminas.json');
const git = simpleGit();

let gitQueue = Promise.resolve();

const guardarEnGitHub = () => {
    gitQueue = gitQueue.then(async () => {
        try {
            await git.add([dataPath, historialPath]);
            await git.commit('Auto-update: Lote de láminas y log actualizado');
            await git.push('origin', 'main');
        } catch (err) {
            console.error('Error controlado en Git (laminas):', err.message);
        }
    });
};

const safeWriteJson = (filePath, data) => {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    fs.renameSync(tempPath, filePath);
};

const obtenerDiccionario = (req, res) => res.json(diccionario);

const listarLaminas = (req, res) => {
    try {
        const laminas = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        res.status(200).json(laminas);
    } catch (error) {
        res.status(200).json([]);
    }
};

const agregarLamina = (req, res) => {
    try {
        const codigosRecibidos = req.body.codigos || (req.body.codigo ? [req.body.codigo] : []);
        
        if (!codigosRecibidos || codigosRecibidos.length === 0) {
            return res.status(400).json({ error: 'No se enviaron códigos' });
        }

        let laminas = [];
        if (fs.existsSync(dataPath)) {
            try { laminas = JSON.parse(fs.readFileSync(dataPath, 'utf-8')); } catch(e) { laminas = []; }
        }
        
        let agregadas = 0;
        let errores = [];

        for (let codigoRaw of codigosRecibidos) {
            const match = codigoRaw.toUpperCase().replace(/\s+/g, '').match(/^([A-Z]{2,4})(00|\d{1,3})$/);
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
            safeWriteJson(dataPath, laminas);
            guardarEnGitHub(); 
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
    try {
        const codigo = req.params.codigo;
        let laminas = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        
        const lamina = laminas.find(l => l.codigo === codigo);
        if (lamina) {
            registrarHistorial({ tipo: 'remove', fuente: 'laminas', codigo: lamina.codigo, pais: lamina.pais, cantidad: 0, detalle: 'Eliminada del stock' });
        }

        laminas = laminas.filter(l => l.codigo !== codigo);
        safeWriteJson(dataPath, laminas);
        res.status(200).json({ mensaje: 'Eliminada' });
        guardarEnGitHub();
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar' });
    }
};

const editarLamina = (req, res) => {
    try {
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
            
            safeWriteJson(dataPath, laminas);
            res.status(200).json({ mensaje: 'Actualizada' });
            guardarEnGitHub();
        } else {
            res.status(404).json({ error: 'No encontrada' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al editar' });
    }
};

module.exports = { listarLaminas, agregarLamina, eliminarLamina, editarLamina, obtenerDiccionario };