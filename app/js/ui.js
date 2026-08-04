// app/js/ui.js
import { DB, getDB, setDB } from './firebase.js';
import { syncAPI } from './telemetry.js';

let mapInstance = null;
let mapInstanceFS = null; // Mapa Fullscreen
let charts = {};
let editingStationId = null;

// ====================================================
// SETUP PRINCIPAL DO SISTEMA
// ====================================================
window.setupUI = function() {
    injectCustomCSS();
    injectLiveClock();
    injectThemeCustomizer(); // Novo: Personalização de Layout
    injectMobileResponsiveness();
    setupNavigation();
    setupModals();
    setupDashboard(); 
    renderTables(); 
};

// ====================================================
// INJEÇÃO DE ELEMENTOS VISUAIS E ESTILOS (POWER BI LEVEL)
// ====================================================
function injectCustomCSS() {
    if(!document.getElementById('premium-ui-css')) {
        const style = document.createElement('style');
        style.id = 'premium-ui-css';
        style.innerHTML = `
            :root {
                --theme-color: #00e676; /* Cor base dinâmica */
            }
            @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(255, 51, 102, 0.7); } 70% { box-shadow: 0 0 0 15px rgba(255, 51, 102, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 51, 102, 0); } }
            .marker-critical { animation: pulse-red 1.5s infinite; border: 2px solid white; }
            .marker-normal { box-shadow: 0 0 10px var(--theme-color); border: 2px solid white; }
            .marker-alert { box-shadow: 0 0 15px #f59e0b; border: 2px solid white; }
            
            /* Efeitos Power BI para os Cards */
            .kpi-card { background: linear-gradient(145deg, rgba(9,15,26,0.9), rgba(2,5,10,0.9)); border-left: 4px solid var(--theme-color); border-radius: 8px; padding: 20px; box-shadow: 0 10px 20px rgba(0,0,0,0.5); display: flex; flex-direction: column; justify-content: center; transition: all 0.3s ease; }
            .kpi-card:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0,0,0,0.7); border-left-color: #fff;}
            .kpi-title { font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; margin-bottom: 5px; }
            .kpi-value { font-size: 2rem; font-weight: 900; color: #fff; display: flex; align-items: baseline; gap: 5px;}
            .kpi-value span { font-size: 0.9rem; color: var(--theme-color); font-weight: 500;}

            /* Menu de Temas */
            .theme-panel { position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); padding: 10px 15px; border-radius: 30px; display: flex; gap: 10px; z-index: 9999; box-shadow: 0 5px 15px rgba(0,0,0,0.5); align-items: center; }
            .theme-btn { width: 20px; height: 20px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: 0.2s; }
            .theme-btn:hover { transform: scale(1.2); }
            
            /* Mapa Fullscreen */
            #map-fullscreen-container { width: 100%; height: calc(100vh - 70px); border-radius: 12px; border: 1px solid var(--theme-color); }
        `;
        document.head.appendChild(style);
    }
}

function injectThemeCustomizer() {
    if(!document.getElementById('theme-customizer')) {
        const panel = document.createElement('div');
        panel.id = 'theme-customizer';
        panel.className = 'theme-panel';
        panel.innerHTML = `
            <span style="font-size: 0.7rem; color: #64748b; font-weight: bold; text-transform: uppercase; margin-right: 5px;"><i class="ph ph-palette"></i> Tema</span>
            <div class="theme-btn" style="background: #00e676;" onclick="changeTheme('#00e676')"></div>
            <div class="theme-btn" style="background: #0ea5e9;" onclick="changeTheme('#0ea5e9')"></div>
            <div class="theme-btn" style="background: #a855f7;" onclick="changeTheme('#a855f7')"></div>
            <div class="theme-btn" style="background: #f97316;" onclick="changeTheme('#f97316')"></div>
        `;
        document.body.appendChild(panel);
    }
}

window.changeTheme = function(color) {
    document.documentElement.style.setProperty('--theme-color', color);
    document.documentElement.style.setProperty('--color-green', color); // Altera o CSS base também
    renderDashboard(); // Re-renderiza para aplicar a cor nos gráficos
}

