const fs = require('fs');
const path = require('path');

const historialPath = path.join(__dirname, '../data/historial.json');

// Inicializar el archivo de historial si no existe
if (!fs.existsSync(historialPath)) {
    fs.writeFileSync(historialPath, JSON.stringify([], null, 2));
}

const registrarHistorial = (entrada) => {
    let log = JSON.parse(fs.readFileSync(historialPath, 'utf-8'));
    
    // Se inserta al principio con la hora EXACTA del servidor
    log.unshift({
        id: Math.random().toString(36).slice(2, 9),
        ts: Date.now(),
        ...entrada
    });
    
    // Limitar a los últimos 500 registros para no sobrecargar el archivo
    if (log.length > 500) log.length = 500; 
    
    fs.writeFileSync(historialPath, JSON.stringify(log, null, 2));
};

const obtenerHistorial = (req, res) => {
    const log = JSON.parse(fs.readFileSync(historialPath, 'utf-8'));
    res.status(200).json(log);
};

module.exports = { registrarHistorial, obtenerHistorial };