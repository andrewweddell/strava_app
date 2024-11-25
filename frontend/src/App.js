import React, { useEffect, useState } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

// Star component to display rating
const Stars = ({ rating }) => {
  const stars = [];
  for (let i = 0; i < 5; i++) {
    stars.push(
      <span key={i} className={i < rating ? "star filled" : "star"}>
        ★
      </span>
    );
  }
  return <div className="stars">{stars}</div>;
};

function App() {
  const [segments, setSegments] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState(null); // Track the selected segment
  const [error, setError] = useState(null);

  // Custom icon for markers
  const customIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png", // Replace with your preferred marker icon URL
    iconSize: [40, 40],
  });

  // Convert wind direction from degrees to cardinal direction
  const getCardinalDirection = (degrees) => {
    const directions = [
      "North",
      "North-East",
      "East",
      "South-East",
      "South",
      "South-West",
      "West",
      "North-West",
    ];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  };

  useEffect(() => {
    const fetchSegmentsWithWeather = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:5000/segments_with_weather");
        setSegments(response.data);
      } catch (err) {
        setError(err.message || "An error occurred");
        console.error("Error fetching segments:", err);
      }
    };

    fetchSegmentsWithWeather();
  }, []);

  // Calculate KOM rating
  const getKOMRating = (bearing, wind) => {
    if (!wind || !bearing) return 1; // Default to poor if data is missing
    const windBearing = (wind.deg + 180) % 360; // Adjust wind direction to where it is going
    const windSpeed = wind.speed || 0;

    const angleDiff = Math.abs(bearing - windBearing);
    const effectiveAngle = angleDiff > 180 ? 360 - angleDiff : angleDiff;

    if (effectiveAngle <= 45 && windSpeed > 5) return 5; // Strong tailwind
    if (effectiveAngle <= 45 && windSpeed <= 5) return 4; // Light tailwind
    if (effectiveAngle > 135) return 1; // Strong headwind
    if (effectiveAngle > 90) return 2; // Moderate headwind or strong crosswind
    return 3; // Neutral
  };

  // Add KOM rating to segments
  const enrichedSegments = segments.map((segment) => {
    const rating = getKOMRating(segment.bearing, segment.wind);
    const windDirection = segment.wind?.deg ? getCardinalDirection(segment.wind.deg) : "Unknown";
    const windSpeedKmh = (segment.wind?.speed || 0) * 3.6; // Convert m/s to km/h
    return { ...segment, rating, windDirection, windSpeedKmh };
  });

  // Sort segments by KOM rating
  const sortedSegments = enrichedSegments.sort((a, b) => b.rating - a.rating);

  // Get weather summary from the first segment (assuming all segments share similar weather)
  const weatherSummary =
    segments.length > 0
      ? {
          location: segments[0].city || "Unknown",
          windSpeedKmh: (segments[0].wind?.speed || 0) * 3.6,
          windDirection: segments[0].wind?.deg
            ? `${segments[0].wind.deg}° (${getCardinalDirection(segments[0].wind.deg)})`
            : "Unknown",
        }
      : null;

  // Highlight selected segment on the map
  const MapFocus = ({ segment }) => {
    const map = useMap();
    if (segment && segment.start_latlng) {
      map.flyTo(segment.start_latlng, 15); // Fly to the selected segment with zoom
    }
    return null;
  };

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="app-container">
      <div className="map-container">
        <h1>Strava Tailwind App</h1>
        <MapContainer center={[-33.9048907, 151.2675154]} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {sortedSegments.map((segment) => (
            <React.Fragment key={segment.id}>
              {/* Draw segment as a polyline */}
              {segment.start_latlng && segment.end_latlng && (
                <Polyline
                  positions={[segment.start_latlng, segment.end_latlng]}
                  pathOptions={{
                    color: segment.id === selectedSegment?.id ? "red" : "blue", // Highlight selected segment
                    weight: 5,
                  }}
                />
              )}
              {/* Add start marker */}
              <Marker
                position={segment.start_latlng}
                icon={customIcon}
                eventHandlers={{
                  click: () => setSelectedSegment(segment), // Update selected segment on marker click
                }}
              >
                <Popup>
                  <b>{segment.name}</b>
                  <p>Bearing: {segment.bearing.toFixed(2)}°</p>
                  <p>Wind Speed: {segment.windSpeedKmh.toFixed(2)} km/h</p>
                  <p>Wind Direction: {segment.windDirection}</p>
                  <p><strong>KOM Rating:</strong> <Stars rating={segment.rating} /></p>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}
          <MapFocus segment={selectedSegment} />
        </MapContainer>
      </div>
      <div className="table-container">
        <h2>KOM Opportunities</h2>
        {weatherSummary && (
          <div className="weather-summary">
            <p><strong>Weather Location:</strong> {weatherSummary.location}</p>
            <p><strong>Wind Speed:</strong> {weatherSummary.windSpeedKmh.toFixed(2)} km/h</p>
            <p><strong>Wind Direction:</strong> {weatherSummary.windDirection}</p>
          </div>
        )}
        <table className="modern-table">
          <thead>
            <tr>
              <th>Segment Name</th>
              <th>City</th>
              <th>Bearing</th>
              <th>Wind Speed (km/h)</th>
              <th>Wind Direction</th>
              <th>KOM Rating</th>
            </tr>
          </thead>
          <tbody>
            {sortedSegments.map((segment) => (
              <tr
                key={segment.id}
                className={segment.id === selectedSegment?.id ? "selected-row" : ""}
                onClick={() => setSelectedSegment(segment)} // Highlight segment on table row click
              >
                <td>{segment.name}</td>
                <td>{segment.city || "Unknown"}</td>
                <td>{segment.bearing.toFixed(2)}°</td>
                <td>{segment.windSpeedKmh.toFixed(2)}</td>
                <td>{segment.windDirection}</td>
                <td><Stars rating={segment.rating} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
