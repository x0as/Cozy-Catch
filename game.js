const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const menuScreen = document.getElementById('menuScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const hud = document.getElementById('hud');
const pauseScreen = document.getElementById('pauseScreen');
const infoScreen = document.getElementById('infoScreen');
const objectiveScreen = document.getElementById('objectiveScreen');
const toast = document.getElementById('toast');

const scoreValue = document.getElementById('scoreValue');
const bestValue = document.getElementById('bestValue');
const healthValue = document.getElementById('healthValue');
const finalScore = document.getElementById('finalScore');
const highScore = document.getElementById('highScore');
const moveControls = document.getElementById('moveControls');

const art = {
    apple: new Image(),
    leaf: new Image(),
    tree: new Image(),
    bucket: new Image(),
    squirrel: new Image(),
    root: new Image()
};

art.apple.src = 'apple.png';
art.leaf.src = 'leaf.png';
art.tree.src = 'tree.png';
art.bucket.src = 'bucket.png';
art.squirrel.src = 'squirrel.png';
art.root.src = 'root.png';

const GRID_SIZE = 6;
const OBJECTIVE_HOLD_MS = 2400;
const OBJECTIVE_FADE_MS = 1300;

const tileTypes = [
    {
        type: 'apple',
        glyph: '●',
        color: '#c95335',
        accent: '#f2c4a0',
        points: 1,
        weight: 55,
        speed: 1
    },
    {
        type: 'leaf',
        glyph: '◆',
        color: '#708252',
        accent: '#c9d09c',
        points: 2,
        weight: 45,
        speed: 0.88
    }
];

const state = {
    mode: 'menu',
    score: 0,
    health: 15,
    reveal: 1,
    best: Number(localStorage.getItem('cozyCatchBest') || 0),

    objects: [],
    particles: [],

    squirrel: {
        active: false,
        progress: 0,
        direction: 1,
        timeLeft: 0,
        stole: false
    },

    nextSquirrelScore: 20,

    player: {
        col: 2,
        row: 5,
        visualCol: 2,
        visualRow: 5,
        jump: 0
    },

    spawnTimer: 0,
    elapsed: 0,
    lastTime: 0,
    shake: 0
};

let layout = {
    cx: 0,
    horizon: 0,
    tileW: 80,
    tileH: 30,
    depth: 50
};

function resize() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;

    ctx.setTransform(
        devicePixelRatio,
        0,
        0,
        devicePixelRatio,
        0,
        0
    );

    calculateLayout();
}

function calculateLayout() {
    const width = innerWidth;
    const height = innerHeight;

    const floorWidth = Math.min(
        width * 0.74,
        height * 1.04,
        820
    );

    layout = {
        cx: width * 0.5,
        horizon: height * 0.43,
        tileW: floorWidth / 6,
        tileH: Math.max(26, floorWidth / 15),
        depth: Math.max(48, floorWidth / 7.5)
    };
}

function project(col, row, z = 0) {
    return {
        x: layout.cx + (col - row) * layout.tileW / 2,
        y: layout.horizon +
            (col + row) * layout.tileH / 2 -
            z * layout.depth
    };
}

function tileCenter(col, row) {
    return project(col + 0.5, row + 0.5);
}

function startGame() {
    state.mode = 'playing';
    state.score = 0;
    state.health = 15;
    state.reveal = 0;

    state.objects = [];
    state.particles = [];

    state.squirrel.active = false;
    state.squirrel.progress = 0;
    state.squirrel.direction = 1;
    state.squirrel.timeLeft = 0;
    state.squirrel.stole = false;

    state.nextSquirrelScore = 20;
    state.elapsed = 0;
    state.spawnTimer = 1.25;

    state.player.col = 2;
    state.player.row = 5;
    state.player.visualCol = 2;
    state.player.visualRow = 5;
    state.player.jump = 0;

    menuScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');

    hud.classList.remove('hidden');
    moveControls.classList.remove('hidden');

    updateHud();
}

