// app/js/ui.js
import { DB, getDB, setDB } from './firebase.js';
import { syncAPI } from './telemetry.js';

let mapInstance = null;
let charts = {};
let editingStationId = null;

// ====================================================
// SETUP PRINCIPAL DO SISTEMA
// ====================================================
window.setupUI = function() {
    injectCustomCSS();
    injectLiveClock();
    injectMobileResponsiveness();
    setupNavigation();
    setupModals();
    setupDashboard(); 
    renderTables(); 
};

// ====================================================
// INJEÇÃO DE ELEMENTOS VISUAIS E ESTILOS AVANÇADOS
// ====================================================
function injectCustomCSS() {
    if(!document.getElementById('premium-ui-css')) {
        const style = document.createElement('style');
        style.id = 'premium-ui-css';
        style.innerHTML = `
            @keyframes pulse-red { 
                0% { box-shadow: 0 0 0 0 rgba(255, 51, 102, 0.7); } 
                70% { box-shadow: 0 0 0 15px rgba(255, 51, 102, 0); } 
                100% { box-shadow: 0 0 0 0 rgba(255, 51, 102, 0); } 
            }
            .marker-critical { animation: pulse-red 1.5s infinite; border: 2px solid white; }
            .marker-normal { box-shadow: 0 0 10px #00e676; border: 2px solid white; }
            .marker-alert { box-shadow: 0 0 15px #f59e0b; border: 2px solid white; }
            
            .hud-overlay { position: absolute; z-index: 10; pointer-events: none; width: 100%; height: 100%; background: linear-gradient(rgba(0,230,118,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,230,118,0.05) 1px, transparent 1px); background-size: 20px 20px; opacity: 0.3;}
        `;
        document.head.appendChild(style);
    }
}

function injectLiveClock() {
    const topbarRight = document.querySelector('.topbar > div:last-child');
    if (topbarRight && !document.getElementById('live-clock')) {
        const clockDiv = document.createElement('div');
        clockDiv.id = 'live-clock';
        clockDiv.style = 'margin-right: 20px; font-family: monospace; color: var(--color-green); font-size: 0.85rem; background: rgba(0,230,118,0.05); padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(0,230,118,0.2); display: flex; align-items: center; gap: 8px; letter-spacing: 1px;';
        topbarRight.prepend(clockDiv);
        
        setInterval(() => {
            const now = new Date();
            clockDiv.innerHTML = `<span class="dot green" style="animation: blink 1s infinite; width: 6px; height: 6px; margin:0;"></span> <b>${now.toLocaleDateString('pt-BR')}</b> | ${now.toLocaleTimeString('pt-BR')}`;
        }, 1000);
    }
}

// ====================================================
// 1. LÓGICA DO DASHBOARD (MAPAS E GRÁFICOS)
// ====================================================
function setupDashboard() {
    renderDashboard();
    window.addEventListener('telemetryUpdated', () => { renderDashboard(); renderTables(); });
    window.addEventListener('cloudDataUpdated', () => { renderDashboard(); renderTables(); });

    const syncBtn = document.getElementById('btn-sync-api');
    if(syncBtn) {
        syncBtn.addEventListener('click', async () => {
            syncBtn.innerHTML = `<i class="ph ph-arrows-clockwise" style="animation: spin 1s linear infinite;"></i> Sincronizando Satélites...`;
            await syncAPI();
            syncBtn.innerHTML = `<i class="ph ph-arrows-clockwise"></i> Forçar Sincronização API`;
        });
    }

    // BOTÕES EXECUTIVOS (Simulação e Relatório)
    const toolbar = document.querySelector('.toolbar > div');
    if(toolbar && !document.getElementById('btn-panic')) {
        // Botão Simulação CEO
        const btnPanic = document.createElement('button');
        btnPanic.id = 'btn-panic';
        btnPanic.className = 'btn btn-danger';
        btnPanic.style.marginLeft = '10px';
        btnPanic.innerHTML = '<i class="ph ph-warning-octagon"></i> Simular Transbordamento (Demo)';
        btnPanic.onclick = async () => {
            alert("⚠️ ALERTA DE SISTEMA: Injetando anomalia climática crítica (154mm) na rede de Morrinhos...");
            let logs = getDB(DB.LOGS);
            let osList = getDB(DB.OS);
            const now = new Date();
            const currentTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0,19).replace('T',' ');

            logs.unshift({ id: Date.now(), date: currentTime, station: 'Morrinhos 1 (Piloto)', status: 'Interditado', precip: 154.2, temp: 23.5, hum: 99, wind: 85.0 });
            osList.push({ id: Date.now()+1, station: 'Morrinhos 1 (Piloto)', issue: 'CRÍTICO: Lâmina d\'água excedeu a cota de segurança da passagem molhada.', status: 'Open', date: new Date().toLocaleDateString('pt-BR'), severity: 'critical' });

            await setDB(DB.LOGS, logs);
            await setDB(DB.OS, osList);
            window.dispatchEvent(new Event('telemetryUpdated'));
        };
        toolbar.appendChild(btnPanic);

        // Botão Relatório Executivo
        const btnReport = document.createElement('button');
        btnReport.className = 'btn btn-outline';
        btnReport.style.marginLeft = '10px';
        btnReport.innerHTML = '<i class="ph ph-printer"></i> Gerar Relatório Executivo';
        btnReport.onclick = () => {
            btnReport.innerHTML = '<i class="ph ph-spinner" style="animation: spin 1s infinite;"></i> Compilando Dados...';
            setTimeout(() => {
                window.print();
                btnReport.innerHTML = '<i class="ph ph-printer"></i> Gerar Relatório Executivo';
            }, 1500);
        };
        toolbar.appendChild(btnReport);
    }
}

