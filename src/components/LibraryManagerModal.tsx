import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Search,
  Package,
  Download,
  Trash2,
  Check,
  ExternalLink,
  FolderOpen,
  RefreshCw,
  FolderArchive,
  Layers,
  Sparkles,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export interface ArduinoLibrary {
  name: string;
  version: string;
  author: string;
  maintainer?: string;
  sentence: string;
  paragraph?: string;
  website?: string;
  category?: string;
  architectures?: string[];
  provides_includes?: string[];
  installed?: boolean;
  installedVersion?: string;
}

const POPULAR_LIBRARIES: ArduinoLibrary[] = [
  {
    name: 'WebSockets',
    version: '2.7.2',
    author: 'Markus Sattler',
    sentence: 'RFC6455-based WebSockets Server & Client for ESP32 and Arduino boards.',
    website: 'https://github.com/Links2004/arduinoWebSockets',
    category: 'Communication',
    provides_includes: ['WebSocketsClient.h', 'WebSocketsServer.h', 'SocketIOclient.h'],
  },
  {
    name: 'ArduinoJson',
    version: '7.3.0',
    author: 'Benoît Blanchon',
    sentence: 'Efficient JSON library for IoT devices, REST APIs, and embedded platforms.',
    website: 'https://arduinojson.org',
    category: 'Data Processing',
    provides_includes: ['ArduinoJson.h'],
  },
  {
    name: 'PubSubClient',
    version: '2.8.0',
    author: 'Nick O\'Leary',
    sentence: 'A client library for MQTT messaging in IoT distributed systems.',
    website: 'https://pubsubclient.knolleary.net',
    category: 'Communication',
    provides_includes: ['PubSubClient.h'],
  },
  {
    name: 'DHT sensor library',
    version: '1.4.6',
    author: 'Adafruit',
    sentence: 'Arduino library for DHT11, DHT22 and AM2302 digital climate sensors.',
    website: 'https://github.com/adafruit/DHT-sensor-library',
    category: 'Sensors',
    provides_includes: ['DHT.h', 'DHT_U.h'],
  },
  {
    name: 'Adafruit GFX Library',
    version: '1.11.11',
    author: 'Adafruit',
    sentence: 'Core graphics library providing primitives for LCD, OLED, and e-paper displays.',
    website: 'https://github.com/adafruit/Adafruit-GFX-Library',
    category: 'Display',
    provides_includes: ['Adafruit_GFX.h'],
  },
  {
    name: 'Adafruit SSD1306',
    version: '2.5.13',
    author: 'Adafruit',
    sentence: 'Driver library for monochrome 128x64 and 128x32 I2C / SPI OLED displays.',
    website: 'https://github.com/adafruit/Adafruit_SSD1306',
    category: 'Display',
    provides_includes: ['Adafruit_SSD1306.h'],
  },
  {
    name: 'LiquidCrystal I2C',
    version: '1.1.2',
    author: 'Frank de Brabander',
    sentence: 'Library for character LCD displays (1602, 2004) with PCF8574 I2C adapter.',
    website: 'https://github.com/johnrickman/LiquidCrystal_I2C',
    category: 'Display',
    provides_includes: ['LiquidCrystal_I2C.h'],
  },
  {
    name: 'Servo',
    version: '1.2.2',
    author: 'Arduino',
    sentence: 'Allows Arduino boards to control RC hobby servo motors seamlessly.',
    website: 'https://www.arduino.cc/en/Reference/Servo',
    category: 'Device Control',
    provides_includes: ['Servo.h'],
  },
  {
    name: 'Adafruit NeoPixel',
    version: '1.12.3',
    author: 'Adafruit',
    sentence: 'Control WS2811, WS2812, WS2812B, and SK6812 addressable RGB LEDs.',
    website: 'https://github.com/adafruit/Adafruit_NeoPixel',
    category: 'Display',
    provides_includes: ['Adafruit_NeoPixel.h'],
  },
  {
    name: 'RTClib',
    version: '2.1.4',
    author: 'Adafruit',
    sentence: 'Real-time clock library for DS1307, DS3231, and PCF8523 modules.',
    website: 'https://github.com/adafruit/RTClib',
    category: 'Timing',
    provides_includes: ['RTClib.h'],
  },
];

export interface LibraryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstalledChange?: () => void;
}

