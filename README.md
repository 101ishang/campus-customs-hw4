# Campus Customs (HW4)

This repository contains a React/Vite/TypeScript storefront and a FastAPI/PydanticAI shopping assistant. The application reads its product catalogue, size inventory, and signed-in chat history from a local SQLite database. Product images and the real database are a **local-only data pack** and are intentionally absent from Git.

## Place the local data pack

Before running the app, put the supplied files at these paths relative to this `hw4/` folder:

```text
hw4/
└── data/
    ├── campus_customs.db
    └── products/
        └── ... product JPG files referenced by the database ...
```

The `data/` directory is ignored by Git. The frontend catalogue export checks that every image referenced in SQLite exists, and the build imports those files. Without this pack, the product catalogue and image pages cannot be rebuilt. Do not upload the pack to GitHub.

## Setup

Use Python 3.11+ and a recent Node.js release. From `hw4/`:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example backend/.env
cd frontend
npm ci
```

Fill in `PORTKEY_API_KEY` in `backend/.env` locally. The provided file contains placeholders only; the filled file is ignored. `PORTKEY_MODEL` defaults to `gpt-4o-mini` through Portkey's OpenAI-compatible endpoint. Set `PORTKEY_VIRTUAL_KEY` if your workspace uses one, or use `PORTKEY_PROVIDER` (default `openai`). The key is read only by the backend and must never be put in a `VITE_` variable.

## Run the storefront and APIs

The easiest way is from `hw4/frontend/`:

```sh
npm run dev
```

The predev step exports public catalogue data from SQLite. The launcher starts the FastAPI chat service on `127.0.0.1:8000` with `backend/` as the Uvicorn working directory, the separate authentication service on `127.0.0.1:8001`, and Vite on `127.0.0.1:5173`. Open the URL Vite prints. Vite proxies `/api/auth` and `/api/chat` to the respective APIs.

To run each service in a separate terminal instead, start them from these directories after setup:

```sh
# Terminal 1, from hw4/
.venv/bin/python backend/auth_server.py

# Terminal 2, from hw4/backend/
../.venv/bin/python -m uvicorn main:app --reload --port 8000

# Terminal 3, from hw4/frontend/
npm run sync:catalogue
npm exec vite -- --host 127.0.0.1
```

The chat API exposes `GET /health`, `POST /api/chat`, and `GET /api/chat/history`. Signed-in sessions come from the auth service. The agent uses read-only catalogue tools, and `output/audit_trail.json` retains bounded run/tool summaries across runs. See [output/harness.md](output/harness.md) for model fields, safety rules, limits, data flow, and result caps. The checkout page is a preview and does not collect payment or place orders.

The assignment's FastAPI command is `uvicorn main:app --reload --port 8000` when run from `hw4/backend/`. The colon and `--port` must have no spaces inside them for the command to work. Run the auth service on port 8001 as shown above so the two services do not compete for port 8000.

## Checks

From `hw4/frontend/`, run `npm run build` to type-check and build the app with the local data pack present. From `hw4/`, run `.venv/bin/python -m compileall -q backend` to check the Python modules. The captured app checks and screenshots are in [output/app_check.html](output/app_check.html).
