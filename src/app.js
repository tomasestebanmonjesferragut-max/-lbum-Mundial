const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Servir la página web (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Conectar las rutas de las láminas
app.use('/api', apiRoutes);

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor del Álbum 2026 corriendo en http://localhost:${PORT}`);
});