// ==================== DUPLAS DA SALA ====================
// Cadastro/remoção de duplas (a partir dos participantes da sala) e
// sincronização delas com o servidor. Depende de state.js.

    function renderDuplaMemberOptions() {
      const names = [...new Set(roomParticipants.map(p => p.nickname))];
      const sel1 = document.getElementById('dupla-member1');
      const sel2 = document.getElementById('dupla-member2');
      const prev1 = sel1.value;
      const prev2 = sel2.value;

      [sel1, sel2].forEach(sel => {
        sel.innerHTML = '';
        names.forEach(name => sel.appendChild(new Option(name, name)));
      });

      sel1.value = names.includes(prev1) ? prev1 : (names[0] || '');

      if (names.includes(prev2) && prev2 !== sel1.value) {
        sel2.value = prev2;
      } else {
        sel2.value = names.find(n => n !== sel1.value) || names[0] || '';
      }
    }

    // [NOVO] Host cria uma dupla a partir de dois participantes da sala
    function addDupla() {
      if (!currentRoom.isHost) return;
      const m1 = document.getElementById('dupla-member1').value;
      const m2 = document.getElementById('dupla-member2').value;

      if (!m1 || !m2 || m1 === m2) {
        alert('Escolha dois jogadores diferentes para formar a dupla.');
        return;
      }

      const name = `${m1} & ${m2}`;
      if (duplas.some(d => d.name === name)) {
        alert('Essa dupla já existe.');
        return;
      }

      duplas.push({ id: `dupla_${Date.now()}_${Math.floor(Math.random() * 1000)}`, name, members: [m1, m2] });
      renderDuplas();
      renderMD3PlayerOptions();
      syncDuplas();
    }

    // [NOVO] Host remove uma dupla cadastrada
    function removeDupla(id) {
      if (!currentRoom.isHost) return;
      duplas = duplas.filter(d => d.id !== id);
      renderDuplas();
      renderMD3PlayerOptions();
      syncDuplas();
    }

    // [NOVO] Renderiza a lista de duplas e o formulário de criação (formulário só aparece pro Host)
    function renderDuplas() {
      renderDuplaMemberOptions();

      const isHost = currentRoom.isHost;
      const form = document.getElementById('duplas-form');
      if (form) form.classList.toggle('hidden', !isHost);

      // [BUGFIX] Precisa de pelo menos 2 participantes distintos na sala pra formar uma dupla
      const distinctParticipants = new Set(roomParticipants.map(p => p.nickname)).size;
      const btnAdd = document.getElementById('btn-add-dupla');
      const hint = document.getElementById('duplas-hint');
      if (btnAdd) btnAdd.disabled = distinctParticipants < 2;
      if (hint) hint.classList.toggle('hidden', distinctParticipants >= 2);

      const list = document.getElementById('duplas-list');
      list.innerHTML = '';

      if (duplas.length === 0) {
        list.innerHTML = '<span class="text-xs text-gray-500 italic">Nenhuma dupla cadastrada ainda.</span>';
      } else {
        duplas.forEach(d => {
          const chip = document.createElement('div');
          chip.className = 'flex items-center gap-2 bg-[#111319] border border-white/10 rounded-full pl-3 pr-2 py-1.5 text-xs font-bold text-white';
          chip.innerHTML = `<span>👥 ${d.name}</span>` + (isHost
            ? `<button onclick="removeDupla('${d.id}')" class="text-gray-500 hover:text-red-400"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>`
            : '');
          list.appendChild(chip);
        });
      }
      lucide.createIcons();
    }

    // [NOVO] Emite as duplas atualizadas para o servidor repassar à sala (Apenas HOST)
    function syncDuplas() {
      if (currentRoom.id && currentRoom.isHost) {
        socket.emit('update_duplas', { roomId: currentRoom.id, duplas: duplas });
      }
    }

    // [NOVO] Renderiza TUDO no MD3 baseando-se apenas no objeto md3State

    socket.on('duplas_updated', (newDuplas) => {
      duplas = newDuplas || [];
      renderDuplas();
      renderMD3PlayerOptions();
    });

    // Retorno: Erro ao Entrar (Sala inexistente ou Senha Errada)
