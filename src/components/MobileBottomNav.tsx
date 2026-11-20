import { BellRing, Users, ClipboardCheck, FileSpreadsheet, Settings } from 'lucide-react';
import type { ActiveTab } from '../types';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  activeAlertCount: number;
  pendingInspectionCount: number;
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  activeAlertCount,
  pendingInspectionCount,
}: MobileBottomNavProps) {
  const tabs: {
    id: ActiveTab;
    label: string;
    icon: typeof BellRing;
    badge?: number;
  }[] = [
    { id: 'realtime', label: 'แจ้งเตือน', icon: BellRing, badge: activeAlertCount },
    { id: 'patients', label: 'ผู้ป่วย', icon: Users },
    { id: 'inspection', label: 'ตรวจรับงาน', icon: ClipboardCheck, badge: pendingInspectionCount },
    { id: 'report', label: 'รายงาน', icon: FileSpreadsheet },
    { id: 'settings', label: 'ตั้งค่า', icon: Settings },
  ];

  return (
    <nav
      aria-label="แถบนำทางมือถือ"
      className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200"
    >
      <div className="grid grid-cols-5 h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex flex-col items-center justify-center min-h-[44px] px-1 transition-colors ${
                isActive ? 'text-teal-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 1.8} />
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white font-mono-tabular text-[10px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
