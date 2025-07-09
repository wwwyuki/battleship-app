document.addEventListener('DOMContentLoaded', () => {
    // --- DOM要素の取得 ---
    const playerBoardEl = document.getElementById('player-board');
    const aiBoardEl = document.getElementById('ai-board');
    const playerShipInfoEl = document.getElementById('player-ship-info');
    const aiShipInfoEl = document.getElementById('ai-ship-info');
    const shipPreviewsEl = document.getElementById('ship-previews');
    const rotateButton = document.getElementById('rotate-button');
    const startButton = document.getElementById('start-button');
    const resetButton = document.getElementById('reset-button');
    const rulesButton = document.getElementById('rules-button');
    const volumeButton = document.getElementById('volume-button');
    const closeRulesButton = document.getElementById('close-rules-button');
    const rulesModal = document.getElementById('rules-modal');
    const placementButtons = document.getElementById('placement-buttons');
    const turnDisplay = document.getElementById('turn-display');
    const infoDisplay = document.getElementById('info-display');
    const hitSound = document.getElementById('hit-sound');
    const sunkSound = document.getElementById('sunk-sound');
    const titlePopup = document.getElementById('title-popup');
    const titleSound = document.getElementById('title-sound');
    const bgmSound = document.getElementById('bgm-sound');
    // --- ゲーム設定と状態変数 ---
    const width = 10;
    const ships = [ { name: 'destroyer', size: 2, label: '駆逐艦' }, { name: 'cruiser', size: 3, label: '巡洋艦' }, { name: 'battleship', size: 4, label: '戦艦' }];
    let playerShips, aiShips, isGameOver, currentPlayer, shipsToPlace, shipDirection, draggedShip;
    let aiShots, aiTargetQueue, aiCurrentHits, aiHuntModeParity;
    let volumeLevel = 2; // ★修正: 2:大, 1:小, 0:ミュート
    let hasInteracted = false;
    // --- 初期化処理 ---
    function init() {
        playSound(titleSound);
        titlePopup.addEventListener('animationend', () => { titlePopup.style.display = 'none'; });
        setupGlobalEventListeners();
        resetGame();
        setVolume();
    }

    // --- グローバルなイベントリスナーを設定 ---
    function setupGlobalEventListeners() {
        resetButton.addEventListener('click', resetGame);
        rulesButton.addEventListener('click', () => rulesModal.classList.remove('hidden'));
        closeRulesButton.addEventListener('click', () => rulesModal.classList.add('hidden'));
        rulesModal.addEventListener('click', (e) => { if (e.target === rulesModal) rulesModal.classList.add('hidden'); });
        volumeButton.addEventListener('click', cycleVolume); // ★修正
    }
    
    // --- ★音量切り替え関数 (新ロジック)★ ---
    function setVolume() {
        const sfxSounds = [titleSound, hitSound, sunkSound];
        let sfxVolume, bgmVolume, newIcon;

        switch (volumeLevel) {
            case 2: // 大
                sfxVolume = 0.3;
                bgmVolume = 0.05; // BGMは音量30%
                newIcon = '🔊';
                break;
            case 1: // 小
                sfxVolume = 0.2;
                bgmVolume = 0.02; // BGMは音量10%
                newIcon = '🔉';
                break;
            case 0: // ミュート
                sfxVolume = 0.0;
                bgmVolume = 0.0;
                newIcon = '🔇';
                break;
        }
        
        volumeButton.textContent = newIcon;
        sfxSounds.forEach(sound => { if (sound) sound.volume = sfxVolume; });
        if (bgmSound) bgmSound.volume = bgmVolume;
    }

    // --- ★音量切り替え関数 (修正)★ ---
    function cycleVolume() {
        volumeLevel--;
        if (volumeLevel < 0) volumeLevel = 2;
        setVolume(); // 新しい設定を適用
    }

    // --- サウンド再生用の関数 (修正) ---
    function playSound(sound) {
        if (!sound) return; // isMutedチェックは不要に
        sound.currentTime = 0;
        sound.play().catch(e => {});
    }

    // (これ以降のすべての関数は、前回の回答から変更ありません)
    
    function resetGame() {
        playerShips = []; aiShips = []; isGameOver = false; currentPlayer = 'player'; shipsToPlace = [...ships]; shipDirection = 'horizontal'; draggedShip = null;
        aiShots = new Set(); aiTargetQueue = []; aiCurrentHits = []; aiHuntModeParity = Math.floor(Math.random() * 2);
        playerBoardEl.innerHTML = ''; aiBoardEl.innerHTML = '';
        createBoard(playerBoardEl); createBoard(aiBoardEl);
        aiShips = placeAllShipsRandomly();
        setupPlacementPhase();
        turnDisplay.textContent = 'あなたの艦隊を配置してください';
        infoDisplay.textContent = '';
        document.querySelector('.shipyard-container').style.display = 'block';
        placementButtons.style.display = 'flex';
        resetButton.style.display = 'none';
        startButton.disabled = true;
        rotateButton.disabled = false;
        shipPreviewsEl.querySelectorAll('.ship-preview').forEach(p => { p.style.display = 'flex'; p.classList.remove('vertical'); });
        if(shipDirection === 'vertical') shipDirection = 'horizontal';
        playerShipInfoEl.innerHTML = ''; aiShipInfoEl.innerHTML = '';
        aiBoardEl.removeEventListener('click', handlePlayerClick);
    }

    function setupPlacementPhase() {
        const previewShips = document.querySelectorAll('.ship-preview');
        previewShips.forEach(ship => { ship.draggable = true; ship.addEventListener('dragstart', dragStart); });
        const playerCells = playerBoardEl.querySelectorAll('.cell');
        playerCells.forEach(cell => { cell.addEventListener('dragover', dragOver); cell.addEventListener('dragleave', dragLeave); cell.addEventListener('drop', dropShip); });
        rotateButton.addEventListener('click', rotateShips);
        startButton.addEventListener('click', startGame);
    }
    
    function rotateShips() {
        shipDirection = shipDirection === 'horizontal' ? 'vertical' : 'horizontal';
        document.querySelectorAll('.ship-preview').forEach(ship => ship.classList.toggle('vertical'));
    }

    function dragStart(e) {
        // 👇ここから修正👇
        // 最初の操作でBGMを再生開始
        if (!hasInteracted) {
            bgmSound.play().catch(e => {});
            hasInteracted = true;
        }
        // 👆ここまで修正👆
        draggedShip = e.target.closest('.ship-preview');
    }
    function dragOver(e) { e.preventDefault(); highlightCells(e.target, 'add'); }
    function dragLeave(e) { highlightCells(e.target, 'remove'); }
    
    function dropShip(e) {
        e.preventDefault();
        const startId = parseInt(e.target.dataset.id);
        const shipName = draggedShip.dataset.name;
        const ship = ships.find(s => s.name === shipName);
        const coords = getShipCoords(startId, ship.size, shipDirection);
        const isValid = validatePlacement(coords);
        if (isValid) {
            playerShips.push({ ...ship, coords, hits: [] });
            coords.forEach(idx => playerBoardEl.querySelector(`.cell[data-id='${idx}']`).classList.add(ship.name, 'taken'));
            draggedShip.style.display = 'none';
            shipsToPlace = shipsToPlace.filter(s => s.name !== shipName);
            if (shipsToPlace.length === 0) {
                startButton.disabled = false;
                turnDisplay.textContent = '全艦隊、配置完了！「ゲーム開始」を押してください。';
                rotateButton.disabled = true;
            }
        }
        highlightCells(e.target, 'remove');
    }
    
    function highlightCells(startCell, action) {
        if (!draggedShip) return;
        const shipName = draggedShip.dataset.name;
        const ship = ships.find(s => s.name === shipName);
        if (!ship) return;
        const startId = parseInt(startCell.dataset.id);
        const coords = getShipCoords(startId, ship.size, shipDirection);
        const isValid = validatePlacement(coords);
        coords.forEach(idx => {
            const cell = playerBoardEl.querySelector(`.cell[data-id='${idx}']`);
            if (cell) cell.classList[action](isValid ? 'drag-over-valid' : 'drag-over-invalid');
        });
    }

    function getShipCoords(startId, size, direction) {
        const coords = [];
        for (let i = 0; i < size; i++) coords.push(direction === 'horizontal' ? startId + i : startId + i * width);
        return coords;
    }
    
    function validatePlacement(coords) {
        const startId = coords[0];
        if (startId === undefined || isNaN(startId)) return false;
        const isHorizontal = coords.length > 1 && coords[1] === startId + 1;
        const outOfBounds = isHorizontal && Math.floor(coords[coords.length - 1] / width) !== Math.floor(startId / width);
        if (outOfBounds || coords[coords.length - 1] >= width * width) return false;
        return !coords.some(idx => playerBoardEl.querySelector(`.cell[data-id='${idx}']`)?.classList.contains('taken'));
    }

    function startGame() {
        document.querySelector('.shipyard-container').style.display = 'none';
        placementButtons.style.display = 'none';
        displayShipInfo();
        turnDisplay.textContent = '戦闘開始！敵の艦隊を攻撃してください！';
        aiBoardEl.addEventListener('click', handlePlayerClick);
    }

    function handlePlayerClick(e) {
        if (!e.target.classList.contains('cell') || isGameOver || currentPlayer !== 'player') return;
        const cell = e.target;
        if (cell.classList.contains('hit') || cell.classList.contains('miss')) return;
        const cellId = parseInt(cell.dataset.id);
        const result = evaluateShot(aiShips, cellId);
        cell.classList.add(result.status);
        if (result.status === 'hit') playSound(hitSound);
        if (result.sunkShip) {
            playSound(sunkSound);
            infoDisplay.textContent = `ヒット！ 敵の${result.sunkShip.label}を撃沈！`;
            result.sunkShip.coords.forEach(idx => aiBoardEl.querySelector(`.cell[data-id='${idx}']`).classList.add('sunk'));
            document.getElementById(`ai-ship-${result.sunkShip.name}`).classList.add('sunk-info');
        } else if (result.status === 'hit') infoDisplay.textContent = `攻撃... ヒット！`;
        else infoDisplay.textContent = `攻撃... ハズレ。`;
        if (checkWinCondition('player')) return;
        currentPlayer = 'ai';
        turnDisplay.textContent = 'AIのターンです';
        setTimeout(aiTurn, 300);
    }
    
    function aiTurn() {
        if (isGameOver) return;
        let shotId;
        if (aiTargetQueue.length > 0) {
            shotId = aiTargetQueue.shift();
        } else {
            do {
                const row = Math.floor(Math.random() * 10), col = Math.floor(Math.random() * 10);
                if ((row + col) % 2 === aiHuntModeParity) shotId = row * width + col;
            } while (shotId === undefined || aiShots.has(shotId));
        }
        aiShots.add(shotId);
        const cell = playerBoardEl.querySelector(`.cell[data-id='${shotId}']`);
        const result = evaluateShot(playerShips, shotId);
        if (!cell) { aiTurn(); return; }
        cell.classList.add(result.status);
        if (result.status === 'hit') {
            playSound(hitSound);
            aiCurrentHits.push(shotId);
            updateTargetQueue(shotId);
        }
        if (result.sunkShip) {
            playSound(sunkSound);
            infoDisplay.textContent = `被弾！ こちらの${result.sunkShip.label}が撃沈された！`;
            aiTargetQueue = []; aiCurrentHits = [];
            result.sunkShip.coords.forEach(idx => playerBoardEl.querySelector(`.cell[data-id='${idx}']`).classList.add('sunk'));
            document.getElementById(`player-ship-${result.sunkShip.name}`).classList.add('sunk-info');
        }
        if (checkWinCondition('ai')) return;
        currentPlayer = 'player';
        turnDisplay.textContent = 'あなたのターンです';
    }

    function updateTargetQueue(hitId) {
        if (aiCurrentHits.length > 1) {
            aiTargetQueue = [];
            const axis = Math.abs(aiCurrentHits[0] - aiCurrentHits[1]) === 1 ? 'horizontal' : 'vertical';
            const allHits = [...aiCurrentHits].sort((a,b) => a - b);
            const targets = axis === 'horizontal' ? [allHits[0] - 1, allHits[allHits.length-1] + 1] : [allHits[0] - width, allHits[allHits.length-1] + width];
            addValidTargets(targets);
        } else addValidTargets([hitId - 1, hitId + 1, hitId - width, hitId + width]);
    }
    function addValidTargets(targets) {
        const validTargets = targets.filter(target => {
            if (target < 0 || target >= 100 || aiShots.has(target)) return false;
            const startId = aiCurrentHits.length > 0 ? aiCurrentHits.sort((a,b) => a - b)[0] : target;
            return !((startId % width === 0 && target % width === 9) || (startId % width === 9 && target % width === 0));
        });
        aiTargetQueue = [...new Set([...aiTargetQueue, ...validTargets])];
    }
    
    function placeAllShipsRandomly() {
        const p = [];
        ships.forEach(s => { let d=0; while(!d){ const r=Math.random()<0.5,c=getShipCoords(Math.floor(Math.random()*100),s.size,r?'horizontal':'vertical'),e=c[c.length-1],o=(r&&Math.floor(e/10)!==Math.floor(c[0]/10))||e>=100; if(!o&&!c.some(x=>p.some(y=>y.coords.includes(x)))) p.push({...s,coords:c,hits:[]}),d=1}});
        return p;
    }
    function displayShipInfo() {
        playerShipInfoEl.innerHTML = '<h4>残存艦</h4>'; aiShipInfoEl.innerHTML = '<h4>残存艦</h4>';
        ships.forEach(ship => { playerShipInfoEl.innerHTML += `<div id="player-ship-${ship.name}">${ship.label} (${ship.size})</div>`; aiShipInfoEl.innerHTML += `<div id="ai-ship-${ship.name}">${ship.label} (${ship.size})</div>`; });
    }
    function createBoard(boardElement) { for (let i = 0; i < 100; i++) { const c=document.createElement('div'); c.className='cell'; c.dataset.id=i; boardElement.appendChild(c); } }
    function evaluateShot(targetShips, shotId) {
        for (const ship of targetShips) { if (ship.coords.includes(shotId)) { ship.hits.push(shotId); return ship.hits.length===ship.size ? {status:'hit',sunkShip:ship} : {status:'hit',sunkShip:null}; } }
        return { status: 'miss', sunkShip: null };
    }
    function checkWinCondition(attacker) {
        const targetShips = attacker === 'player' ? aiShips : playerShips;
        if (targetShips.every(ship => ship.hits.length === ship.size)) {
            isGameOver = true;
            turnDisplay.textContent = 'ゲーム終了！';
            if (attacker === 'player') infoDisplay.textContent = 'おめでとうございます！あなたの勝利です！';
            else infoDisplay.textContent = '残念... AIの勝利です。';
            aiBoardEl.removeEventListener('click', handlePlayerClick);
            placementButtons.style.display = 'none';
            resetButton.style.display = 'inline-block';
            return true;
        }
    
        return false;
    }

    init();
});
// --- Service Workerの登録 ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }).catch(error => {
      console.log('ServiceWorker registration failed: ', error);
    });
  });
}