/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import './index.css';
import { GoogleGenAI } from '@google/genai';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Chart, registerables } from 'chart.js';
import * as authApi from './api/authApiService'; // <-- NOSSO NOVO SERVIÇO DE API

Chart.register(...registerables);


// Ensure API_KEY is correctly accessed from environment variables
const apiKey = process.env.API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
} else {
    // AVISO: A chave da API Gemini será movida para o backend no próximo passo!
    console.warn("API_KEY não está definida no frontend. A funcionalidade de IA será movida para o backend.");
}

// --- START REFACTORED AUTHENTICATION ---
const AUTH_TOKEN_KEY = 'cargoOptimizerAuthToken'; // Chave para armazenar o token JWT real
const TRIAL_SIMULATIONS_KEY = 'cargoOptimizerTrialSimulations';
const MAX_TRIAL_SIMULATIONS = 5;
const ADMIN_EMAIL_FOR_DEMO = "feliperohneltrds@gmail.com"; // Usado apenas para fins de UI no admin

let isAuthenticated = false;
let isAdmin = false;
let appInitialized = false;
let trialSimulationsRemaining = MAX_TRIAL_SIMULATIONS;

const authContainer = document.getElementById('auth-container') as HTMLElement;
const appContainer = document.getElementById('app-container') as HTMLElement;
const adminContainer = document.getElementById('admin-container') as HTMLElement;
const loginFormContainer = document.getElementById('login-form-container') as HTMLElement;
const registerFormContainer = document.getElementById('register-form-container') as HTMLElement;

const logoutButton = document.getElementById('logout-button') as HTMLButtonElement;
const adminLogoutButton = document.getElementById('admin-logout-button') as HTMLButtonElement;
const adminPanelLink = document.getElementById('admin-panel-link') as HTMLAnchorElement;
const backToAppLink = document.getElementById('admin-back-to-app-link') as HTMLAnchorElement;

const trialInfoBanner = document.getElementById('trial-info-banner') as HTMLElement;
const trialSimulationsRemainingSpan = document.getElementById('trial-simulations-remaining') as HTMLSpanElement;
const authMessageElement = document.getElementById('auth-message') as HTMLParagraphElement;

// Funções do painel admin permanecem, mas precisarão ser conectadas a uma API real no futuro
let activeAdminSubView: 'dashboard' | 'charts' = 'dashboard';
let usageByPeriodChartInstance: Chart | null = null;
let userRecurrenceChartInstance: Chart | null = null;


function initializeGlobalState() {
    const storedTrials = localStorage.getItem(TRIAL_SIMULATIONS_KEY);
    if (storedTrials !== null) {
        trialSimulationsRemaining = parseInt(storedTrials, 10);
        if (isNaN(trialSimulationsRemaining) || trialSimulationsRemaining < 0) {
            trialSimulationsRemaining = 0;
        }
    } else {
        trialSimulationsRemaining = MAX_TRIAL_SIMULATIONS;
        localStorage.setItem(TRIAL_SIMULATIONS_KEY, trialSimulationsRemaining.toString());
    }
}

function saveTrialState() {
    localStorage.setItem(TRIAL_SIMULATIONS_KEY, trialSimulationsRemaining.toString());
}

function updateHeaderUI(currentView: 'login' | 'register' | 'app' | 'admin') {
    const mainAppHeader = appContainer.querySelector('header');
    const adminAppHeader = adminContainer.querySelector('header');

    if (!mainAppHeader || !adminAppHeader) return;

    mainAppHeader.classList.toggle('hidden', currentView === 'admin' || currentView === 'login' || currentView === 'register');
    adminAppHeader.classList.toggle('hidden', currentView !== 'admin');

    if (!mainAppHeader.classList.contains('hidden')) {
        if (isAuthenticated) {
            trialInfoBanner.classList.add('hidden');
            logoutButton.classList.remove('hidden');
            adminPanelLink.classList.toggle('hidden', !isAdmin);
            (document.getElementById('header-login-link') as HTMLElement).classList.add('hidden');
            (document.getElementById('header-register-link') as HTMLElement).classList.add('hidden');
        } else {
            logoutButton.classList.add('hidden');
            adminPanelLink.classList.add('hidden');
            (document.getElementById('header-login-link') as HTMLElement).classList.remove('hidden');
            (document.getElementById('header-register-link') as HTMLElement).classList.remove('hidden');

            if (trialSimulationsRemaining > 0) {
                trialSimulationsRemainingSpan.textContent = trialSimulationsRemaining.toString();
                trialInfoBanner.classList.remove('hidden');
            } else {
                trialInfoBanner.classList.add('hidden');
            }
        }
    }
}


function showView(view: 'login' | 'register' | 'app' | 'admin') {
    authContainer.classList.add('hidden');
    appContainer.classList.add('hidden');
    adminContainer.classList.add('hidden');
    loginFormContainer.classList.add('hidden');
    registerFormContainer.classList.add('hidden');

    if (authMessageElement) authMessageElement.textContent = '';

    if (view === 'login') {
        authContainer.classList.remove('hidden');
        loginFormContainer.classList.remove('hidden');
        if (!isAuthenticated && trialSimulationsRemaining <= 0 && authMessageElement) {
            authMessageElement.textContent = "Seu período de teste acabou. Faça login ou registre-se para continuar.";
        }
    } else if (view === 'register') {
        authContainer.classList.remove('hidden');
        registerFormContainer.classList.remove('hidden');
    } else if (view === 'app') {
        appContainer.classList.remove('hidden');
        if (!appInitialized) {
            initializeApp();
            appInitialized = true;
        }
    } else if (view === 'admin') {
        if (isAuthenticated && isAdmin) {
            adminContainer.classList.remove('hidden');
            setupAdminMenuEventListeners();
            showAdminSubView('dashboard');
        } else {
            showView('login');
            return;
        }
    }
    updateHeaderUI(view);
}

async function checkAuthState() {
    initializeGlobalState();

    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    if (token) {
        try {
            const statusResponse = await authApi.checkAuthStatus(token);

            if (statusResponse && statusResponse.isAuthenticated) {
                isAuthenticated = true;
                isAdmin = statusResponse.isAdmin;
                showView('app');
                return;
            } else {
                localStorage.removeItem(AUTH_TOKEN_KEY);
            }
        } catch (error) {
            console.error("Erro ao verificar o status do token:", error);
            localStorage.removeItem(AUTH_TOKEN_KEY);
        }
    }

    isAuthenticated = false;
    isAdmin = false;
    if (trialSimulationsRemaining > 0) {
        showView('app');
    } else {
        showView('login');
    }
}


function handleLogout() {
    isAuthenticated = false;
    isAdmin = false;
    appInitialized = false;
    localStorage.removeItem(AUTH_TOKEN_KEY);

    const detailsPanel = document.getElementById('details-panel');
    if (detailsPanel) {
        detailsPanel.innerHTML = '<h2>Details & Reports</h2><p>3D packing summaries and AI-generated tips will appear here. Select an algorithm and click "Generate 3D Packing Preview".</p>';
    }
    if (scene) {
        clearPackedItemsFromScene();
    }
    activeAdminSubView = 'dashboard';
    checkAuthState(); // Reavalia o estado, que agora será "não autenticado"
}

function setupAuthEventListeners() {
    // LOGIN FORM
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = (document.getElementById('login-email') as HTMLInputElement).value;
        const password = (document.getElementById('login-password') as HTMLInputElement).value;

        try {
            const result = await authApi.loginUser(email, password);
            if (result.token) {
                localStorage.setItem(AUTH_TOKEN_KEY, result.token);
                await checkAuthState(); // Revalida o estado com o token recém-obtido
            } else {
                alert(`Erro no login: ${result.message}`);
            }
        } catch (error) {
            console.error('Falha na requisição de login:', error);
            alert('Não foi possível conectar ao servidor de autenticação.');
        }
    });

    // REGISTER FORM
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = (document.getElementById('register-email') as HTMLInputElement).value;
        const password = (document.getElementById('register-password') as HTMLInputElement).value;
        const confirmPassword = (document.getElementById('register-confirm-password') as HTMLInputElement).value;

        if (password !== confirmPassword) {
            alert("As senhas não coincidem!");
            return;
        }

        try {
            const result = await authApi.registerUser(email, password);
            if (result.token) {
                alert('Usuário registrado com sucesso! Fazendo login...');
                localStorage.setItem(AUTH_TOKEN_KEY, result.token);
                await checkAuthState(); // Valida o estado após registro
            } else {
                alert(`Erro no registro: ${result.message}`);
            }
        } catch (error) {
            console.error('Falha na requisição de registro:', error);
            alert('Não foi possível conectar ao servidor de autenticação.');
        }
    });

    const showRegisterFunc = (e: Event) => { e.preventDefault(); showView('register'); };
    const showLoginFunc = (e: Event) => { e.preventDefault(); showView('login'); };

    document.getElementById('show-register-link')?.addEventListener('click', showRegisterFunc);
    document.getElementById('header-register-link')?.addEventListener('click', showRegisterFunc);

    document.getElementById('show-login-link')?.addEventListener('click', showLoginFunc);
    document.getElementById('header-login-link')?.addEventListener('click', showLoginFunc);


    logoutButton.addEventListener('click', handleLogout);
    adminLogoutButton.addEventListener('click', handleLogout);

    adminPanelLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (isAuthenticated && isAdmin) {
            showView('admin');
        }
    });
    backToAppLink.addEventListener('click', (e) => {
        e.preventDefault();
        showView('app');
    });

    // A integração real com Google OAuth2 agora é um link direto.
    document.getElementById('login-google-button')?.addEventListener('click', () => {
        window.location.href = 'http://localhost:5000/api/auth/google';
    });
    document.getElementById('register-google-button')?.addEventListener('click', () => {
        window.location.href = 'http://localhost:5000/api/auth/google';
    });
}
// --- END REFACTORED AUTHENTICATION ---

// --- START ADMIN PANEL FUNCTIONS (DATA AINDA SIMULADA) ---

function setupAdminMenuEventListeners() {
    const menuDashboard = document.getElementById('admin-menu-dashboard');
    const menuCharts = document.getElementById('admin-menu-charts');

    menuDashboard?.addEventListener('click', (e) => {
        e.preventDefault();
        showAdminSubView('dashboard');
    });
    menuCharts?.addEventListener('click', (e) => {
        e.preventDefault();
        showAdminSubView('charts');
    });
}

function showAdminSubView(subView: 'dashboard' | 'charts') {
    activeAdminSubView = subView;
    const dashboardContent = document.getElementById('admin-dashboard-content');
    const chartsContent = document.getElementById('admin-charts-content');
    const menuDashboard = document.getElementById('admin-menu-dashboard');
    const menuCharts = document.getElementById('admin-menu-charts');

    if (!dashboardContent || !chartsContent || !menuDashboard || !menuCharts) return;

    if (subView === 'dashboard') {
        dashboardContent.classList.remove('hidden');
        chartsContent.classList.add('hidden');
        menuDashboard.classList.add('active');
        menuDashboard.setAttribute('aria-current', 'page');
        menuCharts.classList.remove('active');
        menuCharts.removeAttribute('aria-current');
        renderAdminDashboardContent();
    } else if (subView === 'charts') {
        dashboardContent.classList.add('hidden');
        chartsContent.classList.remove('hidden');
        menuDashboard.classList.remove('active');
        menuDashboard.removeAttribute('aria-current');
        menuCharts.classList.add('active');
        menuCharts.setAttribute('aria-current', 'page');
        renderAdminChartsContent();
    }
}


function renderAdminDashboardContent() {
    // AVISO: Esta seção ainda usa dados simulados.
    // O próximo passo seria criar endpoints de admin no backend para buscar dados reais.
    const userListContainer = document.getElementById('admin-user-list-container');
    const statsContainer = document.getElementById('admin-stats-container');

    if (!userListContainer || !statsContainer) return;

    // A lógica de usuários registrados precisa ser buscada da API no futuro.
    // Por enquanto, vamos exibir uma mensagem placeholder.
    let userListHTML = `<h4>Administrador Atual:</h4><p>${ADMIN_EMAIL_FOR_DEMO}</p>`;
    userListHTML += `<h4>Usuários Registrados:</h4>`;
    userListHTML += `<p>(Esta informação será carregada a partir do backend no futuro.)</p>`;
    userListContainer.innerHTML = userListHTML;

    const cachedItems = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ITEMS_KEY) || '[]');
    const totalItemsInCache = cachedItems.length;
    const numContainerTypes = containerTypes.length;
    const apiKeyStatus = apiKey ? "Configurada (Frontend)" : "Não Configurada";

    statsContainer.innerHTML = `
        <ul>
            <li><span class="stat-label">Usuário Admin (para UI):</span> <span class="stat-value">${ADMIN_EMAIL_FOR_DEMO}</span></li>
            <li><span class="stat-label">Itens no Cache Local:</span> <span class="stat-value">${totalItemsInCache}</span></li>
            <li><span class="stat-label">Simulações de Teste (Trial):</span> <span class="stat-value">${MAX_TRIAL_SIMULATIONS}</span></li>
            <li><span class="stat-label">Status da Chave API Gemini:</span> <span class="stat-value">${apiKeyStatus}</span></li>
            <li><span class="stat-label">Tipos de Contêiner Pré-definidos:</span> <span class="stat-value">${numContainerTypes}</span></li>
        </ul>
    `;
}

