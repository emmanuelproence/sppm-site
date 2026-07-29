// app/js/auth.js
import { auth, database, DB, getDB, setDB } from './firebase.js';

export let currentUser = null;

export function initAuth() {
    // Fica escutando se alguém fez login no Google
    auth.onAuthStateChanged(user => {
        if (user) {
            checkUserRole(user.email);
        } else {
            showLogin(true);
        }
    });

    // Ação do Botão de Login
    document.getElementById('btn-login').addEventListener('click', () => {
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-pass').value.trim();
        const btn = document.getElementById('btn-login');
        
        btn.innerText = "Autenticando...";
        const errorMsg = document.getElementById('login-error');
        if(errorMsg) errorMsg.style.display = 'none';
        
        auth.signInWithEmailAndPassword(email, pass)
            .catch(err => {
                console.error("Erro no Auth:", err);
                if(errorMsg) {
                    errorMsg.style.display = 'block';
                    errorMsg.innerText = 'Credenciais inválidas ou conta não existe.';
                }
                btn.innerText = "Acessar Plataforma";
            });
    });

    // Botão de Sair (se existir no HTML)
    const btnLogout = document.getElementById('btn-logout');
    if(btnLogout) {
        btnLogout.addEventListener('click', () => {
            auth.signOut();
            window.location.reload();
        });
    }
}

// Verifica no banco de dados se o e-mail logado tem permissão
function checkUserRole(email) {
    database.ref('sppm/users').once('value').then(snap => {
        const users = snap.val();
        let foundUser = null;
        
        if (users) {
            // Converte pra Array garantindo a leitura
            const usersArray = Array.isArray(users) ? users : Object.values(users);
            // BUSCA BLINDADA: Ignora se a letra está maiúscula ou minúscula no BD
            foundUser = usersArray.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
        }

        if (foundUser) {
            applyLoginUI(foundUser);
        } else {
            auth.signOut();
            alert("Acesso Negado: Usuário sem permissões cadastradas no SPPM OS.");
        }
    }).catch(err => {
        console.warn("Nuvem inacessível, tentando cache local...", err);
        const localUsers = getDB(DB.USRS);
        const foundLocal = localUsers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
        if (foundLocal) applyLoginUI(foundLocal);
    });
}

// Libera a tela principal
export function applyLoginUI(user) {
    currentUser = user;
    showLogin(false);
    
    // Atualiza o crachá do topo
    const nameEl = document.getElementById('user-name-display');
    const roleEl = document.getElementById('user-role-display');
    if(nameEl) nameEl.innerText = user.name || 'Operador';
    if(roleEl) roleEl.innerText = user.role || 'Geral';
    
    // VERIFICAÇÃO DE ADMIN BLINDADA (Ignora erros de digitação no BD)
    const role = user.role ? user.role.toLowerCase() : '';
    const isAdmin = (role === 'admin' || role === 'cto');

    // Mostra as abas secretas na barra lateral só pra quem é Admin
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        el.style.display = isAdmin ? 'flex' : 'none';
    });
    
    // Dispara a interface visual e os mapas
    if (typeof window.setupUI === 'function') window.setupUI();
}

function showLogin(show) {
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
}
