import os
from flask import Flask, jsonify, request
import requests
from math import atan2, radians, degrees, sin, cos
from flask_cors import CORS
from dotenv import load_dotenv
import math

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app, origins=["https://andrewweddell.github.io"])
# Environment Variables
CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
STRAVA_REFRESH_TOKEN = os.getenv("STRAVA_REFRESH_TOKEN")
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")

ACCESS_TOKEN = None

def refresh_access_token():
    """Refresh the Strava access token using the refresh token."""
    global ACCESS_TOKEN
    url = "https://www.strava.com/oauth/token"
    payload = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": STRAVA_REFRESH_TOKEN,
    }
    response = requests.post(url, data=payload)
    if response.status_code == 200:
        data = response.json()
        ACCESS_TOKEN = data["access_token"]
        print("Access token refreshed successfully!")
    else:
        print(f"Error refreshing token: {response.json()}")
        raise Exception("Failed to refresh access token")

def decode_polyline(polyline_str):
    """
    Decodes a polyline that has been encoded using Google's algorithm.
    Returns a list of (latitude, longitude) tuples.
    """
    index = 0
    lat = 0
    lng = 0
    coordinates = []

    while index < len(polyline_str):
        shift = 0
        result = 0
        while True:
            b = ord(polyline_str[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += dlat

        shift = 0
        result = 0
        while True:
            b = ord(polyline_str[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        dlng = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += dlng

        coordinates.append((lat * 1e-5, lng * 1e-5))
    return coordinates

def calculate_bearing(lat1, lon1, lat2, lon2):
    """Calculate the bearing between two latitude/longitude points."""
    delta_lon = radians(lon2 - lon1)
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    x = sin(delta_lon) * cos(lat2_rad)
    y = cos(lat1_rad) * sin(lat2_rad) - sin(lat1_rad) * cos(lat2_rad) * cos(delta_lon)
    bearing = degrees(atan2(x, y))
    return (bearing + 360) % 360

def average_bearing(coords):
    """
    Compute an average bearing for a series of coordinates.
    This uses the vector sum of unit bearings between consecutive points.
    """
    sum_x = 0
    sum_y = 0
    for i in range(len(coords) - 1):
        lat1, lon1 = coords[i]
        lat2, lon2 = coords[i + 1]
        br = calculate_bearing(lat1, lon1, lat2, lon2)
        sum_x += math.cos(radians(br))
        sum_y += math.sin(radians(br))
    if sum_x == 0 and sum_y == 0:
        return 0
    avg_angle = degrees(atan2(sum_y, sum_x))
    return (avg_angle + 360) % 360

def compute_segment_bearing(segment):
    """
    Compute the segment's bearing.
    If the segment’s start and end coordinates are identical (or end is missing),
    try to decode the polyline and calculate an average bearing.
    """
    start_latlng = segment.get("start_latlng")
    end_latlng = segment.get("end_latlng")

    print("Debug - Raw coordinates:", "start:", start_latlng, "end:", end_latlng)

    if not start_latlng:
        return 0

    # Use polyline if end coordinates are missing or identical to the start.
    if (not end_latlng) or (start_latlng == end_latlng):
        polyline_str = segment.get("map", {}).get("polyline")
        if polyline_str:
            coords = decode_polyline(polyline_str)
            print("Debug - Decoded polyline coordinates:", coords)
            if coords and len(coords) > 1:
                avg_br = average_bearing(coords)
                print("Debug - Average bearing from polyline:", avg_br)
                return avg_br
        return 0

    lat_start, lon_start = start_latlng
    lat_end, lon_end = end_latlng
    computed_bearing = calculate_bearing(lat_start, lon_start, lat_end, lon_end)
    print("Debug - Computed bearing from start/end:", computed_bearing)
    return computed_bearing

def calculate_wind_rating(segment_bearing, wind_from):
    """
    Calculate a wind rating for the segment based on its bearing and wind direction.
    Downwind (i.e. wind effectively pushing the cyclist) gets a rating of 5,
    while a headwind earns a rating of 0.
    """
    # Convert the wind's "from" direction to the "to" direction.
    wind_to = (wind_from + 180) % 360
    # Compute the smallest angular difference.
    angle_diff = abs(segment_bearing - wind_to)
    if angle_diff > 180:
        angle_diff = 360 - angle_diff
    # Map 0° difference to 5 and 180° difference to 0 using a linear scale.
    rating = 5 * (1 - angle_diff / 180)
    return rating

def get_cardinal_direction(deg):
    """Convert a degree measurement into a cardinal direction."""
    directions = [
        "North",
        "North-East",
        "East",
        "South-East",
        "South",
        "South-West",
        "West",
        "North-West",
    ]
    index = round(deg / 45) % 8
    return directions[index]

def process_forecast_data(forecast_data):
    """Extract and organize forecast data by day."""
    daily_forecast = {}
    for entry in forecast_data["list"]:
        date = entry["dt_txt"].split(" ")[0]  # Extract the date portion.
        wind = entry.get("wind", {})
        if date not in daily_forecast:
            daily_forecast[date] = []
        daily_forecast[date].append(wind)
    return daily_forecast

@app.route("/segments_with_weather", methods=["GET"])
def get_segments_with_weather():
    """Fetch Strava starred segments and enrich them with weather data and wind ratings."""
    global ACCESS_TOKEN
    if ACCESS_TOKEN is None:
        refresh_access_token()

    headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}
    strava_response = requests.get("https://www.strava.com/api/v3/segments/starred", headers=headers)

    if strava_response.status_code == 401:
        # Refresh the token if expired and retry.
        refresh_access_token()
        headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}
        strava_response = requests.get("https://www.strava.com/api/v3/segments/starred", headers=headers)

    if strava_response.status_code != 200:
        print(f"Error from Strava API: {strava_response.text}")
        return jsonify({"error": "Failed to fetch Strava segments"}), 500

    segments = strava_response.json()
    if not isinstance(segments, list):
        return jsonify({"error": "Unexpected data format from Strava API"}), 500

    enriched_segments = []
    for segment in segments:
        # Compute the bearing.
        bearing = compute_segment_bearing(segment)
        segment["bearing"] = bearing

        # Fetch weather forecast based on the segment's starting coordinates.
        start_latlng = segment.get("start_latlng")
        if not start_latlng:
            continue  # Skip if no starting coordinate.
        lat_start, lon_start = start_latlng

        forecast_url = (
            f"http://api.openweathermap.org/data/2.5/forecast?lat={lat_start}&lon={lon_start}&units=metric&appid={WEATHER_API_KEY}"
        )
        forecast_response = requests.get(forecast_url)
        if forecast_response.status_code == 200:
            forecast_data = forecast_response.json()
            segment["forecast"] = process_forecast_data(forecast_data)

            # Calculate wind rating and enrich with wind direction and speed.
            if forecast_data.get("list"):
                current_forecast = forecast_data["list"][0]
                wind = current_forecast.get("wind", {})
                if "deg" in wind:
                    rating = calculate_wind_rating(bearing, wind["deg"])
                    segment["wind_rating"] = rating
                    segment["wind_direction"] = get_cardinal_direction(wind["deg"])
                    segment["wind_speed_kmh"] = round(wind.get("speed", 0) * 3.6, 2)
                else:
                    segment["wind_rating"] = None
                    segment["wind_direction"] = "Unknown"
                    segment["wind_speed_kmh"] = 0
            enriched_segments.append(segment)
        else:
            print(f"Error fetching weather forecast: {forecast_response.text}")

    return jsonify(enriched_segments)

@app.route("/weather_forecast", methods=["GET"])
def get_weather_forecast():
    """Fetch the 5-day weather forecast for a specified location."""
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)

    if lat is None or lon is None:
        return jsonify({"error": "Missing required parameters 'lat' and 'lon'"}), 400

    forecast_url = (
        f"http://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&units=metric&appid={WEATHER_API_KEY}"
    )
    response = requests.get(forecast_url)

    if response.status_code != 200:
        print(f"Error fetching weather forecast: {response.text}")
        return jsonify({"error": "Failed to fetch weather forecast"}), 500

    forecast_data = response.json()
    daily_forecast = process_forecast_data(forecast_data)

    return jsonify(daily_forecast)

if __name__ == "__main__":
    try:
        refresh_access_token()  # Refresh the token on app startup.
    except Exception as e:
        print(f"Failed to start the app: {str(e)}")
    app.run(debug=True)