function renderAdminChartsContent() {
    // AVISO: Todos os gráficos usam dados gerados aleatoriamente para demonstração.
    const usageByPeriodCtx = (document.getElementById('usageByPeriodChart') as HTMLCanvasElement)?.getContext('2d');
    if (usageByPeriodCtx) {
        if (usageByPeriodChartInstance) usageByPeriodChartInstance.destroy();
        const usageData = {
            labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
            datasets: [{
                label: 'Simulações Executadas',
                data: [Math.floor(Math.random() * 50) + 10, Math.floor(Math.random() * 50) + 20, Math.floor(Math.random() * 50) + 15, Math.floor(Math.random() * 50) + 30],
                fill: false,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        };
        usageByPeriodChartInstance = new Chart(usageByPeriodCtx, { type: 'line', data: usageData });
    }

    const worldMapContainer = document.getElementById('user-world-map-container');
    if (worldMapContainer) {
        worldMapContainer.innerHTML = '<p>Dados de distribuição de usuários virão do backend.</p>';
    }

    const userRecurrenceCtx = (document.getElementById('userRecurrenceChart') as HTMLCanvasElement)?.getContext('2d');
    if (userRecurrenceCtx) {
        if (userRecurrenceChartInstance) userRecurrenceChartInstance.destroy();
        const recurrenceData = {
            labels: ['Ativos Diários', 'Ativos Semanais', 'Ativos Mensais', 'Raramente Ativos'],
            datasets: [{
                label: 'Número de Usuários',
                data: [Math.floor(Math.random() * 10) + 2, Math.floor(Math.random() * 20) + 5, Math.floor(Math.random() * 30) + 10, Math.floor(Math.random() * 15) + 3],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                    'rgba(75, 192, 192, 0.5)'
                ],
                borderWidth: 1
            }]
        };
        userRecurrenceChartInstance = new Chart(userRecurrenceCtx, {
            type: 'bar',
            data: recurrenceData,
            options: { scales: { y: { beginAtZero: true } } }
        });
    }

    const avgReportsContainer = document.getElementById('avg-reports-chart-container');
    if (avgReportsContainer) {
        avgReportsContainer.innerHTML = `<p>Dados de média de relatórios virão do backend.</p>`;
    }
}
// --- END ADMIN PANEL FUNCTIONS ---


// ==================================================================
// ==                                                              ==
// ==   O RESTANTE DO SEU CÓDIGO (LÓGICA 3D, ITENS, ETC.) PERMANECE  ==
// ==   EXATAMENTE O MESMO A PARTIR DESTE PONTO.                  ==
// ==                                                              ==
// ==================================================================


interface RotationPreferences {
    allowX: boolean;
    allowY: boolean;
    allowZ: boolean;
}

interface AppliedRotationAngles {
    x: number; // radians
    y: number; // radians
    z: number; // radians
}

interface ContainerTypeSpec {
    name: string;
    length: number;
    width: number;
    height: number;
    maxPayloadKg: number;
}

interface Item {
    id: string;
    name: string;
    shape: 'box' | 'cylinder';
    length: number;
    width: number;
    height: number;
    weight: number;
    quantity: number;
    nonStackable: boolean;
    color?: string; // Always store as hex string
    rotationPreferences: RotationPreferences;
}

interface ItemInstance extends Item {
    placed: boolean;
    instanceId: string;
    appliedRotationAngles: AppliedRotationAngles;
    effectiveLength: number;
    effectiveWidth: number;
    effectiveHeight: number;
    meshPosition?: THREE.Vector3; // World position (center) of the item if placed
    containerId?: number; // To identify which container it's in (0 for first, 1 for second, etc.)
    userData?: { // Added to store instance-specific data like containerWorldOffsetX
        containerWorldOffsetX?: number;
    };
}

interface UnplacedReportEntry {
    itemName: string;
    quantity: number;
    reason: string;
}

type AlgorithmChoice = 'ffd' | 'bfd';
let currentAlgorithm: AlgorithmChoice = 'ffd';
let numberOfContainers: 1 | 2 = 1;
const CONTAINER_X_GAP = 0.5; // Gap between containers when two are shown


interface LastPackingResults {
    packedItems: ItemInstance[];
    unplacedReport: UnplacedReportEntry[];
    totalPackedWeight: number; // Overall total weight
    weightsPerContainer: number[]; // Weight in each container
    containerSpec: { // Spec of a single container
        name: string;
        length: number;
        width: number;
        height: number;
        maxPayloadKg: number;
    };
    algorithmUsed: AlgorithmChoice;
    numContainersUsed: number;
}
let lastPackingResults: LastPackingResults | null = null;

const EPSILON_PACK = 0.0001; // For floating point comparisons in packing

let items: Item[] = [];
const itemColorsFallback = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"]; // Fallback hex strings
let fallbackColorIndex = 0;
const LOCAL_STORAGE_ITEMS_KEY = 'cargoOptimizerItemsCache';

const containerTypes: ContainerTypeSpec[] = [
    { name: "Custom", length: 12, width: 2.3, height: 2.3, maxPayloadKg: 999999 }, // Default custom
    { name: "20' Dry Standard", length: 5.90, width: 2.35, height: 2.39, maxPayloadKg: 28280 },
    { name: "40' Dry Standard", length: 12.03, width: 2.35, height: 2.39, maxPayloadKg: 26680 },
    { name: "40' High Cube (HC)", length: 12.03, width: 2.35, height: 2.69, maxPayloadKg: 28500 },
    { name: "45' High Cube (HC)", length: 13.56, width: 2.35, height: 2.69, maxPayloadKg: 27700 },
    { name: "20' Reefer (Refrigerado)", length: 5.44, width: 2.29, height: 2.27, maxPayloadKg: 27480 },
    { name: "40' Reefer (Refrigerado)", length: 11.56, width: 2.29, height: 2.25, maxPayloadKg: 25980 },
    { name: "20' Open Top", length: 5.89, width: 2.35, height: 2.35, maxPayloadKg: 28080 },
];


// Three.js specific variables
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let containerMeshes: THREE.LineSegments[] = [];
const packedItemMeshes: THREE.Mesh[] = [];
const packedItemEdgeMeshes: THREE.Line[] = [];
const CYLINDER_VISUAL_SPACING = 0.005;

let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let itemTooltipElement: HTMLElement | null;
let rotationAxisTooltipElement: HTMLElement | null;
let currentlyHoveredInstanceId: string | null = null;
let currentlyHoveredOriginalId: string | null = null;

const DEFAULT_MESH_OPACITY = 0.9;
const DEFAULT_EDGE_OPACITY = 1.0;
const HOVERED_MESH_OPACITY = 1.0;
const HOVERED_EDGE_OPACITY = 1.0;
const SIMILAR_ITEM_MESH_OPACITY = 0.9;
const SIMILAR_ITEM_EDGE_OPACITY = 1.0;
const DIMMED_MESH_OPACITY = 0.15;
const DIMMED_EDGE_OPACITY = 0.1;

let editingItemId: string | null = null;

// Local Storage Functions
function saveItemsToLocalStorage(): void {
    try {
        localStorage.setItem(LOCAL_STORAGE_ITEMS_KEY, JSON.stringify(items));
    } catch (e) {
        console.warn("Could not save items to local storage:", e);
    }
}

function loadItemsFromLocalStorage(): void {
    try {
        const cachedItemsJson = localStorage.getItem(LOCAL_STORAGE_ITEMS_KEY);
        if (cachedItemsJson) {
            let parsedItems;
            try {
                parsedItems = JSON.parse(cachedItemsJson);
            } catch (parseError) {
                console.error("Failed to parse items from local storage:", parseError);
                localStorage.removeItem(LOCAL_STORAGE_ITEMS_KEY);
                return;
            }

            if (Array.isArray(parsedItems)) {
                const validItems: Item[] = [];
                for (const rawItem of parsedItems) {
                    if (typeof rawItem === 'object' && rawItem !== null &&
                        typeof rawItem.id === 'string' &&
                        typeof rawItem.name === 'string' &&
                        typeof rawItem.shape === 'string' && (rawItem.shape === 'box' || rawItem.shape === 'cylinder') &&
                        typeof rawItem.length === 'number' && rawItem.length > 0 &&
                        typeof rawItem.width === 'number' && rawItem.width > 0 &&
                        typeof rawItem.height === 'number' && rawItem.height > 0 &&
                        typeof rawItem.weight === 'number' && rawItem.weight >= 0 &&
                        typeof rawItem.quantity === 'number' && rawItem.quantity > 0 &&
                        typeof rawItem.nonStackable === 'boolean' &&
                        (typeof rawItem.color === 'string' || typeof rawItem.color === 'undefined') &&
                        typeof rawItem.rotationPreferences === 'object' && rawItem.rotationPreferences !== null &&
                        typeof rawItem.rotationPreferences.allowX === 'boolean' &&
                        typeof rawItem.rotationPreferences.allowY === 'boolean' &&
                        typeof rawItem.rotationPreferences.allowZ === 'boolean'
                    ) {
                        validItems.push(rawItem as Item);
                    } else {
                        console.warn("Skipping invalid item from local storage:", rawItem);
                    }
                }
                items = validItems;
                if (items.length !== parsedItems.length) {
                    console.warn("Some items from local storage were invalid and have been filtered out. The cache has been updated with valid items only.");
                    saveItemsToLocalStorage();
                }
            } else {
                console.warn("Invalid item cache format (not an array) found in local storage. Clearing.");
                localStorage.removeItem(LOCAL_STORAGE_ITEMS_KEY);
            }
        }
    } catch (e) {
        console.error("Could not load items from local storage:", e);
    }
}

function handleClearCachedItems(): void {
    if (confirm("Are you sure you want to clear all locally saved items? This action cannot be undone.")) {
        try {
            localStorage.removeItem(LOCAL_STORAGE_ITEMS_KEY);
            items = [];
            renderItems();
            clearAndResetSceneAndReport();
            const detailsPanel = document.getElementById('details-panel');
            if (detailsPanel) {
                let currentHTML = detailsPanel.innerHTML;
                let baseHTML = '<h2>Details & Reports</h2>';
                const aiTipsStart = currentHTML.indexOf("<h3>AI Packing Tips:</h3>");
                if (aiTipsStart !== -1) {
                    baseHTML = currentHTML.substring(0, aiTipsStart);
                }
                detailsPanel.innerHTML = baseHTML + '<p>Locally saved items cleared. Add new items or get AI tips.</p>';
            }
            alert("Locally saved items have been cleared.");
        } catch (e) {
            console.error("Error clearing local storage:", e);
            alert("Could not clear local storage. See console for details.");
        }
    }
}

function clearAndResetSceneAndReport() {
    clearPackedItemsFromScene();
    lastPackingResults = null;
    const downloadReportBtn = document.getElementById('downloadReportButton') as HTMLButtonElement;
    if (downloadReportBtn) downloadReportBtn.disabled = true;
    const exportOBJBtn = document.getElementById('exportOBJButton') as HTMLButtonElement;
    if (exportOBJBtn) exportOBJBtn.disabled = true;
}


function initThreeScene() {
    const viewportPlaceholder = document.getElementById('viewport-placeholder');
    if (!viewportPlaceholder) {
        console.error("Viewport placeholder not found for Three.js canvas.");
        return;
    }
    viewportPlaceholder.innerHTML = '';

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdedede);

    const aspect = viewportPlaceholder.clientWidth / viewportPlaceholder.clientHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.set(5, 5, 15);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(viewportPlaceholder.clientWidth, viewportPlaceholder.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    viewportPlaceholder.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(10, 15, 7);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 150;

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    itemTooltipElement = document.getElementById('item-tooltip');
    renderer.domElement.addEventListener('mousemove', onDocumentMouseMove, false);
    renderer.domElement.addEventListener('mouseleave', onDocumentMouseLeave, false);

    updateContainerVisual();
    animate();
    window.addEventListener('resize', onWindowResize, false);
}

function formatAppliedRotations(angles: AppliedRotationAngles): string {
    const parts: string[] = [];
    if (Math.abs(angles.x) > 0.01) parts.push(`X:${(angles.x * 180 / Math.PI).toFixed(0)}°`);
    if (Math.abs(angles.y) > 0.01) parts.push(`Y:${(angles.y * 180 / Math.PI).toFixed(0)}°`);
    if (Math.abs(angles.z) > 0.01) parts.push(`Z:${(angles.z * 180 / Math.PI).toFixed(0)}°`);
    return parts.length > 0 ? ` (Rot: ${parts.join(' ')})` : '';
}

function onDocumentMouseMove(event: MouseEvent) {
    if (!renderer || !camera || !itemTooltipElement) return;
    event.preventDefault();
    const canvasBounds = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - canvasBounds.left) / canvasBounds.width) * 2 - 1;
    mouse.y = -((event.clientY - canvasBounds.top) / canvasBounds.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(packedItemMeshes);

    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object as THREE.Mesh;
        const hoveredItemData = intersectedObject.userData.item as ItemInstance;

        if (hoveredItemData) {
            if (hoveredItemData.instanceId !== currentlyHoveredInstanceId) {
                currentlyHoveredInstanceId = hoveredItemData.instanceId;
                currentlyHoveredOriginalId = hoveredItemData.id;
                packedItemMeshes.forEach(mesh => {
                    const meshItemData = mesh.userData.item as ItemInstance;
                    const material = mesh.material as THREE.MeshStandardMaterial;
                    if (meshItemData.instanceId === currentlyHoveredInstanceId) material.opacity = HOVERED_MESH_OPACITY;
                    else if (meshItemData.id === currentlyHoveredOriginalId) material.opacity = SIMILAR_ITEM_MESH_OPACITY;
                    else material.opacity = DIMMED_MESH_OPACITY;
                });
                packedItemEdgeMeshes.forEach(edge => {
                    const edgeParentInstanceId = edge.userData.parentInstanceId as string;
                    const edgeParentOriginalId = edge.userData.parentOriginalId as string;
                    const material = edge.material as THREE.LineBasicMaterial;
                    if (edgeParentInstanceId === currentlyHoveredInstanceId) material.opacity = HOVERED_EDGE_OPACITY;
                    else if (edgeParentOriginalId === currentlyHoveredOriginalId) material.opacity = SIMILAR_ITEM_EDGE_OPACITY;
                    else material.opacity = DIMMED_EDGE_OPACITY;
                });
            }

            const originalItemDefinition = items.find(item => item.id === hoveredItemData.id);
            let tooltipText = `${hoveredItemData.name}`;
            if (hoveredItemData.containerId !== undefined) {
                tooltipText += ` (Cont. ${hoveredItemData.containerId + 1})`;
            }
            if (originalItemDefinition) {
                const totalQuantity = originalItemDefinition.quantity;
                const totalWeight = originalItemDefinition.weight * totalQuantity;
                tooltipText += ` (Qty: ${totalQuantity}, Total Wt: ${totalWeight.toFixed(2)}kg, Unit Wt: ${hoveredItemData.weight.toFixed(2)}kg)`;
            } else {
                tooltipText += ` (Wt: ${hoveredItemData.weight.toFixed(2)}kg)`;
            }
            tooltipText += formatAppliedRotations(hoveredItemData.appliedRotationAngles);

            itemTooltipElement.innerHTML = tooltipText;
            itemTooltipElement.style.left = `${event.clientX + 15}px`;
            itemTooltipElement.style.top = `${event.clientY + 15}px`;
            itemTooltipElement.style.display = 'block';
            renderer.domElement.style.cursor = 'pointer';
        } else {
            onDocumentMouseLeave();
        }
    } else {
        onDocumentMouseLeave();
    }
}

function onDocumentMouseLeave() {
    if (currentlyHoveredInstanceId !== null) {
        packedItemMeshes.forEach(mesh => { (mesh.material as THREE.MeshStandardMaterial).opacity = DEFAULT_MESH_OPACITY; });
        packedItemEdgeMeshes.forEach(edge => { (edge.material as THREE.LineBasicMaterial).opacity = DEFAULT_EDGE_OPACITY; });
        currentlyHoveredInstanceId = null;
        currentlyHoveredOriginalId = null;
    }
    if (itemTooltipElement) itemTooltipElement.style.display = 'none';
    if (renderer) renderer.domElement.style.cursor = 'default';
}

function onWindowResize() {
    const viewportPlaceholder = document.getElementById('viewport-placeholder');
    if (!viewportPlaceholder || !renderer || !camera) return;
    camera.aspect = viewportPlaceholder.clientWidth / viewportPlaceholder.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewportPlaceholder.clientWidth, viewportPlaceholder.clientHeight);
}

