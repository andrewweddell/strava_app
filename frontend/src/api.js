import axios from "axios";

const backendUrl = "http://127.0.0.1:5000";

export const fetchSegmentsWithWeather = async () => {
  const response = await axios.get(`${backendUrl}/segments_with_weather`);
  return response.data;
};
