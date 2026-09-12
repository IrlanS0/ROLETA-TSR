// ==================== ESTADO GLOBAL DA APLICAÇÃO ====================
// Todas as variáveis compartilhadas entre os módulos (TEAMS, md3State, rankingStats,
// duplas, currentRoom, myNickname etc.) e a conexão com o Socket.IO.
// Precisa ser o PRIMEIRO <script> carregado: os outros módulos usam essas variáveis
// e o objeto `socket` direto, sem import/export (scripts clássicos, mesmo escopo global).

    // Base de times carregada dinamicamente conforme o jogo escolhido na criação da sala
    let TEAMS = [];
    let teamsDatabaseLoaded = false;

    // [NOVO] Catálogo de jogos disponíveis, carregado de data/games.json
    let GAMES_CATALOG = {};

    // Metadados de cada liga do JSON: código usado nos filtros, nome de exibição,
    // região (para o filtro de continente) e ícone/bandeira exibidos nos cards.
    const LEAGUE_META = {
      'ARGENTINA — Liga Profesional de Fútbol':    { code: 'ARG_LFP', leagueName: 'Liga Profesional (ARG)',   region: 'CONMEBOL', flag: '🇦🇷' },
      'ARGENTINA — Primera Nacional (2ª divisão)': { code: 'ARG_PN',  leagueName: 'Primera Nacional (ARG)',   region: 'CONMEBOL', flag: '🇦🇷' },
      'BOLÍVIA — División Profesional':            { code: 'BOL_DIV', leagueName: 'División Profesional (BOL)', region: 'CONMEBOL', flag: '🇧🇴' },
      'BRASIL — Brasileirão Série A':              { code: 'BRA_SA',  leagueName: 'Brasileirão Série A',      region: 'CONMEBOL', flag: '🇧🇷' },
      'BRASIL — Brasileirão Série B':              { code: 'BRA_SB',  leagueName: 'Brasileirão Série B',      region: 'CONMEBOL', flag: '🇧🇷' },
      'BRASIL — Brasileirão Série C':              { code: 'BRA_SC',  leagueName: 'Brasileirão Série C',      region: 'CONMEBOL', flag: '🇧🇷' },
      'BRASIL — Brasileirão Série D':              { code: 'BRA_SD',  leagueName: 'Brasileirão Série D',      region: 'CONMEBOL', flag: '🇧🇷' },
      'CHILE — Primera División / Campeonato Itaú':{ code: 'CHI_PD',  leagueName: 'Primera División (CHI)',    region: 'CONMEBOL', flag: '🇨🇱' },
      'COLÔMBIA — Liga BetPlay DIMAYOR':           { code: 'COL_LBP', leagueName: 'Liga BetPlay DIMAYOR (COL)', region: 'CONMEBOL', flag: '🇨🇴' },
      'EQUADOR — LigaPro Serie A':                 { code: 'ECU_LPA', leagueName: 'LigaPro Serie A (ECU)',    region: 'CONMEBOL', flag: '🇪🇨' },
      'PARAGUAI — Primera División':               { code: 'PAR_PD',  leagueName: 'Primera División (PAR)',   region: 'CONMEBOL', flag: '🇵🇾' },
      'PERU — Liga 1':                             { code: 'PER_L1',  leagueName: 'Liga 1 (PER)',             region: 'CONMEBOL', flag: '🇵🇪' },
      'URUGUAI — Primera División':                { code: 'URU_PD',  leagueName: 'Primera División (URU)',   region: 'CONMEBOL', flag: '🇺🇾' },
      'VENEZUELA — Liga Venezuela':                { code: 'VEN_LV',  leagueName: 'Liga Venezuela',           region: 'CONMEBOL', flag: '🇻🇪' },
      'COSTA RICA — Liga Promerica':               { code: 'CRC_LP',  leagueName: 'Liga Promerica (CRC)',     region: 'CONCACAF', flag: '🇨🇷' },
      'ESTADOS UNIDOS / CANADÁ — MLS':             { code: 'USA_MLS', leagueName: 'MLS (EUA/CAN)',            region: 'CONCACAF', flag: '🇺🇸' },
      'MÉXICO — Liga MX':                          { code: 'MEX_LMX', leagueName: 'Liga MX (MEX)',            region: 'CONCACAF', flag: '🇲🇽' },
      'ALEMANHA — Bundesliga':                     { code: 'GER_BL',  leagueName: 'Bundesliga (GER)',         region: 'UEFA',     flag: '🇩🇪' },
      'ESPANHA — La Liga EA Sports':                { code: 'ESP_LL',  leagueName: 'La Liga (ESP)',            region: 'UEFA',     flag: '🇪🇸' },
      "FRANÇA — Ligue 1 McDonald's":                { code: 'FRA_L1',  leagueName: 'Ligue 1 (FRA)',            region: 'UEFA',     flag: '🇫🇷' },
      'INGLATERRA — Premier League':                { code: 'ENG_PL',  leagueName: 'Premier League (ENG)',     region: 'UEFA',     flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
      'INGLATERRA — EFL Championship':              { code: 'ENG_CH',  leagueName: 'EFL Championship (ENG)',   region: 'UEFA',     flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
      'ITÁLIA — Serie A Enilive':                    { code: 'ITA_SA',  leagueName: 'Serie A (ITA)',            region: 'UEFA',     flag: '🇮🇹' }
    };

    // [NOVO] Carrega o catálogo de jogos (data/games.json) e popula o <select> da criação de sala

    let currentTab = 'roulette';
    let removedTeamIds = new Set();
    let roulettePool = [];
    let currentMatchDraw = null;
    let isSpinning = false;
    let currentDraftMode = '1v1';
    let playerList = ['Pedrinho', 'Mateus', 'Lucas', 'Vini'];

    let md3State = {
      player1: 'Jogador A',
      player2: 'Jogador B',
      differentTeams: false, // [NOVO] false = mesmos times nos 3 jogos | true = 1 sorteio novo por confronto
      g1: { team1: null, team2: null, s1: null, s2: null, saved: false },
      g2: { team1: null, team2: null, s1: null, s2: null, saved: false },
      g3: { team1: null, team2: null, s1: null, s2: null, saved: false, active: false },
      completed: false,
      winner: null,
      statusText: 'Série em Andamento',
      subText: 'Preencha os placares dos jogos acima para determinar o campeão.'
    };

    // Descobre qual confronto (g1/g2/g3) deve receber o próximo sorteio enviado pelo Host.

    let roomParticipants = [];

    // [NOVO] Duplas cadastradas na sala (recebidas do servidor via 'duplas_updated')
    let duplas = [];

    // [NOVO] Preenche um <select> com dois grupos: "Jogadores" (participantes da sala) e "Duplas" (cadastradas).
    // Usado tanto pelos selects do MD3 quanto pelo modal de lançar partida avulsa.

    let rankingStats = {};
    let duplaRankingStats = {}; // [NOVO] Ranking exclusivo de duplas


    const socket = io('https://roleta-tsr-1.onrender.com');

    let currentRoom = {
      id: null,
      isHost: false,
      game: null // [NOVO] Jogo escolhido na criação da sala — define qual base de times é carregada
    };

    // [NOVO] Apelido do usuário — persiste entre sessões e relaciona com o nome do jogador no MD3
    let myNickname = localStorage.getItem('nickname') || '';


    let md3AutoAssignPlayer2 = true;

    // [NOVO] Host recebe o apelido de quem acabou de entrar e atualiza o Jogador 2 do MD3