function animate() {
    if (!renderer || !scene || !camera) return;
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function updateContainerVisual() {
    if (!scene) return;

    containerMeshes.forEach(mesh => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
    });
    containerMeshes = [];

    const lengthInput = document.getElementById('container-length') as HTMLInputElement;
    const widthInput = document.getElementById('container-width') as HTMLInputElement;
    const heightInput = document.getElementById('container-height') as HTMLInputElement;

    const cL = parseFloat(lengthInput.value) || 12;
    const cW = parseFloat(widthInput.value) || 2.3;
    const cH = parseFloat(heightInput.value) || 2.3;

    let overallCenterX = 0;
    let overallMinX = 0;
    let overallMaxX = cL;

    for (let i = 0; i < numberOfContainers; i++) {
        const geometry = new THREE.BoxGeometry(cL, cH, cW); // L, H, W for BoxGeometry
        const edges = new THREE.EdgesGeometry(geometry);
        const singleContainerMesh = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 }));

        let offsetX = 0;
        if (i === 1) { // Second container
            offsetX = (cL / 2) + (CONTAINER_X_GAP / 2) + (cL / 2); // Positioned relative to the center of the first
        } else if (numberOfContainers === 2) { // First of two containers
            offsetX = - ((cL / 2) + (CONTAINER_X_GAP / 2));
        }
        // If numberOfContainers is 1, offsetX remains 0, centered at origin.

        singleContainerMesh.position.set(offsetX, cH / 2, 0);
        scene.add(singleContainerMesh);
        containerMeshes.push(singleContainerMesh);

        if (i === 0) overallMinX = offsetX - cL / 2;
        if (i === numberOfContainers - 1) overallMaxX = offsetX + cL / 2;
    }

    overallCenterX = (overallMinX + overallMaxX) / 2;

    const maxSize = Math.max((numberOfContainers === 2 ? (cL * 2 + CONTAINER_X_GAP) : cL), cW, cH);
    const cameraDistanceFactor = 1.1; // Adjusted for potentially wider scene

    camera.position.set(
        overallCenterX, // Camera X centered on the overall scene
        cH / 2 + maxSize * 0.6 * cameraDistanceFactor,  // Adjusted Y
        maxSize * 0.8 * cameraDistanceFactor           // Adjusted Z to be further
    );

    camera.lookAt(overallCenterX, cH / 2, 0);
    if (controls) {
        controls.target.set(overallCenterX, cH / 2, 0);
        controls.minDistance = maxSize * 0.3;
        controls.maxDistance = maxSize * 4;   // Increased max distance
    }
}


function getRotationPreferencesText(prefs: RotationPreferences): string {
    const allowed: string[] = [];
    if (prefs.allowX) allowed.push("X");
    if (prefs.allowY) allowed.push("Y");
    if (prefs.allowZ) allowed.push("Z");
    return allowed.length > 0 ? `Allow: ${allowed.join(', ')}` : "No Rotation";
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        h /= 360;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHex(r: number, g: number, b: number): string {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function getRandomPastelColorHex(): string {
    const h = Math.random() * 360;
    const s = 0.5 + Math.random() * 0.25;
    const l = 0.75 + Math.random() * 0.1;
    const [r_val, g_val, b_val] = hslToRgb(h, s, l);
    return rgbToHex(r_val, g_val, b_val);
}


function renderItems() {
    const itemListContainer = document.getElementById('item-list-container');
    const addItemButton = document.getElementById('addItemButton') as HTMLButtonElement;
    const cancelEditButton = document.getElementById('cancelEditButton') as HTMLButtonElement;

    if (!itemListContainer || !addItemButton || !cancelEditButton) return;
    if (items.length === 0) {
        itemListContainer.innerHTML = '<p>No items added yet. Add items above, load from cache, or import from XLSX.</p>';
        return;
    }
    itemListContainer.innerHTML = '';
    items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.classList.add('item-entry');
        itemElement.setAttribute('aria-label', `Item: ${item.name}`);
        const itemColorValue = item.color || '#cccccc';
        const shapeDisplay = item.shape === 'cylinder' ? 'Cylinder' : 'Box';
        const dim1Label = item.shape === 'cylinder' ? 'Diameter' : 'Length';
        const dim2Display = item.shape === 'cylinder' ? '' : ` x ${item.width}m W`;
        const rotPrefText = getRotationPreferencesText(item.rotationPreferences);

        itemElement.innerHTML = `
      <div class="item-entry-main-info">
        <div class="item-entry-header">
          <span class="item-color-swatch" style="background-color: ${itemColorValue};"></span>
          <strong>${item.name}</strong>
        </div>
        <span>Shape: ${shapeDisplay}</span>
        <span>Qty: ${item.quantity}</span>
        <span>Wt: ${item.weight} kg</span>
        <span>Dims: ${item.length}m ${dim1Label}${dim2Display} x ${item.height}m H</span>
        <span>Rotation: ${rotPrefText}</span>
        ${item.nonStackable ? '<span class="non-stackable-tag">Non-Stackable</span>' : ''}
      </div>
      <div class="item-entry-actions">
        <button class="edit-item-button" data-id="${item.id}" aria-label="Edit ${item.name}">Edit</button>
        <button class="delete-item-button" data-id="${item.id}" aria-label="Delete ${item.name}">Delete</button>
      </div>
    `;
        itemListContainer.appendChild(itemElement);
    });
    if (editingItemId) {
        addItemButton.textContent = 'Save Changes';
        cancelEditButton.style.display = 'block';
    } else {
        addItemButton.textContent = 'Add Item to List';
        cancelEditButton.style.display = 'none';
    }
}

function resetItemForm() {
    const itemUseRandomColorCheckbox = document.getElementById('item-use-random-color') as HTMLInputElement;
    const itemColorInput = document.getElementById('item-color') as HTMLInputElement;

    (document.getElementById('item-name') as HTMLInputElement).value = '';
    (document.getElementById('item-dimension1') as HTMLInputElement).value = '';
    (document.getElementById('item-dimension2') as HTMLInputElement).value = '';
    (document.getElementById('item-height') as HTMLInputElement).value = '';
    (document.getElementById('item-weight') as HTMLInputElement).value = '';
    (document.getElementById('item-quantity') as HTMLInputElement).value = '1';
    (document.getElementById('item-non-stackable') as HTMLInputElement).checked = false;

    if (itemUseRandomColorCheckbox) itemUseRandomColorCheckbox.checked = true;
    if (itemColorInput) {
        itemColorInput.value = '#cccccc';
        if (itemUseRandomColorCheckbox && itemUseRandomColorCheckbox.checked) {
            itemColorInput.disabled = true;
        } else {
            itemColorInput.disabled = false;
        }
    }

    (document.getElementById('item-shape-box') as HTMLInputElement).checked = true;
    (document.getElementById('rot-allowX') as HTMLInputElement).checked = false;
    (document.getElementById('rot-allowY') as HTMLInputElement).checked = false;
    (document.getElementById('rot-allowZ') as HTMLInputElement).checked = false;
    updateDimensionLabels('box');
    (document.getElementById('item-name') as HTMLInputElement)?.focus();
}

function handleAddItem() {
    const name = (document.getElementById('item-name') as HTMLInputElement).value.trim();
    const dim1 = parseFloat((document.getElementById('item-dimension1') as HTMLInputElement).value);
    const dim2 = parseFloat((document.getElementById('item-dimension2') as HTMLInputElement).value);
    const height = parseFloat((document.getElementById('item-height') as HTMLInputElement).value);
    const weight = parseFloat((document.getElementById('item-weight') as HTMLInputElement).value);
    const quantity = parseInt((document.getElementById('item-quantity') as HTMLInputElement).value, 10);
    const nonStackable = (document.getElementById('item-non-stackable') as HTMLInputElement).checked;
    const selectedShape = (document.querySelector('input[name="item-shape"]:checked') as HTMLInputElement)?.value as 'box' | 'cylinder' || 'box';

    const useRandomColorCheckbox = document.getElementById('item-use-random-color') as HTMLInputElement;
    let itemColor: string;
    if (useRandomColorCheckbox && useRandomColorCheckbox.checked) {
        itemColor = getRandomPastelColorHex();
    } else {
        itemColor = (document.getElementById('item-color') as HTMLInputElement).value;
    }

    const rotationPreferences: RotationPreferences = {
        allowX: (document.getElementById('rot-allowX') as HTMLInputElement).checked,
        allowY: (document.getElementById('rot-allowY') as HTMLInputElement).checked,
        allowZ: (document.getElementById('rot-allowZ') as HTMLInputElement).checked,
    };

    let itemLength: number, itemWidth: number;
    if (selectedShape === 'cylinder') { itemLength = dim1; itemWidth = dim1; }
    else { itemLength = dim1; itemWidth = dim2; }

    if (!name) { alert('Please enter an item name.'); return; }
    if (isNaN(itemLength) || itemLength <= 0) { alert('Please enter a valid positive ' + (selectedShape === 'cylinder' ? 'diameter.' : 'length.')); return; }
    if (selectedShape === 'box' && (isNaN(itemWidth) || itemWidth <= 0)) { alert('Please enter a valid positive width.'); return; }
    if (isNaN(height) || height <= 0) { alert('Please enter a valid positive height.'); return; }
    if (isNaN(weight) || weight < 0) { alert('Please enter a valid non-negative weight.'); return; }
    if (isNaN(quantity) || quantity <= 0) { alert('Please enter a valid positive quantity.'); return; }

    if (editingItemId) {
        const itemIndex = items.findIndex(item => item.id === editingItemId);
        if (itemIndex > -1) {
            items[itemIndex] = { ...items[itemIndex], name, shape: selectedShape, length: itemLength, width: itemWidth, height, weight, quantity, nonStackable, color: itemColor, rotationPreferences };
        }
        cancelEditMode();
    } else {
        const newItem: Item = {
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, name, shape: selectedShape,
            length: itemLength, width: itemWidth, height, weight, quantity, nonStackable, color: itemColor, rotationPreferences
        };
        items.push(newItem);
        resetItemForm();
    }
    saveItemsToLocalStorage();
    renderItems();
    clearAndResetSceneAndReport();
    const detailsPanel = document.getElementById('details-panel');
    if (detailsPanel) {
        let currentHTML = detailsPanel.innerHTML;
        const aiTipsStart = currentHTML.indexOf("<h3>AI Packing Tips:</h3>");
        const baseHTML = aiTipsStart !== -1 ? currentHTML.substring(0, aiTipsStart) : '<h2>Details & Reports</h2>';
        detailsPanel.innerHTML = baseHTML + '<p>Item list updated. Generate a new 3D preview or get AI tips.</p>';
    }
}

function handleStartEditItem(itemId: string) {
    const itemToEdit = items.find(item => item.id === itemId);
    if (!itemToEdit) return;
    editingItemId = itemId;

    const itemUseRandomColorCheckbox = document.getElementById('item-use-random-color') as HTMLInputElement;
    const itemColorInput = document.getElementById('item-color') as HTMLInputElement;

    (document.getElementById('item-name') as HTMLInputElement).value = itemToEdit.name;
    (document.getElementById(itemToEdit.shape === 'box' ? 'item-shape-box' : 'item-shape-cylinder') as HTMLInputElement).checked = true;
    updateDimensionLabels(itemToEdit.shape);
    (document.getElementById('item-dimension1') as HTMLInputElement).value = itemToEdit.length.toString();
    (document.getElementById('item-dimension2') as HTMLInputElement).value = itemToEdit.width.toString();
    (document.getElementById('item-height') as HTMLInputElement).value = itemToEdit.height.toString();
    (document.getElementById('item-weight') as HTMLInputElement).value = itemToEdit.weight.toString();
    (document.getElementById('item-quantity') as HTMLInputElement).value = itemToEdit.quantity.toString();
    (document.getElementById('item-non-stackable') as HTMLInputElement).checked = itemToEdit.nonStackable;

    if (itemUseRandomColorCheckbox) itemUseRandomColorCheckbox.checked = false;
    if (itemColorInput) {
        itemColorInput.value = itemToEdit.color || '#cccccc';
        itemColorInput.disabled = false;
    }

    (document.getElementById('rot-allowX') as HTMLInputElement).checked = itemToEdit.rotationPreferences.allowX;
    (document.getElementById('rot-allowY') as HTMLInputElement).checked = itemToEdit.rotationPreferences.allowY;
    (document.getElementById('rot-allowZ') as HTMLInputElement).checked = itemToEdit.rotationPreferences.allowZ;

    renderItems();
    (document.getElementById('item-name') as HTMLInputElement).focus();
}

function cancelEditMode() {
    editingItemId = null;
    resetItemForm();
    renderItems();
}

function handleDeleteItem(itemId: string) {
    items = items.filter(item => item.id !== itemId);
    if (editingItemId === itemId) cancelEditMode();
    saveItemsToLocalStorage();
    renderItems();
    clearAndResetSceneAndReport();
    const detailsPanel = document.getElementById('details-panel');
    if (detailsPanel) {
        let currentHTML = detailsPanel.innerHTML;
        const aiTipsStart = currentHTML.indexOf("<h3>AI Packing Tips:</h3>");
        const baseHTML = aiTipsStart !== -1 ? currentHTML.substring(0, aiTipsStart) : '<h2>Details & Reports</h2>';
        detailsPanel.innerHTML = baseHTML + '<p>Item deleted. Generate a new 3D preview or get AI tips.</p>';
    }
}

