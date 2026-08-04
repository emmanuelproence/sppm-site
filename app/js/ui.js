// ====================================================
// O CÉREBRO DE SALVAMENTO DE FORMULÁRIOS (100% BLINDADO)
// ====================================================
function setupModals() {
    const globalModal = document.getElementById('global-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModal = () => globalModal.classList.remove('active');
    const getSubmitButton = (form) => form.querySelector('button[type="submit"]');

    // 1. BOTÃO NOVA ESTAÇÃO
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
                
                // Trava-quedas: Garante valores padrão se o campo falhar
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
                    alert("Estação provisionada com sucesso e telemetria meteorológica sincronizada!");
                    closeModal();
                } catch (err) {
                    console.error("Erro no Firebase (Estação):", err);
                    alert("Falha na comunicação com a infraestrutura em nuvem. Veja o console (F12).");
                    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Tentar Novamente'; }
                }
            });
        });
    }

    // 2. BOTÃO NOVO USUÁRIO
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
                    if(submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="ph ph-spinner" style="animation: spin 1s infinite;"></i> Gravando Permissões...'; }
                    await setDB(DB.USRS, users); 
                    alert("Acesso RBAC gravado com sucesso! Lembre-se de registrar este email na aba Authentication do Firebase.");
                    closeModal();
                    renderTables();
                } catch (err) {
                    console.error("Erro no Firebase (Usuário):", err);
                    alert("Falha de autenticação na nuvem. Veja o console (F12).");
                    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Salvar'; }
                }
            });
        });
    }

    // 3. BOTÃO NOVA O.S. (BLINDADO E REVISADO)
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
                    if(btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="ph ph-spinner" style="animation: spin 1s infinite;"></i> Gravando O.S...'; }
                    
                    // Extração blindada dos dados (Evita 'undefined' que trava o Firebase)
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

                    // Grava no Firebase
                    await setDB(DB.OS, osList);
                    
                    alert("O.S. registrada no sistema e despachada para a equipe de campo!");
                    closeModal(); 
                    renderTables(); 
                    
                } catch (err) {
                    console.error("ERRO REAL AO GRAVAR O.S:", err); // Isso te mostra o erro verdadeiro!
                    alert("Erro ao gravar O.S. Pressione F12 e veja o painel 'Console' para descobrir a falha exata.");
                    if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerText = 'Salvar O.S.'; }
                }
            });
        });
    }
}
