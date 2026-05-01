# ERP Backend — HTTP API Reference

Base URL (default): `http://localhost:5000` (override with `PORT` in `.env`).  
All paths below are relative to the server origin unless noted.

---

## Conventions

### Content type

- Most endpoints: **`Content-Type: application/json`** request and response.
- **PDF reports** (`/api/pdf-reports/*`): response is a **PDF binary** (`application/pdf`), not JSON.

### Success envelope

```json
{
  "success": true,
  "data": {},
  "message": "",
  "count": 0,
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

- `count` and `pagination` appear on **paginated list** responses (when applicable).
- `message` is always present (may be an empty string).

### Error envelope

```json
{
  "success": false,
  "data": {},
  "message": "Human-readable error",
  "errors": {}
}
```

- `errors` is included for **Zod validation** failures (flattened field errors) when applicable.
- Invalid JSON body → **400** with message `Invalid JSON body`.
- Invalid MongoDB ObjectId where applicable → **400** with message `Invalid id format`.

### Authentication

- **Private routes:** send  
  `Authorization: Bearer <jwt>`  
  The web app may also use the **`token` httpOnly cookie** set on login/register.
- **Public routes:** no header required (see Auth section).

### Pagination (lists)

Where supported, query parameters:

| Query   | Type   | Default | Max |
|---------|--------|---------|-----|
| `page`  | number | 1       | —   |
| `limit` | number | 10      | 100 |

### CORS

Server uses **reflect-any-origin** CORS (`origin: true`) with `credentials: true` for browser and mobile clients.

---

## Canonical path aliases (mobile)

These mount the **same routers** as the hyphenated `/api/*` names from `routeLoader`:

| Canonical path | Same as |
|----------------|---------|
| `GET/POST … /api/fabric/*` | `/api/fabric-lots/*` |
| `GET/POST … /api/lots/*` | `/api/piece-lots/*` |
| `GET/POST … /api/reject/*` | `/api/reject-management/*` |
| `GET/POST … /api/shipment/foreign/*` | `/api/foreign-shipments/*` |
| `GET/POST … /api/shipment/office/*` | `/api/office-dispatch/*` |
| `GET/PUT/PATCH … /api/settings/*` | `/api/system-settings/*` |

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health/` | No | Liveness check |

**Response:** `success`, `data.status` = `"ok"`, `message` = `"API Running"`.

---

## Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | No | Register first admin + business defaults (if registration enabled) |
| `POST` | `/api/auth/login` | No | Login |
| `GET` | `/api/auth/registration-status` | No | Whether public registration is enabled |
| `POST` | `/api/auth/logout` | Yes | Clear auth cookie |
| `GET` | `/api/auth/me` | Yes | Current user |
| `PATCH` | `/api/auth/profile` | Yes | Update own name/password |

### `POST /api/auth/register`

**Body (JSON):** `firstName`, `lastName`, `businessName`, `businessNumber`, `businessAddress`, `email`, `password` (required); `businessLogoUrl`, `organizationId` (optional).

**Response:** `data.token`, `data.user`, `message` (201).

### `POST /api/auth/login`

**Body:** `email`, `password`.

**Response:** `data.token`, `data.user`, `message`.

### `GET /api/auth/registration-status`

**Response:** `data.registrationEnabled` (boolean).

### `POST /api/auth/logout`

**Response:** `data` = `{}`, success message.

### `GET /api/auth/me`

**Response:** `data.user` (user object).

### `PATCH /api/auth/profile`

**Body:** optional `name`, `password` (min 6 chars if provided).

**Response:** `data.user`, `message`.

---

## Fabric lots

**Primary mount:** `/api/fabric-lots`  
**Alias:** `/api/fabric`

| Method | Path | Auth | Validation |
|--------|------|------|--------------|
| `GET` | `/` | Yes | List query + pagination |
| `POST` | `/` | Yes | Create body |
| `GET` | `/:id` | Yes | Id param |
| `PUT` | `/:id` | Yes | Body + id |
| `DELETE` | `/:id` | Yes | Id param |
| `POST` | `/:id/transfer-to-cutting` | Yes | Body + id |

### `POST /` create

**Body:** `fabricType` (string); `quantityKg` **or** `receivedKg` (number ≥ 0); optional `transferredKg`, `receiveDate`.

### `GET /` list

**Query:** `page`, `limit`.

**Response:** `data` = array of lots; `count` = total; `pagination`.

### `GET /:id`

**Response:** `data.lot`, `data.movementHistory`.

### `PUT /:id`

**Body:** at least one of: `fabricType`, `quantityKg`, `receivedKg`, `transferredKg`, `receiveDate`.

### `POST /:id/transfer-to-cutting`

**Body:** `quantityKg` (positive); optional `cuttingDate`, `operatorName`, `notes`.

---

## Piece lots

**Primary mount:** `/api/piece-lots`  
**Alias:** `/api/lots`

Router: **all routes** require auth.

| Method | Path | Auth | Validation |
|--------|------|------|--------------|
| `GET` | `/` | Yes | Query + pagination |
| `POST` | `/` | Yes | Create |
| `GET` | `/:id` | Yes | Id |
| `PUT` | `/:id` | Yes | Update |
| `DELETE` | `/:id` | Yes | Id |
| `POST` | `/:id/send-to-embroidery` | Yes | Body + id |

### `GET /` list

**Query:** `includeAuto` (boolean-ish); `page`, `limit`.

### `POST /` create

**Body:** `lotNumber`; optional `date`, `notes`.

### `PUT /:id`

**Body:** optional `lotNumber`, `date`, `notes`.

### `GET /:id`

**Response:** `data.lot`, `data.movementHistory`.

### `POST /:id/send-to-embroidery`

**Body:** `pieces` (positive number); optional `notes`, `date`.

---

## Cutting

**Mount:** `/api/cutting`

Router: **all routes** require auth.

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| `POST` | `/receive-transfer` | Yes | Zod body |
| `GET` | `/stock/current` | Yes | Pagination query |
| `GET` | `/stock/summary` | Yes | Summary + pagination query accepted |
| `GET` | `/batches/history` | Yes | Filters + pagination |
| `GET` | `/completed/summary` | Yes | Pagination on grouped result |
| `DELETE` | `/completed/by-fabric-type/:fabricType` | Yes | No Zod on route |
| `POST` | `/completed/:fabricType/send-to-lot` | Yes | Zod |
| `GET` | `/batches/:id` | Yes | Zod id |
| `POST` | `/batches/:id/complete-cutting` | Yes | Zod |
| `DELETE` | `/batches/:id` | Yes | Zod id |

### `POST /receive-transfer`

**Body:** `fabricLotId` (24-char hex id), `quantityKg` (positive); optional `transferDate`, `operatorName`, `notes`.

### `GET /stock/current`

**Query:** `page`, `limit`.

### `GET /batches/history`

**Query:** optional `operatorName`, `startDate`, `endDate`; `page`, `limit`.

**Response:** paginated grouped batch rows; `count` / `pagination`.

### `GET /batches/:id`

**Response:** `data.batch`, `data.movementHistory`, `data.conversionHistory`.

### `POST /batches/:id/complete-cutting`

**Body:** `convertedKg`, `outputPieces` (positive); optional `completionDate`, `notes`.

### `POST /completed/:fabricType/send-to-lot`

**Body:** `pieceLotId`, `pieces` (positive); optional `option`, `date`.

---

## Embroidery

**Mount:** `/api/embroidery`

Router: **all routes** require auth.

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/receive` | Yes |
| `POST` | `/reject` | Yes |
| `POST` | `/dispatch` | Yes |
| `POST` | `/factory-warehouse-transfer` | Yes |
| `DELETE` | `/factory-warehouse/:inventoryId` | Yes |
| `GET` | `/factory-warehouse/current` | Yes |
| `GET` | `/stock/current` | Yes |
| `GET` | `/stock/summary` | Yes |
| `GET` | `/stock/:lotId/details` | Yes |
| `PATCH` | `/stock/:lotId/archive` | Yes |
| `DELETE` | `/stock/:lotId` | Yes |
| `GET` | `/history` | Yes |

### Bodies (high level)

- **`/receive`:** `conversionId`, `pieces` (int); optional `date`, `operatorName`.
- **`/reject`:** `lotId`, `pieces`; optional `reason`, `date`, `operatorName`.
- **`/dispatch`:** `lotId`, `pieces`, `destination` (`office` | `export`); optional `date`, `operatorName`.
- **`/factory-warehouse-transfer`:** `lotId`, `pieces`, `grade` (`A Grade` \| `B Grade`); optional `notes`, `date`, `operatorName`.

### `GET /stock/current` & `GET /factory-warehouse/current`

**Query:** `page`, `limit`.

### `DELETE /factory-warehouse/:inventoryId`

Returns the current available quantity from factory balance back to embroidery stock for that lot.

### `GET /history`

**Query:** optional `lotId`, `actionType` (`receive_from_cutting` \| `reject` \| `send_to_office` \| `send_to_export` \| `send_to_factory_warehouse`); `page`, `limit`.

### `GET /stock/:lotId/details`

**Response:** `data.stock`, `data.history`.

### `PATCH /stock/:lotId/archive`

Soft archive for processed lots. History and transactions stay intact; archived lots are excluded from `GET /stock/current` and `GET /stock/summary`.

---

## Reject management

**Primary mount:** `/api/reject-management`  
**Alias:** `/api/reject`

Router: **all routes** require auth.

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/` | Yes |
| `GET` | `/` | Yes |
| `GET` | `/summary` | Yes |
| `DELETE` | `/:entryId` | Yes |

### `POST /`

**Body:** `lot` (id), `stage` (`cutting` \| `embroidery`), `quantity` (int), `reason`; optional `date`.

### `GET /`

**Query:** optional `lot`, `stage`, `startDate`, `endDate`; `page`, `limit`.

### `GET /summary`

**Query:** optional `startDate`, `endDate`.

---

## Foreign shipments (export)

**Primary mount:** `/api/foreign-shipments`  
**Alias:** `/api/shipment/foreign`

Router: **all routes** require auth.

| Method | Path | Auth | Validation |
|--------|------|------|--------------|
| `POST` | `/` | Yes | *(no Zod on route — validate server-side)* |
| `GET` | `/` | Yes | List query + pagination |
| `GET` | `/:id` | Yes | Id |
| `PATCH` | `/:id/status` | Yes | Body + id |
| `DELETE` | `/:id` | Yes | Id |

### `POST /` create

**Body (typical):** `country`, `shipmentNumber`, `lot` (ObjectId), `quantity` (int); optional `buyerName`, `buyerPhone`, `shipmentDate`, `status` (defaults `Packed`), `source` (`embroidery` \| `factory_warehouse`), `grade` (required if `source` = `factory_warehouse`).

### `GET /` list

**Query:** optional `country`, `status`; `page`, `limit`.

### `PATCH /:id/status`

**Body:** `status` — one of: `Packed`, `Dispatched`, `In Transit`, `Delivered`.

---

## Office dispatch

**Primary mount:** `/api/office-dispatch`  
**Alias:** `/api/shipment/office`

Router: **all routes** require auth.

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/` | Yes |
| `GET` | `/` | Yes |
| `GET` | `/:id` | Yes |
| `PATCH` | `/:id/status` | Yes |
| `DELETE` | `/:id` | Yes |

### `POST /` create

**Body:** `office`, `lot`, `quantity` (int), `referenceNo`; optional `dispatchDate`, `status` (`dispatched` \| `received` \| `cancelled`), `source` (`embroidery` \| `factory_warehouse`), `grade` (required if `source` = `factory_warehouse`).

### `GET /` list

**Query:** optional `office`, `status` (enum); `page`, `limit`.

### `PATCH /:id/status`

**Body:** `status` (`dispatched` \| `received` \| `cancelled`).

---

## Movement logs

**Mount:** `/api/movement-logs`

Router: **all routes** require auth.

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/` | Yes |
| `GET` | `/` | Yes |
| `GET` | `/:id` | Yes |

### `POST /`

**Body:** `fromStage`, `toStage`, `lot` (id), `quantity` (positive), `unit`, `user`; optional `date`.

### `GET /`

**Query:** optional `lot`, `fromStage`, `toStage`; `page`, `limit`.

---

## Analytics

**Mount:** `/api/analytics`

Router: **all routes** require auth.

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| `GET` | `/dashboard` | Yes | Aggregated dashboard |
| `GET` | `/quality-metrics` | Yes | Yield / reject metrics |
| `GET` | `/monthly-production` | Yes | Supports `page` / `limit` on **mapped** monthly rows |
| `GET` | `/shipment-totals` | Yes | Foreign shipment aggregates |
| `GET` | `/office-dispatch-totals` | Yes | Office dispatch aggregates |

---

## System settings

**Primary mount:** `/api/system-settings`  
**Alias:** `/api/settings`

| Method | Path | Auth | Role |
|--------|------|------|------|
| `GET` | `/` | Yes | Any authenticated |
| `PUT` | `/` | Yes | **Admin** |
| `PATCH` | `/registration` | Yes | **Admin** |

### `PUT /`

**Body:** optional `businessName`, `businessNumber`, `businessAddress`, `businessLogoUrl`, `registrationEnabled`.

### `PATCH /registration`

**Body:** `registrationEnabled` (boolean-ish).

---

## Users (admin)

**Mount:** `/api/users`

Router: **`protect` + `adminOnly`** on all routes.

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/` | Admin |
| `POST` | `/` | Admin |
| `PUT` | `/:id` | Admin |
| `PATCH` | `/:id/toggle-status` | Admin |
| `DELETE` | `/:id` | Admin |

### `GET /`

**Query:** `page`, `limit`.

### `POST /`

**Body:** `name`, `email`, `password`, `role`; optional `permissions`, `isActive`.

---

## PDF reports

**Mount:** `/api/pdf-reports`

Router: **all routes** require auth.

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/fabric-stock` | PDF |
| `GET` | `/lot-history` | PDF |
| `GET` | `/cutting` | PDF |
| `GET` | `/reject` | PDF |
| `GET` | `/shipment` | PDF |

Query parameters are defined in `pdfReportsController` (see source for each report).

---

## Cutting rejects

**Mount:** `/api/cutting-rejects`

Router: **all routes** require auth.

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/` | Yes |
| `GET` | `/inventory` | Yes |
| `GET` | `/history` | Yes |

### `POST /`

**Body:** `conversionId`, `rejectedPieces` (int), `reason`; optional `date`, `operatorName`.

### `GET /inventory` & `GET /history`

**Query:** `page`, `limit`; **`/history`** also optional `conversionId`, `lotId`.

---

## Cutting conversions

**Mount:** `/api/cutting-conversions`

Router: **all routes** require auth.

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/` | Yes |
| `GET` | `/` | Yes |
| `GET` | `/:id` | Yes |

### `POST /`

**Body:** `lotId`, `kg` (positive); **either** `ratioId` **or** `fabricType`; optional `date`.

### `GET /`

**Query:** optional `lotId`, `startDate`, `endDate`; `page`, `limit` (pagination applied **after** server-side filtering).

---

## Convert to pieces (ratios)

**Mount:** `/api/convert-to-pieces`

Router: **all routes** require auth.

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/ratios` | Yes |
| `GET` | `/ratios` | Yes |
| `GET` | `/ratios/:id` | Yes |
| `PUT` | `/ratios/:id` | Yes |
| `POST` | `/convert` | Yes |

### `POST /ratios`

**Body:** `name`, `piecesPerKg` (positive); optional `fabricType`, `isActive`, `isDefault`, `notes`.

### `GET /ratios`

**Query:** optional `isActive`, `fabricType`; `page`, `limit`.

### `POST /convert`

**Body:** `kg` (positive); **either** `ratioId` **or** `fabricType`.

---

## Quick reference — all base paths

| Prefix | Module |
|--------|--------|
| `/api/health` | Health |
| `/api/auth` | Authentication |
| `/api/fabric-lots` | Fabric lots (+ alias `/api/fabric`) |
| `/api/piece-lots` | Piece lots (+ alias `/api/lots`) |
| `/api/cutting` | Cutting |
| `/api/embroidery` | Embroidery |
| `/api/reject-management` | Reject management (+ alias `/api/reject`) |
| `/api/foreign-shipments` | Foreign shipments (+ alias `/api/shipment/foreign`) |
| `/api/office-dispatch` | Office dispatch (+ alias `/api/shipment/office`) |
| `/api/movement-logs` | Movement logs |
| `/api/analytics` | Analytics |
| `/api/system-settings` | System settings (+ alias `/api/settings`) |
| `/api/users` | Users (admin) |
| `/api/pdf-reports` | PDF downloads |
| `/api/cutting-rejects` | Cutting-stage rejects |
| `/api/cutting-conversions` | Cutting conversions |
| `/api/convert-to-pieces` | Conversion ratios + kg→pieces helper |

---

## Implementation pointers

- Route auto-loading: `src/utils/routeLoader.js` (files named `*.routes.js`).
- Canonical mounts: `src/bootstrap/canonicalApiMount.js`.
- Shared response helper: `src/utils/apiResponse.js`.
- Pagination helpers: `src/utils/pagination.js`.
- Zod pagination fields: `src/validations/pagination.validation.js`.
- JWT + roles: `src/middlewares/authMiddleware.js`, `src/config/rbac.js`.

For field-level validation rules, see the matching file under `src/validations/`.
