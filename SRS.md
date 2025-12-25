# Software Requirements Specification (SRS)  
**Project:** Mridulashray Web Platform  
**Date:** 22 Dec 2025  

---

## 1. Introduction

### 1.1 Purpose
This document captures the functional and non-functional requirements for the Mridulashray web platform. It is intended for stakeholders, designers, and developers who maintain the marketing site, public engagement flows, and the Appwrite-backed admin console.

### 1.2 Scope
The system is a responsive, multi-page website highlighting Mridulashray’s programs, collecting volunteer/contact submissions, showcasing events, and providing an Appwrite-administered CMS for events, volunteers, and contacts. Public pages are built with vanilla HTML/CSS/JS, while authenticated operations rely on Appwrite services for authentication, database, and storage.

### 1.3 Definitions, Acronyms, Abbreviations
- **Appwrite** – Backend-as-a-service providing auth, database, and storage.
- **Album** – Event entry with metadata, media assets, and publication status.
- **Volunteer Form** – Public form that posts to Appwrite collections with an email fallback.

### 1.4 References
- Marketing pages (Home, Volunteer, Events, Contact, Compliance, Terms, Payment)
- Volunteer onboarding flow
- Events gallery implementation
- Admin portal scripts (login and dashboard)
- Global styling definitions

### 1.5 Overview
Section 2 summarizes the product context, Section 3 enumerates system features, Section 4 covers external interfaces, and Sections 5–7 describe non-functional needs, data, and future considerations.

---

## 2. Overall Description

### 2.1 Product Perspective
The platform comprises:
1. **Public marketing site** delivered statically for core story and service information.
2. **Client-side integrations** for carousels, counters, and form submissions.
3. **Admin portal** under `/former/head/admin/` for managing event metadata, media, volunteers, and contact submissions through Appwrite APIs.

### 2.2 Product Functions
- Present organizational story, services, and impact metrics.
- Collect volunteer and contact enquiries with Appwrite persistence and an email fallback.
- Display events gallery, photo wall, and highlight modal sourced from Appwrite collections.
- Allow admins to authenticate, manage events, reorder/upload media, and review volunteer/contact tables.

### 2.3 User Classes and Characteristics
| User Class | Description | Capabilities |
|------------|-------------|--------------|
| **Public Visitors** | Prospective donors, volunteers, or community partners. | Browse pages, submit forms, view published events. |
| **Appwrite Admins** | Internal staff managing content. | Authenticate, manage event albums, volunteers, contacts, and media assets. |
| **System Integrators** | Developers maintaining the site/Appwrite config. | Update code, Appwrite configuration, and deployment artifacts. |

### 2.4 Operating Environment
- Frontend: Modern desktop/mobile browsers with ES6 support.
- Backend: Appwrite cloud endpoint (`https://sgp.cloud.appwrite.io/v1`) with defined project, database, and bucket IDs.
- Hosting: Static file hosting/CDN capable of serving HTML/CSS/JS assets.

### 2.5 Design and Implementation Constraints
- No server-side rendering; all operations are client-driven.
- Appwrite SDK must load before dependent scripts such as login, dashboard, and events pages.
- Anonymous public sessions required for read/write operations from public forms.
- Media uploads limited by Appwrite storage quotas and permissions.

### 2.6 Assumptions and Dependencies
- Appwrite credentials remain valid and are configured at deploy time.
- FormSubmit endpoint remains available as fallback for volunteer/contact submissions.
- Users possess stable internet connections for image-heavy galleries.

---

## 3. System Features

### 3.1 Public Marketing Pages
**Description:** Multi-section layouts communicating mission, services, and impact, including hero slider, service cards, stories, and calls-to-action.  
**Actors:** Public visitors.  
**Functional Requirements:**
1. FR-PUB-1: Display responsive navigation linking to key pages.
2. FR-PUB-2: Auto-rotate hero slides every 6 seconds with indicator controls.
3. FR-PUB-3: Provide CTA buttons to donation, volunteer, and contact pages.
4. FR-PUB-4: Expose service section anchors for footer quick links.

### 3.2 Volunteer Intake
**Description:** Form collecting name, email, location, interests, contribution notes, and phone number with consent checkbox.  
**Functional Requirements:**
1. FR-VOL-1: Validate required fields client-side before submission.
2. FR-VOL-2: Persist submissions to Appwrite `volunteers` collection via the shared form helper.
3. FR-VOL-3: Provide fallback email submission (FormSubmit) if Appwrite save fails.
4. FR-VOL-4: Display confirmation or error status to users through `.form-status`.

### 3.3 Events Gallery
**Description:** Dynamic gallery, photo wall, and highlight cards for event albums with modal viewer.  
**Functional Requirements:**
1. FR-EVT-1: Fetch event documents from Appwrite `events` collection ordered by `$updatedAt`.
2. FR-EVT-2: Filter to published events; fallback to all documents if none published.
3. FR-EVT-3: Aggregate counters for albums, photos, and impact statistics.
4. FR-EVT-4: Render media URLs via Appwrite storage preview endpoints.
5. FR-EVT-5: Support modal view with metadata, gallery grid, and accessibility attributes.

