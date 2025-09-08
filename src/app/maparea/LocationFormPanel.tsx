"use client";
import { useState, useEffect, useRef } from "react";
import "./locationFormPanel.css";
import CitySearchField from "./CitySearchField";

// Date utility functions
const getToday = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getFutureDate = (daysFromToday: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Get current time rounded to nearest 15 minutes
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

// Calculate next Saturday date
const getNextWeekendStart = (): string => {
  const now = new Date();
  const currentDay = now.getDay();

  let daysUntilSaturday;
  if (currentDay === 6) {
    daysUntilSaturday = 7;
  } else if (currentDay === 0) {
    daysUntilSaturday = 6;
  } else {
    daysUntilSaturday = 6 - currentDay;
  }

  return getFutureDate(daysUntilSaturday);
};

// Calculate next Sunday date
const getNextWeekendEnd = (): string => {
  const weekendStart = new Date(getNextWeekendStart());
  weekendStart.setDate(weekendStart.getDate() + 1);

  const year = weekendStart.getFullYear();
  const month = String(weekendStart.getMonth() + 1).padStart(2, "0");
  const day = String(weekendStart.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface BreakData {
  id: string;
  startTime: string;
  duration: number;
  label: string;
}

interface WeatherData {
  current: {
    temp: number;
    feelsLike: number;
    description: string;
    icon: string;
    windSpeed: number;
    humidity: number;
  };
  hourly: Array<{
    time: string;
    temp: number;
    description: string;
    icon: string;
  }>;
  daily: Array<{
    date: string;
    dayName: string;
    highTemp: number;
    lowTemp: number;
    description: string;
    icon: string;
    humidity: number;
    windSpeed: number;
  }>;
}

interface LocationData {
  name: string;
  isRecurring: boolean;
  recurringDays?: string[];
  date?: string;
  time?: string;
  coordinates?: [number, number];
  breaks?: BreakData[];
  regularHours: {
    open: string;
    close: string;
  };
  specialHours?: {
    startDate: string;
    endDate: string;
    open: string;
    close: string;
  };
  isCancelled?: boolean;
  cancelReason?: string;

  nearbyBusinesses?: string[];
  landmarks?: string;
  crossStreets?: string;
  customNotes?: string;
}

interface LocationFormPanelProps {
  isVisible: boolean;
  mode: "add" | "edit";
  initialData: LocationData;
  onSave: (data: LocationData) => void;
  onCancel: () => void;
}

const BREAK_DURATIONS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

const BREAK_PRESETS = [
  { label: "Coffee Break", duration: 15 },
  { label: "Lunch", duration: 60 },
  { label: "Break", duration: 30 },
  { label: "Meeting", duration: 45 },
];

export default function LocationFormPanel({
  isVisible,
  mode,
  initialData,
  onSave,
  onCancel,
}: LocationFormPanelProps) {
  // Temperature conversion utilities
  const celsiusToFahrenheit = (celsius: number): number => {
    return Math.round((celsius * 9) / 5 + 32);
  };

  const formatTemperature = (temp: number, unit: "C" | "F"): string => {
    if (unit === "F") {
      return `${celsiusToFahrenheit(temp)}°F`;
    }
    return `${Math.round(temp)}°C`;
  };

  const getTemperatureValue = (temp: number, unit: "C" | "F"): number => {
    if (unit === "F") {
      return celsiusToFahrenheit(temp);
    }
    return Math.round(temp);
  };

  // Weather API call
  const fetchWeatherData = async (
    coordinates: [number, number]
  ): Promise<WeatherData | null> => {
    try {
      const [lat, lon] = coordinates;

      const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const weatherData = await response.json();

      if (weatherData.error) {
        throw new Error(weatherData.error);
      }

      return weatherData;
    } catch (error) {
      console.error("Failed to fetch weather data:", error);
      return null;
    }
  };

  // Form data state
  const [formData, setFormData] = useState<LocationData>(initialData);
  // UI mode toggle
  const [formMode, setFormMode] = useState<"quick" | "detailed">("quick");
  // Data loss warning dialog visibility
  const [showDataLossWarning, setShowDataLossWarning] = useState(false);
  // Feature toggles
  const [specialHoursEnabled, setSpecialHoursEnabled] = useState(
    !!formData.specialHours
  );
  const [breaksEnabled, setBreaksEnabled] = useState(
    !!(formData.breaks && formData.breaks.length > 0)
  );
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [temperatureUnit, setTemperatureUnit] = useState<"C" | "F">("F");

  // Form validation and state tracking
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationTimeout, setValidationTimeout] =
    useState<NodeJS.Timeout | null>(null);

  // Weather data state
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const fieldRefs = {
    date: useRef<HTMLInputElement>(null),
    time: useRef<HTMLInputElement>(null),
    regularHoursOpen: useRef<HTMLInputElement>(null),
    regularHoursClose: useRef<HTMLInputElement>(null),
    specialStartDate: useRef<HTMLInputElement>(null),
    specialEndDate: useRef<HTMLInputElement>(null),
    specialOpen: useRef<HTMLInputElement>(null),
    specialClose: useRef<HTMLInputElement>(null),
  };

  // Initialize form with props and set defaults
  useEffect(() => {
    setFormData(initialData);

    const currentTime = getCurrentTimeRounded();
    const todayDate = getToday();

    if (!initialData.regularHours.open && !initialData.regularHours.close) {
      setFormData((prev) => ({
        ...prev,
        regularHours: {
          open: "09:00",
          close: "17:00",
        },
      }));
    }

    if (mode === "add" && !initialData.isRecurring && !initialData.time) {
      setFormData((prev) => ({
        ...prev,
        time: currentTime,
        date: todayDate,
      }));
    }

    if (!initialData.breaks) {
      setFormData((prev) => ({
        ...prev,
        breaks: [],
      }));
    }

    setSpecialHoursEnabled(!!initialData.specialHours);
    setBreaksEnabled(!!(initialData.breaks && initialData.breaks.length > 0));

    if (mode === "edit") {
      const editHasDetailedData = !!(
        (initialData.breaks && initialData.breaks.length > 0) ||
        initialData.specialHours ||
        initialData.crossStreets ||
        initialData.landmarks ||
        initialData.customNotes
      );
      setFormMode(editHasDetailedData ? "detailed" : "quick");
    } else {
      setFormMode("quick");
    }

    setIsFormDirty(false);
    setErrors({});
  }, [initialData, mode]);

  // Load weather data when coordinates change
  useEffect(() => {
    const loadWeatherData = async () => {
      if (formData.coordinates && weatherEnabled) {
        setWeatherLoading(true);
        setWeatherError(null);

        const weather = await fetchWeatherData(formData.coordinates);

        if (weather) {
          setWeatherData(weather);
        } else {
          setWeatherError("Unable to load weather data");
        }

        setWeatherLoading(false);
      } else if (!formData.coordinates) {
        setWeatherData(null);
        setWeatherError(null);
        setWeatherEnabled(false);
      }
    };

    loadWeatherData();
  }, [formData.coordinates, weatherEnabled]);

  // Filter weather forecast based on location type and selected days
  const getRelevantForecastDays = () => {
    if (!weatherData) return [];

    if (!formData.isRecurring) {
      if (formData.date) {
        const selectedDate = new Date(formData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);

        if (selectedDate.getTime() === today.getTime()) {
          return [];
        }

        const relevantDays = weatherData.daily.filter((day) => {
          const dayDate = new Date(day.date);
          dayDate.setHours(0, 0, 0, 0);
          return dayDate.getTime() === selectedDate.getTime();
        });

        return relevantDays.length > 0 ? relevantDays : [];
      }
      return [];
    }

    if (!formData.recurringDays || formData.recurringDays.length === 0) {
      return weatherData.daily.slice(0, 1);
    }

    const allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    if (
      formData.recurringDays.length === 7 &&
      allDays.every((day) => formData.recurringDays?.includes(day))
    ) {
      return weatherData.daily;
    }

    const dayNameMap: Record<string, string> = {
      Mon: "Mon",
      Tue: "Tue",
      Wed: "Wed",
      Thu: "Thu",
      Fri: "Fri",
      Sat: "Sat",
      Sun: "Sun",
    };

    return weatherData.daily.filter((day) =>
      formData.recurringDays?.some(
        (selectedDay) => dayNameMap[selectedDay] === day.dayName
      )
    );
  };

  // Generate weather forecast title based on location type
  const getForecastTitle = () => {
    if (!formData.isRecurring) {
      if (formData.date) {
        const selectedDate = new Date(formData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);

        if (selectedDate.getTime() === today.getTime()) {
          return "";
        }

        return "Weather for Your Arrival";
      }
      return "";
    }

    if (!formData.recurringDays || formData.recurringDays.length === 0) {
      return "Current Weather";
    }

    const allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    if (
      formData.recurringDays.length === 7 &&
      allDays.every((day) => formData.recurringDays?.includes(day))
    ) {
      return "5-Day Forecast";
    }

    if (
      formData.recurringDays.length === 5 &&
      ["Mon", "Tue", "Wed", "Thu", "Fri"].every((day) =>
        formData.recurringDays?.includes(day)
      )
    ) {
      return "Weekday Forecast";
    }

    if (
      formData.recurringDays.length === 2 &&
      ["Sat", "Sun"].every((day) => formData.recurringDays?.includes(day))
    ) {
      return "Weekend Forecast";
    }

    return `Forecast for ${formData.recurringDays.join(", ")}`;
  };

  // Determine if hourly forecast should be shown
  const shouldShowHourlyForecast = () => {
    if (!formData.isRecurring) {
      if (formData.date) {
        const selectedDate = new Date(formData.date);
        const today = new Date();
        return selectedDate.toDateString() === today.toDateString();
      }
      return true;
    }

    const today = new Date();
    const todayShort = today.toLocaleDateString("en-US", { weekday: "short" });
    return formData.recurringDays?.includes(todayShort) || false;
  };

  // Toggle weather display
  const handleWeatherToggle = (): void => {
    setWeatherEnabled(!weatherEnabled);
    if (weatherEnabled) {
      setWeatherData(null);
      setWeatherError(null);
    }
  };

  // Toggle temperature unit between C and F
  const handleTemperatureUnitToggle = (): void => {
    setTemperatureUnit(temperatureUnit === "C" ? "F" : "C");
  };

  // Debounced form validation
  const debouncedValidate = (freshFormData?: LocationData): void => {
    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }

    const timeout = setTimeout(() => {
      if (isFormDirty) {
        validateForm(true, freshFormData);
      }
    }, 500);

    setValidationTimeout(timeout);
  };

  // Convert time string to minutes for comparison
  const parseTime = (timeString: string): number | null => {
    if (!timeString) return null;
    const [hours, minutes] = timeString
      .split(":")
      .map((num) => parseInt(num, 10));

    if (isNaN(hours) || isNaN(minutes)) return null;
    if (hours < 0 || hours > 23) return null;
    if (minutes < 0 || minutes > 59) return null;

    return hours * 60 + minutes;
  };

  // Validate breaks don't overlap and are within business hours
  const validateBreaks = (
    breaksData: BreakData[],
    businessOpen: string,
    businessClose: string
  ): string | null => {
    if (!breaksData || breaksData.length === 0) return null;

    const businessOpenMinutes = parseTime(businessOpen);
    const businessCloseMinutes = parseTime(businessClose);

    if (businessOpenMinutes === null || businessCloseMinutes === null) {
      return null;
    }

    for (let i = 0; i < breaksData.length; i++) {
      const breakItem = breaksData[i];
      const breakStartMinutes = parseTime(breakItem.startTime);

      if (breakStartMinutes === null) {
        return `Break ${i + 1}: Invalid start time format`;
      }

      const breakEndMinutes = breakStartMinutes + breakItem.duration;

      if (
        breakStartMinutes < businessOpenMinutes ||
        breakEndMinutes > businessCloseMinutes
      ) {
        return `Break ${
          i + 1
        }: Must be within business hours (${businessOpen} - ${businessClose})`;
      }

      for (let j = i + 1; j < breaksData.length; j++) {
        const otherBreak = breaksData[j];
        const otherStartMinutes = parseTime(otherBreak.startTime);

        if (otherStartMinutes === null) continue;

        const otherEndMinutes = otherStartMinutes + otherBreak.duration;

        if (
          breakStartMinutes < otherEndMinutes &&
          breakEndMinutes > otherStartMinutes
        ) {
          return `Break ${i + 1} and Break ${j + 1}: Breaks cannot overlap`;
        }
      }

      if (!breakItem.label.trim()) {
        return `Break ${i + 1}: Label is required`;
      }
    }

    return null;
  };

  // Comprehensive form validation
  const validateForm = (silent = false, freshData?: LocationData): boolean => {
    const dataToValidate = freshData || formData;
    const newErrors: Record<string, string> = {};

    if (!dataToValidate.name.trim()) {
      newErrors.name = "City name is required";
    }

    const regularOpenMinutes = parseTime(dataToValidate.regularHours.open);
    const regularCloseMinutes = parseTime(dataToValidate.regularHours.close);

    if (!dataToValidate.regularHours.open) {
      newErrors.regularHoursOpen = "Opening time is required";
    } else if (regularOpenMinutes === null) {
      newErrors.regularHoursOpen = "Invalid time format";
    }

    if (!dataToValidate.regularHours.close) {
      newErrors.regularHoursClose = "Closing time is required";
    } else if (regularCloseMinutes === null) {
      newErrors.regularHoursClose = "Invalid time format";
    }

    if (regularOpenMinutes !== null && regularCloseMinutes !== null) {
      if (regularCloseMinutes <= regularOpenMinutes) {
        newErrors.regularHoursClose = "Closing time must be after opening time";
      } else if (regularCloseMinutes - regularOpenMinutes < 60) {
        newErrors.regularHoursClose =
          "Business must be open for at least 1 hour";
      } else if (regularCloseMinutes - regularOpenMinutes > 16 * 60) {
        newErrors.regularHoursClose =
          "Business hours cannot exceed 16 hours per day";
      }
    }

    if (formMode === "detailed") {
      if (
        breaksEnabled &&
        dataToValidate.breaks &&
        dataToValidate.breaks.length > 0
      ) {
        const breakError = validateBreaks(
          dataToValidate.breaks,
          dataToValidate.regularHours.open,
          dataToValidate.regularHours.close
        );
        if (breakError) {
          newErrors.breaks = breakError;
        }
      }
    }

    if (!dataToValidate.isRecurring) {
      if (!dataToValidate.date) {
        newErrors.date = "Date is required for one-time locations";
      } else {
        const selectedDate = new Date(dataToValidate.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
          newErrors.date = "Date cannot be in the past";
        }
      }

      if (!dataToValidate.time) {
        newErrors.time = "Arrival time is required for one-time locations";
      } else {
        const arrivalMinutes = parseTime(dataToValidate.time);
        if (arrivalMinutes === null) {
          newErrors.time = "Invalid time format";
        } else if (
          regularOpenMinutes !== null &&
          regularCloseMinutes !== null
        ) {
          if (
            arrivalMinutes < regularOpenMinutes ||
            arrivalMinutes > regularCloseMinutes
          ) {
            newErrors.time = `Arrival time must be between ${dataToValidate.regularHours.open} and ${dataToValidate.regularHours.close}`;
          }
        }
      }
    }

    if (dataToValidate.isRecurring) {
      if (
        !dataToValidate.recurringDays ||
        dataToValidate.recurringDays.length === 0
      ) {
        newErrors.recurringDays =
          "Please select at least one day or choose a different recurring option";
      }
    }

    if (formMode === "detailed") {
      if (specialHoursEnabled && dataToValidate.specialHours) {
        if (!dataToValidate.specialHours.startDate) {
          newErrors.specialStartDate = "Special start date is required";
        }
        if (!dataToValidate.specialHours.endDate) {
          newErrors.specialEndDate = "Special end date is required";
        }

        if (
          dataToValidate.specialHours.startDate &&
          dataToValidate.specialHours.endDate
        ) {
          const startDate = new Date(dataToValidate.specialHours.startDate);
          const endDate = new Date(dataToValidate.specialHours.endDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (endDate < startDate) {
            newErrors.specialEndDate = "End date must be after start date";
          } else if (startDate < today) {
            newErrors.specialStartDate =
              "Special hours start date cannot be in the past";
          } else {
            const durationDays =
              Math.ceil(
                (endDate.getTime() - startDate.getTime()) /
                  (1000 * 60 * 60 * 24)
              ) + 1;
            if (durationDays > 365) {
              newErrors.specialEndDate =
                "Special hours period cannot exceed 1 year";
            }
          }
        }

        const specialOpenMinutes = parseTime(dataToValidate.specialHours.open);
        const specialCloseMinutes = parseTime(
          dataToValidate.specialHours.close
        );

        if (!dataToValidate.specialHours.open) {
          newErrors.specialOpen = "Special opening time is required";
        } else if (specialOpenMinutes === null) {
          newErrors.specialOpen = "Invalid time format";
        }

        if (!dataToValidate.specialHours.close) {
          newErrors.specialClose = "Special closing time is required";
        } else if (specialCloseMinutes === null) {
          newErrors.specialClose = "Invalid time format";
        }

        if (specialOpenMinutes !== null && specialCloseMinutes !== null) {
          if (specialCloseMinutes <= specialOpenMinutes) {
            newErrors.specialClose =
              "Special closing time must be after opening time";
          } else if (specialCloseMinutes - specialOpenMinutes < 30) {
            newErrors.specialClose =
              "Special hours must be at least 30 minutes";
          } else if (specialCloseMinutes - specialOpenMinutes > 18 * 60) {
            newErrors.specialClose =
              "Special hours cannot exceed 18 hours per day";
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle input field changes with validation
  const handleInputChange = (
    field: keyof LocationData | string,
    value: any
  ): void => {
    if (!isFormDirty) {
      setIsFormDirty(true);
    }

    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      setFormData((prev) => {
        const newFormData = {
          ...prev,
          [parent]: {
            ...(prev as any)[parent],
            [child]: value,
          },
        };
        debouncedValidate(newFormData);
        return newFormData;
      });
    } else {
      setFormData((prev) => {
        const newFormData = {
          ...prev,
          [field]: value,
        };
        debouncedValidate(newFormData);
        return newFormData;
      });
    }
  };

  // Toggle between recurring and one-time location
  const handleRecurringToggle = (): void => {
    const currentDate = getToday();
    const smartCurrentTime = getCurrentTimeRounded();

    setFormData((prev) => ({
      ...prev,
      isRecurring: !prev.isRecurring,
      recurringDays: !prev.isRecurring ? [] : undefined,
      date: prev.isRecurring ? currentDate : undefined,
      time: prev.isRecurring ? smartCurrentTime : undefined,
    }));
  };

  // Toggle breaks feature and add default break
  const handleBreaksToggle = (): void => {
    setBreaksEnabled(!breaksEnabled);
    if (!breaksEnabled) {
      const defaultBreak: BreakData = {
        id: generateBreakId(),
        startTime: "12:00",
        duration: 60,
        label: "Lunch",
      };
      setFormData((prev) => ({
        ...prev,
        breaks: [defaultBreak],
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        breaks: [],
      }));
    }
  };

  // Generate unique ID for break items
  const generateBreakId = (): string => {
    return `break_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Add new break to the list
  const addBreak = (): void => {
    const newBreak: BreakData = {
      id: generateBreakId(),
      startTime: "12:00",
      duration: 30,
      label: "Break",
    };

    setFormData((prev) => ({
      ...prev,
      breaks: [...(prev.breaks || []), newBreak],
    }));
  };

  // Remove break from the list
  const removeBreak = (breakId: string): void => {
    setFormData((prev) => ({
      ...prev,
      breaks: (prev.breaks || []).filter(
        (breakItem) => breakItem.id !== breakId
      ),
    }));
  };

  // Update specific break field
  const updateBreak = (
    breakId: string,
    field: keyof BreakData,
    value: any
  ): void => {
    setFormData((prev) => ({
      ...prev,
      breaks: (prev.breaks || []).map((breakItem) =>
        breakItem.id === breakId ? { ...breakItem, [field]: value } : breakItem
      ),
    }));
  };

  // Add preset break with predefined values
  const addPresetBreak = (preset: {
    label: string;
    duration: number;
  }): void => {
    const newBreak: BreakData = {
      id: generateBreakId(),
      startTime: "12:00",
      duration: preset.duration,
      label: preset.label,
    };

    setFormData((prev) => ({
      ...prev,
      breaks: [...(prev.breaks || []), newBreak],
    }));
  };

  // Toggle special hours and set smart defaults
  const handleSpecialHoursToggle = (): void => {
    setSpecialHoursEnabled(!specialHoursEnabled);
    if (!specialHoursEnabled) {
      const weekendStart = getNextWeekendStart();
      const weekendEnd = getNextWeekendEnd();

      const regularOpen = formData.regularHours.open || "09:00";
      const regularClose = formData.regularHours.close || "17:00";
      const [openHour] = regularOpen.split(":").map(Number);
      const [closeHour] = regularClose.split(":").map(Number);

      const specialOpenHour = Math.max(6, openHour - 1);
      const specialCloseHour = Math.min(22, closeHour + 2);

      setFormData((prev) => ({
        ...prev,
        specialHours: {
          startDate: weekendStart,
          endDate: weekendEnd,
          open: `${specialOpenHour.toString().padStart(2, "0")}:00`,
          close: `${specialCloseHour.toString().padStart(2, "0")}:00`,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        specialHours: undefined,
      }));
    }
  };

  // Format time for display (24h to 12h format)
  const formatTime = (timeString: string): string => {
    if (!timeString) return "";
    const [hours, minutes] = timeString.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  // Check if form has detailed data that would be lost
  const hasDetailedData = (): boolean => {
    const hasBreaks = formData.breaks && formData.breaks.length > 0;
    const hasSpecialHours = !!formData.specialHours;
    const hasLocationDetails = !!(
      formData.crossStreets ||
      formData.landmarks ||
      formData.customNotes
    );
    return hasBreaks || hasSpecialHours || hasLocationDetails;
  };

  // Generate summary of detailed data for warning dialog
  const getDetailedDataSummary = (): string[] => {
    const summary: string[] = [];

    if (formData.breaks && formData.breaks.length > 0) {
      const count = formData.breaks.length;
      summary.push(`${count} scheduled break${count > 1 ? "s" : ""}`);
    }

    if (formData.specialHours) {
      summary.push("Special hours");
    }

    if (formData.crossStreets || formData.landmarks || formData.customNotes) {
      summary.push("Location details");
    }

    return summary;
  };

  // Handle form submission with validation
  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setIsSubmitting(true);

    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }

    if (!validateForm()) {
      setIsSubmitting(false);
      setTimeout(() => scrollToFirstError(errors), 100);
      return;
    }

    if (formMode === "quick" && hasDetailedData()) {
      setIsSubmitting(false);
      setShowDataLossWarning(true);
      return;
    }

    proceedWithSave();
  };

  // Save form data after validation
  const proceedWithSave = (): void => {
    setIsSubmitting(true);

    setTimeout(() => {
      let dataToSave = { ...formData };

      if (formMode === "quick") {
        dataToSave = {
          ...dataToSave,
          breaks: [],
          specialHours: undefined,
          crossStreets: undefined,
          landmarks: undefined,
          customNotes: undefined,
        };
      }

      onSave(dataToSave);
      setIsSubmitting(false);
    }, 200);
  };

  // Confirm data loss and proceed with save
  const handleConfirmDataLoss = (): void => {
    setShowDataLossWarning(false);
    proceedWithSave();
  };

  // Cancel data loss and return to form
  const handleCancelDataLoss = (): void => {
    setShowDataLossWarning(false);
  };

  // Scroll to first validation error
  const scrollToFirstError = (errors: Record<string, string>): void => {
    const errorFieldOrder = [
      "name",
      "date",
      "time",
      "recurringDays",
      "regularHoursOpen",
      "regularHoursClose",
      "specialStartDate",
      "specialEndDate",
      "specialOpen",
      "specialClose",
    ];

    for (const fieldName of errorFieldOrder) {
      if (errors[fieldName]) {
        const refMap: Record<
          string,
          React.RefObject<HTMLInputElement | null>
        > = {
          date: fieldRefs.date,
          time: fieldRefs.time,
          regularHoursOpen: fieldRefs.regularHoursOpen,
          regularHoursClose: fieldRefs.regularHoursClose,
          specialStartDate: fieldRefs.specialStartDate,
          specialEndDate: fieldRefs.specialEndDate,
          specialOpen: fieldRefs.specialOpen,
          specialClose: fieldRefs.specialClose,
        };

        if (fieldName === "name") {
          const citySearchElement = document.querySelector(
            '[data-testid="city-search"], .city-search-field input, input[placeholder*="city" i]'
          );
          if (citySearchElement) {
            citySearchElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            (citySearchElement as HTMLInputElement).focus();
            break;
          }
        }

        const targetRef = refMap[fieldName];
        if (targetRef?.current) {
          targetRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          targetRef.current.focus();
          break;
        }

        const errorElement = document.querySelector(".error-message");
        if (errorElement) {
          errorElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          break;
        }
      }
    }
  };

  // Handle form cancellation and reset
  const handleCancel = (): void => {
    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }
    setFormData(initialData);
    setIsFormDirty(false);
    setErrors({});
    onCancel();
  };

  if (!isVisible) return null;

  return (
    <div className="location-form-panel">
      <div className="panel-header">
        <div className="panel-title-section">
          <h2>{mode === "add" ? "Add New Location" : "Edit Location"}</h2>
          <div className="form-mode-toggle">
            <div className="mode-radio-group">
              <button
                type="button"
                className={`mode-radio-btn ${
                  formMode === "quick" ? "active" : ""
                }`}
                onClick={() => setFormMode("quick")}
              >
                <span className="radio-indicator"></span>
                Quick Add
              </button>
              <button
                type="button"
                className={`mode-radio-btn ${
                  formMode === "detailed" ? "active" : ""
                }`}
                onClick={() => setFormMode("detailed")}
              >
                <span className="radio-indicator"></span>
                Detailed Form
              </button>
            </div>
            <span className="mode-description">
              {formMode === "quick"
                ? "Essential fields only"
                : "All options available"}
            </span>
          </div>
        </div>
        <button
          className="close-panel-button"
          onClick={handleCancel}
          type="button"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
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

      <form
        onSubmit={handleSubmit}
        className={`location-form ${
          isSubmitting ? "form-submitting" : ""
        } ${formMode}`}
      >
        <div className="form-section">
          <CitySearchField
            value={formData.name}
            onChange={(city, coordinates) => {
              handleInputChange("name", city);
              if (coordinates) {
                handleInputChange("coordinates", coordinates);
              } else {
                handleInputChange("coordinates", undefined);
              }
            }}
            error={errors.name}
            label="Search City"
            required={true}
          />
        </div>

        {formData.coordinates && (
          <div className="form-section">
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={weatherEnabled}
                  onChange={handleWeatherToggle}
                />
                <span>Show Weather Information</span>
              </label>
            </div>

            {weatherEnabled && (
              <div className="weather-container">
                <div className="weather-header-controls">
                  <h3>🌤️ Current Weather</h3>
                  <div className="temperature-unit-toggle">
                    <button
                      type="button"
                      className={`temp-unit-btn ${
                        temperatureUnit === "F" ? "active" : ""
                      }`}
                      onClick={handleTemperatureUnitToggle}
                    >
                      °F
                    </button>
                    <button
                      type="button"
                      className={`temp-unit-btn ${
                        temperatureUnit === "C" ? "active" : ""
                      }`}
                      onClick={handleTemperatureUnitToggle}
                    >
                      °C
                    </button>
                  </div>
                </div>

                {weatherLoading && (
                  <div className="weather-loading">
                    <div className="loading-spinner"></div>
                    <span>Loading weather data...</span>
                  </div>
                )}

                {weatherError && (
                  <div className="weather-error">
                    <span>⚠️ {weatherError}</span>
                  </div>
                )}

                {weatherData && !weatherLoading && (
                  <div className="weather-display">
                    <div className="current-weather">
                      <div className="weather-main">
                        <div className="weather-icon">
                          <img
                            src={`https://openweathermap.org/img/wn/${weatherData.current.icon}@2x.png`}
                            alt={weatherData.current.description}
                            width="64"
                            height="64"
                          />
                        </div>
                        <div className="weather-temp">
                          <span className="temp-value">
                            {getTemperatureValue(
                              weatherData.current.temp,
                              temperatureUnit
                            )}
                            °{temperatureUnit}
                          </span>
                          <span className="temp-description">
                            {weatherData.current.description}
                          </span>
                          <span className="feels-like">
                            Feels like{" "}
                            {getTemperatureValue(
                              weatherData.current.feelsLike,
                              temperatureUnit
                            )}
                            °{temperatureUnit}
                          </span>
                        </div>
                      </div>

                      <div className="weather-details">
                        <div className="weather-detail">
                          <span className="detail-label">Wind</span>
                          <span className="detail-value">
                            {weatherData.current.windSpeed} km/h
                          </span>
                        </div>
                        <div className="weather-detail">
                          <span className="detail-label">Humidity</span>
                          <span className="detail-value">
                            {weatherData.current.humidity}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {shouldShowHourlyForecast() && (
                      <div className="hourly-forecast">
                        <h4>Today's Hourly Forecast</h4>
                        <div className="hourly-items">
                          {weatherData.hourly.slice(0, 6).map((hour, index) => (
                            <div key={index} className="hourly-item">
                              <span className="hourly-time">{hour.time}</span>
                              <img
                                src={`https://openweathermap.org/img/wn/${hour.icon}.png`}
                                alt={hour.description}
                                className="hourly-icon"
                                width="32"
                                height="32"
                              />
                              <span className="hourly-temp">
                                {getTemperatureValue(
                                  hour.temp,
                                  temperatureUnit
                                )}
                                °
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {getRelevantForecastDays().length > 0 && (
                      <div className="daily-forecast">
                        <h4>{getForecastTitle()}</h4>
                        <div className="daily-items">
                          {getRelevantForecastDays().map((day, index) => (
                            <div key={index} className="daily-item">
                              <span className="daily-day">{day.dayName}</span>
                              <span className="daily-date">
                                {new Date(day.date).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric" }
                                )}
                              </span>
                              <img
                                src={`https://openweathermap.org/img/wn/${day.icon}@2x.png`}
                                alt={day.description}
                                className="daily-icon"
                                width="48"
                                height="48"
                              />
                              <div className="daily-temps">
                                <span className="daily-high">
                                  {getTemperatureValue(
                                    day.highTemp,
                                    temperatureUnit
                                  )}
                                  °
                                </span>
                                <span className="daily-low">
                                  {getTemperatureValue(
                                    day.lowTemp,
                                    temperatureUnit
                                  )}
                                  °
                                </span>
                              </div>
                              <span className="daily-description">
                                {day.description}
                              </span>
                              <div className="daily-details">
                                <span className="daily-detail">
                                  💨 {day.windSpeed} km/h
                                </span>
                                <span className="daily-detail">
                                  💧 {day.humidity}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="form-section">
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={handleRecurringToggle}
              />
              <span>Recurring Location</span>
            </label>
          </div>

          {formData.isRecurring ? (
            <>
              <div className="recurring-days-container">
                <div className="recurring-header">
                  <div className="recurring-icon">↻</div>
                  <span className="recurring-title">Repeat on days:</span>
                </div>

                <div className="preset-buttons">
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() =>
                      handleInputChange("recurringDays", [
                        "Mon",
                        "Tue",
                        "Wed",
                        "Thu",
                        "Fri",
                        "Sat",
                        "Sun",
                      ])
                    }
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() =>
                      handleInputChange("recurringDays", [
                        "Mon",
                        "Tue",
                        "Wed",
                        "Thu",
                        "Fri",
                      ])
                    }
                  >
                    Weekdays
                  </button>
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() =>
                      handleInputChange("recurringDays", ["Sat", "Sun"])
                    }
                  >
                    Weekends
                  </button>
                  <button
                    type="button"
                    className="preset-btn clear"
                    onClick={() => handleInputChange("recurringDays", [])}
                  >
                    Clear
                  </button>
                </div>

                <div className="checkbox-group">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                    (day) => (
                      <label key={day} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={
                            formData.recurringDays?.includes(day) || false
                          }
                          onChange={(e) => {
                            const days = formData.recurringDays || [];
                            if (e.target.checked) {
                              handleInputChange("recurringDays", [
                                ...days,
                                day,
                              ]);
                            } else {
                              handleInputChange(
                                "recurringDays",
                                days.filter((d) => d !== day)
                              );
                            }
                          }}
                        />
                        <span className="checkbox-text">{day}</span>
                      </label>
                    )
                  )}
                </div>

                <div className="selected-summary">
                  <span className="selected-label">Selected:</span>
                  <span className="selected-days">
                    {(formData.recurringDays ?? []).length > 0
                      ? (formData.recurringDays ?? []).join(", ")
                      : "None selected"}
                  </span>
                </div>
              </div>
              {errors.recurringDays && (
                <div className="error-message">{errors.recurringDays}</div>
              )}
            </>
          ) : (
            <div className="date-time-section">
              <div className="form-group">
                <label htmlFor="location-date">Date</label>
                <input
                  ref={fieldRefs.date}
                  id="location-date"
                  type="date"
                  value={formData.date || ""}
                  onChange={(e) => handleInputChange("date", e.target.value)}
                  className={`form-input ${errors.date ? "error" : ""}`}
                />
                {errors.date && (
                  <div className="error-message">{errors.date}</div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="location-time">Arrival Time (HH:MM)</label>
                <input
                  ref={fieldRefs.time}
                  id="location-time"
                  type="time"
                  value={formData.time || ""}
                  onChange={(e) => handleInputChange("time", e.target.value)}
                  className={`form-input ${errors.time ? "error" : ""}`}
                  placeholder="HH:MM"
                />
                {errors.time && (
                  <div className="error-message">{errors.time}</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="form-section">
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={true}
                onChange={() => {}}
                readOnly
              />
              <span>Set Business Hours</span>
            </label>
          </div>

          <div className="hours-inputs">
            <div className="hours-row">
              <label>Opening Time:</label>
              <input
                ref={fieldRefs.regularHoursOpen}
                type="time"
                value={formData.regularHours.open}
                onChange={(e) =>
                  handleInputChange("regularHours.open", e.target.value)
                }
                className={`form-input time-input-form ${
                  errors.regularHoursOpen ? "error" : ""
                }`}
                placeholder="09:00"
              />
            </div>
            {errors.regularHoursOpen && (
              <div className="error-message">{errors.regularHoursOpen}</div>
            )}
            <div className="hours-row">
              <label>Closing Time:</label>
              <input
                ref={fieldRefs.regularHoursClose}
                type="time"
                value={formData.regularHours.close}
                onChange={(e) =>
                  handleInputChange("regularHours.close", e.target.value)
                }
                className={`form-input time-input-form ${
                  errors.regularHoursClose ? "error" : ""
                }`}
                placeholder="17:00"
              />
            </div>
            {errors.regularHoursClose && (
              <div className="error-message">{errors.regularHoursClose}</div>
            )}
          </div>
        </div>

        {formMode === "detailed" && (
          <>
            <div className="form-section">
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={breaksEnabled}
                    onChange={handleBreaksToggle}
                  />
                  <span>Schedule Breaks</span>
                </label>
              </div>

              {breaksEnabled && (
                <>
                  <div className="breaks-container">
                    {formData.breaks && formData.breaks.length > 0
                      ? formData.breaks.map((breakItem, index) => (
                          <div key={breakItem.id} className="break-item">
                            <div className="break-header">
                              <span className="break-number">
                                Break {index + 1}
                              </span>
                              <button
                                type="button"
                                className="remove-break-button"
                                onClick={() => removeBreak(breakItem.id)}
                                aria-label={`Remove break ${index + 1}`}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
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

                            <div className="break-fields">
                              <div className="break-field">
                                <label>Start Time</label>
                                <input
                                  type="time"
                                  value={breakItem.startTime}
                                  onChange={(e) =>
                                    updateBreak(
                                      breakItem.id,
                                      "startTime",
                                      e.target.value
                                    )
                                  }
                                  className="form-input time-input-form"
                                />
                              </div>

                              <div className="break-field">
                                <label>Duration</label>
                                <select
                                  value={breakItem.duration}
                                  onChange={(e) =>
                                    updateBreak(
                                      breakItem.id,
                                      "duration",
                                      parseInt(e.target.value)
                                    )
                                  }
                                  className="form-input"
                                >
                                  {BREAK_DURATIONS.map((duration) => (
                                    <option
                                      key={duration.value}
                                      value={duration.value}
                                    >
                                      {duration.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="break-field">
                                <label>Label</label>
                                <input
                                  type="text"
                                  value={breakItem.label}
                                  onChange={(e) =>
                                    updateBreak(
                                      breakItem.id,
                                      "label",
                                      e.target.value
                                    )
                                  }
                                  className="form-input"
                                  placeholder="e.g., Lunch, Coffee Break"
                                  maxLength={50}
                                />
                              </div>
                            </div>

                            {errors[`${breakItem.id}_time`] && (
                              <div className="error-message">
                                {errors[`${breakItem.id}_time`]}
                              </div>
                            )}
                            {errors[`${breakItem.id}_timeLogic`] && (
                              <div className="error-message">
                                {errors[`${breakItem.id}_timeLogic`]}
                              </div>
                            )}
                            {errors[`${breakItem.id}_duration`] && (
                              <div className="error-message">
                                {errors[`${breakItem.id}_duration`]}
                              </div>
                            )}

                            <div className="break-summary">
                              {formatTime(breakItem.startTime)} -{" "}
                              {formatTime(
                                `${Math.floor(
                                  (parseTime(breakItem.startTime) || 0) / 60 +
                                    breakItem.duration / 60
                                )}:${String(
                                  ((parseTime(breakItem.startTime) || 0) +
                                    breakItem.duration) %
                                    60
                                ).padStart(2, "0")}`
                              )}{" "}
                              ({breakItem.label})
                            </div>
                          </div>
                        ))
                      : null}

                    <div className="break-actions">
                      <button
                        type="button"
                        className="add-break-button"
                        onClick={addBreak}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M12 5V19M5 12H19"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Add Custom Break
                      </button>

                      <div className="preset-breaks">
                        <span className="preset-label">Quick Add:</span>
                        {BREAK_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            className="preset-break-button"
                            onClick={() => addPresetBreak(preset)}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {errors.breaks && (
                    <div className="error-message">{errors.breaks}</div>
                  )}
                </>
              )}
            </div>

            <div className="form-section">
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={specialHoursEnabled}
                    onChange={handleSpecialHoursToggle}
                  />
                  <span>Set Special Hours</span>
                </label>
              </div>

              {specialHoursEnabled && (
                <>
                  <div className="special-hours-dates">
                    <div className="form-group">
                      <label htmlFor="special-start-date">Start Date</label>
                      <input
                        ref={fieldRefs.specialStartDate}
                        id="special-start-date"
                        type="date"
                        value={formData.specialHours?.startDate || ""}
                        onChange={(e) =>
                          handleInputChange(
                            "specialHours.startDate",
                            e.target.value
                          )
                        }
                        className={`form-input ${
                          errors.specialStartDate ? "error" : ""
                        }`}
                      />
                      {errors.specialStartDate && (
                        <div className="error-message">
                          {errors.specialStartDate}
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="special-end-date">End Date</label>
                      <input
                        ref={fieldRefs.specialEndDate}
                        id="special-end-date"
                        type="date"
                        value={formData.specialHours?.endDate || ""}
                        onChange={(e) =>
                          handleInputChange(
                            "specialHours.endDate",
                            e.target.value
                          )
                        }
                        className={`form-input ${
                          errors.specialEndDate ? "error" : ""
                        }`}
                      />
                      {errors.specialEndDate && (
                        <div className="error-message">
                          {errors.specialEndDate}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="hours-inputs">
                    <div className="hours-row">
                      <label>Special Opening Time:</label>
                      <input
                        ref={fieldRefs.specialOpen}
                        type="time"
                        value={formData.specialHours?.open || ""}
                        onChange={(e) =>
                          handleInputChange("specialHours.open", e.target.value)
                        }
                        className={`form-input special-opening-time-input ${
                          errors.specialOpen ? "error" : ""
                        }`}
                        placeholder="08:00"
                      />
                    </div>
                    {errors.specialOpen && (
                      <div className="error-message">{errors.specialOpen}</div>
                    )}
                    <div className="hours-row">
                      <label>Special Closing Time:</label>
                      <input
                        ref={fieldRefs.specialClose}
                        type="time"
                        value={formData.specialHours?.close || ""}
                        onChange={(e) =>
                          handleInputChange(
                            "specialHours.close",
                            e.target.value
                          )
                        }
                        className={`form-input special-closing-time-input ${
                          errors.specialClose ? "error" : ""
                        }`}
                        placeholder="19:00"
                      />
                    </div>
                    {errors.specialClose && (
                      <div className="error-message">{errors.specialClose}</div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="form-section">
              <h3>📍 Location Details</h3>

              <div className="form-group">
                <label htmlFor="cross-streets">Cross Streets</label>
                <input
                  id="cross-streets"
                  type="text"
                  value={formData.crossStreets || ""}
                  onChange={(e) =>
                    handleInputChange("crossStreets", e.target.value)
                  }
                  className="form-input"
                  placeholder="e.g., Main St & 5th Ave"
                />
              </div>

              <div className="form-group">
                <label htmlFor="landmarks">Landmarks & Directions</label>
                <textarea
                  id="landmarks"
                  value={formData.landmarks || ""}
                  onChange={(e) =>
                    handleInputChange("landmarks", e.target.value)
                  }
                  className="form-input"
                  placeholder="e.g., Behind the brewery, near the big red building"
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label htmlFor="custom-notes">Special Instructions</label>
                <textarea
                  id="custom-notes"
                  value={formData.customNotes || ""}
                  onChange={(e) =>
                    handleInputChange("customNotes", e.target.value)
                  }
                  className="form-input"
                  placeholder="e.g., Talk to the bartender, use back entrance"
                  rows={2}
                />
              </div>
            </div>
          </>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button type="submit" className="save-button" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Location"}
          </button>
        </div>
      </form>

      {showDataLossWarning && (
        <div className="data-loss-warning-overlay">
          <div className="data-loss-warning-dialog">
            <h3>⚠️ Save in Quick Mode?</h3>
            <p>This will remove your advanced settings:</p>
            <ul className="data-loss-list">
              {getDetailedDataSummary().map((item, index) => (
                <li key={index}>• {item}</li>
              ))}
            </ul>
            <p className="data-loss-note">
              You can switch to "Detailed Form" to keep these settings.
            </p>
            <div className="data-loss-actions">
              <button
                type="button"
                className="data-loss-cancel-btn"
                onClick={handleCancelDataLoss}
              >
                Keep Advanced Settings
              </button>
              <button
                type="button"
                className="data-loss-confirm-btn"
                onClick={handleConfirmDataLoss}
              >
                Save Quick Mode Only
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
