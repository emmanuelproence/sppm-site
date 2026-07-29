// js/telemetry.js
import { DB, getDB, setDB } from './firebase.js';
import { currentUser } from './auth.js';

function getLocalTime() { 
    const now = new Date(); 
    return new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0,19).replace('T',' '); 
}

export function getScopedStations() {
    const allStas = getDB(DB.STAS);
    if(!currentUser || currentUser.role === 'Admin' || currentUser.allowedStations === 'all') return allStas;
    return allStas.filter(s => currentUser.allowedStations.includes(s.id));
}

export async function syncAPI() {
    const allStas = getDB(DB.STAS); 
    let logs = getDB(DB.LOGS); 
    let os = getDB(DB.OS);
    const currentTime = getLocalTime();
    
    for(let st of allStas) {
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${st.lat}&longitude=${st.lon}&current=precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m`);
            if(!res.ok) throw new Error("Offline");
            const data = (await res.json()).current;
            
            let status = "Normal";
            if(data.precipitation > 0 && data.precipitation < st.quota) status = "Alerta"; 
            else if(data.precipitation >= st.quota) status = "Interditado";
            
            logs.unshift({ id: Date.now()+Math.random(), date: currentTime, station: st.name, status: status, precip: data.precipitation, temp: data.temperature_2m, hum: data.relative_humidity_2m, wind: data.wind_speed_10m });
            
            // Simulação de IA/Anomalia
            if(data.wind_speed_10m > 40 || Math.random() < 0.05) { 
                if(!os.find(x=>x.station === st.name && x.status === 'Open')) {
                    os.push({ id: Date.now(), station: st.name, issue: 'Anomalia Física / Descalibração JSN', status: 'Open', date: new Date().toLocaleDateString('pt-BR'), severity: 'warning' }); 
                }
            }
        } catch(e) {
            if(!os.find(x=>x.station === st.name && x.status === 'Open')) {
                os.push({ id: Date.now(), station: st.name, issue: 'Queda de Sinal (RTSP/MQTT)', status: 'Open', date: new Date().toLocaleDateString('pt-BR'), severity: 'critical' });
            }
        }
    }
    
    // Limita o Data Lake local
    if(logs.length > 3000) logs.length = 3000;
    
    setDB(DB.LOGS, logs); 
    setDB(DB.OS, os);
    
    // Dispara um evento dizendo "Dados Atualizados!" para que o app.js/ui.js redesenhe o painel
    window.dispatchEvent(new Event('telemetryUpdated'));
}

export function exportCSV() {
    const myStasNames = getScopedStations().map(s => s.name); 
    const logs = getDB(DB.LOGS).filter(l => myStasNames.includes(l.station)); 
    if(!logs.length) return alert("Dataset Vazio para o seu Escopo.");
    
    let csv = "DataHora,Ponto_Monitoramento,Status_Cancela,Chuva_mm,Temperatura_C,Umidade_Relativa,Vento_kmh\n";
    logs.forEach(l => csv += `${l.date},${l.station},${l.status},${l.precip},${l.temp},${l.hum},${l.wind}\n`);
    
    const a = document.createElement('a'); 
    a.href = window.URL.createObjectURL(new Blob([csv], {type: 'text/csv'})); 
    a.download = `SPPM_Dataset_${new Date().getTime()}.csv`; 
    a.click();
}