function beginRun() {
    state.mode = 'intro';
    state.shake = 0;

    menuScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.add('hidden');
    moveControls.classList.add('hidden');
    pauseScreen.classList.add('hidden');

    objectiveScreen.classList.remove('hidden');
    objectiveScreen.classList.remove('show');
    objectiveScreen.classList.remove('fading');

    void objectiveScreen.offsetWidth;
    objectiveScreen.classList.add('show');

    setTimeout(() => {
        objectiveScreen.classList.add('fading');

        setTimeout(() => {
            objectiveScreen.classList.add('hidden');
            objectiveScreen.classList.remove('show');
            objectiveScreen.classList.remove('fading');
            startGame();
        }, OBJECTIVE_FADE_MS);
    }, OBJECTIVE_HOLD_MS);
}

function endGame() {
    state.mode = 'over';

    state.best = Math.max(state.best, state.score);
    localStorage.setItem('cozyCatchBest', state.best);

    finalScore.textContent = state.score;
    highScore.textContent = state.best;

    pauseScreen.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    hud.classList.add('hidden');
    moveControls.classList.add('hidden');
}

function togglePause() {
    if (state.mode === 'playing') {
        state.mode = 'paused';
        pauseScreen.classList.remove('hidden');
    } else if (state.mode === 'paused') {
        state.mode = 'playing';
        pauseScreen.classList.add('hidden');
        state.lastTime = performance.now();
    }
}

function updateHud() {
    scoreValue.textContent = state.score;
    bestValue.textContent = state.best;
    healthValue.textContent = state.health + '%';
}

function chooseType() {
    const total = tileTypes.reduce(
        (sum, item) => sum + item.weight,
        0
    );

    let pick = Math.random() * total;

    for (const item of tileTypes) {
        pick -= item.weight;

        if (pick < 0) {
            return item;
        }
    }

    return tileTypes[0];
}

function spawnObject() {
    const type = chooseType();

    const col = Math.floor(Math.random() * GRID_SIZE);
    const row = Math.floor(Math.random() * GRID_SIZE);

    let landingTime =
        state.elapsed +
        3.75 +
        Math.random() * 0.35;

    if (!state.squirrel.active) {
        while (
            state.objects.some(
                object =>
                    Math.abs(object.landingTime - landingTime) < 0.8
            )
        ) {
            landingTime += 0.85;
        }
    }

    state.objects.push({
        type,
        col,
        row,
        z: 2.55,
        landingTime,
        delay: landingTime - state.elapsed - 3.25,
        sourceX: -46 + Math.random() * 92,
        sourceY: -216 + Math.random() * 72,
        wobble: Math.random() * 7,
        landed: false
    });
}

function spawnInterval() {
    return Math.max(
        0.6,
        (1.8 - state.score * 0.008 - state.elapsed * 0.0015) /
        (1 + Math.max(0, state.health - 100) / 250)
    );
}

function movePlayer(columnDelta, rowDelta) {
    if (state.mode !== 'playing') {
        return;
    }

    const nextCol = Math.max(
        0,
        Math.min(
            GRID_SIZE - 1,
            state.player.col + columnDelta
        )
    );

    const nextRow = Math.max(
        0,
        Math.min(
            GRID_SIZE - 1,
            state.player.row + rowDelta
        )
    );

    if (
        nextCol === state.player.col &&
        nextRow === state.player.row
    ) {
        return;
    }

    const takeoff = tileCenter(
        state.player.col,
        state.player.row
    );

    state.player.col = nextCol;
    state.player.row = nextRow;
    state.player.jump = 1;

    burst(
        takeoff.x,
        takeoff.y + 7,
        'rgba(255, 238, 190, .8)',
        5
    );
}

function startSquirrel() {
    if (
        state.squirrel.active ||
        state.score < state.nextSquirrelScore
    ) {
        return;
    }

    state.squirrel.active = true;
    state.squirrel.progress = 0;
    state.squirrel.direction = 1;
    state.squirrel.timeLeft = 8;
    state.squirrel.stole = false;

    state.nextSquirrelScore += 20;

    showToast(
        '⚠ stop the evil squirrel!',
        true
    );
}

