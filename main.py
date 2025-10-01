# File: ai_service/main.py
# How to name: ai_service/main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import numpy as np
from enum import Enum

app = FastAPI(title="AirAware AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enums and Models
class SensitivityLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"

class ActivityType(str, Enum):
    RESTING = "resting"
    LIGHT_ACTIVITY = "light_activity"
    MODERATE_EXERCISE = "moderate_exercise"
    INTENSE_EXERCISE = "intense_exercise"

class AirQualityData(BaseModel):
    pm25: float
    pm10: Optional[float] = None
    co2: Optional[int] = None
    o3: Optional[float] = None
    no2: Optional[float] = None
    aqi: int
    temperature: float
    humidity: float
    timestamp: datetime

class HealthProfile(BaseModel):
    age: int
    has_asthma: bool = False
    has_copd: bool = False
    has_heart_condition: bool = False
    is_pregnant: bool = False
    is_child: bool = False
    is_elderly: bool = False
    sensitivity_level: SensitivityLevel = SensitivityLevel.MODERATE

class RecommendationRequest(BaseModel):
    air_quality: AirQualityData
    health_profile: HealthProfile
    intended_activity: ActivityType
    duration_minutes: int
    location_type: str  # 'indoor', 'outdoor'

class ForecastRequest(BaseModel):
    historical_data: List[Dict]
    location: Dict[str, float]
    hours_ahead: int = 24

# AQI Categories and Health Impact
AQI_CATEGORIES = {
    "good": (0, 50),
    "moderate": (51, 100),
    "unhealthy_sensitive": (101, 150),
    "unhealthy": (151, 200),
    "very_unhealthy": (201, 300),
    "hazardous": (301, 500)
}

def get_aqi_category(aqi: int) -> str:
    for category, (low, high) in AQI_CATEGORIES.items():
        if low <= aqi <= high:
            return category
    return "hazardous"

def calculate_health_risk_score(
    air_quality: AirQualityData,
    health_profile: HealthProfile,
    activity: ActivityType
) -> float:
    """
    Calculate personalized health risk score (0-100)
    Higher score = higher risk
    """
    base_risk = air_quality.aqi / 5  # AQI as baseline (0-100)
    
    # PM2.5 specific risk (most harmful pollutant)
    if air_quality.pm25:
        pm25_risk = min(air_quality.pm25 / 2, 100)
        base_risk = max(base_risk, pm25_risk)
    
    # Activity multiplier (breathing rate increases with activity)
    activity_multipliers = {
        ActivityType.RESTING: 1.0,
        ActivityType.LIGHT_ACTIVITY: 1.3,
        ActivityType.MODERATE_EXERCISE: 1.8,
        ActivityType.INTENSE_EXERCISE: 2.5
    }
    base_risk *= activity_multipliers[activity]
    
    # Sensitivity adjustments
    sensitivity_multipliers = {
        SensitivityLevel.LOW: 0.8,
        SensitivityLevel.MODERATE: 1.0,
        SensitivityLevel.HIGH: 1.4,
        SensitivityLevel.VERY_HIGH: 1.8
    }
    base_risk *= sensitivity_multipliers[health_profile.sensitivity_level]
    
    # Health condition multipliers
    if health_profile.has_asthma or health_profile.has_copd:
        base_risk *= 1.5
    if health_profile.has_heart_condition:
        base_risk *= 1.3
    if health_profile.is_child or health_profile.is_elderly:
        base_risk *= 1.2
    if health_profile.is_pregnant:
        base_risk *= 1.3
    
    # Age factor
    if health_profile.age < 12:
        base_risk *= 1.2
    elif health_profile.age > 65:
        base_risk *= 1.3
    
    return min(base_risk, 100)

@app.get("/")
def read_root():
    return {"status": "AirAware AI Service", "version": "1.0.0"}

@app.post("/analyze-health-risk")
def analyze_health_risk(request: RecommendationRequest):
    """
    Analyze health risk and provide personalized recommendations
    """
    try:
        risk_score = calculate_health_risk_score(
            request.air_quality,
            request.health_profile,
            request.intended_activity
        )
        
        aqi_category = get_aqi_category(request.air_quality.aqi)
        
        # Generate recommendations based on risk
        recommendations = generate_recommendations(
            risk_score,
            aqi_category,
            request.air_quality,
            request.health_profile,
            request.intended_activity,
            request.duration_minutes,
            request.location_type
        )
        
        # Calculate safe activity window
        safe_window = calculate_safe_window(
            request.air_quality,
            request.health_profile
        )
        
        return {
            "risk_score": round(risk_score, 1),
            "risk_level": get_risk_level(risk_score),
            "aqi_category": aqi_category,
            "recommendations": recommendations,
            "safe_activity_duration": safe_window,
            "requires_mask": should_wear_mask(risk_score, request.location_type),
            "air_purifier_recommended": should_use_purifier(request.air_quality, request.location_type)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

def generate_recommendations(
    risk_score: float,
    aqi_category: str,
    air_quality: AirQualityData,
    health_profile: HealthProfile,
    activity: ActivityType,
    duration: int,
    location_type: str
) -> List[Dict]:
    """
    Generate actionable health recommendations
    """
    recommendations = []
    
    # Primary recommendations based on risk
    if risk_score < 30:
        recommendations.append({
            "priority": "info",
            "action": "safe_to_proceed",
            "message": "Air quality is good. Safe for all activities.",
            "icon": "✅"
        })
    elif risk_score < 50:
        recommendations.append({
            "priority": "low",
            "action": "proceed_with_awareness",
            "message": "Air quality is acceptable. Sensitive individuals should consider reducing prolonged outdoor exertion.",
            "icon": "ℹ️"
        })
    elif risk_score < 70:
        recommendations.append({
            "priority": "medium",
            "action": "limit_outdoor",
            "message": "Air quality is unhealthy for sensitive groups. Consider limiting outdoor activities.",
            "icon": "⚠️"
        })
    else:
        recommendations.append({
            "priority": "high",
            "action": "avoid_outdoor",
            "message": "Air quality is unhealthy. Avoid outdoor activities. Stay indoors with air purification.",
            "icon": "🚫"
        })
    
    # Activity-specific recommendations
    if activity in [ActivityType.MODERATE_EXERCISE, ActivityType.INTENSE_EXERCISE]:
        if risk_score > 50:
            recommendations.append({
                "priority": "medium",
                "action": "modify_activity",
                "message": f"Consider indoor exercise or reduce intensity. Current conditions increase respiratory strain.",
                "icon": "🏃"
            })
    
    # Mask recommendations
    if risk_score > 60 and location_type == "outdoor":
        mask_type = "N95" if risk_score > 80 else "surgical mask"
        recommendations.append({
            "priority": "high" if risk_score > 80 else "medium",
            "action": "wear_mask",
            "message": f"Wear a {mask_type} when outdoors to reduce particulate exposure.",
            "icon": "😷"
        })
    
    # Indoor recommendations
    if location_type == "indoor":
        if air_quality.co2 and air_quality.co2 > 1000:
            recommendations.append({
                "priority": "medium",
                "action": "improve_ventilation",
                "message": "CO₂ levels are high. Open windows or improve ventilation.",
                "icon": "🪟"
            })
        
        if air_quality.pm25 > 35:
            recommendations.append({
                "priority": "high",
                "action": "use_air_purifier",
                "message": "Use an air purifier with HEPA filter to reduce indoor PM2.5.",
                "icon": "🌀"
            })
    
    # Health condition specific
    if health_profile.has_asthma and risk_score > 40:
        recommendations.append({
            "priority": "high",
            "action": "have_inhaler",
            "message": "Keep your rescue inhaler accessible. Monitor for symptoms.",
            "icon": "💊"
        })
    
    # Hydration reminder in poor air
    if risk_score > 50:
        recommendations.append({
            "priority": "low",
            "action": "stay_hydrated",
            "message": "Drink plenty of water to help your body cope with pollutants.",
            "icon": "💧"
        })
    
    return recommendations

def get_risk_level(risk_score: float) -> str:
    if risk_score < 30:
        return "low"
    elif risk_score < 50:
        return "moderate"
    elif risk_score < 70:
        return "high"
    else:
        return "very_high"

def calculate_safe_window(air_quality: AirQualityData, health_profile: HealthProfile) -> int:
    """
    Calculate safe outdoor activity duration in minutes
    """
    if air_quality.aqi < 50:
        return 240  # 4 hours
    elif air_quality.aqi < 100:
        return 120  # 2 hours
    elif air_quality.aqi < 150:
        if health_profile.sensitivity_level in [SensitivityLevel.HIGH, SensitivityLevel.VERY_HIGH]:
            return 30
        return 60
    elif air_quality.aqi < 200:
        return 30 if health_profile.sensitivity_level == SensitivityLevel.LOW else 15
    else:
        return 0  # Avoid outdoor activities

def should_wear_mask(risk_score: float, location_type: str) -> bool:
    return risk_score > 60 and location_type == "outdoor"

def should_use_purifier(air_quality: AirQualityData, location_type: str) -> bool:
    return location_type == "indoor" and (air_quality.pm25 > 35 or air_quality.aqi > 100)

@app.post("/forecast-aqi")
def forecast_aqi(request: ForecastRequest):
    """
    Predict future AQI using simple time-series analysis
    """
    try:
        if len(request.historical_data) < 24:
            return {"error": "Need at least 24 hours of historical data"}
        
        # Extract AQI values
        aqi_values = [reading["aqi"] for reading in request.historical_data[-168:]]  # Last week
        
        # Simple moving average forecast
        ma_24 = np.mean(aqi_values[-24:])
        ma_48 = np.mean(aqi_values[-48:]) if len(aqi_values) >= 48 else ma_24
        
        # Trend detection
        trend = ma_24 - ma_48
        
        # Generate hourly forecasts
        forecasts = []
        current_time = datetime.now()
        
        for hour in range(request.hours_ahead):
            future_time = current_time + timedelta(hours=hour)
            
            # Predict with trend and some variance
            predicted_aqi = ma_24 + (trend * hour / 24)
            
            # Add time-of-day pattern (pollution typically worse during rush hours)
            hour_of_day = future_time.hour
            if 7 <= hour_of_day <= 9 or 17 <= hour_of_day <= 19:
                predicted_aqi *= 1.15  # Rush hour increase
            elif 2 <= hour_of_day <= 5:
                predicted_aqi *= 0.90  # Early morning decrease
            
            predicted_aqi = max(0, min(500, predicted_aqi))  # Clamp to valid range
            
            forecasts.append({
                "timestamp": future_time.isoformat(),
                "predicted_aqi": round(predicted_aqi),
                "category": get_aqi_category(int(predicted_aqi)),
                "confidence": "medium"
            })
        
        # Find best time window for activities
        best_times = find_best_activity_times(forecasts)
        
        return {
            "location": request.location,
            "forecast_generated_at": current_time.isoformat(),
            "forecasts": forecasts,
            "trend": "improving" if trend < -5 else "worsening" if trend > 5 else "stable",
            "best_activity_times": best_times
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast error: {str(e)}")

def find_best_activity_times(forecasts: List[Dict]) -> List[Dict]:
    """
    Identify best time windows for outdoor activities
    """
    best_times = []
    
    for i, forecast in enumerate(forecasts):
        if forecast["predicted_aqi"] < 100:  # Good to moderate air
            best_times.append({
                "time": forecast["timestamp"],
                "aqi": forecast["predicted_aqi"],
                "suitable_for": "all_activities"
            })
        elif forecast["predicted_aqi"] < 150:
            best_times.append({
                "time": forecast["timestamp"],
                "aqi": forecast["predicted_aqi"],
                "suitable_for": "light_activities"
            })
    
    return best_times[:5]  # Return top 5 best times

@app.post("/calculate-exposure")
def calculate_exposure(
    aqi_history: List[int],
    duration_minutes: List[int],
    activity_levels: List[str]
):
    """
    Calculate cumulative pollution exposure over time
    """
    try:
        if len(aqi_history) != len(duration_minutes) or len(aqi_history) != len(activity_levels):
            raise HTTPException(400, "All arrays must have same length")
        
        # Activity breathing rate multipliers (liters per minute)
        breathing_rates = {
            "resting": 8,
            "light": 15,
            "moderate": 25,
            "intense": 40
        }
        
        total_exposure = 0
        weighted_exposure = 0
        
        for i in range(len(aqi_history)):
            aqi = aqi_history[i]
            duration = duration_minutes[i]
            activity = activity_levels[i]
            
            breathing_rate = breathing_rates.get(activity, 15)
            
            # Calculate exposure (AQI * time * breathing rate factor)
            exposure = aqi * duration * (breathing_rate / 15)
            total_exposure += exposure
            weighted_exposure += exposure * (aqi / 100)
        
        # Risk assessment
        risk_level = "low"
        if weighted_exposure > 15000:
            risk_level = "very_high"
        elif weighted_exposure > 10000:
            risk_level = "high"
        elif weighted_exposure > 5000:
            risk_level = "moderate"
        
        return {
            "total_exposure_score": round(total_exposure),
            "weighted_exposure": round(weighted_exposure),
            "risk_level": risk_level,
            "equivalent_hours_at_aqi_100": round(weighted_exposure / 100 / 60, 1),
            "recommendation": get_exposure_recommendation(risk_level)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Exposure calculation error: {str(e)}")

def get_exposure_recommendation(risk_level: str) -> str:
    recommendations = {
        "low": "Your exposure is within safe limits. Continue monitoring air quality.",
        "moderate": "Consider reducing time in polluted areas. Use air purification at home.",
        "high": "Your exposure is elevated. Limit outdoor activities and use protective measures.",
        "very_high": "Serious exposure detected. Seek cleaner air environments and consult healthcare provider if experiencing symptoms."
    }
    return recommendations[risk_level]

@app.post("/suggest-activities")
def suggest_activities(
    current_aqi: int,
    forecast_next_6h: List[int],
    user_preferences: List[str]
):
    """
    Suggest optimal outdoor activities based on air quality
    """
    try:
        suggestions = []
        
        # Activity suitability by AQI range
        activities_by_aqi = {
            (0, 50): ["running", "cycling", "outdoor_yoga", "hiking", "sports"],
            (51, 100): ["walking", "light_jogging", "outdoor_dining", "photography"],
            (101, 150): ["indoor_gym", "mall_walking", "indoor_swimming", "shopping"],
            (151, 500): ["indoor_yoga", "home_workout", "reading", "stay_indoors"]
        }
        
        # Find suitable activities for current conditions
        for aqi_range, activities in activities_by_aqi.items():
            if aqi_range[0] <= current_aqi <= aqi_range[1]:
                for activity in activities:
                    if activity in user_preferences or not user_preferences:
                        suggestions.append({
                            "activity": activity,
                            "current_suitability": "suitable" if current_aqi < 100 else "limited",
                            "recommendation": f"Air quality is {get_aqi_category(current_aqi)}"
                        })
                break
        
        # Find best time in next 6 hours
        best_hour = min(range(len(forecast_next_6h)), key=lambda i: forecast_next_6h[i])
        best_aqi = forecast_next_6h[best_hour]
        
        return {
            "current_aqi": current_aqi,
            "suggested_activities": suggestions[:5],
            "best_time_next_6h": {
                "hour": best_hour,
                "aqi": best_aqi,
                "message": f"Best air quality expected in {best_hour} hour(s)"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Activity suggestion error: {str(e)}")

@app.post("/pm25-to-aqi")
def convert_pm25_to_aqi(pm25: float):
    """
    Convert PM2.5 concentration to AQI using EPA formula
    """
    # EPA breakpoints for PM2.5 (24-hour average)
    breakpoints = [
        (0, 12.0, 0, 50),
        (12.1, 35.4, 51, 100),
        (35.5, 55.4, 101, 150),
        (55.5, 150.4, 151, 200),
        (150.5, 250.4, 201, 300),
        (250.5, 500.4, 301, 500)
    ]
    
    for bp_lo, bp_hi, aqi_lo, aqi_hi in breakpoints:
        if bp_lo <= pm25 <= bp_hi:
            aqi = ((aqi_hi - aqi_lo) / (bp_hi - bp_lo)) * (pm25 - bp_lo) + aqi_lo
            return {
                "pm25": pm25,
                "aqi": round(aqi),
                "category": get_aqi_category(round(aqi))
            }
    
    return {"pm25": pm25, "aqi": 500, "category": "hazardous"}

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "AirAware AI"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
