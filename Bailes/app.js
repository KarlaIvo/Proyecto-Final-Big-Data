// Configuración y variables globales
const models = {
    campeche: {
        name: "Baile Campeche",
        path: "./campeche/",
        url: "./campeche/"
    },
    polkas: {
        name: "Polkas",
        path: "./polkas/",
        url: "./polkas/"
    },
    Artesa: {
        name: "Artesa",
        path: "./Artesa/",
        url: "./Artesa/"
    },
    Costa_chica: {
        name: "Costa Chica",
        path: "./Costa_chica/",
        url: "./Costa_chica/"
    } ,
    Huapangos_slp: {
        name: "Huapangos SLP",
        path: "./Huapangos_slp/",
        url: "./Huapangos_slp/"
    },
    Huapangos_v: {
        name: "Huapangos V",
        path: "./Huapangos_v/",
        url: "./Huapangos_v/"
    },
    Tlacotlalpan: {
        name: "Tlacotlalpan",
        path: "./Tlacotlalpan/",
        url: "./Tlacotlalpan/"
    }

};

let currentModel = 'campeche';
let model, webcam, ctx, labelContainer, maxPredictions;
let isRunning = false;

// Elementos del DOM
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const currentModelDiv = document.getElementById('currentModel');
const currentModelNameSpan = document.getElementById('currentModelName');

// Función para seleccionar modelo
function selectModel(modelKey) {
    if (isRunning) {
        alert('Por favor, detén la cámara antes de cambiar de modelo');
        return;
    }
    
    currentModel = modelKey;
    
    // Actualizar botones activos
    document.querySelectorAll('.model-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.model === modelKey) {
            btn.classList.add('active');
        }
    });
    
    // Actualizar texto del modelo actual
    currentModelDiv.innerHTML = `Modelo actual: <strong>${models[modelKey].name}</strong>`;
    currentModelNameSpan.textContent = models[modelKey].name;
    
    // Limpiar predicciones anteriores
    clearPredictions();
    
    updateStatus(`Modelo cambiado a: ${models[modelKey].name}. Presiona "Iniciar Cámara"`, 'ready');
    
    console.log(`Modelo seleccionado: ${models[modelKey].name}`);
}

// Función principal de inicialización
async function init() {
    try {
        const selectedModel = models[currentModel];
        
        updateStatus(`Cargando modelo: ${selectedModel.name}...`, 'loading');
        startBtn.disabled = true;
        
        // Detener cámara si está activa
        if (webcam && isRunning) {
            await stopWebcam();
        }
        
        // Cargar el modelo seleccionado
        const modelURL = selectedModel.url + "model.json";
        const metadataURL = selectedModel.url + "metadata.json";
        
        model = await tmPose.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();
        
        updateStatus('Configurando cámara...', 'loading');
        
        // Configurar webcam
        const size = 400;
        const flip = true;
        webcam = new tmPose.Webcam(size, size, flip);
        await webcam.setup();
        await webcam.play();
        
        // Configurar canvas
        const canvas = document.getElementById("canvas");
        canvas.width = size;
        canvas.height = size;
        ctx = canvas.getContext("2d");
        
        // Configurar contenedor de etiquetas
        setupPredictionsContainer();
        
        isRunning = true;
        stopBtn.disabled = false;
        updateStatus(`✅ ${selectedModel.name} - Cámara activa`, 'ready');
        
        // Iniciar loop de predicción
        window.requestAnimationFrame(loop);
        
    } catch (error) {
        console.error('Error al inicializar:', error);
        updateStatus('❌ Error: ' + error.message, 'error');
        startBtn.disabled = false;
    }
}

// Configurar contenedor de predicciones
function setupPredictionsContainer() {
    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = ''; // Limpiar contenedor
    
    for (let i = 0; i < maxPredictions; i++) {
        const predictionElement = document.createElement('div');
        predictionElement.className = 'prediction-item';
        predictionElement.innerHTML = `
            <div class="prediction-label">
                <span class="prediction-name">Cargando...</span>
                <span class="prediction-percentage">0%</span>
            </div>
            <div class="prediction-bar-container">
                <div class="prediction-bar" style="width: 0%"></div>
            </div>
        `;
        labelContainer.appendChild(predictionElement);
    }
}

// Loop principal de predicción
async function loop() {
    if (!isRunning) return;
    
    webcam.update();
    await predict();
    window.requestAnimationFrame(loop);
}

// Función de predicción
async function predict() {
    try {
        // Estimación de pose
        const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
        
        // Clasificación
        const prediction = await model.predict(posenetOutput);
        
        // Actualizar interfaz con predicciones
        for (let i = 0; i < maxPredictions; i++) {
            const probability = prediction[i].probability;
            const percentage = Math.round(probability * 100);
            
            const predictionElement = labelContainer.childNodes[i];
            const nameSpan = predictionElement.querySelector('.prediction-name');
            const percentageSpan = predictionElement.querySelector('.prediction-percentage');
            const barElement = predictionElement.querySelector('.prediction-bar');
            
            nameSpan.textContent = prediction[i].className;
            percentageSpan.textContent = percentage + '%';
            barElement.style.width = percentage + '%';
            
            // Cambiar color basado en la confianza
            if (percentage > 80) {
                barElement.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
            } else if (percentage > 50) {
                barElement.style.background = 'linear-gradient(90deg, #FF9800, #FFC107)';
            } else {
                barElement.style.background = 'linear-gradient(90deg, #f44336, #FF5722)';
            }
        }
        
        // Dibujar pose
        drawPose(pose);
        
    } catch (error) {
        console.error('Error en predicción:', error);
    }
}

// Función para dibujar la pose
function drawPose(pose) {
    if (webcam.canvas) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(webcam.canvas, 0, 0);
        
        if (pose) {
            const minPartConfidence = 0.5;
            tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
            tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
        }
    }
}

// Función para detener la cámara
async function stopWebcam() {
    if (webcam) {
        webcam.stop();
        isRunning = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        updateStatus('Cámara detenida. Selecciona un modelo y presiona "Iniciar Cámara"', 'ready');
        
        // Limpiar canvas
        if (ctx) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
        
        clearPredictions();
    }
}

// Limpiar predicciones
function clearPredictions() {
    if (labelContainer) {
        const predictions = labelContainer.querySelectorAll('.prediction-item');
        predictions.forEach(prediction => {
            const percentageSpan = prediction.querySelector('.prediction-percentage');
            const barElement = prediction.querySelector('.prediction-bar');
            const nameSpan = prediction.querySelector('.prediction-name');
            
            nameSpan.textContent = 'Esperando...';
            percentageSpan.textContent = '0%';
            barElement.style.width = '0%';
        });
    }
}

// Función para actualizar el estado
function updateStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status status-${type}`;
}

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    // Seleccionar modelo por defecto
    selectModel('campeche');
});

// Manejar cierre de la página
window.addEventListener('beforeunload', () => {
    if (webcam) {
        webcam.stop();
    }
});

// Manejar errores no capturados
window.addEventListener('error', (event) => {
    console.error('Error global:', event.error);
    updateStatus('❌ Error inesperado: ' + event.error.message, 'error');
});