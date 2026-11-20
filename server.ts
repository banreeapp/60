import 'dotenv/config';
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  evaluateClinicalTriage,
  type BackupSnapshotMeta,
  type CarePatient,
  type CareVisitLog,
  type CertifyingCaregiver,
  type InspectorConfig,
  type PatientLocation,
  type RealtimeAlert,
  type RealtimeServerEvent,
  type SystemSettings,
  type SystemState,
  type VolunteerProfile,
  type WorkAcceptanceBatch,
} from './src/types.ts';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'care-db.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

const DEFAULT_PATIENT_LOCATIONS: PatientLocation[] = [
  { lat: 13.8214, lng: 100.0592 },
  { lat: 13.8165, lng: 100.0668 },
  { lat: 13.8242, lng: 100.0651 },
  { lat: 13.8148, lng: 100.0556 },
  { lat: 13.8266, lng: 100.0549 },
];

function createInitialSeed(): SystemState {
  const now = Date.now();
  const isoAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

  const volunteers = [
    {
      id: 'vol-1',
      name: 'น.ส.กานดา ศรีสุข',
      code: 'อสพ-0412',
      area: 'หมู่ 4 บ้านหนองบัว และ หมู่ 5 บ้านท่าข้าม',
      phone: '089-412-8831',
    },
    {
      id: 'vol-2',
      name: 'นายสมชาย ใจดี',
      code: 'อสพ-0419',
      area: 'หมู่ 1 บ้านกลาง และ หมู่ 2 บ้านคลองใหม่',
      phone: '081-775-3092',
    },
  ];

  const patients: CarePatient[] = [
    {
      id: 'pat-1',
      hn: 'HN 680142',
      fullName: 'นายบุญมี พงษ์สวัสดิ์',
      age: 78,
      gender: 'ชาย',
      village: 'หมู่ 4 บ้านหนองบัว ต.ท่าศาลา',
      location: DEFAULT_PATIENT_LOCATIONS[0],
      careGroup: 'ผู้ป่วยติดเตียง (Barthel ≤ 4)',
      diagnosis: 'Stroke (อัมพฤกษ์ซีกขวา), HT, แผลกดทับระดับ 2 บริเวณก้นกบ',
      assignedVolunteerId: 'vol-1',
      assignedVolunteerName: 'น.ส.กานดา ศรีสุข',
      caregiverName: 'นางสมพร พงษ์สวัสดิ์ (ภรรยา)',
      caregiverPhone: '086-331-9045',
      nextVisitDate: new Date(now).toISOString().slice(0, 10),
      triageLevel: 'critical',
      latestVitals: {
        sbp: 176,
        dbp: 102,
        pr: 108,
        temp: 38.4,
        spo2: 91,
        rr: 26,
        recordedAt: isoAgo(14),
      },
      visitTargetPerMonth: 8,
      visitsCompletedThisMonth: 5,
    },
    {
      id: 'pat-2',
      hn: 'HN 680209',
      fullName: 'นางละม่อม แก้วมณี',
      age: 71,
      gender: 'หญิง',
      village: 'หมู่ 5 บ้านท่าข้าม ต.ท่าศาลา',
      location: DEFAULT_PATIENT_LOCATIONS[1],
      careGroup: 'โรคเรื้อรังควบคุมยาก (DM/HT)',
      diagnosis: 'DM Type 2 (ฉีดอินซูลิน), HT, ไตเสื่อมระยะ 3',
      assignedVolunteerId: 'vol-1',
      assignedVolunteerName: 'น.ส.กานดา ศรีสุข',
      caregiverName: 'นายวิชัย แก้วมณี (บุตรชาย)',
      caregiverPhone: '084-901-2214',
      nextVisitDate: new Date(now).toISOString().slice(0, 10),
      triageLevel: 'watch',
      latestVitals: {
        sbp: 154,
        dbp: 92,
        pr: 88,
        temp: 36.9,
        spo2: 97,
        rr: 20,
        dtx: 248,
        recordedAt: isoAgo(85),
      },
      visitTargetPerMonth: 4,
      visitsCompletedThisMonth: 3,
    },
    {
      id: 'pat-3',
      hn: 'HN 680315',
      fullName: 'นายประสิทธิ์ ชูแสง',
      age: 66,
      gender: 'ชาย',
      village: 'หมู่ 4 บ้านหนองบัว ต.ท่าศาลา',
      location: DEFAULT_PATIENT_LOCATIONS[2],
      careGroup: 'ผู้ป่วยติดบ้าน (IMC/ฟื้นฟู)',
      diagnosis: 'Post-hip fracture ฟื้นฟูการเดินระยะกลาง (IMC)',
      assignedVolunteerId: 'vol-1',
      assignedVolunteerName: 'น.ส.กานดา ศรีสุข',
      caregiverName: 'นางนิตยา ชูแสง (บุตรสาว)',
      caregiverPhone: '091-228-7410',
      nextVisitDate: new Date(now + 86_400_000).toISOString().slice(0, 10),
      triageLevel: 'normal',
      latestVitals: {
        sbp: 126,
        dbp: 78,
        pr: 74,
        temp: 36.6,
        spo2: 98,
        rr: 18,
        recordedAt: isoAgo(190),
      },
      visitTargetPerMonth: 4,
      visitsCompletedThisMonth: 4,
    },
    {
      id: 'pat-4',
      hn: 'HN 680418',
      fullName: 'นางทองคำ อินทร์แก้ว',
      age: 82,
      gender: 'หญิง',
      village: 'หมู่ 1 บ้านกลาง ต.ท่าศาลา',
      location: DEFAULT_PATIENT_LOCATIONS[3],
      careGroup: 'ผู้ป่วยประคับประคอง (Palliative)',
      diagnosis: 'End-stage COPD, ใช้ออกซิเจนที่บ้าน (Home O2)',
      assignedVolunteerId: 'vol-2',
      assignedVolunteerName: 'นายสมชาย ใจดี',
      caregiverName: 'น.ส.อรุณี อินทร์แก้ว (หลาน)',
      caregiverPhone: '087-552-6198',
      nextVisitDate: new Date(now).toISOString().slice(0, 10),
      triageLevel: 'normal',
      latestVitals: {
        sbp: 122,
        dbp: 74,
        pr: 80,
        temp: 36.7,
        spo2: 96,
        rr: 20,
        recordedAt: isoAgo(320),
      },
      visitTargetPerMonth: 6,
      visitsCompletedThisMonth: 4,
    },
    {
      id: 'pat-5',
      hn: 'HN 680527',
      fullName: 'นายเสนาะ วรรณวงศ์',
      age: 74,
      gender: 'ชาย',
      village: 'หมู่ 2 บ้านคลองใหม่ ต.ท่าศาลา',
      location: DEFAULT_PATIENT_LOCATIONS[4],
      careGroup: 'ผู้ป่วยติดเตียง (Barthel ≤ 4)',
      diagnosis: 'Alzheimer, คาสายให้อาหาร (NG Tube) และสายสวนปัสสาวะ',
      assignedVolunteerId: 'vol-2',
      assignedVolunteerName: 'นายสมชาย ใจดี',
      caregiverName: 'นางประไพ วรรณวงศ์ (ภรรยา)',
      caregiverPhone: '082-119-4830',
      nextVisitDate: new Date(now + 2 * 86_400_000).toISOString().slice(0, 10),
      triageLevel: 'normal',
      latestVitals: {
        sbp: 130,
        dbp: 80,
        pr: 76,
        temp: 36.8,
        spo2: 98,
        rr: 18,
        recordedAt: isoAgo(1440),
      },
      visitTargetPerMonth: 6,
      visitsCompletedThisMonth: 3,
    },
  ];

  const visitLogs: CareVisitLog[] = [
    {
      id: 'vis-101',
      patientId: 'pat-1',
      patientName: 'นายบุญมี พงษ์สวัสดิ์',
      patientHn: 'HN 680142',
      village: 'หมู่ 4 บ้านหนองบัว ต.ท่าศาลา',
      volunteerId: 'vol-1',
      volunteerName: 'น.ส.กานดา ศรีสุข',
      visitDate: isoAgo(14),
      durationMinutes: 45,
      vitals: { sbp: 176, dbp: 102, pr: 108, temp: 38.4, spo2: 91, rr: 26 },
      symptoms: ['หายใจหอบเหนื่อย / ออกซิเจนต่ำ', 'ไข้สูง ≥ 38.0°C / หนาวสั่น'],
      activities: ['วัดและประเมินสัญญาณชีพ', 'พลิกตะแคงตัวและดูแลแผลกดทับ', 'ดูดเสมหะและดูแลทางเดินหายใจ'],
      clinicalNote: 'ผู้ป่วยมีเสมหะเหนียว หายใจหอบกว่าปกติ ค่า SpO2 ลดเหลือ 91% แจ้งพยาบาลประจำ รพ.สต. ทันที',
      triageLevel: 'critical',
      alertTriggered: true,
      caregiverSigned: true,
      caregiverSignerName: 'นางสมพร พงษ์สวัสดิ์',
      inspectionStatus: 'pending',
    },
    {
      id: 'vis-102',
      patientId: 'pat-2',
      patientName: 'นางละม่อม แก้วมณี',
      patientHn: 'HN 680209',
      village: 'หมู่ 5 บ้านท่าข้าม ต.ท่าศาลา',
      volunteerId: 'vol-1',
      volunteerName: 'น.ส.กานดา ศรีสุข',
      visitDate: isoAgo(85),
      durationMinutes: 35,
      vitals: { sbp: 154, dbp: 92, pr: 88, temp: 36.9, spo2: 97, rr: 20, dtx: 248 },
      symptoms: ['ระดับน้ำตาลต่ำ (< 70) หรือสูง (> 250)'],
      activities: ['วัดและประเมินสัญญาณชีพ', 'ดูแลการรับประทานยาและฉีดอินซูลิน', 'ให้คำแนะนำผู้ดูแลและประเมินความเครียดญาติ'],
      clinicalNote: 'ผู้ป่วยรับประทานผลไม้รสหวานเมื่อวาน เจาะ DTX หลังอาหารเช้าได้ 248 mg/dL แนะนำคุมอาหารและนัดตรวจซ้ำ',
      triageLevel: 'watch',
      alertTriggered: true,
      caregiverSigned: true,
      caregiverSignerName: 'นายวิชัย แก้วมณี',
      inspectionStatus: 'pending',
    },
    {
      id: 'vis-103',
      patientId: 'pat-3',
      patientName: 'นายประสิทธิ์ ชูแสง',
      patientHn: 'HN 680315',
      village: 'หมู่ 4 บ้านหนองบัว ต.ท่าศาลา',
      volunteerId: 'vol-1',
      volunteerName: 'น.ส.กานดา ศรีสุข',
      visitDate: isoAgo(190),
      durationMinutes: 40,
      vitals: { sbp: 126, dbp: 78, pr: 74, temp: 36.6, spo2: 98, rr: 18 },
      symptoms: [],
      activities: ['วัดและประเมินสัญญาณชีพ', 'กายภาพบำบัดและฟื้นฟูกล้ามเนื้อ'],
      clinicalNote: 'ฝึกเดินด้วย Walker ได้ระยะทาง 15 เมตร ไม่มีอาการเวียนศีรษะ แผลผ่าตัดแห้งดี',
      triageLevel: 'normal',
      alertTriggered: false,
      caregiverSigned: true,
      caregiverSignerName: 'นางนิตยา ชูแสง',
      inspectionStatus: 'approved',
      inspectorName: 'พว.สุภาวดี รัตนชัย',
      inspectedAt: isoAgo(60),
      inspectorNote: 'บันทึกครบถ้วน สัญญาณชีพปกติ ติดตามฝึกเดินต่อเนื่องสัปดาห์หน้า',
    },
    {
      id: 'vis-104',
      patientId: 'pat-4',
      patientName: 'นางทองคำ อินทร์แก้ว',
      patientHn: 'HN 680418',
      village: 'หมู่ 1 บ้านกลาง ต.ท่าศาลา',
      volunteerId: 'vol-2',
      volunteerName: 'นายสมชาย ใจดี',
      visitDate: isoAgo(320),
      durationMinutes: 30,
      vitals: { sbp: 122, dbp: 74, pr: 80, temp: 36.7, spo2: 96, rr: 20 },
      symptoms: [],
      activities: ['วัดและประเมินสัญญาณชีพ', 'ดูดเสมหะและดูแลทางเดินหายใจ'],
      clinicalNote: 'เปิดออกซิเจน 2 LPM ต่อเนื่อง ผู้ป่วยพักผ่อนได้',
      triageLevel: 'normal',
      alertTriggered: false,
      caregiverSigned: false,
      caregiverSignerName: '',
      inspectionStatus: 'revision',
      inspectorName: 'พว.สุภาวดี รัตนชัย',
      inspectedAt: isoAgo(120),
      inspectorNote: 'กรุณาให้ผู้ดูแลลงนามรับรองการเยี่ยม และระบุอัตราการไหลออกซิเจนที่บ้านให้ชัดเจนในบันทึก',
    },
    {
      id: 'vis-105',
      patientId: 'pat-5',
      patientName: 'นายเสนาะ วรรณวงศ์',
      patientHn: 'HN 680527',
      village: 'หมู่ 2 บ้านคลองใหม่ ต.ท่าศาลา',
      volunteerId: 'vol-2',
      volunteerName: 'นายสมชาย ใจดี',
      visitDate: isoAgo(2 * 1440),
      durationMinutes: 40,
      vitals: { sbp: 130, dbp: 80, pr: 76, temp: 36.8, spo2: 98, rr: 18 },
      symptoms: [],
      activities: ['วัดและประเมินสัญญาณชีพ', 'ดูแลสายสวนปัสสาวะ / สายให้อาหาร'],
      clinicalNote: 'สาย NG tube และสายสวนปัสสาวะไหลสะดวกดี ปัสสาวะสีเหลืองใส',
      triageLevel: 'normal',
      alertTriggered: false,
      caregiverSigned: true,
      caregiverSignerName: 'นางประไพ วรรณวงศ์',
      inspectionStatus: 'approved',
      inspectorName: 'พว.สุภาวดี รัตนชัย',
      inspectedAt: isoAgo(1 * 1440),
      inspectorNote: 'ตรวจรับงานเรียบร้อย',
    },
    {
      id: 'vis-106',
      patientId: 'pat-1',
      patientName: 'นายบุญมี พงษ์สวัสดิ์',
      patientHn: 'HN 680142',
      village: 'หมู่ 4 บ้านหนองบัว ต.ท่าศาลา',
      volunteerId: 'vol-1',
      volunteerName: 'น.ส.กานดา ศรีสุข',
      visitDate: isoAgo(8 * 1440),
      durationMinutes: 45,
      vitals: { sbp: 148, dbp: 90, pr: 86, temp: 37.1, spo2: 95, rr: 22 },
      symptoms: ['แผลมีหนอง / บวมแดง / กลิ่นเหม็น'],
      activities: ['วัดและประเมินสัญญาณชีพ', 'พลิกตะแคงตัวและดูแลแผลกดทับ'],
      clinicalNote: 'แผลกดทับก้นกบขอบแผลแดงเล็กน้อย ทำความสะอาดแผลด้วย NSS และแนะนำญาติพลิกตัวทุก 2 ชม.',
      triageLevel: 'watch',
      alertTriggered: true,
      caregiverSigned: true,
      caregiverSignerName: 'นางสมพร พงษ์สวัสดิ์',
      inspectionStatus: 'approved',
      inspectorName: 'พว.สุภาวดี รัตนชัย',
      inspectedAt: isoAgo(7 * 1440),
      inspectorNote: 'ติดตามแผลต่อเนื่องดีมาก',
    },
    {
      id: 'vis-107',
      patientId: 'pat-3',
      patientName: 'นายประสิทธิ์ ชูแสง',
      patientHn: 'HN 680315',
      village: 'หมู่ 4 บ้านหนองบัว ต.ท่าศาลา',
      volunteerId: 'vol-1',
      volunteerName: 'น.ส.กานดา ศรีสุข',
      visitDate: isoAgo(9 * 1440),
      durationMinutes: 35,
      vitals: { sbp: 128, dbp: 76, pr: 72, temp: 36.5, spo2: 98, rr: 18 },
      symptoms: [],
      activities: ['วัดและประเมินสัญญาณชีพ', 'กายภาพบำบัดและฟื้นฟูกล้ามเนื้อ'],
      clinicalNote: 'ฝึกยืนทรงตัวและเหยียดข้อเข่าได้คล่องขึ้น',
      triageLevel: 'normal',
      alertTriggered: false,
      caregiverSigned: true,
      caregiverSignerName: 'นางนิตยา ชูแสง',
      inspectionStatus: 'approved',
      inspectorName: 'พว.สุภาวดี รัตนชัย',
      inspectedAt: isoAgo(8 * 1440),
      inspectorNote: 'ตรวจรับงานเรียบร้อย',
    },
    {
      id: 'vis-108',
      patientId: 'pat-4',
      patientName: 'นางทองคำ อินทร์แก้ว',
      patientHn: 'HN 680418',
      village: 'หมู่ 1 บ้านกลาง ต.ท่าศาลา',
      volunteerId: 'vol-2',
      volunteerName: 'นายสมชาย ใจดี',
      visitDate: isoAgo(11 * 1440),
      durationMinutes: 40,
      vitals: { sbp: 134, dbp: 82, pr: 92, temp: 37.2, spo2: 93, rr: 24 },
      symptoms: ['หายใจหอบเหนื่อย / ออกซิเจนต่ำ'],
      activities: ['วัดและประเมินสัญญาณชีพ', 'ดูดเสมหะและดูแลทางเดินหายใจ'],
      clinicalNote: 'เหนื่อยเล็กน้อยหลังอาบน้ำ ปรับออกซิเจนตามแผนแล้ว SpO2 กลับมา 96%',
      triageLevel: 'critical',
      alertTriggered: true,
      caregiverSigned: true,
      caregiverSignerName: 'น.ส.อรุณี อินทร์แก้ว',
      inspectionStatus: 'approved',
      inspectorName: 'พว.สุภาวดี รัตนชัย',
      inspectedAt: isoAgo(10 * 1440),
      inspectorNote: 'รายงานและประสานงานรวดเร็วดีมาก',
    },
    {
      id: 'vis-109',
      patientId: 'pat-2',
      patientName: 'นางละม่อม แก้วมณี',
      patientHn: 'HN 680209',
      village: 'หมู่ 5 บ้านท่าข้าม ต.ท่าศาลา',
      volunteerId: 'vol-1',
      volunteerName: 'น.ส.กานดา ศรีสุข',
      visitDate: isoAgo(15 * 1440),
      durationMinutes: 30,
      vitals: { sbp: 138, dbp: 84, pr: 80, temp: 36.7, spo2: 98, rr: 18, dtx: 162 },
      symptoms: [],
      activities: ['วัดและประเมินสัญญาณชีพ', 'ดูแลการรับประทานยาและฉีดอินซูลิน'],
      clinicalNote: 'ฉีดอินซูลินถูกต้องตามขนาด น้ำตาลควบคุมได้ดีขึ้น',
      triageLevel: 'normal',
      alertTriggered: false,
      caregiverSigned: true,
      caregiverSignerName: 'นายวิชัย แก้วมณี',
      inspectionStatus: 'approved',
      inspectorName: 'พว.สุภาวดี รัตนชัย',
      inspectedAt: isoAgo(14 * 1440),
      inspectorNote: 'ตรวจรับงานเรียบร้อย',
    },
    {
      id: 'vis-110',
      patientId: 'pat-5',
      patientName: 'นายเสนาะ วรรณวงศ์',
      patientHn: 'HN 680527',
      village: 'หมู่ 2 บ้านคลองใหม่ ต.ท่าศาลา',
      volunteerId: 'vol-2',
      volunteerName: 'นายสมชาย ใจดี',
      visitDate: isoAgo(16 * 1440),
      durationMinutes: 35,
      vitals: { sbp: 126, dbp: 78, pr: 74, temp: 36.6, spo2: 98, rr: 18 },
      symptoms: [],
      activities: ['วัดและประเมินสัญญาณชีพ', 'ให้คำแนะนำผู้ดูแลและประเมินความเครียดญาติ'],
      clinicalNote: 'สอนญาติจัดท่าศีรษะสูง 30 องศาหลังให้อาหารทางสาย',
      triageLevel: 'normal',
      alertTriggered: false,
      caregiverSigned: true,
      caregiverSignerName: 'นางประไพ วรรณวงศ์',
      inspectionStatus: 'approved',
      inspectorName: 'พว.สุภาวดี รัตนชัย',
      inspectedAt: isoAgo(15 * 1440),
      inspectorNote: 'ตรวจรับงานเรียบร้อย',
    },
    {
      id: 'vis-111',
      patientId: 'pat-1',
      patientName: 'นายบุญมี พงษ์สวัสดิ์',
      patientHn: 'HN 680142',
      village: 'หมู่ 4 บ้านหนองบัว ต.ท่าศาลา',
      volunteerId: 'vol-1',
      volunteerName: 'น.ส.กานดา ศรีสุข',
      visitDate: isoAgo(22 * 1440),
      durationMinutes: 40,
      vitals: { sbp: 152, dbp: 94, pr: 84, temp: 36.8, spo2: 96, rr: 20 },
      symptoms: [],
      activities: ['วัดและประเมินสัญญาณชีพ', 'พลิกตะแคงตัวและดูแลแผลกดทับ'],
      clinicalNote: 'ความดันค่อนข้างสูง แนะนำลดอาหารเค็มและรับประทานยาตรงเวลา',
      triageLevel: 'watch',
      alertTriggered: true,
      caregiverSigned: true,
      caregiverSignerName: 'นางสมพร พงษ์สวัสดิ์',
      inspectionStatus: 'approved',
      inspectorName: 'พว.สุภาวดี รัตนชัย',
      inspectedAt: isoAgo(21 * 1440),
      inspectorNote: 'ตรวจรับงานเรียบร้อย',
    },
    {
      id: 'vis-112',
      patientId: 'pat-3',
      patientName: 'นายประสิทธิ์ ชูแสง',
      patientHn: 'HN 680315',
      village: 'หมู่ 4 บ้านหนองบัว ต.ท่าศาลา',
      volunteerId: 'vol-1',
      volunteerName: 'น.ส.กานดา ศรีสุข',
      visitDate: isoAgo(24 * 1440),
      durationMinutes: 35,
      vitals: { sbp: 124, dbp: 76, pr: 76, temp: 36.5, spo2: 98, rr: 18 },
      symptoms: [],
      activities: ['วัดและประเมินสัญญาณชีพ', 'กายภาพบำบัดและฟื้นฟูกล้ามเนื้อ'],
      clinicalNote: 'ประเมินกำลังกล้ามเนื้อขาขวาดีขึ้น ไม่มีอาการปวดข้อสะโพก',
      triageLevel: 'normal',
      alertTriggered: false,
      caregiverSigned: true,
      caregiverSignerName: 'นางนิตยา ชูแสง',
      inspectionStatus: 'approved',
      inspectorName: 'พว.สุภาวดี รัตนชัย',
      inspectedAt: isoAgo(23 * 1440),
      inspectorNote: 'ตรวจรับงานเรียบร้อย',
    },
  ];

  const alerts: RealtimeAlert[] = [
    {
      id: 'alt-1',
      patientId: 'pat-1',
      patientName: 'นายบุญมี พงษ์สวัสดิ์',
      village: 'หมู่ 4 บ้านหนองบัว ต.ท่าศาลา',
      volunteerName: 'น.ส.กานดา ศรีสุข',
      visitLogId: 'vis-101',
      severity: 'critical',
      title: 'สัญญาณชีพวิกฤต: SpO2 91% และไข้สูง 38.4°C',
      detail: 'ผู้ป่วยมีเสมหะเหนียว หายใจหอบเหนื่อย SpO2 ลดเหลือ 91% ความดัน 176/102 mmHg',
      vitalsSummary: 'BP 176/102 · PR 108 · T 38.4°C · SpO2 91% · RR 26',
      createdAt: isoAgo(14),
      status: 'active',
    },
    {
      id: 'alt-2',
      patientId: 'pat-2',
      patientName: 'นางละม่อม แก้วมณี',
      village: 'หมู่ 5 บ้านท่าข้าม ต.ท่าศาลา',
      volunteerName: 'น.ส.กานดา ศรีสุข',
      visitLogId: 'vis-102',
      severity: 'watch',
      title: 'เฝ้าระวัง: น้ำตาลปลายนิ้วสูง DTX 248 mg/dL',
      detail: 'ความดันโลหิต 154/92 mmHg และระดับน้ำตาลสูงกว่าเกณฑ์เป้าหมาย',
      vitalsSummary: 'BP 154/92 · PR 88 · DTX 248 mg/dL',
      createdAt: isoAgo(85),
      status: 'acknowledged',
      acknowledgedBy: 'พว.สุภาวดี รัตนชัย',
      acknowledgedAt: isoAgo(50),
      nurseOrder: 'ให้ อสพ. นัดเจาะ DTX ซ้ำพรุ่งนี้เช้าก่อนอาหาร และเน้นย้ำญาติงดผลไม้หวาน',
    },
  ];

  const caregivers: CertifyingCaregiver[] = [
    {
      id: 'cg-1',
      patientId: 'pat-1',
      patientName: 'นายบุญมี พงษ์สวัสดิ์',
      name: 'นางสมพร พงษ์สวัสดิ์',
      relation: 'ภรรยา',
      phone: '086-331-9045',
      isPrimary: true,
    },
    {
      id: 'cg-1b',
      patientId: 'pat-1',
      patientName: 'นายบุญมี พงษ์สวัสดิ์',
      name: 'นายมานพ พงษ์สวัสดิ์',
      relation: 'บุตรชาย',
      phone: '089-114-5520',
      isPrimary: false,
    },
    {
      id: 'cg-2',
      patientId: 'pat-2',
      patientName: 'นางละม่อม แก้วมณี',
      name: 'นายวิชัย แก้วมณี',
      relation: 'บุตรชาย',
      phone: '084-901-2214',
      isPrimary: true,
    },
    {
      id: 'cg-3',
      patientId: 'pat-3',
      patientName: 'นายประสิทธิ์ ชูแสง',
      name: 'นางนิตยา ชูแสง',
      relation: 'บุตรสาว',
      phone: '091-228-7410',
      isPrimary: true,
    },
    {
      id: 'cg-4',
      patientId: 'pat-4',
      patientName: 'นางทองคำ อินทร์แก้ว',
      name: 'น.ส.อรุณี อินทร์แก้ว',
      relation: 'หลาน',
      phone: '087-552-6198',
      isPrimary: true,
    },
    {
      id: 'cg-5',
      patientId: 'pat-5',
      patientName: 'นายเสนาะ วรรณวงศ์',
      name: 'นางประไพ วรรณวงศ์',
      relation: 'ภรรยา',
      phone: '082-119-4830',
      isPrimary: true,
    },
  ];

  const systemSettings: SystemSettings = {
    requireCaregiverSignature: false,
    requireCaregiverSignerName: true,
    defaultVisitDurationMinutes: 35,
    autoAlertOnWatchLevel: true,
  };

  return {
    patients,
    visitLogs,
    alerts,
    volunteers,
    caregivers,
    inspector: {
      name: 'พว.สุภาวดี รัตนชัย',
      position: 'พยาบาลวิชาชีพชำนาญการ (Care Manager)',
      facility: 'รพ.สต.ท่าศาลา อ.เมือง',
      directorName: 'นายธนากร ศิริวัฒน์ (ผอ.รพ.สต.ท่าศาลา)',
    },
    systemSettings,
    acceptanceBatches: [],
    serverTime: new Date(now).toISOString(),
  };
}

