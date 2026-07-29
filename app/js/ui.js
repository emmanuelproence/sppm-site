// js/ui.js

// Exporta a função para ser usada em outros arquivos
export function navigateTo(targetId) {
    // 1. Oculta todas as seções e remove 'active' dos botões do menu
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active')); 
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active')); 
    
    // 2. Ativa a seção clicada
    const targetSection = document.getElementById(targetId);
    if(targetSection) targetSection.classList.add('active');
    
    // 3. Destaca o item do menu atual
    const navItem = document.querySelector(`[data-target='${targetId}']`);
    if(navItem) {
        navItem.classList.add('active');
        document.getElementById('topbar-title').innerText = navItem.innerText.trim();
    }
    
    // 4. Fecha a sidebar no mobile
    document.querySelector('.sidebar').classList.remove('open'); 
    
    // ==========================================
    // CORREÇÃO DEFINITIVA DO MAPA (Leaflet Bug)
    // ==========================================
    if(targetId === 'view-dashboard') {
        setTimeout(() => { 
            if(window.mapDash) window.mapDash.invalidateSize(); 
        }, 300);
    }
    if(targetId === 'view-mapa') {
        setTimeout(() => { 
            if(window.mapFull) window.mapFull.invalidateSize(); 
        }, 300);
    }
}

export function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            navigateTo(target);
        });
    });
}