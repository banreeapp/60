export type RoleMode = 'volunteer' | 'inspector';

export type TriageLevel = 'normal' | 'watch' | 'critical';

export type InspectionStatus = 'pending' | 'approved' | 'revision';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export type ActiveTab = 'realtime' | 'patients' | 'inspection' | 'report' | 'settings';

export interface VitalSigns {
  sbp: number;
  dbp: number;
  pr: number;
  temp: number;
  spo2: number;
  rr: number;
  dtx?: number;
  recordedAt: string;
}

export interface VolunteerProfile {
  id: string;
  name: string;
  code: string;
  area: string;
  phone: string;
}

export interface PatientLocation {
  lat: number;
  lng: number;
}

export interface CarePatient {
  id: string;
  hn: string;
  fullName: string;
  age: number;
  gender: 'ชาย' | 'หญิง';
  village: string;
  location?: PatientLocation;
  careGroup: string;
  diagnosis: string;
  assignedVolunteerId: string;
  assignedVolunteerName: string;
  caregiverName: string;
  caregiverPhone: string;
  nextVisitDate: string;
  triageLevel: TriageLevel;
  latestVitals: VitalSigns;
  visitTargetPerMonth: number;
  visitsCompletedThisMonth: number;
}

export interface CareVisitLog {
  id: string;
  patientId: string;
  patientName: string;
  patientHn: string;
  village: string;
  volunteerId: string;
  volunteerName: string;
  visitDate: string;
  durationMinutes: number;
  vitals: Omit<VitalSigns, 'recordedAt'>;
  symptoms: string[];
  activities: string[];
  clinicalNote: string;
  triageLevel: TriageLevel;
  alertTriggered: boolean;
  caregiverSigned: boolean;
  caregiverSignerName: string;
  signatureDataUrl?: string;
  inspectionStatus: InspectionStatus;
  inspectorName?: string;
  inspectedAt?: string;
  inspectorNote?: string;
}

export interface RealtimeAlert {
  id: string;
  patientId: string;
  patientName: string;
  village: string;
  volunteerName: string;
  visitLogId?: string;
  severity: 'critical' | 'watch';
  title: string;
  detail: string;
  vitalsSummary: string;
  createdAt: string;
  status: AlertStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  nurseOrder?: string;
}

export interface WorkAcceptanceBatch {
  id: string;
  monthKey: string;
  monthLabel: string;
  volunteerId: string;
  volunteerName: string;
  approvedVisitCount: number;
  totalHours: number;
  certifiedBy: string;
  directorName: string;
  certifiedAt: string;
  remark: string;
}

export interface CertifyingCaregiver {
  id: string;
  patientId: string;
  patientName: string;
  name: string;
  relation: string;
  phone: string;
  isPrimary: boolean;
}

export interface SystemSettings {
  requireCaregiverSignature: boolean;
  requireCaregiverSignerName: boolean;
  defaultVisitDurationMinutes: number;
  autoAlertOnWatchLevel: boolean;
}

export interface InspectorConfig {
  name: string;
  position: string;
  facility: string;
  directorName: string;
}

export interface BackupSnapshotMeta {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  note: string;
  counts: {
    patients: number;
    visitLogs: number;
    alerts: number;
    volunteers: number;
    caregivers: number;
  };
}

export interface SystemState {
  patients: CarePatient[];
  visitLogs: CareVisitLog[];
  alerts: RealtimeAlert[];
  volunteers: VolunteerProfile[];
  caregivers: CertifyingCaregiver[];
  inspector: InspectorConfig;
  systemSettings: SystemSettings;
  acceptanceBatches: WorkAcceptanceBatch[];
  serverTime: string;
}

export type RealtimeServerEvent =
  | { type: 'state:sync'; state: SystemState }
  | { type: 'visit:created'; visitLog: CareVisitLog; patient: CarePatient; alert?: RealtimeAlert }
  | { type: 'visit:updated'; visitLog: CareVisitLog; patient?: CarePatient }
  | { type: 'alert:created'; alert: RealtimeAlert; patient: CarePatient }
  | { type: 'alert:updated'; alert: RealtimeAlert }
  | { type: 'patient:created'; patient: CarePatient }
  | { type: 'patient:updated'; patient: CarePatient }
  | { type: 'volunteer:upserted'; volunteer: VolunteerProfile; patients?: CarePatient[] }
  | { type: 'volunteer:deleted'; volunteerId: string }
  | { type: 'caregiver:upserted'; caregiver: CertifyingCaregiver; patient?: CarePatient }
  | { type: 'caregiver:deleted'; caregiverId: string }
  | { type: 'settings:updated'; inspector: InspectorConfig; systemSettings: SystemSettings }
  | { type: 'acceptance:certified'; batch: WorkAcceptanceBatch };

