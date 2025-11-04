// Estado da aplicação
let whatsappConnected = false;
let selectedAppointments = new Set();
let appointments = [];

// Elementos DOM
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const whatsappStatus = document.getElementById('whatsapp-status');
const currentModeSpan = document.getElementById('current-mode');
const modeSelector = document.getElementById('mode-selector');
const qrContainer = document.getElementById('qr-container');
const qrImage = document.getElementById('qr-image');
const appointmentsContainer = document.getElementById('appointments-container');
const statsContainer = document.getElementById('stats-container');
const sendBulkBtn = document.getElementById('send-bulk-btn');
const selectedCount = document.getElementById('selected-count');
const customMessage = document.getElementById('custom-message');
const refreshBtn = document.getElementById('refresh-btn');
const selectAllBtn = document.getElementById('select-all-btn');
const testMessageBtn = document.getElementById('test-message-btn');
// On-Prem elements
let onpremRequestBtn, onpremVerifyBtn, onpremCC, onpremPhone, onpremMethod, onpremCert, onpremCode, onpremPin;

// Event Listeners
connectBtn.addEventListener('click', connectWhatsApp);
disconnectBtn.addEventListener('click', disconnectWhatsApp);
modeSelector.addEventListener('change', switchWhatsAppMode);
sendBulkBtn.addEventListener('click', sendBulkMessages);
refreshBtn.addEventListener('click', loadData);
selectAllBtn.addEventListener('click', toggleSelectAll);
testMessageBtn.addEventListener('click', () => {
    new bootstrap.Modal(document.getElementById('testModal')).show();
});

document.getElementById('send-test-btn').addEventListener('click', sendTestMessage);

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    checkWhatsAppStatus();
    
    // Verificar status a cada 5 segundos
    setInterval(checkWhatsAppStatus, 5000);

    // Bind On-Prem elements (rendered in DOM now)
    onpremRequestBtn = document.getElementById('onprem-request-btn');
    onpremVerifyBtn  = document.getElementById('onprem-verify-btn');
    onpremCC         = document.getElementById('onprem-cc');
    onpremPhone      = document.getElementById('onprem-phone');
    onpremMethod     = document.getElementById('onprem-method');
    onpremCert       = document.getElementById('onprem-cert');
    onpremCode       = document.getElementById('onprem-code');
    onpremPin        = document.getElementById('onprem-pin');
    
    if (onpremRequestBtn) onpremRequestBtn.addEventListener('click', requestOnPremCode);
    if (onpremVerifyBtn)  onpremVerifyBtn.addEventListener('click', verifyOnPremCode);
});

