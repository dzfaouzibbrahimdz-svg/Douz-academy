import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Video, Users, Lock, ChevronDown, Search, LogIn, X } from "lucide-react";
import { StudentSubscription, PlatformConfig, SessionRecording, LiveRoom } from "../types";
import NativeLiveRoom from "./NativeLiveRoom";

interface Props {
  isAdminLoggedIn: boolean;
  activeSubscriberSession: StudentSubscription | null;
  platformConfig: PlatformConfig;
  showToast: (msg: string) => void;
  recordings: SessionRecording[];
  onSaveRecording: (rec: SessionRecording) => void;
  onDeleteRecording: (id: string) => void;
  initialRoomCode?: string | null;
}

// ── Room catalogue: one room per subject per level ───────────
const LEVELS = [
  // Primary
  { label: "السنة الأولى ابتدائي", stage: "primary" as const, code: "p1", subjects: ["رياضيات","عربية","فرنسية"] },
  { label: "السنة الثانية ابتدائي", stage: "primary" as const, code: "p2", subjects: ["رياضيات","عربية","فرنسية"] },
  { label: "السنة الثالثة ابتدائي", stage: "primary" as const, code: "p3", subjects: ["رياضيات","عربية","فرنسية","تربية علمية"] },
  { label: "السنة الرابعة ابتدائي", stage: "primary" as const, code: "p4", subjects: ["رياضيات","عربية","فرنسية","تربية علمية"] },
  { label: "السنة الخامسة ابتدائي", stage: "primary" as const, code: "p5", subjects: ["رياضيات","عربية","فرنسية","تربية علمية"] },
  { label: "السنة السادسة ابتدائي (سيزيام)", stage: "primary" as const, code: "p6", subjects: ["رياضيات","عربية","فرنسية","تربية علمية"] },
  // Preparatory
  { label: "السنة السابعة أساسي", stage: "preparatory" as const, code: "pr7", subjects: ["رياضيات","عربية","فرنسية","علوم الحياة والأرض (SVT)","فيزياء","تاريخ وجغرافيا"] },
  { label: "السنة الثامنة أساسي", stage: "preparatory" as const, code: "pr8", subjects: ["رياضيات","عربية","فرنسية","علوم الحياة والأرض (SVT)","فيزياء","تاريخ وجغرافيا"] },
  { label: "السنة التاسعة أساسي", stage: "preparatory" as const, code: "pr9", subjects: ["رياضيات","عربية","فرنسية","علوم الحياة والأرض (SVT)","فيزياء","تاريخ وجغرافيا"] },
  // Secondary
  { label: "الأولى ثانوي", stage: "secondary" as const, code: "s1", subjects: ["رياضيات","عربية","فرنسية","علوم الحياة والأرض (SVT)","فيزياء وكيمياء","تاريخ وجغرافيا","فلسفة"] },
  { label: "الثانية ثانوي (علوم)", stage: "secondary" as const, code: "s2", subjects: ["رياضيات","عربية","فرنسية","علوم الحياة والأرض (SVT)","فيزياء وكيمياء"] },
  { label: "الثالثة ثانوي (علوم تجريبية)", stage: "secondary" as const, code: "s3", subjects: ["رياضيات","عربية","فرنسية","علوم الحياة والأرض (SVT)","فيزياء وكيمياء"] },
  { label: "باكالوريا علوم تجريبية", stage: "secondary" as const, code: "bac", subjects: ["رياضيات","عربية","فرنسية","علوم الحياة والأرض (SVT)","فيزياء وكيمياء","فلسفة"] },
];

function buildRooms(): LiveRoom[] {
  const rooms: LiveRoom[] = [];
  LEVELS.forEach(lvl => {
    lvl.subjects.forEach(subj => {
      const subId = subj.replace(/\s+/g, "-").replace(/[()]/g, "").toLowerCase();
      rooms.push({
        id: `${lvl.code}-${subId}`,
        subjectId: subId,
        subjectName: subj,
        level: lvl.label,
        stage: lvl.stage,
        roomCode: `${lvl.code}-${subId}`,
      });
    });
  });
  return rooms;
}

const ALL_ROOMS = buildRooms();

