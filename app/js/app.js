// js/app.js
import { setupNavigation } from './ui.js';
import { checkSession, setupAuthListeners } from './auth.js';
import { syncAPI } from './telemetry.js';
import './ui.js';

// Transforma o mapa em variável global para o Leaflet não perder a referência
window.mapDash = null;
window.mapFull = null;

function initMaps() {
    window.mapDash = L.map('map-container', { zoomControl: false, attributionControl: false }).setView([-5.3, -39.3], 6.5); 
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}').addTo(window.mapDash);
    
    window.mapFull = L.map('map-full').setView([-5.3, -39.3], 7); 
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}').addTo(window.mapFull);

    setTimeout(() => {
        if(window.mapDash) window.mapDash.invalidateSize();
        if(window.mapFull) window.mapFull.invalidateSize();
    }, 300);
}

// Essa função só é chamada DEPOIS que o login dá certo
function startDashboard() {
    initMaps();
    syncAPI();
    // Opcional: setInterval(syncAPI, 5 * 60000);
}

// Inicializa a aplicação assim que o DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    console.log("Iniciando SPPM V9 - Arquitetura Modular Segura");
    
    // Prepara o botão de login para ser clicado
    setupAuthListeners(startDashboard); 
    
    // Verifica se já tem alguém logado (e remove a tela de loading)
    checkSession(startDashboard, setupNavigation); 
});
