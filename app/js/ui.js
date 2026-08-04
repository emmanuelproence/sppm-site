// app/js/ui.js
import { DB, getDB, setDB } from './firebase.js';
import { syncAPI } from './telemetry.js';

let mapInstance = null;
let charts = {};

// Função central chamada após o Login
window.setupUI = function() {
    injectMobileResponsiveness();
    setupNavigation();
    setupModals();
    setupDashboard(); // Carrega Mapa e Gráficos
    renderTables();   // Carrega as Tabelas Ocultas (O BUG ESTAVA AQUI)
};

// ----------------------------------------------------
// 1. LÓGICA DO DASHBOARD (MAPAS E GRÁFICOS)
// ----------------------------------------------------
function setupDashboard() {
    renderDashboard();
    
    // Atualiza a tela automaticamente quando a telemetria baixar dados novos
    window.addEventListener('telemetryUpdated', () => {
        renderDashboard();
        renderTables(); // Atualiza as tabelas junto com o mapa
    });

    const syncBtn = document.getElementById('btn-sync-api');
    if(syncBtn) {
        syncBtn.addEventListener('click', async () => {
            syncBtn.innerHTML = `<i class="ph ph-arrows-clockwise" style="animation: spin 1s linear infinite;"></i> Sincronizando...`;
            await syncAPI();
            syncBtn.innerHTML = `<i class="ph ph-arrows-clockwise"></i> Forçar Sincronização API`;
        });
    }
}

function renderDashboard() {
    const stations = getDB(DB.STAS);
    const logs = getDB(DB.LOGS);
    
    // Atualiza os contadores Operando/Alerta/Interditado
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
    renderCharts(logs);
}

function renderMap(stations, logs) {
    const container = document.getElementById('map-container');
    if(!container) return;

    // FORÇA O TAMANHO PARA O MAPA NÃO FICAR INVISÍVEL
    container.style.minHeight = '350px';

    if(!mapInstance) {
        mapInstance = L.map('map-container').setView([-5.2, -39.3], 7);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(mapInstance);
        window.mapInstance = mapInstance;
        
        setTimeout(() => mapInstance.invalidateSize(), 500);
    }

    // Limpa pontos antigos
    mapInstance.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            mapInstance.removeLayer(layer);
        }
    });

    // Coloca os pontos novos
    stations.forEach(st => {
        const lastLog = logs.find(l => l.station === st.name);
        const status = lastLog ? lastLog.status : 'Normal';
        let color = '#10b981'; 
        if(status === 'Alerta') color = '#f59e0b'; 
        if(status === 'Interditado') color = '#ef4444'; 

        const circleIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color};"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });

        L.marker([st.lat, st.lon], { icon: circleIcon })
          .addTo(mapInstance)
          .bindPopup(`<b style="color: black;">${st.name}</b><br><span style="color: black;">Região: ${st.region}</span><br><strong style="color: ${color};">Status: ${status}</strong>`);
    });
}

