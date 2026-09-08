import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  APIProvider, 
  Map as GoogleMap, 
  Marker, 
  InfoWindow 
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
  Building2, 
  Coffee, 
  Home, 
  Trees, 
  BookOpen,
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ShieldCheck, 
  AlertTriangle,
  LocateFixed,
  Map as MapIcon,
  List,
  X,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import type { ReflectionEntry, UserProfile, LocationTag } from '../types';
import { isValidGoogleMapsKey, GMP_ATTRIBUTION_ID } from '../lib/maps';
import { 
  saveUserPlace, 
  deleteUserPlace, 
  subscribeUserPlaces 
} from '../lib/firebase';

interface LocationsViewProps {
  entries: ReflectionEntry[];
  activeEntry: ReflectionEntry | null;
  onSelectEntry: (entryId: string) => void;
  onUpdateEntry: (updated: ReflectionEntry) => void;
  onNewReflectionAtPlace: (place: LocationTag) => void;
  onOpenReflectionWorkspace: (entryId?: string) => void;
  user?: UserProfile;
}

// Curated default places tailored for calm reflection
export const DEFAULT_PRESET_PLACES: LocationTag[] = [
  {
    id: 'preset-home-writing',
    placeName: 'Home Writing Corner',
    formattedAddress: 'San Francisco, CA',
    latitude: 37.7749,
    longitude: -122.4194,
    category: 'home',
    precision: 'approximate',
    notes: 'Morning desk with natural light by the window',
  },
  {
    id: 'preset-riverside-walk',
    placeName: 'Riverside Walking Path',
    formattedAddress: 'Golden Gate Park, San Francisco, CA',
    latitude: 37.7694,
    longitude: -122.4862,
    category: 'nature',
    precision: 'neighborhood',
    notes: 'Quiet path under the trees for walking reflections',
  },
  {
    id: 'preset-library',
    placeName: 'University Library',
    formattedAddress: 'Campus Quiet Floor, San Francisco, CA',
    latitude: 37.7885,
    longitude: -122.4072,
    category: 'study',
    precision: 'exact',
    notes: 'Dedicated study area for deep focus',
  },
  {
    id: 'preset-quiet-cafe',
    placeName: 'Quiet Café',
    formattedAddress: 'SOMA Neighborhood, San Francisco, CA',
    latitude: 37.7909,
    longitude: -122.4013,
    category: 'cafe',
    precision: 'approximate',
    notes: 'Cozy corner table with ambient warmth',
  },
  {
    id: 'preset-garden',
    placeName: 'Community Garden',
    formattedAddress: 'Mission District, San Francisco, CA',
    latitude: 37.7550,
    longitude: -122.4200,
    category: 'nature',
    precision: 'neighborhood',
    notes: 'Open greenspace surrounded by flowers and herbs',
  },
  {
    id: 'preset-weekend-retreat',
    placeName: 'Weekend Retreat',
    formattedAddress: 'Lake Tahoe, CA',
    latitude: 39.0968,
    longitude: -120.0324,
    category: 'travel',
    precision: 'approximate',
    notes: 'Peaceful cabin surrounded by pines for reset weekends',
  }
];

// Helper to get category icon
export const getCategoryIcon = (category?: string, name?: string) => {
  const cat = (category || '').toLowerCase();
  const lowerName = (name || '').toLowerCase();
  
  if (cat === 'cafe' || lowerName.includes('cafe') || lowerName.includes('coffee')) return Coffee;
  if (cat === 'home' || lowerName.includes('home') || lowerName.includes('room') || lowerName.includes('desk')) return Home;
  if (cat === 'nature' || lowerName.includes('garden') || lowerName.includes('park') || lowerName.includes('path') || lowerName.includes('river')) return Trees;
  if (cat === 'study' || lowerName.includes('library') || lowerName.includes('campus') || lowerName.includes('study')) return BookOpen;
  if (cat === 'travel' || lowerName.includes('retreat') || lowerName.includes('cabin') || lowerName.includes('mountain') || lowerName.includes('lake')) return Compass;
  return Building2;
};

