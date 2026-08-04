// app/js/ui.js
import { DB, getDB, setDB } from './firebase.js';
import { syncAPI } from './telemetry.js';

let mapInstance = null;
let mapInstanceFS = null; 
let charts = {};
let editingStationId = null;

// ====================================================
// SETUP PRINCIPAL DO SISTEMA
// ====================================================
window.setupUI = function() {
    injectCustomCSS();
    injectLiveClock();
    setupConfigTab(); 
    injectMobileResponsiveness();
    setupNavigation();
    setupModals();
    setupDashboard(); 
    renderTables(); 
};

// ====================================================
// INJEÇÃO DE ESTILOS (DARK/LIGHT MODE & VERDE PADRÃO)
// ====================================================
function injectCustomCSS() {
    if(!document.getElementById('premium-ui-css')) {
        const style = document.createElement('style');
        style.id = 'premium-ui-css';
        style.innerHTML = `
            :root {
                --theme-color: #00e676; 
            }
            @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(255, 51, 102, 0.7); } 70% { box-shadow: 0 0 0 15px rgba(255, 51, 102, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 51, 102, 0); } }
            .marker-critical { animation: pulse-red 1.5s infinite; border: 2px solid white; }
            .marker-normal { box-shadow: 0 0 10px var(--theme-color); border: 2px solid white; }
            .marker-alert { box-shadow: 0 0 15px #f59e0b; border: 2px solid white; }
            
            .kpi-card { background: linear-gradient(145deg, rgba(9,15,26,0.9), rgba(2,5,10,0.9)); border-left: 4px solid var(--theme-color); border-radius: 8px; padding: 20px; box-shadow: 0 10px 20px rgba(0,0,0,0.5); display: flex; flex-direction: column; justify-content: center; transition: all 0.3s ease; }
            .kpi-card:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0,0,0,0.7); border-left-color: #fff;}
            .kpi-title { font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; margin-bottom: 5px; }
            .kpi-value { font-size: 2rem; font-weight: 900; color: #fff; display: flex; align-items: baseline; gap: 5px;}
            .kpi-value span { font-size: 0.9rem; color: var(--theme-color); font-weight: 500;}

            /* Efeito HUD de Câmera */
            .hud-overlay { position: absolute; z-index: 5; pointer-events: none; width: 100%; height: 100%; background: linear-gradient(rgba(0,230,118,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,230,118,0.05) 1px, transparent 1px); background-size: 20px 20px; opacity: 0.3;}

            /* LIGHT MODE */
            body.light-mode { background-color: #f1f5f9 !important; color: #0f172a !important; }
            body.light-mode .sidebar, body.light-mode .topbar { background-color: #ffffff !important; border-color: #cbd5e1 !important; }
            body.light-mode .panel, body.light-mode .kpi-card, body.light-mode .os-card { background: #ffffff !important; border-color: #cbd5e1 !important; box-shadow: 0 4px 6px rgba(0,0,0,0.05) !important; }
            body.light-mode .kpi-value, body.light-mode h4, body.light-mode .panel-title { color: #0f172a !important; }
            body.light-mode table th, body.light-mode table td { border-color: #cbd5e1 !important; color: #0f172a !important; }
            body.light-mode .nav-item { color: #475569 !important; }
            body.light-mode .nav-item.active { background-color: rgba(0, 230, 118, 0.15) !important; color: #059669 !important; border-color: #059669 !important; }
        `;
        document.head.appendChild(style);
    }
}

function injectLiveClock() {
    const topbarRight = document.querySelector('.topbar > div:last-child') || document.querySelector('.topbar');
    if (topbarRight && !document.getElementById('live-clock')) {
        const clockDiv = document.createElement('div');
        clockDiv.id = 'live-clock';
        clockDiv.style = 'margin-left: auto; font-family: monospace; color: var(--theme-color); font-size: 0.85rem; background: rgba(0,230,118,0.05); padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(0,230,118,0.2); display: flex; align-items: center; gap: 8px; letter-spacing: 1px;';
        topbarRight.appendChild(clockDiv);
        
        setInterval(() => {
            const now = new Date();
            clockDiv.innerHTML = `<span class="dot" style="background: var(--theme-color); animation: blink 1s infinite; width: 6px; height: 6px; margin:0; box-shadow: 0 0 5px var(--theme-color);"></span> <b>${now.toLocaleDateString('pt-BR')}</b> | ${now.toLocaleTimeString('pt-BR')}`;
        }, 1000);
    }
}

