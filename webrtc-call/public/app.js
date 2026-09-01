const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const $ = (id) => document.getElementById(id);
const socket = io();

let myId = null;
let peerId = null;
let pc = null;
let localStream = null;
let pendingOffer = null;
let pendingCandidates = [];

function show(el, visible) {
  el.classList.toggle('hidden', !visible);
}

function setStatus(text) {
  $('status').textContent = text;
}

async function getMedia() {
  if (localStream) return localStream;
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  $('localVideo').srcObject = localStream;
  return localStream;
}

function createPeerConnection(remoteId) {
  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('ice-candidate', { to: remoteId, payload: e.candidate });
    }
  };

  pc.ontrack = (e) => {
    $('remoteVideo').srcObject = e.streams[0];
  };

  pc.onconnectionstatechange = () => {
    if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) endCall(false);
  };

  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
  return pc;
}

async function flushCandidates() {
  for (const c of pendingCandidates) {
    try { await pc.addIceCandidate(c); } catch (_) { /* ignore */ }
  }
  pendingCandidates = [];
}

function enterCallView() {
  show($('dial'), false);
  show($('incoming'), false);
  show($('callView'), true);
}

function endCall(notifyPeer = true) {
  if (notifyPeer && peerId) socket.emit('hangup', { to: peerId, payload: null });
  if (pc) { pc.close(); pc = null; }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  $('localVideo').srcObject = null;
  $('remoteVideo').srcObject = null;
  peerId = null;
  pendingOffer = null;
  pendingCandidates = [];
  show($('callView'), false);
  show($('incoming'), false);
  show($('dial'), true);
}

$('registerBtn').onclick = () => {
  const id = $('myId').value.trim();
  if (!id) return setStatus('Enter an ID first');
  socket.emit('register', id, (res) => {
    if (!res.ok) return setStatus(res.error === 'id-taken' ? 'ID already in use' : 'Registration failed');
    myId = res.userId;
    $('meLabel').textContent = myId;
    setStatus('Connected');
    show($('setup'), false);
    show($('dial'), true);
  });
};

$('callBtn').onclick = async () => {
  const target = $('peerId').value.trim();
  if (!target || target === myId) return ($('dialStatus').textContent = 'Enter a valid peer ID');
  try {
    await getMedia();
  } catch (err) {
    return ($('dialStatus').textContent = 'Camera/mic access denied');
  }
  peerId = target;
  createPeerConnection(peerId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('call', { to: peerId, payload: offer });
  $('dialStatus').textContent = `Calling ${peerId}...`;
  enterCallView();
};

$('acceptBtn').onclick = async () => {
  try {
    await getMedia();
  } catch (err) {
    socket.emit('reject', { to: peerId, payload: null });
    return endCall(false);
  }
  createPeerConnection(peerId);
  await pc.setRemoteDescription(pendingOffer);
  await flushCandidates();
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', { to: peerId, payload: answer });
  pendingOffer = null;
  enterCallView();
};

$('rejectBtn').onclick = () => {
  socket.emit('reject', { to: peerId, payload: null });
  endCall(false);
};

$('hangupBtn').onclick = () => endCall(true);

$('muteBtn').onclick = () => {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  $('muteBtn').textContent = track.enabled ? 'Mute' : 'Unmute';
};

$('camBtn').onclick = () => {
  if (!localStream) return;
  const track = localStream.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  $('camBtn').textContent = track.enabled ? 'Camera off' : 'Camera on';
};

socket.on('call', ({ from, payload }) => {
  if (pc) return socket.emit('reject', { to: from, payload: null });
  peerId = from;
  pendingOffer = payload;
  $('callerLabel').textContent = from;
  show($('dial'), false);
  show($('incoming'), true);
});

socket.on('answer', async ({ payload }) => {
  if (!pc) return;
  await pc.setRemoteDescription(payload);
  await flushCandidates();
  $('dialStatus').textContent = '';
});

socket.on('ice-candidate', async ({ payload }) => {
  if (!pc || !pc.remoteDescription) return pendingCandidates.push(payload);
  try { await pc.addIceCandidate(payload); } catch (_) { /* ignore */ }
});

socket.on('reject', () => {
  endCall(false);
  $('dialStatus').textContent = 'Call rejected';
});

socket.on('hangup', () => {
  endCall(false);
  $('dialStatus').textContent = '';
});

socket.on('peer-disconnected', ({ from }) => { if (from === peerId) endCall(false); });
socket.on('peer-unavailable', ({ to }) => {
  $('dialStatus').textContent = `User ${to} is not available`;
  endCall(false);
});

socket.on('disconnect', () => {
  setStatus('Disconnected');
  endCall(false);
  show($('setup'), true);
  show($('dial'), false);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
