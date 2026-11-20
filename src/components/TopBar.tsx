import { Plus } from 'lucide-react';
import type { ActiveTab } from '../types';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onNewVisit: () => void;
  activeAlertCount: number;
  pendingInspectionCount: number;
}

export function TopBar({
  activeTab,
  onSelectTab,
  onNewVisit,
  activeAlertCount,
  pendingInspectionCount,
}: TopBarProps) {
  const navItems: { id: ActiveTab; label: string; count?: number }[] = [
    { id: 'realtime', label: 'แจ้งเตือนเรียลไทม์', count: activeAlertCount },
    { id: 'patients', label: 'ผู้ป่วยในการดูแล' },
    { id: 'inspection', label: 'ตรวจรับงาน', count: pendingInspectionCount },
    { id: 'report', label: 'รายงานสรุป' },
    { id: 'settings', label: 'ตั้งค่าระบบ' },
  ];

  return (
    <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onSelectTab('realtime')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
        >
          อสพ. CareConnect
        </button>

        <nav className="hidden md:flex items-center gap-6" aria-label="เมนูหลัก">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded ${
                  isActive
                    ? 'text-teal-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{item.label}</span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="ml-1.5 font-mono-tabular text-xs font-semibold text-rose-700">
                    ({item.count})
                  </span>
                )}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-[1px] h-0.5 bg-teal-700 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onNewVisit}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 active:scale-[0.99] rounded-xl transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-700"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>บันทึกการเยี่ยม</span>
          </button>
        </div>
      </div>
    </header>
  );
}