function setupConfigTab() {
    const configSection = document.querySelector('.view-section[id*="config"]');
    
    if(configSection && !document.getElementById('theme-toggle-container')) {
        const toggleContainer = document.createElement('div');
        toggleContainer.id = 'theme-toggle-container';
        toggleContainer.className = 'panel';
        toggleContainer.style.marginTop = '20px';
        toggleContainer.innerHTML = `
            <div class="panel-header">
                <h3 class="panel-title"><i class="ph ph-moon"></i> Aparência do Sistema</h3>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0;">
                <div>
                    <strong style="display: block; margin-bottom: 5px;">Modo de Visualização</strong>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">Alterne entre o Dark Mode (Padrão) e o Light Mode.</span>
                </div>
                <button id="btn-toggle-theme" class="btn btn-outline" style="width: 150px;">
                    <i class="ph ph-sun"></i> Modo Claro
                </button>
            </div>
        `;
        configSection.appendChild(toggleContainer);

        const btnToggle = document.getElementById('btn-toggle-theme');
        btnToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            if(document.body.classList.contains('light-mode')) {
                btnToggle.innerHTML = '<i class="ph ph-moon"></i> Modo Escuro';
                btnToggle.classList.replace('btn-outline', 'btn-primary');
            } else {
                btnToggle.innerHTML = '<i class="ph ph-sun"></i> Modo Claro';
                btnToggle.classList.replace('btn-primary', 'btn-outline');
            }
        });
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

    const toolbar = document.querySelector('.toolbar > div') || document.querySelector('.toolbar');
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
// MAPAS E CÂMERAS (FULLSCREEN, WINDY E YOUTUBE LIVE)
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
        
        // BOTÃO DO RADAR WINDY NO MAPA
        const ClimaControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function () {
                const btn = L.DomUtil.create('button', 'btn btn-primary');
                btn.innerHTML = '<i class="ph ph-cloud-rain" style="font-size: 1.2rem;"></i> Radar Clima (Windy)';
                btn.style.marginTop = '60px'; 
                btn.style.marginLeft = '10px';
                btn.style.boxShadow = '0 0 15px rgba(0,230,118,0.4)';
                btn.onclick = (e) => { e.stopPropagation(); window.openWindyRadar(); };
                return btn;
            }
        });
        mapInstance.addControl(new ClimaControl());
        
        setTimeout(() => mapInstance.invalidateSize(), 500);
    }

    populateMapData(mapInstance, stations, logs);
}

function renderFullscreenMap() {
    const fsSection = document.querySelector('.view-section.active');
    if(fsSection && fsSection.id.includes('fullscreen')) {
        let container = document.getElementById('map-fullscreen-container');
        if(!container) {
            container = document.createElement('div');
            container.id = 'map-fullscreen-container';
            container.style.width = '100%';
            container.style.height = 'calc(100vh - 120px)';
            container.style.borderRadius = '12px';
            container.style.border = '2px solid var(--theme-color)';
            container.style.position = 'relative';
            container.style.zIndex = '1';
            fsSection.appendChild(container);
        }

        if(!mapInstanceFS) {
            const satMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
            mapInstanceFS = L.map('map-fullscreen-container', { center: [-5.2, -39.3], zoom: 8, layers: [satMap] });
            setTimeout(() => mapInstanceFS.invalidateSize(), 600);
        } else {
            setTimeout(() => mapInstanceFS.invalidateSize(), 300);
        }
        populateMapData(mapInstanceFS, getDB(DB.STAS), getDB(DB.LOGS));
    }
}

