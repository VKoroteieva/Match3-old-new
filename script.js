let playerSkill = parseInt(localStorage.getItem('match3_playerSkill')) || 50;
let levelHistory = JSON.parse(localStorage.getItem('match3_levelHistory')) || {};


function updatePlayerSkill(levelIndex, won) {
    if (!levelHistory[levelIndex]) levelHistory[levelIndex] = { wins: 0, attempts: 0 };
    levelHistory[levelIndex].attempts++;
    if (won) levelHistory[levelIndex].wins++;


    let totalWins = 0, totalAttempts = 0;
    Object.values(levelHistory).forEach(s => {
        totalWins += s.wins;
        totalAttempts += s.attempts;
    });


    if (totalAttempts > 0) {
        playerSkill = Math.round((totalWins / totalAttempts) * 80 + 20);
        playerSkill = Math.max(20, Math.min(100, playerSkill));
    }


    localStorage.setItem('match3_playerSkill', playerSkill);
    localStorage.setItem('match3_levelHistory', JSON.stringify(levelHistory));
}


function adaptDifficulty(levelIndex) {
    let adapted = { ...levelConfig[levelIndex] };
    const skillFactor = (playerSkill - 50) / 150;


    if (adapted.targetScore) adapted.targetScore = Math.round(adapted.targetScore * (1 + skillFactor * 0.04));
    if (adapted.moves && adapted.moves !== Infinity) adapted.moves = Math.max(18, Math.round(adapted.moves * (1 - skillFactor * 0.05)));
    if (adapted.grape) adapted.grape = Math.round(adapted.grape * (1 + skillFactor * 0.08));
    if (adapted.explosions) adapted.explosions = Math.round(adapted.explosions * (1 + skillFactor * 0.08));
    if (adapted.ultra) adapted.ultra = Math.round(adapted.ultra * (1 + skillFactor * 0.08));
    if (adapted.apple) adapted.apple = Math.round(adapted.apple * (1 + skillFactor * 0.08));


    return adapted;
}


const fruitIcons = {
  orange: 'https://cdn-icons-png.flaticon.com/512/135/135620.png',
  apple: 'https://cdn-icons-png.flaticon.com/512/3137/3137044.png',
  banana: 'https://cdn-icons-png.flaticon.com/512/2909/2909761.png',
  grape: 'https://cdn-icons-png.flaticon.com/512/765/765560.png',
  pear: 'https://cdn-icons-png.flaticon.com/512/415/415716.png',
};


const TOTAL_CELLS = 64;


const sounds = {
  background: new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3'),
  clearType: new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'),
  ultraBlast: new Audio('https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3'),
  match: new Audio('https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3'),
};
sounds.background.loop = true;


let isMusicOn = true, isSFXOn = true, hasStartedAudio = false;
let lives = parseInt(localStorage.getItem('match3_lives')) || 5;
let lastLifeTime = parseInt(localStorage.getItem('match3_lastTime')) || Date.now();
let lastScreen = 'main-menu';


let selectedCell = null;
let score = 0;
let movesLeft = 0;
let currentLevel = 1;
let isProcessing = false;
let stats = { grape: 0, explosions: 0, ultra: 0, apple: 0 };
let currentAdaptedLevel = null;
let boardCells = [];


const levelConfig = {
  1: { targetScore: 1500, moves: Infinity, grape: 0, explosions: 0, ultra: 0, apple: 0 },
  2: { targetScore: 0, moves: 25, grape: 25, explosions: 0, ultra: 0, apple: 0 },
  3: { targetScore: 0, moves: 30, grape: 0, explosions: 4, ultra: 0, apple: 0 },
  4: { targetScore: 0, moves: 35, grape: 0, explosions: 0, ultra: 1, apple: 0 },
  5: { targetScore: 4000, moves: 40, grape: 0, explosions: 0, ultra: 0, apple: 40 },
};