async function getPackingTips() {
    const detailsPanel = document.getElementById('details-panel');
    if (!detailsPanel) return;

    if (!ai) {
        detailsPanel.innerHTML = '<p style="color: red; font-weight: bold;">API Gemini não inicializada. Dicas de IA indisponíveis.</p><p>AVISO: A chamada da API será movida para o backend para maior segurança.</p>';
        return;
    }

    const currentContent = detailsPanel.innerHTML;
    detailsPanel.innerHTML = currentContent + '<p>Loading packing tips from Gemini...</p>';
    const getTipsButton = document.getElementById('getPackingTipsButton') as HTMLButtonElement;
    if (getTipsButton) getTipsButton.disabled = true;

    let prompt = '';
    const cLInput = document.getElementById('container-length') as HTMLInputElement;
    const cWInput = document.getElementById('container-width') as HTMLInputElement;
    const cHInput = document.getElementById('container-height') as HTMLInputElement;
    const cL = parseFloat(cLInput?.value || '0');
    const cW = parseFloat(cWInput?.value || '0');
    const cH = parseFloat(cHInput?.value || '0');
    const numContainersSelected = (document.getElementById('number-of-containers') as HTMLSelectElement).value === '2' ? 2 : 1;


    if (items.length > 0 && cL > 0 && cW > 0 && cH > 0) {
        prompt = `You are a cargo packing optimization assistant.
Analyze the following container(s) and item(s) to provide specific packing insights.

Container Configuration:
- Number of Identical Containers: ${numContainersSelected}
- Dimensions (per container):
  - Length: ${cL.toFixed(2)}m
  - Width: ${cW.toFixed(2)}m
  - Height: ${cH.toFixed(2)}m
`;
        prompt += "\nItem Details (representative examples from the user's list):\n";
        const itemsToDetail = items.slice(0, Math.min(items.length, 2)); // Analyze up to 2 items
        itemsToDetail.forEach((item, index) => {
            prompt += `Item ${index + 1} (User named: '${item.name}'):\n`;
            prompt += `- Shape: ${item.shape}\n`;
            prompt += `- Dimensions (L x W x H): ${item.length.toFixed(2)}m x ${item.width.toFixed(2)}m x ${item.height.toFixed(2)}m\n`;
            prompt += `- Weight: ${item.weight} kg\n`;
            prompt += `- Quantity in user's list for this item type: ${item.quantity}\n`;
            prompt += `- Non-Stackable: ${item.nonStackable}\n`;
            prompt += `- Current Allowed Rotations (for 3D preview): X-axis: ${item.rotationPreferences.allowX}, Y-axis: ${item.rotationPreferences.allowY}, Z-axis: ${item.rotationPreferences.allowZ}\n\n`;
        });

        prompt += `
Please provide insights primarily focusing on one of the listed items (e.g., Item 1: '${itemsToDetail[0].name}'). Address the following:
1.  Item Fit Estimation (per container): If the user were to fill *one container* primarily with *this chosen specific item*, provide an *estimation* of how many total units of this item might fit. Briefly describe a simple, logical packing pattern assumed for this estimation (e.g., "aligned along container length, stacked N units high, M units wide").
2.  Rotation Impact: For *this chosen specific item*, analyze how its current rotation allowances (or lack thereof) impact packing. For example, if it's a box and only Z-axis rotation is allowed, what is the *potential* benefit (e.g., "could fit approximately Y more units" or "significantly improve space utilization") if X or Y-axis rotations were also permitted? If no rotations are allowed, what if they were? Conversely, if all rotations are allowed, mention if some might be less efficient.
3.  General Observations: Offer one or two other concise, actionable tips for maximizing space if the user is packing items like the ones detailed, in the specified container configuration. If two containers are used, mention if distributing specific item types across containers could be beneficial.

Prioritize practical, quantifiable (even if estimated) advice. Be clear about any major assumptions made.
Format your response clearly, using bullet points or distinct paragraphs for each main insight.
`;
    } else {
        if (items.length === 0) {
            detailsPanel.innerHTML = currentContent + '<p>Please add items to your list to receive specific packing advice. For now, here are some general tips:</p>';
        } else if (!(cL > 0 && cW > 0 && cH > 0)) {
            detailsPanel.innerHTML = currentContent + '<p>Please ensure valid container dimensions are set to receive specific packing advice. For now, here are some general tips:</p>';
        }
        prompt = 'Provide 5 general tips for efficiently loading cargo into a standard shipping container, considering item diversity (size, weight, stackability, shape like boxes and cylinders, and potential for rotation on X, Y, Z axes). Make them concise, actionable, and suitable for a list display.';
    }

    try {
        const model = 'gemini-2.5-flash-preview-04-17';
        const response = await ai.models.generateContent({ model, contents: prompt });
        const textResponse = response.text;

        let tipsHTML = '<h3>AI Packing Tips:</h3>';
        if (textResponse) {
            let formattedText = textResponse
                .replace(/^\s*[\*\-]\s+/gm, '<li>')
                .replace(/<\/li>\s*([\*\-])\s+/gm, '</li><li>')
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>');

            if (formattedText.includes('<li>')) {
                if (!formattedText.match(/^\s*<(ul|ol)>/i)) {
                    tipsHTML += '<ul>' + formattedText.replace(/<br><li>/g, '<li>').replace(/<li>/g, '<li>') + '</ul>';
                } else {
                    tipsHTML += formattedText;
                }
            } else {
                tipsHTML += `<p>${formattedText}</p>`;
            }
            if (tipsHTML.includes("<li>") && !tipsHTML.match(/<ul>[\s\S]*<\/ul>/i) && !tipsHTML.match(/<ol>[\s\S]*<\/ol>/i)) {
                tipsHTML = tipsHTML.replace(/<h3>AI Packing Tips:<\/h3>\s*(<li>[\s\S]*)/i, "<h3>AI Packing Tips:</h3><ul>$1</ul>");
            }


        } else {
            tipsHTML += '<p>No tips received or tips format not recognized.</p>';
        }

        const aiTipsSectionMarker = "<h3>AI Packing Tips:</h3>";
        const h2Marker = "<h2>Details & Reports</h2>";
        let baseContent = currentContent;

        const existingTipsIndex = baseContent.indexOf(aiTipsSectionMarker);
        if (existingTipsIndex !== -1) {
            baseContent = baseContent.substring(0, existingTipsIndex);
        } else {
            const h2Index = baseContent.indexOf(h2Marker);
            if (h2Index !== -1) {
                baseContent = baseContent.substring(0, h2Index + h2Marker.length);
            } else {
                baseContent = h2Marker;
            }
        }
        const loadingMessage = "<p>Loading packing tips from Gemini...</p>";
        baseContent = baseContent.replace(loadingMessage, "").trim();
        if (baseContent === h2Marker && items.length === 0) {
            baseContent += '<p>Please add items to your list to receive specific packing advice. For now, here are some general tips:</p>';
        }


        detailsPanel.innerHTML = baseContent + tipsHTML;

    } catch (error) {
        console.error('Error fetching packing tips:', error);
        let errorMessage = 'Error fetching packing tips. Check console.';
        if (error instanceof Error && (error.message.includes('API_KEY_INVALID') || error.message.includes('Quota'))) {
            errorMessage = `Error: ${error.message}`;
        }
        detailsPanel.innerHTML = currentContent.replace("<p>Loading packing tips from Gemini...</p>", "") + `<p style="color: red; font-weight: bold;">${errorMessage}</p>`;
    } finally {
        if (getTipsButton) getTipsButton.disabled = false;
    }
}


function clearPackedItemsFromScene() {
    if (!scene) return;
    packedItemMeshes.forEach(mesh => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        if (mesh.material) {
            if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
            else (mesh.material as THREE.Material).dispose();
        }
    });
    packedItemMeshes.length = 0;
    packedItemEdgeMeshes.forEach(edges => {
        scene.remove(edges);
        edges.geometry.dispose();
        if (edges.material) {
            if (Array.isArray(edges.material)) edges.material.forEach(m => m.dispose());
            else (edges.material as THREE.Material).dispose();
        }
    });
    packedItemEdgeMeshes.length = 0;
    onDocumentMouseLeave();
}

const tempBox = new THREE.Box3();
const tempVector = new THREE.Vector3();
const tempMeshForDimensions = new THREE.Mesh();

function getEffectiveDimensions(item: Item, targetRotationAngles: AppliedRotationAngles): { L: number, W: number, H: number } {
    let originalGeometry: THREE.BufferGeometry;
    if (item.shape === 'cylinder') {
        originalGeometry = new THREE.CylinderGeometry(item.length / 2, item.length / 2, item.height, 32);
    } else {
        originalGeometry = new THREE.BoxGeometry(item.length, item.height, item.width);
    }

    if (tempMeshForDimensions.geometry) {
        tempMeshForDimensions.geometry.dispose();
    }
    tempMeshForDimensions.geometry = originalGeometry;

    tempMeshForDimensions.rotation.set(targetRotationAngles.x, targetRotationAngles.y, targetRotationAngles.z);
    tempMeshForDimensions.updateMatrixWorld(true);
    tempBox.setFromObject(tempMeshForDimensions);
    tempBox.getSize(tempVector);

    return { L: tempVector.x, H: tempVector.y, W: tempVector.z };
}


function checkPlacementValidity(
    itemToPlace: ItemInstance,
    effL: number, effW: number, effH: number,
    targetItemBaseX_pack: number, targetItemBaseY_pack: number, targetItemBaseZ_pack: number,
    containerL_dims: number, containerW_dims: number, containerH_dims: number,
    existingItemsInCurrentContainer: ItemInstance[] // IMPORTANT: Only items in the *same conceptual container*
): boolean {
    const EPSILON_VALIDITY = 0.001;

    const newItemMinX_pack = targetItemBaseX_pack;
    const newItemMaxX_pack = targetItemBaseX_pack + effL;
    const newItemMinY_pack = targetItemBaseY_pack;
    const newItemMaxY_pack = targetItemBaseY_pack + effH;
    const newItemMinZ_pack = targetItemBaseZ_pack;
    const newItemMaxZ_pack = targetItemBaseZ_pack + effW;

    // Check against container boundaries (local packing space)
    if (newItemMinX_pack < 0 - EPSILON_VALIDITY ||
        newItemMaxX_pack > containerL_dims + EPSILON_VALIDITY ||
        newItemMinY_pack < 0 - EPSILON_VALIDITY ||
        newItemMaxY_pack > containerH_dims + EPSILON_VALIDITY ||
        newItemMinZ_pack < 0 - EPSILON_VALIDITY ||
        newItemMaxZ_pack > containerW_dims + EPSILON_VALIDITY) {
        return false;
    }

    // Check against other items *in the same conceptual container*
    for (const existingInst of existingItemsInCurrentContainer) {
        if (!existingInst.placed || !existingInst.meshPosition) continue;

        // Get local packing coordinates of the existing item
        // These are relative to the origin of ITS conceptual container
        const exItemLocalPackMinX = existingInst.meshPosition.x - (existingInst.effectiveLength / 2) + (containerL_dims / 2) - (existingInst.userData?.containerWorldOffsetX || 0);
        const exItemLocalPackMinY = existingInst.meshPosition.y - (existingInst.effectiveHeight / 2);
        const exItemLocalPackMinZ = existingInst.meshPosition.z - (existingInst.effectiveWidth / 2) + (containerW_dims / 2);


        const exItemLocalPackMaxX = exItemLocalPackMinX + existingInst.effectiveLength;
        const exItemLocalPackMaxY = exItemLocalPackMinY + existingInst.effectiveHeight;
        const exItemLocalPackMaxZ = exItemLocalPackMinZ + existingInst.effectiveWidth;


        const overlapX = (newItemMinX_pack < exItemLocalPackMaxX - EPSILON_VALIDITY) && (newItemMaxX_pack > exItemLocalPackMinX + EPSILON_VALIDITY);
        const overlapY = (newItemMinY_pack < exItemLocalPackMaxY - EPSILON_VALIDITY) && (newItemMaxY_pack > exItemLocalPackMinY + EPSILON_VALIDITY);
        const overlapZ = (newItemMinZ_pack < exItemLocalPackMaxZ - EPSILON_VALIDITY) && (newItemMaxZ_pack > exItemLocalPackMinZ + EPSILON_VALIDITY);

        if (overlapX && overlapY && overlapZ) return false;
    }

    if (newItemMinY_pack > EPSILON_VALIDITY) {
        let isSupported = false;
        for (const supportingInst of existingItemsInCurrentContainer) {
            if (!supportingInst.placed || !supportingInst.meshPosition) continue;

            const supItemLocalPackMinX = supportingInst.meshPosition.x - (supportingInst.effectiveLength / 2) + (containerL_dims / 2) - (supportingInst.userData?.containerWorldOffsetX || 0);
            const supItemLocalPackMinY = supportingInst.meshPosition.y - (supportingInst.effectiveHeight / 2);
            const supItemLocalPackMinZ = supportingInst.meshPosition.z - (supportingInst.effectiveWidth / 2) + (containerW_dims / 2);

            const supItemLocalPackMaxX = supItemLocalPackMinX + supportingInst.effectiveLength;
            const supItemLocalPackMaxY = supItemLocalPackMinY + supportingInst.effectiveHeight;
            const supItemLocalPackMaxZ = supItemLocalPackMinZ + supportingInst.effectiveWidth;

            if (supportingInst.nonStackable) {
                if (Math.abs(newItemMinY_pack - supItemLocalPackMaxY) < EPSILON_VALIDITY) {
                    const overlapX_support = (newItemMinX_pack < supItemLocalPackMaxX - EPSILON_VALIDITY) && (newItemMaxX_pack > supItemLocalPackMinX + EPSILON_VALIDITY);
                    const overlapZ_support = (newItemMinZ_pack < supItemLocalPackMaxZ - EPSILON_VALIDITY) && (newItemMaxZ_pack > supItemLocalPackMinZ + EPSILON_VALIDITY);
                    if (overlapX_support && overlapZ_support) return false;
                }
            }

            if (Math.abs(newItemMinY_pack - supItemLocalPackMaxY) < EPSILON_VALIDITY) {
                const contactMinX_pack = Math.max(newItemMinX_pack, supItemLocalPackMinX);
                const contactMaxX_pack = Math.min(newItemMaxX_pack, supItemLocalPackMaxX);
                const contactMinZ_pack = Math.max(newItemMinZ_pack, supItemLocalPackMinZ);
                const contactMaxZ_pack = Math.min(newItemMaxZ_pack, supItemLocalPackMaxZ);

                const contactAreaWidth_pack = contactMaxX_pack - contactMinX_pack;
                const contactAreaDepth_pack = contactMaxZ_pack - contactMinZ_pack;

                if (contactAreaWidth_pack > EPSILON_VALIDITY && contactAreaDepth_pack > EPSILON_VALIDITY) {
                    isSupported = true;
                    break;
                }
            }
        }
        if (!isSupported) return false;
    }
    return true;
}


function placeAndRecordItem(
    item: ItemInstance,
    baseX_pack: number, baseY_pack: number, baseZ_pack: number,
    containerL_dims: number, containerW_dims: number,
    containerWorldOffsetX: number, currentContainerId: number
): void {
    if (!scene) return;

    item.containerId = currentContainerId; // Tag the item with its container
    item.userData = { ...item.userData, containerWorldOffsetX }; // Store on the instance itself for later logic

    let geometry: THREE.BufferGeometry;
    if (item.shape === 'cylinder') {
        const visualRadius = Math.max(0.001, (item.length - CYLINDER_VISUAL_SPACING) / 2);
        const visualHeight = Math.max(0.001, item.height - CYLINDER_VISUAL_SPACING);
        geometry = new THREE.CylinderGeometry(visualRadius, visualRadius, visualHeight, 32);
    } else {
        geometry = new THREE.BoxGeometry(item.length, item.height, item.width);
    }

    let displayColor: string = item.color || itemColorsFallback[fallbackColorIndex++ % itemColorsFallback.length];
    const material = new THREE.MeshStandardMaterial({ color: displayColor, transparent: true, opacity: DEFAULT_MESH_OPACITY });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.rotation.set(item.appliedRotationAngles.x, item.appliedRotationAngles.y, item.appliedRotationAngles.z);

    // Calculate center position relative to the conceptual container's origin (0,0,0 for packing logic)
    const meshCenterX_local_to_container = (baseX_pack + item.effectiveLength / 2) - containerL_dims / 2;
    const meshCenterY_world = baseY_pack + item.effectiveHeight / 2; // Y is global for now
    const meshCenterZ_local_to_container = (baseZ_pack + item.effectiveWidth / 2) - containerW_dims / 2;

    // Apply the world offset for the specific container this item belongs to
    const finalMeshCenterX_world = meshCenterX_local_to_container + containerWorldOffsetX;

    mesh.position.set(finalMeshCenterX_world, meshCenterY_world, meshCenterZ_local_to_container);

    mesh.userData.item = item; // Store the full item instance on the mesh for raycasting/tooltips
    mesh.userData.containerWorldOffsetX = containerWorldOffsetX; // Also store directly on mesh for convenience if needed (though primary source now on ItemInstance)

    scene.add(mesh);
    packedItemMeshes.push(mesh);
    item.placed = true;
    item.meshPosition = mesh.position.clone();

    if (item.shape === 'box') {
        const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1, transparent: true, opacity: DEFAULT_EDGE_OPACITY });
        const edgesGeometry = new THREE.EdgesGeometry(mesh.geometry);
        const itemEdges = new THREE.LineSegments(edgesGeometry, edgeMaterial.clone());
        itemEdges.position.copy(mesh.position);
        itemEdges.rotation.copy(mesh.rotation);
        itemEdges.userData = { parentInstanceId: item.instanceId, parentOriginalId: item.id, containerId: currentContainerId };
        scene.add(itemEdges);
        packedItemEdgeMeshes.push(itemEdges);
    }
}


