const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://roleta-tsr.vercel.app",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(process.cwd(), 'public')));

const rooms = {};

// [NOVO] Monta a lista de participantes de uma sala (Host + convidados) para o front-end
function getParticipantsList(room) {
    return Object.entries(room.participants).map(([socketId, nickname]) => ({
        id: socketId,
        nickname: nickname,
        isHost: socketId === room.hostId
    }));
}

// [NOVO] Remove um socket de qualquer sala em que ele esteja e avisa quem ficou
function removeSocketFromRooms(socket) {
    for (const roomId of Object.keys(rooms)) {
        const room = rooms[roomId];
        if (room.participants[socket.id]) {
            delete room.participants[socket.id];
            console.log(`[SALA] ${socket.id} REMOVIDO da sala ${roomId}`);
            io.to(roomId).emit('room_participants_updated', { participants: getParticipantsList(room) });
        }
    }
}

io.on('connection', (socket) => {
    console.log(`[+] Novo cliente conectado: ${socket.id}`);

    // 1. Criação de Sala
    socket.on('create_room', (data) => {
        const roomId = 'GOGOSZ-' + Math.floor(1000 + Math.random() * 9000);
        const hostNickname = (data.nickname || 'Jogador A').toString().trim().substring(0, 20);

        rooms[roomId] = {
            password: data.password || '',
            hostId: socket.id,
            hostNickname: hostNickname, // Apelido do Host
            md3State: null,       // Guarda o estado do MD3 desta sala
            rankingStats: null,   // [NOVO] Guarda o ranking geral desta sala
            duplaRankingStats: null, // [NOVO] Guarda o ranking de duplas desta sala
            duplas: [],            // [NOVO] Duplas cadastradas nesta sala
            participants: { [socket.id]: hostNickname } // [NOVO] Roster: socketId -> apelido
        };
        
        socket.join(roomId);
        console.log(`[SALA] ${socket.id} CRIOU a sala ${roomId} (Apelido: ${hostNickname})`);
        socket.emit('room_created', { roomId: roomId });
    });

    // 2. Entrada em Sala
    socket.on('join_room', (data) => {
        const room = rooms[data.roomId];

        if (!room) {
            return socket.emit('room_error', { message: 'Sala não encontrada. Verifique o ID informado.' });
        }
        if (room.password !== '' && room.password !== data.password) {
            return socket.emit('room_error', { message: 'Senha incorreta.' });
        }

        const nickname = (data.nickname || 'Jogador B').toString().trim().substring(0, 20);
        room.participants[socket.id] = nickname; // [NOVO] Adiciona ao roster da sala

        socket.join(data.roomId);
        console.log(`[SALA] ${socket.id} ENTROU na sala ${data.roomId} (Apelido: ${nickname})`);
        
        // Envia o estado atual do MD3, do ranking, do roster e o apelido do Host para quem entrou
        socket.emit('room_joined', { 
            roomId: data.roomId, 
            md3State: room.md3State,
            rankingStats: room.rankingStats, // [NOVO]
            duplaRankingStats: room.duplaRankingStats, // [NOVO]
            duplas: room.duplas || [],       // [NOVO]
            hostNickname: room.hostNickname,
            participants: getParticipantsList(room) // [NOVO]
        });

        // Avisa o Host quem acabou de entrar, para pré-selecionar como Jogador 2
        socket.to(data.roomId).emit('participant_joined', { nickname: nickname });

        // [NOVO] Atualiza o roster de participantes para todo mundo na sala
        io.to(data.roomId).emit('room_participants_updated', { participants: getParticipantsList(room) });
    });

    // 3. Atualização do MD3 (Host envia seu estado local para cá, e repassamos para a sala)
    socket.on('update_md3', (data) => {
        if (rooms[data.roomId]) {
            rooms[data.roomId].md3State = data.md3State;
            // O .to() isola a mensagem apenas para quem está no mesmo roomId
            socket.to(data.roomId).emit('md3_updated', data.md3State);
        }
    });

    // 4. [NOVO] Atualização do Ranking Geral (Host envia, repassamos para a sala)
    socket.on('update_ranking', (data) => {
        if (rooms[data.roomId]) {
            rooms[data.roomId].rankingStats = data.rankingStats;
            rooms[data.roomId].duplaRankingStats = data.duplaRankingStats; // [NOVO]
            socket.to(data.roomId).emit('ranking_updated', {
                rankingStats: data.rankingStats,
                duplaRankingStats: data.duplaRankingStats
            });
        }
    });

    // 4b. [NOVO] Atualização das Duplas cadastradas (Host envia, repassamos para a sala)
    socket.on('update_duplas', (data) => {
        if (rooms[data.roomId]) {
            rooms[data.roomId].duplas = data.duplas || [];
            socket.to(data.roomId).emit('duplas_updated', rooms[data.roomId].duplas);
        }
    });

    // 5. Sair da sala
    socket.on('leave_room', (roomId) => {
        socket.leave(roomId);
        console.log(`[SALA] ${socket.id} SAIU da sala ${roomId}`);

        // [NOVO] Remove do roster e avisa quem ficou
        const room = rooms[roomId];
        if (room && room.participants[socket.id]) {
            delete room.participants[socket.id];
            io.to(roomId).emit('room_participants_updated', { participants: getParticipantsList(room) });
        }
    });

    socket.on('send_test', (data) => {
        socket.to(data.roomId).emit('test_received', data.message);
    });

    socket.on('disconnect', () => {
        console.log(`[-] Cliente desconectado: ${socket.id}`);
        removeSocketFromRooms(socket); // [NOVO] Limpa o roster de qualquer sala que o socket estivesse
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Servidor GOGOSZ rodando na porta ${PORT}`);
});