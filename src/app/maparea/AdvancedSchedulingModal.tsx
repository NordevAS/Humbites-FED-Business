"use client";
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import "./advancedSchedulingModal.css";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import CitySearchField from "./CitySearchField";

// Define the interfaces for the monthly time slots and patterns
interface MonthlyTimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  location: string;
  coordinates?: [number, number];
}

// Core monthly pattern structure with scheduling rules
interface MonthlyPattern {
  id: string;
  name: string;
  type: "specific" | "relative"; // specific = exact day (15th), relative = dynamic (first Monday)
  dayOfMonth?: number;
  relativeWeek?: "first" | "second" | "third" | "fourth" | "last";
  relativeDay?:
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";
  startDate: string;
  durationMonths: number;
  timeSlots: MonthlyTimeSlot[];
  active: boolean; // Controls if pattern is currently active
  createdAt: string;
}

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  location: string;
  coordinates?: [number, number];
}

interface DaySchedule {
  enabled: boolean;
  timeSlots: TimeSlot[];
}

export interface WeeklySchedule {
  enabled: boolean;
  repeatWeekly: boolean;
  schedule: {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
  };
}

interface AdvancedSchedulingModalProps {
  isVisible: boolean;
  initialData?: WeeklySchedule;
  onSave: (schedule: WeeklySchedule) => void;
  onCancel: () => void;
}

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
const DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const DAY_SHORTS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
];

const WEEKLY_SCHEDULE_STORAGE_KEY = "foodtruck_weekly_schedule";
const MONTHLY_PATTERNS_STORAGE_KEY = "foodtruck_monthly_patterns";

// Predefined pattern templates for quick setup
const PATTERN_TEMPLATES: Partial<MonthlyPattern>[] = [
  {
    name: "First Friday of Month",
    type: "relative",
    relativeWeek: "first",
    relativeDay: "friday",
    durationMonths: 6,
  },
  {
    name: "Last Day of Each Month",
    type: "specific",
    dayOfMonth: 31, // Special case: automatically finds last day of month
    durationMonths: 12,
  },
  {
    name: "Mid-Month (15th)",
    type: "specific",
    dayOfMonth: 15,
    durationMonths: 6,
  },
  {
    name: "First Monday of Month",
    type: "relative",
    relativeWeek: "first",
    relativeDay: "monday",
    durationMonths: 6,
  },
  {
    name: "Last Friday of Month",
    type: "relative",
    relativeWeek: "last",
    relativeDay: "friday",
    durationMonths: 6,
  },
];

const EMPTY_DAY_SCHEDULE: DaySchedule = {
  enabled: false,
  timeSlots: [],
};

const EMPTY_WEEKLY_SCHEDULE: WeeklySchedule = {
  enabled: false,
  repeatWeekly: true,
  schedule: {
    monday: {
      enabled: true,
      timeSlots: [
        {
          id: "demo-slot-1",
          startTime: "11:00",
          endTime: "14:00",
          location: "Humbles City",
          coordinates: [59.9139, 10.7522],
        },
      ],
    },
    tuesday: { ...EMPTY_DAY_SCHEDULE },
    wednesday: { ...EMPTY_DAY_SCHEDULE },
    thursday: { ...EMPTY_DAY_SCHEDULE },
    friday: { ...EMPTY_DAY_SCHEDULE },
    saturday: { ...EMPTY_DAY_SCHEDULE },
    sunday: { ...EMPTY_DAY_SCHEDULE },
  },
};

