import React, { useState } from 'react';
import {
  CheckCircle2,
  RotateCcw,
  FileCheck,
  PenTool,
  X,
  Clock,
  AlertCircle,
} from 'lucide-react';
import type {
  CareVisitLog,
  InspectionStatus,
  RoleMode,
  VolunteerProfile,
} from '../types';
import {
  formatThaiDateTime,
  getInspectionLabel,
  getTriageLabel,
} from '../utils/formatters';
import { SignaturePad } from './SignaturePad';

interface InspectionQueueViewProps {
  visitLogs: CareVisitLog[];
  volunteers: VolunteerProfile[];
  roleMode: RoleMode;
  inspectorName: string;
  onInspectVisit: (
    id: string,
    payload: { inspectionStatus: 'approved' | 'revision'; inspectorNote?: string; inspectorName?: string }
  ) => Promise<CareVisitLog>;
  onResubmitVisit: (
    id: string,
    payload: {
      clinicalNote?: string;
      caregiverSignerName?: string;
      signatureDataUrl?: string;
    }
  ) => Promise<CareVisitLog>;
}

export function InspectionQueueView({
  visitLogs,
  volunteers,
  roleMode,
  inspectorName,
  onInspectVisit,
  onResubmitVisit,
}: InspectionQueueViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | InspectionStatus>('pending');
  const [volunteerFilter, setVolunteerFilter] = useState<string>('all');
  const [selectedVisit, setSelectedVisit] = useState<CareVisitLog | null>(null);

  const [inspectorNote, setInspectorNote] = useState('');
  const [revisionNote, setRevisionNote] = useState('');
  const [revisionSignerName, setRevisionSignerName] = useState('');
  const [revisionSigUrl, setRevisionSigUrl] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openVisit = (visit: CareVisitLog) => {
    setSelectedVisit(visit);
    setInspectorNote(visit.inspectorNote ?? '');
    setRevisionNote(visit.clinicalNote);
    setRevisionSignerName(visit.caregiverSignerName);
    setRevisionSigUrl(visit.signatureDataUrl);
    setFormError(null);
  };

  const counts = {
    pending: visitLogs.filter((v) => v.inspectionStatus === 'pending').length,
    revision: visitLogs.filter((v) => v.inspectionStatus === 'revision').length,
    approved: visitLogs.filter((v) => v.inspectionStatus === 'approved').length,
    all: visitLogs.length,
  };

  const filtered = visitLogs.filter((v) => {
    const matchesStatus = statusFilter === 'all' || v.inspectionStatus === statusFilter;
    const matchesVol = volunteerFilter === 'all' || v.volunteerId === volunteerFilter;
    return matchesStatus && matchesVol;
  });

  const handleApprove = async () => {
    if (!selectedVisit) return;
    setBusy(true);
    setFormError(null);
    try {
      const updated = await onInspectVisit(selectedVisit.id, {
        inspectionStatus: 'approved',
        inspectorNote: inspectorNote.trim() || 'ตรวจรับงานเรียบร้อย เอกสารและสัญญาณชีพครบถ้วน',
        inspectorName,
      });
      setSelectedVisit(updated);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'ไม่สามารถอนุมัติได้');
    } finally {
      setBusy(false);
    }
  };

  const handleSendRevision = async () => {
    if (!selectedVisit) return;
    if (!inspectorNote.trim()) {
      setFormError('กรุณาระบุสิ่งที่ต้องการให้ อสพ. แก้ไขก่อนกดส่งกลับ');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const updated = await onInspectVisit(selectedVisit.id, {
        inspectionStatus: 'revision',
        inspectorNote: inspectorNote.trim(),
        inspectorName,
      });
      setSelectedVisit(updated);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'ไม่สามารถส่งกลับแก้ไขได้');
    } finally {
      setBusy(false);
    }
  };

  const handleVolunteerResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return;
    setBusy(true);
    setFormError(null);
    try {
      const updated = await onResubmitVisit(selectedVisit.id, {
        clinicalNote: revisionNote,
        caregiverSignerName: revisionSignerName,
        signatureDataUrl: revisionSigUrl,
      });
      setSelectedVisit(updated);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'ไม่สามารถส่งงานแก้ไขใหม่ได้');
    } finally {
      setBusy(false);
    }
  };

  const renderStatusText = (status: InspectionStatus) => {
    if (status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{getInspectionLabel(status)}</span>
        </span>
      );
    }
    if (status === 'revision') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{getInspectionLabel(status)}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
        <Clock className="w-3.5 h-3.5" />
        <span>{getInspectionLabel(status)}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {(
            [
              { key: 'pending', label: `รอตรวจรับ (${counts.pending})` },
              { key: 'revision', label: `ส่งกลับแก้ไข (${counts.revision})` },
              { key: 'approved', label: `ตรวจรับแล้ว (${counts.approved})` },
              { key: 'all', label: `ทั้งหมด (${counts.all})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                statusFilter === tab.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="vol-filter" className="text-xs font-medium text-slate-600 whitespace-nowrap">
            กรองตาม อสพ.:
          </label>
          <select
            id="vol-filter"
            value={volunteerFilter}
            onChange={(e) => setVolunteerFilter(e.target.value)}
            className="min-h-[42px] px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900"
          >
            <option value="all">อสพ. ทุกคน</option>
            {volunteers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <FileCheck className="w-8 h-8 text-teal-700 mx-auto" />
          <p className="mt-3 text-sm font-semibold text-slate-900">
            ไม่มีรายการบันทึกงานในหมวดนี้
          </p>
          <p className="mt-1 text-xs text-slate-500">
            เมื่อ อสพ. บันทึกข้อมูลการเยี่ยมบ้าน รายการจะเข้าคิวตรวจรับงานทันที
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Structured Table */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-4">วันเวลาเยี่ยม</th>
                    <th className="py-3.5 px-4">ผู้ป่วย / พื้นที่</th>
                    <th className="py-3.5 px-4">อสพ. ผู้ปฏิบัติ</th>
                    <th className="py-3.5 px-4">สัญญาณชีพ</th>
                    <th className="py-3.5 px-4">ลายเซ็นญาติ</th>
                    <th className="py-3.5 px-4">สถานะตรวจรับ</th>
                    <th className="py-3.5 px-4 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((visit) => (
                    <tr
                      key={visit.id}
                      onClick={() => openVisit(visit)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono-tabular text-xs text-slate-700 whitespace-nowrap">
                        <div>{formatThaiDateTime(visit.visitDate)}</div>
                        <div className="text-slate-400">{visit.durationMinutes} นาที</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{visit.patientName}</div>
                        <div className="text-xs text-slate-500">
                          {visit.patientHn} · {visit.village}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                        {visit.volunteerName}
                      </td>
                      <td className="py-3.5 px-4 font-mono-tabular text-xs text-slate-800 whitespace-nowrap">
                        <div>
                          BP {visit.vitals.sbp}/{visit.vitals.dbp} · SpO2 {visit.vitals.spo2}%
                        </div>
                        <div
                          className={`text-[11px] font-sans font-semibold ${
                            visit.triageLevel === 'critical'
                              ? 'text-rose-700'
                              : visit.triageLevel === 'watch'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {getTriageLabel(visit.triageLevel)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        {visit.caregiverSigned ? (
                          <span className="text-emerald-700 font-medium">
                            ลงนามแล้ว ({visit.caregiverSignerName || 'ผู้ดูแล'})
                          </span>
                        ) : (
                          <span className="text-rose-700 font-medium">ยังไม่ลงนาม</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusText(visit.inspectionStatus)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openVisit(visit);
                          }}
                          className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                        >
                          {visit.inspectionStatus === 'pending' && roleMode === 'inspector'
                            ? 'ตรวจรับงาน'
                            : visit.inspectionStatus === 'revision' && roleMode === 'volunteer'
                            ? 'แก้ไขส่งใหม่'
                            : 'ดูรายละเอียด'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden space-y-3">
            {filtered.map((visit) => (
              <button
                key={visit.id}
                type="button"
                onClick={() => openVisit(visit)}
                className="w-full text-left bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  {renderStatusText(visit.inspectionStatus)}
                  <span className="font-mono-tabular text-xs text-slate-500">
                    {formatThaiDateTime(visit.visitDate)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{visit.patientName}</p>
                  <p className="text-xs text-slate-500">
                    อสพ. {visit.volunteerName} · {visit.durationMinutes} นาที
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="font-mono-tabular text-slate-700">
                    BP {visit.vitals.sbp}/{visit.vitals.dbp} · SpO2 {visit.vitals.spo2}%
                  </span>
                  <span
                    className={
                      visit.caregiverSigned ? 'text-emerald-700 font-medium' : 'text-rose-700 font-medium'
                    }
                  >
                    {visit.caregiverSigned ? 'มีลายเซ็นญาติ' : 'ขาดลายเซ็น'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Inspection / Revision Detail Modal */}
      {selectedVisit && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="รายละเอียดการตรวจรับงาน"
        >
          <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2 text-xs">
                  {renderStatusText(selectedVisit.inspectionStatus)}
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="font-mono-tabular text-slate-500">
                    {formatThaiDateTime(selectedVisit.visitDate)}
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                  {selectedVisit.patientName} ({selectedVisit.patientHn})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVisit(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-xl"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Metadata & Vitals */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 font-mono-tabular text-xs">
                <div>
                  <span className="block text-[10px] font-sans text-slate-500">BP (mmHg)</span>
                  <span className="font-bold text-slate-900">
                    {selectedVisit.vitals.sbp}/{selectedVisit.vitals.dbp}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-slate-500">PR (bpm)</span>
                  <span className="font-bold text-slate-900">{selectedVisit.vitals.pr}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-slate-500">Temp (°C)</span>
                  <span className="font-bold text-slate-900">
                    {selectedVisit.vitals.temp.toFixed(1)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-slate-500">SpO2 (%)</span>
                  <span className="font-bold text-slate-900">{selectedVisit.vitals.spo2}%</span>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-slate-500">เวลาเยี่ยม</span>
                  <span className="font-bold text-slate-900">{selectedVisit.durationMinutes} นาที</span>
                </div>
              </div>

              {/* Activities & Symptoms */}
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-semibold text-slate-500">ผู้ปฏิบัติงาน</p>
                  <p className="text-slate-900 font-medium">
                    {selectedVisit.volunteerName} · พื้นที่ {selectedVisit.village}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500">กิจกรรมการดูแลที่บันทึก</p>
                  <ul className="mt-1 space-y-1 text-slate-800 text-xs list-disc list-inside">
                    {selectedVisit.activities.map((act) => (
                      <li key={act}>{act}</li>
                    ))}
                  </ul>
                </div>

                {selectedVisit.symptoms.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-rose-700">อาการผิดปกติที่พบ</p>
                    <p className="mt-1 text-xs text-rose-900">
                      {selectedVisit.symptoms.join(' · ')}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-slate-500">บันทึกทางคลินิก</p>
                  <p className="mt-1 text-sm text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                    {selectedVisit.clinicalNote}
                  </p>
                </div>
              </div>

              {/* Caregiver Signature Proof */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-700">
                  หลักฐานการลงนามผู้รับบริการ / ผู้ดูแล
                </p>
                {selectedVisit.caregiverSigned ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-emerald-700">ลงนามรับรองการเยี่ยมแล้ว</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        ผู้ลงนาม: {selectedVisit.caregiverSignerName || 'ผู้ดูแลในครอบครัว'}
                      </p>
                    </div>
                    {selectedVisit.signatureDataUrl && (
                      <img
                        src={selectedVisit.signatureDataUrl}
                        alt="ลายมือชื่อผู้รับบริการ"
                        referrerPolicy="no-referrer"
                        className="h-14 w-44 object-contain bg-white border border-slate-200 rounded-lg p-1"
                      />
                    )}
                  </div>
                ) : (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 font-medium">
                    ยังไม่มีลายมือชื่อผู้รับบริการหรือผู้ดูแลรับรอง
                  </div>
                )}
              </div>

              {/* Inspector Previous Note if Revision/Approved */}
              {selectedVisit.inspectorNote && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs space-y-1">
                  <p className="font-bold text-amber-900">
                    ความเห็นผู้ตรวจรับงาน ({selectedVisit.inspectorName || inspectorName})
                  </p>
                  <p className="text-amber-950">{selectedVisit.inspectorNote}</p>
                </div>
              )}

              {/* Inspector Action Panel */}
              {roleMode === 'inspector' && (
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    หมายเหตุการตรวจรับงาน (จำเป็นเมื่อส่งกลับแก้ไข)
                  </label>
                  <textarea
                    rows={2}
                    value={inspectorNote}
                    onChange={(e) => setInspectorNote(e.target.value)}
                    placeholder="ระบุข้อเสนอแนะ หรือเหตุผลที่ส่งกลับแก้ไข..."
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm"
                  />
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleSendRevision}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-sm font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>ส่งกลับแก้ไข</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleApprove}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>อนุมัติตรวจรับงาน</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Volunteer Resubmit Panel when status === 'revision' */}
              {roleMode === 'volunteer' && selectedVisit.inspectionStatus === 'revision' && (
                <form
                  onSubmit={handleVolunteerResubmit}
                  className="pt-4 border-t border-slate-200 space-y-4"
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <PenTool className="w-4 h-4 text-teal-700" />
                    <span>แก้ไขข้อมูลและส่งตรวจรับใหม่</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      บันทึกทางคลินิกเพิ่มเติม
                    </label>
                    <textarea
                      rows={3}
                      value={revisionNote}
                      onChange={(e) => setRevisionNote(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ชื่อผู้ดูแล / ผู้รับบริการที่ลงนาม
                    </label>
                    <input
                      type="text"
                      value={revisionSignerName}
                      onChange={(e) => setRevisionSignerName(e.target.value)}
                      placeholder="ระบุชื่อผู้ลงนาม"
                      className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm mb-3"
                    />
                    <SignaturePad
                      existingDataUrl={revisionSigUrl}
                      onChange={setRevisionSigUrl}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={busy}
                      className="min-h-[44px] px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl disabled:opacity-50"
                    >
                      {busy ? 'กำลังส่ง...' : 'ยืนยันส่งงานแก้ไขใหม่'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
