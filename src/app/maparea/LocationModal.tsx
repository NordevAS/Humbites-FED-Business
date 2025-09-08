"use client";
import React, { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import "./locationModal.css";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import LocationFormPanel from "./LocationFormPanel";
import AdvancedSchedulingModal from "./AdvancedSchedulingModal";
import {
  loadWeeklyScheduleFromStorage,
  calculateWeeklyScheduleSummary,
  WeeklySchedule,
} from "./AdvancedSchedulingModal";

// Utility functions for date/time formatting and calculations
const getFutureDate = (daysFromToday: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getCurrentTimeRounded = (): string => {
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  const adjustedTime = new Date(now);
  adjustedTime.setMinutes(roundedMinutes, 0, 0);
  return `${adjustedTime.getHours().toString().padStart(2, "0")}:${adjustedTime
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
};

const getToday = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export interface LocationModalProps {
  isVisible: boolean;
  onClose: () => void;
  currentData: LocationData;
  onSave?: (data: LocationData) => void;
  onInitialLoad?: (data: LocationData) => void;
}

export interface LocationData {
  id?: string;
  name: string;
  date?: string;
  time?: string;
  isRecurring: boolean;
  recurringDays?: string[];
  coordinates?: [number, number];
  breaks?: BreakData[];
  regularHours: {
    open: string;
    close: string;
  };
  specialHours?: {
    open: string;
    close: string;
    startDate: string;
    endDate: string;
  };
  isCancelled?: boolean;
  cancelReason?: string;
  nearbyBusinesses?: string[];
  landmarks?: string;
  crossStreets?: string;
  customNotes?: string;
}

interface BreakData {
  id: string;
  startTime: string;
  duration: number;
  label: string;
}

interface NearbyBusiness {
  id: string;
  name: string;
  type: string;
  coordinates: [number, number];
  amenity: string;
}

export type FormMode = "add" | "edit";

// Helper functions for location data validation and formatting
const isLocationEmpty = (location: LocationData): boolean => {
  return !location?.name || location.name.trim() === "";
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const formatTime = (time: string): string => {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes} ${period}`;
};

// Break time calculation and formatting utilities
const parseTime = (timeString: string): number => {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
};

const formatTimeFromMinutes = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeString = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
  return formatTime(timeString);
};

const formatBreakDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
};

const getBreakIcon = (label: string): string => {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes("coffee") || lowerLabel.includes("tea")) return "☕";
  if (
    lowerLabel.includes("lunch") ||
    lowerLabel.includes("meal") ||
    lowerLabel.includes("dinner") ||
    lowerLabel.includes("breakfast")
  )
    return "🍽️";
  if (
    lowerLabel.includes("meeting") ||
    lowerLabel.includes("call") ||
    lowerLabel.includes("conference")
  )
    return "📞";
  return "🚬";
};

const formatBreakTimeRange = (breakItem: BreakData): string => {
  const startMinutes = parseTime(breakItem.startTime);
  const endMinutes = startMinutes + breakItem.duration;
  const startFormatted = formatTime(breakItem.startTime);
  const endFormatted = formatTimeFromMinutes(endMinutes);
  const duration = formatBreakDuration(breakItem.duration);
  return `${startFormatted} - ${endFormatted} (${duration})`;
};

// Default data factories for new locations
const getInitialFormData = (): LocationData => ({
  name: "",
  date: getToday(),
  time: getCurrentTimeRounded(),
  isRecurring: false,
  recurringDays: [],
  regularHours: { open: "09:00", close: "17:00" },
});

const getEmptyLocationData = (): LocationData => ({
  name: "",
  date: "",
  time: "",
  isRecurring: false,
  recurringDays: [],
  regularHours: { open: "", close: "" },
  specialHours: undefined,
});

