/* Canvas & DOM elements */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const mainMenu = document.getElementById('mainMenu');
const endScreen = document.getElementById('endScreen');
const leaderboardScreen = document.getElementById('leaderboardScreen');

const startBtn = document.getElementById('startBtn');
const mainMenuLeaderboardBtn = document.getElementById('mainMenuLeaderboardBtn');
const restartBtn = document.getElementById('restartBtn');
const downloadScoreBtn = document.getElementById('downloadScoreBtn');
const endLeaderboardBtn = document.getElementById('endLeaderboardBtn');
const mainMenuBtn = document.getElementById('mainMenuBtn');
const downloadLeaderboardBtn = document.getElementById('downloadLeaderboardBtn');
const backToMainMenuBtn = document.getElementById('backToMainMenuBtn');

const winnerText = document.getElementById('winnerText');
const finalScoreText = document.getElementById('finalScore');
const leaderboardList = document.getElementById('leaderboardList');
const saveScoreBtn = document.getElementById('saveScoreBtn');
const scoreName = document.getElementById('scoreName');
const charPopup = document.getElementById('charPopup');
const scoreOverlay = document.getElementById('scoreOverlay');
const oopsOverlay = document.getElementById('oopsOverlay');
const inputRow = document.querySelector('.input-row');

const trajectoryScreen = document.getElementById('trajectoryScreen');
const trajectoryCanvas = document.getElementById('trajectoryCanvas');
const downloadTrajectoryPngBtn = document.getElementById('downloadTrajectoryPngBtn');
const downloadTrajectoryJsonBtn = document.getElementById('downloadTrajectoryJsonBtn');
const backToEndBtn = document.getElementById('backToEndBtn');
const trajectoryMainMenuBtn = document.getElementById('trajectoryMainMenuBtn');
const showTrajectoryBtn = document.getElementById('showTrajectoryBtn');

/* Game state & constants */
canvas.width = 600;
canvas.height = 450;

const BASE_WIDTH = 800;
const BASE_HEIGHT = 600;
const SCALE_X = canvas.width / BASE_WIDTH;
const SCALE_Y = canvas.height / BASE_HEIGHT;

const BASE_PADDLE_WIDTH = 10;
const BASE_PADDLE_HEIGHT = 100;
const BASE_BALL_SIZE = 16;
const BASE_BALL_SPEED = 6;
const BASE_PADDLE_SPEED = 6;

const paddleWidth = BASE_PADDLE_WIDTH * SCALE_X;
const paddleHeight = BASE_PADDLE_HEIGHT * SCALE_Y;
const ballSize = BASE_BALL_SIZE * ((SCALE_X + SCALE_Y) / 2);
const ballSpeed = BASE_BALL_SPEED * ((SCALE_X + SCALE_Y) / 2);
const paddleSpeed = BASE_PADDLE_SPEED * SCALE_Y;

const EXPORT_SCALE = 2;

let score = 0;
let gameOver = false;
let gameOverTimestamp = null;
let lastTime = null;
let oopsTimer = 0;
let lastScoreTime = 0;
let trajectory = [];
let scoreSaved = false;

const keys = { ArrowUp: false, ArrowDown: false };
let player, ai, ball, lastHit = null;
let pointerActive = false;

const verticalLines = 16;
const horizontalLines = Math.round(canvas.height / canvas.width * verticalLines);

/* FPS & timing */
const TARGET_FPS = 120;
const FRAME_DURATION = 1000 / TARGET_FPS;
let accumulatedTime = 0;

/* Leaderboard storage */
function getLeaderboard() {
    try {
        return JSON.parse(localStorage.getItem('gameCanvasLeaderboard') || "[]");
    } catch (e) {
        console.warn('Failed to parse leaderboard from localStorage, resetting.', e);
        localStorage.removeItem('gameCanvasLeaderboard');
        return [];
    }
}
function saveLeaderboard(data) {
    localStorage.setItem('gameCanvasLeaderboard', JSON.stringify(data));
}

/* Grid */
const gridCanvas = document.createElement("canvas");
gridCanvas.width = canvas.width;
gridCanvas.height = canvas.height;
const gridCtx = gridCanvas.getContext("2d");

