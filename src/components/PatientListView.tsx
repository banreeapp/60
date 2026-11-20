import React, { useState } from 'react';
import {
  Search,
  UserPlus,
  Phone,
  Calendar,
  ClipboardPlus,
  X,
  MapPin,
  LayoutGrid,
  LocateFixed,
} from 'lucide-react';
import type { CarePatient, PatientLocation, TriageLevel, VolunteerProfile } from '../types';
import type { PatientCreatePayload } from '../hooks/useCareRealtime';
import { formatRelativeMinutes, getTriageLabel } from '../utils/formatters';
import { PatientMapView } from './PatientMapView';

interface PatientListViewProps {
  patients: CarePatient[];
  volunteers: VolunteerProfile[];
  mapsApiKey: string;
  onOpenVisitForPatient: (patientId: string) => void;
  onCreatePatient: (payload: PatientCreatePayload) => Promise<CarePatient>;
  onUpdatePatientLocation: (patientId: string, location: PatientLocation) => Promise<CarePatient>;
}

export function PatientListView({
  patients,
  volunteers,
  mapsApiKey,
  onOpenVisitForPatient,
  onCreatePatient,
  onUpdatePatientLocation,
}: PatientListViewProps) {
  const [search, setSearch] = useState('');
  const [triageFilter, setTriageFilter] = useState<'all' | TriageLevel>('all');
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split');
  const [showAddModal, setShowAddModal] = useState(false);

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('72');
  const [gender, setGender] = useState<'ชาย' | 'หญิง'>('หญิง');
  const [village, setVillage] = useState('หมู่ 4 บ้านหนองบัว ต.ท่าศาลา');
  const [careGroup, setCareGroup] = useState('ผู้ป่วยติดเตียง (Barthel ≤ 4)');
  const [diagnosis, setDiagnosis] = useState('');
  const [assignedVolunteerId, setAssignedVolunteerId] = useState(volunteers[0]?.id ?? '');
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [visitTargetPerMonth, setVisitTargetPerMonth] = useState('4');
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const filtered = patients.filter((p) => {
    const matchesTriage = triageFilter === 'all' || p.triageLevel === triageFilter;
    const q = search.trim().toLowerCase();
    const matchesQuery =
      !q ||
      p.fullName.toLowerCase().includes(q) ||
      p.hn.toLowerCase().includes(q) ||
      p.village.toLowerCase().includes(q) ||
      p.diagnosis.toLowerCase().includes(q);
    return matchesTriage && matchesQuery;
  });

  const handleFillCurrentGps = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatInput(pos.coords.latitude.toFixed(6));
        setLngInput(pos.coords.longitude.toFixed(6));
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSubmitting(true);
    try {
      const parsedLat = parseFloat(latInput);
      const parsedLng = parseFloat(lngInput);
      const location =
        Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
          ? { lat: parsedLat, lng: parsedLng }
          : undefined;

      await onCreatePatient({
        fullName: fullName.trim(),
        age: Number(age) || 70,
        gender,
        village: village.trim(),
        careGroup,
        diagnosis: diagnosis.trim() || 'ติดตามดูแลต่อเนื่องที่บ้าน',
        assignedVolunteerId: assignedVolunteerId || volunteers[0]?.id || 'vol-1',
        caregiverName: caregiverName.trim() || 'ผู้ดูแลในครอบครัว',
        caregiverPhone: caregiverPhone.trim() || '-',
        visitTargetPerMonth: Number(visitTargetPerMonth) || 4,
        location,
      });
      setFullName('');
      setDiagnosis('');
      setCaregiverName('');
      setCaregiverPhone('');
      setLatInput('');
      setLngInput('');
      setShowAddModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อผู้ป่วย, HN, หมู่บ้าน หรือโรคประจำตัว..."
            className="w-full min-h-[44px] pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {(['all', 'critical', 'watch', 'normal'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setTriageFilter(lvl)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  triageFilter === lvl
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lvl === 'all'
                  ? 'ทั้งหมด'
                  : lvl === 'critical'
                  ? 'วิกฤต'
                  : lvl === 'watch'
                  ? 'เฝ้าระวัง'
                  : 'ปกติ'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl" role="group" aria-label="รูปแบบการแสดงผล">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                viewMode === 'split' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-teal-700" />
              <span>แผนที่ + รายชื่อ</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                viewMode === 'map' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>เฉพาะแผนที่</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>เฉพาะรายชื่อ</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4 text-teal-700" />
            <span>ลงทะเบียนผู้ป่วยใหม่</span>
          </button>
        </div>
      </div>

      {/* Interactive Care Area Map */}
      {viewMode !== 'list' && (
        <PatientMapView
          patients={filtered}
          mapsApiKey={mapsApiKey}
          onOpenVisitForPatient={onOpenVisitForPatient}
          onUpdatePatientLocation={onUpdatePatientLocation}
        />
      )}

      {/* Patient Cards Grid */}
      {viewMode !== 'map' && (
        <>
          {filtered.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
              <p className="text-sm font-semibold text-slate-900">ไม่พบรายชื่อผู้ป่วยที่ค้นหา</p>
              <p className="mt-1 text-xs text-slate-500">
                ลองปรับคำค้นหาหรือตัวกรองระดับความรุนแรงใหม่อีกครั้ง
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((patient) => {
            const progressPct = Math.min(
              100,
              Math.round((patient.visitsCompletedThisMonth / patient.visitTargetPerMonth) * 100)
            );
            const triageTextColor =
              patient.triageLevel === 'critical'
                ? 'text-rose-700'
                : patient.triageLevel === 'watch'
                ? 'text-amber-700'
                : 'text-emerald-700';

            return (
              <article
                key={patient.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={`font-semibold ${triageTextColor}`}>
                      {getTriageLabel(patient.triageLevel)}
                    </span>
                    <span className="font-mono-tabular text-slate-500">{patient.hn}</span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {patient.fullName}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        ({patient.gender}, {patient.age} ปี)
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{patient.village}</p>
                  </div>

                  <p className="text-xs font-medium text-teal-800">{patient.careGroup}</p>
                  <p className="text-xs text-slate-600 line-clamp-2">{patient.diagnosis}</p>
                </div>

                {/* Vitals Snapshot */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>สัญญาณชีพล่าสุด</span>
                    <span>{formatRelativeMinutes(patient.latestVitals.recordedAt)}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-xs font-mono-tabular bg-slate-50 rounded-xl p-2.5">
                    <div>
                      <span className="block text-[10px] text-slate-500 font-sans">BP</span>
                      <span className="font-semibold text-slate-900">
                        {patient.latestVitals.sbp}/{patient.latestVitals.dbp}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 font-sans">SpO2</span>
                      <span
                        className={`font-semibold ${
                          patient.latestVitals.spo2 <= 92 ? 'text-rose-700' : 'text-slate-900'
                        }`}
                      >
                        {patient.latestVitals.spo2}%
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 font-sans">Temp</span>
                      <span className="font-semibold text-slate-900">
                        {patient.latestVitals.temp.toFixed(1)}°C
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 font-sans">PR</span>
                      <span className="font-semibold text-slate-900">
                        {patient.latestVitals.pr}
                      </span>
                    </div>
                  </div>

                  {/* Visit Progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">ความก้าวหน้าการเยี่ยมเดือนนี้</span>
                      <span className="font-mono-tabular font-semibold text-slate-900">
                        {patient.visitsCompletedThisMonth}/{patient.visitTargetPerMonth} ครั้ง
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-600 rounded-full transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span className="inline-flex items-center gap-1 truncate">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{patient.caregiverPhone}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 shrink-0 font-mono-tabular">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>นัด {patient.nextVisitDate}</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenVisitForPatient(patient.id)}
                    className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors"
                  >
                    <ClipboardPlus className="w-4 h-4" />
                    <span>บันทึกเยี่ยมและประเมินอาการ</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Register Patient Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ลงทะเบียนผู้ป่วยดูแลต่อเนื่อง"
        >
          <form
            onSubmit={handleAddSubmit}
            className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-slate-900">
                ลงทะเบียนผู้ป่วยดูแลต่อเนื่องรายใหม่
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อ-นามสกุลผู้ป่วย *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="เช่น นางสมจิตร วงศ์คำ"
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">อายุ (ปี)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono-tabular"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">เพศ</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'ชาย' | 'หญิง')}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"
                >
                  <option value="หญิง">หญิง</option>
                  <option value="ชาย">ชาย</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ที่อยู่ / หมู่บ้าน *
                </label>
                <input
                  type="text"
                  required
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  กลุ่มเป้าหมายการดูแลต่อเนื่อง
                </label>
                <select
                  value={careGroup}
                  onChange={(e) => setCareGroup(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"
                >
                  <option value="ผู้ป่วยติดเตียง (Barthel ≤ 4)">ผู้ป่วยติดเตียง (Barthel ≤ 4)</option>
                  <option value="ผู้ป่วยติดบ้าน (IMC/ฟื้นฟู)">ผู้ป่วยติดบ้าน (IMC/ฟื้นฟู)</option>
                  <option value="โรคเรื้อรังควบคุมยาก (DM/HT)">โรคเรื้อรังควบคุมยาก (DM/HT)</option>
                  <option value="ผู้ป่วยประคับประคอง (Palliative)">
                    ผู้ป่วยประคับประคอง (Palliative)
                  </option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  การวินิจฉัยโรค / ปัญหาสุขภาพหลัก
                </label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="เช่น โรคหลอดเลือดสมอง, เบาหวาน, แผลกดทับ"
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  อสพ. ผู้รับผิดชอบ
                </label>
                <select
                  value={assignedVolunteerId}
                  onChange={(e) => setAssignedVolunteerId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"
                >
                  {volunteers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เป้าหมายเยี่ยม (ครั้ง/เดือน)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={visitTargetPerMonth}
                  onChange={(e) => setVisitTargetPerMonth(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono-tabular"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อผู้ดูแลหลัก (ญาติ)
                </label>
                <input
                  type="text"
                  value={caregiverName}
                  onChange={(e) => setCaregiverName(e.target.value)}
                  placeholder="ชื่อ-สกุลผู้ดูแล"
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เบอร์โทรติดต่อผู้ดูแล
                </label>
                <input
                  type="tel"
                  value={caregiverPhone}
                  onChange={(e) => setCaregiverPhone(e.target.value)}
                  placeholder="08X-XXX-XXXX"
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono-tabular"
                />
              </div>

              <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">
                    พิกัดที่พักอาศัยสำหรับแสดงบนแผนที่ (ไม่บังคับ)
                  </span>
                  <button
                    type="button"
                    onClick={handleFillCurrentGps}
                    disabled={gpsLoading}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span>{gpsLoading ? 'กำลังอ่าน GPS...' : 'ใช้พิกัด GPS ปัจจุบัน'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">ละติจูด (Latitude)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={latInput}
                      onChange={(e) => setLatInput(e.target.value)}
                      placeholder="13.8205"
                      className="w-full min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">ลองจิจูด (Longitude)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={lngInput}
                      onChange={(e) => setLngInput(e.target.value)}
                      placeholder="100.0605"
                      className="w-full min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono-tabular"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl disabled:opacity-60"
              >
                {submitting ? 'กำลังบันทึก...' : 'บันทึกทะเบียนผู้ป่วย'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
