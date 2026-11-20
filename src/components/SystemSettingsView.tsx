import React, { useEffect, useRef, useState } from 'react';
import {
  UserCheck,
  Users,
  Building2,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Star,
  DatabaseBackup,
  Download,
  Upload,
  RotateCcw,
} from 'lucide-react';
import type {
  BackupSnapshotMeta,
  CarePatient,
  CertifyingCaregiver,
  InspectorConfig,
  SystemSettings,
  SystemState,
  VolunteerProfile,
} from '../types';

interface SystemSettingsViewProps {
  volunteers: VolunteerProfile[];
  caregivers: CertifyingCaregiver[];
  patients: CarePatient[];
  inspector: InspectorConfig;
  systemSettings: SystemSettings;
  backups: BackupSnapshotMeta[];
  onUpsertVolunteer: (
    payload: Omit<VolunteerProfile, 'id'> & { id?: string }
  ) => Promise<VolunteerProfile>;
  onDeleteVolunteer: (id: string) => Promise<void>;
  onUpsertCaregiver: (
    payload: Omit<CertifyingCaregiver, 'id' | 'patientName'> & { id?: string }
  ) => Promise<CertifyingCaregiver>;
  onDeleteCaregiver: (id: string) => Promise<void>;
  onUpdateSettings: (payload: {
    inspector?: Partial<InspectorConfig>;
    systemSettings?: Partial<SystemSettings>;
  }) => Promise<unknown>;
  onFetchBackups: () => Promise<BackupSnapshotMeta[]>;
  onCreateBackup: (note?: string) => Promise<BackupSnapshotMeta>;
  onRestoreBackup: (id: string) => Promise<SystemState>;
  onImportBackup: (jsonData: unknown) => Promise<SystemState>;
  onDeleteBackup: (id: string) => Promise<void>;
}