function generateOrientationsToTry(item: ItemInstance | Item): AppliedRotationAngles[] {
    const orientations: AppliedRotationAngles[] = [];
    const R = Math.PI / 2;
    const { allowX, allowY, allowZ } = item.rotationPreferences;

    const potentialRotationsSet = new Set<string>();
    const addOrientation = (x: number, y: number, z: number) => {
        const key = `${parseFloat(x.toFixed(4))}_${parseFloat(y.toFixed(4))}_${parseFloat(z.toFixed(4))}`;
        if (!potentialRotationsSet.has(key)) {
            potentialRotationsSet.add(key);
            orientations.push({ x, y, z });
        }
    };

    addOrientation(0, 0, 0);

    if (item.shape === 'box') {
        const xRots = allowX ? [0, R] : [0];
        const yRots = allowY ? [0, R] : [0];
        const zRots = allowZ ? [0, R] : [0];

        for (const x of xRots) addOrientation(x, 0, 0);
        for (const y of yRots) addOrientation(0, y, 0);
        for (const z of zRots) addOrientation(0, 0, z);

        if (allowX && allowY) addOrientation(R, R, 0);
        if (allowX && allowZ) addOrientation(R, 0, R);
        if (allowY && allowZ) addOrientation(0, R, R);
    } else {
        if (allowY) addOrientation(0, R, 0);
        if (allowX) addOrientation(R, 0, 0);
        if (allowZ) addOrientation(0, 0, R);
    }
    return orientations;
}

async function packItemsFFDAlgorithm(
    containerL_dims: number, containerW_dims: number, containerH_dims: number, containerMaxPayloadKg: number,
    allItemsToPackInput: ItemInstance[],
    containerWorldOffsetX: number, currentContainerId: number
): Promise<{ packedItemsList: ItemInstance[]; unplacedReport: UnplacedReportEntry[]; totalPackedWeight: number; }> {

    const itemsSorted = [...allItemsToPackInput].sort((a, b) => {
        const volA = a.length * a.width * a.height;
        const volB = b.length * b.width * b.height;
        if (Math.abs(volB - volA) > EPSILON_PACK) return volB - volA;
        const maxDimA = Math.max(a.length, a.width, a.height);
        const maxDimB = Math.max(b.length, b.width, b.height);
        return maxDimB - maxDimA;
    });

    const placedItemsInstancesInThisContainer: ItemInstance[] = [];
    let currentTotalWeight = 0;
    const unplacedReportMap: Map<string, { name: string; count: number; reason: string }> = new Map();
    fallbackColorIndex = 0; // Reset for each container's visual pass

    for (const item of itemsSorted) {
        if (item.placed) continue;
        let isPlacedThisItem = false;
        const orientationsToTry = generateOrientationsToTry(item);

        for (const rotAngles of orientationsToTry) {
            const itemToPlaceAttempt: ItemInstance = { ...item, appliedRotationAngles: rotAngles, placed: false, containerId: currentContainerId };
            const { L: effL, W: effW, H: effH } = getEffectiveDimensions(itemToPlaceAttempt, rotAngles);
            itemToPlaceAttempt.effectiveLength = effL;
            itemToPlaceAttempt.effectiveWidth = effW;
            itemToPlaceAttempt.effectiveHeight = effH;

            if (currentTotalWeight + itemToPlaceAttempt.weight > containerMaxPayloadKg + EPSILON_PACK) {
                continue;
            }

            const anchorPoints: { x: number, y: number, z: number }[] = [];
            anchorPoints.push({ x: 0, y: 0, z: 0 });

            placedItemsInstancesInThisContainer.forEach(pItem => {
                if (!pItem.meshPosition) return;
                // Convert pItem world position back to its local packing origin for anchor point generation
                const pPackBaseX = pItem.meshPosition.x - (pItem.effectiveLength / 2) + (containerL_dims / 2) - (pItem.userData?.containerWorldOffsetX || 0);
                const pPackBaseY = pItem.meshPosition.y - (pItem.effectiveHeight / 2);
                const pPackBaseZ = pItem.meshPosition.z - (pItem.effectiveWidth / 2) + (containerW_dims / 2);


                if (!pItem.nonStackable) {
                    anchorPoints.push({ x: pPackBaseX, y: pPackBaseY + pItem.effectiveHeight, z: pPackBaseZ });
                }
                anchorPoints.push({ x: pPackBaseX + pItem.effectiveLength, y: pPackBaseY, z: pPackBaseZ });
                anchorPoints.push({ x: pPackBaseX, y: pPackBaseY, z: pPackBaseZ + pItem.effectiveWidth });
            });
            anchorPoints.sort((a, b) => {
                if (Math.abs(a.x - b.x) > EPSILON_PACK) return a.x - b.x;
                if (Math.abs(a.y - b.y) > EPSILON_PACK) return a.y - b.y;
                return a.z - b.z;
            });

            const uniqueAnchorPoints = anchorPoints.filter((point, index, self) =>
                index === self.findIndex((p) =>
                    Math.abs(p.x - point.x) < EPSILON_PACK &&
                    Math.abs(p.y - point.y) < EPSILON_PACK &&
                    Math.abs(p.z - point.z) < EPSILON_PACK
                )
            );

            for (const anchor of uniqueAnchorPoints) {
                if (checkPlacementValidity(itemToPlaceAttempt, effL, effW, effH, anchor.x, anchor.y, anchor.z, containerL_dims, containerW_dims, containerH_dims, placedItemsInstancesInThisContainer)) {
                    itemToPlaceAttempt.placed = true;
                    itemToPlaceAttempt.userData = { containerWorldOffsetX }; // Store offset for this placed instance

                    placeAndRecordItem(itemToPlaceAttempt, anchor.x, anchor.y, anchor.z, containerL_dims, containerW_dims, containerWorldOffsetX, currentContainerId);
                    placedItemsInstancesInThisContainer.push(itemToPlaceAttempt);
                    currentTotalWeight += itemToPlaceAttempt.weight;
                    isPlacedThisItem = true;

                    const originalItemInstanceInInput = allItemsToPackInput.find(i => i.instanceId === item.instanceId);
                    if (originalItemInstanceInInput) originalItemInstanceInInput.placed = true; // Mark as placed in the context of the caller

                    await new Promise(resolve => setTimeout(resolve, 0));
                    break;
                }
            }
            if (isPlacedThisItem) break;
        }

        if (!isPlacedThisItem) {
            const reason = (currentTotalWeight + item.weight > containerMaxPayloadKg + EPSILON_PACK) ? `Exceeds weight limit (Cont. ${currentContainerId + 1} - FFD).` : `No suitable space/orientation (Cont. ${currentContainerId + 1} - FFD).`;
            const key = `${item.id}_${item.instanceId}_ffd_unplaced_cont${currentContainerId}`;
            const entry = unplacedReportMap.get(key) || { name: item.name, count: 0, reason: reason };
            entry.count = 1;
            entry.reason = reason;
            unplacedReportMap.set(key, entry);
        }
    }

    const finalUnplacedReport: UnplacedReportEntry[] = [];
    unplacedReportMap.forEach((value) => finalUnplacedReport.push({ itemName: value.name, quantity: value.count, reason: value.reason }));

    return {
        packedItemsList: placedItemsInstancesInThisContainer,
        unplacedReport: finalUnplacedReport,
        totalPackedWeight: currentTotalWeight
    };
}

async function packItemsBFDAlgorithm(
    containerL_dims: number, containerW_dims: number, containerH_dims: number, containerMaxPayloadKg: number,
    allItemsToPackInput: ItemInstance[],
    containerWorldOffsetX: number, currentContainerId: number
): Promise<{ packedItemsList: ItemInstance[]; unplacedReport: UnplacedReportEntry[]; totalPackedWeight: number; }> {

    const itemsSorted = [...allItemsToPackInput].sort((a, b) => {
        const volA = a.length * a.width * a.height;
        const volB = b.length * b.width * b.height;
        if (Math.abs(volB - volA) > EPSILON_PACK) return volB - volA;
        const maxDimA = Math.max(a.length, a.width, a.height);
        const maxDimB = Math.max(b.length, b.width, b.height);
        return maxDimB - maxDimA;
    });

    const placedItemsInstancesInThisContainer: ItemInstance[] = [];
    let currentTotalWeight = 0;
    const unplacedReportMap: Map<string, { name: string; count: number; reason: string }> = new Map();
    fallbackColorIndex = 0; // Reset for each container's visual pass

    for (const item of itemsSorted) {
        if (item.placed) continue;

        let bestPlacementForThisItem: {
            itemInstance: ItemInstance;
            anchor: { x: number; y: number; z: number; };
            effL: number; effW: number; effH: number;
        } | null = null;

        const orientationsToTry = generateOrientationsToTry(item);

        for (const rotAngles of orientationsToTry) {
            const itemToPlaceAttempt: ItemInstance = { ...item, appliedRotationAngles: rotAngles, placed: false, containerId: currentContainerId };
            const { L: effL, W: effW, H: effH } = getEffectiveDimensions(itemToPlaceAttempt, rotAngles);
            itemToPlaceAttempt.effectiveLength = effL;
            itemToPlaceAttempt.effectiveWidth = effW;
            itemToPlaceAttempt.effectiveHeight = effH;

            if (currentTotalWeight + itemToPlaceAttempt.weight > containerMaxPayloadKg + EPSILON_PACK) {
                continue;
            }

            const anchorPoints: { x: number, y: number, z: number }[] = [];
            anchorPoints.push({ x: 0, y: 0, z: 0 });

            placedItemsInstancesInThisContainer.forEach(pItem => {
                if (!pItem.meshPosition) return;
                const pPackBaseX = pItem.meshPosition.x - (pItem.effectiveLength / 2) + (containerL_dims / 2) - (pItem.userData?.containerWorldOffsetX || 0);
                const pPackBaseY = pItem.meshPosition.y - (pItem.effectiveHeight / 2);
                const pPackBaseZ = pItem.meshPosition.z - (pItem.effectiveWidth / 2) + (containerW_dims / 2);


                if (!pItem.nonStackable) {
                    anchorPoints.push({ x: pPackBaseX, y: pPackBaseY + pItem.effectiveHeight, z: pPackBaseZ });
                }
                anchorPoints.push({ x: pPackBaseX + pItem.effectiveLength, y: pPackBaseY, z: pPackBaseZ });
                anchorPoints.push({ x: pPackBaseX, y: pPackBaseY, z: pPackBaseZ + pItem.effectiveWidth });
            });
            anchorPoints.sort((a, b) => {
                if (Math.abs(a.x - b.x) > EPSILON_PACK) return a.x - b.x;
                if (Math.abs(a.y - b.y) > EPSILON_PACK) return a.y - b.y;
                return a.z - b.z;
            });

            const uniqueAnchorPoints = anchorPoints.filter((point, index, self) =>
                index === self.findIndex((p) =>
                    Math.abs(p.x - point.x) < EPSILON_PACK && Math.abs(p.y - point.y) < EPSILON_PACK && Math.abs(p.z - point.z) < EPSILON_PACK)
            );

            for (const anchor of uniqueAnchorPoints) {
                if (checkPlacementValidity(itemToPlaceAttempt, effL, effW, effH, anchor.x, anchor.y, anchor.z, containerL_dims, containerW_dims, containerH_dims, placedItemsInstancesInThisContainer)) {
                    if (bestPlacementForThisItem === null ||
                        anchor.x < bestPlacementForThisItem.anchor.x ||
                        (Math.abs(anchor.x - bestPlacementForThisItem.anchor.x) < EPSILON_PACK && anchor.y < bestPlacementForThisItem.anchor.y) ||
                        (Math.abs(anchor.x - bestPlacementForThisItem.anchor.x) < EPSILON_PACK && Math.abs(anchor.y - bestPlacementForThisItem.anchor.y) < EPSILON_PACK && anchor.z < bestPlacementForThisItem.anchor.z)
                    ) {
                        bestPlacementForThisItem = {
                            itemInstance: { ...itemToPlaceAttempt },
                            anchor: { ...anchor },
                            effL, effW, effH
                        };
                    }
                }
            }
        }

        if (bestPlacementForThisItem) {
            const { itemInstance: placedItem, anchor, effL, effW, effH } = bestPlacementForThisItem;
            placedItem.placed = true;
            placedItem.userData = { containerWorldOffsetX }; // Store offset for this placed instance

            placeAndRecordItem(placedItem, anchor.x, anchor.y, anchor.z, containerL_dims, containerW_dims, containerWorldOffsetX, currentContainerId);
            placedItemsInstancesInThisContainer.push(placedItem);
            currentTotalWeight += placedItem.weight;

            const originalItemInstanceInInput = allItemsToPackInput.find(i => i.instanceId === item.instanceId);
            if (originalItemInstanceInInput) originalItemInstanceInInput.placed = true;

            await new Promise(resolve => setTimeout(resolve, 0));
        } else {
            const reason = (currentTotalWeight + item.weight > containerMaxPayloadKg + EPSILON_PACK) ? `Exceeds weight limit (Cont. ${currentContainerId + 1} - BFD).` : `No suitable space/orientation (Cont. ${currentContainerId + 1} - BFD).`;
            const key = `${item.id}_${item.instanceId}_bfd_unplaced_cont${currentContainerId}`;
            const entry = unplacedReportMap.get(key) || { name: item.name, count: 0, reason: reason };
            entry.count = 1;
            entry.reason = reason;
            unplacedReportMap.set(key, entry);
        }
    }

    const finalUnplacedReport: UnplacedReportEntry[] = [];
    unplacedReportMap.forEach((value) => finalUnplacedReport.push({ itemName: value.name, quantity: value.count, reason: value.reason }));

    return {
        packedItemsList: placedItemsInstancesInThisContainer,
        unplacedReport: finalUnplacedReport,
        totalPackedWeight: currentTotalWeight
    };
}

