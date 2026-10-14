import { PERSEO_API_KEY, API_BASE_URL } from '../config/index.js';
import { axiosClient } from '../utils/httpClient.js';
import NodeCache from 'node-cache';

// Cache de almacenes (30 minutos TTL)
const cacheAlmacenes = new NodeCache({ stdTTL: 30 * 60 });

/**
 * Obtiene la lista de almacenes desde Perseo (con caché)
 * @returns {Promise<Array>} - Array de almacenes con {almacenesid, descripcion}
 */
export async function obtenerAlmacenes() {
    const cacheKey = 'almacenes_all';
    
    // Intentar obtener desde caché primero
    const cachedAlmacenes = cacheAlmacenes.get(cacheKey);
    if (cachedAlmacenes) {
        return cachedAlmacenes;
    }

    try {
        const response = await axiosClient.post(`${API_BASE_URL}/almacenes_consulta`, {
            "api_key": PERSEO_API_KEY
        }, {
            timeout: 10000
        });

        if (response.data?.almacenes && Array.isArray(response.data.almacenes)) {
            // Guardar en caché
            cacheAlmacenes.set(cacheKey, response.data.almacenes);
            return response.data.almacenes;
        }

        return [];
    } catch {
        return [];
    }
}

/**
 * Valida si un almacén existe consultando la lista de almacenes de Perseo
 * @param {number} almacenId - ID del almacén a validar
 * @returns {Promise<{existe: boolean, nombre?: string}>} - Objeto con si existe y opcionalmente el nombre
 */
export async function validarAlmacen(almacenId) {
    if (!almacenId || almacenId <= 0 || isNaN(almacenId)) {
        return { existe: false };
    }

    try {
        const almacenes = await obtenerAlmacenes();
        
        if (almacenes.length === 0) {
            return { existe: false };
        }

        const almacenEncontrado = almacenes.find(
            almacen => almacen.almacenesid === almacenId
        );

        if (almacenEncontrado) {
            return {
                existe: true,
                nombre: almacenEncontrado.descripcion || `Almacén ${almacenId}`
            };
        }

        return { existe: false };
    } catch {
        return { existe: false };
    }
}

