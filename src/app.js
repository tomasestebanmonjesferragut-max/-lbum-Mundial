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

// REDIRECCIÓN AUTOMÁTICA: Si entras a localhost:3000, te lleva al gestor
app.get('/', (req, res) => {
    res.redirect('/laminas/index.html');
});

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor del Álbum 2026 corriendo en http://localhost:${PORT}`);
});