// ==================== ABA 1V1 & DUPLAS (DRAFT MANUAL) ====================
// Lista de jogadores digitados manualmente e sorteio de confronto 1v1/2v2
// a partir dela. Depende de state.js e ui.js (getStarIcons).

    function addPlayerToList() {
      const input = document.getElementById('input-player-name');
      const name = input.value.trim();
      if (!name) return;

      if (!playerList.includes(name)) {
        playerList.push(name);
        renderPlayersList();
      }
      input.value = '';
    }

    function removePlayer(name) {
      playerList = playerList.filter(p => p !== name);
      renderPlayersList();
    }

    function renderPlayersList() {
      const container = document.getElementById('players-list-container');
      container.innerHTML = '';

      playerList.forEach(player => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between bg-[#111319] px-3 py-2 rounded-xl border border-white/5 text-sm font-semibold';
        item.innerHTML = `
          <span class="text-white">${player}</span>
          <button onclick="removePlayer('${player}')" class="text-gray-500 hover:text-red-400">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        `;
        container.appendChild(item);
      });
      lucide.createIcons();
    }

    function setDraftMode(mode) {
      currentDraftMode = mode;
      const b1 = document.getElementById('btn-mode-1v1');
      const b2 = document.getElementById('btn-mode-2v2');

      if (mode === '1v1') {
        b1.className = 'py-2 px-3 rounded-xl font-bold text-xs bg-amber-500 text-black border border-amber-400 transition';
        b2.className = 'py-2 px-3 rounded-xl font-bold text-xs bg-[#111319] text-gray-300 border border-white/10 hover:border-amber-500 transition';
        document.getElementById('draft-mode-badge').textContent = 'Modo Solo (1v1)';
      } else {
        b2.className = 'py-2 px-3 rounded-xl font-bold text-xs bg-amber-500 text-black border border-amber-400 transition';
        b1.className = 'py-2 px-3 rounded-xl font-bold text-xs bg-[#111319] text-gray-300 border border-white/10 hover:border-amber-500 transition';
        document.getElementById('draft-mode-badge').textContent = 'Modo Duplas (2v2)';
      }
    }

    function generateDraftMatchup() {
      if (playerList.length < 2) return;

      const shuffled = [...playerList].sort(() => 0.5 - Math.random());

      let sideA = '';
      let sideB = '';

      if (currentDraftMode === '1v1') {
        sideA = shuffled[0];
        sideB = shuffled[1];
      } else {
        if (shuffled.length < 4) {
          sideA = `${shuffled[0]} & ${shuffled[1]}`;
          sideB = `${shuffled[2] || 'Bot'} & Convidados`;
        } else {
          sideA = `${shuffled[0]} & ${shuffled[1]}`;
          sideB = `${shuffled[2]} & ${shuffled[3]}`;
        }
      }

      const pair = pickBalancedPair();
      if (!pair) {
        alert('Times insuficientes com os filtros atuais (Liga / Escalão / Região) para sortear o confronto do draft.');
        return;
      }

      document.getElementById('draft-p1-names').textContent = sideA;
      document.getElementById('draft-p2-names').textContent = sideB;

      document.getElementById('draft-t1-name').textContent = `${pair[0].icon} ${pair[0].name}`;
      document.getElementById('draft-t1-stars').textContent = getStarIcons(pair[0].stars);

      document.getElementById('draft-t2-name').textContent = `${pair[1].icon} ${pair[1].name}`;
      document.getElementById('draft-t2-stars').textContent = getStarIcons(pair[1].stars);

      playBeep(750, 0.2);
    }