gridCtx.fillStyle = "#ffffff";
const cw = gridCanvas.width / verticalLines;
const ch = gridCanvas.height / horizontalLines;

for (let i = 0; i < verticalLines; i++) {
    const x = Math.round(i * cw);
    gridCtx.fillRect(x, 0, 1, gridCanvas.height);
}

for (let j = 0; j < horizontalLines; j++) {
    const y = Math.round(j * ch);
    gridCtx.fillRect(0, y, gridCanvas.width, 1);
}

gridCtx.globalCompositeOperation = "destination-in";
gridCtx.fillStyle = "rgba(255,255,255,0.25)";
gridCtx.fillRect(0, 0, gridCanvas.width, gridCanvas.height);
gridCtx.globalCompositeOperation = "source-over";

/* Initialize game */
function initGame() {
    score = 0;
    gameOver = false;
    lastTime = null;
    oopsTimer = 0;
    lastScoreTime = 0;
    trajectory = [];
    scoreSaved = false;
    gameOverTimestamp = null;
    if (inputRow) inputRow.style.display = 'flex';

    player = { x: 0, y: canvas.height / 2 - paddleHeight / 2, dy: 0 };
    ai = { x: canvas.width - paddleWidth, y: canvas.height / 2 - paddleHeight / 2, dy: 0 };

    ball = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        size: ballSize,
        dx: 0,
        dy: 0
    };
    lastHit = null;
    pointerActive = false;
    keys.ArrowUp = false;
    keys.ArrowDown = false;

    const angle = getRandomAngle();
    setBallVelocityFromAngle(angle, 1);

    if (scoreOverlay) {
        scoreOverlay.style.top = `${15 * SCALE_Y}px`;
        scoreOverlay.style.left = '50%';
        scoreOverlay.style.transform = 'translateX(-50%)';
        scoreOverlay.style.fontSize = '28px';
        scoreOverlay.setAttribute('role', 'status');
        scoreOverlay.setAttribute('aria-live', 'polite');
    }

    if (oopsOverlay) {
        oopsOverlay.style.top = `${canvas.offsetTop + canvas.height / 2}px`;
        oopsOverlay.style.left = `${canvas.offsetLeft + canvas.width - 30}px`;
        oopsOverlay.style.transform = 'translate(-100%, -50%)';
        oopsOverlay.style.fontSize = '16px';
        oopsOverlay.style.display = 'none';
        oopsOverlay.setAttribute('role', 'alert');
        oopsOverlay.setAttribute('aria-live', 'assertive');
    }
}

/* Draw functions */
function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}
function drawBall(b) {
    drawRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size, 'white');
}
function drawGrid() {
    ctx.drawImage(gridCanvas, 0, 0);
}
function drawBorder() {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'white';
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
}
function drawTrajectoryOnCanvas() {
    if (!trajectoryCanvas) return;
    trajectoryCanvas.width = canvas.width;
    trajectoryCanvas.height = canvas.height;
    const tctx = trajectoryCanvas.getContext("2d");

    tctx.fillStyle = "black";
    tctx.fillRect(0, 0, trajectoryCanvas.width, trajectoryCanvas.height);

    tctx.drawImage(gridCanvas, 0, 0);

    tctx.lineWidth = 2;
    tctx.strokeStyle = "white";
    tctx.strokeRect(1, 1, trajectoryCanvas.width - 2, trajectoryCanvas.height - 2);

    if (trajectory.length > 1) {
        tctx.strokeStyle = "white";
        tctx.lineWidth = 1;
        tctx.beginPath();
        tctx.moveTo(trajectory[0].x, trajectory[0].y);
        for (let i = 1; i < trajectory.length; i++) {
            tctx.lineTo(trajectory[i].x, trajectory[i].y);
        }
        tctx.stroke();
    }
}

/* Controls */
document.addEventListener("keydown", e => { if(keys.hasOwnProperty(e.key)) keys[e.key] = true; });
document.addEventListener("keyup", e => { if(keys.hasOwnProperty(e.key)) keys[e.key] = false; });

function handlePointer(y, active) {
    if(!active) { keys.ArrowUp = false; keys.ArrowDown = false; return; }
    const rect = canvas.getBoundingClientRect();
    const relY = y - rect.top;
    keys.ArrowUp = relY < canvas.height / 2;
    keys.ArrowDown = relY >= canvas.height / 2;
}

