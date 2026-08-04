// app/js/firebase.js

const firebaseConfig = {
    apiKey: "AIzaSyBPwg63RIXP6xgasmQEPEemyBLS4eiPe48",
    authDomain: "sppm-6a369.firebaseapp.com",
    databaseURL: "https://sppm-6a369-default-rtdb.firebaseio.com",
    projectId: "sppm-6a369",
    storageBucket: "sppm-6a369.firebasestorage.app",
    messagingSenderId: "790068123319",
    appId: "1:790068123319:web:0607fba6b316a24cad5f32",
    measurementId: "G-9N8LY8N9G7"
};

// 1. INICIALIZAÇÃO SEGURA (Amarrada ao Window)
if (!window.firebase.apps.length) {
    window.firebase.initializeApp(firebaseConfig);
}

// 2. EXPORTAÇÕES LIGADAS DIRETAMENTE AO MOTOR
export const database = window.firebase.database();
export const auth = window.firebase.auth();

// 3. MUDANÇA PARA V12 PARA DESTRUIR O CACHE LOCAL ANTIGO
export const DB = { USRS: 'sppm_v12_users', STAS: 'sppm_v12_stations', LOGS: 'sppm_v12_logs', CONF: 'sppm_v12_config', OS: 'sppm_v12_os' };

const defaultStations = [
    { id: 1, name: 'Morrinhos 1 (Piloto)', region: 'Litoral Norte', lat: -3.2261, lon: -40.1222, quota: 15, mac: '', calib: 400, cam: '' },
    { id: 2, name: 'Santana do Acaraú 2', region: 'Sertão Sobral', lat: -3.4589, lon: -40.1167, quota: 12, mac: '', calib: 400, cam: '' },
    { id: 3, name: 'Caridade 1', region: 'Sertão Central', lat: -4.2188, lon: -39.2086, quota: 10, mac: '', calib: 400, cam: '' },
    { id: 4, name: 'Russas 1', region: 'Vale do Jaguaribe', lat: -4.9405, lon: -37.9755, quota: 15, mac: '', calib: 400, cam: '' },
    { id: 5, name: 'Russas 2', region: 'Vale do Jaguaribe', lat: -4.9500, lon: -37.9800, quota: 15, mac: '', calib: 400, cam: '' },
    { id: 6, name: 'Russas 3', region: 'Vale do Jaguaribe', lat: -4.9300, lon: -37.9600, quota: 15, mac: '', calib: 400, cam: '' },
    { id: 7, name: 'Russas 4', region: 'Vale do Jaguaribe', lat: -4.9600, lon: -37.9900, quota: 15, mac: '', calib: 400, cam: '' },
    { id: 8, name: 'Pentecoste 1', region: 'Litoral Norte', lat: -3.7913, lon: -39.2725, quota: 10, mac: '', calib: 400, cam: '' },
    { id: 9, name: 'Paraipaba 1', region: 'Litoral Norte', lat: -3.4388, lon: -39.1480, quota: 10, mac: '', calib: 400, cam: '' },
    { id: 10, name: 'S. Gonçalo do Amarante 1', region: 'Litoral Norte', lat: -3.6063, lon: -38.9705, quota: 12, mac: '', calib: 400, cam: '' }
];

export function initLocalFallback() {
    if(!localStorage.getItem(DB.USRS)) localStorage.setItem(DB.USRS, JSON.stringify([{ id:1, email: 'emanu.spb@gmail.com', pass: '1234', role: 'Admin', name: 'Comando Central', allowedStations: 'all' }]));

    if(!localStorage.getItem(DB.STAS)) localStorage.setItem(DB.STAS, JSON.stringify(defaultStations));
    if(!localStorage.getItem(DB.LOGS)) localStorage.setItem(DB.LOGS, JSON.stringify([]));
    if(!localStorage.getItem(DB.CONF)) localStorage.setItem(DB.CONF, JSON.stringify({ syncInterval: 5 }));
    if(!localStorage.getItem(DB.OS)) localStorage.setItem(DB.OS, JSON.stringify([]));
}

export const getDB = (key) => {
    const data = JSON.parse(localStorage.getItem(key));
    if(!data) return [];
    return Array.isArray(data) ? data : Object.values(data);
};

/**
 * Salva local (instantâneo) E na nuvem.
 * Agora retorna uma Promise real: se a escrita no Firebase falhar
 * (permissão negada, offline, etc.) o chamador FICA SABENDO — antes
 * o erro era engolido e o app mentia dizendo "sucesso".
 */
export const setDB = (key, val) => {
    localStorage.setItem(key, JSON.stringify(val));

    if (!database) return Promise.resolve();

    let cKey = "";
    if (key === DB.USRS) cKey = "users";
    else if (key === DB.STAS) cKey = "stations";
    else if (key === DB.LOGS) cKey = "logs";
    else if (key === DB.CONF) cKey = "config";
    else if (key === DB.OS) cKey = "os";

    if (!cKey) return Promise.resolve();

    return database.ref('sppm/' + cKey).set(val).catch(err => {
        console.error(`Falha ao salvar "${cKey}" na nuvem:`, err);
        // Re-lança para quem chamou (ui.js) poder avisar o usuário de verdade.
        throw err;
    });
};

/**
 * ANTES: usava .once('value') uma única vez, no boot do app.
 * Isso criava uma race condition: se o usuário salvasse uma estação/usuário
 * ENQUANTO esse fetch inicial ainda estava em voo, quando o fetch resolvia
 * (com dados antigos) ele SOBRESCREVIA o localStorage e apagava o que acabou
 * de ser salvo — por isso "aparecia no mapa" (render imediato, local) mas
 * "sumia" da gestão (assim que a sincronização da nuvem rodava de novo).
 *
 * AGORA: usa um listener em tempo real (.on('value', ...)). Isso elimina a
 * race condition (a própria escrita que você faz já dispara a atualização
 * do listener com o dado novo) e, de brinde, sincroniza em tempo real entre
 * dispositivos/abas diferentes. A Promise resolve no primeiro snapshot,
 * então quem chama `await syncCloudToLocal()` continua funcionando igual.
 */
export function syncCloudToLocal() {
    return new Promise((resolve) => {
        if (!database) {
            initLocalFallback();
            resolve();
            return;
        }

        let firstLoad = true;

        database.ref('sppm').on('value', (snap) => {
            const d = snap.val();
            if (d) {
                if (d.users) localStorage.setItem(DB.USRS, JSON.stringify(Array.isArray(d.users) ? d.users : Object.values(d.users)));
                if (d.stations) localStorage.setItem(DB.STAS, JSON.stringify(Array.isArray(d.stations) ? d.stations : Object.values(d.stations)));
                if (d.logs) localStorage.setItem(DB.LOGS, JSON.stringify(Array.isArray(d.logs) ? d.logs : Object.values(d.logs)));
                if (d.config) localStorage.setItem(DB.CONF, JSON.stringify(d.config));
                if (d.os) localStorage.setItem(DB.OS, JSON.stringify(Array.isArray(d.os) ? d.os : Object.values(d.os)));
            } else if (firstLoad) {
                initLocalFallback();
            }

            // Avisa o resto do app (mapa, tabelas de gestão, etc.) que há dados novos.
            window.dispatchEvent(new Event('cloudDataUpdated'));

            if (firstLoad) {
                firstLoad = false;
                resolve();
            }
        }, (err) => {
            console.warn("Nuvem inacessível, usando cache local.", err);
            if (firstLoad) {
                firstLoad = false;
                initLocalFallback();
                resolve();
            }
        });
    });
}