export const CARE_ACTIVITIES_OPTIONS = [
  'วัดและประเมินสัญญาณชีพ',
  'พลิกตะแคงตัวและดูแลแผลกดทับ',
  'กายภาพบำบัดและฟื้นฟูกล้ามเนื้อ',
  'ดูแลการรับประทานยาและฉีดอินซูลิน',
  'ดูดเสมหะและดูแลทางเดินหายใจ',
  'ดูแลสายสวนปัสสาวะ / สายให้อาหาร',
  'ให้คำแนะนำผู้ดูแลและประเมินความเครียดญาติ',
] as const;

export const SYMPTOM_RED_FLAGS = [
  'หายใจหอบเหนื่อย / ออกซิเจนต่ำ',
  'เจ็บแน่นหน้าอก / ชีพจรเต้นผิดจังหวะ',
  'ซึมลง / สับสน / ไม่ตอบสนอง',
  'ไข้สูง ≥ 38.0°C / หนาวสั่น',
  'แผลมีหนอง / บวมแดง / กลิ่นเหม็น',
  'ระดับน้ำตาลต่ำ (< 70) หรือสูง (> 250)',
  'กินไม่ได้ / อาเจียน / อ่อนเพลียมาก',
] as const;

export interface TriageEvaluation {
  level: TriageLevel;
  reasons: string[];
}

export function evaluateClinicalTriage(
  vitals: Omit<VitalSigns, 'recordedAt'>,
  symptoms: string[]
): TriageEvaluation {
  const criticalReasons: string[] = [];
  const watchReasons: string[] = [];

  if (vitals.spo2 <= 92) {
    criticalReasons.push(`SpO2 ต่ำวิกฤต (${vitals.spo2}%)`);
  } else if (vitals.spo2 <= 94) {
    watchReasons.push(`SpO2 เฝ้าระวัง (${vitals.spo2}%)`);
  }

  if (vitals.sbp >= 180 || vitals.dbp >= 110) {
    criticalReasons.push(`ความดันโลหิตสูงวิกฤต (${vitals.sbp}/${vitals.dbp} mmHg)`);
  } else if (vitals.sbp <= 90) {
    criticalReasons.push(`ความดันโลหิตต่ำ (${vitals.sbp}/${vitals.dbp} mmHg)`);
  } else if (vitals.sbp >= 150 || vitals.dbp >= 95) {
    watchReasons.push(`ความดันโลหิตสูง (${vitals.sbp}/${vitals.dbp} mmHg)`);
  }

  if (vitals.temp >= 38.5) {
    criticalReasons.push(`ไข้สูง (${vitals.temp.toFixed(1)}°C)`);
  } else if (vitals.temp >= 37.8) {
    watchReasons.push(`มีไข้ต่ำ (${vitals.temp.toFixed(1)}°C)`);
  }

  if (vitals.pr >= 120 || vitals.pr <= 48) {
    criticalReasons.push(`ชีพจรผิดปกติรุนแรง (${vitals.pr} ครั้ง/นาที)`);
  } else if (vitals.pr >= 105 || vitals.pr <= 55) {
    watchReasons.push(`ชีพจรควรเฝ้าระวัง (${vitals.pr} ครั้ง/นาที)`);
  }

  if (vitals.rr >= 28 || vitals.rr <= 10) {
    criticalReasons.push(`อัตราการหายใจผิดปกติ (${vitals.rr} ครั้ง/นาที)`);
  } else if (vitals.rr >= 24) {
    watchReasons.push(`หายใจเร็ว (${vitals.rr} ครั้ง/นาที)`);
  }

  if (typeof vitals.dtx === 'number' && vitals.dtx > 0) {
    if (vitals.dtx < 70 || vitals.dtx >= 300) {
      criticalReasons.push(`น้ำตาลปลายนิ้ววิกฤต (${vitals.dtx} mg/dL)`);
    } else if (vitals.dtx >= 220) {
      watchReasons.push(`น้ำตาลปลายนิ้วสูง (${vitals.dtx} mg/dL)`);
    }
  }

  const urgentSymptoms = symptoms.filter((s) =>
    s.includes('หอบเหนื่อย') || s.includes('เจ็บแน่นหน้าอก') || s.includes('ซึมลง')
  );
  if (urgentSymptoms.length > 0) {
    criticalReasons.push(...urgentSymptoms);
  }

  const otherSymptoms = symptoms.filter((s) => !urgentSymptoms.includes(s));
  if (otherSymptoms.length > 0) {
    watchReasons.push(...otherSymptoms);
  }

  if (criticalReasons.length > 0) {
    return { level: 'critical', reasons: [...criticalReasons, ...watchReasons] };
  }
  if (watchReasons.length > 0) {
    return { level: 'watch', reasons: watchReasons };
  }
  return { level: 'normal', reasons: [] };
}
