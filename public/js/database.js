// ==================== CATÁLOGO DE JOGOS E BASE DE TIMES ====================
// Carrega games.json e o arquivo de times do jogo escolhido pela sala,
// interpreta os formatos suportados (Ligas / FC26) e renderiza a aba
// "Catálogo de Times". Depende de state.js e ui.js (getStarIcons).

    async function loadGamesCatalog() {
      try {
        const response = await fetch('../data/games.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        GAMES_CATALOG = data.jogos || {};

        const select = document.getElementById('game');
        if (select && Object.keys(GAMES_CATALOG).length > 0) {
          select.innerHTML = '<option value="" disabled selected>Selecione um jogo...</option>';
          Object.entries(GAMES_CATALOG).forEach(([key, info]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = info.nome || key;
            select.appendChild(opt);
          });
        }
        console.log(`[JOGOS] Catálogo carregado: ${Object.keys(GAMES_CATALOG).length} jogo(s).`);
      } catch (err) {
        // Se o games.json não carregar, mantém as opções fixas já presentes no HTML como fallback
        console.error('[JOGOS] Falha ao carregar games.json, usando opções fixas:', err);
      }
    }

    // Baixa e converte o .json do jogo escolhido para o formato usado pelo app.
    // Cada jogo pode ter um formato de arquivo diferente — a função detecta a forma dos dados
    // e escolhe o parser correto (ver parseLigasFormat / parseFc26Format).
    async function loadTeamsDatabase(gameKey) {
      TEAMS = [];
      teamsDatabaseLoaded = false;

      const gameInfo = GAMES_CATALOG[gameKey];
      const fileName = (gameInfo && gameInfo.arquivo) || `${gameKey}.json`;

      try {
        const response = await fetch(`../data/${fileName}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        let teams = [];
        if (Array.isArray(data.ligas)) {
          // Formato usado pelo gogoszConmebol: { ligas: [ { liga, times: [{nome, estrelas}] } ] }
          teams = parseLigasFormat(data.ligas);
        } else if (data.times || data.selecoes) {
          // [NOVO] Formato do fc26 (ainda em padronização): { times: {liga: [...]}, selecoes: {regiao: [...]} }
          teams = parseFc26Format(data);
        } else {
          console.warn(`[TIMES] Formato desconhecido em ${fileName}; nenhum time foi carregado.`);
        }

        TEAMS = teams;
        teamsDatabaseLoaded = true;
        console.log(`[TIMES] Base carregada (${gameKey}): ${TEAMS.length} times.`);
      } catch (err) {
        console.error(`[TIMES] Falha ao carregar a base de times de "${fileName}":`, err);
        TEAMS = [];
        teamsDatabaseLoaded = false;
        alert(`Não foi possível carregar a base de times do jogo selecionado (${fileName}). Verifique se o arquivo está publicado junto com o site.`);
      }
    }

    // Formato "ligas": usado hoje pelo gogoszConmebol.json
    function parseLigasFormat(ligas) {
      const teams = [];
      (ligas || []).forEach(liga => {
        const meta = LEAGUE_META[liga.liga] || {
          code: liga.liga.replace(/[^A-Z0-9]+/gi, '_').toUpperCase().slice(0, 12),
          leagueName: liga.liga,
          region: 'ALL',
          flag: '⚽'
        };

        (liga.times || []).forEach((time, idx) => {
          teams.push({
            id: `${meta.code.toLowerCase()}_${String(idx + 1).padStart(2, '0')}`,
            name: time.nome,
            stars: time.estrelas,
            league: meta.code,
            leagueName: meta.leagueName,
            region: meta.region,
            icon: meta.flag
          });
        });
      });
      return teams;
    }

    // [NOVO] Formato ainda provisório do fc26 — clubes em "times" (por liga) e seleções em
    // "selecoes" (por região). Os arrays do arquivo atual ainda estão vazios; quando forem
    // preenchidos, cada time deve ter ao menos um nome (string simples ou {nome, estrelas}).
    function parseFc26Format(data) {
      const teams = [];
      const pushGroup = (groupObj, regionFallback) => {
        Object.entries(groupObj || {}).forEach(([groupName, list]) => {
          const meta = LEAGUE_META[groupName] || {
            code: groupName.replace(/[^A-Z0-9]+/gi, '_').toUpperCase().slice(0, 12),
            leagueName: groupName,
            region: regionFallback,
            flag: '⚽'
          };

          (list || []).forEach((time, idx) => {
            const nome = typeof time === 'string' ? time : (time && (time.nome || time.name));
            if (!nome) return; // Ignora entradas vazias/sem nome (formato ainda não padronizado)
            const estrelas = typeof time === 'object' && time ? (time.estrelas || time.stars) : undefined;
            teams.push({
              id: `${meta.code.toLowerCase()}_${String(idx + 1).padStart(2, '0')}`,
              name: nome,
              stars: estrelas || 3, // Placeholder até o arquivo trazer a nota real de cada time
              league: meta.code,
              leagueName: meta.leagueName,
              region: meta.region,
              icon: meta.flag
            });
          });
        });
      };
      pushGroup(data.times, 'CLUBES');
      pushGroup(data.selecoes, 'SELECOES');
      return teams;
    }


    function renderDatabase() {
      const grid = document.getElementById('db-teams-grid');
      const query = document.getElementById('db-search').value.toLowerCase();
      grid.innerHTML = '';

      const filtered = TEAMS.filter(t => 
        t.name.toLowerCase().includes(query) || 
        t.leagueName.toLowerCase().includes(query) ||
        t.region.toLowerCase().includes(query)
      );

      filtered.forEach(team => {
        const card = document.createElement('div');
        card.className = 'glass-card p-4 rounded-xl space-y-2 border border-white/5 hover:border-amber-500/40 transition';
        card.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-2xl">${team.icon}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">${team.region}</span>
          </div>
          <h4 class="font-bold text-white text-base leading-tight">${team.name}</h4>
          <p class="text-xs text-gray-400 truncate">${team.leagueName}</p>
          <div class="text-xs text-amber-400 font-bold">${getStarIcons(team.stars)}</div>
        `;
        grid.appendChild(card);
      });
    }