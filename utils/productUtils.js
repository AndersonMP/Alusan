import { obtenerCategorias, obtenerSubcategorias } from '../services/perseoService.js';
import { axiosClient } from './httpClient.js';

const CACHE_KEY_CATEGORIAS_MAPA = 'categorias_mapa_id_nombre';
const CACHE_KEY_SUBCATEGORIAS_MAPA = 'subcategorias_mapa_id_nombre';

/**
 * Construye un mapa id → nombre desde un listado de Perseo
 * @param {Array<{ productos_categoriasid?: number, productos_subcategoriasid?: number, descripcion?: string }>} items
 * @param {'productos_categoriasid' | 'productos_subcategoriasid'} idField
 * @returns {Map<number, string>}
 */
function construirMapaIdNombre(items, idField) {
    const mapa = new Map();
    if (!Array.isArray(items)) {
        return mapa;
    }
    for (const item of items) {
        const id = item[idField];
        const nombre = item.descripcion;
        if (typeof id === 'number' && nombre) {
            mapa.set(id, String(nombre).trim());
        }
    }
    return mapa;
}

/**
 * Mapa categoría id → nombre (con caché en memoria)
 * @param {import('node-cache')} cacheTaxonomia
 * @returns {Promise<Map<number, string>>}
 */
export async function obtenerMapaCategoriasPorId(cacheTaxonomia) {
    const cached = cacheTaxonomia.get(CACHE_KEY_CATEGORIAS_MAPA);
    if (cached instanceof Map) {
        return cached;
    }

    const response = await obtenerCategorias();
    const mapa = construirMapaIdNombre(response?.categorias ?? [], 'productos_categoriasid');
    cacheTaxonomia.set(CACHE_KEY_CATEGORIAS_MAPA, mapa);
    return mapa;
}

/**
 * Mapa subcategoría id → nombre (con caché en memoria)
 * @param {import('node-cache')} cacheTaxonomia
 * @returns {Promise<Map<number, string>>}
 */
export async function obtenerMapaSubcategoriasPorId(cacheTaxonomia) {
    const cached = cacheTaxonomia.get(CACHE_KEY_SUBCATEGORIAS_MAPA);
    if (cached instanceof Map) {
        return cached;
    }

    const response = await obtenerSubcategorias();
    const mapa = construirMapaIdNombre(response?.subcategorias ?? [], 'productos_subcategoriasid');
    cacheTaxonomia.set(CACHE_KEY_SUBCATEGORIAS_MAPA, mapa);
    return mapa;
}

/**
 * Añade nombres de categoría y subcategoría a cada producto (variante)
 * @param {Array<Record<string, unknown>>} productos
 * @param {Map<number, string>} mapaCategorias
 * @param {Map<number, string>} mapaSubcategorias
 * @returns {Array<Record<string, unknown>>}
 */
export function enriquecerProductosConNombresTaxonomia(productos, mapaCategorias, mapaSubcategorias) {
    return productos.map((prod) => {
        const categoriaId = prod.productos_categoriasid;
        const subcategoriaId = prod.productos_subcategoriasid;
        return {
            ...prod,
            productos_categorias_nombre:
                typeof categoriaId === 'number' ? (mapaCategorias.get(categoriaId) ?? null) : null,
            productos_subcategorias_nombre:
                typeof subcategoriaId === 'number' ? (mapaSubcategorias.get(subcategoriaId) ?? null) : null
        };
    });
}

/**
 * @param {unknown} value
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
export function parseBodyBoolean(value, defaultValue) {
    if (value === undefined || value === null) {
        return defaultValue;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (value === 1 || value === '1' || value === 'true') {
        return true;
    }
    if (value === 0 || value === '0' || value === 'false') {
        return false;
    }
    return defaultValue;
}

/**
 * Caché del catálogo (sin imágenes ni almacén); imágenes van en caché aparte por producto
 * @param {number} categoriaId
 * @param {{ tarifasResumidas: boolean }} opciones
 * @returns {string}
 */
export function construirCacheKeyCatalogo(categoriaId, opciones) {
    const tar = opciones.tarifasResumidas ? 1 : 0;
    return `catalog_c${categoriaId}_t${tar}`;
}

/** @deprecated Usar construirCacheKeyCatalogo */
export function construirCacheKeyProductos(categoriaId, _almacenId, opciones) {
    return construirCacheKeyCatalogo(categoriaId, opciones);
}

/**
 * Clona grupos aplicando existencias frescas por productosid
 * @param {Array<{ variantes: Array<Record<string, unknown>> }>} items
 * @param {Map<number, number>} existenciasPorProductoId
 * @returns {Array<{ variantes: Array<Record<string, unknown>> }>}
 */
export function clonarGruposConExistencias(items, existenciasPorProductoId) {
    return items.map((grupo) => ({
        ...grupo,
        variantes: grupo.variantes.map((variante) => {
            const productoId = variante.productosid || variante.productoid || variante.id;
            const idNum = typeof productoId === 'number' ? productoId : parseInt(String(productoId), 10);
            return {
                ...variante,
                existenciastotales: Number.isFinite(idNum) ? (existenciasPorProductoId.get(idNum) ?? 0) : 0
            };
        })
    }));
}

/**
 * Extrae IDs únicos de variantes en grupos
 * @param {Array<{ variantes: Array<Record<string, unknown>> }>} items
 * @returns {number[]}
 */
