// ==================== BOOTSTRAP DA APLICAÇÃO ====================
// window.onload: dispara depois que TODOS os módulos acima já foram
// carregados. Deve ser sempre o ÚLTIMO <script> da página.

    window.onload = async function() {
      lucide.createIcons();

      // [NOVO] Carrega o catálogo de jogos (games.json) para popular o seletor da criação de sala.
      // A base de TIMES em si só é carregada depois, quando a sala souber qual jogo usar
      // (ao criar ou entrar numa sala) — ver room_created / room_joined.
      await loadGamesCatalog();

      renderDatabase();
      renderPlayersList();
      updateRoulettePoolInfo();
      renderRanking();
      drawRouletteWheel(0);

      // [NOVO] Recupera o apelido salvo de sessões anteriores
      const nickInput = document.getElementById('my-nickname');
      if (nickInput) nickInput.value = myNickname;
      updateNicknameGate();
    };

