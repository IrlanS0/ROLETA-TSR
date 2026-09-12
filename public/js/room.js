// ==================== SALA: LOBBY, SOCKET.IO E CICLO DE VIDA ====================
// Criar/entrar em sala, apelido, todos os handlers socket.on(...) de sala
// (exceto os específicos de md3/ranking/duplas, que ficam em seus módulos),
// transição pra tela do app e saída da sala. Depende de state.js e ui.js.

    function saveNicknameDraft() {
      myNickname = document.getElementById('my-nickname').value.trim();
      updateNicknameGate(); // [NOVO] Trava/libera os botões conforme o apelido é preenchido
    }

    // [NOVO] Campo de apelido é obrigatório: só libera "Criar Sala" e "Entrar em Sala" se estiver preenchido
    function updateNicknameGate() {
      const hasNickname = myNickname.length > 0;
      const btnCreate = document.getElementById('btn-goto-create');
      const btnJoin = document.getElementById('btn-goto-join');
      if (btnCreate) btnCreate.disabled = !hasNickname;
      if (btnJoin) btnJoin.disabled = !hasNickname;
    }

    // Navegação Interna do Lobby
    function switchLobbyView(viewName) {
      document.getElementById('view-lobby-home').classList.add('hidden');
      document.getElementById('view-lobby-create').classList.add('hidden');
      document.getElementById('view-lobby-success').classList.add('hidden');
      document.getElementById('view-lobby-join').classList.add('hidden');
      
      document.getElementById('join-error-msg').classList.add('hidden'); // Limpa erros
      
      document.getElementById(`view-lobby-${viewName}`).classList.remove('hidden');
      lucide.createIcons(); // Recarrega os ícones para as novas telas
    }

    // 1. Criar Sala (Envia requisição com senha opcional)
    function requestCreateRoom() {
      const nickname = document.getElementById('my-nickname').value.trim();
      if (!nickname) {
        alert('Informe seu apelido antes de criar a sala.');
        return;
      }
      myNickname = nickname;
      localStorage.setItem('nickname', myNickname);

      // [NOVO] Jogo é obrigatório: define de qual base de times a sala vai sortear
      const game = document.getElementById('game').value;
      if (!game) {
        alert('Selecione um jogo antes de criar a sala.');
        return;
      }

      const pass = document.getElementById('create-room-pass').value.trim();
      socket.emit('create_room', { password: pass, nickname: myNickname, game });
    }

    // Retorno: Sala Criada com Sucesso
    socket.on('room_created', async (data) => {
      currentRoom.id = data.roomId;
      currentRoom.isHost = true;
      currentRoom.game = data.game || document.getElementById('game').value; // [NOVO]

      // [NOVO] Relaciona o apelido do Host com o Jogador 1 do MD3
      md3State.player1 = myNickname;

      // [NOVO] Inicializa o roster local (só o Host por enquanto)
      roomParticipants = [{ id: socket.id, nickname: myNickname, isHost: true }];

      document.getElementById('created-room-id').textContent = data.roomId;
      switchLobbyView('success');

      // [NOVO] Carrega a base de times do jogo escolhido para esta sala
      await loadTeamsDatabase(currentRoom.game);
      renderDatabase();
      updateRoulettePoolInfo();
      drawRouletteWheel(0);

      renderMD3UI();   // [NOVO] Garante que a tela inicialize perfeitamente
      renderDuplas();  // [NOVO] Mostra o formulário de duplas pro Host
    });

    // Copiar ID para Área de Transferência
    function copyRoomId() {
      if (!currentRoom.id) return;
      navigator.clipboard.writeText(currentRoom.id).then(() => {
        const btn = document.getElementById('btn-copy-id');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="check" class="w-4 h-4 text-emerald-400"></i> Copiado!';
        lucide.createIcons();
        setTimeout(() => {
          btn.innerHTML = originalHtml;
          lucide.createIcons();
        }, 2000);
      });
    }

    // Host clica em Entrar após criar a sala
    function enterAppFromSuccess() {
      transitionToApp();
    }

    // 2. Entrar em Sala Existente
    function requestJoinRoom() {
      const nickname = document.getElementById('my-nickname').value.trim();
      if (!nickname) {
        alert('Informe seu apelido antes de entrar na sala.');
        return;
      }
      myNickname = nickname;
      localStorage.setItem('nickname', myNickname);

      const roomIdInput = document.getElementById('join-room-id').value.trim().toUpperCase();
      const passInput = document.getElementById('join-room-pass').value.trim();
      
      if (!roomIdInput) {
        showJoinError('Por favor, informe o ID da Sala.');
        return;
      }
      socket.emit('join_room', { roomId: roomIdInput, password: passInput, nickname: myNickname });
    }

    // Retorno: Sucesso ao Entrar
    socket.on('room_joined', async (data) => {
      currentRoom.id = data.roomId;
      currentRoom.isHost = false;
      currentRoom.game = data.game || 'fc26'; // [NOVO] Jogo definido pelo Host desta sala

      // [NOVO] Recebe o estado do MD3 caso ele já esteja rolando
      if (data.md3State) {
          md3State = data.md3State;
      } else {
          // [NOVO] Sala nova: relaciona os apelidos de Host e Participante com os Jogadores do MD3
          md3State.player1 = data.hostNickname || 'Jogador A';
          md3State.player2 = myNickname;
      }

      // [NOVO] Recebe o roster de participantes da sala
      roomParticipants = data.participants || [{ id: socket.id, nickname: myNickname, isHost: false }];

      // [NOVO] Recebe as duplas já cadastradas na sala
      duplas = data.duplas || [];

      // [BUGFIX] Recebe os rankings já existentes na sala, senão ficam vazios só para o participante
      rankingStats = data.rankingStats || {};
      duplaRankingStats = data.duplaRankingStats || {};

      // [NOVO] Carrega a base de times do jogo definido pelo Host, antes de abrir a sala
      await loadTeamsDatabase(currentRoom.game);
      renderDatabase();
      updateRoulettePoolInfo();
      drawRouletteWheel(0);

      transitionToApp();
      renderMD3UI();     // [NOVO] Pinta a tela do participante com os dados recebidos
      renderDuplas();    // [NOVO] Mostra as duplas já cadastradas na sala
      renderRanking();   // [BUGFIX] Garante que as tabelas de ranking apareçam para o participante
    });

    // [NOVO] Controla se um novo participante deve virar automaticamente o Jogador B

    socket.on('participant_joined', (data) => {
      if (!currentRoom.isHost) return;
      // Só auto-atribui se o Host ainda não escolheu manualmente e a série não começou
      if (md3AutoAssignPlayer2 && !md3State.g1.saved && !md3State.g2.saved) {
        md3State.player2 = data.nickname || 'Jogador B';
        syncMD3State();  // Repassa o novo nome do Jogador 2 para todos da sala
        renderMD3UI();
      }
    });

    // [NOVO] Atualiza o roster de participantes exibido nos selects de nome do MD3
    socket.on('room_participants_updated', (data) => {
      roomParticipants = data.participants || [];
      renderMD3PlayerOptions();
      renderDuplas(); // [BUGFIX] Atualiza os selects de duplas quando alguém entra/sai da sala
    });

    // [NOVO] Ouve a atualização do Host em Tempo Real

    socket.on('room_error', (data) => {
      showJoinError(data.message);
    });


    function showJoinError(message) {
      const errorDiv = document.getElementById('join-error-msg');
      errorDiv.classList.remove('hidden');
      errorDiv.querySelector('span').textContent = message;
    }

    // 3. Transição Visual: Lobby -> App Principal

    function transitionToApp() {
      document.getElementById('lobby-screen').classList.add('hidden');
      document.getElementById('app-content').classList.remove('hidden');
      document.getElementById('app-content').classList.add('flex');

      document.getElementById('display-room-id').textContent = currentRoom.id;
      document.getElementById('display-my-nickname').textContent = myNickname; // [NOVO]
      const roleDisplay = document.getElementById('display-room-role');
      const testBtn = document.getElementById('btn-send-test');
      const resetBtn = document.getElementById('btn-reset-md3');
      // [BUGFIX] Apenas o Host pode lançar partidas avulsas e zerar o ranking (mantém a sala consistente)
      const btnLogRoulette = document.getElementById('btn-log-match');
      const btnLogRanking = document.getElementById('btn-log-match-ranking');
      const btnResetRanking = document.getElementById('btn-reset-ranking');
      
      if (currentRoom.isHost) {
        roleDisplay.textContent = 'HOST';
        roleDisplay.className = 'text-emerald-400';
        testBtn.classList.remove('hidden'); 
        resetBtn.style.display = 'flex';
        btnLogRanking.classList.remove('hidden');
        btnResetRanking.classList.remove('hidden');
      } else {
        roleDisplay.textContent = 'PARTICIPANTE';
        roleDisplay.className = 'text-amber-400';
        testBtn.classList.add('hidden'); 
        resetBtn.style.display = 'none';
        btnLogRanking.classList.add('hidden');
        btnResetRanking.classList.add('hidden');
        btnLogRoulette.classList.add('hidden');
      }
      lucide.createIcons();
    }

    // 4. Sair da Sala e Voltar pro Lobby

    function leaveRoom() {
      if(currentRoom.id) {
        socket.emit('leave_room', currentRoom.id);
      }
      
      // Reseta estado local
      currentRoom.id = null;
      currentRoom.isHost = false;
      
      // Limpa os inputs
      document.getElementById('create-room-pass').value = '';
      document.getElementById('join-room-id').value = '';
      document.getElementById('join-room-pass').value = '';

      // Transição Visual: App Principal -> Lobby Home
      document.getElementById('app-content').classList.add('hidden');
      document.getElementById('app-content').classList.remove('flex');
      document.getElementById('lobby-screen').classList.remove('hidden');
      
      switchLobbyView('home');
    }

    // ==================== [NOVO] PAINEL DE INFORMAÇÕES DA SALA (DROPDOWN NO NAV) ====================

    function sendTestToRoom() {
      if (currentRoom.isHost && currentRoom.id) {
        socket.emit('send_test', { roomId: currentRoom.id, message: 'Ping do Host enviado com sucesso!' });
      }
    }

    socket.on('test_received', (msg) => {
      alert(`[MENSAGEM DA SALA]\n${msg}`);
    });