function updateLivesSystem() {
  const now = Date.now();
  if (lives < 5) {
    const diff = now - lastLifeTime;
    const gained = Math.floor(diff / (3 * 60 * 1000));
    if (gained > 0) {
      lives = Math.min(5, lives + gained);
      lastLifeTime = lives === 5 ? now : lastLifeTime + gained * 180000;
      saveLives();
    }
  }
  document.getElementById('lives-val').innerText = lives;
}
function saveLives() {
  localStorage.setItem('match3_lives', lives);
  localStorage.setItem('match3_lastTime', lastLifeTime);
}
setInterval(updateLivesSystem, 1000);


function hideAll() {
  document.querySelectorAll('.container, #game').forEach(el => el.classList.add('hidden'));
}
function showMainMenu() {
  hideAll();
  const mainMenu = document.getElementById('main-menu');
  mainMenu.classList.remove('hidden');
 
  // Додаємо відображення майстерності
  let skillDisplay = document.getElementById('player-skill');
  if (!skillDisplay) {
    skillDisplay = document.createElement('div');
    skillDisplay.id = 'player-skill';
    skillDisplay.style.marginTop = '15px';
    skillDisplay.style.fontSize = '18px';
    skillDisplay.style.color = '#2ecc71';
    mainMenu.appendChild(skillDisplay);
  }
  skillDisplay.innerHTML = `<strong>Майстерність: ${playerSkill}%</strong>`;
}
function showMainMenu() {
  hideAll();
  document.getElementById('main-menu').classList.remove('hidden');
  document.getElementById('skill-value').innerText = playerSkill;
}
function showLevels() { hideAll(); document.getElementById('levels-menu').classList.remove('hidden'); }
function showRules() { hideAll(); document.getElementById('rules-menu').classList.remove('hidden'); }


function showSettings() {
  const screens = ['main-menu','levels-menu','game','rules-menu'];
  screens.forEach(s => { if (!document.getElementById(s).classList.contains('hidden')) lastScreen = s; });
  hideAll();
  document.getElementById('settings-menu').classList.remove('hidden');
}
function closeSettings() {
  hideAll();
  document.getElementById(lastScreen).classList.remove('hidden');
}


function startLevel(lvl) {
  if (lives <= 0) return alert('Чекайте відновлення життів!');
 
  hideAll();
  document.getElementById('game').classList.remove('hidden');


  currentLevel = lvl;
  currentAdaptedLevel = adaptDifficulty(lvl);


  score = 0;
  movesLeft = currentAdaptedLevel.moves;
  stats = { grape: 0, explosions: 0, ultra: 0, apple: 0 };
  selectedCell = null;
  isProcessing = false;


  updateUI();
  initBoard();
}


function initBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  boardCells = [];


  for (let i = 0; i < TOTAL_CELLS; i++) {
    const row = Math.floor(i / 8), col = i % 8;
    let possible = Object.keys(fruitIcons);
    let fruit;


    do {
      fruit = possible[Math.floor(Math.random() * possible.length)];
      const matchH = col >= 2 && boardCells[i-1]?.dataset?.fruit === fruit && boardCells[i-2]?.dataset?.fruit === fruit;
      const matchV = row >= 2 && boardCells[i-8]?.dataset?.fruit === fruit && boardCells[i-16]?.dataset?.fruit === fruit;
      if (!matchH && !matchV) break;
      possible = possible.filter(f => f !== fruit);
    } while (possible.length > 0);


    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.fruit = fruit;
    cell.dataset.index = i;
    cell.innerHTML = `<img src="${fruitIcons[fruit]}" alt="">`;
    cell.onclick = () => handleSelect(cell);
    board.appendChild(cell);
    boardCells.push(cell);
  }
}