canvas.addEventListener('mousedown', e => { pointerActive = true; handlePointer(e.clientY, true); });
canvas.addEventListener('mousemove', e => { if(pointerActive) handlePointer(e.clientY, true); });
canvas.addEventListener('mouseup', () => { pointerActive = false; keys.ArrowUp = false; keys.ArrowDown = false; });
canvas.addEventListener('touchstart', e => { e.preventDefault(); pointerActive = true; handlePointer(e.touches[0].clientY, true); }, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); handlePointer(e.touches[0].clientY, true); }, { passive: false });
canvas.addEventListener('touchend', () => { pointerActive = false; keys.ArrowUp = false; keys.ArrowDown = false; });

/* Ball & AI */
function getRandomAngle() {
    const goldenRatio = 0.61803398875;
    const rand = Math.random();
    const angle = (rand + goldenRatio) % 1;
    return (angle - 0.5) * Math.PI * 2 / 3;
}

function setBallVelocityFromAngle(angle, direction = 1) {
    if (!ball) return;
    ball.dx = direction * ballSpeed * Math.cos(angle);
    ball.dy = ballSpeed * Math.sin(angle);

    const mag = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy) || 1;
    ball.dx = (ball.dx / mag) * ballSpeed;
    ball.dy = (ball.dy / mag) * ballSpeed;
}

function handleBallBounce(paddle) {
    const angle = getRandomAngle();
    const direction = paddle === 'player' ? 1 : -1;
    setBallVelocityFromAngle(angle, direction);

    if (ball.y - ball.size / 2 < 0) ball.y = ball.size / 2;
    if (ball.y + ball.size / 2 > canvas.height) ball.y = canvas.height - ball.size / 2;
}

function resetBall() {
    if (!ball) return;
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;

    const angle = getRandomAngle();
    setBallVelocityFromAngle(angle, 1);

    lastHit = null;
    oopsTimer = 1;
}

function updateBallPosition() {
    ball.x += ball.dx;
    ball.y += ball.dy;

    if (ball.y - ball.size / 2 < 0) {
        ball.y = ball.size / 2;
        ball.dy *= -1;
    }
    if (ball.y + ball.size / 2 > canvas.height) {
        ball.y = canvas.height - ball.size / 2;
        ball.dy *= -1;
    }
}

function moveAI() {
    ai.y = ball.y - paddleHeight / 2;

    if (ai.y < 0) ai.y = 0;
    if (ai.y + paddleHeight > canvas.height) ai.y = canvas.height - paddleHeight;
}

/* Recording */
function recordTrajectory() {
    if (!ball) return;
    if (trajectory.length === 0) {
        trajectory.push({ x: ball.x, y: ball.y });
    } else {
        const last = trajectory[trajectory.length - 1];
        const dx = Math.abs(ball.x - last.x);
        const dy = Math.abs(ball.y - last.y);
        if (dx >= 1 || dy >= 1) {
            trajectory.push({ x: ball.x, y: ball.y });
        }
    }
}

/* Game update & render */
function update() {
    if (gameOver) return;

    player.dy = keys.ArrowUp && !keys.ArrowDown ? -paddleSpeed : keys.ArrowDown && !keys.ArrowUp ? paddleSpeed : 0;
    player.y += player.dy;
    player.y = Math.max(0, Math.min(player.y, canvas.height - paddleHeight));

    moveAI();
    ai.y = Math.max(0, Math.min(ai.y, canvas.height - paddleHeight));

    updateBallPosition();
    recordTrajectory();

    const now = performance.now();
    if (ball.x - ball.size / 2 <= player.x + paddleWidth && ball.y > player.y && ball.y < player.y + paddleHeight) {
        if (lastHit !== 'player') {
            handleBallBounce('player');
            lastHit = 'player';
            if (now - lastScoreTime > 120) { score++; lastScoreTime = now; }
        }
    }

    if (ball.x + ball.size / 2 >= ai.x && ball.y > ai.y && ball.y < ai.y + paddleHeight) {
        if (lastHit !== 'ai') {
            handleBallBounce('ai');
            lastHit = 'ai';
        }
    }

    if (ball.x < 0) { gameOver = true; showEndScreen(); }
    if (ball.x > canvas.width) { resetBall(); }

    if (oopsTimer > 0) { oopsTimer -= FRAME_DURATION / 1000; if (oopsTimer < 0) oopsTimer = 0; }
}

