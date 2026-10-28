
/**
 * Final ShiftFlow - Production Roster v1.0.1
 * Cloud-synchronized production roster application
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { GeminiChatbot } from './components/GeminiChatbot';
import { PersonalReportModal } from './components/PersonalReportModal';
import { DataManagement } from './components/DataManagement';
import { ProcessSettings } from './components/ProcessSettings';
import { PWAInstallButton, UserSettingsButton, OfflineIndicator } from './components/AndroidAppModal';
import { SCHEDULE_DATA, INITIAL_PERSONNEL } from './constants';
import { INITIAL_STAFF, generateNextMonth, getDaysInPersianMonth, validateSwap } from './utils/scheduler';
import { ShiftEntry, Personnel, AppData, PublishedRange, DailyProcessMap, ProcessDefinition } from './types';
import { Settings, Plus, Trash2, Save, ArrowUp, ArrowDown, UserCog, Users, ArrowRightLeft, AlertCircle, AlertTriangle, CheckCircle2, Edit, Calendar as CalendarIcon, List, Table as TableIcon, Check, Lock, X, KeyRound, CalendarPlus, Crown, LogOut, ShieldCheck, Palette, Cloud, CloudUpload, Wifi, RefreshCw, UserPlus, Sun, Moon, Sparkles, FlaskConical, Server, SlidersHorizontal } from 'lucide-react';
import { getTodayPersianParts, getDayNameForJalali, toPersianDigits, getNextJalaliDate } from './utils/persianDate';
import { getNextPersonnelColor, getPersonColor, ensureUniquePersonnelColors, upgradeToVibrantPersonnel } from './utils/personnelColors';
import { subscribeToCloudRoster, saveCloudRoster, resetCloudRoster, subscribeSyncStatus, SyncStatusDetails } from './utils/firebase';
import { unifyPersonnelAndShifts } from './utils/customFormatHandler';
import { DEFAULT_PROCESS_DEFINITIONS, generateFullBioprocessCampaign } from './utils/bioprocessData';

const MONTHS = [
    { name: 'فروردین', code: '01' },
    { name: 'اردیبهشت', code: '02' },
    { name: 'خرداد', code: '03' },
    { name: 'تیر', code: '04' },
    { name: 'مرداد', code: '05' },
    { name: 'شهریور', code: '06' },
    { name: 'مهر', code: '07' },
    { name: 'آبان', code: '08' },
    { name: 'آذر', code: '09' },
    { name: 'دی', code: '10' },
    { name: 'بهمن', code: '11' },
    { name: 'اسفند', code: '12' }
];

const STORAGE_KEYS = {
  SCHEDULE: 'shiftflow_schedule_v2',
  PERSONNEL: 'shiftflow_personnel_v2',
  LOCKED: 'shiftflow_locked_v2',
  PASSWORD: 'shiftflow_admin_password',
  PUBLISHED_RANGE: 'shiftflow_published_range_v2',
  IS_OWNER: 'shiftflow_is_owner_authenticated',
  DAILY_PROCESSES: 'shiftflow_daily_processes_v2',
  PROCESS_DEFINITIONS: 'shiftflow_process_definitions_v2',
  SHOW_PROCESS_SCHEDULE: 'shiftflow_show_process_schedule_v2',
  SETTINGS_SUBTAB: 'shiftflow_settings_subtab_v2',
  UPDATED_AT: 'shiftflow_updated_at'
};

const App: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const [showAiAssistant, setShowAiAssistant] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('shiftflow_show_ai_assistant');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [settingsSubTab, setSettingsSubTab] = useState<'general' | 'shifts' | 'processes'>(() => {
    try {
      const saved = localStorage.getItem('shiftflow_settings_subtab_v2');
      if (saved === 'general' || saved === 'shifts' || saved === 'processes') {
        return saved;
      }
      return 'general';
    } catch {
      return 'general';
    }
  });

  const handleSelectSettingsSubTab = (tab: 'general' | 'shifts' | 'processes') => {
    setSettingsSubTab(tab);
    try {
      localStorage.setItem('shiftflow_settings_subtab_v2', tab);
    } catch (e) {
      console.error(e);
    }
  };

  // --- PERSISTENCE LAYER ---
  const [schedule, setSchedule] = useState<ShiftEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SCHEDULE);
      let list: ShiftEntry[] = saved ? JSON.parse(saved) : SCHEDULE_DATA;

      // Filter out all 1404 entries
      list = list.filter(s => !s.date.startsWith('1404'));

      // If empty after 1404 purge, fallback to clean SCHEDULE_DATA
      if (list.length === 0) {
        list = SCHEDULE_DATA;
      }

      // Always guarantee each entry's dayName is strictly mathematically accurate for the Iranian calendar
      list = list.map(entry => {
        const parts = entry.date.split('/');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const d = parseInt(parts[2], 10);
          if (y && m && d) {
            const correctDay = getDayNameForJalali(y, m, d);
            if (entry.dayName !== correctDay) {
              return { ...entry, dayName: correctDay };
            }
          }
        }
        return entry;
      });

      return list;
    } catch (error) {
      console.error("Failed to load schedule from storage", error);
      return SCHEDULE_DATA;
    }
  });
  
  const [personnelList, setPersonnelList] = useState<Personnel[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PERSONNEL);
      const list: Personnel[] = saved ? JSON.parse(saved) : INITIAL_PERSONNEL;
      const { updated } = upgradeToVibrantPersonnel(list);
      const { unifiedPersonnel } = unifyPersonnelAndShifts([], updated, []);
      return unifiedPersonnel;
    } catch (error) {
      console.error("Failed to load personnel from storage", error);
      return INITIAL_PERSONNEL;
    }
  });

  const [unlockedMonths, setUnlockedMonths] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOCKED);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      return [];
    }
  }); // Format: YYYY/MM

  // --- OWNER & AUTHENTICATION STATE ---
  const [adminPassword, setAdminPassword] = useState(() => {
      return localStorage.getItem(STORAGE_KEYS.PASSWORD) || '1234';
  });
  const [isOwner, setIsOwner] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.IS_OWNER) === 'true';
    } catch {
      return false;
    }
  });
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.IS_OWNER) === 'true';
    } catch {
      return false;
    }
  });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [settingsPassword, setSettingsPassword] = useState('');
  const [intendedTab, setIntendedTab] = useState<'dashboard' | 'settings'>('dashboard');

  // --- PUBLISHED RANGE STATE (Owner designated range visible to everyone) ---
  const [publishedRange, setPublishedRange] = useState<PublishedRange | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PUBLISHED_RANGE);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleSavePublishedRange = (range: PublishedRange | null) => {
    setPublishedRange(range);
    if (range && range.isActive) {
      localStorage.setItem(STORAGE_KEYS.PUBLISHED_RANGE, JSON.stringify(range));
    } else {
      localStorage.removeItem(STORAGE_KEYS.PUBLISHED_RANGE);
    }
    saveCloudRoster({ publishedRange: range }).catch(console.error);
  };

  // --- DAILY BIOPROCESSES & BIOREACTOR TASKS STATE ---
  const [dailyProcesses, setDailyProcesses] = useState<DailyProcessMap>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DAILY_PROCESSES);
      if (saved) return JSON.parse(saved);
      return generateFullBioprocessCampaign('1405/05/26');
    } catch {
      return generateFullBioprocessCampaign('1405/05/26');
    }
  });

  const [processDefinitions, setProcessDefinitions] = useState<ProcessDefinition[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROCESS_DEFINITIONS);
      if (saved) return JSON.parse(saved);
      return DEFAULT_PROCESS_DEFINITIONS;
    } catch {
      return DEFAULT_PROCESS_DEFINITIONS;
    }
  });

  const handleSaveDailyProcesses = (updated: DailyProcessMap) => {
    setDailyProcesses(updated);
    const now = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEYS.DAILY_PROCESSES, JSON.stringify(updated));
      localStorage.setItem(STORAGE_KEYS.UPDATED_AT, now);
    } catch (e) {
      console.error('LocalStorage error', e);
    }
    setSyncStatus('syncing');
    saveCloudRoster({
      schedule,
      personnelList,
      unlockedMonths,
      publishedRange,
      adminPassword,
      dailyProcesses: updated,
      processDefinitions,
      showProcessSchedule
    })
      .then(() => setSyncStatus('synced'))
      .catch((e) => {
        console.warn('Process save error:', e);
        setSyncStatus('synced');
      });
  };

  const handleSaveProcessDefinitions = (updated: ProcessDefinition[]) => {
    setProcessDefinitions(updated);
    const now = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEYS.PROCESS_DEFINITIONS, JSON.stringify(updated));
      localStorage.setItem(STORAGE_KEYS.UPDATED_AT, now);
    } catch (e) {
      console.error('LocalStorage error', e);
    }
    setSyncStatus('syncing');
    saveCloudRoster({
      schedule,
      personnelList,
      unlockedMonths,
      publishedRange,
      adminPassword,
      dailyProcesses,
      processDefinitions: updated,
      showProcessSchedule
    })
      .then(() => setSyncStatus('synced'))
      .catch(() => setSyncStatus('synced'));
  };

  // --- PROCESS SCHEDULE DISPLAY TOGGLE (Dashboard Visibility) ---
  const [showProcessSchedule, setShowProcessSchedule] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SHOW_PROCESS_SCHEDULE);
      if (saved !== null) return saved === 'true';
      return true; // Default: enabled
    } catch {
      return true;
    }
  });

  const handleToggleProcessSchedule = (enabled: boolean) => {
    setShowProcessSchedule(enabled);
    const now = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEYS.SHOW_PROCESS_SCHEDULE, String(enabled));
      localStorage.setItem(STORAGE_KEYS.UPDATED_AT, now);
    } catch (e) {
      console.error('LocalStorage error', e);
    }
    setSyncStatus('syncing');
    saveCloudRoster({
      schedule,
      personnelList,
      unlockedMonths,
      publishedRange,
      adminPassword,
      dailyProcesses,
      processDefinitions,
      showProcessSchedule: enabled
    })
      .then(() => setSyncStatus('synced'))
      .catch(() => setSyncStatus('synced'));

    setSaveNotice({
      type: 'success',
      message: enabled
        ? 'برنامه و جدول پروسه‌ها در داشبورد فعال شد.'
        : 'برنامه پروسه‌ها از داشبورد برداشته شد (کلیه اطلاعات محفوظ هستند).'
    });
    setTimeout(() => setSaveNotice(null), 3500);
  };

  // --- CHANGE PASSWORD MODAL STATE ---
  const [isChangePwdOpen, setChangePwdOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' });

  // --- ADD PERSONNEL UI TOGGLE STATE ---
  const [isAddingShiftPerson, setIsAddingShiftPerson] = useState(false);
  const [isAddingSupervisor, setIsAddingSupervisor] = useState(false);

  const handleUnlockSettings = () => {
    if (settingsPassword === adminPassword) {
        setIsOwner(true);
        setIsSettingsUnlocked(true);
        setShowAiAssistant(true);
        try {
          localStorage.setItem(STORAGE_KEYS.IS_OWNER, 'true');
          localStorage.setItem('shiftflow_show_ai_assistant', 'true');
        } catch (e) {
          console.error(e);
        }
        setSettingsPassword('');
        setIsPasswordModalOpen(false);
        if (intendedTab === 'settings') {
          setActiveTab('settings');
        }
        setIntendedTab('dashboard');
    } else {
        alert('رمز عبور اشتباه است.');
    }
  };

  const handleLogoutOwner = () => {
    setIsOwner(false);
    setIsSettingsUnlocked(false);
    setActiveTab('dashboard');
    try {
      localStorage.removeItem(STORAGE_KEYS.IS_OWNER);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClosePasswordModal = () => {
      setIsPasswordModalOpen(false);
      setSettingsPassword('');
      setIntendedTab('dashboard');
  };

  const handleChangePassword = () => {
      if (pwdForm.current !== adminPassword) {
          alert('رمز عبور فعلی اشتباه است.');
          return;
      }
      if (pwdForm.new.length < 4) {
          alert('رمز عبور باید حداقل ۴ کاراکتر باشد.');
          return;
      }
      if (pwdForm.new !== pwdForm.confirm) {
          alert('تکرار رمز عبور با رمز جدید مطابقت ندارد.');
          return;
      }

      setAdminPassword(pwdForm.new);
      localStorage.setItem(STORAGE_KEYS.PASSWORD, pwdForm.new);
      saveCloudRoster({ adminPassword: pwdForm.new }).catch(console.error);
      alert('رمز عبور با موفقیت تغییر کرد.');
      setChangePwdOpen(false);
      setPwdForm({ current: '', new: '', confirm: '' });
  };

  // --- CLOUD & SERVER DUAL SYNCHRONIZATION ---
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('syncing');
  const [syncDetails, setSyncDetails] = useState<SyncStatusDetails>({
    serverConnected: false,
    firestoreConnected: false,
    lastSyncTime: null,
    channel: 'offline',
  });
  const [isForceSyncing, setIsForceSyncing] = useState(false);

  useEffect(() => {
    const unsub = subscribeSyncStatus((details) => {
      setSyncDetails(details);
    });
    return unsub;
  }, []);

  const handleForceSync = async () => {
    setIsForceSyncing(true);
    try {
      const res = await fetch('/api/sync');
      if (res.ok) {
        const json = await res.json();
        if (json.exists && json.data) {
          const cloudData = json.data;
          if (cloudData.schedule && Array.isArray(cloudData.schedule)) {
            setSchedule(cloudData.schedule);
            localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(cloudData.schedule));
          }
          if (cloudData.personnelList && Array.isArray(cloudData.personnelList)) {
            setPersonnelList(cloudData.personnelList);
            localStorage.setItem(STORAGE_KEYS.PERSONNEL, JSON.stringify(cloudData.personnelList));
          }
          if (cloudData.unlockedMonths && Array.isArray(cloudData.unlockedMonths)) {
            setUnlockedMonths(cloudData.unlockedMonths);
            localStorage.setItem(STORAGE_KEYS.LOCKED, JSON.stringify(cloudData.unlockedMonths));
          }
          if (cloudData.publishedRange !== undefined) {
            setPublishedRange(cloudData.publishedRange);
            if (cloudData.publishedRange && cloudData.publishedRange.isActive) {
              localStorage.setItem(STORAGE_KEYS.PUBLISHED_RANGE, JSON.stringify(cloudData.publishedRange));
            } else {
              localStorage.removeItem(STORAGE_KEYS.PUBLISHED_RANGE);
            }
          }
          if (cloudData.adminPassword) {
            setAdminPassword(cloudData.adminPassword);
            localStorage.setItem(STORAGE_KEYS.PASSWORD, cloudData.adminPassword);
          }
          if (cloudData.dailyProcesses) {
            setDailyProcesses(cloudData.dailyProcesses);
            localStorage.setItem(STORAGE_KEYS.DAILY_PROCESSES, JSON.stringify(cloudData.dailyProcesses));
          }
          if (cloudData.processDefinitions) {
            setProcessDefinitions(cloudData.processDefinitions);
            localStorage.setItem(STORAGE_KEYS.PROCESS_DEFINITIONS, JSON.stringify(cloudData.processDefinitions));
          }
          if (cloudData.showProcessSchedule !== undefined) {
            setShowProcessSchedule(cloudData.showProcessSchedule);
            localStorage.setItem(STORAGE_KEYS.SHOW_PROCESS_SCHEDULE, String(cloudData.showProcessSchedule));
          }
          setSyncStatus('synced');
          setSaveNotice({
            type: 'success',
            message: 'همگام‌سازی مستقیم با سرور با موفقیت انجام شد و جدیدترین داده‌ها دریافت گردید.'
          });
          setTimeout(() => setSaveNotice(null), 4000);
        }
      }
    } catch (err) {
      console.warn('Force sync error:', err);
    } finally {
      setIsForceSyncing(false);
    }
  };

  const [isCloudLoading, setIsCloudLoading] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(STORAGE_KEYS.SCHEDULE);
    } catch {
      return true;
    }
  });
  const isRemoteUpdateRef = useRef(false);
  const isInitialLoadCompletedRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Safety fallback: Never keep the user waiting more than 1.5 seconds if network is lagging
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsCloudLoading(false);
      isInitialLoadCompletedRef.current = true;
      setSyncStatus(prev => (prev === 'syncing' ? 'synced' : prev));
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Subscribe to real-time updates from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToCloudRoster(
      (cloudData) => {
        if (isStagingPreviewRef.current) {
          console.log('Skipping cloud sync override while user is in staging preview');
          return;
        }
        isRemoteUpdateRef.current = true;

        if (cloudData.schedule && Array.isArray(cloudData.schedule) && cloudData.schedule.length > 0) {
          const non1404 = cloudData.schedule.filter(s => !s.date.startsWith('1404'));
          const cleanSchedule = non1404.length > 0 ? non1404 : SCHEDULE_DATA;
          const had1404 = cloudData.schedule.some(s => s.date.startsWith('1404'));

          // Mathematically calculate and normalize dayName for every shift based on exact Jalali date
          let hasDayNameFixes = false;
          const normalizedSchedule = cleanSchedule.map(entry => {
            const parts = entry.date.split('/');
            if (parts.length === 3) {
              const y = parseInt(parts[0], 10);
              const m = parseInt(parts[1], 10);
              const d = parseInt(parts[2], 10);
              if (y && m && d) {
                const correctDay = getDayNameForJalali(y, m, d);
                if (entry.dayName !== correctDay) {
                  hasDayNameFixes = true;
                  return { ...entry, dayName: correctDay };
                }
              }
            }
            return entry;
          });

          const cloudPersonnel = (cloudData.personnelList && Array.isArray(cloudData.personnelList) && cloudData.personnelList.length > 0) 
            ? cloudData.personnelList 
            : personnelList;
          const { updated } = upgradeToVibrantPersonnel(cloudPersonnel);
          const { unifiedShifts, unifiedPersonnel } = unifyPersonnelAndShifts(normalizedSchedule, updated, updated);
          setSchedule(unifiedShifts);
          setPersonnelList(unifiedPersonnel);
          try {
            localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(unifiedShifts));
            localStorage.setItem(STORAGE_KEYS.PERSONNEL, JSON.stringify(unifiedPersonnel));
          } catch (e) {
            console.error('LocalStorage error', e);
          }
        } else if (cloudData.personnelList && Array.isArray(cloudData.personnelList) && cloudData.personnelList.length > 0) {
          const { updated } = upgradeToVibrantPersonnel(cloudData.personnelList);
          const { unifiedPersonnel } = unifyPersonnelAndShifts([], updated, []);
          setPersonnelList(unifiedPersonnel);
          try {
            localStorage.setItem(STORAGE_KEYS.PERSONNEL, JSON.stringify(unifiedPersonnel));
          } catch (e) {
            console.error('LocalStorage error', e);
          }
        }
        if (cloudData.unlockedMonths && Array.isArray(cloudData.unlockedMonths)) {
          setUnlockedMonths(cloudData.unlockedMonths);
          try {
            localStorage.setItem(STORAGE_KEYS.LOCKED, JSON.stringify(cloudData.unlockedMonths));
          } catch (e) {
            console.error('LocalStorage error', e);
          }
        }
        if (cloudData.publishedRange !== undefined) {
          setPublishedRange(cloudData.publishedRange);
          try {
            if (cloudData.publishedRange && cloudData.publishedRange.isActive) {
              localStorage.setItem(STORAGE_KEYS.PUBLISHED_RANGE, JSON.stringify(cloudData.publishedRange));
            } else {
              localStorage.removeItem(STORAGE_KEYS.PUBLISHED_RANGE);
            }
          } catch (e) {
            console.error('LocalStorage error', e);
          }
        }
        if (cloudData.adminPassword) {
          setAdminPassword(cloudData.adminPassword);
          try {
            localStorage.setItem(STORAGE_KEYS.PASSWORD, cloudData.adminPassword);
          } catch (e) {
            console.error('LocalStorage error', e);
          }
        }
        if (cloudData.dailyProcesses) {
          setDailyProcesses(cloudData.dailyProcesses);
          try {
            localStorage.setItem(STORAGE_KEYS.DAILY_PROCESSES, JSON.stringify(cloudData.dailyProcesses));
          } catch (e) {
            console.error('LocalStorage error', e);
          }
        }
        if (cloudData.processDefinitions) {
          setProcessDefinitions(cloudData.processDefinitions);
          try {
            localStorage.setItem(STORAGE_KEYS.PROCESS_DEFINITIONS, JSON.stringify(cloudData.processDefinitions));
          } catch (e) {
            console.error('LocalStorage error', e);
          }
        }
        if (cloudData.showProcessSchedule !== undefined) {
          setShowProcessSchedule(cloudData.showProcessSchedule);
          try {
            localStorage.setItem(STORAGE_KEYS.SHOW_PROCESS_SCHEDULE, String(cloudData.showProcessSchedule));
          } catch (e) {
            console.error('LocalStorage error', e);
          }
        }

        setSyncStatus('synced');
        isInitialLoadCompletedRef.current = true;
        setIsCloudLoading(false);

        // Reset remote update lock after state propagation
        setTimeout(() => {
          isRemoteUpdateRef.current = false;
        }, 150);
      },
      // If Firestore doc does not exist yet, seed it with current local state
      () => {
        saveCloudRoster({
          schedule,
          personnelList,
          unlockedMonths,
          publishedRange,
          adminPassword,
          dailyProcesses,
          processDefinitions,
        })
          .then(() => {
            setSyncStatus('synced');
            isInitialLoadCompletedRef.current = true;
            setIsCloudLoading(false);
          })
          .catch(() => {
            setSyncStatus('offline');
            isInitialLoadCompletedRef.current = true;
            setIsCloudLoading(false);
          });
      },
      (error) => {
        console.warn('Firestore subscription offline or waiting:', error);
        setSyncStatus('offline');
        isInitialLoadCompletedRef.current = true;
        setIsCloudLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // LocalStorage backup whenever state updates
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(schedule));
      localStorage.setItem(STORAGE_KEYS.PERSONNEL, JSON.stringify(personnelList));
      localStorage.setItem(STORAGE_KEYS.LOCKED, JSON.stringify(unlockedMonths));
    } catch (e) {
      console.error('LocalStorage backup notice:', e);
    }
  }, [schedule, personnelList, unlockedMonths]);

  // --- MANUAL SAVE & APPLY CHANGES (SETTINGS) ---
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleManualSaveChanges = async () => {
    setIsSavingChanges(true);
    setSaveNotice(null);
    try {
      // Clear pending debounced timer
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 1. Ensure distinct non-duplicate colors for all personnel
      const distinctPersonnel = ensureUniquePersonnelColors(personnelList);
      setPersonnelList(distinctPersonnel);

      // 2. Automatically synchronize supervisors with calendar and dashboard
      const activeSupervisors = distinctPersonnel
        .filter(p => p.roles.includes('Supervisor') && p.isActive)
        .map(p => p.name);

      let finalSchedule = schedule;
      if (activeSupervisors.length > 0) {
        if (activeSupervisors.length === 1) {
          // If exactly 1 active supervisor, assign them to all shifts in the calendar
          finalSchedule = schedule.map(entry => ({
            ...entry,
            onCallPerson: activeSupervisors[0]
          }));
        } else {
          // If multiple active supervisors, reconcile any missing or obsolete supervisors
          const activeSet = new Set(activeSupervisors);
          const needsSupervisorReconcile = schedule.some(
            s => !s.onCallPerson || !activeSet.has(s.onCallPerson)
          );

          if (needsSupervisorReconcile) {
            let supIndex = 0;
            finalSchedule = schedule.map((entry, idx) => {
              if (entry.dayName === 'شنبه' && idx > 0) {
                supIndex = (supIndex + 1) % activeSupervisors.length;
              }
              return {
                ...entry,
                onCallPerson: activeSet.has(entry.onCallPerson) ? entry.onCallPerson : activeSupervisors[supIndex]
              };
            });
          }
        }
        setSchedule(finalSchedule);
      }

      // 3. Immediately persist to localStorage
      localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(finalSchedule));
      localStorage.setItem(STORAGE_KEYS.PERSONNEL, JSON.stringify(distinctPersonnel));
      localStorage.setItem(STORAGE_KEYS.LOCKED, JSON.stringify(unlockedMonths));
      if (publishedRange && publishedRange.isActive) {
        localStorage.setItem(STORAGE_KEYS.PUBLISHED_RANGE, JSON.stringify(publishedRange));
      } else {
        localStorage.removeItem(STORAGE_KEYS.PUBLISHED_RANGE);
      }
      localStorage.setItem(STORAGE_KEYS.PASSWORD, adminPassword);

      // 4. Immediately commit to Firestore cloud database
      setSyncStatus('syncing');
      await saveCloudRoster({
        schedule: finalSchedule,
        personnelList: distinctPersonnel,
        unlockedMonths,
        publishedRange,
        adminPassword,
        dailyProcesses,
        processDefinitions,
        showProcessSchedule,
      });

      setSyncStatus('synced');
      setSaveNotice({
        type: 'success',
        message: 'تمامی تغییرات، رنگ‌های اختصاصی و سرپرستان با موفقیت در فضای ابری ذخیره شده و در داشبورد اعمال گردید.'
      });

      setTimeout(() => {
        setSaveNotice(null);
      }, 5000);
    } catch (err) {
      console.error('Manual save failed:', err);
      setSyncStatus('offline');
      setSaveNotice({
        type: 'error',
        message: 'خطا در برقراری ارتباط با سرور ابری. تغییرات در حافظه مرورگر ذخیره شد، لطفاً اتصال اینترنت را بررسی کنید.'
      });
    } finally {
      setIsSavingChanges(false);
    }
  };


  // Calendar State - Defaults to today's Iranian date
  const [currentYear, setCurrentYear] = useState(() => {
    const today = getTodayPersianParts();
    return today.year || 1405;
  });
  const [monthIndex, setMonthIndex] = useState(() => {
    const today = getTodayPersianParts();
    return today.monthIndex >= 0 ? today.monthIndex : 5;
  });
  
  // Initialize monthIndex based on today or latest schedule month (never old first month)
  useEffect(() => {
    const today = getTodayPersianParts();
    const currentMonthPrefix = `${today.year}/${today.month}/`;
    const hasTodayMonth = schedule.some(s => s.date.startsWith(currentMonthPrefix));
    
    if (hasTodayMonth) {
      setCurrentYear(today.year);
      setMonthIndex(today.monthIndex);
    } else if (schedule.length > 0) {
      const sorted = [...schedule].sort((a, b) => a.date.localeCompare(b.date));
      const latestDate = sorted[sorted.length - 1].date;
      const [y, m] = latestDate.split('/');
      const yNum = parseInt(y, 10);
      const idx = MONTHS.findIndex(mObj => mObj.code === m);
      if (yNum) setCurrentYear(yNum);
      if (idx !== -1) setMonthIndex(idx);
    }
  }, []);

  const handleNavigateToToday = () => {
    const today = getTodayPersianParts();
    setCurrentYear(today.year);
    setMonthIndex(today.monthIndex);
  };

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  // Derived
  const currentMonth = MONTHS[monthIndex % MONTHS.length];
  const currentMonthKey = `${currentYear}/${currentMonth.code}`;
  
  // If a month is NOT in the unlocked list, it is LOCKED.
  const isCurrentMonthLocked = !unlockedMonths.includes(currentMonthKey);
  
  // Helpers
  const shiftWorkers = personnelList.filter(p => p.isActive && p.roles.includes('Shift')).map(p => p.name);
  const supervisors = personnelList.filter(p => p.isActive && p.roles.includes('Supervisor')).map(p => p.name);
  // All eligible personnel who can be placed in day or night shifts (including supervisors)
  const allEligibleShiftWorkers = useMemo(() => {
    return Array.from(new Set([...shiftWorkers, ...supervisors]));
  }, [shiftWorkers, supervisors]);

  // Available months across schedule
  const availableMonths = useMemo(() => {
    return Array.from(new Set(schedule.map(s => s.date.substring(0, 7)))).sort();
  }, [schedule]);

  // Staged Preview Mode (Load button applies to dashboard in preview mode before saving)
  const [isStagingPreview, setIsStagingPreview] = useState(false);
  const isStagingPreviewRef = useRef(false);

  useEffect(() => {
    isStagingPreviewRef.current = isStagingPreview;
  }, [isStagingPreview]);

  const [openChatSignal, setOpenChatSignal] = useState(0);
  const [stagingMeta, setStagingMeta] = useState<{ source: string; rangeText?: string } | null>(null);
  const [backupBeforeStaging, setBackupBeforeStaging] = useState<{
    schedule: ShiftEntry[];
    personnel: Personnel[];
    unlockedMonths: string[];
    publishedRange: PublishedRange | null;
  } | null>(null);

  const handleStagePreview = (data: AppData, meta?: { source: string; rangeText?: string }) => {
    // Only take snapshot of original state before the first staging starts
    if (!isStagingPreviewRef.current) {
      setBackupBeforeStaging({
        schedule,
        personnel: personnelList,
        unlockedMonths,
        publishedRange
      });
    }

    setIsStagingPreview(true);
    isStagingPreviewRef.current = true;
    setStagingMeta(meta || { source: 'فایل ورودی' });

    const rawSched = data.schedule || schedule;
    const non1404 = rawSched.filter(s => !s.date.startsWith('1404'));
    const incomingStaff = data.personnel || [];
    const { unifiedShifts, unifiedPersonnel } = unifyPersonnelAndShifts(non1404, incomingStaff, personnelList);

    if (incomingStaff.length > 0) {
      setPersonnelList(unifiedPersonnel);
    }

    if (unifiedShifts.length > 0) {
      setSchedule(unifiedShifts);

      // Prefer the explicit range of the newly imported file (from data.publishedRange or meta.rangeText)
      let targetRange: PublishedRange | null = null;
      if (data.publishedRange && data.publishedRange.isActive) {
        targetRange = data.publishedRange;
      } else if (meta?.rangeText) {
        const rangeMatches = meta.rangeText.match(/(\d{4}\/\d{2}\/\d{2})/g);
        if (rangeMatches && rangeMatches.length >= 2) {
          const f = rangeMatches[0].split('/');
          const l = rangeMatches[1].split('/');
          targetRange = {
            isActive: true,
            from: { year: f[0], month: f[1], day: f[2] },
            to: { year: l[0], month: l[1], day: l[2] }
          };
        }
      }

      if (!targetRange) {
        const sortedDates = [...unifiedShifts].sort((a, b) => a.date.localeCompare(b.date));
        const firstDate = sortedDates[0].date.split('/');
        const lastDate = sortedDates[sortedDates.length - 1].date.split('/');

        targetRange = {
          isActive: true,
          from: { year: firstDate[0], month: firstDate[1], day: firstDate[2] },
          to: { year: lastDate[0], month: lastDate[1], day: lastDate[2] }
        };
      }

      setPublishedRange(targetRange);

      const yNum = parseInt(targetRange.from.year, 10);
      const mIdx = MONTHS.findIndex(mObj => mObj.code === targetRange!.from.month);
      if (yNum) setCurrentYear(yNum);
      if (mIdx !== -1) setMonthIndex(mIdx);
    }

    setActiveTab('dashboard');
  };

  const handleSaveStagingFinal = async () => {
    setIsStagingPreview(false);
    isStagingPreviewRef.current = false;
    setStagingMeta(null);
    setBackupBeforeStaging(null);
    await handleManualSaveChanges();
  };

  const handleCancelStaging = () => {
    if (backupBeforeStaging) {
      setSchedule(backupBeforeStaging.schedule);
      setPersonnelList(backupBeforeStaging.personnel);
      setUnlockedMonths(backupBeforeStaging.unlockedMonths);
      setPublishedRange(backupBeforeStaging.publishedRange);
    }
    setIsStagingPreview(false);
    isStagingPreviewRef.current = false;
    setStagingMeta(null);
    setBackupBeforeStaging(null);
    setSaveNotice({
      type: 'success',
      message: 'پیش‌نمایش لغو شد و اطلاعات به حالت قبلی بازگشت.'
    });
    setTimeout(() => setSaveNotice(null), 4000);
  };



  // --- SWAP & EDIT TOOL STATE ---
  const [swapTool, setSwapTool] = useState<{
    date: string;
    shiftType: 'Day' | 'Night';
    targetPerson: string;
    supervisorTarget: string;
  }>({
    date: '',
    shiftType: 'Day',
    targetPerson: '',
    supervisorTarget: ''
  });
  
  // New state for 2-step verification
  const [isSwapReady, setIsSwapReady] = useState(false);

  const [editViewMonth, setEditViewMonth] = useState<string>(''); // For full month edit view
  const [swapMessage, setSwapMessage] = useState<{type: 'error' | 'success' | 'info', text: string} | null>(null);

  // Helper to reset swap state when inputs change
  const updateSwapTool = (updates: Partial<typeof swapTool>) => {
    setSwapTool(prev => ({ ...prev, ...updates }));
    setIsSwapReady(false); // Reset readiness
    setSwapMessage(null);  // Clear messages
  };

  // --- PERSONNEL MANAGEMENT ---
  const [newPersonName, setNewPersonName] = useState('');
  
  const handleStartAddingPersonnel = (role: 'Shift' | 'Supervisor') => {
    setNewPersonName('');
    if (role === 'Shift') {
      setIsAddingShiftPerson(true);
      setIsAddingSupervisor(false);
    } else {
      setIsAddingSupervisor(true);
      setIsAddingShiftPerson(false);
    }
  };

  const handleAddPersonnel = (role: 'Shift' | 'Supervisor') => {
    const trimmedName = newPersonName.trim();
    if (!trimmedName) return;
    if (personnelList.some(p => p.name.trim() === trimmedName)) {
        alert('این نام قبلا ثبت شده است.');
        return;
    }
    
    // Automatically assign next distinct non-duplicate color from palette
    const assignedColor = getNextPersonnelColor(personnelList);
    const newPerson: Personnel = {
      name: trimmedName,
      roles: [role],
      isActive: true,
      color: assignedColor
    };

    const updatedList = [...personnelList, newPerson];
    setPersonnelList(updatedList);
    setNewPersonName('');
    
    // Close the add form
    if (role === 'Shift') {
      setIsAddingShiftPerson(false);
    } else {
      setIsAddingSupervisor(false);
      // Auto-assign to schedule if this is the only active supervisor or if existing shifts have missing/orphaned supervisors
      const activeSupervisors = updatedList
        .filter(p => p.roles.includes('Supervisor') && p.isActive)
        .map(p => p.name);

      if (activeSupervisors.length === 1) {
        setSchedule(prev => prev.map(entry => ({
          ...entry,
          onCallPerson: trimmedName
        })));
      } else {
        setSchedule(prev => prev.map(entry => {
          if (!entry.onCallPerson || !activeSupervisors.includes(entry.onCallPerson)) {
            return { ...entry, onCallPerson: trimmedName };
          }
          return entry;
        }));
      }
    }
  };

  const handleColorChange = (name: string, newColor: string) => {
    setPersonnelList(prev => prev.map(p => {
      if (p.name === name) {
        return { ...p, color: newColor };
      }
      return p;
    }));
  };

  const handleRemovePersonnel = (name: string) => {
    const remainingPersonnel = personnelList.filter(p => p.name !== name);
    setPersonnelList(remainingPersonnel);

    const remainingSupervisors = remainingPersonnel
      .filter(p => p.roles.includes('Supervisor') && p.isActive)
      .map(p => p.name);

    const remainingShiftWorkers = remainingPersonnel
      .filter(p => p.roles.includes('Shift') && p.isActive)
      .map(p => p.name);

    // Automatically reassign shifts so orphaned names never linger in schedule or dashboard
    setSchedule(prev => prev.map(entry => {
      let item = { ...entry };
      if (item.onCallPerson === name) {
        item.onCallPerson = remainingSupervisors.length > 0 ? remainingSupervisors[0] : 'نامشخص';
      }
      if (item.dayShiftPerson === name) {
        item.dayShiftPerson = remainingShiftWorkers.length > 0 ? remainingShiftWorkers[0] : 'نامشخص';
      }
      if (item.nightShiftPerson === name) {
        item.nightShiftPerson = remainingShiftWorkers.length > 0 ? remainingShiftWorkers[0] : 'نامشخص';
      }
      if (item.extraDayPersons && item.extraDayPersons.includes(name)) {
        item.extraDayPersons = item.extraDayPersons.filter(p => p !== name);
      }
      if (item.extraNightPersons && item.extraNightPersons.includes(name)) {
        item.extraNightPersons = item.extraNightPersons.filter(p => p !== name);
      }
      return item;
    }));
  };
  
  const handleToggleActive = (name: string) => {
      const updatedList = personnelList.map(p => 
          p.name === name ? { ...p, isActive: !p.isActive } : p
      );
      setPersonnelList(updatedList);

      const activeSupervisors = updatedList
        .filter(p => p.roles.includes('Supervisor') && p.isActive)
        .map(p => p.name);

      if (activeSupervisors.length > 0) {
        setSchedule(prev => prev.map(entry => {
          if (!activeSupervisors.includes(entry.onCallPerson)) {
            return { ...entry, onCallPerson: activeSupervisors[0] };
          }
          return entry;
        }));
      }
  };

  const movePersonnel = (name: string, direction: 'up' | 'down', roleFilter: 'Shift' | 'Supervisor') => {
    setPersonnelList(prev => {
      const relevantNames = prev
        .filter(p => p.roles.includes(roleFilter))
        .map(p => p.name);

      const currentIndexInRelevant = relevantNames.indexOf(name);
      if (currentIndexInRelevant === -1) return prev;

      if (direction === 'up' && currentIndexInRelevant === 0) return prev;
      if (direction === 'down' && currentIndexInRelevant === relevantNames.length - 1) return prev;

      const swapTargetName = direction === 'up' 
        ? relevantNames[currentIndexInRelevant - 1]
        : relevantNames[currentIndexInRelevant + 1];

      const realIndexA = prev.findIndex(p => p.name === name);
      const realIndexB = prev.findIndex(p => p.name === swapTargetName);

      if (realIndexA === -1 || realIndexB === -1) return prev;

      const newList = [...prev];
      [newList[realIndexA], newList[realIndexB]] = [newList[realIndexB], newList[realIndexA]];
      
      return newList;
    });
  };

  // --- SCHEDULING LOGIC ---
  const handleNextMonth = () => {
    const nextIdx = monthIndex + 1;
    const nextMonthObj = MONTHS[nextIdx % MONTHS.length];
    let nextYear = currentYear;
    if (currentMonth.code === '12' && nextMonthObj.code === '01') {
        nextYear = currentYear + 1;
    }
    
    const nextMonthKey = `${nextYear}/${nextMonthObj.code}`;
    const isNextLocked = !unlockedMonths.includes(nextMonthKey);
    const existingDays = schedule.filter(s => s.date.includes(`${nextYear}/${nextMonthObj.code}/`));
    const daysInNextMonth = getDaysInPersianMonth(nextMonthObj.code);

    if (!isNextLocked && existingDays.length < daysInNextMonth) {
             let startDayIndex = 6; 
             if (schedule.length > 0) {
                 const lastEntry = schedule[schedule.length - 1];
                 const lastDayName = lastEntry.dayName;
                 const weekDays = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
                 const lastDayIdx = weekDays.indexOf(lastDayName);
                 startDayIndex = (lastDayIdx + 1) % 7;
             }
             const newMonthData = generateNextMonth(
                 schedule, 
                 nextYear, 
                 nextMonthObj.code, 
                 startDayIndex, 
                 personnelList,
                 daysInNextMonth
             );
             setSchedule(prev => [...prev, ...newMonthData]);
    }

    setMonthIndex(nextIdx);
    if (nextYear !== currentYear) setCurrentYear(nextYear);
  };

  // Manual Generation from Settings
  const handleManualAddNextMonth = () => {
      if (schedule.length === 0) return;

      const lastEntry = schedule[schedule.length - 1];
      const lastDateParts = lastEntry.date.split('/');
      const lastYear = parseInt(lastDateParts[0]);
      const lastMonth = parseInt(lastDateParts[1]);

      let nextYear = lastYear;
      let nextMonth = lastMonth + 1;
      if (nextMonth > 12) {
          nextMonth = 1;
          nextYear++;
      }
      const nextMonthCode = String(nextMonth).padStart(2, '0');
      const nextMonthName = MONTHS.find(m => m.code === nextMonthCode)?.name || 'نامشخص';
      const daysInNextMonth = getDaysInPersianMonth(nextMonthCode);
      const nextMonthKey = `${nextYear}/${nextMonthCode}`;

      if (confirm(`آیا می‌خواهید برنامه برای ${nextMonthName} ${nextYear} تولید شود؟`)) {
          // Check if already exists (partially or fully)
          const exists = schedule.some(s => s.date.startsWith(`${nextYear}/${nextMonthCode}`));
          if (exists) {
              alert('بخشی از برنامه این ماه قبلا تولید شده است.');
              return;
          }

          const weekDays = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
          const startDayIndex = (weekDays.indexOf(lastEntry.dayName) + 1) % 7;

          const newMonthData = generateNextMonth(
                 schedule, 
                 nextYear, 
                 nextMonthCode, 
                 startDayIndex, 
                 personnelList,
                 daysInNextMonth
          );
          
          setSchedule(prev => [...prev, ...newMonthData]);
          alert(`برنامه ${nextMonthName} ${nextYear} با موفقیت تولید شد.`);
      }
  };

  // Calculate info for the manual button
  const nextGenInfo = useMemo(() => {
     if (schedule.length === 0) return { label: '---', year: '---' };
     const lastEntry = schedule[schedule.length - 1];
     const lastDateParts = lastEntry.date.split('/');
     let y = parseInt(lastDateParts[0]);
     let m = parseInt(lastDateParts[1]) + 1;
     if (m > 12) { m = 1; y++; }
     const mCode = String(m).padStart(2, '0');
     const mName = MONTHS.find(mo => mo.code === mCode)?.name || '---';
     return { label: mName, year: y };
  }, [schedule]);


  const handlePrevMonth = () => {
       // Logic to move back
       // We can simply loop backward through our MONTHS array or logic
       // Current Month Index
       const currentIndex = monthIndex;
       const newIndex = currentIndex - 1;
       
       // Sync year if we crossed boundary
       const currentM = MONTHS[currentIndex % 12];
       const prevM = MONTHS[(newIndex + 1200) % 12]; // safe mod
       
       let newYear = currentYear;
       if (currentM.code === '01' && prevM.code === '12') {
           newYear = currentYear - 1;
       }
       
       setMonthIndex(newIndex);
       setCurrentYear(newYear);
  };

  const scheduleSyncTimeoutRef = useRef<any>(null);

  const syncUpdatedSchedule = (newSchedule: ShiftEntry[]) => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(newSchedule));
      localStorage.setItem(STORAGE_KEYS.UPDATED_AT, now);
    } catch (e) {
      console.error('LocalStorage save error:', e);
    }

    if (scheduleSyncTimeoutRef.current) {
      clearTimeout(scheduleSyncTimeoutRef.current);
    }
    setSyncStatus('syncing');
    scheduleSyncTimeoutRef.current = setTimeout(() => {
      saveCloudRoster({
        schedule: newSchedule,
        personnelList,
        unlockedMonths,
        publishedRange,
        adminPassword,
        dailyProcesses,
        processDefinitions,
        showProcessSchedule
      })
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('synced'));
    }, 250);
  };

  const handleUpdateShift = (id: number, field: 'dayShiftPerson' | 'nightShiftPerson' | 'onCallPerson', value: string) => {
    setSchedule(prev => {
      const currentEntry = prev.find(item => item.id === id);
      if (!currentEntry) return prev;

      let newSched = prev;
      if (field === 'nightShiftPerson' && value && value !== 'نامشخص' && currentEntry.date) {
        const targetDate = getNextJalaliDate(currentEntry.date, 2);
        const norm = (d: string) => d.split('/').map(p => p.padStart(2, '0')).join('/');
        const targetNorm = norm(targetDate);

        newSched = prev.map(item => {
          if (item.id === id) {
            return { ...item, nightShiftPerson: value };
          }
          if (norm(item.date) === targetNorm) {
            const cleanedExtras = item.extraDayPersons ? item.extraDayPersons.filter(p => p !== value) : undefined;
            return {
              ...item,
              dayShiftPerson: value,
              ...(cleanedExtras ? { extraDayPersons: cleanedExtras } : {})
            };
          }
          return item;
        });
      } else {
        newSched = prev.map(item => 
          item.id === id ? { ...item, [field]: value } : item
        );
      }

      syncUpdatedSchedule(newSched);
      return newSched;
    });
  };

  const handleAddExtraPerson = (id: number, shiftType: 'Day' | 'Night', personName: string) => {
    if (!personName) return;
    setSchedule(prev => {
      const currentEntry = prev.find(item => item.id === id);
      const targetDate = currentEntry?.date ? getNextJalaliDate(currentEntry.date, 2) : null;
      const norm = (d: string) => d.split('/').map(p => p.padStart(2, '0')).join('/');
      const targetNorm = targetDate ? norm(targetDate) : null;

      const newSched = prev.map(item => {
        if (item.id === id) {
          if (shiftType === 'Day') {
            const currentExtras = item.extraDayPersons || [];
            if (currentExtras.includes(personName) || item.dayShiftPerson === personName) {
              return item;
            }
            return { ...item, extraDayPersons: [...currentExtras, personName] };
          } else {
            const currentExtras = item.extraNightPersons || [];
            if (currentExtras.includes(personName) || item.nightShiftPerson === personName) {
              return item;
            }
            return { ...item, extraNightPersons: [...currentExtras, personName] };
          }
        }
        if (shiftType === 'Night' && targetNorm && norm(item.date) === targetNorm) {
          const currentDayExtras = item.extraDayPersons || [];
          if (item.dayShiftPerson === personName || currentDayExtras.includes(personName)) {
            return item;
          }
          if (!item.dayShiftPerson || item.dayShiftPerson === 'نامشخص') {
            return { ...item, dayShiftPerson: personName };
          }
          return { ...item, extraDayPersons: [...currentDayExtras, personName] };
        }
        return item;
      });

      syncUpdatedSchedule(newSched);
      return newSched;
    });
  };

  const handleRemoveExtraPerson = (id: number, shiftType: 'Day' | 'Night', personName: string) => {
    setSchedule(prev => {
      const newSched = prev.map(item => {
        if (item.id === id) {
          if (shiftType === 'Day') {
            const currentExtras = item.extraDayPersons || [];
            return { ...item, extraDayPersons: currentExtras.filter(p => p !== personName) };
          } else {
            const currentExtras = item.extraNightPersons || [];
            return { ...item, extraNightPersons: currentExtras.filter(p => p !== personName) };
          }
        }
        return item;
      });
      syncUpdatedSchedule(newSched);
      return newSched;
    });
  };

  const handleReplaceExtraPerson = (id: number, shiftType: 'Day' | 'Night', oldPerson: string, newPerson: string) => {
    if (!newPerson) return;
    setSchedule(prev => {
      const currentEntry = prev.find(item => item.id === id);
      const targetDate = currentEntry?.date ? getNextJalaliDate(currentEntry.date, 2) : null;
      const norm = (d: string) => d.split('/').map(p => p.padStart(2, '0')).join('/');
      const targetNorm = targetDate ? norm(targetDate) : null;

      const newSched = prev.map(item => {
        if (item.id === id) {
          if (shiftType === 'Day') {
            const currentExtras = item.extraDayPersons || [];
            const updated = currentExtras.map(p => p === oldPerson ? newPerson : p);
            return { ...item, extraDayPersons: updated };
          } else {
            const currentExtras = item.extraNightPersons || [];
            const updated = currentExtras.map(p => p === oldPerson ? newPerson : p);
            return { ...item, extraNightPersons: updated };
          }
        }
        if (shiftType === 'Night' && targetNorm && norm(item.date) === targetNorm) {
          if (item.dayShiftPerson === oldPerson) {
            return { ...item, dayShiftPerson: newPerson };
          }
          if (item.extraDayPersons && item.extraDayPersons.includes(oldPerson)) {
            return {
              ...item,
              extraDayPersons: item.extraDayPersons.map(p => p === oldPerson ? newPerson : p)
            };
          }
        }
        return item;
      });

      syncUpdatedSchedule(newSched);
      return newSched;
    });
  };

  const handleToggleHoliday = (id: number) => {
    setSchedule(prev => {
      const newSched = prev.map(item => 
        item.id === id ? { ...item, isHoliday: !item.isHoliday } : item
      );
      syncUpdatedSchedule(newSched);
      return newSched;
    });
  };
  
  const handleToggleLock = () => {
      const key = currentMonthKey;
      let newLocked: string[];
      if (unlockedMonths.includes(key)) {
          newLocked = unlockedMonths.filter(m => m !== key);
      } else {
          newLocked = [...unlockedMonths, key];
      }
      setUnlockedMonths(newLocked);
      try {
        localStorage.setItem(STORAGE_KEYS.LOCKED, JSON.stringify(newLocked));
      } catch (e) {
        console.error(e);
      }
      saveCloudRoster({ unlockedMonths: newLocked }).catch(console.error);
  };

  const handleRegenerate = () => {
      if (confirm('آیا از چیدمان مجدد این ماه اطمینان دارید؟ تمام تغییرات دستی این ماه حذف خواهد شد.')) {
          const monthCode = currentMonth.code;
          const yearStr = String(currentYear);
          const filteredSchedule = schedule.filter(s => !s.date.startsWith(`${yearStr}/${monthCode}`));
          
          let startDayIndex = 6; 
          if (filteredSchedule.length > 0) {
               const lastEntry = filteredSchedule[filteredSchedule.length - 1];
               const weekDays = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
               startDayIndex = (weekDays.indexOf(lastEntry.dayName) + 1) % 7;
          }

          const daysInMonth = getDaysInPersianMonth(monthCode);
          const newData = generateNextMonth(
              filteredSchedule,
              currentYear,
              monthCode,
              startDayIndex,
              personnelList,
              daysInMonth
          );

          setSchedule([...filteredSchedule, ...newData]);
      }
  };

  const handleApplyAiGeneratedMonth = (
    targetYear: number,
    targetMonthCode: string,
    newMonthEntries: ShiftEntry[],
    mode: 'apply' | 'preview' = 'apply'
  ) => {
    const prefix = `${targetYear}/${targetMonthCode}`;
    const otherMonths = schedule.filter(s => !s.date.startsWith(prefix));
    const mergedSchedule = [...otherMonths, ...newMonthEntries].sort((a, b) => a.date.localeCompare(b.date));

    // Switch calendar to target month & year so manager immediately sees the arranged schedule
    const mIdx = MONTHS.findIndex(m => m.code === targetMonthCode);
    if (targetYear) setCurrentYear(targetYear);
    if (mIdx !== -1) setMonthIndex(mIdx);
    setActiveTab('dashboard');

    const mName = MONTHS.find(m => m.code === targetMonthCode)?.name || targetMonthCode;

    if (mode === 'preview') {
      handleStagePreview(
        {
          schedule: mergedSchedule,
          personnel: personnelList,
          lockedMonths: unlockedMonths,
          publishedRange
        },
        {
          source: `چیدمان هوشمند AI (${mName} ${toPersianDigits(targetYear)})`,
          rangeText: `${toPersianDigits(prefix)}/۰۱ تا ${toPersianDigits(prefix)}/${toPersianDigits(newMonthEntries.length)}`
        }
      );
      // Keep calendar focused on the AI-generated target month instead of first date in schedule
      if (targetYear) setCurrentYear(targetYear);
      if (mIdx !== -1) setMonthIndex(mIdx);
      setPublishedRange({
        isActive: true,
        from: { year: String(targetYear), month: targetMonthCode, day: '01' },
        to: {
          year: String(targetYear),
          month: targetMonthCode,
          day: String(newMonthEntries.length).padStart(2, '0')
        }
      });
    } else {
      setSchedule(mergedSchedule);
      syncUpdatedSchedule(mergedSchedule);
      if (targetYear) setCurrentYear(targetYear);
      if (mIdx !== -1) setMonthIndex(mIdx);
      setSaveNotice({
        type: 'success',
        message: `برنامه شیفت ${mName} ${toPersianDigits(targetYear)} توسط دستیار هوشمند با رعایت عدالت و ملاحظات چیده و ذخیره شد.`
      });
      setTimeout(() => setSaveNotice(null), 5000);
    }
  };
  
  const handleImport = (data: AppData) => {
      const rawSched = data.schedule || schedule;
      const non1404 = rawSched.filter(s => !s.date.startsWith('1404'));
      const incomingStaff = data.personnel || [];
      const { unifiedShifts, unifiedPersonnel } = unifyPersonnelAndShifts(non1404, incomingStaff, personnelList);

      const targetSchedule = data.schedule ? unifiedShifts : schedule;
      const targetPersonnel = incomingStaff.length > 0 ? unifiedPersonnel : personnelList;
      const targetLocked = data.lockedMonths || unlockedMonths;
      const targetDailyProcesses = data.dailyProcesses || dailyProcesses;
      const targetProcessDefs = data.processDefinitions || processDefinitions;

      if (data.schedule) setSchedule(unifiedShifts);
      if (incomingStaff.length > 0) setPersonnelList(unifiedPersonnel);
      if (data.lockedMonths) setUnlockedMonths(data.lockedMonths);
      if (data.publishedRange !== undefined) {
        handleSavePublishedRange(data.publishedRange);
        if (data.publishedRange && data.publishedRange.isActive) {
          const yNum = parseInt(data.publishedRange.from.year, 10);
          const mIdx = MONTHS.findIndex(mObj => mObj.code === data.publishedRange!.from.month);
          if (yNum) setCurrentYear(yNum);
          if (mIdx !== -1) setMonthIndex(mIdx);
        }
      }
      if (data.dailyProcesses) setDailyProcesses(data.dailyProcesses);
      if (data.processDefinitions) setProcessDefinitions(data.processDefinitions);
      if (data.showProcessSchedule !== undefined) {
        setShowProcessSchedule(data.showProcessSchedule);
        try {
          localStorage.setItem(STORAGE_KEYS.SHOW_PROCESS_SCHEDULE, String(data.showProcessSchedule));
        } catch (e) {
          console.error('LocalStorage error', e);
        }
      }

      // Immediately persist imported data to cloud
      saveCloudRoster({
        schedule: targetSchedule,
        personnelList: targetPersonnel,
        unlockedMonths: targetLocked,
        publishedRange: data.publishedRange !== undefined ? data.publishedRange : publishedRange,
        dailyProcesses: targetDailyProcesses,
        processDefinitions: targetProcessDefs,
        showProcessSchedule: data.showProcessSchedule !== undefined ? data.showProcessSchedule : showProcessSchedule,
      }).catch(console.error);

      setActiveTab('dashboard');
  };
  
  const handleReset = async () => {
      if (!confirm('آیا از بازنشانی کلیه اطلاعات به حالت پیش‌فرض مطمئن هستید؟')) return;
      const defaultDaily = generateFullBioprocessCampaign('1405/05/26');
      setSchedule(SCHEDULE_DATA);
      setPersonnelList(INITIAL_STAFF);
      setUnlockedMonths([]);
      setPublishedRange(null);
      setDailyProcesses(defaultDaily);
      setProcessDefinitions(DEFAULT_PROCESS_DEFINITIONS);
      setShowProcessSchedule(true);
      localStorage.clear();
      try {
        await resetCloudRoster({
          schedule: SCHEDULE_DATA,
          personnelList: INITIAL_STAFF,
          unlockedMonths: [],
          publishedRange: null,
          adminPassword: '1234',
          dailyProcesses: defaultDaily,
          processDefinitions: DEFAULT_PROCESS_DEFINITIONS,
          showProcessSchedule: true,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Failed to reset cloud roster:', e);
      }
      window.location.reload();
  };
  
  // Step 1: Validate
  const handleValidateSwap = () => {
      if (!swapTool.date || !swapTool.targetPerson) {
          setSwapMessage({ type: 'error', text: 'لطفا تاریخ و شخص جایگزین را انتخاب کنید.' });
          return;
      }
      const result = validateSwap(schedule, swapTool.date, swapTool.targetPerson, swapTool.shiftType);
      if (!result.valid) {
          setSwapMessage({ type: 'error', text: result.reason || 'خطا در جابجایی.' });
          setIsSwapReady(false);
          return;
      }

      setSwapMessage({ type: 'info', text: 'قوانین رعایت شده است. برای اعمال تغییرات دکمه تایید نهایی را بزنید.' });
      setIsSwapReady(true);
  };

  // Step 2: Execute
  const handleApplySwap = () => {
      const entry = schedule.find(s => s.date === swapTool.date);
      if (entry) {
          const isDay = swapTool.shiftType === 'Day';
          const targetDate = getNextJalaliDate(entry.date, 2);
          const norm = (d: string) => d.split('/').map(p => p.padStart(2, '0')).join('/');
          const targetNorm = norm(targetDate);

          setSchedule(prev => {
              const newSched = prev.map(item => {
                  if (item.id === entry.id) {
                      const updates: Partial<ShiftEntry> = {};
                      if (isDay) {
                          updates.dayShiftPerson = swapTool.targetPerson;
                          if (!item.originalDayShiftPerson && item.dayShiftPerson !== swapTool.targetPerson) {
                              updates.originalDayShiftPerson = item.dayShiftPerson;
                          }
                      } else {
                          updates.nightShiftPerson = swapTool.targetPerson;
                          if (!item.originalNightShiftPerson && item.nightShiftPerson !== swapTool.targetPerson) {
                              updates.originalNightShiftPerson = item.nightShiftPerson;
                          }
                      }
                      return { ...item, ...updates };
                  }
                  // If Night shift was swapped, automatically update day shift 2 days later
                  if (!isDay && swapTool.targetPerson && norm(item.date) === targetNorm) {
                      return { ...item, dayShiftPerson: swapTool.targetPerson };
                  }
                  return item;
              });
              syncUpdatedSchedule(newSched);
              return newSched;
          });
          setSwapMessage({ type: 'success', text: isDay ? 'جابجایی با موفقیت انجام شد.' : 'جابجایی انجام شد و شیفت روز ۲ روز بعد نیز به‌روزرسانی گردید.' });
          setIsSwapReady(false);
          setTimeout(() => setSwapMessage(null), 3000);
      }
  };

  const handleUpdateSupervisor = () => {
      if (!swapTool.date || !swapTool.supervisorTarget) {
          setSwapMessage({ type: 'error', text: 'لطفا تاریخ و سرپرست جدید را انتخاب کنید.' });
          return;
      }
      const entry = schedule.find(s => s.date === swapTool.date);
      if (entry) {
          handleUpdateShift(entry.id, 'onCallPerson', swapTool.supervisorTarget);
          setSwapMessage({ type: 'success', text: 'سرپرست شیفت تغییر کرد.' });
          setTimeout(() => setSwapMessage(null), 3000);
      }
  };

  const handleToggleHolidaySetting = () => {
      if (!swapTool.date) return;
      const entry = schedule.find(s => s.date === swapTool.date);
      if (entry) {
          handleToggleHoliday(entry.id);
      }
  };

  // Filter current month data for view
  const currentMonthData = schedule.filter(s => s.date.startsWith(`${currentYear}/${currentMonth.code}`));
  // Helper to get current selection stats for Swap Tool
  const currentSwapEntry = swapTool.date ? schedule.find(s => s.date === swapTool.date) : null;

  if (isCloudLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans dir-rtl select-none">
        <div className="w-16 h-16 relative flex items-center justify-center mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping"></div>
          <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
        </div>
        <div className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl font-black text-xl mb-3 shadow-lg shadow-emerald-950/40" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
          FMD
        </div>
        <h2 className="text-lg sm:text-xl font-black mb-2 text-slate-100">سامانه شیفت تولید</h2>
        <p className="text-xs sm:text-sm text-slate-400 text-center max-w-xs leading-relaxed">
          در حال بارگذاری و دریافت آخرین نسخه ثبت‌شده از سرور ابری...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      {/* Navbar */}
      <nav className="main-navbar bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 no-print shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16 gap-1.5 sm:gap-4">
            
            {/* Branding & Status Info */}
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1 overflow-hidden">
              <div className="bg-emerald-600 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg min-w-[32px] sm:min-w-[42px] h-8 sm:h-9 flex items-center justify-center shadow-xs shrink-0">
                 <span className="font-bold text-xs sm:text-lg leading-none" style={{ fontFamily: '"Times New Roman", Times, serif' }}>FMD</span>
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <h1 className="text-xs sm:text-base md:text-lg font-black text-slate-800 tracking-tight leading-tight truncate">
                  سامانه شیفت تولید
                </h1>
                <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 overflow-hidden whitespace-nowrap">
                  {isOwner ? (
                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full border border-amber-200 whitespace-nowrap shrink-0">
                       <Crown size={10} className="text-amber-600 shrink-0" />
                       <span className="hidden sm:inline">مدیر پنل</span>
                       <span className="sm:hidden">مدیر</span>
                    </span>
                  ) : (
                    <span className="hidden sm:inline text-[10px] text-slate-400 font-medium whitespace-nowrap">
                       سامانه مشاهده شیفت‌ها
                    </span>
                  )}

                  {/* Cloud & Server Sync Live Status Indicator */}
                  {syncStatus === 'synced' ? (
                    <span 
                      className="inline-flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 sm:px-2.5 py-0.5 rounded-full border border-emerald-200/90 whitespace-nowrap shrink-0 shadow-2xs" 
                      title={`همگام‌سازی مستقیم سرور: فعال (بدون نیاز به فیلترشکن)${syncDetails.firestoreConnected ? ' | فضای ابری فایربیس: متصل' : ' | فایربیس: محدودیت شبکه (سرور مستقیم فعال است)'}${syncDetails.lastSyncTime ? ' | آخرین سینک: ' + syncDetails.lastSyncTime : ''}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                      <Server size={10} className="text-emerald-600 shrink-0 hidden xs:inline" />
                      <span className="hidden md:inline">همگام مستقیم (بدون فیلتر)</span>
                      <span className="md:hidden">همگام</span>
                    </span>
                  ) : syncStatus === 'syncing' ? (
                    <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 sm:px-2 py-0.5 rounded-full border border-amber-200 animate-pulse whitespace-nowrap shrink-0" title="در حال ذخیره و انتشار تغییرات در سرور و دیتابیس ابری...">
                      <CloudUpload size={10} className="text-amber-600 shrink-0" />
                      <span className="hidden sm:inline">در حال ذخیره...</span>
                      <span className="sm:hidden">ذخیره...</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded-full border border-slate-200 whitespace-nowrap shrink-0" title="داده‌های محلی در دسترس هستند">
                      <Cloud size={10} className="text-slate-400 shrink-0" />
                      <span>آفلاین</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Navigation Tabs & Actions */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Segmented Tab Pill - Only visible when Manager is logged in */}
              {isOwner && (
                <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200/80 animate-in fade-in duration-150">
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                      activeTab === 'dashboard' 
                        ? 'bg-white text-slate-900 shadow-xs' 
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    داشبورد
                  </button>
                  <button 
                    onClick={() => setActiveTab('settings')}
                    className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                      activeTab === 'settings' 
                        ? 'bg-white text-slate-900 shadow-xs' 
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    تنظیمات
                  </button>
                </div>
              )}

              {/* 3 Settings Subtabs in Top Navbar on Medium+ Screens */}
              {activeTab === 'settings' && isOwner && (
                <div className="hidden lg:flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200/80 animate-in fade-in duration-150">
                  <button
                    onClick={() => handleSelectSettingsSubTab('general')}
                    className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                      settingsSubTab === 'general'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    تنظیمات جنرال
                  </button>
                  <button
                    onClick={() => handleSelectSettingsSubTab('shifts')}
                    className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                      settingsSubTab === 'shifts'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    شیفت
                  </button>
                  <button
                    onClick={() => handleSelectSettingsSubTab('processes')}
                    className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                      settingsSubTab === 'processes'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    پروسه
                  </button>
                </div>
              )}

              {/* Android / Mobile App Latest Release Button (Icon-only on mobile) */}
              <PWAInstallButton schedule={schedule} />

              {/* User Settings & Smart Shift Notification Center (For All Users) */}
              <UserSettingsButton
                schedule={schedule}
                personnelList={personnelList}
                dailyProcesses={dailyProcesses}
                currentMonthName={currentMonth.name}
                currentYear={currentYear}
                currentMonthCode={currentMonth.code}
              />

              {/* AI Assistant Toggle for Manager */}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setShowAiAssistant(prev => {
                    const nextVal = !prev;
                    try { localStorage.setItem('shiftflow_show_ai_assistant', String(nextVal)); } catch {}
                    return nextVal;
                  })}
                  className={`flex items-center justify-center gap-1 text-xs font-bold w-8 h-8 sm:w-auto sm:h-9 sm:px-2.5 sm:py-1.5 rounded-xl transition shadow-2xs cursor-pointer whitespace-nowrap shrink-0 border ${
                    showAiAssistant 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                      : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-800'
                  }`}
                  title={showAiAssistant ? 'برای بستن و پنهان‌سازی دستیار هوش مصنوعی کلیک کنید' : 'برای فعال‌سازی دستیار هوش مصنوعی کلیک کنید'}
                >
                  <Sparkles size={14} className={showAiAssistant ? 'text-indigo-600' : 'text-slate-400'} />
                  <span className="hidden lg:inline">دستیار هوش مصنوعی:</span>
                  <span className="hidden sm:inline">{showAiAssistant ? 'روشن' : 'خاموش'}</span>
                </button>
              )}

              {/* Login / Logout Action */}
              {isOwner ? (
                <button
                  onClick={handleLogoutOwner}
                  className="flex items-center justify-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 w-8 h-8 sm:w-auto sm:h-9 sm:px-2.5 sm:py-1.5 rounded-xl transition shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                  title="خروج از حساب مدیر پنل"
                >
                  <LogOut size={14} className="shrink-0" />
                  <span className="hidden sm:inline">خروج مدیر</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIntendedTab('dashboard');
                    setIsPasswordModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-1 text-xs font-bold text-slate-700 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 h-8 sm:h-9 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl transition shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                  title="ورود به پنل مدیریت"
                >
                  <KeyRound size={13} className="text-emerald-600 shrink-0" />
                  <span className="text-[11px] sm:text-xs">ورود</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Staged Preview Sticky Banner */}
      {isStagingPreview && (
        <div className="bg-amber-500 text-slate-900 border-b-2 border-amber-600 px-4 py-2.5 sticky top-14 sm:top-16 z-40 shadow-md animate-in fade-in slide-in-from-top-2 no-print">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 font-bold text-right">
              <span className="flex h-2.5 w-2.5 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
              </span>
              <span>
                پیش‌نمایش موقت ورودی: <b>{stagingMeta?.source || 'فایل ورودی'}</b> {stagingMeta?.rangeText ? `(${stagingMeta.rangeText})` : ''} — این تغییرات در داشبورد شما بارگذاری شده اما هنوز ذخیره نهایی نشده است.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAiAssistant(true);
                    try { localStorage.setItem('shiftflow_show_ai_assistant', 'true'); } catch {}
                    setOpenChatSignal(prev => prev + 1);
                  }}
                  className="bg-indigo-700 hover:bg-indigo-800 active:scale-95 text-white font-black px-3 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Sparkles size={14} className="shrink-0" />
                  <span>ویرایش با چت هوشمند</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveStagingFinal}
                disabled={isSavingChanges}
                className="bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-black px-3.5 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Save size={14} className="shrink-0" />
                <span>{isSavingChanges ? 'در حال ذخیره...' : 'ذخیره و انتشار نهایی'}</span>
              </button>
              <button
                type="button"
                onClick={handleCancelStaging}
                className="bg-amber-800 hover:bg-amber-900 text-white font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <X size={14} className="shrink-0" />
                <span>انصراف</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="main-content max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {activeTab === 'dashboard' || !isOwner ? (
          <Dashboard 
            scheduleData={currentMonthData}
            fullSchedule={schedule}
            shiftWorkers={shiftWorkers}
            supervisors={supervisors}
            personnelList={personnelList}
            monthName={currentMonth.name}
            year={currentYear}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onUpdateShift={handleUpdateShift}
            onToggleHoliday={handleToggleHoliday}
            onOpenReport={() => setIsReportModalOpen(true)}
            onAddExtraPerson={handleAddExtraPerson}
            onRemoveExtraPerson={handleRemoveExtraPerson}
            onReplaceExtraPerson={handleReplaceExtraPerson}
            isLocked={isCurrentMonthLocked}
            onToggleLock={handleToggleLock}
            onRegenerate={handleRegenerate}
            onNavigateToToday={handleNavigateToToday}
            isOwner={isOwner}
            onOpenOwnerLogin={() => setIsPasswordModalOpen(true)}
            onLogoutOwner={handleLogoutOwner}
            publishedRange={publishedRange}
            onSavePublishedRange={handleSavePublishedRange}
            dailyProcesses={dailyProcesses}
            onSaveDailyProcesses={handleSaveDailyProcesses}
            processDefinitions={processDefinitions}
            showProcessSchedule={showProcessSchedule}
          />
        ) : (
          <div className="relative min-h-[80vh]">
             {/* 1. Transparent Interceptor Layer (Invisible Shield) */}
             {!isSettingsUnlocked && (
                 <div 
                    className="absolute inset-0 z-40 cursor-pointer"
                    onClick={() => setIsPasswordModalOpen(true)}
                    title="برای ایجاد تغییرات کلیک کنید"
                 ></div>
             )}
             
             {/* 3. CHANGE PASSWORD MODAL */}
             {isChangePwdOpen && (
                 <div 
                    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setChangePwdOpen(false)}
                 >
                     <div 
                         className="bg-white p-6 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm animate-in zoom-in-95 relative" 
                         onClick={e => e.stopPropagation()}
                     >
                         <div className="flex justify-between items-center mb-4 border-b pb-3">
                             <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                 <KeyRound size={20} className="text-emerald-500" />
                                 تغییر رمز عبور تنظیمات
                             </h3>
                             <button onClick={() => setChangePwdOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                         </div>
                         
                         <div className="space-y-3">
                             <div>
                                 <label className="text-xs font-bold text-slate-800 mb-1 block">رمز فعلی</label>
                                 <input 
                                    type="password"
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none text-center dir-ltr text-slate-900 font-bold"
                                    value={pwdForm.current}
                                    onChange={e => setPwdForm({...pwdForm, current: e.target.value})}
                                 />
                             </div>
                             <div>
                                 <label className="text-xs font-bold text-slate-800 mb-1 block">رمز جدید</label>
                                 <input 
                                    type="password"
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none text-center dir-ltr text-slate-900 font-bold"
                                    value={pwdForm.new}
                                    onChange={e => setPwdForm({...pwdForm, new: e.target.value})}
                                 />
                             </div>
                             <div>
                                 <label className="text-xs font-bold text-slate-800 mb-1 block">تکرار رمز جدید</label>
                                 <input 
                                    type="password"
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none text-center dir-ltr text-slate-900 font-bold"
                                    value={pwdForm.confirm}
                                    onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})}
                                 />
                             </div>

                             <div className="flex gap-2 mt-4 pt-2">
                                 <button 
                                    onClick={() => setChangePwdOpen(false)}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-bold transition"
                                 >
                                     انصراف
                                 </button>
                                 <button 
                                    onClick={handleChangePassword}
                                    className="flex-1 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition shadow-md"
                                 >
                                     تغییر رمز
                                 </button>
                             </div>
                         </div>
                     </div>
                 </div>
             )}

             {/* 4. Settings Content (Visible but covered by shield if locked) */}
             <div className="max-w-4xl mx-auto space-y-6">
                
                {/* Top Sticky Header with the 3 Segmented Tabs (styled like the top of the app) and Save Actions */}
                <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xs border border-slate-200 p-2.5 sm:p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 sticky top-14 sm:top-16 z-30 transition-all">
                    {/* The 3 Tabs - Exactly styled like the top app segmented pill */}
                    <div className="flex items-center justify-center w-full md:w-auto">
                        <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200/80 w-full sm:w-auto justify-center">
                            <button
                                type="button"
                                onClick={() => handleSelectSettingsSubTab('general')}
                                className={`flex-1 sm:flex-initial px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                                    settingsSubTab === 'general'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                تنظیمات جنرال
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSelectSettingsSubTab('shifts')}
                                className={`flex-1 sm:flex-initial px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                                    settingsSubTab === 'shifts'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                شیفت
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSelectSettingsSubTab('processes')}
                                className={`flex-1 sm:flex-initial px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                                    settingsSubTab === 'processes'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                پروسه
                            </button>
                        </div>
                    </div>

                    {/* Quick Actions (Password & Save) */}
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0">
                        <button 
                            type="button"
                            onClick={() => setChangePwdOpen(true)}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs text-slate-700 hover:text-emerald-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition font-bold px-3 py-1.5 sm:py-2 rounded-xl cursor-pointer shadow-2xs whitespace-nowrap"
                            title="تغییر رمز عبور مدیریت"
                        >
                            <KeyRound size={14} className="text-emerald-600 shrink-0" />
                            <span>تغییر رمز</span>
                        </button>

                        <button 
                            type="button"
                            id="btn-save-settings-top"
                            onClick={handleManualSaveChanges}
                            disabled={isSavingChanges}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-slate-400 text-white font-black text-xs sm:text-sm px-4 sm:px-6 py-1.5 sm:py-2 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
                        >
                            {isSavingChanges ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin shrink-0" />
                                    <span>در حال ذخیره...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={15} className="shrink-0" />
                                    <span>ذخیره تغییرات</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Success / Error Notification */}
                {saveNotice && (
                    <div className={`p-4 rounded-xl shadow-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 ${
                        saveNotice.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                    }`}>
                        <div className="flex items-center gap-2.5 font-bold text-sm">
                            {saveNotice.type === 'success' ? (
                                <CheckCircle2 size={20} className="shrink-0 text-emerald-100" />
                            ) : (
                                <AlertCircle size={20} className="shrink-0 text-red-100" />
                            )}
                            <span>{saveNotice.message}</span>
                        </div>
                        <button 
                            type="button"
                            onClick={() => setSaveNotice(null)} 
                            className="text-white/80 hover:text-white p-1 cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}

                {/* --- TAB 1: تنظیمات جنرال --- */}
                {settingsSubTab === 'general' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        {/* Network & Dual Sync Status Card */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-4 sm:p-5">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                                <Server size={20} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm sm:text-base font-bold text-slate-900">وضعیت همگام‌سازی شبکه (Direct Server Sync)</h3>
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        سرور مستقیم فعال است (بدون فیلترشکن)
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    جهت رفع اختلال مسدود بودن فایربیس روی شبکه برخی همکاران، همگام‌سازی مستقیماً از طریق سرور اختصاصی برنامه انجام می‌شود و پرسنل بدون فیلترشکن به جدیدترین نسخه شیفت‌ها دسترسی دارند.
                                </p>
                                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-600 flex-wrap">
                                    <span className="inline-flex items-center gap-1">
                                        <span className={`w-2 h-2 rounded-full ${syncDetails.serverConnected ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                        سرور داخلی برنامه: <strong>{syncDetails.serverConnected ? 'متصل و زنده' : 'آماده به کار'}</strong>
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="inline-flex items-center gap-1">
                                        <span className={`w-2 h-2 rounded-full ${syncDetails.firestoreConnected ? 'bg-emerald-500' : (syncDetails.isQuotaExhausted ? 'bg-amber-400' : 'bg-slate-400')}`}></span>
                                        دیتابیس ابری فایربیس: <strong>{syncDetails.firestoreConnected ? 'متصل' : (syncDetails.isQuotaExhausted ? 'سهمیه روزانه تکمیل (سرور مستقیم فعال است)' : 'قفل شبکه (سرور مستقیم فعال است)')}</strong>
                                    </span>
                                    {syncDetails.lastSyncTime && (
                                        <>
                                            <span className="text-slate-300">•</span>
                                            <span>آخرین همگام‌سازی: <strong>{syncDetails.lastSyncTime}</strong></span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleForceSync}
                            disabled={isForceSyncing}
                            className="w-full md:w-auto flex items-center justify-center gap-1.5 text-xs text-slate-700 hover:text-blue-700 bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 transition font-bold px-3.5 py-2 rounded-xl cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
                            title="دریافت آنی آخرین وضعیت شیفت‌ها از سرور"
                        >
                            <RefreshCw size={14} className={isForceSyncing ? 'animate-spin text-blue-600' : 'text-slate-500'} />
                            <span>{isForceSyncing ? 'در حال همگام‌سازی...' : 'بروزرسانی از سرور'}</span>
                        </button>
                    </div>
                </div>

                        {/* 4. Next Month Generation (Manual) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <CalendarPlus className="text-purple-500" size={20} />
                            تولید تقویم آینده
                        </h2>
                        <span className="text-xs bg-white border px-2 py-1 rounded text-slate-500">هوشمند</span>
                    </div>
                    
                    <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-slate-600 leading-6">
                            <p>اگر می‌خواهید برنامه ماه‌های آینده را از هم‌اکنون تولید کنید، از این بخش استفاده کنید.</p>
                            <p className="text-xs text-slate-400">سیستم به صورت خودکار آخرین ماه موجود را شناسایی کرده و ماه بعد از آن را تولید می‌کند.</p>
                        </div>
                        <button 
                            onClick={handleManualAddNextMonth}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-md flex items-center gap-2 whitespace-nowrap"
                        >
                            <CalendarPlus size={18} />
                            ایجاد برنامه {nextGenInfo.label} {nextGenInfo.year}
                        </button>
                    </div>
                </div>

                        <DataManagement 
                    currentData={{ schedule, personnel: personnelList, lockedMonths: unlockedMonths, publishedRange, dailyProcesses, processDefinitions, showProcessSchedule }} 
                    onImport={handleImport}
                    onStagePreview={handleStagePreview}
                    onReset={handleReset}
                />
                    </div>
                )}

                {/* --- TAB 2: شیفت --- */}
                {settingsSubTab === 'shifts' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        {/* 1. Experts Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Users className="text-amber-500" size={20} />
                            لیست کارشناسان
                        </h2>
                        <span className="text-xs bg-white border px-2 py-1 rounded text-slate-500">کارشناس</span>
                    </div>
                    
                    <div className="p-4 sm:p-6 space-y-6">
                        {/* Toggle Add Form */}
                        {!isAddingShiftPerson ? (
                             <button 
                                onClick={() => handleStartAddingPersonnel('Shift')}
                                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition flex items-center justify-center gap-2"
                             >
                                <Plus size={20} />
                                افزودن کارشناس جدید
                             </button>
                        ) : (
                            <div className="flex gap-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in slide-in-from-top-2">
                                <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="نام کارشناس جدید..." 
                                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 bg-white"
                                    value={newPersonName}
                                    onChange={(e) => setNewPersonName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddPersonnel('Shift')}
                                />
                                <button 
                                    onClick={() => { setIsAddingShiftPerson(false); setNewPersonName(''); }}
                                    className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-3 py-2 rounded-lg transition"
                                    title="انصراف"
                                >
                                    <X size={18} />
                                </button>
                                <button 
                                    onClick={() => handleAddPersonnel('Shift')}
                                    className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition font-bold text-sm"
                                >
                                    <Check size={18} />
                                    تایید
                                </button>
                            </div>
                        )}

                        {/* List */}
                        <div className="space-y-2">
                            {personnelList.filter(p => p.roles.includes('Shift')).map((person) => (
                                <div key={person.name} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-amber-200 hover:shadow-sm transition-all group relative">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${person.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                        
                                        {/* Distinct Vibrant Color Indicator with direct customization */}
                                        <label className="relative cursor-pointer group/color shrink-0" title="تغییر رنگ اختصاصی در نمودار">
                                            <div 
                                                className="w-4 h-4 rounded-full border border-black/15 shadow-xs shrink-0 ring-2 ring-white group-hover/color:scale-125 transition-transform"
                                                style={{ backgroundColor: person.color || getPersonColor(person.name, personnelList) }}
                                            />
                                            <input 
                                                type="color" 
                                                value={person.color || getPersonColor(person.name, personnelList)}
                                                onChange={(e) => handleColorChange(person.name, e.target.value)}
                                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full pointer-events-auto"
                                            />
                                        </label>

                                        <span className={`font-medium ${person.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                                            {person.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => movePersonnel(person.name, 'up', 'Shift')}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                            title="بالا"
                                        >
                                            <ArrowUp size={16} />
                                        </button>
                                        <button 
                                            onClick={() => movePersonnel(person.name, 'down', 'Shift')}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                            title="پایین"
                                        >
                                            <ArrowDown size={16} />
                                        </button>
                                        <div className="w-px h-4 bg-slate-200 mx-1"></div>
                                        <button 
                                            onClick={() => handleToggleActive(person.name)}
                                            className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                                        >
                                            {person.isActive ? 'غیرفعال' : 'فعال'}
                                        </button>
                                        <button 
                                            onClick={() => handleRemovePersonnel(person.name)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2. Supervisors Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <UserCog className="text-emerald-500" size={20} />
                            لیست سرپرستان
                        </h2>
                        <span className="text-xs bg-white border px-2 py-1 rounded text-slate-500">سرپرست</span>
                    </div>
                    
                    <div className="p-4 sm:p-6 space-y-6">
                        {/* Toggle Add Form */}
                        {!isAddingSupervisor ? (
                             <button 
                                onClick={() => handleStartAddingPersonnel('Supervisor')}
                                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition flex items-center justify-center gap-2"
                             >
                                <Plus size={20} />
                                افزودن سرپرست جدید
                             </button>
                        ) : (
                            <div className="flex gap-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in slide-in-from-top-2">
                                <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="نام سرپرست جدید..." 
                                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 bg-white"
                                    value={newPersonName}
                                    onChange={(e) => setNewPersonName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddPersonnel('Supervisor')}
                                />
                                <button 
                                    onClick={() => { setIsAddingSupervisor(false); setNewPersonName(''); }}
                                    className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-3 py-2 rounded-lg transition"
                                    title="انصراف"
                                >
                                    <X size={18} />
                                </button>
                                <button 
                                    onClick={() => handleAddPersonnel('Supervisor')}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition font-bold text-sm"
                                >
                                    <Check size={18} />
                                    تایید
                                </button>
                            </div>
                        )}

                        {/* List */}
                        <div className="space-y-2">
                            {personnelList.filter(p => p.roles.includes('Supervisor')).map((person) => (
                                <div key={person.name} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-emerald-200 hover:shadow-sm transition-all group relative">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${person.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                        
                                        {/* Distinct Vibrant Color Indicator with direct customization */}
                                        <label className="relative cursor-pointer group/color shrink-0" title="تغییر رنگ اختصاصی در نمودار">
                                            <div 
                                                className="w-4 h-4 rounded-full border border-black/15 shadow-xs shrink-0 ring-2 ring-white group-hover/color:scale-125 transition-transform"
                                                style={{ backgroundColor: person.color || getPersonColor(person.name, personnelList) }}
                                            />
                                            <input 
                                                type="color" 
                                                value={person.color || getPersonColor(person.name, personnelList)}
                                                onChange={(e) => handleColorChange(person.name, e.target.value)}
                                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full pointer-events-auto"
                                            />
                                        </label>

                                        <span className={`font-medium ${person.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                                            {person.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => movePersonnel(person.name, 'up', 'Supervisor')}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                            title="بالا"
                                        >
                                            <ArrowUp size={16} />
                                        </button>
                                        <button 
                                            onClick={() => movePersonnel(person.name, 'down', 'Supervisor')}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                            title="پایین"
                                        >
                                            <ArrowDown size={16} />
                                        </button>
                                        <div className="w-px h-4 bg-slate-200 mx-1"></div>
                                        <button 
                                            onClick={() => handleToggleActive(person.name)}
                                            className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                                        >
                                            {person.isActive ? 'غیرفعال' : 'فعال'}
                                        </button>
                                        <button 
                                            onClick={() => handleRemovePersonnel(person.name)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 3. Shift Management Tool (Combined Swap + Edit) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Edit className="text-blue-500" size={20} />
                            مدیریت و ویرایش شیفت‌ها
                        </h2>
                        <span className="text-xs bg-white border px-2 py-1 rounded text-slate-500 font-medium">جابجایی، ویرایش و شیفت‌های چندنفره</span>
                    </div>
                    
                    <div className="p-6 space-y-8">
                        {/* SECTION A: Single Date Edit */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 border-b pb-2">
                                <CalendarIcon size={16} />
                                مدیریت و تنظیمات روزانه شیفت‌ها (جابجایی، سرپرست و نفرات کمکی)
                            </h3>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">انتخاب تاریخ</label>
                                <div className="flex items-center gap-2">
                                    <select 
                                        className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                                        value={swapTool.date}
                                        onChange={(e) => updateSwapTool({date: e.target.value, targetPerson: '', supervisorTarget: ''})}
                                    >
                                        <option value="">انتخاب کنید...</option>
                                        {currentMonthData.map(s => {
                                            const totalExtras = (s.extraDayPersons?.length || 0) + (s.extraNightPersons?.length || 0);
                                            return (
                                                <option key={s.id} value={s.date}>
                                                    {s.dayName} - {toPersianDigits(s.date)} {totalExtras > 0 ? `⭐ [چندنفره: ${toPersianDigits(totalExtras + 2)} نفر]` : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                {currentMonthData.filter(s => (s.extraDayPersons?.length || 0) + (s.extraNightPersons?.length || 0) > 0).length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                                            <Users size={12} className="text-indigo-600" />
                                            <span>روزهای دارای شیفت چندنفره در این ماه:</span>
                                        </span>
                                        {currentMonthData.filter(s => (s.extraDayPersons?.length || 0) + (s.extraNightPersons?.length || 0) > 0).map(d => (
                                            <button
                                                key={d.id}
                                                type="button"
                                                onClick={() => updateSwapTool({date: d.date, targetPerson: '', supervisorTarget: ''})}
                                                className={`text-[11px] font-bold px-2 py-0.5 rounded border transition cursor-pointer flex items-center gap-1 ${
                                                    swapTool.date === d.date
                                                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                                                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                                                }`}
                                            >
                                                <span>{toPersianDigits(d.date.split('/').slice(1).join('/'))}</span>
                                                <span className="text-[9px] opacity-85 font-black">
                                                    ({toPersianDigits((d.extraDayPersons?.length || 0) + (d.extraNightPersons?.length || 0) + 2)}نفر)
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {swapTool.date && currentSwapEntry && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* 3.1 Smart Swap (Day/Night) */}
                                        <div className="space-y-4">
                                            <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                                <ArrowRightLeft size={16} className="text-amber-500"/>
                                                جابجایی شیفت (هوشمند)
                                            </h3>
                                            
                                            <div className="flex bg-white p-1 rounded-lg border border-slate-200">
                                                <button 
                                                    onClick={() => updateSwapTool({shiftType: 'Day'})}
                                                    className={`flex-1 py-1.5 text-xs rounded-md transition font-medium ${swapTool.shiftType === 'Day' ? 'bg-amber-100 text-amber-900' : 'text-slate-500'}`}
                                                >
                                                    شیفت روز
                                                </button>
                                                <button 
                                                    onClick={() => updateSwapTool({shiftType: 'Night'})}
                                                    className={`flex-1 py-1.5 text-xs rounded-md transition font-medium ${swapTool.shiftType === 'Night' ? 'bg-indigo-100 text-indigo-900' : 'text-slate-500'}`}
                                                >
                                                    شیفت شب
                                                </button>
                                            </div>

                                            <div className="text-xs space-y-2">
                                                <div className="flex justify-between text-slate-600">
                                                    <span>شخص فعلی:</span>
                                                    <span className="font-bold">{swapTool.shiftType === 'Day' ? currentSwapEntry.dayShiftPerson : currentSwapEntry.nightShiftPerson}</span>
                                                </div>
                                                 <div className="flex items-center gap-2">
                                                    <span className="whitespace-nowrap">جایگزین:</span>
                                                    <select 
                                                        className="w-full bg-white text-slate-900 border border-slate-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                                                        value={swapTool.targetPerson}
                                                        onChange={(e) => updateSwapTool({targetPerson: e.target.value})}
                                                    >
                                                        <option value="">انتخاب...</option>
                                                        {allEligibleShiftWorkers.map(name => (
                                                            <option key={name} value={name}>{name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {!isSwapReady ? (
                                                <button 
                                                    onClick={handleValidateSwap}
                                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 rounded-lg transition"
                                                >
                                                    بررسی قوانین
                                                </button>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => setIsSwapReady(false)}
                                                        className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium py-2 rounded-lg transition"
                                                    >
                                                        انصراف
                                                    </button>
                                                    <button 
                                                        onClick={handleApplySwap}
                                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-2 rounded-lg transition flex items-center justify-center gap-1"
                                                    >
                                                        <Check size={14} />
                                                        تایید نهایی
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* 3.2 Other Edits (Supervisor & Holiday) */}
                                        <div className="space-y-4">
                                            {/* Supervisor Edit */}
                                            <div className="space-y-3">
                                                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                                    <UserCog size={16} className="text-emerald-500"/>
                                                    تغییر سرپرست
                                                </h3>
                                                <div className="text-xs space-y-2">
                                                    <div className="flex justify-between text-slate-600">
                                                        <span>سرپرست فعلی:</span>
                                                        <span className="font-bold">{currentSwapEntry.onCallPerson}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <select 
                                                            className="w-full bg-white text-slate-900 border border-slate-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-500 outline-none"
                                                            value={swapTool.supervisorTarget}
                                                            onChange={(e) => setSwapTool({...swapTool, supervisorTarget: e.target.value})}
                                                        >
                                                            <option value="">انتخاب سرپرست جدید...</option>
                                                            {supervisors.map(s => (
                                                                <option key={s} value={s}>{s}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={handleUpdateSupervisor}
                                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-2 rounded-lg transition"
                                                >
                                                    تغییر سرپرست
                                                </button>
                                            </div>

                                            {/* Holiday Toggle */}
                                            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                                                <div>
                                                    <h3 className="font-bold text-slate-700 text-sm">وضعیت تعطیلی</h3>
                                                    <p className={`text-xs mt-1 font-medium ${currentSwapEntry.isHoliday ? 'text-red-500' : 'text-slate-500'}`}>
                                                        {currentSwapEntry.isHoliday ? 'تعطیل است' : 'روز کاری عادی'}
                                                    </p>
                                                </div>
                                                <button 
                                                    onClick={handleToggleHolidaySetting}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                                                        currentSwapEntry.isHoliday 
                                                        ? 'bg-white border-red-200 text-red-600 hover:bg-red-50' 
                                                        : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                                                    }`}
                                                >
                                                    {currentSwapEntry.isHoliday ? 'حذف تعطیلی' : 'تنظیم به عنوان تعطیل'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3.3 Multi-person Shift Assignment (2-person or 3-person shifts) */}
                                    <div className="pt-5 border-t border-slate-200">
                                        <div className="bg-gradient-to-r from-orange-50/70 via-white to-indigo-50/70 p-4 rounded-xl border border-slate-200">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                                                        <UserPlus size={18} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm">تنظیم شیفت چندنفره (۲ یا ۳ نفره)</h4>
                                                        <p className="text-[11px] text-slate-500">افزودن یا حذف نفر دوم و سوم برای شیفت روز یا شب در تاریخ {currentSwapEntry.date}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                                {/* Day shift multi-person */}
                                                <div className="bg-white p-3 rounded-lg border border-orange-200/80 shadow-2xs space-y-2.5">
                                                    <div className="flex items-center justify-between border-b border-orange-100 pb-2">
                                                        <span className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                                            شیفت روز:
                                                        </span>
                                                        <span className="text-xs font-black text-orange-900 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                                                            اصلی: {currentSwapEntry.dayShiftPerson}
                                                        </span>
                                                    </div>

                                                    {/* Extra day members */}
                                                    <div className="space-y-1.5 min-h-[32px]">
                                                        {currentSwapEntry.extraDayPersons && currentSwapEntry.extraDayPersons.length > 0 ? (
                                                            currentSwapEntry.extraDayPersons.map((extraPerson, extraIdx) => (
                                                                <div key={extraIdx} className="flex items-center justify-between bg-orange-50/80 border border-orange-200 px-2 py-1 rounded text-xs">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="font-bold text-orange-950">{extraPerson}</span>
                                                                        <span className="text-[10px] text-orange-700 bg-orange-200/70 px-1.5 rounded-full font-black">
                                                                            {extraIdx === 0 ? 'نفر دوم' : 'نفر سوم'}
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleRemoveExtraPerson(currentSwapEntry.id, 'Day', extraPerson)}
                                                                        className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-50 transition"
                                                                        title="حذف از شیفت"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-[11px] text-slate-400 italic py-1 text-center">در حال حاضر تک‌نفره است.</p>
                                                        )}
                                                    </div>

                                                    {/* Add extra person select */}
                                                    {(!currentSwapEntry.extraDayPersons || currentSwapEntry.extraDayPersons.length < 2) && (
                                                        <div className="pt-1.5 border-t border-slate-100">
                                                            <div className="flex items-center gap-1.5">
                                                                <select 
                                                                    id="select-add-extra-day"
                                                                    className="flex-1 bg-white text-slate-900 border border-slate-300 rounded-md px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-orange-400"
                                                                    defaultValue=""
                                                                    onChange={(e) => {
                                                                        if (e.target.value) {
                                                                            handleAddExtraPerson(currentSwapEntry.id, 'Day', e.target.value);
                                                                            e.target.value = "";
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="" disabled>+ افزودن نفر کمکی به روز...</option>
                                                                    {allEligibleShiftWorkers
                                                                        .filter(p => p !== currentSwapEntry.dayShiftPerson && !(currentSwapEntry.extraDayPersons || []).includes(p))
                                                                        .map(p => (
                                                                            <option key={p} value={p}>{p}</option>
                                                                        ))
                                                                    }
                                                                </select>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Night shift multi-person */}
                                                <div className="bg-white p-3 rounded-lg border border-indigo-200/80 shadow-2xs space-y-2.5">
                                                    <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                                                        <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                                                            شیفت شب:
                                                        </span>
                                                        <span className="text-xs font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                                            اصلی: {currentSwapEntry.nightShiftPerson}
                                                        </span>
                                                    </div>

                                                    {/* Extra night members */}
                                                    <div className="space-y-1.5 min-h-[32px]">
                                                        {currentSwapEntry.extraNightPersons && currentSwapEntry.extraNightPersons.length > 0 ? (
                                                            currentSwapEntry.extraNightPersons.map((extraPerson, extraIdx) => (
                                                                <div key={extraIdx} className="flex items-center justify-between bg-indigo-50/80 border border-indigo-200 px-2 py-1 rounded text-xs">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="font-bold text-indigo-950">{extraPerson}</span>
                                                                        <span className="text-[10px] text-indigo-700 bg-indigo-200/70 px-1.5 rounded-full font-black">
                                                                            {extraIdx === 0 ? 'نفر دوم' : 'نفر سوم'}
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleRemoveExtraPerson(currentSwapEntry.id, 'Night', extraPerson)}
                                                                        className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-50 transition"
                                                                        title="حذف از شیفت"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-[11px] text-slate-400 italic py-1 text-center">در حال حاضر تک‌نفره است.</p>
                                                        )}
                                                    </div>

                                                    {/* Add extra person select */}
                                                    {(!currentSwapEntry.extraNightPersons || currentSwapEntry.extraNightPersons.length < 2) && (
                                                        <div className="pt-1.5 border-t border-slate-100">
                                                            <div className="flex items-center gap-1.5">
                                                                <select 
                                                                    id="select-add-extra-night"
                                                                    className="flex-1 bg-white text-slate-900 border border-slate-300 rounded-md px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-400"
                                                                    defaultValue=""
                                                                    onChange={(e) => {
                                                                        if (e.target.value) {
                                                                            handleAddExtraPerson(currentSwapEntry.id, 'Night', e.target.value);
                                                                            e.target.value = "";
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="" disabled>+ افزودن نفر کمکی به شب...</option>
                                                                    {allEligibleShiftWorkers
                                                                        .filter(p => p !== currentSwapEntry.nightShiftPerson && !(currentSwapEntry.extraNightPersons || []).includes(p))
                                                                        .map(p => (
                                                                            <option key={p} value={p}>{p}</option>
                                                                        ))
                                                                    }
                                                                </select>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {swapMessage && (
                                        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${swapMessage.type === 'error' ? 'bg-red-50 text-red-700' : (swapMessage.type === 'info' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700')}`}>
                                            {swapMessage.type === 'error' ? <AlertCircle size={18} /> : (swapMessage.type === 'info' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />)}
                                            {swapMessage.text}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* SECTION B: Batch Edit (Month Table) */}
                        <div className="space-y-4 pt-6 border-t border-slate-200">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <TableIcon size={16} />
                                ویرایش گروهی (نمای ماهانه)
                            </h3>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">انتخاب ماه جهت نمایش لیست کامل</label>
                                <select 
                                    className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={editViewMonth}
                                    onChange={(e) => setEditViewMonth(e.target.value)}
                                >
                                    <option value="">انتخاب ماه...</option>
                                    {availableMonths.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {editViewMonth && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 bg-indigo-50/90 text-indigo-900 border border-indigo-200/90 rounded-xl p-2.5 text-xs shadow-2xs">
                                        <Sparkles size={16} className="text-indigo-600 shrink-0" />
                                        <span><strong>چرخش خودکار:</strong> با انتخاب نام کارشناس برای شیفت شب، نام ایشان به صورت خودکار برای شیفت روزِ ۲ روز بعد تنظیم می‌شود (کاملاً قابل ویرایش و تعویض دستی).</span>
                                    </div>
                                    <div className="overflow-x-auto max-h-[500px] rounded-lg border border-slate-200">
                                    <table className="w-full text-xs text-center border-collapse">
                                        <thead className="bg-slate-50 text-slate-700 sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="p-2 border-b">روز</th>
                                                <th className="p-2 border-b">تاریخ</th>
                                                <th className="p-2 border-b">شیفت روز</th>
                                                <th className="p-2 border-b">شیفت شب</th>
                                                <th className="p-2 border-b">سرپرست</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {schedule.filter(s => s.date.startsWith(editViewMonth)).map(entry => (
                                                <tr key={entry.id} className="hover:bg-slate-50 transition">
                                                    <td className={`p-2 ${entry.dayName === 'جمعه' || entry.isHoliday ? 'text-red-500 font-bold' : ''}`}>
                                                        {entry.dayName}
                                                    </td>
                                                    <td className="p-2 font-mono text-slate-500">{entry.date}</td>
                                                    <td className="p-1">
                                                        <div className="space-y-1">
                                                            <select 
                                                                className="w-full p-1 bg-white text-slate-900 border border-slate-200 rounded focus:border-amber-400 outline-none text-xs"
                                                                value={entry.dayShiftPerson}
                                                                onChange={(e) => handleUpdateShift(entry.id, 'dayShiftPerson', e.target.value)}
                                                            >
                                                                {allEligibleShiftWorkers.map(s => <option key={s} value={s}>{s}</option>)}
                                                            </select>
                                                            {entry.extraDayPersons && entry.extraDayPersons.map((extra, idx) => (
                                                                <div key={idx} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 text-[10px]">
                                                                    <span className="font-bold text-orange-900 truncate">{extra} ({idx === 0 ? 'نفر ۲' : 'نفر ۳'})</span>
                                                                    <button
                                                                        onClick={() => handleRemoveExtraPerson(entry.id, 'Day', extra)}
                                                                        className="text-red-500 hover:text-red-700 ml-1"
                                                                        title="حذف"
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="p-1">
                                                        <div className="space-y-1">
                                                            <select 
                                                                className="w-full p-1 bg-white text-slate-900 border border-slate-200 rounded focus:border-indigo-400 outline-none text-xs"
                                                                value={entry.nightShiftPerson}
                                                                onChange={(e) => handleUpdateShift(entry.id, 'nightShiftPerson', e.target.value)}
                                                            >
                                                                {allEligibleShiftWorkers.map(s => <option key={s} value={s}>{s}</option>)}
                                                            </select>
                                                            {entry.extraNightPersons && entry.extraNightPersons.map((extra, idx) => (
                                                                <div key={idx} className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 text-[10px]">
                                                                    <span className="font-bold text-indigo-900 truncate">{extra} ({idx === 0 ? 'نفر ۲' : 'نفر ۳'})</span>
                                                                    <button
                                                                        onClick={() => handleRemoveExtraPerson(entry.id, 'Night', extra)}
                                                                        className="text-red-500 hover:text-red-700 ml-1"
                                                                        title="حذف"
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="p-1">
                                                        <select 
                                                            className="w-full p-1 bg-white text-slate-900 border border-slate-200 rounded focus:border-emerald-400 outline-none"
                                                            value={entry.onCallPerson}
                                                            onChange={(e) => handleUpdateShift(entry.id, 'onCallPerson', e.target.value)}
                                                        >
                                                            {supervisors.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                    </div>
                )}

                {/* --- TAB 3: پروسه --- */}
                {settingsSubTab === 'processes' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        {/* 5. Process Module Visibility & Toggle Setting */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                                <FlaskConical size={18} />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                                    نمایش برنامه پروسه‌ها در داشبورد
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    کنترل نمایش یا پنهان‌سازی کل بخش فرآیندهای تولید، بیوراکتورها و جدول پروسه‌ها در داشبورد اصلی
                                </p>
                            </div>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-bold border transition-colors ${
                            showProcessSchedule 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs' 
                                : 'bg-rose-50 text-rose-700 border-rose-200 shadow-2xs'
                        }`}>
                            {showProcessSchedule ? '● فعال و در حال نمایش در داشبورد' : '○ غیرفعال و پنهان از داشبورد'}
                        </span>
                    </div>
                    
                    <div className="p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl space-y-2.5">
                            <p className="font-bold text-slate-800 text-sm">
                                کلید فعال‌سازی و حذف برنامه پروسه‌ها از صفحه اصلی
                            </p>
                            <p className="text-xs text-slate-500 leading-6">
                                با خاموش کردن این کلید، جدول فرآیندهای روزانه در پایین داشبورد، بنر پروسه امروز در وضعیت زنده، نشانگرهای فرآیند روی روزهای تقویم و پنجره مدیریت پروسه‌ها کاملاً از صفحه داشبورد برداشته می‌شوند و صفحه تنها به شیفت‌ها، ساعات کارکرد و نمودارها اختصاص می‌یابد.
                            </p>
                            <div className="flex items-center gap-2 bg-emerald-50/90 text-emerald-900 text-[11px] font-bold p-3 rounded-xl border border-emerald-200/80">
                                <Sparkles size={16} className="text-emerald-600 shrink-0" />
                                <span>
                                    <strong>حفظ ۱۰۰٪ داده‌ها:</strong> با خاموش کردن این گزینه هیچ داده یا تنظیمی پاک نخواهد شد؛ تمام فرآیندها در پایگاه داده باقی مانده و با روشن کردن مجدد کلید، دقیقاً به همان شکل در داشبورد ظاهر می‌شوند.
                                </span>
                            </div>
                        </div>

                        {/* Interactive Switch Toggle */}
                        <div className="flex flex-col items-center md:items-end gap-2 shrink-0 w-full md:w-auto p-4 md:p-0 bg-slate-50 md:bg-transparent rounded-xl border md:border-0 border-slate-100">
                            <button
                                type="button"
                                role="switch"
                                aria-checked={showProcessSchedule}
                                onClick={() => handleToggleProcessSchedule(!showProcessSchedule)}
                                className={`w-20 h-10 flex items-center rounded-full p-1.5 cursor-pointer transition-all duration-200 shadow-inner ${
                                    showProcessSchedule 
                                        ? 'bg-emerald-600 justify-end ring-2 ring-emerald-500/20' 
                                        : 'bg-slate-300 justify-start'
                                }`}
                                title={showProcessSchedule ? 'برای برداشتن برنامه پروسه‌ها از داشبورد کلیک کنید' : 'برای فعال‌سازی و بازگرداندن برنامه پروسه‌ها به داشبورد کلیک کنید'}
                            >
                                <span className="bg-white w-7 h-7 rounded-full shadow-md flex items-center justify-center transition-all">
                                    {showProcessSchedule ? (
                                        <Check size={14} className="text-emerald-600 stroke-[3]" />
                                    ) : (
                                        <X size={14} className="text-slate-400 stroke-[3]" />
                                    )}
                                </span>
                            </button>
                            <span className={`text-xs font-black ${showProcessSchedule ? 'text-emerald-700' : 'text-slate-500'}`}>
                                {showProcessSchedule ? 'روشن (نمایش در داشبورد)' : 'خاموش (پنهان از داشبورد)'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Industrial Bioprocess & Bioreactor Definition Settings */}
                <ProcessSettings 
                    processDefinitions={processDefinitions}
                    onSaveDefinitions={handleSaveProcessDefinitions}
                    isUnlocked={isSettingsUnlocked}
                    onOpenUnlockModal={() => setIsPasswordModalOpen(true)}
                />
                    </div>
                )}

                {/* Bottom Action Panel */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-right">
                        <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                            <Save className="text-emerald-600" size={20} />
                            اعمال و ذخیره نهایی کلیه تغییرات
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            با کلیک روی این دکمه، تمام تنظیمات و جابجایی‌ها به صورت آنی در دیتابیس ابری ثبت شده و به همه بازدیدکنندگان نمایش داده می‌شود.
                        </p>
                    </div>

                    <button 
                        type="button"
                        id="btn-save-settings-bottom"
                        onClick={handleManualSaveChanges}
                        disabled={isSavingChanges}
                        className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-slate-400 text-white font-black text-sm px-8 py-3.5 rounded-xl shadow-lg hover:shadow-emerald-600/25 transition-all cursor-pointer whitespace-nowrap"
                    >
                        {isSavingChanges ? (
                            <>
                                <RefreshCw size={19} className="animate-spin" />
                                <span>در حال ذخیره و اعمال تغییرات...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={19} />
                                <span>ذخیره کلیه تغییرات</span>
                            </>
                        )}
                    </button>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <PersonalReportModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)}
        schedule={currentMonthData}
        fullSchedule={schedule}
        staffList={shiftWorkers}
        monthName={`${currentMonth.name} ${currentYear.toLocaleString('fa-IR', {useGrouping:false})}`}
      />

      {/* Universal Owner Login Password Modal */}
      {isPasswordModalOpen && (
          <div 
             className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-200"
             onClick={handleClosePasswordModal}
          >
              <div 
                  className="bg-white p-6 rounded-2xl shadow-2xl border border-slate-200 text-center max-w-sm w-full animate-in zoom-in-95 relative" 
                  onClick={e => e.stopPropagation()}
              >
                  <button 
                      onClick={handleClosePasswordModal}
                      className="absolute top-3 left-3 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
                  >
                      <X size={20} />
                  </button>

                  <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-xs">
                      <Crown size={28} className="text-amber-600" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-lg mb-1">ورود</h3>
                  <p className="text-slate-600 text-xs mb-4">
                     جهت دسترسی به تنظیمات و محدودسازی بازه نمایش عمومی، لطفا رمز عبور مدیریت را وارد کنید.
                  </p>
                  
                  <div className="space-y-3">
                      <input 
                         id="settings-pwd-input"
                         type="password" 
                         className="w-full bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-center rounded-xl px-3 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none dir-ltr tracking-widest font-black transition"
                         placeholder="****"
                         value={settingsPassword}
                         onChange={e => setSettingsPassword(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && handleUnlockSettings()}
                         autoFocus
                      />
                      <div className="flex gap-2">
                          <button 
                             onClick={handleClosePasswordModal}
                             className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                              انصراف
                          </button>
                          <button 
                             onClick={handleUnlockSettings}
                             className="flex-1 bg-slate-900 text-white px-3 py-2.5 rounded-xl text-xs font-bold hover:bg-black transition shadow-md cursor-pointer"
                          >
                              ورود به عنوان مدیر
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
      {/* Floating Gemini AI Assistant (Manager Only) */}
      {isOwner && showAiAssistant && (
        <GeminiChatbot
          schedule={schedule}
          personnelList={personnelList}
          currentYear={currentYear}
          currentMonthCode={currentMonth.code}
          currentMonthName={currentMonth.name}
          isStagingPreview={isStagingPreview}
          onSavePreviewFinal={handleSaveStagingFinal}
          onCancelPreview={handleCancelStaging}
          openChatSignal={openChatSignal}
          onApplyGeneratedMonth={handleApplyAiGeneratedMonth}
          onClose={() => {
            setShowAiAssistant(false);
            try { localStorage.setItem('shiftflow_show_ai_assistant', 'false'); } catch {}
          }}
        />
      )}
      <OfflineIndicator />
    </div>
  );
};

export default App;