function renderDashboard() {
    const stations = getDB(DB.STAS);
    const logs = getDB(DB.LOGS);
    
    let op = 0, al = 0, inT = 0;
    stations.forEach(st => {
        const lastLog = logs.find(l => l.station === st.name);
        const status = lastLog ? lastLog.status : 'Normal';
        if(status === 'Normal') op++;
        else if(status === 'Alerta') al++;
        else if(status === 'Interditado') inT++;
    });

    const cardOp = document.getElementById('card-op');
    const cardAl = document.getElementById('card-al');
    const cardIn = document.getElementById('card-in');
    if(cardOp) cardOp.innerText = op;
    if(cardAl) cardAl.innerText = al;
    if(cardIn) cardIn.innerText = inT;

    renderMap(stations, logs);
    renderCharts(logs, op, al, inT); // Passa os contadores para os gráficos
}

// ====================================================
// MAPA DE SATÉLITE E RADAR CLIMÁTICO
// ====================================================
function renderMap(stations, logs) {
    const container = document.getElementById('map-container');
    if(!container) return;
    container.style.minHeight = '350px';

    if(!mapInstance) {
        // Satélite de Alta Resolução Esri
        const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri'
        });
        const darkMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');

        mapInstance = L.map('map-container', { center: [-5.2, -39.3], zoom: 7, layers: [satelliteMap] });
        window.mapInstance = mapInstance;

        L.control.layers({"Satélite Militar": satelliteMap, "Mapa Tático": darkMap}).addTo(mapInstance);
        
        // Botão Radar Clima no Mapa
        const ClimaControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function () {
                const btn = L.DomUtil.create('button', 'btn btn-primary');
                btn.innerHTML = '<i class="ph ph-cloud-rain" style="font-size: 1.2rem;"></i> Radar Clima (Windy)';
                btn.style.marginTop = '60px'; 
                btn.style.marginLeft = '10px';
                btn.style.boxShadow = '0 0 15px rgba(0,230,118,0.4)';
                btn.onclick = (e) => { e.stopPropagation(); openWindyRadar(); };
                return btn;
            }
        });
        mapInstance.addControl(new ClimaControl());

        setTimeout(() => mapInstance.invalidateSize(), 500);
    }

    mapInstance.eachLayer((layer) => { if (layer instanceof L.Marker) mapInstance.removeLayer(layer); });

    stations.forEach(st => {
        const lastLog = logs.find(l => l.station === st.name);
        const status = lastLog ? lastLog.status : 'Normal';
        
        let color = '#00e676'; 
        let cssClass = 'marker-normal';
        
        if(status === 'Alerta') { color = '#f59e0b'; cssClass = 'marker-alert'; }
        if(status === 'Interditado') { color = '#ff3366'; cssClass = 'marker-critical'; } 

        const circleIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="${cssClass}" style="background-color: ${color}; width: 18px; height: 18px; border-radius: 50%;"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });

        const popupContent = `
            <div style="text-align: center; color: black; font-family: 'Inter', sans-serif;">
                <b style="font-size: 1.1rem;">${st.name}</b><br>
                <span style="color: #666; font-size: 0.8rem;">LAT: ${st.lat} | LON: ${st.lon}</span><br>
                <div style="margin: 10px 0; padding: 5px; background: #f8f9fa; border-radius: 4px; border: 1px solid #ddd;">
                    <strong style="color: ${color}; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 1px;">${status}</strong>
                </div>
                <button onclick="openAICamera()" style="background: #02050a; color: #00e676; border: 1px solid #00e676; padding:8px 12px; border-radius:6px; cursor:pointer; width:100%; font-weight:800; transition: 0.2s; display:flex; justify-content:center; align-items:center; gap:6px;">
                    <i class="ph ph-video-camera"></i> ACESSAR CÂMERA IA
                </button>
            </div>
        `;

        L.marker([st.lat, st.lon], { icon: circleIcon }).addTo(mapInstance).bindPopup(popupContent);
    });
}