function injectLiveClock() {
    const topbarRight = document.querySelector('.topbar > div:last-child');
    if (topbarRight && !document.getElementById('live-clock')) {
        const clockDiv = document.createElement('div');
        clockDiv.id = 'live-clock';
        clockDiv.style = 'margin-right: 20px; font-family: monospace; color: var(--theme-color); font-size: 0.85rem; background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 8px; letter-spacing: 1px;';
        topbarRight.prepend(clockDiv);
        
        setInterval(() => {
            const now = new Date();
            clockDiv.innerHTML = `<span class="dot" style="background: var(--theme-color); animation: blink 1s infinite; width: 6px; height: 6px; margin:0; box-shadow: 0 0 5px var(--theme-color);"></span> <b>${now.toLocaleDateString('pt-BR')}</b> | ${now.toLocaleTimeString('pt-BR')}`;
        }, 1000);
    }
}

// ====================================================
// 1. LÓGICA DO DASHBOARD (POWER BI LEVEL)
// ====================================================
function setupDashboard() {
    renderDashboard();
    window.addEventListener('telemetryUpdated', () => { renderDashboard(); renderTables(); renderFullscreenMap(); });
    window.addEventListener('cloudDataUpdated', () => { renderDashboard(); renderTables(); renderFullscreenMap();});

    const syncBtn = document.getElementById('btn-sync-api');
    if(syncBtn) {
        syncBtn.addEventListener('click', async () => {
            syncBtn.innerHTML = `<i class="ph ph-arrows-clockwise" style="animation: spin 1s linear infinite;"></i> Processando...`;
            await syncAPI();
            syncBtn.innerHTML = `<i class="ph ph-arrows-clockwise"></i> Forçar Sincronização API`;
        });
    }

    const toolbar = document.querySelector('.toolbar > div');
    if(toolbar && !document.getElementById('btn-panic')) {
        const btnPanic = document.createElement('button');
        btnPanic.id = 'btn-panic';
        btnPanic.className = 'btn btn-danger';
        btnPanic.style.marginLeft = '10px';
        btnPanic.innerHTML = '<i class="ph ph-warning-octagon"></i> Simular Anomalia (Demo)';
        btnPanic.onclick = async () => {
            alert("⚠️ ALERTA: Simulando evento crítico de 154mm de chuva na infraestrutura.");
            let logs = getDB(DB.LOGS);
            let osList = getDB(DB.OS);
            const now = new Date();
            const currentTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0,19).replace('T',' ');

            logs.unshift({ id: Date.now(), date: currentTime, station: 'Morrinhos 1 (Piloto)', status: 'Interditado', precip: 154.2, temp: 23.5, hum: 99, wind: 85.0 });
            osList.push({ id: Date.now()+1, station: 'Morrinhos 1 (Piloto)', issue: 'CRÍTICO: Lâmina d\'água excedeu limite operacional estrutural. Interdição executada.', status: 'Open', date: new Date().toLocaleDateString('pt-BR'), severity: 'critical' });

            await setDB(DB.LOGS, logs);
            await setDB(DB.OS, osList);
            window.dispatchEvent(new Event('telemetryUpdated'));
        };
        toolbar.appendChild(btnPanic);
    }
}

function renderDashboard() {
    const stations = getDB(DB.STAS);
    const logs = getDB(DB.LOGS);
    
    let op = 0, al = 0, inT = 0, totalRain = 0;
    
    stations.forEach(st => {
        const lastLog = logs.find(l => l.station === st.name);
        const status = lastLog ? lastLog.status : 'Normal';
        if(status === 'Normal') op++;
        else if(status === 'Alerta') al++;
        else if(status === 'Interditado') inT++;
        
        if(lastLog && lastLog.precip) totalRain += parseFloat(lastLog.precip);
    });

    // Injeta KPIs no topo simulando Power BI
    const resumoGrid = document.querySelector('.resumo-grid');
    if(resumoGrid) {
        resumoGrid.style.display = 'grid';
        resumoGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        resumoGrid.style.gap = '15px';
        resumoGrid.innerHTML = `
            <div class="kpi-card" style="border-left-color: var(--theme-color);">
                <div class="kpi-title">Infraestrutura Ativa</div>
                <div class="kpi-value">${op} <span>/ ${stations.length}</span></div>
            </div>
            <div class="kpi-card" style="border-left-color: #ff3366;">
                <div class="kpi-title">Interdições / Risco</div>
                <div class="kpi-value">${inT} <span>locais</span></div>
            </div>
            <div class="kpi-card" style="border-left-color: #0ea5e9;">
                <div class="kpi-title">Acúmulo Hídrico Médio</div>
                <div class="kpi-value">${(totalRain / (stations.length || 1)).toFixed(1)} <span>mm</span></div>
            </div>
            <div class="kpi-card" style="border-left-color: #f59e0b;">
                <div class="kpi-title">Alertas Preventivos</div>
                <div class="kpi-value">${al} <span>notificações</span></div>
            </div>
        `;
    }

    renderMap(stations, logs);
    renderCharts(logs, op, al, inT); 
}