async function handleExportOBJ() {
    const exportButton = document.getElementById('exportOBJButton') as HTMLButtonElement;
    if (!exportButton || !lastPackingResults || lastPackingResults.packedItems.length === 0 || !scene) {
        alert("No valid packing data available to export. Please run a simulation with items first.");
        if (exportButton) exportButton.disabled = true;
        return;
    }
    if (containerMeshes.length === 0) {
        alert("Container visual not ready for export.");
        return;
    }


    const originalButtonText = exportButton.textContent;
    exportButton.textContent = "Exporting...";
    exportButton.disabled = true;

    try {
        const groupToExport = new THREE.Group();

        containerMeshes.forEach(cm => {
            const containerClone = cm.clone();
            groupToExport.add(containerClone);
        });


        packedItemMeshes.forEach(mesh => {
            const itemClone = mesh.clone(true);
            groupToExport.add(itemClone);
        });

        const exporter = new OBJExporter();
        const objData = exporter.parse(groupToExport);

        const blob = new Blob([objData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        const shipmentRefInput = document.getElementById('shipment-reference') as HTMLInputElement;
        const shipmentRef = shipmentRefInput?.value.trim() || "Packing";
        const safeShipmentRef = shipmentRef.replace(/[^a-zA-Z0-9_.-]/g, '_');

        link.download = `CargoOptimizer_3D_Model_${safeShipmentRef}.obj`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        const detailsPanel = document.getElementById('details-panel');
        if (detailsPanel) {
            const currentHTML = detailsPanel.innerHTML;
            const baseHTML = currentHTML.includes("<h3>AI Packing Tips:</h3>") ? currentHTML.split("<h3>AI Packing Tips:</h3>")[0] : currentHTML.split("<h2>Details & Reports</h2>")[0] + "<h2>Details & Reports</h2>" + currentHTML.split("<h2>Details & Reports</h2>").slice(1).join("<h2>Details & Reports</h2>");
            detailsPanel.innerHTML = baseHTML + `<p style="color: green;">3D Model exported as ${link.download}.</p>`;
        }

    } catch (error) {
        console.error("Error exporting OBJ:", error);
        alert("An error occurred while exporting the 3D model. Check the console for details.");
        const detailsPanel = document.getElementById('details-panel');
        if (detailsPanel) {
            const currentHTML = detailsPanel.innerHTML;
            const baseHTML = currentHTML.includes("<h3>AI Packing Tips:</h3>") ? currentHTML.split("<h3>AI Packing Tips:</h3>")[0] : currentHTML.split("<h2>Details & Reports</h2>")[0] + "<h2>Details & Reports</h2>" + currentHTML.split("<h2>Details & Reports</h2>").slice(1).join("<h2>Details & Reports</h2>");
            detailsPanel.innerHTML = baseHTML + `<p style="color: red;">Error exporting 3D model. Check console.</p>`;
        }
    } finally {
        exportButton.textContent = originalButtonText;
        exportButton.disabled = !(lastPackingResults && lastPackingResults.packedItems.length > 0);
    }
}

function consolidateFinalUnplacedReport(reportEntries: UnplacedReportEntry[]): UnplacedReportEntry[] {
    const consolidated: Record<string, { itemName: string; quantity: number; reasons: Set<string> }> = {};
    reportEntries.forEach(report => {
        const key = report.itemName; // Consolidate by item name, reasons might vary across containers
        if (!consolidated[key]) {
            consolidated[key] = { itemName: report.itemName, quantity: 0, reasons: new Set() };
        }
        consolidated[key].quantity += report.quantity;
        consolidated[key].reasons.add(report.reason);
    });
    return Object.values(consolidated).map(cuReport => ({
        itemName: cuReport.itemName, // Corrected from cuReport.name
        quantity: cuReport.quantity,
        reason: Array.from(cuReport.reasons).join('; ')
    }));
}


async function handleOptimizeLoad() {
    const detailsPanel = document.getElementById('details-panel');
    const optimizeButton = document.getElementById('optimizeLoadButton') as HTMLButtonElement;
    const downloadReportBtn = document.getElementById('downloadReportButton') as HTMLButtonElement;
    const exportOBJBtn = document.getElementById('exportOBJButton') as HTMLButtonElement;

    if (!detailsPanel) return;

    if (!isAuthenticated) {
        if (trialSimulationsRemaining <= 0) {
            alert("Your free trial simulations have been used. Please log in or register to continue generating packing previews.");
            showView('login');
            return;
        }
        trialSimulationsRemaining--;
        saveTrialState();
        updateHeaderUI('app');
        if (trialSimulationsRemaining < 0) trialSimulationsRemaining = 0;
    }

    const cLInput = document.getElementById('container-length') as HTMLInputElement;
    const cWInput = document.getElementById('container-width') as HTMLInputElement;
    const cHInput = document.getElementById('container-height') as HTMLInputElement;
    const cMaxPayloadDisplay = document.getElementById('container-max-payload-display') as HTMLSpanElement;
    const cTypeSelect = document.getElementById('container-type-select') as HTMLSelectElement;
    const numContainersSelect = document.getElementById('number-of-containers') as HTMLSelectElement;
    numberOfContainers = parseInt(numContainersSelect.value, 10) as 1 | 2;


    if (!cLInput || !cWInput || !cHInput || !cMaxPayloadDisplay || !cTypeSelect) { alert('Container setup elements missing.'); return; }
    const cL_dims = parseFloat(cLInput.value);
    const cW_dims = parseFloat(cWInput.value);
    const cH_dims = parseFloat(cHInput.value);
    let cMaxPayloadKg_per_container = parseFloat(cMaxPayloadDisplay.textContent || '999999');
    if (isNaN(cMaxPayloadKg_per_container) || cMaxPayloadDisplay.textContent?.includes('N/A')) cMaxPayloadKg_per_container = 999999;

    if (isNaN(cL_dims) || cL_dims <= 0 || isNaN(cW_dims) || cW_dims <= 0 || isNaN(cH_dims) || cH_dims <= 0) { alert('Valid positive container dimensions required.'); return; }

    if (items.length === 0) {
        alert('Add items before generating 3D preview.');
        detailsPanel.innerHTML = '<h2>Details & Reports</h2><p>No items to pack for 3D preview.</p>';
        clearAndResetSceneAndReport(); return;
    }

    if (optimizeButton) optimizeButton.disabled = true;
    if (downloadReportBtn) downloadReportBtn.disabled = true;
    if (exportOBJBtn) exportOBJBtn.disabled = true;
    lastPackingResults = null;
    clearAndResetSceneAndReport();
    updateContainerVisual();

    let algorithmName = currentAlgorithm === 'bfd' ? "Best Fit Decreasing (BFD)" : "First Fit Decreasing (FFD)";

    let baseDetailsHTML = detailsPanel.innerHTML;
    baseDetailsHTML = baseDetailsHTML.includes("<h3>AI Packing Tips:</h3>") ? "<h3>AI Packing Tips:</h3>" + baseDetailsHTML.split("<h3>AI Packing Tips:</h3>")[1] : '<h2>Details & Reports</h2>';

    detailsPanel.innerHTML = baseDetailsHTML + `<p>Generating 3D packing preview for ${numberOfContainers} container(s) using <strong>${algorithmName}</strong>...</p>`;

    try {
        const initialItemInstances: ItemInstance[] = [];
        const preFilterOversizedReportMap: Map<string, { name: string; count: number; reason: string }> = new Map();
        items.forEach(item => {
            for (let i = 0; i < item.quantity; i++) {
                const initialDims = getEffectiveDimensions(item, { x: 0, y: 0, z: 0 });
                const instance: ItemInstance = {
                    ...item, placed: false, instanceId: `${item.id}_instance_${i}`,
                    appliedRotationAngles: { x: 0, y: 0, z: 0 },
                    effectiveLength: initialDims.L, effectiveWidth: initialDims.W, effectiveHeight: initialDims.H,
                    meshPosition: undefined, containerId: undefined, userData: {} // Initialize userData
                };

                let canFitDimensionally = false;
                const orientationsToTry = generateOrientationsToTry(instance);
                for (const rot of orientationsToTry) {
                    const { L, W, H } = getEffectiveDimensions(instance, rot);
                    if (L <= cL_dims + EPSILON_PACK && W <= cW_dims + EPSILON_PACK && H <= cH_dims + EPSILON_PACK) {
                        canFitDimensionally = true;
                        break;
                    }
                }
                if (canFitDimensionally) {
                    initialItemInstances.push(instance);
                } else {
                    const key = `${instance.id}_${instance.instanceId}_dim_oversized_prefilter`;
                    const entry = preFilterOversizedReportMap.get(key) || { name: instance.name, count: 0, reason: "Exceeds container dimensions in all orientations." };
                    entry.count = 1;
                    preFilterOversizedReportMap.set(key, entry);
                }
            }
        });

        let itemsStillToPack = [...initialItemInstances];
        const allPackedItemsAcrossAllContainers: ItemInstance[] = [];
        const weightsPerContainerResult: number[] = [];
        let cumulativeUnplacedReportEntries: UnplacedReportEntry[] = [];

        preFilterOversizedReportMap.forEach(reportEntry => {
            cumulativeUnplacedReportEntries.push({ itemName: reportEntry.name, quantity: reportEntry.count, reason: reportEntry.reason });
        });


        for (let k = 0; k < numberOfContainers; k++) {
            if (itemsStillToPack.length === 0) {
                weightsPerContainerResult.push(0); // No items left to pack for this container
                continue;
            }

            let containerWorldOffsetX = 0;
            if (numberOfContainers === 2) {
                containerWorldOffsetX = (k === 0) ? -((cL_dims / 2) + (CONTAINER_X_GAP / 2)) : ((cL_dims / 2) + (CONTAINER_X_GAP / 2));
            }

            // Ensure items for this attempt are marked as unplaced
            const itemsForCurrentContainerAttempt = itemsStillToPack.map(it => ({ ...it, placed: false, meshPosition: undefined, containerId: k, userData: { ...it.userData } })); // Ensure userData is fresh per attempt

            let resultsForThisContainer: { packedItemsList: ItemInstance[]; unplacedReport: UnplacedReportEntry[]; totalPackedWeight: number; };

            if (currentAlgorithm === 'ffd') {
                resultsForThisContainer = await packItemsFFDAlgorithm(cL_dims, cW_dims, cH_dims, cMaxPayloadKg_per_container, itemsForCurrentContainerAttempt, containerWorldOffsetX, k);
            } else { // bfd
                resultsForThisContainer = await packItemsBFDAlgorithm(cL_dims, cW_dims, cH_dims, cMaxPayloadKg_per_container, itemsForCurrentContainerAttempt, containerWorldOffsetX, k);
            }

            allPackedItemsAcrossAllContainers.push(...resultsForThisContainer.packedItemsList);
            weightsPerContainerResult.push(resultsForThisContainer.totalPackedWeight);
            cumulativeUnplacedReportEntries.push(...resultsForThisContainer.unplacedReport);


            const packedInstanceIdsInThisContainer = new Set(resultsForThisContainer.packedItemsList.map(p => p.instanceId));
            itemsStillToPack = itemsStillToPack.filter(item => !packedInstanceIdsInThisContainer.has(item.instanceId));
        }

        // Items remaining in itemsStillToPack after all containers are processed are truly unplaced.
        itemsStillToPack.forEach(item => {
            cumulativeUnplacedReportEntries.push({ itemName: item.name, quantity: 1, reason: "Not packed in any available container." });
        });

        const finalConsolidatedUnplacedReport = consolidateFinalUnplacedReport(cumulativeUnplacedReportEntries);
        const totalPackedWeightOverall = weightsPerContainerResult.reduce((sum, w) => sum + w, 0);

        const currentContainerSpec = containerTypes.find(ct => ct.name === cTypeSelect.value) || containerTypes[0];
        lastPackingResults = {
            packedItems: allPackedItemsAcrossAllContainers,
            unplacedReport: finalConsolidatedUnplacedReport,
            totalPackedWeight: totalPackedWeightOverall,
            weightsPerContainer: weightsPerContainerResult,
            containerSpec: { name: currentContainerSpec.name, length: cL_dims, width: cW_dims, height: cH_dims, maxPayloadKg: cMaxPayloadKg_per_container },
            algorithmUsed: currentAlgorithm,
            numContainersUsed: numberOfContainers
        };

        let packingMessage = `<h3>3D Packing Preview Summary (${algorithmName}, ${numberOfContainers} Container(s)):</h3>`;
        const totalItemUnitsInput = items.reduce((sum, item) => sum + item.quantity, 0);
        const actualPackedUnitsOverall = allPackedItemsAcrossAllContainers.length;

        packingMessage += `<p>Overall Packed Weight: <strong>${totalPackedWeightOverall.toFixed(2)} kg</strong></p>`;
        weightsPerContainerResult.forEach((weight, index) => {
            packingMessage += `<p>Container ${index + 1} Weight: <strong>${weight.toFixed(2)} kg</strong> / ${cMaxPayloadKg_per_container === 999999 ? 'N/A (Custom)' : cMaxPayloadKg_per_container.toFixed(0)} kg capacity</p>`;
            if (weight > cMaxPayloadKg_per_container + EPSILON_PACK && cMaxPayloadKg_per_container !== 999999) {
                packingMessage += `<p style="color: red; font-weight: bold;">Warning: Container ${index + 1} packed weight exceeds its capacity!</p>`;
            }
        });


        if (actualPackedUnitsOverall === totalItemUnitsInput && finalConsolidatedUnplacedReport.length === 0) packingMessage += `<p style="color: green;">All ${totalItemUnitsInput} item unit(s) visually placed and accounted for across ${numberOfContainers} container(s).</p>`;
        else packingMessage += `<p style="color: orange;">Algorithm accounted for ${actualPackedUnitsOverall} of ${totalItemUnitsInput} item units across ${numberOfContainers} container(s).</p>`;

        if (finalConsolidatedUnplacedReport.length > 0) {
            packingMessage += `<h4>Unplaced Items Details (Overall):</h4><ul>`;
            finalConsolidatedUnplacedReport.forEach(cuReport => {
                packingMessage += `<li><strong>${cuReport.quantity} unit(s) of '${cuReport.itemName}'</strong>: ${cuReport.reason}</li>`;
            });
            packingMessage += `</ul>`;
        } else if (actualPackedUnitsOverall < totalItemUnitsInput) {
            packingMessage += `<p style="color: orange;">Some items could not be placed or were filtered. Check pre-filter (oversized) or algorithm limitations.</p>`;
        }

        detailsPanel.innerHTML = baseDetailsHTML + packingMessage;
        if (downloadReportBtn && allPackedItemsAcrossAllContainers.length > 0) downloadReportBtn.disabled = false;
        if (exportOBJBtn && allPackedItemsAcrossAllContainers.length > 0) exportOBJBtn.disabled = false;


    } catch (error) {
        console.error(`Error during ${algorithmName} packing:`, error);
        detailsPanel.innerHTML = baseDetailsHTML + `<p style="color: red; font-weight: bold;">Error during ${algorithmName} packing. Check console.</p>`;
        clearAndResetSceneAndReport();
    } finally {
        if (optimizeButton) optimizeButton.disabled = false;
    }
}


function updateDimensionLabels(shape: 'box' | 'cylinder') {
    const dim1Label = document.getElementById('item-dimension1-label') as HTMLLabelElement;
    const dim2Label = document.getElementById('item-dimension2-label') as HTMLLabelElement;
    const dim2Input = document.getElementById('item-dimension2') as HTMLInputElement;
    if (!dim1Label || !dim2Label || !dim2Input) return;
    if (shape === 'cylinder') {
        dim1Label.textContent = 'Diameter (m):';
        dim2Label.style.display = 'none';
        dim2Input.style.display = 'none';
        dim2Input.value = (document.getElementById('item-dimension1') as HTMLInputElement).value;
    } else {
        dim1Label.textContent = 'Length (m):';
        dim2Label.style.display = 'block';
        dim2Input.style.display = 'block';
        dim2Input.placeholder = '0.3';
    }
}

function handleAlgorithmChange(event: Event) {
    const selectedValue = (event.target as HTMLInputElement).value as AlgorithmChoice;
    if (currentAlgorithm !== selectedValue) {
        currentAlgorithm = selectedValue;
        clearAndResetSceneAndReport();
        const detailsPanel = document.getElementById('details-panel');
        if (detailsPanel) {
            let currentHTML = detailsPanel.innerHTML;
            const aiTipsStart = currentHTML.indexOf("<h3>AI Packing Tips:</h3>");
            const baseHTML = aiTipsStart !== -1 ? currentHTML.substring(0, aiTipsStart) : '<h2>Details & Reports</h2>';
            let algoText = "First Fit Decreasing (FFD)";
            if (currentAlgorithm === 'bfd') algoText = "Best Fit Decreasing (BFD)";
            detailsPanel.innerHTML = baseHTML + `<p>Algorithm choice changed to <strong>${algoText}</strong>. Generate a new 3D preview.</p>`;
        }
    }
}


function handleContainerTypeChange() {
    const selectElement = document.getElementById('container-type-select') as HTMLSelectElement;
    const lengthInput = document.getElementById('container-length') as HTMLInputElement;
    const widthInput = document.getElementById('container-width') as HTMLInputElement;
    const heightInput = document.getElementById('container-height') as HTMLInputElement;
    const maxPayloadDisplay = document.getElementById('container-max-payload-display') as HTMLSpanElement;

    const selectedType = containerTypes.find(type => type.name === selectElement.value);

    if (selectedType) {
        lengthInput.value = selectedType.length.toString();
        widthInput.value = selectedType.width.toString();
        heightInput.value = selectedType.height.toString();
        maxPayloadDisplay.textContent = selectedType.maxPayloadKg === 999999 ? "N/A (Custom)" : selectedType.maxPayloadKg.toFixed(0) + " kg";

        const isCustom = selectedType.name === "Custom";
        lengthInput.disabled = !isCustom;
        widthInput.disabled = !isCustom;
        heightInput.disabled = !isCustom;
    }
    clearAndResetSceneAndReport();
    updateContainerVisual();
    const detailsPanel = document.getElementById('details-panel');
    if (detailsPanel) {
        let currentHTML = detailsPanel.innerHTML;
        const aiTipsStart = currentHTML.indexOf("<h3>AI Packing Tips:</h3>");
        const baseHTML = aiTipsStart !== -1 ? currentHTML.substring(0, aiTipsStart) : '<h2>Details & Reports</h2>';
        detailsPanel.innerHTML = baseHTML + "<p>Container type/dimensions changed. Generate a new 3D preview.</p>";
    }
}

async function generatePDFReport() {
    if (!lastPackingResults || lastPackingResults.packedItems.length === 0) {
        alert("No packing data available to generate a report. Please run a 3D packing simulation first.");
        return;
    }
    const { packedItems, containerSpec, algorithmUsed, numContainersUsed, weightsPerContainer } = lastPackingResults;
    const shipmentRefInput = document.getElementById('shipment-reference') as HTMLInputElement;
    const shipmentRef = shipmentRefInput ? shipmentRefInput.value.trim() : "N/A";

    const pdfButton = document.getElementById('downloadReportButton') as HTMLButtonElement;
    if (pdfButton) pdfButton.disabled = true;

    const logoUploadInput = document.getElementById('company-logo-upload') as HTMLInputElement;
    const logoFile = logoUploadInput && logoUploadInput.files && logoUploadInput.files.length > 0 ? logoUploadInput.files[0] : null;

    let companyLogoDataURL: string | null = null;
    if (logoFile) {
        companyLogoDataURL = await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string || null);
            reader.onerror = () => { console.error("Error reading logo file."); resolve(null); };
            reader.readAsDataURL(logoFile);
        });
    }

    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let currentY = margin;
    let logoHeightUsed = 0;

    if (companyLogoDataURL) {
        try {
            const imgProps = doc.getImageProperties(companyLogoDataURL);
            const logoMaxHeight = 20;
            const logoMaxWidth = 50;
            let displayLogoWidth = logoMaxWidth;
            let displayLogoHeight = displayLogoWidth / imgProps.width * imgProps.height;

            if (displayLogoHeight > logoMaxHeight) {
                displayLogoHeight = logoMaxHeight;
                displayLogoWidth = displayLogoHeight * imgProps.width / imgProps.height;
            }
            if (displayLogoWidth > logoMaxWidth) {
                displayLogoWidth = logoMaxWidth;
                displayLogoHeight = displayLogoWidth / imgProps.width * imgProps.height;
            }
            doc.addImage(companyLogoDataURL, imgProps.fileType.toUpperCase(), margin, currentY, displayLogoWidth, displayLogoHeight);
            logoHeightUsed = displayLogoHeight;
        } catch (e) {
            console.error("Error adding company logo to PDF:", e);
        }
    }

    doc.setFontSize(10);
    doc.text("CargoOptimizer App", pageWidth - margin, margin + 3, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, pageWidth - margin, margin + 8, { align: 'right' });

    const titleStartY = Math.max(margin + logoHeightUsed + 5, margin + 8 + 5) + 5;
    doc.setFontSize(18);
    doc.text("Equipment Packing Report", pageWidth / 2, titleStartY, { align: 'center' });
    currentY = titleStartY + 10;


    let canvasImageURL = '';
    const viewportElement = document.getElementById('viewport-placeholder');
    if (viewportElement && renderer) {
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
            const canvas = await html2canvas(renderer.domElement, {
                useCORS: true,
                logging: false,
                scale: 1.5,
            });
            canvasImageURL = canvas.toDataURL('image/png');
        } catch (e) {
            console.error("Error capturing 3D scene:", e);
            alert("Could not capture 3D scene for the report.");
        }
    }

    doc.setFontSize(11);
    doc.text(`Following cargo shall be loaded in ${numContainersUsed} x Container(s) - ${containerSpec.name}`, margin, currentY);
    currentY += 5;
    doc.text(`(Per Cont: ${containerSpec.length.toFixed(2)}m L x ${containerSpec.width.toFixed(2)}m W x ${containerSpec.height.toFixed(2)}m H) with your ref. ${shipmentRef || 'N/A'}`, margin, currentY);
    currentY += 5;
    let algoNameText = "First Fit Decreasing (FFD)";
    if (algorithmUsed === 'bfd') algoNameText = "Best Fit Decreasing (BFD)";
    doc.text(`Packing Algorithm Used: ${algoNameText}`, margin, currentY);
    currentY += 8;

    for (let i = 0; i < numContainersUsed; i++) {
        if (i > 0) { // Add page break for subsequent containers if not first
            if (currentY + 40 > pageHeight - margin) { // Check if space for header + some table
                doc.addPage();
                currentY = margin;
            }
        }
        doc.setFontSize(12);
        doc.text(`Container ${i + 1} Summary:`, margin, currentY);
        currentY += 6;

        const summaryTableData: any[][] = [];
        const uniquePackedItemsMap = new Map<string, { item: Item, packedQty: number }>();

        packedItems.filter(pItem => pItem.containerId === i).forEach(pItem => {
            const originalItem = items.find(origI => origI.id === pItem.id);
            if (originalItem) {
                let entry = uniquePackedItemsMap.get(originalItem.id);
                if (!entry) {
                    entry = { item: originalItem, packedQty: 0 };
                    uniquePackedItemsMap.set(originalItem.id, entry);
                }
                entry.packedQty++;
            }
        });

        uniquePackedItemsMap.forEach(entry => {
            const { item, packedQty } = entry;
            summaryTableData.push([
                item.name,
                item.length.toFixed(2), item.width.toFixed(2), item.height.toFixed(2),
                item.weight.toFixed(2),
                `${packedQty}`, // Only packed in this container
                item.color || '#CCCCCC'
            ]);
        });

        if (summaryTableData.length > 0) {
            autoTable(doc, {
                startY: currentY,
                head: [['Cargo Name', 'Length (m)', 'Width (m)', 'Height (m)', 'Weight (kg)', 'Packed Qty', 'Color']],
                body: summaryTableData.map(row => row.slice(0, -1)),
                theme: 'grid',
                headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontSize: 9 },
                bodyStyles: { fontSize: 8 },
                didDrawCell: (data) => {
                    if (data.section === 'body' && data.column.index === 6) {
                        const color = summaryTableData[data.row.index][6] as string;
                        doc.setFillColor(color);
                        doc.rect(data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4, 'F');
                    }
                },
                margin: { left: margin, right: margin }
            });
            currentY = (doc as any).lastAutoTable.finalY + 5;
        } else {
            doc.setFontSize(10);
            doc.text("No items packed in this container.", margin, currentY);
            currentY += 6;
        }

        doc.setFontSize(10);
        doc.text(`Packed Weight in Cont. ${i + 1}: ${weightsPerContainer[i].toFixed(2)} kg / ${containerSpec.maxPayloadKg === 999999 ? 'N/A' : containerSpec.maxPayloadKg.toFixed(0)} kg`, margin, currentY);
        currentY += 8;
    }


    // Overall Summary
    if (currentY + 30 > pageHeight - margin) { doc.addPage(); currentY = margin; } // Space for overall summary
    doc.setFontSize(12);
    doc.text("Overall Shipment Summary:", margin, currentY);
    currentY += 6;

    let totalPackedOriginalCBM = 0;
    packedItems.forEach(pItem => totalPackedOriginalCBM += pItem.length * pItem.width * pItem.height);
    const singleContainerCBM = containerSpec.length * containerSpec.width * containerSpec.height;
    const totalContainerCBM = singleContainerCBM * numContainersUsed;

    doc.setFontSize(10);
    doc.text(`Total Packed (Original Dims) CBM: ${totalPackedOriginalCBM.toFixed(3)} m³ / ${totalContainerCBM.toFixed(3)} m³ (${(totalPackedOriginalCBM / totalContainerCBM * 100).toFixed(1)}%)`, margin, currentY);
    currentY += 5;
    doc.text(`Overall Total Packed Weight: ${lastPackingResults.totalPackedWeight.toFixed(2)} kg`, margin, currentY);
    currentY += 5;
    doc.text(`Total Units Packed (Overall): ${packedItems.length} / ${items.reduce((s, i) => s + i.quantity, 0)}`, margin, currentY);
    currentY += 10;


    if (canvasImageURL) {
        if (currentY + 60 > pageHeight - margin) { doc.addPage(); currentY = margin; } // Check space for image
        try {
            const imgWidth = pageWidth - 2 * margin;
            const imgProperties = doc.getImageProperties(canvasImageURL);
            const imgOriginalWidth = imgProperties.width;
            const imgOriginalHeight = imgProperties.height;
            const imgAspectRatio = imgOriginalWidth / imgOriginalHeight;
            let imgHeight = imgWidth / imgAspectRatio;
            const remainingPageHeight = pageHeight - currentY - margin - 5;
            if (imgHeight > remainingPageHeight) {
                imgHeight = remainingPageHeight;
            }
            if (imgHeight > 0 && remainingPageHeight > 20) {
                doc.addImage(canvasImageURL, 'PNG', margin, currentY, imgWidth, imgHeight);
                currentY += imgHeight + 5;
            } else {
                doc.addPage();
                currentY = margin;
                imgHeight = Math.min(pageHeight - margin * 2 - 5, imgWidth / imgAspectRatio);
                doc.addImage(canvasImageURL, 'PNG', margin, currentY, imgWidth, imgHeight);
                currentY += imgHeight + 5;
            }
        } catch (e) { console.error("Error adding image to PDF:", e); }
    }

    doc.addPage();
    currentY = margin;
    doc.setFontSize(16);
    doc.text("Loading Sequence & Placement Instructions", pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    const instructionTableData: any[][] = [];
    packedItems.forEach((pItem, index) => {
        if (!pItem.meshPosition || pItem.containerId === undefined) return;

        // Calculate local packing coords relative to its container's origin for the report
        const containerOffsetX = (numberOfContainers === 2 && pItem.containerId === 1)
            ? (containerSpec.length / 2) + (CONTAINER_X_GAP / 2)
            : (numberOfContainers === 2 && pItem.containerId === 0)
                ? -((containerSpec.length / 2) + (CONTAINER_X_GAP / 2))
                : 0;

        const itemBaseX_pack_local = (pItem.meshPosition.x - containerOffsetX) - pItem.effectiveLength / 2 + containerSpec.length / 2;
        const itemBaseY_pack_local = pItem.meshPosition.y - pItem.effectiveHeight / 2;
        const itemBaseZ_pack_local = pItem.meshPosition.z - pItem.effectiveWidth / 2 + containerSpec.width / 2;


        instructionTableData.push([
            index + 1,
            `Cont. ${pItem.containerId + 1}`,
            pItem.name,
            pItem.color || '#CCCCCC',
            `${pItem.length.toFixed(2)}x${pItem.width.toFixed(2)}x${pItem.height.toFixed(2)}`,
            `X:${itemBaseX_pack_local.toFixed(2)}, Y:${itemBaseY_pack_local.toFixed(2)}, Z:${itemBaseZ_pack_local.toFixed(2)} (in Cont.)`,
            `X:${(pItem.appliedRotationAngles.x * 180 / Math.PI).toFixed(0)}°, Y:${(pItem.appliedRotationAngles.y * 180 / Math.PI).toFixed(0)}°, Z:${(pItem.appliedRotationAngles.z * 180 / Math.PI).toFixed(0)}°`
        ]);
    });

    autoTable(doc, {
        startY: currentY,
        head: [['Step', 'Container', 'Item Name', 'Color', 'Orig. Dims (LxWxH)', 'Placement (from Back-Left-Bottom of its Cont.)', 'Orientation (°X,Y,Z)']],
        body: instructionTableData.map(row => [row[0], row[1], row[2], '', row[4], row[5], row[6]]),
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 3) { // Color column
                const color = instructionTableData[data.row.index][3] as string;
                doc.setFillColor(color);
                doc.rect(data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2, 'F');
            }
        },
        margin: { left: margin, right: margin }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount} / Created on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
            pageWidth / 2, pageHeight - margin / 2, { align: 'center' });
    }

    if (pdfButton) pdfButton.disabled = false;
    doc.save(`CargoOptimizer_Report_${shipmentRef.replace(/[^a-zA-Z0-9]/g, '_') || 'Packing'}.pdf`);
}

