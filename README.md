#  AirAware - Environmental Health Monitoring Platform

[![React Native](https://img.shields.io/badge/React_Native-61DAFB?style=flat&logo=react&logoColor=black)](https://reactnative.dev/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![TimescaleDB](https://img.shields.io/badge/TimescaleDB-FDB515?style=flat&logo=timescale&logoColor=black)](https://www.timescale.com/)
[![MQTT](https://img.shields.io/badge/MQTT-660066?style=flat&logo=mqtt&logoColor=white)](https://mqtt.org/)

A comprehensive IoT-powered platform that empowers users to monitor environmental air quality in real-time, receive AI-driven health recommendations, and make informed decisions about outdoor activities. Integrates with sensors, external APIs, and community data to provide hyperlocal air quality insights.

---

##  Key Features

### Real-Time Monitoring
- **Multi-Pollutant Tracking** - PM2.5, PM10, CO₂, O₃, NO₂, temperature, humidity
- **Live AQI Updates** - EPA standard Air Quality Index with color-coded categories
- **IoT Integration** - Support for external sensors via MQTT protocol
- **API Aggregation** - Combines OpenWeatherMap, AirNow, and community data

### AI Health Intelligence
- **Personalized Risk Assessment** - Calculates health risk based on user profile (age, conditions, sensitivity)
- **Activity Recommendations** - Suggests when to exercise outdoors, wear masks, use air purifiers
- **Exposure Tracking** - Cumulative pollution exposure calculation over time
- **Predictive Forecasting** - 24-hour AQI predictions with best activity windows

### Community Features
- **Pollution Mapping** - Real-time heatmap of air quality across your city
- **Crowdsourced Data** - Users contribute readings from personal devices
- **Alert System** - Push notifications for poor air quality events
- **Impact Tracking** - See your clean air exposure and carbon footprint

### Mobile-First Design
- **React Native** - Native iOS and Android apps
- **Offline Support** - Cached data and sensor readings work offline
- **Location Services** - Automatic location detection and nearby sensor discovery
- **Dark Mode** - Eye-friendly interface for all conditions

---

##  Architecture

```
┌─────────────────────────────┐
│  React Native Mobile App    │
│  - Real-time Dashboard      │
│  - Interactive Maps         │
│  - Health Recommendations   │
│  - Activity Planner         │
└──────────┬──────────────────┘
           │ REST + WebSocket
┌──────────▼──────────────────┐
│   Node.js API Server        │
│  - MQTT Broker              │
│  - Real-time Streaming      │
│  - Alert Engine             │
│  - Geolocation Services     │
└───┬──────────────────┬──────┘
    │                  │
    ▼                  ▼
┌────────────┐   ┌─────────────────┐
│ Databases  │   │  Python AI      │
│            │   │  Service        │
│- TimescaleDB│  │ - Risk Analysis │
│- MongoDB   │   │ - Forecasting   │
│- Redis     │   │ - Recommendations│
└────┬───────┘   └─────────────────┘
     │
     ▼
┌─────────────────────┐
│  Data Sources       │
│  - IoT Sensors      │
│  - OpenWeatherMap   │
│  - AirNow API       │
│  - Community Reports│
└─────────────────────┘
```

---

##  Tech Stack

### Mobile App
- **React Native 0.72** - Cross-platform mobile development
- **TypeScript** - Type safety
- **React Navigation** - Screen navigation
- **Mapbox GL** - Interactive pollution maps
- **React Native Geolocation** - Location services

### Backend
- **Node.js + Express** - REST API
- **Socket.io** - Real-time WebSocket communication
- **MQTT.js** - IoT sensor protocol
- **TimescaleDB** - Time-series air quality data
- **MongoDB** - User profiles and metadata
- **Redis** - Real-time caching and pub/sub

### AI Service
- **Python 3.10** + FastAPI
- **NumPy/Pandas** - Data processing
- **Scikit-learn** - Forecasting models
- **Custom Algorithms** - Health risk scoring

### IoT & APIs
- **MQTT Protocol** - Sensor communication
- **OpenWeatherMap API** - Weather and pollution data
- **AirNow API** - Official EPA air quality data

---

##  Getting Started

### Prerequisites
```bash
node >= 18.0.0
python >= 3.10
postgresql >= 14 (with TimescaleDB extension)
mongodb >= 5.0
redis >= 6.0
react-native-cli
```

### Installation

**1. Clone Repository**
```bash
git clone https://github.com/yourusername/airaware.git
cd airaware
```

**2. Backend Setup**
```bash
cd backend
npm install
cp .env.example .env
# Configure environment variables
npm run dev
```

**3. TimescaleDB Setup**
```bash
# Install TimescaleDB extension
psql -U postgres -c "CREATE DATABASE airaware;"
psql -U postgres -d airaware -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"

# Run schema
psql -U postgres -d airaware < database/timescale_schema.sql
```

**4. AI Service Setup**
```bash
cd ai_service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**5. Mobile App Setup**
```bash
cd mobile
npm install
npx pod-install  # iOS only

# Android
npx react-native run-android

# iOS
npx react-native run-ios
```

### Environment Variables

**Backend (.env)**
```env
# Databases
MONGODB_URI=mongodb://localhost:27017/airaware
TIMESCALE_URI=postgresql://postgres:password@localhost:5432/airaware
REDIS_URL=redis://localhost:6379

# MQTT
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=airaware
MQTT_PASSWORD=secure_password

# External APIs
OPENWEATHER_API_KEY=your_api_key
AIRNOW_API_KEY=your_api_key

# AI Service
AI_SERVICE_URL=http://localhost:8000

# Server
PORT=3000
JWT_SECRET=your_jwt_secret
```

**Mobile App (.env)**
```env
API_URL=http://localhost:3000/api
WS_URL=ws://localhost:3000
MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

---

##  Data Flow

### Sensor Reading Pipeline
```
IoT Sensor → MQTT Publish → Node.js MQTT Client → 
TimescaleDB Insert → WebSocket Broadcast → 
Mobile App Update → AI Analysis → 
Health Recommendation
```

### User Query Flow
```
Mobile App Request → REST API → 
TimescaleDB Query (Hypertable) → 
Aggregate Historical Data → 
Send to AI Service → 
Generate Forecast → 
Return to User
```

---

## 🧠 AI Health Risk Model

### Risk Score Calculation
```python
base_risk = AQI / 5  # 0-100 scale

# Activity multiplier
activity_multipliers = {
    "resting": 1.0,
    "light": 1.3,
    "moderate": 1.8,
    "intense": 2.5
}

# Sensitivity multiplier
sensitivity_multipliers = {
    "low": 0.8,
    "moderate": 1.0,
    "high": 1.4,
    "very_high": 1.8
}

# Health condition adjustments
if has_asthma: base_risk *= 1.5
if is_elderly: base_risk *= 1.3

final_risk = min(base_risk * activity * sensitivity, 100)
```

### AQI Categories
| AQI | Category | Health Impact |
|-----|----------|---------------|
| 0-50 | Good | Safe for everyone |
| 51-100 | Moderate | Acceptable for most |
| 101-150 | Unhealthy (Sensitive) | Sensitive groups affected |
| 151-200 | Unhealthy | Everyone may experience effects |
| 201-300 | Very Unhealthy | Health alert |
| 301-500 | Hazardous | Emergency conditions |

---

##  Mobile App Screens

### Dashboard
- Large AQI display with color coding
- Current pollutant levels (PM2.5, CO₂, etc.)
- Health risk score and recommendations
- 6-hour forecast timeline
- Weekly exposure trend

### Map View
- Real-time pollution heatmap
- Nearby sensor locations
- Community reports overlay
- "Find clean air" navigation

### Activity Planner
- Best times for outdoor activities
- Personalized suggestions
- Calendar integration
- Weather correlation

### Profile & Settings
- Health profile setup
- Sensitivity level
- Notification preferences
- Device management

---

##  IoT Sensor Integration

### MQTT Topics
```
airaware/sensors/{device_id}/data     # Sensor readings
airaware/sensors/{device_id}/status   # Device status
airaware/sensors/{device_id}/config   # Configuration
airaware/alerts/{user_id}             # User alerts
```

### Sensor Data Format
```json
{
  "device_id": "sensor_001",
  "timestamp": "2025-10-01T14:30:00Z",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "readings": {
    "pm25": 35.2,
    "pm10": 48.5,
    "co2": 420,
    "temperature": 22.5,
    "humidity": 65,
    "pressure": 1013.25
  }
}
```

### Supported Sensors
- **PurpleAir** - Community PM2.5 sensors
- **Awair** - Indoor air quality monitors
- **uHoo** - Multi-pollutant monitors
- **DIY Sensors** - Raspberry Pi + SDS011 PM sensor
- **Mobile App** - Phone sensors (basic measurements)

---

##  External API Integration

### OpenWeatherMap Air Pollution API
```typescript
// Fetch current air quality
GET http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={key}

// Response includes: PM2.5, PM10, NO2, O3, SO2, CO
```

### AirNow API (EPA Official Data)
```typescript
// Get current AQI by ZIP code
GET https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode={zip}&API_KEY={key}
```

### Fallback Strategy
1. Try local sensor data (most accurate)
2. Fall back to community data nearby
3. Use OpenWeatherMap API
4. Use AirNow API
5. Return cached data with timestamp

---

##  Time-Series Optimization

### TimescaleDB Hypertables
```sql
-- Automatic partitioning by time
SELECT create_hypertable('air_quality_readings', 'timestamp');

-- Continuous aggregates for fast queries
CREATE MATERIALIZED VIEW air_quality_hourly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', timestamp) AS hour,
    AVG(pm25) as avg_pm25,
    AVG(aqi) as avg_aqi
FROM air_quality_readings
GROUP BY hour;
```

### Data Retention
- **Raw readings**: 90 days
- **Hourly aggregates**: 1 year
- **Daily aggregates**: Forever

### Query Performance
- **Current reading**: <10ms
- **24-hour history**: <50ms
- **Weekly trend**: <100ms
- **Map data (100 points)**: <200ms

---

##  Alert System

### Alert Types
1. **High Pollution Alert** - AQI exceeds user threshold
2. **Activity Warning** - Scheduled outdoor activity during poor air
3. **Sensitive Group Alert** - AQI in unhealthy range
4. **Trend Alert** - Air quality worsening rapidly
5. **Location Alert** - Poor air detected at saved location

### Alert Delivery
- Push notifications (Firebase/APNs)
- SMS (Twilio integration)
- Email summaries
- In-app notifications

### Smart Alerts
```javascript
// Only alert if:
- AQI change is significant (>20 points)
- User is likely outdoors (location activity)
- Not during quiet hours (user preference)
- Not duplicate alert within 2 hours
```

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test

# Test coverage
npm run test:coverage
```

### AI Service Tests
```bash
cd ai_service
pytest
pytest --cov=main
```

### Mobile App Tests
```bash
cd mobile
npm test

# E2E tests with Detox
npm run test:e2e:ios
npm run test:e2e:android
```

---

##  Deployment

### Docker Compose (Development)
```bash
docker-compose up -d
```

### Production Deployment

**Backend & Databases**
- **Railway** or **Render** ($15-20/month)
- TimescaleDB on **Timescale Cloud** (free tier available)
- MongoDB on **MongoDB Atlas** (free tier)
- Redis on **Upstash** (free tier)

**AI Service**
- **Render** or **Railway** ($5-10/month)
- Auto-scaling for high demand

**Mobile Apps**
- iOS: **App Store** (Apple Developer $99/year)
- Android: **Google Play** ($25 one-time)

**MQTT Broker**
- **HiveMQ Cloud** (free tier)
- **CloudMQTT** (free tier)

---

## 🎯 Use Cases

### Individual Users
- Monitor air quality at home
- Plan outdoor exercises safely
- Track exposure for health conditions
- Receive personalized recommendations

### Parents
- Protect children from pollution
- Safe outdoor play scheduling
- School air quality monitoring
- Asthma trigger awareness

### Athletes
- Optimize training schedules
- Performance impact analysis
- Race day air quality planning
- Recovery optimization

### Urban Planners
- Pollution hotspot identification
- Traffic impact assessment
- Green space effectiveness
- Policy impact measurement

---

##  Future Roadmap

### Phase 1: Enhanced Monitoring (4 weeks)
- [ ] Apple Watch integration
- [ ] Wearable sensor support
- [ ] Voice assistant integration (Alexa, Google Home)
- [ ] Widget for home screen

### Phase 2: Social Features (6 weeks)
- [ ] Share air quality updates
- [ ] Community challenges
- [ ] Leaderboards for clean air exposure
- [ ] Group activity planning

### Phase 3: Advanced AI (8 weeks)
- [ ] Machine learning forecasting (LSTM)
- [ ] Pollen and allergen tracking
- [ ] Wildfire smoke prediction
- [ ] Indoor vs outdoor recommendations

### Phase 4: Enterprise (12 weeks)
- [ ] Corporate wellness programs
- [ ] School air quality monitoring
- [ ] Building management integration
- [ ] API for third-party apps

---

##  What I Learned

Building AirAware taught me:
- **Time-Series Databases** - Optimizing TimescaleDB for sensor data
- **IoT Protocols** - MQTT pub/sub architecture
- **Real-Time Systems** - WebSocket streaming and caching
- **Mobile Development** - React Native cross-platform apps
- **Geospatial Queries** - Location-based data retrieval
- **Health Data** - Understanding air quality impacts
- **External APIs** - Integrating multiple data sources

---

##  Contributing

Contributions welcome! Areas we need help:
- Sensor driver development
- ML model improvements
- UI/UX enhancements
- Documentation
- Translations

---

## 📝 License

MIT License - see LICENSE file for details.

---

##  Author

**Your Name**

- LinkedIn: [linkedin.com/in/yourprofile](https://linkedin.com/in/yourprofile)

---

## Acknowledgments

- **EPA AirNow** - Official air quality data
- **OpenWeatherMap** - Weather and pollution APIs
- **PurpleAir** - Community sensor network
- **TimescaleDB** - Time-series database platform

---

**Built with love to make air quality data accessible and actionable for everyone**

---

## Project Statistics

| Metric | Value |
|--------|-------|
| Lines of Code | ~15,000 |
| API Endpoints | 25+ |
| Supported Pollutants | 7 |
| Database Tables | 6 (TimescaleDB) + 6 (MongoDB) |
| AI Models | 3 (Risk, Forecast, Activity) |
| External APIs | 3 |
| Mobile Screens | 12 |
| Real-time Updates | <1s latency |

---

## Design Philosophy

**Mobile-First** - Designed for on-the-go air quality checks  
**Data-Driven** - Every recommendation backed by science  
**Privacy-Focused** - User data encrypted and anonymized  
**Community-Powered** - Crowdsourced data improves accuracy  
**Accessible** - Easy to understand AQI and recommendations  

---

## 📖 Related Resources

- [EPA Air Quality Guide](https://www.airnow.gov/aqi/aqi-basics/)
- [WHO Air Quality Guidelines](https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health)
- [Understanding PM2.5](https://www.epa.gov/pm-pollution)
- [TimescaleDB Documentation](https://docs.timescale.com/)
- [MQTT Protocol Spec](https://mqtt.org/mqtt-specification/)

---

##  Troubleshooting

### Common Issues

**"No data available"**
- Check internet connection
- Verify API keys are configured
- Enable location permissions
- Check if in supported region

**"Sensor not connecting"**
- Verify MQTT broker URL
- Check device credentials
- Ensure firewall allows MQTT (port 1883)
- Restart MQTT client

**"App crashes on launch"**
- Clear app cache
- Update to latest version
- Check device compatibility
- Review crash logs

### Getting Help
- Check [Issues](https://github.com/yourusername/airaware/issues)
- Join [Discord Community](https://discord.gg/airaware)
- Email: support@airaware.app

---

**Stay Healthy. Breathe Better. 🌬️💚**
