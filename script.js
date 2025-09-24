let localizacionesDisponibles = [];

async function cargarLocalizaciones() {
  try {
    const response = await fetch('localizaciones_stanton_flap.json');
    const data = await response.json();

    // The first and last lines of the file are not locations, so we skip them.
    localizacionesDisponibles = data.slice(1, -1);

    const locationLists = document.querySelectorAll("#locations-datalist");
    locationLists.forEach(list => {
      list.innerHTML = '';
      localizacionesDisponibles.forEach(location => {
        if (!location.includes(':')) return; // Skip invalid entries

        const parts = location.split(':');
        const tipo = parts[0].trim();
        const nombreUbicacion = parts.slice(1).join(':').trim();
        const nombreMatch = nombreUbicacion.match(/^(.*?)(?:\s\(|$)/);
        const nombre = nombreMatch ? nombreMatch[1].trim() : nombreUbicacion;

        const option = document.createElement("option");
        option.value = `${tipo}: ${nombre}`;
        option.setAttribute("data-tipo", tipo);
        list.appendChild(option);
      });
    });

    console.log("Localizaciones cargadas correctamente para datalists.");
  } catch (error) {
    console.error("Error al cargar o procesar localizaciones_stanton_flap.json:", error);
  }
}

let materialesDisponibles = [];

async function cargarMateriales() {
  try {
    const response = await fetch('materiales.json');
    const data = await response.json();

    materialesDisponibles = data.materials;

    const materialList = document.getElementById("materials-datalist");
    materialList.innerHTML = '';

    materialesDisponibles.forEach(material => {
      const option = document.createElement("option");
      option.value = material;
      materialList.appendChild(option);
    });

    console.log("Materiales cargados correctamente");
  } catch (error) {
    console.error("Error al cargar materiales.json:", error);
  }
}

import "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js";

// Cargar distancias para planificación de ruta
let distances = {};
let distanceNodes = new Set();

function loadDistances() {
  fetch('distancias_stanton.json')
    .then(res => res.text())
    .then(txt => {
      let parsed = null;
      try { parsed = JSON.parse(txt); } catch (_) { parsed = null; }
      const map = {};
      if (parsed && !Array.isArray(parsed) && parsed.distance && Array.isArray(parsed.distance)) {
        // Si por alguna razón parsed.distance fuese válido (array), igualmente extraemos con regex del texto crudo
      }
      // Extraer todos los pares "clave": valor del texto crudo
      const pairRegex = /"(\([^"]+\)\s-\s\([^"]+\))"\s*:\s*([0-9.]+)/g;
      let m;
      while ((m = pairRegex.exec(txt)) !== null) {
        map[m[1]] = parseFloat(m[2]);
      }
      distances = map;
      // Poblar nodos desde las claves "(A) - (B)"
      const nodeRegex = /\(([^)]+)\)\s-\s\(([^)]+)\)/g;
      let n;
      while ((n = nodeRegex.exec(txt)) !== null) {
        distanceNodes.add(`(${n[1]})`);
        distanceNodes.add(`(${n[2]})`);
      }
    })
    .catch(err => console.error('Error cargando distancias:', err));
}
loadDistances();

// Función de acceso a distancias
function calculateDistancia(orig, dest) {
  const key1 = `${orig} - ${dest}`, key2 = `${dest} - ${orig}`;
  if (distances[key1] != null) return distances[key1];
  if (distances[key2] != null) return distances[key2];
  return Infinity;
}

/* Global: parse a location string like "Place (Stanton - MIC-L1)" */
function parseLocation(locationString) {
  if (!locationString) return { name: '', details: null };
  const match = locationString.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match && match[1] && match[2]) {
    return { name: match[1].trim(), details: match[2].trim() };
  }
  return { name: (locationString || '').trim(), details: null };
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/* lightweight sound helper */
const SOUND_MAP = { confirm: new Audio('confirm.mp3') };
function playSound(name) {
  const a = SOUND_MAP[name];
  if (a) { try { a.currentTime = 0; a.play(); } catch(_) {} }
}

