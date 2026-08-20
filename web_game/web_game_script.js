// Global variables
let peer = null;
let isHost = false;
let connections = []; // Client connections stored here (if host)
let hostConnection = null; // Connection to host stored here (if client)
let players = {}; 
let myName = "";

// Elements
const createBtn = document.getElementById('create-room-btn');
const joinBtn = document.getElementById('join-room-btn');
const nameInput = document.getElementById('player-name-input');
const codeInput = document.getElementById('room-code-input');
const roomCodeDisplay = document.getElementById('room-code-display');
const playerList = document.getElementById('player-list');
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');

createBtn.addEventListener('click', handleCreateRoom);
joinBtn.addEventListener('click', handleJoinRoom);
leaveRoomBtn.addEventListener('click', handleLeaveRoom);

// --- HOST LOGIC ---
function handleCreateRoom() {
    myName = nameInput.value.trim() || "Host";
    //Randomises room code
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    isHost = true;

    // Peer created based on room code
    peer = new Peer('my-game-lobby-' + roomCode);

    peer.on('open', (id) => {
        setupRoomLogic(roomCode);
        players[id] = myName; // Add this player to the player list
        updatePlayerListUI();
    });

    // On client connection
    peer.on('connection', (conn) => {
        connections.push(conn);

        // Data for this client
        conn.on('data', (data) => {
            if (data.type === 'join') {
                players[conn.peer] = data.name;
                broadcast({ type: 'players_update', players: players }); // Send updated list to all clients
            } else if (data.type === 'chat') {
                addChatMessage(players[conn.peer], data.text);
                // Host forwards the chat to all OTHER clients
                broadcast({ type: 'chat', sender: players[conn.peer], text: data.text }, conn.peer);
            }
        });

        // When client leaves
        conn.on('close', () => {
            delete players[conn.peer];
            connections = connections.filter(c => c.peer !== conn.peer);
            broadcast({ type: 'players_update', players: players });
        });
    });
}

// --- CLIENT LOGIC ---
function handleJoinRoom() {
    myName = nameInput.value.trim() || "Player";
    const roomCode = codeInput.value.trim().toUpperCase();
    isHost = false;

    peer = new Peer(); // Clients get random ID

    peer.on('open', (id) => {
        // Connect to Host
        hostConnection = peer.connect('my-game-lobby-' + roomCode);

        hostConnection.on('open', () => {
            setupRoomLogic(roomCode);
            // Tell Host our name so they can add us to the list
            hostConnection.send({ type: 'join', name: myName });
        });

        // Listen for updates from Host
        hostConnection.on('data', (data) => {
            if (data.type === 'players_update') {
                players = data.players;
                updatePlayerListUI();
            } else if (data.type === 'chat') {
                addChatMessage(data.sender, data.text);
            }
        });

        hostConnection.on('close', () => {
            //Has an issue where this plays when you disconnect as peer lol
            //alert("The host has disconnected.");
            handleLeaveRoom();
        });
    });
}

function handleLeaveRoom() {
    // Deletes peer and resets all variables (in case of joining a new room)
    if (peer) {
        peer.destroy();
        peer = null;
    }

    players = {};
    connections = [];
    isHost = false;

    document.getElementById('setup-screen').style.display = 'block';
    document.getElementById('room-screen').style.display = 'none';
    document.getElementById('chat-box').innerHTML = '';
}

// --- SHARED UI LOGIC ---
function setupRoomLogic(roomCode) {
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('room-screen').style.display = 'block';
    roomCodeDisplay.innerText = roomCode;

    // Chat sending logic depends on if you are Host or Client
    sendChatBtn.addEventListener('click', () => {
        const text = chatInput.value.trim();
        if (text !== "") {
            addChatMessage(myName, text); // Show it on our own screen
            
            if (isHost) {
                // Host broadcasts to all clients
                broadcast({ type: 'chat', sender: myName, text: text });
            } else {
                // Client sends up to the Host
                hostConnection.send({ type: 'chat', text: text });
            }
            chatInput.value = '';
        }
    });
}

function broadcast(data, excludePeerId = null) {
    //Send the data for all active connectiions
    connections.forEach(conn => {
        if (conn.peer !== excludePeerId) {
            conn.send(data);
        }
    });
    //Update UI if necessary
    if (data.type === 'players_update') updatePlayerListUI();
}

function updatePlayerListUI() {
    playerList.innerHTML = '';
    for (const id in players) {
        const listItem = document.createElement('li');
        // Add "(You)" if it's... you
        listItem.innerText = players[id] + (id === peer.id ? " (You)" : "");
        playerList.appendChild(listItem);
    }
}

function addChatMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}