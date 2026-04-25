import './style.css';

import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';

type Point = {
  x: number;
  y: number;
};

type NormalizedLandmark = {
  x: number;
  y: number;
  z: number;
};

type VisualStyle = {
  coreColor: string;
  lineWidth: number;
  glowColor: string;
  glowBlur: number;
  landmarkStrokeColor: string;
  landmarkGlowColor: string;
  landmarkFillColor: string;
  progressTrackColor: string;
  progressFillColor: string;
  hudAccentColor: string;
  hudAccentSoft: string;
  modalAccentColor: string;
  countdownColor: string;
};

type CaptureState = {
  delaySeconds: number;
  countdownEndAt: number | null;
  capturedImageDataUrl: string | null;
  previewOpen: boolean;
};

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];

const THUMB_TIP_INDEX = 4;
const THUMB_IP_INDEX = 3;
const THUMB_MCP_INDEX = 2;
const WRIST_INDEX = 0;
const OTHER_FINGERTIP_INDICES = [8, 12, 16, 20] as const;
const OTHER_PIP_INDICES = [6, 10, 14, 18] as const;
const HOLD_TO_FREEZE_MS = 1000;
const EXTENDED_THRESHOLD = 0.05;
const DEDUPE_DISTANCE = 18;
const POLYGON_STABILITY_TOLERANCE = 22;

const style: VisualStyle = {
  coreColor: '#f7feff',
  lineWidth: 2,
  glowColor: 'rgba(151, 251, 255, 0.92)',
  glowBlur: 28,
  landmarkStrokeColor: 'rgba(203, 255, 253, 0.92)',
  landmarkGlowColor: 'rgba(141, 255, 244, 0.82)',
  landmarkFillColor: '#f8feff',
  progressTrackColor: 'rgba(160, 245, 255, 0.24)',
  progressFillColor: '#c6fdff',
  hudAccentColor: '#97fbff',
  hudAccentSoft: 'rgba(151, 251, 255, 0.16)',
  modalAccentColor: '#c6fdff',
  countdownColor: '#f8feff',
};

const canvas = getRequiredElement('#app-canvas') as HTMLCanvasElement;
const statusText = getRequiredElement('#status-text') as HTMLDivElement;
const resetBtn = getRequiredElement('#reset-btn') as HTMLButtonElement;
const captureDelaySelect = getRequiredElement('#capture-delay-select') as HTMLSelectElement;
const captureBtn = getRequiredElement('#capture-btn') as HTMLButtonElement;
const previewModal = getRequiredElement('#preview-modal') as HTMLDivElement;
const previewImage = getRequiredElement('#preview-image') as HTMLImageElement;
const closePreviewBtn = getRequiredElement('#close-preview-btn') as HTMLButtonElement;
const savePreviewBtn = getRequiredElement('#save-preview-btn') as HTMLButtonElement;
const ctx = getRequiredContext(canvas);

const video = document.createElement('video');
video.autoplay = true;
video.muted = true;
video.playsInline = true;
video.setAttribute('playsinline', 'true');

const frozenBackgroundCanvas = document.createElement('canvas');
const frozenBackgroundCtx = getRequiredContext(frozenBackgroundCanvas, false);

let handLandmarker: HandLandmarker | null = null;
let lastVideoTime = -1;
let lastDetections: HandLandmarkerResult | null = null;
let holdStartAt: number | null = null;
let portalPolygon: Point[] = [];
let previewHoldPolygon: Point[] = [];
let isFrozen = false;
let stream: MediaStream | null = null;
let latestLivePolygon: Point[] = [];
const captureState: CaptureState = {
  delaySeconds: 0,
  countdownEndAt: null,
  capturedImageDataUrl: null,
  previewOpen: false,
};

applyStyleToDocument();
attachUIEvents();
startApp().catch((error: unknown) => {
  console.error(error);
  setStatus('Không thể khởi động camera hoặc MediaPipe. Hãy cấp quyền camera rồi tải lại trang.');
});

function getRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Thiếu phần tử DOM bắt buộc: ${selector}`);
  }

  return element;
}

function getRequiredContext(
  targetCanvas: HTMLCanvasElement,
  alpha = true,
): CanvasRenderingContext2D {
  const context = targetCanvas.getContext('2d', { alpha });
  if (!context) {
    throw new Error('Không lấy được CanvasRenderingContext2D.');
  }

  return context;
}

function applyStyleToDocument(): void {
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--accent', style.hudAccentColor);
  rootStyle.setProperty('--accent-soft', style.hudAccentSoft);
  rootStyle.setProperty('--button-bg', style.hudAccentSoft);
  rootStyle.setProperty('--button-border', style.hudAccentColor);
  rootStyle.setProperty('--panel-border', hexToRgba(style.hudAccentColor, 0.28));
  rootStyle.setProperty('--theme-core', style.coreColor);
  rootStyle.setProperty('--modal-accent', style.modalAccentColor);
}

function attachUIEvents(): void {
  captureDelaySelect.addEventListener('change', () => {
    captureState.delaySeconds = Number(captureDelaySelect.value);
  });

  captureBtn.addEventListener('click', () => {
    if (!isFrozen || captureState.countdownEndAt !== null) {
      return;
    }

    startCaptureFlow();
  });

  savePreviewBtn.addEventListener('click', () => {
    if (!captureState.capturedImageDataUrl) {
      return;
    }

    downloadPreviewImage(captureState.capturedImageDataUrl);
  });

  closePreviewBtn.addEventListener('click', () => {
    closePreviewModal();
  });

  previewModal.addEventListener('click', (event) => {
    if (event.target === previewModal || (event.target instanceof HTMLElement && event.target.classList.contains('preview-backdrop'))) {
      closePreviewModal();
    }
  });

  resetBtn.addEventListener('click', () => {
    resetPortal();
  });

  window.addEventListener('resize', () => {
    resizeCanvas();
  });
}

async function startApp(): Promise<void> {
  setStatus('Đang xin quyền camera trước...');
  await setupCamera();
  resizeCanvas();

  setStatus('Đang tải MediaPipe Hand Landmarker...');
  await setupHandLandmarker();

  setStatus('Sẵn sàng. Đưa tay vào • Mở lòng bàn tay • Giữ 1 giây để tạo khung');
  requestAnimationFrame(renderLoop);
}

async function setupCamera(): Promise<void> {
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  });

  video.srcObject = stream;

  await video.play();
  await new Promise<void>((resolve) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      resolve();
      return;
    }

    video.onloadedmetadata = () => resolve();
  });
}

async function setupHandLandmarker(): Promise<void> {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
  });
}

function resizeCanvas(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  frozenBackgroundCanvas.width = width;
  frozenBackgroundCanvas.height = height;
}

function renderLoop(): void {
  if (!handLandmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    requestAnimationFrame(renderLoop);
    return;
  }

  const now = performance.now();
  const currentVideoTime = video.currentTime;

  if (currentVideoTime !== lastVideoTime) {
    lastDetections = handLandmarker.detectForVideo(video, now);
    lastVideoTime = currentVideoTime;
  }

  const landmarks = lastDetections?.landmarks ?? [];
  latestLivePolygon = buildPolygonFromHands(landmarks);
  const freezeProgress = getFreezeProgress();
  const countdownValue = getCountdownRemaining();

  drawFrame(latestLivePolygon, landmarks, freezeProgress, countdownValue);
  updateFreezeState(latestLivePolygon, landmarks.length);
  updateCountdownState();

  requestAnimationFrame(renderLoop);
}

function buildPolygonFromHands(landmarks: NormalizedLandmark[][]): Point[] {
  const points: Point[] = [];

  for (const hand of landmarks) {
    if (isThumbExtended(hand)) {
      const thumbTip = hand[THUMB_TIP_INDEX];
      if (thumbTip) {
        points.push(toCanvasPoint(thumbTip.x, thumbTip.y));
      }
    }

    for (let index = 0; index < OTHER_FINGERTIP_INDICES.length; index += 1) {
      const tipIndex = OTHER_FINGERTIP_INDICES[index];
      const pipIndex = OTHER_PIP_INDICES[index];
      const tip = hand[tipIndex];
      const pip = hand[pipIndex];

      if (!tip || !pip) {
        continue;
      }

      if (tip.y < pip.y - EXTENDED_THRESHOLD) {
        points.push(toCanvasPoint(tip.x, tip.y));
      }
    }
  }

  const dedupedPoints = dedupeNearbyPoints(points, DEDUPE_DISTANCE);
  return sortPointsClockwise(dedupedPoints);
}

function isThumbExtended(hand: NormalizedLandmark[]): boolean {
  const thumbTip = hand[THUMB_TIP_INDEX];
  const thumbIp = hand[THUMB_IP_INDEX];
  const thumbMcp = hand[THUMB_MCP_INDEX];
  const wrist = hand[WRIST_INDEX];

  if (!thumbTip || !thumbIp || !thumbMcp || !wrist) {
    return false;
  }

  const tipToMcp = normalizedDistance(thumbTip, thumbMcp);
  const tipToWrist = normalizedDistance(thumbTip, wrist);
  const ipToWrist = normalizedDistance(thumbIp, wrist);
  const spreadFromPalm = Math.abs(thumbTip.x - thumbMcp.x);

  return tipToMcp > 0.12 && tipToWrist > ipToWrist * 0.95 && spreadFromPalm > 0.05;
}

function updateFreezeState(livePolygon: Point[], handCount: number): void {
  const hasEnoughPoints = livePolygon.length >= 3;
  const now = Date.now();

  if (isFrozen) {
    return;
  }

  if (!hasEnoughPoints) {
    holdStartAt = null;
    previewHoldPolygon = [];
    setStatus(`Đang thấy ${handCount} tay • ${livePolygon.length} đỉnh hợp lệ. Cần ít nhất 3 đỉnh để tạo khung.`);
    return;
  }

  if (holdStartAt === null) {
    holdStartAt = now;
    previewHoldPolygon = livePolygon.map((point) => ({ ...point }));
    setStatus(`Đang thấy ${handCount} tay • ${livePolygon.length} đỉnh. Giữ yên thêm 1 giây để freeze background.`);
    return;
  }

  if (!isPolygonStable(previewHoldPolygon, livePolygon)) {
    holdStartAt = now;
    previewHoldPolygon = livePolygon.map((point) => ({ ...point }));
    setStatus(`Khung đang đổi hình. Đã reset tiến trình • ${handCount} tay • ${livePolygon.length} đỉnh.`);
    return;
  }

  const elapsed = now - holdStartAt;
  if (elapsed < HOLD_TO_FREEZE_MS) {
    const remain = ((HOLD_TO_FREEZE_MS - elapsed) / 1000).toFixed(1);
    setStatus(`Đang thấy ${handCount} tay • ${livePolygon.length} đỉnh • giữ yên thêm ${remain}s để tạo portal.`);
    return;
  }

  portalPolygon = livePolygon.map((point) => ({ ...point }));
  captureFrozenBackground();
  isFrozen = true;
  holdStartAt = null;
  previewHoldPolygon = [];
  captureBtn.classList.remove('hidden');
  setStatus('Portal đã freeze. Chọn thời gian chờ rồi bấm Chụp ảnh.');
}

function startCaptureFlow(): void {
  closePreviewModal();

  if (captureState.delaySeconds <= 0) {
    capturePreviewImage();
    return;
  }

  captureState.countdownEndAt = Date.now() + captureState.delaySeconds * 1000;
  setStatus(`Đang đếm ngược ${captureState.delaySeconds}s để chụp ảnh.`);
}

function updateCountdownState(): void {
  if (captureState.countdownEndAt === null) {
    return;
  }

  const remaining = captureState.countdownEndAt - Date.now();
  if (remaining > 0) {
    setStatus(`Đang đếm ngược ${Math.ceil(remaining / 1000)}s để chụp ảnh.`);
    return;
  }

  captureState.countdownEndAt = null;
  capturePreviewImage();
}

function capturePreviewImage(): void {
  captureState.capturedImageDataUrl = canvas.toDataURL('image/png');
  previewImage.src = captureState.capturedImageDataUrl;
  previewModal.classList.remove('hidden');
  previewModal.setAttribute('aria-hidden', 'false');
  captureState.previewOpen = true;
  setStatus('Đã chụp xong. Xem preview và bấm Tải ảnh nếu muốn.');
}

function closePreviewModal(): void {
  previewModal.classList.add('hidden');
  previewModal.setAttribute('aria-hidden', 'true');
  captureState.previewOpen = false;
}

function drawFrame(
  livePolygon: Point[],
  landmarks: NormalizedLandmark[][],
  freezeProgress: number,
  countdownValue: number | null,
): void {
  clearCanvas();

  if (!isFrozen) {
    drawMirroredVideo(ctx);

    if (livePolygon.length >= 2) {
      drawPortalAtmosphere(ctx, livePolygon, livePolygon.length >= 3);
      drawPolygonFrame(ctx, livePolygon, livePolygon.length >= 3);
    }

    if (livePolygon.length >= 3 && freezeProgress > 0) {
      drawPolygonProgress(ctx, livePolygon, freezeProgress);
    }
  } else {
    ctx.drawImage(frozenBackgroundCanvas, 0, 0, canvas.clientWidth, canvas.clientHeight);

    if (portalPolygon.length >= 3) {
      ctx.save();
      buildPolygonPath(ctx, portalPolygon);
      ctx.clip();
      drawMirroredVideo(ctx);
      ctx.restore();
      drawPortalAtmosphere(ctx, portalPolygon, true);
      drawPolygonFrame(ctx, portalPolygon, true);
    }
  }

  drawLandmarks(landmarks);

  if (countdownValue !== null) {
    drawCountdownOverlay(countdownValue);
  }
}

function clearCanvas(): void {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

function drawMirroredVideo(targetCtx: CanvasRenderingContext2D): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const videoAspect = video.videoWidth / video.videoHeight;
  const canvasAspect = width / height;

  let drawWidth = width;
  let drawHeight = height;

  if (videoAspect > canvasAspect) {
    drawHeight = height;
    drawWidth = drawHeight * videoAspect;
  } else {
    drawWidth = width;
    drawHeight = drawWidth / videoAspect;
  }

  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  targetCtx.save();
  targetCtx.translate(width, 0);
  targetCtx.scale(-1, 1);
  targetCtx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
  targetCtx.restore();
}

function captureFrozenBackground(): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  frozenBackgroundCanvas.width = width;
  frozenBackgroundCanvas.height = height;
  frozenBackgroundCtx.clearRect(0, 0, width, height);
  drawMirroredVideo(frozenBackgroundCtx);
}

function drawPolygonFrame(
  targetCtx: CanvasRenderingContext2D,
  polygon: Point[],
  closePath = true,
): void {
  if (polygon.length < 2) {
    return;
  }

  targetCtx.save();
  targetCtx.lineJoin = 'round';
  targetCtx.lineCap = 'round';
  targetCtx.shadowColor = style.glowColor;
  targetCtx.shadowBlur = style.glowBlur;
  targetCtx.strokeStyle = style.coreColor;
  targetCtx.lineWidth = style.lineWidth;
  buildPolygonPath(targetCtx, polygon, closePath);
  targetCtx.stroke();
  targetCtx.shadowBlur = 0;
  targetCtx.strokeStyle = hexToRgba(style.coreColor, 0.3);
  targetCtx.lineWidth = style.lineWidth + 8;
  targetCtx.stroke();
  targetCtx.restore();
}

function drawPortalAtmosphere(
  targetCtx: CanvasRenderingContext2D,
  polygon: Point[],
  closePath: boolean,
): void {
  if (polygon.length < 2) {
    return;
  }

  targetCtx.save();
  targetCtx.lineJoin = 'round';
  targetCtx.lineCap = 'round';
  targetCtx.strokeStyle = hexToRgba(style.glowColor, 0.34);
  targetCtx.lineWidth = style.lineWidth + 18;
  targetCtx.shadowColor = style.glowColor;
  targetCtx.shadowBlur = style.glowBlur * 1.5;
  buildPolygonPath(targetCtx, polygon, closePath);
  targetCtx.stroke();
  targetCtx.restore();
}

function buildPolygonPath(
  targetCtx: CanvasRenderingContext2D,
  polygon: Point[],
  closePath = true,
): void {
  targetCtx.beginPath();
  targetCtx.moveTo(polygon[0].x, polygon[0].y);

  for (let index = 1; index < polygon.length; index += 1) {
    targetCtx.lineTo(polygon[index].x, polygon[index].y);
  }

  if (closePath) {
    targetCtx.closePath();
  }
}

function drawPolygonProgress(
  targetCtx: CanvasRenderingContext2D,
  polygon: Point[],
  progress: number,
): void {
  const topEdge = getTopEdge(polygon);
  if (!topEdge) {
    return;
  }

  const edgeLength = distance(topEdge.start, topEdge.end);
  if (edgeLength < 36) {
    return;
  }

  const directionX = (topEdge.end.x - topEdge.start.x) / edgeLength;
  const directionY = (topEdge.end.y - topEdge.start.y) / edgeLength;
  const midpoint = {
    x: (topEdge.start.x + topEdge.end.x) / 2,
    y: (topEdge.start.y + topEdge.end.y) / 2,
  };
  const centroid = getPolygonCenter(polygon);
  const inwardVector = {
    x: centroid.x - midpoint.x,
    y: centroid.y - midpoint.y,
  };
  const normalCandidateA = { x: -directionY, y: directionX };
  const normalCandidateB = { x: directionY, y: -directionX };
  const normal =
    dotProduct(normalCandidateA, inwardVector) < dotProduct(normalCandidateB, inwardVector)
      ? normalCandidateA
      : normalCandidateB;
  const offset = Math.max(24, canvas.clientWidth * 0.018);
  const inset = Math.min(24, edgeLength * 0.16);

  const trimmedStart = {
    x: topEdge.start.x + directionX * inset,
    y: topEdge.start.y + directionY * inset,
  };
  const trimmedEnd = {
    x: topEdge.end.x - directionX * inset,
    y: topEdge.end.y - directionY * inset,
  };

  const start = {
    x: trimmedStart.x + normal.x * offset,
    y: trimmedStart.y + normal.y * offset,
  };
  const end = {
    x: trimmedEnd.x + normal.x * offset,
    y: trimmedEnd.y + normal.y * offset,
  };
  const fillEnd = {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
  };

  targetCtx.save();
  targetCtx.lineCap = 'round';
  targetCtx.lineWidth = 4;
  targetCtx.strokeStyle = style.progressTrackColor;
  targetCtx.beginPath();
  targetCtx.moveTo(start.x, start.y);
  targetCtx.lineTo(end.x, end.y);
  targetCtx.stroke();

  targetCtx.lineWidth = 2.5;
  targetCtx.strokeStyle = style.progressFillColor;
  targetCtx.beginPath();
  targetCtx.moveTo(start.x, start.y);
  targetCtx.lineTo(fillEnd.x, fillEnd.y);
  targetCtx.stroke();
  targetCtx.restore();
}

function drawLandmarks(landmarks: NormalizedLandmark[][]): void {
  for (const hand of landmarks) {
    for (const [startIndex, endIndex] of HAND_CONNECTIONS) {
      const start = hand[startIndex];
      const end = hand[endIndex];
      if (!start || !end) {
        continue;
      }

      const startPoint = toCanvasPoint(start.x, start.y);
      const endPoint = toCanvasPoint(end.x, end.y);

      ctx.save();
      ctx.strokeStyle = style.landmarkStrokeColor;
      ctx.shadowColor = style.landmarkGlowColor;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(endPoint.x, endPoint.y);
      ctx.stroke();
      ctx.restore();
    }

    for (const landmark of hand) {
      const point = toCanvasPoint(landmark.x, landmark.y);
      ctx.save();
      ctx.fillStyle = style.landmarkFillColor;
      ctx.shadowColor = style.landmarkGlowColor;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawCountdownOverlay(countdownValue: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.fillStyle = style.countdownColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.max(72, canvas.clientWidth * 0.12)}px Inter, system-ui, sans-serif`;
  ctx.fillText(String(countdownValue), canvas.clientWidth / 2, canvas.clientHeight / 2);
  ctx.restore();
}

