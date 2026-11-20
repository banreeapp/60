import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Mic, Send, Square, X } from 'lucide-react';
import {
  CARE_ACTIVITIES_OPTIONS,
  SYMPTOM_RED_FLAGS,
  evaluateClinicalTriage,
  type CarePatient,
  type CertifyingCaregiver,
  type SystemSettings,
  type VolunteerProfile,
} from '../types';
import type { VisitSubmitPayload } from '../hooks/useCareRealtime';
import { SignaturePad } from './SignaturePad';

interface VisitFormModalProps {
  patients: CarePatient[];
  volunteers: VolunteerProfile[];
  caregivers: CertifyingCaregiver[];
  systemSettings: SystemSettings;
  initialPatientId?: string;
  activeVolunteerId: string;
  onClose: () => void;
  onSubmit: (payload: VisitSubmitPayload) => Promise<unknown>;
}

export function VisitFormModal({
  patients,
  volunteers,
  caregivers,
  systemSettings,
  initialPatientId,
  activeVolunteerId,
  onClose,
  onSubmit,
}: VisitFormModalProps) {
  const [patientId, setPatientId] = useState(initialPatientId || patients[0]?.id || '');
  const selectedPatient = patients.find((p) => p.id === patientId) ?? patients[0];
  const patientCaregivers = useMemo(
    () => caregivers.filter((c) => c.patientId === patientId),
    [caregivers, patientId]
  );

  const [volunteerId, setVolunteerId] = useState(
    activeVolunteerId || selectedPatient?.assignedVolunteerId || volunteers[0]?.id || ''
  );
  const [durationMinutes, setDurationMinutes] = useState(
    systemSettings.defaultVisitDurationMinutes || 35
  );

  const [sbp, setSbp] = useState(128);
  const [dbp, setDbp] = useState(80);
  const [pr, setPr] = useState(78);
  const [temp, setTemp] = useState(36.7);
  const [spo2, setSpo2] = useState(98);
  const [rr, setRr] = useState(18);
  const [dtx, setDtx] = useState('');

  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([
    'วัดและประเมินสัญญาณชีพ',
    'ดูแลการรับประทานยาและฉีดอินซูลิน',
  ]);
  const [clinicalNote, setClinicalNote] = useState('');
  const [caregiverSignerName, setCaregiverSignerName] = useState(
    selectedPatient?.caregiverName ?? ''
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Voice-to-Text (Microphone API) state & refs
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceFeedback, setVoiceFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const cancelRecordingRef = useRef(false);
  const timerIntervalRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const cleanupAudioResources = () => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  useEffect(() => {
    return () => {
      cancelRecordingRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore stop errors on unmount
        }
      }
      cleanupAudioResources();
    };
  }, []);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const commaIndex = result.indexOf(',');
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      };
      reader.onerror = () => reject(new Error('ไม่สามารถอ่านข้อมูลเสียงได้'));
      reader.readAsDataURL(blob);
    });

  const handleStartRecording = async () => {
    setVoiceFeedback(null);

    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof MediaRecorder === 'undefined'
    ) {
      setVoiceFeedback({
        tone: 'error',
        text: 'เบราว์เซอร์นี้ไม่รองรับการบันทึกเสียงผ่านไมโครโฟน (Microphone API)',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      cancelRecordingRef.current = false;
      audioChunksRef.current = [];

      // Pick best supported audio mime type
      const candidateTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const supportedType = candidateTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      // Setup live mic input meter
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const updateLevel = () => {
            if (!audioContextRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i += 1) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 90) * 100)));
            rafRef.current = window.requestAnimationFrame(updateLevel);
          };
          rafRef.current = window.requestAnimationFrame(updateLevel);
        } catch {
          // Audio level meter is optional; recording still proceeds
        }
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || supportedType || 'audio/webm';
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        cleanupAudioResources();

        if (cancelRecordingRef.current || chunks.length === 0) {
          setVoiceStatus('idle');
          return;
        }

        const audioBlob = new Blob(chunks, { type: mimeType });
        if (audioBlob.size < 400) {
          setVoiceStatus('idle');
          setVoiceFeedback({
            tone: 'error',
            text: 'เสียงบันทึกสั้นเกินไป กรุณากดบันทึกและพูดใหม่อีกครั้ง',
          });
          return;
        }

        setVoiceStatus('transcribing');
        try {
          const audioBase64 = await blobToBase64(audioBlob);
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64, mimeType }),
          });
          const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
          if (!res.ok || !data.text) {
            throw new Error(data.error || 'ไม่สามารถแปลงเสียงเป็นข้อความได้');
          }
          const transcribedText = data.text.trim();
          setClinicalNote((prev) =>
            prev.trim() ? `${prev.trimEnd()}\n${transcribedText}` : transcribedText
          );
          setVoiceFeedback({
            tone: 'success',
            text: 'ถอดเสียงเป็นข้อความเรียบร้อยแล้ว สามารถตรวจสอบหรือแก้ไขเพิ่มเติมได้',
          });
        } catch (err) {
          setVoiceFeedback({
            tone: 'error',
            text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการถอดเสียง',
          });
        } finally {
          setVoiceStatus('idle');
        }
      };

      recorder.start(250);
      setRecordingSeconds(0);
      setVoiceStatus('recording');

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev + 1 >= 60) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      cleanupAudioResources();
      setVoiceStatus('idle');
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setVoiceFeedback({
          tone: 'error',
          text: 'ไม่ได้รับอนุญาตให้เข้าถึงไมโครโฟน กรุณาเปิดสิทธิ์ไมโครโฟนในเบราว์เซอร์',
        });
      } else if (name === 'NotFoundError') {
        setVoiceFeedback({
          tone: 'error',
          text: 'ไม่พบอุปกรณ์ไมโครโฟนบนเครื่องนี้',
        });
      } else {
        setVoiceFeedback({
          tone: 'error',
          text: 'ไม่สามารถเปิดไมโครโฟนได้ กรุณาลองใหม่อีกครั้ง',
        });
      }
    }
  };

  const handleStopAndTranscribe = () => {
    cancelRecordingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleCancelRecording = () => {
    cancelRecordingRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupAudioResources();
      setVoiceStatus('idle');
    }
  };

  const formatDurationClock = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const handlePatientChange = (newId: string) => {
    setPatientId(newId);
    const pat = patients.find((p) => p.id === newId);
    const primaryCg = caregivers.find((c) => c.patientId === newId && c.isPrimary);
    if (primaryCg) {
      setCaregiverSignerName(`${primaryCg.name} (${primaryCg.relation})`);
    } else if (pat) {
      setCaregiverSignerName(pat.caregiverName);
    }
  };

  const toggleItem = (list: string[], setter: (v: string[]) => void, item: string) => {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const liveTriage = useMemo(
    () =>
      evaluateClinicalTriage(
        {
          sbp,
          dbp,
          pr,
          temp,
          spo2,
          rr,
          dtx: dtx ? Number(dtx) : undefined,
        },
        symptoms
      ),
    [sbp, dbp, pr, temp, spo2, rr, dtx, symptoms]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;
    if (systemSettings.requireCaregiverSignerName && !caregiverSignerName.trim()) {
      setErrorMsg('ตามข้อกำหนดระบบ กรุณาระบุชื่อผู้ดูแลที่ลงนามรับรองก่อนบันทึก');
      return;
    }
    if (systemSettings.requireCaregiverSignature && !signatureDataUrl) {
      setErrorMsg('ตามข้อกำหนดระบบ กรุณาให้ผู้รับบริการหรือผู้ดูแลลงลายมือชื่อดิจิทัลก่อนบันทึก');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit({
        patientId,
        volunteerId,
        durationMinutes,
        vitals: {
          sbp,
          dbp,
          pr,
          temp,
          spo2,
          rr,
          dtx: dtx ? Number(dtx) : undefined,
        },
        symptoms,
        activities,
        clinicalNote,
        caregiverSignerName,
        signatureDataUrl,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="บันทึกข้อมูลการเยี่ยมบ้านและดูแลต่อเนื่อง"
    >
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              บันทึกการดูแลต่อเนื่อง (อสพ.)
            </h2>
            <p className="text-xs text-slate-500">
              ระบบประเมินสัญญาณอันตรายอัตโนมัติและส่งแจ้งเตือนเรียลไทม์ถึงพยาบาล
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-xl"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-800">
              {errorMsg}
            </div>
          )}

          {/* 1. Patient & Volunteer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                ผู้ป่วยที่เข้าเยี่ยม *
              </label>
              <select
                value={patientId}
                onChange={(e) => handlePatientChange(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.hn})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ผู้ปฏิบัติงาน (อสพ.)
                </label>
                <select
                  value={volunteerId}
                  onChange={(e) => setVolunteerId(e.target.value)}
                  className="w-full min-h-[44px] px-2.5 py-2 border border-slate-300 rounded-xl text-sm bg-white"
                >
                  {volunteers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  เวลาเยี่ยม (นาที)
                </label>
                <input
                  type="number"
                  min={10}
                  max={240}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono-tabular"
                />
              </div>
            </div>
          </div>

          {/* 2. Vitals Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">1. บันทึกสัญญาณชีพ (Vital Signs)</h3>
              <span className="text-xs text-slate-500">ปรับค่าตามที่วัดได้จริง</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">ความดันตัวบน (SBP)</label>
                <input
                  type="number"
                  min={50}
                  max={260}
                  value={sbp}
                  onChange={(e) => setSbp(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono-tabular font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">ความดันตัวล่าง (DBP)</label>
                <input
                  type="number"
                  min={30}
                  max={160}
                  value={dbp}
                  onChange={(e) => setDbp(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono-tabular font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">ชีพจร (PR / นาที)</label>
                <input
                  type="number"
                  min={30}
                  max={200}
                  value={pr}
                  onChange={(e) => setPr(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono-tabular font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">อุณหภูมิ (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  min={34}
                  max={43}
                  value={temp}
                  onChange={(e) => setTemp(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono-tabular font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">ออกซิเจน (SpO2 %)</label>
                <input
                  type="number"
                  min={60}
                  max={100}
                  value={spo2}
                  onChange={(e) => setSpo2(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono-tabular font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">น้ำตาลปลายนิ้ว (DTX)</label>
                <input
                  type="number"
                  min={20}
                  max={600}
                  placeholder="ถ้ามี (mg/dL)"
                  value={dtx}
                  onChange={(e) => setDtx(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono-tabular"
                />
              </div>
            </div>

            {/* Live Clinical Triage Banner */}
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                liveTriage.level === 'critical'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : liveTriage.level === 'watch'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              {liveTriage.level === 'normal' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    liveTriage.level === 'critical' ? 'text-rose-700' : 'text-amber-700'
                  }`}
                />
              )}
              <div>
                <p className="font-bold">
                  {liveTriage.level === 'critical'
                    ? 'เกณฑ์วิกฤต — ระบบจะส่งแจ้งเตือนด่วนถึงพยาบาลทันทีที่บันทึก'
                    : liveTriage.level === 'watch'
                    ? 'เกณฑ์เฝ้าระวัง — ระบบจะแจ้งเตือนพยาบาลเพื่อติดตามอาการ'
                    : 'สัญญาณชีพอยู่ในเกณฑ์ปกติ'}
                </p>
                {liveTriage.reasons.length > 0 && (
                  <p className="mt-0.5">{liveTriage.reasons.join(' · ')}</p>
                )}
              </div>
            </div>
          </div>

          {/* 3. Symptom Red Flags */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900">
              2. อาการผิดปกติที่พบ (เลือกได้มากกว่า 1 ข้อ)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SYMPTOM_RED_FLAGS.map((flag) => {
                const checked = symptoms.includes(flag);
                return (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => toggleItem(symptoms, setSymptoms, flag)}
                    className={`min-h-[44px] px-3.5 py-2 text-left text-xs font-medium rounded-xl border transition-colors ${
                      checked
                        ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {checked ? '✓ ' : ''}
                    {flag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Care Activities */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900">
              3. กิจกรรมการดูแลต่อเนื่องที่ปฏิบัติ
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CARE_ACTIVITIES_OPTIONS.map((act) => {
                const checked = activities.includes(act);
                return (
                  <button
                    key={act}
                    type="button"
                    onClick={() => toggleItem(activities, setActivities, act)}
                    className={`min-h-[44px] px-3.5 py-2 text-left text-xs font-medium rounded-xl border transition-colors ${
                      checked
                        ? 'bg-teal-50 border-teal-300 text-teal-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {checked ? '✓ ' : ''}
                    {act}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Clinical Note & Signature */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-semibold text-slate-700">
                  4. สรุปผลการดูแลและอาการเพิ่มเติม
                </label>

                {voiceStatus === 'idle' && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleStartRecording}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Mic className="w-4 h-4 text-teal-700" />
                    <span>บันทึกอาการด้วยเสียง</span>
                  </button>
                )}

                {voiceStatus === 'transcribing' && (
                  <span className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
                    <span>กำลังแปลงเสียงเป็นข้อความ...</span>
                  </span>
                )}
              </div>

              {voiceStatus === 'recording' && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-950">
                        <span>กำลังรับเสียงจากไมโครโฟน</span>
                        <span className="font-mono-tabular text-rose-700">
                          {formatDurationClock(recordingSeconds)} / 01:00
                        </span>
                      </div>
                      <div className="w-40 h-1.5 bg-rose-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-600 rounded-full transition-all duration-75"
                          style={{ width: `${Math.max(8, audioLevel)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCancelRecording}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={handleStopAndTranscribe}
                      className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-xl"
                    >
                      <Square className="w-3.5 h-3.5 fill-white" />
                      <span>หยุดและแปลงเป็นข้อความ</span>
                    </button>
                  </div>
                </div>
              )}

              {voiceFeedback && (
                <p
                  className={`text-xs px-3 py-2 rounded-xl border ${
                    voiceFeedback.tone === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  {voiceFeedback.text}
                </p>
              )}

              <textarea
                rows={3}
                value={clinicalNote}
                onChange={(e) => setClinicalNote(e.target.value)}
                placeholder="พิมพ์หรือกดปุ่ม 'บันทึกอาการด้วยเสียง' เพื่อพูดสรุปอาการ สภาพแผล การรับประทานยา หรือคำแนะนำ..."
                className="w-full p-3 border border-slate-300 rounded-xl text-sm text-slate-900"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  ชื่อผู้รับบริการ / ผู้ดูแลที่ลงนามรับรอง
                  {systemSettings.requireCaregiverSignerName && (
                    <span className="text-rose-700 ml-1">*</span>
                  )}
                </label>
                {systemSettings.requireCaregiverSignature && (
                  <span className="text-[11px] font-semibold text-rose-700">
                    บังคับลงลายมือชื่อดิจิทัล
                  </span>
                )}
              </div>

              {patientCaregivers.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span className="text-[11px] text-slate-500">เลือกผู้ดูแลที่ลงทะเบียน:</span>
                  {patientCaregivers.map((cg) => {
                    const label = `${cg.name} (${cg.relation})`;
                    const selected = caregiverSignerName === label;
                    return (
                      <button
                        key={cg.id}
                        type="button"
                        onClick={() => setCaregiverSignerName(label)}
                        className={`min-h-[34px] px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                          selected
                            ? 'bg-teal-50 border-teal-300 text-teal-900 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              <input
                type="text"
                value={caregiverSignerName}
                onChange={(e) => setCaregiverSignerName(e.target.value)}
                placeholder="ระบุชื่อผู้รับบริการหรือญาติผู้ดูแล"
                className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-sm mb-3"
              />
              <SignaturePad onChange={setSignatureDataUrl} />
            </div>
          </div>

          {/* Sticky Footer Submit */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting || voiceStatus !== 'idle'}
              className={`inline-flex items-center gap-2 min-h-[48px] px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-60 ${
                liveTriage.level === 'critical'
                  ? 'bg-rose-700 hover:bg-rose-800'
                  : 'bg-teal-700 hover:bg-teal-800'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>
                {submitting
                  ? 'กำลังบันทึก...'
                  : liveTriage.level === 'critical'
                  ? 'บันทึกและส่งแจ้งเตือนด่วน'
                  : 'บันทึกการเยี่ยมบ้าน'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
