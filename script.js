const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score');
const gameOverEl = document.getElementById('game-over');
const restartBtn = document.getElementById('restart-btn');

context.scale(20, 20);

const arena = createMatrix(12, 20);
let score = 0;
let gameOver = false;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

// DAS (Delayed Auto Shift) key repeat
const keysDown = {};
const DAS_DELAY = 170;    // m before auto-repeat starts
const DAS_INTERVAL = 50;  // ms between repeats

function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) continue outer;
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;      // re-check same position after shift
        rowCount++;
    }
    if (rowCount > 0) {
        const scoreTable = [0, 100, 300, 500, 800];
        score += scoreTable[rowCount] || 0;
        updateScore();
    }
}

function createPiece(type) {
    if (type === 'I') return [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]];
    else if (type === 'L') return [[0, 2, 0], [0, 2, 0], [0, 2, 2]];
    else if (type === 'J') return [[0, 3, 0], [0, 3, 0], [3, 3, 0]];
    else if (type === 'O') return [[4, 4], [4, 4]];
    else if (type === 'Z') return [[5, 5, 0], [0, 5, 5], [0, 0, 0]];
    else if (type === 'S') return [[0, 6, 6], [6, 6, 0], [0, 0, 0]];
    else if (type === 'T') return [[0, 7, 0], [7, 7, 7], [0, 0, 0]];
}

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

const colors = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'];

function collide(arena, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
                (arena[y + o.y] === undefined || arena[y + o.y][x + o.x] === undefined || arena[y + o.y][x + o.x] !== 0)
            ) {
                return true;
            }
        }
    }
    return false;
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, {x: 0, y: 0});
    if (!gameOver) drawMatrix(player.matrix, player.pos);
}

function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = colors[value];
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function playerReset() {
    const pieces = 'ILJOTSZ';
    player.matrix = createPiece(pieces[pieces.length * Math.random() | 0]);
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    
    if (collide(arena, player)) {
        gameOver = true;
        finalScoreEl.textContent = score;
        gameOverEl.classList.remove('hidden');
        return false;
    }
    return true;
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        arenaSweep();
        if (!playerReset()) return;  // game over on spawn
    }
    dropCounter = 0;
    
    // DAS: auto-repeat for soft drop
    const currentDropDelay = keysDown['ArrowDown'] ? DAS_INTERVAL : dropInterval;
    if (dropCounter >= currentDropDelay) {
        player.pos.y++;
        if (!collide(arena, player)) {
            draw();  // render mid-drop for smooth feel
        } else {
            player.pos.y--;
        }
        dropCounter = 0;
    }
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    }
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

function playerHardDrop() {
    while (!collide(arena, player)) {
        player.pos.y++;
        score += 2; // 2 points per cell hard-dropped (classic Tetris rule)
    }
    player.pos.y--;
    merge(arena, player);
    arenaSweep();
    if (!playerReset()) return;
    dropCounter = 0;
}

function updateScore() {
    scoreEl.textContent = score;
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    if (dir > 0) matrix.forEach(row => row.reverse());
    else matrix.reverse();
}

function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;
    
    dropCounter += deltaTime;
    if (dropCounter >= dropInterval) {
        playerDrop();
    }
    
    // DAS: auto-move with held arrow keys
    if (keysDown['ArrowLeft']) {
        const elapsed = dropCounter;
        if (elapsed > DAS_DELAY || (keysDown['_d_left'] && elapsed % DAS_INTERVAL < deltaTime)) {
            keysDown['_d_left'] = true;
            playerMove(-1);
        }
    } else {
        keysDown['_d_left'] = false;
    }
    
    if (keysDown['ArrowRight']) {
        const elapsed = dropCounter;
        if (elapsed > DAS_DELAY || (keysDown['_d_right'] && elapsed % DAS_INTERVAL < deltaTime)) {
            keysDown['_d_right'] = true;
            playerMove(1);
        }
    } else {
        keysDown['_d_right'] = false;
    }
    
    draw();
    requestAnimationFrame(update);
}

const player = {
    pos: {x: 0, y: 0},
    matrix: null,
};

keysDown['_d_left'] = false;
keysDown['_d_right'] = false;

document.addEventListener('keydown', event => {
    if (gameOver) return;
    
    // Track key state for DAS
    keysDown[event.key] = true;
    let moved = false;
    
    if (event.key === 'ArrowLeft') {
        playerMove(-1);
        moved = true;
    } else if (event.key === 'ArrowRight') {
        playerMove(1);
        moved = true;
    } else if (event.key === 'ArrowDown') {
        playerDrop();
    } else if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        playerRotate(1);
    } else if (event.key === 'z' || event.key === 'Z') {
        playerHardDrop();
        moved = false; // hard drop already handled in real-time
    }
    
    event.preventDefault();
});

document.addEventListener('keyup', event => {
    delete keysDown[event.key];
    if (event.key === 'ArrowLeft') keysDown['_d_left'] = false;
    if (event.key === 'ArrowRight') keysDown['_d_right'] = false;
});

function restartGame() {
    arena.forEach(row => row.fill(0));
    score = 0;
    gameOver = false;
    dropCounter = 0;
    lastTime = 0;
    updateScore();
    gameOverEl.classList.add('hidden');
    playerReset();
}

restartBtn.addEventListener('click', restartGame);

playerReset();
updateScore();
update();
