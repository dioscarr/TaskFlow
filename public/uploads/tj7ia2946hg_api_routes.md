## API Routes

- `POST /credit_score`: Calculate credit score for a given applicant.
  - Request body: `applicant_data` (JSON)
  - Response: `credit_score` (integer), `explainability_insights` (JSON)

- `GET /credit_score/{applicant_id}`: Retrieve credit score and insights for a specific applicant.
  - Response: `credit_score` (integer), `explainability_insights` (JSON)

- `GET /model_performance`: Retrieve model performance metrics.
  - Response: `metrics` (JSON)

- `POST /feedback`: Submit user feedback on credit score accuracy.
  - Request body: `applicant_id` (integer), `feedback` (string)

- `GET /data_sources`: Retrieve a list of integrated data sources.
  - Response: `data_sources` (JSON array)