import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastContext';
import { api } from '../lib/api';

export interface AttendanceRecord {
  id: string;
  employeeName: string;
  date: string;
  clockInTime: string;
  clockOutTime?: string;
  status: 'ON_TIME' | 'LATE' | 'OPEN';
  lateMinutes: number;
  durationHours?: number;
  salesCount: number;
  notes?: string;
}

export interface StaffTask {
  id: string;
  title: string;
  assignedTo: string;
  isDone: boolean;
  doneAt?: string;
  date: string;
  priority: 'NORMAL' | 'URGENT';
}

export interface ShopScheduleConfig {
  openingTime: string; // ex: "08:00"
  closingTime: string; // ex: "19:00"
  graceMinutes: number; // ex: 15
  autoNotify: boolean;
  workingDays: number[]; // 1=Lundi, 2=Mardi, 3=Mercredi, 4=Jeudi, 5=Vendredi, 6=Samedi, 0=Dimanche
  breakStartTime?: string; // ex: "12:30"
  breakEndTime?: string; // ex: "14:00"
  breakEnabled?: boolean;
  employeeOffDays?: Record<string, number[]>; // Nom employé -> jours de repos [0, ...]
}

export const getScheduleKey = (tenantId?: string) => `vtm_shop_schedule_config_${tenantId || 'default'}`;
export const getAttendanceKey = (tenantId?: string) => `vtm_staff_attendance_records_${tenantId || 'default'}`;
export const getTasksKey = (tenantId?: string) => `vtm_staff_tasks_records_${tenantId || 'default'}`;

export function getShopScheduleConfig(tenantId?: string): ShopScheduleConfig {
  try {
    const raw = localStorage.getItem(getScheduleKey(tenantId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        openingTime: parsed.openingTime || '08:00',
        closingTime: parsed.closingTime || '19:00',
        graceMinutes: parsed.graceMinutes ?? 15,
        autoNotify: parsed.autoNotify ?? true,
        workingDays: Array.isArray(parsed.workingDays) ? parsed.workingDays : [1, 2, 3, 4, 5, 6],
        breakStartTime: parsed.breakStartTime || '12:30',
        breakEndTime: parsed.breakEndTime || '14:00',
        breakEnabled: parsed.breakEnabled ?? false,
        employeeOffDays: parsed.employeeOffDays || {},
      };
    }
  } catch {}
  return {
    openingTime: '08:00',
    closingTime: '19:00',
    graceMinutes: 15,
    autoNotify: true,
    workingDays: [1, 2, 3, 4, 5, 6],
    breakStartTime: '12:30',
    breakEndTime: '14:00',
    breakEnabled: false,
    employeeOffDays: {},
  };
}

export function saveShopScheduleConfig(cfg: Partial<ShopScheduleConfig>, tenantId?: string): ShopScheduleConfig {
  const current = getShopScheduleConfig(tenantId);
  const updated = { ...current, ...cfg };
  try {
    localStorage.setItem(getScheduleKey(tenantId), JSON.stringify(updated));
  } catch (err) {
    console.warn('Storage save error:', err);
  }
  // Best-effort synchronization with server tenant settings
  api.put('/settings/staff.scheduleConfig', { value: updated }).catch(() => {});
  return updated;
}