function populateMapData(mapObj, stations, logs) {
    mapObj.eachLayer((layer) => { if (layer instanceof L.Marker) mapObj.removeLayer(layer); });

    stations.forEach(st => {
        const lastLog = logs.find(l => l.station === st.name);
        const status = lastLog ? lastLog.status : 'Normal';
        
        let color = '#00e676'; 
        let cssClass = 'marker-normal';
        if(status === 'Alerta') { color = '#f59e0b'; cssClass = 'marker-alert'; }
        if(status === 'Interditado') { color = '#ff3366'; cssClass = 'marker-critical'; } 

        const circleIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="${cssClass}" style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%;"></div>`,
            iconSize: [20, 20], iconAnchor: [10, 10]
        });

        // BOTÃO DA CÂMERA IA RESTAURADO DENTRO DO BALÃO
        const popupContent = `
            <div style="text-align: center; color: black; font-family: 'Inter', sans-serif;">
                <b style="font-size: 1.1rem;">${st.name}</b><br>
                <div style="margin: 10px 0; padding: 5px; background: #f8f9fa; border-radius: 4px; border: 1px solid #ddd;">
                    <strong style="color: ${color}; font-size: 1.2rem; text-transform: uppercase;">${status}</strong>
                </div>
                <button onclick="window.openAICamera()" style="background: #02050a; color: #00e676; border: 1px solid #00e676; padding:8px 12px; border-radius:6px; cursor:pointer; width:100%; font-weight:800; transition: 0.2s; display:flex; justify-content:center; align-items:center; gap:6px;">
                    <i class="ph ph-video-camera"></i> VISUALIZAR CÂMERA IA
                </button>
            </div>
        `;
        L.marker([st.lat, st.lon], { icon: circleIcon }).addTo(mapObj).bindPopup(popupContent);
    });
}

// A CÂMERA DE VÍDEO (YOUTUBE LIVE COM YOLOv8 OVERLAY) BLINDADA
window.openAICamera = function() {
    let aiModal = document.getElementById('ai-modal-dynamic');
    if(!aiModal) {
        aiModal = document.createElement('div');
        aiModal.id = 'ai-modal-dynamic';
        aiModal.className = 'modal-overlay active';
        aiModal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; padding: 20px; background: #02050a; border: 1px solid var(--theme-color);">
                <div class="modal-header">
                    <h3 class="modal-title" style="color: var(--theme-color);"><i class="ph ph-video-camera"></i> Câmera IA ao Vivo</h3>
                    <i class="ph ph-x close-modal" onclick="document.getElementById('ai-modal-dynamic').classList.remove('active')" style="cursor: pointer; color: white;"></i>
                </div>
                <div style="position:relative; width:100%; height:400px; background:#000; border-radius:8px; overflow:hidden;">
                    <div class="hud-overlay"></div>
                    <iframe width="100%" height="100%" src="https://www.youtube.com/embed/1EiC9bvVGnk?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=1EiC9bvVGnk" frameborder="0" allow="autoplay; encrypted-media" style="position: absolute; top: 0; left: 0; z-index: 1; opacity: 0.8; pointer-events: none;"></iframe>
                    
                    <div style="position:absolute; top:10px; left:10px; background:rgba(0,0,0,0.85); padding:6px 10px; border-radius:4px; font-size:0.75rem; color:var(--theme-color); font-family:monospace; display:flex; align-items:center; gap:6px; z-index: 10; border: 1px solid var(--theme-color);">
                        <span class="dot green" style="background:var(--theme-color); width:8px; height:8px; margin:0; animation: blink 1s infinite;"></span> LINK RTSP ESTÁVEL (5G)
                    </div>

                    <div id="ai-box" style="position:absolute; top:25%; left:20%; width:50%; height:50%; border: 2px dashed var(--theme-color); background: rgba(0, 230, 118, 0.1); z-index: 10; box-shadow: 0 0 20px rgba(0, 230, 118, 0.2) inset;">
                        <span style="position:absolute; top:-24px; left:-2px; background:var(--theme-color); color:#000; font-size:0.75rem; padding:4px 8px; font-weight:800; text-transform: uppercase;">YOLOv8 | Passagem Livre</span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(aiModal);
    } else {
        aiModal.classList.add('active');
    }
};

