# Simple Firebase Functions App

A minimal Firebase Functions project with React frontend.

## Project Info

- **Firebase Project:** ag-survey-staging-3
- **Backend:** Firebase Functions (Node.js)
- **Frontend:** React + Vite
- **Database:** Firestore

## Structure

```
packages/
├── functions/          # Backend (Firebase Functions)
│   ├── src/
│   │   └── index.js   # Simple API endpoint
│   └── .env.example   # Environment variables template
└── assets/            # Frontend (React)
    ├── src/
    │   ├── App.js           # Main React component
    │   ├── main.js          # Entry point
    │   └── config/
    │       └── firebase.js  # Firebase config
    └── .env             # Environment variables (Firebase config)
```

## Setup

### 1. Install dependencies
```bash
yarn install
```

### 2. Firebase Setup

**Get Service Account (for backend):**
1. Go to [Firebase Console](https://console.firebase.google.com/) → ag-survey-staging-3
2. Project Settings → Service Accounts
3. Click "Generate New Private Key"
4. Save as `serviceAccount.development.json` in project root

**Environment variables are already configured:**
- Frontend: `packages/assets/.env`
- Backend: `packages/functions/.env.example`

### 3. Start Development

```bash
# Terminal 1 - Backend (Firebase Emulators)
yarn emulators

# Terminal 2 - Frontend (Vite dev server)
yarn dev
```

**URLs:**
- Frontend: http://localhost:5173 (Vite)
- Backend API: http://localhost:5000/api
- Firebase Emulator UI: http://localhost:4000

## TodoList API

### Get All Todos
```bash
curl http://localhost:5000/api/todos
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "title": "Learn Firebase",
      "description": "Complete the tutorial",
      "completed": false,
      "createdAt": "2025-02-05T13:00:00.000Z"
    }
  ]
}
```

### Create Todo
```bash
curl -X POST http://localhost:5000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "New Task", "description": "Task details"}'
```

### Update Todo
```bash
curl -X PUT http://localhost:5000/api/todos/abc123 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

### Delete Todo
```bash
curl -X DELETE http://localhost:5000/api/todos/abc123
```

## Deployment

```bash
# Deploy everything
yarn deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only hosting
firebase deploy --only hosting
```

## Tech Stack

- **Backend:** Firebase Functions v2 (Node.js)
- **Frontend:** React 18 + Vite
- **Database:** Firestore
- **Hosting:** Firebase Hosting
