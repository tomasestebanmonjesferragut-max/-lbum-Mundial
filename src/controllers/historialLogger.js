const fs = require('fs');
const path = require('path');

const historialPath = path.join(__dirname, '../data/historial.json');

// Escritura segura para evitar que el historial se corrompa
const safeWriteJson = (filePath, data) => {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    fs.renameSync(tempPath, filePath);
};

// Inicializar el archivo de historial si no existe
if (!fs.existsSync(historialPath)) {
    safeWriteJson(historialPath, []);
}

const registrarHistorial = (entrada) => {
    let log = [];
    try {
        log = JSON.parse(fs.readFileSync(historialPath, 'utf-8'));
    } catch (e) {
        log = []; // Si falla, inicia vacío en vez de crashear
    }
    
    // Se inserta al principio con la hora EXACTA del servidor
    log.unshift({
        id: Math.random().toString(36).slice(2, 9),
        ts: Date.now(),
        ...entrada
    });
    
    // Limitar a los últimos 500 registros para no sobrecargar el archivo
    if (log.length > 500) log.length = 500; 
    
    safeWriteJson(historialPath, log);
};

const obtenerHistorial = (req, res) => {
    try {
        const log = JSON.parse(fs.readFileSync(historialPath, 'utf-8'));
        res.status(200).json(log);
    } catch (error) {
        res.status(200).json([]);
    }
};

module.exports = { registrarHistorial, obtenerHistorial };