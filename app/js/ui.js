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
};

// ----------------------------------------------------
// 1. LÓGICA DO DASHBOARD (MAPAS E GRÁFICOS)
// ----------------------------------------------------
function setupDashboard() {
    renderDashboard();

    // Atualiza a tela automaticamente quando a telemetria baixar dados novos
    window.addEventListener('telemetryUpdated', () => {
        renderDashboard();
    });

    // NOVO: atualiza a tela também quando a nuvem sincroniza em tempo real
    // (inclui as próprias gravações do usuário e mudanças feitas em outro
    // dispositivo/aba). Antes só existia o listener acima, então uma
    // gravação nova só refletia no mapa até a próxima sync sobrescrever
    // o localStorage com dados desatualizados.
    window.addEventListener('cloudDataUpdated', () => {
        renderDashboard();
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
// 2. LÓGICA DOS BOTÕES E SALVAMENTO NO BANCO
// ----------------------------------------------------
function setupModals() {
    const globalModal = document.getElementById('global-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    // Função para fechar o modal
    const closeModal = () => globalModal.classList.remove('active');

    // Helper: pega o botão de submit de um form pra poder travar/destravar
    // durante o salvamento e evitar duplo-clique / clique com gravação em voo.
    const getSubmitButton = (form) => form.querySelector('button[type="submit"], input[type="submit"]');

    // 1. Botão e Formulário de NOVA ESTAÇÃO
    const btnNewStation = document.getElementById('btn-new-station');
    if(btnNewStation) {
        btnNewStation.addEventListener('click', () => {
            modalTitle.innerText = "Cadastrar Nova Estação";
            const tpl = document.getElementById('tpl-station-form').content.cloneNode(true);
            modalBody.innerHTML = '';
            modalBody.appendChild(tpl);
            globalModal.classList.add('active');

            // Cérebro de salvamento:
            const form = document.getElementById('form-station-submit');
            form.addEventListener('submit', async (e) => {
                e.preventDefault(); // Impede a página de recarregar

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
                    await setDB(DB.STAS, stations); // Salva local + nuvem, agora com confirmação real
                    alert("Estação provisionada com sucesso!");
                    closeModal();
                    window.dispatchEvent(new Event('telemetryUpdated')); // Atualiza o mapa na mesma hora
                } catch (err) {
                    alert("Não foi possível salvar a estação na nuvem. Verifique sua conexão/permissões do Firebase e tente novamente.");
                    console.error(err);
                    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Salvar'; }
                }
            });
        });
    }

    // 2. Botão e Formulário de NOVO USUÁRIO
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

            // Cérebro de salvamento:
            const form = document.getElementById('form-user-submit');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const submitBtn = getSubmitButton(form);
                const roleVal = document.getElementById('usr-role').value;

                // ANTES: sempre salvava allowedStations como [] para não-admin,
                // ignorando qualquer checkbox marcado — usuário ficava sem
                // acesso a estação nenhuma. Agora lê os checkboxes marcados,
                // se existirem no template; senão cai em 'all' como antes.
                let allowedStations = 'all';
                if (roleVal !== 'Admin') {
                    const checkboxes = document.querySelectorAll('#container-station-select input[type="checkbox"]:checked');
                    allowedStations = checkboxes.length
                        ? Array.from(checkboxes).map(cb => parseInt(cb.value))
                        : [];
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
                    await setDB(DB.USRS, users); // Salva local + nuvem, agora com confirmação real
                    alert("Acesso de Servidor registrado com sucesso!");
                    closeModal();
                } catch (err) {
                    alert("Não foi possível salvar o usuário na nuvem. Verifique sua conexão/permissões do Firebase e tente novamente.");
                    console.error(err);
                    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Salvar'; }
                }
            });
        });
    }

    // 3. Botão e Formulário de NOVA ORDEM DE SERVIÇO
    const btnNewOS = document.getElementById('btn-new-os');
    if(btnNewOS) {
        btnNewOS.addEventListener('click', () => {
            modalTitle.innerText = "Abrir Ordem de Serviço";
            const tpl = document.getElementById('tpl-os-form').content.cloneNode(true);

            // Popula a caixinha de escolher as estações com as estações reais
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

            // Cérebro de salvamento:
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
                } catch (err) {
                    alert("Não foi possível registrar a O.S. na nuvem. Verifique sua conexão/permissões do Firebase e tente novamente.");
                    console.error(err);
                    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Salvar'; }
                }
            });
        });
    }
}

// ----------------------------------------------------
// 3. RESPONSIVIDADE E NAVEGAÇÃO
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
