import React, { useEffect, useMemo, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import type { MapMouseEvent } from '@vis.gl/react-google-maps';
import {
  ClipboardPlus,
  Crosshair,
  LocateFixed,
  MapPin,
  Navigation,
  Phone,
  X,
} from 'lucide-react';
import type { CarePatient, PatientLocation, TriageLevel } from '../types';
import { getTriageLabel } from '../utils/formatters';

interface PatientMapViewProps {
  patients: CarePatient[];
  mapsApiKey: string;
  onOpenVisitForPatient: (patientId: string) => void;
  onUpdatePatientLocation: (patientId: string, location: PatientLocation) => Promise<CarePatient>;
}

const DEFAULT_CENTER: PatientLocation = { lat: 13.8205, lng: 100.0605 };

function getPinStyle(triageLevel: TriageLevel) {
  switch (triageLevel) {
    case 'critical':
      return {
        background: '#dc2626',
        borderColor: '#991b1b',
        glyphColor: '#ffffff',
        scale: 1.2,
      };
    case 'watch':
      return {
        background: '#d97706',
        borderColor: '#92400e',
        glyphColor: '#ffffff',
        scale: 1.08,
      };
    default:
      return {
        background: '#0d9488',
        borderColor: '#115e59',
        glyphColor: '#ffffff',
        scale: 1.0,
      };
  }
}

interface PatientMarkerProps {
  patient: CarePatient;
  isSelected: boolean;
  isRelocating: boolean;
  onSelect: (patientId: string) => void;
  onClose: () => void;
  onStartRelocate: (patientId: string) => void;
  onOpenVisit: (patientId: string) => void;
}

function PatientMarkerWithInfoWindow({
  patient,
  isSelected,
  isRelocating,
  onSelect,
  onClose,
  onStartRelocate,
  onOpenVisit,
}: PatientMarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  if (!patient.location) return null;

  const pinStyle = getPinStyle(patient.triageLevel);
  const triageTextColor =
    patient.triageLevel === 'critical'
      ? 'text-rose-700'
      : patient.triageLevel === 'watch'
      ? 'text-amber-700'
      : 'text-emerald-700';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={patient.location}
        title={`${patient.fullName} (${getTriageLabel(patient.triageLevel)})`}
        zIndex={
          isSelected || isRelocating
            ? 300
            : patient.triageLevel === 'critical'
            ? 200
            : patient.triageLevel === 'watch'
            ? 100
            : 10
        }
        onClick={() => onSelect(patient.id)}
      >
        <Pin
          background={isRelocating ? '#1d4ed8' : pinStyle.background}
          borderColor={isRelocating ? '#1e3a8a' : pinStyle.borderColor}
          glyphColor={pinStyle.glyphColor}
          scale={isSelected || isRelocating ? 1.25 : pinStyle.scale}
        />
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} maxWidth={300} onCloseClick={onClose}>
          <div className="p-1 space-y-2.5 text-slate-900 font-sans min-w-[230px]">
            <div className="space-y-0.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className={`font-bold ${triageTextColor}`}>
                  {getTriageLabel(patient.triageLevel)}
                </span>
                <span className="font-mono-tabular text-slate-500">{patient.hn}</span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 leading-snug">
                {patient.fullName}
              </h4>
              <p className="text-xs text-slate-600 leading-snug">{patient.village}</p>
            </div>

            <div className="grid grid-cols-4 gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-2 text-[11px] font-mono-tabular">
              <div>
                <span className="block text-[9px] text-slate-500 font-sans">BP</span>
                <span className="font-semibold">
                  {patient.latestVitals.sbp}/{patient.latestVitals.dbp}
                </span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-500 font-sans">SpO2</span>
                <span
                  className={`font-semibold ${
                    patient.latestVitals.spo2 <= 92 ? 'text-rose-700' : 'text-slate-900'
                  }`}
                >
                  {patient.latestVitals.spo2}%
                </span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-500 font-sans">Temp</span>
                <span className="font-semibold">{patient.latestVitals.temp.toFixed(1)}°</span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-500 font-sans">PR</span>
                <span className="font-semibold">{patient.latestVitals.pr}</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-600 space-y-0.5">
              <p>ผู้ดูแล: {patient.caregiverName}</p>
              <p className="inline-flex items-center gap-1 font-mono-tabular">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>{patient.caregiverPhone}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenVisit(patient.id)}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                <ClipboardPlus className="w-3.5 h-3.5" />
                <span>บันทึกเยี่ยม</span>
              </button>
              <button
                type="button"
                onClick={() => onStartRelocate(patient.id)}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                title="ย้ายหมุดตำแหน่งบ้าน"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>ย้ายหมุด</span>
              </button>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

