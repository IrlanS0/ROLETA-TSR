// ==================== UTILITÁRIOS DE UI COMPARTILHADOS ====================
// Funções genéricas usadas por vários módulos: troca de abas, som de beep,
// preenchimento de <select> com jogadores/duplas, ícones de estrela e o
// dropdown de informações da sala. Depende de state.js.

    function populateNameSelect(select, currentValue) {
      const individualNames = [...new Set(roomParticipants.map(p => p.nickname))];
      const duplaNames = [...new Set(duplas.map(d => d.name))];

      if (currentValue && !individualNames.includes(currentValue) && !duplaNames.includes(currentValue)) {
        individualNames.push(currentValue); // Mantém visível um nome antigo mesmo que não exista mais
      }

      select.innerHTML = '';

      const groupPlayers = document.createElement('optgroup');
      groupPlayers.label = 'Jogadores';
      individualNames.forEach(name => groupPlayers.appendChild(new Option(name, name)));
      select.appendChild(groupPlayers);

      if (duplaNames.length > 0) {
        const groupDuplas = document.createElement('optgroup');
        groupDuplas.label = 'Duplas';
        duplaNames.forEach(name => groupDuplas.appendChild(new Option(name, name)));
        select.appendChild(groupDuplas);
      }

      select.value = currentValue || individualNames[0] || '';
    }

    // [NOVO] Preenche os selects de Jogador A / Jogador B (MD3) com quem está na sala e as duplas cadastradas.
    // Só o Host pode alterar; o valor salvo é preservado mesmo se a pessoa já não estiver mais na sala.

    function switchTab(tabId) {
      currentTab = tabId;
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.getElementById(`view-${tabId}`).classList.remove('hidden');

      document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-amber-500', 'text-black', 'shadow-md');
        btn.classList.add('text-gray-400');
      });

      const activeBtn = document.getElementById(`tab-${tabId}`);
      if (activeBtn) {
        activeBtn.classList.add('bg-amber-500', 'text-black', 'shadow-md');
        activeBtn.classList.remove('text-gray-400');
      }
    }


    function playBeep(freq = 440, duration = 0.05) {
      if (!document.getElementById('chk-sound').checked) return;
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      } catch(e){}
    }


    function getStarIcons(stars) {
      const full = Math.floor(stars);
      const half = stars % 1 !== 0;
      let str = '⭐'.repeat(full);
      if (half) str += '✨';
      return str;
    }
    
    // [CORREÇÃO DE BUG] resetMD3Series ficava incompleto: não recriava statusText/subText/g3.active,
    // não reabilitava os inputs de placar (ficavam travados após um jogo salvo), não repassava a
    // atualização de UI via renderMD3UI() e não sincronizava o reset com os demais da sala.

    function toggleRoomInfoPanel() {
      const panel = document.getElementById('room-info-panel');
      panel.classList.toggle('hidden');
    }

    // Fecha o painel ao clicar fora dele
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('room-info-panel');
      const btn = document.getElementById('btn-room-info');
      if (!panel || panel.classList.contains('hidden')) return;
      if (!panel.contains(e.target) && e.target !== btn) {
        panel.classList.add('hidden');
      }
    });

    // Evento de Teste (Ping) mantido da Etapa 1
