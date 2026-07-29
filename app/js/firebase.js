// js/firebase.js

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

let database = null;
export let auth = null; // Exportação do Auth oficial do Firebase

try { 
    firebase.initializeApp(firebaseConfig); 
    database = firebase.database(); 
    auth = firebase.auth(); // Inicializa o motor de senhas criptografadas
} catch(e) { 
    console.warn("Conexão com Firebase falhou. Usando modo offline."); 
}

// ATUALIZADO PARA V10 PARA FORÇAR LIMPEZA DE CACHE
export const DB = { USRS: 'sppm_v10_users', STAS: 'sppm_v10_stations', LOGS: 'sppm_v10_logs', CONF: 'sppm_v10_config', OS: 'sppm_v10_os' };

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
    // ATUALIZADO COM O SEU E-MAIL PARA GARANTIR PERMISSÃO DE ADMIN
    if(!localStorage.getItem(DB.USRS)) localStorage.setItem(DB.USRS, JSON.stringify([{ id:1, email: 'emanu.spb@gmail.com', pass: '1234', role: 'Admin', name: 'Comando Central', allowedStations: 'all' }]));
    
    if(!localStorage.getItem(DB.STAS)) localStorage.setItem(DB.STAS, JSON.stringify(defaultStations));
    if(!localStorage.getItem(DB.LOGS)) localStorage.setItem(DB.LOGS, JSON.stringify([]));
    if(!localStorage.getItem(DB.CONF)) localStorage.setItem(DB.CONF, JSON.stringify({ syncInterval: 5 }));
    if(!localStorage.getItem(DB.OS)) localStorage.setItem(DB.OS, JSON.stringify([]));
}

// Função blindada para forçar array
export const getDB = (key) => {
    const data = JSON.parse(localStorage.getItem(key));
    if(!data) return [];
    return Array.isArray(data) ? data : Object.values(data);
};

export const setDB = (key, val) => {
    localStorage.setItem(key, JSON.stringify(val));
    if(database) {
        let cKey = "";
        if(key===DB.USRS) cKey="users"; if(key===DB.STAS) cKey="stations"; if(key===DB.LOGS) cKey="logs"; if(key===DB.CONF) cKey="config"; if(key===DB.OS) cKey="os";
        database.ref('sppm/' + cKey).set(val);
    }
};

export async function syncCloudToLocal() {
    if(!database) return initLocalFallback();
    try {
        const snap = await database.ref('sppm').once('value');
        const d = snap.val();
        if(d) {
            if(d.users) localStorage.setItem(DB.USRS, JSON.stringify(Array.isArray(d.users) ? d.users : Object.values(d.users)));
            if(d.stations) localStorage.setItem(DB.STAS, JSON.stringify(Array.isArray(d.stations) ? d.stations : Object.values(d.stations)));
            if(d.logs) localStorage.setItem(DB.LOGS, JSON.stringify(Array.isArray(d.logs) ? d.logs : Object.values(d.logs)));
            if(d.config) localStorage.setItem(DB.CONF, JSON.stringify(d.config));
            if(d.os) localStorage.setItem(DB.OS, JSON.stringify(Array.isArray(d.os) ? d.os : Object.values(d.os)));
        } else { initLocalFallback(); }
    } catch(e) { initLocalFallback(); }
}