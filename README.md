# Perseo API Server

Servidor API para procesamiento optimizado de productos de Perseo con agrupación por código padre.

## 🚀 Características

- **Procesamiento Paralelo**: Descarga imágenes y existencias simultáneamente
- **Agrupación Inteligente**: Agrupa productos por código padre (separado por guion)
- **Consulta de Existencias**: Obtiene existencias del almacén especificado
- **Imágenes ultra comprimidas**: WebP miniatura (~120px, calidad baja) para reducir banda en Render

## 📋 Requisitos Previos

- Node.js 18+ 
- npm o yarn

## 🔧 Instalación

1. Clona o descarga el proyecto
2. Instala las dependencias:

```bash
npm install
```

3. Configura las variables de entorno. Plantilla completa en [`.env.example`](.env.example) (copiar a `.env` en local o pegar en **Render → Environment**).

```env
NODE_ENV=production
PERSEO_API_KEY=tu_api_key
API_KEY=tu_api_key
API_BASE_URL=https://accesoalnusan.app/api
ALMACEN_ID=2
CACHE_TTL_PRODUCTOS=14400
CACHE_TTL_EXISTENCIAS=120
DEFAULT_INCLUIR_IMAGENES=false
DEFAULT_MAX_IMAGENES=1
DEFAULT_TARIFAS_RESUMIDAS=true
MAX_CONCURRENT_EXISTENCIAS=15
EXISTENCIAS_BATCH_SIZE=30
PRODUCTOS_CONSULTA_TIMEOUT=60000
```

**Variables principales:**
- `PERSEO_API_KEY` / `API_KEY` - Credencial Perseo y auth de endpoints
- `CACHE_TTL_PRODUCTOS` - Caché catálogo en segundos (14400 = 4 h)
- `CACHE_TTL_EXISTENCIAS` - Caché de stock en segundos (120 = 2 min, evita saturar Perseo con peticiones N+1)
- `MAX_CONCURRENT_EXISTENCIAS` - Concurrencia de consultas de stock (recomendado 15-20)
- `DEFAULT_TARIFAS_RESUMIDAS` - `true` reduce peso del JSON (solo tarifa PUBLICO)
- `DEFAULT_INCLUIR_IMAGENES` - `false` recomendado si solo se necesita catálogo y stock rápido

## 🏃 Ejecución

### Modo Producción
```bash
npm start
```

### Modo Desarrollo (con auto-reload)
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3001`

## 📚 Documentación

Documentación interactiva con **[Scalar](https://scalar.com)** (misma guía que antes, ahora con “Try it” en el navegador):

- **Local:** `http://localhost:3001/docs` o `http://localhost:3001/` (redirige automáticamente)
- **Producción:** `https://alusan.onrender.com/docs` o `https://alusan.onrender.com/` (redirige automáticamente)
- **Especificación OpenAPI:** `docs/openapi.yaml` (fuente única de la documentación)

## 📡 Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/categorias` | Categorías completas |
| POST | `/api/categorias/list` | Categorías (id + nombre) |
| POST | `/api/subcategorias` | Subcategorías completas |
| POST | `/api/subcategorias/list` | Subcategorías (id + nombre) |
| POST | `/api/almacenes` | Almacenes disponibles |
| POST | `/api/productos` | Productos por categoría (imágenes + stock) |
| POST | `/api/cache/stats` | Estadísticas de caché |
| POST | `/api/cache/clear` | Limpiar caché |

Documentación interactiva (Scalar): `/docs`

### 🔐 Autenticación

**TODOS los endpoints requieren autenticación mediante API key en el body de la petición.**

**Ejemplo de body con API key:**
```json
{
  "api_key": "tu_api_key_aqui"
}
```

### POST `/api/productos`

Obtiene productos agrupados por código padre de una categoría específica.

**Body requerido:**
```json
{
  "api_key": "tu_api_key_aqui",
  "categoria_id": 126,
  "almacen_id": 2
}
```

O por nombre de categoría:
```json
{
  "api_key": "tu_api_key_aqui",
  "categoria_nombre": "VARIEDADES",
  "almacen_id": 2
}
```

**Parámetros:**
- `api_key` (requerido): API Key de autenticación
- `categoria_id` (opcional*): ID numérico de la categoría
- `categoria_nombre` (opcional*): Nombre de la categoría (case-insensitive)
- `almacen_id` (requerido): ID del almacén para consultar existencias

*Debe proporcionarse al menos uno: `categoria_id` o `categoria_nombre`

**Campos adicionales en cada variante:** además de `productos_categoriasid` y `productos_subcategoriasid`, la respuesta incluye `productos_categorias_nombre` y `productos_subcategorias_nombre` (resueltos desde Perseo con caché de 30 min). En la raíz del JSON también viene `categoria_consultada_nombre`.

### POST `/api/categorias`

Obtiene todas las categorías con información completa.

**Body requerido:**
```json
{
  "api_key": "tu_api_key_aqui"
}
```

### POST `/api/categorias/list`

Obtiene una lista simplificada de categorías (solo ID y nombre).

**Body requerido:**
```json
{
  "api_key": "tu_api_key_aqui"
}
```

### POST `/api/subcategorias/list`

Lista simplificada de subcategorías (solo `id` y `nombre`). Recomendado para UI y filtros. Caché 30 min.

**Body requerido:**
```json
{
  "api_key": "tu_api_key_aqui"
}
```

**Respuesta (200 OK):**
```json
{
  "success": true,
  "total": 180,
  "subcategorias": [
    { "id": 332, "nombre": "VARIOS" },
    { "id": 1, "nombre": "General" }
  ]
}
```

- `id` = `productos_subcategoriasid` en Perseo  
- `nombre` = `descripcion` en Perseo  

### POST `/api/subcategorias`

Obtiene todas las subcategorías con información completa desde Perseo (`productos_subcategorias_consulta`).

**Body requerido:**
```json
{
  "api_key": "tu_api_key_aqui"
}
```

**Respuesta (200 OK):**
```json
{
  "success": true,
  "total": 180,
  "data": [
    {
      "productos_subcategoriasid": 332,
      "descripcion": "VARIOS",
      "imagen": ""
    }
  ]
}
```

### POST `/api/almacenes`

Lista todos los almacenes disponibles en Perseo.

**Body requerido:**
```json
{
  "api_key": "tu_api_key_aqui"
}
```

### POST `/api/cache/stats`

Obtiene estadísticas del caché.

**Body requerido:**
```json
{
  "api_key": "tu_api_key_aqui"
}
```

### POST `/api/cache/clear`

Limpia todo el caché de categorías y productos.

**Body requerido:**
```json
{
  "api_key": "tu_api_key_aqui"
}
```

## 🚀 Despliegue

El proyecto está configurado para desplegarse en Render. Ver `render.yaml` para configuración.

## 📝 Notas

- Todos los endpoints son **POST** (no GET)
- Todos requieren `api_key` en el body
- Los productos se agrupan por **código padre**
- La búsqueda por nombre de categoría es **case-insensitive**
