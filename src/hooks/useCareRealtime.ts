import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BackupSnapshotMeta,
  CarePatient,
  CareVisitLog,
  CertifyingCaregiver,
  InspectorConfig,
  PatientLocation,
  RealtimeAlert,
  RealtimeServerEvent,
  SystemSettings,
  SystemState,
  VolunteerProfile,
  WorkAcceptanceBatch,
} from '../types';

export interface VisitSubmitPayload {
  patientId: string;
  volunteerId: string;
  durationMinutes: number;
  vitals: CareVisitLog['vitals'];
  symptoms: string[];
  activities: string[];
  clinicalNote: string;
  caregiverSignerName: string;
  signatureDataUrl?: string;
}

export interface PatientCreatePayload {
  fullName: string;
  hn?: string;
  age: number;
  gender: 'ชาย' | 'หญิง';
  village: string;
  careGroup: string;
  diagnosis: string;
  assignedVolunteerId: string;
  caregiverName: string;
  caregiverPhone: string;
  visitTargetPerMonth: number;
  location?: PatientLocation;
}

export function useCareRealtime() {
  const [state, setState] = useState<SystemState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
  );
  const [backups, setBackups] = useState<BackupSnapshotMeta[]>([]);
  const [toastMessage, setToastMessage] = useState<{
    id: string;
    title: string;
    tone: 'critical' | 'normal';
  } | null>(null);

  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);

  const showToast = useCallback((title: string, tone: 'critical' | 'normal' = 'normal') => {
    const id = String(Date.now());
    setToastMessage({ id, title, tone });
    window.setTimeout(() => {
      setToastMessage((prev) => (prev?.id === id ? null : prev));
    }, 5000);
  }, []);

  const fetchInitialState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('ไม่สามารถโหลดข้อมูลระบบได้');
      const data = (await res.json()) as SystemState;
      setState(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setLoading(false);
    }
  }, []);

  const applyServerEvent = useCallback(
    (event: RealtimeServerEvent) => {
      if (event.type === 'state:sync') {
        setState(event.state);
        setLoading(false);
        return;
      }

      setState((prev) => {
        if (!prev) return prev;

        switch (event.type) {
          case 'patient:created': {
            if (prev.patients.some((p) => p.id === event.patient.id)) return prev;
            return {
              ...prev,
              patients: [event.patient, ...prev.patients],
            };
          }
          case 'visit:created': {
            const exists = prev.visitLogs.some((v) => v.id === event.visitLog.id);
            const visitLogs = exists ? prev.visitLogs : [event.visitLog, ...prev.visitLogs];
            const patients = prev.patients.map((p) => (p.id === event.patient.id ? event.patient : p));
            let alerts = prev.alerts;
            if (event.alert && !prev.alerts.some((a) => a.id === event.alert!.id)) {
              alerts = [event.alert, ...prev.alerts];
            }
            return { ...prev, visitLogs, patients, alerts };
          }
          case 'visit:updated': {
            const visitLogs = prev.visitLogs.map((v) =>
              v.id === event.visitLog.id ? event.visitLog : v
            );
            return { ...prev, visitLogs };
          }
          case 'alert:created': {
            const exists = prev.alerts.some((a) => a.id === event.alert.id);
            const alerts = exists ? prev.alerts : [event.alert, ...prev.alerts];
            const patients = prev.patients.map((p) => (p.id === event.patient.id ? event.patient : p));
            return { ...prev, alerts, patients };
          }
          case 'alert:updated': {
            const alerts = prev.alerts.map((a) => (a.id === event.alert.id ? event.alert : a));
            let patients = prev.patients;
            if (event.alert.status === 'resolved') {
              const hasOtherCritical = alerts.some(
                (a) =>
                  a.patientId === event.alert.patientId &&
                  a.id !== event.alert.id &&
                  a.status !== 'resolved' &&
                  a.severity === 'critical'
              );
              if (!hasOtherCritical) {
                patients = prev.patients.map((p) =>
                  p.id === event.alert.patientId ? { ...p, triageLevel: 'normal' } : p
                );
              }
            }
            return { ...prev, alerts, patients };
          }
          case 'acceptance:certified': {
            const filtered = prev.acceptanceBatches.filter(
              (b) => !(b.volunteerId === event.batch.volunteerId && b.monthKey === event.batch.monthKey)
            );
            return {
              ...prev,
              acceptanceBatches: [event.batch, ...filtered],
            };
          }
          case 'patient:updated': {
            return {
              ...prev,
              patients: prev.patients.map((p) => (p.id === event.patient.id ? event.patient : p)),
            };
          }
          case 'volunteer:upserted': {
            const exists = prev.volunteers.some((v) => v.id === event.volunteer.id);
            const volunteers = exists
              ? prev.volunteers.map((v) => (v.id === event.volunteer.id ? event.volunteer : v))
              : [...prev.volunteers, event.volunteer];
            return {
              ...prev,
              volunteers,
              patients: event.patients ?? prev.patients,
            };
          }
          case 'volunteer:deleted': {
            const volunteers = prev.volunteers.filter((v) => v.id !== event.volunteerId);
            const fallback = volunteers[0];
            return {
              ...prev,
              volunteers,
              patients: fallback
                ? prev.patients.map((p) =>
                    p.assignedVolunteerId === event.volunteerId
                      ? { ...p, assignedVolunteerId: fallback.id, assignedVolunteerName: fallback.name }
                      : p
                  )
                : prev.patients,
            };
          }
          case 'caregiver:upserted': {
            const exists = prev.caregivers.some((c) => c.id === event.caregiver.id);
            let caregivers = exists
              ? prev.caregivers.map((c) => (c.id === event.caregiver.id ? event.caregiver : c))
              : [event.caregiver, ...prev.caregivers];
            if (event.caregiver.isPrimary) {
              caregivers = caregivers.map((c) =>
                c.patientId === event.caregiver.patientId && c.id !== event.caregiver.id
                  ? { ...c, isPrimary: false }
                  : c
              );
            }
            const patients = event.patient
              ? prev.patients.map((p) => (p.id === event.patient!.id ? event.patient! : p))
              : prev.patients;
            return { ...prev, caregivers, patients };
          }
          case 'caregiver:deleted': {
            return {
              ...prev,
              caregivers: prev.caregivers.filter((c) => c.id !== event.caregiverId),
            };
          }
          case 'settings:updated': {
            return {
              ...prev,
              inspector: event.inspector,
              systemSettings: event.systemSettings,
            };
          }
          default:
            return prev;
        }
      });

      if (event.type === 'alert:created') {
        showToast(`แจ้งเตือนด่วน: ${event.patient.fullName} (${event.alert.title})`, 'critical');
      } else if (event.type === 'visit:created' && event.alert) {
        showToast(
          `${event.alert.severity === 'critical' ? 'แจ้งเตือนวิกฤต' : 'แจ้งเตือนเฝ้าระวัง'}: ${event.patient.fullName}`,
          event.alert.severity === 'critical' ? 'critical' : 'normal'
        );
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchInitialState();

    if (!mapsApiKey) {
      fetch('/api/config/maps')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { apiKey?: string } | null) => {
          if (data?.apiKey) {
            setMapsApiKey(data.apiKey);
          }
        })
        .catch(() => {
          // Ignore config fetch error; fallback UI will handle missing key
        });
    }

    let unmounted = false;

    const connectWs = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        reconnectAttemptRef.current = 0;
        setWsConnected(true);
      };

      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data) as RealtimeServerEvent;
          applyServerEvent(parsed);
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setWsConnected(false);
        const delay = Math.min(10000, 1000 * Math.pow(1.5, reconnectAttemptRef.current));
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(connectWs, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [applyServerEvent, fetchInitialState]);

  const submitVisit = useCallback(
    async (payload: VisitSubmitPayload) => {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'บันทึกการเยี่ยมไม่สำเร็จ');
      }
      const data = (await res.json()) as {
        visitLog: CareVisitLog;
        patient: CarePatient;
        alert?: RealtimeAlert;
      };
      showToast(
        data.alert
          ? `บันทึกสำเร็จและส่งแจ้งเตือนไปยังพยาบาลแล้ว (${data.patient.fullName})`
          : `บันทึกการเยี่ยม ${data.patient.fullName} เรียบร้อย`,
        data.alert?.severity === 'critical' ? 'critical' : 'normal'
      );
      return data;
    },
    [showToast]
  );

  const triggerSos = useCallback(
    async (payload: { patientId: string; volunteerId: string; title?: string; detail: string }) => {
      const res = await fetch('/api/alerts/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'ส่งสัญญาณฉุกเฉินไม่สำเร็จ');
      }
      return (await res.json()) as { alert: RealtimeAlert; patient: CarePatient };
    },
    []
  );

  const updateAlert = useCallback(
    async (
      id: string,
      payload: { status?: RealtimeAlert['status']; nurseOrder?: string; acknowledgedBy?: string }
    ) => {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'อัปเดตสถานะแจ้งเตือนไม่สำเร็จ');
      }
      const updated = (await res.json()) as RealtimeAlert;
      showToast(
        updated.status === 'resolved'
          ? `ปิดเคสแจ้งเตือน: ${updated.patientName}`
          : `ส่งคำสั่งการพยาบาลไปยัง อสพ. แล้ว`
      );
      return updated;
    },
    [showToast]
  );

  const inspectVisit = useCallback(
    async (
      id: string,
      payload: { inspectionStatus: 'approved' | 'revision'; inspectorNote?: string; inspectorName?: string }
    ) => {
      const res = await fetch(`/api/visits/${id}/inspect`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'บันทึกผลตรวจรับงานไม่สำเร็จ');
      }
      const updated = (await res.json()) as CareVisitLog;
      showToast(
        updated.inspectionStatus === 'approved'
          ? `อนุมัติตรวจรับงาน: ${updated.patientName}`
          : `ส่งกลับแก้ไข: ${updated.patientName}`
      );
      return updated;
    },
    [showToast]
  );

  const resubmitVisit = useCallback(
    async (
      id: string,
      payload: {
        clinicalNote?: string;
        caregiverSignerName?: string;
        signatureDataUrl?: string;
        activities?: string[];
      }
    ) => {
      const res = await fetch(`/api/visits/${id}/resubmit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'ส่งงานแก้ไขซ้ำไม่สำเร็จ');
      }
      const updated = (await res.json()) as CareVisitLog;
      showToast(`ส่งงานแก้ไขเพื่อตรวจรับใหม่แล้ว: ${updated.patientName}`);
      return updated;
    },
    [showToast]
  );

  const createPatient = useCallback(
    async (payload: PatientCreatePayload) => {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'ลงทะเบียนผู้ป่วยไม่สำเร็จ');
      }
      const patient = (await res.json()) as CarePatient;
      showToast(`ลงทะเบียนผู้ป่วยใหม่: ${patient.fullName}`);
      return patient;
    },
    [showToast]
  );

  const updatePatientLocation = useCallback(
    async (id: string, location: PatientLocation) => {
      const res = await fetch(`/api/patients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'อัปเดตพิกัดบ้านผู้ป่วยไม่สำเร็จ');
      }
      const updated = (await res.json()) as CarePatient;
      showToast(`บันทึกพิกัดที่พักอาศัยใหม่: ${updated.fullName}`);
      return updated;
    },
    [showToast]
  );

  const certifyBatch = useCallback(
    async (payload: { volunteerId: string; monthKey: string; monthLabel: string; remark?: string }) => {
      const res = await fetch('/api/acceptance/certify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'รับรองใบตรวจรับงานไม่สำเร็จ');
      }
      const batch = (await res.json()) as WorkAcceptanceBatch;
      showToast(`รับรองผลการปฏิบัติงานประจำเดือนของ ${batch.volunteerName} แล้ว`);
      return batch;
    },
    [showToast]
  );

  const upsertVolunteer = useCallback(
    async (payload: Omit<VolunteerProfile, 'id'> & { id?: string }) => {
      const isEdit = Boolean(payload.id);
      const res = await fetch(isEdit ? `/api/volunteers/${payload.id}` : '/api/volunteers', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'บันทึกข้อมูล อสพ. ไม่สำเร็จ');
      }
      const vol = (await res.json()) as VolunteerProfile;
      showToast(isEdit ? `อัปเดตข้อมูล อสพ. ${vol.name} แล้ว` : `เพิ่ม อสพ. ${vol.name} แล้ว`);
      return vol;
    },
    [showToast]
  );

  const deleteVolunteer = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/volunteers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'ลบรายชื่อ อสพ. ไม่สำเร็จ');
      }
      showToast('ลบรายชื่อ อสพ. ออกจากระบบแล้ว');
    },
    [showToast]
  );

  const upsertCaregiver = useCallback(
    async (
      payload: Omit<CertifyingCaregiver, 'id' | 'patientName'> & { id?: string }
    ) => {
      const isEdit = Boolean(payload.id);
      const res = await fetch(isEdit ? `/api/caregivers/${payload.id}` : '/api/caregivers', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'บันทึกข้อมูลผู้ดูแลไม่สำเร็จ');
      }
      const cg = (await res.json()) as CertifyingCaregiver;
      showToast(
        isEdit
          ? `อัปเดตผู้ดูแลที่ลงนามรับรอง: ${cg.name}`
          : `เพิ่มผู้ดูแลที่ลงนามรับรอง: ${cg.name}`
      );
      return cg;
    },
    [showToast]
  );

  const deleteCaregiver = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/caregivers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'ลบรายชื่อผู้ดูแลไม่สำเร็จ');
      }
      showToast('ลบรายชื่อผู้ดูแลที่ลงนามรับรองแล้ว');
    },
    [showToast]
  );

  const updateSystemSettings = useCallback(
    async (payload: {
      inspector?: Partial<InspectorConfig>;
      systemSettings?: Partial<SystemSettings>;
    }) => {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'บันทึกการตั้งค่าระบบไม่สำเร็จ');
      }
      showToast('บันทึกการตั้งค่าระบบเรียบร้อยแล้ว');
      return (await res.json()) as {
        inspector: InspectorConfig;
        systemSettings: SystemSettings;
      };
    },
    [showToast]
  );

  const fetchBackups = useCallback(async () => {
    const res = await fetch('/api/backups');
    if (!res.ok) {
      throw new Error('ไม่สามารถโหลดรายการสำรองข้อมูลได้');
    }
    const list = (await res.json()) as BackupSnapshotMeta[];
    setBackups(list);
    return list;
  }, []);

  const createBackup = useCallback(
    async (note?: string) => {
      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'สร้างไฟล์สำรองข้อมูลไม่สำเร็จ');
      }
      const meta = (await res.json()) as BackupSnapshotMeta;
      setBackups((prev) => [meta, ...prev.filter((b) => b.id !== meta.id)]);
      showToast('สำรองข้อมูลระบบเรียบร้อยแล้ว');
      return meta;
    },
    [showToast]
  );

  const restoreBackup = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/backups/${id}/restore`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'กู้คืนข้อมูลไม่สำเร็จ');
      }
      const data = (await res.json()) as { state: SystemState };
      if (data.state) {
        setState(data.state);
      }
      await fetchBackups();
      showToast('กู้คืนข้อมูลจากจุดสำรองเรียบร้อยแล้ว');
      return data.state;
    },
    [fetchBackups, showToast]
  );

  const importBackup = useCallback(
    async (jsonData: unknown) => {
      const res = await fetch('/api/backups/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'นำเข้าไฟล์สำรองข้อมูลไม่สำเร็จ');
      }
      const data = (await res.json()) as { state: SystemState };
      if (data.state) {
        setState(data.state);
      }
      await fetchBackups();
      showToast('นำเข้าและกู้คืนข้อมูลจากไฟล์เรียบร้อยแล้ว');
      return data.state;
    },
    [fetchBackups, showToast]
  );

  const deleteBackup = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/backups/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'ลบไฟล์สำรองข้อมูลไม่สำเร็จ');
      }
      setBackups((prev) => prev.filter((b) => b.id !== id));
      showToast('ลบจุดสำรองข้อมูลแล้ว');
    },
    [showToast]
  );

  return {
    state,
    loading,
    error,
    wsConnected,
    mapsApiKey,
    backups,
    toastMessage,
    dismissToast: () => setToastMessage(null),
    reload: fetchInitialState,
    submitVisit,
    triggerSos,
    updateAlert,
    inspectVisit,
    resubmitVisit,
    createPatient,
    updatePatientLocation,
    certifyBatch,
    upsertVolunteer,
    deleteVolunteer,
    upsertCaregiver,
    deleteCaregiver,
    updateSystemSettings,
    fetchBackups,
    createBackup,
    restoreBackup,
    importBackup,
    deleteBackup,
  };
}