function toCanvasPoint(normalizedX: number, normalizedY: number): Point {
  return {
    x: (1 - normalizedX) * canvas.clientWidth,
    y: normalizedY * canvas.clientHeight,
  };
}

function normalizedDistance(pointA: NormalizedLandmark, pointB: NormalizedLandmark): number {
  const deltaX = pointA.x - pointB.x;
  const deltaY = pointA.y - pointB.y;
  const deltaZ = pointA.z - pointB.z;
  return Math.hypot(deltaX, deltaY, deltaZ);
}

function dedupeNearbyPoints(points: Point[], minDistance: number): Point[] {
  const result: Point[] = [];

  for (const point of points) {
    const exists = result.some((candidate) => distance(candidate, point) < minDistance);
    if (!exists) {
      result.push(point);
    }
  }

  return result;
}

function sortPointsClockwise(points: Point[]): Point[] {
  if (points.length <= 2) {
    return points;
  }

  const center = getPolygonCenter(points);

  return [...points].sort((pointA, pointB) => {
    const angleA = Math.atan2(pointA.y - center.y, pointA.x - center.x);
    const angleB = Math.atan2(pointB.y - center.y, pointB.x - center.x);
    return angleA - angleB;
  });
}

function getFreezeProgress(): number {
  if (holdStartAt === null || isFrozen) {
    return 0;
  }

  return Math.max(0, Math.min(1, (Date.now() - holdStartAt) / HOLD_TO_FREEZE_MS));
}

