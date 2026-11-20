import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  Send,
  ShieldAlert,
  Clock,
  Activity,
  ChevronRight,
} from 'lucide-react';
import type { CarePatient, RealtimeAlert, RoleMode } from '../types';
import { formatRelativeMinutes, formatThaiTime, getTriageLabel } from '../utils/formatters';

interface AlertsPanelProps {
  alerts: RealtimeAlert[];
  patients: CarePatient[];
  roleMode: RoleMode;
  activeVolunteerId: string;
  onUpdateAlert: (
    id: string,
    payload: { status?: RealtimeAlert['status']; nurseOrder?: string }
  ) => Promise<RealtimeAlert>;
  onTriggerSos: (payload: {
    patientId: string;
    volunteerId: string;
    title?: string;
    detail: string;
  }) => Promise<unknown>;
  onOpenVisitForPatient: (patientId: string) => void;
}

export function AlertsPanel({
  alerts,
  patients,
  roleMode,
  activeVolunteerId,
  onUpdateAlert,
  onTriggerSos,
  onOpenVisitForPatient,
}: AlertsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<'active_ack' | 'resolved' | 'all'>('active_ack');
  const [orderDrafts, setOrderDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const [sosOpen, setSosOpen] = useState(false);
  const [sosPatientId, setSosPatientId] = useState(patients[0]?.id ?? '');
  const [sosDetail, setSosDetail] = useState('');
  const [sosSubmitting, setSosSubmitting] = useState(false);

  const filteredAlerts = alerts.filter((a) => {
    if (statusFilter === 'active_ack') return a.status !== 'resolved';
    if (statusFilter === 'resolved') return a.status === 'resolved';
    return true;
  });

  const criticalActiveCount = alerts.filter(
    (a) => a.status === 'active' && a.severity === 'critical'
  ).length;
  const acknowledgedCount = alerts.filter((a) => a.status === 'acknowledged').length;
  const resolvedCount = alerts.filter((a) => a.status === 'resolved').length;

  const handleAcknowledgeOrOrder = async (alert: RealtimeAlert, nextStatus: RealtimeAlert['status']) => {
    setBusyId(alert.id);
    try {
      const draftOrder = orderDrafts[alert.id] ?? alert.nurseOrder ?? '';
      await onUpdateAlert(alert.id, {
        status: nextStatus,
        nurseOrder: draftOrder,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleSosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sosPatientId) return;
    setSosSubmitting(true);
    try {
      await onTriggerSos({
        patientId: sosPatientId,
        volunteerId: activeVolunteerId,
        detail: sosDetail || 'พบผู้ป่วยอาการเปลี่ยนแปลงฉับพลัน ต้องการพยาบาลประเมินและสั่งการด่วน',
      });
      setSosDetail('');
      setSosOpen(false);
    } finally {
      setSosSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <section aria-label="สรุปสถานะแจ้งเตือนเรียลไทม์" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>แจ้งเตือนวิกฤต (รอรับเรื่อง)</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="mt-2 font-mono-tabular text-2xl sm:text-3xl font-bold text-rose-700">
            {criticalActiveCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">ต้องประเมินและสั่งการทันที</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>รับทราบและกำลังติดตาม</span>
            <Activity className="w-4 h-4 text-amber-600" />
          </div>
          <p className="mt-2 font-mono-tabular text-2xl sm:text-3xl font-bold text-amber-700">
            {acknowledgedCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">มีคำสั่งการพยาบาลแล้ว</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>ผู้ป่วยในการดูแลทั้งหมด</span>
            <CheckCircle2 className="w-4 h-4 text-teal-700" />
          </div>
          <p className="mt-2 font-mono-tabular text-2xl sm:text-3xl font-bold text-slate-900">
            {patients.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">อัปเดตสัญญาณชีพสด</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>แจ้งเหตุฉุกเฉินภาคสนาม</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!sosPatientId && patients[0]) setSosPatientId(patients[0].id);
              setSosOpen((prev) => !prev);
            }}
            className="mt-3 w-full min-h-[44px] px-4 py-2 bg-rose-700 hover:bg-rose-800 active:scale-[0.99] text-white text-sm font-semibold rounded-xl transition-all whitespace-nowrap"
          >
            ส่งแจ้งเตือนด่วน (SOS)
          </button>
        </div>
      </section>

      {/* SOS Emergency Quick Drawer */}
      {sosOpen && (
        <form
          onSubmit={handleSosSubmit}
          className="bg-rose-50/70 border border-rose-200 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-rose-900">
                ส่งสัญญาณแจ้งเหตุฉุกเฉินถึงพยาบาลวิชาชีพทันที
              </h2>
              <p className="text-xs text-rose-800 mt-0.5">
                ข้อมูลจะถูกส่งแบบเรียลไทม์ไปยังศูนย์ติดตามอาการ รพ.สต. ทันทีที่กดยืนยัน
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSosOpen(false)}
              className="min-h-[40px] px-3 text-xs font-medium text-rose-800 hover:bg-rose-100 rounded-lg"
            >
              ปิด
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                เลือกผู้ป่วย
              </label>
              <select
                value={sosPatientId}
                onChange={(e) => setSosPatientId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.village})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                อาการเร่งด่วนที่พบ / ความช่วยเหลือที่ต้องการ
              </label>
              <input
                type="text"
                required
                placeholder="เช่น ผู้ป่วยหอบเหนื่อยมาก SpO2 89% ขอประสานรถรับส่งต่อ..."
                value={sosDetail}
                onChange={(e) => setSosDetail(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setSosOpen(false)}
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={sosSubmitting}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2 text-sm font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-xl disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              <span>{sosSubmitting ? 'กำลังส่ง...' : 'ยืนยันส่งสัญญาณ SOS'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Main 2-Column Split: Active Alerts Feed + Live Patient Vital Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Real-time Alert Feed */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-slate-900">
              รายการแจ้งเตือนอาการผิดปกติ
            </h2>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setStatusFilter('active_ack')}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'active_ack'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                กำลังติดตาม ({alerts.filter((a) => a.status !== 'resolved').length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('resolved')}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'resolved'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ปิดเคสแล้ว ({resolvedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ทั้งหมด
              </button>
            </div>
          </div>

          {filteredAlerts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="mt-3 text-sm font-semibold text-slate-900">
                ไม่มีรายการแจ้งเตือนค้างในหมวดนี้
              </p>
              <p className="mt-1 text-xs text-slate-500">
                ระบบจะแสดงรายการแจ้งเตือนทันทีเมื่อ อสพ. บันทึกพบสัญญาณชีพหรืออาการผิดปกติ
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAlerts.map((alert) => {
                const isCritical = alert.severity === 'critical';
                const patient = patients.find((p) => p.id === alert.patientId);
                const draftOrder = orderDrafts[alert.id] ?? alert.nurseOrder ?? '';

                return (
                  <article
                    key={alert.id}
                    className={`bg-white border rounded-2xl p-5 space-y-4 ${
                      alert.status === 'active' && isCritical
                        ? 'border-rose-300'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <span
                            className={`inline-flex items-center gap-1 ${
                              isCritical ? 'text-rose-700' : 'text-amber-700'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {isCritical ? 'แจ้งเตือนวิกฤต' : 'เฝ้าระวังอาการ'}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="text-slate-600">
                            {alert.status === 'active'
                              ? 'รอพยาบาลรับเรื่อง'
                              : alert.status === 'acknowledged'
                              ? 'รับทราบและสั่งการแล้ว'
                              : 'ปิดเคสแล้ว'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">{alert.title}</h3>
                        <p className="text-xs text-slate-500">
                          {alert.patientName} · {alert.village} · ผู้รายงาน: {alert.volunteerName}
                        </p>
                      </div>

                      <div className="text-right text-xs text-slate-500 font-mono-tabular shrink-0">
                        <div className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatThaiTime(alert.createdAt)}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatRelativeMinutes(alert.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 space-y-1.5">
                      <p className="font-mono-tabular text-xs font-semibold text-slate-800">
                        {alert.vitalsSummary}
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">{alert.detail}</p>
                    </div>

                    {/* Nurse Order / Field Feedback Section */}
                    {alert.nurseOrder && (
                      <div className="bg-teal-50/70 border border-teal-200 rounded-xl px-4 py-3">
                        <p className="text-xs font-semibold text-teal-900">
                          คำสั่งการพยาบาล ({alert.acknowledgedBy || 'พว.สุภาวดี'})
                        </p>
                        <p className="mt-1 text-sm text-teal-950">{alert.nurseOrder}</p>
                      </div>
                    )}

                    {/* Action Area */}
                    {alert.status !== 'resolved' && (
                      <div className="pt-2 border-t border-slate-100 space-y-3">
                        {roleMode === 'inspector' ? (
                          <>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                placeholder="พิมพ์คำสั่งการพยาบาลส่งถึง อสพ. ในพื้นที่..."
                                value={draftOrder}
                                onChange={(e) =>
                                  setOrderDrafts((prev) => ({
                                    ...prev,
                                    [alert.id]: e.target.value,
                                  }))
                                }
                                className="flex-1 min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900"
                              />
                              <button
                                type="button"
                                disabled={busyId === alert.id}
                                onClick={() => handleAcknowledgeOrOrder(alert, 'acknowledged')}
                                className="min-h-[44px] px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap disabled:opacity-50"
                              >
                                {alert.status === 'active' ? 'รับทราบและสั่งการ' : 'อัปเดตคำสั่ง'}
                              </button>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              {patient && (
                                <span className="text-xs text-slate-500">
                                  ผู้ดูแล: {patient.caregiverName} · โทร {patient.caregiverPhone}
                                </span>
                              )}
                              <button
                                type="button"
                                disabled={busyId === alert.id}
                                onClick={() => handleAcknowledgeOrOrder(alert, 'resolved')}
                                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors whitespace-nowrap"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>อาการปลอดภัย / ปิดเคส</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            {patient && (
                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                                <PhoneCall className="w-3.5 h-3.5 text-teal-700" />
                                ญาติ: {patient.caregiverName} ({patient.caregiverPhone})
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => onOpenVisitForPatient(alert.patientId)}
                              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors whitespace-nowrap"
                            >
                              <span>บันทึกติดตามอาการซ้ำ</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 5 cols: Live Patient Vitals Monitor */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900">
              สถานะสัญญาณชีพผู้ป่วยล่าสุด
            </h2>
            <span className="text-xs text-slate-500 font-mono-tabular">
              {patients.length} ราย
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
            {patients.map((patient) => {
              const triageColor =
                patient.triageLevel === 'critical'
                  ? 'text-rose-700'
                  : patient.triageLevel === 'watch'
                  ? 'text-amber-700'
                  : 'text-emerald-700';

              return (
                <div key={patient.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`font-semibold ${triageColor}`}>
                          {getTriageLabel(patient.triageLevel)}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="font-mono-tabular text-slate-500">{patient.hn}</span>
                      </div>
                      <p className="mt-0.5 text-sm font-bold text-slate-900 truncate">
                        {patient.fullName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{patient.village}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenVisitForPatient(patient.id)}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 border border-teal-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                    >
                      บันทึกเยี่ยม
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2 text-xs font-mono-tabular bg-slate-50 rounded-xl p-2.5">
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
                      <span
                        className={`font-semibold ${
                          patient.latestVitals.temp >= 38 ? 'text-rose-700' : 'text-slate-900'
                        }`}
                      >
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
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
