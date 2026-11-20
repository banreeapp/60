import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import type { CarePatient, CareVisitLog, VolunteerProfile } from '../types';

interface WeeklyAnalyticsChartsProps {
  patients: CarePatient[];
  visitLogs: CareVisitLog[];
  volunteers: VolunteerProfile[];
  selectedVolunteerId: string;
}

const TRIAGE_COLORS = {
  normal: '#0d9488',
  watch: '#d97706',
  critical: '#dc2626',
} as const;

const INSPECTION_COLORS = {
  approved: '#0d9488',
  pending: '#64748b',
  revision: '#d97706',
} as const;

export function WeeklyAnalyticsCharts({
  patients,
  visitLogs,
  volunteers,
  selectedVolunteerId,
}: WeeklyAnalyticsChartsProps) {
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [rightChartMode, setRightChartMode] = useState<'triage' | 'volunteer'>('triage');

  const scopedVisits = useMemo(() => {
    if (scope === 'selected' && selectedVolunteerId) {
      return visitLogs.filter((v) => v.volunteerId === selectedVolunteerId);
    }
    return visitLogs;
  }, [visitLogs, scope, selectedVolunteerId]);

  const scopedPatients = useMemo(() => {
    if (scope === 'selected' && selectedVolunteerId) {
      return patients.filter((p) => p.assignedVolunteerId === selectedVolunteerId);
    }
    return patients;
  }, [patients, scope, selectedVolunteerId]);

  const weeklyVisitData = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayMs = 86_400_000;

    const buckets = [
      { key: 'w4', label: '3 สัปดาห์ก่อน', minDaysAgo: 21, maxDaysAgo: 27, normal: 0, watch: 0, critical: 0, total: 0 },
      { key: 'w3', label: '2 สัปดาห์ก่อน', minDaysAgo: 14, maxDaysAgo: 20, normal: 0, watch: 0, critical: 0, total: 0 },
      { key: 'w2', label: 'สัปดาห์ที่แล้ว', minDaysAgo: 7, maxDaysAgo: 13, normal: 0, watch: 0, critical: 0, total: 0 },
      { key: 'w1', label: 'สัปดาห์นี้', minDaysAgo: 0, maxDaysAgo: 6, normal: 0, watch: 0, critical: 0, total: 0 },
    ];

    for (const log of scopedVisits) {
      const logTime = new Date(log.visitDate).getTime();
      const logDayStart = new Date(
        new Date(logTime).getFullYear(),
        new Date(logTime).getMonth(),
        new Date(logTime).getDate()
      ).getTime();
      const daysAgo = Math.max(0, Math.floor((startOfToday - logDayStart) / dayMs));

      const bucket = buckets.find((b) => daysAgo >= b.minDaysAgo && daysAgo <= b.maxDaysAgo);
      if (bucket) {
        bucket[log.triageLevel] += 1;
        bucket.total += 1;
      }
    }

    return buckets;
  }, [scopedVisits]);

  const patientTriageData = useMemo(() => {
    const counts = { normal: 0, watch: 0, critical: 0 };
    for (const p of scopedPatients) {
      counts[p.triageLevel] += 1;
    }
    return [
      { key: 'critical', name: 'วิกฤต / แจ้งเตือนด่วน', value: counts.critical, color: TRIAGE_COLORS.critical },
      { key: 'watch', name: 'เฝ้าระวังอาการ', value: counts.watch, color: TRIAGE_COLORS.watch },
      { key: 'normal', name: 'อาการปกติ', value: counts.normal, color: TRIAGE_COLORS.normal },
    ];
  }, [scopedPatients]);

  const volunteerComparisonData = useMemo(() => {
    return volunteers.map((vol) => {
      const logs = visitLogs.filter((v) => v.volunteerId === vol.id);
      const shortName = vol.name.split(' ')[0] || vol.name;
      return {
        name: shortName,
        fullName: vol.name,
        approved: logs.filter((v) => v.inspectionStatus === 'approved').length,
        pending: logs.filter((v) => v.inspectionStatus === 'pending').length,
        revision: logs.filter((v) => v.inspectionStatus === 'revision').length,
      };
    });
  }, [volunteers, visitLogs]);

  const totalPatients = scopedPatients.length;
  const totalWeeklyVisits = weeklyVisitData.reduce((acc, w) => acc + w.total, 0);
  const selectedVolunteerName =
    volunteers.find((v) => v.id === selectedVolunteerId)?.name ?? 'อสพ. ที่เลือก';

  return (
    <section aria-label="กราฟสรุปผลรายสัปดาห์และการวิเคราะห์แนวโน้ม" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
            วิเคราะห์แนวโน้มการดูแลรายสัปดาห์
          </h2>
          <p className="text-xs text-slate-500">
            ติดตามจำนวนการเยี่ยมบ้าน 4 สัปดาห์ล่าสุด และสัดส่วนความรุนแรงของผู้ป่วยแบบเรียลไทม์
          </p>
        </div>

        <div className="no-print flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setScope('all')}
            className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              scope === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ภาพรวมทั้ง รพ.สต.
          </button>
          <button
            type="button"
            onClick={() => setScope('selected')}
            className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              scope === 'selected'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            เฉพาะ {selectedVolunteerName}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 cols: Weekly Home Visits Stacked Bar Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                จำนวนการเยี่ยมบ้านของ อสพ. รายสัปดาห์
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                แยกตามผลประเมินอาการรายครั้ง (รวม 4 สัปดาห์:{' '}
                <span className="font-mono-tabular font-semibold text-slate-800">
                  {totalWeeklyVisits}
                </span>{' '}
                ครั้ง)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-teal-600" />
                ปกติ
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-600" />
                เฝ้าระวัง
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-600" />
                วิกฤต
              </span>
            </div>
          </div>

          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyVisitData}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                barSize={36}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#475569', fontSize: 12 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#e2e8f0',
                    fontSize: '12px',
                  }}
                  formatter={(value, name) => {
                    const labelMap: Record<string, string> = {
                      normal: 'ปกติ',
                      watch: 'เฝ้าระวัง',
                      critical: 'วิกฤต',
                    };
                    return [`${value} ครั้ง`, labelMap[String(name)] ?? String(name)];
                  }}
                />
                <Bar dataKey="normal" stackId="visits" fill={TRIAGE_COLORS.normal} radius={[0, 0, 0, 0]} />
                <Bar dataKey="watch" stackId="visits" fill={TRIAGE_COLORS.watch} radius={[0, 0, 0, 0]} />
                <Bar dataKey="critical" stackId="visits" fill={TRIAGE_COLORS.critical} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 5 cols: Patient Severity Breakdown OR Volunteer Acceptance Comparison */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {rightChartMode === 'triage'
                  ? 'จำนวนผู้ป่วยแยกตามระดับความรุนแรง'
                  : 'สรุปผลการตรวจรับงานราย อสพ.'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {rightChartMode === 'triage'
                  ? `ผู้ป่วยในการดูแลทั้งหมด ${totalPatients} ราย`
                  : 'เปรียบเทียบจำนวนครั้งที่อนุมัติ / รอตรวจรับ / ส่งแก้ไข'}
              </p>
            </div>

            <div className="no-print flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setRightChartMode('triage')}
                aria-label="ดูสัดส่วนระดับความรุนแรงผู้ป่วย"
                className={`min-h-[32px] min-w-[32px] px-2 flex items-center justify-center rounded-md transition-colors ${
                  rightChartMode === 'triage'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <PieChartIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setRightChartMode('volunteer')}
                aria-label="ดูสรุปการตรวจรับงานราย อสพ."
                className={`min-h-[32px] min-w-[32px] px-2 flex items-center justify-center rounded-md transition-colors ${
                  rightChartMode === 'volunteer'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {rightChartMode === 'triage' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
              <div className="relative h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={patientTriageData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {patientTriageData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        borderColor: '#e2e8f0',
                        fontSize: '12px',
                      }}
                      formatter={(value) => [`${value} ราย`, 'จำนวนผู้ป่วย']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono-tabular text-2xl font-bold text-slate-900">
                    {totalPatients}
                  </span>
                  <span className="text-[11px] text-slate-500">ผู้ป่วย (ราย)</span>
                </div>
              </div>

              <div className="space-y-3">
                {patientTriageData.map((item) => {
                  const pct =
                    totalPatients > 0 ? Math.round((item.value / totalPatients) * 100) : 0;
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs font-medium text-slate-700 truncate">
                          {item.name}
                        </span>
                      </div>
                      <div className="text-right font-mono-tabular text-xs shrink-0">
                        <span className="font-bold text-slate-900">{item.value} ราย</span>
                        <span className="text-slate-400 ml-1">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-teal-600" />
                  ตรวจรับแล้ว
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-500" />
                  รอตรวจรับ
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-600" />
                  ส่งกลับแก้ไข
                </span>
              </div>
              <div className="w-full h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={volunteerComparisonData}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                    barSize={28}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#475569', fontSize: 12 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{
                        borderRadius: '12px',
                        borderColor: '#e2e8f0',
                        fontSize: '12px',
                      }}
                      formatter={(value, name) => {
                        const map: Record<string, string> = {
                          approved: 'ตรวจรับแล้ว',
                          pending: 'รอตรวจรับ',
                          revision: 'ส่งกลับแก้ไข',
                        };
                        return [`${value} ครั้ง`, map[String(name)] ?? String(name)];
                      }}
                    />
                    <Bar dataKey="approved" stackId="insp" fill={INSPECTION_COLORS.approved} />
                    <Bar dataKey="pending" stackId="insp" fill={INSPECTION_COLORS.pending} />
                    <Bar
                      dataKey="revision"
                      stackId="insp"
                      fill={INSPECTION_COLORS.revision}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
