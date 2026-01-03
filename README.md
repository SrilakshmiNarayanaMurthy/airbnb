# LAB2 — Distributed Airbnb-Style App (Microservices • Kafka • MySQL/MongoDB • Optional AI)

A **end-to-end Airbnb-like platform** built to demonstrate how **multiple distributed services** work together in a realistic product flow.

It includes:
- **React/Vite Frontend** for travelers + property owners
- **Node.js/Express Backend API** with **MySQL** (listings/bookings) + **MongoDB** (users/sessions)
- **Kafka event streaming** for booking updates (traveler ↔ owner flows)
- **Optional AI Concierge** service (**FastAPI + LangChain**) that can read booking data
- **Docker Compose** (quick local run) + **Kubernetes manifests** (cluster run)

---

## 🌟 What you can do (feature highlights)

### Traveler experience
- Create an account, log in, and remain signed in via **secure session cookies**
- Browse listings and filter by **city, dates, guests**
- Book a stay (backend validates availability, calculates pricing)
- View **upcoming trips** and **booking history**
- Add/remove favorites (if enabled)

### Owner experience
- Create listings (stored in **MySQL**)
- Receive booking updates via **Kafka events**
- Access owner tools / management screens (if enabled)

### AI concierge (optional)
- Ask for recommendations (e.g., “suggest stays in SF under $200”)
- Ask for booking summaries or help understanding trips
- Works only if you run `ai-agent/` and configure keys (if required)

---

## 🗺️ Repo map (where things live)

---

## 🧠 Architecture (how services talk)

### Request flow (normal)
1. **Frontend** calls the **Backend API** via REST (JSON/HTTP)
2. Backend validates, applies business rules, then reads/writes data:
   - **MySQL** → listings, bookings, blackout/availability
   - **MongoDB** → users + sessions (keeps you logged in)
3. Backend responds to frontend with JSON → UI updates

### Event flow (Kafka)
When a booking is created:
1. Backend writes booking to **MySQL**
2. Backend publishes a Kafka event on topic **`bookings`**
3. Owner-side consumer group processes/receives the booking event
4. Status changes can be published to **`booking-status`** for traveler updates

### Optional AI flow
1. Frontend sends user question to **AI Agent**
2. AI Agent reads MySQL (and optionally calls tools/LLMs) to produce a response
3. Frontend displays the AI answer

---

## 🧩 System diagram 





Quick Start (Recommended): Docker Compose
Prerequisites

Docker + Docker Compose

Run everything
docker compose up --build

Default ports

Frontend: http://localhost:3000

Backend: http://localhost:4000

AI agent: http://localhost:8001 (optional)

MySQL: localhost:3306

MongoDB: localhost:27017

Kafka: localhost:9092

ZooKeeper: localhost:2181

If a port is busy, edit docker-compose.yml and update your .env values.




🔐 Environment Variables
Frontend (frontend/.env)
VITE_API_URL=http://localhost:4000
VITE_AI_AGENT_URL=http://localhost:8001


Backend (backend/.env)
PORT=4000

# MySQL
DB_HOST=localhost
DB_USER=root
DB_PASS=password
DB_NAME=airbnb

# MongoDB
MONGO_URL=mongodb://localhost:27017/airbnb

# Kafka
KAFKA_BROKERS=localhost:9092

# Sessions / Security
SESSION_SECRET=replace_this_with_a_strong_secret

# CORS
FRONTEND_ORIGINS=http://localhost:3000



AI Agent (ai-agent/.env) — optional
# Use either a URI or split credentials depending on your implementation
MYSQL_URI=mysql://root:password@localhost:3306/airbnb

# Optional external keys (only if your agent uses them)
OPENAI_API_KEY=
TAVILY_API_KEY=



🏃 Run Manually (Dev Mode)
1) Backend
cd backend
npm install
npm run dev


Backend: http://localhost:4000

2) Frontend
cd frontend
npm install
npm run dev -- --host --port 3000


Frontend: http://localhost:3000

3) AI Agent (optional)
cd ai-agent
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload


AI agent: http://localhost:8001



🔌 Key backend routes (Express)
Health

GET / → “Backend is running”

Auth

POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
Listings
GET /api/listings (filters: city, start, end, guests)
GET /api/listings/:id
POST /api/listings (owner only)

Bookings

POST /api/bookings
✅ checks availability
✅ calculates total price
✅ emits Kafka event (bookings)

GET /api/bookings/my
GET /api/bookings/history
Static uploads
GET /uploads/* serves images from backend/uploads/
For exact route behavior, see the route files in backend/ and table definitions in backend/sql-schema.js.




🗄️ Storage & Messaging (clear separation)
MySQL (Primary transactional data)

Used for:

Listings
Bookings
Blackout dates / availability
MongoDB (Identity + session persistence)

Used for:

User accounts
Session store (keeps you logged in across requests)

Kafka (Event-driven coordination)

Topics:

bookings — produced on booking creation, consumed by owner flows
booking-status — produced on owner status changes, consumed by traveler flows

Why Kafka here?

It decouples “booking created” from “owner receives updates”
Multiple services can subscribe to the same event stream without tightly coupling code


Apply manifests (update images/env for your cluster):

kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
kubectl apply -f k8s/kafka.yaml


You will still need to provide:

MySQL + Mongo endpoints (or deploy them as StatefulSets)
ConfigMaps/Secrets for environment variables

🧪 Load Testing (JMeter)

Plan: FinalLabreport.jmx
Result logs: Finalresults.jtl, login_results.jtl

Dashboards: summary-report*/index.html

Suggested steps:

Bring stack up (Docker or manual)
Run the JMeter test plan
Compare latency + throughput across scenarios




🗣️ How it works 
The user opens the React app and logs in.
Login sessions are stored in MongoDB, so the user stays signed in.
The user searches listings; the backend reads listings from MySQL.
When a booking is made, the backend checks availability and writes the booking into MySQL.
Immediately after writing, the backend emits a Kafka event so owner-side flows can react.
Owner updates can publish a booking-status event so traveler views stay consistent.
Optionally, the AI agent can read the booking data and provide recommendations or summaries.


🧯 Troubleshooting
CORS issues

Ensure FRONTEND_ORIGINS=http://localhost:3000
Restart backend after changing .env
Reset local databases

If you want a clean slate:
Stop stack
Remove Docker volumes for MySQL/Mongo
Restart compose

Secrets safety
Never commit real keys
Use .env and rotate secrets for production
