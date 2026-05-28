// Configuración global de Chart.js para que coincida con el Tema Oscuro
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(22, 27, 39, 0.95)';
Chart.defaults.plugins.tooltip.titleColor = '#f1f5f9';
Chart.defaults.plugins.tooltip.bodyColor = '#94a3b8';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;

document.addEventListener('DOMContentLoaded', () => {
    initEstadisticas();
});

async function initEstadisticas() {
    try {
        // 1. Obtener datos reales desde la API de tu backend
        const [albumRes, repetidasRes, diccRes] = await Promise.all([
            fetch('/api/album'),
            fetch('/api/laminas'),
            fetch('/api/diccionario')
        ]);

        if (!albumRes.ok || !repetidasRes.ok || !diccRes.ok) {
            throw new Error('Error al obtener datos de la API');
        }

        const albumData = await albumRes.json();
        const repetidasData = await repetidasRes.json();
        const diccionario = await diccRes.json();

        // 2. Calcular total dinámico de láminas del álbum según el diccionario
        let totalLaminasMundial = 0;
        for (let prefijo in diccionario) {
            totalLaminasMundial += diccionario[prefijo].max;
            if (diccionario[prefijo].extra) {
                totalLaminasMundial += diccionario[prefijo].extra.length;
            }
        }
        if (totalLaminasMundial === 0) totalLaminasMundial = 682; // Fallback de seguridad

        // 3. Calcular KPIs en base a los arrays devueltos por tus endpoints
        const laminasPegadas = albumData.length;
        const faltantes = totalLaminasMundial - laminasPegadas;
        const porcentajeProgreso = totalLaminasMundial > 0 ? ((laminasPegadas / totalLaminasMundial) * 100).toFixed(1) : 0;
        
        // El endpoint /api/laminas devuelve [{codigo, pais, cantidad}, ...]
        const totalRepetidas = repetidasData.reduce((acc, lamina) => acc + lamina.cantidad, 0);

        // 4. Actualizar el HTML con los KPIs
        document.getElementById('kpi-progreso').innerText = `${porcentajeProgreso}%`;
        document.getElementById('kpi-pegadas').innerText = laminasPegadas;
        document.getElementById('kpi-repetidas').innerText = totalRepetidas;
        document.getElementById('kpi-faltantes').innerText = faltantes;

        // 5. Agrupar datos por País para armar el "Top 5 Equipos"
        let equiposCounts = {};
        albumData.forEach(lamina => {
            // Utilizamos el nombre del país guardado directamente por el backend
            const pais = lamina.pais || 'Desconocido';
            equiposCounts[pais] = (equiposCounts[pais] || 0) + 1;
        });

        // Ordenar de mayor a menor y tomar solo los primeros 5
        const topEquipos = Object.entries(equiposCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        const topLabels = topEquipos.map(e => e[0]);
        const topData = topEquipos.map(e => e[1]);

        // 6. Renderizar Gráfico de Dona (Progreso General)
        const ctxProgreso = document.getElementById('progresoChart').getContext('2d');
        new Chart(ctxProgreso, {
            type: 'doughnut',
            data: {
                labels: ['Pegadas', 'Faltantes'],
                datasets: [{
                    data: [laminasPegadas, faltantes],
                    backgroundColor: ['#3b82f6', '#1e2636'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
                }
            }
        });

        // 7. Renderizar Gráfico de Barras (Top Equipos)
        const ctxEquipos = document.getElementById('equiposChart').getContext('2d');
        new Chart(ctxEquipos, {
            type: 'bar',
            data: {
                labels: topLabels.length > 0 ? topLabels : ['Aún no hay datos'],
                datasets: [{
                    label: 'Láminas Pegadas',
                    data: topData.length > 0 ? topData : [0],
                    backgroundColor: '#22c55e',
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { stepSize: 1 } 
                    },
                    x: { grid: { display: false } }
                }
            }
        });

        // 8. Generar Textos de Curiosidades
        renderCuriosidades(laminasPegadas, totalRepetidas, topEquipos);

    } catch (error) {
        console.error('Error al generar estadísticas:', error);
        document.getElementById('curiosidadesList').innerHTML = 
            '<li class="loading-text" style="color: #ef4444;">⚠️ Hubo un problema al conectar con el servidor para cargar las estadísticas.</li>';
    }
}

// Lógica para mostrar textos dinámicos basados en la recolección
function renderCuriosidades(pegadas, repetidas, topEquipos) {
    const list = document.getElementById('curiosidadesList');
    list.innerHTML = ''; // Limpiar lista
    
    // Curiosidad 1
    const li1 = document.createElement('li');
    li1.innerHTML = `💡 Has recolectado en total <b>${pegadas + repetidas}</b> láminas sumando las pegadas y tus repetidas.`;
    list.appendChild(li1);

    // Curiosidad 2
    const li2 = document.createElement('li');
    if (topEquipos.length > 0) {
        li2.innerHTML = `🏆 Tu equipo con mejor progreso es <b>${topEquipos[0][0]}</b> con ${topEquipos[0][1]} láminas en el álbum.`;
    } else {
        li2.innerHTML = `🏆 Aún no has pegado láminas en ningún equipo. ¡Es hora de empezar a abrir sobres!`;
    }
    list.appendChild(li2);

    // Curiosidad 3
    const li3 = document.createElement('li');
    const ratio = pegadas > 0 ? (repetidas / pegadas).toFixed(2) : 0;
    if (ratio > 0.5) {
        li3.innerHTML = `🔥 Tienes una gran cantidad de repetidas (Ratio: ${ratio} por cada lámina pegada). ¡Es un gran momento para intercambiar!`;
    } else {
        li3.innerHTML = `✨ Tienes mucha suerte, la mayoría de tus láminas han ido directamente al álbum y tienes pocas repetidas.`;
    }
    list.appendChild(li3);
}