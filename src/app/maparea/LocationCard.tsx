"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import "./locationCard.css";
import { LocationData } from "./LocationModal";

const LocationModal = dynamic(() => import("./LocationModal"), {
  ssr: false,
});

const CURRENT_LOCATION_KEY = "foodtruck_current_location";
const CLEAR_ALL_AUDIT_KEY = "foodtruck_clear_all_audit";

// Utility function: Load current location data from localStorage with error handling
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

// Utility function: Load audit data for cleared locations, returns most recent audit entry
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

// Utility function: Returns default empty location structure
const getEmptyLocationData = (): LocationData => ({
  name: "",
  isRecurring: false,
  regularHours: {
    open: "",
    close: "",
  },
});

export default function LocationCard() {
  // State: Controls modal visibility for location management
  const [showModal, setShowModal] = useState(false);

  // State: Stores current location data including name, hours, scheduling details
  const [currentLocationData, setCurrentLocationData] = useState<LocationData>(
    getEmptyLocationData()
  );

  // State: Tracks if location data was deliberately cleared by user
  const [isClearedState, setIsClearedState] = useState(false);

  // State: Stores audit information about what was cleared and why
  const [clearAuditData, setClearAuditData] = useState<any>(null);

  // Handler function: Checks localStorage for audit data and current location to determine display state
  const checkAuditData = () => {
    const auditData = loadClearAllAuditFromStorage();
    const hasCurrentLocation = loadCurrentLocationFromStorage();

    if (auditData && auditData.clearedData && !hasCurrentLocation) {
      setIsClearedState(true);
      setClearAuditData(auditData);
      setCurrentLocationData(getEmptyLocationData());
    } else if (hasCurrentLocation) {
      setIsClearedState(false);
      setClearAuditData(null);
      setCurrentLocationData(hasCurrentLocation);
    } else {
      setIsClearedState(false);
      setClearAuditData(null);
      setCurrentLocationData(getEmptyLocationData());
    }
  };

  // useEffect: Sets up event listeners for location updates/clears and loads initial data
  useEffect(() => {
    import("./LocationModal");

    checkAuditData();

    // Event handler: Responds to location cleared events from other components
    const handleLocationCleared = () => {
      console.log("LocationCard: Received locationCleared event");
      checkAuditData();
    };

    // Event handler: Updates location data when location is modified elsewhere
    const handleLocationUpdated = (event: CustomEvent<LocationData>) => {
      console.log("LocationCard: Received locationUpdated event", event.detail);
      setCurrentLocationData(event.detail);
      setIsClearedState(false);
      setClearAuditData(null);
    };

    window.addEventListener("locationCleared", handleLocationCleared);
    window.addEventListener(
      "locationUpdated",
      handleLocationUpdated as EventListener
    );

    return () => {
      window.removeEventListener("locationCleared", handleLocationCleared);
      window.removeEventListener(
        "locationUpdated",
        handleLocationUpdated as EventListener
      );
    };
  }, []);

  // Handler function: Saves new location data and resets cleared state
  const handleSaveLocation = (data: LocationData) => {
    setCurrentLocationData(data);
    setIsClearedState(false);
    setClearAuditData(null);
    console.log("LocationCard: Location saved", data.name);
  };

  // Utility function: Converts 24-hour time format to 12-hour display format
  const formatTime = (timeString: string): string => {
    if (!timeString) return "";
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours, 10);
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  // Utility function: Formats break time range by calculating end time from start + duration
  const formatBreakTime = (startTime: string, duration: number): string => {
    const [hours, minutes] = startTime.split(":").map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + duration;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTimeString = `${endHours.toString().padStart(2, "0")}:${endMins
      .toString()
      .padStart(2, "0")}`;
    return `${formatTime(startTime)} - ${formatTime(endTimeString)}`;
  };

  const isLocationEmpty =
    !currentLocationData.name || currentLocationData.name.trim() === "";

  return (
    <>
      <div className={`location-card ${isClearedState ? "cleared-state" : ""}`}>
        <div className="header">
          <div className="header-subtitle">
            <div className="truck-info">
              <span className="truck-icon">🚚</span>
              <span className="truck-location-text">Truck Location</span>
            </div>
            <button
              className="manage-button"
              onClick={() => setShowModal(true)}
            >
              Manage Location
            </button>
          </div>
          <h3 className="location-name">
            {isClearedState
              ? ""
              : isLocationEmpty
              ? "No location set"
              : currentLocationData.name}
          </h3>
        </div>

        {/* Rendering logic: Cleared state - shows audit information about what was removed */}
        {isClearedState ? (
          <div className="cleared-location-info">
            <div className="cleared-location-message">
              <p>All location data has been removed</p>
            </div>
            {clearAuditData && clearAuditData.clearedData && (
              <>
                <div className="cleared-reason-section">
                  <div className="cleared-label">Reason:</div>
                  <div className="cleared-value">{clearAuditData.reason}</div>
                </div>

                <div className="cleared-items-section">
                  <div className="cleared-label">What was removed:</div>
                  <div className="cleared-items-list">
                    {clearAuditData.clearedData.currentLocation && (
                      <div className="cleared-item">
                        <div className="cleared-item-label">
                          ✓ Current Location:
                        </div>
                        <div className="cleared-item-value">
                          {clearAuditData.clearedData.currentLocation}
                        </div>
                      </div>
                    )}
                    {clearAuditData.clearedData.futureLocations &&
                      clearAuditData.clearedData.futureLocations.length > 0 && (
                        <div className="cleared-item">
                          <div className="cleared-item-label">
                            ✓ Future Locations:
                          </div>
                          <div className="cleared-item-list">
                            {clearAuditData.clearedData.futureLocations.map(
                              (location: string, index: number) => (
                                <div key={index} className="cleared-item-value">
                                  • {location}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : /* Rendering logic: Empty state - prompts user to set a location */ isLocationEmpty ? (
          <div className="empty-location-info">
            <div className="empty-location-message">
              <span className="empty-icon">📍</span>
              <p>Click "Manage Location" to set your truck location</p>
            </div>
          </div>
        ) : (
          <>
            {/* Rendering logic: Cancelled state - shows cancellation badge and reason */}
            {currentLocationData.isCancelled ? (
              <div className="cancelled-location-info">
                <div className="cancelled-badge-wrapper">
                  <div className="cancelled-badge">❌ Cancelled</div>
                  {currentLocationData.cancelReason && (
                    <div className="cancel-reason">
                      <strong>Reason:</strong>{" "}
                      {currentLocationData.cancelReason}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Rendering logic: Recurring vs scheduled visit - different displays for recurring locations vs one-time visits */}
                {currentLocationData.isRecurring ? (
                  <div className="recurring-info">
                    <span className="recurring-badge">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
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
                      {currentLocationData.recurringDays?.map((day: string) => (
                        <span key={day} className="day-badge">
                          {day}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  currentLocationData.date &&
                  currentLocationData.time && (
                    <div className="scheduled-visit-info">
                      <span className="scheduled-badge">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
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
                          {new Date(
                            currentLocationData.date
                          ).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="arrival-time-text">
                          arriving at {formatTime(currentLocationData.time)}
                        </span>
                      </div>
                    </div>
                  )
                )}

                {currentLocationData.breaks &&
                  currentLocationData.breaks.length > 0 && (
                    <div className="breaks-display">
                      <div className="breaks-header">
                        <span className="breaks-icon">☕</span>
                        <span className="breaks-title">Scheduled Breaks</span>
                      </div>
                      <div className="breaks-list">
                        {currentLocationData.breaks.map((breakItem) => (
                          <div
                            key={breakItem.id}
                            className="break-display-item"
                          >
                            <span className="break-label">
                              {breakItem.label}
                            </span>
                            <span className="break-time">
                              {formatBreakTime(
                                breakItem.startTime,
                                breakItem.duration
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {(currentLocationData.crossStreets ||
                  currentLocationData.landmarks ||
                  currentLocationData.customNotes) && (
                  <div className="location-details-display">
                    <div className="location-details-header">
                      <span className="location-details-icon">📍</span>
                      <span className="location-details-title">
                        Location Details
                      </span>
                    </div>
                    <div className="location-details-list">
                      {currentLocationData.crossStreets && (
                        <div className="location-detail-item">
                          <span className="detail-icon">🛣️</span>
                          <div className="detail-content">
                            <span className="detail-label">Cross Streets</span>
                            <span className="detail-value">
                              {currentLocationData.crossStreets}
                            </span>
                          </div>
                        </div>
                      )}
                      {currentLocationData.landmarks && (
                        <div className="location-detail-item">
                          <span className="detail-icon">🏛️</span>
                          <div className="detail-content">
                            <span className="detail-label">Landmarks</span>
                            <span className="detail-value">
                              {currentLocationData.landmarks}
                            </span>
                          </div>
                        </div>
                      )}
                      {currentLocationData.customNotes && (
                        <div className="location-detail-item">
                          <span className="detail-icon">📝</span>
                          <div className="detail-content">
                            <span className="detail-label">Instructions</span>
                            <span className="detail-value">
                              {currentLocationData.customNotes}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(currentLocationData.regularHours.open ||
                  currentLocationData.regularHours.close) && (
                  <div className="hours-grid">
                    <div className="hours-item">
                      <div className="hours-label">Regular Hours</div>
                      <div className="hours-value">
                        {formatTime(currentLocationData.regularHours.open)} -{" "}
                        {formatTime(currentLocationData.regularHours.close)}
                      </div>
                    </div>
                    {currentLocationData.specialHours && (
                      <div className="hours-item">
                        <div className="hours-label special-label">
                          <span className="special-icon">⭐</span>
                          Special Hours
                        </div>
                        <div className="hours-value">
                          {formatTime(currentLocationData.specialHours.open)} -{" "}
                          {formatTime(currentLocationData.specialHours.close)}
                          <div className="hours-dates">
                            (
                            {new Date(
                              currentLocationData.specialHours.startDate
                            ).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            to{" "}
                            {new Date(
                              currentLocationData.specialHours.endDate
                            ).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                            )
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {showModal && (
        <LocationModal
          isVisible={showModal}
          onClose={() => setShowModal(false)}
          currentData={currentLocationData}
          onSave={handleSaveLocation}
          onInitialLoad={(data) => {
            setCurrentLocationData(data);
            setIsClearedState(false);
            setClearAuditData(null);
          }}
        />
      )}
    </>
  );
}