function render() {
    drawRect(0, 0, canvas.width, canvas.height, 'black');
    drawGrid();
    drawBorder();
    drawRect(player.x, player.y, paddleWidth, paddleHeight, 'white');
    drawRect(ai.x, ai.y, paddleWidth, paddleHeight, 'white');
    drawBall(ball);

    if (scoreOverlay) scoreOverlay.textContent = `Score: ${score}`;
    if (oopsOverlay) oopsOverlay.style.display = oopsTimer > 0 ? 'block' : 'none';

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
}

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;

    const delta = timestamp - lastTime;
    lastTime = timestamp;

    accumulatedTime += delta;
    while (accumulatedTime >= FRAME_DURATION) {
        update();
        accumulatedTime -= FRAME_DURATION;
    }

    render();

    if (!gameOver) requestAnimationFrame(gameLoop);
}

/* End screen */
function showEndScreen() {
    gameOverTimestamp = new Date();
    if (winnerText) winnerText.textContent = 'Game Over!';
    if (finalScoreText) finalScoreText.textContent = `Score: ${score}`;
    hidePongScreen();
    if (endScreen) {
        endScreen.style.display = 'block';
        endScreen.setAttribute('aria-hidden', 'false');
    }
    if (mainMenu) mainMenu.setAttribute('aria-hidden', 'true');

    pointerActive = false;
    keys.ArrowUp = false;
    keys.ArrowDown = false;
    if (scoreName) scoreName.value = '';
}

/* Screen switching helper */
function switchScreen(hideEl, showEl) {
    if (hideEl) {
        if (document.activeElement && hideEl.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        hideEl.style.display = 'none';
        hideEl.setAttribute('aria-hidden', 'true');
    }

    if (showEl) {
        showEl.style.display = 'block';
        showEl.setAttribute('aria-hidden', 'false');
        focusFirstFocusable(showEl);
    }
}

/* Leaderboard UI & helpers */
function clearConfirmBox() {
    const box = document.getElementById('confirmBox');
    if (box) {
        box.style.display = 'none';
        box.innerHTML = '';
    }
    const existing = document.querySelector('.confirm-box');
    if (existing) existing.remove();
}

function renderLeaderboard() {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '';

    const leaderboard = getLeaderboard().slice().sort((a, b) => b.score - a.score);

    const existing = document.getElementById("leaderboardEmpty");
    if (existing) existing.remove();

    if (leaderboard.length === 0) {
        leaderboardList.style.display = "none";
        const emptyMsg = document.createElement("div");
        emptyMsg.id = "leaderboardEmpty";
        emptyMsg.textContent = "No scores yet!";
        emptyMsg.classList.add("leaderboard-empty");
        if (leaderboardScreen) leaderboardScreen.insertBefore(emptyMsg, leaderboardList.nextSibling);
        return;
    } else {
        leaderboardList.style.display = "block";
    }

    leaderboard.forEach((entry, index) => {
        const li = document.createElement('li');
        li.classList.add('leaderboard-item');
        li.setAttribute('role', 'listitem');
        li.setAttribute('tabindex', '-1');
        if (entry.id !== undefined && entry.id !== null) li.setAttribute('data-id', String(entry.id));

        const descId = `leaderboard-desc-${entry.id !== undefined && entry.id !== null ? entry.id : index}`;

        const rank = document.createElement('span');
        rank.classList.add('rank');
        rank.textContent = (index + 1) + '.';

        const nameScore = document.createElement('span');
        nameScore.classList.add('name-score');
        nameScore.textContent = `${entry.name} - Score: ${entry.score}`;
        nameScore.setAttribute('aria-label', `${entry.name}, score ${entry.score}`);

        const desc = document.createElement('span');
        desc.id = descId;
        desc.className = 'visually-hidden';
        desc.textContent = `Rank ${index + 1}. ${entry.name}, score ${entry.score}`;

        li.appendChild(rank);
        li.appendChild(nameScore);
        li.appendChild(desc);

        li.setAttribute('aria-describedby', descId);

        const removeBtn = document.createElement('button');
        removeBtn.classList.add('remove-btn');
        removeBtn.textContent = 'X';
        removeBtn.setAttribute('aria-label', `Remove ${entry.name}'s score`);
        removeBtn.addEventListener('click', () => confirmRemove(entry.id, entry.name));
        removeBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); confirmRemove(entry.id, entry.name); } });

        li.appendChild(removeBtn);
        leaderboardList.appendChild(li);
    });
}

