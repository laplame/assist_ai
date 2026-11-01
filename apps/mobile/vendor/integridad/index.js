"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NODO_VACIO = exports.utf8 = exports.sha256Hex = void 0;
exports.canonicalJson = canonicalJson;
exports.hashPin = hashPin;
exports.hashDeCadena = hashDeCadena;
exports.hojaMerkle = hojaMerkle;
exports.hashNodo = hashNodo;
exports.armarArbol = armarArbol;
exports.verificarPrueba = verificarPrueba;
exports.inferirTipo = inferirTipo;
exports.esRebote = esRebote;
exports.distanciaMetros = distanciaMetros;
const sha256_1 = require("./sha256");
var sha256_2 = require("./sha256");
Object.defineProperty(exports, "sha256Hex", { enumerable: true, get: function () { return sha256_2.sha256Hex; } });
Object.defineProperty(exports, "utf8", { enumerable: true, get: function () { return sha256_2.utf8; } });
function canonicalJson(value) {
    return JSON.stringify(ordenar(value));
}
function ordenar(value) {
    if (Array.isArray(value))
        return value.map((item) => ordenar(item));
    if (value && typeof value === 'object') {
        const source = value;
        const out = {};
        for (const key of Object.keys(source).sort()) {
            if (source[key] !== undefined)
                out[key] = ordenar(source[key]);
        }
        return out;
    }
    return value;
}
function hashPin(salt, pin) {
    return (0, sha256_1.sha256Hex)((0, sha256_1.utf8)(`${salt}:${pin}`));
}
function hashDeCadena(hashPrevio, cuerpo) {
    return (0, sha256_1.sha256Hex)((0, sha256_1.utf8)(hashPrevio + canonicalJson(cuerpo)));
}
function hojaMerkle(hoja) {
    return (0, sha256_1.sha256Hex)((0, sha256_1.concatBytes)([new Uint8Array([0x00]), (0, sha256_1.utf8)(canonicalJson(hoja))]));
}
exports.NODO_VACIO = (0, sha256_1.sha256Hex)(new Uint8Array([0x02]));
function hashNodo(izquierda, derecha) {
    return (0, sha256_1.sha256Hex)((0, sha256_1.concatBytes)([new Uint8Array([0x01]), (0, sha256_1.fromHex)(izquierda), (0, sha256_1.fromHex)(derecha)]));
}
function armarArbol(hojas) {
    if (hojas.length === 0)
        throw new Error('Un lote necesita al menos una hoja');
    const pruebas = hojas.map(() => []);
    let nivel = hojas.map((hash, index) => ({ hash, hojas: [index] }));
    while (nivel.length > 1) {
        const siguiente = [];
        for (let i = 0; i < nivel.length; i += 2) {
            const izquierda = nivel[i];
            if (!izquierda)
                continue;
            const derecha = nivel[i + 1];
            const hashDerecha = derecha?.hash ?? exports.NODO_VACIO;
            for (const hoja of izquierda.hojas)
                pruebas[hoja]?.push({ lado: 'der', hash: hashDerecha });
            for (const hoja of derecha?.hojas ?? [])
                pruebas[hoja]?.push({ lado: 'izq', hash: izquierda.hash });
            siguiente.push({
                hash: hashNodo(izquierda.hash, hashDerecha),
                hojas: [...izquierda.hojas, ...(derecha?.hojas ?? [])],
            });
        }
        nivel = siguiente;
    }
    return { raiz: nivel[0]?.hash ?? '', pruebas };
}
function verificarPrueba(hoja, prueba, raiz) {
    let actual = hoja;
    for (const paso of prueba) {
        actual = paso.lado === 'der' ? hashNodo(actual, paso.hash) : hashNodo(paso.hash, actual);
    }
    return actual === raiz;
}
function inferirTipo(ultimo) {
    if (ultimo === 'entrada')
        return 'comida_inicio';
    if (ultimo === 'comida_inicio')
        return 'comida_fin';
    if (ultimo === 'comida_fin')
        return 'salida';
    return 'entrada';
}
function esRebote(ultimaMs, ahoraMs) {
    return ultimaMs !== null && ahoraMs - ultimaMs < 60_000;
}
function distanciaMetros(aLat, aLng, bLat, bLng) {
    const rad = Math.PI / 180;
    const dLat = (bLat - aLat) * rad;
    const dLng = (bLng - aLng) * rad;
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
