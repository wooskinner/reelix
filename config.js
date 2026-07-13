match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if false; // Only Cloudflare Worker (Admin SDK) should write here
}
