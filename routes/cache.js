import {
    CACHE_TTL_CATEGORIAS,
    CACHE_TTL_PRODUCTOS,
    CACHE_TTL_EXISTENCIAS,
    CACHE_MAX_CATALOG_KEYS,
    CACHE_MAX_IMAGENES_KEYS,
    CACHE_MAX_EXISTENCIAS_KEYS
} from '../config/index.js';
import { authenticateApiKey } from '../middleware/auth.js';

/**
 * Endpoint: POST /api/cache/stats
 * Obtiene estadísticas del caché
 */
export function setupCacheRoutes(app, cacheCategorias, cacheProductos, cacheImagenes, cacheExistencias) {
    app.post('/api/cache/stats', authenticateApiKey, (req, res) => {
        const statsCategorias = cacheCategorias.getStats();
        const statsProductos = cacheProductos.getStats();
        const statsImagenes = cacheImagenes.getStats();
        const statsExistencias = cacheExistencias ? cacheExistencias.getStats() : { keys: 0, hits: 0, misses: 0 };

        res.json({
            success: true,
            categorias: {
                keys: statsCategorias.keys || 0,
                hits: statsCategorias.hits || 0,
                misses: statsCategorias.misses || 0,
                ttl: CACHE_TTL_CATEGORIAS
            },
            productos: {
                keys: statsProductos.keys || 0,
                hits: statsProductos.hits || 0,
                misses: statsProductos.misses || 0,
                ttl: CACHE_TTL_PRODUCTOS,
                max_keys: CACHE_MAX_CATALOG_KEYS
            },
            imagenes: {
                keys: statsImagenes.keys || 0,
                hits: statsImagenes.hits || 0,
                misses: statsImagenes.misses || 0,
                ttl: CACHE_TTL_PRODUCTOS,
                max_keys: CACHE_MAX_IMAGENES_KEYS
            },
            existencias: {
                keys: statsExistencias.keys || 0,
                hits: statsExistencias.hits || 0,
                misses: statsExistencias.misses || 0,
                ttl: CACHE_TTL_EXISTENCIAS,
                max_keys: CACHE_MAX_EXISTENCIAS_KEYS
            }
        });
    });

    /**
     * Endpoint: POST /api/cache/clear
     * Limpia todo el caché
     */
    app.post('/api/cache/clear', authenticateApiKey, (req, res) => {
        cacheCategorias.flushAll();
        cacheProductos.flushAll();
        cacheImagenes.flushAll();
        if (cacheExistencias) {
            cacheExistencias.flushAll();
        }

        res.json({
            success: true,
            message: 'Caché limpiado correctamente.'
        });
    });
}
