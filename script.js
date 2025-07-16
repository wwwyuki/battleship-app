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
    const bgmSound = document.getElementById('bgm-sound');
    const mobileShipSelector = document.getElementById('mobile-ship-selector');
    let winLosePanel, winLoseText;

    // --- ゲーム設定と状態変数 ---
    const width = 10;
    const ships = [ { name: 'destroyer', size: 2, label: '駆逐艦' }, { name: 'cruiser', size: 3, label: '巡洋艦' }, { name: 'battleship', size: 4, label: '戦艦' }];
    let playerShips, aiShips, isGameOver, shipDirection, draggedShip;
    let aiShots, aiTargetQueue, aiCurrentHits, aiHuntModeParity;
    let volumeLevel = 2;
    let hasInteracted = false;
    let selectedShipToPlace = null;
    let isMobile = false;
    let aiAttackInterval = null;

    // --- 初期化処理 ---
    function init() {
        winLosePanel = document.createElement('div');
        winLosePanel.id = 'win-lose-panel';
        winLosePanel.className = 'hidden';
        winLoseText = document.createElement('p');
        winLoseText.id = 'win-lose-text';
        winLosePanel.appendChild(winLoseText);
        document.body.appendChild(winLosePanel);
        
        isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window);

        setVolume();
        titlePopup.addEventListener('animationend', () => { titlePopup.style.display = 'none'; });
        setupGlobalEventListeners();
        resetGame();
    }

    // --- グローバルなイベントリスナーを設定 ---
    function setupGlobalEventListeners() {
        resetButton.addEventListener('click', resetGame);
        rulesButton.addEventListener('click', () => rulesModal.classList.remove('hidden'));
        closeRulesButton.addEventListener('click', () => rulesModal.classList.add('hidden'));
        rulesModal.addEventListener('click', (e) => { if (e.target === rulesModal) rulesModal.classList.add('hidden'); });
        volumeButton.addEventListener('click', cycleVolume);
    }

    // --- 音量関連 ---
    function setVolume() {
        const sfxSounds = [hitSound, sunkSound]; // titleSoundを削除
        let sfxVolume, bgmVolume, newIcon;
        switch (volumeLevel) {
            case 2: sfxVolume = 0.2; bgmVolume = 0.3; newIcon = '🔊'; break;
            case 1: sfxVolume = 0.1; bgmVolume = 0.1; newIcon = '🔉'; break;
            case 0: sfxVolume = 0.0; bgmVolume = 0.0; newIcon = '🔇'; break;
        }
        volumeButton.textContent = newIcon;
        sfxSounds.forEach(sound => { if (sound) sound.volume = sfxVolume; });
        if (bgmSound) bgmSound.volume = bgmVolume;
    }
    function cycleVolume() {
        volumeLevel = (volumeLevel + 2) % 3;
        setVolume();
    }
    function playSound(sound) {
        if (!sound) return;
        sound.currentTime = 0;
        sound.play().catch(e => {});
    }

    // --- ゲームリセット ---
    function resetGame() {
        playerShips = [];
        aiShips = [];
        isGameOver = false;
        shipDirection = 'horizontal';
        draggedShip = null;
        aiShots = new Set();
        aiTargetQueue = [];
        aiCurrentHits = [];
        aiHuntModeParity = Math.floor(Math.random() * 2);
        selectedShipToPlace = null;
        clearInterval(aiAttackInterval);

        playerBoardEl.innerHTML = '';
        aiBoardEl.innerHTML = '';
        createBoard(playerBoardEl);
        createBoard(aiBoardEl);
        aiShips = placeAllShipsRandomly();
        setupPlacementPhase();
        turnDisplay.textContent = 'あなたの艦隊を配置してください';
        infoDisplay.textContent = '';
        
        const shipyardContainer = document.querySelector('.shipyard-container');
        const mobileControls = document.querySelector('.mobile-placement-controls');
        if (isMobile) {
            if (shipyardContainer) shipyardContainer.style.display = 'none';
            if (mobileControls) mobileControls.style.display = 'block';
        } else {
            if (shipyardContainer) shipyardContainer.style.display = 'block';
            if (mobileControls) mobileControls.style.display = 'none';
        }

        placementButtons.style.display = 'flex';
        resetButton.style.display = 'none';
        startButton.disabled = true;
        rotateButton.disabled = false;

        shipPreviewsEl.querySelectorAll('.ship-preview').forEach(p => {
            p.style.display = 'flex';
            p.classList.remove('vertical');
        });
        if (shipDirection === 'vertical') {
            shipDirection = 'horizontal';
        }

        playerShipInfoEl.innerHTML = '';
        aiShipInfoEl.innerHTML = '';
        aiBoardEl.removeEventListener('click', handlePlayerClick);
        winLosePanel.classList.remove('show');
        winLosePanel.classList.add('hidden');
        
        if (hasInteracted) {
            bgmSound.play().catch(e => {});
        }
    }

    // --- 配置フェーズの設定 ---
    function setupPlacementPhase() {
        const playerCells = playerBoardEl.querySelectorAll('.cell');
        rotateButton.addEventListener('click', rotateShips);
        startButton.addEventListener('click', startGame);

        if (isMobile) {
            setupMobilePlacement(playerCells);
        } else {
            setupDesktopPlacement(playerCells);
        }
    }

    // 【PC用】ドラッグ＆ドロップで配置
    function setupDesktopPlacement(playerCells) {
        document.querySelectorAll('.shipyard-container .ship-preview').forEach(ship => {
            ship.draggable = true;
            ship.addEventListener('dragstart', dragStart);
        });
        playerCells.forEach(cell => {
            cell.addEventListener('dragover', dragOver);
            cell.addEventListener('dragleave', dragLeave);
            cell.addEventListener('drop', dropShip);
        });
    }

    // 【モバイル用】クリックで配置
    function setupMobilePlacement(playerCells) {
        if (!mobileShipSelector) return;
        infoDisplay.textContent = '下のドックから艦を選び、マップをタップして配置してください。';
        mobileShipSelector.innerHTML = '';

        const previewsToClone = document.querySelectorAll('.shipyard-container .ship-preview');
        
        previewsToClone.forEach(preview => {
            const clone = preview.cloneNode(true);
            clone.draggable = false;
            clone.addEventListener('click', (e) => selectShipToPlace(e.currentTarget));
            mobileShipSelector.appendChild(clone);
        });

        playerCells.forEach(cell => {
            cell.addEventListener('click', (e) => placeShipOnClick(e.target));
        });
    }

    // --- モバイル用の関数 ---
    function selectShipToPlace(shipElement) {
        if (shipElement.style.display === 'none') return;

        mobileShipSelector.querySelectorAll('.ship-preview').forEach(el => el.classList.remove('selected'));
        shipElement.classList.add('selected');
        selectedShipToPlace = shipElement;
        
        const shipName = ships.find(s => s.name === shipElement.dataset.name)?.label || '';
        infoDisplay.textContent = `「${shipName}」を選択中...`;
    }

    function placeShipOnClick(cell) {
        if (!hasInteracted) {
            bgmSound.play().catch(e => {});
            hasInteracted = true;
        }
        if (!selectedShipToPlace) {
            infoDisplay.textContent = '先に下のドックから配置する艦を選択してください。';
            return;
        }

        const startId = parseInt(cell.dataset.id);
        const shipName = selectedShipToPlace.dataset.name;
        const ship = ships.find(s => s.name === shipName);
        const coords = getShipCoords(startId, ship.size, shipDirection);

        if (validatePlacement(coords)) {
            placeShip(ship, coords);
            selectedShipToPlace.style.display = 'none';
            selectedShipToPlace.classList.remove('selected');
            selectedShipToPlace = null;
            infoDisplay.textContent = `「${ship.label}」を配置しました。`;
            checkAllShipsPlaced();
        } else {
            infoDisplay.textContent = 'そこには配置できません。';
        }
    }

    function rotateShips() {
        shipDirection = shipDirection === 'horizontal' ? 'vertical' : 'horizontal';
        document.querySelectorAll('.ship-preview').forEach(ship => ship.classList.toggle('vertical'));
    }

    // --- PC用ドラッグ＆ドロップ関連 ---
    function dragStart(e) {
        if (!hasInteracted) {
            bgmSound.play().catch(e => {});
            hasInteracted = true;
        }
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

        if (validatePlacement(coords)) {
            placeShip(ship, coords);
            draggedShip.style.display = 'none';
            checkAllShipsPlaced();
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
    
    // 配置関連のロジック
    function placeShip(ship, coords) {
        if (playerShips.some(s => s.name === ship.name)) {
            return; 
        }
        playerShips.push({ ...ship, coords, hits: [] });
        coords.forEach(idx => playerBoardEl.querySelector(`.cell[data-id='${idx}']`).classList.add(ship.name, 'taken'));
    }
    
    // 配置完了判定
    function checkAllShipsPlaced() {
        if (playerShips.length === ships.length) {
            startButton.disabled = false;
            turnDisplay.textContent = '全艦隊、配置完了！「ゲーム開始」を押してください。';
            rotateButton.disabled = true;
        }
    }

    // --- 配置と座標の共通ロジック ---
    function getShipCoords(startId, size, direction) {
        const coords = [];
        for (let i = 0; i < size; i++) {
            coords.push(direction === 'horizontal' ? startId + i : startId + i * width);
        }
        return coords;
    }

    function validatePlacement(coords) {
        const startId = coords[0];
        if (startId === undefined || isNaN(startId)) return false;
        
        const isHorizontal = coords.length > 1 && coords[1] === startId + 1;
        const outOfBounds = isHorizontal ? Math.floor(coords[coords.length - 1] / width) !== Math.floor(startId / width) : coords[coords.length - 1] >= width * width;
        if (outOfBounds) return false;

        return !coords.some(idx => {
            const cell = playerBoardEl.querySelector(`.cell[data-id='${idx}']`);
            return !cell || cell.classList.contains('taken');
        });
    }

    // --- 戦闘ロジック ---
    function startGame() {
        const shipyardContainer = document.querySelector('.shipyard-container');
        if (shipyardContainer) shipyardContainer.style.display = 'none';

        const mobileControls = document.querySelector('.mobile-placement-controls');
        if (mobileControls) mobileControls.style.display = 'none';

        placementButtons.style.display = 'none';
        
        displayShipInfo();
        turnDisplay.textContent = '戦闘開始！';
        infoDisplay.textContent = '敵の艦隊を攻撃せよ！';

        aiBoardEl.addEventListener('click', handlePlayerClick);
        aiAttackInterval = setInterval(aiAttack, 400);
    }

    function handlePlayerClick(e) {
        if (isGameOver || !e.target.classList.contains('cell') || e.target.classList.contains('hit') || e.target.classList.contains('miss')) {
            return;
        }
        
        const cell = e.target;
        const cellId = parseInt(cell.dataset.id);
        const result = evaluateShot(aiShips, cellId);
        
        cell.classList.add(result.status);
        if (result.status === 'hit') playSound(hitSound);
        
        if (result.sunkShip) {
            playSound(sunkSound);
            infoDisplay.textContent = `ヒット！ 敵の${result.sunkShip.label}を撃沈！`;
            result.sunkShip.coords.forEach(idx => aiBoardEl.querySelector(`.cell[data-id='${idx}']`).classList.add('sunk'));
            document.getElementById(`ai-ship-${result.sunkShip.name}`).classList.add('sunk-info');
        }
        
        checkWinCondition('player');
    }

    function aiAttack() {
        if (isGameOver) return;

        let shotId;
        if (aiTargetQueue.length > 0) {
            shotId = aiTargetQueue.shift();
        } 
        else {
            do {
                const row = Math.floor(Math.random() * 10), col = Math.floor(Math.random() * 10);
                if ((row + col) % 2 === aiHuntModeParity) {
                    shotId = row * width + col;
                }
            } while (shotId === undefined || aiShots.has(shotId));
        }
        
        aiShots.add(shotId);
        const cell = playerBoardEl.querySelector(`.cell[data-id='${shotId}']`);
        if (!cell) {
            aiAttack();
            return;
        }
        
        const result = evaluateShot(playerShips, shotId);
        cell.classList.add(result.status);
        
        if (result.status === 'hit') {
            playSound(hitSound);
            aiCurrentHits.push(shotId);
            updateTargetQueue(shotId);
        }
        
        if (result.sunkShip) {
            playSound(sunkSound);
            infoDisplay.textContent = `被弾！ こちらの${result.sunkShip.label}が撃沈された！`;
            aiTargetQueue = [];
            aiCurrentHits = [];
            result.sunkShip.coords.forEach(idx => playerBoardEl.querySelector(`.cell[data-id='${idx}']`).classList.add('sunk'));
            document.getElementById(`player-ship-${result.sunkShip.name}`).classList.add('sunk-info');
        }
        
        checkWinCondition('ai');
    }

    function updateTargetQueue(hitId) {
        if (aiCurrentHits.length > 1) {
            aiTargetQueue = [];
            const axis = Math.abs(aiCurrentHits[0] - aiCurrentHits[1]) === 1 ? 'horizontal' : 'vertical';
            const allHits = [...aiCurrentHits].sort((a, b) => a - b);
            const targets = axis === 'horizontal' ? [allHits[0] - 1, allHits[allHits.length - 1] + 1] : [allHits[0] - width, allHits[allHits.length - 1] + width];
            addValidTargets(targets);
        } else {
            addValidTargets([hitId - 1, hitId + 1, hitId - width, hitId + width]);
        }
    }

    function addValidTargets(targets) {
        const validTargets = targets.filter(target => {
            if (target < 0 || target >= 100 || aiShots.has(target)) return false;
            const startId = aiCurrentHits.length > 0 ? aiCurrentHits.sort((a, b) => a - b)[0] : target;
            return !((startId % width === 0 && target % width === 9) || (startId % width === 9 && target % width === 0));
        });
        aiTargetQueue = [...new Set([...aiTargetQueue, ...validTargets])];
    }

    function placeAllShipsRandomly() {
        const p = [];
        ships.forEach(s => {
            let d = 0;
            while (!d) {
                const r = Math.random() < 0.5;
                const c = getShipCoords(Math.floor(Math.random() * 100), s.size, r ? 'horizontal' : 'vertical');
                const e = c[c.length - 1];
                const o = (r && Math.floor(e / 10) !== Math.floor(c[0] / 10)) || e >= 100;
                if (!o && !c.some(x => p.some(y => y.coords.includes(x)))) {
                    p.push({ ...s, coords: c, hits: [] });
                    d = 1;
                }
            }
        });
        return p;
    }

    function displayShipInfo() {
        playerShipInfoEl.innerHTML = '<h4>残存艦</h4>';
        aiShipInfoEl.innerHTML = '<h4>残存艦</h4>';
        ships.forEach(ship => {
            playerShipInfoEl.innerHTML += `<div id="player-ship-${ship.name}">${ship.label} (${ship.size})</div>`;
            aiShipInfoEl.innerHTML += `<div id="ai-ship-${ship.name}">${ship.label} (${ship.size})</div>`;
        });
    }

    function createBoard(boardElement) {
        for (let i = 0; i < 100; i++) {
            const c = document.createElement('div');
            c.className = 'cell';
            c.dataset.id = i;
            boardElement.appendChild(c);
        }
    }

    function evaluateShot(targetShips, shotId) {
        for (const ship of targetShips) {
            if (ship.coords.includes(shotId)) {
                ship.hits.push(shotId);
                return ship.hits.length === ship.size ? { status: 'hit', sunkShip: ship } : { status: 'hit', sunkShip: null };
            }
        }
        return { status: 'miss', sunkShip: null };
    }

    function checkWinCondition(attacker) {
        if (isGameOver) return;

        const targetShips = attacker === 'player' ? aiShips : playerShips;
        if (targetShips.every(ship => ship.hits.length === ship.size)) {
            isGameOver = true;
            clearInterval(aiAttackInterval);
            
            turnDisplay.textContent = 'ゲーム終了！';
            if (bgmSound) {
                bgmSound.pause();
                bgmSound.currentTime = 0;
            }
            
            const resultText = attacker === 'player' ? 'You Win!' : 'You Lose...';
            showWinLosePanel(resultText);
            
            aiBoardEl.removeEventListener('click', handlePlayerClick);
            placementButtons.style.display = 'none';
            resetButton.style.display = 'inline-block';
        }
    }

    function showWinLosePanel(text) {
        winLoseText.textContent = text;
        winLosePanel.classList.remove('hidden');
        winLosePanel.classList.add('show');
    }

    init();
});

// --- Service Workerの登録 ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(registration => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }).catch(error => {
            console.log('ServiceWorker registration failed: ', error);
        });
    });
}