// app/js/ui.js
import { DB, getDB, setDB } from './firebase.js';

// Função exposta para o auth.js chamar quando o login der certo
window.setupUI = function() {
    injectMobileResponsiveness();
    setupNavigation();
};

function injectMobileResponsiveness() {
    // INJETA O CSS DO CELULAR DIRETO NA MEMÓRIA (Protege seu HTML original)
    if(!document.getElementById('sppm-mobile-css')) {
        const style = document.createElement('style');
        style.id = 'sppm-mobile-css';
        style.innerHTML = `
            @media (max-width: 768px) {
                /* Esconde o menu lateral */
                .sidebar { position: fixed; left: -100%; top: 0; height: 100vh; z-index: 9999; transition: left 0.3s ease; box-shadow: 5px 0 15px rgba(0,0,0,0.8); width: 260px; }
                .sidebar.open { left: 0; }
                
                /* Expande a área central */
                .main-content { margin-left: 0 !important; width: 100%; }
                
                /* Empilha os Cards e Mapas pra caber no celular */
                .grid-layout { display: flex !important; flex-direction: column; gap: 15px; }
                .card { width: 100% !important; margin: 0; }
                #map, .leaflet-container { height: 350px !important; }
                
                /* Mostra o botão Hambúrguer apenas no celular */
                .btn-mobile-menu { display: inline-block !important; background: none; border: none; color: #10b981; font-size: 1.8rem; cursor: pointer; margin-right: 15px; }
            }
            @media (min-width: 769px) {
                .btn-mobile-menu { display: none !important; }
            }
        `;
        document.head.appendChild(style);
    }

    // ADICIONA O BOTÃO DE MENU LATERAL (HAMBÚRGUER) NO TOPO
    const topbar = document.querySelector('.topbar') || document.querySelector('header');
    if(topbar && !document.getElementById('menu-toggle')) {
        const btn = document.createElement('button');
        btn.id = 'menu-toggle';
        btn.className = 'btn-mobile-menu';
        btn.innerHTML = '☰';
        topbar.prepend(btn); // Coloca o botão no começo da barra superior

        btn.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            if(sidebar) sidebar.classList.toggle('open');
        });
    }
}

export function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetID = item.getAttribute('data-target');
            if(!targetID) return;
            
            // Marca a aba atual de verde
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Troca a tela central
            sections.forEach(sec => {
                sec.style.display = 'none'; // Esconde todas
                if(sec.id === targetID) {
                    sec.style.display = 'block'; // Mostra a certa
                }
            });

            // Recolhe a barra lateral no celular automaticamente após clicar
            const sidebar = document.querySelector('.sidebar');
            if(window.innerWidth <= 768 && sidebar) {
                sidebar.classList.remove('open');
            }
            
            // Corrige o bug do Leaflet carregar cinza/cortado
            if(window.mapInstance) {
                setTimeout(() => window.mapInstance.invalidateSize(), 300);
            }
        });
    });
}