function handleSelect(cell) {
  if (isProcessing) return;
  if (!hasStartedAudio && isMusicOn) {
    sounds.background.play().catch(() => {});
    hasStartedAudio = true;
  }


  if (selectedCell) {
    const i1 = parseInt(selectedCell.dataset.index);
    const i2 = parseInt(cell.dataset.index);
    const r1 = Math.floor(i1/8), c1 = i1%8;
    const r2 = Math.floor(i2/8), c2 = i2%8;


    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1) {
      swap(selectedCell, cell);
      selectedCell.classList.remove('selected');
      selectedCell = null;


      if (checkMatches()) {
        if (movesLeft !== Infinity) movesLeft--;
        updateUI();
      } else {
        setTimeout(() => swap(cell, selectedCell || cell), 250);
      }
    } else {
      selectedCell.classList.remove('selected');
      selectedCell = cell;
      cell.classList.add('selected');
    }
  } else {
    selectedCell = cell;
    cell.classList.add('selected');
  }
}


function swap(cell1, cell2) {
  const f1 = cell1.dataset.fruit;
  const f2 = cell2.dataset.fruit;
  cell1.dataset.fruit = f2; cell1.querySelector('img').src = fruitIcons[f2];
  cell2.dataset.fruit = f1; cell2.querySelector('img').src = fruitIcons[f1];
}


function checkMatches() {
  if (isProcessing) return false;
  isProcessing = true;


  let matched = new Set();
  let ultra = false;
  let typeToClear = null;


  for (let i = 0; i < TOTAL_CELLS; i++) {
    const fruit = boardCells[i].dataset.fruit;
    const row = Math.floor(i / 8);
    const col = i % 8;


    if (col <= 5 && fruit === boardCells[i+1].dataset.fruit && fruit === boardCells[i+2].dataset.fruit) {
      matched.add(boardCells[i]); matched.add(boardCells[i+1]); matched.add(boardCells[i+2]);
      if (col <= 4 && fruit === boardCells[i+3].dataset.fruit) { matched.add(boardCells[i+3]); typeToClear = fruit; }
      if (col <= 3 && fruit === boardCells[i+4].dataset.fruit) { matched.add(boardCells[i+4]); ultra = true; }
    }


    if (row <= 5 && fruit === boardCells[i+8].dataset.fruit && fruit === boardCells[i+16].dataset.fruit) {
      matched.add(boardCells[i]); matched.add(boardCells[i+8]); matched.add(boardCells[i+16]);
      if (row <= 4 && fruit === boardCells[i+24].dataset.fruit) { matched.add(boardCells[i+24]); typeToClear = fruit; }
      if (row <= 3 && fruit === boardCells[i+32].dataset.fruit) { matched.add(boardCells[i+32]); ultra = true; }
    }
  }


  if (matched.size === 0) {
    isProcessing = false;
    checkWinCondition();
    return false;
  }


  let points = ultra ? 1000 : (typeToClear ? 100 : 30);
  score += points * matched.size;


  if (ultra) {
    playSound('ultraBlast');
    stats.ultra++;
    boardCells.forEach(c => matched.add(c));
  } else if (typeToClear) {
    playSound('clearType');
    stats.explosions++;
    boardCells.forEach(c => { if (c.dataset.fruit === typeToClear) matched.add(c); });
  } else {
    playSound('match');
  }


  matched.forEach(cell => {
    if (cell.dataset.fruit === 'grape') stats.grape++;
    if (cell.dataset.fruit === 'apple') stats.apple++;
    cell.classList.add('removing');
  });


  updateUI();


  setTimeout(() => removeAndDrop(matched), 280);
  return true;
}