function handleExportXLSXTemplate() {
    const headers = [
        'Item Name', 'Shape (box/cylinder)', 'Dim1_Length_or_Diameter (m)',
        'Dim2_Width_for_Box (m)', 'Height (m)', 'Weight (kg)', 'Quantity',
        'NonStackable (TRUE/FALSE)', 'RotateX_Allowed (TRUE/FALSE)',
        'RotateY_Allowed (TRUE/FALSE)', 'RotateZ_Allowed (TRUE/FALSE)',
        'Color (hex, e.g. #RRGGBB - optional)'
    ];
    const exampleData = [
        ['Example Box', 'box', 1.2, 0.8, 0.5, 25, 2, 'FALSE', 'TRUE', 'TRUE', 'FALSE', '#FFC0CB'],
        ['Example Cylinder', 'cylinder', 0.6, '', 1.0, 15, 3, 'TRUE', 'FALSE', 'FALSE', 'TRUE', '#ADD8E6']
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Items');
    XLSX.writeFile(wb, 'CargoOptimizer_Items_Template.xlsx');
    const detailsPanel = document.getElementById('details-panel');
    if (detailsPanel) {
        let currentHTML = detailsPanel.innerHTML;
        const aiTipsStart = currentHTML.indexOf("<h3>AI Packing Tips:</h3>");
        const baseHTML = aiTipsStart !== -1 ? currentHTML.substring(0, aiTipsStart) : '<h2>Details & Reports</h2>';
        detailsPanel.innerHTML = baseHTML + '<p>XLSX template downloaded. Fill it and use the import option.</p>';
    }
}

function parseBooleanFlexible(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const lowerVal = value.toLowerCase().trim();
        if (lowerVal === 'true' || lowerVal === 'yes' || lowerVal === '1') return true;
        if (lowerVal === 'false' || lowerVal === 'no' || lowerVal === '0') return false;
    }
    if (typeof value === 'number') {
        return value === 1;
    }
    return false;
}

