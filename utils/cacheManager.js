import NodeCache from 'node-cache';

/**
 * Crea una instancia de NodeCache protegida contra el error fatal 'Cache max keys amount exceeded'.
 * Si el caché alcanza maxKeys, desaloja automáticamente las claves más antiguas (FIFO)
 * para hacer espacio y reintentar el guardado sin arrojar excepciones que rompan peticiones HTTP.
 * 
 * @param {import('node-cache').Options} options 
 * @returns {NodeCache}
 */
export function crearCacheSeguro(options) {
    const cache = new NodeCache(options);
    const originalSet = cache.set.bind(cache);

    cache.set = function (key, val, ttl) {
        try {
            return ttl !== undefined ? originalSet(key, val, ttl) : originalSet(key, val);
        } catch (error) {
            if (error && error.message && error.message.includes('Cache max keys amount exceeded')) {
                try {
                    const keys = cache.keys();
                    if (keys.length > 0) {
                        // Desalojar el 20% de claves más antiguas para liberar espacio de golpe
                        const cantidadAEliminar = Math.max(1, Math.floor(keys.length * 0.2));
                        const clavesAEliminar = keys.slice(0, cantidadAEliminar);
                        cache.del(clavesAEliminar);
                        
                        return ttl !== undefined ? originalSet(key, val, ttl) : originalSet(key, val);
                    }
                } catch {
                    // Si falla el desalojo, degradar suavemente sin romper la petición
                    return false;
                }
            }
            return false;
        }
    };

    return cache;
}
