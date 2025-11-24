import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface StatusLogProps {
  logs: LogEntry[];
}

export const StatusLog: React.FC<StatusLogProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col h-64">
      <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Log</h3>
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2 scrollbar-hide">
        {logs.length === 0 && (
          <div className="text-slate-600 italic text-center mt-10">Waiting for trip to start...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3">
            <span className="text-slate-600 shrink-0">
              {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={`${
              log.type === 'error' ? 'text-red-400' :
              log.type === 'success' ? 'text-emerald-400' :
              log.type === 'warning' ? 'text-amber-400' :
              'text-slate-300'
            }`}>
              {log.type === 'success' && '✓ '}
              {log.type === 'error' && '✕ '}
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};