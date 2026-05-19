# CLAUDE.md - Oxlet Auto Dashboard

## Project Overview
Oxlet Auto Dashboard เป็นระบบ CRM Dashboard สำหรับบริษัท Oxlet Auto (เต๊นท์รถยนต์มือสอง) ใช้ติดตาม Lead, Booking, Sales Pipeline, Live Activity และ Performance ของพนักงานขาย (seller) แต่ละคน

แปลงมาจาก single-file HTML → Next.js 14 App Router + Google Sheets API (Service Account)

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3 + CSS custom properties (globals.css)
- **Data source**: Google Sheets API via `google-auth-library` + native fetch
- **Auth method**: Service Account (`n8n-sheets@sylvan-road-477705-q4.iam.gserviceaccount.com`)
- **Deploy target**: Vercel
- **User auth**: Magic Link → cookie-based session

## Project Structure
```
oxlet-dashboard/
├── app/
│   ├── layout.tsx          # Root layout (lang="th")
│   ├── page.tsx            # Redirect to /dashboard
│   ├── globals.css         # All CSS (~800 lines, light/dark mode via CSS vars)
│   ├── dashboard/
│   │   └── page.tsx        # Main dashboard (client component, ~1200 lines)
│   ├── api/
│   │   ├── dashboard/route.ts  # GET: fetch all 6 sheets → DashboardData JSON
│   │   ├── auth/route.ts       # GET: verify token → employee data
│   │   ├── leads/route.ts      # (deprecated, redirects to /api/dashboard)
│   │   └── bookings/route.ts   # (deprecated, redirects to /api/dashboard)
│   └── u/[token]/
│       └── page.tsx        # Magic link auth entry
├── lib/
│   ├── google-sheets.ts    # Sheet config, column maps, auth, fetchSheet(), fetchAllSheets()
│   ├── auth.ts             # Cookie get/set/clear, isAdmin()
│   ├── types.ts            # TS interfaces: DashboardData, SellerData, FollowCase, BookingCase, etc.
│   ├── constants.ts        # UPD_TGT=4, LIVE_TGT=4, PAGE_SIZE=15, STATUS_COLOR, TEAM_COLORS
│   ├── helpers.ts          # pct, nc, urg, dots, urgBadge, parseNoteHistory, inRange
│   ├── fetch-dashboard.ts  # Transform Google Sheets rows → DashboardData (server-side)
│   ├── use-dashboard.ts    # React hook: auth, fetch /api/dashboard, filter, impersonate
│   └── supabase.ts         # (legacy, no longer used)
├── public/image/           # Logo image
├── .env.local              # GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
└── package.json
```

## Google Sheets (6 sheets, 4 files)
| Mapping | Sheet File | Tab Name | Spreadsheet ID |
|---------|-----------|----------|----------------|
| leads | ชีทจ่ายเบอร์ ปี69 | รวม sheet | `1s9FFPRV53U7pQTnBGSlkSFL8ygmRGRGYOAG1HakzgA0` |
| sales_reports | รายงานฝ่ายขาย สาขาบ้านเก่า 68 | รวม sheet | `13_vFkHEZWRAzxZiJ1Uj-NPlzlZtptyXuIjdxkGqlg8Y` |
| bookings | นับลีด | รวม sheet | `13jiQTOvcCvlKLGvjrb348_iRWoiMpumqqeEgOTkTgB0` |
| live_sessions | Sheet Master | รวม sheet | `18Djos3lUJnoZ00gYEBuCCExwm1YknfIQrP-TIuUgjWU` |
| live_followups | Sheet Master | ติดตามไลฟ์สด | `18Djos3lUJnoZ00gYEBuCCExwm1YknfIQrP-TIuUgjWU` |
| employees | chatbot | เก็บข้อมูลพนักงาน กลุ่ม หลัก | `1HOhrPSIFTxfOpc4UWvKb-LfMuXGYW2vYkR5vbGzPd_A` |