// ====================================================
// MODAIS DE CÂMERA AO VIVO E RADAR WINDY
// ====================================================
window.openAICamera = function() {
    const aiModal = document.getElementById('ai-modal');
    if(!aiModal) return;

    const imgContainer = aiModal.querySelector('div[style*="height:320px"]');
    if(imgContainer) {
        imgContainer.style.background = '#02050a';
        
        if(!imgContainer.querySelector('iframe')) {
            // Câmera Pública de Rodovia ao Vivo via YouTube (Iframe)
            imgContainer.innerHTML = `
                <div class="hud-overlay"></div>
                <iframe width="100%" height="100%" src="https://www.youtube.com/embed/1EiC9bvVGnk?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=1EiC9bvVGnk" frameborder="0" allow="autoplay; encrypted-media" style="position: absolute; top: 0; left: 0; z-index: 1; opacity: 0.6; pointer-events: none;"></iframe>
                
                <div style="position:absolute; top:10px; left:10px; background:rgba(0,0,0,0.85); padding:6px 10px; border-radius:4px; font-size:0.75rem; color:var(--color-green); font-family:monospace; display:flex; align-items:center; gap:6px; z-index: 10; border: 1px solid var(--color-green);">
                    <span class="dot green" style="width:8px; height:8px; margin:0; animation: blink 1s infinite;"></span> LINK RTSP ESTÁVEL (5G)
                </div>

                <div id="ai-box" style="position:absolute; top:25%; left:20%; width:50%; height:50%; border: 2px dashed var(--color-green); background: rgba(0, 230, 118, 0.1); z-index: 10; box-shadow: 0 0 20px rgba(0, 230, 118, 0.2) inset;">
                    <span style="position:absolute; top:-24px; left:-2px; background:var(--color-green); color:#000; font-size:0.75rem; padding:4px 8px; font-weight:800; text-transform: uppercase;">YOLOv8 | Passagem Livre</span>
                </div>
            `;
        }
    }
    aiModal.classList.add('active');
};

window.openWindyRadar = function() {
    let wModal = document.getElementById('windy-modal');
    if(!wModal) {
        wModal = document.createElement('div');
        wModal.id = 'windy-modal';
        wModal.className = 'modal-overlay active';
        wModal.innerHTML = `
            <div class="modal-content" style="max-width: 90vw; height: 85vh; padding: 15px; display: flex; flex-direction: column;">
                <div class="modal-header" style="margin-bottom: 10px;">
                    <h3 class="modal-title"><i class="ph ph-radar"></i> Radar Meteorológico Satelital</h3>
                    <i class="ph ph-x close-modal" onclick="document.getElementById('windy-modal').classList.remove('active')"></i>
                </div>
                <iframe width="100%" height="100%" src="https://embed.windy.com/embed2.html?lat=-5.2&lon=-39.3&zoom=6&level=surface&overlay=rain&menu=&message=&marker=&calendar=&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1" frameborder="0" style="border-radius: 8px; border: 1px solid var(--color-green);"></iframe>
            </div>
        `;
        document.body.appendChild(wModal);
    } else {
        wModal.classList.add('active');
    }
}