// O RADAR METEOROLÓGICO (WINDY) BLINDADO
window.openWindyRadar = function() {
    let wModal = document.getElementById('windy-modal');
    if(!wModal) {
        wModal = document.createElement('div');
        wModal.id = 'windy-modal';
        wModal.className = 'modal-overlay active';
        wModal.innerHTML = `
            <div class="modal-content" style="max-width: 90vw; height: 85vh; padding: 15px; display: flex; flex-direction: column; background: #02050a; border: 1px solid var(--theme-color);">
                <div class="modal-header" style="margin-bottom: 10px;">
                    <h3 class="modal-title" style="color: var(--theme-color);"><i class="ph ph-radar"></i> Radar Meteorológico Satelital</h3>
                    <i class="ph ph-x close-modal" onclick="document.getElementById('windy-modal').classList.remove('active')" style="cursor:pointer; color:white;"></i>
                </div>
                <iframe width="100%" height="100%" src="https://embed.windy.com/embed2.html?lat=-5.2&lon=-39.3&zoom=6&level=surface&overlay=rain&menu=&message=&marker=&calendar=&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1" frameborder="0" style="border-radius: 8px; border: 1px solid var(--theme-color);"></iframe>
            </div>
        `;
        document.body.appendChild(wModal);
    } else {
        wModal.classList.add('active');
    }
};

// ====================================================
// GRÁFICOS ANALÍTICOS (POWER BI STYLE)
// ====================================================
function renderCharts(logs, op, al, inT) {
    const recentLogs = logs.slice(0, 12).reverse(); 
    const labels = recentLogs.map(l => l.date.slice(11, 16));
    const themeColor = '#00e676'; 

    Chart.defaults.color = '#8b9bb4';
    Chart.defaults.font.family = 'Inter';

    const ctxEvolucao = document.getElementById('evolucaoChart');
    if(ctxEvolucao) {
        if(charts.evolucao) charts.evolucao.destroy();
        charts.evolucao = new Chart(ctxEvolucao, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { type: 'line', label: 'Temperatura (°C)', data: recentLogs.map(l => l.temp || 28), borderColor: '#f97316', tension: 0.4, borderWidth: 3, yAxisID: 'y1' },
                    { type: 'bar', label: 'Precipitação (mm)', data: recentLogs.map(l => l.precip), backgroundColor: themeColor, borderRadius: 4, yAxisID: 'y' }
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
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { padding: 20 } } } }
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
                <td style="font-family: monospace; color: #0ea5e9;">${st.mac || 'Pendente'}</td>
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
// AÇÕES GLOBAIS DE EXCLUSÃO E EDIÇÃO
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

window.editStation = function(id) {
    editingStationId = id; 
    const stations = getDB(DB.STAS);
    const station = stations.find(s => String(s.id) === String(id));
    
    if(!station) return;

    const globalModal = document.getElementById('global-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.innerText = "Editar Estação";
    const tpl = document.getElementById('tpl-station-form').content.cloneNode(true);
    modalBody.innerHTML = '';
    modalBody.appendChild(tpl);

    document.getElementById('st-name').value = station.name;
    document.getElementById('st-region').value = station.region;
    document.getElementById('st-lat').value = station.lat;
    document.getElementById('st-lon').value = station.lon;
    document.getElementById('st-quota').value = station.quota;
    document.getElementById('st-mac').value = station.mac || '';
    document.getElementById('st-calib').value = station.calib || '';
    document.getElementById('st-cam').value = station.cam || '';

    document.getElementById('form-station-submit').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        let stList = getDB(DB.STAS);
        const index = stList.findIndex(s => String(s.id) === String(editingStationId));
        
        if (index !== -1) {
            stList[index] = {
                ...stList[index],
                name: document.getElementById('st-name').value.trim(),
                region: document.getElementById('st-region').value,
                lat: parseFloat(document.getElementById('st-lat').value),
                lon: parseFloat(document.getElementById('st-lon').value),
                quota: parseInt(document.getElementById('st-quota').value),
                mac: document.getElementById('st-mac').value.trim(),
                calib: document.getElementById('st-calib').value.trim(),
                cam: document.getElementById('st-cam').value.trim()
            };
        }

        try {
            if(submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Salvando...'; }
            await setDB(DB.STAS, stList);
            alert("Estação atualizada com sucesso!");
            globalModal.classList.remove('active');
            editingStationId = null; 
            window.dispatchEvent(new Event('telemetryUpdated'));
        } catch (err) {
            alert("Erro ao salvar a estação.");
            if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Salvar'; }
        }
    });

    globalModal.classList.add('active');
};