function catchObject(object) {
    const center = tileCenter(
        object.col,
        object.row
    );

    state.score += object.type.points;
    state.health += object.type.points * 5;

    state.best = Math.max(
        state.best,
        state.score
    );

    localStorage.setItem(
        'cozyCatchBest',
        state.best
    );

    burst(
        center.x,
        center.y - 20,
        object.type.color,
        10
    );

    if (object.type.points > 1) {
        showToast('+ leaf!');
    } else {
        showToast('+1 apple!');
    }

    updateHud();

    if (
        state.score >= state.nextSquirrelScore &&
        !state.squirrel.active
    ) {
        startSquirrel();
    }
}

function missObject(object) {
    const center = tileCenter(
        object.col,
        object.row
    );

    burst(
        center.x,
        center.y,
        '#a75e3f',
        8
    );

    state.health = Math.max(
        0,
        state.health - 10
    );

    state.shake = 0.2;

    showToast('missed it');

    updateHud();

    if (state.health <= 0) {
        endGame();
    }
}

function showToast(text, warn = false) {
    toast.textContent = text;
    toast.classList.toggle('warn', warn);
    toast.classList.remove('show');

    void toast.offsetWidth;

    toast.classList.add('show');
}

function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        state.particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 100,
            vy: (Math.random() - 0.8) * 90,
            life: 0.55 + Math.random() * 0.35,
            max: 0.8,
            color,
            size: 2 + Math.random() * 3
        });
    }
}

function update(dt) {
    if (state.mode !== 'playing') {
        return;
    }

    state.elapsed += dt;

    state.player.visualCol +=
        (state.player.col - state.player.visualCol) *
        Math.min(1, dt * 13);

    state.player.visualRow +=
        (state.player.row - state.player.visualRow) *
        Math.min(1, dt * 13);

    state.player.jump = Math.max(
        0,
        state.player.jump - dt * 4.8
    );

    if (
        state.score >= state.nextSquirrelScore &&
        !state.squirrel.active
    ) {
        startSquirrel();
    }

    if (state.squirrel.active) {
        state.squirrel.timeLeft -= dt;
        state.squirrel.progress += dt * 0.5;

        while (state.squirrel.progress >= 1) {
            state.squirrel.progress -= 1;
            state.squirrel.direction *= -1;
        }

        if (
            !state.squirrel.stole &&
            state.squirrel.timeLeft < 4
        ) {
            state.squirrel.stole = true;
            state.health = Math.max(
                0,
                state.health - 5
            );

            state.shake = 0.25;
            showToast(
                'the squirrel stole some fruit!',
                true
            );

            updateHud();

            if (state.health <= 0) {
                endGame();
                return;
            }
        }

        if (state.squirrel.timeLeft <= 0) {
            state.squirrel.active = false;
            state.squirrel.progress = 0;
            showToast('squirrel escaped!');
        }
    }

    state.spawnTimer -= dt;

    if (state.spawnTimer <= 0) {
        spawnObject();

        state.spawnTimer = state.squirrel.active
            ? 1.1 + Math.random() * 0.3
            : spawnInterval();
    }

    state.objects.forEach(object => {
        if (object.delay > 0) {
            object.delay -= dt;
            return;
        }

        const squirrelBoost =
            state.squirrel.active ? 1.5 : 1;

        const healthBoost =
            1 + Math.max(0, state.health - 100) / 320;

        object.z -=
            dt *
            (0.58 +
                Math.min(state.score, 40) * 0.003 +
                Math.min(state.elapsed, 120) * 0.001) *
            object.type.speed *
            squirrelBoost *
            healthBoost;
    });

    for (
        let i = state.objects.length - 1;
        i >= 0;
        i--
    ) {
        const object = state.objects[i];

        if (object.z <= 0.08) {
            if (
                object.col === state.player.col &&
                object.row === state.player.row
            ) {
                catchObject(object);
            } else {
                missObject(object);
            }

            state.objects.splice(i, 1);

            if (state.mode !== 'playing') {
                break;
            }
        }
    }

    state.particles.forEach(particle => {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 130 * dt;
        particle.life -= dt;
    });

    state.particles = state.particles.filter(
        particle => particle.life > 0
    );

    state.shake = Math.max(
        0,
        state.shake - dt
    );

    state.reveal = Math.min(
        1,
        state.reveal + dt / 0.85
    );
}

