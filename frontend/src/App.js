import React, { useEffect, useState } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";



// Star component to display rating
const Stars = ({ rating }) => {
  const stars = [];
  const filledStars = Math.round(rating); // Assuming rating is between 0 and 5
  for (let i = 0; i < 5; i++) {
    stars.push(
      <span key={i} className={i < filledStars ? "star filled" : "star"}>
        ★
      </span>
    );
  }
  return <div className="stars">{stars}</div>;
};

// Map Handler to Move to Selected Segment
const MapHandler = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, 15); // Zoom level 15 for a closer view
    }
  }, [position, map]);
  return null;
};

function App() {
  
  const [segments, setSegments] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [showAll, setShowAll] = useState(false); // Toggle state for accordion

  const customIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
    iconSize: [40, 40],
  });

  // Fetch segments with weather data
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

  const handleSegmentClick = (segment) => {
    if (segment.start_latlng) {
      setSelectedPosition(segment.start_latlng);
    }
  };

  const toggleAccordion = () => {
    setShowAll(!showAll);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  // Sort segments by wind rating
  const sortedSegments = segments.sort((a, b) => (b.wind_rating || 0) - (a.wind_rating || 0));
  const top5Segments = sortedSegments.slice(0, 5);
  const otherSegments = sortedSegments.slice(5);

  return (
    <div className="app-container">
      <div className="controls">
        <h1>Top Segments</h1>
      </div>
      <div className="content">
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
              {top5Segments.map((segment) => (
                <tr
                  key={segment.id}
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
                  {otherSegments.map((segment) => (
                    <tr
                      key={segment.id}
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
            {segments.map((segment) => (
              <React.Fragment key={segment.id}>
                {segment.start_latlng && segment.end_latlng && (
                  <Polyline
                    positions={[segment.start_latlng, segment.end_latlng]}
                    pathOptions={{
                      color: "blue",
                      weight: 5,
                    }}
                  >
                    <Popup>
                      <b>{segment.name}</b>
                      <p>Bearing: {segment.bearing.toFixed(2)}°</p>
                      <p>Rating: <Stars rating={segment.wind_rating || 0} /></p>
                    </Popup>
                  </Polyline>
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
    </div>
  );
}

export default App;