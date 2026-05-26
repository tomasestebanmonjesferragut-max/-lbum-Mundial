const express = require('express');
const router = express.Router();
const { listarLaminas, agregarLamina, eliminarLamina, editarLamina, obtenerDiccionario } = require('../controllers/laminaController');
const { listarAlbum, agregarAlbum, quitarAlbum } = require('../controllers/albumController');

// --- Repetidas ---
router.get('/diccionario', obtenerDiccionario);
router.get('/laminas', listarLaminas);
router.post('/laminas', agregarLamina);
router.delete('/laminas/:codigo', eliminarLamina);
router.put('/laminas/:codigo', editarLamina);

// --- Álbum físico (independiente) ---
router.get('/album', listarAlbum);
router.post('/album', agregarAlbum);
router.delete('/album/:codigo', quitarAlbum);

module.exports = router;