const generateLocationId = (): string => {
  return `location_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// LocalStorage keys and business type configuration
const CURRENT_LOCATION_KEY = "foodtruck_current_location";
const FUTURE_LOCATIONS_KEY = "foodtruck_future_locations";
const CLEAR_ALL_AUDIT_KEY = "foodtruck_clear_all_audit";

const BUSINESS_TYPES = [
  { key: "fast_food", label: "Fast Food", amenity: "fast_food", icon: "🍔" },
  { key: "cafe", label: "Cafes", amenity: "cafe", icon: "☕" },
  {
    key: "restaurant",
    label: "Restaurants",
    amenity: "restaurant",
    icon: "🍽️",
  },
];

const RADIUS_PRESETS = [100, 250, 500, 750];

// LocalStorage operations for persisting location data
const saveCurrentLocationToStorage = (location: LocationData): void => {
  try {
    localStorage.setItem(CURRENT_LOCATION_KEY, JSON.stringify(location));
  } catch (error) {
    console.warn("Failed to save current location to localStorage:", error);
  }
};

const loadCurrentLocationFromStorage = (): LocationData | null => {
  try {
    const stored = localStorage.getItem(CURRENT_LOCATION_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as LocationData;
  } catch (error) {
    console.warn("Failed to load current location from localStorage:", error);
    return null;
  }
};

const saveFutureLocationsToStorage = (locations: LocationData[]): void => {
  try {
    localStorage.setItem(FUTURE_LOCATIONS_KEY, JSON.stringify(locations));
  } catch (error) {
    console.warn("Failed to save future locations to localStorage:", error);
  }
};

const loadFutureLocationsFromStorage = (): LocationData[] => {
  try {
    const stored = localStorage.getItem(FUTURE_LOCATIONS_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as LocationData[];
  } catch (error) {
    console.warn("Failed to load future locations from localStorage:", error);
    return [];
  }
};

// Audit trail functions for tracking data clearing operations
const loadClearAllAuditFromStorage = (): any => {
  try {
    const stored = localStorage.getItem(CLEAR_ALL_AUDIT_KEY);
    if (!stored) return null;
    const auditData = JSON.parse(stored);
    if (auditData && auditData.length > 0) {
      return auditData[auditData.length - 1];
    }
    return null;
  } catch (error) {
    console.warn("Failed to load clear audit from localStorage:", error);
    return null;
  }
};

const saveClearAllAudit = (reason: string, clearedData: any): void => {
  try {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      reason: reason,
      clearedData: clearedData,
    };
    const existingAudits = JSON.parse(
      localStorage.getItem(CLEAR_ALL_AUDIT_KEY) || "[]"
    );
    existingAudits.push(auditEntry);
    localStorage.setItem(CLEAR_ALL_AUDIT_KEY, JSON.stringify(existingAudits));
  } catch (error) {
    console.warn("Failed to save clear all audit:", error);
  }
};

const clearClearAllAudit = (): void => {
  try {
    localStorage.removeItem(CLEAR_ALL_AUDIT_KEY);
  } catch (error) {
    console.warn("Failed to clear audit data:", error);
  }
};

const clearAllLocationData = (): void => {
  try {
    localStorage.removeItem(CURRENT_LOCATION_KEY);
    localStorage.removeItem(FUTURE_LOCATIONS_KEY);
  } catch (error) {
    console.warn("Failed to clear location data from localStorage:", error);
  }
};

// External API functions for nearby business search and geocoding
const fetchNearbyBusinesses = async (
  lat: number,
  lon: number,
  radius: number,
  businessTypes: string[]
): Promise<NearbyBusiness[]> => {
  if (businessTypes.length === 0) return [];

  const amenityQueries = businessTypes
    .map((type) => {
      const businessType = BUSINESS_TYPES.find((bt) => bt.key === type);
      return `node["amenity"="${businessType?.amenity}"](around:${radius},${lat},${lon});`;
    })
    .join("");

  const query = `
    [out:json][timeout:25];
    (
      ${amenityQueries}
    );
    out;
  `;

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return data.elements.map((element: any) => ({
      id: element.id.toString(),
      name: element.tags?.name || "Unknown Business",
      type: element.tags?.amenity || "unknown",
      coordinates: [element.lat, element.lon] as [number, number],
      amenity: element.tags?.amenity || "unknown",
    }));
  } catch (error) {
    console.error("Error fetching nearby businesses:", error);
    return [];
  }
};

const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.address) {
      const addr = data.address;
      const parts = [];

      if (addr.house_number && addr.road) {
        parts.push(`${addr.house_number} ${addr.road}`);
      } else if (addr.road) {
        parts.push(addr.road);
      } else if (addr.amenity) {
        parts.push(addr.amenity);
      }

      if (addr.neighbourhood || addr.suburb || addr.city_district) {
        parts.push(addr.neighbourhood || addr.suburb || addr.city_district);
      } else if (addr.city || addr.town || addr.village) {
        parts.push(addr.city || addr.town || addr.village);
      }

      if (parts.length > 0) {
        return parts.join(", ");
      }
    }

    if (data.display_name) {
      const addressParts = data.display_name.split(",");
      if (addressParts.length >= 3) {
        return `${addressParts[0].trim()}, ${addressParts[1].trim()}`;
      }
      return addressParts[0].trim();
    }

    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  } catch (error) {
    console.error("Error reverse geocoding:", error);
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  }
};

// Map icon creation utilities
const createFoodTruckIcon = (): L.Icon => {
  return new L.Icon({
    iconUrl: new URL("../../../icon.png", import.meta.url).href,
    iconSize: [50, 58],
    iconAnchor: [25, 58],
    popupAnchor: [0, -58],
  });
};

const createBusinessIcon = (businessType: string): L.Icon => {
  const isCompetitor = businessType === "fast_food";
  const color = isCompetitor ? "#dc2626" : "#2563eb";

  return new L.Icon({
    iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 12.5 12.5 28.5 12.5 28.5s12.5-16 12.5-28.5C25 5.596 19.404 0 12.5 0z" fill="${color}"/>
        <circle cx="12.5" cy="12.5" r="8" fill="white"/>
        <circle cx="12.5" cy="12.5" r="4" fill="${color}"/>
      </svg>
    `)}`,
    iconSize: [25, 41],
    iconAnchor: [12.5, 41],
    popupAnchor: [0, -41],
  });
};

interface WeeklyScheduleDisplayProps {
  weeklySchedule: WeeklySchedule | null;
}

const WeeklyScheduleDisplay: React.FC<WeeklyScheduleDisplayProps> = ({
  weeklySchedule,
}) => {
  const summary = calculateWeeklyScheduleSummary(weeklySchedule || undefined);

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  if (!weeklySchedule || !weeklySchedule.enabled) {
    return (
      <div className="weekly-schedule-display">
        <div className="weekly-schedule-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect
              x="3"
              y="4"
              width="18"
              height="18"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M16 2V6M8 2V6M3 10H21"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h3>Weekly Schedule</h3>
        </div>
        <div className="weekly-schedule-empty">
          <p>No weekly schedule set</p>
          <span className="empty-schedule-hint">
            Use Advanced Scheduling to create a recurring weekly schedule
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="weekly-schedule-display">
      <div className="weekly-schedule-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect
            x="3"
            y="4"
            width="18"
            height="18"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M16 2V6M8 2V6M3 10H21"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h3>Weekly Schedule</h3>
      </div>

      <div className="schedule-summary-stats">
        <div className="schedule-stat">
          <span className="stat-number">{summary.activeDays}</span>
          <span className="stat-label">days active</span>
        </div>
        <div className="schedule-stat">
          <span className="stat-number">{summary.totalLocations}</span>
          <span className="stat-label">locations scheduled</span>
        </div>
      </div>

      <div className="schedule-day-badges">
        {dayLabels.map((day) => {
          const isActive = summary.activeDayNames.includes(day);
          return (
            <div
              key={day}
              className={`schedule-day-badge ${
                isActive ? "active" : "inactive"
              }`}>
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function LocationModal(props: LocationModalProps) {
  // Core modal and form state
  const [showFormPanel, setShowFormPanel] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("add");
  const [formData, setFormData] = useState<LocationData>(getInitialFormData());
  const [editingLocationId, setEditingLocationId] = useState<string | null>(
    null
  );

  // Map state for view and interaction
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    59.9139, 10.7522,
  ]);
  const [mapKey, setMapKey] = useState(0);
  const [viewingLocationOnMap, setViewingLocationOnMap] =
    useState<LocationData | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Confirmation dialog states for various actions
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedLocationForCancel, setSelectedLocationForCancel] = useState<
    string | null
  >(null);
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [removeReason, setRemoveReason] = useState("");
  const [selectedLocationForRemove, setSelectedLocationForRemove] = useState<
    string | null
  >(null);
  const [showClearAllConfirmation, setShowClearAllConfirmation] =
    useState(false);
  const [clearAllReason, setClearAllReason] = useState("");

  // Audit notification state for tracking cleared data
  const [showAuditNotification, setShowAuditNotification] = useState(false);
  const [auditNotificationData, setAuditNotificationData] = useState<any>(null);

  // Component lifecycle and modal state
  const [isMounted, setIsMounted] = useState(false);
  const [showAdvancedScheduling, setShowAdvancedScheduling] = useState(false);

  // Location data state
  const [futureLocations, setFutureLocations] = useState<LocationData[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule | null>(
    null
  );

  // Nearby business search state
  const [showNearbyBusinesses, setShowNearbyBusinesses] = useState(false);
  const [selectedBusinessTypes, setSelectedBusinessTypes] = useState<string[]>(
    []
  );
  const [searchRadius, setSearchRadius] = useState(250);
  const [nearbyBusinesses, setNearbyBusinesses] = useState<NearbyBusiness[]>(
    []
  );
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(false);
  const [showBusinessList, setShowBusinessList] = useState(false);

  // Initialize Leaflet icons on client-side mount
  useEffect(() => {
    if (typeof window !== "undefined" && L?.Icon?.Default?.prototype) {
      const iconDefault = L.Icon.Default.prototype as any;
      if ("_getIconUrl" in iconDefault) {
        delete iconDefault._getIconUrl;
      }
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });
    }
  }, []);

  // Load persisted data and set up event listeners on component mount
  useEffect(() => {
    setIsMounted(true);
    const storedFutureLocations = loadFutureLocationsFromStorage();
    if (storedFutureLocations.length > 0) {
      setFutureLocations(storedFutureLocations);
    }

    const storedWeeklySchedule = loadWeeklyScheduleFromStorage();
    if (storedWeeklySchedule) {
      setWeeklySchedule(storedWeeklySchedule);
    }

    const auditData = loadClearAllAuditFromStorage();
    if (auditData && auditData.clearedData) {
      setAuditNotificationData(auditData);
      setShowAuditNotification(true);
    }

    const handleWeeklyScheduleUpdate = (event: CustomEvent) => {
      setWeeklySchedule(event.detail);
    };

    window.addEventListener(
      "weeklyScheduleUpdated",
      handleWeeklyScheduleUpdate as EventListener
    );

    return () => {
      setIsMounted(false);
      window.removeEventListener(
        "weeklyScheduleUpdated",
        handleWeeklyScheduleUpdate as EventListener
      );
    };
  }, []);

  // Manage body scroll when modal is visible
  useEffect(() => {
    if (props.isVisible) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [props.isVisible]);

  // Load current location from storage if empty
  useEffect(() => {
    if (props.onInitialLoad && isLocationEmpty(props.currentData)) {
      const storedCurrentLocation = loadCurrentLocationFromStorage();
      if (storedCurrentLocation && !isLocationEmpty(storedCurrentLocation)) {
        props.onInitialLoad(storedCurrentLocation);
      }
    }
  }, [props.onInitialLoad, props.currentData]);

  // Auto-save current location data to localStorage
  useEffect(() => {
    if (!isLocationEmpty(props.currentData)) {
      saveCurrentLocationToStorage(props.currentData);
    }
  }, [props.currentData]);

  // Update map center when location coordinates change
  React.useEffect(() => {
    const activeLocation = viewingLocationOnMap || props.currentData;
    if (activeLocation?.coordinates) {
      setMapCenter(activeLocation.coordinates);
      setMapKey((prev) => prev + 1);
    }
  }, [props.currentData?.coordinates, viewingLocationOnMap]);

  // Load nearby businesses when search parameters change
  useEffect(() => {
    const loadNearbyBusinesses = async () => {
      const activeLocation = viewingLocationOnMap || props.currentData;
      if (
        !showNearbyBusinesses ||
        selectedBusinessTypes.length === 0 ||
        !activeLocation?.coordinates
      ) {
        setNearbyBusinesses([]);
        return;
      }

      setIsLoadingBusinesses(true);
      try {
        const [lat, lon] = activeLocation.coordinates;
        const businesses = await fetchNearbyBusinesses(
          lat,
          lon,
          searchRadius,
          selectedBusinessTypes
        );
        setNearbyBusinesses(businesses);
      } catch (error) {
        console.error("Failed to load nearby businesses:", error);
        setNearbyBusinesses([]);
      } finally {
        setIsLoadingBusinesses(false);
      }
    };

    loadNearbyBusinesses();
  }, [
    showNearbyBusinesses,
    selectedBusinessTypes,
    searchRadius,
    props.currentData?.coordinates,
    viewingLocationOnMap,
  ]);

  // Business analysis utility function
  const calculateDistance = (business: NearbyBusiness): number => {
    const activeLocation = viewingLocationOnMap || props.currentData;
    if (!activeLocation?.coordinates) return 0;

    const [lat1, lon1] = activeLocation.coordinates;
    const [lat2, lon2] = business.coordinates;

    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  };

  const getCategorizedBusinesses = () => {
    const competitors: NearbyBusiness[] = [];
    const opportunities: NearbyBusiness[] = [];
    const other: NearbyBusiness[] = [];

    nearbyBusinesses.forEach((business) => {
      const type = business.type.toLowerCase();
      const name = business.name.toLowerCase();

      if (
        type === "fast_food" ||
        name.includes("truck") ||
        name.includes("mobile")
      ) {
        competitors.push(business);
      } else if (
        type === "cafe" ||
        type === "bar" ||
        type === "pub" ||
        type === "brewery" ||
        type === "restaurant"
      ) {
        opportunities.push(business);
      } else {
        other.push(business);
      }
    });

    return { competitors, opportunities, other };
  };

  const getBusinessIcon = (type: string): string => {
    switch (type.toLowerCase()) {
      case "fast_food":
        return "🍔";
      case "restaurant":
        return "🍽️";
      case "cafe":
        return "☕";
      case "bar":
      case "pub":
        return "🍺";
      case "brewery":
        return "🍻";
      default:
        return "🏪";
    }
  };

  // Map marker drag handler - updates location coordinates and name via geocoding
  const handleMarkerDragEnd = useCallback(
    async (event: any) => {
      const marker = event.target;
      const position = marker.getLatLng();
      const newCoordinates: [number, number] = [position.lat, position.lng];

      setIsDragging(true);

      try {
        const newAddress = await reverseGeocode(position.lat, position.lng);

        if (viewingLocationOnMap) {
          const updatedLocation = {
            ...viewingLocationOnMap,
            name: newAddress,
            coordinates: newCoordinates,
          };
          setViewingLocationOnMap(updatedLocation);

          if (viewingLocationOnMap.id) {
            const updatedLocations = futureLocations.map((location) =>
              location.id === viewingLocationOnMap.id
                ? updatedLocation
                : location
            );
            setFutureLocations(updatedLocations);
            saveFutureLocationsToStorage(updatedLocations);
          }
        } else {
          const updatedCurrentData = {
            ...props.currentData,
            name: newAddress,
            coordinates: newCoordinates,
          };

          if (props.onSave) {
            props.onSave(updatedCurrentData);
            saveCurrentLocationToStorage(updatedCurrentData);
            window.dispatchEvent(
              new CustomEvent("locationUpdated", { detail: updatedCurrentData })
            );
          }
        }

        setMapCenter(newCoordinates);
      } catch (error) {
        console.error("Failed to update location:", error);
      } finally {
        setIsDragging(false);
      }
    },
    [props, viewingLocationOnMap, futureLocations]
  );

  // Form panel handlers - manage add/edit location workflows
  const handleAddNewLocation = useCallback(() => {
    setFormMode("add");
    setFormData(getInitialFormData());
    setEditingLocationId(null);
    setShowFormPanel(true);
  }, []);

  const handleEditCurrentLocation = useCallback(() => {
    setFormMode("edit");
    setFormData(props.currentData);
    setEditingLocationId("current");
    setShowFormPanel(true);
  }, [props.currentData]);

  const handleEditFutureLocation = useCallback((location: LocationData) => {
    setFormMode("edit");
    setFormData(location);
    setEditingLocationId(location.id || null);
    setShowFormPanel(true);
  }, []);

  // Map view handlers - switch between viewing different locations
  const handleViewLocationOnMap = useCallback((location: LocationData) => {
    setViewingLocationOnMap(location);
  }, []);

  const handleBackToCurrentLocation = useCallback(() => {
    setViewingLocationOnMap(null);
  }, []);

  // Location cancellation handlers - mark locations as cancelled with reason
  const handleCancelLocation = useCallback(() => {
    setSelectedLocationForCancel("current");
    setShowCancelConfirmation(true);
  }, []);

  const handleCancelFutureLocation = useCallback((locationId: string) => {
    setSelectedLocationForCancel(locationId);
    setShowCancelConfirmation(true);
  }, []);

  // Location removal handlers - delete locations with optional reason
  const handleRemoveFutureLocation = useCallback(
    (locationId: string) => {
      const location = futureLocations.find((loc) => loc.id === locationId);
      const isCancelled = location?.isCancelled || false;

      if (isCancelled) {
        const updatedLocations = futureLocations.filter(
          (location) => location.id !== locationId
        );
        setFutureLocations(updatedLocations);
        saveFutureLocationsToStorage(updatedLocations);
        console.log("Cancelled location removed without reason");
      } else {
        setSelectedLocationForRemove(locationId);
        setShowRemoveConfirmation(true);
      }
    },
    [futureLocations]
  );

  const handleRemoveCurrentLocation = useCallback(() => {
    const isCancelled = props.currentData?.isCancelled || false;

    if (isCancelled) {
      if (props.onSave) {
        const emptyLocation = getEmptyLocationData();
        props.onSave(emptyLocation);
        saveCurrentLocationToStorage(emptyLocation);
        window.dispatchEvent(
          new CustomEvent("locationUpdated", { detail: emptyLocation })
        );
      }
      console.log("Cancelled current location removed without reason");
    } else {
      setSelectedLocationForRemove("current");
      setShowRemoveConfirmation(true);
    }
  }, [props]);

  // Clear all data handler - removes all location data with audit trail
  const handleClearAllLocations = useCallback(() => {
    setShowClearAllConfirmation(true);
  }, []);

  const handleConfirmClearAll = useCallback(() => {
    const successData = {
      reason: clearAllReason,
      currentLocation: !isLocationEmpty(props.currentData)
        ? props.currentData.name
        : "",
      futureLocations: futureLocations.map((location) => location.name),
    };

    saveClearAllAudit(clearAllReason, successData);
    clearAllLocationData();
    setFutureLocations([]);

    if (props.onSave) {
      props.onSave(getEmptyLocationData());
    }

    window.dispatchEvent(new CustomEvent("locationCleared"));

    setShowClearAllConfirmation(false);
    setClearAllReason("");
    props.onClose();

    console.log("All locations cleared:", clearAllReason);
  }, [props, clearAllReason, futureLocations]);

  const handleCancelClearAll = useCallback(() => {
    setShowClearAllConfirmation(false);
    setClearAllReason("");
  }, []);

  // Audit acknowledgment handler - clear audit notification
  const handleAuditAcknowledged = useCallback(() => {
    clearClearAllAudit();
    setShowAuditNotification(false);
    setAuditNotificationData(null);
    window.dispatchEvent(new CustomEvent("locationCleared"));
  }, []);

  // Confirmation dialog handlers for remove operations
  const handleConfirmRemove = useCallback(() => {
    if (selectedLocationForRemove === "current") {
      if (props.onSave) {
        const emptyLocation = getEmptyLocationData();
        props.onSave(emptyLocation);
        saveCurrentLocationToStorage(emptyLocation);
        window.dispatchEvent(
          new CustomEvent("locationUpdated", { detail: emptyLocation })
        );
      }
    } else {
      const updatedLocations = futureLocations.filter(
        (location) => location.id !== selectedLocationForRemove
      );
      setFutureLocations(updatedLocations);
      saveFutureLocationsToStorage(updatedLocations);
    }
    setShowRemoveConfirmation(false);
    setRemoveReason("");
    setSelectedLocationForRemove(null);
    console.log(
      "Location removed:",
      removeReason ? `Reason: ${removeReason}` : "No reason provided"
    );
  }, [props, removeReason, selectedLocationForRemove, futureLocations]);

  const handleCancelRemoval = useCallback(() => {
    setShowRemoveConfirmation(false);
    setRemoveReason("");
    setSelectedLocationForRemove(null);
  }, []);

  // Confirmation dialog handlers for cancel operations
  const handleConfirmCancel = useCallback(() => {
    if (selectedLocationForCancel === "current") {
      if (props.onSave) {
        const cancelledData = {
          ...props.currentData,
          isCancelled: true,
          cancelReason: cancelReason,
        };
        props.onSave(cancelledData);
        saveCurrentLocationToStorage(cancelledData);
        window.dispatchEvent(
          new CustomEvent("locationUpdated", { detail: cancelledData })
        );
      }
    } else {
      const updatedLocations = futureLocations.map((location) =>
        location.id === selectedLocationForCancel
          ? { ...location, isCancelled: true, cancelReason: cancelReason }
          : location
      );
      setFutureLocations(updatedLocations);
      saveFutureLocationsToStorage(updatedLocations);
    }
    setShowCancelConfirmation(false);
    setCancelReason("");
    setSelectedLocationForCancel(null);
  }, [props, cancelReason, selectedLocationForCancel, futureLocations]);

  const handleCancelCancellation = useCallback(() => {
    setShowCancelConfirmation(false);
    setCancelReason("");
    setSelectedLocationForCancel(null);
  }, []);

  // Form save handler - processes add/edit operations for locations
  const handleFormSave = useCallback(
    (data: LocationData) => {
      if (formMode === "add") {
        const newLocationData = { ...data, id: generateLocationId() };

        if (isLocationEmpty(props.currentData)) {
          if (props.onSave) {
            props.onSave(newLocationData);
            saveCurrentLocationToStorage(newLocationData);
            window.dispatchEvent(
              new CustomEvent("locationUpdated", { detail: newLocationData })
            );
          }
        } else {
          const updatedLocations = [newLocationData, ...futureLocations];
          setFutureLocations(updatedLocations);
          saveFutureLocationsToStorage(updatedLocations);
        }
      } else {
        if (editingLocationId === "current") {
          if (props.onSave) {
            props.onSave(data);
            saveCurrentLocationToStorage(data);
            window.dispatchEvent(
              new CustomEvent("locationUpdated", { detail: data })
            );
          }
        } else {
          const updatedLocationData = {
            ...data,
            id: editingLocationId ?? undefined,
          };
          const updatedLocations = futureLocations.map((location) =>
            location.id === editingLocationId ? updatedLocationData : location
          );
          setFutureLocations(updatedLocations);
          saveFutureLocationsToStorage(updatedLocations);

          if (
            viewingLocationOnMap &&
            viewingLocationOnMap.id === editingLocationId
          ) {
            setViewingLocationOnMap(updatedLocationData);
          }
        }
      }

      setShowFormPanel(false);
      setEditingLocationId(null);
      console.log("Location saved:", data.name);
    },
    [props, formMode, editingLocationId, futureLocations, viewingLocationOnMap]
  );

  const handleFormCancel = useCallback(() => {
    setShowFormPanel(false);
    setEditingLocationId(null);
  }, []);

  // Modal backdrop click handler
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        props.onClose();
      }
    },
    [props]
  );

  // Advanced scheduling modal handlers
  const handleOpenAdvancedScheduling = useCallback(() => {
    setShowAdvancedScheduling(true);
  }, []);

  const handleCloseAdvancedScheduling = useCallback(() => {
    setShowAdvancedScheduling(false);
  }, []);

  const handleSaveAdvancedScheduling = useCallback(
    (schedule: WeeklySchedule) => {
      console.log("Advanced schedule saved:", schedule);
      setWeeklySchedule(schedule);
      setShowAdvancedScheduling(false);
    },
    []
  );

  // Nearby business search handlers
  const handleBusinessTypeToggle = useCallback((businessType: string) => {
    setSelectedBusinessTypes((prev) =>
      prev.includes(businessType)
        ? prev.filter((type) => type !== businessType)
        : [...prev, businessType]
    );
  }, []);

  const handleRadiusChange = useCallback((newRadius: number) => {
    setSearchRadius(newRadius);
  }, []);

  const { currentData } = props;
  const activeLocation = viewingLocationOnMap || currentData;

  if (!props.isVisible) return null;

  // Main modal content with complex conditional rendering based on location states
  const modalContent = (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      {isDragging && (
        <div className="pin-drag-indicator">🎯 Updating location...</div>
      )}
      {showAdvancedScheduling ? (
        <AdvancedSchedulingModal
          isVisible={showAdvancedScheduling}
          onSave={handleSaveAdvancedScheduling}
          onCancel={handleCloseAdvancedScheduling}
        />
      ) : (
        <div className="modal-container">
          {/* Audit notification dialog - shows when data was previously cleared */}
          {showAuditNotification && auditNotificationData && (
            <div className="confirmation-dialog">
              <div className="confirmation-content">
                <h3>⚠️ Important: Location Data Removed</h3>
                <p>
                  All location data was previously cleared. Here are the
                  details:
                </p>
                <div className="audit-notification-reason">
                  <strong>Reason:</strong> {auditNotificationData.reason}
                </div>
                <div className="audit-notification-items">
                  <p className="audit-notification-header">
                    <strong>What was removed:</strong>
                  </p>
                  {auditNotificationData.clearedData.currentLocation && (
                    <div className="audit-notification-item">
                      <div className="audit-label">✓ Current Location:</div>
                      <div className="audit-value">
                        {auditNotificationData.clearedData.currentLocation}
                      </div>
                    </div>
                  )}
                  {auditNotificationData.clearedData.futureLocations &&
                    auditNotificationData.clearedData.futureLocations.length >
                      0 && (
                      <div className="audit-notification-item">
                        <div className="audit-label">✓ Future Locations:</div>
                        <div className="audit-values">
                          {auditNotificationData.clearedData.futureLocations.map(
                            (location: string, index: number) => (
                              <div key={index} className="audit-value">
                                {location}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                </div>
                <div className="confirmation-buttons">
                  <button
                    className="confirm-button"
                    onClick={handleAuditAcknowledged}>
                    Acknowledge
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Clear all confirmation dialog */}
          {showClearAllConfirmation && (
            <div className="confirmation-dialog">
              <div className="confirmation-content">
                <h3>⚠️ Clear All Location Data?</h3>
                <p>
                  Are you sure you want to remove all location data? This will
                  permanently delete your current location and all future
                  locations. This action cannot be undone.
                </p>
                <textarea
                  value={clearAllReason}
                  onChange={(e) => setClearAllReason(e.target.value)}
                  placeholder="Enter reason for clearing all data..."
                  className="cancel-reason-textarea"
                  rows={3}
                />
                <div className="confirmation-buttons">
                  <button
                    className="confirm-button destructive"
                    onClick={handleConfirmClearAll}
                    disabled={!clearAllReason.trim()}>
                    Yes, Clear All
                  </button>
                  <button
                    className="cancel-button"
                    onClick={handleCancelClearAll}>
                    Keep Locations
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Remove confirmation dialog */}
          {showRemoveConfirmation && (
            <div className="confirmation-dialog">
              <div className="confirmation-content">
                <h3>
                  {selectedLocationForRemove === "current"
                    ? "Remove Current Location?"
                    : "Remove Future Location?"}
                </h3>
                <p>
                  Are you sure you want to remove this location? You may
                  optionally provide a reason for the removal.
                </p>
                <textarea
                  value={removeReason}
                  onChange={(e) => setRemoveReason(e.target.value)}
                  placeholder="Optional: Enter reason for removal..."
                  className="cancel-reason-textarea"
                  rows={3}
                />
                <div className="confirmation-buttons">
                  <button
                    className="confirm-button destructive"
                    onClick={handleConfirmRemove}>
                    Yes, Remove
                  </button>
                  <button
                    className="cancel-button"
                    onClick={handleCancelRemoval}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cancel confirmation dialog */}
          {showCancelConfirmation && (
            <div className="confirmation-dialog">
              <div className="confirmation-content">
                <h3>
                  {selectedLocationForCancel === "current"
                    ? "Cancel Current Location?"
                    : "Cancel Future Location?"}
                </h3>
                <p>
                  Please provide a reason for cancelling this location. This
                  will help other users understand why the location was
                  cancelled.
                </p>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter cancellation reason..."
                  className="cancel-reason-textarea"
                  rows={3}
                />
                <div className="confirmation-buttons">
                  <button
                    className="confirm-button"
                    onClick={handleConfirmCancel}
                    disabled={!cancelReason.trim()}>
                    Cancel Location
                  </button>
                  <button
                    className="cancel-button"
                    onClick={handleCancelCancellation}>
                    Keep Location
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="modal-header">
            <h2>Manage Locations</h2>
            <div className="modal-header-actions">
              <button
                className="clear-all-btn"
                onClick={handleClearAllLocations}
                type="button"
                disabled={
                  isLocationEmpty(currentData) && futureLocations.length === 0
                }>
                Clear All
              </button>
              <button
                className="advanced-scheduling-btn"
                onClick={handleOpenAdvancedScheduling}
                type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 8V12L15 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                Advanced Scheduling
              </button>
              <button
                className="close-button"
                onClick={props.onClose}
                aria-label="Close modal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="modal-body">
            <div className="modal-left">
              {/* Current location section - displays current location or empty state */}
              <div className="current-location-section">
                <h3>Current Location</h3>
                {!isLocationEmpty(currentData) ? (
                  <div className="location-info-card">
                    {/* Mobile action buttons - same pattern as future location cards */}
                    {!currentData.isCancelled ? (
                      <div className="card-header-actions">
                        <button
                          className="action-btn edit"
                          type="button"
                          onClick={handleEditCurrentLocation}>
                          Edit
                        </button>
                        <button
                          className="action-btn cancel"
                          type="button"
                          onClick={handleCancelLocation}>
                          Cancel
                        </button>
                        <button
                          className="action-btn remove"
                          type="button"
                          onClick={handleRemoveCurrentLocation}>
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="card-header-actions">
                        <button
                          className="action-btn remove"
                          type="button"
                          onClick={handleRemoveCurrentLocation}>
                          Remove
                        </button>
                      </div>
                    )}

                    <h4>{currentData.name}</h4>

                    {/* Conditional rendering based on cancellation status */}
                    {currentData.isCancelled ? (
                      <>
                        <div className="cancelled-location-info">
                          <span className="cancelled-badge">❌ Cancelled</span>
                        </div>
                        {currentData.cancelReason && (
                          <div className="cancel-reason">
                            <strong>Reason:</strong> {currentData.cancelReason}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Recurring vs scheduled display logic */}
                        {currentData.isRecurring ? (
                          <div className="recurring-info">
                            <span className="recurring-badge">
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none">
                                <path
                                  d="M1 4V10H7M23 20V14H17M7.38 3.08C8.832 2.391 10.443 2 12.11 2C17.56 2 22.11 6.08 22.95 11.29M1.05 12.71C1.89 17.92 6.44 22 11.89 22C13.557 22 15.168 21.609 16.62 20.92"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              Recurring
                            </span>
                            <div className="recurring-days">
                              {currentData.recurringDays?.map((day: string) => (
                                <span key={day} className="day-badge">
                                  {day}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          currentData.date &&
                          currentData.time && (
                            <div className="scheduled-visit-info">
                              <span className="scheduled-badge">
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none">
                                  <rect
                                    x="3"
                                    y="4"
                                    width="18"
                                    height="18"
                                    rx="2"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  />
                                  <path
                                    d="M16 2V6M8 2V6M3 10H21"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                Scheduled Visit
                              </span>
                              <div className="visit-datetime-display">
                                <span className="visit-date-text">
                                  {formatDate(currentData.date)}
                                </span>
                                <span className="arrival-time-text">
                                  arriving at {formatTime(currentData.time)}
                                </span>
                              </div>
                            </div>
                          )
                        )}

                        {/* Break information display */}
                        {currentData.breaks &&
                          currentData.breaks.length > 0 && (
                            <div className="modal-breaks-info">
                              <div className="break-summary-container">
                                {currentData.breaks.map((breakItem) => (
                                  <div
                                    key={breakItem.id}
                                    className="break-primary-display">
                                    <span className="break-type-icon">
                                      {getBreakIcon(breakItem.label)}
                                    </span>
                                    <span className="break-time-text">
                                      {formatBreakTimeRange(breakItem)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Hours display section */}
                        <div className="hours-display">
                          {(currentData.regularHours.open ||
                            currentData.regularHours.close) && (
                            <div className="hours-row">
                              <span className="hours-label">
                                Regular Hours:
                              </span>
                              <span className="hours-value">
                                {currentData.regularHours.open} -{" "}
                                {currentData.regularHours.close}
                              </span>
                            </div>
                          )}
                          {currentData.specialHours && (
                            <div className="hours-row special">
                              <span className="hours-label">
                                Special Hours:
                              </span>
                              <span className="hours-value">
                                {currentData.specialHours.open} -{" "}
                                {currentData.specialHours.close}
                                <span className="hours-dates">
                                  (
                                  {formatDate(
                                    currentData.specialHours.startDate
                                  )}{" "}
                                  to{" "}
                                  {formatDate(currentData.specialHours.endDate)}
                                  )
                                </span>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Location details section - conditional display */}
                        {(currentData.crossStreets ||
                          currentData.landmarks ||
                          currentData.customNotes) && (
                          <div className="location-details-section">
                            <h5 className="details-header">
                              📍 Location Details
                            </h5>

                            {currentData.crossStreets && (
                              <div className="detail-item">
                                <span className="detail-icon">🛣️</span>
                                <span className="detail-label">
                                  Cross Streets:
                                </span>
                                <span className="detail-value">
                                  {currentData.crossStreets}
                                </span>
                              </div>
                            )}

                            {currentData.landmarks && (
                              <div className="detail-item">
                                <span className="detail-icon">🏛️</span>
                                <span className="detail-label">Landmarks:</span>
                                <span className="detail-value">
                                  {currentData.landmarks}
                                </span>
                              </div>
                            )}

                            {currentData.customNotes && (
                              <div className="detail-item">
                                <span className="detail-icon">📝</span>
                                <span className="detail-label">
                                  Instructions:
                                </span>
                                <span className="detail-value">
                                  {currentData.customNotes}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  /* Empty location state */
                  <div className="empty-location-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M21 10C21 17 12 23 12 23 C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <p>No current location set</p>
                    <button
                      className="location-action-btn add"
                      type="button"
                      onClick={handleAddNewLocation}>
                      Add Location
                    </button>
                  </div>
                )}
              </div>

              {/* Map section - displays interactive map or empty state */}
              <div className="map-section">
                {activeLocation.name && activeLocation.coordinates ? (
                  <>
                    {viewingLocationOnMap && (
                      <div className="back-to-current-container">
                        <button
                          type="button"
                          onClick={handleBackToCurrentLocation}
                          className="back-to-current-btn">
                          ← Back to Current Location
                        </button>
                      </div>
                    )}
                    <div className="map-container">
                      <MapContainer
                        key={mapKey}
                        center={mapCenter}
                        zoom={13}
                        style={{
                          height: "100%",
                          width: "100%",
                          borderRadius: "12px",
                        }}>
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Marker
                          position={mapCenter}
                          icon={createFoodTruckIcon()}
                          draggable={true}
                          eventHandlers={{
                            dragend: handleMarkerDragEnd,
                          }}>
                          <Popup>{activeLocation.name}</Popup>
                        </Marker>
                        {nearbyBusinesses.map((business) => (
                          <Marker
                            key={business.id}
                            position={business.coordinates}
                            icon={createBusinessIcon(business.type)}>
                            <Popup>
                              <div>
                                <strong>{business.name}</strong>
                                <br />
                                <em>{business.type}</em>
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    </div>

                    {/* Nearby businesses search panel */}
                    <div className="nearby-businesses-controls">
                      <div className="nearby-businesses-toggle">
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={showNearbyBusinesses}
                            onChange={(e) =>
                              setShowNearbyBusinesses(e.target.checked)
                            }
                          />
                          <span className="toggle-text">
                            Show Nearby Businesses
                          </span>
                        </label>
                      </div>

                      {showNearbyBusinesses && (
                        <div className="nearby-businesses-panel">
                          <div className="business-types-section">
                            <h4>Business Types</h4>
                            <div className="business-type-checkboxes">
                              {BUSINESS_TYPES.map((businessType) => (
                                <label
                                  key={businessType.key}
                                  className="business-type-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={selectedBusinessTypes.includes(
                                      businessType.key
                                    )}
                                    onChange={() =>
                                      handleBusinessTypeToggle(businessType.key)
                                    }
                                  />
                                  <span className="business-type-icon">
                                    {businessType.icon}
                                  </span>
                                  <span className="business-type-label">
                                    {businessType.label}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="radius-controls-section">
                            <h4>Search Radius</h4>

                            <div className="radius-quick-buttons">
                              {RADIUS_PRESETS.map((radius) => (
                                <button
                                  key={radius}
                                  type="button"
                                  className={`radius-preset-btn ${
                                    searchRadius === radius ? "active" : ""
                                  }`}
                                  onClick={() => handleRadiusChange(radius)}>
                                  {radius}m
                                </button>
                              ))}
                            </div>

                            <div className="radius-slider-container">
                              <label
                                htmlFor="radius-slider"
                                className="slider-label">
                                Custom radius: {searchRadius}m
                              </label>
                              <input
                                id="radius-slider"
                                type="range"
                                min="50"
                                max="1000"
                                step="50"
                                value={searchRadius}
                                onChange={(e) =>
                                  handleRadiusChange(parseInt(e.target.value))
                                }
                                className="radius-slider"
                              />
                              <div className="slider-range-labels">
                                <span>50m</span>
                                <span>1000m</span>
                              </div>
                            </div>
                          </div>

                          {isLoadingBusinesses && (
                            <div className="loading-businesses">
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none">
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  strokeDasharray="32"
                                  strokeDashoffset="32">
                                  <animateTransform
                                    attributeName="transform"
                                    type="rotate"
                                    dur="1s"
                                    values="0 12 12;360 12 12"
                                    repeatCount="indefinite"
                                  />
                                </circle>
                              </svg>
                              <span>Loading nearby businesses...</span>
                            </div>
                          )}

                          {/* Business results display with categorization */}
                          {nearbyBusinesses.length > 0 && (
                            <div className="nearby-businesses-summary">
                              <div className="businesses-header">
                                <h4>
                                  Found {nearbyBusinesses.length} businesses
                                  within {searchRadius}m
                                </h4>
                                <button
                                  className="toggle-businesses-list"
                                  onClick={() =>
                                    setShowBusinessList(!showBusinessList)
                                  }
                                  type="button">
                                  {showBusinessList
                                    ? "Hide Details ▲"
                                    : "View Details ▼"}
                                </button>
                              </div>

                              {showBusinessList && (
                                <div className="businesses-intelligence-panel">
                                  {getCategorizedBusinesses().competitors
                                    .length > 0 && (
                                    <div className="business-category competitors">
                                      <h5>
                                        🚨 COMPETITORS (
                                        {
                                          getCategorizedBusinesses().competitors
                                            .length
                                        }
                                        )
                                      </h5>
                                      <div className="business-list">
                                        {getCategorizedBusinesses().competitors.map(
                                          (business) => (
                                            <div
                                              key={business.id}
                                              className="business-item competitor">
                                              <div className="business-info">
                                                <span className="business-icon">
                                                  🚚
                                                </span>
                                                <span className="business-name">
                                                  {business.name}
                                                </span>
                                                <span className="business-distance">
                                                  {calculateDistance(business)}m
                                                </span>
                                              </div>
                                              <div className="business-actions">
                                                <a
                                                  href={`https://www.google.com/search?q=${encodeURIComponent(
                                                    business.name +
                                                      " " +
                                                      (activeLocation?.name ||
                                                        "")
                                                  )}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="business-action-link">
                                                  Search Google
                                                </a>
                                                <a
                                                  href={`https://www.google.com/maps?q=${business.coordinates[0]},${business.coordinates[1]}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="business-action-link">
                                                  View on Maps
                                                </a>
                                              </div>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {getCategorizedBusinesses().opportunities
                                    .length > 0 && (
                                    <div className="business-category opportunities">
                                      <h5>
                                        💰 OPPORTUNITIES (
                                        {
                                          getCategorizedBusinesses()
                                            .opportunities.length
                                        }
                                        )
                                      </h5>
                                      <div className="business-list">
                                        {getCategorizedBusinesses().opportunities.map(
                                          (business) => (
                                            <div
                                              key={business.id}
                                              className="business-item opportunity">
                                              <div className="business-info">
                                                <span className="business-icon">
                                                  {getBusinessIcon(
                                                    business.type
                                                  )}
                                                </span>
                                                <span className="business-name">
                                                  {business.name}
                                                </span>
                                                <span className="business-distance">
                                                  {calculateDistance(business)}m
                                                </span>
                                              </div>
                                              <div className="business-actions">
                                                <a
                                                  href={`https://www.google.com/search?q=${encodeURIComponent(
                                                    business.name +
                                                      " " +
                                                      (activeLocation?.name ||
                                                        "")
                                                  )}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="business-action-link">
                                                  Search Google
                                                </a>
                                                <a
                                                  href={`https://www.google.com/maps?q=${business.coordinates[0]},${business.coordinates[1]}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="business-action-link">
                                                  View on Maps
                                                </a>
                                              </div>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {getCategorizedBusinesses().other.length >
                                    0 && (
                                    <div className="business-category other">
                                      <h5>
                                        ⚠️ OTHER (
                                        {
                                          getCategorizedBusinesses().other
                                            .length
                                        }
                                        )
                                      </h5>
                                      <div className="business-list">
                                        {getCategorizedBusinesses().other.map(
                                          (business) => (
                                            <div
                                              key={business.id}
                                              className="business-item other-business">
                                              <div className="business-info">
                                                <span className="business-icon">
                                                  {getBusinessIcon(
                                                    business.type
                                                  )}
                                                </span>
                                                <span className="business-name">
                                                  {business.name}
                                                </span>
                                                <span className="business-distance">
                                                  {calculateDistance(business)}m
                                                </span>
                                              </div>
                                              <div className="business-actions">
                                                <a
                                                  href={`https://www.google.com/search?q=${encodeURIComponent(
                                                    business.name +
                                                      " " +
                                                      (activeLocation?.name ||
                                                        "")
                                                  )}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="business-action-link">
                                                  Search Google
                                                </a>
                                                <a
                                                  href={`https://www.google.com/maps?q=${business.coordinates[0]},${business.coordinates[1]}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="business-action-link">
                                                  View on Maps
                                                </a>
                                              </div>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* Empty map state */
                  <div className="empty-map-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 20l-6-3V4l6 3m0 13l6 3m-6-3v-7m6 10l6-3V7l-6 3m0 10v-7M9 4v7m0 0l6 3m-6-3l6-3"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <p>Select a location to see the map</p>
                  </div>
                )}
              </div>

              {/* Future locations section - displays scheduled locations or empty state */}
              <div className="future-locations-section">
                <h3>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M19 14C19 14.5304 18.7893 15.0391 18.4142 15.4142C18.0391 15.7893 17.5304 16 17 16H7L3 20V6C3 5.46957 3.21071 4.96086 3.58579 4.58579C3.96086 4.21071 4.46957 4 5 4H17C17.5304 4 18.0391 4.21071 18.4142 4.58579C18.7893 4.96086 19 5.46957 19 6V14Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Future Locations{" "}
                  <span className="count">
                    ({futureLocations.length} scheduled)
                  </span>
                </h3>

                {futureLocations.length > 0 ? (
                  /* Future locations list with complex conditional rendering */
                  <div className="future-locations-list">
                    {futureLocations.map((location) => (
                      <div
                        key={location.id}
                        className={`future-location-card ${
                          location.isCancelled ? "cancelled" : ""
                        }`}>
                        <div className="card-header-actions">
                          <button
                            className="action-btn view-map"
                            type="button"
                            disabled={location.isCancelled}
                            onClick={() => handleViewLocationOnMap(location)}>
                            View on Map
                          </button>
                          <button
                            className="action-btn edit"
                            type="button"
                            onClick={() => handleEditFutureLocation(location)}
                            disabled={location.isCancelled}>
                            Edit
                          </button>
                          {!location.isCancelled ? (
                            <>
                              <button
                                className="action-btn cancel"
                                type="button"
                                onClick={() =>
                                  handleCancelFutureLocation(location.id!)
                                }>
                                Cancel
                              </button>
                              <button
                                className="action-btn remove"
                                type="button"
                                onClick={() =>
                                  handleRemoveFutureLocation(location.id!)
                                }>
                                Remove
                              </button>
                            </>
                          ) : (
                            <button
                              className="action-btn remove"
                              type="button"
                              onClick={() =>
                                handleRemoveFutureLocation(location.id!)
                              }>
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="location-details">
                          <h4>{location.name}</h4>
                          {/* Similar conditional rendering logic as current location */}
                          {location.isCancelled ? (
                            <>
                              <p className="location-meta">
                                <span className="cancelled-badge">
                                  ❌ Cancelled
                                </span>
                              </p>
                              {location.cancelReason && (
                                <p className="cancel-reason">
                                  <strong>Reason:</strong>{" "}
                                  {location.cancelReason}
                                </p>
                              )}
                            </>
                          ) : (
                            <>
                              {location.isRecurring ? (
                                <p className="location-meta">
                                  <span className="recurring-indicator">⟲</span>
                                  Recurring Location
                                </p>
                              ) : (
                                location.date &&
                                location.time && (
                                  <div className="scheduled-visit-info">
                                    <span className="scheduled-badge">
                                      <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none">
                                        <rect
                                          x="3"
                                          y="4"
                                          width="18"
                                          height="18"
                                          rx="2"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                        />
                                        <path
                                          d="M16 2V6M8 2V6M3 10H21"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                      Scheduled Visit
                                    </span>
                                    <div className="visit-datetime-display">
                                      <span className="visit-date-text">
                                        {formatDate(location.date)}
                                      </span>
                                      <span className="arrival-time-text">
                                        arriving at {formatTime(location.time)}
                                      </span>
                                    </div>
                                  </div>
                                )
                              )}

                              {location.isRecurring &&
                                location.recurringDays && (
                                  <div className="recurring-days-display">
                                    <span className="label">Repeat on:</span>
                                    {location.recurringDays.map(
                                      (day: string) => (
                                        <span key={day} className="day-pill">
                                          {day}
                                        </span>
                                      )
                                    )}
                                  </div>
                                )}

                              {location.breaks &&
                                location.breaks.length > 0 && (
                                  <div className="future-location-breaks">
                                    <div className="future-break-summary">
                                      {location.breaks.map((breakItem) => (
                                        <div
                                          key={breakItem.id}
                                          className="break-item-display">
                                          <span className="break-icon">
                                            {getBreakIcon(breakItem.label)}
                                          </span>
                                          <span className="break-text">
                                            {formatBreakTimeRange(breakItem)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                              <div className="hours-display">
                                {(location.regularHours.open ||
                                  location.regularHours.close) && (
                                  <div className="hours-row">
                                    <span className="hours-label">
                                      Regular Hours:
                                    </span>
                                    <span className="hours-value">
                                      {location.regularHours.open} -{" "}
                                      {location.regularHours.close}
                                    </span>
                                  </div>
                                )}
                                {location.specialHours && (
                                  <div className="hours-row special">
                                    <span className="hours-label">
                                      Special Hours:
                                    </span>
                                    <span className="hours-value">
                                      {location.specialHours.open} -{" "}
                                      {location.specialHours.close}
                                      <span className="hours-dates">
                                        (
                                        {formatDate(
                                          location.specialHours.startDate
                                        )}{" "}
                                        to{" "}
                                        {formatDate(
                                          location.specialHours.endDate
                                        )}
                                        )
                                      </span>
                                    </span>
                                  </div>
                                )}
                              </div>

                              {(location.crossStreets ||
                                location.landmarks ||
                                location.customNotes) && (
                                <div className="future-location-details-section">
                                  <h5 className="details-header">
                                    📍 Location Details
                                  </h5>

                                  {location.crossStreets && (
                                    <div className="detail-item">
                                      <span className="detail-icon">🛣️</span>
                                      <span className="detail-label">
                                        Cross Streets:
                                      </span>
                                      <span className="detail-value">
                                        {location.crossStreets}
                                      </span>
                                    </div>
                                  )}

                                  {location.landmarks && (
                                    <div className="detail-item">
                                      <span className="detail-icon">🏛️</span>
                                      <span className="detail-label">
                                        Landmarks:
                                      </span>
                                      <span className="detail-value">
                                        {location.landmarks}
                                      </span>
                                    </div>
                                  )}

                                  {location.customNotes && (
                                    <div className="detail-item">
                                      <span className="detail-icon">📝</span>
                                      <span className="detail-label">
                                        Instructions:
                                      </span>
                                      <span className="detail-value">
                                        {location.customNotes}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Empty future locations state */
                  <div className="empty-future-locations">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 20l-6-3V4l6 3m0 13l6 3m-6-3v-7m6 10l6-3V7l-6 3m0 10v-7M9 4v7m0 0l6 3m-6-3l6-3"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <p>No future locations scheduled</p>
                  </div>
                )}
              </div>
            </div>
            {/* Right panel - shows form or action bar based on state */}
            <div className={`modal-right ${showFormPanel ? "visible" : ""}`}>
              {!showFormPanel ? (
                <div className="action-bar">
                  <WeeklyScheduleDisplay weeklySchedule={weeklySchedule} />

                  <h3>Location Actions</h3>
                  <p className="action-bar-description">
                    Manage your current location or add new future locations.
                  </p>

                  <div className="action-buttons">
                    {/* Complex conditional rendering based on current location state */}
                    {!isLocationEmpty(currentData) ? (
                      <>
                        {!currentData.isCancelled ? (
                          <>
                            <button
                              className="action-bar-btn edit-btn"
                              onClick={handleEditCurrentLocation}>
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none">
                                <path
                                  d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10217 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              Edit Current Location
                            </button>
                            <button
                              className="action-bar-btn cancel-btn"
                              onClick={handleCancelLocation}>
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none">
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                />
                                <path
                                  d="M15 9L9 15M9 9L15 15"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              Cancel Location
                            </button>
                            <button
                              className="action-bar-btn remove-btn"
                              onClick={handleRemoveCurrentLocation}>
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none">
                                <path
                                  d="M3 6H5H21"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              Remove Current Location
                            </button>
                          </>
                        ) : (
                          /* Cancelled location state display */
                          <div className="cancelled-location-message">
                            <svg
                              width="48"
                              height="48"
                              viewBox="0 0 24 24"
                              fill="none">
                              <circle
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path
                                d="M15 9L9 15M9 9L15 15"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <p>This location has been cancelled</p>
                            <p className="cancelled-subtitle">
                              No actions available for cancelled locations
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      /* No location state display */
                      <div className="no-location-message">
                        <svg
                          width="48"
                          height="48"
                          viewBox="0 0 24 24"
                          fill="none">
                          <path
                            d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <p>No current location set</p>
                        <p className="no-location-subtitle">
                          Set a current location to manage it here
                        </p>
                      </div>
                    )}

                    <div className="action-divider">
                      <span>or</span>
                    </div>

                    <button
                      className="action-bar-btn add-btn"
                      onClick={handleAddNewLocation}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none">
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M12 8V16M8 12H16"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {isLocationEmpty(currentData)
                        ? "Add Location"
                        : "Add Future Location"}
                    </button>
                  </div>
                </div>
              ) : (
                <LocationFormPanel
                  isVisible={showFormPanel}
                  mode={formMode}
                  initialData={formData}
                  onSave={handleFormSave}
                  onCancel={handleFormCancel}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Portal rendering logic - only render when mounted and document is available
  if (typeof window !== "undefined" && isMounted && document.body) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
