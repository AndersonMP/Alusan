import http from 'http';
import https from 'https';
import axios from 'axios';

// Agentes con keep-alive para reutilizar sockets TCP y TLS
// Evita el handshake SSL en cada una de las peticiones a Perseo
export const httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 60,
    maxFreeSockets: 20,
    timeout: 30000
});

export const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 60,
    maxFreeSockets: 20,
    timeout: 30000
});

// Instancia axios reutilizable con agentes persistentes
export const axiosClient = axios.create({
    httpAgent,
    httpsAgent,
    validateStatus: (status) => status < 500
});
