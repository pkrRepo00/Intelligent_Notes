## 2024-05-31 - PII & Internal Details Leak in Error Handlers
**Vulnerability:** The global `handleFirestoreError` function was extracting the user's email address and internal stack trace/details and throwing them directly into a JSON-stringified error message that bubbled up to the client interface.
**Learning:** Returning serialized error objects verbatim or including unnecessary details (like the user's email in backend-bound operations) can accidentally expose PII or inner workings. The user ID is sufficient for debugging access issues without revealing their email.
**Prevention:** Only log necessary identifiers (like `userId`). Ensure that error responses or exceptions bubbled up to the UI are generic (e.g., `An error occurred during the [operation]`).