function getCountdownRemaining(): number | null {
  if (captureState.countdownEndAt === null) {
    return null;
  }

  return Math.max(1, Math.ceil((captureState.countdownEndAt - Date.now()) / 1000));
}

function isPolygonStable(previousPolygon: Point[], nextPolygon: Point[]): boolean {
  if (previousPolygon.length !== nextPolygon.length) {
    return false;
  }

  return previousPolygon.every(
    (point, index) => distance(point, nextPolygon[index]) <= POLYGON_STABILITY_TOLERANCE,
  );
}

function getTopEdge(polygon: Point[]): { start: Point; end: Point } | null {
  if (polygon.length < 2) {
    return null;
  }

  let topEdge: { start: Point; end: Point } | null = null;
  let topMidY = Number.POSITIVE_INFINITY;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const midY = (start.y + end.y) / 2;

    if (midY < topMidY) {
      topMidY = midY;
      topEdge = { start, end };
    }
  }

  return topEdge;
}

function distance(pointA: Point, pointB: Point): number {
  const deltaX = pointA.x - pointB.x;
  const deltaY = pointA.y - pointB.y;
  return Math.hypot(deltaX, deltaY);
}

function getPolygonCenter(points: Point[]): Point {
  return points.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x / points.length,
      y: accumulator.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
}

