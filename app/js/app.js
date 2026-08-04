// app/js/app.js
import { initAuth } from './auth.js';
import './ui.js'; 
import { initDashboard } from './dashboard.js';
import { initLocalFallback, syncCloudToLocal } from './firebase.js';
import { syncAPI } from './telemetry.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Prepara o banco local/nuvem
    initLocalFallback();
    await syncCloudToLocal();

    // 2. Inicia o Motor de Segurança
    initAuth();

    // 3. Inicia os Gráficos e o Mapa
    initDashboard();

    // 4. Executa a primeira leitura da API climática
    await syncAPI();

    // 5. Desliga a tela de "Sincronizando com a Nuvem..."
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
});
