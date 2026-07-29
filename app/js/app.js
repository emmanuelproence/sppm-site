import { initAuth } from './auth.js';
import './ui.js'; 

document.addEventListener('DOMContentLoaded', () => {
    initAuth();

    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
});
