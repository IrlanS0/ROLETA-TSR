// ==================== ROLETA BALANCEADA (SORTEIO DE CONFRONTOS) ====================
// Filtro do pool de times, giro da roleta, sorteio balanceado e exibição
// do confronto sorteado. Depende de state.js e ui.js (playBeep, getStarIcons).

    function getFilteredTeams() {
      const leagueFilter = document.getElementById('league-filter').value;
      const starFilter = document.getElementById('star-filter').value;
      const regionFilter = document.getElementById('region-filter').value;

      return TEAMS.filter(t => {
        if (removedTeamIds.has(t.id)) return false;
        if (leagueFilter !== 'ALL' && t.league !== leagueFilter) return false;
        if (starFilter !== 'ALL' && t.stars !== parseFloat(starFilter)) return false;
        if (regionFilter !== 'ALL' && t.region !== regionFilter) return false;
        return true;
      });
    }

    function updateRoulettePoolInfo() {
      roulettePool = getFilteredTeams();
      const badge = document.getElementById('pool-count-badge');
      badge.textContent = `${roulettePool.length} equipes`;
      drawRouletteWheel(0);
    }

    function restoreAllRemovedTeams() {
      removedTeamIds.clear();
      updateRoulettePoolInfo();
      playBeep(600, 0.15);
    }

    function drawRouletteWheel(rotationAngle = 0) {
      const canvas = document.getElementById('roulette-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = width / 2 - 10;

      ctx.clearRect(0, 0, width, height);

      // [CORREÇÃO DE BUG] A roleta deve desenhar sempre o pool já filtrado — nunca
      // a base inteira — para não sugerir visualmente times fora dos filtros ativos.
      const items = roulettePool;
      if (items.length === 0) {
        ctx.fillStyle = '#6B7280';
        ctx.font = 'bold 13px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Nenhum time com os filtros atuais', centerX, centerY);
        return;
      }
      const displayItems = items.length > 24 ? items.slice(0, 24) : items;
      const sliceAngle = (Math.PI * 2) / displayItems.length;

      const colors = ['#FFB800', '#1C202C', '#C78F00', '#2B3042', '#00E676', '#161820'];

      displayItems.forEach((team, idx) => {
        const start = rotationAngle + idx * sliceAngle;
        const end = start + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, start, end);
        ctx.closePath();

        ctx.fillStyle = colors[idx % colors.length];
        ctx.fill();
        ctx.strokeStyle = '#0B0C10';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(start + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = (idx % 2 === 0) ? '#000000' : '#FFFFFF';
        ctx.font = 'bold 11px Inter';
        ctx.fillText(`${team.icon} ${team.name.substring(0, 13)}`, radius - 15, 4);
        ctx.restore();
      });
    }


    function pickBalancedPair() {
      // [CORREÇÃO DE BUG] O sorteio deve respeitar SEMPRE o pool já filtrado (roulettePool).
      // Antes, quando o pool filtrado tinha menos de 2 times, o código caía para
      // TEAMS (a base inteira, sem filtro nenhum), fazendo o sorteio ignorar
      // completamente a Liga/Escalão/Região selecionados pelo usuário.
      const pool = roulettePool;
      if (pool.length < 2) return null;

      const balanceMode = document.getElementById('balance-mode').value;

      let t1 = pool[Math.floor(Math.random() * pool.length)];
      let candidates = pool.filter(t => t.id !== t1.id);

      if (balanceMode === 'EXACT') {
        candidates = candidates.filter(t => t.stars === t1.stars);
      } else if (balanceMode === 'FAIR') {
        candidates = candidates.filter(t => Math.abs(t.stars - t1.stars) <= 0.5);
      } else if (balanceMode === 'EURO_LATAM') {
        const targetRegion = t1.region === 'UEFA' ? 'CONMEBOL' : 'UEFA';
        candidates = candidates.filter(t => t.region === targetRegion && Math.abs(t.stars - t1.stars) <= 0.5);
      }

      // Se ninguém no pool atende ao critério de equilíbrio (ex.: EURO_LATAM sem
      // times da região oposta no pool filtrado), relaxamos apenas o critério de
      // equilíbrio — mas continuamos restritos ao pool filtrado, nunca à base inteira.
      if (candidates.length === 0) {
        candidates = pool.filter(t => t.id !== t1.id);
      }

      let t2 = candidates[Math.floor(Math.random() * candidates.length)];
      return [t1, t2];
    }

    function spinRoulette() {
      if (isSpinning) return;

      // Se o pool ficou pequeno só por causa dos times já sorteados/removidos, tenta recuperar
      if (roulettePool.length < 2 && removedTeamIds.size > 0 && document.getElementById('chk-remove-drawn').checked) {
        restoreAllRemovedTeams();
      }

      // [CORREÇÃO DE BUG] Se mesmo assim não houver times suficientes com os filtros
      // atuais, avisa o usuário em vez de sortear de qualquer time da base inteira.
      if (roulettePool.length < 2) {
        alert('Times insuficientes com os filtros atuais (Liga / Escalão / Região). Amplie os filtros selecionados para sortear.');
        return;
      }

      isSpinning = true;
      document.getElementById('btn-spin').disabled = true;
      document.getElementById('wheel-status-text').textContent = 'Girando a Roleta...';

      const pair = pickBalancedPair();
      if (!pair) {
        isSpinning = false;
        document.getElementById('btn-spin').disabled = false;
        document.getElementById('wheel-status-text').textContent = 'Pronto para o sorteio.';
        alert('Não foi possível formar um confronto com os filtros atuais.');
        return;
      }
      const team1 = pair[0];
      const team2 = pair[1];

      let currentAngle = 0;
      let speed = 0.4;
      let ticks = 0;

      const spinInterval = setInterval(() => {
        currentAngle += speed;
        speed *= 0.975;
        ticks++;

        drawRouletteWheel(currentAngle);
        if (ticks % 3 === 0) playBeep(500 + Math.random() * 200, 0.03);

        if (speed < 0.005) {
          clearInterval(spinInterval);
          isSpinning = false;
          document.getElementById('btn-spin').disabled = false;
          document.getElementById('wheel-status-text').textContent = 'Sorteio Concluído!';
          playBeep(880, 0.3);

          displayMatchResult(team1, team2);
        }
      }, 30);
    }

    function quickDrawMatch() {
      // Mesma correção do sorteio principal: nunca ignorar os filtros selecionados
      if (roulettePool.length < 2 && removedTeamIds.size > 0) {
        restoreAllRemovedTeams();
      }
      if (roulettePool.length < 2) {
        alert('Times insuficientes com os filtros atuais (Liga / Escalão / Região). Amplie os filtros selecionados para sortear.');
        return;
      }
      const pair = pickBalancedPair();
      if (!pair) return;
      displayMatchResult(pair[0], pair[1]);
      playBeep(700, 0.1);
    }

    function displayMatchResult(t1, t2) {
      currentMatchDraw = { t1, t2 };

      document.getElementById('res-team1-logo').textContent = t1.icon;
      document.getElementById('res-team1-name').textContent = t1.name;
      document.getElementById('res-team1-meta').textContent = `${t1.leagueName} (${t1.region})`;
      document.getElementById('res-team1-stars').textContent = getStarIcons(t1.stars);

      document.getElementById('res-team2-logo').textContent = t2.icon;
      document.getElementById('res-team2-name').textContent = t2.name;
      document.getElementById('res-team2-meta').textContent = `${t2.leagueName} (${t2.region})`;
      document.getElementById('res-team2-stars').textContent = getStarIcons(t2.stars);

      const diff = Math.abs(t1.stars - t2.stars);
      const badge = document.getElementById('result-tier-badge');
      if (diff === 0) {
        badge.textContent = '⚖️ Equilíbrio Perfeito (Tiers Iguais)';
        badge.className = 'text-xs font-bold px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      } else if (diff <= 0.5) {
        badge.textContent = '⚔️ Confronto Justo (Dif. 0.5 Estrela)';
        badge.className = 'text-xs font-bold px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30';
      } else {
        badge.textContent = '🎲 Caos Aberto';
        badge.className = 'text-xs font-bold px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30';
      }

      if (document.getElementById('chk-remove-drawn').checked) {
        removedTeamIds.add(t1.id);
        removedTeamIds.add(t2.id);
        updateRoulettePoolInfo();
      }

      const btnMD3 = document.getElementById('btn-send-md3');
      const btnLog = document.getElementById('btn-log-match');
      
      btnMD3.disabled = false;
      btnMD3.classList.remove('opacity-50', 'cursor-not-allowed');

      btnLog.disabled = false;
      btnLog.classList.remove('opacity-50', 'cursor-not-allowed');
    }

