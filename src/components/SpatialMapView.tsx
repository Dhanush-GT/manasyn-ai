import React, { useState, useMemo } from 'react';
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
  Calendar, 
  MessageSquare, 
  Sparkles, 
  ArrowRight, 
  Search, 
  Layers, 
  Maximize2,
  Tag,
  Share2,
  Navigation
} from 'lucide-react';
import type { ReflectionEntry, UserProfile, LocationTag } from '../types';

interface SpatialMapViewProps {
  entries: ReflectionEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entryId: string) => void;
  onOpenReflectionView?: (entryId?: string) => void;
  onNewReflectionAtPlace?: (place: LocationTag) => void;
  user?: UserProfile;
}

const MapCanvasWithMarkers: React.FC<{
  mappedEntries: ReflectionEntry[];
  selectedEntry: ReflectionEntry | null;
  onSelectMarker: (entry: ReflectionEntry) => void;
  onCloseInfoWindow: () => void;
  center: { lat: number; lng: number };
  zoom: number;
  onOpenSession: (entryId: string) => void;
}> = ({
  mappedEntries,
  selectedEntry,
  onSelectMarker,
  onCloseInfoWindow,
  center,
  zoom,
  onOpenSession,
}) => {
  const status = useApiLoadingStatus();

  if (status === APILoadingStatus.LOADING || status === APILoadingStatus.NOT_LOADED) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-950 rounded-2xl relative overflow-hidden font-mono"
        style={{
          backgroundImage: `
            radial-gradient(circle at center, rgba(6, 182, 212, 0.08) 0%, transparent 70%),
            linear-gradient(to right, rgba(6, 182, 212, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(6, 182, 212, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 32px 32px, 32px 32px',
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 rounded-full border border-cyan-500/20 animate-ping opacity-30" />
          <div className="absolute w-80 h-80 rounded-full border border-cyan-500/10" />
        </div>
        <div className="relative z-10 space-y-3">
          <Compass className="w-10 h-10 text-cyan-400 mx-auto animate-spin" />
          <h4 className="text-sm sm:text-base font-bold text-white font-display tracking-wide">
            Initializing Spatial Vector Canvas
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto font-sans leading-relaxed">
            Rendering {mappedEntries.length} physical coordinate nodes into Google Maps Platform layer...
          </p>
        </div>
      </div>
    );
  }

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-950 rounded-2xl relative overflow-hidden font-mono"
        style={{
          backgroundImage: `
            radial-gradient(circle at center, rgba(6, 182, 212, 0.08) 0%, transparent 70%),
            linear-gradient(to right, rgba(6, 182, 212, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(6, 182, 212, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 32px 32px, 32px 32px',
        }}
      >
        <Compass className="w-12 h-12 text-cyan-400 mb-3 animate-pulse" />
        <h4 className="text-base font-bold text-white font-display">
          Spatial Memory Matrix Active
        </h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed font-sans">
          {mappedEntries.length} operational coordinates mapped across physical locations. Select any item from the index to view details.
        </p>
      </div>
    );
  }

  return (
    <Map
      center={center}
      zoom={zoom}
      gestureHandling="greedy"
      disableDefaultUI={false}
      style={{ width: '100%', height: '100%' }}
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
    >
      {mappedEntries.map((entry) => {
        if (!entry.location) return null;
        const isSelected = selectedEntry?.id === entry.id;
        return (
          <Marker
            key={entry.id}
            position={{ lat: entry.location.latitude, lng: entry.location.longitude }}
            onClick={() => onSelectMarker(entry)}
            title={entry.title || entry.location.placeName}
          />
        );
      })}

      {selectedEntry && selectedEntry.location && (
        <InfoWindow
          position={{
            lat: selectedEntry.location.latitude,
            lng: selectedEntry.location.longitude,
          }}
          onCloseClick={onCloseInfoWindow}
        >
          <div className="p-2 max-w-[260px] sm:max-w-[280px] text-slate-900 font-sans">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 mb-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{selectedEntry.location.placeName}</span>
            </div>
            
            <h4 className="font-bold text-xs sm:text-sm text-slate-900 mb-1 line-clamp-1">
              {selectedEntry.title || 'Untitled Reflection'}
            </h4>

            {selectedEntry.messages && selectedEntry.messages.length > 0 && (
              <p className="text-[11px] text-slate-600 line-clamp-2 mb-2 leading-relaxed bg-slate-50 p-1.5 rounded">
                "{selectedEntry.messages[selectedEntry.messages.length - 1].content}"
              </p>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[10px] text-slate-500 mb-2">
              <span>{new Date(selectedEntry.updatedAt || selectedEntry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
              <span>{selectedEntry.messages?.length || 0} messages</span>
            </div>

            <button
              type="button"
              onClick={() => onOpenSession(selectedEntry.id)}
              className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
            >
              <span>Jump to Reflection</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </InfoWindow>
      )}
    </Map>
  );
};

export const SpatialMapView: React.FC<SpatialMapViewProps> = ({
  entries,
  activeEntryId,
  onSelectEntry,
  onOpenReflectionView,
  user,
}) => {
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

  const mappedEntries = useMemo(() => {
    return entries.filter(
      (e) =>
        e.location &&
        typeof e.location.latitude === 'number' &&
        typeof e.location.longitude === 'number' &&
        !isNaN(e.location.latitude) &&
        !isNaN(e.location.longitude)
    );
  }, [entries]);

  const [selectedEntry, setSelectedEntry] = useState<ReflectionEntry | null>(() => {
    if (activeEntryId) {
      const found = mappedEntries.find((e) => e.id === activeEntryId);
      if (found) return found;
    }
    return mappedEntries.length > 0 ? mappedEntries[0] : null;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(() => {
    if (selectedEntry?.location) {
      return { lat: selectedEntry.location.latitude, lng: selectedEntry.location.longitude };
    }
    if (mappedEntries.length > 0 && mappedEntries[0].location) {
      return { lat: mappedEntries[0].location.latitude, lng: mappedEntries[0].location.longitude };
    }
    return { lat: 37.7749, lng: -122.4194 }; // Default San Francisco
  });
  const [mapZoom, setMapZoom] = useState(12);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  const filteredMappedEntries = mappedEntries.filter((entry) => {
    const query = searchQuery.toLowerCase();
    return (
      entry.title.toLowerCase().includes(query) ||
      (entry.location?.placeName || '').toLowerCase().includes(query) ||
      (entry.location?.formattedAddress || '').toLowerCase().includes(query) ||
      (entry.tags || []).some((t) => t.toLowerCase().includes(query))
    );
  });

  const handleSelectPlace = (entry: ReflectionEntry) => {
    setSelectedEntry(entry);
    onSelectEntry(entry.id);
    if (entry.location) {
      setMapCenter({ lat: entry.location.latitude, lng: entry.location.longitude });
      setMapZoom(14);
    }
  };

  const handleJumpToSession = (entryId: string) => {
    onSelectEntry(entryId);
    if (onOpenReflectionView) {
      onOpenReflectionView(entryId);
    }
  };

  return (
    <div id="spatial-map-view-root" className="flex-1 flex flex-col md:flex-row h-full overflow-hidden relative bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Interactive Map Area */}
      <div className="flex-1 h-[55vh] md:h-full relative order-2 md:order-1">
        {mappedEntries.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-950">
            <div className="w-16 h-16 rounded-2xl bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-800/80 flex items-center justify-center text-cyan-600 dark:text-cyan-400 mb-4 shadow-xs">
              <MapPin className="w-8 h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-display">
              No Spatial Coordinates Mapped Yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm leading-relaxed font-sans">
              Tag locations on your operational reflections to anchor cognitive sessions to geographic landmarks, server centers, or work sanctuaries.
            </p>
            <button
              type="button"
              onClick={() => onOpenReflectionView && onOpenReflectionView()}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-cyan-950/30 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Back to Reflections to Tag a Location</span>
            </button>
          </div>
        ) : (
          <APIProvider apiKey={apiKey}>
            <MapCanvasWithMarkers
              mappedEntries={mappedEntries}
              selectedEntry={selectedEntry}
              onSelectMarker={(entry) => handleSelectPlace(entry)}
              onCloseInfoWindow={() => setSelectedEntry(null)}
              center={mapCenter}
              zoom={mapZoom}
              onOpenSession={handleJumpToSession}
            />
          </APIProvider>
        )}

        {/* Floating Quick Stats Badge */}
        <div className="absolute top-4 left-4 z-10 hidden sm:flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl text-xs font-mono">
          <MapPin className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span className="font-bold text-slate-700 dark:text-slate-200">
            {mappedEntries.length} Coordinates Pinned
          </span>
        </div>
      </div>

      {/* Side Sanctuary Directory */}
      <div 
        id="spatial-sidebar-drawer" 
        className="w-full md:w-80 lg:w-96 bg-white dark:bg-slate-900/95 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 flex flex-col h-[45vh] md:h-full order-1 md:order-2 shrink-0 z-20"
      >
        {/* Directory Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white font-display">
                Spatial Coordinate Index
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/80">
              {filteredMappedEntries.length} Coordinates
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by location or title..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 font-sans"
            />
          </div>
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredMappedEntries.length === 0 ? (
            <div className="text-center py-8 px-4 text-slate-400 font-mono">
              <p className="text-xs">No matching spatial coordinates</p>
            </div>
          ) : (
            filteredMappedEntries.map((entry) => {
              const isSelected = selectedEntry?.id === entry.id;
              const lastMsg = entry.messages?.[entry.messages.length - 1];

              return (
                <div
                  key={entry.id}
                  id={`spatial-entry-item-${entry.id}`}
                  onClick={() => handleSelectPlace(entry)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-cyan-50 dark:bg-slate-800/90 border-cyan-400 dark:border-cyan-500/70 shadow-sm ring-1 ring-cyan-500/20'
                      : 'bg-slate-50/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {entry.title || 'Untitled Thought'}
                    </h4>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {new Date(entry.updatedAt || entry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 mb-1.5 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{entry.location?.placeName}</span>
                  </div>

                  {lastMsg && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1 mb-2 font-sans">
                      {lastMsg.content}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/80">
                    <span className="text-[10px] font-mono text-slate-500">
                      {entry.messages?.length || 0} {entry.messages?.length === 1 ? 'message' : 'messages'}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpToSession(entry.id);
                      }}
                      className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1 font-mono"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
