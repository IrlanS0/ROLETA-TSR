// ==================== MODO MD3 (MELHOR DE 3) ====================
// Estado e regras da série MD3: times por jogo (modo "times diferentes"),
// placar, cálculo de vencedor e sincronização com a sala.
// Depende de state.js e ui.js (populateNameSelect, switchTab, playBeep).

    function getNextPendingMD3Game() {
      if (!md3State.g1.saved) return 'g1';
      if (!md3State.g2.saved) return 'g2';
      if (md3State.g3.active && !md3State.g3.saved) return 'g3';
      return null; // nada pendente (série decidida ou aguardando resultado do derradeiro)
    }

    // [BUGFIX] Função central que aplica um confronto sorteado (t1 x t2) ao md3State,
    // respeitando o modo escolhido. Usada tanto pelo botão da Roleta quanto pelo atalho
    // "Sortear Times", pra nunca precisar de um segundo sorteio pra "confirmar" o mesmo jogo.
    // Retorna true se aplicou, ou false se não havia confronto pendente pra receber.
    function assignDrawToMD3(t1, t2) {
      if (!md3State.differentTeams) {
        // Modo padrão: o mesmo confronto vale para os 3 jogos (mando invertido no Jogo 2)
        md3State.g1.team1 = t1; md3State.g1.team2 = t2;
        md3State.g2.team1 = t2; md3State.g2.team2 = t1;
        md3State.g3.team1 = t1; md3State.g3.team2 = t2;
        return true;
      }

      const target = getNextPendingMD3Game();
      if (!target) return false;
      md3State[target].team1 = t1;
      md3State[target].team2 = t2;
      return true;
    }

    // Liga/desliga o modo "times diferentes por confronto".
    // Não reinicia a série: placares e times de jogos já JOGADOS continuam guardados até o Host
    // salvar a série no ranking (ou reiniciar manualmente).
    // [NOVO] Liga/desliga o modo "times diferentes por confronto" com recuperação inteligente.
    function toggleMD3DifferentTeams() {
      if (!currentRoom.isHost) return;
      md3State.differentTeams = document.getElementById('chk-md3-different-teams').checked;

      if (md3State.differentTeams) {
        // Mudando PARA times diferentes (LIGADO):
        // Mantém os times do jogo atual intactos.
        // Limpa apenas o Jogo 2 e Jogo 3 se não estiverem salvos, para obrigar novo sorteio depois.
        if (!md3State.g2.saved) { md3State.g2.team1 = null; md3State.g2.team2 = null; }
        if (!md3State.g3.saved) { md3State.g3.team1 = null; md3State.g3.team2 = null; }
      } else {
        // Voltando PARA o modo normal (DESLIGADO):
        // Propaga os times do Jogo 1 para os Jogos 2 e 3 (se não estiverem salvos).
        // Jogo 2 recebe os times com mando invertido.
        if (md3State.g1.team1 && md3State.g1.team2) {
          if (!md3State.g2.saved) {
            md3State.g2.team1 = md3State.g1.team2;
            md3State.g2.team2 = md3State.g1.team1;
          }
          if (!md3State.g3.saved) {
            md3State.g3.team1 = md3State.g1.team1;
            md3State.g3.team2 = md3State.g1.team2;
          }
        }
      }

      syncMD3State();
      renderMD3UI();
    }

    // [BUGFIX] Atalho do modo "times diferentes": sorteia E já salva os times do confronto
    // pendente em UMA única ação (antes exigia sortear e depois clicar em "Jogar este confronto
    // no Modo MD3" na aba de Sorteio — o que parecia "precisar sortear duas vezes").
    function goDrawTeamsForMD3() {
      if (!currentRoom.isHost || !md3State.differentTeams) return;

      const target = getNextPendingMD3Game();
      if (!target) {
        alert(md3State.completed
          ? 'A série MD3 já foi concluída! Clique em "Reiniciar Série MD3" para começar uma nova.'
          : 'Confirme o placar do confronto atual no Modo MD3 antes de sortear o próximo.');
        return;
      }

      if (roulettePool.length < 2 && removedTeamIds.size > 0 && document.getElementById('chk-remove-drawn').checked) {
        restoreAllRemovedTeams();
      }
      if (roulettePool.length < 2) {
        alert('Times insuficientes com os filtros atuais (Liga / Escalão / Região). Amplie os filtros selecionados para sortear.');
        return;
      }
      const pair = pickBalancedPair();
      if (!pair) {
        alert('Não foi possível formar um confronto com os filtros atuais.');
        return;
      }

      switchTab('roulette');
      displayMatchResult(pair[0], pair[1]); // Mostra o confronto sorteado na tela de Sorteio
      playBeep(700, 0.1);

      // [BUGFIX] Já aplica direto ao jogo pendente do MD3 — sem precisar de um segundo clique
      assignDrawToMD3(pair[0], pair[1]);
      syncMD3State();

      // Como já foi salvo automaticamente, evita que o Host clique de novo achando que falta algo
      const btnMD3 = document.getElementById('btn-send-md3');
      if (btnMD3) {
        btnMD3.disabled = true;
        btnMD3.classList.add('opacity-50', 'cursor-not-allowed');
      }
      const wheelStatus = document.getElementById('wheel-status-text');
      if (wheelStatus) wheelStatus.textContent = '✅ Times sorteados e já salvos no Modo MD3!';
    }

    // [NOVO] Emite o estado atual para o servidor repassar (Apenas HOST)
    function syncMD3State() {
      if (currentRoom.id && currentRoom.isHost) {
        socket.emit('update_md3', { roomId: currentRoom.id, md3State: md3State });
      }
    }

    // [BUGFIX] Emite os rankings (individual e de duplas) atualizados para o servidor repassar à sala (Apenas HOST)

    function renderMD3PlayerOptions() {
      const isHost = currentRoom.isHost;
      const p1Select = document.getElementById('md3-player1-name');
      const p2Select = document.getElementById('md3-player2-name');

      [[p1Select, md3State.player1], [p2Select, md3State.player2]].forEach(([select, currentValue]) => {
        populateNameSelect(select, currentValue);
        select.disabled = !isHost;
      });
    }

    // [BUGFIX] Preenche os selects de membros ao montar uma nova dupla, garantindo que
    // Jogador 1 e Jogador 2 nunca nasçam apontando pro mesmo participante por padrão.

    function renderMD3UI() {
      const isHost = currentRoom.isHost;

      // Nomes dos Jogadores (selects com os participantes da sala)
      renderMD3PlayerOptions();

      // [NOVO] Toggle de "times diferentes" refletido na UI (só o Host pode mexer)
      const chkDiffTeams = document.getElementById('chk-md3-different-teams');
      if (chkDiffTeams) {
        chkDiffTeams.checked = !!md3State.differentTeams;
        chkDiffTeams.disabled = !isHost;
      }

      // [NOVO] Botão de atalho "Sortear Times": só aparece pro Host, no modo "times diferentes",
      // e quando existe um confronto pendente aguardando sorteio.
      const btnDrawNext = document.getElementById('btn-md3-draw-next');
      if (btnDrawNext) {
        const nextTarget = md3State.differentTeams ? getNextPendingMD3Game() : null;
        if (isHost && nextTarget) {
          const gameLabel = nextTarget === 'g3' ? 'o Derradeiro' : (nextTarget === 'g1' ? 'o Jogo 1' : 'o Jogo 2');
          btnDrawNext.innerHTML = `<i data-lucide="dices" class="w-4 h-4"></i> Sortear Times para ${gameLabel}`;
          btnDrawNext.classList.remove('hidden');
          lucide.createIcons();
        } else {
          btnDrawNext.classList.add('hidden');
        }
      }

      // Renderiza Jogos (1, 2 e 3) — cada um com os próprios times, placar e trava
      [1, 2, 3].forEach(i => {
        const g = md3State[`g${i}`];
        const s1Input = document.getElementById(`md3-g${i}-score1`);
        const s2Input = document.getElementById(`md3-g${i}-score2`);
        const status = document.getElementById(`md3-g${i}-status`);
        const btn = document.getElementById(`btn-save-g${i}`);
        const t1NameEl = document.getElementById(`md3-g${i}-t1-name`);
        const t2NameEl = document.getElementById(`md3-g${i}-t2-name`);

        const hasTeams = !!(g.team1 && g.team2);

        // Escudos e Nomes dos Times deste confronto específico
        if (hasTeams) {
          t1NameEl.textContent = g.team1.name;
          t2NameEl.textContent = g.team2.name;
        } else {
          t1NameEl.textContent = (i === 3 && !md3State.g3.active) ? 'Time 1' : 'Aguardando Sorteio...';
          t2NameEl.textContent = (i === 3 && !md3State.g3.active) ? 'Time 2' : 'Aguardando Sorteio...';
        }

        if(document.activeElement !== s1Input) s1Input.value = g.s1 !== null ? g.s1 : '';
        if(document.activeElement !== s2Input) s2Input.value = g.s2 !== null ? g.s2 : '';

        // Status Visual
        if (g.saved) {
          status.textContent = 'Concluído';
          status.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300';
          if(btn) btn.classList.add('hidden');
          s1Input.disabled = true;
          s2Input.disabled = true;
        } else if (!hasTeams) {
          // [NOVO] Confronto ainda não liberado: faltam times sorteados para este jogo específico
          status.textContent = (i === 3 && !md3State.g3.active) ? 'Só se Houver Empate' : 'Aguardando Sorteio';
          status.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-gray-500/20 text-gray-400';
          if(btn) btn.classList.add('hidden');
          s1Input.disabled = true;
          s2Input.disabled = true;
        } else {
          status.textContent = (i === 3 && md3State.g3.active) ? '⚠️ HORA DO DERRADEIRO!' : (i === 3 ? 'Só se Houver Empate' : 'Pendente');
          status.className = (i === 3 && md3State.g3.active) 
            ? 'text-[10px] font-bold px-2 py-0.5 rounded bg-red-500 text-white animate-pulse' 
            : (i === 3 ? 'text-[10px] font-bold px-2 py-0.5 rounded bg-gray-500/20 text-gray-400' : 'text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300');
          
          if(btn) {
              if (isHost) btn.classList.remove('hidden');
              else btn.classList.add('hidden');
          }
          s1Input.disabled = !isHost;
          s2Input.disabled = !isHost;
        }
      });

      // Visibilidade específica do Jogo 3
      const cardG3 = document.getElementById('md3-g3-card');
      const btnG3 = document.getElementById('btn-save-g3');
      const g3HasTeams = !!(md3State.g3.team1 && md3State.g3.team2);
      if (md3State.g3.active) {
        cardG3.classList.remove('opacity-60');
        if (isHost && !md3State.g3.saved && g3HasTeams) {
          btnG3.disabled = false;
          btnG3.classList.remove('opacity-50', 'cursor-not-allowed', 'hidden');
        } else if (!g3HasTeams) {
          // [NOVO] Derradeiro ativo, mas ainda sem times sorteados (modo "times diferentes")
          btnG3.disabled = true;
          btnG3.classList.add('opacity-50', 'cursor-not-allowed');
          document.getElementById('md3-g3-score1').disabled = true;
          document.getElementById('md3-g3-score2').disabled = true;
        }
      } else {
        cardG3.classList.add('opacity-60');
        document.getElementById('md3-g3-score1').disabled = true;
        document.getElementById('md3-g3-score2').disabled = true;
        if(btnG3) {
            btnG3.disabled = true;
            btnG3.classList.add('opacity-50', 'cursor-not-allowed');
        }
      }

      // Textos de Resumo no final da série
      document.getElementById('md3-series-winner-text').textContent = md3State.statusText;
      document.getElementById('md3-series-subtext').textContent = md3State.subText;

      const btnRank = document.getElementById('btn-md3-ranking');
      if (md3State.completed && isHost) {
        btnRank.disabled = false;
        btnRank.classList.remove('opacity-50', 'cursor-not-allowed', 'hidden');
      } else {
        btnRank.disabled = true;
        btnRank.classList.add('opacity-50', 'cursor-not-allowed');
        if(!isHost) btnRank.classList.add('hidden');
      }
    }

    function sendMatchToMD3() {
      if (!currentMatchDraw || !currentRoom.isHost) return;

      const applied = assignDrawToMD3(currentMatchDraw.t1, currentMatchDraw.t2);
      if (!applied) {
        alert(md3State.completed
          ? 'A série MD3 já foi concluída! Clique em "Reiniciar Série MD3" para começar uma nova.'
          : 'Confirme o placar do confronto atual no Modo MD3 antes de sortear o próximo.');
        return;
      }

      syncMD3State();
      renderMD3UI();
      switchTab('md3');
    }

    function saveMD3Game(gameNum) {
      if (!currentRoom.isHost) return;

      const s1Input = document.getElementById(`md3-g${gameNum}-score1`);
      const s2Input = document.getElementById(`md3-g${gameNum}-score2`);
      
      const s1 = parseInt(s1Input.value);
      const s2 = parseInt(s2Input.value);

      if (isNaN(s1) || isNaN(s2)) {
        alert('Por favor, informe os gols de ambos os times.');
        return;
      }

      // 1. Atualiza o objeto do estado local do MD3 (CORRIGIDO para preservar os times)
      md3State[`g${gameNum}`].s1 = s1;
      md3State[`g${gameNum}`].s2 = s2;
      md3State[`g${gameNum}`].saved = true;

      // 2. Recalcula o fluxo da série (se vai pra jogo 3 ou se acabou)
      calculateMD3Outcome(); 

      // 3. Envia o estado atualizado para o servidor sincronizar a sala
      syncMD3State();

      // 4. Atualiza a tela do Host imediatamente
      renderMD3UI();
    }

    function calculateMD3Outcome() {
      const g1 = md3State.g1;
      const g2 = md3State.g2;
      let p1Wins = 0, p2Wins = 0;

      if (g1.saved) {
        if (g1.s1 > g1.s2) p1Wins++;
        else if (g1.s2 > g1.s1) p2Wins++;
      }
      if (g2.saved) {
        if (g2.s2 > g2.s1) p1Wins++;
        else if (g2.s1 > g2.s2) p2Wins++;
      }

      if (g1.saved && g2.saved) {
        // [BUGFIX] MD3 = melhor de 3: quem tiver mais vitórias nos 2 primeiros jogos já vence a série
        // (antes só declarava campeão em caso de 2 a 0, forçando um 3º jogo desnecessário em placares como 1 a 0)
        if (p1Wins > p2Wins) finishMD3Series(md3State.player1);
        else if (p2Wins > p1Wins) finishMD3Series(md3State.player2);
        else {
          md3State.g3.active = true;
          md3State.statusText = 'Empate! Tudo será decidido no Derradeiro!';
        }
      }

      if (md3State.g3.saved) {
        if (md3State.g3.s1 > md3State.g3.s2) finishMD3Series(md3State.player1);
        else if (md3State.g3.s2 > md3State.g3.s1) finishMD3Series(md3State.player2);
      }
    }

    function finishMD3Series(winnerName) {
      md3State.completed = true;
      md3State.winner = winnerName;
      md3State.statusText = `🏆 Campeão: ${winnerName}!`;
      md3State.subText = 'Série encerrada com sucesso.';
    }

      // Ações do Host que modificam e sincronizam o Estado
    function handleMD3NameChange() {
      if (!currentRoom.isHost) return;
      md3State.player1 = document.getElementById('md3-player1-name').value || 'Jogador A';
      md3State.player2 = document.getElementById('md3-player2-name').value || 'Jogador B';
      md3AutoAssignPlayer2 = false; // [NOVO] Host escolheu manualmente; para de auto-atribuir a novos participantes
      syncMD3State();
    }


    function resetMD3Series() {
      md3State = {
        player1: md3State.player1 || 'Jogador A', // mantém os jogadores já selecionados
        player2: md3State.player2 || 'Jogador B',
        differentTeams: !!md3State.differentTeams, // [NOVO] mantém o modo escolhido (mesmos times ou não)
        g1: { team1: null, team2: null, s1: null, s2: null, saved: false },
        g2: { team1: null, team2: null, s1: null, s2: null, saved: false },
        g3: { team1: null, team2: null, s1: null, s2: null, saved: false, active: false },
        completed: false,
        winner: null,
        statusText: 'Série em Andamento',
        subText: 'Preencha os placares dos jogos acima para determinar o campeão da melhor de 3.'
      };

      [1, 2, 3].forEach(i => {
        const s1Input = document.getElementById(`md3-g${i}-score1`);
        const s2Input = document.getElementById(`md3-g${i}-score2`);
        s1Input.value = '';
        s2Input.value = '';
        // Jogos 1 e 2 voltam liberados para o Host; o Jogo 3 só libera se houver empate (feito em renderMD3UI)
        s1Input.disabled = (i === 3) ? true : !currentRoom.isHost;
        s2Input.disabled = (i === 3) ? true : !currentRoom.isHost;
      });

      const cardG3 = document.getElementById('md3-g3-card');
      cardG3.classList.add('opacity-60');

      renderMD3UI();  // [CORREÇÃO] Reaplica todo o estado visual (botões, status, cards) de forma consistente
      syncMD3State(); // [CORREÇÃO] Propaga o reinício da série para todos os participantes da sala
    }


    socket.on('md3_updated', (newState) => {
      md3State = newState;
      renderMD3UI();
    });

    // [BUGFIX] Ouve a atualização dos Rankings em Tempo Real (corrige ranking sumido pro participante)