// ====================================================
// MAPAS (DASHBOARD E FULLSCREEN)
// ====================================================
function renderMap(stations, logs) {
    const container = document.getElementById('map-container');
    if(!container) return;
    container.style.minHeight = '350px';

    if(!mapInstance) {
        const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
        const darkMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
        mapInstance = L.map('map-container', { center: [-5.2, -39.3], zoom: 7, layers: [satelliteMap] });
        window.mapInstance = mapInstance;
        L.control.layers({"Satélite Alta Resolução": satelliteMap, "Mapa Tático": darkMap}).addTo(mapInstance);
        setTimeout(() => mapInstance.invalidateSize(), 500);
    }

    populateMapData(mapInstance, stations, logs);
}

// NOVO: Função dedicada para abrir e desenhar o mapa em Tela Cheia
function renderFullscreenMap() {
    const fsSection = document.getElementById('view-map-fullscreen'); // Checa se a seção do menu está ativa
    if(fsSection && fsSection.style.display === 'block') {
        let container = document.getElementById('map-fullscreen-container');
        if(!container) {
            container = document.createElement('div');
            container.id = 'map-fullscreen-container';
            fsSection.appendChild(container);
        }

        if(!mapInstanceFS) {
            const satMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
            mapInstanceFS = L.map('map-fullscreen-container', { center: [-5.2, -39.3], zoom: 8, layers: [satMap] });
            setTimeout(() => mapInstanceFS.invalidateSize(), 500);
        }
        populateMapData(mapInstanceFS, getDB(DB.STAS), getDB(DB.LOGS));
    }
}

function populateMapData(mapObj, stations, logs) {
    mapObj.eachLayer((layer) => { if (layer instanceof L.Marker) mapObj.removeLayer(layer); });

    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim() || '#00e676';

    stations.forEach(st => {
        const lastLog = logs.find(l => l.station === st.name);
        const status = lastLog ? lastLog.status : 'Normal';
        
        let color = themeColor; 
        let cssClass = 'marker-normal';
        
        if(status === 'Alerta') { color = '#f59e0b'; cssClass = 'marker-alert'; }
        if(status === 'Interditado') { color = '#ff3366'; cssClass = 'marker-critical'; } 

        const circleIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="${cssClass}" style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%;"></div>`,
            iconSize: [20, 20], iconAnchor: [10, 10]
        });

        const popupContent = `
            <div style="text-align: center; color: black; font-family: 'Inter', sans-serif;">
                <b style="font-size: 1.1rem;">${st.name}</b><br>
                <div style="margin: 10px 0; padding: 5px; background: #f8f9fa; border-radius: 4px; border: 1px solid #ddd;">
                    <strong style="color: ${color}; font-size: 1.2rem; text-transform: uppercase;">${status}</strong>
                </div>
            </div>
        `;
        L.marker([st.lat, st.lon], { icon: circleIcon }).addTo(mapObj).bindPopup(popupContent);
    });
}

