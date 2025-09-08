import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log("🌤️ Weather API called");

    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    console.log("📍 Coordinates:", { lat, lon });

    if (!lat || !lon) {
      console.log("❌ Missing coordinates");
      return NextResponse.json(
        { error: "Latitude and longitude are required" },
        { status: 400 }
      );
    }

    const API_KEY = process.env.OPENWEATHER_API_KEY;

    console.log("🔑 API Key found:", API_KEY ? "YES" : "NO");
    console.log("🔑 API Key length:", API_KEY ? API_KEY.length : 0);

    if (!API_KEY) {
      console.error("❌ OpenWeather API key not found in environment");
      return NextResponse.json(
        { error: "Weather service unavailable - no API key" },
        { status: 500 }
      );
    }

    const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
    console.log("🌐 Calling OpenWeather API...");

    const response = await fetch(weatherUrl, {
      next: { revalidate: 600 }, 
    });

    console.log("📡 OpenWeather response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ OpenWeather API error:", response.status, errorText);
      throw new Error(`Weather API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("✅ OpenWeather data received successfully");

    const current = data.list[0];
    const hourlyForecasts = data.list.slice(0, 8);

    const dailyMap = new Map();

    data.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toDateString();

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: date.toISOString().split("T")[0],
          dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
          temps: [],
          descriptions: [],
          icons: [],
          humidity: [],
          windSpeed: [],
        });
      }

      const dayData = dailyMap.get(dateKey);
      dayData.temps.push(item.main.temp);
      dayData.descriptions.push(item.weather[0].description);
      dayData.icons.push(item.weather[0].icon);
      dayData.humidity.push(item.main.humidity);
      dayData.windSpeed.push(item.wind.speed);
    });

    const dailyForecasts = Array.from(dailyMap.values())
      .slice(0, 5)
      .map((day: any) => ({
        date: day.date,
        dayName: day.dayName,
        highTemp: Math.round(Math.max(...day.temps)),
        lowTemp: Math.round(Math.min(...day.temps)),
        description: day.descriptions[Math.floor(day.descriptions.length / 2)],
        icon: day.icons[Math.floor(day.icons.length / 2)],
        humidity: Math.round(
          day.humidity.reduce((a: number, b: number) => a + b, 0) /
            day.humidity.length
        ),
        windSpeed: Math.round(
          (day.windSpeed.reduce((a: number, b: number) => a + b, 0) /
            day.windSpeed.length) *
            3.6
        ),
      }));

    const weatherData = {
      current: {
        temp: Math.round(current.main.temp),
        feelsLike: Math.round(current.main.feels_like),
        description: current.weather[0].description,
        icon: current.weather[0].icon,
        windSpeed: Math.round(current.wind.speed * 3.6),
        humidity: current.main.humidity,
      },
      hourly: hourlyForecasts.map((forecast: any) => ({
        time: new Date(forecast.dt * 1000).toLocaleTimeString("en-US", {
          hour: "numeric",
          hour12: true,
        }),
        temp: Math.round(forecast.main.temp),
        description: forecast.weather[0].description,
        icon: forecast.weather[0].icon,
      })),
      daily: dailyForecasts,
    };

    console.log("✅ Weather data processed successfully");
    return NextResponse.json(weatherData);
  } catch (error) {
    console.error("💥 Failed to fetch weather data:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}