// ====================================================
// OS 3 GRÁFICOS DO DASHBOARD (DATA ANALYTICS)
// ====================================================
function renderCharts(logs, op, al, inT) {
    const recentLogs = logs.slice(0, 10).reverse();
    const labels = recentLogs.map(l => l.date.slice(11, 16));

    Chart.defaults.color = '#8b9bb4';
    Chart.defaults.font.family = 'Inter';

    // 1. Gráfico de Lâmina D'água (Evolução) - Linha
    const ctxEvolucao = document.getElementById('evolucaoChart');
    if(ctxEvolucao) {
        if(charts.evolucao) charts.evolucao.destroy();
        charts.evolucao = new Chart(ctxEvolucao, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Precipitação Média (mm)',
                    data: recentLogs.map(l => l.precip),
                    borderColor: '#00e676', backgroundColor: 'rgba(0, 230, 118, 0.1)',
                    tension: 0.4, fill: true, borderWidth: 2, pointBackgroundColor: '#00e676'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } } }
        });
    }

    // 2. Gráfico Histórico (Velocidade dos Ventos) - Barras
    const ctxHistorico = document.getElementById('historicoChart');
    if(ctxHistorico) {
        if(charts.historico) charts.historico.destroy();
        charts.historico = new Chart(ctxHistorico, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Vento Máx. (km/h)',
                    data: recentLogs.map(l => l.wind),
                    backgroundColor: '#0ea5e9', borderRadius: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } } }
        });
    }

    // 3. Gráfico de Região (Distribuição Operacional) - Rosca
    const ctxRegiao = document.getElementById('regiaoChart');
    if(ctxRegiao) {
        if(charts.regiao) charts.regiao.destroy();
        
        // Renderiza a legenda customizada
        const legendDiv = document.getElementById('regiao-legend');
        if(legendDiv) {
            legendDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between;"><span><span class="dot green"></span>Seguro</span> <strong>${op}</strong></div>
                <div style="display:flex; justify-content:space-between;"><span><span class="dot yellow"></span>Alerta</span> <strong>${al}</strong></div>
                <div style="display:flex; justify-content:space-between;"><span><span class="dot red"></span>Crítico</span> <strong>${inT}</strong></div>
            `;
        }

        charts.regiao = new Chart(ctxRegiao, {
            type: 'doughnut',
            data: {
                labels: ['Operando', 'Alerta', 'Interditado'],
                datasets: [{
                    data: [op, al, inT],
                    backgroundColor: ['#00e676', '#f59e0b', '#ff3366'],
                    borderWidth: 0, hoverOffset: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
        });
    }
}

// ====================================================
// RENDERIZAÇÃO DAS TABELAS DE GESTÃO E RBAC
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
                <td>${st.cam ? '<span style="color: var(--color-green)"><i class="ph ph-check-circle"></i> Integrada</span>' : '<span style="color: var(--text-muted)">Offline</span>'}</td>
                <td class="admin-only" style="display:flex; gap:5px;">
                    <button class="btn btn-outline" style="padding: 6px 10px;" onclick="editStation('${st.id}')" title="Editar Estação"><i class="ph ph-pencil"></i></button>
                    <button class="btn btn-danger" style="padding: 6px 10px;" onclick="deleteStation('${st.id}')" title="Excluir Estação"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    const tbodyUsers = document.querySelector('#table-users tbody');
    if (tbodyUsers) {
        const users = getDB(DB.USRS);
        tbodyUsers.innerHTML = users.map(u => {
            let permissoes = '0 passagens';
            if (u.allowedStations === 'all') permissoes = '<i class="ph ph-shield-check" style="color:var(--color-green)"></i> Acesso Global (Admin)';
            else if (Array.isArray(u.allowedStations)) permissoes = `${u.allowedStations.length} passagens liberadas`;
            
            return `
            <tr>
                <td><strong>${u.name || 'Usuário'}</strong></td>
                <td>${u.email}</td>
                <td><span style="background: rgba(0, 230, 118, 0.1); color: var(--color-green); border: 1px solid rgba(0,230,118,0.3); padding: 4px 8px; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 0.7rem;">${u.role}</span></td>
                <td>${permissoes}</td>
                <td>
                    <button class="btn btn-danger" style="padding: 6px 10px;" onclick="deleteUser('${u.id}')" title="Revogar Acesso"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
            `;
        }).join('');
    }

    const osContainer = document.getElementById('os-container');
    if (osContainer) {
        const osList = getDB(DB.OS);
        if (osList.length === 0) {
            osContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; border: 1px dashed var(--border-color); border-radius: 12px; color: var(--text-muted);"><i class="ph ph-check-circle" style="font-size: 3rem; color: var(--color-green); margin-bottom: 15px; display: block;"></i>Nenhuma manutenção pendente. Operação 100%.</div>';
        } else {
            osContainer.innerHTML = osList.map(os => `
                <div class="os-card ${os.severity}" style="box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <h4 style="color:var(--text-white); margin: 0;">${os.station}</h4>
                        <span style="font-size: 0.65rem; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 10px;">OS #${os.id.toString().slice(-4)}</span>
                    </div>
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px; line-height: 1.4;">${os.issue}</p>
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem; border-top: 1px solid var(--border-color); padding-top: 10px;">
                        <span style="color:var(--color-blue-gray)"><i class="ph ph-clock"></i> Registrado em: ${os.date}</span>
                        <strong style="color: ${os.severity === 'critical' ? 'var(--color-red)' : 'var(--color-yellow)'}; text-transform: uppercase;"><i class="ph ph-warning-circle"></i> ${os.status}</strong>
                    </div>
                </div>
            `).join('');
        }
    }

    const tbodyLogs = document.querySelector('#table-logs tbody');
    if (tbodyLogs) {
        const logs = getDB(DB.LOGS).slice(0, 50); 
        tbodyLogs.innerHTML = logs.map(l => `
            <tr>
                <td style="font-family: monospace;">${l.date}</td>
                <td><strong>${l.station}</strong></td>
                <td><span style="background: ${l.status==='Interditado' ? 'rgba(255,51,102,0.1)' : (l.status==='Alerta' ? 'rgba(245,158,11,0.1)' : 'rgba(0,230,118,0.1)')}; color: ${l.status==='Interditado' ? 'var(--color-red)' : (l.status==='Alerta' ? 'var(--color-yellow)' : 'var(--color-green)')}; padding: 4px 8px; border-radius: 4px; font-weight: 700;">${l.status}</span></td>
                <td>${l.precip} mm</td>
                <td><i class="ph-fill ph-check-circle" style="color: var(--color-green);"></i> Validado</td>
            </tr>
        `).join('');
    }
}

// ====================================================
// AÇÕES GLOBAIS (EXCLUIR / EDITAR)
// ====================================================
window.deleteStation = function(id) {
    if(!confirm("ALERTA DE SEGURANÇA: Tem certeza que deseja remover permanentemente esta estação da malha de telemetria?")) return;
    let stations = getDB(DB.STAS);
    stations = stations.filter(s => String(s.id) !== String(id));
    setDB(DB.STAS, stations).then(() => { renderTables(); renderDashboard(); });
};

window.deleteUser = function(id) {
    if(!confirm("ALERTA DE SEGURANÇA: Tem certeza que deseja revogar o acesso deste servidor ao SPPM?")) return;
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

    modalTitle.innerHTML = "<i class='ph ph-pencil-simple'></i> Editar Configuração da Estação";
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
            if(submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="ph ph-spinner" style="animation: spin 1s infinite;"></i> Aplicando Patches...'; }
            await setDB(DB.STAS, stList);
            await syncAPI(); // Atualiza o clima IMEDIATAMENTE
            alert("Protocolos da estação atualizados e sincronizados com a nuvem!");
            globalModal.classList.remove('active');
            editingStationId = null; 
        } catch (err) {
            alert("Erro de comunicação com a nuvem.");
            if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Salvar'; }
        }
    });
    globalModal.classList.add('active');
};

// ====================================================
// SETUP DE MODAIS E CRIAÇÃO DE DADOS
// ====================================================
function setupModals() {
    const globalModal = document.getElementById('global-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModal = () => globalModal.classList.remove('active');
    const getSubmitButton = (form) => form.querySelector('button[type="submit"]');

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
                stations.push({
                    id: Date.now(),
                    name: document.getElementById('st-name').value.trim(),
                    region: document.getElementById('st-region').value,
                    lat: parseFloat(document.getElementById('st-lat').value),
                    lon: parseFloat(document.getElementById('st-lon').value),
                    quota: parseInt(document.getElementById('st-quota').value),
                    mac: document.getElementById('st-mac').value.trim(),
                    calib: document.getElementById('st-calib').value.trim(),
                    cam: document.getElementById('st-cam').value.trim()
                });

                try {
                    if(submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="ph ph-spinner" style="animation: spin 1s infinite;"></i> Conectando...'; }
                    await setDB(DB.STAS, stations); 
                    await syncAPI(); // A MÁGICA: Puxa o clima exato da estação recém-criada
                    alert("Estação provisionada com sucesso e telemetria meteorológica sincronizada!");
                    closeModal();
                } catch (err) {
                    alert("Falha na comunicação com a infraestrutura em nuvem.");
                    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Tentar Novamente'; }
                }
            });
        });
    }

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
                    document.getElementById('container-station-select').style.display = e.target.value === 'Admin' ? 'none' : 'block';
                });
            }

            const form = document.getElementById('form-user-submit');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = getSubmitButton(form);
                const roleVal = document.getElementById('usr-role').value;

                let allowedStations = 'all';
                if (roleVal !== 'Admin') {
                    const checkboxes = document.querySelectorAll('#container-station-select input[type="checkbox"]:checked');
                    allowedStations = checkboxes.length ? Array.from(checkboxes).map(cb => String(cb.value)) : [];
                }

                const users = getDB(DB.USRS);
                users.push({
                    id: Date.now(),
                    name: document.getElementById('usr-name').value.trim(),
                    email: document.getElementById('usr-email').value.trim().toLowerCase(),
                    pass: document.getElementById('usr-pass').value.trim(),
                    role: roleVal,
                    allowedStations: allowedStations
                });

                try {
                    if(submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="ph ph-spinner" style="animation: spin 1s infinite;"></i> Gravando Permissões...'; }
                    await setDB(DB.USRS, users); 
                    alert("Acesso RBAC gravado com sucesso! Lembre-se de registrar este email na aba Authentication do Firebase.");
                    closeModal();
                    renderTables();
                } catch (err) {
                    alert("Falha de autenticação na nuvem.");
                    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Salvar'; }
                }
            });
        });
    }

    const btnNewOS = document.getElementById('btn-new-os');
    if(btnNewOS) {
        btnNewOS.addEventListener('click', () => {
            modalTitle.innerHTML = "<i class='ph ph-wrench'></i> Emitir Ordem de Serviço";
            const tpl = document.getElementById('tpl-os-form').content.cloneNode(true);
            
            const selectOs = tpl.querySelector('#os-station');
            const stations = getDB(DB.STAS);
            stations.forEach(st => {
                const opt = document.createElement('option');
                opt.value = st.name;
                opt.innerText = st.name;
                selectOs.appendChild(opt);
            });

            modalBody.innerHTML = '';
            modalBody.appendChild(tpl);
            globalModal.classList.add('active');

            const form = document.getElementById('form-os-submit');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = getSubmitButton(form);
                const osList = getDB(DB.OS);
                osList.push({
                    id: Date.now(),
                    station: document.getElementById('os-station').value,
                    issue: document.getElementById('os-issue').value,
                    status: 'Open',
                    date: new Date().toLocaleDateString('pt-BR'),
                    severity: document.getElementById('os-severity').value
                });

                try {
                    if(submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="ph ph-spinner" style="animation: spin 1s infinite;"></i> Despachando...'; }
                    await setDB(DB.OS, osList);
                    alert("O.S. registrada no sistema e despachada para a equipe de campo!");
                    closeModal();
                    renderTables();
                } catch (err) {
                    alert("Erro de comunicação.");
                    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Salvar'; }
                }
            });
        });
    }
}

// ====================================================
// NAV & MOBILE 
// ====================================================
function injectMobileResponsiveness() {
    if(!document.getElementById('sppm-mobile-css')) {
        const style = document.createElement('style');
        style.id = 'sppm-mobile-css';
        style.innerHTML = `@media (max-width: 768px) { .sidebar { position: fixed; left: -100%; top: 0; height: 100vh; z-index: 9999; transition: left 0.3s ease; box-shadow: 5px 0 15px rgba(0,0,0,0.8); width: 260px; } .sidebar.open { left: 0; } .main-content { margin-left: 0 !important; width: 100%; } .grid-layout { display: flex !important; flex-direction: column; gap: 15px; } .card { width: 100% !important; margin: 0; } #map, .leaflet-container { height: 350px !important; } .btn-mobile-menu { display: inline-block !important; background: none; border: none; color: #00e676; font-size: 1.8rem; cursor: pointer; margin-right: 15px; } } @media (min-width: 769px) { .btn-mobile-menu { display: none !important; } }`;
        document.head.appendChild(style);
    }
    const topbar = document.querySelector('.topbar') || document.querySelector('header');
    if(topbar && !document.getElementById('menu-toggle')) {
        const btn = document.createElement('button');
        btn.id = 'menu-toggle';
        btn.className = 'btn-mobile-menu';
        btn.innerHTML = '☰';
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
        });
    });
}