function confirmRemove(id, name) {
    showConfirmBox(name, () => {
        const data = getLeaderboard();
        const idx = data.findIndex(e => e.id === id);
        if (idx !== -1) {
            data.splice(idx, 1);
            saveLeaderboard(data);
            renderLeaderboard();
        }
    });
}

function showConfirmBox(name, onConfirm) {
    const box = document.getElementById('confirmBox');
    if (!box) return;

    box.innerHTML = '';

    const p = document.createElement('p');
    p.textContent = `Remove ${name}'s score?`;
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-modal', 'true');

    const actions = document.createElement('div');
    actions.className = 'popup-actions';

    const yesBtn = document.createElement('button');
    yesBtn.textContent = 'Yes';
    yesBtn.onclick = () => {
        box.style.display = 'none';
        onConfirm();
    };

    const noBtn = document.createElement('button');
    noBtn.textContent = 'No';
    noBtn.onclick = () => box.style.display = 'none';

    actions.appendChild(yesBtn);
    actions.appendChild(noBtn);
    box.appendChild(p);
    box.appendChild(actions);

    box.style.display = 'flex';
    yesBtn.focus();
}

/* Timestamp helper */
function getTimestamp(date = new Date()) {
    const d = date;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}-${String(d.getSeconds()).padStart(2, '0')}`;
}

/* Buttons UI interactions */
if (startBtn) {
    startBtn.addEventListener('click', () => {
        switchScreen(mainMenu, document.getElementById('pongSurvival'));
        if (endScreen) endScreen.style.display = 'none';
        if (leaderboardScreen) leaderboardScreen.style.display = 'none';
        showPongScreen();
    });
}

if (mainMenuLeaderboardBtn) {
    mainMenuLeaderboardBtn.addEventListener('click', () => {
        switchScreen(mainMenu, leaderboardScreen);
        renderLeaderboard();
        if (scoreName) scoreName.value = '';
    });
}

if (restartBtn) {
    restartBtn.addEventListener('click', () => {
        switchScreen(endScreen, document.getElementById('pongSurvival'));
        showPongScreen();
        if (scoreName) scoreName.value = '';
    });
}

if (mainMenuBtn) {
    mainMenuBtn.addEventListener('click', () => {
        hidePongScreen();
        switchScreen(endScreen, mainMenu);
        if (leaderboardScreen) leaderboardScreen.style.display = 'none';
        clearConfirmBox();
        if (scoreName) scoreName.value = '';
    });
}

if (endLeaderboardBtn) {
    endLeaderboardBtn.addEventListener('click', () => {
        switchScreen(endScreen, leaderboardScreen);
        renderLeaderboard();
    });
}

if (downloadScoreBtn) {
    downloadScoreBtn.addEventListener('click', () => {
        const ts = getTimestamp(gameOverTimestamp);
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width * EXPORT_SCALE;
        exportCanvas.height = canvas.height * EXPORT_SCALE;
        const exportCtx = exportCanvas.getContext('2d');
        exportCtx.drawImage(
            canvas,
            0, 0, canvas.width, canvas.height,
            0, 0, exportCanvas.width, exportCanvas.height
        );
        const scoreFontSize = 28 * EXPORT_SCALE;
        exportCtx.fillStyle = 'white';
        exportCtx.font = `${scoreFontSize}px 'BoldPixels', monospace, Arial, sans-serif`;
        exportCtx.textAlign = 'center';
        exportCtx.textBaseline = 'top';
        const scoreX = exportCanvas.width / 2;
        const scoreY = 15 * SCALE_Y * EXPORT_SCALE;
        exportCtx.fillText(`Score: ${score}`, scoreX, scoreY);
        const link = document.createElement('a');
        link.download = `pong_survival_result_${ts}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    });
}

