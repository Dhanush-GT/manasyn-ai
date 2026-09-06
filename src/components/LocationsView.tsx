import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  APIProvider, 
  Map, 
  Marker, 
  InfoWindow, 
  useApiLoadingStatus, 
  APILoadingStatus 
} from '@vis.gl/react-google-maps';
import { 
  MapPin, 
  Compass, 
  Search, 
  Plus, 
  Check, 
  ArrowRight, 
  Sparkles, 
  Navigation, 
  Layers, 
  Building2, 
  Coffee, 
  Home, 
  Trees, 
  Laptop,
  Globe2,
  Trash2,
  Bookmark,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import type { ReflectionEntry, UserProfile, LocationTag } from '../types';
import { isValidGoogleMapsKey, GMP_ATTRIBUTION_ID } from '../lib/maps';

interface LocationsViewProps {
  entries: ReflectionEntry[];
  activeEntry: ReflectionEntry | null;
  onSelectEntry: (entryId: string) => void;
  onUpdateEntry: (updated: ReflectionEntry) => void;
  onNewReflectionAtPlace: (place: LocationTag) => void;
  onOpenReflectionWorkspace: (entryId?: string) => void;
  user?: UserProfile;
}

// Curated Sanctuaries & Focus Spaces
export const PRESET_SANCTUARIES: LocationTag[] = [
  {
    placeName: 'Home Studio Sanctuary',
    latitude: 37.7749,
    longitude: -122.4194,
  },
  {
    placeName: 'Downtown Focus & Coffee Lab',
    latitude: 37.7885,
    longitude: -122.4072,
  },
  {
    placeName: 'Quiet Park & Botanical Garden',
    latitude: 37.7694,
    longitude: -122.4862,
  },
  {
    placeName: 'Innovation Hub & Coworking Space',
    latitude: 37.7909,
    longitude: -122.4013,
  },
  {
    placeName: 'Mountain Haven & Retreat',
    latitude: 39.0968,
    longitude: -120.0324,
  },
  {
    placeName: 'Coastal Pier & Sunset Walk',
    latitude: 37.8080,
    longitude: -122.4098,
  }
];

// Helper to get category icon for sanctuaries
const getSanctuaryIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('coffee') || lower.includes('cafe')) return Coffee;
  if (lower.includes('studio') || lower.includes('home')) return Home;
  if (lower.includes('park') || lower.includes('garden')) return Trees;
  if (lower.includes('hub') || lower.includes('coworking')) return Laptop;
  if (lower.includes('pier') || lower.includes('coastal')) return Navigation;
  return Building2;
};

/**
 * High-fidelity Interactive Spatial Vector Canvas
 * Renders an offline-capable, interactive radar & cartographic grid
 * displaying all sanctuaries and reflection pins with real geographic coordinates.
 * Activated when Google Maps API key is unconfigured or encounters auth failure.
 */
interface SpatialVectorCanvasProps {
  mappedEntries: ReflectionEntry[];
  sanctuaries: LocationTag[];
  selectedLocation: LocationTag | null;
  onSelectLocation: (loc: LocationTag) => void;
  onOpenSession: (entryId: string) => void;
}

