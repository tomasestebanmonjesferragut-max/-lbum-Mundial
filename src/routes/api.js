const express = require('express');
const router = express.Router();
const { listarLaminas, agregarLamina, eliminarLamina, editarLamina, obtenerDiccionario } = require('../controllers/laminaController');

router.get('/diccionario', obtenerDiccionario); // Nueva: Para el frontend
router.get('/laminas', listarLaminas);
router.post('/laminas', agregarLamina);
router.delete('/laminas/:codigo', eliminarLamina); // Nueva: Eliminar
router.put('/laminas/:codigo', editarLamina);       // Nueva: Editar

module.exports = router;