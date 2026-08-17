# Álbum Mundial 2026

Gestor de láminas repetidas para el Álbum del Mundial 2026. Permite llevar el control de qué láminas tenés repetidas y cuáles ya pegaste en tu álbum físico.

## Funcionalidades

- **Láminas repetidas**: agregá, editá y eliminá láminas repetidas por código.
- **Álbum físico**: marcá las láminas que ya pegaste en tu álbum.
- **Historial**: registro de los cambios realizados (altas y bajas).
- **Diccionario de selecciones**: mapea cada prefijo de código a su país y cantidad máxima de láminas.

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior

## Instalación

```bash
npm install
```

## Uso

```bash
npm start
```

El servidor queda disponible en [http://localhost:3000](http://localhost:3000), donde te redirige automáticamente al gestor de láminas.

## Estructura del proyecto

```
src/
├── app.js                  # Punto de entrada del servidor Express
├── routes/api.js           # Rutas de la API
├── controllers/            # Lógica de láminas, álbum e historial
├── data/                   # Datos persistidos en JSON (láminas, álbum, historial)
└── public/                 # Frontend (láminas, álbum, historial, estadísticas)
```

## API

| Método | Ruta                  | Descripción                          |
| ------ | --------------------- | ------------------------------------- |
| GET    | `/api/diccionario`    | Lista de selecciones y sus códigos    |
| GET    | `/api/laminas`        | Lista de láminas repetidas            |
| POST   | `/api/laminas`        | Agrega una lámina repetida            |
| PUT    | `/api/laminas/:codigo`| Edita una lámina repetida             |
| DELETE | `/api/laminas/:codigo`| Elimina una lámina repetida           |
| GET    | `/api/album`          | Lista de láminas pegadas en el álbum  |
| POST   | `/api/album`          | Marca una o más láminas como pegadas  |
| DELETE | `/api/album/:codigo`  | Desmarca una lámina del álbum         |
| GET    | `/api/historial`      | Historial de cambios                  |
