// app/js/ui.js
import { DB, getDB, setDB } from './firebase.js';
import { syncAPI } from './telemetry.js';

let mapInstance = null;
let charts = {};
let editingStationId = null; // Variável para controlar se estamos criando ou editando

// Função central chamada após o Login
window.setupUI = function() {
    injectMobileResponsiveness();
    setupNavigation();
    setupModals();
    setupDashboard(); 
    renderTables(); // Carrega as Tabelas IMEDIATAMENTE
};

// ----------------------------------------------------
// 1. LÓGICA DO DASHBOARD (MAPAS E GRÁFICOS)
// ----------------------------------------------------
function setupDashboard() {
    renderDashboard();
    
    window.addEventListener('telemetryUpdated', () => {
        renderDashboard();
        renderTables();
    });

    window.addEventListener('cloudDataUpdated', () => {
        renderDashboard();
        renderTables();
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

    container.style.minHeight = '350px';

    if(!mapInstance) {
        mapInstance = L.map('map-container').setView([-5.2, -39.3], 7);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(mapInstance);
        window.mapInstance = mapInstance;
        
        setTimeout(() => mapInstance.invalidateSize(), 500);
    }

    mapInstance.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            mapInstance.removeLayer(layer);
        }
    });

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
// 2. RENDERIZAÇÃO DAS TABELAS
// ----------------------------------------------------
function renderTables() {
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
                <td class="admin-only" style="display:flex; gap:5px;">
                    <button class="btn btn-outline" style="padding: 4px 8px;" onclick="editStation(${st.id})" title="Editar Estação"><i class="ph ph-pencil"></i></button>
                    <button class="btn btn-danger" style="padding: 4px 8px;" onclick="deleteStation(${st.id})" title="Excluir Estação"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    const tbodyUsers = document.querySelector('#table-users tbody');
    if (tbodyUsers) {
        const users = getDB(DB.USRS);
        tbodyUsers.innerHTML = users.map(u => {
            let permissoes = '0 estações';
            if (u.allowedStations === 'all') permissoes = 'Acesso Total (Admin)';
            else if (Array.isArray(u.allowedStations)) permissoes = u.allowedStations.length + ' estações permitidas';
            
            return `
            <tr>
                <td><strong>${u.name || 'Usuário'}</strong></td>
                <td>${u.email}</td>
                <td><span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px;">${u.role}</span></td>
                <td>${permissoes}</td>
                <td>
                    <button class="btn btn-danger" style="padding: 4px 8px;" onclick="deleteUser(${u.id})" title="Revogar Acesso"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
            `;
        }).join('');
    }

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

    const tbodyLogs = document.querySelector('#table-logs tbody');
    if (tbodyLogs) {
        const logs = getDB(DB.LOGS).slice(0, 50); 
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

// ----------------------------------------------------
// 3. AÇÕES GLOBAIS (EDITAR E EXCLUIR)
// ----------------------------------------------------
window.deleteStation = function(id) {
    if(!confirm("ALERTA: Tem certeza que deseja remover esta estação do sistema?")) return;
    let stations = getDB(DB.STAS);
    stations = stations.filter(s => s.id !== id);
    setDB(DB.STAS, stations).then(() => {
        renderTables();
        renderDashboard(); 
    });
};

window.deleteUser = function(id) {
    if(!confirm("ALERTA: Tem certeza que deseja revogar o acesso deste servidor?")) return;
    let users = getDB(DB.USRS);
    users = users.filter(u => u.id !== id);
    setDB(DB.USRS, users).then(() => {
        renderTables();
    });
};

window.editStation = function(id) {
    editingStationId = id; // Marca que estamos editando
    const stations = getDB(DB.STAS);
    const station = stations.find(s => s.id === id);
    if(!station) return;

    const globalModal = document.getElementById('global-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.innerText = "Editar Estação";
    const tpl = document.getElementById('tpl-station-form').content.cloneNode(true);
    modalBody.innerHTML = '';
    modalBody.appendChild(tpl);

    // Preenche os campos com os dados existentes
    document.getElementById('st-name').value = station.name;
    document.getElementById('st-region').value = station.region;
    document.getElementById('st-lat').value = station.lat;
    document.getElementById('st-lon').value = station.lon;
    document.getElementById('st-quota').value = station.quota;
    document.getElementById('st-mac').value = station.mac || '';
    document.getElementById('st-calib').value = station.calib || '';
    document.getElementById('st-cam').value = station.cam || '';

    // Adiciona o evento de salvar edição
    document.getElementById('form-station-submit').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        let stList = getDB(DB.STAS);
        const index = stList.findIndex(s => s.id === editingStationId);
        
        if (index !== -1) {
            stList[index] = {
                ...stList[index],
                name: document.getElementById('st-name').value,
                region: document.getElementById('st-region').value,
                lat: parseFloat(document.getElementById('st-lat').value),
                lon: parseFloat(document.getElementById('st-lon').value),
                quota: parseInt(document.getElementById('st-quota').value),
                mac: document.getElementById('st-mac').value || '',
                calib: document.getElementById('st-calib').value || '',
                cam: document.getElementById('st-cam').value || ''
            };
        }

        try {
            if(submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Salvando...'; }
            await setDB(DB.STAS, stList);
            alert("Estação atualizada com sucesso!");
            globalModal.classList.remove('active');
            editingStationId = null; // Reseta o estado
            window.dispatchEvent(new Event('telemetryUpdated'));
        } catch (err) {
            alert("Erro ao salvar.");
            if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Salvar'; }
        }
    });

    globalModal.classList.add('active');
};

// ----------------------------------------------------
// 4. LÓGICA DOS BOTÕES E MODAIS DE CRIAÇÃO
// ----------------------------------------------------
function setupModals() {
    const globalModal = document.getElementById('global-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    const closeModal = () => globalModal.classList.remove('active');

    const getSubmitButton = (form) => form.querySelector('button[type="submit"]');

    const btnNewStation = document.getElementById('btn-new-station');
    if(btnNewStation) {
        btnNewStation.addEventListener('click', () => {
            editingStationId = null; // Garante que é criação nova
            modalTitle.innerText = "Cadastrar Nova Estação";
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
                    name: document.getElementById('st-name').value,
                    region: document.getElementById('st-region').value,
                    lat: parseFloat(document.getElementById('st-lat').value),
                    lon: parseFloat(document.getElementById('st-lon').value),
                    quota: parseInt(document.getElementById('st-quota').value),
                    mac: document.getElementById('st-mac').value || '',
                    calib: document.getElementById('st-calib').value || '',
                    cam: document.getElementById('st-cam').value || ''
                });

                try {
                    if(submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Salvando...'; }
                    await setDB(DB.STAS, stations); 
                    alert("Estação provisionada com sucesso!");
                    closeModal();
                    window.dispatchEvent(new Event('telemetryUpdated')); 
                } catch (err) {
                    alert("Não foi possível salvar a estação na nuvem.");
                    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Salvar'; }
                }
            });
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

            const form = document.getElementById('form-user-submit');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const submitBtn = getSubmitButton(form);
                const roleVal = document.getElementById('usr-role').value;

                let allowedStations = 'all';
                if (roleVal !== 'Admin') {
                    // Se precisar escolher estações depois, a lógica entra aqui
                    allowedStations = [];
                }

                const users = getDB(DB.USRS);
                users.push({
                    id: Date.now(),
                    name: document.getElementById('usr-name').value,
                    email: document.getElementById('usr-email').value,
                    pass: document.getElementById('usr-pass').value,
                    role: roleVal,
                    allowedStations: allowedStations
                });

                try {
                    if(submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Salvando...'; }
                    await setDB(DB.USRS, users); 
                    alert("Acesso de Servidor registrado com sucesso! Lembre-se de registrar este email/senha na aba 'Authentication' do Firebase.");
                    closeModal();
                    renderTables();
                } catch (err) {
                    alert("Não foi possível salvar o usuário na nuvem.");
                    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Salvar'; }
                }
            });
        });
    }

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
                    if(submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Salvando...'; }
                    await setDB(DB.OS, osList);
                    alert("O.S. registrada no sistema e despachada para a equipe!");
                    closeModal();
                    renderTables();
                } catch (err) {
                    alert("Não foi possível registrar a O.S. na nuvem.");
                    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Salvar'; }
                }
            });
        });
    }
}

// ----------------------------------------------------
// 5. RESPONSIVIDADE E NAVEGAÇÃO
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