function drawBackground(width, height) {
    const gradient = ctx.createLinearGradient(
        0,
        0,
        width,
        height
    );

    gradient.addColorStop(
        0,
        '#d7b783'
    );

    gradient.addColorStop(
        0.56,
        '#e8c990'
    );

    gradient.addColorStop(
        1,
        '#bd865d'
    );

    ctx.fillStyle = gradient;
    ctx.fillRect(
        0,
        0,
        width,
        height
    );

    ctx.fillStyle =
        'rgba(79, 104, 74, .16)';

    ctx.beginPath();
 
   
    ctx.fill();

    ctx.fillStyle =
        'rgba(255, 244, 211, .22)';

    ctx.beginPath();

    ctx.fill();

    ctx.fillStyle =
        'rgba(75, 61, 43, .16)';

    ctx.fillRect(
        0,
        height * 0.78,
        width,
        height * 0.22
    );
}

function treeBase() {
    return {
        x: layout.cx,
        y: layout.horizon + 28
    };
}

function drawGrid() {
    const left = project(0, 0);
    const top = project(6, 0);
    const right = project(6, 6);
    const bottom = project(0, 6);

    ctx.save();

    ctx.shadowColor =
        'rgba(74, 47, 31, .28)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 20;

    ctx.fillStyle = '#8b583c';

    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const a = project(col, row);
            const b = project(col + 1, row);
            const c = project(col + 1, row + 1);
            const d = project(col, row + 1);

            ctx.fillStyle =
                (row + col) % 2
                    ? '#a46a43'
                    : '#9a603e';

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(c.x, c.y);
            ctx.lineTo(d.x, d.y);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle =
                'rgba(70, 43, 29, .25)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    ctx.strokeStyle =
        'rgba(73, 47, 33, .35)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.closePath();
    ctx.stroke();
}

