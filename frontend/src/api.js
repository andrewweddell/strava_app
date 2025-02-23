import axios from "axios";

const backendUrl = "https://strava-app-l46p.onrender.com";

export const fetchSegmentsWithWeather = async () => {
  const response = await axios.get(`${backendUrl}/segments_with_weather`);
  return response.data;
};