function loadState(): SystemState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seed = createInitialSeed();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SystemState>;
    const seed = createInitialSeed();
    const patientsWithLocation = (Array.isArray(parsed.patients) ? parsed.patients : seed.patients).map(
      (p, idx) => ({
        ...p,
        location: p.location ?? DEFAULT_PATIENT_LOCATIONS[idx % DEFAULT_PATIENT_LOCATIONS.length],
      })
    );
    return {
      ...seed,
      ...parsed,
      patients: patientsWithLocation,
      caregivers: Array.isArray(parsed.caregivers) ? parsed.caregivers : seed.caregivers,
      systemSettings: parsed.systemSettings ? { ...seed.systemSettings, ...parsed.systemSettings } : seed.systemSettings,
      serverTime: new Date().toISOString(),
    };
  } catch {
    const seed = createInitialSeed();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
}

function saveState(state: SystemState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify({ ...state, serverTime: new Date().toISOString() }, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

let dbState: SystemState = loadState();

const geminiApiKey = process.env.GEMINI_API_KEY;
const ai = geminiApiKey
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const broadcast = (event: RealtimeServerEvent) => {
    const payload = JSON.stringify(event);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };

  wss.on('connection', (socket) => {
    const syncEvent: RealtimeServerEvent = {
      type: 'state:sync',
      state: { ...dbState, serverTime: new Date().toISOString() },
    };
    socket.send(JSON.stringify(syncEvent));
  });

  app.get('/api/state', (_req, res) => {
    res.json({ ...dbState, serverTime: new Date().toISOString() });
  });

  app.get('/api/config/maps', (_req, res) => {
    res.json({
      apiKey: process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
    });
  });

  app.post('/api/transcribe', async (req, res) => {
    if (!ai) {
      res.status(503).json({
        error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ กรุณาตรวจสอบที่ Settings > Secrets',
      });
      return;
    }

    const body = (req.body || {}) as { audioBase64?: string; mimeType?: string };
    if (!body.audioBase64 || typeof body.audioBase64 !== 'string') {
      res.status(400).json({ error: 'ไม่พบข้อมูลไฟล์เสียงสำหรับถอดความ' });
      return;
    }

    const rawMime = typeof body.mimeType === 'string' && body.mimeType.trim() ? body.mimeType : 'audio/webm';
    const cleanMimeType = rawMime.split(';')[0].trim();

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: cleanMimeType,
                data: body.audioBase64,
              },
            },
            {
              text: 'ถอดเสียงพูดภาษาไทย (และศัพท์ทางการแพทย์ถ้ามี) จากคลิปเสียงนี้เป็นข้อความที่ถูกต้อง ชัดเจน อ่านง่าย สำหรับบันทึกอาการผู้ป่วยในการเยี่ยมบ้านของอาสาพยาบาลชุมชน (อสพ.) ตอบกลับเฉพาะข้อความที่ถอดเสียงได้เท่านั้น ไม่ต้องใส่คำอธิบายหรือเครื่องหมายคำพูด',
            },
          ],
        },
      });

      const transcript = (response.text ?? '').trim();
      if (!transcript) {
        res.status(422).json({
          error: 'ไม่ได้ยินเสียงพูดชัดเจนในคลิปเสียง กรุณาลองบันทึกใหม่อีกครั้ง',
        });
        return;
      }
      res.json({ text: transcript });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถถอดเสียงเป็นข้อความได้';
      res.status(500).json({ error: `ถอดเสียงไม่สำเร็จ: ${msg}` });
    }
  });

  app.post('/api/patients', (req, res) => {
    const body = req.body as Partial<CarePatient>;
    if (!body.fullName?.trim() || !body.village?.trim()) {
      res.status(400).json({ error: 'กรุณาระบุชื่อ-สกุลผู้ป่วย และที่อยู่/หมู่บ้าน' });
      return;
    }

    const volunteer = dbState.volunteers.find((v) => v.id === body.assignedVolunteerId) ?? dbState.volunteers[0];
    const nowIso = new Date().toISOString();
    const fallbackLoc =
      DEFAULT_PATIENT_LOCATIONS[dbState.patients.length % DEFAULT_PATIENT_LOCATIONS.length];
    const location =
      body.location &&
      typeof body.location.lat === 'number' &&
      typeof body.location.lng === 'number'
        ? { lat: body.location.lat, lng: body.location.lng }
        : {
            lat: fallbackLoc.lat + (Math.random() - 0.5) * 0.004,
            lng: fallbackLoc.lng + (Math.random() - 0.5) * 0.004,
          };

    const newPatient: CarePatient = {
      id: `pat-${Date.now()}`,
      hn: body.hn?.trim() || `HN ${Math.floor(680600 + Math.random() * 399)}`,
      fullName: body.fullName.trim(),
      age: Number(body.age) || 68,
      gender: body.gender === 'ชาย' ? 'ชาย' : 'หญิง',
      village: body.village.trim(),
      location,
      careGroup: body.careGroup || 'ผู้ป่วยติดบ้าน (IMC/ฟื้นฟู)',
      diagnosis: body.diagnosis?.trim() || 'ติดตามดูแลต่อเนื่องที่บ้าน',
      assignedVolunteerId: volunteer.id,
      assignedVolunteerName: volunteer.name,
      caregiverName: body.caregiverName?.trim() || 'ผู้ดูแลในครอบครัว',
      caregiverPhone: body.caregiverPhone?.trim() || '-',
      nextVisitDate: body.nextVisitDate || nowIso.slice(0, 10),
      triageLevel: 'normal',
      latestVitals: {
        sbp: 120,
        dbp: 80,
        pr: 76,
        temp: 36.6,
        spo2: 98,
        rr: 18,
        recordedAt: nowIso,
      },
      visitTargetPerMonth: Number(body.visitTargetPerMonth) || 4,
      visitsCompletedThisMonth: 0,
    };

    const primaryCaregiver: CertifyingCaregiver = {
      id: `cg-${Date.now()}`,
      patientId: newPatient.id,
      patientName: newPatient.fullName,
      name: newPatient.caregiverName,
      relation: 'ผู้ดูแลหลัก',
      phone: newPatient.caregiverPhone,
      isPrimary: true,
    };

    dbState.patients = [newPatient, ...dbState.patients];
    dbState.caregivers = [primaryCaregiver, ...dbState.caregivers];
    saveState(dbState);
    broadcast({ type: 'patient:created', patient: newPatient });
    broadcast({ type: 'caregiver:upserted', caregiver: primaryCaregiver });
    res.status(201).json(newPatient);
  });

  app.patch('/api/patients/:id', (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<CarePatient>;
    const existing = dbState.patients.find((p) => p.id === id);
    if (!existing) {
      res.status(404).json({ error: 'ไม่พบข้อมูลผู้ป่วย' });
      return;
    }
    const updated: CarePatient = {
      ...existing,
      village: body.village?.trim() || existing.village,
      location:
        body.location &&
        typeof body.location.lat === 'number' &&
        typeof body.location.lng === 'number'
          ? { lat: body.location.lat, lng: body.location.lng }
          : existing.location,
    };
    dbState.patients = dbState.patients.map((p) => (p.id === id ? updated : p));
    saveState(dbState);
    broadcast({ type: 'patient:updated', patient: updated });
    res.json(updated);
  });

  app.post('/api/visits', (req, res) => {
    const body = req.body as {
      patientId: string;
      volunteerId: string;
      durationMinutes: number;
      vitals: CareVisitLog['vitals'];
      symptoms: string[];
      activities: string[];
      clinicalNote: string;
      caregiverSignerName: string;
      signatureDataUrl?: string;
    };

    const patient = dbState.patients.find((p) => p.id === body.patientId);
    if (!patient) {
      res.status(404).json({ error: 'ไม่พบข้อมูลผู้ป่วย' });
      return;
    }

    const volunteer = dbState.volunteers.find((v) => v.id === body.volunteerId) ?? dbState.volunteers[0];
    const nowIso = new Date().toISOString();
    const vitals = {
      sbp: Number(body.vitals?.sbp) || 120,
      dbp: Number(body.vitals?.dbp) || 80,
      pr: Number(body.vitals?.pr) || 76,
      temp: Number(body.vitals?.temp) || 36.6,
      spo2: Number(body.vitals?.spo2) || 98,
      rr: Number(body.vitals?.rr) || 18,
      dtx: body.vitals?.dtx ? Number(body.vitals.dtx) : undefined,
    };
    const symptoms = Array.isArray(body.symptoms) ? body.symptoms : [];
    const activities = Array.isArray(body.activities) ? body.activities : [];

    const triage = evaluateClinicalTriage(vitals, symptoms);
    const caregiverSigned = Boolean(body.signatureDataUrl || body.caregiverSignerName?.trim());

    const visitLog: CareVisitLog = {
      id: `vis-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.fullName,
      patientHn: patient.hn,
      village: patient.village,
      volunteerId: volunteer.id,
      volunteerName: volunteer.name,
      visitDate: nowIso,
      durationMinutes: Math.max(10, Number(body.durationMinutes) || 30),
      vitals,
      symptoms,
      activities: activities.length > 0 ? activities : ['วัดและประเมินสัญญาณชีพ'],
      clinicalNote: body.clinicalNote?.trim() || 'เยี่ยมติดตามอาการต่อเนื่องตามแผนการดูแล',
      triageLevel: triage.level,
      alertTriggered: triage.level !== 'normal',
      caregiverSigned,
      caregiverSignerName: body.caregiverSignerName?.trim() || patient.caregiverName,
      signatureDataUrl: body.signatureDataUrl,
      inspectionStatus: 'pending',
    };

    const updatedPatient: CarePatient = {
      ...patient,
      triageLevel: triage.level,
      latestVitals: { ...vitals, recordedAt: nowIso },
      visitsCompletedThisMonth: patient.visitsCompletedThisMonth + 1,
    };

    dbState.visitLogs = [visitLog, ...dbState.visitLogs];
    dbState.patients = dbState.patients.map((p) => (p.id === updatedPatient.id ? updatedPatient : p));

    let createdAlert: RealtimeAlert | undefined;
    if (
      triage.level === 'critical' ||
      (triage.level === 'watch' && dbState.systemSettings.autoAlertOnWatchLevel)
    ) {
      const vitalsSummary = `BP ${vitals.sbp}/${vitals.dbp} · PR ${vitals.pr} · T ${vitals.temp.toFixed(1)}°C · SpO2 ${vitals.spo2}%${
        vitals.dtx ? ` · DTX ${vitals.dtx}` : ''
      }`;
      const newAlert: RealtimeAlert = {
        id: `alt-${Date.now()}`,
        patientId: patient.id,
        patientName: patient.fullName,
        village: patient.village,
        volunteerName: volunteer.name,
        visitLogId: visitLog.id,
        severity: triage.level,
        title:
          triage.level === 'critical'
            ? `แจ้งเตือนด่วน: ${triage.reasons[0] || 'พบอาการผิดปกติรุนแรง'}`
            : `เฝ้าระวัง: ${triage.reasons[0] || 'สัญญาณชีพเกินเกณฑ์'}`,
        detail: `${triage.reasons.join(' · ')}${visitLog.clinicalNote ? ` — ${visitLog.clinicalNote}` : ''}`,
        vitalsSummary,
        createdAt: nowIso,
        status: 'active',
      };
      createdAlert = newAlert;
      dbState.alerts = [newAlert, ...dbState.alerts];
    }

    saveState(dbState);
    broadcast({ type: 'visit:created', visitLog, patient: updatedPatient, alert: createdAlert });
    res.status(201).json({ visitLog, patient: updatedPatient, alert: createdAlert });
  });

  app.post('/api/alerts/sos', (req, res) => {
    const body = req.body as {
      patientId: string;
      volunteerId: string;
      title?: string;
      detail: string;
    };

    const patient = dbState.patients.find((p) => p.id === body.patientId);
    if (!patient) {
      res.status(404).json({ error: 'ไม่พบข้อมูลผู้ป่วย' });
      return;
    }

    const volunteer = dbState.volunteers.find((v) => v.id === body.volunteerId) ?? dbState.volunteers[0];
    const nowIso = new Date().toISOString();

    const alert: RealtimeAlert = {
      id: `alt-sos-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.fullName,
      village: patient.village,
      volunteerName: volunteer.name,
      severity: 'critical',
      title: body.title?.trim() || 'แจ้งเหตุฉุกเฉินจากพื้นที่ (SOS)',
      detail: body.detail?.trim() || 'อสพ. ขอคำปรึกษาพยาบาลวิชาชีพและประสานส่งต่อด่วน',
      vitalsSummary: `BP ${patient.latestVitals.sbp}/${patient.latestVitals.dbp} · SpO2 ${patient.latestVitals.spo2}% · T ${patient.latestVitals.temp.toFixed(1)}°C`,
      createdAt: nowIso,
      status: 'active',
    };

    const updatedPatient: CarePatient = {
      ...patient,
      triageLevel: 'critical',
    };

    dbState.alerts = [alert, ...dbState.alerts];
    dbState.patients = dbState.patients.map((p) => (p.id === updatedPatient.id ? updatedPatient : p));
    saveState(dbState);

    broadcast({ type: 'alert:created', alert, patient: updatedPatient });
    res.status(201).json({ alert, patient: updatedPatient });
  });

  app.patch('/api/alerts/:id', (req, res) => {
    const { id } = req.params;
    const body = req.body as {
      status?: RealtimeAlert['status'];
      nurseOrder?: string;
      acknowledgedBy?: string;
    };

    const existing = dbState.alerts.find((a) => a.id === id);
    if (!existing) {
      res.status(404).json({ error: 'ไม่พบรายการแจ้งเตือน' });
      return;
    }

    const nowIso = new Date().toISOString();
    const updated: RealtimeAlert = {
      ...existing,
      status: body.status ?? existing.status,
      nurseOrder: body.nurseOrder !== undefined ? body.nurseOrder.trim() : existing.nurseOrder,
      acknowledgedBy: body.acknowledgedBy?.trim() || existing.acknowledgedBy || dbState.inspector.name,
      acknowledgedAt: existing.acknowledgedAt || nowIso,
    };

    dbState.alerts = dbState.alerts.map((a) => (a.id === id ? updated : a));

    if (updated.status === 'resolved') {
      const hasOtherActiveCritical = dbState.alerts.some(
        (a) => a.patientId === updated.patientId && a.id !== updated.id && a.status !== 'resolved' && a.severity === 'critical'
      );
      if (!hasOtherActiveCritical) {
        dbState.patients = dbState.patients.map((p) =>
          p.id === updated.patientId ? { ...p, triageLevel: 'normal' } : p
        );
      }
    }

    saveState(dbState);
    broadcast({ type: 'alert:updated', alert: updated });
    res.json(updated);
  });

  app.patch('/api/visits/:id/inspect', (req, res) => {
    const { id } = req.params;
    const body = req.body as {
      inspectionStatus: 'approved' | 'revision';
      inspectorNote?: string;
      inspectorName?: string;
    };

    const existing = dbState.visitLogs.find((v) => v.id === id);
    if (!existing) {
      res.status(404).json({ error: 'ไม่พบบันทึกการเยี่ยม' });
      return;
    }

    if (body.inspectionStatus === 'revision' && !body.inspectorNote?.trim()) {
      res.status(400).json({ error: 'กรุณาระบุหมายเหตุสิ่งที่ต้องแก้ไขก่อนส่งกลับ' });
      return;
    }

    const updated: CareVisitLog = {
      ...existing,
      inspectionStatus: body.inspectionStatus,
      inspectorName: body.inspectorName?.trim() || dbState.inspector.name,
      inspectedAt: new Date().toISOString(),
      inspectorNote: body.inspectorNote?.trim() || (body.inspectionStatus === 'approved' ? 'ตรวจรับงานเรียบร้อย เอกสารครบถ้วน' : ''),
    };

    dbState.visitLogs = dbState.visitLogs.map((v) => (v.id === id ? updated : v));
    saveState(dbState);
    broadcast({ type: 'visit:updated', visitLog: updated });
    res.json(updated);
  });

  app.post('/api/visits/:id/resubmit', (req, res) => {
    const { id } = req.params;
    const body = req.body as {
      clinicalNote?: string;
      caregiverSignerName?: string;
      signatureDataUrl?: string;
      activities?: string[];
    };

    const existing = dbState.visitLogs.find((v) => v.id === id);
    if (!existing) {
      res.status(404).json({ error: 'ไม่พบบันทึกการเยี่ยม' });
      return;
    }

    const updated: CareVisitLog = {
      ...existing,
      clinicalNote: body.clinicalNote?.trim() || existing.clinicalNote,
      caregiverSignerName: body.caregiverSignerName?.trim() || existing.caregiverSignerName,
      signatureDataUrl: body.signatureDataUrl || existing.signatureDataUrl,
      caregiverSigned: Boolean(body.signatureDataUrl || body.caregiverSignerName?.trim() || existing.caregiverSigned),
      activities: body.activities && body.activities.length > 0 ? body.activities : existing.activities,
      inspectionStatus: 'pending',
      inspectorNote: undefined,
    };

    dbState.visitLogs = dbState.visitLogs.map((v) => (v.id === id ? updated : v));
    saveState(dbState);
    broadcast({ type: 'visit:updated', visitLog: updated });
    res.json(updated);
  });

  app.post('/api/acceptance/certify', (req, res) => {
    const body = req.body as {
      volunteerId: string;
      monthKey: string;
      monthLabel: string;
      remark?: string;
    };

    const volunteer = dbState.volunteers.find((v) => v.id === body.volunteerId);
    if (!volunteer) {
      res.status(404).json({ error: 'ไม่พบข้อมูล อสพ.' });
      return;
    }

    const approvedLogs = dbState.visitLogs.filter(
      (v) => v.volunteerId === volunteer.id && v.inspectionStatus === 'approved'
    );
    const totalMinutes = approvedLogs.reduce((acc, v) => acc + v.durationMinutes, 0);

    const batch: WorkAcceptanceBatch = {
      id: `acc-${Date.now()}`,
      monthKey: body.monthKey,
      monthLabel: body.monthLabel,
      volunteerId: volunteer.id,
      volunteerName: volunteer.name,
      approvedVisitCount: approvedLogs.length,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      certifiedBy: dbState.inspector.name,
      directorName: dbState.inspector.directorName,
      certifiedAt: new Date().toISOString(),
      remark: body.remark?.trim() || 'ตรวจรับผลการปฏิบัติงานดูแลผู้ป่วยต่อเนื่องในชุมชนเรียบร้อย',
    };

    dbState.acceptanceBatches = [
      batch,
      ...dbState.acceptanceBatches.filter(
        (b) => !(b.volunteerId === batch.volunteerId && b.monthKey === batch.monthKey)
      ),
    ];
    saveState(dbState);
    broadcast({ type: 'acceptance:certified', batch });
    res.status(201).json(batch);
  });

  app.post('/api/volunteers', (req, res) => {
    const body = req.body as Partial<VolunteerProfile>;
    if (!body.name?.trim() || !body.code?.trim()) {
      res.status(400).json({ error: 'กรุณาระบุชื่อ-สกุล และรหัสประจำตัว อสพ.' });
      return;
    }
    const volunteer: VolunteerProfile = {
      id: `vol-${Date.now()}`,
      name: body.name.trim(),
      code: body.code.trim(),
      area: body.area?.trim() || 'พื้นที่รับผิดชอบ รพ.สต.',
      phone: body.phone?.trim() || '-',
    };
    dbState.volunteers = [...dbState.volunteers, volunteer];
    saveState(dbState);
    broadcast({ type: 'volunteer:upserted', volunteer });
    res.status(201).json(volunteer);
  });

  app.patch('/api/volunteers/:id', (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<VolunteerProfile>;
    const existing = dbState.volunteers.find((v) => v.id === id);
    if (!existing) {
      res.status(404).json({ error: 'ไม่พบข้อมูล อสพ.' });
      return;
    }
    const updated: VolunteerProfile = {
      ...existing,
      name: body.name?.trim() || existing.name,
      code: body.code?.trim() || existing.code,
      area: body.area !== undefined ? body.area.trim() : existing.area,
      phone: body.phone !== undefined ? body.phone.trim() : existing.phone,
    };
    dbState.volunteers = dbState.volunteers.map((v) => (v.id === id ? updated : v));
    dbState.patients = dbState.patients.map((p) =>
      p.assignedVolunteerId === id ? { ...p, assignedVolunteerName: updated.name } : p
    );
    saveState(dbState);
    broadcast({ type: 'volunteer:upserted', volunteer: updated, patients: dbState.patients });
    res.json(updated);
  });

  app.delete('/api/volunteers/:id', (req, res) => {
    const { id } = req.params;
    if (dbState.volunteers.length <= 1) {
      res.status(400).json({ error: 'ต้องมีรายชื่อ อสพ. อย่างน้อย 1 ท่านในระบบ' });
      return;
    }
    const exists = dbState.volunteers.some((v) => v.id === id);
    if (!exists) {
      res.status(404).json({ error: 'ไม่พบข้อมูล อสพ.' });
      return;
    }
    dbState.volunteers = dbState.volunteers.filter((v) => v.id !== id);
    const fallback = dbState.volunteers[0];
    dbState.patients = dbState.patients.map((p) =>
      p.assignedVolunteerId === id
        ? { ...p, assignedVolunteerId: fallback.id, assignedVolunteerName: fallback.name }
        : p
    );
    saveState(dbState);
    broadcast({ type: 'volunteer:deleted', volunteerId: id });
    res.json({ deletedId: id });
  });

  app.post('/api/caregivers', (req, res) => {
    const body = req.body as Partial<CertifyingCaregiver>;
    if (!body.patientId || !body.name?.trim()) {
      res.status(400).json({ error: 'กรุณาเลือกผู้ป่วยและระบุชื่อผู้ดูแลที่ลงนามรับรอง' });
      return;
    }
    const patient = dbState.patients.find((p) => p.id === body.patientId);
    if (!patient) {
      res.status(404).json({ error: 'ไม่พบข้อมูลผู้ป่วย' });
      return;
    }

    const isPrimary = Boolean(body.isPrimary);
    const caregiver: CertifyingCaregiver = {
      id: `cg-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.fullName,
      name: body.name.trim(),
      relation: body.relation?.trim() || 'ผู้ดูแลในครอบครัว',
      phone: body.phone?.trim() || '-',
      isPrimary,
    };

    if (isPrimary) {
      dbState.caregivers = dbState.caregivers.map((c) =>
        c.patientId === patient.id ? { ...c, isPrimary: false } : c
      );
    }
    dbState.caregivers = [caregiver, ...dbState.caregivers];

    let updatedPatient: CarePatient | undefined;
    if (isPrimary) {
      updatedPatient = {
        ...patient,
        caregiverName: `${caregiver.name} (${caregiver.relation})`,
        caregiverPhone: caregiver.phone,
      };
      dbState.patients = dbState.patients.map((p) =>
        p.id === patient.id ? updatedPatient! : p
      );
    }

    saveState(dbState);
    broadcast({ type: 'caregiver:upserted', caregiver, patient: updatedPatient });
    res.status(201).json(caregiver);
  });

  app.patch('/api/caregivers/:id', (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<CertifyingCaregiver>;
    const existing = dbState.caregivers.find((c) => c.id === id);
    if (!existing) {
      res.status(404).json({ error: 'ไม่พบข้อมูลผู้ดูแลที่ลงนามรับรอง' });
      return;
    }

    const updated: CertifyingCaregiver = {
      ...existing,
      name: body.name?.trim() || existing.name,
      relation: body.relation?.trim() || existing.relation,
      phone: body.phone !== undefined ? body.phone.trim() : existing.phone,
      isPrimary: body.isPrimary !== undefined ? Boolean(body.isPrimary) : existing.isPrimary,
    };

    if (updated.isPrimary) {
      dbState.caregivers = dbState.caregivers.map((c) =>
        c.patientId === updated.patientId ? (c.id === id ? updated : { ...c, isPrimary: false }) : c
      );
    } else {
      dbState.caregivers = dbState.caregivers.map((c) => (c.id === id ? updated : c));
    }

    let updatedPatient: CarePatient | undefined;
    if (updated.isPrimary) {
      const targetPatient = dbState.patients.find((p) => p.id === updated.patientId);
      if (targetPatient) {
        updatedPatient = {
          ...targetPatient,
          caregiverName: `${updated.name} (${updated.relation})`,
          caregiverPhone: updated.phone,
        };
        dbState.patients = dbState.patients.map((p) =>
          p.id === updatedPatient!.id ? updatedPatient! : p
        );
      }
    }

    saveState(dbState);
    broadcast({ type: 'caregiver:upserted', caregiver: updated, patient: updatedPatient });
    res.json(updated);
  });

  app.delete('/api/caregivers/:id', (req, res) => {
    const { id } = req.params;
    const exists = dbState.caregivers.some((c) => c.id === id);
    if (!exists) {
      res.status(404).json({ error: 'ไม่พบข้อมูลผู้ดูแล' });
      return;
    }
    dbState.caregivers = dbState.caregivers.filter((c) => c.id !== id);
    saveState(dbState);
    broadcast({ type: 'caregiver:deleted', caregiverId: id });
    res.json({ deletedId: id });
  });

  app.patch('/api/settings', (req, res) => {
    const body = req.body as {
      inspector?: Partial<InspectorConfig>;
      systemSettings?: Partial<SystemSettings>;
    };

    if (body.inspector) {
      dbState.inspector = {
        ...dbState.inspector,
        name: body.inspector.name?.trim() || dbState.inspector.name,
        position: body.inspector.position?.trim() || dbState.inspector.position,
        facility: body.inspector.facility?.trim() || dbState.inspector.facility,
        directorName: body.inspector.directorName?.trim() || dbState.inspector.directorName,
      };
    }

    if (body.systemSettings) {
      dbState.systemSettings = {
        ...dbState.systemSettings,
        requireCaregiverSignature:
          body.systemSettings.requireCaregiverSignature ??
          dbState.systemSettings.requireCaregiverSignature,
        requireCaregiverSignerName:
          body.systemSettings.requireCaregiverSignerName ??
          dbState.systemSettings.requireCaregiverSignerName,
        defaultVisitDurationMinutes:
          Number(body.systemSettings.defaultVisitDurationMinutes) ||
          dbState.systemSettings.defaultVisitDurationMinutes,
        autoAlertOnWatchLevel:
          body.systemSettings.autoAlertOnWatchLevel ?? dbState.systemSettings.autoAlertOnWatchLevel,
      };
    }

    saveState(dbState);
    broadcast({
      type: 'settings:updated',
      inspector: dbState.inspector,
      systemSettings: dbState.systemSettings,
    });
    res.json({ inspector: dbState.inspector, systemSettings: dbState.systemSettings });
  });

  // --- Data Backup & Restore Endpoints ---
  const ensureBackupsDir = () => {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
  };

  interface StoredBackupFile {
    meta: BackupSnapshotMeta;
    data: SystemState;
  }

  const createSnapshotOnDisk = (note: string): BackupSnapshotMeta => {
    ensureBackupsDir();
    const id = `bkp-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const filename = `careconnect-backup-${createdAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;
    const snapshotData: SystemState = { ...dbState, serverTime: createdAt };
    const meta: BackupSnapshotMeta = {
      id,
      filename,
      createdAt,
      sizeBytes: 0,
      note: note.trim() || 'สำรองข้อมูลระบบตามกำหนดเวลา',
      counts: {
        patients: snapshotData.patients.length,
        visitLogs: snapshotData.visitLogs.length,
        alerts: snapshotData.alerts.length,
        volunteers: snapshotData.volunteers.length,
        caregivers: snapshotData.caregivers.length,
      },
    };
    const payload: StoredBackupFile = { meta, data: snapshotData };
    const serialized = JSON.stringify(payload, null, 2);
    meta.sizeBytes = Buffer.byteLength(serialized, 'utf-8');
    payload.meta.sizeBytes = meta.sizeBytes;
    fs.writeFileSync(path.join(BACKUPS_DIR, `${id}.json`), JSON.stringify(payload, null, 2), 'utf-8');
    return meta;
  };

  app.get('/api/backups', (_req, res) => {
    ensureBackupsDir();
    const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.json'));
    const list: BackupSnapshotMeta[] = [];
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(BACKUPS_DIR, file), 'utf-8');
        const parsed = JSON.parse(raw) as StoredBackupFile;
        if (parsed?.meta?.id) {
          list.push(parsed.meta);
        }
      } catch {
        // Ignore corrupted backup file
      }
    }
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(list);
  });

  app.post('/api/backups', (req, res) => {
    const body = (req.body || {}) as { note?: string };
    const meta = createSnapshotOnDisk(body.note || 'สำรองข้อมูลด้วยตนเอง');
    res.status(201).json(meta);
  });

  app.get('/api/backups/:id/download', (req, res) => {
    ensureBackupsDir();
    const safeId = path.basename(req.params.id);
    const filePath = path.join(BACKUPS_DIR, `${safeId}.json`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'ไม่พบไฟล์สำรองข้อมูล' });
      return;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as StoredBackupFile;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${parsed.meta?.filename || `${safeId}.json`}"`
    );
    res.send(raw);
  });

  app.post('/api/backups/:id/restore', (req, res) => {
    ensureBackupsDir();
    const safeId = path.basename(req.params.id);
    const filePath = path.join(BACKUPS_DIR, `${safeId}.json`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'ไม่พบไฟล์สำรองข้อมูลที่ต้องการกู้คืน' });
      return;
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as StoredBackupFile;
      if (!parsed?.data || !Array.isArray(parsed.data.patients)) {
        res.status(400).json({ error: 'โครงสร้างไฟล์สำรองข้อมูลไม่ถูกต้อง' });
        return;
      }
      createSnapshotOnDisk('สำรองอัตโนมัติก่อนกู้คืนข้อมูล');
      dbState = {
        ...parsed.data,
        serverTime: new Date().toISOString(),
      };
      saveState(dbState);
      broadcast({ type: 'state:sync', state: dbState });
      res.json({ restoredFrom: parsed.meta, state: dbState });
    } catch {
      res.status(500).json({ error: 'ไม่สามารถกู้คืนข้อมูลจากไฟล์สำรองได้' });
    }
  });

  app.post('/api/backups/import', (req, res) => {
    const body = req.body as Partial<StoredBackupFile> & Partial<SystemState>;
    const candidate: Partial<SystemState> | undefined = body.data ? body.data : body;
    if (
      !candidate ||
      !Array.isArray(candidate.patients) ||
      !Array.isArray(candidate.visitLogs) ||
      !Array.isArray(candidate.volunteers)
    ) {
      res.status(400).json({ error: 'ไฟล์ JSON ไม่ใช่ข้อมูลสำรองของระบบ อสพ. CareConnect' });
      return;
    }

    createSnapshotOnDisk('สำรองอัตโนมัติก่อนนำเข้าไฟล์สำรอง');
    const seed = createInitialSeed();
    dbState = {
      ...seed,
      ...candidate,
      patients: candidate.patients,
      visitLogs: candidate.visitLogs,
      volunteers: candidate.volunteers,
      alerts: Array.isArray(candidate.alerts) ? candidate.alerts : [],
      caregivers: Array.isArray(candidate.caregivers) ? candidate.caregivers : [],
      acceptanceBatches: Array.isArray(candidate.acceptanceBatches) ? candidate.acceptanceBatches : [],
      serverTime: new Date().toISOString(),
    };
    saveState(dbState);
    broadcast({ type: 'state:sync', state: dbState });
    res.json({ state: dbState });
  });

  app.delete('/api/backups/:id', (req, res) => {
    ensureBackupsDir();
    const safeId = path.basename(req.params.id);
    const filePath = path.join(BACKUPS_DIR, `${safeId}.json`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'ไม่พบไฟล์สำรองข้อมูล' });
      return;
    }
    fs.unlinkSync(filePath);
    res.json({ deletedId: safeId });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