const STAGE_LABELS: Record<string, string> = { primary: "الابتدائي 📝", preparatory: "الإعدادي 🔬", secondary: "الثانوي والباكالوريا 🎓" };
const STAGE_COLORS: Record<string, string> = { primary: "bg-blue-100 text-blue-800 border-blue-200", preparatory: "bg-teal-100 text-teal-800 border-teal-200", secondary: "bg-purple-100 text-purple-800 border-purple-200" };

export default function LiveRoomsTab({ isAdminLoggedIn, activeSubscriberSession, platformConfig, showToast, onSaveRecording, initialRoomCode }: Props) {
  const [activeRoom, setActiveRoom] = useState<LiveRoom | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | "primary" | "preparatory" | "secondary">("all");
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);

  // Guest entry modal
  const [pendingRoom, setPendingRoom] = useState<LiveRoom | null>(null);
  const [guestName, setGuestName] = useState("");

  // Resolve username
  const userName = isAdminLoggedIn
    ? "الأستاذ فوزي بنبراهيم"
    : activeSubscriberSession
    ? `${activeSubscriberSession.firstName} ${activeSubscriberSession.lastName}`
    : "";

  // ── Handle initialRoomCode from URL — open room on first render ──────────
  useEffect(() => {
    if (!initialRoomCode) return;
    const found = ALL_ROOMS.find(r => r.roomCode === initialRoomCode || r.id === initialRoomCode);
    if (!found) return;
    if (isAdminLoggedIn || activeSubscriberSession?.status === "approved") {
      setActiveRoom(found);
    } else {
      setPendingRoom(found);
      setExpandedLevel(found.level);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update URL when entering/leaving a room
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeRoom) {
      url.searchParams.set("room", activeRoom.roomCode);
    } else {
      url.searchParams.delete("room");
    }
    window.history.replaceState({}, "", url.toString());
  }, [activeRoom]);

  const handleEnterRoom = (room: LiveRoom) => {
    // Admin and approved subscribers enter directly
    if (isAdminLoggedIn || activeSubscriberSession?.status === "approved") {
      setActiveRoom(room);
      return;
    }
    // Everyone else: show guest name modal
    setGuestName("");
    setPendingRoom(room);
  };

  const handleGuestJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const name = guestName.trim();
    if (!name) { showToast("⚠️ يرجى إدخال اسمك للدخول."); return; }
    if (!pendingRoom) return;
    // Enter as guest — lobby approval still required inside the room
    setActiveRoom(pendingRoom);
    setPendingRoom(null);
  };

  // If in a room, show the live room component
  if (activeRoom) {
    const resolvedName = userName || (guestName.trim() || "زائر");
    return (
      <NativeLiveRoom
        room={activeRoom}
        isAdmin={isAdminLoggedIn}
        userName={resolvedName}
        onBack={() => { setActiveRoom(null); setGuestName(""); }}
        onSaveRecording={onSaveRecording}
      />
    );
  }

  // Filter rooms
  const filtered = ALL_ROOMS.filter(r => {
    const q = searchQ.toLowerCase();
    const matchSearch = !q || r.subjectName.toLowerCase().includes(q) || r.level.toLowerCase().includes(q);
    const matchStage = stageFilter === "all" || r.stage === stageFilter;
    return matchSearch && matchStage;
  });

  // Group by level
  const byLevel = new Map<string, LiveRoom[]>();
  filtered.forEach(r => {
    if (!byLevel.has(r.level)) byLevel.set(r.level, []);
    byLevel.get(r.level)!.push(r);
  });

  return (
    <div className="space-y-5" dir="rtl">

      {/* ── Guest name modal ────────────────────────────────── */}
      <AnimatePresence>
        {pendingRoom && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/70 flex items-center justify-center p-4"
            onClick={() => setPendingRoom(null)}>
            <motion.div
              initial={{ scale: 0.93, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 20 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-right"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setPendingRoom(null)} className="w-8 h-8 bg-slate-700 hover:bg-slate-600 text-white rounded-xl flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="font-black text-white text-sm">الدخول إلى الغرفة</h3>
                  <p className="text-slate-400 text-[11px] mt-0.5">{pendingRoom.subjectName} — {pendingRoom.level}</p>
                </div>
              </div>

              <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-3 mb-4 text-xs text-amber-200 flex items-start gap-2">
                <span className="text-base mt-0.5">⏳</span>
                <span>ستنتقل إلى غرفة الانتظار. سيتم الدخول بعد موافقة المشرف.</span>
              </div>

              <form onSubmit={handleGuestJoin} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-300 font-bold mb-1.5">اسمك الكامل</label>
                  <input
                    type="text"
                    autoFocus
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    placeholder="مثال: أحمد بن علي"
                    dir="rtl"
                    maxLength={40}
                    className="w-full bg-slate-800 border border-slate-600 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!guestName.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                  <LogIn className="w-4 h-4" />
                  طلب الدخول
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-900 to-slate-950 rounded-3xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-48 h-48 bg-emerald-500 rounded-full filter blur-[80px] opacity-10 pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-full">📹 بث مباشر</span>
          </div>
          <h3 className="text-xl font-black">غرف البث المباشر — كل مادة بكل مستوى</h3>
          <p className="text-emerald-100 text-xs">
            {isAdminLoggedIn
              ? "🛡️ أنت تدخل كمدير مع صلاحيات كاملة."
              : "اختر الغرفة وادخل اسمك — الدخول بعد موافقة المشرف مباشرةً."}
          </p>
        </div>
      </div>

      {/* Info banner for guests */}
      {!isAdminLoggedIn && !activeSubscriberSession && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 text-xs">
          <Users className="w-4 h-4 text-blue-600 shrink-0" />
          <p className="text-blue-900 font-medium">يمكنك الدخول مباشرة عبر أي غرفة بإدخال اسمك — الدخول يتطلب موافقة المشرف داخل الغرفة.</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
          <input type="text" placeholder="ابحث عن مادة أو مستوى..." value={searchQ} onChange={e => setSearchQ(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-3 text-xs text-right outline-none focus:border-emerald-600" />
        </div>
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value as typeof stageFilter)} className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-right outline-none cursor-pointer focus:border-emerald-600">
          <option value="all">كل المراحل</option><option value="primary">الابتدائي</option><option value="preparatory">الإعدادي</option><option value="secondary">الثانوي والباكالوريا</option>
        </select>
      </div>

      {/* Rooms by level */}
      <div className="space-y-3">
        {Array.from(byLevel.entries()).map(([level, rooms]) => {
          const lvlMeta = LEVELS.find(l => l.label === level)!;
          const isExpanded = expandedLevel === level;
          return (
            <div key={level} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <button onClick={() => setExpandedLevel(isExpanded ? null : level)} className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-all">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${STAGE_COLORS[lvlMeta.stage]}`}>{STAGE_LABELS[lvlMeta.stage]}</span>
                  <h4 className="font-black text-slate-900 text-sm text-right">{level}</h4>
                  <span className="text-xs text-slate-400 font-mono">{rooms.length} مادة</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-100 overflow-hidden">
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {rooms.map(room => (
                        <button key={room.id} onClick={() => handleEnterRoom(room)}
                          className="rounded-xl p-3 text-right border transition-all group bg-slate-50 hover:bg-emerald-50 border-slate-200 hover:border-emerald-300 hover:shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center transition-all">
                              <Video className="w-3.5 h-3.5 text-emerald-700" />
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                          </div>
                          <p className="font-black text-slate-900 text-[11px] leading-tight">{room.subjectName}</p>
                          <p className="text-[9px] text-slate-400 mt-1 font-mono">{room.roomCode}</p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {byLevel.size === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
            <Video className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-600 text-sm">لا توجد غرف مطابقة</h4>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-4 justify-around text-center text-xs">
        <div><span className="font-black text-slate-900 text-base block">{ALL_ROOMS.length}</span><span className="text-slate-500">غرفة نشطة</span></div>
        <div><span className="font-black text-slate-900 text-base block">{LEVELS.length}</span><span className="text-slate-500">مستوى دراسي</span></div>
        <div><span className="font-black text-slate-900 text-base block">{[...new Set(ALL_ROOMS.map(r => r.subjectName))].length}</span><span className="text-slate-500">مادة مختلفة</span></div>
      </div>
    </div>
  );
}