// Funções de API
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`/api/messages${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Erro na requisição');
        }
        
        return data;
    } catch (error) {
        console.error('Erro na API:', error);
        showAlert(error.message, 'danger');
        throw error;
    }
}

// WhatsApp Functions
async function connectWhatsApp() {
    connectBtn.disabled = true;
    connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';
    
    try {
        const result = await apiCall('/whatsapp/connect', { method: 'POST' });
        showAlert(result.message, 'success');
        checkWhatsAppStatus();
    } catch (error) {
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<i class="fas fa-plug"></i> Conectar';
    }
}

async function disconnectWhatsApp() {
    try {
        const result = await apiCall('/whatsapp/disconnect', { method: 'POST' });
        showAlert(result.message, 'info');
        checkWhatsAppStatus();
    } catch (error) {
        // Error already handled in apiCall
    }
}

async function switchWhatsAppMode() {
    const newMode = modeSelector.value;
    
    try {
        const result = await apiCall('/whatsapp/mode', {
            method: 'POST',
            body: JSON.stringify({ mode: newMode })
        });
        
        showAlert(result.message, 'success');
        currentModeSpan.textContent = newMode === 'business' ? 'Business API' : 'Web';
        checkWhatsAppStatus();
    } catch (error) {
        // Reverter seleção em caso de erro
        modeSelector.value = modeSelector.value === 'business' ? 'web' : 'business';
    }
}

async function checkWhatsAppStatus() {
    try {
        const status = await apiCall('/whatsapp/status');
        
        whatsappConnected = status.isConnected || status.isConfigured;
        
        // Atualizar modo na interface
        if (status.mode) {
            modeSelector.value = status.mode;
            currentModeSpan.textContent = status.mode === 'business' ? 'Business API' : 'Web';
        }
        
        // Atualizar UI baseado no modo
        if (status.mode === 'business') {
            // Modo Business API
            if (status.isConfigured) {
                whatsappStatus.innerHTML = '<span class="status-connected"><i class="fas fa-circle"></i> Business API Ativo</span>';
                connectBtn.disabled = true;
                disconnectBtn.disabled = false;
                sendBulkBtn.disabled = selectedAppointments.size === 0;
                qrContainer.style.display = 'none';
            } else {
                whatsappStatus.innerHTML = '<span class="status-disconnected"><i class="fas fa-circle"></i> Business API - Configure credenciais</span>';
                connectBtn.disabled = false;
                disconnectBtn.disabled = true;
                sendBulkBtn.disabled = true;
                qrContainer.style.display = 'none';
            }
        } else {
            // Modo Web (original)
            if (status.isConnected) {
                whatsappStatus.innerHTML = '<span class="status-connected"><i class="fas fa-circle"></i> WhatsApp Web Conectado</span>';
                connectBtn.disabled = true;
                disconnectBtn.disabled = false;
                sendBulkBtn.disabled = selectedAppointments.size === 0;
                qrContainer.style.display = 'none';
            } else if (status.hasQRCode && status.qrCode) {
                whatsappStatus.innerHTML = '<span class="status-waiting"><i class="fas fa-circle"></i> Aguardando QR Code</span>';
                qrImage.src = status.qrCode;
                qrContainer.style.display = 'block';
                connectBtn.disabled = true;
                disconnectBtn.disabled = false;
                sendBulkBtn.disabled = true;
            } else {
                whatsappStatus.innerHTML = '<span class="status-disconnected"><i class="fas fa-circle"></i> WhatsApp Web Desconectado</span>';
                connectBtn.disabled = false;
                disconnectBtn.disabled = true;
                sendBulkBtn.disabled = true;
                qrContainer.style.display = 'none';
            }
        }
        
        connectBtn.innerHTML = '<i class="fas fa-plug"></i> Conectar';
        
    } catch (error) {
        whatsappStatus.innerHTML = '<span class="status-disconnected"><i class="fas fa-circle"></i> Erro</span>';
    }
}

// Data Loading Functions
async function loadData() {
    showLoading(true);
    try {
        await Promise.all([
            loadAppointments(),
            loadStats()
        ]);
    } catch (error) {
        // Errors handled in individual functions
    } finally {
        showLoading(false);
    }
}

async function loadAppointments() {
    try {
        const result = await apiCall('/appointments/pending');
        appointments = result.data;
        renderAppointments();
    } catch (error) {
        appointmentsContainer.innerHTML = '<p class="text-danger">Erro ao carregar agendamentos</p>';
    }
}

async function loadStats() {
    try {
        const result = await apiCall('/appointments/stats');
        const stats = result.data;
        
        statsContainer.innerHTML = `
            <div class="small">
                <div><strong>Total:</strong> ${stats.total}</div>
                <div><strong>Confirmados:</strong> ${stats.confirmed}</div>
                <div class="text-warning"><strong>Pendentes:</strong> ${stats.pending}</div>
            </div>
        `;
    } catch (error) {
        statsContainer.innerHTML = '<small class="text-danger">Erro ao carregar</small>';
    }
}

// Render Functions
function renderAppointments() {
    if (appointments.length === 0) {
        appointmentsContainer.innerHTML = '<p class="text-muted">Nenhum agendamento pendente encontrado.</p>';
        return;
    }
    
    const html = appointments.map(appointment => {
        const date = new Date(appointment.tratamento_date);
        const formattedDate = date.toLocaleDateString('pt-BR');
        const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const isSelected = selectedAppointments.has(appointment.id);
        
        return `
            <div class="appointment-card card mb-2">
                <div class="card-body p-3">
                    <div class="row align-items-center">
                        <div class="col-md-1">
                            <input type="checkbox" class="form-check-input appointment-checkbox" 
                                value="${appointment.id}" ${isSelected ? 'checked' : ''}>
                        </div>
                        <div class="col-md-3">
                            <strong>${appointment.patient_name}</strong><br>
                            <small class="text-muted">${appointment.patient_contacts}</small>
                        </div>
                        <div class="col-md-3">
                            <i class="fas fa-calendar"></i> ${formattedDate}<br>
                            <i class="fas fa-clock"></i> ${formattedTime}
                        </div>
                        <div class="col-md-3">
                            <small class="text-muted">${appointment.main_procedure_term}</small>
                        </div>
                        <div class="col-md-2 text-end">
                            <button class="btn btn-outline-primary btn-sm" 
                                onclick="sendSingleMessage(${appointment.id})">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                            <button class="btn btn-outline-success btn-sm" 
                                onclick="confirmAppointment(${appointment.id})">
                                <i class="fas fa-check"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    appointmentsContainer.innerHTML = html;
    
    // Adicionar event listeners para checkboxes
    document.querySelectorAll('.appointment-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });
    
    updateSelectedCount();
}

// Event Handlers
function handleCheckboxChange(event) {
    const appointmentId = parseInt(event.target.value);
    
    if (event.target.checked) {
        selectedAppointments.add(appointmentId);
    } else {
        selectedAppointments.delete(appointmentId);
    }
    
    updateSelectedCount();
}

function updateSelectedCount() {
    selectedCount.textContent = `(${selectedAppointments.size})`;
    sendBulkBtn.disabled = !whatsappConnected || selectedAppointments.size === 0;
    
    // Atualizar texto do botão de selecionar todos
    const allSelected = selectedAppointments.size === appointments.length && appointments.length > 0;
    selectAllBtn.innerHTML = allSelected 
        ? '<i class="fas fa-square"></i> Desmarcar Todos'
        : '<i class="fas fa-check-square"></i> Selecionar Todos';
}

