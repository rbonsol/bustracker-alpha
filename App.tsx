import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BusTelemetry, LogEntry } from './types';
import { pushTelemetry, initializeFirebase } from './services/dataService';
import { DEFAULT_CONFIG } from './services/firebaseConfig';
import { generateAnnouncement } from './services/geminiService';
import { TelemetryCard } from './components/TelemetryCard';

// Helper to get consistent device ID
const getDeviceId = () => {
  const stored = localStorage.getItem('omni_device_id');
  if (stored) return stored;
  const newId = uuidv4();
  localStorage.setItem('omni_device_id', newId);
  return newId;
};

// Helper to get stored config or return default
const getStoredConfig = () => {
  try {
    const stored = localStorage.getItem('omni_firebase_config');
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error("Failed to parse stored config", e);
  }
  return DEFAULT_CONFIG;
};

const App: React.FC = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [deviceId] = useState(getDeviceId());
  
  // Metrics
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [isCharging, setIsCharging] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [lastSentTime, setLastSentTime] = useState<string>("-");
  const [statusMessage, setStatusMessage] = useState<string>("Ready to start");
  const [statusType, setStatusType] = useState<'normal' | 'error' | 'success'>('normal');

  // AI & Modals
  const [incidentText, setIncidentText] = useState("");
  const [generatedMsg, setGeneratedMsg] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  // Config
  const [fbConfig, setFbConfig] = useState(getStoredConfig());

  // Use ReturnType<typeof setInterval> for environment-agnostic typing
  const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize Firebase on mount or config change
  useEffect(() => {
    const error = initializeFirebase(fbConfig as any);
    if (error) {
      setStatusMessage(`DB Error: ${error}`);
      setStatusType('error');
    } else {
      // Only set ready if we aren't already tracking or showing another status
      if (!isTracking) {
        setStatusMessage("Connected to DB");
        setStatusType('success');
        setTimeout(() => {
           setStatusMessage("Ready to start");
           setStatusType('normal');
        }, 2000);
      }
    }
  }, [fbConfig, isTracking]);

  const saveConfig = () => {
    localStorage.setItem('omni_firebase_config', JSON.stringify(fbConfig));
    setShowConfigModal(false);
    setStatusMessage("Config Saved");
    setTimeout(() => setStatusMessage("Ready to start"), 1500);
  };

  // Battery Monitor
  useEffect(() => {
    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        const updateBattery = () => {
          setBatteryLevel(battery.level * 100);
          setIsCharging(battery.charging);
        };
        updateBattery();
        battery.onlevelchange = updateBattery;
        battery.onchargingchange = updateBattery;
      });
    }
  }, []);

  // Main Tracking Loop
  const collectAndSendTelemetry = useCallback(async () => {
    if (!navigator.geolocation) {
      setStatusMessage("GPS not supported");
      setStatusType('error');
      return;
    }

    setStatusMessage("Acquiring GPS...");
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, speed, heading } = position.coords;
        setLastLocation({ lat: latitude, lng: longitude });
        setCurrentSpeed(speed || 0);

        const telemetry: BusTelemetry = {
          deviceId,
          timestamp: Date.now(),
          latitude,
          longitude,
          speed,
          heading,
          batteryLevel: batteryLevel / 100,
          isCharging
        };

        setStatusMessage("Syncing...");
        
        try {
          const success = await pushTelemetry(telemetry);
          if (success) {
            setSentCount(prev => prev + 1);
            setLastSentTime(new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            setStatusMessage("Data Synced");
            setStatusType('success');
            // Clear success message after 2s
            setTimeout(() => {
                setStatusMessage("Tracking Active");
                setStatusType('normal');
            }, 2000);
          } else {
            setStatusMessage("Sync Failed (Retrying)");
            setStatusType('error');
          }
        } catch (e) {
          setStatusMessage("Network Error");
          setStatusType('error');
        }
      },
      (error) => {
        setStatusMessage(`GPS Error: ${error.message}`);
        setStatusType('error');
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, [batteryLevel, deviceId, isCharging]);

  // Start/Stop Logic
  useEffect(() => {
    if (isTracking) {
      // Send immediately on start
      collectAndSendTelemetry();
      // Then every 10 seconds strict
      trackingIntervalRef.current = setInterval(collectAndSendTelemetry, 10000);
    } else {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
        setStatusMessage("Tracking Paused");
        setStatusType('normal');
      }
    }

    return () => {
      if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
    };
  }, [isTracking, collectAndSendTelemetry]);


  // AI Handler
  const handleAiGeneration = async () => {
    if (!incidentText.trim()) return;
    setIsGenerating(true);
    setGeneratedMsg("");
    
    const contextStr = lastLocation 
      ? `${lastLocation.lat.toFixed(4)}, ${lastLocation.lng.toFixed(4)}` 
      : "Unknown Location";
      
    const result = await generateAnnouncement(incidentText, {
      speed: (currentSpeed || 0) * 3.6,
      location: contextStr
    });
    
    setGeneratedMsg(result);
    setIsGenerating(false);
  };

  return (
    <div className="h-screen w-full bg-slate-950 flex flex-col overflow-hidden relative">
      
      {/* App Bar */}
      <div className="flex-none bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center z-10">
        <div>
           <div className="text-xs text-slate-500 font-mono tracking-widest uppercase">Driver App</div>
           <div className="font-bold text-slate-100 text-lg flex items-center gap-2">
             OmniTrack
             <span className="text-emerald-500 text-xs bg-emerald-950 px-2 py-0.5 rounded border border-emerald-900">ANDROID</span>
           </div>
        </div>
        <button onClick={() => setShowConfigModal(true)} className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700">
          <i className="fas fa-cog"></i>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col p-4 space-y-4 overflow-y-auto">
        
        {/* Status Banner */}
        <div className={`flex items-center justify-between p-3 rounded-lg border ${
            statusType === 'error' ? 'bg-red-900/20 border-red-800/50 text-red-400' :
            statusType === 'success' ? 'bg-emerald-900/20 border-emerald-800/50 text-emerald-400' :
            'bg-slate-900 border-slate-800 text-slate-400'
        } transition-colors duration-300`}>
             <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isTracking ? 'animate-pulse bg-emerald-500' : 'bg-slate-600'}`}></div>
                <span className="font-mono text-sm font-bold uppercase truncate max-w-[200px]">{statusMessage}</span>
             </div>
             <div className="text-xs font-mono opacity-70 flex-shrink-0">{isTracking ? 'NEXT UPDATE: 10s' : 'IDLE'}</div>
        </div>

        {/* Speedometer (Hero Metric) */}
        <div className="flex-none bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col items-center justify-center py-10">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Current Speed</div>
            <div className="flex items-baseline gap-2">
                <span className="text-7xl font-mono font-bold text-white tracking-tighter">
                    {((currentSpeed || 0) * 3.6).toFixed(0)}
                </span>
                <span className="text-xl text-slate-500 font-medium">KM/H</span>
            </div>
        </div>

        {/* Secondary Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
             <TelemetryCard 
                label="Last Sync" 
                value={lastSentTime} 
                icon="fa-clock" 
                unit=""
                color="default"
            />
            <TelemetryCard 
                label="Battery" 
                value={Math.round(batteryLevel)} 
                unit="%" 
                icon={isCharging ? "fa-bolt" : "fa-battery-half"} 
                color={batteryLevel < 20 ? 'danger' : 'success'} 
            />
            <TelemetryCard 
                label="Lat" 
                value={lastLocation?.lat.toFixed(4) || '--'} 
                icon="fa-map-marker-alt" 
                color="default"
            />
            <TelemetryCard 
                label="Lng" 
                value={lastLocation?.lng.toFixed(4) || '--'} 
                icon="fa-map-pin" 
                color="default"
            />
        </div>

      </div>

      {/* Footer Controls */}
      <div className="flex-none p-4 pb-8 bg-slate-900 border-t border-slate-800 flex flex-col gap-3">
          
          <button
            onClick={() => setIsTracking(!isTracking)}
            className={`w-full py-5 rounded-xl font-bold text-xl shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-3 ${
                isTracking 
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-900/20' 
                : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-900/20'
            }`}
            >
            <i className={`fas ${isTracking ? 'fa-stop-circle' : 'fa-play-circle'} text-2xl`}></i>
            {isTracking ? 'STOP TRACKING' : 'START ROUTE'}
          </button>

          <button
            onClick={() => setShowIncidentModal(true)}
            className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700 transition flex items-center justify-center gap-2"
          >
            <i className="fas fa-bullhorn text-amber-400"></i>
            Broadcast Incident
          </button>
      </div>

      {/* Incident Modal (Mobile Friendly) */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border-t sm:border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 pb-10 sm:pb-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <i className="fas fa-robot text-emerald-400"></i> AI Assistant
                </h2>
                <button onClick={() => setShowIncidentModal(false)} className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              {!generatedMsg ? (
                  <>
                    <p className="text-slate-400 text-sm mb-3">What's happening?</p>
                    <textarea
                        value={incidentText}
                        onChange={(e) => setIncidentText(e.target.value)}
                        placeholder="e.g. Flat tire, traffic delayed 10m..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-white text-lg focus:border-emerald-500 focus:outline-none min-h-[120px] mb-4"
                    />
                    <button
                        onClick={handleAiGeneration}
                        disabled={isGenerating || !incidentText}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-lg"
                    >
                        {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : 'Generate Alert'}
                    </button>
                  </>
              ) : (
                  <div className="space-y-4">
                      <div className="bg-emerald-900/20 border border-emerald-900/50 p-4 rounded-lg">
                        <p className="text-emerald-100 text-lg leading-relaxed">"{generatedMsg}"</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => {
                            navigator.clipboard.writeText(generatedMsg);
                            setShowIncidentModal(false);
                            setGeneratedMsg("");
                            setStatusMessage("Copied to Clipboard");
                            setStatusType("success");
                            }}
                            className="py-3 bg-slate-800 text-white rounded-lg font-semibold"
                        >
                            Copy
                        </button>
                        <button 
                             onClick={() => setGeneratedMsg("")}
                             className="py-3 bg-emerald-600 text-slate-900 rounded-lg font-bold"
                        >
                            New
                        </button>
                      </div>
                  </div>
              )}
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
           <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-6">
              <h3 className="text-white font-bold mb-4">Firebase Config</h3>
              <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Database URL (Required)</label>
                    <input className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white" placeholder="https://..." value={fbConfig.databaseURL} onChange={e => setFbConfig({...fbConfig, databaseURL: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">API Key (Required)</label>
                    <input className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white" placeholder="AIza..." value={fbConfig.apiKey} onChange={e => setFbConfig({...fbConfig, apiKey: e.target.value})} />
                  </div>
                   <div>
                    <label className="text-xs text-slate-500 block mb-1">Project ID (Optional)</label>
                    <input className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white" placeholder="my-project-id" value={fbConfig.projectId} onChange={e => setFbConfig({...fbConfig, projectId: e.target.value})} />
                  </div>
              </div>
              <div className="flex justify-end gap-2">
                  <button onClick={() => setShowConfigModal(false)} className="px-4 py-2 text-slate-400">Cancel</button>
                  <button onClick={saveConfig} className="px-4 py-2 bg-emerald-600 text-white rounded">Save & Connect</button>
              </div>
              <p className="text-xs text-slate-600 mt-2">Configuration is saved to your browser.</p>
           </div>
        </div>
      )}

    </div>
  );
};

export default App;