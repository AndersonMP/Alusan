import {
    PERSEO_API_KEY,
    API_BASE_URL,
    IMAGE_REQUEST_TIMEOUT,
    MAX_IMAGE_RESPONSE_BYTES
} from '../config/index.js';
import { axiosClient } from '../utils/httpClient.js';
import { procesarImagen, limitadorCompresion } from '../utils/imageProcessor.js';

/**
 * Descarga imágenes crudas de Perseo (sin comprimir)
 * @param {number} productoId
 * @param {number} maxImagenes
 * @returns {Promise<string[]>}
 */
export async function obtenerImagenesProducto(productoId, maxImagenes = 1) {
    const urlImagen = `${API_BASE_URL}/productos_imagenes_consulta`;
    const limite = maxImagenes > 0 ? maxImagenes : 0;

    try {
        const resImg = await axiosClient.post(urlImagen, {
            api_key: PERSEO_API_KEY,
            productosid: productoId
        }, {
            timeout: IMAGE_REQUEST_TIMEOUT,
            maxContentLength: MAX_IMAGE_RESPONSE_BYTES,
            maxBodyLength: MAX_IMAGE_RESPONSE_BYTES
        });

        if (resImg.data?.informacion === true &&
            Array.isArray(resImg.data?.productos_imagenes) &&
            resImg.data.productos_imagenes.length > 0) {
            const imagenes = resImg.data.productos_imagenes
                .map((img) => img.imagen)
                .filter(Boolean);
            return limite > 0 ? imagenes.slice(0, limite) : imagenes;
        }

        return [];
    } catch {
        try {
            const resImgRetry = await axiosClient.post(urlImagen, {
                api_key: PERSEO_API_KEY,
                productosid: productoId
            }, {
                timeout: IMAGE_REQUEST_TIMEOUT,
                maxContentLength: MAX_IMAGE_RESPONSE_BYTES,
                maxBodyLength: MAX_IMAGE_RESPONSE_BYTES
            });

            if (resImgRetry.data?.informacion === true &&
                Array.isArray(resImgRetry.data?.productos_imagenes) &&
                resImgRetry.data.productos_imagenes.length > 0) {
                const imagenes = resImgRetry.data.productos_imagenes
                    .map((img) => img.imagen)
                    .filter(Boolean);
                return limite > 0 ? imagenes.slice(0, limite) : imagenes;
            }
        } catch {
            // Sin imágenes
        }

        return [];
    }
}

/**
 * Clave de caché por producto e imágenes solicitadas
 * @param {number} productoId
 * @param {number} maxImagenes
 * @returns {string}
 */
export function claveCacheImagen(productoId, maxImagenes) {
    return `img_p${productoId}_m${maxImagenes}`;
}

/**
 * Obtiene imágenes comprimidas (caché → Perseo → comprimir una a una)
 * @param {number} productoId
 * @param {number} maxImagenes
 * @param {import('node-cache')|null} cacheImagenes
 * @returns {Promise<string[]>}
 */
export async function obtenerImagenesComprimidas(productoId, maxImagenes, cacheImagenes) {
    if (!productoId || maxImagenes <= 0) {
        return [];
    }

    const key = claveCacheImagen(productoId, maxImagenes);

    if (cacheImagenes) {
        const cached = cacheImagenes.get(key);
        if (Array.isArray(cached)) {
            return cached;
        }
    }

    const raw = await obtenerImagenesProducto(productoId, maxImagenes);
    const comprimidas = [];

    for (const img of raw) {
        const comprimida = await procesarImagen(img);
        if (comprimida) {
            comprimidas.push(comprimida);
        }
    }

    if (cacheImagenes && comprimidas.length > 0) {
        cacheImagenes.set(key, comprimidas);
    }

    return comprimidas;
}

/**
 * Quita imágenes del catálogo en caché (se guardan aparte)
 * @param {Array<{ variantes: Array<Record<string, unknown>> }>} items
 * @returns {Array<{ variantes: Array<Record<string, unknown>> }>}
 */
export function stripImagenesDeGrupos(items) {
    return items.map((grupo) => ({
        ...grupo,
        variantes: grupo.variantes.map(({ imagenes_data: _img, ...variante }) => variante)
    }));
}

/**
 * Adjunta imágenes desde caché; re-hidrata solo las que falten concurrentemente
 * @param {Array<{ variantes: Array<Record<string, unknown>> }>} items
 * @param {import('node-cache')|null} cacheImagenes
 * @param {{ incluirImagenes: boolean, maxImagenes: number }} opciones
 * @returns {Promise<Array<{ variantes: Array<Record<string, unknown>> }>>}
 */
export async function adjuntarImagenesAGrupos(items, cacheImagenes, opciones) {
    if (!opciones.incluirImagenes || opciones.maxImagenes <= 0) {
        return items.map((grupo) => ({
            ...grupo,
            variantes: grupo.variantes.map((variante) => ({
                ...variante,
                imagenes_data: []
            }))
        }));
    }

    // 1. Recolectar todos los IDs únicos de producto
    const idsUnicos = new Set();
    for (const grupo of items) {
        for (const variante of grupo.variantes) {
            const productoId = variante.productosid || variante.productoid || variante.id;
            const idNum = typeof productoId === 'number' ? productoId : parseInt(String(productoId), 10);
            if (Number.isFinite(idNum) && idNum > 0) {
                idsUnicos.add(idNum);
            }
        }
    }

    // 2. Verificar cuáles ya están en caché y cuáles faltan
    const mapaImagenes = new Map();
    const idsFaltantes = [];

    for (const id of idsUnicos) {
        const key = claveCacheImagen(id, opciones.maxImagenes);
        if (cacheImagenes) {
            const cached = cacheImagenes.get(key);
            if (Array.isArray(cached)) {
                mapaImagenes.set(id, cached);
                continue;
            }
        }
        idsFaltantes.push(id);
    }

    // 3. Descargar y comprimir concurrentemente solo los faltantes
    if (idsFaltantes.length > 0) {
        await Promise.all(
            idsFaltantes.map((id) =>
                limitadorCompresion(async () => {
                    const imagenes = await obtenerImagenesComprimidas(id, opciones.maxImagenes, cacheImagenes);
                    mapaImagenes.set(id, imagenes);
                })
            )
        );
    }

    // 4. Asignar imágenes a las variantes de cada grupo
    return items.map((grupo) => ({
        ...grupo,
        variantes: grupo.variantes.map((variante) => {
            const productoId = variante.productosid || variante.productoid || variante.id;
            const idNum = typeof productoId === 'number' ? productoId : parseInt(String(productoId), 10);
            const imagenes_data = Number.isFinite(idNum) ? (mapaImagenes.get(idNum) || []) : [];
            return {
                ...variante,
                imagenes_data
            };
        })
    }));
}