function toggleSelectAll() {
    const allSelected = selectedAppointments.size === appointments.length && appointments.length > 0;
    
    if (allSelected) {
        selectedAppointments.clear();
    } else {
        appointments.forEach(appointment => {
            selectedAppointments.add(appointment.id);
        });
    }
    
    renderAppointments();
}

// Message Functions
async function sendSingleMessage(appointmentId) {
    if (!whatsappConnected) {
        showAlert('WhatsApp não está conectado', 'warning');
        return;
    }
    
    try {
        const message = customMessage.value.trim() || null;
        const result = await apiCall(`/send/${appointmentId}`, {
            method: 'POST',
            body: JSON.stringify({ customMessage: message })
        });
        
        showAlert(`Mensagem enviada para ${result.data.appointment.patient_name}`, 'success');
    } catch (error) {
        // Error already handled in apiCall
    }
}

async function sendBulkMessages() {
    if (!whatsappConnected) {
        showAlert('WhatsApp não está conectado', 'warning');
        return;
    }
    
    if (selectedAppointments.size === 0) {
        showAlert('Selecione pelo menos um agendamento', 'warning');
        return;
    }
    
    const confirmSend = confirm(`Enviar mensagens para ${selectedAppointments.size} destinatários?`);
    if (!confirmSend) return;
    
    sendBulkBtn.disabled = true;
    sendBulkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    
    try {
        const message = customMessage.value.trim() || null;
        const appointmentIds = Array.from(selectedAppointments);
        
        const result = await apiCall('/send/bulk', {
            method: 'POST',
            body: JSON.stringify({ 
                appointmentIds, 
                customMessage: message 
            })
        });
        
        const { successful, failed, total } = result.data;
        showAlert(
            `Disparo concluído: ${successful} enviadas, ${failed} falharam de ${total} total`, 
            successful > 0 ? 'success' : 'warning'
        );
        
        // Limpar seleção
        selectedAppointments.clear();
        renderAppointments();
        
    } catch (error) {
        // Error already handled in apiCall
    } finally {
        sendBulkBtn.disabled = false;
        sendBulkBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Selecionados <span id="selected-count">(0)</span>';
    }
}

async function sendTestMessage() {
    const phone = document.getElementById('test-phone').value.trim();
    const message = document.getElementById('test-message').value.trim();
    
    if (!phone || !message) {
        showAlert('Telefone e mensagem são obrigatórios', 'warning');
        return;
    }
    
    if (!whatsappConnected) {
        showAlert('WhatsApp não está conectado', 'warning');
        return;
    }
    
    try {
        await apiCall('/test', {
            method: 'POST',
            body: JSON.stringify({ phone, message })
        });
        
        showAlert('Mensagem de teste enviada!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('testModal')).hide();
        
        // Limpar campos
        document.getElementById('test-phone').value = '';
        document.getElementById('test-message').value = '';
        
    } catch (error) {
        // Error already handled in apiCall
    }
}

async function confirmAppointment(appointmentId) {
    const confirmAction = confirm('Confirmar este agendamento?');
    if (!confirmAction) return;
    
    try {
        await apiCall(`/appointments/${appointmentId}/confirm`, { method: 'POST' });
        showAlert('Agendamento confirmado!', 'success');
        loadData(); // Recarregar dados
    } catch (error) {
        // Error already handled in apiCall
    }
}

// Utility Functions
function showAlert(message, type = 'info') {
    // Remover alertas existentes
    const existingAlerts = document.querySelectorAll('.alert-custom');
    existingAlerts.forEach(alert => alert.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show alert-custom`;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

function showLoading(show) {
    const loading = document.querySelector('.loading');
    loading.style.display = show ? 'block' : 'none';
}

// ================= On-Premises helpers =================
async function requestOnPremCode() {
    try {
        const body = {
            cc: (onpremCC?.value || '55').trim(),
            phone_number: (onpremPhone?.value || '').trim(),
            method: (onpremMethod?.value || 'sms').trim(),
            cert: (onpremCert?.value || '').trim() || undefined
        };
        if (!body.phone_number) {
            showAlert('Informe o telefone (sem DDI)', 'warning');
            return;
        }
        const res = await apiCall('/waba-onprem/request-code', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        showAlert('Código solicitado com sucesso. Verifique SMS/voz.', 'success');
        console.log('On-Prem request-code result:', res);
    } catch (e) {}
}

async function verifyOnPremCode() {
    try {
        const body = {
            code: (onpremCode?.value || '').trim(),
            cert: (onpremCert?.value || '').trim() || undefined,
            pin: (onpremPin?.value || '').trim() || undefined
        };
        if (!body.code) {
            showAlert('Informe o código recebido', 'warning');
            return;
        }
        const res = await apiCall('/waba-onprem/verify', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        showAlert('Número verificado com sucesso!', 'success');
        console.log('On-Prem verify result:', res);
    } catch (e) {}
}