interface InnerMapCanvasProps {
  patients: CarePatient[];
  selectedPatientId: string | null;
  relocatingPatientId: string | null;
  onSelectPatient: (patientId: string | null) => void;
  onStartRelocate: (patientId: string) => void;
  onOpenVisitForPatient: (patientId: string) => void;
  onMapClickRelocate: (location: PatientLocation) => void;
}

function InnerMapCanvas({
  patients,
  selectedPatientId,
  relocatingPatientId,
  onSelectPatient,
  onStartRelocate,
  onOpenVisitForPatient,
  onMapClickRelocate,
}: InnerMapCanvasProps) {
  const map = useMap();
  const status = useApiLoadingStatus();

  const mappablePatients = useMemo(
    () => patients.filter((p): p is CarePatient & { location: PatientLocation } => Boolean(p.location)),
    [patients]
  );

  const initialCenter = mappablePatients[0]?.location ?? DEFAULT_CENTER;

  useEffect(() => {
    if (!map || !selectedPatientId) return;
    const target = mappablePatients.find((p) => p.id === selectedPatientId);
    if (target) {
      map.panTo(target.location);
    }
  }, [map, selectedPatientId, mappablePatients]);

  const handleMapClick = (event: MapMouseEvent) => {
    if (relocatingPatientId && event.detail.latLng) {
      onMapClickRelocate({
        lat: Number(event.detail.latLng.lat.toFixed(6)),
        lng: Number(event.detail.latLng.lng.toFixed(6)),
      });
    } else if (!relocatingPatientId) {
      onSelectPatient(null);
    }
  };

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="h-[440px] lg:h-[520px] w-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-6 text-center space-y-2">
        <MapPin className="w-8 h-8 text-amber-600" />
        <p className="text-sm font-semibold text-slate-900">
          ไม่สามารถโหลดแผนที่ Google Maps ได้ชั่วคราว
        </p>
        <p className="text-xs text-slate-600 max-w-md">
          กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต หรือสิทธิ์การใช้งาน API Key ของ Google Maps Platform
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-[440px] lg:h-[520px] w-full rounded-xl overflow-hidden border border-slate-200">
      <GoogleMap
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        defaultCenter={initialCenter}
        defaultZoom={15}
        gestureHandling="greedy"
        streetViewControl={false}
        mapTypeControl={true}
        fullscreenControl={true}
        onClick={handleMapClick}
        style={{ width: '100%', height: '100%' }}
      >
        {mappablePatients.map((patient) => (
          <PatientMarkerWithInfoWindow
            key={patient.id}
            patient={patient}
            isSelected={selectedPatientId === patient.id}
            isRelocating={relocatingPatientId === patient.id}
            onSelect={(id) => onSelectPatient(id)}
            onClose={() => onSelectPatient(null)}
            onStartRelocate={onStartRelocate}
            onOpenVisit={onOpenVisitForPatient}
          />
        ))}
      </GoogleMap>
    </div>
  );
}