export const saveWeeklyScheduleToStorage = (schedule: WeeklySchedule): void => {
  try {
    localStorage.setItem(WEEKLY_SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
    window.dispatchEvent(
      new CustomEvent("weeklyScheduleUpdated", { detail: schedule })
    );
  } catch (error) {
    console.warn("Failed to save weekly schedule to localStorage:", error);
  }
};

export const loadWeeklyScheduleFromStorage = (): WeeklySchedule | null => {
  try {
    const stored = localStorage.getItem(WEEKLY_SCHEDULE_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as WeeklySchedule;
    if (parsed && typeof parsed === "object" && parsed.schedule) {
      return parsed;
    }
    return null;
  } catch (error) {
    console.warn("Failed to load weekly schedule from localStorage:", error);
    return null;
  }
};

export const saveMonthlyPatternsToStorage = (
  patterns: MonthlyPattern[]
): void => {
  try {
    localStorage.setItem(
      MONTHLY_PATTERNS_STORAGE_KEY,
      JSON.stringify(patterns)
    );
    window.dispatchEvent(
      new CustomEvent("monthlyPatternsUpdated", { detail: patterns })
    );
  } catch (error) {
    console.warn("Failed to save monthly patterns to localStorage:", error);
  }
};

export const loadMonthlyPatternsFromStorage = (): MonthlyPattern[] => {
  try {
    const stored = localStorage.getItem(MONTHLY_PATTERNS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as MonthlyPattern[];
    if (Array.isArray(parsed)) {
      return parsed.map((pattern) => ({
        ...pattern,
        active: pattern.active !== undefined ? pattern.active : true,
        createdAt: pattern.createdAt || new Date().toISOString(),
      }));
    }
    return [];
  } catch (error) {
    console.warn("Failed to load monthly patterns from localStorage:", error);
    return [];
  }
};

export const calculateWeeklyScheduleSummary = (schedule?: WeeklySchedule) => {
  if (!schedule || !schedule.enabled) {
    return {
      activeDays: 0,
      totalLocations: 0,
      activeDayNames: [] as string[],
    };
  }

  const activeDays = DAYS.filter((day) => schedule.schedule[day].enabled);
  const totalLocations = activeDays.reduce((total, day) => {
    return total + schedule.schedule[day].timeSlots.length;
  }, 0);

  const activeDayNames = activeDays.map((day) => {
    const index = DAYS.indexOf(day);
    return DAY_SHORTS[index];
  });

  return {
    activeDays: activeDays.length,
    totalLocations,
    activeDayNames,
  };
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

const createScheduleIcon = (
  day: string,
  slotIndex: number,
  isSelected: boolean,
  hasSelection: boolean
): L.DivIcon => {
  const dayShort = DAY_SHORTS[DAYS.indexOf(day as any)].toUpperCase();
  const slotNumber = slotIndex + 1;
  const scale = isSelected ? 3.5 : 0.8;
  const zIndex = isSelected ? 1000 : 500;
  const pulseClass = isSelected ? "pulsing" : "";

  return new L.DivIcon({
    html: `
      <div class="custom-marker ${pulseClass}" style="transform: scale(${scale}); z-index: ${zIndex}; position: relative;">
        <img src="${
          new URL("../../../icon.png", import.meta.url).href
        }" class="marker-icon" />
        <div class="marker-badge">${dayShort}${slotNumber}</div>
      </div>
    `,
    className: "custom-marker-container",
    iconSize: [50, 58],
    iconAnchor: [25, 58],
    popupAnchor: [0, -58],
  });
};

const getOrdinalSuffix = (day: number): string => {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

// Helper function to handle "31st" special case for month-end patterns
const getDateDescription = (dayOfMonth: number): string => {
  if (dayOfMonth === 31) {
    return "Last day of each month";
  }
  return `${dayOfMonth}${getOrdinalSuffix(dayOfMonth)} of each month`;
};

export default function AdvancedSchedulingModal({
  isVisible,
  initialData,
  onSave,
  onCancel,
}: AdvancedSchedulingModalProps) {
  // Core scheduling state
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(
    initialData || EMPTY_WEEKLY_SCHEDULE
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Map interaction states
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    59.9139, 10.7522,
  ]);
  const [mapKey, setMapKey] = useState(0); // Forces map re-render when needed
  const [selectedSlotForMap, setSelectedSlotForMap] = useState<{
    day: (typeof DAYS)[number];
    slotId: string;
  } | null>(null); // Currently highlighted slot on map

  // Day copying functionality states
  const [selectedCopyFromDay, setSelectedCopyFromDay] =
    useState<(typeof DAYS)[number]>("monday");
  const [selectedCopyToDays, setSelectedCopyToDays] = useState<
    (typeof DAYS)[number][]
  >([]);

  // Clear confirmation modal states
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [clearReason, setClearReason] = useState("");

  // Monthly patterns states
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("weekly");
  const [monthlyPatterns, setMonthlyPatterns] = useState<MonthlyPattern[]>([]);
  const [showCreatePattern, setShowCreatePattern] = useState(false);
  const [editingPattern, setEditingPattern] = useState<MonthlyPattern | null>(
    null
  );
  const [showTemplates, setShowTemplates] = useState(false);
  const [newPattern, setNewPattern] = useState<Partial<MonthlyPattern>>({
    type: "specific",
    name: "",
    dayOfMonth: 1, // Default to 1st of month so specific patterns show preview immediately like relative patterns
    relativeWeek: "first",
    relativeDay: "monday",
    startDate: "",
    durationMonths: 3,
    timeSlots: [],
    active: true,
  });

  // Helper functions for generating unique IDs
  const generateTimeSlotId = (): string => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 5);
  };

  const generateMonthlyTimeSlotId = (): string => {
    return (
      "monthly_" +
      Date.now().toString() +
      Math.random().toString(36).substr(2, 5)
    );
  };

  const generatePatternId = (): string => {
    return (
      "pattern_" +
      Date.now().toString() +
      Math.random().toString(36).substr(2, 5)
    );
  };

  useEffect(() => {
    const storedPatterns = loadMonthlyPatternsFromStorage();
    setMonthlyPatterns(storedPatterns);
  }, []);

  useEffect(() => {
    if (selectedSlotForMap) {
      const slotElement = document.getElementById(
        `slot-${selectedSlotForMap.day}-${selectedSlotForMap.slotId}`
      );
      if (slotElement) {
        slotElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [selectedSlotForMap]);

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

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    const storedSchedule = loadWeeklyScheduleFromStorage();
    if (storedSchedule && !initialData) {
      let fixedSchedule = { ...storedSchedule };
      let needsFix = false;

      DAYS.forEach((day) => {
        const daySchedule = fixedSchedule.schedule[day];
        if (daySchedule.enabled && daySchedule.timeSlots.length === 0) {
          fixedSchedule = {
            ...fixedSchedule,
            schedule: {
              ...fixedSchedule.schedule,
              [day]: {
                ...daySchedule,
                timeSlots: [
                  {
                    id: generateTimeSlotId(),
                    startTime: "11:00",
                    endTime: "14:00",
                    location: "",
                  },
                ],
              },
            },
          };
          needsFix = true;
        }
      });

      setWeeklySchedule(fixedSchedule);

      if (needsFix) {
        saveWeeklyScheduleToStorage(fixedSchedule);
      }
    } else if (initialData) {
      setWeeklySchedule(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    const allTimeSlots = DAYS.flatMap((day) =>
      weeklySchedule.schedule[day].enabled
        ? weeklySchedule.schedule[day].timeSlots.filter(
            (slot) => slot.coordinates
          )
        : []
    );

    if (allTimeSlots.length > 0) {
      const latitudes = allTimeSlots.map((slot) => slot.coordinates![0]);
      const longitudes = allTimeSlots.map((slot) => slot.coordinates![1]);

      const centerLat = latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
      const centerLon =
        longitudes.reduce((a, b) => a + b, 0) / longitudes.length;

      setMapCenter([centerLat, centerLon]);
      setMapKey((prev) => prev + 1);
    }
  }, [weeklySchedule]);

  const toggleDay = (day: (typeof DAYS)[number]): void => {
    setWeeklySchedule((prev) => {
      const currentDay = prev.schedule[day];
      const willBeEnabled = !currentDay.enabled;

      return {
        ...prev,
        schedule: {
          ...prev.schedule,
          [day]: {
            ...currentDay,
            enabled: willBeEnabled,
            timeSlots: willBeEnabled
              ? currentDay.timeSlots.length > 0
                ? currentDay.timeSlots
                : [
                    {
                      id: generateTimeSlotId(),
                      startTime: "11:00",
                      endTime: "14:00",
                      location: "",
                    },
                  ]
              : [],
          },
        },
      };
    });
  };

  const addTimeSlot = (day: (typeof DAYS)[number]): void => {
    const existingSlots = weeklySchedule.schedule[day].timeSlots;
    const lastSlot = existingSlots[existingSlots.length - 1];

    let startTime = "17:00";
    let endTime = "20:00";

    if (lastSlot) {
      const lastEndHour = parseInt(lastSlot.endTime.split(":")[0]);
      startTime = `${(lastEndHour + 1).toString().padStart(2, "0")}:00`;
      endTime = `${(lastEndHour + 4).toString().padStart(2, "0")}:00`;
    }

    setWeeklySchedule((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...prev.schedule[day],
          timeSlots: [
            ...prev.schedule[day].timeSlots,
            {
              id: generateTimeSlotId(),
              startTime,
              endTime,
              location: lastSlot?.location || "",
              coordinates: lastSlot?.coordinates,
            },
          ],
        },
      },
    }));
  };

  const removeTimeSlot = (day: (typeof DAYS)[number], slotId: string): void => {
    setWeeklySchedule((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...prev.schedule[day],
          timeSlots: prev.schedule[day].timeSlots.filter(
            (slot) => slot.id !== slotId
          ),
        },
      },
    }));
  };

  const updateTimeSlot = (
    day: (typeof DAYS)[number],
    slotId: string,
    field: keyof TimeSlot,
    value: string | [number, number]
  ): void => {
    setWeeklySchedule((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...prev.schedule[day],
          timeSlots: prev.schedule[day].timeSlots.map((slot) =>
            slot.id === slotId ? { ...slot, [field]: value } : slot
          ),
        },
      },
    }));
  };

  const handleMarkerDragEnd = useCallback(
    async (event: any, day: (typeof DAYS)[number], slotId: string) => {
      const marker = event.target;
      const position = marker.getLatLng();
      const newCoordinates: [number, number] = [position.lat, position.lng];

      try {
        const newAddress = await reverseGeocode(position.lat, position.lng);

        updateTimeSlot(day, slotId, "location", newAddress);
        updateTimeSlot(day, slotId, "coordinates", newCoordinates);
      } catch (error) {
        console.error("Failed to update location:", error);
      }
    },
    []
  );

  // Generate map markers with collision detection and stacking
  const getAllMapMarkers = () => {
    const markers: Array<{
      day: (typeof DAYS)[number];
      dayIndex: number;
      slot: TimeSlot;
      slotIndex: number;
      displayCoordinates: [number, number];
    }> = [];

    DAYS.forEach((day, dayIndex) => {
      const daySchedule = weeklySchedule.schedule[day];
      if (daySchedule.enabled) {
        daySchedule.timeSlots.forEach((slot, slotIndex) => {
          if (slot.coordinates) {
            markers.push({
              day,
              dayIndex,
              slot,
              slotIndex,
              displayCoordinates: slot.coordinates,
            });
          }
        });
      }
    });

    const coordinateGroups = new Map<string, typeof markers>();
    markers.forEach((marker) => {
      const key = `${marker.slot.coordinates![0]}_${
        marker.slot.coordinates![1]
      }`;
      if (!coordinateGroups.has(key)) {
        coordinateGroups.set(key, []);
      }
      coordinateGroups.get(key)!.push(marker);
    });

    coordinateGroups.forEach((group) => {
      if (group.length > 1) {
        const radius = 0.0002;
        group.forEach((marker, index) => {
          const angle = (index * 2 * Math.PI) / group.length;
          const offsetLat = radius * Math.cos(angle);
          const offsetLng = radius * Math.sin(angle);
          marker.displayCoordinates = [
            marker.slot.coordinates![0] + offsetLat,
            marker.slot.coordinates![1] + offsetLng,
          ];
        });
      }
    });

    const selectedMarker = markers.find(
      (m) =>
        selectedSlotForMap?.day === m.day &&
        selectedSlotForMap?.slotId === m.slot.id
    );

    if (selectedMarker) {
      const otherMarkers = markers.filter((m) => m !== selectedMarker);
      return [...otherMarkers, selectedMarker];
    }

    return markers;
  };

  const handleViewSlotOnMap = (day: (typeof DAYS)[number], slotId: string) => {
    const daySchedule = weeklySchedule.schedule[day];
    const slot = daySchedule.timeSlots.find((slot) => slot.id === slotId);

    if (slot && slot.coordinates) {
      setMapCenter(slot.coordinates);
      setSelectedSlotForMap({ day, slotId });
      setMapKey((prev) => prev + 1);
    }
  };

  const copyToAllDays = (): void => {
    const allDaysExceptFrom = DAYS.filter((day) => day !== selectedCopyFromDay);
    setSelectedCopyToDays(allDaysExceptFrom);
  };

  const copyToWeekdays = (): void => {
    const weekdays = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
    ] as (typeof DAYS)[number][];
    const targetWeekdays = weekdays.filter(
      (day) => day !== selectedCopyFromDay
    );
    setSelectedCopyToDays(targetWeekdays);
  };

  const copyToWeekends = (): void => {
    const weekends = ["saturday", "sunday"] as (typeof DAYS)[number][];
    const targetWeekends = weekends.filter(
      (day) => day !== selectedCopyFromDay
    );
    setSelectedCopyToDays(targetWeekends);
  };

  const copySelectedDays = (): void => {
    const fromDaySchedule = weeklySchedule.schedule[selectedCopyFromDay];
    if (
      !fromDaySchedule.enabled ||
      fromDaySchedule.timeSlots.length === 0 ||
      selectedCopyToDays.length === 0
    )
      return;

    setWeeklySchedule((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        ...selectedCopyToDays.reduce(
          (acc, day) => ({
            ...acc,
            [day]: {
              enabled: true,
              timeSlots: fromDaySchedule.timeSlots.map((slot) => ({
                ...slot,
                id: generateTimeSlotId(),
              })),
            },
          }),
          {}
        ),
      },
    }));
  };

  const addMonthlyTimeSlot = (): void => {
    const newTimeSlot: MonthlyTimeSlot = {
      id: generateMonthlyTimeSlotId(),
      startTime: "09:00",
      endTime: "17:00",
      location: "",
    };

    setNewPattern((prev) => ({
      ...prev,
      timeSlots: [...(prev.timeSlots || []), newTimeSlot],
    }));
  };

  const removeMonthlyTimeSlot = (slotId: string): void => {
    setNewPattern((prev) => ({
      ...prev,
      timeSlots: (prev.timeSlots || []).filter((slot) => slot.id !== slotId),
    }));
  };

  const updateMonthlyTimeSlot = (
    slotId: string,
    field: keyof MonthlyTimeSlot,
    value: string | [number, number]
  ): void => {
    setNewPattern((prev) => ({
      ...prev,
      timeSlots: (prev.timeSlots || []).map((slot) =>
        slot.id === slotId ? { ...slot, [field]: value } : slot
      ),
    }));
  };

  // Calculate live preview of pattern dates for user feedback
  const calculatePatternPreview = (
    pattern: Partial<MonthlyPattern>
  ): string[] => {
    if (!pattern.startDate || !pattern.durationMonths) return [];

    const previews: string[] = [];
    const startDate = new Date(pattern.startDate);

    for (let i = 0; i < pattern.durationMonths; i++) {
      let targetDate: Date;

      if (pattern.type === "specific" && pattern.dayOfMonth) {
        const targetYear = startDate.getFullYear();
        const targetMonth = startDate.getMonth() + i;

        if (pattern.dayOfMonth === 31) {
          targetDate = new Date(targetYear, targetMonth + 1, 0);
        } else {
          const lastDayOfMonth = new Date(
            targetYear,
            targetMonth + 1,
            0
          ).getDate();
          const dayToUse = Math.min(pattern.dayOfMonth, lastDayOfMonth);
          targetDate = new Date(targetYear, targetMonth, dayToUse);
        }
      } else if (
        pattern.type === "relative" &&
        pattern.relativeWeek &&
        pattern.relativeDay
      ) {
        const targetMonth = startDate.getMonth() + i;
        const targetYear = startDate.getFullYear();
        targetDate = calculateRelativeDate(
          targetYear,
          targetMonth,
          pattern.relativeWeek,
          pattern.relativeDay
        );
      } else {
        continue;
      }

      const options: Intl.DateTimeFormatOptions = {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      };
      previews.push(targetDate.toLocaleDateString("en-US", options));
    }

    return previews;
  };

  // Calculate actual date for relative patterns (e.g., "first Monday of March")
  const calculateRelativeDate = (
    year: number,
    month: number,
    week: "first" | "second" | "third" | "fourth" | "last",
    dayName: string
  ): Date => {
    const dayIndex = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ].indexOf(dayName);
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    if (week === "last") {
      for (let day = lastDayOfMonth.getDate(); day >= 1; day--) {
        const date = new Date(year, month, day);
        if (date.getDay() === dayIndex) {
          return date;
        }
      }
    } else {
      const weekNumber = { first: 1, second: 2, third: 3, fourth: 4 }[week];
      let count = 0;
      for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const date = new Date(year, month, day);
        if (date.getDay() === dayIndex) {
          count++;
          if (count === weekNumber) {
            return date;
          }
        }
      }
    }

    return firstDayOfMonth;
  };

  const saveMonthlyPattern = (): void => {
    if (!newPattern.type || !newPattern.startDate || !newPattern.durationMonths)
      return;

    const pattern: MonthlyPattern = {
      id: editingPattern?.id || generatePatternId(),
      name:
        newPattern.name ||
        (newPattern.type === "specific"
          ? getDateDescription(newPattern.dayOfMonth || 1).replace(
              "each",
              "every"
            )
          : `${newPattern.relativeWeek} ${newPattern.relativeDay} of every month`),
      type: newPattern.type,
      dayOfMonth: newPattern.dayOfMonth,
      relativeWeek: newPattern.relativeWeek,
      relativeDay: newPattern.relativeDay,
      startDate: newPattern.startDate,
      durationMonths: newPattern.durationMonths,
      timeSlots: newPattern.timeSlots || [],
      active: newPattern.active !== undefined ? newPattern.active : true,
      createdAt: editingPattern?.createdAt || new Date().toISOString(),
    };

    const conflicts = checkPatternConflicts(pattern);
    if (conflicts.length > 0) {
      alert(
        `Warning: This pattern conflicts with existing patterns on: ${conflicts.join(
          ", "
        )}`
      );
    }

    let updatedPatterns;
    if (editingPattern) {
      updatedPatterns = monthlyPatterns.map((p) =>
        p.id === editingPattern.id ? pattern : p
      );
    } else {
      updatedPatterns = [...monthlyPatterns, pattern];
    }

    setMonthlyPatterns(updatedPatterns);
    saveMonthlyPatternsToStorage(updatedPatterns);

    resetPatternForm();
  };

  const checkPatternConflicts = (newPattern: MonthlyPattern): string[] => {
    const conflicts: string[] = [];
    const newDates = calculatePatternDates(newPattern);

    monthlyPatterns.forEach((existingPattern) => {
      if (existingPattern.id === newPattern.id || !existingPattern.active)
        return;

      const existingDates = calculatePatternDates(existingPattern);

      newDates.forEach((newDate) => {
        existingDates.forEach((existingDate) => {
          if (newDate.toDateString() === existingDate.toDateString()) {
            conflicts.push(newDate.toLocaleDateString());
          }
        });
      });
    });

    return [...new Set(conflicts)];
  };

  const calculatePatternDates = (pattern: MonthlyPattern): Date[] => {
    const dates: Date[] = [];
    const startDate = new Date(pattern.startDate);

    for (let i = 0; i < pattern.durationMonths; i++) {
      let targetDate: Date;

      if (pattern.type === "specific" && pattern.dayOfMonth) {
        const targetYear = startDate.getFullYear();
        const targetMonth = startDate.getMonth() + i;

        if (pattern.dayOfMonth === 31) {
          targetDate = new Date(targetYear, targetMonth + 1, 0);
        } else {
          const lastDayOfMonth = new Date(
            targetYear,
            targetMonth + 1,
            0
          ).getDate();
          const dayToUse = Math.min(pattern.dayOfMonth, lastDayOfMonth);
          targetDate = new Date(targetYear, targetMonth, dayToUse);
        }
      } else if (
        pattern.type === "relative" &&
        pattern.relativeWeek &&
        pattern.relativeDay
      ) {
        const targetMonth = startDate.getMonth() + i;
        const targetYear = startDate.getFullYear();
        targetDate = calculateRelativeDate(
          targetYear,
          targetMonth,
          pattern.relativeWeek,
          pattern.relativeDay
        );
      } else {
        continue;
      }

      dates.push(targetDate);
    }

    return dates;
  };

  // Calculate pattern lifecycle status (active/expired/progress)
  const getPatternStatus = (pattern: MonthlyPattern) => {
    const now = new Date();
    const startDate = new Date(pattern.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + pattern.durationMonths);

    const totalMonths = pattern.durationMonths;
    const monthsPassed = Math.max(
      0,
      Math.floor(
        (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      )
    );
    const monthsCompleted = Math.min(monthsPassed, totalMonths);
    const monthsRemaining = Math.max(0, totalMonths - monthsPassed);

    const isExpired = now > endDate;
    const isActive = now >= startDate && now <= endDate;

    const nextOccurrence = calculatePatternPreview(pattern)[0];

    return {
      totalMonths,
      monthsCompleted,
      monthsRemaining,
      isExpired,
      isActive,
      nextOccurrence,
      progressPercentage: Math.round((monthsCompleted / totalMonths) * 100),
    };
  };

  // Pattern management handlers
  const togglePatternActive = (patternId: string): void => {
    const updatedPatterns = monthlyPatterns.map((pattern) =>
      pattern.id === patternId
        ? { ...pattern, active: !pattern.active }
        : pattern
    );
    setMonthlyPatterns(updatedPatterns);
    saveMonthlyPatternsToStorage(updatedPatterns);
  };

  // Create a copy of existing pattern for editing
  const duplicatePattern = (pattern: MonthlyPattern): void => {
    const duplicated: MonthlyPattern = {
      ...pattern,
      id: generatePatternId(),
      name: `${pattern.name} (Copy)`,
      createdAt: new Date().toISOString(),
      startDate: "",
      active: true,
    };

    setEditingPattern(null);
    setNewPattern({
      ...duplicated,
      timeSlots: duplicated.timeSlots.map((slot) => ({
        ...slot,
        id: generateMonthlyTimeSlotId(),
      })),
    });
    setShowCreatePattern(true);
  };

  const extendPattern = (patternId: string, additionalMonths: number): void => {
    const updatedPatterns = monthlyPatterns.map((pattern) =>
      pattern.id === patternId
        ? {
            ...pattern,
            durationMonths: pattern.durationMonths + additionalMonths,
          }
        : pattern
    );
    setMonthlyPatterns(updatedPatterns);
    saveMonthlyPatternsToStorage(updatedPatterns);
  };

  const applyTemplate = (template: Partial<MonthlyPattern>): void => {
    setNewPattern({
      ...template,
      name: template.name || "",
      startDate: "",
      timeSlots: [],
      active: true,
    });
    setShowTemplates(false);
    setShowCreatePattern(true);
  };

  const startEditingPattern = (pattern: MonthlyPattern): void => {
    setEditingPattern(pattern);
    setNewPattern({
      type: pattern.type,
      name: pattern.name || "",
      dayOfMonth: pattern.dayOfMonth,
      relativeWeek: pattern.relativeWeek,
      relativeDay: pattern.relativeDay,
      startDate: pattern.startDate,
      durationMonths: pattern.durationMonths,
      active: pattern.active !== undefined ? pattern.active : true,
      timeSlots: pattern.timeSlots.map((slot) => ({ ...slot })),
    });
  };

  const resetPatternForm = (): void => {
    setNewPattern({
      type: "specific",
      name: "",
      dayOfMonth: 1, // Default to 1st of month for consistent preview behavior
      relativeWeek: "first",
      relativeDay: "monday",
      startDate: "",
      durationMonths: 3,
      timeSlots: [],
      active: true,
    });
    setShowCreatePattern(false);
    setEditingPattern(null);
    setShowTemplates(false);
  };

  const cancelPatternEdit = (): void => {
    resetPatternForm();
  };

  const deleteMonthlyPattern = (patternId: string): void => {
    const updatedPatterns = monthlyPatterns.filter((p) => p.id !== patternId);
    setMonthlyPatterns(updatedPatterns);
    saveMonthlyPatternsToStorage(updatedPatterns);
  };

  const clearAllDays = (): void => {
    setShowClearConfirmation(true);
  };

  const handleClearConfirmation = (): void => {
    if (clearReason.trim().length < 3) {
      return;
    }

    setWeeklySchedule((prev) => ({
      ...prev,
      schedule: {
        monday: { ...EMPTY_DAY_SCHEDULE },
        tuesday: { ...EMPTY_DAY_SCHEDULE },
        wednesday: { ...EMPTY_DAY_SCHEDULE },
        thursday: { ...EMPTY_DAY_SCHEDULE },
        friday: { ...EMPTY_DAY_SCHEDULE },
        saturday: { ...EMPTY_DAY_SCHEDULE },
        sunday: { ...EMPTY_DAY_SCHEDULE },
      },
    }));

    setShowClearConfirmation(false);
    setClearReason("");
  };

  const handleClearCancel = (): void => {
    setShowClearConfirmation(false);
    setClearReason("");
  };

  const validateSchedule = (): boolean => {
    const newErrors: Record<string, string> = {};

    const enabledDays = DAYS.filter(
      (day) => weeklySchedule.schedule[day].enabled
    );

    enabledDays.forEach((day) => {
      const daySchedule = weeklySchedule.schedule[day];

      if (daySchedule.timeSlots.length === 0) {
        newErrors[`${day}_empty`] = `${
          DAY_LABELS[DAYS.indexOf(day)]
        } is enabled but has no time slots`;
        return;
      }

      daySchedule.timeSlots.forEach((slot, index) => {
        const slotKey = `${day}_${slot.id}`;

        if (!slot.location) {
          newErrors[`${slotKey}_location`] = "Location is required";
        }
        if (!slot.startTime || !slot.endTime) {
          newErrors[`${slotKey}_time`] = "Start and end times are required";
        }

        if (slot.startTime && slot.endTime) {
          const startMinutes = timeToMinutes(slot.startTime);
          const endMinutes = timeToMinutes(slot.endTime);

          if (endMinutes <= startMinutes) {
            newErrors[`${slotKey}_timeLogic`] =
              "End time must be after start time";
          }

          if (endMinutes - startMinutes < 60) {
            newErrors[`${slotKey}_duration`] =
              "Time slot must be at least 1 hour";
          }
        }
      });

      for (let i = 0; i < daySchedule.timeSlots.length; i++) {
        for (let j = i + 1; j < daySchedule.timeSlots.length; j++) {
          const slot1 = daySchedule.timeSlots[i];
          const slot2 = daySchedule.timeSlots[j];

          if (timeSlotsOverlap(slot1, slot2)) {
            newErrors[`${day}_overlap`] = `${
              DAY_LABELS[DAYS.indexOf(day)]
            } has overlapping time slots`;
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const timeSlotsOverlap = (slot1: TimeSlot, slot2: TimeSlot): boolean => {
    const start1 = timeToMinutes(slot1.startTime);
    const end1 = timeToMinutes(slot1.endTime);
    const start2 = timeToMinutes(slot2.startTime);
    const end2 = timeToMinutes(slot2.endTime);

    return start1 < end2 && start2 < end1;
  };

  const handleSave = (): void => {
    if (!validateSchedule()) return;

    setIsSubmitting(true);

    const hasEnabledDays = DAYS.some(
      (day) => weeklySchedule.schedule[day].enabled
    );

    const finalSchedule = {
      ...weeklySchedule,
      enabled: hasEnabledDays,
    };

    saveWeeklyScheduleToStorage(finalSchedule);

    setTimeout(() => {
      onSave(finalSchedule);
      setIsSubmitting(false);
    }, 200);
  };

  const handleCancel = (): void => {
    const storedSchedule = loadWeeklyScheduleFromStorage();
    setWeeklySchedule(storedSchedule || initialData || EMPTY_WEEKLY_SCHEDULE);
    setErrors({});
    onCancel();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  if (!isVisible) return null;

  const enabledDaysCount = DAYS.filter(
    (day) => weeklySchedule.schedule[day].enabled
  ).length;

  const allMapMarkers = getAllMapMarkers();

  const enabledDaysForCopy = DAYS.filter(
    (day) =>
      weeklySchedule.schedule[day].enabled &&
      weeklySchedule.schedule[day].timeSlots.length > 0
  );

  const modalContent = (
    <div className="advanced-modal-backdrop" onClick={handleBackdropClick}>
      <div className="advanced-modal-container">
        <div className="advanced-modal-main-header">
          <h1>Advanced Scheduling</h1>
          <button
            className="close-modal-button"
            onClick={handleCancel}
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

        <div className="advanced-modal-header">
          <div className="modal-tabs">
            <button
              className={`modal-tab ${activeTab === "weekly" ? "active" : ""}`}
              onClick={() => setActiveTab("weekly")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Weekly Schedule
            </button>
            <button
              className={`modal-tab ${activeTab === "monthly" ? "active" : ""}`}
              onClick={() => setActiveTab("monthly")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 3 20V6C3 4.89543 3.89543 4 5 4ZM7 14H10V17H7V14Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Monthly Patterns
            </button>
          </div>
        </div>

        {activeTab === "weekly" && (
          <div className="weekly-schedule-panel">
            <div className="panel-header">
              <div className="schedule-stats">
                <span className="enabled-days-count">
                  {enabledDaysCount} day{enabledDaysCount !== 1 ? "s" : ""}{" "}
                  scheduled
                </span>
              </div>
            </div>

            <div className="quick-actions">
              <div className="copy-days-section">
                <div className="copy-controls">
                  <div className="copy-from">
                    <label>Copy from:</label>
                    <select
                      value={selectedCopyFromDay}
                      onChange={(e) =>
                        setSelectedCopyFromDay(
                          e.target.value as (typeof DAYS)[number]
                        )
                      }
                      disabled={enabledDaysForCopy.length === 0}>
                      {DAYS.map((day, index) => (
                        <option
                          key={day}
                          value={day}
                          disabled={
                            !weeklySchedule.schedule[day].enabled ||
                            weeklySchedule.schedule[day].timeSlots.length === 0
                          }>
                          {DAY_LABELS[index]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="copy-to">
                    <label>Copy to:</label>
                    <div className="copy-to-checkboxes">
                      {DAYS.map((day, index) => (
                        <label key={day} className="copy-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedCopyToDays.includes(day)}
                            disabled={day === selectedCopyFromDay}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCopyToDays((prev) => [...prev, day]);
                              } else {
                                setSelectedCopyToDays((prev) =>
                                  prev.filter((d) => d !== day)
                                );
                              }
                            }}
                          />
                          <span>{DAY_SHORTS[index]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="quick-copy-buttons">
                  <button
                    type="button"
                    className="quick-copy-btn"
                    onClick={copyToAllDays}
                    disabled={
                      !weeklySchedule.schedule[selectedCopyFromDay].enabled ||
                      weeklySchedule.schedule[selectedCopyFromDay].timeSlots
                        .length === 0
                    }>
                    Copy to All Days
                  </button>
                  <button
                    type="button"
                    className="quick-copy-btn"
                    onClick={copyToWeekdays}
                    disabled={
                      !weeklySchedule.schedule[selectedCopyFromDay].enabled ||
                      weeklySchedule.schedule[selectedCopyFromDay].timeSlots
                        .length === 0
                    }>
                    Copy to Weekdays
                  </button>
                  <button
                    type="button"
                    className="quick-copy-btn"
                    onClick={copyToWeekends}
                    disabled={
                      !weeklySchedule.schedule[selectedCopyFromDay].enabled ||
                      weeklySchedule.schedule[selectedCopyFromDay].timeSlots
                        .length === 0
                    }>
                    Copy to Weekends
                  </button>
                </div>
                <button
                  type="button"
                  className="quick-action-btn"
                  onClick={copySelectedDays}
                  disabled={
                    !weeklySchedule.schedule[selectedCopyFromDay].enabled ||
                    weeklySchedule.schedule[selectedCopyFromDay].timeSlots
                      .length === 0 ||
                    selectedCopyToDays.length === 0
                  }>
                  Copy Selected Days
                </button>
              </div>
              <button
                type="button"
                className="quick-action-btn clear"
                onClick={clearAllDays}>
                Clear All
              </button>
            </div>

            {errors.general && (
              <div className="error-message general-error">
                {errors.general}
              </div>
            )}

            {enabledDaysCount === 0 && (
              <div className="empty-schedule-notice">
                <p>
                  💡 <strong>Optional:</strong> Enable days below to create a
                  weekly schedule, or leave empty if you prefer manual
                  scheduling.
                </p>
              </div>
            )}

            <div className="schedule-content-grid">
              <div className="schedule-map-panel">
                <div className="map-header">
                  <h3>Weekly Route Overview</h3>
                  <div className="map-legend">
                    {DAYS.map((day, index) => {
                      const daySchedule = weeklySchedule.schedule[day];
                      if (
                        !daySchedule.enabled ||
                        daySchedule.timeSlots.length === 0
                      )
                        return null;

                      return (
                        <div key={day} className="legend-item">
                          <div
                            className="legend-color"
                            style={{
                              backgroundColor: DAY_COLORS[index],
                            }}></div>
                          <span className="legend-label">
                            {DAY_SHORTS[index]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {allMapMarkers.length > 0 ? (
                  <div className="advanced-map-container">
                    <MapContainer
                      key={mapKey}
                      center={mapCenter}
                      zoom={10}
                      className="map-leaflet-container"
                      style={{
                        width: "100%",
                        borderRadius: "8px",
                      }}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      {allMapMarkers.map((marker) => {
                        const isSelected =
                          selectedSlotForMap?.day === marker.day &&
                          selectedSlotForMap?.slotId === marker.slot.id;
                        const hasActiveSelection = selectedSlotForMap !== null;
                        return (
                          <Marker
                            key={`${marker.day}-${marker.slot.id}`}
                            position={marker.displayCoordinates}
                            icon={createScheduleIcon(
                              marker.day,
                              marker.slotIndex,
                              isSelected,
                              hasActiveSelection
                            )}
                            draggable={true}
                            eventHandlers={{
                              dragend: (e) => {
                                const newPos = e.target.getLatLng();
                                const newCoords: [number, number] = [
                                  newPos.lat,
                                  newPos.lng,
                                ];
                                updateTimeSlot(
                                  marker.day,
                                  marker.slot.id,
                                  "coordinates",
                                  newCoords
                                );
                                handleMarkerDragEnd(
                                  e,
                                  marker.day,
                                  marker.slot.id
                                );
                                setSelectedSlotForMap({
                                  day: marker.day,
                                  slotId: marker.slot.id,
                                });
                              },
                              click: () => {
                                setMapCenter(marker.slot.coordinates!);
                                setSelectedSlotForMap({
                                  day: marker.day,
                                  slotId: marker.slot.id,
                                });
                                setMapKey((prev) => prev + 1);
                              },
                            }}>
                            <Popup>
                              <div className="schedule-popup">
                                <div className="popup-header">
                                  <strong>
                                    {DAY_LABELS[marker.dayIndex]} - Slot{" "}
                                    {marker.slotIndex + 1}
                                    {isSelected && " (Selected)"}
                                  </strong>
                                </div>
                                <div className="popup-content">
                                  <div className="popup-location">
                                    {marker.slot.location}
                                  </div>
                                  <div className="popup-time">
                                    {marker.slot.startTime} -{" "}
                                    {marker.slot.endTime}
                                  </div>
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                        );
                      })}
                    </MapContainer>
                  </div>
                ) : (
                  <div className="empty-map-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 20l-6-3V4l6 3m0 13l6 3m-6-3v-7m6 10l6-3V7l-6 3m0 10v-7M9 4v7m0 0l6 3m-6-3l6-3"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <p>Add locations to see them on the map</p>
                  </div>
                )}
              </div>

              <div className="weekly-schedule-grid">
                {DAYS.map((day, index) => {
                  const daySchedule = weeklySchedule.schedule[day];
                  const dayLabel = DAY_LABELS[index];
                  const dayShort = DAY_SHORTS[index];

                  return (
                    <div
                      key={day}
                      className={`day-card ${
                        daySchedule.enabled ? "enabled" : "disabled"
                      }`}>
                      <div className="day-header">
                        <div className="day-info">
                          <h3>{dayLabel}</h3>
                          <span className="day-short">{dayShort}</span>
                        </div>
                        <label className="day-toggle">
                          <input
                            type="checkbox"
                            checked={daySchedule.enabled}
                            onChange={() => toggleDay(day)}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>

                      {daySchedule.enabled && (
                        <div className="day-content">
                          {daySchedule.timeSlots.map((slot, slotIndex) => {
                            const isSelectedOnMap =
                              selectedSlotForMap?.day === day &&
                              selectedSlotForMap?.slotId === slot.id;
                            return (
                              <div
                                key={slot.id}
                                id={`slot-${day}-${slot.id}`}
                                className={`time-slot ${
                                  isSelectedOnMap ? "selected" : ""
                                }`}>
                                <div className="slot-header">
                                  <span className="slot-number">
                                    #{slotIndex + 1}
                                  </span>
                                  {slot.coordinates && (
                                    <button
                                      type="button"
                                      className="view-map-btn"
                                      onClick={() =>
                                        handleViewSlotOnMap(day, slot.id)
                                      }
                                      title="View on map">
                                      View on Map
                                    </button>
                                  )}
                                  {daySchedule.timeSlots.length > 1 && (
                                    <button
                                      type="button"
                                      className="remove-slot-btn"
                                      onClick={() =>
                                        removeTimeSlot(day, slot.id)
                                      }>
                                      ×
                                    </button>
                                  )}
                                </div>

                                <div className="slot-location">
                                  <CitySearchField
                                    value={slot.location}
                                    onChange={(location, coordinates) => {
                                      updateTimeSlot(
                                        day,
                                        slot.id,
                                        "location",
                                        location
                                      );
                                      if (coordinates) {
                                        updateTimeSlot(
                                          day,
                                          slot.id,
                                          "coordinates",
                                          coordinates
                                        );
                                      }
                                    }}
                                    placeholder="Enter location..."
                                    error={errors[`${day}_${slot.id}_location`]}
                                    label=""
                                  />
                                </div>

                                <div className="slot-times">
                                  <div className="time-input-group">
                                    <label>Start</label>
                                    <input
                                      type="time"
                                      value={slot.startTime}
                                      onChange={(e) =>
                                        updateTimeSlot(
                                          day,
                                          slot.id,
                                          "startTime",
                                          e.target.value
                                        )
                                      }
                                      className="time-input"
                                    />
                                  </div>
                                  <span className="time-separator">to</span>
                                  <div className="time-input-group">
                                    <label>End</label>
                                    <input
                                      type="time"
                                      value={slot.endTime}
                                      onChange={(e) =>
                                        updateTimeSlot(
                                          day,
                                          slot.id,
                                          "endTime",
                                          e.target.value
                                        )
                                      }
                                      className="time-input"
                                    />
                                  </div>
                                </div>

                                {errors[`${day}_${slot.id}_time`] && (
                                  <div className="error-message">
                                    {errors[`${day}_${slot.id}_time`]}
                                  </div>
                                )}
                                {errors[`${day}_${slot.id}_timeLogic`] && (
                                  <div className="error-message">
                                    {errors[`${day}_${slot.id}_timeLogic`]}
                                  </div>
                                )}
                                {errors[`${day}_${slot.id}_duration`] && (
                                  <div className="error-message">
                                    {errors[`${day}_${slot.id}_duration`]}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          <button
                            type="button"
                            className="add-slot-btn"
                            onClick={() => addTimeSlot(day)}>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none">
                              <path
                                d="M12 5V19M5 12H19"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                            Add Time Slot
                          </button>

                          {errors[`${day}_empty`] && (
                            <div className="error-message">
                              {errors[`${day}_empty`]}
                            </div>
                          )}
                          {errors[`${day}_overlap`] && (
                            <div className="error-message">
                              {errors[`${day}_overlap`]}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="repeat-weekly-section">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={weeklySchedule.repeatWeekly}
                  onChange={(e) =>
                    setWeeklySchedule((prev) => ({
                      ...prev,
                      repeatWeekly: e.target.checked,
                    }))
                  }
                />
                <span>Repeat this schedule every week</span>
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={handleCancel}
                disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="button"
                className="save-button"
                onClick={handleSave}
                disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : enabledDaysCount === 0
                  ? "Save (No Weekly Schedule)"
                  : "Save Weekly Schedule"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "monthly" && (
          <div className="monthly-patterns-panel">
            <div className="monthly-patterns-header">
              <h2>Monthly Recurring Patterns</h2>
              <div className="header-actions">
                <button
                  type="button"
                  className="templates-btn"
                  onClick={() => setShowTemplates(!showTemplates)}>
                  📋 Templates
                </button>
                <button
                  type="button"
                  className="add-pattern-btn"
                  onClick={() => {
                    resetPatternForm();
                    setShowCreatePattern(true);
                  }}>
                  Add Monthly Pattern
                </button>
              </div>
            </div>

            {showTemplates && (
              <div className="templates-section">
                <h3>Quick Start Templates</h3>
                <div className="templates-grid">
                  {PATTERN_TEMPLATES.map((template, index) => (
                    <div
                      key={index}
                      className="template-card"
                      onClick={() => applyTemplate(template)}>
                      <h4>{template.name}</h4>
                      <p>
                        {template.type === "specific"
                          ? getDateDescription(template.dayOfMonth || 1)
                          : `${template.relativeWeek} ${template.relativeDay} of each month`}
                      </p>
                      <span className="template-duration">
                        {template.durationMonths} months
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="monthly-patterns-list">
              {monthlyPatterns.map((pattern) => {
                const status = getPatternStatus(pattern);
                const isEditing = editingPattern?.id === pattern.id;

                return (
                  <div
                    key={pattern.id}
                    className={`pattern-container ${
                      isEditing ? "editing" : ""
                    }`}>
                    <div
                      className={`monthly-pattern-card ${
                        !pattern.active ? "inactive" : ""
                      } ${status.isExpired ? "expired" : ""}`}
                      onClick={() => {
                        if (isEditing) {
                          resetPatternForm();
                        } else {
                          startEditingPattern(pattern);
                        }
                      }}>
                      <div className="pattern-header">
                        <div className="pattern-title">
                          <h3>{pattern.name}</h3>
                          <div className="pattern-status-badges">
                            {!pattern.active && (
                              <span className="status-badge inactive">
                                Inactive
                              </span>
                            )}
                            {status.isExpired && (
                              <span className="status-badge expired">
                                Expired
                              </span>
                            )}
                            {status.isActive && pattern.active && (
                              <span className="status-badge active">
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="pattern-actions">
                          <label className="pattern-toggle">
                            <input
                              type="checkbox"
                              checked={!!pattern.active}
                              onChange={(e) => {
                                e.stopPropagation();
                                togglePatternActive(pattern.id);
                              }}
                            />
                            <span className="toggle-slider-small"></span>
                          </label>
                          <button
                            type="button"
                            className="duplicate-pattern-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicatePattern(pattern);
                            }}
                            title="Duplicate pattern">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none">
                              <path
                                d="M16 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6C4 4.89543 4.89543 4 6 4H8M16 4V2C16 1.44772 15.5523 1 15 1H9C8.44772 1 8 1.44772 8 2V4M16 4H8"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="delete-pattern-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMonthlyPattern(pattern.id);
                            }}
                            title="Delete pattern">
                            ×
                          </button>
                        </div>
                      </div>

                      <div className="pattern-progress">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${status.progressPercentage}%`,
                            }}></div>
                        </div>
                        <span className="progress-text">
                          {status.monthsCompleted} of {status.totalMonths}{" "}
                          months completed
                        </span>
                      </div>

                      <div className="pattern-details">
                        <p>Locations: {pattern.timeSlots.length}</p>
                        <p>
                          Next: {status.nextOccurrence || "No upcoming dates"}
                        </p>
                        {status.monthsRemaining > 0 && (
                          <p>
                            Expires in: {status.monthsRemaining} month
                            {status.monthsRemaining !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>

                      {status.isActive && !status.isExpired && (
                        <div className="pattern-quick-actions">
                          <button
                            type="button"
                            className="extend-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              extendPattern(pattern.id, 3);
                            }}>
                            Extend +3 months
                          </button>
                        </div>
                      )}

                      {status.isExpired && (
                        <div className="pattern-expired-actions">
                          <p className="expired-message">
                            This pattern has completed. Would you like to extend
                            it?
                          </p>
                          <div className="expired-buttons">
                            <button
                              type="button"
                              className="extend-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                extendPattern(pattern.id, 6);
                              }}>
                              Extend +6 months
                            </button>
                            <button
                              type="button"
                              className="duplicate-pattern-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicatePattern(pattern);
                              }}>
                              Create New
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {isEditing && (
                      <div className="inline-edit-form">
                        <h4>Edit Pattern</h4>

                        <div className="form-group">
                          <label>Pattern Name (Optional)</label>
                          <input
                            type="text"
                            value={newPattern.name || ""}
                            onChange={(e) =>
                              setNewPattern((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                            placeholder="Custom name for this pattern..."
                          />
                        </div>

                        <div className="pattern-type-section">
                          <label>Pattern Type</label>
                          <div className="pattern-type-toggle">
                            <button
                              type="button"
                              className={`pattern-type-btn ${
                                newPattern.type === "specific" ? "active" : ""
                              }`}
                              onClick={() =>
                                setNewPattern((prev) => ({
                                  ...prev,
                                  type: "specific",
                                  dayOfMonth: prev.dayOfMonth || 1, // Ensure dayOfMonth has default for preview
                                }))
                              }>
                              Specific Date
                            </button>
                            <button
                              type="button"
                              className={`pattern-type-btn ${
                                newPattern.type === "relative" ? "active" : ""
                              }`}
                              onClick={() =>
                                setNewPattern((prev) => ({
                                  ...prev,
                                  type: "relative",
                                }))
                              }>
                              Relative Day
                            </button>
                          </div>
                        </div>

                        {newPattern.type === "specific" && (
                          <div className="specific-date-section">
                            <div className="form-group">
                              <label>Day of Month</label>
                              <input
                                type="number"
                                min="1"
                                max="31"
                                value={newPattern.dayOfMonth || ""}
                                onChange={(e) =>
                                  setNewPattern((prev) => ({
                                    ...prev,
                                    dayOfMonth: e.target.value
                                      ? parseInt(e.target.value)
                                      : undefined,
                                  }))
                                }
                                placeholder="5"
                              />
                            </div>
                          </div>
                        )}

                        {newPattern.type === "relative" && (
                          <div className="relative-day-section">
                            <div className="form-row">
                              <div className="form-group">
                                <label>Week</label>
                                <select
                                  value={newPattern.relativeWeek || "first"}
                                  onChange={(e) =>
                                    setNewPattern((prev) => ({
                                      ...prev,
                                      relativeWeek: e.target.value as
                                        | "first"
                                        | "second"
                                        | "third"
                                        | "fourth"
                                        | "last",
                                    }))
                                  }>
                                  <option value="first">First</option>
                                  <option value="second">Second</option>
                                  <option value="third">Third</option>
                                  <option value="fourth">Fourth</option>
                                  <option value="last">Last</option>
                                </select>
                              </div>
                              <div className="form-group">
                                <label>Day</label>
                                <select
                                  value={newPattern.relativeDay || "monday"}
                                  onChange={(e) =>
                                    setNewPattern((prev) => ({
                                      ...prev,
                                      relativeDay: e.target.value as
                                        | "monday"
                                        | "tuesday"
                                        | "wednesday"
                                        | "thursday"
                                        | "friday"
                                        | "saturday"
                                        | "sunday",
                                    }))
                                  }>
                                  <option value="monday">Monday</option>
                                  <option value="tuesday">Tuesday</option>
                                  <option value="wednesday">Wednesday</option>
                                  <option value="thursday">Thursday</option>
                                  <option value="friday">Friday</option>
                                  <option value="saturday">Saturday</option>
                                  <option value="sunday">Sunday</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="form-row">
                          <div className="form-group">
                            <label>Start Date</label>
                            <input
                              type="date"
                              value={newPattern.startDate || ""}
                              onChange={(e) =>
                                setNewPattern((prev) => ({
                                  ...prev,
                                  startDate: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="form-group">
                            <label>Repeat every month for the next</label>
                            <select
                              value={newPattern.durationMonths || 3}
                              onChange={(e) =>
                                setNewPattern((prev) => ({
                                  ...prev,
                                  durationMonths: parseInt(e.target.value),
                                }))
                              }>
                              <option value={1}>1 month</option>
                              <option value={2}>2 months</option>
                              <option value={3}>3 months</option>
                              <option value={4}>4 months</option>
                              <option value={5}>5 months</option>
                              <option value={6}>6 months</option>
                              <option value={12}>12 months</option>
                            </select>
                          </div>
                        </div>

                        <div className="locations-section">
                          <div className="locations-header">
                            <h4>Locations & Times</h4>
                            <button
                              type="button"
                              className="add-location-btn"
                              onClick={addMonthlyTimeSlot}>
                              Add Location
                            </button>
                          </div>

                          <div className="monthly-time-slots">
                            {(newPattern.timeSlots || []).map((slot) => (
                              <div key={slot.id} className="monthly-time-slot">
                                <div className="slot-times">
                                  <input
                                    type="time"
                                    value={slot.startTime}
                                    onChange={(e) =>
                                      updateMonthlyTimeSlot(
                                        slot.id,
                                        "startTime",
                                        e.target.value
                                      )
                                    }
                                  />
                                  <span>to</span>
                                  <input
                                    type="time"
                                    value={slot.endTime}
                                    onChange={(e) =>
                                      updateMonthlyTimeSlot(
                                        slot.id,
                                        "endTime",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div className="slot-location">
                                  <CitySearchField
                                    value={slot.location}
                                    onChange={(location, coordinates) => {
                                      updateMonthlyTimeSlot(
                                        slot.id,
                                        "location",
                                        location
                                      );
                                      if (coordinates) {
                                        updateMonthlyTimeSlot(
                                          slot.id,
                                          "coordinates",
                                          coordinates
                                        );
                                      }
                                    }}
                                    placeholder="Enter location..."
                                    label=""
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="remove-monthly-slot-btn"
                                  onClick={() =>
                                    removeMonthlyTimeSlot(slot.id)
                                  }>
                                  ×
                                </button>
                              </div>
                            ))}

                            {(!newPattern.timeSlots ||
                              newPattern.timeSlots.length === 0) && (
                              <div className="no-locations-message">
                                <p>
                                  No locations added yet. Click "Add Location"
                                  to get started.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {newPattern.startDate &&
                          (newPattern.dayOfMonth ||
                            (newPattern.relativeWeek &&
                              newPattern.relativeDay)) && (
                            <div className="preview-section">
                              <h4>
                                Preview: Next {newPattern.durationMonths || 0}{" "}
                                occurrences
                              </h4>
                              <div className="preview-dates">
                                {calculatePatternPreview(newPattern).map(
                                  (date, index) => (
                                    <div key={index} className="preview-date">
                                      {date}
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                        <div className="pattern-actions">
                          <button
                            type="button"
                            className="cancel-pattern-btn"
                            onClick={cancelPatternEdit}>
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="save-pattern-btn"
                            onClick={saveMonthlyPattern}
                            disabled={
                              !newPattern.startDate ||
                              (!newPattern.dayOfMonth &&
                                (!newPattern.relativeWeek ||
                                  !newPattern.relativeDay)) ||
                              !newPattern.timeSlots?.length
                            }>
                            Update Pattern
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {monthlyPatterns.length === 0 && (
                <div className="no-patterns-message">
                  <p>
                    No monthly patterns created yet. Click "Add Monthly Pattern"
                    or try a template to get started.
                  </p>
                </div>
              )}
            </div>

            {showCreatePattern && (
              <div className="create-pattern-section">
                <h3>
                  {editingPattern
                    ? "Edit Monthly Pattern"
                    : "Create New Monthly Pattern"}
                </h3>

                <div className="form-group">
                  <label>Pattern Name (Optional)</label>
                  <input
                    type="text"
                    value={newPattern.name || ""}
                    onChange={(e) =>
                      setNewPattern((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Custom name for this pattern..."
                  />
                </div>

                <div className="pattern-type-section">
                  <label>Pattern Type</label>
                  <div className="pattern-type-toggle">
                    <button
                      type="button"
                      className={`pattern-type-btn ${
                        newPattern.type === "specific" ? "active" : ""
                      }`}
                      onClick={() =>
                        setNewPattern((prev) => ({
                          ...prev,
                          type: "specific",
                          dayOfMonth: prev.dayOfMonth || 1, // Ensure dayOfMonth has default for preview
                        }))
                      }>
                      Specific Date
                    </button>
                    <button
                      type="button"
                      className={`pattern-type-btn ${
                        newPattern.type === "relative" ? "active" : ""
                      }`}
                      onClick={() =>
                        setNewPattern((prev) => ({ ...prev, type: "relative" }))
                      }>
                      Relative Day
                    </button>
                  </div>
                </div>

                {newPattern.type === "specific" && (
                  <div className="specific-date-section">
                    <div className="form-group">
                      <label>Day of Month</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={newPattern.dayOfMonth || ""}
                        onChange={(e) =>
                          setNewPattern((prev) => ({
                            ...prev,
                            dayOfMonth: e.target.value
                              ? parseInt(e.target.value)
                              : undefined,
                          }))
                        }
                        placeholder="5"
                      />
                    </div>
                  </div>
                )}

                {newPattern.type === "relative" && (
                  <div className="relative-day-section">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Week</label>
                        <select
                          value={newPattern.relativeWeek || "first"}
                          onChange={(e) =>
                            setNewPattern((prev) => ({
                              ...prev,
                              relativeWeek: e.target.value as
                                | "first"
                                | "second"
                                | "third"
                                | "fourth"
                                | "last",
                            }))
                          }>
                          <option value="first">First</option>
                          <option value="second">Second</option>
                          <option value="third">Third</option>
                          <option value="fourth">Fourth</option>
                          <option value="last">Last</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Day</label>
                        <select
                          value={newPattern.relativeDay || "monday"}
                          onChange={(e) =>
                            setNewPattern((prev) => ({
                              ...prev,
                              relativeDay: e.target.value as
                                | "monday"
                                | "tuesday"
                                | "wednesday"
                                | "thursday"
                                | "friday"
                                | "saturday"
                                | "sunday",
                            }))
                          }>
                          <option value="monday">Monday</option>
                          <option value="tuesday">Tuesday</option>
                          <option value="wednesday">Wednesday</option>
                          <option value="thursday">Thursday</option>
                          <option value="friday">Friday</option>
                          <option value="saturday">Saturday</option>
                          <option value="sunday">Sunday</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={newPattern.startDate || ""}
                      onChange={(e) =>
                        setNewPattern((prev) => ({
                          ...prev,
                          startDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Repeat every month for the next</label>
                    <select
                      value={newPattern.durationMonths || 3}
                      onChange={(e) =>
                        setNewPattern((prev) => ({
                          ...prev,
                          durationMonths: parseInt(e.target.value),
                        }))
                      }>
                      <option value={1}>1 month</option>
                      <option value={2}>2 months</option>
                      <option value={3}>3 months</option>
                      <option value={4}>4 months</option>
                      <option value={5}>5 months</option>
                      <option value={6}>6 months</option>
                      <option value={12}>12 months</option>
                    </select>
                  </div>
                </div>

                <div className="locations-section">
                  <div className="locations-header">
                    <h4>Locations & Times</h4>
                    <button
                      type="button"
                      className="add-location-btn"
                      onClick={addMonthlyTimeSlot}>
                      Add Location
                    </button>
                  </div>

                  <div className="monthly-time-slots">
                    {(newPattern.timeSlots || []).map((slot) => (
                      <div key={slot.id} className="monthly-time-slot">
                        <div className="slot-times">
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) =>
                              updateMonthlyTimeSlot(
                                slot.id,
                                "startTime",
                                e.target.value
                              )
                            }
                          />
                          <span>to</span>
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) =>
                              updateMonthlyTimeSlot(
                                slot.id,
                                "endTime",
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <div className="slot-location">
                          <CitySearchField
                            value={slot.location}
                            onChange={(location, coordinates) => {
                              updateMonthlyTimeSlot(
                                slot.id,
                                "location",
                                location
                              );
                              if (coordinates) {
                                updateMonthlyTimeSlot(
                                  slot.id,
                                  "coordinates",
                                  coordinates
                                );
                              }
                            }}
                            placeholder="Enter location..."
                            label=""
                          />
                        </div>
                        <button
                          type="button"
                          className="remove-monthly-slot-btn"
                          onClick={() => removeMonthlyTimeSlot(slot.id)}>
                          ×
                        </button>
                      </div>
                    ))}

                    {(!newPattern.timeSlots ||
                      newPattern.timeSlots.length === 0) && (
                      <div className="no-locations-message">
                        <p>
                          No locations added yet. Click "Add Location" to get
                          started.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {newPattern.startDate &&
                  (newPattern.dayOfMonth ||
                    (newPattern.relativeWeek && newPattern.relativeDay)) && (
                    <div className="preview-section">
                      <h4>
                        Preview: Next {newPattern.durationMonths || 0}{" "}
                        occurrences
                      </h4>
                      <div className="preview-dates">
                        {calculatePatternPreview(newPattern).map(
                          (date, index) => (
                            <div key={index} className="preview-date">
                              {date}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                <div className="pattern-actions">
                  <button
                    type="button"
                    className="cancel-pattern-btn"
                    onClick={cancelPatternEdit}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="save-pattern-btn"
                    onClick={saveMonthlyPattern}
                    disabled={
                      !newPattern.startDate ||
                      (!newPattern.dayOfMonth &&
                        (!newPattern.relativeWeek ||
                          !newPattern.relativeDay)) ||
                      !newPattern.timeSlots?.length
                    }>
                    {editingPattern ? "Update Pattern" : "Save Pattern"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showClearConfirmation && (
        <div className="advanced-modal-backdrop">
          <div className="confirmation-modal-container">
            <div className="advanced-modal-main-header">
              <h1>Confirm Clear All</h1>
              <button
                className="close-modal-button"
                onClick={handleClearCancel}
                aria-label="Close confirmation">
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

            <div className="weekly-schedule-panel">
              <p className="confirmation-dialog-text">
                Are you sure you want to clear all scheduled days? This action
                cannot be undone.
              </p>

              <div className="confirmation-dialog-input-group">
                <label className="confirmation-dialog-label">
                  Please provide a reason for clearing:
                  <span className="required">*</span>
                </label>
                <textarea
                  value={clearReason}
                  onChange={(e) => setClearReason(e.target.value)}
                  placeholder="Enter reason for clearing all schedules..."
                  className={`confirmation-dialog-textarea ${
                    clearReason.trim().length < 3 ? "error" : ""
                  }`}
                />
                {clearReason.trim().length > 0 &&
                  clearReason.trim().length < 3 && (
                    <div className="error-message">
                      Reason must be at least 3 characters long
                    </div>
                  )}
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleClearCancel}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={`confirmation-clear-button ${
                    clearReason.trim().length < 3 ? "disabled" : ""
                  }`}
                  onClick={handleClearConfirmation}
                  disabled={clearReason.trim().length < 3}>
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (typeof window !== "undefined" && isMounted && document.body) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
