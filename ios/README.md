# Cappy iOS App Codebase

This directory contains the Swift/SwiftUI source code for the **Cappy** native iOS application.

## Directory Structure

* **[CappyApp.swift](Cappy/CappyApp.swift)**: Primary SwiftUI application entry point. Sets up root layout and registers background NFC Universal Link routing.
* **[DesignSystem/](Cappy/DesignSystem/)**: Contains [CappyDesignSystem.swift](Cappy/DesignSystem/CappyDesignSystem.swift) which defines brand colors, custom Nunito Sans and Inter fonts, reusable controls (`DoseStatusPill` and `ChildAvatar`), and custom view modifiers.
* **[Models/](Cappy/Models/)**: [Models.swift](Cappy/Models/Models.swift) structures data representations of children, medications, doses, and tags.
* **[Services/](Cappy/Services/)**: [NFCManager.swift](Cappy/Services/NFCManager.swift) wraps the Apple `CoreNFC` API for scanning NTAG215 stickers, and provides simulated tag triggers when run in the iOS Simulator.
* **[Views/](Cappy/Views/)**: Core SwiftUI screen layouts matching the Cappy templates:
  - [HomeDashboardView.swift](Cappy/Views/HomeDashboardView.swift): Main medication sync summary.
  - [NFCQuickAccessSheet.swift](Cappy/Views/NFCQuickAccessSheet.swift): Child selectors after NFC detection.
  - [DosingDashboardSheet.swift](Cappy/Views/DosingDashboardSheet.swift): Weight-based dosing calculator, caution banners, and log triggers.

## Setting Up in Xcode

To run and build this application on a physical device or simulator:

1. Open Xcode and create a new project: **File -> New -> Project...**
2. Choose **iOS -> App** template.
3. Set the project details:
   - Product Name: `Cappy`
   - Organization Identifier: `app.cappy`
   - Interface: `SwiftUI`
   - Language: `Swift`
4. Save the project inside the `/ios/` folder (naming the project `Cappy`).
5. Drag and drop the directories (`DesignSystem`, `Models`, `Services`, `Views`) and `CappyApp.swift` into the Xcode project navigator, replacing the default `ContentView.swift` and default app entry point.
6. **Enable Core NFC Capability:**
   - Select the `Cappy` project in the project navigator.
   - Go to **Signing & Capabilities**.
   - Click **+ Capability** and add **Near Field Communication Tag Reading**.
   - Under the Info tab, add the `Privacy - NFC Scan Usage Description` key with a description (e.g. *"Cappy scans NFC tags to log pediatric medication doses."*).
7. **Configure Universal Links:**
   - Under the Signing & Capabilities tab, add the **Associated Domains** capability.
   - Add the domain entry: `applinks:tap.cappy.app`.
