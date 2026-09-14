# kth-grades Ladok Connector (browser extension)

Fully automatic: just log in to `student.ladok.se` as normal. The extension
finds (or navigates to, and back from) the *Studieresultat* page on its own,
reads the already-rendered grades, and pushes them to the kth-grades app in
the background — no button to click, no password, cookie, or session token
ever touches this extension or the app. A small toast in the bottom-right
corner confirms once it's done.

## Install (Chrome/Edge, unpacked)

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this `extension/` folder
4. Log in to Ladok at https://www.student.ladok.se

The app tab (kth-grades.github.io or your local dev server) is opened or
updated automatically in the background and imports the courses; open it
whenever you like to see the result.
