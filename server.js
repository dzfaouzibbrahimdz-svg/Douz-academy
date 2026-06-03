const express = require("express");
const { createServer } = require("http");
const { Server: SocketServer } = require("socket.io");

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 3001;

// ── إعداد CORS ─────────────────────────────────────────────
// ضع رابط موقعك على GitHub Pages هنا
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["*"];

app.use(require("cors")({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

// ── فحص صحة الخادم ────────────────────────────────────────
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", message: "الخادم يعمل بشكل صحيح ✅" });
});

// ── Socket.io ──────────────────────────────────────────────
const io = new SocketServer(httpServer, {
  path: "/socket.io",
  cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

// roomCode → participants
const rooms = new Map();
// roomCode → waiting list
const lobbies = new Map();

io.on("connection", (socket) => {
  console.log(`🔌 اتصال جديد: ${socket.id}`);

  // ── Admin: joins immediately, no lobby ──────────────────
  socket.on("room:join-admin", ({ roomCode, name }) => {
    socket.join(roomCode);
    if (!rooms.has(roomCode)) rooms.set(roomCode, new Map());
    if (!lobbies.has(roomCode)) lobbies.set(roomCode, new Map());

    const room = rooms.get(roomCode);
    const p = {
      socketId: socket.id, name, isAdmin: true,
      hasVideoPermission: true, hasAudioPermission: true,
      joinedAt: Date.now(),
    };
    room.set(socket.id, p);

    socket.emit("room:joined", { participants: Array.from(room.values()) });
    socket.emit("lobby:list", Array.from(lobbies.get(roomCode).values()));
    socket.to(roomCode).emit("room:user-joined", p);
    console.log(`👑 مشرف دخل الغرفة: ${name} → ${roomCode}`);
  });

  // ── Participant: request entry ───────────────────────────
  socket.on("room:request-entry", ({ roomCode, name }) => {
    if (!lobbies.has(roomCode)) lobbies.set(roomCode, new Map());
    const lobby = lobbies.get(roomCode);

    const entry = { socketId: socket.id, name, requestedAt: Date.now() };
    lobby.set(socket.id, entry);

    socket.emit("lobby:waiting");

    const room = rooms.get(roomCode);
    if (room) {
      room.forEach((p) => {
        if (p.isAdmin) io.to(p.socketId).emit("lobby:knock", entry);
      });
    }
    console.log(`🚪 طلب دخول: ${name} → ${roomCode}`);
  });

  // ── Admin: approve ───────────────────────────────────────
  socket.on("lobby:approve", ({ roomCode, targetSocketId }) => {
    const room = rooms.get(roomCode);
    if (!room?.get(socket.id)?.isAdmin) return;

    const lobby = lobbies.get(roomCode);
    const entry = lobby?.get(targetSocketId);
    if (!entry) return;
    lobby.delete(targetSocketId);

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (!targetSocket) return;
    targetSocket.join(roomCode);

    const p = {
      socketId: targetSocketId, name: entry.name, isAdmin: false,
      hasVideoPermission: false, hasAudioPermission: false,
      joinedAt: Date.now(),
    };
    room.set(targetSocketId, p);

    io.to(targetSocketId).emit("room:joined", { participants: Array.from(room.values()) });
    io.to(roomCode).emit("room:user-joined", p);
    io.to(socket.id).emit("lobby:list", Array.from(lobby.values()));
    console.log(`✅ تمت الموافقة على: ${entry.name}`);
  });

  // ── Admin: reject ────────────────────────────────────────
  socket.on("lobby:reject", ({ roomCode, targetSocketId }) => {
    const room = rooms.get(roomCode);
    if (!room?.get(socket.id)?.isAdmin) return;

    lobbies.get(roomCode)?.delete(targetSocketId);
    io.to(targetSocketId).emit("room:rejected");
    io.to(socket.id).emit("lobby:list", Array.from((lobbies.get(roomCode) ?? new Map()).values()));
  });

  // ── Admin: kick ──────────────────────────────────────────
  socket.on("room:kick", ({ roomCode, targetSocketId }) => {
    const room = rooms.get(roomCode);
    if (!room?.get(socket.id)?.isAdmin) return;

    io.to(targetSocketId).emit("room:kicked");
    const target = io.sockets.sockets.get(targetSocketId);
    if (target) target.leave(roomCode);
    room.delete(targetSocketId);
    io.to(roomCode).emit("room:user-left", { socketId: targetSocketId });
  });

  // ── Admin: grant video permission ────────────────────────
  socket.on("room:grant-video", ({ roomCode, targetSocketId, allow }) => {
    const room = rooms.get(roomCode);
    if (!room?.get(socket.id)?.isAdmin) return;
    const target = room.get(targetSocketId);
    if (!target) return;
    target.hasVideoPermission = allow;
    io.to(targetSocketId).emit("room:video-permission", { allow });
    io.to(roomCode).emit("room:participants", Array.from(room.values()));
  });

  // ── Admin: grant audio permission ────────────────────────
  socket.on("room:grant-audio", ({ roomCode, targetSocketId, allow }) => {
    const room = rooms.get(roomCode);
    if (!room?.get(socket.id)?.isAdmin) return;
    const target = room.get(targetSocketId);
    if (!target) return;
    target.hasAudioPermission = allow;
    io.to(targetSocketId).emit("room:audio-permission", { allow });
    io.to(roomCode).emit("room:participants", Array.from(room.values()));
  });

  // ── Participant: raise hand ──────────────────────────────
  socket.on("room:raise-hand", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    const user = room?.get(socket.id);
    if (!user || !room) return;
    room.forEach((p) => {
      if (p.isAdmin) io.to(p.socketId).emit("room:hand-raised", { socketId: socket.id, name: user.name });
    });
  });

  // ── WebRTC signaling ─────────────────────────────────────
  socket.on("rtc:offer", ({ targetSocketId, offer }) => {
    io.to(targetSocketId).emit("rtc:offer", { from: socket.id, offer });
  });

  socket.on("rtc:answer", ({ targetSocketId, answer }) => {
    io.to(targetSocketId).emit("rtc:answer", { from: socket.id, answer });
  });

  socket.on("rtc:ice", ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit("rtc:ice", { from: socket.id, candidate });
  });

  // ── Whiteboard sync ──────────────────────────────────────
  socket.on("wb:stroke", ({ roomCode, stroke }) => {
    socket.to(roomCode).emit("wb:stroke", stroke);
  });

  socket.on("wb:clear", ({ roomCode }) => {
    if (!rooms.get(roomCode)?.get(socket.id)?.isAdmin) return;
    socket.to(roomCode).emit("wb:clear");
  });

  socket.on("wb:undo", ({ roomCode }) => {
    socket.to(roomCode).emit("wb:undo");
  });

  // ── Chat ─────────────────────────────────────────────────
  socket.on("chat:message", ({ roomCode, text }) => {
    const user = rooms.get(roomCode)?.get(socket.id);
    if (!user) return;
    io.to(roomCode).emit("chat:message", {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: user.name,
      isAdmin: user.isAdmin,
      text,
      time: new Date().toLocaleTimeString("ar-TN", { hour: "2-digit", minute: "2-digit" }),
    });
  });

  // ── Disconnect ───────────────────────────────────────────
  socket.on("disconnect", () => {
    rooms.forEach((_, roomCode) => handleLeave(socket.id, roomCode));
    lobbies.forEach((lobby, roomCode) => {
      if (lobby.has(socket.id)) {
        lobby.delete(socket.id);
        rooms.get(roomCode)?.forEach((p) => {
          if (p.isAdmin) io.to(p.socketId).emit("lobby:list", Array.from(lobby.values()));
        });
      }
    });
    console.log(`❌ انقطع الاتصال: ${socket.id}`);
  });

  function handleLeave(socketId, roomCode) {
    const room = rooms.get(roomCode);
    if (!room?.has(socketId)) return;
    room.delete(socketId);
    if (room.size === 0) { rooms.delete(roomCode); lobbies.delete(roomCode); }
    else io.to(roomCode).emit("room:user-left", { socketId });
  }
});

// ── تشغيل الخادم ──────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
  console.log(`🔗 Socket.io جاهز على المسار: /socket.io`);
});