// Helper for human-readable precision label
export const getPrecisionLabel = (precision?: string): string => {
  switch (precision) {
    case 'neighborhood':
      return 'Neighborhood area';
    case 'exact':
      return 'Specific place';
    case 'approximate':
    default:
      return 'Approximate area';
  }
};

/**
 * Fallback Interactive Map View
 * Renders a calm, accessible cartographic canvas displaying your places and reflection pins.
 */
interface CalmPlacesCanvasProps {
  mappedEntries: ReflectionEntry[];
  places: LocationTag[];
  selectedPlace: LocationTag | null;
  onSelectPlace: (place: LocationTag) => void;
  onOpenReflection: (entryId: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
}

const CalmPlacesCanvas: React.FC<CalmPlacesCanvasProps> = ({
  mappedEntries,
  places,
  selectedPlace,
  onSelectPlace,
  onOpenReflection,
  onMapClick,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute dynamic bounding box
  const allCoords = useMemo(() => {
    const coords: { lat: number; lng: number }[] = [];
    places.forEach((p) => coords.push({ lat: p.latitude, lng: p.longitude }));
    mappedEntries.forEach((e) => {
      if (e.location) coords.push({ lat: e.location.latitude, lng: e.location.longitude });
    });
    return coords;
  }, [places, mappedEntries]);

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
    const latSpan = Math.max(0.2, maxLat - minLat);
    const lngSpan = Math.max(0.3, maxLng - minLng);
    return {
      minLat: minLat - latSpan * 0.15,
      maxLat: maxLat + latSpan * 0.15,
      minLng: minLng - lngSpan * 0.15,
      maxLng: maxLng + lngSpan * 0.15,
    };
  }, [allCoords]);

  // Project geographic coordinates to canvas percentages
  const project = (lat: number, lng: number) => {
    const xPct = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
    const yPct = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 100;
    return {
      x: Math.max(8, Math.min(92, xPct)),
      y: Math.max(8, Math.min(92, yPct)),
    };
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
      id="calm-places-canvas"
      className="relative w-full h-full min-h-[360px] bg-slate-900 rounded-2xl overflow-hidden select-none cursor-grab active:cursor-grabbing border border-slate-800"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      role="region"
      aria-label="Interactive Map of Your Places"
    >
      {/* Background Cartographic Subtle Grid */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle, #6366f1 1px, transparent 1px),
            linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px, 64px 64px, 64px 64px',
        }}
      />