function handleImportXLSX() {
    const fileInput = document.getElementById('import-xlsx-file') as HTMLInputElement;
    const file = fileInput.files ? fileInput.files[0] : null;

    if (!file) {
        alert('Please select an XLSX file to import.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = e.target?.result;
            if (!data) {
                alert('Could not read file data.');
                return;
            }
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false }) as any[][];

            if (jsonData.length < 2) {
                alert('XLSX file is empty or has no data rows.');
                return;
            }

            const newItems: Item[] = [];
            let importedCount = 0;
            let skippedCount = 0;

            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
                    continue;
                }
                try {
                    const name = String(row[0] || '').trim();
                    const shapeStr = String(row[1] || 'box').toLowerCase().trim();
                    const dim1 = parseFloat(String(row[2]));
                    const dim2Str = String(row[3]);
                    const height = parseFloat(String(row[4]));
                    const weight = parseFloat(String(row[5]));
                    const quantity = parseInt(String(row[6]), 10);
                    const nonStackable = parseBooleanFlexible(row[7]);
                    const allowX = parseBooleanFlexible(row[8]);
                    const allowY = parseBooleanFlexible(row[9]);
                    const allowZ = parseBooleanFlexible(row[10]);
                    let color = String(row[11] || '').trim();

                    if (!name) {
                        console.warn(`Skipping row ${i + 1}: Item name is missing.`);
                        skippedCount++;
                        continue;
                    }
                    const shape: 'box' | 'cylinder' = (shapeStr === 'cylinder') ? 'cylinder' : 'box';

                    let length: number, width: number;
                    if (isNaN(dim1) || dim1 <= 0) {
                        console.warn(`Skipping row ${i + 1} ('${name}'): Invalid Dimension 1.`);
                        skippedCount++; continue;
                    }

                    if (shape === 'box') {
                        const parsedDim2 = parseFloat(dim2Str);
                        if (isNaN(parsedDim2) || parsedDim2 <= 0) {
                            console.warn(`Skipping row ${i + 1} ('${name}'): Invalid Dimension 2 for box.`);
                            skippedCount++; continue;
                        }
                        length = dim1; width = parsedDim2;
                    } else {
                        length = dim1; width = dim1;
                    }

                    if (isNaN(height) || height <= 0) { console.warn(`Skipping row ${i + 1} ('${name}'): Invalid Height.`); skippedCount++; continue; }
                    if (isNaN(weight) || weight < 0) { console.warn(`Skipping row ${i + 1} ('${name}'): Invalid Weight.`); skippedCount++; continue; }
                    if (isNaN(quantity) || quantity <= 0) { console.warn(`Skipping row ${i + 1} ('${name}'): Invalid Quantity.`); skippedCount++; continue; }

                    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
                        console.warn(`Row ${i + 1} ('${name}'): Invalid color format '${color}'. Using random color.`);
                        color = getRandomPastelColorHex();
                    } else if (!color) {
                        color = getRandomPastelColorHex();
                    }

                    const newItem: Item = {
                        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        name, shape, length, width, height, weight, quantity, nonStackable,
                        color: color,
                        rotationPreferences: { allowX, allowY, allowZ }
                    };
                    newItems.push(newItem);
                    importedCount++;
                } catch (parseError) {
                    console.warn(`Error parsing row ${i + 1}:`, parseError, row);
                    skippedCount++;
                }
            }

            if (newItems.length > 0) {
                items.push(...newItems);
                saveItemsToLocalStorage();
                renderItems();
                clearAndResetSceneAndReport();
                const detailsPanel = document.getElementById('details-panel');
                if (detailsPanel) {
                    let currentHTML = detailsPanel.innerHTML;
                    const aiTipsStart = currentHTML.indexOf("<h3>AI Packing Tips:</h3>");
                    const baseHTML = aiTipsStart !== -1 ? currentHTML.substring(0, aiTipsStart) : '<h2>Details & Reports</h2>';
                    detailsPanel.innerHTML = baseHTML + `<p>${importedCount} items imported from XLSX. ${skippedCount > 0 ? `${skippedCount} rows skipped (check console).` : ''} List updated.</p>`;
                }
            }
            alert(`Imported ${importedCount} items. ${skippedCount > 0 ? `${skippedCount} rows were skipped due to errors (see console for details).` : 'All valid rows imported.'}`);

        } catch (error) {
            console.error('Error processing XLSX file:', error);
            alert('Error processing XLSX file. Please ensure it is a valid .xlsx file and matches the template format. Check console for details.');
        } finally {
            fileInput.value = '';
        }
    };
    reader.onerror = () => {
        alert('Error reading the file. Please try again.');
        console.error('FileReader error:', reader.error);
        fileInput.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function setupCollapsibleSections() {
    const controlsPanel = document.getElementById('controls-panel');
    if (!controlsPanel) return;

    controlsPanel.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const toggleButton = target.closest('.collapsible-toggle-button') as HTMLButtonElement | null;

        if (toggleButton) {
            const contentId = toggleButton.getAttribute('aria-controls');
            if (!contentId) return;

            const contentElement = document.getElementById(contentId);
            if (!contentElement) return;

            const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';

            toggleButton.setAttribute('aria-expanded', String(!isExpanded));
            contentElement.style.display = isExpanded ? 'none' : '';
        }
    });
}

function setupRotationTooltips() {
    if (rotationAxisTooltipElement) { // Already created
        document.body.removeChild(rotationAxisTooltipElement);
    }
    rotationAxisTooltipElement = document.createElement('div');
    rotationAxisTooltipElement.id = 'rotation-axis-tooltip';
    document.body.appendChild(rotationAxisTooltipElement);

    const rotationLabels = [
        { id: 'rot-allowX', text: "<strong>X-axis (Pitch):</strong> Allows item to tilt forwards/backwards (rotation around its Length axis). Think of an airplane's nose pitching up/down." },
        { id: 'rot-allowY', text: "<strong>Y-axis (Yaw):</strong> Allows item to turn left/right (rotation around its Height axis). Think of an item spinning on the spot if upright." },
        { id: 'rot-allowZ', text: "<strong>Z-axis (Roll):</strong> Allows item to tilt side-to-side (rotation around its Width axis). Think of an airplane's wings rolling left/right." },
    ];

    rotationLabels.forEach(item => {
        const label = document.querySelector(`label[for="${item.id}"]`);
        if (label && rotationAxisTooltipElement) {
            const currentTooltip = rotationAxisTooltipElement; // Capture for closure
            label.addEventListener('mouseenter', (event) => {
                const targetLabel = event.currentTarget as HTMLElement;
                const rect = targetLabel.getBoundingClientRect();
                currentTooltip.innerHTML = item.text;
                currentTooltip.style.left = `${rect.left + window.scrollX}px`;
                currentTooltip.style.top = `${rect.bottom + window.scrollY + 5}px`; // 5px below the label
                currentTooltip.style.display = 'block';
            });
            label.addEventListener('mouseleave', () => {
                currentTooltip.style.display = 'none';
            });
        }
    });
}


function initializeApp() {
    loadItemsFromLocalStorage();
    initThreeScene();
    setupCollapsibleSections();
    setupRotationTooltips();

    const containerTypeSelect = document.getElementById('container-type-select') as HTMLSelectElement;
    if (containerTypeSelect) {
        containerTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.name;
            option.textContent = type.name;
            containerTypeSelect.appendChild(option);
        });
        containerTypeSelect.value = "Custom";
        containerTypeSelect.addEventListener('change', handleContainerTypeChange);
        handleContainerTypeChange();
    }

    const numContainersSelect = document.getElementById('number-of-containers') as HTMLSelectElement;
    if (numContainersSelect) {
        numContainersSelect.addEventListener('change', () => {
            numberOfContainers = parseInt(numContainersSelect.value, 10) as 1 | 2;
            clearAndResetSceneAndReport();
            updateContainerVisual();
            const detailsPanel = document.getElementById('details-panel');
            if (detailsPanel) {
                let currentHTML = detailsPanel.innerHTML;
                const aiTipsStart = currentHTML.indexOf("<h3>AI Packing Tips:</h3>");
                const baseHTML = aiTipsStart !== -1 ? currentHTML.substring(0, aiTipsStart) : '<h2>Details & Reports</h2>';
                detailsPanel.innerHTML = baseHTML + `<p>Number of containers changed to ${numberOfContainers}. Generate a new 3D preview.</p>`;
            }
        });
    }


    const itemUseRandomColorCheckbox = document.getElementById('item-use-random-color') as HTMLInputElement;
    const itemColorInput = document.getElementById('item-color') as HTMLInputElement;

    if (itemUseRandomColorCheckbox && itemColorInput) {
        itemUseRandomColorCheckbox.addEventListener('change', () => {
            itemColorInput.disabled = itemUseRandomColorCheckbox.checked;
        });
        itemColorInput.disabled = itemUseRandomColorCheckbox.checked;
    }

    document.getElementById('getPackingTipsButton')?.addEventListener('click', getPackingTips);
    document.getElementById('addItemButton')?.addEventListener('click', handleAddItem);
    document.getElementById('optimizeLoadButton')?.addEventListener('click', handleOptimizeLoad);
    document.getElementById('downloadReportButton')?.addEventListener('click', generatePDFReport);
    document.getElementById('exportOBJButton')?.addEventListener('click', handleExportOBJ);
    document.getElementById('cancelEditButton')?.addEventListener('click', cancelEditMode);
    document.getElementById('clearCachedItemsButton')?.addEventListener('click', handleClearCachedItems);
    document.getElementById('exportXLSXTemplateButton')?.addEventListener('click', handleExportXLSXTemplate);
    document.getElementById('importXLSXButton')?.addEventListener('click', handleImportXLSX);

    document.querySelectorAll('input[name="algorithm-choice"]').forEach(radio => {
        radio.addEventListener('change', handleAlgorithmChange);
    });

    document.getElementById('item-list-container')?.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (target.classList.contains('edit-item-button')) {
            const itemId = target.dataset.id; if (itemId) handleStartEditItem(itemId);
        } else if (target.classList.contains('delete-item-button')) {
            const itemId = target.dataset.id;
            const itemToDelete = items.find(i => i.id === itemId);
            if (itemId && confirm(`Are you sure you want to delete item ${itemToDelete?.name || 'this item'}?`)) {
                handleDeleteItem(itemId);
            }
        }
    });

    document.querySelectorAll('input[name="item-shape"]').forEach(radio => {
        radio.addEventListener('change', (event) => {
            const shape = (event.target as HTMLInputElement).value as 'box' | 'cylinder';
            updateDimensionLabels(shape);
            if (shape === 'cylinder') {
                const dim1Input = document.getElementById('item-dimension1') as HTMLInputElement;
                const dim2Input = document.getElementById('item-dimension2') as HTMLInputElement;
                if (dim1Input && dim2Input) dim2Input.value = dim1Input.value;
            }
        });
    });
    const dim1Input = document.getElementById('item-dimension1') as HTMLInputElement;
    const dim2Input = document.getElementById('item-dimension2') as HTMLInputElement;
    if (dim1Input && dim2Input) {
        dim1Input.addEventListener('input', () => {
            const selectedShapeRadio = document.querySelector('input[name="item-shape"]:checked') as HTMLInputElement | null;
            if (selectedShapeRadio?.value === 'cylinder') {
                dim2Input.value = dim1Input.value;
            }
        });
    }

    updateDimensionLabels((document.querySelector('input[name="item-shape"]:checked') as HTMLInputElement)?.value as 'box' | 'cylinder' || 'box');

    [document.getElementById('container-length'), document.getElementById('container-width'), document.getElementById('container-height')].forEach(input => {
        if (input) {
            input.addEventListener('change', () => {
                const containerTypeSelectEl = document.getElementById('container-type-select') as HTMLSelectElement;
                if (containerTypeSelectEl && containerTypeSelectEl.value !== "Custom") {
                    containerTypeSelectEl.value = "Custom";
                    handleContainerTypeChange();
                } else {
                    clearAndResetSceneAndReport();
                    updateContainerVisual();
                    const detailsPanel = document.getElementById('details-panel');
                    if (detailsPanel) {
                        let currentHTML = detailsPanel.innerHTML;
                        const aiTipsStart = currentHTML.indexOf("<h3>AI Packing Tips:</h3>");
                        const baseHTML = aiTipsStart !== -1 ? currentHTML.substring(0, aiTipsStart) : '<h2>Details & Reports</h2>';
                        detailsPanel.innerHTML = baseHTML + "<p>Container dimensions changed. Generate a new 3D preview.</p>";
                    }
                }
            });
        }
    });
    if (!apiKey && document.getElementById('details-panel')) (document.getElementById('details-panel') as HTMLElement).innerHTML = '<p style="color: orange; font-weight: bold;">API_KEY not configured. AI features unavailable.</p>';
    resetItemForm();
    renderItems();
}


// Dentro de document.addEventListener('DOMContentLoaded', () => { ... }) em src/index.tsx

document.addEventListener('DOMContentLoaded', () => {
    // Lógica para capturar o token da URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
        // Se encontramos um token, o salvamos e limpamos a URL
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        // Redireciona para a raiz da aplicação sem os parâmetros na URL
        window.history.replaceState({}, document.title, "/");
    }

    setupAuthEventListeners();
    checkAuthState(); // Esta função agora encontrará o token salvo
});
// Dentro de src/index.tsx

document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('register-email') as HTMLInputElement).value;
    const password = (document.getElementById('register-password') as HTMLInputElement).value;
    const confirmPassword = (document.getElementById('register-confirm-password') as HTMLInputElement).value;

    if (password !== confirmPassword) {
        alert("As senhas não coincidem!");
        return;
    }

    try {
        // A função agora retorna a mensagem de sucesso do backend
        const result = await authApi.registerUser(email, password);

        // Exibe a mensagem de sucesso real do backend
        alert(result.message);

        // Mostra a tela para inserir o token
        showView('verify-email');

    } catch (error: any) {
        // O bloco 'catch' agora só será acionado para erros reais (4xx, 5xx)
        console.error('Falha na requisição de registro:', error);
        alert(`Erro no registro: ${error.message}`);
    }
});