### 3.4 Admin Authentication
**Description:** Appwrite email/password login for authorized staff.  
**Functional Requirements:**
1. FR-ADM-1: Validate both email and password fields before submission.
2. FR-ADM-2: Create email session via `account.createEmailSession`.
3. FR-ADM-3: Store session metadata in `localStorage` (key `mridulashrayAdminSession`) for dashboard greeting.
4. FR-ADM-4: Redirect authenticated users directly to dashboard and unauthenticated ones to login.

### 3.5 Admin Dashboard – Events Management
**Description:** Single-page dashboard allowing CRUD on event metadata, media, and publish status.  
**Functional Requirements:**
1. FR-DBE-1: Require Appwrite session before revealing dashboard sections (`requireSession`).
2. FR-DBE-2: List events with title, slug, status, last updated date, media count, and action buttons.
3. FR-DBE-3: Support create/update of event metadata with validation on name, title, and description.
4. FR-DBE-4: Allow editing and deletion of events, including confirmation prompts for destructive actions.
5. FR-DBE-5: Provide album workspace for managing media uploads, edits, cover selection, and reordering with persistence to Appwrite storage/database.

### 3.6 Admin Dashboard – Volunteer & Contact Tables
**Description:** Data tables for Appwrite collections `volunteers` and `contactDetails`.  
**Functional Requirements:**
1. FR-DBV-1: Fetch documents ordered by `$createdAt` and render structured table rows.
2. FR-DBV-2: Provide refresh controls for volunteers and contacts.
3. FR-DBV-3: Link email fields using `mailto:` anchors.

---

## 4. External Interface Requirements

### 4.1 User Interface
- Consistent header/nav/footer across pages with responsive layout.
- Forms use labelled inputs, placeholders, and helper text to support accessibility.
- Admin dashboard uses tabbed sections, tables, and modals for media management; styling centralised in `styles.css`.

### 4.2 Hardware Interface
No dedicated hardware dependencies beyond standard user devices (desktop, tablet, mobile).

### 4.3 Software Interface
- **Appwrite SDK:** Loaded from CDN and used for authentication, database, and storage APIs.
- **FormSubmit:** HTTP POST endpoint for email notifications when Appwrite persistence fails.

### 4.4 Communications Interface
- HTTPS requests to Appwrite endpoint for CRUD operations.
- Browser-native navigation and anchor scrolls for intra-page linking.

---

## 5. Non-Functional Requirements

1. **Performance:** Public pages must remain interactive under typical broadband/mobile connections; sliders and counters should initialize within 2 seconds after DOM ready. Events gallery should degrade gracefully when Appwrite is unavailable.
2. **Scalability:** Appwrite collections should accommodate hundreds of events and thousands of volunteer/contact entries without code changes.
3. **Security:** 
   - Enforce authenticated Appwrite sessions for admin dashboard actions.
   - Use least-privilege permissions on uploaded files, granting read to public and edit/delete to uploader.
   - Do not expose Appwrite API keys client-side; rely on project-level configuration.
4. **Reliability:** Volunteer/contact submissions must either store in Appwrite or email fallback to avoid data loss.
5. **Maintainability:** Configuration centralized in `appwrite-config.js`; new collections/buckets must be added there and referenced in scripts.
6. **Usability:** Layouts must be responsive with accessible labels, alt text, and keyboard-supportive components (e.g., modal close buttons).

---

## 6. Data Requirements

| Entity | Source Collection | Key Fields | Notes |
|--------|-------------------|------------|-------|
| **Events** | `events` | `slug`, `name`, `title`, `description`, `date`, `status`, `mediaEntries`, `mediaFileIds`, `coverFileId`, `impactCount`, timestamps | `mediaEntries` stored as JSON array string. |
| **Volunteer Submissions** | `volunteers` | `name`, `email`, `phone`, `location`, `interest`, `message`, `submittedAt`, `$createdAt` | Captured from volunteer form with `source` metadata. |
| **Contact Requests** | `contactDetails` | `name`, `email`, `phone`, `message`, `$createdAt` | Rendered in admin contacts table. |
| **Media Files** | Storage bucket `69419d0a000e78807ded` | `fileId`, `filename`, `type`, `uploadedAt`, `title`, `description` | Permissions include public read and owner edit/delete. |

All date/time fields use ISO 8601 strings.

---

## 7. Other Requirements

### 7.1 Risk Assessment
1. **Appwrite Connectivity Failure:** Mitigated via polling for SDK load and anonymous session retries.
2. **Media Storage Limits:** Need monitoring; deletion workflows remove associated storage files to conserve quotas.
3. **Unauthorized Access:** `requireSession` and logout flows ensure only authenticated users operate the dashboard.

### 7.2 Future Enhancements
1. Implement server-side email notifications for new volunteer/contact submissions.
2. Add pagination or search for large volunteer/contact datasets.
3. Introduce role-based permissions for multi-admin setups.
4. Provide analytics dashboards showing event engagement metrics.

---

## 8. Appendices
- **Appendix A:** Sitemap – Home, Volunteer, Events, Contact, Compliance, Terms, Payment, Admin Login, Admin Dashboard.
- **Appendix B:** Third-party dependencies – Appwrite SDK, FormSubmit, Google Fonts (Playfair Display, Poppins).

---

*End of Document*
