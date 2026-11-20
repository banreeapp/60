import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Stethoscope,
  UserCheck,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useCareRealtime } from './hooks/useCareRealtime';
import type { ActiveTab, RoleMode } from './types';
import { TopBar } from './components/TopBar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { AlertsPanel } from './components/AlertsPanel';
import { PatientListView } from './components/PatientListView';
import { InspectionQueueView } from './components/InspectionQueueView';
import { OfficialReportView } from './components/OfficialReportView';
import { VisitFormModal } from './components/VisitFormModal';
import { SystemSettingsView } from './components/SystemSettingsView';

export default function App() {
  const {
    state,
    loading,
    error,
    wsConnected,
    mapsApiKey,
    backups,
    toastMessage,
    dismissToast,
    reload,
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
  } = useCareRealtime();

  const [activeTab, setActiveTab] = useState<ActiveTab>('realtime');
  const [roleMode, setRoleMode] = useState<RoleMode>('inspector');
  const [activeVolunteerId, setActiveVolunteerId] = useState<string>('vol-1');
  const [visitModalPatientId, setVisitModalPatientId] = useState<string | undefined>(undefined);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const openVisitModal = (patientId?: string) => {
    setVisitModalPatientId(patientId);
    setShowVisitModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-2xl p-6 text-center space-y-4">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h1 className="text-base font-bold text-slate-900">ไม่สามารถเชื่อมต่อข้อมูลระบบได้</h1>
          <p className="text-sm text-slate-600">{error || 'กรุณาลองโหลดข้อมูลใหม่อีกครั้ง'}</p>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2 bg-teal-700 text-white text-sm font-semibold rounded-xl hover:bg-teal-800"
          >
            <RefreshCw className="w-4 h-4" />
            <span>ลองเชื่อมต่อใหม่</span>
          </button>
        </div>
      </div>
    );
  }

  const activeAlertCount = state.alerts.filter((a) => a.status === 'active').length;
  const pendingInspectionCount = state.visitLogs.filter(
    (v) => v.inspectionStatus === 'pending'
  ).length;
  const activeVolunteer =
    state.volunteers.find((v) => v.id === activeVolunteerId) ?? state.volunteers[0];

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-12">
      {gmpQuotaExceeded && (
        <div className="no-print bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewVisit={() => openVisitModal()}
        activeAlertCount={activeAlertCount}
        pendingInspectionCount={pendingInspectionCount}
      />

      {/* Live Notification Toast */}
      {toastMessage && (
        <div
          role="status"
          className="no-print fixed top-16 sm:top-20 right-4 left-4 sm:left-auto sm:w-96 z-50"
        >
          <div
            className={`border rounded-2xl p-4 shadow-lg flex items-start justify-between gap-3 ${
              toastMessage.tone === 'critical'
                ? 'bg-rose-900 border-rose-700 text-white'
                : 'bg-slate-900 border-slate-700 text-white'
            }`}
          >
            <div className="flex items-start gap-2.5 text-sm">
              {toastMessage.tone === 'critical' ? (
                <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <span className="font-medium leading-snug">{toastMessage.title}</span>
            </div>
            <button
              type="button"
              onClick={dismissToast}
              className="text-slate-300 hover:text-white shrink-0"
              aria-label="ปิดการแจ้งเตือน"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 space-y-6">
        {/* Workspace Role Toolbar (Outside Header per Top Bar Contract) */}
        <section className="no-print bg-white border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{state.inspector.facility}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                {wsConnected ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-700" />
                    <span>ซิงค์ข้อมูลเรียลไทม์</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-700" />
                    <span>กำลังเชื่อมต่อใหม่...</span>
                  </>
                )}
              </span>
            </div>
            <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900 text-balance">
              {activeTab === 'realtime' && 'ศูนย์ติดตามอาการผู้ป่วยและแจ้งเตือนเรียลไทม์'}
              {activeTab === 'patients' && 'ทะเบียนผู้ป่วยดูแลต่อเนื่องในพื้นที่รับผิดชอบ'}
              {activeTab === 'inspection' && 'คิวตรวจรับงานและรับรองการเยี่ยมบ้าน อสพ.'}
              {activeTab === 'report' && 'แบบรายงานสรุปผลการดูแลต่อเนื่องและตรวจรับงาน'}
              {activeTab === 'settings' && 'ตั้งค่าระบบ ผู้ปฏิบัติงาน (อสพ.) ผู้ดูแล และสำรองข้อมูล'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Role Mode Switcher */}
            <div
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
              role="group"
              aria-label="สลับบทบาทผู้ใช้งาน"
            >
              <button
                type="button"
                onClick={() => setRoleMode('volunteer')}
                className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  roleMode === 'volunteer'
                    ? 'bg-white text-teal-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>มุมมอง อสพ. ภาคสนาม</span>
              </button>
              <button
                type="button"
                onClick={() => setRoleMode('inspector')}
                className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  roleMode === 'inspector'
                    ? 'bg-white text-teal-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>มุมมองพยาบาลตรวจรับงาน</span>
              </button>
            </div>

            {roleMode === 'volunteer' && (
              <select
                aria-label="เลือกผู้ปฏิบัติงาน อสพ."
                value={activeVolunteerId}
                onChange={(e) => setActiveVolunteerId(e.target.value)}
                className="min-h-[40px] px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              >
                {state.volunteers.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.code})
                  </option>
                ))}
              </select>
            )}
          </div>
        </section>

        {/* Active View */}
        {activeTab === 'realtime' && (
          <AlertsPanel
            alerts={state.alerts}
            patients={state.patients}
            roleMode={roleMode}
            activeVolunteerId={activeVolunteer?.id ?? 'vol-1'}
            onUpdateAlert={updateAlert}
            onTriggerSos={triggerSos}
            onOpenVisitForPatient={(id) => openVisitModal(id)}
          />
        )}

        {activeTab === 'patients' && (
          <PatientListView
            patients={state.patients}
            volunteers={state.volunteers}
            mapsApiKey={mapsApiKey}
            onOpenVisitForPatient={(id) => openVisitModal(id)}
            onCreatePatient={createPatient}
            onUpdatePatientLocation={updatePatientLocation}
          />
        )}

        {activeTab === 'inspection' && (
          <InspectionQueueView
            visitLogs={state.visitLogs}
            volunteers={state.volunteers}
            roleMode={roleMode}
            inspectorName={state.inspector.name}
            onInspectVisit={inspectVisit}
            onResubmitVisit={resubmitVisit}
          />
        )}

        {activeTab === 'report' && (
          <OfficialReportView
            patients={state.patients}
            visitLogs={state.visitLogs}
            volunteers={state.volunteers}
            inspector={state.inspector}
            acceptanceBatches={state.acceptanceBatches}
            roleMode={roleMode}
            onCertifyBatch={certifyBatch}
          />
        )}

        {activeTab === 'settings' && (
          <SystemSettingsView
            volunteers={state.volunteers}
            caregivers={state.caregivers}
            patients={state.patients}
            inspector={state.inspector}
            systemSettings={state.systemSettings}
            backups={backups}
            onUpsertVolunteer={upsertVolunteer}
            onDeleteVolunteer={deleteVolunteer}
            onUpsertCaregiver={upsertCaregiver}
            onDeleteCaregiver={deleteCaregiver}
            onUpdateSettings={updateSystemSettings}
            onFetchBackups={fetchBackups}
            onCreateBackup={createBackup}
            onRestoreBackup={restoreBackup}
            onImportBackup={importBackup}
            onDeleteBackup={deleteBackup}
          />
        )}
      </main>

      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeAlertCount={activeAlertCount}
        pendingInspectionCount={pendingInspectionCount}
      />

      {showVisitModal && (
        <VisitFormModal
          patients={state.patients}
          volunteers={state.volunteers}
          caregivers={state.caregivers}
          systemSettings={state.systemSettings}
          initialPatientId={visitModalPatientId}
          activeVolunteerId={activeVolunteer?.id ?? 'vol-1'}
          onClose={() => setShowVisitModal(false)}
          onSubmit={submitVisit}
        />
      )}
    </div>
  );
}