if (downloadLeaderboardBtn) {
    downloadLeaderboardBtn.addEventListener('click', () => {
        const ts = getTimestamp();
        const data = getLeaderboard().sort((a, b) => b.score - a.score);
        const text = 'Pong Survival Leaderboard\n\n' + data.map((e, i) => `${i + 1}. ${e.name} - Score: ${e.score}`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `pong_survival_leaderboard_${ts}.txt`;
        link.click();
    });
}

if (backToMainMenuBtn) {
    backToMainMenuBtn.addEventListener('click', () => {
        switchScreen(leaderboardScreen, mainMenu);
        clearConfirmBox();
        if (scoreName) scoreName.value = '';
    });
}

if (showTrajectoryBtn) {
    showTrajectoryBtn.addEventListener('click', () => {
        switchScreen(endScreen, trajectoryScreen);
        drawTrajectoryOnCanvas();
    });
}

if (downloadTrajectoryJsonBtn) {
    downloadTrajectoryJsonBtn.addEventListener('click', () => {
        const ts = getTimestamp(gameOverTimestamp);
        const blob = new Blob([JSON.stringify(trajectory, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `pong_survival_trajectory_${ts}.json`;
        link.click();
    });
}

if (downloadTrajectoryPngBtn) {
    downloadTrajectoryPngBtn.addEventListener('click', () => {
        const ts = getTimestamp(gameOverTimestamp);
        if (!trajectoryCanvas) return;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width * EXPORT_SCALE;
        exportCanvas.height = canvas.height * EXPORT_SCALE;
        const exportCtx = exportCanvas.getContext('2d');
        exportCtx.fillStyle = 'black';
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        exportCtx.drawImage(
            trajectoryCanvas,
            0, 0, trajectoryCanvas.width, trajectoryCanvas.height,
            0, 0, exportCanvas.width, exportCanvas.height
        );
        exportCanvas.toBlob(blob => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `pong_survival_trajectory_${ts}.png`;
            link.click();
        }, "image/png");
    });
}

if (backToEndBtn) {
    backToEndBtn.addEventListener('click', () => {
        switchScreen(trajectoryScreen, endScreen);
    });
}

if (trajectoryMainMenuBtn) {
    trajectoryMainMenuBtn.addEventListener('click', () => {
        switchScreen(trajectoryScreen, mainMenu);
    });
}

/* Glyph input & validation */
const fontRegex = /[A-Za-z0-9!"#$%&'()*+,\-./:;<=>?@[\\\]^_{|}~ ]/g;
if (scoreName) scoreName.setAttribute('maxlength', '32');

if (scoreName) {
    scoreName.addEventListener('input', e => {
        let value = scoreName.value;
        const filtered = value.match(fontRegex)?.join('') || '';
        if (filtered !== value) {
            scoreName.value = filtered;
            showCharPopup('Character not supported!');
            return;
        }
        if (filtered.length >= 32) {
            showCharPopup('Maximum 32 characters!');
        }
    });
}

function showCharPopup(msg, inputRowWidth) {
    if (!charPopup) return;
    if (charPopup.timeout) clearTimeout(charPopup.timeout);
    charPopup.textContent = msg;
    charPopup.style.display = 'flex';
    if (inputRowWidth) charPopup.style.maxWidth = inputRowWidth + 'px';

    charPopup.timeout = setTimeout(() => {
        charPopup.style.display = 'none';
        charPopup.textContent = '';
    }, 1500);
}

/* Save score */
if (saveScoreBtn) {
    saveScoreBtn.addEventListener('click', () => {
        if (scoreSaved) return;

        let name = (scoreName?.value || '').trim();
        if (!name) {
            showCharPopup('Character not supported!');
            return;
        }

        const data = getLeaderboard();
        data.push({ id: crypto.randomUUID(), timestamp: Date.now(), name, score });
        saveLeaderboard(data);
        renderLeaderboard();

        if (inputRow) inputRow.style.display = 'none';

        showCharPopup('Score saved to leaderboard!');
        scoreSaved = true;
    });
}

/* Show/hide Pong screen */
function showPongScreen() {
    const pong = document.getElementById('pongSurvival');
    if (pong) pong.style.display = 'block';
    if (scoreOverlay) scoreOverlay.style.display = 'block';
    if (oopsOverlay) oopsOverlay.style.display = 'none';
    initGame();
    lastTime = null;
    accumulatedTime = 0;
    requestAnimationFrame(gameLoop);
    if (mainMenu) mainMenu.setAttribute('aria-hidden', 'true');
    if (endScreen) endScreen.setAttribute('aria-hidden', 'true');
}

function hidePongScreen() {
    const pong = document.getElementById('pongSurvival');
    if (pong) pong.style.display = 'none';
    if (scoreOverlay) scoreOverlay.style.display = 'none';
    if (oopsOverlay) oopsOverlay.style.display = 'none';
}

/* Initial visibility & accessibility */
if (mainMenu) {
    mainMenu.style.display = 'block';
    mainMenu.setAttribute('role', 'region');
    mainMenu.setAttribute('aria-label', 'Main Menu');
    mainMenu.setAttribute('aria-hidden', 'false');
}
if (endScreen) {
    endScreen.style.display = 'none';
    endScreen.setAttribute('role', 'region');
    endScreen.setAttribute('aria-label', 'End Screen');
    endScreen.setAttribute('aria-hidden', 'true');
}
if (leaderboardScreen) {
    leaderboardScreen.style.display = 'none';
    leaderboardScreen.setAttribute('role', 'region');
    leaderboardScreen.setAttribute('aria-label', 'Leaderboard Screen');
    leaderboardScreen.setAttribute('aria-hidden', 'true');
}
if (scoreOverlay) {
    scoreOverlay.setAttribute('role', 'status');
    scoreOverlay.setAttribute('aria-live', 'polite');
}
if (oopsOverlay) {
    oopsOverlay.setAttribute('role', 'alert');
    oopsOverlay.setAttribute('aria-live', 'assertive');
}
if (charPopup) {
    charPopup.setAttribute('role', 'alert');
    charPopup.setAttribute('aria-live', 'assertive');
}
if (leaderboardList) {
    leaderboardList.setAttribute('role', 'list');
}

/* Additional accessibility helpers */
function focusFirstFocusable(container) {
    if (!container) return;
    const selectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const el = container.querySelector(selectors);
    if (el && typeof el.focus === 'function') el.focus();
}

/* Initial rendering and accessibility setup */
renderLeaderboard();
addAccessibility();

/* Guarded accessibility attributes */
function addAccessibility() {
    if (startBtn) startBtn.setAttribute('aria-label', 'Start Game');
    if (mainMenuLeaderboardBtn) mainMenuLeaderboardBtn.setAttribute('aria-label', 'Show Leaderboard from Main Menu');
    if (restartBtn) restartBtn.setAttribute('aria-label', 'Restart Game');
    if (downloadScoreBtn) downloadScoreBtn.setAttribute('aria-label', 'Download Game Screenshot');
    if (endLeaderboardBtn) endLeaderboardBtn.setAttribute('aria-label', 'Show Leaderboard from End Screen');
    if (mainMenuBtn) mainMenuBtn.setAttribute('aria-label', 'Return to Main Menu');
    if (downloadLeaderboardBtn) downloadLeaderboardBtn.setAttribute('aria-label', 'Download Leaderboard');
    if (backToMainMenuBtn) backToMainMenuBtn.setAttribute('aria-label', 'Return to Main Menu from Leaderboard');
    if (saveScoreBtn) saveScoreBtn.setAttribute('aria-label', 'Save Score');
    if (showTrajectoryBtn) showTrajectoryBtn.setAttribute('aria-label', 'Show Trajectory');
    if (downloadTrajectoryPngBtn) downloadTrajectoryPngBtn.setAttribute('aria-label', 'Download Trajectory PNG');
    if (downloadTrajectoryJsonBtn) downloadTrajectoryJsonBtn.setAttribute('aria-label', 'Download Trajectory JSON');
    if (trajectoryMainMenuBtn) trajectoryMainMenuBtn.setAttribute('aria-label', 'Return to Main Menu from Trajectory');
    if (backToEndBtn) backToEndBtn.setAttribute('aria-label', 'Return to End Screen from Trajectory');

    const confirmBox = document.getElementById('confirmBox');
    if (confirmBox) {
        confirmBox.setAttribute('role', 'dialog');
        confirmBox.setAttribute('aria-modal', 'true');
    }
}