function dotProduct(pointA: Point, pointB: Point): number {
  return pointA.x * pointB.x + pointA.y * pointB.y;
}

function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith('rgba(') || hex.startsWith('rgb(')) {
    const values = hex
      .replace(/rgba?\(/, '')
      .replace(')', '')
      .split(',')
      .map((value) => value.trim());
    const [red, green, blue] = values;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  const normalizedHex = hex.replace('#', '');
  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function downloadPreviewImage(dataUrl: string): void {
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
  link.href = dataUrl;
  link.download = `hand-frame-portal-${timestamp}.png`;
  link.click();
}

function resetPortal(): void {
  isFrozen = false;
  holdStartAt = null;
  portalPolygon = [];
  previewHoldPolygon = [];
  latestLivePolygon = [];
  captureState.countdownEndAt = null;
  captureState.capturedImageDataUrl = null;
  captureState.previewOpen = false;
  frozenBackgroundCtx.clearRect(0, 0, frozenBackgroundCanvas.width, frozenBackgroundCanvas.height);
  captureBtn.classList.add('hidden');
  closePreviewModal();
  setStatus('Đã reset toàn bộ. Đưa tay vào • Mở lòng bàn tay • Giữ 1 giây để tạo khung');
}

function setStatus(message: string): void {
  statusText.textContent = message;
}