const SpatialVectorCanvas: React.FC<SpatialVectorCanvasProps> = ({
  mappedEntries,
  sanctuaries,
  selectedLocation,
  onSelectLocation,
  onOpenSession,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute dynamic bounding box
  const allCoords = useMemo(() => {
    const coords: { lat: number; lng: number }[] = [];
    sanctuaries.forEach((s) => coords.push({ lat: s.latitude, lng: s.longitude }));
    mappedEntries.forEach((e) => {
      if (e.location) coords.push({ lat: e.location.latitude, lng: e.location.longitude });
    });
    return coords;
  }, [sanctuaries, mappedEntries]);

  const bounds = useMemo(() => {
    if (allCoords.length === 0) {
      return { minLat: 37.6, maxLat: 39.2, minLng: -122.6, maxLng: -120.0 };
    }
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    allCoords.forEach((c) => {
      if (c.lat < minLat) minLat = c.lat;
      if (c.lat > maxLat) maxLat = c.lat;
      if (c.lng < minLng) minLng = c.lng;
      if (c.lng > maxLng) maxLng = c.lng;
    });
    // Add safety margins
    const latSpan = Math.max(0.2, maxLat - minLat);
    const lngSpan = Math.max(0.3, maxLng - minLng);
    return {
      minLat: minLat - latSpan * 0.15,
      maxLat: maxLat + latSpan * 0.15,
      minLng: minLng - lngSpan * 0.15,
      maxLng: maxLng + lngSpan * 0.15,
    };
  }, [allCoords]);

  // Project lat/lng to SVG Cartesian coordinate system (800 x 500)
  const project = (lat: number, lng: number) => {
    const latNorm = (bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat);
    const lngNorm = (lng - bounds.minLng) / (bounds.maxLng - bounds.minLng);
    const x = lngNorm * 700 + 50;
    const y = latNorm * 380 + 60;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOrigin({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragOrigin.x,
      y: e.clientY - dragOrigin.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div 
      ref={containerRef}
      id="spatial-vector-canvas-root"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="w-full h-full relative overflow-hidden bg-slate-950 select-none cursor-grab active:cursor-grabbing font-sans"
      style={{
        backgroundImage: `
          radial-gradient(circle at center, rgba(99, 102, 241, 0.08) 0%, transparent 75%),
          linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 40px 40px, 40px 40px',
      }}
    >
      {/* Informative Header Badge */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-1 max-w-[calc(100%-4rem)] sm:max-w-md">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-lg text-slate-200">
          <Globe2 className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
          <span className="text-xs font-bold font-display">Spatial Coordinate Matrix</span>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Vector Mode
          </span>
        </div>
        <p className="text-[11px] text-slate-400/90 font-sans pl-1 hidden sm:block">
          Live coordinate grid active. Live Google Maps satellite tiles activate when a production Google Maps Platform API key is configured.
        </p>
      </div>

      {/* Compass Rose */}
      <div className="absolute top-3 right-3 z-20 w-10 h-10 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-md flex flex-col items-center justify-center shadow-lg pointer-events-none">
        <Compass className="w-5 h-5 text-indigo-400" />
        <span className="text-[9px] font-mono font-bold text-slate-300 leading-none mt-0.5">N</span>
      </div>

      {/* Interactive Controls Overlay */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 backdrop-blur-md p-1 rounded-xl shadow-xl">
        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.25))}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-700 mx-0.5" />
        <button
          type="button"
          onClick={resetView}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 text-[11px] font-mono font-semibold"
          title="Reset View"
          aria-label="Reset View"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Coordinate Scale Indicator */}
      <div className="absolute bottom-4 left-4 z-20 hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 backdrop-blur-md text-[10px] font-mono text-slate-400 pointer-events-none">
        <Navigation className="w-3 h-3 text-indigo-400" />
        <span>Scale: {(zoomLevel * 100).toFixed(0)}%</span>
        <span>•</span>
        <span>{allCoords.length} Nodes</span>
      </div>

      {/* SVG Canvas Stage */}
      <svg
        className="w-full h-full"
        viewBox="0 0 800 500"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="beaconGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
            <stop offset="70%" stopColor="#6366f1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="reflectionGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
            <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Dynamic Zoom & Pan Transform Container */}
        <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`} style={{ transformOrigin: '400px 250px' }}>
          
          {/* Cartographic Coordinate Grid Lines */}
          <line x1="50" y1="120" x2="750" y2="120" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
          <text x="55" y="115" fill="rgba(255,255,255,0.25)" fontSize="10" fontFamily="monospace">
            {bounds.maxLat.toFixed(2)}° N
          </text>

          <line x1="50" y1="250" x2="750" y2="250" stroke="rgba(99,102,241,0.15)" strokeDasharray="4 4" />
          <text x="55" y="245" fill="rgba(99,102,241,0.4)" fontSize="10" fontFamily="monospace">
            {((bounds.maxLat + bounds.minLat) / 2).toFixed(2)}° N (Center Line)
          </text>

          <line x1="50" y1="380" x2="750" y2="380" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
          <text x="55" y="375" fill="rgba(255,255,255,0.25)" fontSize="10" fontFamily="monospace">
            {bounds.minLat.toFixed(2)}° N
          </text>

          <line x1="200" y1="60" x2="200" y2="440" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
          <text x="205" y="435" fill="rgba(255,255,255,0.25)" fontSize="10" fontFamily="monospace">
            {bounds.minLng.toFixed(2)}° W
          </text>

          <line x1="400" y1="60" x2="400" y2="440" stroke="rgba(99,102,241,0.15)" strokeDasharray="4 4" />
          <text x="405" y="435" fill="rgba(99,102,241,0.4)" fontSize="10" fontFamily="monospace">
            {((bounds.maxLng + bounds.minLng) / 2).toFixed(2)}° W
          </text>

          <line x1="600" y1="60" x2="600" y2="440" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
          <text x="605" y="435" fill="rgba(255,255,255,0.25)" fontSize="10" fontFamily="monospace">
            {bounds.maxLng.toFixed(2)}° W
          </text>

          {/* Concentric Radar Rings around Selected Sanctuary */}
          {selectedLocation && (() => {
            const { x, y } = project(selectedLocation.latitude, selectedLocation.longitude);
            return (
              <g className="pointer-events-none">
                <circle cx={x} cy={y} r="28" fill="url(#beaconGlow)" />
                <circle cx={x} cy={y} r="45" fill="none" stroke="#6366f1" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                <circle cx={x} cy={y} r="70" fill="none" stroke="#6366f1" strokeWidth="0.75" strokeDasharray="6 6" opacity="0.25" />
              </g>
            );
          })()}

          {/* Connecting Constellation Lines between Sanctuaries */}
          {sanctuaries.map((s, i) => {
            if (i === 0) return null;
            const p1 = project(sanctuaries[i - 1].latitude, sanctuaries[i - 1].longitude);
            const p2 = project(s.latitude, s.longitude);
            return (
              <line
                key={`vector-link-${i}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="rgba(99, 102, 241, 0.12)"
                strokeWidth="1.5"
                strokeDasharray="2 4"
              />
            );
          })}

          {/* Preset Sanctuaries Vector Nodes */}
          {sanctuaries.map((sanctuary, idx) => {
            const { x, y } = project(sanctuary.latitude, sanctuary.longitude);
            const isSelected = selectedLocation?.placeName === sanctuary.placeName;

            return (
              <g
                key={`canvas-sanctuary-${idx}`}
                transform={`translate(${x}, ${y})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLocation(sanctuary);
                }}
                className="cursor-pointer group"
              >
                {/* Outer Glow Halo */}
                <circle
                  r={isSelected ? "18" : "12"}
                  fill={isSelected ? "rgba(99, 102, 241, 0.3)" : "rgba(99, 102, 241, 0.1)"}
                  className="transition-all duration-300"
                />

                {/* Core Anchor Pin */}
                <circle
                  r={isSelected ? "8" : "6"}
                  fill={isSelected ? "#818cf8" : "#6366f1"}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? "2" : "1.5"}
                  className="transition-all duration-300 shadow-md group-hover:scale-125"
                />

                {/* Label Box */}
                <g transform="translate(0, 18)" className="pointer-events-none">
                  <rect
                    x="-70"
                    y="-2"
                    width="140"
                    height="18"
                    rx="6"
                    fill={isSelected ? "rgba(30, 27, 75, 0.9)" : "rgba(15, 23, 42, 0.85)"}
                    stroke={isSelected ? "rgba(129, 140, 248, 0.6)" : "rgba(255, 255, 255, 0.15)"}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="10"
                    textAnchor="middle"
                    fill={isSelected ? "#e0e7ff" : "#cbd5e1"}
                    fontSize="9"
                    fontWeight={isSelected ? "700" : "500"}
                    fontFamily="sans-serif"
                  >
                    {sanctuary.placeName.length > 22
                      ? sanctuary.placeName.substring(0, 20) + '...'
                      : sanctuary.placeName}
                  </text>
                </g>
              </g>
            );
          })}

          {/* User Reflection Entries Nodes */}
          {mappedEntries.map((entry) => {
            if (!entry.location) return null;
            const { x, y } = project(entry.location.latitude, entry.location.longitude);
            const isSelected = selectedLocation?.placeName === entry.location.placeName;

            return (
              <g
                key={`canvas-entry-${entry.id}`}
                transform={`translate(${x}, ${y})`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (entry.location) onSelectLocation(entry.location);
                }}
                className="cursor-pointer group"
              >
                {/* Reflection Diamond Halo */}
                <polygon
                  points="0,-14 14,0 0,14 -14,0"
                  fill={isSelected ? "rgba(6, 182, 212, 0.35)" : "rgba(6, 182, 212, 0.15)"}
                  className="transition-all duration-300"
                />

                {/* Core Diamond */}
                <polygon
                  points="0,-7 7,0 0,7 -7,0"
                  fill={isSelected ? "#22d3ee" : "#06b6d4"}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="transition-all duration-300 group-hover:scale-125"
                />

                {/* Reflection Label */}
                <g transform="translate(0, -20)" className="pointer-events-none">
                  <rect
                    x="-65"
                    y="-10"
                    width="130"
                    height="16"
                    rx="5"
                    fill="rgba(8, 51, 68, 0.9)"
                    stroke="rgba(34, 211, 238, 0.5)"
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="1"
                    textAnchor="middle"
                    fill="#cffafe"
                    fontSize="8.5"
                    fontWeight="600"
                    fontFamily="sans-serif"
                  >
                    {entry.title.length > 18 ? entry.title.substring(0, 16) + '...' : entry.title}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

/**
 * Standard Google Maps Canvas with Markers
 * Used only when a valid Google Maps Platform API key is available.
 */
const MapCanvasWithMarkers: React.FC<{
  mappedEntries: ReflectionEntry[];
  selectedLocation: LocationTag | null;
  onSelectLocation: (loc: LocationTag) => void;
  center: { lat: number; lng: number };
  zoom: number;
  onOpenSession: (entryId: string) => void;
  onAuthFailure: () => void;
}> = ({
  mappedEntries,
  selectedLocation,
  onSelectLocation,
  center,
  zoom,
  onOpenSession,
  onAuthFailure,
}) => {
  const status = useApiLoadingStatus();

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
      onAuthFailure();
    }
  }, [status, onAuthFailure]);

  if (status === APILoadingStatus.LOADING || status === APILoadingStatus.NOT_LOADED) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900/90 text-slate-100 rounded-2xl relative overflow-hidden font-mono">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mb-3 animate-pulse">
          <Compass className="w-5 h-5 animate-spin" />
        </div>
        <p className="text-xs font-semibold text-slate-300">Initializing Interactive Geographic Layer...</p>
        <span className="text-[10px] text-slate-400 mt-1">Connecting to Google Maps Platform</span>
      </div>
    );
  }

  return (
    <Map
      id="locations-google-map"
      defaultCenter={center}
      defaultZoom={zoom}
      gestureHandling="greedy"
      disableDefaultUI={false}
      internalUsageAttributionIds={[GMP_ATTRIBUTION_ID]}
      className="w-full h-full rounded-2xl shadow-inner overflow-hidden"
    >
      {/* Pinned Reflections Markers */}
      {mappedEntries.map((entry) => {
        if (!entry.location) return null;
        return (
          <Marker
            key={`marker-entry-${entry.id}`}
            position={{ lat: entry.location.latitude, lng: entry.location.longitude }}
            title={entry.title || entry.location.placeName}
            onClick={() => onSelectLocation(entry.location!)}
          />
        );
      })}

      {/* Preset Sanctuaries Markers */}
      {PRESET_SANCTUARIES.map((sanctuary, idx) => {
        return (
          <Marker
            key={`marker-sanctuary-${idx}`}
            position={{ lat: sanctuary.latitude, lng: sanctuary.longitude }}
            title={sanctuary.placeName}
            onClick={() => onSelectLocation(sanctuary)}
          />
        );
      })}

      {selectedLocation && (
        <InfoWindow
          position={{ lat: selectedLocation.latitude, lng: selectedLocation.longitude }}
          onCloseClick={() => {}}
        >
          <div className="p-1 max-w-xs text-slate-900 font-sans">
            <h4 className="font-bold text-xs flex items-center gap-1.5 text-indigo-700">
              <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>{selectedLocation.placeName}</span>
            </h4>
            <p className="text-[11px] text-slate-600 mt-1 font-mono">
              {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
            </p>
          </div>
        </InfoWindow>
      )}
    </Map>
  );
};

export const LocationsView: React.FC<LocationsViewProps> = ({
  entries,
  activeEntry,
  onSelectEntry,
  onUpdateEntry,
  onNewReflectionAtPlace,
  onOpenReflectionWorkspace,
  user,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [customLat, setCustomLat] = useState('37.7749');
  const [customLng, setCustomLng] = useState('-122.4194');
  const [selectedLocation, setSelectedLocation] = useState<LocationTag | null>(
    activeEntry?.location || PRESET_SANCTUARIES[0]
  );
  const [tagSuccessMessage, setTagSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sanctuaries' | 'reflections' | 'custom'>('sanctuaries');
  const [hasMapAuthFailed, setHasMapAuthFailed] = useState(false);

  // Retrieve key from environment
  const rawApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

  // Determine if Google Maps should be activated
  const isKeyValid = useMemo(() => isValidGoogleMapsKey(rawApiKey), [rawApiKey]);
  const shouldRenderGoogleMaps = isKeyValid && !hasMapAuthFailed;

  // Intercept Google Maps runtime auth errors to prevent unhandled InvalidKeyMapError crashes
  useEffect(() => {
    const prevAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.warn('[LocationsView] Google Maps runtime authentication error caught. Switching to Spatial Vector Canvas.');
      setHasMapAuthFailed(true);
      if (typeof prevAuthFailure === 'function') {
        try { prevAuthFailure(); } catch (_) {}
      }
    };
    return () => {
      (window as any).gm_authFailure = prevAuthFailure;
    };
  }, []);

  // Filter entries that have locations
  const mappedEntries = useMemo(() => {
    return entries.filter((e) => e.location && typeof e.location.latitude === 'number');
  }, [entries]);

  // Filtered preset sanctuaries
  const filteredSanctuaries = useMemo(() => {
    if (!searchQuery.trim()) return PRESET_SANCTUARIES;
    const q = searchQuery.toLowerCase();
    return PRESET_SANCTUARIES.filter((s) => s.placeName.toLowerCase().includes(q));
  }, [searchQuery]);

  // Filtered pinned reflections
  const filteredMappedEntries = useMemo(() => {
    if (!searchQuery.trim()) return mappedEntries;
    const q = searchQuery.toLowerCase();
    return mappedEntries.filter(
      (e) =>
        e.title?.toLowerCase().includes(q) ||
        e.location?.placeName.toLowerCase().includes(q)
    );
  }, [mappedEntries, searchQuery]);

  const mapCenter = useMemo(() => {
    if (selectedLocation) {
      return { lat: selectedLocation.latitude, lng: selectedLocation.longitude };
    }
    if (mappedEntries.length > 0 && mappedEntries[0].location) {
      return { lat: mappedEntries[0].location.latitude, lng: mappedEntries[0].location.longitude };
    }
    return { lat: 37.7749, lng: -122.4194 };
  }, [selectedLocation, mappedEntries]);

  // Handle assigning chosen location to active reflection
  const handleAssignToActiveEntry = () => {
    if (!activeEntry || !selectedLocation) return;
    const updated: ReflectionEntry = {
      ...activeEntry,
      location: selectedLocation,
      updatedAt: new Date().toISOString(),
    };
    onUpdateEntry(updated);
    setTagSuccessMessage(`Tagged "${selectedLocation.placeName}" to session!`);
    setTimeout(() => setTagSuccessMessage(null), 3000);
  };

  // Handle creating custom location
  const handleAddCustomLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const lat = parseFloat(customLat) || 37.7749;
    const lng = parseFloat(customLng) || -122.4194;
    const newLoc: LocationTag = {
      placeName: customName.trim(),
      latitude: lat,
      longitude: lng,
    };
    setSelectedLocation(newLoc);
    setCustomName('');
  };

  return (
    <div 
      id="locations-full-page-view" 
      className="flex-1 flex flex-col w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors"
    >
      {/* Top Banner */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-display">
                  Locations & Sanctuaries
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {mappedEntries.length} Pinned
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-sans">
                Anchor cognitive clarity and reflections to physical spaces, work sanctuaries, and geographic landmarks.
              </p>
            </div>
          </div>

          {/* Contextual Active Reflection Badge / Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {activeEntry ? (
              <div className="flex items-center gap-2 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 px-3 py-1.5 rounded-xl text-xs">
                <span className="text-slate-500 dark:text-slate-400">Active session:</span>
                <span className="font-bold text-indigo-700 dark:text-indigo-300 max-w-[150px] truncate">
                  {activeEntry.title || 'Untitled Session'}
                </span>
                {selectedLocation && (
                  <button
                    id="tag-location-to-session-btn"
                    type="button"
                    onClick={handleAssignToActiveEntry}
                    className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] shadow-xs transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Tag Selected</span>
                  </button>
                )}
              </div>
            ) : null}

            {selectedLocation && (
              <button
                id="new-reflection-at-location-btn"
                type="button"
                onClick={() => onNewReflectionAtPlace(selectedLocation)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Reflect Here</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {tagSuccessMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/70 border-b border-emerald-200 dark:border-emerald-800/80 px-4 py-2 text-center text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{tagSuccessMessage}</span>
          <button
            type="button"
            onClick={() => onOpenReflectionWorkspace(activeEntry?.id)}
            className="underline font-bold ml-2 hover:text-emerald-900 dark:hover:text-white"
          >
            Return to Reflection &rarr;
          </button>
        </div>
      )}

      {/* Main Responsive Split Grid */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col lg:flex-row gap-6">
        
        {/* Left Interactive Map Container */}
        <div className="w-full lg:w-3/5 h-[420px] lg:h-auto min-h-[400px] flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm z-10">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {selectedLocation ? selectedLocation.placeName : 'Select a location'}
              </span>
            </div>
            {selectedLocation && (
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
              </span>
            )}
          </div>

          <div className="flex-1 w-full h-full relative">
            {shouldRenderGoogleMaps ? (
              <APIProvider apiKey={rawApiKey}>
                <MapCanvasWithMarkers
                  mappedEntries={mappedEntries}
                  selectedLocation={selectedLocation}
                  onSelectLocation={(loc) => setSelectedLocation(loc)}
                  center={mapCenter}
                  zoom={12}
                  onOpenSession={(id) => onOpenReflectionWorkspace(id)}
                  onAuthFailure={() => setHasMapAuthFailed(true)}
                />
              </APIProvider>
            ) : (
              <SpatialVectorCanvas
                mappedEntries={mappedEntries}
                sanctuaries={PRESET_SANCTUARIES}
                selectedLocation={selectedLocation}
                onSelectLocation={(loc) => setSelectedLocation(loc)}
                onOpenSession={(id) => onOpenReflectionWorkspace(id)}
              />
            )}
          </div>
        </div>

        {/* Right Directory & Tagging Workspace */}
        <div className="w-full lg:w-2/5 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-1.5 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('sanctuaries')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'sanctuaries'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Sanctuaries ({PRESET_SANCTUARIES.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reflections')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'reflections'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Pinned ({mappedEntries.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'custom'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Custom Pin
            </button>
          </div>

          {/* Search Filter */}
          {activeTab !== 'custom' && (
            <div className="p-3 border-b border-slate-200 dark:border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search locations or reflections..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Tab Content Lists */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[500px]">
            {activeTab === 'sanctuaries' && (
              <div className="space-y-2">
                {filteredSanctuaries.map((sanctuary, idx) => {
                  const isSelected = selectedLocation?.placeName === sanctuary.placeName;
                  const Icon = getSanctuaryIcon(sanctuary.placeName);

                  return (
                    <div
                      key={`sanctuary-${idx}`}
                      onClick={() => setSelectedLocation(sanctuary)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-500/20'
                          : 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {sanctuary.placeName}
                            </h4>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {sanctuary.latitude.toFixed(3)}, {sanctuary.longitude.toFixed(3)}
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="p-1 rounded-full bg-indigo-600 text-white shrink-0">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      {/* Action buttons on selected item */}
                      {isSelected && (
                        <div className="mt-3 pt-2 border-t border-indigo-100 dark:border-indigo-900/60 flex items-center justify-end gap-2">
                          {activeEntry && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAssignToActiveEntry();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-colors"
                            >
                              Tag to Current Session
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNewReflectionAtPlace(sanctuary);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[11px] transition-colors"
                          >
                            New Reflection Here
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'reflections' && (
              <div className="space-y-2">
                {filteredMappedEntries.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 font-sans text-xs">
                    No reflections with tagged locations yet.
                  </div>
                ) : (
                  filteredMappedEntries.map((entry) => {
                    const isSelected = selectedLocation?.placeName === entry.location?.placeName;
                    return (
                      <div
                        key={entry.id}
                        onClick={() => {
                          if (entry.location) setSelectedLocation(entry.location);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700'
                            : 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {entry.title || 'Untitled Session'}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{entry.location?.placeName}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {new Date(entry.updatedAt || entry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">
                            {entry.messages?.length || 0} messages
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenReflectionWorkspace(entry.id);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            <span>Open Reflection</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'custom' && (
              <form onSubmit={handleAddCustomLocation} className="space-y-3 p-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Place or Sanctuary Name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Kyoto Zen Garden or Downtown Studio"
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={customLat}
                      onChange={(e) => setCustomLat(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={customLng}
                      onChange={(e) => setCustomLng(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-colors mt-2"
                >
                  Pin Custom Location
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