export function PatientMapView({
  patients,
  mapsApiKey,
  onOpenVisitForPatient,
  onUpdatePatientLocation,
}: PatientMapViewProps) {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [relocatingPatientId, setRelocatingPatientId] = useState<string | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const relocatingPatient = patients.find((p) => p.id === relocatingPatientId) ?? null;

  const counts = useMemo(() => {
    let critical = 0;
    let watch = 0;
    let normal = 0;
    for (const p of patients) {
      if (p.triageLevel === 'critical') critical += 1;
      else if (p.triageLevel === 'watch') watch += 1;
      else normal += 1;
    }
    return { critical, watch, normal };
  }, [patients]);

  const handleSaveLocation = async (patientId: string, location: PatientLocation) => {
    setSavingLocation(true);
    setGpsError(null);
    try {
      await onUpdatePatientLocation(patientId, location);
      setRelocatingPatientId(null);
      setSelectedPatientId(patientId);
    } catch (err) {
      setGpsError(err instanceof Error ? err.message : 'บันทึกพิกัดไม่สำเร็จ');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleUseCurrentGps = (patientId: string) => {
    if (!navigator.geolocation) {
      setGpsError('เบราว์เซอร์นี้ไม่รองรับการอ่านพิกัด GPS');
      return;
    }
    setGpsError(null);
    setSavingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await handleSaveLocation(patientId, {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
      },
      () => {
        setSavingLocation(false);
        setGpsError('ไม่สามารถเข้าถึงตำแหน่ง GPS ได้ กรุณาอนุญาตการเข้าถึงตำแหน่งหรือคลิกบนแผนที่');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
      {/* Map Header & Legend */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-slate-900">
            แผนที่แสดงตำแหน่งที่พักอาศัยผู้ป่วยในพื้นที่ดูแล
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            คลิกที่หมุดผู้ป่วยเพื่อดูสัญญาณชีพและบันทึกการเยี่ยมบ้าน หรือปรับตำแหน่งหมุดบ้านให้ตรงพิกัดจริง
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 font-medium">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
            <span>วิกฤต ({counts.critical})</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
            <span>เฝ้าระวัง ({counts.watch})</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
            <span>ปกติ ({counts.normal})</span>
          </span>
        </div>
      </div>

      {/* Relocation Banner */}
      {relocatingPatient && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs sm:text-sm text-blue-950">
            <Crosshair className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <span>
              โหมดย้ายหมุดบ้านผู้ป่วย: คลิกตำแหน่งบนแผนที่เพื่อกำหนดที่พักของ{' '}
              <strong className="font-bold">{relocatingPatient.fullName}</strong>
              {savingLocation ? ' (กำลังบันทึกพิกัด...)' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={savingLocation}
              onClick={() => handleUseCurrentGps(relocatingPatient.id)}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold text-blue-900 bg-white border border-blue-300 hover:bg-blue-100 rounded-lg disabled:opacity-50"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              <span>ใช้พิกัด GPS ปัจจุบัน</span>
            </button>
            <button
              type="button"
              onClick={() => setRelocatingPatientId(null)}
              className="inline-flex items-center gap-1 min-h-[36px] px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
              <span>ยกเลิก</span>
            </button>
          </div>
        </div>
      )}

      {gpsError && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          {gpsError}
        </p>
      )}

      {/* Map + Quick Residence Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          {mapsApiKey ? (
            <APIProvider apiKey={mapsApiKey} libraries={['marker']} language="th" region="TH">
              <InnerMapCanvas
                patients={patients}
                selectedPatientId={selectedPatientId}
                relocatingPatientId={relocatingPatientId}
                onSelectPatient={setSelectedPatientId}
                onStartRelocate={(id) => {
                  setRelocatingPatientId(id);
                  setSelectedPatientId(null);
                }}
                onOpenVisitForPatient={onOpenVisitForPatient}
                onMapClickRelocate={(loc) => {
                  if (relocatingPatientId) {
                    handleSaveLocation(relocatingPatientId, loc);
                  }
                }}
              />
            </APIProvider>
          ) : (
            <div className="h-[440px] lg:h-[520px] w-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-6 text-center space-y-2">
              <MapPin className="w-8 h-8 text-slate-400" />
              <p className="text-sm font-semibold text-slate-900">
                กำลังเตรียมข้อมูลแผนที่ Google Maps Platform
              </p>
              <p className="text-xs text-slate-500 max-w-md">
                หากยังไม่พบการตั้งค่า API Key ระบบจะแสดงรายการพิกัดที่พักอาศัยผู้ป่วยทางด้านข้างแทน
              </p>
            </div>
          )}
        </div>

        {/* Patient Pin Directory */}
        <div className="lg:col-span-4 flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden max-h-[520px]">
          <div className="px-3.5 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">
              พิกัดที่พักอาศัย ({patients.length} ราย)
            </span>
            <span className="text-[11px] text-slate-500">เลือกเพื่อเลื่อนแผนที่</span>
          </div>

          <div className="divide-y divide-slate-200 overflow-y-auto flex-1">
            {patients.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">
                ไม่พบรายชื่อผู้ป่วยตามตัวกรองปัจจุบัน
              </p>
            ) : (
              patients.map((patient) => {
                const isSelected = selectedPatientId === patient.id;
                const isRelocating = relocatingPatientId === patient.id;
                const dotColor =
                  patient.triageLevel === 'critical'
                    ? 'bg-red-600'
                    : patient.triageLevel === 'watch'
                    ? 'bg-amber-600'
                    : 'bg-teal-600';

                return (
                  <div
                    key={patient.id}
                    className={`p-3 transition-colors ${
                      isSelected ? 'bg-teal-50/70' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedPatientId(patient.id)}
                      className="w-full text-left space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 truncate">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                          <span className="truncate">{patient.fullName}</span>
                        </span>
                        <span className="font-mono-tabular text-[11px] text-slate-500 shrink-0">
                          {patient.hn}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate">{patient.village}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                        <span className="font-mono-tabular">
                          {patient.location
                            ? `${patient.location.lat.toFixed(4)}, ${patient.location.lng.toFixed(4)}`
                            : 'ยังไม่ระบุพิกัด'}
                        </span>
                        <span>{patient.assignedVolunteerName}</span>
                      </div>
                    </button>

                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setRelocatingPatientId(isRelocating ? null : patient.id);
                          setSelectedPatientId(null);
                        }}
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md ${
                          isRelocating
                            ? 'bg-blue-700 text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Navigation className="w-3 h-3" />
                        <span>{isRelocating ? 'กำลังเลือกจุด...' : 'ปักหมุดย้าย'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenVisitForPatient(patient.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-900 px-2 py-1 rounded-md hover:bg-teal-50"
                      >
                        <ClipboardPlus className="w-3 h-3" />
                        <span>บันทึกเยี่ยม</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
