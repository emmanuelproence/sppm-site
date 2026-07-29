// app/js/app.js

// 1. Importa os módulos essenciais
import { initAuth } from './auth.js';
import './ui.js'; 

// 2. Inicia o Motor de Segurança assim que a página carrega
document.addEventListener('DOMContentLoaded', () => {
    
    // Inicia a verificação de Login
    initAuth();

    // Remove qualquer tela de "Carregando" infinita, caso exista no seu HTML
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
});
