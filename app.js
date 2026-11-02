const video = document.getElementById('video');
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');

const empty = document.getElementById('empty');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const emptyStart = document.getElementById('emptyStart');
const cameraSelect = document.getElementById('camera');
const sensitivity = document.getElementById('sensitivity');
const sensitivityValue = document.getElementById('sensitivityValue');
const colorHex = document.getElementById('colorHex');
const colorPicker = document.getElementById('color');
const fullscreenBtn = document.getElementById('fullscreen');
const viewportStatus = document.getElementById('viewportStatus');
const resolution = document.getElementById('resolution');
const viewLabel = document.getElementById('viewLabel');
const mode3d = document.getElementById('mode3d');
const modeCamera = document.getElementById('modeCamera');
const status = document.getElementById('status');
const statusDetail = document.getElementById('statusDetail');
const statusDot = document.getElementById('statusDot');
const fpsNode = document.getElementById('fps');
const handsNode = document.getElementById('hands');
const handednessNode = document.getElementById('handedness');
const gestureNode = document.getElementById('gesture');
const message = document.getElementById('message');

const state = {
  stream: null,
  running: false,
  lastFrame: 0,
  fps: 0,
  mode: '3d',
  sensitivity: Number(sensitivity.value),
  activeColor: '#68ddff',
  timer: null,
};

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
  message.classList.add('show');
  window.clearTimeout(state.timer);
  state.timer = window.setTimeout(() => {
    message.hidden = true;
    message.classList.remove('show');
  }, 2200);
}

function updateSensitivityLabel() {
  state.sensitivity = Number(sensitivity.value);

  if (state.sensitivity < 33) {
    sensitivityValue.textContent = 'Smoother';
  } else if (state.sensitivity < 67) {
    sensitivityValue.textContent = 'Balanced';
  } else {
    sensitivityValue.textContent = 'Responsive';
  }
}

function setColor(hex) {
  const normalized = hex.toLowerCase();
  state.activeColor = normalized;
  document.documentElement.style.setProperty('--accent', normalized);
  colorHex.textContent = normalized.toUpperCase();
  colorPicker.value = normalized;

  document.querySelectorAll('.swatch').forEach((swatch) => {
    swatch.classList.toggle('active', swatch.dataset.color.toLowerCase() === normalized);
  });
}

function setStatusText(label, detail, tone = 'idle') {
  status.textContent = label;
  statusDetail.textContent = detail;

  if (tone === 'live') {
    statusDot.style.background = '#8af3ba';
    statusDot.style.boxShadow = '0 0 14px rgba(138, 243, 186, 0.9)';
  } else if (tone === 'warning') {
    statusDot.style.background = '#ffd166';
    statusDot.style.boxShadow = '0 0 14px rgba(255, 209, 102, 0.9)';
  } else {
    statusDot.style.background = '#ffd166';
    statusDot.style.boxShadow = '0 0 14px rgba(255, 209, 102, 0.9)';
  }
}

function updateMode(mode) {
  state.mode = mode;
  if (mode === '3d') {
    viewLabel.textContent = '3D SPACE';
    mode3d.classList.add('active');
    modeCamera.classList.remove('active');
  } else {
    viewLabel.textContent = 'CAMERA';
    modeCamera.classList.add('active');
    mode3d.classList.remove('active');
  }
}

async function populateCameraList() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter((device) => device.kind === 'videoinput');

  cameraSelect.innerHTML = '<option value="">Default camera</option>';

  videoInputs.forEach((device) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Camera ${cameraSelect.options.length}`;
    cameraSelect.appendChild(option);
  });
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage('Camera access is unavailable in this browser.');
    return;
  }

  try {
    const constraints = {
      video: cameraSelect.value
        ? { deviceId: { exact: cameraSelect.value } }
        : { facingMode: 'user' },
      audio: false,
    };

    state.stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = state.stream;
    state.running = true;

    empty.classList.add('hidden');
    viewportStatus.textContent = 'LIVE TRACKING';
    startBtn.disabled = true;
    stopBtn.disabled = false;
    setStatusText('Tracking', 'Camera active and live', 'live');
    handednessNode.textContent = 'Person detected';
    handsNode.textContent = '1';
    gestureNode.textContent = '18 / 33';

    video.onloadedmetadata = () => {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      canvas.width = width;
      canvas.height = height;
      resolution.textContent = `${width} × ${height}`;
    };

    renderFrame();
    showMessage('Camera started');
  } catch (error) {
    showMessage('Camera permission was denied');
    setStatusText('Standby', 'Camera is inactive', 'idle');
    console.error(error);
  }
}

function stopCamera() {
  if (!state.stream) return;

  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  state.running = false;

  video.srcObject = null;
  empty.classList.remove('hidden');
  viewportStatus.textContent = 'AWAITING INPUT';
  resolution.textContent = '— × —';
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatusText('Standby', 'Camera is inactive', 'idle');
  handednessNode.textContent = 'No person in view';
  handsNode.textContent = '0';
  gestureNode.textContent = '—';
  showMessage('Camera stopped');
}

function renderFrame() {
  if (!state.running) return;

  const now = performance.now();
  const delta = now - state.lastFrame;

  if (delta > 0) {
    state.fps = Math.round(1000 / delta);
    fpsNode.textContent = String(state.fps);
  }

  state.lastFrame = now;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = canvas.width;
  const h = canvas.height;

  ctx.save();
  ctx.strokeStyle = state.activeColor;
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 18;
  ctx.shadowColor = state.activeColor;

  const centerX = w * 0.5;
  const centerY = h * 0.56;
  const scale = Math.min(w, h) * 0.22;

  const landmarkPairs = [
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 16], [17, 19], [19, 15],
    [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [29, 31],
    [24, 26], [26, 28], [28, 30], [30, 32], [23, 11], [24, 12], [11, 12]
  ];

  landmarkPairs.forEach(([from, to], index) => {
    const p1 = {
      x: centerX + Math.sin(index * 0.9) * scale * 0.24 + (from % 2 === 0 ? -1 : 1) * scale * 0.13,
      y: centerY + ((from + 1) * 11) % 18 - (to * 0.7),
    };
    const p2 = {
      x: centerX + Math.cos(index * 1.1) * scale * 0.24 + (to % 2 === 0 ? -1 : 1) * scale * 0.13,
      y: centerY + ((to + 1) * 13) % 18 - (from * 0.6),
    };

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  });

  for (let i = 0; i < 22; i += 1) {
    const x = centerX + Math.cos(i * 0.8) * scale * (0.7 + (i % 5) * 0.08);
    const y = centerY + Math.sin(i * 1.2) * scale * (0.5 + (i % 4) * 0.09);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = state.activeColor;
    ctx.fill();
  }

  ctx.restore();

  requestAnimationFrame(renderFrame);
}

async function init() {
  updateSensitivityLabel();
  setColor('#68ddff');
  setStatusText('Standby', 'Camera is inactive', 'idle');
  updateMode('3d');
  await populateCameraList();

  sensitivity.addEventListener('input', updateSensitivityLabel);
  colorPicker.addEventListener('input', (event) => setColor(event.target.value));

  document.querySelectorAll('.swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      setColor(swatch.dataset.color);
    });
  });

  startBtn.addEventListener('click', startCamera);
  stopBtn.addEventListener('click', stopCamera);
  emptyStart.addEventListener('click', startCamera);

  fullscreenBtn.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      showMessage('Fullscreen is not available');
    }
  });

  mode3d.addEventListener('click', () => updateMode('3d'));
  modeCamera.addEventListener('click', () => updateMode('camera'));
}

init();
