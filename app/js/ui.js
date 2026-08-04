// app/js/ui.js
import { DB, getDB, setDB } from './firebase.js';

window.setupUI = function() {
    injectMobileResponsiveness();
    setupNavigation();
    setupModals(); 
};

function setupModals() {
    const globalModal = document.getElementById('global-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    const btnNewStation = document.getElementById('btn-new-station');
    if(btnNewStation) {
        btnNewStation.addEventListener('click', () => {
            modalTitle.innerText = "Cadastrar Nova Estação";
            const tpl = document.getElementById('tpl-station-form').content.cloneNode(true);
            modalBody.innerHTML = '';
            modalBody.appendChild(tpl);
            globalModal.classList.add('active');
        });
    }

    const btnNewUser = document.getElementById('btn-new-user');
    if(btnNewUser) {
        btnNewUser.addEventListener('click', () => {
            modalTitle.innerText = "Provisionar Novo Acesso (RBAC)";
            const tpl = document.getElementById('tpl-user-form').content.cloneNode(true);
            modalBody.innerHTML = '';
            modalBody.appendChild(tpl);
            globalModal.classList.add('active');
            
            const roleSelect = document.getElementById('usr-role');
            if(roleSelect) {
                roleSelect.addEventListener('change', (e) => {
                    document.getElementById('container-station-select').style.display = e.target.value === 'Admin' ? 'none' : 'block';
                });
            }
        });
    }

    const btnNewOS = document.getElementById('btn-new-os');
    if(btnNewOS) {
        btnNewOS.addEventListener('click', () => {
            modalTitle.innerText = "Abrir Ordem de Serviço";
            const tpl = document.getElementById('tpl-os-form').content.cloneNode(true);
            modalBody.innerHTML = '';
            modalBody.appendChild(tpl);
            globalModal.classList.add('active');
        });
    }
}

function injectMobileResponsiveness() {
    if(!document.getElementById('sppm-mobile-css')) {
        const style = document.createElement('style');
        style.id = 'sppm-mobile-css';
        style.innerHTML = `
            @media (max-width: 768px) {
                .sidebar { position: fixed; left: -100%; top: 0; height: 100vh; z-index: 9999; transition: left 0.3s ease; box-shadow: 5px 0 15px rgba(0,0,0,0.8); width: 260px; }
                .sidebar.open { left: 0; }
                .main-content { margin-left: 0 !important; width: 100%; }
                .grid-layout { display: flex !important; flex-direction: column; gap: 15px; }
                .card { width: 100% !important; margin: 0; }
                #map, .leaflet-container { height: 350px !important; }
                .btn-mobile-menu { display: inline-block !important; background: none; border: none; color: #10b981; font-size: 1.8rem; cursor: pointer; margin-right: 15px; }
            }
            @media (min-width: 769px) { .btn-mobile-menu { display: none !important; } }
        `;
        document.head.appendChild(style);
    }

    const topbar = document.querySelector('.topbar') || document.querySelector('header');
    if(topbar && !document.getElementById('menu-toggle')) {
        const btn = document.createElement('button');
        btn.id = 'menu-toggle';
        btn.className = 'btn-mobile-menu';
        btn.innerHTML = '☰';
        topbar.prepend(btn);

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
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(sec => {
                sec.style.display = 'none';
                if(sec.id === targetID) sec.style.display = 'block';
            });

            const sidebar = document.querySelector('.sidebar');
            if(window.innerWidth <= 768 && sidebar) {
                sidebar.classList.remove('open');
            }
            
            if(window.mapInstance) {
                setTimeout(() => window.mapInstance.invalidateSize(), 300);
            }
        });
    });
}