function removeAndDrop(matched) {
  for (let col = 0; col < 8; col++) {
    let writePos = 7;
    for (let row = 7; row >= 0; row--) {
      const idx = row * 8 + col;
      const cell = boardCells[idx];
      if (!matched.has(cell)) {
        if (row !== writePos) {
          const targetIdx = writePos * 8 + col;
          boardCells[targetIdx].dataset.fruit = cell.dataset.fruit;
          boardCells[targetIdx].querySelector('img').src = fruitIcons[cell.dataset.fruit];
        }
        writePos--;
      }
    }
    for (let row = writePos; row >= 0; row--) {
      const idx = row * 8 + col;
      const newFruit = Object.keys(fruitIcons)[Math.floor(Math.random() * 5)];
      boardCells[idx].dataset.fruit = newFruit;
      boardCells[idx].querySelector('img').src = fruitIcons[newFruit];
      boardCells[idx].classList.add('falling');
      setTimeout(() => boardCells[idx].classList.remove('falling'), 400);
    }
  }


  boardCells.forEach(c => c.classList.remove('removing'));
  isProcessing = false;


  setTimeout(() => {
    checkWinCondition();   // Перевіряємо перемогу після падіння
    if (!checkMatches()) {
      checkEnd();
    }
  }, 300);
}


function checkWinCondition() {
  const cfg = currentAdaptedLevel;
  const hasWon =
    (cfg.targetScore ? score >= cfg.targetScore : true) &&
    stats.grape >= cfg.grape &&
    stats.explosions >= cfg.explosions &&
    stats.ultra >= cfg.ultra &&
    stats.apple >= cfg.apple;


  if (hasWon) {
    triggerWin();
  }
}


function triggerWin() {
  isProcessing = true;
  updatePlayerSkill(currentLevel, true);


  hideAll();
  const screen = document.getElementById('game-over');
  screen.classList.remove('hidden');
 
  screen.innerHTML = `
    <h2>ПЕРЕМОГА!</h2>
    <p>Рівень ${currentLevel} пройдено</p>
    <button class="btn-play" onclick="nextLevel()">Наступний рівень</button>
    <button class="btn-back" onclick="showLevels()" style="margin-top:12px;">Меню рівнів</button>
  `;
}


function nextLevel() {
  if (currentLevel < 5) startLevel(currentLevel + 1);
  else {
    alert("Вітаємо! Ви пройшли всі рівні!");
    showLevels();
  }
}
Ф
function checkEnd() {
  if (movesLeft <= 0 && movesLeft !== Infinity) {
    updatePlayerSkill(currentLevel, false);
    lives--;
    saveLives();
    updateLivesSystem();


    hideAll();
    const screen = document.getElementById('game-over');
    screen.classList.remove('hidden');
    screen.innerHTML = `
      <h2>ПОРАЗКА</h2>
      <p>Ходи закінчилися</p>
      <button class="btn-play" onclick="showLevels()">До меню рівнів</button>
    `;
  }
}


function updateUI() {
  const cfg = currentAdaptedLevel;
  document.getElementById('score').innerText = score;
  document.getElementById('moves').innerText = movesLeft === Infinity ? '∞' : movesLeft;


  let text = 'Ціль: ';
  if (cfg.targetScore > 0) text += `${score}/${cfg.targetScore} очок`;
  else if (cfg.grape > 0) text += `🍇 ${stats.grape}/${cfg.grape}`;
  else if (cfg.explosions > 0) text += `✨ 4-в-ряд: ${stats.explosions}/${cfg.explosions}`;
  else if (cfg.ultra > 0) text += `🌈 5-в-ряд: ${stats.ultra}/${cfg.ultra}`;
  else if (cfg.apple > 0) text += `🍎 ${stats.apple}/${cfg.apple}`;


  document.getElementById('progress-info').innerText = text;
}


function playSound(name) {
  if (isSFXOn && sounds[name]) {
    sounds[name].currentTime = 0;
    sounds[name].play().catch(() => {});
  }
}


function toggleMusic() {
  isMusicOn = document.getElementById('music-toggle').checked;
  if (isMusicOn) sounds.background.play();
  else sounds.background.pause();
}
function toggleSFX() {
  isSFXOn = document.getElementById('sfx-toggle').checked;
}


updateLivesSystem();
