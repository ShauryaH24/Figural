/**
 * Figural - Draw & Voice to Code
 * A browser-based app for creating web apps from drawings and voice input
 */

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // AI Generation API (Anthropic Claude)
  // API keys are now stored securely on the server (in .env file)
  AI_API_URL: '/api/generate',  // Use local proxy
  AI_MODEL: 'claude-sonnet-4-20250514',
  
  // NVIDIA Parakeet ASR API
  NVIDIA_ASR_URL: '/api/transcribe',  // Use local proxy
  NVIDIA_ASR_MODEL: 'nvidia/parakeet-ctc-1.1b-asr',
  
  STORAGE_KEY: 'figural_session'
};

// ============================================================================
// Utilities
// ============================================================================

function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ============================================================================
// State Management
// ============================================================================

const state = {
  // Drawing
  tool: 'pen',
  color: '#1f2937',
  strokeWidth: 3,
  isDrawing: false,
  elements: [],
  undoStack: [],
  redoStack: [],
  currentPath: null,
  startX: 0,
  startY: 0,

  // Selection
  selectedElement: null,
  isDragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  
  // Resizing
  isResizing: false,
  resizeHandle: null,
  resizeStartBounds: null,
  resizeStartX: 0,
  resizeStartY: 0,
  
  // Zoom & Pan
  zoom: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  lastPanX: 0,
  lastPanY: 0,
  minZoom: 0.25,
  maxZoom: 4,

  // Voice
  isRecording: false,
  mediaRecorder: null,
  audioChunks: [],
  recognition: null,
  transcript: [],
  recordingStartTime: null,

  // Session
  sessionStartTime: null,

  // Images cache (loaded Image objects for redrawing)
  imageCache: new Map(),

  // Generated code
  generatedCode: {
    html: '',
    css: '',
    js: ''
  }
};

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
  canvas: document.getElementById('drawingCanvas'),
  ctx: null,
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.querySelector('.status-text'),
  
  // Tools
  toolButtons: document.querySelectorAll('.tool-btn[data-tool]'),
  colorPicker: document.getElementById('colorPicker'),
  colorPreview: document.getElementById('colorPreview'),
  strokeWidth: document.getElementById('strokeWidth'),
  strokePreview: document.getElementById('strokePreview'),
  undoBtn: document.getElementById('undoBtn'),
  redoBtn: document.getElementById('redoBtn'),
  clearBtn: document.getElementById('clearBtn'),

  // Text input
  textInputOverlay: document.getElementById('textInputOverlay'),
  textInput: document.getElementById('textInput'),
  textConfirm: document.getElementById('textConfirm'),
  textCancel: document.getElementById('textCancel'),

  // Voice & Text Input
  recordBtn: document.getElementById('recordBtn'),
  textPrompt: document.getElementById('textPrompt'),
  transcriptPreview: document.getElementById('transcriptPreview'),
  transcriptText: document.getElementById('transcriptText'),
  recordingTimer: document.getElementById('recordingTimer'),
  timerDisplay: document.getElementById('timerDisplay'),

  // Image
  imageInput: document.getElementById('imageInput'),
  dropOverlay: document.getElementById('dropOverlay'),
  canvasArea: document.getElementById('canvasArea'),

  // Zoom
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomResetBtn: document.getElementById('zoomResetBtn'),
  zoomLabel: document.getElementById('zoomLabel'),

  // Generate
  generateBtn: document.getElementById('generateBtn'),
  loadingOverlay: document.getElementById('loadingOverlay'),

  // Preview modal
  previewModal: document.getElementById('previewModal'),
  previewFrame: document.getElementById('previewFrame'),
  previewContainer: document.getElementById('previewContainer'),
  codeEditor: document.getElementById('codeEditor'),
  codeTextarea: document.getElementById('codeTextarea'),
  codeTabs: document.querySelectorAll('.code-tab'),
  editCodeBtn: document.getElementById('editCodeBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  regenerateBtn: document.getElementById('regenerateBtn'),
  closePreviewBtn: document.getElementById('closePreviewBtn'),
  applyCodeBtn: document.getElementById('applyCodeBtn')
};

// ============================================================================
// Canvas Setup & Drawing
// ============================================================================

function initCanvas() {
  elements.ctx = elements.canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Mouse events
  elements.canvas.addEventListener('mousedown', handleMouseDown);
  elements.canvas.addEventListener('mousemove', handleMouseMove);
  elements.canvas.addEventListener('mouseup', handleMouseUp);
  elements.canvas.addEventListener('mouseleave', handleMouseUp);

  // Touch events
  elements.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  elements.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  elements.canvas.addEventListener('touchend', handleTouchEnd);
}

function resizeCanvas() {
  const rect = elements.canvas.parentElement.getBoundingClientRect();
  elements.canvas.width = rect.width;
  elements.canvas.height = rect.height;
  redrawCanvas();
}

function handleMouseDown(e) {
  // Don't handle if middle mouse (panning)
  if (e.button === 1) return;
  
  const { offsetX, offsetY } = e;
  const screenX = offsetX * (elements.canvas.width / elements.canvas.offsetWidth);
  const screenY = offsetY * (elements.canvas.height / elements.canvas.offsetHeight);
  const { x, y } = screenToCanvas(screenX, screenY);
  
  if (state.tool === 'select') {
    handleSelectionStart(x, y);
  } else {
    startDrawing(x, y);
  }
}

function handleMouseMove(e) {
  const { offsetX, offsetY } = e;
  const screenX = offsetX * (elements.canvas.width / elements.canvas.offsetWidth);
  const screenY = offsetY * (elements.canvas.height / elements.canvas.offsetHeight);
  const { x, y } = screenToCanvas(screenX, screenY);
  
  if (state.tool === 'select') {
    handleSelectionMove(x, y);
  } else if (state.isDrawing) {
    continueDrawing(x, y);
  }
}

function handleMouseUp(e) {
  const { offsetX, offsetY } = e;
  const screenX = offsetX * (elements.canvas.width / elements.canvas.offsetWidth);
  const screenY = offsetY * (elements.canvas.height / elements.canvas.offsetHeight);
  const { x, y } = screenToCanvas(screenX, screenY);
  
  if (state.tool === 'select') {
    handleSelectionEnd();
  } else if (state.isDrawing) {
    endDrawing(x, y);
  }
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = elements.canvas.getBoundingClientRect();
  const offsetX = touch.clientX - rect.left;
  const offsetY = touch.clientY - rect.top;
  const screenX = offsetX * (elements.canvas.width / rect.width);
  const screenY = offsetY * (elements.canvas.height / rect.height);
  const { x, y } = screenToCanvas(screenX, screenY);
  
  if (state.tool === 'select') {
    handleSelectionStart(x, y);
  } else {
    startDrawing(x, y);
  }
}

function handleTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = elements.canvas.getBoundingClientRect();
  const offsetX = touch.clientX - rect.left;
  const offsetY = touch.clientY - rect.top;
  const screenX = offsetX * (elements.canvas.width / rect.width);
  const screenY = offsetY * (elements.canvas.height / rect.height);
  const { x, y } = screenToCanvas(screenX, screenY);
  
  if (state.tool === 'select') {
    handleSelectionMove(x, y);
  } else if (state.isDrawing) {
    continueDrawing(x, y);
  }
}

function handleTouchEnd(e) {
  if (state.tool === 'select') {
    handleSelectionEnd();
  } else if (state.isDrawing) {
    endDrawing(state.currentPath?.points?.slice(-1)[0]?.x || 0, 
               state.currentPath?.points?.slice(-1)[0]?.y || 0);
  }
}

function startDrawing(x, y) {
  if (state.tool === 'text') {
    showTextInput(x, y);
    return;
  }

  state.isDrawing = true;
  state.startX = x;
  state.startY = y;
  state.redoStack = [];

  const timestamp = Date.now();

  if (state.tool === 'pen' || state.tool === 'eraser') {
    state.currentPath = {
      type: state.tool === 'eraser' ? 'eraser' : 'path',
      points: [{ x, y }],
      color: state.tool === 'eraser' ? '#ffffff' : state.color,
      strokeWidth: state.tool === 'eraser' ? state.strokeWidth * 3 : state.strokeWidth,
      timestamp
    };
  } else {
    state.currentPath = {
      type: state.tool,
      startX: x,
      startY: y,
      endX: x,
      endY: y,
      color: state.color,
      strokeWidth: state.strokeWidth,
      timestamp
    };
  }
}

