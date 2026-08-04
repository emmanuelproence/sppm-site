// app/js/auth.js
import { auth, database, DB, getDB } from './firebase.js';

export let currentUser = null;

export function initAuth() {
    auth.onAuthStateChanged(user => {
        if (user) {
            checkUserRole(user.email);
        } else {
            showLogin(true);
        }
    });

    // BLINDAGEM DO FORMULÁRIO: Captura tanto o clique quanto a tecla ENTER
    const formLogin = document.getElementById('form-login');
    const btnLogin = document.getElementById('btn-login-submit');
    
    if(formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault(); // <-- A MÁGICA: Impede a página de recarregar sozinha
            
            const email = document.getElementById('login-user').value.trim();
            const pass = document.getElementById('login-pass').value.trim();
            const errorMsg = document.getElementById('login-error');
            
            if(btnLogin) btnLogin.innerHTML = '<i class="ph ph-spinner" style="animation: spin 1s infinite;"></i> Autenticando...';
            if(errorMsg) errorMsg.style.display = 'none';
            
            auth.signInWithEmailAndPassword(email, pass)
                .catch(err => {
                    console.error("Erro no Auth do Firebase:", err);
                    if(errorMsg) {
                        errorMsg.innerText = "Acesso Negado. Credenciais inválidas.";
                        errorMsg.style.display = 'block';
                    }
                    if(btnLogin) btnLogin.innerHTML = 'Acessar Sistema';
                });
        });
    }

    // Lógica do botão Sair (Logout)
    const btnLogout = document.getElementById('btn-logout');
    if(btnLogout) {
        btnLogout.addEventListener('click', () => {
            auth.signOut().then(() => {
                window.location.reload();
            });
        });
    }
}

function checkUserRole(email) {
    const cleanEmail = email.trim().toLowerCase();

    database.ref('sppm/users').once('value').then(snap => {
        const users = snap.val();
        let foundUser = null;
        
        if (users) {
            const usersArray = Array.isArray(users) ? users : Object.values(users);
            foundUser = usersArray.find(u => u.email && u.email.trim().toLowerCase() === cleanEmail);
        }

        if (foundUser) {
            applyLoginUI(foundUser);
        } else {
            auth.signOut();
            alert("Acesso Negado: O e-mail '" + cleanEmail + "' não possui permissões no SPPM OS.");
            const btnLogin = document.getElementById('btn-login-submit');
            if(btnLogin) btnLogin.innerHTML = 'Acessar Sistema';
        }
    }).catch(err => {
        console.warn("Nuvem inacessível, tentando cache...", err);
        const localUsers = getDB(DB.USRS);
        const foundLocal = localUsers.find(u => u.email && u.email.trim().toLowerCase() === cleanEmail);
        if (foundLocal) {
            applyLoginUI(foundLocal);
        } else {
            const btnLogin = document.getElementById('btn-login-submit');
            if(btnLogin) btnLogin.innerHTML = 'Acessar Sistema';
        }
    });
}

export function applyLoginUI(user) {
    currentUser = user;
    showLogin(false);
    
    const nameEl = document.getElementById('active-user-name');
    const roleEl = document.getElementById('active-user-role');
    if(nameEl) nameEl.innerText = user.name || 'Operador';
    if(roleEl) roleEl.innerText = user.role || 'Geral';
    
    const role = user.role ? user.role.toLowerCase() : '';
    const isAdmin = (role === 'admin' || role === 'cto');

    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        el.style.display = isAdmin ? 'flex' : 'none';
    });
    
    // Inicia a interface gráfica e o dashboard do ui.js
    if (typeof window.setupUI === 'function') {
        window.setupUI();
    } else {
        console.error("ERRO GRAVE: A função window.setupUI não foi encontrada. O arquivo ui.js falhou ao carregar.");
    }
}

function showLogin(show) {
    const loginScreen = document.getElementById('login-screen');
    const appLayout = document.getElementById('app-layout');
    
    if (loginScreen) loginScreen.style.display = show ? 'flex' : 'none';
    if (appLayout) appLayout.style.display = show ? 'none' : 'flex';
    
    // Desliga a tela preta de "Sincronizando com a Nuvem..."
    const loadingOverlay = document.getElementById('loading-overlay');
    if(loadingOverlay) loadingOverlay.style.display = 'none';
}
