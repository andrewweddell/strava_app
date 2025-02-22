import React, { useEffect, useState } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

// Star component to display rating
const Stars = ({ rating }) => {
  const stars = [];
  // Assuming rating is a value between 0 and 5, you can round or floor as needed.
  const filledStars = Math.round(rating);
  for (let i = 0; i < 5; i++) {
    stars.push(
      <span key={i} className={i < filledStars ? "star filled" : "star"}>
        ★
      </span>
    );
  }
  return <div className="stars">{stars}</div>;
};

function App() {
  const [segments, setSegments] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
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
        // Default selected day from the first segment's forecast, if available.
        if (segmentsResponse.data.length > 0) {
          const forecastDays = Object.keys(segmentsResponse.data[0].forecast);
          setSelectedDay(forecastDays[0]);
        }
      } catch (err) {
        setError("Failed to fetch segments.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSegments();
  }, []);

  const handleDayClick = (day) => {
    setSelectedDay(day);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  // No additional client-side calculations are needed.
  // The backend has enriched each segment with wind_rating, wind_direction, and wind_speed_kmh.
  // Optionally, you can sort segments here if desired.
  const sortedSegments = segments.sort((a, b) => (b.wind_rating || 0) - (a.wind_rating || 0));

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
                  // Display forecast information from the first segment
                  const wind = segments[0].forecast[day][0] || {};
                  const windSpeedKmh = wind.speed ? (wind.speed * 3.6).toFixed(2) : "0.00";
                  const windDirection = wind.deg ? wind.deg : "Unknown";
                  return (
                    <tr
                      key={index}
                      onClick={() => handleDayClick(day)}
                      className={day === selectedDay ? "selected" : ""}
                    >
                      <td>{day}</td>
                      <td>{windDirection}</td>
                      <td>{windSpeedKmh}</td>
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
              {sortedSegments.map((segment) => (
                <tr key={segment.id}>
                  <td>{segment.name}</td>
                  <td>{segment.bearing.toFixed(2)}°</td>
                  <td>{segment.wind_direction || "Unknown"}</td>
                  <td>{segment.wind_speed_kmh !== undefined ? segment.wind_speed_kmh : "0.00"}</td>
                  <td>
                    <Stars rating={segment.wind_rating || 0} />
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