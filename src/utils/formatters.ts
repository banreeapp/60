import type { InspectionStatus, TriageLevel } from '../types';

export function formatThaiTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '-';
  }
}

export function formatThaiDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return '-';
  }
}

export function formatThaiDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '-';
  }
}

export function formatRelativeMinutes(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60_000));
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชม. ที่แล้ว`;
  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

export function getTriageLabel(level: TriageLevel): string {
  switch (level) {
    case 'critical':
      return 'วิกฤต / แจ้งเตือนด่วน';
    case 'watch':
      return 'เฝ้าระวัง';
    default:
      return 'ปกติ';
  }
}

export function getInspectionLabel(status: InspectionStatus): string {
  switch (status) {
    case 'approved':
      return 'ตรวจรับงานแล้ว';
    case 'revision':
      return 'ส่งกลับแก้ไข';
    default:
      return 'รอตรวจรับ';
  }
}
