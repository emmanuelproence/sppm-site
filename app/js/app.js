// app/js/app.js
import { initAuth } from './auth.js';
import './ui.js'; 
import { initLocalFallback, syncCloudToLocal } from './firebase.js';
import { syncAPI } from './telemetry.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Prepara o banco de dados local primeiro (Instantâneo)
    initLocalFallback();

    // 2. Inicia o Motor de Segurança (Isso já aciona a tela de Login)
    initAuth();

    // 3. Desliga a tela de "Sincronizando..." IMEDIATAMENTE (Não trava a tela)
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }

    // 4. Faz as buscas pesadas na nuvem e na API de forma invisível no fundo
    syncCloudToLocal().then(() => {
        syncAPI(); 
    }).catch(err => console.log("Carregando em modo offline."));
});
