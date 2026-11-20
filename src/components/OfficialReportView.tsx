import { useState } from 'react';
import { Printer, Download, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type {
  CarePatient,
  CareVisitLog,
  RoleMode,
  VolunteerProfile,
  WorkAcceptanceBatch,
} from '../types';
import { formatThaiDate, formatThaiDateTime, getInspectionLabel } from '../utils/formatters';
import { WeeklyAnalyticsCharts } from './WeeklyAnalyticsCharts';

interface OfficialReportViewProps {
  patients: CarePatient[];
  visitLogs: CareVisitLog[];
  volunteers: VolunteerProfile[];
  inspector: {
    name: string;
    position: string;
    facility: string;
    directorName: string;
  };
  acceptanceBatches: WorkAcceptanceBatch[];
  roleMode: RoleMode;
  onCertifyBatch: (payload: {
    volunteerId: string;
    monthKey: string;
    monthLabel: string;
    remark?: string;
  }) => Promise<WorkAcceptanceBatch>;
}

export function OfficialReportView({
  patients,
  visitLogs,
  volunteers,
  inspector,
  acceptanceBatches,
  roleMode,
  onCertifyBatch,
}: OfficialReportViewProps) {
  const [selectedVolId, setSelectedVolId] = useState(volunteers[0]?.id ?? '');
  const [certifying, setCertifying] = useState(false);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = new Intl.DateTimeFormat('th-TH', {
    month: 'long',
    year: 'numeric',
  }).format(now);

  const selectedVol = volunteers.find((v) => v.id === selectedVolId) ?? volunteers[0];
  const volVisits = visitLogs.filter((v) => v.volunteerId === selectedVol?.id);
  const approvedVisits = volVisits.filter((v) => v.inspectionStatus === 'approved');
  const pendingCount = volVisits.filter((v) => v.inspectionStatus === 'pending').length;
  const totalMinutes = approvedVisits.reduce((acc, v) => acc + v.durationMinutes, 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  const existingBatch = acceptanceBatches.find(
    (b) => b.volunteerId === selectedVol?.id && b.monthKey === monthKey
  );

  const handleExportCsv = () => {
    const header = [
      'ลำดับ',
      'วันเวลาเยี่ยม',
      'รหัสผู้ป่วย',
      'ชื่อผู้ป่วย',
      'หมู่บ้าน',
      'BP',
      'PR',
      'Temp',
      'SpO2',
      'กิจกรรมการดูแล',
      'ผู้ลงนามรับรอง',
      'สถานะตรวจรับ',
    ];
    const rows = volVisits.map((v, idx) => [
      String(idx + 1),
      formatThaiDateTime(v.visitDate),
      v.patientHn,
      v.patientName,
      v.village,
      `${v.vitals.sbp}/${v.vitals.dbp}`,
      String(v.vitals.pr),
      v.vitals.temp.toFixed(1),
      `${v.vitals.spo2}%`,
      v.activities.join(' / '),
      v.caregiverSigned ? v.caregiverSignerName || 'ลงนามแล้ว' : 'ยังไม่ลงนาม',
      getInspectionLabel(v.inspectionStatus),
    ]);

    const csvContent =
      '\uFEFF' +
      [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `รายงานตรวจรับงาน-${selectedVol?.code ?? 'อสพ'}-${monthKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCertify = async () => {
    if (!selectedVol) return;
    setCertifying(true);
    try {
      await onCertifyBatch({
        volunteerId: selectedVol.id,
        monthKey,
        monthLabel,
        remark: `ตรวจรับงานครบถ้วน จำนวน ${approvedVisits.length} ครั้ง (${totalHours} ชั่วโมง)`,
      });
    } finally {
      setCertifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="report-vol" className="text-xs font-semibold text-slate-700">
            เลือกอาสาพยาบาลชุมชน (อสพ.):
          </label>
          <select
            id="report-vol"
            value={selectedVolId}
            onChange={(e) => setSelectedVolId(e.target.value)}
            className="min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900"
          >
            {volunteers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออก CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์แบบฟอร์ม A4</span>
          </button>

          {roleMode === 'inspector' && (
            <button
              type="button"
              disabled={certifying || approvedVisits.length === 0}
              onClick={handleCertify}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {certifying
                  ? 'กำลังรับรอง...'
                  : existingBatch
                  ? 'อัปเดตใบรับรองประจำเดือน'
                  : 'ลงนามรับรองใบตรวจรับงาน'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Weekly Summary Analytics Charts */}
      <WeeklyAnalyticsCharts
        patients={patients}
        visitLogs={visitLogs}
        volunteers={volunteers}
        selectedVolunteerId={selectedVolId}
      />

      {/* Printable Official Form Sheet (Digitized from Paper Form Packet) */}
      <section className="print-sheet bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Form Title */}
        <div className="text-center border-b border-slate-200 pb-5 space-y-1">
          <p className="text-xs font-semibold text-slate-500">{inspector.facility}</p>
          <h2 className="font-display text-xl font-bold text-slate-900">
            แบบรายงานผลการดูแลต่อเนื่องและตรวจรับงาน อาสาพยาบาลชุมชน (อสพ.)
          </h2>
          <p className="text-sm text-slate-600">ประจำเดือน {monthLabel}</p>
        </div>

        {/* Section 1: Volunteer & Summary Info Box (Mirrors Page 1-2 of Paper Form) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
          <div>
            <span className="block text-slate-500">ชื่อผู้ปฏิบัติงาน (อสพ.)</span>
            <span className="mt-0.5 block text-sm font-bold text-slate-900">
              {selectedVol?.name}
            </span>
            <span className="font-mono-tabular text-slate-600">รหัส {selectedVol?.code}</span>
          </div>
          <div>
            <span className="block text-slate-500">พื้นที่รับผิดชอบ</span>
            <span className="mt-0.5 block text-sm font-semibold text-slate-900">
              {selectedVol?.area}
            </span>
          </div>
          <div>
            <span className="block text-slate-500">จำนวนครั้งที่ตรวจรับแล้ว</span>
            <span className="mt-0.5 block font-mono-tabular text-lg font-bold text-teal-700">
              {approvedVisits.length} / {volVisits.length} ครั้ง
            </span>
            {pendingCount > 0 && (
              <span className="text-amber-700">รอตรวจรับอีก {pendingCount} รายการ</span>
            )}
          </div>
          <div>
            <span className="block text-slate-500">รวมเวลาปฏิบัติงานที่อนุมัติ</span>
            <span className="mt-0.5 block font-mono-tabular text-lg font-bold text-slate-900">
              {totalHours} ชั่วโมง
            </span>
            <span className="text-slate-600 font-mono-tabular">({totalMinutes} นาที)</span>
          </div>
        </div>

        {/* Certified Status Banner if Signed Off */}
        {existingBatch && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <div>
                <p className="font-bold text-sm">
                  รับรองผลการปฏิบัติงานและตรวจรับงานประจำเดือน {existingBatch.monthLabel} แล้ว
                </p>
                <p className="text-emerald-800 mt-0.5">
                  ผู้ตรวจรับ: {existingBatch.certifiedBy} · วันที่รับรอง:{' '}
                  {formatThaiDate(existingBatch.certifiedAt)}
                </p>
              </div>
            </div>
            <span className="font-mono-tabular font-bold text-emerald-800">
              อนุมัติ {existingBatch.approvedVisitCount} ครั้ง ({existingBatch.totalHours} ชม.)
            </span>
          </div>
        )}

        {/* Section 2: Daily Visit Log Table (Mirrors Pages 3-13 of Paper Form) */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900">
            ตารางบันทึกการเยี่ยมบ้านและดูแลต่อเนื่องรายครั้ง
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="py-2.5 px-3 text-center w-12">ลำดับ</th>
                  <th className="py-2.5 px-3">วัน/เวลา</th>
                  <th className="py-2.5 px-3">ชื่อ-สกุลผู้ป่วย (HN)</th>
                  <th className="py-2.5 px-3">สัญญาณชีพ</th>
                  <th className="py-2.5 px-3">กิจกรรมการดูแลต่อเนื่อง</th>
                  <th className="py-2.5 px-3">อาการ / หมายเหตุ</th>
                  <th className="py-2.5 px-3">ผู้ดูแลลงนาม</th>
                  <th className="py-2.5 px-3">ผลตรวจรับ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {volVisits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      ยังไม่มีบันทึกการเยี่ยมบ้านสำหรับ อสพ. ท่านนี้ในเดือนปัจจุบัน
                    </td>
                  </tr>
                ) : (
                  volVisits.map((v, idx) => (
                    <tr key={v.id} className="align-top">
                      <td className="py-2.5 px-3 text-center font-mono-tabular">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono-tabular whitespace-nowrap">
                        <div>{formatThaiDateTime(v.visitDate)}</div>
                        <div className="text-slate-500">{v.durationMinutes} นาที</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{v.patientName}</div>
                        <div className="font-mono-tabular text-slate-500">{v.patientHn}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono-tabular whitespace-nowrap">
                        <div>
                          BP {v.vitals.sbp}/{v.vitals.dbp} · PR {v.vitals.pr}
                        </div>
                        <div>
                          T {v.vitals.temp.toFixed(1)}°C · SpO2 {v.vitals.spo2}%
                        </div>
                      </td>
                      <td className="py-2.5 px-3 max-w-[220px]">
                        {v.activities.join(', ')}
                      </td>
                      <td className="py-2.5 px-3 max-w-[220px] text-slate-700">
                        {v.clinicalNote}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {v.caregiverSigned ? v.caregiverSignerName || 'ลงนามแล้ว' : 'ยังไม่ลงนาม'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-semibold">
                        <span
                          className={
                            v.inspectionStatus === 'approved'
                              ? 'text-emerald-700'
                              : v.inspectionStatus === 'revision'
                              ? 'text-amber-700'
                              : 'text-slate-600'
                          }
                        >
                          {getInspectionLabel(v.inspectionStatus)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: 4-Box Official Sign-off Grid (Mirrors Page 1 & Pages 14-15) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          <div className="border border-slate-300 rounded-xl p-4 text-center space-y-6">
            <p className="text-xs font-semibold text-slate-700">ผู้บันทึก / ผู้ปฏิบัติงาน</p>
            <div className="pt-4 border-b border-dotted border-slate-400 text-xs font-medium text-slate-900 pb-1">
              {selectedVol?.name}
            </div>
            <p className="text-[11px] text-slate-500">อาสาพยาบาลชุมชน (อสพ.)</p>
          </div>

          <div className="border border-slate-300 rounded-xl p-4 text-center space-y-6">
            <p className="text-xs font-semibold text-slate-700">ผู้รับบริการ / ผู้แทนครอบครัว</p>
            <div className="pt-4 border-b border-dotted border-slate-400 text-xs font-medium text-slate-900 pb-1">
              {volVisits.some((v) => v.caregiverSigned)
                ? 'ลงนามอิเล็กทรอนิกส์รายครั้งครบถ้วน'
                : 'รอการลงนาม'}
            </div>
            <p className="text-[11px] text-slate-500">รับรองการเข้าเยี่ยมตามจริง</p>
          </div>

          <div className="border border-slate-300 rounded-xl p-4 text-center space-y-6">
            <p className="text-xs font-semibold text-slate-700">ผู้ตรวจสอบและตรวจรับงาน</p>
            <div className="pt-4 border-b border-dotted border-slate-400 text-xs font-medium text-slate-900 pb-1">
              {existingBatch ? existingBatch.certifiedBy : inspector.name}
            </div>
            <p className="text-[11px] text-slate-500">{inspector.position}</p>
          </div>

          <div className="border border-slate-300 rounded-xl p-4 text-center space-y-6">
            <p className="text-xs font-semibold text-slate-700">ผู้อนุมัติผลการปฏิบัติงาน</p>
            <div className="pt-4 border-b border-dotted border-slate-400 text-xs font-medium text-slate-900 pb-1">
              {inspector.directorName}
            </div>
            <p className="text-[11px] text-slate-500">{inspector.facility}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
