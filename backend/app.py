from flask import Flask, jsonify
import requests
from math import atan2, radians, degrees, cos, sin
from flask_cors import CORS  # Import the CORS library

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://127.0.0.1:3000", "http://localhost:3000"]}})  # Allow React's origins

STRAVA_TOKEN = "4bf0fbbb29f172dcbc18dee25b24d7ed58eea558"
WEATHER_API_KEY = "45d323849e36ad33c0a9a9e4c40c6ae2"


def calculate_bearing(lat1, lon1, lat2, lon2):
    """Calculate the bearing between two latitude/longitude points."""
    delta_lon = radians(lon2 - lon1)
    lat1 = radians(lat1)
    lat2 = radians(lat2)
    x = sin(delta_lon) * cos(lat2)
    y = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(delta_lon)
    bearing = degrees(atan2(x, y))
    return (bearing + 360) % 360


@app.route("/segments_with_weather", methods=["GET"])
def get_segments_with_weather():
    """Fetch Strava starred segments and enrich them with weather data."""
    headers = {"Authorization": f"Bearer {STRAVA_TOKEN}"}
    strava_response = requests.get("https://www.strava.com/api/v3/segments/starred", headers=headers)

    # Check if the Strava API request was successful
    if strava_response.status_code != 200:
        print(f"Error from Strava API: {strava_response.text}")
        return jsonify({"error": "Failed to fetch Strava segments"}), 500

    segments = strava_response.json()

    # Ensure the response is a list of segments
    if not isinstance(segments, list):
        return jsonify({"error": "Unexpected data format from Strava API"}), 500

    enriched_segments = []
    for segment in segments:
        # Extract latitude and longitude from start_latlng and end_latlng
        start_latlng = segment.get("start_latlng")
        end_latlng = segment.get("end_latlng")

        if not start_latlng or not end_latlng:
            print(f"Skipping segment with incomplete data: {segment}")
            continue

        lat_start, lon_start = start_latlng
        lat_end, lon_end = end_latlng

        # Calculate the bearing of the segment
        bearing = calculate_bearing(lat_start, lon_start, lat_end, lon_end)

        # Fetch weather data for the segment's start point
        weather_url = (
            f"http://api.openweathermap.org/data/2.5/weather?lat={lat_start}&lon={lon_start}&appid={WEATHER_API_KEY}"
        )
        weather_response = requests.get(weather_url)

        # Handle potential errors in weather API
        if weather_response.status_code != 200:
            print(f"Error fetching weather for segment {segment.get('id', 'unknown')}: {weather_response.text}")
            continue

        weather_data = weather_response.json()

        # Enrich the segment with additional data
        segment["bearing"] = bearing
        segment["wind"] = weather_data.get("wind", {})
        enriched_segments.append(segment)

    return jsonify(enriched_segments)


if __name__ == "__main__":
    app.run(debug=True)
