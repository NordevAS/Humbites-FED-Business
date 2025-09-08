"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import "./citySearchField.css";
import { geocode } from "nominatim-browser";

// Type definitions for props and search results
interface CitySearchFieldProps {
  value: string;
  onChange: (city: string, coordinates?: [number, number]) => void;
  placeholder?: string;
  error?: string;
  label?: string;
  required?: boolean;
}

// Type definition for search results from the geocoding API
interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: string;
  type: string;
}

// City search field component
export default function CitySearchField({
  value,
  onChange,
  placeholder = "Type city name or address...",
  error,
  label = "Search Location",
  required = false,
}: CitySearchFieldProps) {
  // Input display value
  const [searchTerm, setSearchTerm] = useState(value);
  // Query used for API search
  const [searchQuery, setSearchQuery] = useState("");
  // Controls dropdown visibility
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Geocoding API results
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  // Keyboard navigation index
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  // API loading state
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  // Sync internal state with external value prop
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  // Geocoding API call with country filtering
  const performSearch = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      setShowSuggestions(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const results = await geocode({
        q: query,
        limit: 8,
        addressdetails: true,
        countrycodes: ["us", "ca", "gb", "au", "de", "fr", "it", "es"],
      });

      const formattedResults: SearchResult[] = results.map((result: any) => ({
        display_name: result.display_name,
        lat: result.lat,
        lon: result.lon,
        place_id: result.place_id,
        type: result.type,
      }));

      setSearchResults(formattedResults);
      setShowSuggestions(formattedResults.length > 0);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error("Geocoding error:", error);
      setSearchResults([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search trigger
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.length >= 3) {
      searchTimeoutRef.current = window.setTimeout(() => {
        performSearch(searchQuery);
      }, 500);
    } else if (searchQuery.length > 0) {
      setSearchResults([]);
      setShowSuggestions(false);
      setIsLoading(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle input value changes and trigger search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setSearchQuery(newValue);
    onChange(newValue);
    setHighlightedIndex(-1);
  };

  // Handle location selection from dropdown
  const handleLocationSelect = (result: SearchResult) => {
    const coordinates: [number, number] = [
      parseFloat(result.lat),
      parseFloat(result.lon),
    ];
    const formattedLocation = formatSelectedLocation(result);
    setSearchTerm(formattedLocation);
    setSearchQuery("");
    onChange(formattedLocation, coordinates);
    setShowSuggestions(false);
    setSearchResults([]);
    setHighlightedIndex(-1);
  };

  // Keyboard navigation for dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || searchResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
          handleLocationSelect(searchResults[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Shorten display name for dropdown items
  const formatDisplayName = (displayName: string): string => {
    const parts = displayName.split(",");
    if (parts.length > 3) {
      return `${parts[0]}, ${parts[1]}, ${parts[parts.length - 1]}`;
    }
    return displayName;
  };

  // Format selected location for input field
  const formatSelectedLocation = (result: SearchResult): string => {
    const parts = result.display_name.split(",").map((p) => p.trim());

    const landmarkTypes = [
      "tourist",
      "attraction",
      "park",
      "museum",
      "stadium",
      "theatre",
      "cinema",
      "zoo",
      "monument",
    ];
    if (landmarkTypes.includes(result.type)) {
      return parts[0];
    }

    if (/^\d/.test(parts[0])) {
      const streetNum = parts[0];
      const streetName = parts[1];
      const city =
        parts.find(
          (part) =>
            !part.match(/^\d{4,5}$/) &&
            part !== streetName &&
            part !== streetNum &&
            ![
              "Norway",
              "United States",
              "Canada",
              "United Kingdom",
              "Australia",
              "Germany",
              "France",
              "Italy",
              "Spain",
            ].includes(part)
        ) || parts[2];
      return `${streetName} ${streetNum}, ${city}`;
    }

    if (
      result.type === "city" ||
      result.type === "town" ||
      result.type === "municipality"
    ) {
      const city = parts[0];
      const country = parts[parts.length - 1];
      const userCountry = "Norway";
      return country === userCountry ? city : `${city}, ${country}`;
    }

    if (parts.length > 2) {
      return `${parts[0]}, ${parts[1]}`;
    }

    return result.display_name;
  };

  return (
    <div className="city-search-field" ref={containerRef}>
      {label && (
        <label htmlFor="location-search" className="city-search-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}

      <div className="search-container">
        <div className="search-input-wrapper">
          <input
            ref={inputRef}
            id="location-search"
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (searchQuery.length >= 3 && searchResults.length > 0) {
                setShowSuggestions(true);
              }
            }}
            className={`search-input ${error ? "error" : ""}`}
            autoComplete="off"
          />

          {isLoading && (
            <div className="loading-spinner">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray="32"
                  strokeDashoffset="32"
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    dur="1s"
                    values="0 12 12;360 12 12"
                    repeatCount="indefinite"
                  />
                </circle>
              </svg>
            </div>
          )}

          {searchTerm && !isLoading && (
            <button
              type="button"
              className="clear-button"
              onClick={() => {
                setSearchTerm("");
                setSearchQuery("");
                onChange("");
                setSearchResults([]);
                setShowSuggestions(false);
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
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
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        {showSuggestions && searchResults.length > 0 && (
          <div className="suggestions-dropdown">
            <div className="suggestions-list">
              {searchResults.map((result, index) => (
                <button
                  key={result.place_id}
                  type="button"
                  className={`suggestion-item ${
                    index === highlightedIndex ? "highlighted" : ""
                  }`}
                  onClick={() => handleLocationSelect(result)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="10"
                      r="3"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                  <span>{formatDisplayName(result.display_name)}</span>
                </button>
              ))}
            </div>

            {searchResults.length >= 8 && (
              <div className="suggestions-footer">
                Type more to refine search...
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="suggestions-dropdown">
            <div className="suggestions-list">
              <div className="suggestion-item loading">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray="32"
                    strokeDashoffset="32"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      dur="1s"
                      values="0 12 12;360 12 12"
                      repeatCount="indefinite"
                    />
                  </circle>
                </svg>
                <span>Searching locations...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
