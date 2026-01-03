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

# Airbnb Lab Stack

Distributed Airbnb-style lab with an Express + MySQL core, Mongo-backed auth/sessions, Kafka for booking events, a Socket.IO channel for real-time owner/traveler updates, a Vite/React UI, and a FastAPI + LangChain concierge agent. Everything is runnable locally via Docker Compose; AWS and Kubernetes manifests are included for cloud runs.

## Services and Responsibilities
- `backend` (Node/Express): REST API for auth, listings, bookings, favorites, owner actions. Uses MySQL for primary data, MongoDB for users/sessions, Kafka (via `kafkajs`) for booking/status events, and Socket.IO for push updates.
- `frontend` (Vite/React + Redux Toolkit): Traveler/owner UI that calls the backend API and subscribes to Socket.IO notifications. Built image served via Nginx (`frontend/Dockerfile`).
- `ai-agent` (FastAPI): `/ai/concierge` endpoint that builds travel plans with OpenAI (LangChain), optional Tavily live lookups, and logs requests/responses into MySQL (`agent_logs`).
- Data planes: MySQL 8 for transactional data; MongoDB for users/sessions; Kafka + Zookeeper for event streaming; Kafka UI for inspection.
- Infra: Root `docker-compose.yml` for local/dev, `aws/` for EC2 + ECR deployment, `k8s/` for Kubernetes manifests, `jmeter/` for load scripts.

## Runtime Architecture (happy path)
1. **Auth & sessions**: Mongo-backed `express-session` cookies issued by backend; JWTs are minted for Socket.IO auth (`utils/jwt`). Allowed origins are governed by `FRONTEND_ORIGINS` and `COOKIE_*` envs.
2. **Listings & bookings (SQL)**: Listings, blackout windows, photos, favorites, and bookings live in MySQL (`sql-schema.js` initializes tables; `scripts/seed-db.js` ensures schema on boot).
3. **Eventing (Kafka)**: Creating a booking publishes to `booking_created`; owner actions publish to `booking_status`. Consumers in `Kafka/bookingConsumer.js` and `Kafka/bookingStatusConsumer.js` push changes to rooms like `user:{id}` and `role:owner` over Socket.IO.
4. **AI concierge**: `POST /ai/concierge` accepts a booking + preferences JSON body, enriches with Tavily context (if `TAVILY_API_KEY` is set), asks the LLM (model default `gpt-4o-mini`), enforces JSON-only output, and inserts the full request/response into MySQL for audit.
5. **Frontend data flow**: `src/api.js` hits REST endpoints; `src/socket.js` joins rooms using the JWT from the login response; screens include Listings, MyTrips, Profile, and owner flows.

## Local Development
### With Docker Compose (recommended)
```bash
# From repo root
cp .env.example .env  # create if you need overrides; see env matrix below
docker compose up -d
```
- Containers: MySQL (`3306`), MongoDB (`27017`), Kafka/Zookeeper, backend (`4000`), frontend (`80`), AI agent (`8001`), Kafka UI (`8080`).
- The `seed-db` job runs once to ensure MySQL schema. Backend and agent mount local source by default for hot reload; comment volumes in `docker-compose.yml` for production-like builds.
- Health checks gate service startup for MySQL/Mongo where defined.

### Running services manually
- Backend: `cd backend && npm install && npm run dev` (requires MySQL, MongoDB, Kafka reachable; env vars below).
- Frontend: `cd frontend && npm install && npm run dev -- --host --port 5173` (set `VITE_API_URL` and `VITE_WS_URL`).
- AI agent: `cd ai-agent && pip install -r requirements.txt && uvicorn main:app --reload --port 8001`.

## Configuration (key env vars)
- Backend: `PORT` (default 4000), `DB_HOST/DB_USER/DB_PASS/DB_NAME`, `MONGO_URL`, `KAFKA_BROKERS`, `JWT_SECRET`, `SESSION_SECRET`, `FRONTEND_ORIGINS`, `NODE_ENV`, `COOKIE_SECURE`, `COOKIE_SAMESITE`.
- Frontend build args: `VITE_API_URL` (REST base), `VITE_WS_URL` (Socket.IO base).
- AI agent: `OPENAI_API_KEY`, `TAVILY_API_KEY` (optional live context), `MYSQL_URI` or `MYSQL_HOST/USER/PASSWORD/DB`.
- Compose/AWS overrides: see root `docker-compose.yml` and `aws/.env` template inside `aws/README.md`.

## Data Model Highlights
- MySQL tables: `listings`, `bookings`, `listing_blackouts`, `listing_photos`, `favorites`, plus `agent_logs` for AI calls. Schema creation is centralized in `backend/sql-schema.js` (also documented in `backend/SCHEMA.md`).
- Mongo collections: `users`, `sessions` (from `connect-mongo`), plus legacy `listings`/`bookings` for backwards compatibility.
- Kafka topics: `booking_created` (traveler-side producer) and `booking_status` (owner-side producer). Messages include booking id, listing id, user id, dates, status, and emit Socket.IO broadcasts on consume.

## API Surface (pointers)
- Auth/profile: `backend/routes/auth.js` -> `/api/auth/*` (register/login/me/profile/avatar/logout).
- Listings: `backend/routes/listings-sql.js` -> `/api/listings` (search/detail/create).
- Bookings & favorites: `backend/routes/bookings.js`, `backend/routes/favorites.js`.
- Owner workflows: `backend/routes/owners.js` (listing CRUD, blackout management, booking approvals).
- AI concierge: `ai-agent` -> `POST /ai/concierge` (see `ConciergeRequest` models in `ai-agent/main.py`).
- Full request/response and schema reference lives in `backend/SCHEMA.md`.

## Operations and Deployments
- **AWS**: `aws/cloudformation-ec2-docker.yaml` provisions an EC2 host with Docker; `aws/build-and-push.sh` builds/pushes images to ECR; `aws/docker-compose.yml` + `.env` boot the stack on the instance. Follow `aws/README.md`.
- **Kubernetes**: Manifests in `k8s/` for backend/frontend deployments and services plus `kafka.yaml` (Zookeeper + Kafka). Adjust images/env and apply with `kubectl apply -f`.
- **Load testing**: `jmeter/FinalLabreport.jmx` drives booking/listing flows; `results.jtl` captures sample outputs. Tailor endpoints/threads before running.
- **Troubleshooting**: Use `docker compose logs -f <service>`, inspect Kafka topics via Kafka UI (`:8080`), and check MySQL/Mongo connectivity before debugging app code.

## Quick Service URLs (default compose)
- Frontend: `http://localhost`
- Backend API: `http://localhost:4000`
- AI agent: `http://localhost:8001`
- Kafka UI: `http://localhost:8080`

## Helpful Files
- `docker-compose.yml`: Local orchestrator (all services).
- `backend/SCHEMA.md`: Detailed DB schema + endpoint table.
- `backend/scripts/seed-db.js`: One-shot schema/seed initializer.
- `frontend/src/*`: React screens, API client, Socket.IO wiring.
- `ai-agent/main.py`: FastAPI entrypoint, LLM prompt builder, MySQL logger.

