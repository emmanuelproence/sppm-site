// app/js/ui.js
import { DB, getDB, setDB } from './firebase.js';
import { syncAPI } from './telemetry.js';

let mapInstance = null;
let charts = {};
let editingStationId = null;

window.setupUI = function() {
    injectMobileResponsiveness();
    setupNavigation();
    setupModals();
    setupDashboard(); 
    renderTables(); 
    setupAIModal(); // Ativa a Câmera Viva
};

function setupDashboard() {
    renderDashboard();
    window.addEventListener('telemetryUpdated', () => { renderDashboard(); renderTables(); });
    window.addEventListener('cloudDataUpdated', () => { renderDashboard(); renderTables(); });

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
        // Satélite de Ultra Resolução como Padrão
        const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri'
        });
        const darkMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');

        mapInstance = L.map('map-container', {
            center: [-5.2, -39.3],
            zoom: 7,
            layers: [satelliteMap] // Satélite ativo de início
        });
        window.mapInstance = mapInstance;

        // Controle para alternar Satélite / Mapa Tático
        L.control.layers({"Satélite Alta Resolução": satelliteMap, "Mapa Tático Escuro": darkMap}).addTo(mapInstance);
        
        // Criando o Botão do Radar Climatológico
        const ClimaControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function () {
                const btn = L.DomUtil.create('button', 'btn btn-primary');
                btn.innerHTML = '<i class="ph ph-cloud-rain" style="font-size: 1.2rem;"></i> Radar Clima';
                btn.style.marginTop = '60px'; 
                btn.style.marginLeft = '10px';
                btn.onclick = (e) => { e.stopPropagation(); openWindyRadar(); };
                return btn;
            }
        });
        mapInstance.addControl(new ClimaControl());

        setTimeout(() => mapInstance.invalidateSize(), 500);
    }

    mapInstance.eachLayer((layer) => {
        if (layer instanceof L.Marker) mapInstance.removeLayer(layer);
    });

    stations.forEach(st => {
        const lastLog = logs.find(l => l.station === st.name);
        const status = lastLog ? lastLog.status : 'Normal';
        let color = '#00e676'; 
        if(status === 'Alerta') color = '#f59e0b'; 
        if(status === 'Interditado') color = '#ff3366'; 

        const circleIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px ${color};"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });

        const popupContent = `
            <div style="text-align: center; color: black;">
                <b>${st.name}</b><br>
                <span>${st.region}</span><br>
                <strong style="color: ${color}; font-size: 1.1rem; text-transform: uppercase;">${status}</strong><br>
                <button onclick="document.getElementById('ai-modal').classList.add('active')" style="margin-top:8px; background: #000; color: #00e676; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; width:100%; font-weight:bold;">Visualizar Câmera IA</button>
            </div>
        `;

        L.marker([st.lat, st.lon], { icon: circleIcon })
          .addTo(mapInstance)
          .bindPopup(popupContent);
    });
}

// Abre o Radar Profissional do Windy por cima do mapa
function openWindyRadar() {
    let wModal = document.getElementById('windy-modal');
    if(!wModal) {
        wModal = document.createElement('div');
        wModal.id = 'windy-modal';
        wModal.className = 'modal-overlay active';
        wModal.innerHTML = `
            <div class="modal-content" style="max-width: 90vw; height: 85vh; padding: 15px; display: flex; flex-direction: column;">
                <div class="modal-header" style="margin-bottom: 10px;">
                    <h3 class="modal-title">Radar Climatológico em Tempo Real (Ceará)</h3>
                    <i class="ph ph-x close-modal" onclick="document.getElementById('windy-modal').classList.remove('active')"></i>
                </div>
                <iframe width="100%" height="100%" src="https://embed.windy.com/embed2.html?lat=-5.2&lon=-39.3&zoom=6&level=surface&overlay=rain&menu=&message=&marker=&calendar=&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1" frameborder="0" style="border-radius: 8px; border: 1px solid var(--border-color);"></iframe>
            </div>
        `;
        document.body.appendChild(wModal);
    } else {
        wModal.classList.add('active');
    }
}

