(function() {
  const SIZE = 4;
  const STORAGE_KEY_STATE = 'web2048_state';
  const STORAGE_KEY_LEADERS = 'web2048_leaders';

  let board = createEmptyBoard();
  let score = 0;
  let best = 0;
  let gameOver = false;

  // для undo
  let prevState = null;

  let boardBgEl;
  let tilesLayerEl;
  let scoreEl;
  let bestEl;
  let mobileControlsEl;
  let modalGameOverEl;
  let leaderboardModalEl;
  let leadersBodyEl;
  let saveScoreBlockEl;
  let scoreSavedMsgEl;

  // для свайпов
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    boardBgEl = document.getElementById('board-background');
    tilesLayerEl = document.getElementById('tiles-layer');
    scoreEl = document.getElementById('score-value');
    bestEl = document.getElementById('best-value');
    mobileControlsEl = document.getElementById('mobile-controls');
    modalGameOverEl = document.getElementById('game-over-modal');
    leaderboardModalEl = document.getElementById('leaderboard-modal');
    leadersBodyEl = document.getElementById('leaders-body');
    saveScoreBlockEl = document.getElementById('save-score-block');
    scoreSavedMsgEl = document.getElementById('score-saved-msg');

    createBoardBackground();

    loadState();
    renderBoard();

    attachEvents();
  }

  function createEmptyBoard() {
    const arr = [];
    for (let i = 0; i < SIZE; i++) {
      const row = [];
      for (let j = 0; j < SIZE; j++) {
        row.push(0);
      }
      arr.push(row);
    }
    return arr;
  }

  function createBoardBackground() {
    // создаем 16 ячеек
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement('div');
      cell.className = 'board-cell';
      boardBgEl.appendChild(cell);
    }
  }

  function attachEvents() {
    document.getElementById('btn-new').addEventListener('click', () => {
      startNewGame();
    });

    document.getElementById('btn-undo').addEventListener('click', () => {
      undoMove();
    });

    document.getElementById('btn-leaderboard').addEventListener('click', () => {
      openLeaderboard();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      closeGameOverModal();
      startNewGame();
    });

    document.getElementById('btn-close-gameover').addEventListener('click', () => {
      closeGameOverModal();
    });

    document.getElementById('btn-close-leaders').addEventListener('click', () => {
      closeLeaderboard();
    });

    document.getElementById('btn-save-score').addEventListener('click', saveCurrentScore);

    // управление с клавиатуры
    document.addEventListener('keydown', handleKeyDown);

    // мобильные кнопки
    mobileControlsEl.addEventListener('click', function(e) {
      const btn = e.target.closest('.ctrl-btn');
      if (!btn) return;
      const dir = btn.getAttribute('data-dir');
      handleMove(dir);
    });

    // свайпы
    const gameContainer = document.getElementById('game-container');
    gameContainer.addEventListener('touchstart', function(e) {
      if (!e.touches || e.touches.length === 0) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, {passive: true});
    gameContainer.addEventListener('touchend', function(e) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const threshold = 25;

      if (absX < threshold && absY < threshold) return;

      if (absX > absY) {
        if (dx > 0) handleMove('right');
        else handleMove('left');
      } else {
        if (dy > 0) handleMove('down');
        else handleMove('up');
      }
    }, {passive: true});
  }

  function handleKeyDown(e) {
    if (leaderboardModalEl && !leaderboardModalEl.classList.contains('hidden')) {
      return;
    }
    if (modalGameOverEl && !modalGameOverEl.classList.contains('hidden')) {
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        handleMove('up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        handleMove('down');
        break;
      case 'ArrowLeft':
        e.preventDefault();
        handleMove('left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        handleMove('right');
        break;
    }
  }

  function startNewGame() {
    board = createEmptyBoard();
    score = 0;
    gameOver = false;
    prevState = null;

    spawnRandomTile();
    spawnRandomTile();
    maybeSpawnThirdStartTile();

    renderBoard();
    saveState();
    showMobileControls();
  }

  function maybeSpawnThirdStartTile() {
    // по условию: в начале игры 1–3 тайла
    // с вероятностью 40% добавим третий
    if (Math.random() < 0.4) {
      spawnRandomTile();
    }
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    if (!raw) {
      // если ничего нет — стартуем новую
      startNewGame();
      // best из лидеров
      best = getBestFromLeaders();
      updateScoreUI();
      return;
    }
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data.board)) {
        board = data.board;
      } else {
        board = createEmptyBoard();
      }
      score = typeof data.score === 'number' ? data.score : 0;
      best = typeof data.best === 'number' ? data.best : getBestFromLeaders();
      gameOver = !!data.gameOver;
      prevState = data.prevState ? data.prevState : null;

      if (gameOver) {
        showGameOverModal();
        hideMobileControls();
      } else {
        showMobileControls();
      }

      updateScoreUI();
    } catch (e) {
      startNewGame();
    }
  }

  function saveState() {
    const payload = {
      board: board,
      score: score,
      best: best,
      gameOver: gameOver,
      prevState: prevState
    };
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(payload));
  }

  function renderBoard() {
    // очистка слоя тайлов
    while (tilesLayerEl.firstChild) {
      tilesLayerEl.removeChild(tilesLayerEl.firstChild);
    }

    const gap = 12;
    const boardSize = tilesLayerEl.getBoundingClientRect().width;
    const cellSize = (boardSize - gap * 5) / 4;

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const value = board[r][c];
        if (value === 0) continue;

        const tile = document.createElement('div');
        const cls = ['tile', 'v' + value];
        tile.className = cls.join(' ');
        tile.textContent = String(value);

        const x = gap + c * (cellSize + gap);
        const y = gap + r * (cellSize + gap);

        tile.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        tile.style.width = cellSize + 'px';
        tile.style.height = cellSize + 'px';

        tilesLayerEl.appendChild(tile);
      }
    }

    updateScoreUI();
  }

  function updateScoreUI() {
    scoreEl.textContent = String(score);
    bestEl.textContent = String(best);
  }

  function spawnRandomTile() {
    const empty = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) {
          empty.push({r, c});
        }
      }
    }
    if (empty.length === 0) return;

    const countToSpawn = Math.random() < 0.4 ? 2 : 1; // 1-2 тайла
    for (let i = 0; i < countToSpawn; i++) {
      if (empty.length === 0) break;
      const idx = Math.floor(Math.random() * empty.length);
      const cell = empty.splice(idx, 1)[0];
      board[cell.r][cell.c] = Math.random() < 0.9 ? 2 : 4;
    }
  }

  function handleMove(direction) {
    if (gameOver) return;

    // сохраним предыдущее состояние для undo
    const before = {
      board: copyBoard(board),
      score: score
    };

    const moved = moveBoard(direction);

    if (!moved) {
      return;
    }

    spawnRandomTile();

    // проверка конца игры
    if (isGameOver(board)) {
      gameOver = true;
      showGameOverModal();
      hideMobileControls();
    }

    if (score > best) {
      best = score;
    }

    prevState = before;

    renderBoard();
    saveState();
  }

  function moveBoard(direction) {
    // вернем true, если что-то поменялось
    let moved = false;
    let newBoard = createEmptyBoard();
    let localScoreGain = 0;

    // для удобства: работаем как сдвиг влево, остальное — поворотами
    let working = copyBoard(board);

    if (direction === 'up') {
      working = rotateLeft(working);
    } else if (direction === 'right') {
      working = reverseRows(working);
    } else if (direction === 'down') {
      working = rotateRight(working);
    }

    for (let r = 0; r < SIZE; r++) {
      const row = working[r];
      const {newRow, gained, changed} = compressAndMergeRow(row);
      working[r] = newRow;
      localScoreGain += gained;
      if (changed) moved = true;
    }

    // возвращаем обратно ориентацию
    if (direction === 'up') {
      working = rotateRight(working);
    } else if (direction === 'right') {
      working = reverseRows(working);
    } else if (direction === 'down') {
      working = rotateLeft(working);
    }

    if (moved) {
      board = working;
      score += localScoreGain;
    }

    return moved;
  }

  function compressAndMergeRow(row) {
    // row: [4, 4, 4, 4] -> [16, 0, 0, 0]
    const filtered = row.filter(v => v !== 0);
    const res = [];
    let gained = 0;
    let i = 0;
    while (i < filtered.length) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        const sum = filtered[i] + filtered[i + 1];
        res.push(sum);
        gained += sum;
        i += 2;
      } else {
        res.push(filtered[i]);
        i += 1;
      }
    }
    while (res.length < SIZE) {
      res.push(0);
    }

    const changed = !arraysEqual(row, res);
    return {newRow: res, gained, changed};
  }

  function rotateLeft(mat) {
    const res = createEmptyBoard();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        res[SIZE - c - 1][r] = mat[r][c];
      }
    }
    return res;
  }

  function rotateRight(mat) {
    const res = createEmptyBoard();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        res[c][SIZE - r - 1] = mat[r][c];
      }
    }
    return res;
  }

  function reverseRows(mat) {
    const res = createEmptyBoard();
    for (let r = 0; r < SIZE; r++) {
      res[r] = mat[r].slice().reverse();
    }
    return res;
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function isGameOver(mat) {
    // если есть пустые — еще не конец
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (mat[r][c] === 0) return false;
      }
    }
    // проверка возможных слияний
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = mat[r][c];
        if (r + 1 < SIZE && mat[r + 1][c] === v) return false;
        if (c + 1 < SIZE && mat[r][c + 1] === v) return false;
      }
    }
    return true;
  }

  function copyBoard(src) {
    const out = [];
    for (let r = 0; r < SIZE; r++) {
      out.push(src[r].slice());
    }
    return out;
  }

  function showGameOverModal() {
    modalGameOverEl.classList.remove('hidden');
    modalGameOverEl.setAttribute('aria-hidden', 'false');
    // показать блок сохранения
    saveScoreBlockEl.classList.remove('hidden');
    scoreSavedMsgEl.classList.add('hidden');
    const input = document.getElementById('player-name');
    input.value = '';
    input.focus();
  }

  function closeGameOverModal() {
    modalGameOverEl.classList.add('hidden');
    modalGameOverEl.setAttribute('aria-hidden', 'true');
    // если игра окончена — оставим скрытыми моб. кнопки
  }

  function saveCurrentScore() {
    const input = document.getElementById('player-name');
    const name = input.value.trim() || 'Игрок';

    const leaders = readLeaders();
    const now = new Date();
    const entry = {
      name: name,
      score: score,
      date: now.toISOString()
    };
    leaders.push(entry);
    leaders.sort((a, b) => b.score - a.score);
    const top10 = leaders.slice(0, 10);
    localStorage.setItem(STORAGE_KEY_LEADERS, JSON.stringify(top10));

    // обновим best
    if (score > best) {
      best = score;
      updateScoreUI();
      saveState();
    }

    saveScoreBlockEl.classList.add('hidden');
    scoreSavedMsgEl.classList.remove('hidden');
  }

  function readLeaders() {
    const raw = localStorage.getItem(STORAGE_KEY_LEADERS);
    if (!raw) return [];
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
      return [];
    } catch (e) {
      return [];
    }
  }

  function getBestFromLeaders() {
    const leaders = readLeaders();
    if (leaders.length === 0) return 0;
    return Math.max.apply(null, leaders.map(l => l.score));
  }

  function openLeaderboard() {
    const leaders = readLeaders();
    // очистить tbody
    while (leadersBodyEl.firstChild) {
      leadersBodyEl.removeChild(leadersBodyEl.firstChild);
    }

    if (leaders.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.setAttribute('colspan', '4');
      td.textContent = 'Записей пока нет.';
      tr.appendChild(td);
      leadersBodyEl.appendChild(tr);
    } else {
      leaders.forEach((entry, idx) => {
        const tr = document.createElement('tr');

        const tdIdx = document.createElement('td');
        tdIdx.textContent = String(idx + 1);
        tr.appendChild(tdIdx);

        const tdName = document.createElement('td');
        tdName.textContent = entry.name;
        tr.appendChild(tdName);

        const tdScore = document.createElement('td');
        tdScore.textContent = String(entry.score);
        tr.appendChild(tdScore);

        const tdDate = document.createElement('td');
        tdDate.textContent = formatDate(entry.date);
        tr.appendChild(tdDate);

        leadersBodyEl.appendChild(tr);
      });
    }

    leaderboardModalEl.classList.remove('hidden');
    leaderboardModalEl.setAttribute('aria-hidden', 'false');

    hideMobileControls();
  }

  function closeLeaderboard() {
    leaderboardModalEl.classList.add('hidden');
    leaderboardModalEl.setAttribute('aria-hidden', 'true');

    if (!gameOver) {
      showMobileControls();
    }
  }

  function formatDate(iso) {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return day + '.' + month + '.' + year + ' ' + hh + ':' + mm;
  }

  function undoMove() {
    if (!prevState) return;
    // после завершения игры откатывать нельзя
    if (gameOver) return;

    board = copyBoard(prevState.board);
    score = prevState.score;
    prevState = null;

    renderBoard();
    saveState();
  }

  function hideMobileControls() {
    if (!mobileControlsEl) return;
    mobileControlsEl.style.display = 'none';
  }

  function showMobileControls() {
    if (!mobileControlsEl) return;
    // покажем только на маленьких, но пусть будет
    mobileControlsEl.style.display = '';
  }

})();
