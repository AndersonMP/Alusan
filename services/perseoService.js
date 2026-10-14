import pLimit from 'p-limit';
import {
    PERSEO_API_KEY,
    API_BASE_URL,
    MAX_CONCURRENT_EXISTENCIAS,
    EXISTENCIAS_REQUEST_TIMEOUT,
    PRODUCTOS_CONSULTA_TIMEOUT
} from '../config/index.js';
import { axiosClient } from '../utils/httpClient.js';
import { obtenerImagenesComprimidas } from './imagenProductoService.js';

const limitadorExistencias = pLimit(MAX_CONCURRENT_EXISTENCIAS);

/**
 * Obtiene todas las categorías de Perseo
 * @returns {Promise<Object>} - Respuesta con categorías
 */
export async function obtenerCategorias() {
    const response = await axiosClient.post(`${API_BASE_URL}/productos_categorias_consulta`, {
        "api_key": PERSEO_API_KEY,
        "descripcion": ""
    });
    
    return response.data;
}

/**
 * Obtiene todas las subcategorías de productos de Perseo
 * @returns {Promise<Object>} - Respuesta con subcategorias
 */
export async function obtenerSubcategorias() {
    const response = await axiosClient.post(`${API_BASE_URL}/productos_subcategorias_consulta`, {
        "api_key": PERSEO_API_KEY
    });

    return response.data;
}

/**
 * Obtiene productos de una categoría específica
 * @param {number} categoriaId - ID de la categoría
 * @returns {Promise<Object>} - Respuesta con productos
 */
export async function obtenerProductosPorCategoria(categoriaId) {
    const response = await axiosClient.post(`${API_BASE_URL}/productos_consulta`, {
        "api_key": PERSEO_API_KEY,
        "categoriasid": categoriaId,
        "usuario_creacion": "ADMIN",
        "dispositivo": "API"
    }, {
        timeout: PRODUCTOS_CONSULTA_TIMEOUT
    });
    
    return response.data;
}

/**
 * Guarda las existencias de todos los almacenes de un producto en el cache
 * @param {number} productoId
 * @param {Array<{almacenesid: number, existencias: number}>} existenciasArray
 * @param {import('node-cache')|null} cacheExistencias
 * @param {number} almacenBuscadoId
 * @returns {number} existencias del almacen buscado
 */
function guardarExistenciasEnCache(productoId, existenciasArray, cacheExistencias, almacenBuscadoId) {
    let stockAlmacen = 0;
    if (Array.isArray(existenciasArray)) {
        for (const item of existenciasArray) {
            if (item.almacenesid === almacenBuscadoId) {
                stockAlmacen = item.existencias || 0;
            }
        }
    }
    // Solo se guarda el almacén consultado: guardar todos los almacenes de cada producto
    // llenaba el caché (10000 claves) con una sola categoría. Un fallo del caché no debe romper la consulta.
    if (cacheExistencias) {
        try {
            cacheExistencias.set(`stock_a${almacenBuscadoId}_p${productoId}`, stockAlmacen);
        } catch {
            // caché lleno: se devuelve el valor sin cachearlo
        }
    }
    return stockAlmacen;
}

/**
 * Obtiene las existencias de un producto específico del almacén configurado
 * @param {number} productoId - ID del producto
 * @param {number} almacenId - ID del almacén (por defecto 2)
 * @param {import('node-cache')|null} cacheExistencias - Cache de existencias
 * @returns {Promise<number>} - Cantidad de existencias del almacén configurado (0 si no hay)
 */
export async function obtenerExistenciasProducto(productoId, almacenId = 2, cacheExistencias = null) {
    const cacheKey = `stock_a${almacenId}_p${productoId}`;
    if (cacheExistencias) {
        const cached = cacheExistencias.get(cacheKey);
        if (typeof cached === 'number') {
            return cached;
        }
    }

    const urlExistencias = `${API_BASE_URL}/existencia_producto`;
    
    try {
        const resExistencias = await axiosClient.post(urlExistencias, {
            "api_key": PERSEO_API_KEY,
            "productosid": productoId
        }, {
            timeout: EXISTENCIAS_REQUEST_TIMEOUT
        });
        
        return guardarExistenciasEnCache(productoId, resExistencias.data?.existencias, cacheExistencias, almacenId);
    } catch {
        // Si falla, intentar retry rápido una vez
        try {
            const resExistenciasRetry = await axiosClient.post(urlExistencias, {
                "api_key": PERSEO_API_KEY,
                "productosid": productoId
            }, {
                timeout: EXISTENCIAS_REQUEST_TIMEOUT
            });
            
            return guardarExistenciasEnCache(productoId, resExistenciasRetry.data?.existencias, cacheExistencias, almacenId);
        } catch {
            return 0; // no se cachea el 0 de un fallo, para reintentar en la próxima petición
        }
    }
}

/**
 * Consulta existencias frescas para varios productos (tiempo casi real con caché)
 * @param {number[]} productosIds
 * @param {number} almacenId
 * @param {import('node-cache')|null} cacheExistencias
 * @returns {Promise<Map<number, number>>}
 */