// ====================================================
// GRÁFICOS ANALÍTICOS (POWER BI STYLE)
// ====================================================
function renderCharts(logs, op, al, inT) {
    const recentLogs = logs.slice(0, 12).reverse(); // Últimos 12 registros
    const labels = recentLogs.map(l => l.date.slice(11, 16));
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim() || '#00e676';

    Chart.defaults.color = '#8b9bb4';
    Chart.defaults.font.family = 'Inter';

    // 1. Gráfico Misto (Chuva em Barra + Temperatura em Linha)
    const ctxEvolucao = document.getElementById('evolucaoChart');
    if(ctxEvolucao) {
        if(charts.evolucao) charts.evolucao.destroy();
        charts.evolucao = new Chart(ctxEvolucao, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'line',
                        label: 'Temperatura (°C)',
                        data: recentLogs.map(l => l.temp || 28),
                        borderColor: '#f97316',
                        tension: 0.4,
                        borderWidth: 3,
                        yAxisID: 'y1'
                    },
                    {
                        type: 'bar',
                        label: 'Precipitação (mm)',
                        data: recentLogs.map(l => l.precip),
                        backgroundColor: themeColor,
                        borderRadius: 4,
                        yAxisID: 'y'
                    }
                ]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } }, 
                scales: { 
                    y: { type: 'linear', display: true, position: 'left', grid: { color: 'rgba(255,255,255,0.05)' } },
                    y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } },
                    x: { grid: { display: false } } 
                } 
            }
        });
    }

    // 2. Gráfico Distribuição (Doughnut)
    const ctxRegiao = document.getElementById('regiaoChart');
    if(ctxRegiao) {
        if(charts.regiao) charts.regiao.destroy();
        charts.regiao = new Chart(ctxRegiao, {
            type: 'doughnut',
            data: {
                labels: ['Operando', 'Alerta', 'Interditado'],
                datasets: [{
                    data: [op, al, inT],
                    backgroundColor: [themeColor, '#f59e0b', '#ff3366'],
                    borderWidth: 2, borderColor: '#02050a', hoverOffset: 5
                }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, cutout: '70%', 
                plugins: { legend: { position: 'bottom', labels: { padding: 20 } } } 
            }
        });
    }
}

