import express from 'express';
import cors from 'cors';
import compression from 'compression';
import NodeCache from 'node-cache';
import {
    PORT,
    CACHE_TTL_CATEGORIAS,
    CACHE_TTL_PRODUCTOS,
    CACHE_TTL_EXISTENCIAS,
    CACHE_MAX_CATALOG_KEYS,
    CACHE_MAX_IMAGENES_KEYS,
    CACHE_MAX_EXISTENCIAS_KEYS
} from './config/index.js';
import { requestLogger } from './middleware/logger.js';
import { setupCategoriasRoutes } from './routes/categorias.js';
import { setupSubcategoriasRoutes } from './routes/subcategorias.js';
import { setupProductosRoutes } from './routes/productos.js';
import { setupAlmacenesRoutes } from './routes/almacenes.js';
import { setupCacheRoutes } from './routes/cache.js';

import { crearCacheSeguro } from './utils/cacheManager.js';

const app = express();

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(requestLogger);

// Servir documentación estática
app.use('/docs', express.static('docs'));

// Redirección de raíz a documentación
app.get('/', (req, res) => {
    res.redirect('/docs');
});

// Configuración de caché protegida contra desbordamientos
const cacheCategorias = crearCacheSeguro({ stdTTL: CACHE_TTL_CATEGORIAS, useClones: false });
const cacheProductos = crearCacheSeguro({
    stdTTL: CACHE_TTL_PRODUCTOS,
    useClones: false,
    maxKeys: CACHE_MAX_CATALOG_KEYS
});
const cacheImagenes = crearCacheSeguro({
    stdTTL: CACHE_TTL_PRODUCTOS,
    useClones: false,
    maxKeys: CACHE_MAX_IMAGENES_KEYS
});
const cacheExistencias = crearCacheSeguro({
    stdTTL: CACHE_TTL_EXISTENCIAS,
    useClones: false,
    maxKeys: CACHE_MAX_EXISTENCIAS_KEYS
});

// Configurar rutas
setupCategoriasRoutes(app, cacheCategorias);
setupSubcategoriasRoutes(app, cacheCategorias);
setupAlmacenesRoutes(app);
setupProductosRoutes(app, cacheProductos, cacheCategorias, cacheImagenes, cacheExistencias);
setupCacheRoutes(app, cacheCategorias, cacheProductos, cacheImagenes, cacheExistencias);

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Perseo API escuchando en http://localhost:${PORT} (docs: /docs)`);
});