export async function obtenerExistenciasPorProductosIds(productosIds, almacenId, cacheExistencias = null) {
    const mapa = new Map();
    const idsParaConsultar = [];

    for (const productoId of productosIds) {
        const cacheKey = `stock_a${almacenId}_p${productoId}`;
        if (cacheExistencias) {
            const cached = cacheExistencias.get(cacheKey);
            if (typeof cached === 'number') {
                mapa.set(productoId, cached);
                continue;
            }
        }
        idsParaConsultar.push(productoId);
    }

    if (idsParaConsultar.length === 0) {
        return mapa;
    }

    await Promise.all(
        idsParaConsultar.map((productoId) =>
            limitadorExistencias(async () => {
                const cantidad = await obtenerExistenciasProducto(productoId, almacenId, cacheExistencias);
                mapa.set(productoId, cantidad);
            })
        )
    );

    return mapa;
}

/**
 * Aplica stock fresco sobre grupos (clon, no muta caché)
 * @param {Array<{ variantes: Array<Record<string, unknown>> }>} items
 * @param {number} almacenId
 * @param {import('node-cache')|null} cacheExistencias
 * @returns {Promise<Array<{ variantes: Array<Record<string, unknown>> }>>}
 */
export async function aplicarExistenciasFrescasEnGrupos(items, almacenId, cacheExistencias = null) {
    const idsParaConsultar = new Set();
    const mapaStockCero = new Map();

    for (const grupo of items) {
        for (const variante of grupo.variantes) {
            const productoId = variante.productosid || variante.productoid || variante.id;
            const idNum = typeof productoId === 'number' ? productoId : parseInt(String(productoId), 10);
            if (!Number.isFinite(idNum) || idNum <= 0) {
                continue;
            }

            // OPTIMIZACIÓN CLAVE:
            // Si el producto tiene existenciastotales_global <= 0,
            // no existe stock en NINGÚN almacén de Perseo. Se asigna 0 directamente sin consulta HTTP.
            const stockGlobal = variante.existenciastotales_global ?? variante.existenciastotales_erp ?? null;
            if (stockGlobal !== null && stockGlobal <= 0) {
                mapaStockCero.set(idNum, 0);
            } else {
                idsParaConsultar.add(idNum);
            }
        }
    }

    let existencias = new Map();
    if (idsParaConsultar.size > 0) {
        existencias = await obtenerExistenciasPorProductosIds([...idsParaConsultar], almacenId, cacheExistencias);
    }

    return items.map((grupo) => ({
        ...grupo,
        variantes: grupo.variantes.map((variante) => {
            const productoId = variante.productosid || variante.productoid || variante.id;
            const idNum = typeof productoId === 'number' ? productoId : parseInt(String(productoId), 10);
            let stock = 0;
            if (Number.isFinite(idNum)) {
                if (mapaStockCero.has(idNum)) {
                    stock = 0;
                } else {
                    stock = existencias.get(idNum) ?? 0;
                }
            }
            return {
                ...variante,
                existenciastotales: stock
            };
        })
    }));
}

/**
 * Hidrata productos con imágenes (bajo consumo de memoria); existencias opcionales
 * @param {Array} productosRaw
 * @param {number} almacenId
 * @param {{ incluirImagenes?: boolean, maxImagenes?: number, omitirExistencias?: boolean }} opciones
 * @param {import('node-cache')|null} [cacheImagenes]
 * @param {import('node-cache')|null} [cacheExistencias]
 * @returns {Promise<Array>}
 */
export async function hidratarProductosConImagenes(productosRaw, almacenId = 2, opciones = {}, cacheImagenes = null, cacheExistencias = null) {
    const incluirImagenes = opciones.incluirImagenes !== false;
    const maxImagenes = opciones.maxImagenes ?? 1;
    const omitirExistencias = opciones.omitirExistencias === true;
    const resultados = [];

    for (const prod of productosRaw) {
        const productoId = prod.productosid || prod.productoid || prod.id;
        const stockGlobal = prod.existenciastotales ?? 0;

        if (!productoId) {
            resultados.push({
                ...prod,
                existenciastotales_global: stockGlobal,
                imagenes_data: [],
                existenciastotales: 0
            });
            continue;
        }

        try {
            if (!incluirImagenes) {
                let existencias = 0;
                if (!omitirExistencias) {
                    if (stockGlobal <= 0) {
                        existencias = 0;
                    } else {
                        existencias = await obtenerExistenciasProducto(productoId, almacenId, cacheExistencias);
                    }
                }
                resultados.push({
                    ...prod,
                    existenciastotales_global: stockGlobal,
                    imagenes_data: [],
                    existenciastotales: existencias
                });
                continue;
            }

            const imagenes_data = await obtenerImagenesComprimidas(productoId, maxImagenes, cacheImagenes);

            let existencias = 0;
            if (!omitirExistencias) {
                if (stockGlobal <= 0) {
                    existencias = 0;
                } else {
                    existencias = await obtenerExistenciasProducto(productoId, almacenId, cacheExistencias);
                }
            }

            resultados.push({
                ...prod,
                existenciastotales_global: stockGlobal,
                imagenes_data,
                existenciastotales: existencias
            });
        } catch {
            resultados.push({
                ...prod,
                existenciastotales_global: stockGlobal,
                imagenes_data: [],
                existenciastotales: 0
            });
        }
    }

    return resultados;
}