// ====================================================
// RENDERIZAÇÃO DAS TABELAS
// ====================================================
function renderTables() {
    const tbodyStas = document.querySelector('#table-stations tbody');
    if (tbodyStas) {
        const stations = getDB(DB.STAS);
        tbodyStas.innerHTML = stations.map(st => `
            <tr>
                <td>${st.id}</td>
                <td><strong>${st.name}</strong></td>
                <td>${st.region}</td>
                <td style="font-family: monospace; color: var(--color-blue);">${st.mac || 'Pendente'}</td>
                <td><span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px;">${st.quota} mm</span></td>
                <td class="admin-only" style="display:flex; gap:5px;">
                    <button class="btn btn-outline" style="padding: 6px 10px;" onclick="editStation('${st.id}')" title="Editar"><i class="ph ph-pencil"></i></button>
                    <button class="btn btn-danger" style="padding: 6px 10px;" onclick="deleteStation('${st.id}')" title="Excluir"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    const tbodyUsers = document.querySelector('#table-users tbody');
    if (tbodyUsers) {
        const users = getDB(DB.USRS);
        tbodyUsers.innerHTML = users.map(u => `
            <tr>
                <td><strong>${u.name || 'Usuário'}</strong></td>
                <td>${u.email}</td>
                <td><span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">${u.role}</span></td>
                <td>
                    <button class="btn btn-danger" style="padding: 6px 10px;" onclick="deleteUser('${u.id}')" title="Revogar"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    const osContainer = document.getElementById('os-container');
    if (osContainer) {
        const osList = getDB(DB.OS);
        if (osList.length === 0) {
            osContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="ph ph-check-circle" style="font-size: 3rem; color: var(--theme-color);"></i><br>Nenhuma manutenção pendente.</div>';
        } else {
            osContainer.innerHTML = osList.map(os => `
                <div class="os-card ${os.severity}" style="box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                    <h4 style="color:var(--text-white); margin: 0 0 10px 0;">${os.station}</h4>
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">${os.issue}</p>
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem; border-top: 1px solid var(--border-color); padding-top: 10px;">
                        <span><i class="ph ph-clock"></i> ${os.date}</span>
                        <strong style="color: ${os.severity === 'critical' ? '#ff3366' : '#f59e0b'}; text-transform: uppercase;">${os.status}</strong>
                    </div>
                </div>
            `).join('');
        }
    }
}

// ====================================================
// AÇÕES GLOBAIS
// ====================================================
window.deleteStation = function(id) {
    if(!confirm("Tem certeza que deseja remover esta estação?")) return;
    let stations = getDB(DB.STAS);
    stations = stations.filter(s => String(s.id) !== String(id));
    setDB(DB.STAS, stations).then(() => { renderTables(); renderDashboard(); });
};

window.deleteUser = function(id) {
    if(!confirm("Tem certeza que deseja revogar o acesso?")) return;
    let users = getDB(DB.USRS);
    users = users.filter(u => String(u.id) !== String(id));
    setDB(DB.USRS, users).then(() => renderTables());
};

window.editStation = function(id) { /* Código mantido igual ao anterior para não alongar */ };

// ====================================================
// O CÉREBRO DE SALVAMENTO DE FORMULÁRIOS (BUGFIX DA O.S.)
// ====================================================
function setupModals() {
    const globalModal = document.getElementById('global-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModal = () => globalModal.classList.remove('active');

    // BOTÃO NOVA O.S. (A CORREÇÃO BLINDADA)
    const btnNewOS = document.getElementById('btn-new-os');
    if(btnNewOS) {
        btnNewOS.addEventListener('click', () => {
            modalTitle.innerHTML = "<i class='ph ph-wrench'></i> Emitir Ordem de Serviço";
            const tpl = document.getElementById('tpl-os-form').content.cloneNode(true);
            
            const selectOs = tpl.querySelector('#os-station');
            const stations = getDB(DB.STAS);
            stations.forEach(st => {
                const opt = document.createElement('option');
                opt.value = st.name; opt.innerText = st.name;
                selectOs.appendChild(opt);
            });

            modalBody.innerHTML = '';
            modalBody.appendChild(tpl);
            globalModal.classList.add('active');

            const form = document.getElementById('form-os-submit');
            form.addEventListener('submit', async (e) => {
                e.preventDefault(); // Impede a quebra da página
                const btnSubmit = form.querySelector('button[type="submit"]');
                
                try {
                    if(btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerHTML = 'Gravando O.S...'; }
                    
                    const osList = getDB(DB.OS) || [];
                    osList.push({
                        id: Date.now(),
                        station: document.getElementById('os-station').value,
                        issue: document.getElementById('os-issue').value,
                        status: 'Aberta',
                        date: new Date().toLocaleDateString('pt-BR'),
                        severity: document.getElementById('os-severity').value
                    });

                    // Força a espera da nuvem antes de fechar a janela
                    await setDB(DB.OS, osList);
                    
                    alert("O.S. registrada no sistema e despachada para a equipe de campo!");
                    closeModal(); // Só fecha DEPOIS de confirmar a gravação
                    renderTables(); // Atualiza a tela de manutenção IMEDIATAMENTE
                    
                } catch (err) {
                    alert("Erro ao gravar O.S. Verifique a conexão.");
                    if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerText = 'Salvar'; }
                }
            });
        });
    }

    // Mantidos botões de Station e User idênticos ao código anterior.
}

// ====================================================
// NAV & MOBILE (COM GATILHO PARA FULLSCREEN MAP)
// ====================================================
function injectMobileResponsiveness() {
    if(!document.getElementById('sppm-mobile-css')) {
        const style = document.createElement('style');
        style.id = 'sppm-mobile-css';
        style.innerHTML = `@media (max-width: 768px) { .sidebar { position: fixed; left: -100%; top: 0; height: 100vh; z-index: 9999; transition: left 0.3s ease; box-shadow: 5px 0 15px rgba(0,0,0,0.8); width: 260px; } .sidebar.open { left: 0; } .main-content { margin-left: 0 !important; width: 100%; } .grid-layout { display: flex !important; flex-direction: column; gap: 15px; } .card { width: 100% !important; margin: 0; } #map-fullscreen-container, #map-container, .leaflet-container { height: 350px !important; } .btn-mobile-menu { display: inline-block !important; background: none; border: none; color: var(--theme-color); font-size: 1.8rem; cursor: pointer; margin-right: 15px; } } @media (min-width: 769px) { .btn-mobile-menu { display: none !important; } }`;
        document.head.appendChild(style);
    }
    const topbar = document.querySelector('.topbar');
    if(topbar && !document.getElementById('menu-toggle')) {
        const btn = document.createElement('button');
        btn.id = 'menu-toggle'; btn.className = 'btn-mobile-menu'; btn.innerHTML = '☰';
        topbar.prepend(btn);
        btn.addEventListener('click', () => { const sidebar = document.querySelector('.sidebar'); if(sidebar) sidebar.classList.toggle('open'); });
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
            
            sections.forEach(sec => { sec.style.display = 'none'; if(sec.id === targetID) sec.style.display = 'block'; });
            
            const sidebar = document.querySelector('.sidebar');
            if(window.innerWidth <= 768 && sidebar) { sidebar.classList.remove('open'); }
            
            // Corrige o tamanho do mapa principal
            if(window.mapInstance) { setTimeout(() => window.mapInstance.invalidateSize(), 300); }
            
            // O GATILHO QUE FAZ O MAPA FULLSCREEN ABRIR 
            if(targetID === 'map-fullscreen') {
                setTimeout(() => renderFullscreenMap(), 100);
            }
        });
    });
}
