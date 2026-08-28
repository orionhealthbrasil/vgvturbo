import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { useAvailability, useReplaceAvailability } from '@/hooks/useAvailability';
import { DAYS_OF_WEEK } from '@/types/booking';

interface Window {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export function AvailabilityEditor({ calendarId }: { calendarId: string }) {
  const { data: existing } = useAvailability(calendarId);
  const replace = useReplaceAvailability();
  const [windows, setWindows] = useState<Window[]>([]);

  useEffect(() => {
    if (existing) {
      setWindows(existing.map((w) => ({
        day_of_week: w.day_of_week,
        start_time: w.start_time.slice(0, 5),
        end_time: w.end_time.slice(0, 5),
      })));
    }
  }, [existing]);

  const addWindow = (day: number) => {
    setWindows((w) => [...w, { day_of_week: day, start_time: '09:00', end_time: '18:00' }]);
  };

  const updateWindow = (idx: number, patch: Partial<Window>) => {
    setWindows((w) => w.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };

  const removeWindow = (idx: number) => {
    setWindows((w) => w.filter((_, i) => i !== idx));
  };

  const save = () => {
    replace.mutate({
      calendar_id: calendarId,
      windows: windows.map((w) => ({
        day_of_week: w.day_of_week,
        start_time: `${w.start_time}:00`,
        end_time: `${w.end_time}:00`,
      })),
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {DAYS_OF_WEEK.map((day) => {
          const dayWindows = windows
            .map((w, idx) => ({ w, idx }))
            .filter(({ w }) => w.day_of_week === day.value);
          return (
            <div key={day.value} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{day.label}</span>
                <Button size="sm" variant="ghost" onClick={() => addWindow(day.value)}>
                  <Plus className="w-4 h-4 mr-1" /> Faixa
                </Button>
              </div>
              {dayWindows.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem disponibilidade</p>
              ) : (
                <div className="space-y-2">
                  {dayWindows.map(({ w, idx }) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={w.start_time}
                        onChange={(e) => updateWindow(idx, { start_time: e.target.value })}
                        className="w-28"
                      />
                      <span>—</span>
                      <Input
                        type="time"
                        value={w.end_time}
                        onChange={(e) => updateWindow(idx, { end_time: e.target.value })}
                        className="w-28"
                      />
                      <Button size="icon" variant="ghost" onClick={() => removeWindow(idx)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Button onClick={save} disabled={replace.isPending}>Salvar disponibilidade</Button>
    </div>
  );
}