function drawIndicator(object) {
    const center = tileCenter(
        object.col,
        object.row
    );

    const danger = Math.min(
        1,
        Math.max(
            0,
            1 - object.z / 2.55
        )
    );

    const radius = 7 + danger * 25;

    const color = `rgb(
        ${Math.round(180 + danger * 48)},
        ${Math.round(163 - danger * 120)},
        ${Math.round(116 - danger * 91)}
    )`;

    ctx.save();

    ctx.translate(
        center.x,
        center.y + 4
    );

    ctx.scale(1, 0.42);

    ctx.beginPath();
    ctx.arc(
        0,
        0,
        radius,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        `rgba(255, 215, 145, ${0.08 + danger * 0.2})`;
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2 + danger * 2;
    ctx.setLineDash([2, 5]);
    ctx.lineDashOffset =
        -state.elapsed * 18;
    ctx.stroke();

    ctx.restore();
}

function drawObject(object) {
    const target = project(
        object.col + 0.5,
        object.row + 0.5,
        object.z
    );

    const source = treeBase();

    const progress = Math.min(
        1,
        Math.max(
            0,
            1 - object.z / 2.55
        )
    );

    const center = {
        x:
            source.x +
            object.sourceX +
            (target.x -
                source.x -
                object.sourceX) *
                progress,

        y:
            source.y +
            object.sourceY +
            (target.y -
                source.y -
                object.sourceY) *
                progress
    };

    const type = object.type;

    ctx.save();

    ctx.translate(
        center.x,
        center.y
    );

    ctx.rotate(
        Math.sin(
            state.elapsed * 2 +
            object.wobble
        ) * 0.08
    );

    ctx.shadowColor =
        'rgba(58, 39, 26, .3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 8;

    if (
        art[type.type].complete &&
        art[type.type].naturalWidth
    ) {
        const image = art[type.type];
        const size =
            type.type === 'apple'
                ? 50
                : 42;

        ctx.drawImage(
            image,
            -size / 2,
            -size / 2,
            size,
            size
        );
    } else if (type.type === 'apple') {
        ctx.fillStyle = type.color;

        ctx.beginPath();
        ctx.arc(
            0,
            0,
            20,
            0,
            Math.PI * 2
        );
        ctx.fill();

        ctx.fillStyle = type.accent;

        ctx.beginPath();

        ctx.fill();
    } else {
        ctx.fillStyle = type.color;

        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(15, 0);
        ctx.lineTo(0, 16);
        ctx.lineTo(-15, 0);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

function drawParticles() {
    state.particles.forEach(particle => {
        ctx.globalAlpha =
            Math.max(
                0,
                particle.life / particle.max
            );

        ctx.fillStyle = particle.color;

        ctx.fillRect(
            particle.x,
            particle.y,
            particle.size,
            particle.size
        );
    });

    ctx.globalAlpha = 1;
}

function drawBucket() {
    const center = tileCenter(
        state.player.visualCol,
        state.player.visualRow
    );

    const jumpHeight =
        Math.sin(
            state.player.jump * Math.PI
        ) * 24;

    ctx.save();

    ctx.translate(
        center.x,
        center.y - jumpHeight + 28
    );

    if (
        art.bucket.complete &&
        art.bucket.naturalWidth
    ) {
        ctx.imageSmoothingEnabled = false;

        const scale = 1.5;

        const bucketWidth =
            art.bucket.naturalWidth * scale;

        const bucketHeight =
            art.bucket.naturalHeight * scale;

        ctx.drawImage(
            art.bucket,
            -bucketWidth / 2,
            -bucketHeight,
            bucketWidth,
            bucketHeight
        );
    }

    ctx.restore();
}

function drawTree(width, height) {
    const base = treeBase();

    const sway = state.squirrel.active
        ? Math.sin(state.elapsed * 5) * 2
        : 0;

    ctx.save();

    ctx.translate(
        base.x + sway,
        base.y
    );

    if (
        art.tree.complete &&
        art.tree.naturalWidth
    ) {
        ctx.imageSmoothingEnabled = false;

        const scale = 6;

        const treeWidth =
            art.tree.naturalWidth * scale;

        const treeHeight =
            art.tree.naturalHeight * scale;

        ctx.drawImage(
            art.tree,
            -treeWidth / 2,
            -treeHeight,
            treeWidth,
            treeHeight
        );
    }

    if (
        state.squirrel.active &&
        art.squirrel.complete &&
        art.squirrel.naturalWidth
    ) {
        const squirrel = state.squirrel;

        const x =
            squirrel.direction === 1
                ? -125 + squirrel.progress * 250
                : 125 - squirrel.progress * 250;

        const y =
            -205 -
            Math.sin(
                squirrel.progress * Math.PI
            ) * 58;

        ctx.save();

        ctx.translate(x, y);
        ctx.scale(squirrel.direction, 1);
        ctx.imageSmoothingEnabled = false;

        ctx.drawImage(
            art.squirrel,
            -24,
            -18,
            48,
            36
        );

        ctx.restore();
    }

    ctx.restore();
}

function drawMenuScene() {
    const width = innerWidth;
    const height = innerHeight;
    const centerX = width * 0.72;

    const treeScale = Math.min(
        7,
        Math.max(5, height / 95)
    );

    const treeWidth =
        art.tree.naturalWidth * treeScale;

    const treeHeight =
        art.tree.naturalHeight * treeScale;

    ctx.save();

    if (
        art.tree.complete &&
        art.tree.naturalWidth
    ) {
        ctx.imageSmoothingEnabled = false;

        ctx.drawImage(
            art.tree,
            centerX - treeWidth / 2,
            height * 0.17,
            treeWidth,
            treeHeight
        );
    }

    if (
        art.bucket.complete &&
        art.bucket.naturalWidth
    ) {
        ctx.imageSmoothingEnabled = false;

        const bucketScale = Math.min(
            1.7,
            Math.max(1.35, height / 370)
        );

        const bucketWidth =
            art.bucket.naturalWidth *
            bucketScale;

        const bucketHeight =
            art.bucket.naturalHeight *
            bucketScale;

        ctx.drawImage(
            art.bucket,
            centerX - bucketWidth / 2,
            height * 0.57,
            bucketWidth,
            bucketHeight
        );
    }

    if (
        art.squirrel.complete &&
        art.squirrel.naturalWidth
    ) {
        ctx.imageSmoothingEnabled = false;

        ctx.drawImage(
            art.squirrel,
            centerX - 25,
            height * 0.12,
            50,
            38
        );
    }

    ctx.restore();
}

function drawRootCurve(x0, y0, cx, cy, x1, y1, scale = 0.42, seed = 0) {
    if (!art.root.complete || !art.root.naturalWidth) {
        return;
    }

    const dx = x1 - x0;
    const dy = y1 - y0;
    const distance = Math.hypot(dx, dy);
    const rootWidth = art.root.naturalWidth * scale;
    const step = Math.max(12, rootWidth * 0.62);
    const segments = Math.max(2, Math.ceil(distance / step));

    for (let i = 0; i < segments; i++) {
        const t = i / (segments - 1);
        const inverse = 1 - t;

        const px =
            inverse * inverse * x0 +
            2 * inverse * t * cx +
            t * t * x1;

        const py =
            inverse * inverse * y0 +
            2 * inverse * t * cy +
            t * t * y1;

        const tx =
            2 * inverse * (cx - x0) +
            2 * t * (x1 - cx);

        const ty =
            2 * inverse * (cy - y0) +
            2 * t * (y1 - cy);

        const angle = Math.atan2(ty, tx);
        const size = scale * (1 - t * 0.25);
        const width = art.root.naturalWidth * size;
        const height = art.root.naturalHeight * size;
        const offset = ((i + seed) % 3 - 1) * 0.8;

        ctx.save();
        ctx.translate(px, py + offset);
        ctx.rotate(angle);

        ctx.drawImage(
            art.root,
            -width * 0.5,
            -height * 0.5,
            width,
            height
        );

        ctx.restore();
    }
}

function drawRoots() {
    const base = treeBase();

    const healthFactor = Math.max(
        0,
        Math.min(1, state.health / 100)
    );

    const spread = 55 + healthFactor * 145;
    const depth = 35 + healthFactor * 70;

    // Ordered so the first couple of roots are the ones that show up
    // first (low health) and later entries only unlock as the tree
    // gets healthier, via each root's "appearAt" threshold below.
    const roots = [
        {
            side: -1,
            length: 1.0,
            curve: -0.28,
            y: 0,
            scale: 0.50,
            appearAt: 0
        },
        {
            side: 1,
            length: 1.0,
            curve: 0.28,
            y: 0,
            scale: 0.42,
            appearAt: 0
        },
        {
            side: -1,
            length: 0.78,
            curve: 0.22,
            y: 8,
            scale: 0.39,
            appearAt: 0.22
        },
        {
            side: 1,
            length: 0.78,
            curve: -0.22,
            y: 8,
            scale: 0.39,
            appearAt: 0.22
        },
        {
            side: -0.15,
            length: 0.72,
            curve: -0.12,
            y: 16,
            scale: 0.35,
            appearAt: 0.45
        },
        {
            side: 0.15,
            length: 0.72,
            curve: 0.12,
            y: 16,
            scale: 0.35,
            appearAt: 0.45
        },
        {
            side: -1,
            length: 0.52,
            curve: -0.4,
            y: 13,
            scale: 0.34,
            appearAt: 0.7
        },
        {
            side: 1,
            length: 0.52,
            curve: 0.4,
            y: 13,
            scale: 0.34,
            appearAt: 0.7
        }
    ];

    // How much "healthFactor room" a root takes to fade in once its
    // threshold is reached, so new roots ease in instead of popping.
    const FADE_WINDOW = 0.14;

    roots.forEach((root, index) => {
        if (healthFactor < root.appearAt) {
            return;
        }

        const growth = Math.min(
            1,
            (healthFactor - root.appearAt) / FADE_WINDOW
        );

        ctx.save();
        ctx.globalAlpha = growth;

        const direction = root.side < 0 ? -1 : 1;
        const length = spread * root.length * growth;

        const x0 =
            base.x +
            root.side * 13;

        const y0 =
            base.y +
            5 +
            root.y;

        const x1 =
            base.x +
            root.side * length;

        const y1 =
            y0 +
            depth * (0.55 + root.length * 0.3);

        const curve =
            length * root.curve;

        const cx =
            base.x +
            root.side * length * 0.48 +
            curve * direction;

        const cy =
            y0 +
            depth * 0.28;

    

        if (index < 6) {
            const branchT = 0.55;
            const inverse = 1 - branchT;

            const branchX =
                inverse * inverse * x0 +
                2 * inverse * branchT * cx +
                branchT * branchT * x1;

            const branchY =
                inverse * inverse * y0 +
                2 * inverse * branchT * cy +
                branchT * branchT * y1;

            const branchDirection =
                index % 2 === 0
                    ? -1
                    : 1;

            const branchLength =
                (28 +
                healthFactor * 42) *
                growth;

        
        }

        ctx.restore();
    });
}

function drawMiniTree() {
    if (
        state.mode !== 'playing' &&
        state.mode !== 'paused'
    ) {
        return;
    }

    if (
        !art.tree.complete ||
        !art.tree.naturalWidth
    ) {
        return;
    }

    const padding = 22;
    const topOffset = 96;
    const treeWidth = 0;

    const treeHeight =
        treeWidth *
        (
            art.tree.naturalHeight /
            art.tree.naturalWidth
        );

    const x =
        padding +
        treeWidth / 2;

    const y =
        topOffset +
        treeHeight;

    ctx.save();

    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
        art.tree,
        x - treeWidth / 2,
        topOffset,
        treeWidth,
        treeHeight
    );

    const healthFactor = Math.max(
        0,
        Math.min(1, state.health / 100)
    );

    const rootStart = y - 5;
    const rootSpread =
        0 +
        healthFactor * 35;

    ctx.restore();
}

function render() {
    const width = innerWidth;
    const height = innerHeight;

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    drawBackground(
        width,
        height
    );

    if (state.mode === 'menu') {
        drawMenuScene();
        return;
    }

    if (state.mode === 'intro') {
        return;
    }

    drawTree(
        width,
        height
    );

    ctx.save();

    if (
        state.mode === 'playing' &&
        state.shake
    ) {
        ctx.translate(
            (Math.random() - 0.5) *
                state.shake *
                18,
            (Math.random() - 0.5) *
                state.shake *
                10
        );
    }

    drawGrid();
    drawRoots();

    state.objects
        .slice()
        .sort((a, b) => b.z - a.z)
        .forEach(drawIndicator);

    state.objects
        .slice()
        .sort((a, b) => a.z - b.z)
        .forEach(drawObject);

    drawBucket();
    drawParticles();

    ctx.restore();

    drawMiniTree();

    if (state.reveal < 1) {
        ctx.save();

        ctx.fillStyle = '#e8c990';
        ctx.globalAlpha = 1 - state.reveal;

        ctx.fillRect(
            0,
            0,
            width,
            height
        );

        ctx.restore();
    }
}

function loop(time) {
    const dt = Math.min(
        0.04,
        (time - state.lastTime) / 1000 || 0
    );

    state.lastTime = time;

    update(dt);
    render();

    requestAnimationFrame(loop);
}


// Menu buttons

document
    .getElementById('playButton')
    .addEventListener('click', beginRun);

document
    .getElementById('againButton')
    .addEventListener('click', beginRun);

document
    .getElementById('menuButton')
    .addEventListener('click', () => {
        state.mode = 'menu';
        state.shake = 0;

        pauseScreen.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        hud.classList.add('hidden');
        moveControls.classList.add('hidden');

        if (infoScreen) {
            infoScreen.classList.add('hidden');
        }

        menuScreen.classList.remove('hidden');
    });

document
    .getElementById('resumeButton')
    .addEventListener('click', togglePause);

document
    .getElementById('pauseMenuButton')
    .addEventListener('click', () => {
        state.mode = 'menu';
        state.shake = 0;

        pauseScreen.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        hud.classList.add('hidden');
        moveControls.classList.add('hidden');

        if (infoScreen) {
            infoScreen.classList.add('hidden');
        }

        menuScreen.classList.remove('hidden');
    });

document
    .getElementById('pauseButton')
    .addEventListener('click', togglePause);


// Info

const infoBtn =
    document.getElementById('infoButton');

if (infoBtn) {
    infoBtn.addEventListener('click', () => {
        if (infoScreen) {
            infoScreen.classList.remove('hidden');
        }
    });
}

const infoCloseBtn =
    document.getElementById('infoCloseButton');

if (infoCloseBtn) {
    infoCloseBtn.addEventListener('click', () => {
        if (infoScreen) {
            infoScreen.classList.add('hidden');
        }
    });
}


// Movement buttons

document
    .getElementById('upButton')
    .addEventListener('click', () => {
        movePlayer(0, -1);
    });

document
    .getElementById('leftButton')
    .addEventListener('click', () => {
        movePlayer(-1, 0);
    });

document
    .getElementById('downButton')
    .addEventListener('click', () => {
        movePlayer(0, 1);
    });

document
    .getElementById('rightButton')
    .addEventListener('click', () => {
        movePlayer(1, 0);
    });


// Keyboard

window.addEventListener('keydown', event => {
    const movementKeys = [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD'
    ];

    const pauseKeys = [
        'KeyP',
        'Space',
        'Escape'
    ];

    if (
        movementKeys.includes(event.code) ||
        pauseKeys.includes(event.code)
    ) {
        event.preventDefault();
    }

    if (
        event.repeat &&
        pauseKeys.includes(event.code)
    ) {
        return;
    }

    if (
        event.code === 'ArrowUp' ||
        event.code === 'KeyW'
    ) {
        movePlayer(0, -1);
    }

    if (
        event.code === 'ArrowDown' ||
        event.code === 'KeyS'
    ) {
        movePlayer(0, 1);
    }

    if (
        event.code === 'ArrowLeft' ||
        event.code === 'KeyA'
    ) {
        movePlayer(-1, 0);
    }

    if (
        event.code === 'ArrowRight' ||
        event.code === 'KeyD'
    ) {
        movePlayer(1, 0);
    }

    if (
        event.code === 'KeyP' ||
        event.code === 'Space' ||
        event.code === 'Escape'
    ) {
        togglePause();
    }
});


// Swipe controls

let touchStartX = null;

canvas.addEventListener('pointerdown', event => {
    touchStartX = event.clientX;
});

canvas.addEventListener('pointerup', event => {
    if (touchStartX === null) {
        return;
    }

    const delta =
        event.clientX - touchStartX;

    if (Math.abs(delta) > 18) {
        movePlayer(
            delta > 0 ? 1 : -1,
            0
        );
    }

    touchStartX = null;
});

window.addEventListener('resize', resize);

resize();

bestValue.textContent = state.best;

requestAnimationFrame(loop);