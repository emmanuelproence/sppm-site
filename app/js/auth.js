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

    const btnLogin = document.getElementById('btn-login-submit');
    if(btnLogin) {
        btnLogin.addEventListener('click', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-user').value.trim();
            const pass = document.getElementById('login-pass').value.trim();
            const errorMsg = document.getElementById('login-error');
            
            btnLogin.innerText = "Autenticando...";
            if(errorMsg) errorMsg.style.display = 'none';
            
            auth.signInWithEmailAndPassword(email, pass)
                .catch(err => {
                    console.error("Erro no Auth:", err);
                    if(errorMsg) {
                        errorMsg.style.display = 'block';
                    }
                    btnLogin.innerText = "Acessar Sistema";
                });
        });
    }

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
    // Limpa espaços invisíveis e joga pra minúsculo (A MÁGICA ESTÁ AQUI)
    const cleanEmail = email.trim().toLowerCase();

    database.ref('sppm/users').once('value').then(snap => {
        const users = snap.val();
        let foundUser = null;
        
        if (users) {
            const usersArray = Array.isArray(users) ? users : Object.values(users);
            // Procura o usuário blindando contra espaços em branco e letras maiúsculas
            foundUser = usersArray.find(u => u.email && u.email.trim().toLowerCase() === cleanEmail);
        }

        if (foundUser) {
            applyLoginUI(foundUser);
        } else {
            auth.signOut();
            alert("Acesso Negado: O e-mail '" + cleanEmail + "' não possui permissões no SPPM OS.");
        }
    }).catch(err => {
        console.warn("Nuvem inacessível, tentando cache...", err);
        const localUsers = getDB(DB.USRS);
        const foundLocal = localUsers.find(u => u.email && u.email.trim().toLowerCase() === cleanEmail);
        if (foundLocal) applyLoginUI(foundLocal);
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
    
    if (typeof window.setupUI === 'function') {
        window.setupUI();
    }
}

function showLogin(show) {
    const loginScreen = document.getElementById('login-screen');
    const appLayout = document.getElementById('app-layout');
    
    if (loginScreen) loginScreen.style.display = show ? 'flex' : 'none';
    if (appLayout) appLayout.style.display = show ? 'none' : 'flex';
}
