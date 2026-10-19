import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

const entero = (valor, fallback) => {
    const n = parseInt(valor, 10);
    return Number.isFinite(n) ? n : fallback;
};

const requerido = (nombre) => {
    const valor = process.env[nombre];
    if (!valor || !valor.trim()) {
        throw new Error(
            `Falta la variable de entorno obligatoria ${nombre}. ` +
            'Configúrala en el entorno del servicio (Coolify/Render) o en .env; no hay valor por defecto.'
        );
    }
    return valor.trim();
};

export const PERSEO_API_KEY = requerido('PERSEO_API_KEY');
export const API_BASE_URL = process.env.API_BASE_URL || "https://accesoalnusan.app/api";
export const PORT = process.env.PORT || 3001;

export const API_KEY = process.env.API_KEY?.trim() || PERSEO_API_KEY;
export const API_SECRET_KEY = process.env.API_SECRET_KEY;

// Calidad y dimensiones optimizadas para e-commerce (hasta 800px)
export const MAX_IMAGE_SIZE = entero(process.env.MAX_IMAGE_SIZE, 800);
export const IMAGE_QUALITY = entero(process.env.IMAGE_QUALITY, 75);
export const COMPRESSION_EFFORT = entero(process.env.COMPRESSION_EFFORT, 4);
export const MAX_OUTPUT_BYTES = entero(process.env.MAX_OUTPUT_BYTES, 150000);
export const IMAGE_EMERGENCY_SIZE = entero(process.env.IMAGE_EMERGENCY_SIZE, 400);
export const IMAGE_EMERGENCY_QUALITY = entero(process.env.IMAGE_EMERGENCY_QUALITY, 60);
export const MAX_IMAGE_RESPONSE_BYTES = entero(process.env.MAX_IMAGE_RESPONSE_BYTES, 5 * 1024 * 1024);

// Valores efectivos de imagen: se registran al arrancar para poder verificar
// en los logs del despliegue si las variables de entorno se aplicaron.
export const CONFIG_IMAGENES = Object.freeze({
    maxSize: MAX_IMAGE_SIZE,
    quality: IMAGE_QUALITY,
    effort: COMPRESSION_EFFORT,
    maxOutputBytes: MAX_OUTPUT_BYTES,
    emergencySize: IMAGE_EMERGENCY_SIZE,
    emergencyQuality: IMAGE_EMERGENCY_QUALITY
});

export const MAX_CONCURRENT_REQUESTS = entero(process.env.MAX_CONCURRENT_REQUESTS, isProd ? 4 : 12);
export const MAX_CONCURRENT_COMPRESSION = entero(process.env.MAX_CONCURRENT_COMPRESSION, isProd ? 2 : 6);
export const MAX_CONCURRENT_EXISTENCIAS = entero(process.env.MAX_CONCURRENT_EXISTENCIAS, isProd ? 15 : 20);
export const HIDRATACION_BATCH_SIZE = entero(process.env.HIDRATACION_BATCH_SIZE, isProd ? 4 : 8);
export const EXISTENCIAS_BATCH_SIZE = entero(process.env.EXISTENCIAS_BATCH_SIZE, isProd ? 30 : 50);
export const COMPRESSION_BATCH_SIZE = entero(process.env.COMPRESSION_BATCH_SIZE, isProd ? 2 : 12);
export const CACHE_MAX_CATALOG_KEYS = entero(process.env.CACHE_MAX_CATALOG_KEYS, 200);
export const CACHE_MAX_IMAGENES_KEYS = entero(process.env.CACHE_MAX_IMAGENES_KEYS, 10000);
export const CACHE_MAX_EXISTENCIAS_KEYS = entero(process.env.CACHE_MAX_EXISTENCIAS_KEYS, 25000);
export const NODE_HEAP_MB = entero(process.env.NODE_HEAP_MB, isProd ? 384 : 512);
export const IMAGE_REQUEST_TIMEOUT = entero(process.env.IMAGE_REQUEST_TIMEOUT, 10000);
export const EXISTENCIAS_REQUEST_TIMEOUT = entero(process.env.EXISTENCIAS_REQUEST_TIMEOUT, 5000);
export const PRODUCTOS_CONSULTA_TIMEOUT = entero(process.env.PRODUCTOS_CONSULTA_TIMEOUT, 60000);

export const ALMACEN_ID = entero(process.env.ALMACEN_ID, 2);

// Caché en memoria (segundos) — más TTL = menos banda y CPU
export const CACHE_TTL_CATEGORIAS = entero(process.env.CACHE_TTL_CATEGORIAS, 6 * 60 * 60);
export const CACHE_TTL_PRODUCTOS = entero(process.env.CACHE_TTL_PRODUCTOS, 4 * 60 * 60);
export const CACHE_TTL_EXISTENCIAS = entero(process.env.CACHE_TTL_EXISTENCIAS, 120);

// Opciones por defecto en POST /api/productos (sobreescribibles en el body)
export const DEFAULT_INCLUIR_IMAGENES =
    process.env.DEFAULT_INCLUIR_IMAGENES !== undefined
        ? process.env.DEFAULT_INCLUIR_IMAGENES !== 'false'
        : true;
export const DEFAULT_MAX_IMAGENES = entero(process.env.DEFAULT_MAX_IMAGENES, 1);
export const DEFAULT_TARIFAS_RESUMIDAS =
    process.env.DEFAULT_TARIFAS_RESUMIDAS !== undefined
        ? process.env.DEFAULT_TARIFAS_RESUMIDAS === 'true'
        : isProd;
export const CACHE_CONTROL_PRODUCTOS = entero(process.env.CACHE_CONTROL_PRODUCTOS, 60);
