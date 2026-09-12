// ==================== RANKING GERAL E DE DUPLAS ====================
// Gravação de resultados (roleta, MD3 ou lançamento manual), cálculo das
// tabelas de ranking (individual e duplas) e sincronização com a sala.
// Depende de state.js, ui.js (populateNameSelect, switchTab) e duplas.js.

    function syncRanking() {
      if (currentRoom.id && currentRoom.isHost) {
        socket.emit('update_ranking', { roomId: currentRoom.id, rankingStats: rankingStats, duplaRankingStats: duplaRankingStats });
      }
    }

    // [NOVO] Roster de participantes da sala (recebido do servidor via 'room_participants_updated')

    function recordMatchResult(p1, s1, p2, s2, isMD3TitleWinner = null) {
      if (!currentRoom.isHost) return; // [BUGFIX] Só o Host grava resultados; evita ranking divergente entre sala

      // [NOVO] Se algum dos dois nomes for uma dupla cadastrada, o confronto vale pro ranking de duplas
      const isDuplaMatch = duplas.some(d => d.name === p1) || duplas.some(d => d.name === p2);
      const target = isDuplaMatch ? duplaRankingStats : rankingStats;

      function initPlayer(name) {
        if (!target[name]) {
          target[name] = { pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, titles: 0 };
        }
      }

      initPlayer(p1);
      initPlayer(p2);

      target[p1].j += 1;
      target[p2].j += 1;

      target[p1].gp += s1;
      target[p1].gc += s2;

      target[p2].gp += s2;
      target[p2].gc += s1;

      if (s1 > s2) {
        target[p1].v += 1;
        target[p1].pts += 3;
        target[p2].d += 1;
      } else if (s2 > s1) {
        target[p2].v += 1;
        target[p2].pts += 3;
        target[p1].d += 1;
      } else {
        target[p1].e += 1;
        target[p1].pts += 1;
        target[p2].e += 1;
        target[p2].pts += 1;
      }

      if (isMD3TitleWinner && target[isMD3TitleWinner]) {
        target[isMD3TitleWinner].titles += 1;
      }

      renderRanking();
      syncRanking(); // [BUGFIX] Repassa os rankings atualizados para todos da sala (inclui participantes)
    }

    // [NOVO] Soma o título do confronto MD3 para quem venceu a série, independente de ter ido ao 3º jogo
    function awardMD3Title(winnerName) {
      if (!winnerName) return;

      const isDuplaMatch = duplas.some(d => d.name === winnerName);
      const target = isDuplaMatch ? duplaRankingStats : rankingStats;

      if (!target[winnerName]) {
        target[winnerName] = { pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, titles: 0 };
      }
      target[winnerName].titles += 1;

      renderRanking();
      syncRanking();
    }

    function applyMD3ToRanking() {
      if (!md3State.completed) return;

      const p1 = document.getElementById('md3-player1-name').value || 'Jogador A';
      const p2 = document.getElementById('md3-player2-name').value || 'Jogador B';

      if (md3State.g1.saved) recordMatchResult(p1, md3State.g1.s1, p2, md3State.g1.s2);
      if (md3State.g2.saved) recordMatchResult(p2, md3State.g2.s1, p1, md3State.g2.s2);
      if (md3State.g3.saved) recordMatchResult(p1, md3State.g3.s1, p2, md3State.g3.s2);

      // [BUGFIX] Antes o título só era contado quando a série ia ao 3º jogo; agora vai
      // sempre para quem venceu o confronto (md3State.winner), não importa como terminou.
      awardMD3Title(md3State.winner);

      // [CORREÇÃO DE BUG] Depois de salvar a série no ranking, ela ficava "completa"
      // para sempre — os placares e o time sorteado continuavam na tela e os inputs
      // ficavam travados, impedindo iniciar uma nova série. Agora reinicia automaticamente.
      resetMD3Series();

      switchTab('ranking');
    }

    // [NOVO] Transforma um objeto de estatísticas em uma lista ordenada pronta pra exibir
    function buildRankingRows(stats) {
      const players = Object.keys(stats).map(name => {
        const p = stats[name];
        const sg = p.gp - p.gc;
        const maxPts = p.j * 3;
        const aproveitamento = maxPts > 0 ? ((p.pts / maxPts) * 100).toFixed(0) : 0;
        return { name, ...p, sg, aproveitamento };
      });
      players.sort((a, b) => b.pts - a.pts || b.v - a.v || b.sg - a.sg || b.gp - a.gp);
      return players;
    }

    // [NOVO] Pinta uma tabela de ranking (individual ou de duplas) num <tbody> específico
    function renderRankingTableInto(tbodyId, players, emptyMessage) {
      const tbody = document.getElementById(tbodyId);
      tbody.innerHTML = '';

      if (players.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="12" class="py-8 text-center text-gray-500 italic">${emptyMessage}</td>
          </tr>
        `;
        return;
      }

      players.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-white/5 transition border-b border-white/5';
        tr.innerHTML = `
          <td class="py-3 px-4 text-center font-bold ${idx === 0 ? 'text-amber-400' : 'text-gray-400'}">${idx + 1}º</td>
          <td class="py-3 px-4 font-bold text-white flex items-center gap-2">
            ${idx === 0 ? '👑' : ''} ${p.name}
          </td>
          <td class="py-3 px-3 text-center font-black text-amber-400">${p.pts}</td>
          <td class="py-3 px-3 text-center text-gray-300">${p.j}</td>
          <td class="py-3 px-3 text-center text-emerald-400">${p.v}</td>
          <td class="py-3 px-3 text-center text-gray-400">${p.e}</td>
          <td class="py-3 px-3 text-center text-red-400">${p.d}</td>
          <td class="py-3 px-3 text-center text-gray-300">${p.gp}</td>
          <td class="py-3 px-3 text-center text-gray-400">${p.gc}</td>
          <td class="py-3 px-3 text-center font-bold ${p.sg >= 0 ? 'text-emerald-400' : 'text-red-400'}">${p.sg > 0 ? '+' : ''}${p.sg}</td>
          <td class="py-3 px-3 text-center text-amber-300 font-bold">${p.aproveitamento}%</td>
          <td class="py-3 px-3 text-center font-extrabold text-amber-400">${p.titles > 0 ? '🏆 ' + p.titles : '-'}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    function renderRanking() {
      renderRankingTableInto('ranking-tbody', buildRankingRows(rankingStats), 'Nenhum confronto registrado ainda. Sorteie na roleta ou jogue o Modo MD3!');
      renderRankingTableInto('ranking-duplas-tbody', buildRankingRows(duplaRankingStats), 'Nenhuma dupla registrou partidas ainda. Cadastre duplas acima e lance um placar avulso.');
    }

    function confirmResetRanking() {
      if (!currentRoom.isHost) return; // [BUGFIX] Só o Host reseta o ranking da sala
      rankingStats = {};
      duplaRankingStats = {}; // [NOVO] Zera também o ranking de duplas
      renderRanking();
      syncRanking(); // [BUGFIX] Repassa o reset para todos da sala
    }

    function openLogMatchModal() {
      // [NOVO] Popula os selects com jogadores da sala e duplas cadastradas
      populateNameSelect(document.getElementById('log-p1-name'), null);
      populateNameSelect(document.getElementById('log-p2-name'), null);
      document.getElementById('log-p1-score').value = '';
      document.getElementById('log-p2-score').value = '';
      document.getElementById('modal-log-match').classList.remove('hidden');
      document.getElementById('modal-log-match').classList.add('flex');
    }

    function closeLogMatchModal() {
      document.getElementById('modal-log-match').classList.add('hidden');
      document.getElementById('modal-log-match').classList.remove('flex');
    }

    function saveManualMatchToRanking() {
      const p1 = document.getElementById('log-p1-name').value || 'Jogador 1';
      const p2 = document.getElementById('log-p2-name').value || 'Jogador 2';
      const s1 = parseInt(document.getElementById('log-p1-score').value) || 0;
      const s2 = parseInt(document.getElementById('log-p2-score').value) || 0;

      recordMatchResult(p1, s1, p2, s2);
      closeLogMatchModal();
      switchTab('ranking');
    }


    socket.on('ranking_updated', (newStats) => {
      rankingStats = (newStats && newStats.rankingStats) || {};
      duplaRankingStats = (newStats && newStats.duplaRankingStats) || {};
      renderRanking();
    });

    // [NOVO] Ouve a atualização das Duplas em Tempo Real