### Key Column Mappings (defined in `lib/google-sheets.ts`)
- **leads** (38 cols): ว/ด/ป, เบอร์โทร, เวลา, Code, เซลล์, ช่องทาง, type, รถลูกค้าถาม, จำนวนอัพเดท, PROFILE ลูกค้า, สถานะ, Status แอดมิน, อัพเดทเคส(1-3), Final ของเซลล์
- **sales_reports** (28 cols): ชื่อเซลล์, วันที่, LD/SD โค้ด, ชื่อ-นามสกุล, รายละเอียดรถ, ทะเบียน, ราคาขาย, เงินจอง, สถานะ, ไฟแนนซ์หลัก, วันที่ปล่อยรถ
- **bookings** (14 cols): DATE, เซลล์, ยอดจอง, CODE, TYPE, CAR, ทะเบียน, ชื่อลูกค้า
- **live_sessions** (15 cols): วันที่, เวลา, ผู้ไลฟ์ 1-5, หัวข้อ, INBOX, LEAD
- **live_followups**: ชื่อ, วันที่ลงคลิป
- **employees**: userId, displayName, ชื่อเล่น, ตำแหน่งงาน

## Key Data Flow
1. Client (`use-dashboard.ts`) → calls `GET /api/dashboard`
2. API route → calls `fetchDashboardData()` (server-side)
3. `fetch-dashboard.ts` → calls `fetchAllSheets()` from `google-sheets.ts`
4. `google-sheets.ts` → authenticates via Service Account → fetches 6 Google Sheets in parallel
5. Raw rows (string arrays) → transformed to `DashboardData` with column index maps
6. Client receives JSON → applies role-based filtering → renders 4 tabs

## Auth & Roles
- **Magic Link**: `/u/[token]` → calls `/api/auth?token=...` → looks up `employees.userId` → sets cookie `oxlet_employee`
- **Admin**: `position === "admin"` → sees all data, can impersonate sellers
- **Seller**: sees only own data (filtered by `nickname`)
- **DEV MODE**: if no cookie, defaults to admin (for dev testing)

## Dashboard Tabs
1. **Overview (o)**: KPI summary, pipeline, team cards, seller table, hot cases, follow cases
2. **Activity (a)**: Live sessions, clip tracking, per-host stats
3. **Booking (b)**: Booking cards with status pipeline, case details
4. **Seller (s)**: Individual seller deep-dive, lead breakdown

## Business Logic Notes
- **Timezone**: All date calculations use `Asia/Bangkok` timezone
- **Date format**: Google Sheets uses `d/m/yy` Thai format → `parseDate()` handles conversion
- **Month filter**: Data filtered to current month by default
- **Urgency scoring**: Based on `updateCount` vs `UPD_TGT` (4 updates required)
- **Pipeline statuses**: จอง → รอเซ็นต์ → รอผล → รอปล่อย → ปล่อย (หรือ รีเจ็ก)
- **Team mapping**: Derived from `employees.ตำแหน่งงาน` field (team_a, team_b, team_c, admin)
- **Target calculation**: Default ~8% of leads count per seller
- **Clip target**: 4 clips/month per seller

## CSS Architecture
- CSS custom properties for light/dark mode (auto via `prefers-color-scheme`)
- All styles in `globals.css` — migrated exactly from original HTML
- Key classes: `.card`, `.kpi`, `.pipe-row`, `.team-card`, `.srow`, `.hlrow`, `.booking-card`, `.cd-kpi-grid`
- Responsive breakpoint at 640px

## Environment Variables
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=n8n-sheets@sylvan-road-477705-q4.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Commands
```bash
npm run dev     # Start dev server
npm run build   # Production build
npm run start   # Start production server
npm run lint    # ESLint
```

## Important Caveats
- `dashboard/page.tsx` uses `dangerouslySetInnerHTML` for `dots()` and `urgBadge()` helper output
- All UI text is in Thai
- `localStorage` is used for admin impersonation state (`oxlet_impersonate`)
- Google Sheets API runs server-side only (API route) — credentials never exposed to client
- `lib/supabase.ts` is legacy and no longer used (can be deleted)
- Service Account email must be shared as Viewer on all Google Sheets files