export function extraerProductosIdsDeGrupos(items) {
    const ids = new Set();
    for (const grupo of items) {
        for (const variante of grupo.variantes) {
            const productoId = variante.productosid || variante.productoid || variante.id;
            const idNum = typeof productoId === 'number' ? productoId : parseInt(String(productoId), 10);
            if (Number.isFinite(idNum) && idNum > 0) {
                ids.add(idNum);
            }
        }
    }
    return [...ids];
}

/**
 * Deja solo tarifa PUBLICO (o la primera) para reducir peso del JSON
 * @param {Record<string, unknown>} producto
 * @returns {Record<string, unknown>}
 */
export function resumirTarifasProducto(producto) {
    const tarifas = producto.tarifas;
    if (!tarifas || typeof tarifas !== 'object' || !Array.isArray(tarifas.unidadinterna)) {
        return producto;
    }

    const lista = tarifas.unidadinterna;
    const publica = lista.find(
        (t) => t?.tarifadescripcion === 'PUBLICO' || t?.tarifasid === 1
    ) ?? lista[0];

    return {
        ...producto,
        tarifas: {
            unidadinterna: publica ? [publica] : []
        }
    };
}

/**
 * Limita imágenes y tarifas según opciones de respuesta
 * @param {Record<string, unknown>} producto
 * @param {{ incluirImagenes: boolean, maxImagenes: number, tarifasResumidas: boolean }} opciones
 * @returns {Record<string, unknown>}
 */
export function aplicarOpcionesVariante(producto, opciones) {
    let resultado = { ...producto };

    if (opciones.tarifasResumidas) {
        resultado = resumirTarifasProducto(resultado);
    }

    if (!opciones.incluirImagenes) {
        resultado.imagenes_data = [];
    } else if (Array.isArray(resultado.imagenes_data) && opciones.maxImagenes > 0) {
        resultado.imagenes_data = resultado.imagenes_data.slice(0, opciones.maxImagenes);
    }

    return resultado;
}

/**
 * Función lógica para agrupar por código padre (OPTIMIZADA PARA VELOCIDAD)
 * Usa técnicas de optimización: pre-allocación, indexOf más rápido que split
 * @param {Array} lista - Lista de productos con imágenes
 * @returns {Array} - Productos agrupados por código padre
 */
export function agruparProductos(lista) {
    const mapaPadres = {};
    const resultados = [];

    // Optimización: pre-calcular códigos padre para evitar múltiples operaciones
    for (let i = 0; i < lista.length; i++) {
        const item = lista[i];
        const codigoOriginal = item.productocodigo || "";
        
        // Optimización: indexOf es más rápido que split para encontrar el guion
        const indiceGuion = codigoOriginal.indexOf('-');
        const codigoPadre = indiceGuion > 0 
            ? codigoOriginal.substring(0, indiceGuion)
            : codigoOriginal;

        let grupo = mapaPadres[codigoPadre];
        
        if (!grupo) {
            grupo = {
                codigo_padre: codigoPadre,
                tiene_variantes: false,
                variantes: []
            };
            mapaPadres[codigoPadre] = grupo;
            resultados.push(grupo); // Mantener orden de inserción
        }

        grupo.variantes.push(item);
        
        // Optimización: solo marcar una vez cuando llega el segundo
        if (grupo.variantes.length === 2) {
            grupo.tiene_variantes = true;
        }
    }

    return resultados;
}

/**
 * Busca el ID de una categoría por nombre
 * @param {string} nombreCategoria - Nombre de la categoría a buscar
 * @param {Object} cacheCategorias - Cache de categorías
 * @param {string} API_BASE_URL - URL base de la API
 * @param {string} PERSEO_API_KEY - API key de Perseo
 * @returns {Promise<number|null>} - ID de la categoría o null si no se encuentra
 */
export async function buscarCategoriaPorNombre(nombreCategoria, cacheCategorias, API_BASE_URL, PERSEO_API_KEY) {
    const cacheKey = 'categorias_all';
    
    // Intentar obtener desde caché primero
    let categorias = cacheCategorias.get(cacheKey);
    
    if (!categorias || !categorias.data) {
        // Si no hay en caché, consultar a Perseo
        try {
            const response = await axiosClient.post(`${API_BASE_URL}/productos_categorias_consulta`, {
                "api_key": PERSEO_API_KEY,
                "descripcion": ""
            });
            
            if (response.data && response.data.categorias) {
                categorias = {
                    success: true,
                    data: response.data.categorias
                };
                // Guardar en caché
                cacheCategorias.set(cacheKey, categorias);
            } else {
                return null;
            }
        } catch {
            return null;
        }
    }
    
    // Buscar la categoría por nombre (case-insensitive - sin importar mayúsculas/minúsculas)
    // Asegurar que nombreCategoria sea un string
    const nombreCategoriaStr = String(nombreCategoria || '').trim();
    if (!nombreCategoriaStr) {
        return null;
    }
    
    const nombreCategoriaNormalizado = nombreCategoriaStr.toLowerCase();
    const categoriaEncontrada = categorias.data.find(cat => {
        if (!cat.descripcion) return false;
        const descripcionNormalizada = String(cat.descripcion).trim().toLowerCase();
        return descripcionNormalizada === nombreCategoriaNormalizado;
    });
    
    return categoriaEncontrada ? categoriaEncontrada.productos_categoriasid : null;
}