function renderCharts(logs) {
    const ctxEvolucao = document.getElementById('evolucaoChart');
    if(ctxEvolucao) {
        if(charts.evolucao) charts.evolucao.destroy();
        const recentLogs = logs.slice(0, 10).reverse();
        charts.evolucao = new Chart(ctxEvolucao, {
            type: 'line',
            data: {
                labels: recentLogs.map(l => l.date.slice(11, 16)),
                datasets: [{
                    label: 'Precipitação (mm)',
                    data: recentLogs.map(l => l.precip),
                    borderColor: '#10b981',
                    tension: 0.3,
                    fill: true,
                    backgroundColor: 'rgba(16, 185, 129, 0.05)'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

// ----------------------------------------------------
// 2. RENDERIZAÇÃO DAS TABELAS (A SOLUÇÃO DO BUG)
// ----------------------------------------------------
function renderTables() {
    // 2.1 Tabela de Estações (Gestão de Sistemas)
    const tbodyStas = document.querySelector('#table-stations tbody');
    if (tbodyStas) {
        const stations = getDB(DB.STAS);
        tbodyStas.innerHTML = stations.map(st => `
            <tr>
                <td>${st.id}</td>
                <td><strong>${st.name}</strong></td>
                <td>${st.region}</td>
                <td style="font-family: monospace;">${st.mac || 'N/A'}</td>
                <td>${st.quota} mm</td>
                <td>${st.cam ? '<span style="color: var(--color-green)">Ativa</span>' : '<span style="color: var(--text-muted)">Inativa</span>'}</td>
                <td class="admin-only">
                    <button class="btn btn-danger" style="padding: 4px 8px;" onclick="deleteStation(${st.id})" title="Excluir Estação"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    // 2.2 Tabela de Usuários (Controle RBAC)
    const tbodyUsers = document.querySelector('#table-users tbody');
    if (tbodyUsers) {
        const users = getDB(DB.USRS);
        tbodyUsers.innerHTML = users.map(u => `
            <tr>
                <td><strong>${u.name}</strong></td>
                <td>${u.email}</td>
                <td><span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px;">${u.role}</span></td>
                <td>${u.allowedStations === 'all' ? 'Acesso Total (Admin)' : (u.allowedStations.length + ' estações permitidas')}</td>
                <td>
                    <button class="btn btn-danger" style="padding: 4px 8px;" onclick="deleteUser(${u.id})" title="Revogar Acesso"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    // 2.3 Grid de Ordens de Serviço (Manutenção)
    const osContainer = document.getElementById('os-container');
    if (osContainer) {
        const osList = getDB(DB.OS);
        if (osList.length === 0) {
            osContainer.innerHTML = '<p style="color: var(--text-muted); width: 100%;">Nenhuma ordem de serviço pendente.</p>';
        } else {
            osContainer.innerHTML = osList.map(os => `
                <div class="os-card ${os.severity}">
                    <h4 style="color:var(--text-white); margin-bottom: 5px;">${os.station}</h4>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:10px;">${os.issue}</p>
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem;">
                        <span style="color:var(--color-blue-gray)"><i class="ph ph-calendar"></i> ${os.date}</span>
                        <strong style="color: ${os.severity === 'critical' ? 'var(--color-red)' : 'var(--color-yellow)'}; text-transform: uppercase;">${os.status}</strong>
                    </div>
                </div>
            `).join('');
        }
    }

    // 2.4 Tabela de Histórico / Alertas
    const tbodyLogs = document.querySelector('#table-logs tbody');
    if (tbodyLogs) {
        const logs = getDB(DB.LOGS).slice(0, 50); // Mostra só os 50 mais recentes
        tbodyLogs.innerHTML = logs.map(l => `
            <tr>
                <td>${l.date}</td>
                <td><strong>${l.station}</strong></td>
                <td style="color: ${l.status==='Interditado' ? 'var(--color-red)' : (l.status==='Alerta' ? 'var(--color-yellow)' : 'var(--color-green)')}; font-weight: 700;">${l.status}</td>
                <td>${l.precip} mm</td>
                <td><i class="ph ph-check-circle" style="color: var(--color-green);"></i> Concluída</td>
            </tr>
        `).join('');
    }
}

// Funções globais para os botões de excluir funcionarem
window.deleteStation = function(id) {
    if(!confirm("ALERTA: Tem certeza que deseja remover esta estação do sistema?")) return;
    let stations = getDB(DB.STAS);
    stations = stations.filter(s => s.id !== id);
    setDB(DB.STAS, stations);
    renderTables();
    renderDashboard(); 
};

window.deleteUser = function(id) {
    if(!confirm("ALERTA: Tem certeza que deseja revogar o acesso deste servidor?")) return;
    let users = getDB(DB.USRS);
    users = users.filter(u => u.id !== id);
    setDB(DB.USRS, users);
    renderTables();
};

// ----------------------------------------------------
// 3. LÓGICA DOS BOTÕES E MODAIS
// ----------------------------------------------------
function setupModals() {
    const globalModal = document.getElementById('global-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    const closeModal = () => globalModal.classList.remove('active');

    // Botão Nova Estação
    const btnNewStation = document.getElementById('btn-new-station');
    if(btnNewStation) {
        btnNewStation.addEventListener('click', () => {
            modalTitle.innerText = "Cadastrar Nova Estação";
            const tpl = document.getElementById('tpl-station-form').content.cloneNode(true);
            modalBody.innerHTML = '';
            modalBody.appendChild(tpl);
            globalModal.classList.add('active');

            document.getElementById('form-station-submit').addEventListener('submit', (e) => {
                e.preventDefault();
                const stations = getDB(DB.STAS);
                stations.push({
                    id: Date.now(),
                    name: document.getElementById('st-name').value,
                    region: document.getElementById('st-region').value,
                    lat: parseFloat(document.getElementById('st-lat').value),
                    lon: parseFloat(document.getElementById('st-lon').value),
                    quota: parseInt(document.getElementById('st-quota').value),
                    mac: document.getElementById('st-mac').value || '',
                    calib: document.getElementById('st-calib').value || '',
                    cam: document.getElementById('st-cam').value || ''
                });
                
                setDB(DB.STAS, stations);
                alert("Estação provisionada com sucesso!");
                closeModal();
                window.dispatchEvent(new Event('telemetryUpdated'));
            });
        });
    }

    // Botão Novo Usuário
    const btnNewUser = document.getElementById('btn-new-user');
    if(btnNewUser) {
        btnNewUser.addEventListener('click', () => {
            modalTitle.innerText = "Provisionar Novo Acesso (RBAC)";
            const tpl = document.getElementById('tpl-user-form').content.cloneNode(true);
            
            // Popula os checkboxes de permissões de estações
            const containerStations = tpl.querySelector('#usr-stations-container');
            const stations = getDB(DB.STAS);
            stations.forEach(st => {
                containerStations.innerHTML += `
                    <label class="checkbox-label">
                        <input type="checkbox" value="${st.id}" class="station-cb"> ${st.name}
                    </label>
                `;
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

            document.getElementById('form-user-submit').addEventListener('submit', (e) => {
                e.preventDefault();
                
                // Pega as estações marcadas
                let allowed = [];
                if (document.getElementById('usr-role').value === 'Admin') {
                    allowed = 'all';
                } else {
                    const cbs = document.querySelectorAll('.station-cb:checked');
                    cbs.forEach(cb => allowed.push(parseInt(cb.value)));
                }

                const users = getDB(DB.USRS);
                users.push({
                    id: Date.now(),
                    name: document.getElementById('usr-name').value,
                    email: document.getElementById('usr-email').value,
                    pass: document.getElementById('usr-pass').value,
                    role: document.getElementById('usr-role').value,
                    allowedStations: allowed
                });
                
                setDB(DB.USRS, users);
                alert("Acesso de Servidor registrado com sucesso!");
                closeModal();
                renderTables(); // Atualiza a tabela na hora
            });
        });
    }

    // Botão Nova OS
    const btnNewOS = document.getElementById('btn-new-os');
    if(btnNewOS) {
        btnNewOS.addEventListener('click', () => {
            modalTitle.innerText = "Abrir Ordem de Serviço";
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

            document.getElementById('form-os-submit').addEventListener('submit', (e) => {
                e.preventDefault();
                
                const osList = getDB(DB.OS);
                osList.push({
                    id: Date.now(),
                    station: document.getElementById('os-station').value,
                    issue: document.getElementById('os-issue').value,
                    status: 'Open',
                    date: new Date().toLocaleDateString('pt-BR'),
                    severity: document.getElementById('os-severity').value
                });
                
                setDB(DB.OS, osList);
                alert("O.S. registrada no sistema e despachada para a equipe!");
                closeModal();
                renderTables(); // Atualiza a tabela na hora
            });
        });
    }
}

// ----------------------------------------------------
// 4. RESPONSIVIDADE E NAVEGAÇÃO
// ----------------------------------------------------
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