export function StaffAttendancePage() {
  const { profile } = useAuth();
  const { addToast } = useToast();

  const [scheduleConfig, setScheduleConfig] = useState<ShopScheduleConfig>(() => getShopScheduleConfig(profile?.tenantId));
  const [activeTab, setActiveTab] = useState<'attendance' | 'tasks' | 'reports' | 'config'>('attendance');
  const [reportPeriod, setReportPeriod] = useState<'DAY' | 'WEEK' | 'MONTH'>('DAY');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('ALL');

  // Real store sales & staff users
  const [realSales, setRealSales] = useState<Array<{ id: string; createdAt: string; grandTotal: string }>>([]);
  const [staffUsers, setStaffUsers] = useState<Array<{ id: string; fullName: string; email: string; role?: string }>>([]);

  // Attendance records with tenant-scoped persistent storage (Clean empty start for real production)
  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    try {
      const raw = localStorage.getItem(getAttendanceKey(profile?.tenantId));
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  // Daily staff tasks with tenant-scoped persistent storage (Clean empty start for real production)
  const [tasks, setTasks] = useState<StaffTask[]>(() => {
    try {
      const raw = localStorage.getItem(getTasksKey(profile?.tenantId));
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  // Load backend schedule settings on mount or tenant switch
  useEffect(() => {
    if (!profile?.tenantId) return;
    try {
      const rawAtt = localStorage.getItem(getAttendanceKey(profile.tenantId));
      if (rawAtt) setRecords(JSON.parse(rawAtt));
      const rawTsk = localStorage.getItem(getTasksKey(profile.tenantId));
      if (rawTsk) setTasks(JSON.parse(rawTsk));
      setScheduleConfig(getShopScheduleConfig(profile.tenantId));
    } catch {}

    api.get<Record<string, any>>('/settings')
      .then((settings) => {
        if (settings && typeof settings === 'object' && settings['staff.scheduleConfig']) {
          const remote = settings['staff.scheduleConfig'];
          const merged = { ...getShopScheduleConfig(profile.tenantId), ...remote };
          setScheduleConfig(merged);
          localStorage.setItem(getScheduleKey(profile.tenantId), JSON.stringify(merged));
        }
      })
      .catch(() => {});
  }, [profile?.tenantId]);

  // Save to tenant-scoped localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem(getAttendanceKey(profile?.tenantId), JSON.stringify(records));
    } catch (err) {
      console.warn('Storage save error:', err);
    }
  }, [records, profile?.tenantId]);

  useEffect(() => {
    try {
      localStorage.setItem(getTasksKey(profile?.tenantId), JSON.stringify(tasks));
    } catch (err) {
      console.warn('Storage save error:', err);
    }
  }, [tasks, profile?.tenantId]);

  // Load real sales to dynamically calculate today's sales count
  useEffect(() => {
    api
      .get<Array<{ id: string; createdAt: string; grandTotal: string }>>('/sales')
      .then((data) => setRealSales(data || []))
      .catch(() => setRealSales([]));

    api
      .get<Array<{ id: string; fullName: string; email: string; role?: string }>>('/users')
      .then((users) => {
        if (users && users.length > 0) {
          setStaffUsers(users);
        } else if (profile?.fullName) {
          setStaffUsers([{ id: profile.id, fullName: profile.fullName, email: profile.email || '', role: 'Gérant' }]);
        }
      })
      .catch(() => {
        if (profile?.fullName) {
          setStaffUsers([{ id: profile.id, fullName: profile.fullName, email: profile.email || '', role: 'Gérant' }]);
        }
      });
  }, [profile]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentTimeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Today's active clock-in for the current user
  const activeTodayRecord = useMemo(() => {
    return records.find((r) => r.date === todayStr && !r.clockOutTime && (r.employeeName === (profile?.fullName || 'Utilisateur')));
  }, [records, todayStr, profile?.fullName]);

  // Liste consolidée de tous les employés (utilisateurs de la base + historiques)
  const allEmployeeNames = useMemo(() => {
    const set = new Set<string>();
    if (profile?.fullName) set.add(profile.fullName);
    staffUsers.forEach((u) => {
      if (u.fullName) set.add(u.fullName);
    });
    records.forEach((r) => {
      if (r.employeeName) set.add(r.employeeName);
    });
    return Array.from(set);
  }, [staffUsers, records, profile]);

  // État de présence aujourd'hui pour chaque employé de l'organisation
  const staffPresenceToday = useMemo(() => {
    const todayDate = new Date();
    const todayDay = todayDate.getDay();
    const workingDays = scheduleConfig.workingDays ?? [1, 2, 3, 4, 5, 6];
    const isShopOpenToday = workingDays.includes(todayDay);

    return allEmployeeNames.map((name) => {
      const isEmployeeOffToday = (scheduleConfig.employeeOffDays?.[name] ?? []).includes(todayDay);
      const todayRecord = records.find((r) => r.date === todayStr && r.employeeName === name);
      const isPresent = Boolean(todayRecord && !todayRecord.clockOutTime);
      const isCompleted = Boolean(todayRecord && todayRecord.clockOutTime);

      let status: 'PRESENT' | 'DEPARTED' | 'ABSENT' | 'CLOSED' | 'DAY_OFF' = 'ABSENT';
      if (isPresent) {
        status = 'PRESENT';
      } else if (isCompleted) {
        status = 'DEPARTED';
      } else if (!isShopOpenToday) {
        status = 'CLOSED';
      } else if (isEmployeeOffToday) {
        status = 'DAY_OFF';
      }

      return {
        name,
        todayRecord,
        status,
        clockInTime: todayRecord?.clockInTime,
        clockOutTime: todayRecord?.clockOutTime,
        durationHours: todayRecord?.durationHours,
        notes: todayRecord?.notes,
      };
    });
  }, [allEmployeeNames, records, todayStr, scheduleConfig]);

  // Count sales made today from real backend
  const todaySalesCount = useMemo(() => {
    return realSales.filter((s) => s.createdAt.slice(0, 10) === todayStr).length;
  }, [realSales, todayStr]);

  // 🟢 Pointer l'Arrivée (STRICTEMENT PERSONNEL : Chaque utilisateur ne gère que pour lui-même)
  const handleClockIn = () => {
    const empName = profile?.fullName || 'Utilisateur';
    const alreadyIn = records.some((r) => r.date === todayStr && r.employeeName === empName && !r.clockOutTime);
    if (alreadyIn) {
      addToast(`Votre arrivée est déjà enregistrée pour aujourd'hui !`, 'warning');
      return;
    }

    const now = new Date();
    const clockInTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const [openH, openM] = scheduleConfig.openingTime.split(':').map(Number);
    const [nowH, nowM] = clockInTime.split(':').map(Number);

    const openMinutes = openH * 60 + openM;
    const nowMinutes = nowH * 60 + nowM;
    const diff = nowMinutes - openMinutes;

    const isLate = diff > scheduleConfig.graceMinutes;
    const lateMinutes = isLate ? diff : 0;

    const newRecord: AttendanceRecord = {
      id: `att-${Date.now()}`,
      employeeName: empName,
      date: todayStr,
      clockInTime,
      status: isLate ? 'LATE' : 'ON_TIME',
      lateMinutes,
      salesCount: todaySalesCount,
      notes: `Arrivée personnelle pointée à ${clockInTime} (${isLate ? `Retard de ${lateMinutes} min` : 'À l’heure'}).`,
    };

    setRecords((prev) => [newRecord, ...prev]);
    addToast(
      `Votre arrivée a été pointée à ${clockInTime} ! ${isLate ? `Retard de ${lateMinutes} min notifié.` : 'Parfaitement à l’heure.'}`,
      isLate ? 'warning' : 'success',
    );
  };

  // 🔴 Pointer le Départ (STRICTEMENT PERSONNEL)
  const handleClockOut = () => {
    const empName = profile?.fullName || 'Utilisateur';
    const activeRec = records.find(
      (r) => r.date === todayStr && !r.clockOutTime && r.employeeName === empName,
    );

    if (!activeRec) {
      addToast(`Aucune arrivée active trouvée pour votre compte aujourd’hui`, 'error');
      return;
    }

    const clockOutTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // Calcul de la durée
    const [inH, inM] = activeRec.clockInTime.split(':').map(Number);
    const [outH, outM] = clockOutTime.split(':').map(Number);
    const inMin = inH * 60 + inM;
    const outMin = outH * 60 + outM;
    const durationHours = Math.max(0.1, Math.round(((outMin - inMin) / 60) * 10) / 10);

    setRecords((prev) =>
      prev.map((r) => {
        if (r.id === activeRec.id) {
          return {
            ...r,
            clockOutTime,
            durationHours,
            salesCount: todaySalesCount,
            notes: `${r.notes || ''} — Départ pointé à ${clockOutTime} (${durationHours}h travaillées, ${todaySalesCount} ventes réalisées).`,
          };
        }
        return r;
      }),
    );

    addToast(`Départ de ${empName} pointé à ${clockOutTime} ! Total travaillé : ${durationHours}h.`, 'success');
  };

  // Toggle task done
  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextDone = !t.isDone;
          return {
            ...t,
            isDone: nextDone,
            doneAt: nextDone ? new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : undefined,
          };
        }
        return t;
      }),
    );
  };

  // New task modal state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState(profile?.fullName || '');
  const [newTaskPriority, setNewTaskPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: StaffTask = {
      id: `tsk-${Date.now()}`,
      title: newTaskTitle.trim(),
      assignedTo: newTaskAssignee || 'Équipe',
      isDone: false,
      date: todayStr,
      priority: newTaskPriority,
    };

    setTasks((prev) => [newTask, ...prev]);
    setNewTaskTitle('');
    addToast('Nouvelle tâche enregistrée', 'success');
  };

  // Export & backup data (zero loss)
  const handleExportBackup = () => {
    const data = {
      exportDate: new Date().toISOString(),
      scheduleConfig,
      records,
      tasks,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sauvegarde-personnel-pointage-${todayStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Sauvegarde intégrale téléchargée avec succès (Zéro perte de données)', 'success');
  };

  // Filtered reports avec prise en compte du filtre par employé
  const filteredRecords = useMemo(() => {
    let list = records;
    if (selectedEmployeeFilter !== 'ALL') {
      list = list.filter((r) => r.employeeName === selectedEmployeeFilter);
    }
    if (reportPeriod === 'DAY') {
      return list.filter((r) => r.date === todayStr);
    }
    if (reportPeriod === 'WEEK') {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      return list.filter((r) => r.date >= oneWeekAgo);
    }
    // MONTH
    const currentMonth = todayStr.slice(0, 7);
    return list.filter((r) => r.date.startsWith(currentMonth));
  }, [records, reportPeriod, todayStr, selectedEmployeeFilter]);

  const reportStats = useMemo(() => {
    const totalClocks = filteredRecords.length;
    const onTimeCount = filteredRecords.filter((r) => r.status === 'ON_TIME').length;
    const lateCount = filteredRecords.filter((r) => r.status === 'LATE').length;
    const totalHours = filteredRecords.reduce((sum, r) => sum + (r.durationHours || 0), 0);
    const totalSalesRecorded = filteredRecords.reduce((sum, r) => sum + (r.salesCount || 0), 0);

    return {
      totalClocks,
      onTimeCount,
      lateCount,
      punctualityRate: totalClocks > 0 ? Math.round((onTimeCount / totalClocks) * 100) : 100,
      totalHours: Math.round(totalHours * 10) / 10,
      totalSalesRecorded,
    };
  }, [filteredRecords]);

  return (
    <div className="staff-attendance-page">
      <PageHeader
        title="Personnel, Pointage & Feuilles de Temps"
        subtitle="Suivi précis des arrivées, départs, tâches réalisées et volume de ventes par employé"
        primaryAction={{
          label: '📥 Exporter Sauvegarde (Zéro Perte)',
          onClick: handleExportBackup,
        }}
      />

      {/* Quick Opening/Closing Hero Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '1px solid #334155',
          borderRadius: '16px',
          padding: '1.75rem 2rem',
          color: '#ffffff',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⏱️</span>
            <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#f8fafc' }}>
              Horaires Magasin : {scheduleConfig.openingTime} ➔ {scheduleConfig.closingTime}
            </h2>
            <span
              style={{
                fontSize: '0.74rem',
                background: activeTodayRecord ? '#15803d' : '#475569',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '999px',
                fontWeight: 700,
              }}
            >
              {activeTodayRecord ? '● Boutique Ouverte' : '○ En attente d’ouverture'}
            </span>
          </div>

          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Heure actuelle : <strong>{currentTimeStr}</strong> • Tolérance retard :{' '}
            <strong>{scheduleConfig.graceMinutes} min</strong> • Ventes du jour en caisse :{' '}
            <strong style={{ color: '#38bdf8' }}>{todaySalesCount} ventes</strong>
          </div>
        </div>

        {/* Dynamic Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {!activeTodayRecord ? (
            <button
              type="button"
              onClick={() => handleClockIn()}
              style={{
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.85rem 1.6rem',
                fontSize: '0.95rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 15px rgba(22, 163, 74, 0.4)',
                transition: 'transform 0.15s ease',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>🟢</span>
              <span>Ouvrir la Boutique / Pointer mon Arrivée</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleClockOut()}
              style={{
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.85rem 1.6rem',
                fontSize: '0.95rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 15px rgba(220, 38, 38, 0.4)',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>🔴</span>
              <span>Fermer la Boutique / Pointer mon Départ</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid var(--border)',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        {[
          { key: 'attendance', label: '📅 Pointages & Présence', badge: `${records.length} pointages` },
          { key: 'tasks', label: '✅ Tâches d’Équipe (Faites / Pas faites)', badge: `${tasks.filter((t) => t.isDone).length}/${tasks.length}` },
          { key: 'reports', label: '📊 Rapports (Jour / Semaine / Mois)', badge: 'Synthèse Ventes' },
          { key: 'config', label: '⚙️ Configuration Horaires', badge: 'Matin & Soir' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '0.65rem 1.25rem',
                border: 'none',
                background: isActive ? 'var(--surface)' : 'transparent',
                borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent',
                cursor: 'pointer',
                borderRadius: '8px 8px 0 0',
              }}
            >
              <span style={{ fontWeight: isActive ? 700 : 600, fontSize: '0.9rem', color: isActive ? '#1e40af' : 'var(--text)' }}>
                {tab.label}
              </span>
              <span style={{ fontSize: '0.74rem', color: isActive ? '#2563eb' : 'var(--text-muted)' }}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════
          ONGLET 1 : POINTAGES & PRÉSENCES
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Suivi en direct : Qui est présent / qui est absent aujourd'hui */}
          <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                  👥 Présence en Direct de l'Équipe Aujourd'hui ({todayStr})
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  Suivi de présence en temps réel. Règle de sécurité : chaque utilisateur gère et enregistre exclusivement son propre pointage personnel. Il est impossible de pointer pour autrui.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: '999px', fontWeight: 700 }}>
                  {staffPresenceToday.filter((p) => p.status === 'PRESENT').length} Présent(s)
                </span>
                <span style={{ fontSize: '0.78rem', background: '#fee2e2', color: '#b91c1c', padding: '3px 10px', borderRadius: '999px', fontWeight: 700 }}>
                  {staffPresenceToday.filter((p) => p.status === 'ABSENT').length} Absent(s)
                </span>
                <span style={{ fontSize: '0.78rem', background: '#f3e8ff', color: '#7e22ce', padding: '3px 10px', borderRadius: '999px', fontWeight: 700 }}>
                  {staffPresenceToday.filter((p) => p.status === 'CLOSED' || p.status === 'DAY_OFF').length} Fermé/Repos
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {staffPresenceToday.map((member) => {
                const isPresent = member.status === 'PRESENT';
                const isDeparted = member.status === 'DEPARTED';
                const isClosed = member.status === 'CLOSED';
                const isDayOff = member.status === 'DAY_OFF';

                const cardBg = isPresent ? '#f0fdf4' : isDeparted ? '#f8fafc' : isClosed ? '#faf5ff' : isDayOff ? '#f0f9ff' : '#fef2f2';
                const cardBorder = isPresent ? '#bbf7d0' : isDeparted ? '#e2e8f0' : isClosed ? '#e9d5ff' : isDayOff ? '#bae6fd' : '#fecaca';
                const badgeBg = isPresent ? '#15803d' : isDeparted ? '#475569' : isClosed ? '#6b21a8' : isDayOff ? '#0284c7' : '#dc2626';
                const badgeLabel = isPresent ? '● PRÉSENT' : isDeparted ? '○ DÉPART POINTÉ' : isClosed ? '🏖️ BOUTIQUE FERMÉE' : isDayOff ? '🌴 REPOS PROGRAMMÉ' : '✕ ABSENT';

                return (
                  <div
                    key={member.name}
                    style={{
                      background: cardBg,
                      border: `1px solid ${cardBorder}`,
                      borderRadius: '10px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a' }}>{member.name}</span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: badgeBg,
                            color: '#ffffff',
                          }}
                        >
                          {badgeLabel}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                        {isPresent && (
                          <span>Arrivée pointée à <strong>{member.clockInTime}</strong></span>
                        )}
                        {isDeparted && (
                          <span>Journée terminée ({member.clockInTime} ➔ {member.clockOutTime}) • {member.durationHours}h</span>
                        )}
                        {isClosed && (
                          <span style={{ color: '#7e22ce' }}>Jour de fermeture hebdomadaire (aucun pointage requis)</span>
                        )}
                        {isDayOff && (
                          <span style={{ color: '#0369a1' }}>Jour de repos planifié (absence justifiée)</span>
                        )}
                        {!isPresent && !isDeparted && !isClosed && !isDayOff && (
                          <span style={{ color: '#b91c1c' }}>Aucun pointage d'arrivée pour aujourd'hui</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem', paddingTop: '0.45rem', borderTop: '1px solid #e2e8f0', fontSize: '0.74rem' }}>
                      {member.name === (profile?.fullName || 'Utilisateur') ? (
                        <span style={{ color: '#2563eb', fontWeight: 700 }}>
                          ★ Votre compte (géré via le bouton principal)
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>
                          Pointage personnel individuel
                        </span>
                      )}

                      <span style={{ fontWeight: 600, color: badgeBg }}>
                        {isPresent ? 'En poste' : isDeparted ? 'Sorti' : isClosed ? 'Fermé' : isDayOff ? 'Repos' : 'Non pointé'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Journal Historique des Pointages</h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px' }}>Date</th>
                  <th style={{ padding: '8px' }}>Employé</th>
                  <th style={{ padding: '8px' }}>Arrivée</th>
                  <th style={{ padding: '8px' }}>Départ</th>
                  <th style={{ padding: '8px' }}>Durée</th>
                  <th style={{ padding: '8px' }}>Ponctualité</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Ventes faites</th>
                  <th style={{ padding: '8px' }}>Observations</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>⏱️</div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Aucun pointage enregistré</div>
                      <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                        Cliquez sur le bouton vert <strong>« Pointer mon Arrivée »</strong> ci-dessus pour enregistrer votre début de journée.
                      </div>
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 600 }}>{r.date}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 700 }}>{r.employeeName}</td>
                      <td style={{ padding: '10px 8px', color: '#15803d', fontWeight: 700 }}>{r.clockInTime}</td>
                      <td style={{ padding: '10px 8px', color: r.clockOutTime ? '#b91c1c' : '#94a3b8', fontWeight: 700 }}>
                        {r.clockOutTime || 'En cours...'}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {r.durationHours ? `${r.durationHours}h` : '—'}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: r.status === 'ON_TIME' ? '#dcfce7' : '#fee2e2',
                            color: r.status === 'ON_TIME' ? '#166534' : '#991b1b',
                          }}
                        >
                          {r.status === 'ON_TIME' ? '✓ À l’heure' : `⚠️ Retard (${r.lateMinutes} min)`}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: '#2563eb' }}>
                        {r.salesCount} ventes
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {r.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 2 : TÂCHES D’ÉQUIPE (FAITES / PAS FAITES)
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'tasks' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.2fr) minmax(300px, 0.8fr)', gap: '1.5rem' }}>
          {/* Liste des tâches */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Feuille de Tâches Journalières</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
              Cochez les tâches au fur et à mesure qu'elles sont accomplies.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {tasks.length === 0 ? (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>📋</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Aucune tâche assignée</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                    Utilisez le formulaire à droite pour créer et assigner des missions journalières à votre équipe.
                  </div>
                </div>
              ) : (
                tasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleToggleTask(t.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: t.isDone ? '#f0fdf4' : '#ffffff',
                      border: t.isDone ? '1px solid #86efac' : '1px solid #cbd5e1',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={t.isDone}
                        onChange={() => {}}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            textDecoration: t.isDone ? 'line-through' : 'none',
                            color: t.isDone ? '#166534' : 'var(--text)',
                          }}
                        >
                          {t.title}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>
                          Assigné à : <strong>{t.assignedTo}</strong> • {t.isDone ? `✓ Réalisée à ${t.doneAt}` : '⏳ En attente'}
                        </div>
                      </div>
                    </div>

                    <div>
                      {t.priority === 'URGENT' && (
                        <span style={{ fontSize: '0.7rem', background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                          URGENT
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Formulaire ajout tâche */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem' }}>+ Assigner une Nouvelle Tâche</h3>
            <form onSubmit={handleAddTask}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                  Description de la tâche :
                </label>
                <textarea
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Ex: Nettoyer la vitrine, faire l’inventaire des écouteurs..."
                  rows={3}
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                  Assigner à :
                </label>
                <input
                  type="text"
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  placeholder="Nom de l’employé ou groupe"
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                  Priorité :
                </label>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                >
                  <option value="NORMAL">Normale</option>
                  <option value="URGENT">⚠️ Urgente / Prioritaire</option>
                </select>
              </div>

              <button
                type="submit"
                className="primary"
                style={{ width: '100%', padding: '0.75rem', fontWeight: 800, background: '#2563eb' }}
              >
                + Ajouter la Tâche
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 3 : RAPPORTS (JOUR / SEMAINE / MOIS)
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'reports' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Rapport Consolidé du Personnel & Ventes</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Synthèse détaillée de l'assiduité, des heures prestées et des performances commerciales.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Sélecteur d'employé pour rapport individuel */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Employé :</span>
                <select
                  value={selectedEmployeeFilter}
                  onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                  }}
                >
                  <option value="ALL">👥 Toute l'équipe (Tous)</option>
                  {allEmployeeNames.map((name) => (
                    <option key={name} value={name}>
                      👤 {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sélecteur de période */}
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {(['DAY', 'WEEK', 'MONTH'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setReportPeriod(p)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: reportPeriod === p ? '#2563eb' : '#ffffff',
                      color: reportPeriod === p ? '#ffffff' : 'var(--text)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    {p === 'DAY' ? 'Jour' : p === 'WEEK' ? 'Semaine' : 'Mois'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#0f172a',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                🖨️ Imprimer la feuille
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: 700 }}>Total Pointages</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e3a8a', marginTop: '0.2rem' }}>
                {reportStats.totalClocks}
              </div>
            </div>

            <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 700 }}>Taux de Ponctualité</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#14532d', marginTop: '0.2rem' }}>
                {reportStats.punctualityRate}%
              </div>
              <div style={{ fontSize: '0.72rem', color: '#15803d' }}>
                {reportStats.onTimeCount} à l’heure • {reportStats.lateCount} retard(s)
              </div>
            </div>

            <div style={{ background: '#fefce8', padding: '1rem', borderRadius: '10px', border: '1px solid #fef08a' }}>
              <div style={{ fontSize: '0.78rem', color: '#a16207', fontWeight: 700 }}>Heures Travaillées</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#713f12', marginTop: '0.2rem' }}>
                {reportStats.totalHours} h
              </div>
            </div>

            <div style={{ background: '#faf5ff', padding: '1rem', borderRadius: '10px', border: '1px solid #e9d5ff' }}>
              <div style={{ fontSize: '0.78rem', color: '#7e22ce', fontWeight: 700 }}>Ventes Encaissées</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#581c87', marginTop: '0.2rem' }}>
                {reportStats.totalSalesRecorded} ventes
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 4 : CONFIGURATION HORAIRES
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'config' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', maxWidth: '600px', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Configuration des Horaires Boutique</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
            Définissez l'heure d'ouverture et de fermeture. Le système affiche le bouton d'arrivée chaque matin à l'heure programmée.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                🌅 Heure d'ouverture :
              </label>
              <input
                type="time"
                value={scheduleConfig.openingTime}
                onChange={(e) => {
                  const updated = saveShopScheduleConfig({ openingTime: e.target.value }, profile?.tenantId);
                  setScheduleConfig(updated);
                  addToast('Heure d’ouverture mise à jour', 'success');
                }}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                🌇 Heure de fermeture :
              </label>
              <input
                type="time"
                value={scheduleConfig.closingTime}
                onChange={(e) => {
                  const updated = saveShopScheduleConfig({ closingTime: e.target.value }, profile?.tenantId);
                  setScheduleConfig(updated);
                  addToast('Heure de fermeture mise à jour', 'success');
                }}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>
              ⏱️ Tolérance de retard (minutes) :
            </label>
            <input
              type="number"
              min="0"
              value={scheduleConfig.graceMinutes}
              onChange={(e) => {
                const updated = saveShopScheduleConfig({ graceMinutes: Number(e.target.value) || 0 }, profile?.tenantId);
                setScheduleConfig(updated);
              }}
              style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)' }}
            />
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Au-delà de cette tolérance, l'employé est comptabilisé en retard.
            </span>
          </div>

          {/* Pause intermédiaire / déjeuner */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginBottom: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.86rem', fontWeight: 700, cursor: 'pointer', marginBottom: '0.5rem' }}>
              <input
                type="checkbox"
                checked={scheduleConfig.breakEnabled ?? false}
                onChange={(e) => {
                  const updated = saveShopScheduleConfig({ breakEnabled: e.target.checked }, profile?.tenantId);
                  setScheduleConfig(updated);
                  addToast(`Pause de mi-journée ${e.target.checked ? 'activée' : 'désactivée'}`, 'info');
                }}
                style={{ width: '16px', height: '16px' }}
              />
              🍽️ Activer une pause journalière (déjeuner / repos intermédiaire)
            </label>

            {scheduleConfig.breakEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '0.2rem' }}>Début pause :</label>
                  <input
                    type="time"
                    value={scheduleConfig.breakStartTime || '12:30'}
                    onChange={(e) => {
                      const updated = saveShopScheduleConfig({ breakStartTime: e.target.value }, profile?.tenantId);
                      setScheduleConfig(updated);
                    }}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '0.2rem' }}>Fin pause :</label>
                  <input
                    type="time"
                    value={scheduleConfig.breakEndTime || '14:00'}
                    onChange={(e) => {
                      const updated = saveShopScheduleConfig({ breakEndTime: e.target.value }, profile?.tenantId);
                      setScheduleConfig(updated);
                    }}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.82rem' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Jours Ouvrables de la Boutique */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 800, marginBottom: '0.35rem' }}>
              📅 Jours Ouvrables & Ouverture Hebdomadaire :
            </label>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
              Cochez les jours où la boutique est officiellement ouverte. Les jours non cochés (ex: dimanche) sont automatiquement reconnus comme fermés et ne génèrent AUCUNE absence.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(75px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {[
                { day: 1, label: 'Lun' },
                { day: 2, label: 'Mar' },
                { day: 3, label: 'Mer' },
                { day: 4, label: 'Jeu' },
                { day: 5, label: 'Ven' },
                { day: 6, label: 'Sam' },
                { day: 0, label: 'Dim' },
              ].map(({ day, label }) => {
                const isWorking = (scheduleConfig.workingDays ?? [1, 2, 3, 4, 5, 6]).includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      const current = scheduleConfig.workingDays ?? [1, 2, 3, 4, 5, 6];
                      const next = isWorking ? current.filter((d) => d !== day) : [...current, day].sort();
                      const updated = saveShopScheduleConfig({ workingDays: next }, profile?.tenantId);
                      setScheduleConfig(updated);
                      addToast(`${label} ${isWorking ? 'marqué comme fermé' : 'marqué comme ouvert'}`, 'success');
                    }}
                    style={{
                      padding: '0.6rem 0.3rem',
                      borderRadius: '8px',
                      border: isWorking ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: isWorking ? '#eff6ff' : '#f8fafc',
                      color: isWorking ? '#1d4ed8' : '#64748b',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}
                  >
                    <span>{label}</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>
                      {isWorking ? '🟢 Ouvert' : '⚪ Fermé'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem', fontSize: '0.78rem', color: '#166534' }}>
              🛡️ <strong>Règle de gestion RH :</strong> Un jour non ouvré ou un jour de repos programmé pour un employé ne peut jamais être comptabilisé comme une absence injustifiée.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