export const LibraryManagerModal: React.FC<LibraryManagerModalProps> = ({
  isOpen,
  onClose,
  onInstalledChange,
}) => {
  const [activeTab, setActiveTab] = useState<'popular' | 'installed' | 'search'>('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ArduinoLibrary[]>([]);
  const [installedLibraries, setInstalledLibraries] = useState<ArduinoLibrary[]>([]);
  const [installedMap, setInstalledMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 0-Latency Dragging via Direct DOM Transform
  const modalBoxRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });

  useEffect(() => {
    if (isOpen) {
      posRef.current = { x: 0, y: 0 };
      if (modalBoxRef.current) {
        modalBoxRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
      }
      loadInstalledLibraries();
    }
  }, [isOpen]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select')) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: posRef.current.x,
      startY: posRef.current.y,
    };

    const header = e.currentTarget as HTMLElement;
    header.setPointerCapture(e.pointerId);

    const onPointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - dragStartRef.current.mouseX;
      const dy = ev.clientY - dragStartRef.current.mouseY;
      posRef.current = {
        x: dragStartRef.current.startX + dx,
        y: dragStartRef.current.startY + dy,
      };
      if (modalBoxRef.current) {
        modalBoxRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0px)`;
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      isDraggingRef.current = false;
      try {
        header.releasePointerCapture(ev.pointerId);
      } catch {}
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const loadInstalledLibraries = async () => {
    try {
      const raw = await tauriInvoke<string>('list_installed_arduino_libraries');
      if (raw) {
        const parsed = JSON.parse(raw);
        const list: ArduinoLibrary[] = [];
        const map: Record<string, string> = {};

        if (Array.isArray(parsed.installed_libraries)) {
          for (const item of parsed.installed_libraries) {
            const lib = item.library || item;
            if (lib && lib.name) {
              const libObj: ArduinoLibrary = {
                name: lib.name,
                version: lib.version || '1.0.0',
                author: lib.author || 'Unknown',
                maintainer: lib.maintainer,
                sentence: lib.sentence || '',
                paragraph: lib.paragraph,
                website: lib.website,
                category: lib.category,
                provides_includes: lib.provides_includes || [],
                installed: true,
                installedVersion: lib.version,
              };
              list.push(libObj);
              map[lib.name.toLowerCase()] = lib.version || '1.0.0';
            }
          }
        }
        setInstalledLibraries(list);
        setInstalledMap(map);
      }
    } catch (err: any) {
      console.warn('Failed to list installed libraries:', err);
    }
  };

  const searchSeqRef = useRef(0);

  // High-performance Debounced search with sequence tracking to prevent out-of-order race conditions
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setIsLoading(false);
      if (activeTab === 'search') {
        setActiveTab('popular');
      }
      return;
    }

    setActiveTab('search');
    const seq = ++searchSeqRef.current;

    const timer = setTimeout(async () => {
      if (seq !== searchSeqRef.current) return;
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const raw = await tauriInvoke<string>('search_arduino_libraries', { query: q });
        if (seq !== searchSeqRef.current) return;
        if (raw) {
          const parsed = JSON.parse(raw);
          const results: ArduinoLibrary[] = [];
          if (Array.isArray(parsed.libraries)) {
            for (const item of parsed.libraries.slice(0, 50)) {
              const latest = item.latest || {};
              const name = item.name || latest.name;
              if (name) {
                results.push({
                  name,
                  version: latest.version || 'Latest',
                  author: latest.author || item.author || 'Community',
                  sentence: latest.sentence || item.sentence || '',
                  paragraph: latest.paragraph,
                  website: latest.website,
                  category: latest.category || 'Contributed',
                  provides_includes: latest.provides_includes || [],
                });
              }
            }
          }
          setSearchResults(results);
        }
      } catch (err: any) {
        if (seq === searchSeqRef.current) {
          setErrorMessage(err?.message || String(err));
        }
      } finally {
        if (seq === searchSeqRef.current) {
          setIsLoading(false);
        }
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleInstall = async (libName: string) => {
    setActionInProgress(libName);
    setErrorMessage(null);
    setStatusMessage(`Installing ${libName} via arduino-cli...`);
    try {
      await tauriInvoke<string>('install_arduino_library', { name: libName });
      await loadInstalledLibraries();
      setStatusMessage(`Successfully installed ${libName}`);
      onInstalledChange?.();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to install ${libName}: ${err?.message || err}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUninstall = async (libName: string) => {
    setActionInProgress(libName);
    setErrorMessage(null);
    setStatusMessage(`Uninstalling ${libName}...`);
    try {
      await tauriInvoke<string>('uninstall_arduino_library', { name: libName });
      await loadInstalledLibraries();
      setStatusMessage(`Successfully uninstalled ${libName}`);
      onInstalledChange?.();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to uninstall ${libName}: ${err?.message || err}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleInstallZip = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage('Selecting and installing .ZIP library...');
    try {
      const res = await tauriInvoke<string | null>('install_arduino_library_zip');
      if (res) {
        await loadInstalledLibraries();
        setStatusMessage('Library installed successfully from ZIP archive.');
        onInstalledChange?.();
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage(null);
      }
    } catch (err: any) {
      setErrorMessage(`ZIP installation error: ${err?.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFolder = () => {
    tauriInvoke('open_arduino_libraries_folder').catch(console.error);
  };

  // Determine current list to display
  const displayList = useMemo(() => {
    if (activeTab === 'installed') {
      if (!searchQuery.trim()) return installedLibraries;
      const q = searchQuery.toLowerCase();
      return installedLibraries.filter(
        (l) => l.name.toLowerCase().includes(q) || l.sentence.toLowerCase().includes(q)
      );
    }
    if (activeTab === 'search') {
      return searchResults;
    }
    // popular
    if (!searchQuery.trim()) return POPULAR_LIBRARIES;
    const q = searchQuery.toLowerCase();
    return POPULAR_LIBRARIES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.sentence.toLowerCase().includes(q)
    );
  }, [activeTab, searchQuery, installedLibraries, searchResults]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs select-none p-4"
      onClick={onClose}
    >
      <div
        ref={modalBoxRef}
        onClick={(e) => e.stopPropagation()}
        className="w-[880px] max-w-[96vw] h-[640px] max-h-[92vh] bg-[#141416] border border-[#242428] rounded-2xl shadow-2xl flex flex-col overflow-hidden outline-none will-change-transform"
        style={{ transform: 'translate3d(0px, 0px, 0px)' }}
      >
        {/* Draggable Header */}
        <div
          onPointerDown={handlePointerDown}
          className="h-11 px-4 bg-[#18181b] border-b border-[#222226] flex items-center justify-between cursor-move select-none shrink-0"
        >
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-xs tracking-tight">
            <Package className="w-4 h-4 text-zinc-400" />
            <span>Arduino Library Manager</span>
            <span className="text-[10px] text-zinc-500 font-mono">
              ({installedLibraries.length} installed)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Toolbar: Search, Filters & Actions */}
        <div className="p-3 bg-[#161619] border-b border-[#222226] space-y-2.5 shrink-0">
          <div className="flex items-center gap-2">
            {/* Search Input Box */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search official Arduino library registry (e.g. WebSockets, ArduinoJson, MQTT)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-8 text-xs bg-[#121215] border-zinc-800 text-zinc-100 placeholder:text-zinc-500 rounded-full focus-visible:border-zinc-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Install from ZIP Action */}
            <Button
              type="button"
              variant="outline"
              onClick={handleInstallZip}
              disabled={isLoading || Boolean(actionInProgress)}
              className="h-8 rounded-full border-zinc-700/80 bg-[#18181b] hover:bg-zinc-800 text-zinc-200 text-xs px-3.5 flex items-center gap-1.5 shrink-0"
              title="Install library directly from a downloaded .ZIP archive"
            >
              <FolderArchive className="w-3.5 h-3.5 text-zinc-400" />
              <span>Install .ZIP...</span>
            </Button>

            {/* Open Library Folder in Windows Explorer */}
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenFolder}
              className="h-8 rounded-full border-zinc-700/80 bg-[#18181b] hover:bg-zinc-800 text-zinc-200 text-xs px-3.5 flex items-center gap-1.5 shrink-0"
              title="Open Arduino libraries folder in Windows Explorer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
              <span>Open Folder</span>
            </Button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 p-0.5 bg-[#121215] rounded-full border border-zinc-800/80">
              <button
                type="button"
                onClick={() => setActiveTab('popular')}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'popular'
                    ? 'bg-zinc-700 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>Popular / Essential</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('installed')}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'installed'
                    ? 'bg-zinc-700 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Installed ({installedLibraries.length})</span>
              </button>

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setActiveTab('search')}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                    activeTab === 'search'
                      ? 'bg-zinc-700 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Search className="w-3 h-3" />
                  <span>Search Results ({searchResults.length})</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isLoading && (
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 animate-pulse">
                  <div className="w-2.5 h-2.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                  <span>Fetching library index...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notifications / Error Banner */}
        {statusMessage && (
          <div className="px-4 py-2 bg-emerald-950/40 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 shrink-0 animate-in fade-in duration-100">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="px-4 py-2 bg-red-950/40 border-b border-red-500/40 text-red-300 text-xs flex items-center justify-between gap-2 shrink-0 animate-in fade-in duration-100">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Content Body: Scrollable Inset Box Rows */}
        <div className="flex-1 p-3 overflow-y-auto space-y-2 scrollbar-thin">
          {displayList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500">
              <Package className="w-10 h-10 text-zinc-600 mb-2 stroke-[1.5]" />
              <div className="text-sm font-medium text-zinc-300">
                {activeTab === 'installed'
                  ? 'No libraries installed yet'
                  : isLoading
                  ? 'Searching Arduino library registry...'
                  : 'No libraries matched your query'}
              </div>
              <div className="text-xs text-zinc-500 max-w-[360px] mt-1 leading-relaxed">
                {activeTab === 'installed'
                  ? 'Install libraries from the Popular tab or search by name to add functionality to your sketches.'
                  : 'Try searching by keyword, protocol (e.g. MQTT, WebSocket, HTTP), or hardware driver.'}
              </div>
            </div>
          ) : (
            displayList.map((lib) => {
              const isInstalled = Boolean(installedMap[lib.name.toLowerCase()]);
              const installedVer = installedMap[lib.name.toLowerCase()];
              const isOperating = actionInProgress === lib.name;

              return (
                <div
                  key={lib.name}
                  className="p-3 bg-[#1c1c20] border border-zinc-800/60 rounded-xl flex items-start justify-between gap-3 hover:border-zinc-700/80 transition-all"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Title + Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-zinc-100 font-mono tracking-tight">
                        {lib.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] font-mono border-zinc-700 bg-[#121215] text-zinc-300 px-1.5 py-0.2 whitespace-nowrap [word-break:keep-all]"
                      >
                        v{lib.version}
                      </Badge>
                      {lib.category && (
                        <span className="text-[10px] text-zinc-400 font-sans">
                          • {lib.category}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-500 font-sans truncate">
                        by {lib.author}
                      </span>
                    </div>

                    {/* Description Sentence */}
                    <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                      {lib.sentence}
                    </p>

                    {/* Metadata & Provided Includes */}
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      {lib.provides_includes && lib.provides_includes.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono bg-[#121215] px-2 py-0.5 rounded-md border border-zinc-800">
                          <FileCode className="w-3 h-3 text-zinc-500" />
                          <span>#include &lt;{lib.provides_includes[0]}&gt;</span>
                          {lib.provides_includes.length > 1 && (
                            <span className="text-zinc-500">
                              (+{lib.provides_includes.length - 1} more)
                            </span>
                          )}
                        </div>
                      )}

                      {lib.website && (
                        <a
                          href={lib.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1 hover:underline transition-colors"
                        >
                          <span>Repository</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    {isInstalled ? (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-emerald-500/40 bg-emerald-950/20 text-emerald-400 text-[10px] font-medium flex items-center gap-1 px-2.5 py-1 whitespace-nowrap [word-break:keep-all]"
                        >
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Installed {installedVer ? `(v${installedVer})` : ''}</span>
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleUninstall(lib.name)}
                          disabled={isOperating}
                          className="rounded-full h-7 px-3 text-[11px] border-zinc-800 bg-[#121215] text-zinc-400 hover:text-red-400 hover:bg-red-950/30 hover:border-red-900/50 transition-colors"
                          title={`Uninstall ${lib.name}`}
                        >
                          {isOperating ? (
                            <div className="w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          <span className="ml-1">Remove</span>
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => handleInstall(lib.name)}
                        disabled={isOperating}
                        className="rounded-full h-7 px-3 text-[11px] bg-white hover:bg-zinc-200 text-zinc-950 font-semibold transition-colors shadow-xs flex items-center gap-1.5"
                      >
                        {isOperating ? (
                          <>
                            <div className="w-3 h-3 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                            <span>Installing...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3 h-3" />
                            <span>Install</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#18181b] border-t border-[#222226] flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono truncate">
            <span>Library Storage:</span>
            <span className="text-zinc-400 truncate">
              %USERPROFILE%/Documents/Arduino/libraries
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-full border-zinc-700/80 bg-transparent text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs h-7 px-4"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
