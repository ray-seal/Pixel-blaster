# Pixel Blaster — Privacy Policy

Effective date: 2025-10-17

Thank you for playing Pixel Blaster. Your privacy matters. This Privacy Policy explains what information the Pixel Blaster game (the "Game") collects, how it is used, how it is stored, your choices, and how you can contact us.

If you have questions about this policy or need assistance, you can:
- Open an issue in the game's GitHub repository: https://github.com/ray-seal/Pixel-blaster
- Email: privacy@ray-seal.dev (placeholder — replace with your preferred contact)

---

## 1. Scope

This policy applies to personal data and other information collected when you play the Game delivered from the Pixel Blaster web application (index.html + client scripts). The Game is developed and maintained by the repository owner (GitHub login: ray-seal).

---

## 2. Information We Collect

We collect two types of information: information you provide directly and information we collect automatically.

### 2.1 Information You Provide
- High score submission name: When you submit a global high score, the Game collects the name you enter (typically three characters) together with the score and distance. These values may be sent to a hosted backend (see Third-Party Services below).
- Other in-game input: If you interact with shop or perk selection UIs, any data you actively type into forms or share may be stored locally or submitted to services if you choose to do so.

### 2.2 Information Collected Automatically
- Local game state stored in your browser via localStorage:
  - `coins` — player's locally saved coins.
  - `highScore` — player's local high score.
  - `globalHighScores` — cached global high scores (if any).
  - `queuedScores` — high scores queued for later submission when offline.
  - Any other settings or temporary caches created by the Game stored in localStorage.
- Gameplay metrics in memory (distance, score, enemies defeated) used only locally to run the game and to render the HUD unless you submit a high score.
- Technical data necessary to run the Game (device/browser type, screen size) which may be visible in server logs when communicating with backend services.

---

## 3. How We Use Information

We use the data we collect to:
- Provide and maintain the Game experience (run the game, save progress such as coins and local high scores).
- Store and display local settings and game state so your play carries across sessions.
- Submit and retrieve global high scores if you choose to submit them to the game's online leaderboard.
- Improve the Game (bug fixes, feature improvements); if analytics are added in the future we will disclose them.

We do not sell your personal data.

---

## 4. Third-Party Services

The Game may use third-party services for leaderboards and backend storage:
- Supabase (or similar service): The repository contains code that attempts to send global high score entries to a Supabase database (see SUPABASE_URL in game.js). If you submit a high score while online, your high-score entry (name, score, distance, timestamp) may be transmitted to and stored by that service.
- CDN libraries: The Game may load client libraries (for example the Supabase JS library) from public CDNs.

Third-party providers have their own privacy policies; we recommend you review them. We are not responsible for their practices.

---

## 5. Local Storage & Offline Behavior

The Game stores data locally using the browser's localStorage API. This includes coins, cached high scores, and queued scores (key names listed in Section 2.2). If you clear your browser storage or uninstall/reset the browser profile, locally stored data will be removed.

When you submit a high score while offline, the Game saves it to `queuedScores` and will attempt to sync when your device reconnects.

---

## 6. Sharing & Disclosure

We will not share your personal data for marketing or advertising. We may disclose information:
- To the third-party services you choose to use (e.g., leaderboard services).
- As required by law or to protect rights, property, safety, or the rights of others.
- In aggregated or anonymized form (e.g., aggregated usage statistics) which cannot reasonably identify an individual.

---

## 7. Data Retention

- Local data (coins, cached scores): retained on your device until you clear browser storage, uninstall data, or the application code explicitly removes it.
- Server-side high-score entries: retention depends on the third-party service (e.g., Supabase). If you want a server-side entry removed, see Contact & Deletion Requests below.

---

## 8. Your Rights and Choices

Depending on your jurisdiction (e.g., GDPR in the EU, CCPA in California), you may have rights with respect to your personal data:
- Access: request a copy of data we hold about you.
- Correction: ask us to correct inaccurate data.
- Deletion: request deletion of personal data (for server-side deletion, contact us; for local data, clear your browser storage).
- Portability: obtain a copy of your data in a machine-readable format where applicable.
- Opt-out: if we enable analytics or optional tracking in the future, you may opt out.

To exercise your rights, contact us via the contact options at the top of this policy. We will respond as required by applicable law.

---

## 9. Security

We use reasonable technical and administrative measures to protect data in transit and at rest. However, no method of transmission over the Internet or electronic storage is 100% secure. If you believe your data has been compromised, contact us immediately.

---

## 10. Children's Privacy

The Game is not intended for children under 13 (or the minimum age in your jurisdiction). We do not knowingly collect personal data from children under the applicable minimum age. If you are a parent or guardian and believe we have collected personal information from a child under the minimum age, please contact us to request deletion.

---

## 11. International Transfers

If data is transmitted to or stored by third-party providers outside your country, those transfers may be subject to cross-border transfer rules. By using the Game you consent to such transfers as necessary to operate services such as leaderboards.

---

## 12. Changes to This Policy

We may update this policy from time to time. When we do, we will update the Effective date at the top. Continued use of the Game after changes indicates acceptance of any revised Policy.

---

## 13. Contact & Deletion Requests

For questions, complaints, or to request deletion of server-side records (e.g., global high scores):
- Open an issue in the repository: https://github.com/ray-seal/Pixel-blaster
- Email: privacy@ray-seal.dev (replace with official contact address if you have one)

When requesting deletion of server records, please include the high-score name, score, and date if available to help us locate the record.

---

## 14. Legal Basis (GDPR)

If you are in the EU, our legal basis for processing personal data is:
- Consent for optional features (e.g., leaderboards if they require you to submit a name).
- Legitimate interests for running and improving the Game and storing non-identifying local state.

---

Thank you for playing Pixel Blaster. We aim to respect your privacy and keep your data safe.