      {/* Top Map Header */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm">
        <Compass className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-bold text-white">Your Places</span>
        <span className="text-[10px] text-slate-400 font-sans">
          ({places.length} saved)
        </span>
      </div>

      {/* Interactive Map Controls */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-sm">
        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={resetView}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Reset View"
          aria-label="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Transformable Canvas Layer */}
      <div
        className="w-full h-full relative transition-transform duration-75 origin-center"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
        }}
      >
        {/* Soft connecting paths between places */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
          {places.length > 1 && (
            <polyline
              points={places
                .map((p) => {
                  const { x, y } = project(p.latitude, p.longitude);
                  return `${x}%,${y}%`;
                })
                .join(' ')}
              fill="none"
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}
        </svg>

        {/* Render Saved Places Pins */}
        {places.map((place, idx) => {
          const { x, y } = project(place.latitude, place.longitude);
          const isSelected = selectedPlace?.placeName === place.placeName;
          const Icon = getCategoryIcon(place.category, place.placeName);

          return (
            <div
              key={`canvas-place-${place.id || idx}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation();
                onSelectPlace(place);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectPlace(place);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Select place: ${place.placeName}`}
            >
              {/* Pulse ripple for selected place */}
              {isSelected && (
                <div className="absolute -inset-2.5 rounded-full bg-indigo-500/30 animate-ping pointer-events-none" />
              )}

              {/* Pin Icon Bubble */}
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border shadow-md transition-all ${
                  isSelected
                    ? 'bg-indigo-600 border-white text-white scale-125 ring-2 ring-indigo-400'
                    : 'bg-slate-800 border-slate-600 text-slate-200 group-hover:bg-slate-700 group-hover:border-indigo-400 group-hover:scale-110'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              {/* Place Name Pill Tooltip */}
              <div
                className={`absolute top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all pointer-events-none shadow-md ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-bold opacity-100 z-30'
                    : 'bg-slate-900/90 text-slate-300 opacity-80 group-hover:opacity-100'
                }`}
              >
                {place.placeName}
              </div>
            </div>
          );
        })}

        {/* Render Reflection Pins */}
        {mappedEntries.map((entry) => {
          if (!entry.location) return null;
          const { x, y } = project(entry.location.latitude, entry.location.longitude);
          const isSelected = selectedPlace?.placeName === entry.location.placeName;

          return (
            <div
              key={`canvas-entry-${entry.id}`}
              style={{ left: `${x}%`, top: `${y + 2}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation();
                if (entry.location) onSelectPlace(entry.location);
              }}
              tabIndex={0}
              role="button"
              aria-label={`Reflection: ${entry.title}`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full border shadow-sm transition-transform ${
                  isSelected
                    ? 'bg-violet-400 border-white ring-2 ring-violet-400 scale-125'
                    : 'bg-indigo-400 border-slate-900 group-hover:scale-125'
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Subtle bottom note */}
      <div className="absolute bottom-2 left-3 z-10 text-[10px] text-slate-400 pointer-events-none">
        Click or tap any place marker to view details
      </div>
    </div>
  );
};

/**
 * Google Maps Integration with markers
 */
interface GoogleMapWithMarkersProps {
  mappedEntries: ReflectionEntry[];
  places: LocationTag[];
  selectedPlace: LocationTag | null;
  onSelectPlace: (place: LocationTag) => void;
  center: { lat: number; lng: number };
  zoom: number;
  onOpenReflection: (entryId: string) => void;
  onAuthFailure: () => void;
}

const GoogleMapWithMarkers: React.FC<GoogleMapWithMarkersProps> = ({
  mappedEntries,
  places,
  selectedPlace,
  onSelectPlace,
  center,
  zoom,
  onOpenReflection,
  onAuthFailure,
}) => {
  return (
    <GoogleMap
      id="places-google-map"
      mapId={GMP_ATTRIBUTION_ID}
      defaultCenter={center}
      center={center}
      defaultZoom={zoom}
      gestureHandling="greedy"
      disableDefaultUI={false}
      style={{ width: '100%', height: '100%', minHeight: '360px', borderRadius: '1rem' }}
    >
      {/* Places Markers */}
      {places.map((place, idx) => (
        <Marker
          key={`map-marker-place-${place.id || idx}`}
          position={{ lat: place.latitude, lng: place.longitude }}
          title={place.placeName}
          onClick={() => onSelectPlace(place)}
        />
      ))}

      {/* Selected Info Window */}
      {selectedPlace && (
        <InfoWindow
          position={{ lat: selectedPlace.latitude, lng: selectedPlace.longitude }}
          onCloseClick={() => {}}
        >
          <div className="p-1 max-w-xs text-slate-900 font-sans">
            <h4 className="font-bold text-xs flex items-center gap-1.5 text-indigo-700">
              <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>{selectedPlace.placeName}</span>
            </h4>
            {selectedPlace.formattedAddress && (
              <p className="text-[11px] text-slate-600 mt-1">
                {selectedPlace.formattedAddress}
              </p>
            )}
            <p className="text-[10px] text-slate-400 mt-0.5">
              {getPrecisionLabel(selectedPlace.precision)}
            </p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
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
  // Navigation & Search State
  const [activeTab, setActiveTab] = useState<'saved' | 'reflections'>('saved');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [mobileViewMode, setMobileViewMode] = useState<'list' | 'map'>('list');

  // Selected Place
  const [selectedPlace, setSelectedPlace] = useState<LocationTag | null>(
    activeEntry?.location || DEFAULT_PRESET_PLACES[0]
  );

  // User saved places state (with Firestore real-time sync + fallback)
  const [userPlaces, setUserPlaces] = useState<LocationTag[]>(DEFAULT_PRESET_PLACES);
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [deleteConfirmPlace, setDeleteConfirmPlace] = useState<LocationTag | null>(null);
  const [tagSuccessMessage, setTagSuccessMessage] = useState<string | null>(null);
  const [hasMapAuthFailed, setHasMapAuthFailed] = useState(false);
  const [geolocationLoading, setGeolocationLoading] = useState(false);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);

  // New Place Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<'home' | 'nature' | 'work' | 'cafe' | 'study' | 'travel' | 'other'>('home');
  const [formPrecision, setFormPrecision] = useState<'approximate' | 'neighborhood' | 'exact'>('approximate');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formLat, setFormLat] = useState(37.7749);
  const [formLng, setFormLng] = useState(-122.4194);

  // Subscribe to user's saved places in Firestore
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeUserPlaces(
      user.uid,
      (remotePlaces) => {
        const placeMap = new Map<string, LocationTag>();
        (remotePlaces || []).forEach((p) => {
          const nameKey = (p.placeName || '').trim().toLowerCase();
          const idKey = (p.id || '').trim().toLowerCase();
          if (nameKey) {
            placeMap.set(nameKey, p);
          } else if (idKey) {
            placeMap.set(idKey, p);
          }
        });

        DEFAULT_PRESET_PLACES.forEach((preset) => {
          const key = preset.placeName.trim().toLowerCase();
          if (!placeMap.has(key)) {
            placeMap.set(key, preset);
          }
        });

        setUserPlaces(Array.from(placeMap.values()));
      },
      (err) => {
        console.warn('[Places] Falling back to default preset places:', err);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Retrieve Google Maps key
  const rawApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
  const isKeyValid = useMemo(() => isValidGoogleMapsKey(rawApiKey), [rawApiKey]);
  const shouldRenderGoogleMaps = isKeyValid && !hasMapAuthFailed;

  // Intercept Google Maps runtime auth errors
  useEffect(() => {
    const prevAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.warn('[Places] Google Maps runtime authentication error caught. Switching to Calm Places Canvas.');
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

  // Compute linked reflections count for a place
  const getLinkedReflectionsCount = (placeName: string) => {
    return entries.filter(
      (e) => e.location && e.location.placeName.toLowerCase() === placeName.toLowerCase()
    ).length;
  };

  // Deduplicated places list (by normalized placeName or ID)
  const deduplicatedPlaces = useMemo(() => {
    const map = new Map<string, LocationTag>();
    userPlaces.forEach((p) => {
      const key = (p.placeName || p.id || '').trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, p);
      }
    });
    return Array.from(map.values());
  }, [userPlaces]);

  // Filtered saved places based on search query & category
  const filteredPlaces = useMemo(() => {
    return deduplicatedPlaces.filter((p) => {
      const matchesSearch =
        !searchQuery.trim() ||
        p.placeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.formattedAddress && p.formattedAddress.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.notes && p.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat =
        selectedCategory === 'all' ||
        (p.category || 'other').toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCat;
    });
  }, [deduplicatedPlaces, searchQuery, selectedCategory]);

  // Filtered reflections with locations
  const filteredMappedEntries = useMemo(() => {
    if (!searchQuery.trim()) return mappedEntries;
    const q = searchQuery.toLowerCase();
    return mappedEntries.filter(
      (e) =>
        e.title?.toLowerCase().includes(q) ||
        e.location?.placeName.toLowerCase().includes(q) ||
        e.location?.formattedAddress?.toLowerCase().includes(q)
    );
  }, [mappedEntries, searchQuery]);

  const mapCenter = useMemo(() => {
    if (selectedPlace) {
      return { lat: selectedPlace.latitude, lng: selectedPlace.longitude };
    }
    if (mappedEntries.length > 0 && mappedEntries[0].location) {
      return { lat: mappedEntries[0].location.latitude, lng: mappedEntries[0].location.longitude };
    }
    return { lat: 37.7749, lng: -122.4194 };
  }, [selectedPlace, mappedEntries]);

  // Handle assigning chosen place to active reflection
  const handleAssignToActiveEntry = () => {
    if (!activeEntry || !selectedPlace) return;
    const updated: ReflectionEntry = {
      ...activeEntry,
      location: selectedPlace,
      updatedAt: new Date().toISOString(),
    };
    onUpdateEntry(updated);
    setTagSuccessMessage(`Added "${selectedPlace.placeName}" to your current reflection.`);
    setTimeout(() => setTagSuccessMessage(null), 3500);
  };

  // Handle detaching place from active reflection
  const handleDetachFromActiveEntry = () => {
    if (!activeEntry) return;
    const updated: ReflectionEntry = {
      ...activeEntry,
      location: undefined,
      updatedAt: new Date().toISOString(),
    };
    onUpdateEntry(updated);
    setTagSuccessMessage('Place detached from your reflection.');
    setTimeout(() => setTagSuccessMessage(null), 3000);
  };

  // Browser Geolocation flow
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeolocationError('Geolocation is not supported by your browser.');
      return;
    }

    setGeolocationLoading(true);
    setGeolocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormLat(position.coords.latitude);
        setFormLng(position.coords.longitude);
        setFormAddress('Current location');
        setGeolocationLoading(false);
      },
      (error) => {
        setGeolocationLoading(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGeolocationError('Location access was not granted. You can still enter a name or neighborhood.');
        } else {
          setGeolocationError('Unable to retrieve your current location.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Submit new place
  const handleSaveNewPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) return;

    // Check if place already exists
    const existingPlace = userPlaces.find(
      (p) => p.placeName.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    const newPlace: LocationTag = {
      id: existingPlace?.id || `place-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      placeName: trimmedName,
      category: formCategory,
      precision: formPrecision,
      formattedAddress: formAddress.trim() || undefined,
      notes: formNotes.trim() || undefined,
      latitude: formLat,
      longitude: formLng,
      taggedAt: new Date().toISOString(),
    };

    if (user?.uid) {
      await saveUserPlace(user.uid, newPlace);
    }

    setUserPlaces((prev) => {
      const map = new Map<string, LocationTag>();
      map.set(newPlace.placeName.trim().toLowerCase(), newPlace);
      prev.forEach((p) => {
        const key = (p.placeName || p.id || '').trim().toLowerCase();
        if (key && !map.has(key)) {
          map.set(key, p);
        }
      });
      return Array.from(map.values());
    });

    setSelectedPlace(newPlace);
    setIsAddingPlace(false);
    
    // Reset form
    setFormName('');
    setFormAddress('');
    setFormNotes('');
    setFormCategory('home');
    setFormPrecision('approximate');
  };

  // Delete place
  const handleDeletePlace = async (place: LocationTag) => {
    if (user?.uid && place.id && !place.id.startsWith('preset-')) {
      await deleteUserPlace(user.uid, place.id);
    }
    const targetKey = (place.placeName || '').trim().toLowerCase();
    setUserPlaces((prev) =>
      prev.filter((p) => (p.placeName || '').trim().toLowerCase() !== targetKey)
    );
    if ((selectedPlace?.placeName || '').trim().toLowerCase() === targetKey) {
      setSelectedPlace(null);
    }
    setDeleteConfirmPlace(null);
  };

  return (
    <div 
      id="places-full-page-view" 
      className="flex-1 flex flex-col w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors pb-28 sm:pb-12"
    >
      {/* Top Header Banner */}
      <header className="p-3 sm:p-6 px-2 sm:px-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-display">
                  Places
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {userPlaces.length} Saved
                </span>
                {mappedEntries.length > 0 && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    {mappedEntries.length} Tagged Reflections
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-sans">
                Connect reflections with places that matter to you.
              </p>
            </div>
          </div>

          {/* Contextual Active Reflection Badge & Primary Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {activeEntry && (
              <div className="flex items-center gap-2 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs">
                <span className="text-slate-500 dark:text-slate-400">Current reflection:</span>
                <span className="font-bold text-indigo-700 dark:text-indigo-300 max-w-[140px] truncate">
                  {activeEntry.title || 'Untitled Reflection'}
                </span>
                {selectedPlace && (
                  <button
                    id="add-place-to-current-reflection-btn"
                    type="button"
                    onClick={handleAssignToActiveEntry}
                    className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] shadow-xs transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Add to current reflection</span>
                  </button>
                )}
                {activeEntry.location && (
                  <button
                    type="button"
                    onClick={handleDetachFromActiveEntry}
                    title="Remove place from this reflection"
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {selectedPlace && (
              <button
                id="start-reflection-here-top-btn"
                type="button"
                onClick={() => onNewReflectionAtPlace(selectedPlace)}
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start a reflection here</span>
              </button>
            )}

            <button
              id="add-new-place-btn"
              type="button"
              onClick={() => setIsAddingPlace(true)}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add a Place</span>
            </button>
          </div>
        </div>
      </header>

      {/* Privacy Notice Banner */}
      <div 
        id="places-privacy-notice"
        className="bg-slate-100/80 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 px-2 sm:px-4 py-2"
      >
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-sans">
          <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>
            Manasyn only uses your location when you choose to add it to a reflection. Your location is not tracked continuously.
          </span>
        </div>
      </div>

      {/* Success Notification Banner */}
      {tagSuccessMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/70 border-b border-emerald-200 dark:border-emerald-800/80 px-2 sm:px-4 py-2 text-center text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-2">
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

      {/* Mobile View Switcher (List-First Architecture) */}
      <div className="lg:hidden max-w-7xl mx-auto w-full px-2 sm:px-4 pt-3 sm:pt-4">
        <div className="flex bg-slate-200/80 dark:bg-slate-900 p-1 rounded-xl border border-slate-300 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setMobileViewMode('list')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              mobileViewMode === 'list'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Places List</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileViewMode('map')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              mobileViewMode === 'map'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Map View</span>
          </button>
        </div>
      </div>

      {/* Main Responsive Split Content Layout */}
      <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 lg:px-8 py-4 sm:py-6 flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6">
        
        {/* Left Column: Places List Directory (List-First UX) */}
        <div 
          className={`w-full lg:w-1/2 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden ${
            mobileViewMode === 'map' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Main Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-1.5 gap-1">
            <button
              id="places-tab-saved"
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'saved'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Saved Places ({userPlaces.length})</span>
            </button>
            <button
              id="places-tab-reflections"
              type="button"
              onClick={() => setActiveTab('reflections')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'reflections'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Reflections with Places ({mappedEntries.length})</span>
            </button>
          </div>

          {/* Search Filter Bar & Category Chips */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'saved'
                    ? 'Search saved places, neighborhoods, notes...'
                    : 'Search reflections by place or title...'
                }
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Chips for Saved Places */}
            {activeTab === 'saved' && (
              <div className="flex flex-wrap items-center gap-1.5 pb-1 text-xs">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'home', label: 'Home' },
                  { id: 'nature', label: 'Nature' },
                  { id: 'study', label: 'Study & Library' },
                  { id: 'cafe', label: 'Café' },
                  { id: 'travel', label: 'Retreats' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Directory Content List */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 max-h-[600px] scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
            {activeTab === 'saved' && (
              <div className="space-y-2.5">
                {filteredPlaces.length === 0 ? (
                  <div className="text-center py-10 px-4 text-slate-400 text-xs font-sans space-y-2">
                    <p>No places found matching your search.</p>
                    <button
                      type="button"
                      onClick={() => setIsAddingPlace(true)}
                      className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add a new place</span>
                    </button>
                  </div>
                ) : (
                  filteredPlaces.map((place, idx) => {
                    const isSelected = selectedPlace?.placeName === place.placeName;
                    const Icon = getCategoryIcon(place.category, place.placeName);
                    const linkedCount = getLinkedReflectionsCount(place.placeName);

                    return (
                      <div
                        key={`place-card-${place.id || idx}`}
                        onClick={() => setSelectedPlace(place)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-500/20'
                            : 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                        }`}
                        tabIndex={0}
                        role="button"
                        aria-label={`Select place ${place.placeName}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedPlace(place);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {place.placeName}
                                </h3>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                                  {getPrecisionLabel(place.precision)}
                                </span>
                              </div>

                              {place.formattedAddress && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-sans">
                                  {place.formattedAddress}
                                </p>
                              )}

                              {place.notes && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 italic font-sans line-clamp-2">
                                  "{place.notes}"
                                </p>
                              )}

                              {linkedCount > 0 && (
                                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                                  {linkedCount} reflection{linkedCount === 1 ? '' : 's'} linked
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isSelected && (
                              <span className="p-1 rounded-full bg-indigo-600 text-white shadow-xs">
                                <Check className="w-3 h-3" />
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmPlace(place);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
                              title="Delete Place"
                              aria-label={`Delete place ${place.placeName}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Action Buttons on Selected Item */}
                        {isSelected && (
                          <div className="mt-3 pt-2.5 border-t border-indigo-100 dark:border-indigo-900/60 flex items-center justify-end gap-2 flex-wrap">
                            {activeEntry && (
                              <button
                                id={`tag-btn-${place.id || idx}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAssignToActiveEntry();
                                }}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-colors shadow-xs"
                              >
                                Add to current reflection
                              </button>
                            )}
                            <button
                              id={`start-reflection-btn-${place.id || idx}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNewReflectionAtPlace(place);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white dark:text-slate-100 font-bold text-[11px] transition-colors"
                            >
                              Start a reflection here
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'reflections' && (
              <div className="space-y-2.5">
                {filteredMappedEntries.length === 0 ? (
                  <div className="text-center py-10 px-4 text-slate-400 text-xs font-sans space-y-2">
                    <p>No reflections with tagged places yet.</p>
                    <p className="text-[11px] text-slate-500">
                      You can attach a place to any reflection to remember where your thoughts took shape.
                    </p>
                  </div>
                ) : (
                  filteredMappedEntries.map((entry) => {
                    const isSelected = selectedPlace?.placeName === entry.location?.placeName;
                    return (
                      <div
                        key={entry.id}
                        onClick={() => {
                          if (entry.location) setSelectedPlace(entry.location);
                        }}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700'
                            : 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                        }`}
                        tabIndex={0}
                        role="button"
                        aria-label={`Reflection: ${entry.title}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {entry.title || 'Untitled Reflection'}
                            </h3>
                            <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-1">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{entry.location?.placeName}</span>
                            </div>
                            {entry.location?.formattedAddress && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                {entry.location.formattedAddress}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 font-sans">
                            {new Date(entry.updatedAt || entry.createdAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
                          <span className="text-[10px] text-slate-400">
                            {entry.messages?.length || 0} messages
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenReflectionWorkspace(entry.id);
                            }}
                            className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            <span>View reflection</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Visual Map (Desktop side-by-side or Mobile toggled) */}
        <div 
          className={`w-full lg:w-1/2 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[420px] relative ${
            mobileViewMode === 'list' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Top Map Action Bar */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm z-10">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                {selectedPlace ? selectedPlace.placeName : 'Select a place'}
              </span>
            </div>
            {selectedPlace && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                {getPrecisionLabel(selectedPlace.precision)}
              </span>
            )}
          </div>

          {/* Map Rendering Viewport */}
          <div className="flex-1 w-full h-full relative min-h-[380px]">
            {shouldRenderGoogleMaps ? (
              <APIProvider apiKey={rawApiKey}>
                <GoogleMapWithMarkers
                  mappedEntries={mappedEntries}
                  places={userPlaces}
                  selectedPlace={selectedPlace}
                  onSelectPlace={(p) => setSelectedPlace(p)}
                  center={mapCenter}
                  zoom={12}
                  onOpenReflection={(id) => onOpenReflectionWorkspace(id)}
                  onAuthFailure={() => setHasMapAuthFailed(true)}
                />
              </APIProvider>
            ) : (
              <CalmPlacesCanvas
                mappedEntries={mappedEntries}
                places={userPlaces}
                selectedPlace={selectedPlace}
                onSelectPlace={(p) => setSelectedPlace(p)}
                onOpenReflection={(id) => onOpenReflectionWorkspace(id)}
              />
            )}
          </div>

          {/* Bottom Context Info on Selected Place */}
          {selectedPlace && (
            <div className="p-3 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 backdrop-blur-md flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {selectedPlace.placeName}
                </p>
                {selectedPlace.formattedAddress && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {selectedPlace.formattedAddress}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {activeEntry && (
                  <button
                    type="button"
                    onClick={handleAssignToActiveEntry}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-colors"
                  >
                    Add to current reflection
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNewReflectionAtPlace(selectedPlace)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-[11px] transition-colors"
                >
                  Start a reflection here
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* "Add a Place" Modal / Form */}
      {isAddingPlace && (
        <div 
          id="add-place-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsAddingPlace(false)}
        >
          <div 
            id="add-place-modal-card"
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
                  Add a Place
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingPlace(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewPlace} className="space-y-3.5">
              {/* Place Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Place Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Sunny Window Bench or Forest Cabin"
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                />
              </div>

              {/* Category Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'home', label: 'Home', icon: Home },
                    { id: 'nature', label: 'Nature', icon: Trees },
                    { id: 'study', label: 'Study', icon: BookOpen },
                    { id: 'cafe', label: 'Café', icon: Coffee },
                    { id: 'travel', label: 'Retreat', icon: Compass },
                    { id: 'other', label: 'Other', icon: Building2 },
                  ].map((cat) => {
                    const CatIcon = cat.icon;
                    const isSelected = formCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFormCategory(cat.id as any)}
                        className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <CatIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Precision Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Location Precision
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'approximate', label: 'Approximate area' },
                    { id: 'neighborhood', label: 'Neighborhood' },
                    { id: 'exact', label: 'Specific place' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFormPrecision(p.id as any)}
                      className={`p-2 rounded-xl border text-[11px] font-semibold text-center transition-all ${
                        formPrecision === p.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Address / Location Helper with Geolocation Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Address or Neighborhood Description
                  </label>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={geolocationLoading}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                  >
                    <LocateFixed className="w-3 h-3" />
                    <span>{geolocationLoading ? 'Locating...' : 'Use my current location'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. San Francisco, CA or Lake Tahoe"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                />
                {geolocationError && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    {geolocationError}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="What makes this space meaningful for your reflections?"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddingPlace(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="submit-save-place-btn"
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition-colors"
                >
                  Save Place
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal with Linked Reflections Warning */}
      {deleteConfirmPlace && (
        <div 
          id="delete-place-confirm-modal"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmPlace(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 w-full max-w-sm shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold">Remove Saved Place?</h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 font-sans">
              Are you sure you want to remove <span className="font-bold text-slate-900 dark:text-white">"{deleteConfirmPlace.placeName}"</span> from your saved places?
            </p>

            {getLinkedReflectionsCount(deleteConfirmPlace.placeName) > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                <span className="font-bold">Note:</span> This place is linked to {getLinkedReflectionsCount(deleteConfirmPlace.placeName)} existing reflection{getLinkedReflectionsCount(deleteConfirmPlace.placeName) === 1 ? '' : 's'}. Removing it will keep your existing reflections intact.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmPlace(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-place-btn"
                type="button"
                onClick={() => handleDeletePlace(deleteConfirmPlace)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs transition-colors"
              >
                Remove Place
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