// Injeta o vídeo real de tráfego no Modal de IA
function setupAIModal() {
    const aiModal = document.getElementById('ai-modal');
    if(aiModal) {
        const imgContainer = aiModal.querySelector('div[style*="images.unsplash.com"]');
        if(imgContainer) {
            // Remove a imagem estática e coloca um vídeo real de rodovia em looping
            imgContainer.style.background = '#000';
            imgContainer.innerHTML += `
                <video autoplay loop muted playsinline style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; opacity: 0.7;">
                    <source src="https://cdn.pixabay.com/video/2020/05/24/40090-424855018_tiny.mp4" type="video/mp4">
                </video>
            `;
            // Ajusta o z-index dos elementos por cima do vídeo
            const badges = imgContainer.querySelectorAll('div');
            badges.forEach(b => b.style.zIndex = '2');
        }
    }
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
                    borderColor: '#00e676',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(0, 230, 118, 0.1)'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

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
                    <button class="btn btn-outline" style="padding: 4px 8px;" onclick="editStation('${st.id}')" title="Editar Estação"><i class="ph ph-pencil"></i></button>
                    <button class="btn btn-danger" style="padding: 4px 8px;" onclick="deleteStation('${st.id}')" title="Excluir Estação"><i class="ph ph-trash"></i></button>
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
                    <button class="btn btn-danger" style="padding: 4px 8px;" onclick="deleteUser('${u.id}')" title="Revogar Acesso"><i class="ph ph-trash"></i></button>
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
    stations = stations.filter(s => String(s.id) !== String(id));
    setDB(DB.STAS, stations).then(() => { renderTables(); renderDashboard(); });
};

window.deleteUser = function(id) {
    if(!confirm("ALERTA: Tem certeza que deseja revogar o acesso deste servidor?")) return;
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
            await syncAPI(); // Busca os dados do clima da edição nova imediatamente!
            alert("Estação atualizada com sucesso!");
            globalModal.classList.remove('active');
            editingStationId = null; 
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
            editingStationId = null; 
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
                    if(submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Salvando...'; }
                    await setDB(DB.STAS, stations); 
                    await syncAPI(); // A MÁGICA: Puxa o clima exato da estação recém-criada
                    alert("Estação provisionada e telemetria climática sincronizada!");
                    closeModal();
                } catch (err) {
                    alert("Não foi possível salvar a estação.");
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
                roleSelect.addEventListener('change', (e) => { document.getElementById('container-station-select').style.display = e.target.value === 'Admin' ? 'none' : 'block'; });
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
                    if(submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Salvando...'; }
                    await setDB(DB.USRS, users); 
                    alert("Acesso de Servidor registrado com sucesso!");
                    closeModal();
                    renderTables();
                } catch (err) {
                    alert("Não foi possível salvar o usuário.");
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
                    alert("Não foi possível registrar a O.S.");
                    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Salvar'; }
                }
            });
        });
    }
}

function injectMobileResponsiveness() {
    if(!document.getElementById('sppm-mobile-css')) {
        const style = document.createElement('style');
        style.id = 'sppm-mobile-css';
        style.innerHTML = `@media (max-width: 768px) { .sidebar { position: fixed; left: -100%; top: 0; height: 100vh; z-index: 9999; transition: left 0.3s ease; box-shadow: 5px 0 15px rgba(0,0,0,0.8); width: 260px; } .sidebar.open { left: 0; } .main-content { margin-left: 0 !important; width: 100%; } .grid-layout { display: flex !important; flex-direction: column; gap: 15px; } .card { width: 100% !important; margin: 0; } #map, .leaflet-container { height: 350px !important; } .btn-mobile-menu { display: inline-block !important; background: none; border: none; color: #10b981; font-size: 1.8rem; cursor: pointer; margin-right: 15px; } } @media (min-width: 769px) { .btn-mobile-menu { display: none !important; } }`;
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
