"use client";

import { useState, useEffect } from "react";

export default function ChatPage() {
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [locationError, setLocationError] = useState("");
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const getLocationName = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      );
      const data = await response.json();
      setLocationName(data.display_name);
    } catch (error) {
      console.error("Error getting location name:", error);
    }
  };

  useEffect(() => {
    let watchId: number;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(coords);
          await getLocationName(coords.lat, coords.lng);
        },
        (error) => {
          setLocationError(
            "Please enable location services to get better recommendations",
          );
        },
      );

      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(coords);
          await getLocationName(coords.lat, coords.lng);
        },
        (error) => {
          setLocationError("Error tracking location");
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        },
      );
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userLocation) {
      setResponse(
        "Please enable location services to get local recommendations",
      );
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: new Headers({
            "Content-Type": "application/json",
            "X-Goog-Api-Key": process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? "",
            "X-Goog-FieldMask":
              "places.displayName,places.formattedAddress,places.rating,places.editorialSummary,places.photos",
          }),
          body: JSON.stringify({
            textQuery: `${query} near ${locationName}`,
            locationBias: {
              circle: {
                center: {
                  latitude: userLocation.lat,
                  longitude: userLocation.lng,
                },
                radius: 1500.0,
              },
            },
          }),
        },
      );

      const data = await response.json();
      if (data.places && data.places.length > 0) {
        const recommendations = data.places
          .map(
            (place: any) =>
              `📍 ${place.displayName.text}\n` +
              `${place.editorialSummary?.text || ""}\n` +
              `📍 Address: ${place.formattedAddress}\n` +
              `⭐ Rating: ${place.rating || "No rating yet"}\n`,
          )
          .join("\n");

        setResponse(recommendations);
      } else {
        setResponse(
          "No recommendations found for this query. Try a different search term.",
        );
      }
    } catch (error) {
      setResponse("Error getting recommendations. Please try again.");
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto pt-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">
          Local Guide
        </h1>

        {locationError && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
            {locationError}
          </div>
        )}

        {userLocation && locationName && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md text-green-800">
            <p>Current location: {locationName}</p>
            <p className="mt-2 text-sm">
              Coordinates: {userLocation.lat.toFixed(4)}°,{" "}
              {userLocation.lng.toFixed(4)}°
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6 bg-white p-6 rounded-lg shadow-md"
        >
          <div>
            <label
              htmlFor="query"
              className="block text-gray-700 text-sm font-medium mb-2"
            >
              What would you like to know about this area?
            </label>
            <input
              type="text"
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., 'popular bars nearby' or 'hidden gem restaurants'"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-md font-medium transition-colors ${isLoading ? "bg-gray-300 text-gray-500" : "bg-[#F5E6D3] text-gray-800 hover:bg-[#E6D7C4]"}`}
          >
            {isLoading ? "Searching..." : "Get Recommendations"}
          </button>
        </form>

        {response && (
          <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Recommendations
            </h2>
            <p className="text-gray-600 whitespace-pre-line">{response}</p>
          </div>
        )}
      </div>
    </main>
  );
}
