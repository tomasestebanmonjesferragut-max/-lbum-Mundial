const { registrarHistorial } = require('./historialLogger');
const historialPath = path.join(__dirname, '../data/historial.json');
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const diccionario = require('../data/diccionarioMundial');

const git = simpleGit();
const dataPath = path.join(__dirname, '../data/album.json');

if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify([], null, 2));
}

// Fire-and-forget: sin await. Se incluye el historialPath para guardar ambos archivos
const guardarEnGitHub = () => {
    git.add([dataPath, historialPath])
        .then(() => git.commit('Auto-update: Álbum físico y log actualizados'))
        .then(() => git.push('origin', 'main'))
        .catch(err => console.error('Error Git (album):', err));
};

const listarAlbum = (req, res) => {
    const laminas = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    res.status(200).json(laminas);
};

const agregarAlbum = (req, res) => {
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

            const existe = laminas.findIndex(l => l.codigo === codigoFormateado);
            if (existe === -1) {
                laminas.push({ codigo: codigoFormateado, pais: paisInfo.nombre, pegada: true });
                registrarHistorial({ tipo: 'album-add', fuente: 'album', codigo: codigoFormateado, pais: paisInfo.nombre, detalle: 'Pegada en el álbum' });
                agregadas++;
            }
        }

        if (agregadas > 0) {
            fs.writeFileSync(dataPath, JSON.stringify(laminas, null, 2));
            guardarEnGitHub(); // sin await
        }

        res.status(200).json({
            mensaje: `${agregadas} láminas marcadas en el álbum.`,
            errores: errores.length > 0 ? errores : null
        });

    } catch (error) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

const quitarAlbum = (req, res) => {
    const codigo = decodeURIComponent(req.params.codigo);
    let laminas = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    // Buscar la lámina antes de quitarla para registrar el evento
    const lamina = laminas.find(l => l.codigo === codigo);
    if (lamina) {
        registrarHistorial({ tipo: 'album-remove', fuente: 'album', codigo: lamina.codigo, pais: lamina.pais, detalle: 'Quitada del álbum' });
    }

    laminas = laminas.filter(l => l.codigo !== codigo);
    fs.writeFileSync(dataPath, JSON.stringify(laminas, null, 2));
    guardarEnGitHub(); // sin await
    res.status(200).json({ mensaje: 'Lámina desmarcada' });
};

module.exports = { listarAlbum, agregarAlbum, quitarAlbum };