function continueDrawing(x, y) {
  if (!state.currentPath) return;

  if (state.currentPath.type === 'path' || state.currentPath.type === 'eraser') {
    state.currentPath.points.push({ x, y });
    
    // Draw incrementally for performance with zoom transform
    const ctx = elements.ctx;
    const points = state.currentPath.points;
    const len = points.length;
    
    if (len >= 2) {
      // Apply zoom transformation
      ctx.setTransform(state.zoom, 0, 0, state.zoom, state.panX, state.panY);
      ctx.beginPath();
      ctx.strokeStyle = state.currentPath.color;
      ctx.lineWidth = state.currentPath.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(points[len - 2].x, points[len - 2].y);
      ctx.lineTo(points[len - 1].x, points[len - 1].y);
      ctx.stroke();
      // Reset transform
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  } else {
    state.currentPath.endX = x;
    state.currentPath.endY = y;
    redrawCanvas();
    drawElement(state.currentPath);
  }
}

function endDrawing(x, y) {
  if (!state.isDrawing || !state.currentPath) return;

  state.isDrawing = false;

  if (state.currentPath.type !== 'path' && state.currentPath.type !== 'eraser') {
    state.currentPath.endX = x;
    state.currentPath.endY = y;
  }

  // Add dimensions for shapes
  if (state.currentPath.type === 'rectangle' || state.currentPath.type === 'circle') {
    state.currentPath.width = Math.abs(state.currentPath.endX - state.currentPath.startX);
    state.currentPath.height = Math.abs(state.currentPath.endY - state.currentPath.startY);
  }

  state.elements.push(state.currentPath);
  state.undoStack.push({ action: 'add', element: state.currentPath });
  state.currentPath = null;

  redrawCanvas();
  saveSession();
}

function drawElement(el) {
  const ctx = elements.ctx;
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.color;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (el.type) {
    case 'path':
    case 'eraser':
      if (el.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(el.points[0].x, el.points[0].y);
      for (let i = 1; i < el.points.length; i++) {
        ctx.lineTo(el.points[i].x, el.points[i].y);
      }
      ctx.stroke();
      break;

    case 'line':
      ctx.beginPath();
      ctx.moveTo(el.startX, el.startY);
      ctx.lineTo(el.endX, el.endY);
      ctx.stroke();
      break;

    case 'rectangle':
      ctx.beginPath();
      ctx.rect(
        Math.min(el.startX, el.endX),
        Math.min(el.startY, el.endY),
        Math.abs(el.endX - el.startX),
        Math.abs(el.endY - el.startY)
      );
      ctx.stroke();
      break;

    case 'circle':
      const radiusX = Math.abs(el.endX - el.startX) / 2;
      const radiusY = Math.abs(el.endY - el.startY) / 2;
      const centerX = Math.min(el.startX, el.endX) + radiusX;
      const centerY = Math.min(el.startY, el.endY) + radiusY;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'text':
      ctx.font = `${el.fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText(el.text, el.x, el.y);
      break;

    case 'image':
      drawImageElement(el);
      break;
  }
}

function redrawCanvas() {
  const ctx = elements.ctx;
  
  // Clear with identity transform
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
  
  // Draw grid/background pattern to show zoom level
  drawCanvasBackground();
  
  // Apply zoom and pan transformation
  ctx.setTransform(state.zoom, 0, 0, state.zoom, state.panX, state.panY);
  
  for (const el of state.elements) {
    drawElement(el);
  }
  
  // Draw selection highlight if an element is selected
  if (state.selectedElement && state.tool === 'select') {
    drawSelectionHighlight(state.selectedElement);
  }
  
  // Reset transform for UI overlays
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawCanvasBackground() {
  const ctx = elements.ctx;
  const dotSpacing = 20 * state.zoom;
  const offsetX = state.panX % dotSpacing;
  const offsetY = state.panY % dotSpacing;
  const dotRadius = Math.max(1, 1.5 * state.zoom);
  
  // Fill white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
  
  // Draw dots
  ctx.fillStyle = '#c0c0c0';
  
  for (let x = offsetX; x < elements.canvas.width; x += dotSpacing) {
    for (let y = offsetY; y < elements.canvas.height; y += dotSpacing) {
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function screenToCanvas(screenX, screenY) {
  return {
    x: (screenX - state.panX) / state.zoom,
    y: (screenY - state.panY) / state.zoom
  };
}

function canvasToScreen(canvasX, canvasY) {
  return {
    x: canvasX * state.zoom + state.panX,
    y: canvasY * state.zoom + state.panY
  };
}

function zoomIn() {
  const centerX = elements.canvas.width / 2;
  const centerY = elements.canvas.height / 2;
  zoomAtPoint(centerX, centerY, state.zoom * 1.25);
}

function zoomOut() {
  const centerX = elements.canvas.width / 2;
  const centerY = elements.canvas.height / 2;
  zoomAtPoint(centerX, centerY, state.zoom / 1.25);
}

function resetZoom() {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  updateZoomLabel();
  redrawCanvas();
}

function zoomAtPoint(screenX, screenY, newZoom) {
  newZoom = Math.max(state.minZoom, Math.min(state.maxZoom, newZoom));
  
  // Calculate the point in canvas coordinates before zoom
  const canvasPoint = screenToCanvas(screenX, screenY);
  
  // Update zoom
  state.zoom = newZoom;
  
  // Adjust pan to keep the point under the cursor
  state.panX = screenX - canvasPoint.x * state.zoom;
  state.panY = screenY - canvasPoint.y * state.zoom;
  
  updateZoomLabel();
  redrawCanvas();
}

function updateZoomLabel() {
  if (elements.zoomLabel) {
    elements.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  }
}

function initZoomControls() {
  // Button controls
  if (elements.zoomInBtn) {
    elements.zoomInBtn.addEventListener('click', zoomIn);
  }
  if (elements.zoomOutBtn) {
    elements.zoomOutBtn.addEventListener('click', zoomOut);
  }
  if (elements.zoomResetBtn) {
    elements.zoomResetBtn.addEventListener('click', resetZoom);
  }
  
  // Wheel zoom
  elements.canvas.addEventListener('wheel', handleWheelZoom, { passive: false });
  
  // Middle mouse panning
  elements.canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1) { // Middle mouse button
      e.preventDefault();
      state.isPanning = true;
      state.lastPanX = e.clientX;
      state.lastPanY = e.clientY;
      elements.canvas.style.cursor = 'grabbing';
    }
  });
  
  window.addEventListener('mousemove', (e) => {
    if (state.isPanning) {
      const deltaX = e.clientX - state.lastPanX;
      const deltaY = e.clientY - state.lastPanY;
      state.panX += deltaX;
      state.panY += deltaY;
      state.lastPanX = e.clientX;
      state.lastPanY = e.clientY;
      redrawCanvas();
    }
  });
  
  window.addEventListener('mouseup', (e) => {
    if (e.button === 1 && state.isPanning) {
      state.isPanning = false;
      elements.canvas.style.cursor = state.tool === 'select' ? 'default' : 'crosshair';
    }
  });
  
  updateZoomLabel();
}

function handleWheelZoom(e) {
  e.preventDefault();
  
  const rect = elements.canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // Determine zoom direction
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = state.zoom * delta;
  
  zoomAtPoint(mouseX, mouseY, newZoom);
}

function showTextInput(x, y) {
  elements.textInputOverlay.style.left = `${x}px`;
  elements.textInputOverlay.style.top = `${y}px`;
  elements.textInputOverlay.classList.remove('hidden');
  elements.textInput.value = '';
  elements.textInput.focus();

  state.textPosition = { x, y };
}

function hideTextInput() {
  elements.textInputOverlay.classList.add('hidden');
  state.textPosition = null;
}

function addTextElement() {
  const text = elements.textInput.value.trim();
  if (!text || !state.textPosition) return;

  const textElement = {
    type: 'text',
    text,
    x: state.textPosition.x,
    y: state.textPosition.y + 16,
    color: state.color,
    fontSize: 16,
    timestamp: Date.now()
  };

  state.elements.push(textElement);
  state.undoStack.push({ action: 'add', element: textElement });
  state.redoStack = [];
  
  hideTextInput();
  redrawCanvas();
  saveSession();
}

function undo() {
  if (state.undoStack.length === 0) return;

  const action = state.undoStack.pop();
  if (action.action === 'add') {
    const idx = state.elements.indexOf(action.element);
    if (idx > -1) {
      state.elements.splice(idx, 1);
      state.redoStack.push(action);
    }
  }

  redrawCanvas();
  saveSession();
}

function redo() {
  if (state.redoStack.length === 0) return;

  const action = state.redoStack.pop();
  if (action.action === 'add') {
    state.elements.push(action.element);
    state.undoStack.push(action);
  }

  redrawCanvas();
  saveSession();
}

function clearCanvas() {
  const hasContent = state.elements.length > 0 || 
                     state.transcript.length > 0 || 
                     (elements.textPrompt && elements.textPrompt.value.trim());
  
  if (!hasContent) return;
  
  if (confirm('Clear all drawings and inputs? This cannot be undone.')) {
    state.elements = [];
    state.undoStack = [];
    state.redoStack = [];
    state.transcript = [];
    if (elements.textPrompt) {
      elements.textPrompt.value = '';
    }
    redrawCanvas();
    saveSession();
  }
}

// ============================================================================
// Selection & Move
// ============================================================================

function handleSelectionStart(x, y) {
  // First check if clicking on a resize handle of selected element
  if (state.selectedElement) {
    const handleName = findResizeHandleAt(x, y, state.selectedElement);
    if (handleName) {
      state.isResizing = true;
      state.resizeHandle = handleName;
      state.resizeStartBounds = { ...getElementBounds(state.selectedElement) };
      state.resizeStartX = x;
      state.resizeStartY = y;
      
      // Save state for undo
      state.undoStack.push(JSON.parse(JSON.stringify(state.elements)));
      state.redoStack = [];
      return;
    }
  }
  
  // Find element at click position (check from top to bottom, last drawn = on top)
  const clickedElement = findElementAt(x, y);
  
  if (clickedElement) {
    state.selectedElement = clickedElement;
    state.isDragging = true;
    
    // Calculate offset from element origin to click point
    const bounds = getElementBounds(clickedElement);
    state.dragOffsetX = x - bounds.x;
    state.dragOffsetY = y - bounds.y;
    
    // Save state for undo
    state.undoStack.push(JSON.parse(JSON.stringify(state.elements)));
    state.redoStack = [];
    
    redrawCanvas();
  } else {
    // Clicked on empty space - deselect
    if (state.selectedElement) {
      state.selectedElement = null;
      redrawCanvas();
    }
  }
}

function handleSelectionMove(x, y) {
  // Handle resizing
  if (state.isResizing && state.selectedElement && state.resizeHandle) {
    const deltaX = x - state.resizeStartX;
    const deltaY = y - state.resizeStartY;
    resizeElement(state.selectedElement, state.resizeHandle, deltaX, deltaY, state.resizeStartBounds);
    redrawCanvas();
    return;
  }
  
  // Handle dragging
  if (state.isDragging && state.selectedElement) {
    const newX = x - state.dragOffsetX;
    const newY = y - state.dragOffsetY;
    moveElement(state.selectedElement, newX, newY);
    redrawCanvas();
    return;
  }
  
  // Update cursor based on hover
  if (state.selectedElement) {
    const handleName = findResizeHandleAt(x, y, state.selectedElement);
    if (handleName) {
      elements.canvas.style.cursor = getResizeCursor(handleName);
      return;
    }
  }
  
  const hoveredElement = findElementAt(x, y);
  elements.canvas.style.cursor = hoveredElement ? 'move' : 'default';
}

function handleSelectionEnd() {
  if (state.isDragging || state.isResizing) {
    state.isDragging = false;
    state.isResizing = false;
    state.resizeHandle = null;
    state.resizeStartBounds = null;
    saveSession();
  }
}

function findElementAt(x, y) {
  // Search from last to first (top to bottom in z-order)
  for (let i = state.elements.length - 1; i >= 0; i--) {
    const el = state.elements[i];
    if (isPointInElement(x, y, el)) {
      return el;
    }
  }
  return null;
}

function isPointInElement(x, y, el) {
  const bounds = getElementBounds(el);
  if (!bounds) return false;
  
  // Add some padding for easier selection
  const padding = 5;
  return x >= bounds.x - padding && 
         x <= bounds.x + bounds.width + padding &&
         y >= bounds.y - padding && 
         y <= bounds.y + bounds.height + padding;
}

function getElementBounds(el) {
  switch (el.type) {
    case 'rectangle':
    case 'circle':
    case 'line':
      return {
        x: Math.min(el.startX, el.endX),
        y: Math.min(el.startY, el.endY),
        width: Math.abs(el.endX - el.startX),
        height: Math.abs(el.endY - el.startY)
      };
    
    case 'text':
      // Approximate text bounds
      const fontSize = el.fontSize || 16;
      const textWidth = el.text.length * fontSize * 0.6;
      return {
        x: el.x,
        y: el.y - fontSize,
        width: textWidth,
        height: fontSize * 1.2
      };
    
    case 'image':
      return {
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height
      };
    
    case 'path':
    case 'eraser':
      if (!el.points || el.points.length === 0) return null;
      const pathBounds = getPathBounds(el.points);
      return {
        x: pathBounds.minX,
        y: pathBounds.minY,
        width: pathBounds.maxX - pathBounds.minX,
        height: pathBounds.maxY - pathBounds.minY
      };
    
    default:
      return null;
  }
}

function moveElement(el, newX, newY) {
  const bounds = getElementBounds(el);
  if (!bounds) return;
  
  const deltaX = newX - bounds.x;
  const deltaY = newY - bounds.y;
  
  switch (el.type) {
    case 'rectangle':
    case 'circle':
    case 'line':
      el.startX += deltaX;
      el.startY += deltaY;
      el.endX += deltaX;
      el.endY += deltaY;
      break;
    
    case 'text':
      el.x += deltaX;
      el.y += deltaY;
      break;
    
    case 'image':
      el.x = newX;
      el.y = newY;
      break;
    
    case 'path':
    case 'eraser':
      if (el.points) {
        el.points = el.points.map(p => ({
          x: p.x + deltaX,
          y: p.y + deltaY
        }));
      }
      break;
  }
}

function drawSelectionHighlight(el) {
  const bounds = getElementBounds(el);
  if (!bounds) return;
  
  const ctx = elements.ctx;
  const padding = 4;
  
  ctx.save();
  
  // Draw selection rectangle
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(
    bounds.x - padding,
    bounds.y - padding,
    bounds.width + padding * 2,
    bounds.height + padding * 2
  );
  
  // Draw corner handles
  ctx.fillStyle = '#111111';
  ctx.setLineDash([]);
  const handleSize = 8;
  const corners = [
    { x: bounds.x - padding, y: bounds.y - padding },
    { x: bounds.x + bounds.width + padding, y: bounds.y - padding },
    { x: bounds.x - padding, y: bounds.y + bounds.height + padding },
    { x: bounds.x + bounds.width + padding, y: bounds.y + bounds.height + padding }
  ];
  
  corners.forEach(corner => {
    ctx.fillRect(
      corner.x - handleSize / 2,
      corner.y - handleSize / 2,
      handleSize,
      handleSize
    );
  });
  
  ctx.restore();
}

function deleteSelectedElement() {
  if (!state.selectedElement) return;
  
  // Save state for undo
  state.undoStack.push(JSON.parse(JSON.stringify(state.elements)));
  state.redoStack = [];
  
  // Remove element from array
  const index = state.elements.indexOf(state.selectedElement);
  if (index > -1) {
    state.elements.splice(index, 1);
  }
  
  state.selectedElement = null;
  redrawCanvas();
  saveSession();
}

function getResizeHandles(el) {
  const bounds = getElementBounds(el);
  if (!bounds) return [];
  
  const padding = 4;
  const handleSize = 8;
  
  return [
    { name: 'nw', x: bounds.x - padding, y: bounds.y - padding },
    { name: 'ne', x: bounds.x + bounds.width + padding, y: bounds.y - padding },
    { name: 'sw', x: bounds.x - padding, y: bounds.y + bounds.height + padding },
    { name: 'se', x: bounds.x + bounds.width + padding, y: bounds.y + bounds.height + padding }
  ].map(h => ({
    ...h,
    hitBox: {
      x: h.x - handleSize / 2,
      y: h.y - handleSize / 2,
      width: handleSize,
      height: handleSize
    }
  }));
}

function findResizeHandleAt(x, y, el) {
  if (!el) return null;
  
  const handles = getResizeHandles(el);
  for (const handle of handles) {
    const hb = handle.hitBox;
    if (x >= hb.x && x <= hb.x + hb.width && y >= hb.y && y <= hb.y + hb.height) {
      return handle.name;
    }
  }
  return null;
}

function getResizeCursor(handleName) {
  const cursors = {
    'nw': 'nwse-resize',
    'se': 'nwse-resize',
    'ne': 'nesw-resize',
    'sw': 'nesw-resize'
  };
  return cursors[handleName] || 'default';
}

function resizeElement(el, handleName, deltaX, deltaY, startBounds) {
  const maintainAspectRatio = el.type === 'image';
  
  let newX = startBounds.x;
  let newY = startBounds.y;
  let newWidth = startBounds.width;
  let newHeight = startBounds.height;
  
  switch (handleName) {
    case 'nw':
      newX = startBounds.x + deltaX;
      newY = startBounds.y + deltaY;
      newWidth = startBounds.width - deltaX;
      newHeight = startBounds.height - deltaY;
      break;
    case 'ne':
      newY = startBounds.y + deltaY;
      newWidth = startBounds.width + deltaX;
      newHeight = startBounds.height - deltaY;
      break;
    case 'sw':
      newX = startBounds.x + deltaX;
      newWidth = startBounds.width - deltaX;
      newHeight = startBounds.height + deltaY;
      break;
    case 'se':
      newWidth = startBounds.width + deltaX;
      newHeight = startBounds.height + deltaY;
      break;
  }
  
  // Maintain minimum size
  const minSize = 20;
  if (newWidth < minSize) {
    if (handleName === 'nw' || handleName === 'sw') {
      newX = startBounds.x + startBounds.width - minSize;
    }
    newWidth = minSize;
  }
  if (newHeight < minSize) {
    if (handleName === 'nw' || handleName === 'ne') {
      newY = startBounds.y + startBounds.height - minSize;
    }
    newHeight = minSize;
  }
  
  // Maintain aspect ratio for images
  if (maintainAspectRatio && startBounds.width > 0 && startBounds.height > 0) {
    const aspectRatio = startBounds.width / startBounds.height;
    
    if (newWidth / newHeight > aspectRatio) {
      newWidth = newHeight * aspectRatio;
    } else {
      newHeight = newWidth / aspectRatio;
    }
    
    // Adjust position for corner handles
    if (handleName === 'nw') {
      newX = startBounds.x + startBounds.width - newWidth;
      newY = startBounds.y + startBounds.height - newHeight;
    } else if (handleName === 'ne') {
      newY = startBounds.y + startBounds.height - newHeight;
    } else if (handleName === 'sw') {
      newX = startBounds.x + startBounds.width - newWidth;
    }
  }
  
  // Apply the new dimensions to the element
  switch (el.type) {
    case 'image':
      el.x = newX;
      el.y = newY;
      el.width = newWidth;
      el.height = newHeight;
      break;
    case 'rectangle':
    case 'circle':
    case 'line':
      el.startX = newX;
      el.startY = newY;
      el.endX = newX + newWidth;
      el.endY = newY + newHeight;
      break;
  }
}

// ============================================================================
// Image Handling
// ============================================================================

function initImageHandling() {
  // File input change
  elements.imageInput.addEventListener('change', handleImageSelect);
  
  // Drag and drop
  elements.canvasArea.addEventListener('dragover', handleDragOver);
  elements.canvasArea.addEventListener('dragleave', handleDragLeave);
  elements.canvasArea.addEventListener('drop', handleDrop);
  
  // Paste from clipboard
  document.addEventListener('paste', handlePaste);
}

function handleImageSelect(e) {
  const file = e.target.files[0];
  if (file && file.type.startsWith('image/')) {
    loadImageFile(file);
  }
  e.target.value = '';
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer.types.includes('Files')) {
    elements.dropOverlay.classList.remove('hidden');
  }
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!elements.canvasArea.contains(e.relatedTarget)) {
    elements.dropOverlay.classList.add('hidden');
  }
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  elements.dropOverlay.classList.add('hidden');
  
  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].type.startsWith('image/')) {
    loadImageFile(files[0], e.offsetX, e.offsetY);
  }
}

function handlePaste(e) {
  const items = e.clipboardData?.items;
  if (!items) return;
  
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) {
        loadImageFile(file);
      }
      break;
    }
  }
}

function loadImageFile(file, dropX = null, dropY = null) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    addImageToCanvas(dataUrl, dropX, dropY);
  };
  reader.readAsDataURL(file);
}

function addImageToCanvas(dataUrl, dropX = null, dropY = null) {
  const img = new Image();
  img.onload = () => {
    // Calculate position (center if not dropped, else use drop position)
    const canvasRect = elements.canvas.getBoundingClientRect();
    let x, y, width, height;
    
    // Scale image to fit reasonably on canvas (max 50% of canvas size)
    const maxWidth = elements.canvas.width * 0.5;
    const maxHeight = elements.canvas.height * 0.5;
    const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
    
    width = img.width * scale;
    height = img.height * scale;
    
    if (dropX !== null && dropY !== null) {
      // Position at drop location (adjust for canvas scaling)
      const scaleX = elements.canvas.width / canvasRect.width;
      const scaleY = elements.canvas.height / canvasRect.height;
      x = dropX * scaleX - width / 2;
      y = dropY * scaleY - height / 2;
    } else {
      // Center on canvas
      x = (elements.canvas.width - width) / 2;
      y = (elements.canvas.height - height) / 2;
    }
    
    // Create element
    const imageId = `img_${Date.now()}`;
    const element = {
      type: 'image',
      id: imageId,
      dataUrl: dataUrl,
      x: x,
      y: y,
      width: width,
      height: height,
      timestamp: Date.now()
    };
    
    // Cache the loaded image
    state.imageCache.set(imageId, img);
    
    // Add to elements and save
    state.undoStack.push([...state.elements]);
    state.redoStack = [];
    state.elements.push(element);
    redrawCanvas();
    saveSession();
    
    updateStatus('ready', 'Image added');
  };
  img.src = dataUrl;
}

function drawImageElement(element) {
  let img = state.imageCache.get(element.id);
  
  if (img) {
    elements.ctx.drawImage(img, element.x, element.y, element.width, element.height);
  } else {
    // Image not in cache, reload it
    const newImg = new Image();
    newImg.onload = () => {
      state.imageCache.set(element.id, newImg);
      elements.ctx.drawImage(newImg, element.x, element.y, element.width, element.height);
    };
    newImg.src = element.dataUrl;
  }
}

// ============================================================================
// Voice Recording
// ============================================================================

function initVoiceRecording() {
  // Check browser support for MediaRecorder (required)
  if (!('mediaDevices' in navigator)) {
    elements.recordBtn.disabled = true;
    elements.recordBtn.title = 'Voice recording not supported in this browser';
    console.warn('MediaDevices API not supported');
    return;
  }

  // Initialize Web Speech API for real-time preview (optional - Parakeet is primary)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (SpeechRecognition) {
    state.recognition = new SpeechRecognition();
    state.recognition.continuous = true;
    state.recognition.interimResults = true;
    state.recognition.lang = 'en-US';

    state.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Show real-time preview (will be replaced by Parakeet result)
      const preview = finalTranscript || interimTranscript;
      if (preview) {
        elements.transcriptText.textContent = preview + ' (live preview)';
      }
    };

    state.recognition.onerror = (event) => {
      console.warn('Web Speech API error:', event.error);
      // Don't show error to user since Parakeet is the primary transcription method
    };

    state.recognition.onend = () => {
      if (state.isRecording && state.recognition) {
        try {
          state.recognition.start();
        } catch (e) {
          // Ignore restart errors
        }
      }
    };
    
    console.log('Web Speech API available for real-time preview');
  } else {
    console.log('Web Speech API not available. Using NVIDIA Parakeet only.');
  }
  
  console.log('NVIDIA Parakeet ASR configured via server proxy');
}

async function toggleRecording() {
  if (state.isRecording) {
    await stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  try {
    // Request microphone access with specific constraints for better quality
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true
      }
    });
    
    // Start MediaRecorder - prefer webm/opus for good quality
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
      ? 'audio/webm;codecs=opus' 
      : 'audio/webm';
    
    state.mediaRecorder = new MediaRecorder(stream, { mimeType });
    state.audioChunks = [];

    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        state.audioChunks.push(event.data);
      }
    };

    state.mediaRecorder.start(1000);

    // Start Speech Recognition for real-time preview (if available)
    state.transcript = [];
    if (state.recognition) {
      try {
        state.recognition.start();
      } catch (e) {
        console.warn('Could not start Web Speech API:', e);
      }
    }

    // Update UI
    state.isRecording = true;
    state.recordingStartTime = Date.now();
    state.sessionStartTime = state.sessionStartTime || Date.now();

    elements.recordBtn.classList.add('recording');
    elements.recordBtn.querySelector('span').textContent = 'Stop Recording';
    elements.transcriptPreview.classList.remove('hidden');
    elements.transcriptText.textContent = 'Listening... (powered by NVIDIA Parakeet)';
    elements.recordingTimer.classList.remove('hidden');
    
    updateStatus('recording', 'Recording');
    startRecordingTimer();

  } catch (error) {
    console.error('Failed to start recording:', error);
    alert('Could not access microphone. Please allow microphone access and try again.');
  }
}

async function stopRecording() {
  if (!state.isRecording) return;
  
  state.isRecording = false;
  
  // Stop speech recognition first
  if (state.recognition) {
    state.recognition.stop();
  }

  // Stop MediaRecorder and wait for final data
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    await new Promise(resolve => {
      state.mediaRecorder.onstop = resolve;
      state.mediaRecorder.stop();
    });
    state.mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }

  elements.recordBtn.classList.remove('recording');
  elements.recordBtn.querySelector('span').textContent = 'Start Recording';
  elements.recordingTimer.classList.add('hidden');
  stopRecordingTimer();

  // Transcribe with NVIDIA Parakeet if we have audio
  if (state.audioChunks.length > 0) {
    await transcribeWithParakeet();
  }

  updateStatus('ready', 'Ready');
  saveSession();
}

async function transcribeWithParakeet() {
  try {
    updateStatus('processing', 'Transcribing...');
    elements.transcriptText.textContent = 'Processing audio with NVIDIA Parakeet...';

    // Create audio blob from recorded chunks
    const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
    
    // Convert to WAV format for better compatibility
    const wavBlob = await convertToWav(audioBlob);
    
    // Create form data for API request
    const formData = new FormData();
    formData.append('file', wavBlob, 'audio.wav');
    formData.append('model', CONFIG.NVIDIA_ASR_MODEL);
    formData.append('language', 'en');

    const response = await fetch(CONFIG.NVIDIA_ASR_URL, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NVIDIA API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const transcribedText = data.text || '';

    if (transcribedText.trim()) {
      // Update transcript with Parakeet result
      state.transcript = [{
        text: transcribedText.trim(),
        timestamp: Date.now(),
        isFinal: true,
        source: 'parakeet'
      }];
      
      elements.transcriptText.textContent = transcribedText;
      console.log('Parakeet transcription:', transcribedText);
    } else {
      elements.transcriptText.textContent = 'No speech detected in audio.';
    }

  } catch (error) {
    console.error('Parakeet transcription failed:', error);
    elements.transcriptText.textContent = `Transcription failed: ${error.message}. Using Web Speech results.`;
    // Keep existing Web Speech API transcript as fallback
  }
}

async function convertToWav(blob) {
  // Create audio context for conversion
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Decode the audio blob
  const arrayBuffer = await blob.arrayBuffer();
  
  let audioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.warn('Could not decode audio, sending original blob:', e);
    return blob;
  }
  
  // Convert to WAV
  const wavBuffer = audioBufferToWav(audioBuffer);
  const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
  
  await audioContext.close();
  return wavBlob;
}

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const data = buffer.numberOfChannels === 1 
    ? buffer.getChannelData(0) 
    : interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  
  const samples = data.length;
  const dataLength = samples * bytesPerSample;
  const bufferLength = 44 + dataLength;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Write audio data
  floatTo16BitPCM(view, 44, data);
  
  return arrayBuffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(view, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function interleave(leftChannel, rightChannel) {
  const length = leftChannel.length + rightChannel.length;
  const result = new Float32Array(length);
  
  let inputIndex = 0;
  for (let i = 0; i < length; ) {
    result[i++] = leftChannel[inputIndex];
    result[i++] = rightChannel[inputIndex];
    inputIndex++;
  }
  return result;
}

let timerInterval = null;

function startRecordingTimer() {
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - state.recordingStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    elements.timerDisplay.textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, 1000);
}

function stopRecordingTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ============================================================================
// Status Management
// ============================================================================

function updateStatus(status, text) {
  elements.statusIndicator.className = 'status-indicator ' + status;
  elements.statusText.textContent = text;
}

// ============================================================================
// Session Management
// ============================================================================

function getSessionData() {
  const voiceText = state.transcript.map(t => t.text).join(' ').trim();
  const textPromptValue = elements.textPrompt ? elements.textPrompt.value.trim() : '';
  
  // Combine voice and text prompt
  let combinedDescription = '';
  if (voiceText && textPromptValue) {
    combinedDescription = `${textPromptValue}\n\nAdditional voice notes: ${voiceText}`;
  } else if (textPromptValue) {
    combinedDescription = textPromptValue;
  } else if (voiceText) {
    combinedDescription = voiceText;
  }
  
  return {
    sessionId: Date.now().toString(36),
    startTime: state.sessionStartTime || Date.now(),
    drawing: {
      elements: state.elements.map(el => ({
        ...el,
        relativeTimestamp: el.timestamp - (state.sessionStartTime || el.timestamp)
      })),
      canvasWidth: elements.canvas.width,
      canvasHeight: elements.canvas.height
    },
    voice: {
      transcript: state.transcript,
      fullText: voiceText
    },
    textPrompt: textPromptValue,
    combinedDescription: combinedDescription
  };
}

function saveSession() {
  try {
    const session = getSessionData();
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('Failed to save session:', e);
  }
}

function loadSession() {
  try {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (saved) {
      const session = JSON.parse(saved);
      state.elements = session.drawing?.elements || [];
      state.transcript = session.voice?.transcript || [];
      state.sessionStartTime = session.startTime;
      
      // Restore text prompt
      if (session.textPrompt && elements.textPrompt) {
        elements.textPrompt.value = session.textPrompt;
      }
      
      if (state.transcript.length > 0) {
        elements.transcriptPreview.classList.remove('hidden');
        elements.transcriptText.textContent = session.voice.fullText || 'Previous transcript loaded';
      }
      
      redrawCanvas();
    }
  } catch (e) {
    console.warn('Failed to load session:', e);
  }
}

// ============================================================================
// AI Generation
// ============================================================================

async function generateApp() {
  const session = getSessionData();

  if (session.drawing.elements.length === 0) {
    alert('Please draw something on the canvas first.');
    return;
  }

  elements.loadingOverlay.classList.remove('hidden');
  updateStatus('processing', 'Processing');

  try {
    const code = await generateAppFromSession(session);
    state.generatedCode = code;
    
    updateStatus('generated', 'Generated');
    showPreview();
  } catch (error) {
    console.error('Generation failed:', error);
    alert('Failed to generate app: ' + error.message);
    updateStatus('ready', 'Ready');
  } finally {
    elements.loadingOverlay.classList.add('hidden');
  }
}

async function generateAppFromSession(sessionData) {
  const textPrompt = buildPrompt(sessionData);

  // Capture canvas as base64 image for vision API
  const canvasDataUrl = elements.canvas.toDataURL('image/png');
  const base64Image = canvasDataUrl.split(',')[1];

  // Build multimodal message content (image + text)
  const messageContent = [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: base64Image
      }
    },
    {
      type: 'text',
      text: textPrompt
    }
  ];

  // API call via local proxy (API key is handled server-side)
  const response = await fetch(CONFIG.AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: CONFIG.AI_MODEL,
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: messageContent
      }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  return parseGeneratedCode(text);
}

function buildPrompt(sessionData) {
  const elementsDescription = sessionData.drawing.elements.map(el => {
    switch (el.type) {
      case 'rectangle':
        return `Rectangle at (${Math.round(el.startX)}, ${Math.round(el.startY)}) with size ${Math.round(el.width)}x${Math.round(el.height)}`;
      case 'circle':
        return `Circle/Ellipse at (${Math.round(el.startX)}, ${Math.round(el.startY)}) with size ${Math.round(el.width)}x${Math.round(el.height)}`;
      case 'line':
        return `Line from (${Math.round(el.startX)}, ${Math.round(el.startY)}) to (${Math.round(el.endX)}, ${Math.round(el.endY)})`;
      case 'text':
        return `Text "${el.text}" at (${Math.round(el.x)}, ${Math.round(el.y)})`;
      case 'path':
        const bounds = getPathBounds(el.points);
        return `Freehand drawing in area (${Math.round(bounds.minX)}, ${Math.round(bounds.minY)}) to (${Math.round(bounds.maxX)}, ${Math.round(bounds.maxY)})`;
      case 'image':
        return `Image at (${Math.round(el.x)}, ${Math.round(el.y)}) with size ${Math.round(el.width)}x${Math.round(el.height)}`;
      default:
        return `Element of type ${el.type}`;
    }
  }).join('\n');

  return `You are an expert frontend developer and UI designer. Look at the attached image of a hand-drawn UI sketch and generate a beautiful, modern single-page web application based on it.

The image shows a canvas with the following elements:
${elementsDescription || 'Freehand drawings and/or images'}

USER DESCRIPTION:
${sessionData.combinedDescription || 'No description provided.'}

REQUIREMENTS:
1. Generate ONLY three files: index.html, styles.css, and script.js
2. Use React 18 via CDN with Babel for JSX transformation
3. Include Tailwind CSS via CDN for styling
4. Write React functional components with hooks (useState, useEffect, useCallback)
5. Make the app FULLY FUNCTIONAL with real working features
6. Use localStorage for data persistence so data survives page refresh

REACT SETUP - Include these CDN scripts in index.html head:
\`\`\`html
<script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
\`\`\`

REACT COMPONENT STRUCTURE:
- Create a main App component that renders everything
- Break down UI into smaller reusable components
- Use React hooks for state management (useState, useEffect)
- Use useEffect to load data from localStorage on mount
- Use useEffect to save data to localStorage when state changes

DESIGN GUIDELINES - Make it look PROFESSIONAL and MODERN:
- Use a cohesive color scheme (stick to 2-3 main colors)
- Apply subtle shadows (shadow-sm, shadow-md, shadow-lg)
- Use rounded corners (rounded-lg, rounded-xl, rounded-2xl)
- Add smooth transitions (transition-all, duration-200, hover effects)
- Use proper spacing (p-4, p-6, gap-4, space-y-4)
- Include gradient backgrounds where appropriate (bg-gradient-to-r)
- Add hover states on interactive elements (hover:bg-*, hover:scale-*)
- Make it fully responsive (use sm:, md:, lg: breakpoints)
- For icons, use inline SVGs in JSX (not external icon libraries)

VISUAL STYLE:
- Clean, minimalist aesthetic with plenty of whitespace
- Card-based layouts with shadows for depth
- Rounded buttons with hover animations
- Soft color palette (avoid harsh primary colors)
- Professional typography with clear hierarchy
- Subtle borders (border, border-gray-200)
- Focus states for accessibility (focus:ring-2, focus:ring-offset-2)

FUNCTIONALITY - Make the app ACTUALLY WORK:
- Use localStorage to persist ALL user data
- Load saved data on component mount with useEffect
- Save data when state changes with useEffect
- For TODO/list apps: implement full CRUD (Create, Read, Update, Delete)
- For forms: controlled components with state, save submissions
- For e-commerce: working cart with add/remove, quantity, total calculation
- For dashboards: editable data, working filters
- Include a "Clear Data" or "Reset" button
- Show empty states when no data exists
- Add confirmation dialogs for destructive actions

REACT CODE PATTERN:
\`\`\`javascript
const { useState, useEffect, useCallback } = React;

function App() {
  const [items, setItems] = useState([]);
  
  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('appData');
    if (saved) setItems(JSON.parse(saved));
  }, []);
  
  // Save to localStorage when items change
  useEffect(() => {
    localStorage.setItem('appData', JSON.stringify(items));
  }, [items]);
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Components here */}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
\`\`\`

CRITICAL - CLASSNAME SYNTAX:
DO NOT use template literals (backticks) for dynamic classNames. Instead use array join:
\`\`\`javascript
// WRONG - causes parsing errors:
className={\`card \${isActive ? 'active' : ''}\`}

// CORRECT - use this pattern:
className={['card', isActive && 'active'].filter(Boolean).join(' ')}

// Or for simple cases, use string concatenation:
className={'card ' + (isActive ? 'active' : '')}
\`\`\`

OUTPUT FORMAT:
Return the code in this exact format:

===INDEX.HTML===
(html with React/Babel/Tailwind CDN scripts, a div with id="root", and script tag with type="text/babel" linking to script.js)
===END INDEX.HTML===

===STYLES.CSS===
(minimal custom CSS - only for things Tailwind can't do, like custom animations)
===END STYLES.CSS===

===SCRIPT.JS===
(COMPLETE React code with:
- Functional components with hooks
- localStorage for persistence
- Full CRUD operations
- Proper state management
- Event handlers as functions
- Clean component structure)
===END SCRIPT.JS===`;
}

function getPathBounds(points) {
  if (!points || points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

function parseGeneratedCode(text) {
  const htmlMatch = text.match(/===INDEX\.HTML===\s*([\s\S]*?)\s*===END INDEX\.HTML===/);
  const cssMatch = text.match(/===STYLES\.CSS===\s*([\s\S]*?)\s*===END STYLES\.CSS===/);
  const jsMatch = text.match(/===SCRIPT\.JS===\s*([\s\S]*?)\s*===END SCRIPT\.JS===/);

  return {
    html: htmlMatch ? htmlMatch[1].trim() : '',
    css: cssMatch ? cssMatch[1].trim() : '',
    js: jsMatch ? jsMatch[1].trim() : ''
  };
}

function mockGenerateApp(sessionData) {
  const hasRectangles = sessionData.drawing.elements.some(el => el.type === 'rectangle');
  const hasCircles = sessionData.drawing.elements.some(el => el.type === 'circle');
  const hasText = sessionData.drawing.elements.some(el => el.type === 'text');
  // Use combined description (text prompt + voice) for detection
  const descriptionText = (sessionData.combinedDescription || '').toLowerCase();

  // Determine app type from description or drawing
  let appType = 'generic';
  if (descriptionText.includes('form') || descriptionText.includes('login') || descriptionText.includes('signup')) {
    appType = 'form';
  } else if (descriptionText.includes('card') || descriptionText.includes('product') || descriptionText.includes('list')) {
    appType = 'cards';
  } else if (descriptionText.includes('dashboard') || descriptionText.includes('chart')) {
    appType = 'dashboard';
  } else if (hasRectangles && sessionData.drawing.elements.filter(e => e.type === 'rectangle').length > 2) {
    appType = 'cards';
  }

  return generateMockApp(appType);
}

function generateMockApp(type) {
  const reactHead = `  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css">`;

  const templates = {
    form: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact Form</title>
${reactHead}
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" src="script.js"></script>
</body>
</html>`,
      css: `@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
.shake { animation: shake 0.3s ease-in-out; }`,
      js: `const { useState, useEffect } = React;

const MailIcon = () => (
  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const SendIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

function App() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('contactSubmissions');
    if (saved) setSubmissions(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('contactSubmissions', JSON.stringify(submissions));
  }, [submissions]);

  const validate = () => {
    const newErrors = {};
    if (formData.name.trim().length < 2) newErrors.name = 'Please enter your name';
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(formData.email)) newErrors.email = 'Please enter a valid email';
    if (formData.message.trim().length < 10) newErrors.message = 'Message must be at least 10 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      const newSubmission = { id: Date.now(), ...formData, date: new Date().toLocaleString() };
      setSubmissions([newSubmission, ...submissions]);
      setFormData({ name: '', email: '', message: '' });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const deleteSubmission = (id) => {
    if (confirm('Delete this submission?')) {
      setSubmissions(submissions.filter(s => s.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <MailIcon />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Get in Touch</h1>
            <p className="text-gray-500 mt-1">We'd love to hear from you</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Full Name" value={formData.name} error={errors.name} placeholder="John Doe"
              onChange={(e) => setFormData({...formData, name: e.target.value})} />
            <FormField label="Email Address" type="email" value={formData.email} error={errors.email} placeholder="john@example.com"
              onChange={(e) => setFormData({...formData, email: e.target.value})} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
              <textarea value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})}
                className={['w-full px-4 py-3 rounded-xl border-2 focus:border-gray-500 focus:ring-4 focus:ring-gray-100 transition-all outline-none resize-none', errors.message ? 'border-red-500 shake' : 'border-gray-200'].join(' ')}
                rows="4" placeholder="Your message here..." />
              {errors.message && <p className="text-red-500 text-sm mt-1">{errors.message}</p>}
            </div>
            <button type="submit" className="w-full py-4 bg-gradient-to-r from-gray-800 to-black text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <SendIcon /> Send Message
            </button>
          </form>

          {showSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
                <CheckIcon /> Message sent successfully!
              </div>
            </div>
          )}

          {submissions.length > 0 && (
            <div className="mt-6 space-y-3 max-h-48 overflow-y-auto">
              <p className="text-xs text-gray-500">Previous submissions ({submissions.length}):</p>
              {submissions.slice(0, 5).map(s => (
                <div key={s.id} className="bg-gray-50 p-3 rounded-lg text-sm flex justify-between items-center">
                  <span><strong>{s.name}</strong> <span className="text-gray-400">• {s.date}</span></span>
                  <button onClick={() => deleteSubmission(s.id)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FormField({ label, type = 'text', value, onChange, error, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        className={['w-full px-4 py-3 rounded-xl border-2 focus:border-gray-500 focus:ring-4 focus:ring-gray-100 transition-all outline-none', error ? 'border-red-500 shake' : 'border-gray-200'].join(' ')} />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`
    },

    cards: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Product Gallery</title>
${reactHead}
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" src="script.js"></script>
</body>
</html>`,
      css: `@keyframes pop { 50% { transform: scale(1.2); } }
.pop { animation: pop 0.3s ease-out; }`,
      js: `const { useState, useEffect } = React;

const ShoppingBagIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
);

const CartIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const products = [
  { id: 1, name: 'Wireless Headphones', price: 149.99, color: 'from-pink-500 to-rose-500' },
  { id: 2, name: 'Smart Watch Pro', price: 299.99, color: 'from-gray-600 to-gray-800' },
  { id: 3, name: 'Laptop Stand', price: 79.99, color: 'from-blue-500 to-cyan-500' },
  { id: 4, name: 'Mechanical Keyboard', price: 159.99, color: 'from-emerald-500 to-teal-500' },
  { id: 5, name: 'USB-C Hub', price: 49.99, color: 'from-orange-500 to-amber-500' },
  { id: 6, name: 'Webcam HD', price: 89.99, color: 'from-indigo-500 to-blue-500' }
];

function App() {
  const [cart, setCart] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('shopCart');
    if (saved) setCart(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('shopCart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product) => {
    setCart([...cart, { ...product, qty: 1 }]);
  };

  const updateQty = (id, delta) => {
    setCart(cart.map(item => item.id === id ? { ...item, qty: item.qty + delta } : item).filter(item => item.qty > 0));
  };

  const getCartItem = (id) => cart.find(item => item.id === id);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const viewCart = () => {
    if (cart.length === 0) { alert('Your cart is empty!'); return; }
    const items = cart.map(i => i.name + ' x' + i.qty + ' = $' + (i.price * i.qty).toFixed(2)).join('\\n');
    if (confirm('Your Cart:\\n\\n' + items + '\\n\\nTotal: $' + cartTotal.toFixed(2) + '\\n\\nClear cart?')) {
      setCart([]);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center">
              <ShoppingBagIcon />
            </div>
            <span className="text-xl font-bold text-gray-800">ShopHub</span>
          </div>
          <button onClick={viewCart} className="relative bg-gray-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-gray-700 transition-all hover:scale-105 flex items-center gap-2">
            <CartIcon /> Cart
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-gray-600 text-white text-xs font-bold rounded-full flex items-center justify-center">{cartCount}</span>
          </button>
        </nav>
      </header>

      <section className="bg-gradient-to-r from-gray-800 via-gray-900 to-black text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Discover Amazing Products</h1>
          <p className="text-lg text-white/80 mb-8">Find the best deals on premium tech items</p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => (
            <ProductCard key={product.id} product={product} cartItem={getCartItem(product.id)} onAdd={() => addToCart(product)} onUpdateQty={updateQty} />
          ))}
        </div>
      </main>

      <footer className="border-t border-gray-200 py-8 text-center text-gray-500">
        <p>© 2024 ShopHub. All rights reserved.</p>
      </footer>
    </div>
  );
}

function ProductCard({ product, cartItem, onAdd, onUpdateQty }) {
  return (
    <div className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100">
      <div className={'h-48 bg-gradient-to-br flex items-center justify-center ' + product.color}>
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-3xl text-white">✦</span>
        </div>
      </div>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">{product.name}</h3>
        <p className="text-2xl font-bold text-gray-700 mb-4">\${product.price.toFixed(2)}</p>
        {cartItem ? (
          <div className="flex items-center gap-2">
            <button onClick={() => onUpdateQty(product.id, -1)} className="w-10 h-10 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-xl font-bold">−</button>
            <span className="flex-1 text-center font-semibold text-lg">{cartItem.qty}</span>
            <button onClick={() => onUpdateQty(product.id, 1)} className="w-10 h-10 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-xl font-bold">+</button>
          </div>
        ) : (
          <button onClick={onAdd} className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-700 transition-all flex items-center justify-center gap-2">
            <PlusIcon /> Add to Cart
          </button>
        )}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`
    },

    dashboard: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard</title>
${reactHead}
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" src="script.js"></script>
</body>
</html>`,
      css: `.bar { border-radius: 8px 8px 0 0; transition: height 0.5s ease; }`,
      js: `const { useState, useEffect, useRef } = React;

const chartData = [65, 45, 80, 55, 90, 70, 85];
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-gray-500', 'bg-amber-500', 'bg-pink-500', 'bg-cyan-500', 'bg-indigo-500'];

function App() {
  const [period, setPeriod] = useState('today');
  const [stats, setStats] = useState({ users: 0, revenue: 0, orders: 0, rating: 0 });

  useEffect(() => {
    const duration = 1500;
    const start = performance.now();
    const targets = { users: 12847, revenue: 48329, orders: 1243, rating: 4.8 };
    
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setStats({
        users: Math.floor(targets.users * eased),
        revenue: Math.floor(targets.revenue * eased),
        orders: Math.floor(targets.orders * eased),
        rating: Number((targets.rating * eased).toFixed(1))
      });
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, []);

  return (
    <div className="bg-gray-100 min-h-screen flex">
      <Sidebar />
      <main className="flex-1 p-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Dashboard Overview</h1>
          <div className="flex gap-2 bg-white rounded-xl p-1 shadow-sm">
            {['today', 'week', 'month'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={['px-4 py-2 rounded-lg text-sm font-medium transition-colors', period === p ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'].join(' ')}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon="users" label="Total Users" value={stats.users.toLocaleString()} color="blue" />
          <StatCard icon="dollar" label="Revenue" value={\`$\${stats.revenue.toLocaleString()}\`} color="emerald" />
          <StatCard icon="package" label="Orders" value={stats.orders.toLocaleString()} color="gray" />
          <StatCard icon="star" label="Avg Rating" value={stats.rating} color="amber" />
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Weekly Activity</h2>
          <Chart />
        </div>
      </main>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 min-h-screen p-6 hidden lg:block">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-800 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <span className="text-xl font-bold text-white">Analytics</span>
      </div>
      <nav className="space-y-2">
        <NavItem label="Dashboard" active />
        <NavItem label="Reports" />
        <NavItem label="Settings" />
      </nav>
    </aside>
  );
}

function NavItem({ label, active }) {
  return (
    <a href="#" className={['flex items-center gap-3 px-4 py-3 rounded-xl transition-colors', active ? 'bg-gray-700 text-white font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white'].join(' ')}>
      {label}
    </a>
  );
}

function StatCard({ icon, label, value, color }) {
  const bgColors = { blue: 'bg-blue-100', emerald: 'bg-emerald-100', gray: 'bg-gray-100', amber: 'bg-amber-100' };
  const textColors = { blue: 'text-blue-600', emerald: 'text-emerald-600', gray: 'text-gray-600', amber: 'text-amber-600' };
  
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className={['w-12 h-12 rounded-xl flex items-center justify-center', bgColors[color]].join(' ')}>
          <span className={'text-xl ' + textColors[color]}>●</span>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          <p className="text-gray-500 text-sm">{label}</p>
        </div>
      </div>
    </div>
  );
}

function Chart() {
  const [heights, setHeights] = useState(chartData.map(() => 0));
  
  useEffect(() => {
    chartData.forEach((value, i) => {
      setTimeout(() => {
        setHeights(prev => {
          const newHeights = [...prev];
          newHeights[i] = value;
          return newHeights;
        });
      }, 100 + i * 100);
    });
  }, []);

  return (
    <div className="flex items-end gap-4 h-48">
      {chartData.map((_, i) => (
        <div key={i} className="flex-1 flex flex-col items-center">
          <div className={['w-full bar transition-all duration-500', colors[i]].join(' ')} style={{ height: heights[i] + '%' }}></div>
          <span className="text-xs text-gray-500 mt-2">{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`
    },

    generic: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
${reactHead}
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" src="script.js"></script>
</body>
</html>`,
      css: `@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
.float { animation: float 3s ease-in-out infinite; }`,
      js: `const { useState, useEffect, useRef } = React;

const ZapIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const PlayIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const features = [
  { title: 'Lightning Fast', desc: 'Optimized performance that keeps your app running at peak speed.', color: 'from-amber-400 to-orange-500' },
  { title: 'Secure by Default', desc: 'Enterprise-grade security to keep your data safe and protected.', color: 'from-emerald-400 to-teal-500' },
  { title: 'Beautiful Design', desc: 'Stunning, modern interfaces that users love to interact with.', color: 'from-gray-500 to-gray-700' }
];

function App() {
  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-white">
      <Header />
      <Hero onLearnMore={scrollToFeatures} />
      <Features />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
      <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white text-lg">✦</span>
          </div>
          <span className="text-xl font-bold text-gray-800">MyApp</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">Features</a>
          <a href="#about" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">About</a>
          <a href="#contact" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">Contact</a>
        </div>
        <button onClick={() => alert('Thanks for your interest!')} className="bg-gradient-to-r from-gray-800 to-black text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all">
          Get Started
        </button>
      </nav>
    </header>
  );
}

function Hero({ onLearnMore }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black"></div>
      <div className="relative max-w-4xl mx-auto text-center py-32 px-4">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white/90 px-4 py-2 rounded-full text-sm font-medium mb-8">
          <ZapIcon /> Built for the future
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">Welcome to MyApp</h1>
        <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">Build something amazing today with our powerful platform designed for modern teams.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={onLearnMore} className="bg-white text-gray-800 px-8 py-4 rounded-xl font-semibold shadow-xl hover:shadow-2xl hover:scale-105 transition-all inline-flex items-center justify-center gap-2">
            <PlayIcon /> Learn More
          </button>
          <button className="border-2 border-white/30 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-all">
            View on GitHub
          </button>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-24 px-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Powerful Features</h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">Everything you need to build amazing products, all in one place.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ title, desc, color, delay }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setTimeout(() => setVisible(true), delay);
      }
    }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={['bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 group', visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'].join(' ')}>
      <div className={['w-14 h-14 bg-gradient-to-br rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform', color].join(' ')}>
        <span className="text-2xl text-white">⚡</span>
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-3">{title}</h3>
      <p className="text-gray-600">{desc}</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-12 px-4">
      <div className="max-w-6xl mx-auto text-center">
        <p className="text-gray-400">© 2024 MyApp. All rights reserved.</p>
      </div>
    </footer>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`
    }
  };

  return templates[type] || templates.generic;
}

// ============================================================================
// Preview & Code Editor
// ============================================================================

function showPreview() {
  elements.previewModal.classList.remove('hidden');
  renderPreview();
}

function hidePreview() {
  elements.previewModal.classList.add('hidden');
}

function renderPreview() {
  const { html, css, js } = state.generatedCode;
  
  // Inject CSS and JS into HTML
  let fullHtml = html;
  
  // Replace stylesheet link with inline styles
  fullHtml = fullHtml.replace(
    /<link rel="stylesheet" href="styles\.css">/,
    `<style>${css}</style>`
  );
  
  // Replace script tag with inline script (handle both regular and babel scripts)
  fullHtml = fullHtml.replace(
    /<script type="text\/babel" src="script\.js"><\/script>/,
    `<script type="text/babel">${js}<\/script>`
  );
  fullHtml = fullHtml.replace(
    /<script src="script\.js"><\/script>/,
    `<script>${js}<\/script>`
  );
  
  elements.previewFrame.srcdoc = fullHtml;
}

function toggleCodeEditor() {
  const isHidden = elements.codeEditor.classList.contains('hidden');
  
  if (isHidden) {
    elements.codeEditor.classList.remove('hidden');
    elements.previewContainer.style.flex = '0 0 50%';
    showCodeTab('html');
    elements.editCodeBtn.textContent = 'Hide Code';
  } else {
    elements.codeEditor.classList.add('hidden');
    elements.previewContainer.style.flex = '1';
    elements.editCodeBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>
      </svg>
      Edit Code
    `;
  }
}

let currentCodeTab = 'html';

function showCodeTab(tab) {
  currentCodeTab = tab;
  
  elements.codeTabs.forEach(t => {
    t.classList.toggle('active', t.dataset.file === tab);
  });
  
  const codeMap = {
    html: state.generatedCode.html,
    css: state.generatedCode.css,
    js: state.generatedCode.js
  };
  
  elements.codeTextarea.value = codeMap[tab];
}

function applyCodeChanges() {
  const code = elements.codeTextarea.value;
  
  switch (currentCodeTab) {
    case 'html':
      state.generatedCode.html = code;
      break;
    case 'css':
      state.generatedCode.css = code;
      break;
    case 'js':
      state.generatedCode.js = code;
      break;
  }
  
  renderPreview();
}

function downloadAsZip() {
  // Create a simple zip-like download (individual files)
  const files = [
    { name: 'index.html', content: state.generatedCode.html },
    { name: 'styles.css', content: state.generatedCode.css },
    { name: 'script.js', content: state.generatedCode.js }
  ];
  
  files.forEach(file => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  });
}

async function regenerateApp() {
  hidePreview();
  await generateApp();
}

// ============================================================================
// Tool Selection & Settings
// ============================================================================

function selectTool(tool) {
  // Image tool opens file dialog instead of selecting
  if (tool === 'image') {
    elements.imageInput.click();
    return;
  }
  
  // Clear selection when switching away from select tool
  if (state.tool === 'select' && tool !== 'select' && state.selectedElement) {
    state.selectedElement = null;
    redrawCanvas();
  }
  
  state.tool = tool;
  elements.toolButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
  
  // Update cursor
  if (tool === 'select') {
    elements.canvas.style.cursor = 'default';
  } else if (tool === 'text') {
    elements.canvas.style.cursor = 'text';
  } else if (tool === 'eraser') {
    elements.canvas.style.cursor = 'cell';
  } else {
    elements.canvas.style.cursor = 'crosshair';
  }
}

function updateColor(color) {
  state.color = color;
  elements.colorPreview.style.background = color;
}

function updateStrokeWidth(width) {
  state.strokeWidth = parseInt(width);
  elements.strokePreview.textContent = width + 'px';
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

function handleKeyboard(e) {
  // Ignore if typing in text input
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'z':
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        break;
      case 'y':
        e.preventDefault();
        redo();
        break;
    }
  } else {
    switch (e.key.toLowerCase()) {
      case 'v':
        selectTool('select');
        break;
      case 'p':
        selectTool('pen');
        break;
      case 'l':
        selectTool('line');
        break;
      case 'r':
        selectTool('rectangle');
        break;
      case 'c':
        selectTool('circle');
        break;
      case 't':
        selectTool('text');
        break;
      case 'e':
        selectTool('eraser');
        break;
      case 'i':
        selectTool('image');
        break;
      case 'escape':
        hideTextInput();
        hidePreview();
        // Deselect element
        if (state.selectedElement) {
          state.selectedElement = null;
          redrawCanvas();
        }
        break;
      case 'delete':
      case 'backspace':
        // Delete selected element
        if (state.selectedElement && state.tool === 'select') {
          e.preventDefault();
          deleteSelectedElement();
        }
        break;
      case '=':
      case '+':
        e.preventDefault();
        zoomIn();
        break;
      case '-':
      case '_':
        e.preventDefault();
        zoomOut();
        break;
      case '0':
        e.preventDefault();
        resetZoom();
        break;
    }
  }
}

// ============================================================================
// Event Listeners
// ============================================================================

function initEventListeners() {
  // Tool selection
  elements.toolButtons.forEach(btn => {
    btn.addEventListener('click', () => selectTool(btn.dataset.tool));
  });
  
  // Color & stroke
  elements.colorPicker.addEventListener('input', (e) => updateColor(e.target.value));
  elements.strokeWidth.addEventListener('input', (e) => updateStrokeWidth(e.target.value));
  
  // Undo/Redo/Clear
  elements.undoBtn.addEventListener('click', undo);
  elements.redoBtn.addEventListener('click', redo);
  elements.clearBtn.addEventListener('click', clearCanvas);
  
  // Text input
  elements.textConfirm.addEventListener('click', addTextElement);
  elements.textCancel.addEventListener('click', hideTextInput);
  elements.textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addTextElement();
    } else if (e.key === 'Escape') {
      hideTextInput();
    }
  });
  
  // Voice recording
  elements.recordBtn.addEventListener('click', toggleRecording);
  
  // Text prompt input - save on change
  if (elements.textPrompt) {
    elements.textPrompt.addEventListener('input', debounce(saveSession, 500));
    elements.textPrompt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        generateApp();
      }
    });
  }
  
  // Generate
  elements.generateBtn.addEventListener('click', generateApp);
  
  // Preview modal
  elements.closePreviewBtn.addEventListener('click', hidePreview);
  elements.editCodeBtn.addEventListener('click', toggleCodeEditor);
  elements.downloadBtn.addEventListener('click', downloadAsZip);
  elements.regenerateBtn.addEventListener('click', regenerateApp);
  elements.applyCodeBtn.addEventListener('click', applyCodeChanges);
  
  elements.codeTabs.forEach(tab => {
    tab.addEventListener('click', () => showCodeTab(tab.dataset.file));
  });
  
  // Close modal on backdrop click
  elements.previewModal.addEventListener('click', (e) => {
    if (e.target === elements.previewModal) {
      hidePreview();
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

// ============================================================================
// Initialization
// ============================================================================

function init() {
  initCanvas();
  initZoomControls();
  initImageHandling();
  initVoiceRecording();
  initEventListeners();
  loadSession();
  updateColor(state.color);
  updateStrokeWidth(state.strokeWidth);
  
  console.log('Figural initialized. Draw your UI and speak your intent!');
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
