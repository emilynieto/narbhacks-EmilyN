"use client";

import { useState, useEffect, useRef } from "react";
import {
  generateTravelRecommendations,
  answerTravelQuestion,
} from "@/lib/gemini";

type MessageType = {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  places?: any[];
};

type PlaceType = {
  displayName: { text: string };
  formattedAddress: string;
  rating?: number;
  distance: number;
  editorialSummary?: { text: string };
  photos?: any[];
};

export default function ChatPage() {
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationName, setLocationName] = useState<string>("");
  const [locationError, setLocationError] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [trendingPlaces, setTrendingPlaces] = useState<PlaceType[]>([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState<boolean>(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState<boolean>(false);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);

  // Load Google Maps script
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.google && process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => setIsMapLoaded(true);
      document.head.appendChild(script);
    } else if (typeof window !== 'undefined' && window.google) {
      setIsMapLoaded(true);
    }
  }, []);

  // Initialize map when location and Google Maps are available
  useEffect(() => {
    if (isMapLoaded && userLocation && mapRef.current && !googleMapRef.current && typeof window !== 'undefined' && window.google) {
      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: userLocation.lat, lng: userLocation.lng },
        zoom: 15,
        styles: [
          {
            featureType: "all",
            elementType: "geometry.fill",
            stylers: [{ color: "#FFF8F0" }]
          },
          {
            featureType: "water",
            elementType: "geometry.fill",
            stylers: [{ color: "#A0C3D2" }]
          },
          {
            featureType: "road",
            elementType: "geometry.fill",
            stylers: [{ color: "#F7EDE2" }]
          },
          {
            featureType: "poi",
            elementType: "geometry.fill",
            stylers: [{ color: "#E6A4B4" }]
          }
        ],
        disableDefaultUI: true,
        zoomControl: isMapFullscreen,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      // Remove or comment out the marker code below
      /* 
      // Add user location marker
      new window.google.maps.Marker({
        position: { lat: userLocation.lat, lng: userLocation.lng },
        map: googleMapRef.current,
        title: "Your Location",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#E6A4B4",
          fillOpacity: 1,
          strokeColor: "#5E3023",
          strokeWeight: 2,
        },
      });
      */
    }
  }, [isMapLoaded, userLocation]);

  // Update map center when location changes
  useEffect(() => {
    if (googleMapRef.current && userLocation) {
      googleMapRef.current.setCenter({ lat: userLocation.lat, lng: userLocation.lng });
    }
  }, [userLocation]);

  // Update map controls when fullscreen state changes
  useEffect(() => {
    if (googleMapRef.current) {
      googleMapRef.current.setOptions({
        zoomControl: isMapFullscreen,
        disableDefaultUI: !isMapFullscreen,
      });
    }
  }, [isMapFullscreen]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getLocationName = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      );
      const data = await response.json();
      setLocationName(data.display_name);

      // Add welcome message when location is determined
      if (messages.length === 0) {
        setMessages([
          {
            id: Date.now().toString(),
            content: `Hi there! 👋 I'm your Travel Buddy, and I notice you're around ${data.address.city || data.address.town || data.address.county || "somewhere nice"}. What kind of adventures are you looking for today?`,
            sender: "ai",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error("Error getting location name:", error);
    }
  };

  // Fetch trending places nearby
  const fetchTrendingPlaces = async (lat: number, lng: number) => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY) return;

    setIsTrendingLoading(true);
    try {
      const placesResponse = await fetch(
        "https://places.googleapis.com/v1/places:searchNearby",
        {
          method: "POST",
          headers: new Headers({
            "Content-Type": "application/json",
            "X-Goog-Api-Key": process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask":
              "places.displayName,places.formattedAddress,places.rating,places.editorialSummary,places.photos,places.location,places.types",
          }),
          body: JSON.stringify({
            locationRestriction: {
              circle: {
                center: {
                  latitude: lat,
                  longitude: lng,
                },
                radius: 2000.0, // 2km radius
              },
            },
            // Add social venue types to filter results
            includedTypes: [
              "restaurant", 
              "bar", 
              "cafe", 
              "night_club",
              "museum", 
              "art_gallery", 
              "movie_theater", 
              "tourist_attraction",
              "amusement_park",
              "aquarium",
              "zoo"
            ],
            rankPreference: "POPULARITY",
            maxResultCount: 10, // Increased to ensure we get enough after filtering
          }),
        },
      );

      const data = await placesResponse.json();
      if (data.places && data.places.length > 0) {
        // Calculate distance for each place
        const placesWithDistance = data.places.map((place: any) => {
          const distance = calculateDistance(
            lat,
            lng,
            place.location.latitude,
            place.location.longitude,
          );
          return {
            ...place,
            distance: distance,
          };
        });

        setTrendingPlaces(placesWithDistance.slice(0, 5)); // Limit to 5 places
      }
    } catch (error) {
      console.error("Error fetching trending places:", error);
    } finally {
      setIsTrendingLoading(false);
    }
  };

  const trendingPlacesLoadedRef = useRef(false);

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
          await fetchTrendingPlaces(coords.lat, coords.lng);
          trendingPlacesLoadedRef.current = true;
        },
        (error) => {
          setLocationError(
            "Please enable location services to get better recommendations",
          );

          // Add error message to chat
          setMessages([
            {
              id: Date.now().toString(),
              content:
                "Hey there! It looks like location services are turned off. No worries though - I can still help with travel ideas! Just let me know what you're curious about. 😊",
              sender: "ai",
              timestamp: new Date(),
            },
          ]);
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

          // Only fetch trending places if they haven't been loaded yet
          if (!trendingPlacesLoadedRef.current) {
            await fetchTrendingPlaces(coords.lat, coords.lng);
            trendingPlacesLoadedRef.current = true;
          }
        },
        (error) => {
          setLocationError("Error tracking location");
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 60000, // Increased to reduce frequency
        },
      );
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Add this helper function to calculate distance between two coordinates
  const calculateDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number => {
    const R = 3959; // Radius of the Earth in miles (changed from 6371 km)
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in miles
    return distance;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    // Add user message to chat
    const userMessage: MessageType = {
      id: Date.now().toString(),
      content: query,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setQuery("");

    try {
      // First, get place recommendations from Google Places API
      let placesData = [];
      if (userLocation) {
        const placesResponse = await fetch(
          "https://places.googleapis.com/v1/places:searchText",
          {
            method: "POST",
            headers: new Headers({
              "Content-Type": "application/json",
              "X-Goog-Api-Key":
                process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? "",
              "X-Goog-FieldMask":
                "places.displayName,places.formattedAddress,places.rating,places.editorialSummary,places.photos,places.location",
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

        const data = await placesResponse.json();
        if (data.places && data.places.length > 0) {
          // Calculate distance for each place and add it to the place object
          const placesWithDistance = data.places.map((place: any) => {
            const distance = calculateDistance(
              userLocation.lat,
              userLocation.lng,
              place.location.latitude,
              place.location.longitude,
            );
            return {
              ...place,
              distance: distance,
            };
          });

          // Sort places by distance (closest first)
          placesData = placesWithDistance.sort(
            (a: any, b: any) => a.distance - b.distance,
          );
        }
      }

      // Now use Gemini AI to generate a response based on the query and places data
      let aiResponse;
      if (
        query.toLowerCase().includes("recommend") ||
        query.toLowerCase().includes("suggestion") ||
        query.toLowerCase().includes("place") ||
        query.toLowerCase().includes("visit") ||
        query.toLowerCase().includes("go to")
      ) {
        // This is a recommendation request
        const preferences = query;
        aiResponse = await generateTravelRecommendations(
          locationName || "this location",
          preferences,
        );
      } else {
        // This is a general question
        aiResponse = await answerTravelQuestion(
          locationName || "this location",
          query,
        );
      }

      // Add AI response to chat
      const aiMessage: MessageType = {
        id: Date.now().toString(),
        content: aiResponse,
        sender: "ai",
        timestamp: new Date(),
        places: placesData.length > 0 ? placesData.slice(0, 3) : undefined,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error:", error);

      // Add error message to chat
      const errorMessage: MessageType = {
        id: Date.now().toString(),
        content:
          "Oops! Something went wrong on my end. Let's try that again, shall we? 😅",
        sender: "ai",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to generate a description for places without editorialSummary
  const generateDescription = (place: any): string => {
    if (place.editorialSummary?.text) {
      return place.editorialSummary.text;
    }

    // Create a fallback description based on available data
    let description = "";

    if (place.types && place.types.length > 0) {
      const primaryType = place.types[0]
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l: string) => l.toUpperCase());
      description = `A ${primaryType.toLowerCase()}`;
    }

    if (place.rating) {
      description += ` with a ${place.rating}-star rating`;
    }

    if (place.priceLevel) {
      const priceText =
        ["Free", "Inexpensive", "Moderate", "Expensive", "Very Expensive"][
          place.priceLevel
        ] || "";
      if (priceText) {
        description += ` in the ${priceText.toLowerCase()} price range`;
      }
    }

    if (place.businessStatus === "OPERATIONAL") {
      description += ". Currently open for business.";
    }

    return description || "A local establishment worth visiting.";
  };

  return (
    <div className="relative min-h-screen">
      {/* Background Map */}
      <div 
        ref={mapRef}
        className={`absolute inset-0 transition-all duration-300 ${
          isMapFullscreen ? 'z-40' : 'z-0 opacity-30'
        }`}
        style={{ 
          filter: isMapFullscreen ? 'none' : 'blur(1px)',
        }}
      />

      {/* Fullscreen Map Exit Button - Only visible when map is fullscreen */}
      {isMapFullscreen && (
        <button
          onClick={() => setIsMapFullscreen(false)}
          className="fixed top-4 right-4 z-50 w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg transition-all duration-300 flex items-center justify-center"
          title="Exit fullscreen map"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Main Content - Hidden when map is fullscreen */}
      <main className={`relative z-10 min-h-screen transition-all duration-300 ${
        isMapFullscreen ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } flex flex-row`}>
        {/* Chat Section */}
        <div className="flex-1 max-w-3xl w-full mx-auto pt-8 px-4 pb-24 flex flex-col">
          <h1 className="text-4xl font-bold text-[#5E3023] mb-8 text-center drop-shadow-lg">
            Travel Buddy
          </h1>

          {locationError && (
            <div className="mb-6 p-4 bg-[#FFF1E6]/95 backdrop-blur-sm border border-[#E6A4B4] rounded-md text-[#9E4244] shadow-lg">
              {locationError}
            </div>
          )}

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto mb-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.sender === "ai" && (
                  <div className="w-10 h-10 rounded-full bg-[#E6A4B4] flex items-center justify-center mr-2 mt-1 shadow-lg">
                    <span className="text-white text-lg">🧭</span>
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl p-4 shadow-lg backdrop-blur-sm ${message.sender === "user" ? "bg-[#A0C3D2]/95 text-[#2C3333]" : "bg-[#F7EDE2]/95 border border-[#F0D9CA] text-[#5E3023]"}`}
                >
                  <div className="whitespace-pre-line">{message.content}</div>

                  {/* Display place recommendations if available */}
                  {message.places && message.places.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <h3 className="font-medium text-[#5E3023]">
                        ✨ Places you might love:
                      </h3>
                      {message.places.map((place, index) => (
                        <div
                          key={index}
                          className="p-3 bg-[#FFF8F0]/95 backdrop-blur-sm rounded-xl border border-[#F0D9CA] hover:shadow-md transition-shadow"
                        >
                          <h4 className="font-medium text-[#5E3023]">
                            {place.displayName.text}
                          </h4>
                          <p className="text-sm text-[#7D5A50] mt-1">
                            {place.formattedAddress}
                          </p>
                          <div className="flex items-center mt-1 text-sm text-[#7D5A50]">
                            <span className="text-amber-500 mr-1">⭐</span>
                            <span>{place.rating || "No rating yet"}</span>
                            <span className="mx-2">•</span>
                            <span>{place.distance.toFixed(2)} miles away</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {message.sender === "user" && (
                  <div className="w-10 h-10 rounded-full bg-[#A0C3D2] flex items-center justify-center ml-2 mt-1 shadow-lg">
                    <span className="text-white text-lg">👤</span>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form with Map Toggle */}
          <div className="sticky bottom-0 flex items-center gap-3">
            {/* Map Toggle Button - Only shows expand icon when not fullscreen */}
            <button
              onClick={() => setIsMapFullscreen(true)}
              className="w-12 h-12 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center bg-[#E6A4B4] hover:bg-[#D77A9B] text-white"
              title="View fullscreen map"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </button>

            {/* Chat Input Form */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 bg-[#FFF8F0]/95 backdrop-blur-md p-4 rounded-xl shadow-lg border border-[#F0D9CA]"
            >
              <div className="flex items-center">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What are you in the mood for today?..."
                  className="flex-1 px-4 py-3 border border-[#F0D9CA] rounded-l-xl focus:outline-none focus:ring-2 focus:ring-[#E6A4B4] bg-[#FFF8F0]/90 backdrop-blur-sm text-[#5E3023] placeholder-[#B79492]"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`px-6 py-3 rounded-r-xl font-medium transition-colors ${isLoading ? "bg-[#D8B4A0] text-[#FFF8F0]" : "bg-[#E6A4B4] text-white hover:bg-[#D77A9B]"}`}
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Thinking...
                    </span>
                  ) : (
                    "Ask Away"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Trending Places Sidebar */}
        <div className="hidden md:block w-80 bg-[#F7EDE2]/80 backdrop-blur-md border-l border-[#F0D9CA] p-6 overflow-y-auto">
          <div className="sticky top-0 pt-2 pb-4 bg-[#F7EDE2]/90 backdrop-blur-sm z-10 rounded-lg">
            <h2 className="text-2xl font-bold text-[#5E3023] mb-1 drop-shadow-sm">
              Trending Nearby
            </h2>
            <p className="text-sm text-[#7D5A50] mb-4">
              Popular places around you
            </p>
          </div>

          {isTrendingLoading ? (
            <div className="flex justify-center items-center h-40">
              <svg
                className="animate-spin h-8 w-8 text-[#E6A4B4]"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
                </svg>
            </div>
          ) : trendingPlaces.length > 0 ? (
            <div className="space-y-4">
              {trendingPlaces.map((place, index) => (
                <div
                  key={index}
                  className="p-4 bg-[#FFF8F0]/95 backdrop-blur-sm rounded-xl border border-[#F0D9CA] hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium text-[#5E3023] text-lg">
                      {place.displayName.text}
                    </h3>
                    <div className="flex items-center bg-[#E6A4B4] text-white text-xs font-bold px-2 py-1 rounded-full">
                      #{index + 1}
                    </div>
                  </div>
                  <p className="text-sm text-[#7D5A50] mt-2">
                    {place.formattedAddress}
                  </p>
                  <div className="flex items-center mt-2 text-sm text-[#7D5A50]">
                    <span className="text-amber-500 mr-1">⭐</span>
                    <span>{place.rating || "No rating yet"}</span>
                    <span className="mx-2">•</span>
                    <span>{place.distance.toFixed(2)} miles away</span>
                  </div>
                  {place.editorialSummary?.text && (
                    <p className="text-sm text-[#7D5A50] mt-2 line-clamp-3">
                      {place.editorialSummary.text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-[#7D5A50]">
              <p>No trending places found nearby.</p>
              <p className="text-sm mt-2">
                Try enabling location services or exploring a different area.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