document.addEventListener("DOMContentLoaded", () => {

  // Load data for datalists when the page loads
  cargarLocalizaciones();
  cargarMateriales();

  const createMissionDropdown = document.getElementById('create-mission-dropdown');
  const missionTableBody = document.getElementById('mission-table-body');
  const locationTableBody = document.getElementById('location-table-body');
  const pickupLocationTableBody = document.getElementById('pickup-location-table-body');
  const historyTableBody = document.getElementById('history-table-body');
  const clearAllButton = document.getElementById('clear-all');
  const loadAllPendingButton = document.getElementById('load-all-pending');
  const noMissionsRow = document.getElementById('no-missions-row');
  const missionCardsContainer = document.getElementById('mission-cards-container');
  const noMissionsMessage = document.getElementById('no-missions-message-mission-view');
  const summaryFooter = document.getElementById('summary-footer');
  
  const addMaterialFormContainer = document.getElementById('add-material-form-container');
  const addMaterialFormTitle = document.getElementById('add-material-form-title');
  const materialForm = document.getElementById('material-form');
  const missionIdInput = document.getElementById('missionId');
  const cargoIdInput = document.getElementById('cargoId');
  const cancelAddMaterialBtn = document.getElementById('cancel-add-material-btn');
  const submitMaterialBtn = document.getElementById('submit-material-btn');
  const totalScuInput = document.getElementById('totalScu');
  const containerBreakdownSection = document.getElementById('container-breakdown-section');
  const containerValidationMessage = document.getElementById('container-validation-message');
  const historySummaryFooter = document.getElementById('history-summary-footer');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const resetScuInputsBtn = document.getElementById('reset-scu-inputs');
  const currentBalanceInput = document.getElementById('currentBalanceInput');
  const historyTotalEarningsSpan = document.getElementById('history-total-earnings');
  const historyFinalBalanceSpan = document.getElementById('history-final-balance');
  const missionPayoutOnCreateInput = document.getElementById('missionPayoutOnCreate');

  let isNewMissionCreation = false;

  const createShipModalEl = document.getElementById('create-ship-modal');
  const createShipModal = new bootstrap.Modal(createShipModalEl);
  const createShipForm = document.getElementById('create-ship-form');
  const createShipNameInput = document.getElementById('createShipName');
  const createShipTotalScuInput = document.getElementById('createShipTotalScu');
  const createQuantumFuelCapacityInput = document.getElementById('createQuantumFuelCapacity'); 
  const createQuantumTravelSpeedInput = document.getElementById('createQuantumTravelSpeed'); 
  const addPlatformBtnCreate = document.getElementById('add-platform-btn-create');
  const removePlatformBtnCreate = document.getElementById('remove-platform-btn-create');
  const createShipPlatformsContainer = document.getElementById('create-ship-platforms-container');
  const shipContainer = document.getElementById('ship-container');

  const editShipDetailsModalEl = document.getElementById('edit-ship-details-modal');
  const editShipDetailsModal = new bootstrap.Modal(editShipDetailsModalEl);
  const editShipForm = document.getElementById('edit-ship-form');
  const editShipIdInput = document.getElementById('editShipId');
  const editShipNameInput = document.getElementById('editShipName');
  const editShipTotalScuInput = document.getElementById('editShipTotalScu');
  const editQuantumFuelCapacityInput = document.getElementById('editQuantumFuelCapacity'); 
  const editQuantumTravelSpeedInput = document.getElementById('editQuantumTravelSpeed'); 
  const addPlatformBtnEdit = document.getElementById('add-platform-btn-edit');
  const removePlatformBtnEdit = document.getElementById('remove-platform-btn-edit');
  const editShipPlatformsContainer = document.getElementById('edit-ship-platforms-container');
  const saveEditedShipBtn = document.getElementById('save-edited-ship-btn');

  const editMissionModalEl = document.getElementById('editMissionModal');
  const editMissionModal = new bootstrap.Modal(editMissionModalEl);
  const editMissionForm = document.getElementById('edit-mission-form');
  const editMissionIdInput = document.getElementById('editMissionId');
  const editMissionNameInput = document.getElementById('editMissionName');
  const editMissionPayoutInput = document.getElementById('editMissionPayout');
  const editMissionTypeInput = document.getElementById('editMissionType');

  const platformCargoLoadModalEl = document.getElementById('platformCargoLoadModal');
  const platformCargoLoadModal = new bootstrap.Modal(platformCargoLoadModalEl);
  const currentLoadingShipPlatformSpan = document.getElementById('current-loading-ship-platform');
  const platformLoadValidationMessage = document.getElementById('platform-load-validation-message');
  const pendingCargoListDiv = document.getElementById('pending-cargo-list');
  const currentPlatformLoadedCargoDiv = document.getElementById('current-platform-loaded-cargo');

  const manageDataModalEl = document.getElementById('manageDataModal');
  const materialsListTextarea = document.getElementById('materials-list');
  const locationsListTextarea = document.getElementById('locations-list');
  const saveDataListsBtn = document.getElementById('save-data-lists-btn');
  const materialsDatalist = document.getElementById('materials-datalist');
  const locationsDatalist = document.getElementById('locations-datalist');
  document.getElementById("clear-cache-btn").addEventListener("click", () => {
    if (confirm("¿Estás seguro de que quieres borrar la caché local? Se eliminarán todas las listas y datos guardados localmente.")) {
      localStorage.clear();
      sessionStorage.clear();

      if ('caches' in window) {
        caches.keys().then(names => {
          for (let name of names) {
            caches.delete(name);
          }
        });
      }

      alert("Caché local eliminada. Recarga la página para ver los cambios.");
      location.reload(); 
    }
  });

  const langSwitcher = document.getElementById('lang-switcher');
  const langFlag = document.getElementById('lang-flag');
  let currentLang = localStorage.getItem('lang') || 'es';

  const handlePlatformCapacityFocus = (e) => {
    if (e.target.classList.contains('platform-capacity-input') && e.target.value === '1') {
      e.target.value = '';
    }
  };

  createShipPlatformsContainer.addEventListener('focusin', handlePlatformCapacityFocus);
  editShipPlatformsContainer.addEventListener('focusin', handlePlatformCapacityFocus);

  const imageModalEl = document.getElementById('imageModal');
  const imageModal = new bootstrap.Modal(imageModalEl);
  const modalImage = document.getElementById('modalImage');

  const translations = {
    es: {
      title: "SC CARGO ORGANIZER",
      mission_management: "GESTIÓN DE MISIONES",
      create_new_mission: "Crear Nueva Misión",
      local: "Local",
      planetary: "Planetario",
      system: "Sistema",
      material: "Material",
      material_placeholder: "Ej: Oro, Laranita",
      pickup_location: "Lugar de Recogida",
      pickup_location_placeholder: "Ej: Grim HEX",
      dropoff_location: "Lugar de Entrega",
      dropoff_location_placeholder: "Ej: Area 18",
      total_scu: "Total SCU",
      total_scu_placeholder: "Ej: 32",
      container_breakdown_label: "Cantidad de Contenedores por tamaño (SCU)",
      cancel: "Cancelar",
      add_material: "Agregar Material",
      save_changes: "Guardar Cambios",
      cargo_summary: "RESUMEN DE CARGA",
      load_all_pending: "Cargar Todo lo Pendiente",
      clear_all: "Limpiar Todo",
      clear_cache: "Borrar Caché",
      by_mission: "Por Misión",
      by_pickup_location: "Por Lugar de Recogida",
      by_dropoff_location: "Por Lugar de Entrega",
      pickup: "Recogida",
      dropoff: "Entrega",
      containers: "Contenedores",
      status: "Estado",
      actions: "Acciones",
      no_active_missions: 'No hay misiones activas. Haz clic en "Crear Nueva Misión" para comenzar.',
      mission: "Misión",
      footer_note: "Creado por Manumg84 para la comunidad de Star Citizen.",
      manage_lists: "Gestionar Listas",
      materials_list: "Lista de Materiales",
      materials_list_desc: 'Introduzca un material por línea. Estos aparecerán como sugerencias en el campo "Material".',
      locations_list: "Lista de Lugares",
      locations_list_desc: 'Introduzca un lugar por línea. Estos aparecerán en los campos de "Recogida" y "Entrega".',
      close: "Cerrar",
      save_lists: "Guardar Listas",
      edit_mission: "Editar Misión",
      mission_name: "Nombre de la Misión",
      mission_type: "Tipo de Misión",
      payout_auec: "Ganancia (aUEC)",
      add_material_to: "Añadir Material a",
      edit_material_in: "Editar Material en",
      unspecified: "Sin especificar",
      unspecified_title: "Contenedores no especificados",
      payout: "Ganancia",
      no_payout: "Sin Paga",
      pending_scu: "Pendiente",
      loaded_scu: "Cargado",
      total_scu_summary: "Total",
      mission_default_name: "Misión",
      loaded: "Cargado",
      delivered: "Entregado",
      pending: "Pendiente",
      scu_assigned_validation: (current, total, remaining) => `SCU Asignado: ${current} / ${total}. <span class="${remaining === 0 ? 'text-success' : 'text-warning'}">Faltan ${remaining} SCU por asignar.</span>`,
      history: "Historial",
      completion_date: "Fecha de Finalización",
      clear_history: "Limpiar Historial",
      total_earnings: "Ganancias Totales",
      no_completed_misions: "No hay misiones completadas en el historial.",
      restore_mission_prompt: "¿Estás seguro de que quieres restaurar esta misión a la lista de misiones activas?",
      restore_mission_title: "Restaurar Misión",
      cargo_zone: "Zona de Carga",
      ship_management: "Gestión de Naves",
      create_ship: "Crear Nave",
      ship_name: "Nombre de la Nave",
      total_ship_scu: "Capacidad Total SCU",
      quantum_fuel_capacity: "Capacidad Combustible Quantum (scu Quantum)", 
      quantum_fuel_capacity_placeholder: "Ej: 1000", 
      quantum_travel_speed: "Velocidad Viaje Quantum (km/s)", 
      quantum_travel_speed_placeholder: "Ej: 200000", 
      add_platform: "Añadir Plataforma",
      remove_last_platform: "Eliminar Última",
      platform_name: "Nombre Plataforma",
      platform_scu_capacity: "Capacidad SCU Plataforma",
      no_ships_message: 'No hay naves creadas. Haz clic en "Crear Nave" para añadir una.',
      save: "Guardar",
      manage_cargo_placement: "Gestionar Carga", 
      current_ship_load: "Carga Actual de la Nave:",
      no_ship_selected: "Selecciona una nave para ver su carga.",
      unassigned_cargo_scu: (scu) => `SCU sin asignar: ${scu}`,
      unassigned: "Sin asignar",
      not_enough_capacity: "No hay suficiente capacidad en esta plataforma para este contenedor.",
      cargo_already_loaded: "Esta carga ya está cargada en la nave y plataforma seleccionadas.", 
      cargo_unloaded: "Carga descargada correctamente.", 
      confirm_unload: "¿Estás seguro de que quieres descargar esta carga de la nave?",
      cargo_loaded_onto: (material, shipName, platformName) => `Carga "${material}" asignada a ${shipName} (${platformName}).`, 
      unload_cargo: "Descargar Carga",
      delete_ship: "Eliminar Nave",
      edit_ship: "Editar Nave",
      load_cargo_onto_platform: "Cargar Carga en Plataforma",
      loading_for: "Cargando para:",
      pending_cargo_for_assignment: "Carga Pendiente para Asignar",
      current_platform_load: "Carga Actual de la Plataforma",
      no_pending_cargo: "No hay carga pendiente.",
      no_cargo_on_platform: "No hay carga en esta plataforma.",
      confirm_unload_container: "¿Estás seguro de que quieres descargar este contenedor?",
      container_loaded_onto: (size, material, platformName) => `Contenedor ${size} SCU de ${material} cargado en ${platformName}.`,
      container_unloaded: "Contenedor descargado.",
      current_balance_label: "Saldo Actual",
      final_balance: "Saldo Final",
      cargo_ships: "Naves de Carga",
      transport_routes: "Rutas de Transporte", 
      customize_theme: "Personalizar Tema",
      theme_primary: "Color Primario",
      theme_background: "Color de Fondo",
      theme_text: "Color del Texto",
      theme_input_bg: "Fondo de Inputs",
      theme_input_border: "Borde de Inputs",
      theme_reset: "Resetear",
      theme_panel_bg: "Fondo del Panel",
      theme_panel_border: "Borde del Panel",
      theme_success: "Color de Éxito",
      theme_warning: "Color de Advertencia",
      theme_danger: "Color de Peligro",
      theme_table_header_bg: "Fondo Cabecera de Grupo",
      theme_table_header_text: "Texto Cabecera de Grupo",
      theme_table_row_hover: "Fondo Fila (Hover)",
      theme_container_list: "Color Lista Contenedores",
      theme_badge_sm_text: "Texto Etiqueta Pequeña",
      theme_mission_badge_bg: "Fondo Etiqueta Misión",
      theme_mission_badge_border_color: "Borde Etiqueta Misión",
      theme_mission_badge_sm_bg: "Fondo Etiqueta Misión Pequeña",
      theme_mission_badge_sm_border_color: "Borde Etiqueta Misión Pequeña",
      theme_mission_badge_sm_text_color: "Texto Etiqueta Misión Pequeña",
      theme_table_bg: "Fondo General de Tabla",
      theme_table_text: "Texto General de Tabla",
      theme_table_general_border: "Borde General de Tabla",
      theme_mission_table_cell_border_color: "Borde Celdas Misión",
      theme_mission_table_thead_th_border_bottom_color: "Borde Inferior Cabecera Misión",
      theme_mission_group_header_bg: "Fondo Cabecera Grupo Misión",
      theme_mission_group_header_text_color: "Texto Cabecera Grupo Misión",
      theme_mission_group_header_border_top_color: "Borde Superior Cabecera Grupo Misión",
      theme_mission_group_header_border_bottom_color: "Borde Inferior Cabecera Grupo Misión",
      theme_table_cell_font_size: "Tamaño Fuente Celdas",
      theme_ship_data_prompt_font_size: "Tamaño Fuente Texto Nave", 
      ship_tech_data_prompt: "Accede aqui para obtener datos técnicos de tu nave",
      dps_calculator_btn: "DPS Calculator"
    },
    en: {
      title: "SC CARGO ORGANIZER",
      mission_management: "MISSION MANAGEMENT",
      create_new_mission: "Create New Mission",
      local: "Local",
      planetary: "Planetary",
      system: "System",
      material: "Material",
      material_placeholder: "e.g., Gold, Laranite",
      pickup_location: "Pickup Location",
      pickup_location_placeholder: "e.g., Grim HEX",
      dropoff_location: "Dropoff Location",
      dropoff_location_placeholder: "e.g., Area 18",
      total_scu: "Total SCU",
      total_scu_placeholder: "e.g., 32",
      container_breakdown_label: "Number of Containers by size (SCU)",
      cancel: "Cancel",
      add_material: "Add Material",
      save_changes: "Save Changes",
      cargo_summary: "CARGO SUMMARY",
      load_all_pending: "Load All Pending",
      clear_all: "Clear All",
      clear_cache: "Clear Cache",
      by_mission: "By Mission",
      by_pickup_location: "By Pickup Location",
      by_dropoff_location: "By Dropoff Location",
      pickup: "Pickup",
      dropoff: "Dropoff",
      containers: "Containers",
      status: "Status",
      actions: "Actions",
      no_active_missions: 'No active missions. Click "Create New Mission" to start.',
      mission: "Mission",
      footer_note: "Created by Manumg84 for the Star Citizen community.",
      manage_lists: "Manage Lists",
      materials_list: "Materials List",
      materials_list_desc: "Enter one material per line. These will appear as suggestions in the 'Material' field.",
      locations_list: "Locations List",
      locations_list_desc: "Enter one location per line. These will appear in the 'Pickup' and 'Dropoff' fields.",
      close: "Close",
      save_lists: "Save Lists",
      edit_mission: "Edit Mission",
      mission_name: "Mission Name",
      mission_type: "Mission Type",
      payout_auec: "Payout (aUEC)",
      add_material_to: "Add Material to",
      edit_material_in: "Edit Material in",
      unspecified: "Unspecified",
      unspecified_title: "Containers not specified",
      payout: "Payout",
      no_payout: "No Payout",
      pending_scu: "Pending",
      loaded_scu: "Loaded",
      total_scu_summary: "Total",
      mission_default_name: "Mission",
      loaded: "Loaded",
      delivered: "Delivered",
      pending: "Pending",
      scu_assigned_validation: (current, total, remaining) => `SCU Assigned: ${current} / ${total}. <span class="${remaining === 0 ? 'text-success' : 'text-warning'}">${remaining} SCU remaining to be assigned.</span>`,
      history: "History",
      completion_date: "Completion Date",
      clear_history: "Clear History",
      total_earnings: "Total Earnings",
      no_completed_misions: "No completed missions in history.",
      restore_mission_prompt: "Are you sure you want to restore this mission to the active missions list?",
      restore_mission_title: "Restore Mission",
      cargo_zone: "Cargo Zone",
      ship_management: "Ship Management",
      create_ship: "Create Ship",
      ship_name: "Ship Name",
      total_ship_scu: "Total SCU Capacity",
      quantum_fuel_capacity: "Quantum Fuel Capacity (scu Quantum)", 
      quantum_fuel_capacity_placeholder: "e.g., 1000", 
      quantum_travel_speed: "Quantum Travel Speed (km/s)", 
      quantum_travel_speed_placeholder: "e.g., 200000", 
      add_platform: "Add Platform",
      remove_last_platform: "Remove Last Platform",
      platform_name: "Platform Name",
      platform_scu_capacity: "Platform SCU Capacity",
      no_ships_message: 'No ships created. Click "Create Ship" to add one.',
      save: "Save",
      manage_cargo_placement: "Manage Cargo", 
      current_ship_load: "Current Ship Load:",
      no_ship_selected: "Select a ship to view its cargo.",
      unassigned_cargo_scu: (scu) => `Unassigned SCU: ${scu}`,
      unassigned: "Unassigned",
      not_enough_capacity: "Not enough capacity on this platform for this container.",
      cargo_already_loaded: "This cargo is already loaded onto the selected ship and platform.",
      cargo_unloaded: "Cargo successfully unloaded.",
      confirm_unload: "Are you sure you want to unload this cargo from the ship?",
      cargo_loaded_onto: (material, shipName, platformName) => `Cargo "${material}" assigned to ${shipName} (${platformName}).`, 
      unload_cargo: "Unload Cargo",
      delete_ship: "Delete Ship",
      edit_ship: "Edit Ship",
      load_cargo_onto_platform: "Load Cargo onto Platform",
      loading_for: "Loading for:",
      pending_cargo_for_assignment: "Pending Cargo for Assignment",
      current_platform_load: "Current Platform Load",
      no_pending_cargo: "No pending cargo.",
      no_cargo_on_platform: "No cargo on this platform.",
      confirm_unload_container: "Are you sure you want to unload this container?",
      container_loaded_onto: (size, material, platformName) => `Container ${size} SCU of ${material} loaded onto ${platformName}.`,
      container_unloaded: "Container unloaded.",
      current_balance_label: "Current Balance",
      final_balance: "Final Balance",
      cargo_ships: "Cargo Ships",
      transport_routes: "Transport Routes", 
      customize_theme: "Customize Theme",
      theme_primary: "Primary Color",
      theme_background: "Background Color",
      theme_text: "Text Color",
      theme_input_bg: "Input Background",
      theme_input_border: "Input Border",
      theme_reset: "Reset",
      theme_panel_bg: "Panel Background",
      theme_panel_border: "Panel Border",
      theme_success: "Success Color",
      theme_warning: "Warning Color",
      theme_danger: "Danger Color",
      theme_table_header_bg: "Group Header Background",
      theme_table_header_text: "Group Header Text",
      theme_table_row_hover: "Row Hover Background",
      theme_container_list: "Container List Color",
      theme_badge_sm_text: "Small Badge Text",
      theme_mission_badge_bg: "Mission Badge Background",
      theme_mission_badge_border_color: "Mission Badge Border",
      theme_mission_badge_sm_bg: "Small Mission Badge Background",
      theme_mission_badge_sm_border_color: "Small Mission Badge Border",
      theme_mission_badge_sm_text_color: "Small Mission Badge Text",
      theme_table_bg: "General Table Background",
      theme_table_text: "General Table Text",
      theme_table_general_border: "General Table Border",
      theme_mission_table_cell_border_color: "Mission Cell Border",
      theme_mission_table_thead_th_border_bottom_color: "Mission Header Bottom Border",
      theme_mission_group_header_bg: "Mission Group Header Background",
      theme_mission_group_header_text_color: "Mission Group Header Text",
      theme_mission_group_header_border_top_color: "Mission Group Header Top Border",
      theme_mission_group_header_border_bottom_color: "Mission Group Header Bottom Border",
      theme_table_cell_font_size: "Cell Font Size",
      theme_ship_data_prompt_font_size: "Ship Text Font Size", 
      ship_tech_data_prompt: "Access technical data for your ship here",
      dps_calculator_btn: "DPS Calculator"
    }
  };

  const translatePage = (lang) => {
    document.querySelectorAll('[data-key]').forEach(element => {
      const key = element.dataset.key;
      if (translations[lang][key]) {
        const excludeFromDirectTextContent = [
          'submit-material-btn', 'create-ship-btn', 'save-data-lists-btn',
          'clear-history-btn', 'load-all-pending', 'clear-all', 'clear-cache-btn'
        ];
        
        const isExcludedButton = excludeFromDirectTextContent.includes(element.id) ||
                                 (element.parentElement && excludeFromDirectTextContent.includes(element.parentElement.id));

        if (!isExcludedButton && element.children.length === 0) {
          element.textContent = translations[lang][key];
        } else if (!isExcludedButton) {
          const textNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0);
          if (textNode) {
            textNode.textContent = " " + translations[lang][key]; 
          } else if (element.textContent.trim() === '') { 
            element.textContent = translations[lang][key];
          }
        }
      }
    });
    document.querySelectorAll('[data-placeholder-key]').forEach(element => {
      const key = element.dataset.placeholderKey;
      if (translations[lang][key]) {
        element.placeholder = translations[lang][key];
      }
    });

    langFlag.src = lang === 'en' ? 'flag_es.png' : 'flag_uk.png';
    langFlag.alt = lang === 'en' ? 'Switch to English' : 'Switch to Spanish';

    localStorage.setItem('lang', lang);
    currentLang = lang;
    renderTable(); 
  };

  langSwitcher.addEventListener('click', () => {
    const newLang = currentLang === 'es' ? 'en' : 'es';
    translatePage(newLang);
  });

  let missions = JSON.parse(localStorage.getItem('missions')) || [];
  let ships = JSON.parse(localStorage.getItem('ships')) || [];
  let missionHistory = JSON.parse(localStorage.getItem('missionHistory')) || [];
  let materialsList = JSON.parse(localStorage.getItem('materialsList')) || [];
  let locationsList = JSON.parse(localStorage.getItem('locationsList')) || [];
  let currentBalance = parseFloat(localStorage.getItem('currentBalance')) || 0;

  const saveMissions = () => {
    localStorage.setItem('missions', JSON.stringify(missions));
  };

  const saveShips = () => {
    localStorage.setItem('ships', JSON.stringify(ships));
  };

  const saveMissionHistory = () => {
    localStorage.setItem('missionHistory', JSON.stringify(missionHistory));
  };

  const saveLists = () => {
    localStorage.setItem('materialsList', JSON.stringify(materialsList));
    localStorage.setItem('locationsList', JSON.stringify(locationsList));
  };

  const saveCurrentBalance = () => {
    localStorage.setItem('currentBalance', currentBalance.toFixed(2));
  };

  if (localStorage.getItem('ships_deleted_v2') !== 'true') {
    ships = [];
    localStorage.setItem('ships_deleted_v2', 'true'); 
    saveShips(); 
  }

  const locationIconMap = {
    'nada2': 'bi-building-gear',
    'nada': 'bi-building',
    'centro distribucion': 'bi-diagram-3',
    'puesto avanzado': 'bi-flag-fill',
    'granja': 'bi-tree-fill',
    'estación pirata': 'bi-radioactive',
    'puesto minero': 'bi-tools',
    'ciudad': 'bi-buildings-fill',
    'nada3': 'bi-house-slash-fill',
    'base de seguridad': 'bi-shield-fill-check',
    'estación espacial': 'bi-hdd-network-fill',
    'chatarreria': 'bi-recycle',
    'plataforma orbital': 'bi-record-circle-fill',
    'refugio emergencia': 'bi-hospital-fill',
    'prision': 'bi-lock-fill',
    'hideout': 'bi-eye-slash-fill',
  };

  const getLocationIcon = (locationName) => {
    const lowerLocation = locationName.toLowerCase();
    for (const [prefix, iconClass] of Object.entries(locationIconMap)) {
      if (lowerLocation.startsWith(prefix)) {
        const title = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        return `<i class="bi ${iconClass} me-1" title="${title}"></i>`;
      }
    }
    return ''; 
  };

  const populateDatalists = () => {
    materialsDatalist.innerHTML = materialsList.map(item => `<option value="${item}"></option>`).join('');
    
    const uniqueLocationNames = [...new Set(locationsList.map(item => parseLocation(item).name))];
    locationsDatalist.innerHTML = uniqueLocationNames.map(name => `<option value="${name}"></option>`).join('');
  };

  const calculateTotalScu = (cargo) => {
    if (!cargo || !Array.isArray(cargo.containers)) {
        return 0;
    }
    return cargo.containers.reduce((sum, container) => sum + (container.size || 0), 0);
  };

  const formatContainers = (containers) => {
    if (!Array.isArray(containers) || containers.length === 0) {
      const t = translations[currentLang];
      return `<span class="edit-trigger" style="cursor: pointer;"><i class="bi bi-exclamation-triangle-fill text-warning me-1" title="${t.unspecified_title}"></i> ${t.unspecified}</span>`;
    }
    const counts = {};
    containers.forEach(c => {
        counts[c.size] = (counts[c.size] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([scuA], [scuB]) => parseInt(scuA) - parseInt(scuB))
      .map(([scu, count]) => `${count}x${scu}scu`)
      .join(' ');
  };

  const getCargoOverallStatus = (cargo) => {
    if (!cargo || !Array.isArray(cargo.containers) || cargo.containers.length === 0) {
        return 'pending';
    }

    const allDelivered = cargo.containers.every(c => c.status === 'delivered');
    if (allDelivered) {
        return 'delivered';
    }

    const allLoaded = cargo.containers.every(c => c.status === 'loaded' || c.status === 'delivered');
    if (allLoaded) {
        return 'loaded';
    }
    
    return 'pending';
  };

  const renderSummary = () => {
    const allCargos = missions.flatMap(m => Array.isArray(m.cargos) ? m.cargos : []);

    let totalScu = 0;
    let pendingScu = 0;
    let loadedScu = 0;

    allCargos.forEach(cargo => {
        totalScu += calculateTotalScu(cargo);
        const status = getCargoOverallStatus(cargo);
        if (status === 'pending') {
            pendingScu += calculateTotalScu(cargo);
        } else if (status === 'loaded') {
            loadedScu += calculateTotalScu(cargo);
        }
    });

    const totalPayout = missions.reduce((sum, mission) => sum + (mission.payout || 0), 0);
    const t = translations[currentLang];

    summaryFooter.innerHTML = `
      <span title="Total payout of all missions">${t.payout}: <span class="scu-value">${totalPayout.toLocaleString()} aUEC</span></span>
      <span>${t.pending_scu}: <span class="scu-value">${pendingScu}</span> SCU</span>
      <span>${t.loaded_scu}: <span class="scu-value">${loadedScu}</span> SCU</span>
      <span>${t.total_scu_summary}: <span class="scu-value">${totalScu}</span> SCU</span>
    `;
  };

  const renderMissionView = (sortedMissions) => {
    missionCardsContainer.innerHTML = '';
    if (missions.length === 0) {
      noMissionsMessage.style.display = 'block';
      return;
    } else {
      noMissionsMessage.style.display = 'none';
    }

    sortedMissions.forEach(mission => {
        const t = translations[currentLang];
        const missionCard = document.createElement('div');
        missionCard.className = 'mission-card mb-4';
        missionCard.dataset.missionId = mission.id;

        const totalScuForMission = (Array.isArray(mission.cargos) ? mission.cargos.reduce((sum, cargo) => sum + (cargo.totalScu || 0), 0) : 0);
        
        let loadedScuForMission = 0;
        let deliveredScuForMission = 0;
        if (Array.isArray(mission.cargos)) {
            mission.cargos.forEach(cargo => {
                if (Array.isArray(cargo.containers)) {
                    cargo.containers.forEach(container => {
                        if (container.status === 'loaded') {
                            loadedScuForMission += container.size;
                        } else if (container.status === 'delivered') {
                            deliveredScuForMission += container.size;
                        }
                    });
                }
            });
        }
        
        const progress = totalScuForMission > 0 ? ((loadedScuForMission * 0.5 + deliveredScuForMission) / totalScuForMission) * 100 : 0;
        const missionPayout = mission.payout ? `${mission.payout.toLocaleString()} aUEC` : t.no_payout;

        missionCard.innerHTML = `
            <div class="mission-card-header">
                <div class="d-flex align-items-center flex-wrap">
                    <h3 class="mission-card-title me-3" title="Edit Mission">${mission.name}</h3>
                    <div class="mission-card-details">
                         <span class="mission-type-badge-sm">${mission.type.toUpperCase()}</span>
                         <span class="mx-2">|</span>
                         <span>${totalScuForMission} SCU</span>
                         <span class="mx-2">|</span>
                         <span>${missionPayout}</span>
                    </div>
                </div>
                <div class="btn-group">
                    <button class="btn btn-primary btn-sm add-material-btn" title="Material"><i class="bi bi-plus-circle me-1"></i>Materiales</button>
                    <button class="btn btn-danger btn-sm delete-mission-btn" title="Delete Mission"><i class="bi bi-trash"></i></button>
                </div>
            </div>
            <div class="mission-card-body">
                <div class="d-flex flex-column gap-3">
                    ${!Array.isArray(mission.cargos) || mission.cargos.length === 0 
                        ? `<div class="text-center text-muted-glow p-3">No hay materiales en esta misión.</div>`
                        : mission.cargos.map(cargo => {
                            const cargoOverallStatus = getCargoOverallStatus(cargo);
                            let statusBadge, actions;

                            switch(cargoOverallStatus) {
                                case 'loaded':
                                    statusBadge = `<span class="status-badge status-loaded">${t.loaded}</span>`;
                                    actions = `<button class="btn btn-success btn-sm deliver-btn" title="Deliver"><i class="bi bi-truck"></i></button>
                                               <button class="btn btn-warning btn-sm unload-btn" title="Unload"><i class="bi bi-box-arrow-up"></i></button>`;
                                    break;
                                case 'delivered':
                                    statusBadge = `<span class="status-badge status-delivered">${t.delivered}</span>`;
                                    actions = `<button class="btn btn-danger btn-sm delete-btn" title="Delete"><i class="bi bi-trash-fill"></i></button>`;
                                    break;
                                default: // pending
                                    statusBadge = `<span class="status-badge status-pending">${t.pending}</span>`;
                                    actions = `<button class="btn btn-primary btn-sm load-btn" title="Load"><i class="bi bi-box-arrow-in-down"></i></button>
                                               <button class="btn btn-danger btn-sm delete-btn" title="Delete"><i class="bi bi-trash-fill"></i></button>`;
                            }

                            const pickup = parseLocation(cargo.pickupLocation);
                            const dropoff = parseLocation(cargo.dropoffLocation);

                            return `
                                <div class="material-card" data-id="${cargo.id}">
                                    <div class="material-card-main">
                                        <div class="material-info-block">
                                            <div class="material-info">
                                                <i class="bi bi-box me-2"></i>
                                                <span>${cargo.material} - ${cargo.totalScu} SCU</span>
                                                <span class="cargo-containers-list edit-trigger" title="${t.edit_material_in} ${mission.name}">(${formatContainers(cargo.containers)})</span>
                                            </div>
                                            <div class="material-locations">
                                                <span>${getLocationIcon(pickup.name)}${pickup.name}</span>
                                                <i class="bi bi-arrow-right mx-2"></i>
                                                <span>${getLocationIcon(dropoff.name)}${dropoff.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="material-card-actions">
                                        ${statusBadge}
                                        <div class="btn-group cargo-actions">
                                            <button class="btn btn-info btn-sm edit-btn" title="Edit"><i class="bi bi-pencil-fill"></i></button>
                                            ${actions}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')
                    }
                </div>
            </div>
        `;
        missionCardsContainer.appendChild(missionCard);
    });
  };
  
  const renderPickupLocationView = () => {
    pickupLocationTableBody.innerHTML = '';
    const allCargos = missions.flatMap(m => Array.isArray(m.cargos) ? m.cargos.map(c => ({...c, missionName: m.name, missionId: m.id, missionType: m.type })) : []);

    if (allCargos.length === 0) {
      pickupLocationTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-muted-glow">No hay carga para mostrar.</td></tr>`;
      return;
    }

    const groupedByLocation = allCargos.reduce((acc, cargo) => {
      const location = cargo.pickupLocation || 'Desconocido';
      if (!acc[location]) {
        acc[location] = [];
      }
      acc[location].push(cargo);
      return acc;
    }, {});

    const sortedLocations = Object.keys(groupedByLocation).sort();

    sortedLocations.forEach(location => {
      const cargos = groupedByLocation[location];
      const totalScuForLocation = cargos.reduce((sum, cargo) => sum + calculateTotalScu(cargo), 0);

      const groupHeader = document.createElement('tr');
      groupHeader.className = 'mission-group-header';
      groupHeader.dataset.locationGroup = location;
      groupHeader.innerHTML = `
        <td colspan="7">
          <i class="bi bi-chevron-down me-2 toggle-collapse"></i>
          ${getLocationIcon(location)}<i class="bi bi-box-arrow-in-up me-2"></i>${location}
          <span class="mission-details">(${totalScuForLocation} SCU)</span>
        </td>
      `;
      pickupLocationTableBody.appendChild(groupHeader);

      // NUEVO: tarjetas de distancia por entrega desde el origen seleccionado
      const originHub = getCurrentOriginHub();
      if (originHub) {
        const infoRow = document.createElement('tr');
        const cards = cargos.map(c => {
          const drop = parseLocation(c.dropoffLocation);
          const dropHub = getHubFromDetails(drop.details) || getHubForName(drop.name);
          const d = dropHub ? calculateDistancia(originHub, dropHub) : Infinity;
          const dTxt = isFinite(d) ? `${d} Gm` : '—';
          return `<span class="badge bg-secondary me-2 mb-1"><i class="bi bi-geo-alt-fill me-1"></i>${drop.name}<span class="badge bg-info ms-2">${dTxt}</span></span>`;
        }).join(' ');
        infoRow.innerHTML = `<td colspan="7"><div class="small text-muted-glow">${cards || ''}</div></td>`;
        pickupLocationTableBody.appendChild(infoRow);
      }

      cargos.sort((a,b) => a.missionId - b.missionId).forEach(cargo => {
        const row = document.createElement('tr');
        row.className = 'location-item';
        row.dataset.id = cargo.id;
        row.dataset.missionId = cargo.missionId;
        row.dataset.locationGroup = location;

        let statusBadge;
        let actions;
        const t = translations[currentLang];
        const cargoOverallStatus = getCargoOverallStatus(cargo);

        switch(cargoOverallStatus) {
          case 'loaded':
            statusBadge = `<span class="status-badge status-loaded">${t.loaded}</span>`;
            actions = `
              <button class="btn btn-success btn-sm deliver-btn" title="Deliver"><i class="bi bi-truck"></i></button>
              <button class="btn btn-warning btn-sm unload-btn" title="Unload"><i class="bi bi-box-arrow-up"></i></button>
              <button class="btn btn-info btn-sm edit-btn" title="Edit"><i class="bi bi-pencil-fill"></i></button>
            `;
            break;
          case 'delivered':
            statusBadge = `<span class="status-badge status-delivered">${t.delivered}</span>`;
            actions = `<button class="btn btn-danger btn-sm delete-btn" title="Delete"><i class="bi bi-trash-fill"></i></button>`;
            break;
          default: // pending
            statusBadge = `<span class="status-badge status-pending">${t.pending}</span>`;
            actions = `
              <button class="btn btn-primary btn-sm load-btn" title="Load"><i class="bi bi-box-arrow-in-down"></i></button>
              <button class="btn btn-info btn-sm edit-btn" title="Edit"><i class="bi bi-pencil-fill"></i></button>
              <button class="btn btn-danger btn-sm delete-btn" title="Delete"><i class="bi bi-trash-fill"></i></button>
            `;
        }
        const missionType = cargo.missionType ? `<span class="mission-type-badge-sm">${cargo.missionType.toUpperCase()}</span>` : '';
        const containersString = formatContainers(cargo.containers);
        const dropoff = parseLocation(cargo.dropoffLocation);

        row.innerHTML = `
          <td><i class="bi bi-box me-2"></i>${cargo.material}</td>
          <td>${missionType}<span class="origin-mission-name ms-1">${cargo.missionName}</span></td>
          <td class="location-cell" data-details="${dropoff.details || ''}">${getLocationIcon(dropoff.name)}${dropoff.name}</td>
          <td class="text-center">${calculateTotalScu(cargo)}</td>
          <td><span class="cargo-containers-list">${containersString}</span></td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-center cargo-actions">${actions}</td>
        `;
        pickupLocationTableBody.appendChild(row);
      });
    });
  };

  const renderLocationView = () => {
    locationTableBody.innerHTML = '';
    const allCargos = missions.flatMap(m => Array.isArray(m.cargos) ? m.cargos.map(c => ({...c, missionName: m.name, missionId: m.id, missionType: m.type })) : []);

    if (allCargos.length === 0) {
      locationTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-muted-glow">No hay carga para mostrar.</td></tr>`;
      return;
    }

    const groupedByLocation = allCargos.reduce((acc, cargo) => {
      const location = cargo.dropoffLocation || 'Desconocido';
      if (!acc[location]) {
        acc[location] = [];
      }
      acc[location].push(cargo);
      return acc;
    }, {});

    const sortedLocations = Object.keys(groupedByLocation).sort();

    sortedLocations.forEach(location => {
      const cargos = groupedByLocation[location];
      const totalScuForLocation = cargos.reduce((sum, cargo) => sum + calculateTotalScu(cargo), 0);

      const groupHeader = document.createElement('tr');
      groupHeader.className = 'mission-group-header';
      groupHeader.dataset.locationGroup = location;
      groupHeader.innerHTML = `
        <td colspan="7">
          <i class="bi bi-chevron-down me-2 toggle-collapse"></i>
          ${getLocationIcon(location)}<i class="bi bi-geo-alt-fill me-2"></i>${location}
          <span class="mission-details">(${totalScuForLocation} SCU)</span>
        </td>
      `;
      locationTableBody.appendChild(groupHeader);

      // NUEVO: tarjetas de distancia por entrega (solo si hay carga cargada)
      const originHub = getCurrentOriginHub();
      if (originHub) {
        const loadedCargos = cargos.filter(c => Array.isArray(c.containers) && c.containers.some(ct => ct.status === 'loaded'));
        if (loadedCargos.length) {
          const infoRow = document.createElement('tr');
          const cards = loadedCargos.map(c => {
            const drop = parseLocation(c.dropoffLocation);
            const dropHub = getHubFromDetails(drop.details) || getHubForName(drop.name);
            const d = dropHub ? calculateDistancia(originHub, dropHub) : Infinity;
            const dTxt = isFinite(d) ? `${d} Gm` : '—';
            return `<span class="badge bg-secondary me-2 mb-1"><i class="bi bi-geo-alt-fill me-1"></i>${drop.name}<span class="badge bg-info ms-2">${dTxt}</span></span>`;
          }).join(' ');
          infoRow.innerHTML = `<td colspan="7"><div class="small text-muted-glow">${cards}</div></td>`;
          locationTableBody.appendChild(infoRow);
        }
      }

      cargos.sort((a,b) => a.missionId - b.missionId).forEach(cargo => {
        const row = document.createElement('tr');
        row.className = 'location-item';
        row.dataset.id = cargo.id;
        row.dataset.missionId = cargo.missionId;
        row.dataset.locationGroup = location;

        let statusBadge;
        let actions;
        const t = translations[currentLang];
        const cargoOverallStatus = getCargoOverallStatus(cargo);

        switch(cargoOverallStatus) {
          case 'loaded':
            statusBadge = `<span class="status-badge status-loaded">${t.loaded}</span>`;
            actions = `
              <button class="btn btn-success btn-sm deliver-btn" title="Deliver"><i class="bi bi-truck"></i></button>
              <button class="btn btn-warning btn-sm unload-btn" title="Unload"><i class="bi bi-box-arrow-up"></i></button>
              <button class="btn btn-info btn-sm edit-btn" title="Edit"><i class="bi bi-pencil-fill"></i></button>
            `;
            break;
          case 'delivered':
            statusBadge = `<span class="status-badge status-delivered">${t.delivered}</span>`;
            actions = `<button class="btn btn-danger btn-sm delete-btn" title="Delete"><i class="bi bi-trash-fill"></i></button>`;
            break;
          default: // pending
            statusBadge = `<span class="status-badge status-pending">${t.pending}</span>`;
            actions = `
              <button class="btn btn-primary btn-sm load-btn" title="Load"><i class="bi bi-box-arrow-in-down"></i></button>
              <button class="btn btn-info btn-sm edit-btn" title="Edit"><i class="bi bi-pencil-fill"></i></button>
              <button class="btn btn-danger btn-sm delete-btn" title="Delete"><i class="bi bi-trash-fill"></i></button>
            `;
        }
        const missionType = cargo.missionType ? `<span class="mission-type-badge-sm">${cargo.missionType.toUpperCase()}</span>` : '';
        const containersString = formatContainers(cargo.containers);
        const pickup = parseLocation(cargo.pickupLocation);

        row.innerHTML = `
          <td><i class="bi bi-box me-2"></i>${cargo.material}</td>
          <td>${missionType}<span class="origin-mission-name ms-1">${cargo.missionName}</span></td>
          <td class="location-cell" data-details="${pickup.details || ''}">${getLocationIcon(pickup.name)}${pickup.name}</td>
          <td class="text-center">${calculateTotalScu(cargo)}</td>
          <td><span class="cargo-containers-list">${containersString}</span></td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-center cargo-actions">${actions}</td>
        `;
        locationTableBody.appendChild(row);
      });
    });
  };

  const renderHistoryView = () => {
    historyTableBody.innerHTML = '';
    const t = translations[currentLang];

    if (missionHistory.length === 0) {
      historyTableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-muted-glow">${t.no_completed_misions}</td></tr>`;
    }

    const sortedHistory = [...missionHistory].sort((a, b) => new Date(b.completionDate) - new Date(a.completionDate));
    
    let totalEarnings = 0;

    sortedHistory.forEach(mission => {
      totalEarnings += mission.payout || 0;
      const missionPayout = mission.payout ? `${mission.payout.toLocaleString()} aUEC` : t.no_payout;
      const completionDate = new Date(mission.completionDate).toLocaleString(currentLang);
      const missionType = mission.type ? `<span class="mission-type-badge">${mission.type.toUpperCase()}</span>` : '';

      const row = document.createElement('tr');
      row.className = 'mission-item'; 
      row.dataset.missionId = mission.id;
      row.innerHTML = `
        <td>
          ${missionType}
          <span class="ms-2">${mission.name}</span>
        </td>
        <td class="text-center">${missionPayout}</td>
        <td class="text-center">${completionDate}</td>
        <td class="text-center">
          <button class="btn btn-warning btn-sm restore-mission-btn" title="${t.restore_mission_title}"><i class="bi bi-arrow-counterclockwise"></i></button>
        </td>
      `;
      historyTableBody.appendChild(row);
    });

    currentBalanceInput.value = currentBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    const finalBalance = currentBalance + totalEarnings;

    historyTotalEarningsSpan.innerHTML = `${t.total_earnings}: <span class="scu-value">${totalEarnings.toLocaleString()} aUEC</span>`;
    historyFinalBalanceSpan.innerHTML = `${t.final_balance}: <span class="scu-value">${finalBalance.toLocaleString()} aUEC</span>`;
  };

  const renderTable = () => {
    if (missions.length === 0) {
      addMaterialFormContainer.classList.add('d-none');
      summaryFooter.innerHTML = '';
    } else {
      summaryFooter.classList.remove('d-none');
    }
    
    const sortedMissions = [...missions].sort((a, b) => a.id - b.id);
    
    renderMissionView(sortedMissions);
    renderPickupLocationView();
    renderLocationView();
    renderHistoryView();
    renderCargoZone();
    renderSummary();
    window.dispatchEvent(new CustomEvent('missions-updated')); // notify manual route panel
  };

  const findCargoAndMission = (cargoId) => {
    for (const mission of missions) {
      if (Array.isArray(mission.cargos)) {
        const cargo = mission.cargos.find(c => c.id === cargoId);
        if (cargo) {
          return { mission, cargo };
        }
      }
    }
    return { mission: null, cargo: null };
  };

  const getContainerById = (cargo, containerId) => {
      if (!cargo || !Array.isArray(cargo.containers)) return null;
      return cargo.containers.find(c => c.id === containerId);
  }

  let currentShipIdForLoading = null;
  let currentPlatformIdForLoading = null;

  const renderPlatformLoadModalContent = () => {
    const t = translations[currentLang];
    platformLoadValidationMessage.textContent = '';
    pendingCargoListDiv.innerHTML = '';
    currentPlatformLoadedCargoDiv.innerHTML = '';

    const ship = ships.find(s => s.id === currentShipIdForLoading);
    const platform = ship ? ship.platforms.find(p => p.id === currentPlatformIdForLoading) : null;

    if (!ship || !platform) {
      currentLoadingShipPlatformSpan.textContent = "Error";
      return;
    }
    currentLoadingShipPlatformSpan.textContent = `${ship.name} - ${platform.name} (${platform.occupiedScu} / ${platform.capacity} SCU cargado, ${platform.capacity - platform.occupiedScu} SCU libre)`;

    const pendingCargosGroupedByMission = missions.reduce((acc, mission) => {
        const missionPendingCargos = Array.isArray(mission.cargos) ? mission.cargos.filter(cargo => 
            Array.isArray(cargo.containers) && cargo.containers.some(c => c.status === 'pending')
        ) : [];
        if (missionPendingCargos.length > 0) {
            acc.push({ mission, cargos: missionPendingCargos });
        }
        return acc;
    }, []);

    if (pendingCargosGroupedByMission.length === 0) {
      pendingCargoListDiv.innerHTML = `<p class="text-muted-glow small">${t.no_pending_cargo}</p>`;
    } else {
      pendingCargosGroupedByMission.forEach(({ mission, cargos }) => {
        const missionGroup = document.createElement('div');
        missionGroup.className = 'mb-3 p-2 cargo-group-panel';
        missionGroup.innerHTML = `<h6 class="title-font mb-2 mission-group-title">${mission.name} (${mission.type})</h6>`;

        cargos.forEach(cargo => {
          const availableContainers = Array.isArray(cargo.containers) ? cargo.containers.filter(c => c.status === 'pending') : [];
          if (availableContainers.length === 0) return;

          const cargoItem = document.createElement('div');
          cargoItem.className = 'cargo-item-container';
          cargoItem.innerHTML = `<span class="cargo-material-name">${cargo.material} (Total: ${calculateTotalScu(cargo)} SCU)</span>`;

          const containerButtons = document.createElement('div');
          containerButtons.className = 'container-buttons';

          const containerCounts = availableContainers.reduce((acc, container) => {
            acc[container.size] = (acc[container.size] || 0) + 1;
            return acc;
          }, {});

          Object.entries(containerCounts).sort(([sA],[sB]) => parseInt(sA)-parseInt(sB)).forEach(([size, count]) => {
            if (count > 0) { // Only show buttons if there are containers
                const btn = document.createElement('button');
                btn.className = 'btn btn-sm btn-outline-info me-1 mb-1 load-container-btn';
                btn.textContent = `${count}x ${size} SCU`;
                btn.dataset.cargoId = cargo.id;
                btn.dataset.containerSize = size;
                containerButtons.appendChild(btn);
            }
          });
          cargoItem.appendChild(containerButtons);
          missionGroup.appendChild(cargoItem);
        });
        pendingCargoListDiv.appendChild(missionGroup);
      });
    }

    if (!Array.isArray(platform.loadedContainers) || platform.loadedContainers.length === 0) {
      currentPlatformLoadedCargoDiv.innerHTML = `<p class="text-muted-glow small">${t.no_cargo_on_platform}</p>`;
    } else {
      const loadedList = document.createElement('ul');
      loadedList.className = 'list-unstyled mb-0'; 
      platform.loadedContainers.forEach(lc => {
        const { mission, cargo } = findCargoAndMission(lc.cargoId);
        if (cargo && mission) {
          const listItem = document.createElement('li');
          listItem.className = 'd-flex justify-content-between align-items-center loaded-cargo-item p-1'; 
          listItem.innerHTML = `
            <span class="small"><i class="bi bi-box-seam me-2"></i>${cargo.material} (${lc.size} SCU) <small class="text-muted-glow">- ${mission.name}</small></span>
            <button class="btn btn-sm btn-danger unload-container-btn" data-container-id="${lc.id}" data-cargo-id="${lc.cargoId}" title="${t.unload_cargo}"><i class="bi bi-x-lg"></i></button>
          `;
          loadedList.appendChild(listItem);
        }
      });
      currentPlatformLoadedCargoDiv.appendChild(loadedList);
    }
  };

  const openPlatformCargoLoadModal = (shipId, platformId) => {
    currentShipIdForLoading = shipId;
    currentPlatformIdForLoading = platformId;
    renderPlatformLoadModalContent();
    platformCargoLoadModal.show();
  };

  pendingCargoListDiv.addEventListener('click', (e) => {
    const loadBtn = e.target.closest('.load-container-btn');
    if (!loadBtn) return;

    const cargoId = parseInt(loadBtn.dataset.cargoId, 10);
    const containerSize = parseInt(loadBtn.dataset.containerSize, 10);
    const t = translations[currentLang];

    const ship = ships.find(s => s.id === currentShipIdForLoading);
    const platform = ship ? ship.platforms.find(p => p.id === currentPlatformIdForLoading) : null;
    const { cargo } = findCargoAndMission(cargoId);

    if (!ship || !platform || !cargo) {
      platformLoadValidationMessage.innerHTML = `<span class="text-danger">Error: Cargo or platform data not found.</span>`;
      return;
    }

    const availableContainer = Array.isArray(cargo.containers) ? cargo.containers.find(c => c.size === containerSize && c.status === 'pending') : null;

    if (!availableContainer) {
      platformLoadValidationMessage.innerHTML = `<span class="text-danger">No pending containers of ${containerSize} SCU for this cargo.</span>`;
      return;
    }

    if (platform.capacity - platform.occupiedScu < containerSize) {
      platformLoadValidationMessage.innerHTML = `<span class="text-warning">${t.not_enough_capacity}</span>`;
      return;
    }

    availableContainer.status = 'loaded';
    availableContainer.location = { shipId: ship.id, platformId: platform.id };
    platform.loadedContainers.push({
        id: availableContainer.id,
        cargoId: cargo.id,
        size: availableContainer.size,
        material: cargo.material,
        missionId: cargo.missionId 
    });
    platform.occupiedScu += containerSize;
    
    cargo.status = getCargoOverallStatus(cargo); 

    saveMissions();
    saveShips();
    renderPlatformLoadModalContent(); 
    renderTable(); 
    platformLoadValidationMessage.innerHTML = `<span class="text-success">${t.container_loaded_onto(containerSize, cargo.material, platform.name)}</span>`;
  });

  currentPlatformLoadedCargoDiv.addEventListener('click', (e) => {
    const unloadBtn = e.target.closest('.unload-container-btn');
    if (!unloadBtn) return;

    const containerId = unloadBtn.dataset.containerId;
    const cargoId = parseInt(unloadBtn.dataset.cargoId, 10);
    const t = translations[currentLang];

    if (confirm(t.confirm_unload_container)) {
      const ship = ships.find(s => s.id === currentShipIdForLoading);
      const platform = ship ? ship.platforms.find(p => p.id === currentPlatformIdForLoading) : null;
      const { cargo } = findCargoAndMission(cargoId);
      
      if (!ship || !platform || !cargo) {
        platformLoadValidationMessage.innerHTML = `<span class="text-danger">Error: Cargo or platform data not found.</span>`;
        return;
      }

      const containerToUnloadIndex = Array.isArray(platform.loadedContainers) ? platform.loadedContainers.findIndex(lc => lc.id === containerId) : -1;
      const originalCargoContainer = Array.isArray(cargo.containers) ? cargo.containers.find(c => c.id === containerId) : null;

      if (containerToUnloadIndex !== -1 && originalCargoContainer) {
        const [removedLoadedContainer] = platform.loadedContainers.splice(containerToUnloadIndex, 1);
        platform.occupiedScu -= removedLoadedContainer.size;
        
        originalCargoContainer.status = 'pending';
        originalCargoContainer.location = null;
        cargo.status = getCargoOverallStatus(cargo); 

        saveMissions();
        saveShips();
        renderPlatformLoadModalContent(); 
        renderTable();
      }
    }
  });

  const showAddMaterialForm = (missionId, missionName) => {
    missionIdInput.value = missionId;
    cargoIdInput.value = ''; 
    materialForm.reset(); 
    
    document.getElementById('totalScu').value = ''; 
    
    // Reset container count badges manually for a new material form
    materialForm.querySelectorAll('.scu-count-badge').forEach(span => {
      span.textContent = '0';
      span.style.display = 'none';
    });

    const t = translations[currentLang];
    addMaterialFormTitle.innerHTML = `<i class="bi bi-clipboard-plus me-2"></i>${t.add_material_to} <strong>${missionName}</strong>`;
    submitMaterialBtn.querySelector('span').textContent = t.add_material;
    
    totalScuInput.readOnly = false;
    containerBreakdownSection.classList.add('d-none'); 
    containerValidationMessage.textContent = ''; 
    
    addMaterialFormContainer.classList.remove('d-none');
    /* sync payout with mission */
    const m = missions.find(m => m.id === missionId);
    if (m && missionPayoutOnCreateInput) missionPayoutOnCreateInput.value = m.payout || 0;
    addMaterialFormContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('material').focus();
  };

  const showEditMaterialForm = (cargo, missionId, missionName) => {
    missionIdInput.value = missionId;
    cargoIdInput.value = cargo.id;
    materialForm.reset();

    document.getElementById('material').value = cargo.material;
    document.getElementById('pickupLocation').value = cargo.pickupLocation;
    document.getElementById('dropoffLocation').value = cargo.dropoffLocation;
    document.getElementById('totalScu').value = cargo.totalScu; 
    
    const containerCounts = Array.isArray(cargo.containers) ? cargo.containers.reduce((acc, c) => {
        acc[c.size] = (acc[c.size] || 0) + 1;
        return acc;
    }, {}) : {};

    materialForm.querySelectorAll('.scu-count-badge').forEach(span => {
      const scuSize = parseInt(span.dataset.scu, 10);
      const count = containerCounts[scuSize] || 0;
      span.textContent = count;
      span.style.display = count > 0 ? 'inline-block' : 'none';
    });

    const t = translations[currentLang];
    addMaterialFormTitle.innerHTML = `<i class="bi bi-pencil-fill me-2"></i>${t.edit_material_in} <strong>${missionName}</strong>`;
    submitMaterialBtn.querySelector('span').textContent = t.save_changes;
    
    totalScuInput.readOnly = true; 
    containerBreakdownSection.classList.remove('d-none'); 

    updateContainerValidationMessage(cargo.totalScu);
    addMaterialFormContainer.classList.remove('d-none');
    /* sync payout with mission */
    const m = missions.find(m => m.id === missionId);
    if (m && missionPayoutOnCreateInput) missionPayoutOnCreateInput.value = m.payout || 0;
    addMaterialFormContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('material').focus();
  };

  const hideAddMaterialForm = () => {
    addMaterialFormContainer.classList.add('d-none');
    missionIdInput.value = '';
    cargoIdInput.value = '';
    updateScuButtonsState(Infinity); // Re-enable all buttons when form is hidden
  };

  createMissionDropdown.addEventListener('click', (e) => {
    e.preventDefault();
    const missionType = e.target.dataset.missionType;
    if (!missionType) return;

    const nextMissionNumber = (missions.reduce((max, m) => {
      const missionNameKey = translations['es'].mission_default_name; 
      const regex = new RegExp(`^${missionNameKey} (\\d+)`);
      const match = m.name.match(regex);
      if (match) {
        const num = parseInt(match[1]);
        return num > max ? num : max;
      }
      return max;
    }, 0)) + 1;

    const newMission = {
      id: Date.now(),
      name: `${translations[currentLang].mission_default_name} ${nextMissionNumber}`,
      payout: 0,
      type: missionType,
      cargos: [] 
    };
    missions.push(newMission);
    saveMissions();
    renderTable();
    isNewMissionCreation = true; 
    showAddMaterialForm(newMission.id, newMission.name);
    playSound('confirm');
  });
  
  const updateContainerValidationMessage = (targetScu) => {
    let currentScu = 0;
    containerBreakdownSection.querySelectorAll('.scu-count-badge').forEach(span => {
      const scuSize = parseInt(span.dataset.scu, 10);
      const count = parseInt(span.textContent, 10) || 0;
      currentScu += scuSize * count;
    });
    const remaining = targetScu - currentScu;
    const t = translations[currentLang];
    containerValidationMessage.innerHTML = t.scu_assigned_validation(currentScu, targetScu, remaining);
    updateScuButtonsState(remaining); // Add this call
  };
  
  const updateScuButtonsState = (remainingScu) => {
    containerBreakdownSection.querySelectorAll('.scu-add-btn').forEach(btn => {
        const scuSize = parseInt(btn.dataset.scu, 10);
        if (scuSize > remainingScu) {
            btn.disabled = true;
        } else {
            btn.disabled = false;
        }
    });
  };
  
  materialForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const missionId = parseInt(missionIdInput.value, 10);
    const cargoId = parseInt(cargoIdInput.value, 10) || null;
    
    const missionIndex = missions.findIndex(m => m.id === missionId);

    if (missionIndex === -1) {
      alert("Error: Mission not found.");
      return;
    }
    
    isNewMissionCreation = false; 

    const material = document.getElementById('material').value.trim();
    const pickupLocationName = document.getElementById('pickupLocation').value.trim();
    const dropoffLocationName = document.getElementById('dropoffLocation').value.trim();
    const totalScuInputVal = parseInt(totalScuInput.value, 10);
    const payoutVal = parseInt(missionPayoutOnCreateInput?.value, 10);

    if (!material || !pickupLocationName || !dropoffLocationName) {
      alert('Please complete all material and location fields.');
      return;
    }

    if (!totalScuInputVal || totalScuInputVal <= 0) {
      alert("Please enter a valid total SCU value.");
      return;
    }

    const containersData = [];
    let assignedScu = 0;
    containerBreakdownSection.querySelectorAll('.scu-count-badge').forEach(span => {
        const scuSize = parseInt(span.dataset.scu, 10);
        const count = parseInt(span.textContent, 10) || 0;
        for (let i = 0; i < count; i++) {
            containersData.push({ id: uuidv4(), size: scuSize, status: 'pending', location: null });
        }
        assignedScu += scuSize * count;
    });

    if (cargoId) { 
      if (assignedScu !== totalScuInputVal) {
        alert(`Assigned SCU (${assignedScu}) does not match the total SCU of the cargo (${totalScuInputVal}). Please adjust the containers.`);
        return;
      }

      const cargoIndex = Array.isArray(missions[missionIndex].cargos) ? missions[missionIndex].cargos.findIndex(c => c.id === cargoId) : -1;
      if (cargoIndex !== -1) {
        const existingCargo = missions[missionIndex].cargos[cargoIndex];
        const fullPickupLocation = locationsList.find(l => parseLocation(l).name === pickupLocationName) || pickupLocationName;
        const fullDropoffLocation = locationsList.find(l => parseLocation(l).name === dropoffLocationName) || dropoffLocationName;

        const updatedContainers = [];
        const oldContainersById = new Map(Array.isArray(existingCargo.containers) ? existingCargo.containers.map(c => [c.id, c]) : []);

        const newContainerCounts = {};
        containerBreakdownSection.querySelectorAll('.scu-count-badge').forEach(span => {
            const scuSize = parseInt(span.dataset.scu, 10);
            const count = parseInt(span.textContent, 10) || 0;
            newContainerCounts[scuSize] = count;
        });

        const usedExistingContainerIds = new Set();
        for (const size of Object.keys(newContainerCounts).map(Number).sort((a,b)=>a-b)) {
            let neededCount = newContainerCounts[size];
            const matchingExisting = Array.isArray(existingCargo.containers) ? existingCargo.containers.filter(c => c.size === size && !usedExistingContainerIds.has(c.id)) : [];
            
            for (const existingC of matchingExisting) {
                if (neededCount > 0) {
                    updatedContainers.push(existingC);
                    usedExistingContainerIds.add(existingC.id);
                    neededCount--;
                } else {
                    existingC.status = 'pending';
                    existingC.location = null;
                    existingCargo.status = getCargoOverallStatus(existingCargo);
                }
            }
            for (let i = 0; i < neededCount; i++) {
                updatedContainers.push({ id: uuidv4(), size: size, status: 'pending', location: null });
            }
        }
        
        if (Array.isArray(existingCargo.containers)) {
          existingCargo.containers.forEach(oldC => {
              if (!usedExistingContainerIds.has(oldC.id) && !updatedContainers.includes(oldC)) { 
                  oldC.status = 'pending';
                  oldC.location = null;
              }
          });
        }

        missions[missionIndex].cargos[cargoIndex] = {
          ...existingCargo,
          material,
          pickupLocation: fullPickupLocation,
          dropoffLocation: fullDropoffLocation,
          totalScu: totalScuInputVal,
          containers: updatedContainers
        };
        saveShips(); 
      }
      hideAddMaterialForm();
    } else { 
      const fullPickupLocation = locationsList.find(l => parseLocation(l).name === pickupLocationName) || pickupLocationName;
      const fullDropoffLocation = locationsList.find(l => parseLocation(l).name === dropoffLocationName) || dropoffLocationName;

      const newCargo = {
        id: Date.now(),
        material,
        pickupLocation: fullPickupLocation,
        dropoffLocation: fullDropoffLocation,
        totalScu: totalScuInputVal,
        containers: containersData
      };
      missions[missionIndex].cargos.push(newCargo);
      
      document.getElementById('totalScu').value = '';
      materialForm.querySelectorAll('.scu-count-badge').forEach(span => {
        span.textContent = '0';
        span.style.display = 'none';
      });
      updateContainerValidationMessage(0); 

      submitMaterialBtn.focus();
    }

    saveMissions();
    renderTable();
  });
  
  containerBreakdownSection.addEventListener('click', (e) => {
    const totalScu = parseInt(totalScuInput.value, 10);
    if (isNaN(totalScu) || totalScu <= 0) {
      alert("Please enter a valid total SCU value before assigning containers.");
      totalScuInput.focus();
      return;
    }

    // Handle left-click on add button to increment
    if (e.target.classList.contains('scu-add-btn') && e.type === 'click') {
      const countSpan = e.target.previousElementSibling;
      let currentCount = parseInt(countSpan.textContent, 10);
      currentCount++;
      countSpan.textContent = currentCount;
      countSpan.style.display = 'inline-block';
      updateContainerValidationMessage(totalScu);
    }
    
    // Handle right-click on add button to decrement
    if (e.target.classList.contains('scu-add-btn') && e.type === 'contextmenu') {
        e.preventDefault(); // Prevent context menu from appearing
        const countSpan = e.target.previousElementSibling;
        let currentCount = parseInt(countSpan.textContent, 10);
        if (currentCount > 0) {
            currentCount--;
            countSpan.textContent = currentCount;
            if (currentCount === 0) {
                countSpan.style.display = 'none';
            }
            updateContainerValidationMessage(totalScu);
        }
    }
  });

  // Need to also listen for contextmenu for the right-click decrement
  containerBreakdownSection.addEventListener('contextmenu', (e) => {
    if (e.target.classList.contains('scu-add-btn')) {
        e.preventDefault();
        containerBreakdownSection.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            target: e.target,
            type: 'contextmenu' // Pass type to handler
        }));
    }
  });

  resetScuInputsBtn.addEventListener('click', () => {
    containerBreakdownSection.querySelectorAll('.scu-count-badge').forEach(span => {
      span.textContent = '0';
      span.style.display = 'none';
    });
    const totalScu = parseInt(totalScuInput.value, 10) || 0;
    updateContainerValidationMessage(totalScu);
  });

  cancelAddMaterialBtn.addEventListener('click', () => {
    const missionId = parseInt(missionIdInput.value, 10);
    const mission = missions.find(m => m.id === missionId);

    if (isNewMissionCreation && mission && (!mission.cargos || mission.cargos.length === 0)) {
        missions = missions.filter(m => m.id !== missionId);
        saveMissions();
        renderTable();
    }
    
    hideAddMaterialForm();
    updateScuButtonsState(Infinity); // Re-enable all buttons when form is hidden
  });

  document.getElementById('summary-tab-content').addEventListener('click', (e) => {
    const button = e.target.closest('button');
    const editableName = e.target.closest('.editable-name, .mission-card-title');
    const locationCell = e.target.closest('.location-cell');
    const editTrigger = e.target.closest('.edit-trigger');
    
    if (locationCell && !button && !editTrigger) {
      e.stopPropagation(); 
      return;
    }

    if (button && editableName) return; 
    
    const header = e.target.closest('.mission-group-header');
    if (!button && (!editableName || (editableName && e.target.tagName !== 'SPAN')) && header) {
      header.classList.toggle('collapsed');
      const missionId = parseInt(header.dataset.missionId, 10);
      const locationGroup = header.dataset.locationGroup;

      if (missionId) {
        document.querySelectorAll(`.mission-item[data-mission-id="${missionId}"]`).forEach(row => {
          row.classList.toggle('collapsed');
        });
      } else if (locationGroup) {
        document.querySelectorAll(`.location-item[data-location-group="${locationGroup}"]`).forEach(row => {
          row.classList.toggle('collapsed');
        });
      }
      return;
    }

    const materialGroupHeader = e.target.closest('.material-group-header-cz');
    if (materialGroupHeader) {
        const containerList = materialGroupHeader.nextElementSibling;
        if (containerList && containerList.classList.contains('container-list-cz')) {
            containerList.classList.toggle('collapsed');
            materialGroupHeader.classList.toggle('collapsed');
        }
        return;
    }

    const missionCard = e.target.closest('.mission-card');
    const materialCard = e.target.closest('.material-card');

    if (editableName) {
      const missionId = parseInt(missionCard.dataset.missionId, 10);
      const mission = missions.find(m => m.id === missionId);
      if (mission) {
        editMissionIdInput.value = mission.id;
        editMissionNameInput.value = mission.name;
        editMissionPayoutInput.value = mission.payout || 0;
        editMissionTypeInput.value = mission.type || 'Local';
        editMissionModal.show();
      }
      return;
    }
    
    // Actions on the mission card itself (add/delete mission)
    if (button && missionCard && !materialCard) {
      const missionId = parseInt(missionCard.dataset.missionId, 10);
      if (!missionId) return;

      const mission = missions.find(m => m.id === missionId);

      if (button.classList.contains('add-material-btn')) {
        showAddMaterialForm(mission.id, mission.name);
      } else if (button.classList.contains('delete-mission-btn')) {
        if (confirm('¿Estás seguro de que quieres eliminar esta misión y toda su carga? Esta acción no se puede deshacer.')) {
            missions = missions.filter(m => m.id !== missionId);
            // This part is complex, might need to re-evaluate if it's correct
            const missionCargos = mission.cargos ? mission.cargos.map(c => c.id) : [];
            ships.forEach(s => {
              s.platforms.forEach(p => {
                  if (Array.isArray(p.loadedContainers)) {
                      p.loadedContainers = p.loadedContainers.filter(lc => !missionCargos.includes(lc.cargoId));
                      p.occupiedScu = p.loadedContainers.reduce((sum, lc) => sum + lc.size, 0);
                  }
              });
            });
            if (parseInt(missionIdInput.value, 10) === missionId) {
                hideAddMaterialForm();
            }
            saveMissions();
            saveShips();
            renderTable();
        }
      }
      return;
    }

    // Actions on a material card within a mission card
    if (materialCard && missionCard) {
        const cargoId = parseInt(materialCard.dataset.id, 10);
        const missionId = parseInt(missionCard.dataset.missionId, 10);
        const mission = missions.find(m => m.id === missionId);
        const cargo = mission ? (Array.isArray(mission.cargos) ? mission.cargos.find(c => c.id === cargoId) : null) : null; 

        if (button && button.classList.contains('edit-btn') || editTrigger) {
            if(cargo && mission) {
                showEditMaterialForm(cargo, mission.id, mission.name);
            }
            return; 
        }

        if(button && cargo) {
             if (button.classList.contains('delete-btn')) {
                 if(mission) {
                    mission.cargos = mission.cargos.filter(c => c.id !== cargoId);
                    ships.forEach(s => {
                        s.platforms.forEach(p => {
                            p.loadedContainers = Array.isArray(p.loadedContainers) ? p.loadedContainers.filter(lc => lc.cargoId !== cargoId) : [];
                            p.occupiedScu = p.loadedContainers.reduce((sum, lc) => sum + lc.size, 0);
                        });
                    });
                    saveMissions();
                    saveShips();
                    renderTable();
                 }
            } else if (button.classList.contains('load-btn')) {
                document.getElementById('cargo-zone-tab').click();
            } else if (button.classList.contains('unload-btn')) {
                if (confirm(translations[currentLang].confirm_unload)) {
                    ships.forEach(s => {
                        s.platforms.forEach(p => {
                            p.loadedContainers = Array.isArray(p.loadedContainers) ? p.loadedContainers.filter(lc => lc.cargoId !== cargoId) : [];
                            p.occupiedScu = p.loadedContainers.reduce((sum, lc) => sum + lc.size, 0);
                        });
                    });
                    if (Array.isArray(cargo.containers)) {
                        cargo.containers.forEach(c => {
                            c.status = 'pending';
                            c.location = null;
                        });
                    }
                    cargo.status = 'pending'; 
                    saveMissions();
                    saveShips();
                    renderTable();
                }
            } else if(button.classList.contains('deliver-btn')) {
                 if (Array.isArray(cargo.containers)) {
                    cargo.containers.forEach(c => {
                        if (c.status === 'loaded') {
                            c.status = 'delivered';
                        }
                    });
                }
                cargo.status = getCargoOverallStatus(cargo);

                const missionAllCargosDelivered = mission.cargos.every(c => getCargoOverallStatus(c) === 'delivered');
                if (missionAllCargosDelivered) {
                    mission.completionDate = new Date().toISOString();
                    missionHistory.push(mission);
                    missions = missions.filter(m => m.id !== mission.id);
                    currentBalance += (mission.payout || 0);
                    saveCurrentBalance();
                    saveMissionHistory();
                }

                saveMissions();
                renderTable();
            }
        }
    }
  });

  historyTableBody.addEventListener('click', e => {
    const button = e.target.closest('button');
    if (!button || !button.classList.contains('restore-mission-btn')) return;

    const row = e.target.closest('tr');
    const missionId = parseInt(row.dataset.missionId, 10);
    
    const t = translations[currentLang];
    if (confirm(t.restore_mission_prompt)) {
      const missionIndex = missionHistory.findIndex(m => m.id === missionId);
      if (missionIndex !== -1) {
        const [missionToRestore] = missionHistory.splice(missionIndex, 1);
        
        if (missionToRestore.cargos && Array.isArray(missionToRestore.cargos)) {
            missionToRestore.cargos.forEach(c => {
                if (c.containers && Array.isArray(c.containers)) {
                    c.containers.forEach(cont => {
                        cont.status = 'pending';
                        cont.location = null;
                    });
                }
                c.status = 'pending';
            });
        }
        delete missionToRestore.completionDate;
        
        currentBalance -= (missionToRestore.payout || 0);
        saveCurrentBalance();
        missions.push(missionToRestore);

        saveMissions();
        saveMissionHistory();
        renderTable();
      }
    }
  });

  clearAllButton.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres eliminar TODAS las misiones y cargas? Esta acción no se puede deshacer.')) {
      missions = [];
      ships.forEach(s => s.platforms.forEach(p => { p.loadedContainers = []; p.occupiedScu = 0; })); 
      saveMissions();
      saveShips();
      renderTable();
      hideAddMaterialForm();
    }
  });

  clearHistoryBtn.addEventListener('click', () => {
    const t = translations[currentLang];
    if (confirm(t.clear_history + '? ' + 'Esta acción no se puede rehacer.')) { 
      missionHistory = [];
      saveMissionHistory();
      renderTable();
    }
  });

  loadAllPendingButton.addEventListener('click', () => {
    let itemsLoaded = false;
    missions.forEach(mission => {
      if (Array.isArray(mission.cargos)) {
        mission.cargos.forEach(cargo => {
          if (Array.isArray(cargo.containers)) {
            cargo.containers.forEach(container => {
                if (container.status === 'pending') {
                    container.status = 'loaded'; 
                    itemsLoaded = true;
                }
            });
          }
          cargo.status = getCargoOverallStatus(cargo); 
        });
      }
    });
    if (itemsLoaded) {
      saveMissions();
      renderTable();
    }
  });

  editMissionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const missionId = parseInt(editMissionIdInput.value, 10);
    const missionIndex = missions.findIndex(m => m.id === missionId);
    if (missionIndex !== -1) {
      missions[missionIndex].name = editMissionNameInput.value.trim();
      missions[missionIndex].payout = parseInt(editMissionPayoutInput.value, 10) || 0;
      missions[missionIndex].type = editMissionTypeInput.value;
      saveMissions();
      renderTable();
      editMissionModal.hide();
    }
  });

  saveDataListsBtn.addEventListener('click', () => {
    const newMaterials = materialsListTextarea.value.split('\n').map(s => s.trim()).filter(Boolean);
    const newLocations = locationsListTextarea.value.split('\n').map(s => s.trim()).filter(Boolean);

    materialsList = [...new Set(newMaterials)].sort();
    locationsList = [...new Set(newLocations)].sort();
    
    saveLists();
    populateDatalists();
    if (manageDataModalEl) {
      // Correctly get the modal instance
      const modalInstance = bootstrap.Modal.getInstance(manageDataModalEl);
      if (modalInstance) {
        modalInstance.hide();
      }
    }
    playSound('confirm');
  });

  const renderCreateShipPlatformInputs = (platforms = []) => {
    createShipPlatformsContainer.innerHTML = '';
    (Array.isArray(platforms) ? platforms : []).forEach((platform, index) => {
        const div = document.createElement('div');
        div.className = 'mb-3 platform-input-group';
        div.innerHTML = `
          <div class="row g-2 align-items-end">
              <div class="col-md-6">
                  <label for="createPlatformName_${index}" class="form-label">${translations[currentLang].platform_name} ${index + 1}</label>
                  <input type="text" class="form-control platform-name-input" id="createPlatformName_${index}" required value="${platform.name || `Plataforma ${index + 1}`}">
              </div>
              <div class="col-md-6">
                  <label for="createPlatformCapacity_${index}" class="form-label">${translations[currentLang].platform_scu_capacity}</label>
                  <input type="number" class="form-control platform-capacity-input" id="createPlatformCapacity_${index}" min="1" required value="${platform.capacity}">
              </div>
          </div>
        `;
        createShipPlatformsContainer.appendChild(div);
    });
  };

  addPlatformBtnCreate.addEventListener('click', () => {
    const platforms = [];
    createShipPlatformsContainer.querySelectorAll('.platform-input-group').forEach(group => {
        platforms.push({
            name: group.querySelector('.platform-name-input').value,
            capacity: parseInt(group.querySelector('.platform-capacity-input').value, 10),
            occupiedScu: 0, 
            loadedContainers: [] 
        });
    });
    platforms.push({ name: `Plataforma ${platforms.length + 1}`, capacity: 1, occupiedScu: 0, loadedContainers: [] });
    renderCreateShipPlatformInputs(platforms);
  });

  removePlatformBtnCreate.addEventListener('click', () => {
    const platformGroups = createShipPlatformsContainer.querySelectorAll('.platform-input-group');
    if (platformGroups.length > 0) {
        platformGroups[platformGroups.length - 1].remove();
    }
  });

  createShipForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newShipName = createShipNameInput.value.trim();
    const quantumFuelCapacity = parseFloat(createQuantumFuelCapacityInput.value) || 0;
    const quantumTravelSpeed = parseInt(createQuantumTravelSpeedInput.value, 10) || 0; 
    
    const platforms = [];
    let calculatedTotalScu = 0;
    let isValid = true;
    createShipPlatformsContainer.querySelectorAll('.platform-input-group').forEach((group, index) => {
      const name = group.querySelector('.platform-name-input').value.trim();
      const capacity = parseInt(group.querySelector('.platform-capacity-input').value, 10);
      if (isNaN(capacity) || capacity <= 0) {
        alert(`Please enter a valid capacity for Platform ${index + 1}.`);
        isValid = false;
        return; 
      }
      platforms.push({ id: uuidv4(), name: name, capacity: capacity, occupiedScu: 0, loadedContainers: [] });
      calculatedTotalScu += capacity;
    });

    if (!isValid) return;

    if (calculatedTotalScu !== parseInt(createShipTotalScuInput.value, 10)) {
      alert(`The sum of platform capacities (${calculatedTotalScu} SCU) does not match the ship's total capacity (${createShipTotalScuInput.value} SCU). Please adjust them.`);
      return;
    }

    ships.push({
      id: Date.now(),
      name: newShipName,
      totalScu: calculatedTotalScu,
      quantumFuelCapacity: quantumFuelCapacity, 
      quantumTravelSpeed: quantumTravelSpeed,   
      platforms: platforms
    });
    
    saveShips();
    renderTable();
    createShipModal.hide();
  });

  const renderEditShipPlatformInputs = (platforms = []) => {
    editShipPlatformsContainer.innerHTML = '';
    (Array.isArray(platforms) ? platforms : []).forEach((platform, index) => {
        const div = document.createElement('div');
        div.className = 'mb-3 platform-input-group';
        div.dataset.platformId = platform.id; 
        div.innerHTML = `
          <div class="row g-2 align-items-end">
              <div class="col-md-6">
                  <label for="editPlatformName_${platform.id}" class="form-label">${translations[currentLang].platform_name} ${index + 1}</label>
                  <input type="text" class="form-control platform-name-input" id="editPlatformName_${platform.id}" required value="${platform.name || `Plataforma ${index + 1}`}">
              </div>
              <div class="col-md-6">
                  <label for="editPlatformCapacity_${platform.id}" class="form-label">${translations[currentLang].platform_scu_capacity}</label>
                  <input type="number" class="form-control platform-capacity-input" id="editPlatformCapacity_${platform.id}" min="1" required value="${platform.capacity}">
              </div>
          </div>
        `;
        editShipPlatformsContainer.appendChild(div);
    });
  };

  addPlatformBtnEdit.addEventListener('click', () => {
    const platforms = [];
    editShipPlatformsContainer.querySelectorAll('.platform-input-group').forEach(group => {
        platforms.push({
            id: group.dataset.platformId, 
            name: group.querySelector('.platform-name-input').value,
            capacity: parseInt(group.querySelector('.platform-capacity-input').value, 10),
            occupiedScu: 0, 
            loadedContainers: [] 
        });
    });
    platforms.push({ id: uuidv4(), name: `Plataforma ${platforms.length + 1}`, capacity: 1, occupiedScu: 0, loadedContainers: [] });
    renderEditShipPlatformInputs(platforms);
  });

  removePlatformBtnEdit.addEventListener('click', () => {
    const platformGroups = editShipPlatformsContainer.querySelectorAll('.platform-input-group');
    if (platformGroups.length > 0) {
      const lastGroup = platformGroups[platformGroups.length - 1];
      const platformId = lastGroup.dataset.platformId;
      const shipId = parseInt(editShipIdInput.value, 10);
      
      if (shipId) { 
        const ship = ships.find(s => s.id === shipId);
        if (ship && Array.isArray(ship.platforms)) {
          const platformToDelete = ship.platforms.find(p => p.id === platformId);
          if (platformToDelete && Array.isArray(platformToDelete.loadedContainers) && platformToDelete.loadedContainers.length > 0) {
            alert("You cannot delete a platform that has cargo assigned. Unassign all cargo first.");
            return;
          }
        }
      }
      lastGroup.remove();
    }
  });

  saveEditedShipBtn.addEventListener('click', (e) => {
    e.preventDefault();

    const shipId = parseInt(editShipIdInput.value, 10);
    const shipIndex = ships.findIndex(s => s.id === shipId);
    if (shipIndex === -1) {
        alert("Error: Ship not found.");
        return;
    }

    const oldShip = ships[shipIndex];
    const newShipName = editShipNameInput.value.trim();
    const newShipTotalScu = parseInt(editShipTotalScuInput.value, 10);
    const newQuantumFuelCapacity = parseFloat(editQuantumFuelCapacityInput.value) || 0;
    const newQuantumTravelSpeed = parseInt(editQuantumTravelSpeedInput.value, 10) || 0;   
    const updatedPlatforms = [];
    let calculatedTotalScu = 0;
    let isValid = true;

    editShipPlatformsContainer.querySelectorAll('.platform-input-group').forEach(group => {
        const platformName = group.querySelector('.platform-name-input').value.trim();
        const platformCapacity = parseInt(group.querySelector('.platform-capacity-input').value, 10);
        
        if (isNaN(platformCapacity) || platformCapacity <= 0) {
            alert(`Please enter a valid capacity for the platform "${platformName}".`);
            isValid = false;
            return;
        }

        const existingPlatformId = group.dataset.platformId;
        const oldPlatform = Array.isArray(oldShip.platforms) ? oldShip.platforms.find(p => p.id === existingPlatformId) : null;

        let platformIdToUse = existingPlatformId || uuidv4(); 
        
        let loadedContainers = [];
        let occupiedScu = 0;

        if (oldPlatform) {
            loadedContainers = Array.isArray(oldPlatform.loadedContainers) ? oldPlatform.loadedContainers : [];
            occupiedScu = oldPlatform.occupiedScu;

            if (platformCapacity < occupiedScu) {
                alert(`The platform "${platformName}" is currently loaded with ${occupiedScu} SCU, which exceeds the new capacity of ${platformCapacity} SCU. Please unload the cargo from this platform before reducing its capacity.`);
                isValid = false;
                return;
            }
        } else {
            loadedContainers = [];
            occupiedScu = 0;
        }

        updatedPlatforms.push({
            id: platformIdToUse,
            name: platformName,
            capacity: platformCapacity,
            occupiedScu: occupiedScu,
            loadedContainers: loadedContainers
        });
        calculatedTotalScu += platformCapacity;
    });

    if (!isValid) return;

    if (calculatedTotalScu !== newShipTotalScu) {
        alert(`The sum of platform capacities (${calculatedTotalScu} SCU) does not match the ship's total capacity (${newShipTotalScu} SCU). Please adjust them.`);
        return;
    }

    ships[shipIndex] = {
        id: shipId,
        name: newShipName,
        totalScu: newShipTotalScu,
        quantumFuelCapacity: newQuantumFuelCapacity, 
        quantumTravelSpeed: newQuantumTravelSpeed,   
        platforms: updatedPlatforms
    };

    missions.forEach(m => {
        if (Array.isArray(m.cargos)) {
            m.cargos.forEach(c => c.status = getCargoOverallStatus(c));
        }
    });

    saveMissions();
    saveShips();
    renderTable();
    editShipDetailsModal.hide();
  });

  createShipModalEl.addEventListener('show.bs.modal', () => {
    createShipForm.reset();
    createQuantumFuelCapacityInput.value = ''; 
    createQuantumTravelSpeedInput.value = '';   
    renderCreateShipPlatformInputs([]);
    createShipNameInput.focus();
  });

  shipContainer.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-ship-btn');
    const deleteBtn = e.target.closest('.delete-ship-btn');
    const unloadSingleBtn = e.target.closest('.unload-single-container-btn');
    const loadPlatformCargoBtn = e.target.closest('.load-platform-cargo-btn');
    const materialGroupHeader = e.target.closest('.material-group-header-cz');

    if (materialGroupHeader) {
        const containerList = materialGroupHeader.nextElementSibling;
        if (containerList && containerList.classList.contains('container-list-cz')) {
            containerList.classList.toggle('collapsed');
            materialGroupHeader.classList.toggle('collapsed');
        }
        return;
    }

    if (editBtn) {
      const shipId = parseInt(editBtn.dataset.shipId, 10);
      const ship = ships.find(s => s.id === shipId);
      if (ship) {
        editShipIdInput.value = ship.id;
        editShipNameInput.value = ship.name;
        editShipTotalScuInput.value = ship.totalScu;
        editQuantumFuelCapacityInput.value = ship.quantumFuelCapacity || ''; 
        editQuantumTravelSpeedInput.value = ship.quantumTravelSpeed || '';   
        renderEditShipPlatformInputs(ship.platforms); 
        editShipDetailsModal.show();
      }
    } else if (deleteBtn) {
      if (confirm('Are you sure you want to delete this ship? All cargo will be unassigned.')) {
        const shipId = parseInt(deleteBtn.dataset.shipId, 10);
        const shipToDelete = ships.find(s => s.id === shipId);
        if (shipToDelete) {
          if (Array.isArray(shipToDelete.platforms)) {
            shipToDelete.platforms.forEach(p => {
              p.loadedContainers.forEach(lc => {
                const { cargo } = findCargoAndMission(lc.cargoId);
                if (cargo) {
                    const container = getContainerById(cargo, lc.id);
                    if (container) {
                        container.status = 'pending';
                        container.location = null;
                    }
                }
              });
              p.loadedContainers = [];
              p.occupiedScu = 0;
            });
          }
          missions.forEach(m => {
            if (Array.isArray(m.cargos)) {
              m.cargos.forEach(c => c.status = getCargoOverallStatus(c))
            }
          });

          ships = ships.filter(s => s.id !== shipId);
          saveMissions(); 
          saveShips();
          renderTable();
        }
      }
    } else if (unloadSingleBtn) {
      const shipId = parseInt(unloadSingleBtn.dataset.shipId, 10);
      const platformId = unloadSingleBtn.dataset.platformId;
      const containerId = unloadSingleBtn.dataset.containerId;
      const cargoId = parseInt(unloadSingleBtn.dataset.cargoId, 10);
      const t = translations[currentLang];

      if (confirm(t.confirm_unload_container)) {
        const selectedShip = ships.find(s => s.id === shipId);
        const selectedPlatform = selectedShip && Array.isArray(selectedShip.platforms) ? selectedShip.platforms.find(p => p.id === platformId) : null;
        const { cargo } = findCargoAndMission(cargoId);

        if (selectedPlatform && cargo) {
          const loadedIndex = Array.isArray(selectedPlatform.loadedContainers) ? selectedPlatform.loadedContainers.findIndex(lc => lc.id === containerId) : -1;
          const originalCargoContainer = Array.isArray(cargo.containers) ? cargo.containers.find(c => c.id === containerId) : null;

          if (loadedIndex !== -1 && originalCargoContainer) {
            const [removedLoadedContainer] = selectedPlatform.loadedContainers.splice(loadedIndex, 1);
            selectedPlatform.occupiedScu -= removedLoadedContainer.size;
            
            originalCargoContainer.status = 'pending';
            originalCargoContainer.location = null;
            cargo.status = getCargoOverallStatus(cargo); 

            saveMissions();
            saveShips();
            renderTable();
          }
        }
     }
    } else if (loadPlatformCargoBtn) {
        const shipId = parseInt(loadPlatformCargoBtn.dataset.shipId, 10);
        const platformId = loadPlatformCargoBtn.dataset.platformId;
        openPlatformCargoLoadModal(shipId, platformId);
    }
  });

  currentBalanceInput.addEventListener('change', (e) => {
    let value = parseFloat(e.target.value);
    if (isNaN(value) || value < 0) {
      value = 0; 
    }
    currentBalance = value;
    saveCurrentBalance();
    renderHistoryView(); 
  });

  let tooltipElement = null;

  const removeTooltip = () => {
    if (tooltipElement) {
      tooltipElement.remove();
      tooltipElement = null;
    }
  };

  document.body.addEventListener('click', (e) => {
    const locationCell = e.target.closest('.location-cell');

    if (!locationCell || (tooltipElement && tooltipElement.parentElement === document.body)) {
      removeTooltip();
      if(!locationCell) return; 
    }
    
    if (tooltipElement) { 
      removeTooltip();
      return;
    }
    
    const details = locationCell.dataset.details;
    if (details) {
      tooltipElement = document.createElement('div');
      tooltipElement.className = 'location-details-tooltip';
      tooltipElement.textContent = details;
      
      document.body.appendChild(tooltipElement);
      
      tooltipElement.style.left = `${e.pageX + 15}px`;
      tooltipElement.style.top = `${e.pageY + 15}px`;
    }
  }, true); 

  const renderCargoZone = () => {
    const shipContainer = document.getElementById('ship-container');
    const noShipsMessage = document.getElementById('no-ships-message');
    const t = translations[currentLang]; 

    shipContainer.innerHTML = ''; 

    if (!ships || ships.length === 0) {
        if(noShipsMessage) noShipsMessage.style.display = 'block';
        return;
    }

    if(noShipsMessage) noShipsMessage.style.display = 'none';

    ships.forEach(ship => {
        const shipCard = document.createElement('div');
        shipCard.className = 'glass-panel p-3 mb-4'; 
        shipCard.dataset.shipId = ship.id;

        const totalOccupiedScu = Array.isArray(ship.platforms) ? ship.platforms.reduce((sum, p) => sum + p.occupiedScu, 0) : 0;
        const percentageFilled = ship.totalScu > 0 ? (totalOccupiedScu / ship.totalScu) * 100 : 0;

        let platformsHtml = '';
        if (Array.isArray(ship.platforms)) {
            ship.platforms.forEach(platform => {
                const platformPercentageFilled = platform.capacity > 0 ? (platform.occupiedScu / platform.capacity) * 100 : 0;
                
                let loadedItemsHtml = '';
                if (Array.isArray(platform.loadedContainers) && platform.loadedContainers.length > 0) {
                    
                    const groupedByMission = platform.loadedContainers.reduce((acc, lc) => {
                        const { mission, cargo } = findCargoAndMission(lc.cargoId);
                        if (!mission || !cargo) return acc;

                        if (!acc[mission.id]) {
                            acc[mission.id] = { missionName: mission.name, materials: {} };
                        }
                        if (!acc[mission.id].materials[cargo.material]) {
                             acc[mission.id].materials[cargo.material] = { containers: [], counts: {} };
                        }
                        acc[mission.id].materials[cargo.material].containers.push(lc);
                        acc[mission.id].materials[cargo.material].counts[lc.size] = (acc[mission.id].materials[cargo.material].counts[lc.size] || 0) + 1;

                        return acc;
                    }, {});

                    for (const missionId in groupedByMission) {
                        const missionGroup = groupedByMission[missionId];
                        loadedItemsHtml += `<div class="mission-cargo-group-cz"><h6 class="mission-group-title-cz">${missionGroup.missionName}</h6>`;

                        for (const material in missionGroup.materials) {
                            const materialGroup = missionGroup.materials[material];
                            
                            const countSummary = Object.entries(materialGroup.counts)
                                .sort(([sizeA], [sizeB]) => parseInt(sizeA) - parseInt(sizeB))
                                .map(([size, count]) => `${count}x ${size} SCU`)
                                .join(', ');

                            loadedItemsHtml += `
                                <div class="material-cargo-item-cz">
                                    <div class="material-group-header-cz">
                                        <div class="d-flex align-items-center">
                                            <i class="bi bi-box me-2"></i>
                                            <span class="material-name-cz">${material}</span>
                                        </div>
                                        <div class="container-summary-cz">
                                            <span class="small">${countSummary}</span>
                                        </div>
                                    </div>
                                </div>`;
                        }
                        loadedItemsHtml += `</div>`;
                    }

                } else {
                    loadedItemsHtml += `<div class="text-muted-glow small p-2">${t.no_cargo_on_platform}</div>`;
                }


                platformsHtml += `
                    <div class="platform-card">
                        <div class="platform-header">
                            <div class="d-flex align-items-center">
                                <i class="bi bi-grid-3x3-gap-fill me-2"></i><strong>${platform.name}</strong>
                            </div>
                            <div class="capacity flex-grow-1 text-end me-3">
                                <small>${platform.occupiedScu} / ${platform.capacity} SCU</small>
                            </div>
                            <button class="btn btn-sm btn-info load-platform-cargo-btn" data-ship-id="${ship.id}" data-platform-id="${platform.id}" title="${t.manage_cargo_placement}">
                                <i class="bi bi-boxes me-1"></i> ${t.manage_cargo_placement}
                            </button>
                        </div>
                        <div class="progress" style="height: 5px; background-color: rgba(255,255,255,0.1);">
                            <div class="progress-bar bg-primary" role="progressbar" style="width: ${platformPercentageFilled}%" aria-valuenow="${platformPercentageFilled}" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                        <div class="mt-2 platform-contents">
                           ${loadedItemsHtml}
                        </div>
                    </div>
                `;
            });
        }

        const quantumFuelInfo = ship.quantumFuelCapacity ? ` | <i class="bi bi-fuel-pump-fill"></i> ${ship.quantumFuelCapacity.toLocaleString(currentLang, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} scu Quantum` : '';
        const quantumSpeedInfo = ship.quantumTravelSpeed ? ` | <i class="bi bi-speedometer2"></i> ${ship.quantumTravelSpeed.toLocaleString()} km/s` : '';

        shipCard.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap">
                <div class="d-flex align-items-center flex-wrap mb-2 mb-md-0">
                    <h4 class="title-font mb-0 me-3"><i class="bi bi-rocket-takeoff me-2"></i>${ship.name}</h4>
                </div>
                <div class="btn-group">
                    <button class="btn btn-info btn-sm edit-ship-btn" data-ship-id="${ship.id}"><i class="bi bi-pencil-square me-1"></i> ${t.edit_ship}</button>
                    <button class="btn btn-danger btn-sm delete-ship-btn" data-ship-id="${ship.id}"><i class="bi bi-trash-fill me-1"></i> ${t.delete_ship}</button>
                </div>
            </div>
            <div class="mb-3">
                <div class="d-flex justify-content-between">
                    <small>${t.current_ship_load}</small>
                    <small>${totalOccupiedScu} / ${ship.totalScu} SCU</small>
                </div>
                <div class="progress" style="background-color: rgba(255,255,255,0.1);">
                    <div class="progress-bar bg-info" role="progressbar" style="width: ${percentageFilled}%" aria-valuenow="${percentageFilled}" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
            </div>
            <div class="text-muted-glow small mb-3">
                <i class="bi bi-box"></i> ${ship.totalScu.toLocaleString()} SCU${quantumFuelInfo}${quantumSpeedInfo}
            </div>
            <div>
                ${platformsHtml}
            </div>
        `;
        shipContainer.appendChild(shipCard);
    });
  };

  const themeForm = document.getElementById('theme-form');
  const resetThemeBtn = document.getElementById('reset-theme-btn');
  const themeColorPickers = themeForm.querySelectorAll('input[type="color"]');
  const themeNumberInputs = themeForm.querySelectorAll('input[type="number"]');

  const defaultTheme = {
    '--primary-color': '#00aaff',
    '--bg-color': '#0a0f18',
    '--text-color': '#d0e0f0',
    '--input-bg': '#121c2d',
    '--input-border': '#2a3f5a',
    '--panel-bg': 'rgba(18, 28, 45, 0.8)',
    '--panel-border': 'rgba(0, 170, 255, 0.3)',
    '--success-color': '#28a745',
    '--warning-color': '#ffc107',
    '--danger-color': '#ff4d4d',
    '--table-header-bg': 'rgba(0, 170, 255, 0.1)',
    '--table-header-text': 'rgba(0, 170, 255, 0.1)',
    '--table-row-hover': 'rgba(0, 170, 255, 0.05)',
    '--table-bg': 'transparent',
    '--table-text': '#fcfcfc',
    '--table-general-border': '#1a2a3a',
    '--mission-table-cell-border-color': 'var(--panel-border)',
    '--mission-table-thead-th-border-bottom-color': 'var(--panel-border)',
    '--mission-group-header-bg': 'rgba(0, 170, 255, 0.1)',
    '--mission-group-header-text-color': '#c63c3c',
    '--mission-group-header-border-top-color': 'var(--panel-border)',
    '--mission-group-header-border-bottom-color': 'var(--panel-border)',
    '--ship-data-prompt-font-size': '12px' 
  };

  const applyTheme = (theme) => {
    for (const [key, value] of Object.entries(theme)) {
      document.documentElement.style.setProperty(key, value);
    }
  };

  const updateColorPickers = (theme) => {
     themeColorPickers.forEach(picker => {
        const cssVar = picker.dataset.cssVar;
        if(theme[cssVar]) {
            picker.value = theme[cssVar];
        }
    });
     themeNumberInputs.forEach(input => {
        const cssVar = input.dataset.cssVar;
        if (theme[cssVar]) {
            input.value = parseInt(theme[cssVar], 10);
        }
     });
  };
  
  const loadTheme = () => {
    let savedTheme = localStorage.getItem('customTheme');
    try {
        savedTheme = savedTheme ? JSON.parse(savedTheme) : {};
    } catch (e) {
        savedTheme = {};
    }
    const currentTheme = { ...defaultTheme, ...savedTheme };
    applyTheme(currentTheme);
    updateColorPickers(currentTheme);
  };

  themeColorPickers.forEach(picker => {
    picker.addEventListener('input', (e) => {
      const cssVar = e.target.dataset.cssVar;
      const newColor = e.target.value;
      document.documentElement.style.setProperty(cssVar, newColor);
      
      let savedTheme = localStorage.getItem('customTheme');
      try {
        savedTheme = savedTheme ? JSON.parse(savedTheme) : {};
      } catch (e) {
        savedTheme = {};
      }

      savedTheme[cssVar] = newColor;
      localStorage.setItem('customTheme', JSON.stringify(savedTheme));
    });
  });

  themeNumberInputs.forEach(input => {
    input.addEventListener('input', (e) => {
        const cssVar = e.target.dataset.cssVar;
        const unit = e.target.dataset.unit || '';
        const newValue = e.target.value + unit;
        document.documentElement.style.setProperty(cssVar, newValue);

        let savedTheme = localStorage.getItem('customTheme');
        try {
            savedTheme = savedTheme ? JSON.parse(savedTheme) : {};
        } catch (e) {
            savedTheme = {};
        }

        savedTheme[cssVar] = newValue;
        localStorage.setItem('customTheme', JSON.stringify(savedTheme));
    });
  });

  resetThemeBtn.addEventListener('click', () => {
    if(confirm(translations[currentLang].theme_reset + '?')) {
        localStorage.removeItem('customTheme');
        applyTheme(defaultTheme);
        updateColorPickers(defaultTheme);
    }
  });

  document.querySelectorAll("th[data-key='material']").forEach(th => {
    th.style.width = "15%"; 
});

  populateDatalists();
  loadTheme(); 
  renderTable();
  translatePage(currentLang);

  // Sync payout between "Añadir Material a misión" and "Editar Misión"
  if (missionPayoutOnCreateInput) {
    missionPayoutOnCreateInput.addEventListener('focus', (e) => {
      const v = e.target.value.trim();
      if (v === '0' || parseInt(v, 10) === 0) e.target.value = '';
    });
    missionPayoutOnCreateInput.addEventListener('input', () => {
      const missionId = parseInt(missionIdInput.value, 10);
      const idx = missions.findIndex(m => m.id === missionId);
      if (idx !== -1) {
        missions[idx].payout = parseInt(missionPayoutOnCreateInput.value, 10) || 0;
        saveMissions();
        renderSummary();
        if (parseInt(editMissionIdInput.value, 10) === missionId) {
          editMissionPayoutInput.value = missions[idx].payout || 0;
        }
      }
    });
  }
  if (editMissionPayoutInput) {
    editMissionPayoutInput.addEventListener('input', () => {
      const missionId = parseInt(editMissionIdInput.value, 10);
      const idx = missions.findIndex(m => m.id === missionId);
      if (idx !== -1) {
        missions[idx].payout = parseInt(editMissionPayoutInput.value, 10) || 0;
        saveMissions();
        renderSummary();
        if (parseInt(missionIdInput.value, 10) === missionId && !addMaterialFormContainer.classList.contains('d-none')) {
          missionPayoutOnCreateInput.value = missions[idx].payout || 0;
        }
      }
    });
  }

  // === Rutas de Transporte ===
  const originSelect = document.getElementById('route-origin');
  const calculateRouteBtn = document.getElementById('calculate-route-btn');
  const routeResultDiv = document.getElementById('route-result');
  if (calculateRouteBtn && originSelect && routeResultDiv) {
    calculateRouteBtn.addEventListener('click', () => {
      const originInput = originSelect.value.trim();
      if (!originInput) { alert('Please select an origin'); return; }
      const parsedOrigin = parseLocation(originInput);
      const originHub = getHubFromDetails(parsedOrigin.details) || getHubForName(parsedOrigin.name) || originInput;
      const cargosAll = missions.flatMap(m => Array.isArray(m.cargos) ? m.cargos.map(c=>({...c, missionId:m.id, missionName:m.name})) : []);
      const stops = [];
      cargosAll.forEach(c => {
        const pick = parseLocation(c.pickupLocation), drop = parseLocation(c.dropoffLocation);
        const hasLoaded = Array.isArray(c.containers) && c.containers.some(ct=>ct.status==='loaded');
        const hasPending = !Array.isArray(c.containers) || c.containers.length === 0
          ? true
          : c.containers.some(ct => ct.status === 'pending');
        const pickHub = getHubFromDetails(pick.details) || getHubForName(pick.name);
        const dropHub = getHubFromDetails(drop.details) || getHubForName(drop.name);
        if (hasPending && pickHub) stops.push({type:'pickup', cargoId:c.id, name:pick.name, hub:pickHub, label:`Pickup ${c.material} (${c.missionName})`});
        if ((hasLoaded || hasPending) && dropHub) stops.push({type:'delivery', cargoId:c.id, name:drop.name, hub:dropHub, label:`Delivery ${c.material} (${c.missionName})`});
      });
      const visited = new Set(), picked = new Set();
      let current = originHub, totalDist = 0, route = [];
      while (true) {
        const eligible = stops.filter(s => !visited.has(`${s.type}-${s.cargoId}`) && (s.type==='pickup' || picked.has(s.cargoId)));
        if (!eligible.length) break;
        let best = null, bestD = Infinity;
        eligible.forEach(s => { const d = calculateDistancia(current, s.hub); if (d < bestD) { bestD = d; best = s; } });
        if (!best) break;
        route.push({type: best.type, name: best.name, hub: best.hub, label: best.label, dist: isFinite(bestD)?bestD:0});
        totalDist += isFinite(bestD)?bestD:0;
        visited.add(`${best.type}-${best.cargoId}`); if (best.type==='pickup') picked.add(best.cargoId);
        current = best.hub;
      }
      if (!route.length) { routeResultDiv.innerHTML = '<p class="text-muted-glow">No routes to plan.</p>'; return; }
      let html = '<ul class="list-group mb-2">';
      html += `<li class="list-group-item bg-secondary text-white"><strong>Origin:</strong> ${originInput} <span class="ms-2 badge bg-dark">${originHub}</span></li>`;
      route.forEach((s,i)=>{
        const tipo = s.type === 'pickup' ? 'Pickup' : 'Delivery';
        html += `<li class="list-group-item"><strong>${tipo} ${i+1}:</strong> ${s.hub} <span class="text-muted">— ${s.name}</span> <span class="badge bg-info ms-2">${s.dist} Gm</span></li>`;
      });
      html += '</ul>';
      html += `<p><strong>Estimated total distance:</strong> ${totalDist.toFixed(2)} Gm</p>`;
      routeResultDiv.innerHTML = html;
    });
  }

  // === Navegacion (web viewer) ===
  const navigationInput = document.getElementById('navigationSearch');
  const navigationDatalist = document.getElementById('navigation-datalist');
  const openNavigationBtn = document.getElementById('open-navigation-btn');
  const navigationViewerWrap = document.getElementById('navigation-viewer-wrap');
  const navigationViewer = document.getElementById('navigation-viewer');
  let navegacionEntries = [];

  async function loadNavegacion() {
    try {
      const res = await fetch('navegacion.json');
      navegacionEntries = await res.json();
      if (navigationDatalist) {
        navigationDatalist.innerHTML = navegacionEntries
          .map(e => `<option value="${e.name}"></option>`).join('');
      }
    } catch (e) {
      console.error('Error cargando navegacion.json', e);
    }
  }
  loadNavegacion();

  if (openNavigationBtn && navigationInput && navigationViewer && navigationViewerWrap) {
    openNavigationBtn.addEventListener('click', () => {
      const name = navigationInput.value.trim();
      if (!name) return;
      const entry = navegacionEntries.find(e => e.name.toLowerCase() === name.toLowerCase());
      if (!entry || !entry.url) return;
      navigationViewer.src = entry.url;
      navigationViewerWrap.classList.remove('d-none');
    });
  }

  fetchAndPopulateLists();
});

const imageModalEl = document.getElementById('imageModal');
const imageModal = new bootstrap.Modal(imageModalEl);
const modalImage = document.getElementById('modalImage');

if (imageModalEl) {
  imageModalEl.addEventListener('show.bs.modal', function (event) {
      const button = event.relatedTarget; 
      if (button) {
          const diagramSrc = button.getAttribute('data-diagram-src'); 
          if (diagramSrc && modalImage) {
              modalImage.src = diagramSrc;
          }
      }
  });
}

const materialInput = document.getElementById('material');
const pickupLocationInput = document.getElementById('pickupLocation');
const dropoffLocationInput = document.getElementById('dropoffLocation');
const cargoIdInput = document.getElementById('cargoId');

const clearOnFocusIfAdding = (e) => {
  // This function will clear the input's value on focus,
  // but only if we are in "add new material" mode (cargoId is empty).
  if (cargoIdInput && !cargoIdInput.value) {
    e.target.value = '';
  }
};

if(materialInput) materialInput.addEventListener('focus', clearOnFocusIfAdding);
if(pickupLocationInput) pickupLocationInput.addEventListener('focus', clearOnFocusIfAdding);
if(dropoffLocationInput) dropoffLocationInput.addEventListener('focus', clearOnFocusIfAdding);

const getHubFromDetails = (details) => {
  if (!details) return null;
  // Intento directo con formato "(Stanton - X)"
  const wrapped = `(${details})`;
  for (const node of distanceNodes) {
    if (node.toLowerCase() === wrapped.toLowerCase()) return node;
  }
  // Fallback anterior por tokens
  const tokens = details.split('-').map(s => s.trim());
  for (const t of tokens) {
    const tl = t.toLowerCase();
    for (const node of distanceNodes) {
      if (node.toLowerCase() === tl) return node;
    }
  }
  return null;
};

const getHubForName = (name) => {
  if (!name) return null;
  const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`:\\s*${safe}\\s*\\(([^)]+)\\)`, 'i');
  const hit = (localizacionesDisponibles || []).find(s => re.test(s));
  if (hit) {
    const m = hit.match(re);
    const hub = m && m[1] ? getHubFromDetails(m[1]) : null;
    if (hub) return hub;
  }
  const nl = name.toLowerCase();
  for (const node of distanceNodes) if (node.toLowerCase() === nl) return node;
  return null;
};

function fetchAndPopulateLists() {
  try {
    cargarMateriales();
    cargarLocalizaciones();
  } catch (e) {
    console.error('fetchAndPopulateLists error:', e);
  }
}

// Helper: obtiene el HUB actual del campo de ruta
const getCurrentOriginHub = () => {
  const originEl = document.getElementById('route-origin');
  if (!originEl) return null;
  const parsed = parseLocation(originEl.value.trim());
  return getHubFromDetails(parsed.details) || getHubForName(parsed.name) || null;
};

// remove duplicate payout sync listeners defined outside DOMContentLoaded scope
// (These referenced missionPayoutOnCreateInput/editMissionPayoutInput out of scope and caused ReferenceError. Handlers already exist inside DOMContentLoaded.)
// (These referenced missionPayoutOnCreateInput/editMissionPayoutInput out of scope and caused ReferenceError. Handlers already exist inside DOMContentLoaded.)