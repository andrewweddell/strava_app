import React, { useEffect, useState } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

// Helper to convert wind direction in degrees to cardinal directions
const getCardinalDirection = (deg) => {
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
  const index = Math.round(deg / 45) % 8;
  return directions[index];
};

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
  const [selectedDay, setSelectedDay] = useState(null); // Selected day
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const customIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
    iconSize: [40, 40],
  });

  useEffect(() => {
    const fetchSegments = async () => {
      try {
        const segmentsResponse = await axios.get("http://127.0.0.1:5000/segments_with_weather");
        setSegments(segmentsResponse.data);
        setSelectedDay(Object.keys(segmentsResponse.data[0].forecast)[0]); // Default to the first day
      } catch (err) {
        setError("Failed to fetch segments.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSegments();
  }, []);

  const getKOMRating = (bearing, wind) => {
    if (!wind || !bearing) return 1;
    const windBearing = (wind.deg + 180) % 360;
    const windSpeed = wind.speed || 0;

    const angleDiff = Math.abs(bearing - windBearing);
    const effectiveAngle = angleDiff > 180 ? 360 - angleDiff : angleDiff;

    if (effectiveAngle <= 45 && windSpeed > 5) return 5;
    if (effectiveAngle <= 45 && windSpeed <= 5) return 4;
    if (effectiveAngle > 135) return 1;
    if (effectiveAngle > 90) return 2;
    return 3;
  };

  // Map and then sort segments based on the rating (best to worst)
  const enrichedSegments = segments
    .map((segment) => {
      const wind = segment.forecast[selectedDay]?.[0] || {}; // Get the first forecasted wind entry for the selected day
      const rating = getKOMRating(segment.bearing, wind);
      return {
        ...segment,
        rating,
        windDirection: wind.deg ? getCardinalDirection(wind.deg) : "Unknown",
        windSpeedKmh: (wind.speed || 0) * 3.6,
      };
    })
    .sort((a, b) => b.rating - a.rating); // Sorting from best (highest) to worst (lowest)

  const handleDayClick = (day) => {
    setSelectedDay(day); // Update selected day
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="app-container">
      <div className="controls">
        <h1>Strava Tailwind App</h1>
      </div>
      <div className="content">
        <div className="forecast-container">
          <h2>5-Day Weather Forecast</h2>
          <table className="forecast-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Wind Direction</th>
                <th>Wind Speed (km/h)</th>
              </tr>
            </thead>
            <tbody>
              {segments.length > 0 &&
                Object.keys(segments[0].forecast).map((day, index) => {
                  const wind = segments[0].forecast[day][0] || {};
                  const windSpeedKmh = (wind.speed || 0) * 3.6;
                  const windDirection = wind.deg ? getCardinalDirection(wind.deg) : "Unknown";

                  return (
                    <tr
                      key={index}
                      onClick={() => handleDayClick(day)}
                      className={day === selectedDay ? "selected" : ""}
                    >
                      <td>{day}</td>
                      <td>{windDirection}</td>
                      <td>{windSpeedKmh.toFixed(2)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div className="segments-container">
          <h2>Segments for {selectedDay}</h2>
          <table className="segments-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Bearing</th>
                <th>Wind Direction</th>
                <th>Wind Speed (km/h)</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {enrichedSegments.map((segment) => (
                <tr key={segment.id}>
                  <td>{segment.name}</td>
                  <td>{segment.bearing.toFixed(2)}°</td>
                  <td>{segment.windDirection}</td>
                  <td>{segment.windSpeedKmh.toFixed(2)}</td>
                  <td>
                    <Stars rating={segment.rating} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="map-container">
          <MapContainer
            center={[-33.9048907, 151.2675154]}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {segments.map((segment) => (
              <React.Fragment key={segment.id}>
                {segment.start_latlng && segment.end_latlng && (
                  <Polyline
                    positions={[segment.start_latlng, segment.end_latlng]}
                    pathOptions={{
                      color: "blue",
                      weight: 5,
                    }}
                  />
                )}
                <Marker position={segment.start_latlng} icon={customIcon}>
                  <Popup>
                    <b>{segment.name}</b>
                    <p>Bearing: {segment.bearing.toFixed(2)}°</p>
                  </Popup>
                </Marker>
              </React.Fragment>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default App;