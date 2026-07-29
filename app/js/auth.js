// js/auth.js
import { DB, getDB, syncCloudToLocal, auth } from './firebase.js';

export let currentUser = null;

export function setupAuthListeners(bootSystemCallback) {
    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-login-submit');
        btn.innerText = "Autenticando na Nuvem...";
        btn.disabled = true;

        const email = document.getElementById('login-user').value.trim().toLowerCase();
        const password = document.getElementById('login-pass').value.trim();
        
        try {
            // 1. O FIREBASE VALIDA A SENHA CRIPTOGRAFADA (Fim do texto plano!)
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const firebaseUser = userCredential.user;

            // 2. Sincroniza o banco para pegar as permissões (RBAC) do usuário
            await syncCloudToLocal();
            
            // 3. Busca o perfil do usuário no banco de dados para saber se é Admin ou Operador
            const users = getDB(DB.USRS);
            const userProfile = users.find(x => (x.email || "").trim().toLowerCase() === email);
            
            if(userProfile) {
                currentUser = userProfile; 
                sessionStorage.setItem('sppm_active_user', JSON.stringify(userProfile)); 
                applyLoginUI(userProfile); 
                bootSystemCallback(); 
            } else {
                // Usuário autenticado, mas sem perfil criado no painel do sistema
                alert("Usuário sem permissões configuradas no sistema.");
                auth.signOut();
            }
        } catch (error) {
            console.error("Erro no login:", error.code);
            document.getElementById('login-error').style.display = 'block'; 
            document.getElementById('login-error').innerText = "Credenciais inválidas ou conta inexistente.";
        } finally {
            btn.innerText = "Acessar Sistema";
            btn.disabled = false;
        }
    });

    const logoutBtn = document.getElementById('btn-logout');
    if(logoutBtn) logoutBtn.addEventListener('click', logout);
}

export async function checkSession(bootSystemCallback, setupNavigationCallback) {
    document.getElementById('loading-overlay').style.display = 'flex';
    await syncCloudToLocal();
    document.getElementById('loading-overlay').style.opacity = '0';
    setTimeout(()=> document.getElementById('loading-overlay').style.display = 'none', 500);

    setupNavigationCallback(); 
    
    // O Firebase Auth gerencia a sessão automaticamente, mas mantemos o sessionStorage para o RBAC da UI
    auth.onAuthStateChanged((firebaseUser) => {
        if (firebaseUser) {
            const savedSession = sessionStorage.getItem('sppm_active_user');
            if(savedSession) {
                currentUser = JSON.parse(savedSession);
                applyLoginUI(currentUser); 
                bootSystemCallback(); 
            }
        } else {
            document.getElementById('login-screen').style.display = 'flex'; 
        }
    });
}

function applyLoginUI(user) {
    document.getElementById('login-screen').style.display = 'none'; 
    document.getElementById('app-layout').style.display = 'flex';
    document.getElementById('active-user-name').innerText = user.name; 
    document.getElementById('active-user-role').innerText = user.role;
    
    document.querySelectorAll('th.admin-only, td.admin-only').forEach(el => el.style.display = user.role === 'Admin' ? 'table-cell' : 'none');
    document.querySelectorAll('li.admin-only, button.admin-only, .admin-only').forEach(el => { 
        if(el.tagName !== 'TH' && el.tagName !== 'TD') el.style.display = user.role === 'Admin' ? 'flex' : 'none'; 
    });
}

export function logout() { 
    auth.signOut().then(() => {
        sessionStorage.removeItem('sppm_active_user'); 
        currentUser = null;
        document.getElementById('app-layout').style.display = 'none'; 
        document.getElementById('login-screen').style.display = 'flex'; 
        document.getElementById('login-pass').value = ''; 
        window.dispatchEvent(new Event('userLogout'));
    });
}