export function SystemSettingsView({
  volunteers,
  caregivers,
  patients,
  inspector,
  systemSettings,
  backups,
  onUpsertVolunteer,
  onDeleteVolunteer,
  onUpsertCaregiver,
  onDeleteCaregiver,
  onUpdateSettings,
  onFetchBackups,
  onCreateBackup,
  onRestoreBackup,
  onImportBackup,
  onDeleteBackup,
}: SystemSettingsViewProps) {
  const [activeSection, setActiveSection] = useState<
    'volunteers' | 'caregivers' | 'facility' | 'backups'
  >('volunteers');

  // Volunteer form state
  const [volFormOpen, setVolFormOpen] = useState(false);
  const [editingVolId, setEditingVolId] = useState<string | undefined>(undefined);
  const [volName, setVolName] = useState('');
  const [volCode, setVolCode] = useState('');
  const [volArea, setVolArea] = useState('');
  const [volPhone, setVolPhone] = useState('');
  const [volBusy, setVolBusy] = useState(false);
  const [volError, setVolError] = useState<string | null>(null);
  const [confirmDeleteVolId, setConfirmDeleteVolId] = useState<string | null>(null);

  // Caregiver form state
  const [caregiverPatientFilter, setCaregiverPatientFilter] = useState<string>('all');
  const [cgFormOpen, setCgFormOpen] = useState(false);
  const [editingCgId, setEditingCgId] = useState<string | undefined>(undefined);
  const [cgPatientId, setCgPatientId] = useState(patients[0]?.id ?? '');
  const [cgName, setCgName] = useState('');
  const [cgRelation, setCgRelation] = useState('บุตรสาว');
  const [cgPhone, setCgPhone] = useState('');
  const [cgIsPrimary, setCgIsPrimary] = useState(true);
  const [cgBusy, setCgBusy] = useState(false);
  const [cgError, setCgError] = useState<string | null>(null);

  // Facility & workflow rules state
  const [facilityName, setFacilityName] = useState(inspector.facility);
  const [inspectorName, setInspectorName] = useState(inspector.name);
  const [inspectorPosition, setInspectorPosition] = useState(inspector.position);
  const [directorName, setDirectorName] = useState(inspector.directorName);
  const [requireSig, setRequireSig] = useState(systemSettings.requireCaregiverSignature);
  const [requireName, setRequireName] = useState(systemSettings.requireCaregiverSignerName);
  const [defaultDuration, setDefaultDuration] = useState(
    String(systemSettings.defaultVisitDurationMinutes)
  );
  const [autoAlertWatch, setAutoAlertWatch] = useState(systemSettings.autoAlertOnWatchLevel);
  const [settingsBusy, setSettingsBusy] = useState(false);

  // Backup & restore state
  const [backupNote, setBackupNote] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [confirmDeleteBackupId, setConfirmDeleteBackupId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (activeSection === 'backups') {
      onFetchBackups().catch(() => {
        // Handled cleanly if fetch fails
      });
    }
  }, [activeSection, onFetchBackups]);

  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBackupBusy(true);
    setBackupError(null);
    try {
      await onCreateBackup(backupNote.trim() || undefined);
      setBackupNote('');
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'สำรองข้อมูลไม่สำเร็จ');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBackupBusy(true);
    setBackupError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      await onImportBackup(parsed);
    } catch (err) {
      setBackupError(
        err instanceof Error ? err.message : 'ไฟล์ที่เลือกไม่ใช่ไฟล์สำรองข้อมูล JSON ที่ถูกต้อง'
      );
    } finally {
      setBackupBusy(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatBackupDate = (iso: string) =>
    new Date(iso).toLocaleString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const openAddVolunteer = () => {
    setEditingVolId(undefined);
    setVolName('');
    setVolCode(`อสพ-04${20 + volunteers.length}`);
    setVolArea('');
    setVolPhone('');
    setVolError(null);
    setVolFormOpen(true);
  };

  const openEditVolunteer = (vol: VolunteerProfile) => {
    setEditingVolId(vol.id);
    setVolName(vol.name);
    setVolCode(vol.code);
    setVolArea(vol.area);
    setVolPhone(vol.phone);
    setVolError(null);
    setVolFormOpen(true);
  };

  const handleSaveVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    setVolBusy(true);
    setVolError(null);
    try {
      await onUpsertVolunteer({
        id: editingVolId,
        name: volName,
        code: volCode,
        area: volArea,
        phone: volPhone,
      });
      setVolFormOpen(false);
    } catch (err) {
      setVolError(err instanceof Error ? err.message : 'บันทึกข้อมูล อสพ. ไม่สำเร็จ');
    } finally {
      setVolBusy(false);
    }
  };

  const openAddCaregiver = () => {
    setEditingCgId(undefined);
    setCgPatientId(
      caregiverPatientFilter !== 'all' ? caregiverPatientFilter : patients[0]?.id ?? ''
    );
    setCgName('');
    setCgRelation('ผู้ดูแลในครอบครัว');
    setCgPhone('');
    setCgIsPrimary(true);
    setCgError(null);
    setCgFormOpen(true);
  };

  const openEditCaregiver = (cg: CertifyingCaregiver) => {
    setEditingCgId(cg.id);
    setCgPatientId(cg.patientId);
    setCgName(cg.name);
    setCgRelation(cg.relation);
    setCgPhone(cg.phone);
    setCgIsPrimary(cg.isPrimary);
    setCgError(null);
    setCgFormOpen(true);
  };

  const handleSaveCaregiver = async (e: React.FormEvent) => {
    e.preventDefault();
    setCgBusy(true);
    setCgError(null);
    try {
      await onUpsertCaregiver({
        id: editingCgId,
        patientId: cgPatientId,
        name: cgName,
        relation: cgRelation,
        phone: cgPhone,
        isPrimary: cgIsPrimary,
      });
      setCgFormOpen(false);
    } catch (err) {
      setCgError(err instanceof Error ? err.message : 'บันทึกข้อมูลผู้ดูแลไม่สำเร็จ');
    } finally {
      setCgBusy(false);
    }
  };

  const handleSaveFacilitySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsBusy(true);
    try {
      await onUpdateSettings({
        inspector: {
          facility: facilityName,
          name: inspectorName,
          position: inspectorPosition,
          directorName,
        },
        systemSettings: {
          requireCaregiverSignature: requireSig,
          requireCaregiverSignerName: requireName,
          defaultVisitDurationMinutes: Number(defaultDuration) || 35,
          autoAlertOnWatchLevel: autoAlertWatch,
        },
      });
    } finally {
      setSettingsBusy(false);
    }
  };

  const filteredCaregivers = caregivers.filter(
    (c) => caregiverPatientFilter === 'all' || c.patientId === caregiverPatientFilter
  );

  return (
    <div className="space-y-6">
      {/* Section Switcher */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveSection('volunteers')}
          className={`inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeSection === 'volunteers'
              ? 'bg-white text-teal-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>ผู้ปฏิบัติงาน (อสพ.)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('caregivers')}
          className={`inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeSection === 'caregivers'
              ? 'bg-white text-teal-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>ผู้ดูแลที่ลงนามรับรอง</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('facility')}
          className={`inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeSection === 'facility'
              ? 'bg-white text-teal-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>หน่วยบริการและข้อกำหนด</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('backups')}
          className={`inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeSection === 'backups'
              ? 'bg-white text-teal-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <DatabaseBackup className="w-4 h-4" />
          <span>สำรองข้อมูล</span>
        </button>
      </div>

      {/* SECTION 1: Volunteers (อสพ.) */}
      {activeSection === 'volunteers' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
                ทะเบียนผู้ปฏิบัติงานอาสาพยาบาลชุมชน (อสพ.)
              </h2>
              <p className="text-xs text-slate-500">
                รายชื่อ อสพ. ใช้สำหรับมอบหมายผู้ป่วย บันทึกการเยี่ยมบ้าน และออกใบตรวจรับงานประจำเดือน
              </p>
            </div>
            <button
              type="button"
              onClick={openAddVolunteer}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่ม อสพ. ใหม่</span>
            </button>
          </div>

          {volFormOpen && (
            <form
              onSubmit={handleSaveVolunteer}
              className="bg-white border border-teal-200 rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  {editingVolId ? 'แก้ไขข้อมูล อสพ.' : 'เพิ่มรายชื่อ อสพ. ใหม่'}
                </h3>
                <button
                  type="button"
                  onClick={() => setVolFormOpen(false)}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {volError && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {volError}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อ-นามสกุล อสพ. *
                  </label>
                  <input
                    type="text"
                    required
                    value={volName}
                    onChange={(e) => setVolName(e.target.value)}
                    placeholder="เช่น นางวันดี สุขใจ"
                    className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รหัสประจำตัว *
                  </label>
                  <input
                    type="text"
                    required
                    value={volCode}
                    onChange={(e) => setVolCode(e.target.value)}
                    placeholder="อสพ-0420"
                    className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    พื้นที่รับผิดชอบ (หมู่บ้าน)
                  </label>
                  <input
                    type="text"
                    value={volArea}
                    onChange={(e) => setVolArea(e.target.value)}
                    placeholder="เช่น หมู่ 3 บ้านดอนแก้ว"
                    className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    type="tel"
                    value={volPhone}
                    onChange={(e) => setVolPhone(e.target.value)}
                    placeholder="08X-XXX-XXXX"
                    className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono-tabular"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setVolFormOpen(false)}
                  className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={volBusy}
                  className="inline-flex items-center gap-1.5 min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{volBusy ? 'กำลังบันทึก...' : 'บันทึกข้อมูล อสพ.'}</span>
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {volunteers.map((vol) => {
              const assignedCount = patients.filter(
                (p) => p.assignedVolunteerId === vol.id
              ).length;
              const isConfirmingDelete = confirmDeleteVolId === vol.id;

              return (
                <article
                  key={vol.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono-tabular text-xs font-semibold text-teal-700">
                        {vol.code} · ผู้ป่วยในความดูแล {assignedCount} ราย
                      </p>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">{vol.name}</h3>
                      <p className="text-xs text-slate-600 mt-1">{vol.area}</p>
                      <p className="text-xs text-slate-500 font-mono-tabular mt-0.5">
                        โทร {vol.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditVolunteer(vol)}
                        aria-label={`แก้ไข ${vol.name}`}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-xl transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {volunteers.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDeleteVolId(isConfirmingDelete ? null : vol.id)
                          }
                          aria-label={`ลบ ${vol.name}`}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isConfirmingDelete && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                      <span className="text-rose-900 font-medium">
                        ยืนยันลบรายชื่อ? ผู้ป่วยที่รับผิดชอบจะถูกโอนให้ อสพ. ท่านแรก
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteVolId(null)}
                          className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium"
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteVolunteer(vol.id);
                            setConfirmDeleteVolId(null);
                          }}
                          className="px-2.5 py-1.5 bg-rose-700 text-white rounded-lg font-semibold"
                        >
                          ยืนยันลบ
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION 2: Certifying Caregivers (ผู้ดูแลที่ลงนามรับรอง) */}
      {activeSection === 'caregivers' && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
                ทะเบียนผู้ดูแลที่ลงนามรับรองการเยี่ยมบ้าน
              </h2>
              <p className="text-xs text-slate-500">
                กำหนดรายชื่อญาติหรือผู้ดูแลที่มีสิทธิ์ลงนามรับรองหน้างาน (อสพ. เลือกใช้ได้ทันทีในแบบฟอร์มเยี่ยม)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                aria-label="กรองผู้ดูแลตามผู้ป่วย"
                value={caregiverPatientFilter}
                onChange={(e) => setCaregiverPatientFilter(e.target.value)}
                className="min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900"
              >
                <option value="all">ผู้ป่วยทุกราย</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={openAddCaregiver}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มผู้ดูแลรับรอง</span>
              </button>
            </div>
          </div>

          {cgFormOpen && (
            <form
              onSubmit={handleSaveCaregiver}
              className="bg-white border border-teal-200 rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  {editingCgId ? 'แก้ไขข้อมูลผู้ดูแลที่ลงนามรับรอง' : 'เพิ่มผู้ดูแลที่ลงนามรับรอง'}
                </h3>
                <button
                  type="button"
                  onClick={() => setCgFormOpen(false)}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {cgError && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {cgError}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ผู้ป่วยที่ดูแล *
                  </label>
                  <select
                    disabled={Boolean(editingCgId)}
                    value={cgPatientId}
                    onChange={(e) => setCgPatientId(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white disabled:bg-slate-50"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อ-นามสกุลผู้ดูแล *
                  </label>
                  <input
                    type="text"
                    required
                    value={cgName}
                    onChange={(e) => setCgName(e.target.value)}
                    placeholder="เช่น นางสมศรี พงษ์สวัสดิ์"
                    className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ความสัมพันธ์กับผู้ป่วย
                  </label>
                  <input
                    type="text"
                    value={cgRelation}
                    onChange={(e) => setCgRelation(e.target.value)}
                    placeholder="เช่น ภรรยา, บุตรสาว, หลาน"
                    className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เบอร์โทรติดต่อ
                  </label>
                  <input
                    type="tel"
                    value={cgPhone}
                    onChange={(e) => setCgPhone(e.target.value)}
                    placeholder="08X-XXX-XXXX"
                    className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono-tabular"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={cgIsPrimary}
                    onChange={(e) => setCgIsPrimary(e.target.checked)}
                    className="w-4 h-4 accent-teal-700 rounded"
                  />
                  <span>กำหนดเป็นผู้ดูแลหลัก (ใช้เป็นค่าเริ่มต้นในการลงนามรับรอง)</span>
                </label>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCgFormOpen(false)}
                    className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={cgBusy}
                    className="inline-flex items-center gap-1.5 min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{cgBusy ? 'กำลังบันทึก...' : 'บันทึกผู้ดูแล'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-4">ชื่อผู้ดูแลที่ลงนามรับรอง</th>
                    <th className="py-3.5 px-4">ความสัมพันธ์</th>
                    <th className="py-3.5 px-4">ผู้ป่วยในความดูแล</th>
                    <th className="py-3.5 px-4">เบอร์โทร</th>
                    <th className="py-3.5 px-4">บทบาท</th>
                    <th className="py-3.5 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCaregivers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                        ยังไม่มีรายชื่อผู้ดูแลที่ลงนามรับรองสำหรับผู้ป่วยที่เลือก
                      </td>
                    </tr>
                  ) : (
                    filteredCaregivers.map((cg) => (
                      <tr key={cg.id} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{cg.name}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-600">{cg.relation}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-800">{cg.patientName}</td>
                        <td className="py-3.5 px-4 font-mono-tabular text-xs text-slate-600">
                          {cg.phone}
                        </td>
                        <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                          {cg.isPrimary ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-teal-700">
                              <Star className="w-3.5 h-3.5 fill-teal-700" />
                              ผู้ดูแลหลัก
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onUpsertCaregiver({
                                  id: cg.id,
                                  patientId: cg.patientId,
                                  name: cg.name,
                                  relation: cg.relation,
                                  phone: cg.phone,
                                  isPrimary: true,
                                })
                              }
                              className="text-xs text-slate-600 hover:text-teal-700 underline underline-offset-2"
                            >
                              ตั้งเป็นผู้ดูแลหลัก
                            </button>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditCaregiver(cg)}
                              aria-label={`แก้ไข ${cg.name}`}
                              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-lg"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteCaregiver(cg.id)}
                              aria-label={`ลบ ${cg.name}`}
                              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 3: Facility, Inspector & Workflow Rules */}
      {activeSection === 'facility' && (
        <form
          onSubmit={handleSaveFacilitySettings}
          className="grid grid-cols-1 lg:grid-cols-12 gap-5"
        >
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                ข้อมูลหน่วยบริการและผู้ตรวจรับงาน
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ข้อมูลนี้จะแสดงบนหัวระบบและใช้ลงนามในแบบรายงานตรวจรับงาน A4 อัตโนมัติ
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อหน่วยบริการ / รพ.สต.
                </label>
                <input
                  type="text"
                  required
                  value={facilityName}
                  onChange={(e) => setFacilityName(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  พยาบาลวิชาชีพผู้ตรวจรับงาน (Care Manager)
                </label>
                <input
                  type="text"
                  required
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ตำแหน่งผู้ตรวจรับงาน
                </label>
                <input
                  type="text"
                  required
                  value={inspectorPosition}
                  onChange={(e) => setInspectorPosition(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ผู้อำนวยการ / ผู้อนุมัติผลการปฏิบัติงาน
                </label>
                <input
                  type="text"
                  required
                  value={directorName}
                  onChange={(e) => setDirectorName(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  ข้อกำหนดการบันทึกงานและการแจ้งเตือน
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  กำหนดกติกาการลงนามรับรองของ อสพ. และระยะเวลามาตรฐานการเยี่ยมบ้าน
                </p>
              </div>

              <div className="space-y-3 divide-y divide-slate-100">
                <label className="flex items-start justify-between gap-4 pt-1 cursor-pointer">
                  <div>
                    <span className="block text-sm font-semibold text-slate-900">
                      บังคับลงลายมือชื่อดิจิทัลของผู้ดูแลหน้างาน
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      หากเปิดใช้งาน อสพ. ต้องให้ผู้รับบริการหรือผู้ดูแลเซ็นบนหน้าจอก่อนกดบันทึก
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={requireSig}
                    onChange={(e) => setRequireSig(e.target.checked)}
                    className="w-5 h-5 mt-0.5 accent-teal-700 rounded shrink-0"
                  />
                </label>

                <label className="flex items-start justify-between gap-4 pt-3 cursor-pointer">
                  <div>
                    <span className="block text-sm font-semibold text-slate-900">
                      บังคับระบุชื่อ-สกุลผู้ดูแลที่ลงนามรับรอง
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      ต้องระบุชื่อผู้รับรองทุกครั้งเพื่อใช้ประกอบการตรวจรับงาน
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={requireName}
                    onChange={(e) => setRequireName(e.target.checked)}
                    className="w-5 h-5 mt-0.5 accent-teal-700 rounded shrink-0"
                  />
                </label>

                <label className="flex items-start justify-between gap-4 pt-3 cursor-pointer">
                  <div>
                    <span className="block text-sm font-semibold text-slate-900">
                      แจ้งเตือนพยาบาลอัตโนมัติเมื่อพบอาการระดับเฝ้าระวัง
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      นอกเหนือจากเคสวิกฤต ระบบจะส่งรายการเฝ้าระวังไปยังศูนย์ติดตามทันที
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoAlertWatch}
                    onChange={(e) => setAutoAlertWatch(e.target.checked)}
                    className="w-5 h-5 mt-0.5 accent-teal-700 rounded shrink-0"
                  />
                </label>

                <div className="pt-3">
                  <label className="block text-sm font-semibold text-slate-900 mb-1">
                    ระยะเวลาการเข้าเยี่ยมมาตรฐาน (นาที/ครั้ง)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={180}
                    value={defaultDuration}
                    onChange={(e) => setDefaultDuration(e.target.value)}
                    className="w-36 min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono-tabular font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={settingsBusy}
                className="inline-flex items-center gap-2 min-h-[46px] px-6 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{settingsBusy ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าระบบ'}</span>
              </button>
            </div>
          </div>
        </form>
      )}
      {/* SECTION 4: Backup & Restore System */}
      {activeSection === 'backups' && (
        <section className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form
              onSubmit={handleCreateBackup}
              className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
            >
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  สร้างจุดสำรองข้อมูลระบบ (Snapshot)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  สำรองข้อมูลผู้ป่วย ประวัติการเยี่ยมบ้าน การแจ้งเตือน อสพ. และใบตรวจรับงานทั้งหมดไว้ในเครื่องแม่ข่าย
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={backupNote}
                  onChange={(e) => setBackupNote(e.target.value)}
                  placeholder="หมายเหตุจุดสำรอง เช่น สำรองก่อนสรุปยอดประจำเดือน"
                  className="flex-1 min-h-[44px] px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                />
                <button
                  type="submit"
                  disabled={backupBusy}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  <DatabaseBackup className="w-4 h-4" />
                  <span>{backupBusy ? 'กำลังสำรอง...' : 'สำรองข้อมูลทันที'}</span>
                </button>
              </div>
            </form>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  นำเข้าไฟล์สำรองจากภายนอก (.json)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  กู้คืนข้อมูลจากไฟล์สำรองที่ดาวน์โหลดไว้ (ระบบจะสำรองข้อมูลปัจจุบันให้อัตโนมัติก่อนกู้คืน)
                </p>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={backupBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  <Upload className="w-4 h-4 text-teal-700" />
                  <span>เลือกไฟล์ .json เพื่อกู้คืนข้อมูล</span>
                </button>
              </div>
            </div>
          </div>

          {backupError && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
              {backupError}
            </p>
          )}

          {/* Backups List */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ประวัติจุดสำรองข้อมูลในระบบ ({backups.length} รายการ)
                </h3>
                <p className="text-xs text-slate-500">
                  สามารถดาวน์โหลดเก็บไว้ภายนอก หรือกู้คืนย้อนหลังได้ทันที
                </p>
              </div>
            </div>

            {backups.length === 0 ? (
              <div className="p-10 text-center space-y-1">
                <p className="text-sm font-semibold text-slate-800">ยังไม่มีไฟล์สำรองข้อมูล</p>
                <p className="text-xs text-slate-500">
                  กดปุ่ม &ldquo;สำรองข้อมูลทันที&rdquo; ด้านบนเพื่อสร้างจุดสำรองแรกของระบบ
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {backups.map((bkp) => {
                  const isConfirmRestore = confirmRestoreId === bkp.id;
                  const isConfirmDelete = confirmDeleteBackupId === bkp.id;

                  return (
                    <div key={bkp.id} className="p-4 sm:px-5 space-y-3">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-mono-tabular font-semibold text-teal-800">
                              {formatBackupDate(bkp.createdAt)}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="font-mono-tabular text-slate-500">
                              {formatBytes(bkp.sizeBytes)}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">{bkp.note}</p>
                          <p className="text-xs text-slate-500 font-mono-tabular">
                            ผู้ป่วย {bkp.counts.patients} ราย · เยี่ยมบ้าน {bkp.counts.visitLogs} ครั้ง ·
                            แจ้งเตือน {bkp.counts.alerts} รายการ · อสพ. {bkp.counts.volunteers} ท่าน
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <a
                            href={`/api/backups/${bkp.id}/download`}
                            download={bkp.filename}
                            className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>ดาวน์โหลด</span>
                          </a>

                          <button
                            type="button"
                            disabled={backupBusy}
                            onClick={() => {
                              setConfirmRestoreId(isConfirmRestore ? null : bkp.id);
                              setConfirmDeleteBackupId(null);
                            }}
                            className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-xl disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>กู้คืน</span>
                          </button>

                          <button
                            type="button"
                            disabled={backupBusy}
                            onClick={() => {
                              setConfirmDeleteBackupId(isConfirmDelete ? null : bkp.id);
                              setConfirmRestoreId(null);
                            }}
                            aria-label={`ลบจุดสำรอง ${bkp.filename}`}
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {isConfirmRestore && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <span className="text-amber-950 font-medium">
                            ยืนยันกู้คืนข้อมูลกลับไปยังจุดสำรองนี้? (ระบบจะสำรองสถานะปัจจุบันไว้ให้อัตโนมัติก่อนกู้คืน)
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setConfirmRestoreId(null)}
                              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium"
                            >
                              ยกเลิก
                            </button>
                            <button
                              type="button"
                              disabled={backupBusy}
                              onClick={async () => {
                                setBackupBusy(true);
                                try {
                                  await onRestoreBackup(bkp.id);
                                  setConfirmRestoreId(null);
                                } finally {
                                  setBackupBusy(false);
                                }
                              }}
                              className="px-3 py-1.5 bg-teal-700 text-white rounded-lg font-semibold disabled:opacity-50"
                            >
                              ยืนยันกู้คืนข้อมูล
                            </button>
                          </div>
                        </div>
                      )}

                      {isConfirmDelete && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
                          <span className="text-rose-900 font-medium">
                            ยืนยันลบไฟล์สำรองข้อมูลนี้อย่างถาวร?
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteBackupId(null)}
                              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium"
                            >
                              ยกเลิก
                            </button>
                            <button
                              type="button"
                              disabled={backupBusy}
                              onClick={async () => {
                                setBackupBusy(true);
                                try {
                                  await onDeleteBackup(bkp.id);
                                  setConfirmDeleteBackupId(null);
                                } finally {
                                  setBackupBusy(false);
                                }
                              }}
                              className="px-3 py-1.5 bg-rose-700 text-white rounded-lg font-semibold disabled:opacity-50"
                            >
                              ยืนยันลบ
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