// ====================================================
// O CÉREBRO DE SALVAMENTO DE FORMULÁRIOS
// ====================================================
function setupModals() {
    const globalModal = document.getElementById('global-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModal = () => globalModal.classList.remove('active');
    const getSubmitButton = (form) => form.querySelector('button[type="submit"]');

    // NOVA ESTAÇÃO
    const btnNewStation = document.getElementById('btn-new-station');
    if(btnNewStation) {
        btnNewStation.addEventListener('click', () => {
            editingStationId = null; 
            modalTitle.innerHTML = "<i class='ph ph-plus-circle'></i> Provisionar Nova Estação IoT";
            const tpl = document.getElementById('tpl-station-form').content.cloneNode(true);
            modalBody.innerHTML = '';
            modalBody.appendChild(tpl);
            globalModal.classList.add('active');

            const form = document.getElementById('form-station-submit');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = getSubmitButton(form);
                const stations = getDB(DB.STAS);
                
                const latVal = document.getElementById('st-lat') ? parseFloat(document.getElementById('st-lat').value) : 0;
                const lonVal = document.getElementById('st-lon') ? parseFloat(document.getElementById('st-lon').value) : 0;
                const quotaVal = document.getElementById('st-quota') ? parseInt(document.getElementById('st-quota').value) : 10;
                
                stations.push({
                    id: Date.now(),
                    name: (document.getElementById('st-name') ? document.getElementById('st-name').value.trim() : 'Estação Desconhecida'),
                    region: (document.getElementById('st-region') ? document.getElementById('st-region').value : 'Geral'),
                    lat: isNaN(latVal) ? 0 : latVal,
                    lon: isNaN(lonVal) ? 0 : lonVal,
                    quota: isNaN(quotaVal) ? 10 : quotaVal,
                    mac: (document.getElementById('st-mac') ? document.getElementById('st-mac').value.trim() : ''),
                    calib: (document.getElementById('st-calib') ? document.getElementById('st-calib').value.trim() : ''),
                    cam: (document.getElementById('st-cam') ? document.getElementById('st-cam').value.trim() : '')
                });

                try {
                    if(submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="ph ph-spinner" style="animation: spin 1s infinite;"></i> Conectando...'; }
                    await setDB(DB.STAS, stations); 
                    await syncAPI(); 
                    alert("Estação provisionada com sucesso!");
                    closeModal();
                } catch (err) {
                    alert("Falha ao salvar estação.");
                    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Tentar Novamente'; }
                }
            });
        });
    }

    // NOVO USUÁRIO
    const btnNewUser = document.getElementById('btn-new-user');
    if(btnNewUser) {
        btnNewUser.addEventListener('click', () => {
            modalTitle.innerHTML = "<i class='ph ph-shield-plus'></i> Provisionar Acesso RBAC";
            const tpl = document.getElementById('tpl-user-form').content.cloneNode(true);
            
            const containerStations = tpl.querySelector('#usr-stations-container');
            const stations = getDB(DB.STAS);
            stations.forEach(st => {
                containerStations.innerHTML += `<label class="checkbox-label"><input type="checkbox" value="${st.id}" class="station-cb"> ${st.name}</label>`;
            });

            modalBody.innerHTML = '';
            modalBody.appendChild(tpl);
            globalModal.classList.add('active');

            const roleSelect = document.getElementById('usr-role');
            if(roleSelect) {
                roleSelect.addEventListener('change', (e) => {
                    const sel = document.getElementById('container-station-select');
                    if(sel) sel.style.display = e.target.value === 'Admin' ? 'none' : 'block';
                });
            }

            const form = document.getElementById('form-user-submit');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = getSubmitButton(form);
                const roleVal = document.getElementById('usr-role') ? document.getElementById('usr-role').value : 'Operador';

                let allowedStations = 'all';
                if (roleVal !== 'Admin') {
                    const checkboxes = document.querySelectorAll('#container-station-select input[type="checkbox"]:checked');
                    allowedStations = checkboxes.length ? Array.from(checkboxes).map(cb => String(cb.value)) : [];
                }

                const users = getDB(DB.USRS);
                users.push({
                    id: Date.now(),
                    name: (document.getElementById('usr-name') ? document.getElementById('usr-name').value.trim() : 'Novo Usuário'),
                    email: (document.getElementById('usr-email') ? document.getElementById('usr-email').value.trim().toLowerCase() : ''),
                    pass: (document.getElementById('usr-pass') ? document.getElementById('usr-pass').value.trim() : ''),
                    role: roleVal,
                    allowedStations: allowedStations
                });

                try {
                    if(submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = 'Gravando...'; }
                    await setDB(DB.USRS, users); 
                    alert("Acesso RBAC gravado com sucesso! Adicione o email no Firebase Auth.");
                    closeModal();
                    renderTables();
                } catch (err) {
                    alert("Falha de autenticação na nuvem.");
                    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Salvar'; }
                }
            });
        });
    }

    // NOVA ORDEM DE SERVIÇO
    const btnNewOS = document.getElementById('btn-new-os');
    if(btnNewOS) {
        btnNewOS.addEventListener('click', () => {
            modalTitle.innerHTML = "<i class='ph ph-wrench'></i> Emitir Ordem de Serviço";
            const tpl = document.getElementById('tpl-os-form').content.cloneNode(true);
            
            const selectOs = tpl.querySelector('#os-station');
            const stations = getDB(DB.STAS);
            if(selectOs) {
                stations.forEach(st => {
                    const opt = document.createElement('option');
                    opt.value = st.name; opt.innerText = st.name;
                    selectOs.appendChild(opt);
                });
            }

            modalBody.innerHTML = '';
            modalBody.appendChild(tpl);
            globalModal.classList.add('active');

            const form = document.getElementById('form-os-submit');
            form.addEventListener('submit', async (e) => {
                e.preventDefault(); 
                const btnSubmit = form.querySelector('button[type="submit"]');
                
                try {
                    if(btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerHTML = 'Gravando O.S...'; }
                    
                    const stationVal = document.getElementById('os-station') ? document.getElementById('os-station').value : 'Geral';
                    const issueVal = document.getElementById('os-issue') ? document.getElementById('os-issue').value.trim() : 'Sem descrição';
                    const severityVal = document.getElementById('os-severity') ? document.getElementById('os-severity').value : 'warning';
                    
                    const osList = getDB(DB.OS) || [];
                    osList.push({
                        id: Date.now(),
                        station: stationVal,
                        issue: issueVal || 'Inspeção solicitada',
                        status: 'Aberta',
                        date: new Date().toLocaleDateString('pt-BR'),
                        severity: severityVal
                    });

                    await setDB(DB.OS, osList);
                    alert("O.S. registrada no sistema e despachada para a equipe!");
                    closeModal(); 
                    renderTables(); 
                    
                } catch (err) {
                    console.error("ERRO:", err);
                    alert("Erro ao gravar O.S.");
                    if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerText = 'Salvar O.S.'; }
                }
            });
        });
    }
}

// ====================================================
// NAV & MOBILE (GATILHO PARA FULLSCREEN MAP)
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
            
            if(window.mapInstance) { setTimeout(() => window.mapInstance.invalidateSize(), 300); }
            
            if(targetID.includes('fullscreen') || targetID.includes('map')) {
                setTimeout(() => renderFullscreenMap(), 100);
            }
        });
    });
}
