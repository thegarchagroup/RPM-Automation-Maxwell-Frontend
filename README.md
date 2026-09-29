# The Maxwell - Preventive Maintenance Inspection System

A standalone, client-side web application for conducting Preventive Maintenance Inspections at The Maxwell hotel properties.

## Features

- **100% Client-Side**: No backend or external database required. Operates offline and locally with persistent `localStorage`.
- **Fast Authentication**: 1-click demo logins (Inspector, Supervisor, Admin) or custom email login.
- **Full Checklist Form**: All Sections A through K (Doors, Bedroom, Bathroom, Toilet Accessories, Handicapp Room, Closet/Wardrobe, Timber Flooring/Skirting, Stones, Partition Wall, Ceiling, Artwork) with 3-way toggles (Pass / Fail / N/A), defect remarks, and quick tags.
- **Digital Signatures**: Canvas drawing pad and image upload selector with persistent local storage.
- **In-Browser Official PDF Generation**: Download print-ready, official Maxwell inspection PDF reports with one click via `jspdf` & `jspdf-autotable`.
- **Direct Print**: Print-optimized stylesheet for immediate hard-copy printing.

## Running Locally

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.
