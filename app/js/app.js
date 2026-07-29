// app/js/app.js

import { initAuth } from './auth.js';
import './ui.js'; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicia o Motor de Segurança
    initAuth();

    // 2. Desliga a tela de "Sincronizando com a Nuvem..."
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
});
