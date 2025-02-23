import React, { useEffect, useState } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import Stars from "./Stars";
import "leaflet/dist/leaflet.css";
import "../styles/SegmentDisplay.css";

// Convert wind direction degrees to human-readable names
const getWindDirectionName = (deg) => {
  const directions = [
    "North", "Northeast", "East", "Southeast",
    "South", "Southwest", "West", "Northwest"
  ];
  const index = Math.round(deg / 45) % 8;
  return directions[index];
};

// Map handler to move to selected segment
const MapHandler = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, 15);
    }
  }, [position, map]);
  return null;
};

const SegmentDisplay = ({ user }) => {
  // segments will be incrementally added during loading
  const [segments, setSegments] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const customIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
    iconSize: [40, 40],
  });

  // Fetch segments and simulate incremental streaming by adding them one-by-one.
  useEffect(() => {
    const fetchSegments = async () => {
      try {
        const response = await axios.get(`https://strava-app-l46p.onrender.com/segments_with_weather`, {
          params: { user }
        });
        const data = response.data;
        // Set default forecast day from the first segment.
        if (data.length > 0) {
          const forecastDays = Object.keys(data[0].forecast);
          setSelectedDay(forecastDays[0]);
        }
        // Incrementally add each segment with a slight delay.
        data.forEach((segment, index) => {
          setTimeout(() => {
            setSegments(prev => [...prev, segment]);
            if (index === data.length - 1) {
              setLoading(false);
            }
          }, index * 50); // 50ms delay per segment to simulate streaming
        });
      } catch (err) {
        setError("Failed to fetch segments.");
        console.error(err);
        setLoading(false);
      }
    };
    fetchSegments();
  }, [user]);

  const handleDayClick = (day) => {
    setSelectedDay(day);
  };

  const handleSegmentClick = (segment) => {
    if (segment.start_latlng) {
      setSelectedPosition(segment.start_latlng);
    }
  };

  const toggleAccordion = () => {
    setShowAll(!showAll);
  };

  // While loading, display a code-styled loading page with the segments as they arrive.
  if (loading) {
    return (
      <div
        style={{
          backgroundColor: "black",
          color: "#00ff00",
          fontFamily: "monospace",
          padding: "20px",
          height: "100vh",
          overflowY: "auto"
        }}
      >
        <pre>
          <code>
{segments.map((segment, index) => {
  const start = segment.start_latlng 
    ? `[${segment.start_latlng.join(", ")}]` 
    : "N/A";
  const end = segment.end_latlng 
    ? `[${segment.end_latlng.join(", ")}]` 
    : "N/A";
  return `Segment ${segment.id}: ${start} -> ${end}\n`;
})}
          </code>
        </pre>
        <div>Loading segments data...</div>
      </div>
    );
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  // Sort segments by wind rating for the main page.
  const sortedSegments = segments.sort((a, b) => (b.wind_rating || 0) - (a.wind_rating || 0));
  const top5Segments = sortedSegments.slice(0, 5);
  const otherSegments = sortedSegments.slice(5);

  return (
    <div className="segment-display-container">
      <h1>{user}'s Segments</h1>

      {/* Weather Forecast Section */}
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
                const windSpeedKmh = wind.speed ? (wind.speed * 3.6).toFixed(2) : "0.00";
                const windDirection = wind.deg ? getWindDirectionName(wind.deg) : "Unknown";
                return (
                  <tr
                    key={`${day}-${index}`}
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

      {/* Segments Table with Accordion */}
      <div className="segments-container">
        <h2>Top 5 Segments for {selectedDay}</h2>
        <table className="segments-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Bearing</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {top5Segments.map((segment, index) => (
              <tr
                key={`${segment.id}-${index}`}
                onClick={() => handleSegmentClick(segment)}
                style={{ cursor: "pointer" }}
              >
                <td>{segment.name}</td>
                <td>{segment.bearing.toFixed(2)}°</td>
                <td>
                  <Stars rating={segment.wind_rating || 0} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Accordion for Other Segments */}
        <div className="accordion">
          <button className="accordion-toggle" onClick={toggleAccordion}>
            {showAll ? "Hide Other Segments" : "Show Other Segments"}
          </button>
          {showAll && (
            <table className="segments-table">
              <tbody>
                {otherSegments.map((segment, index) => (
                  <tr
                    key={`${segment.id}-${index}`}
                    onClick={() => handleSegmentClick(segment)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{segment.name}</td>
                    <td>{segment.bearing.toFixed(2)}°</td>
                    <td>
                      <Stars rating={segment.wind_rating || 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Map Section */}
      <div className="map-container">
        <MapContainer
          center={[-33.9048907, 151.2675154]}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
        >
          <MapHandler position={selectedPosition} />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {segments.map((segment, index) => (
            <React.Fragment key={`${segment.id}-${index}`}>
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
                  <p>Rating: <Stars rating={segment.wind_rating || 0} /></p>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default SegmentDisplay;