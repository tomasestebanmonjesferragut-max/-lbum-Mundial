const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const diccionario = require('../data/diccionarioMundial'); 

const git = simpleGit();
const dataPath = path.join(__dirname, '../data/laminas.json');

const guardarEnGitHub = async () => {
    try {
        await git.add(dataPath);
        await git.commit('Auto-update: Lote de láminas actualizado');
        await git.push('origin', 'main'); 
    } catch (error) {
        console.error('Error Git:', error);
    }
};

const obtenerDiccionario = (req, res) => res.json(diccionario);

const listarLaminas = (req, res) => {
    const laminas = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    res.status(200).json(laminas);
};

const agregarLamina = async (req, res) => {
    try {
        // Soportar un array de códigos o un solo código (retrocompatibilidad)
        const codigosRecibidos = req.body.codigos || (req.body.codigo ? [req.body.codigo] : []);
        
        if (!codigosRecibidos || codigosRecibidos.length === 0) {
            return res.status(400).json({ error: 'No se enviaron códigos' });
        }

        let laminas = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        let agregadas = 0;
        let errores = [];

        // Procesar todas las láminas de la lista
        for (let codigoRaw of codigosRecibidos) {
            const match = codigoRaw.toUpperCase().replace(/\s+/g, '').match(/^([A-Z]{2,3})(00|\d{1,2})$/);
            if (!match) {
                errores.push(`${codigoRaw}: Formato inválido`);
                continue;
            }

            let prefijo = match[1];
            let numeroStr = match[2];
            let num = parseInt(numeroStr);
            if (numeroStr !== "00") numeroStr = numeroStr.padStart(2, '0');

            const codigoFormateado = `${prefijo} ${numeroStr}`;
            const paisInfo = diccionario[prefijo];

            // Validaciones
            if (!paisInfo) {
                errores.push(`${codigoFormateado}: País no existe`);
                continue;
            }
            if (numeroStr !== "00" && (num < 1 || num > paisInfo.max)) {
                errores.push(`${codigoFormateado}: Límite es ${paisInfo.max}`);
                continue;
            }
            if (numeroStr === "00" && (!paisInfo.extra || !paisInfo.extra.includes("00"))) {
                errores.push(`${codigoFormateado}: No tiene lámina 00`);
                continue;
            }

            // Sumar a la base de datos
            const index = laminas.findIndex(l => l.codigo === codigoFormateado);
            if (index !== -1) {
                laminas[index].cantidad += 1;
            } else {
                laminas.push({ codigo: codigoFormateado, pais: paisInfo.nombre, cantidad: 1 });
            }
            agregadas++;
        }

        // Si al menos una funcionó, guardamos todo junto
        if (agregadas > 0) {
            fs.writeFileSync(dataPath, JSON.stringify(laminas, null, 2));
            await guardarEnGitHub();
        }

        res.status(200).json({ 
            mensaje: `Se agregaron ${agregadas} láminas.`, 
            errores: errores.length > 0 ? errores : null 
        });

    } catch (error) { 
        res.status(500).json({ error: 'Error del servidor' }); 
    }
};

const eliminarLamina = async (req, res) => {
    const codigo = req.params.codigo;
    let laminas = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    laminas = laminas.filter(l => l.codigo !== codigo);
    fs.writeFileSync(dataPath, JSON.stringify(laminas, null, 2));
    res.status(200).json({ mensaje: 'Eliminada' });
    await guardarEnGitHub();
};

const editarLamina = async (req, res) => {
    const codigo = req.params.codigo;
    const { cantidad } = req.body;
    let laminas = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const index = laminas.findIndex(l => l.codigo === codigo);
    
    if (index !== -1) {
        if (cantidad <= 0) {
            laminas.splice(index, 1);
        } else {
            laminas[index].cantidad = cantidad;
        }
        fs.writeFileSync(dataPath, JSON.stringify(laminas, null, 2));
        res.status(200).json({ mensaje: 'Actualizada' });
        await guardarEnGitHub();
    } else {
        res.status(404).json({ error: 'No encontrada' });
    }
};

module.exports = { listarLaminas, agregarLamina, eliminarLamina, editarLamina, obtenerDiccionario };