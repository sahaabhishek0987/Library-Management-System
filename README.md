# 🏛️ Bibliotheca — Library Management System

A full-stack Library Management System built with **Node.js**, **Express**, and **MongoDB**. Supports two user roles (Admin and Issuer), book and member management, borrowing/returning workflows, fine calculation, and JWT-based authentication with account lockout protection.

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Seeding the Database](#seeding-the-database)
- [API Reference](#api-reference)
- [Authentication & Roles](#authentication--roles)
- [Data Models](#data-models)
- [Business Rules](#business-rules)

---

## ✨ Features

- **JWT Authentication** with 8-hour session tokens
- **Account lockout** after 5 failed login attempts (15-minute lock)
- **Role-based access control** — Admin and Issuer roles with granular permissions
- **Book management** — add, update, delete, search, filter by category/status
- **Member management** — register, update, suspend, track borrow history
- **Borrow/return workflow** with automatic availability tracking
- **Fine calculation** — ₹5 per day overdue, with fine payment endpoint
- **Pagination and sorting** across all list endpoints
- **Auto-generated IDs** — member IDs (`LIB01001`) and employee IDs (`ADM1001`, `ISS1001`)
- **Serves a static frontend** from the `public/` directory

---

## 🛠️ Tech Stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Runtime    | Node.js                                 |
| Framework  | Express 4.x                             |
| Database   | MongoDB with Mongoose 8.x               |
| Auth       | JSON Web Tokens (`jsonwebtoken`)        |
| Passwords  | bcryptjs (salt rounds: 12)              |
| Logging    | Morgan                                  |
| Dev server | Nodemon                                 |

---

## 📁 Project Structure

```
library-management-system/
├── server.js                  # Entry point, Express app setup
├── seed.js                    # Database seeding script
├── package.json
├── models/
│   ├── User.js                # Admin & Issuer accounts
│   ├── Book.js                # Book catalogue
│   ├── Member.js              # Library members
│   └── Transaction.js         # Borrow/return records
├── routes/
│   ├── auth.js                # Login, profile, issuer management
│   ├── books.js               # Book CRUD
│   ├── members.js             # Member CRUD
│   └── transactions.js        # Borrow, return, fine payment
├── middleware/
│   └── auth.js                # JWT verification, role & permission guards
└── public/
    └── index.html             # Frontend (served statically)
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- MongoDB (local or Atlas)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd library-management-system

# Install dependencies
npm install

# (Optional) Copy and configure environment variables
cp .env.example .env
```

### Running the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server starts at **http://localhost:5000** by default.

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/library_management
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=8h
```

| Variable        | Default                                          | Description                      |
|-----------------|--------------------------------------------------|----------------------------------|
| `PORT`          | `5000`                                           | HTTP server port                 |
| `MONGODB_URI`   | `mongodb://localhost:27017/library_management`   | MongoDB connection string        |
| `JWT_SECRET`    | `bibliotheca_super_secret_jwt_key_2024`          | JWT signing secret               |
| `JWT_EXPIRES_IN`| `8h`                                             | Token expiry duration            |

> **Note:** Always set a strong `JWT_SECRET` in production.

---

## 🌱 Seeding the Database

Populate the database with sample books, members, and default accounts:

```bash
npm run seed
```

This creates:

| Role   | Username  | Password    |
|--------|-----------|-------------|
| Admin  | `admin`   | `admin_password`  |
| Issuer | `issuer1` | `issuer123` |

It also inserts **10 sample books** across categories (Fiction, Science, Technology, History, etc.) and **5 sample members**.

> ⚠️ The seed script **clears all existing data** before inserting. Do not run it in production.

---

## 📡 API Reference

All endpoints are prefixed with `/api`. All routes except `POST /api/auth/login` require a `Bearer` token in the `Authorization` header.

### Auth — `/api/auth`

| Method | Endpoint                          | Access       | Description                          |
|--------|-----------------------------------|--------------|--------------------------------------|
| POST   | `/login`                          | Public       | Login and receive JWT                |
| GET    | `/me`                             | Authenticated| Get current user profile             |
| PUT    | `/change-password`                | Authenticated| Change own password                  |
| GET    | `/issuers`                        | Admin only   | List all issuer accounts             |
| POST   | `/issuers`                        | Admin only   | Create a new issuer account          |
| PUT    | `/issuers/:id`                    | Admin only   | Update issuer account                |
| DELETE | `/issuers/:id`                    | Admin only   | Delete issuer account                |
| PUT    | `/issuers/:id/reset-password`     | Admin only   | Reset an issuer's password           |

**Login request:**
```json
POST /api/auth/login
{
  "username": "admin",
  "password": "admin_password"
}
```

**Login response:**
```json
{
  "success": true,
  "token": "<jwt>",
  "user": { "id": "...", "username": "admin", "role": "admin", ... }
}
```

---

### Books — `/api/books`

| Method | Endpoint      | Permission      | Description                            |
|--------|---------------|-----------------|----------------------------------------|
| GET    | `/`           | Authenticated   | List books (search, filter, paginate)  |
| GET    | `/stats`      | Authenticated   | Book statistics by category            |
| GET    | `/:id`        | Authenticated   | Get a single book                      |
| POST   | `/`           | `manageBooks`   | Add a new book                         |
| PUT    | `/:id`        | `manageBooks`   | Update a book                          |
| DELETE | `/:id`        | `manageBooks`   | Delete a book                          |

**Query parameters for `GET /`:**
- `search` — matches title, author, or ISBN
- `category` — filter by category
- `status` — `Available` or `Out of Stock`
- `page`, `limit`, `sortBy`, `order`

---

### Members — `/api/members`

| Method | Endpoint                  | Permission       | Description                        |
|--------|---------------------------|------------------|------------------------------------|
| GET    | `/`                       | Authenticated    | List members (search, filter)      |
| GET    | `/stats`                  | Authenticated    | Member statistics                  |
| GET    | `/:id`                    | Authenticated    | Get a single member                |
| GET    | `/:id/transactions`       | Authenticated    | Member's borrow history            |
| POST   | `/`                       | `manageMembers`  | Register a new member              |
| PUT    | `/:id`                    | `manageMembers`  | Update member details              |
| DELETE | `/:id`                    | `manageMembers`  | Delete member (no active borrows)  |

---

### Transactions — `/api/transactions`

| Method | Endpoint                     | Permission      | Description                         |
|--------|------------------------------|-----------------|-------------------------------------|
| GET    | `/`                          | Authenticated   | List all transactions               |
| GET    | `/stats`                     | Authenticated   | Dashboard stats (active, overdue…)  |
| GET    | `/:id`                       | Authenticated   | Get a single transaction            |
| POST   | `/borrow`                    | `issueBooks`    | Issue a book to a member            |
| PUT    | `/return/:id`                | `returnBooks`   | Return a borrowed book              |
| PUT    | `/pay-fine/:memberId`        | Authenticated   | Clear a member's outstanding fine   |

**Borrow request:**
```json
POST /api/transactions/borrow
{
  "memberId": "<member _id>",
  "bookId": "<book _id>",
  "notes": "Optional notes"
}
```

---

### Health Check

```
GET /api/health
```
Returns server status and MongoDB connection state.

---

## 🔐 Authentication & Roles

### Roles

| Role     | Description                                                        |
|----------|--------------------------------------------------------------------|
| `admin`  | Full access to everything, including issuer account management     |
| `issuer` | Access determined by individual permission flags                   |

### Issuer Permissions

Each issuer account has the following toggleable permissions:

| Permission       | Default | Description                     |
|------------------|---------|---------------------------------|
| `manageBooks`    | `true`  | Add, edit, delete books         |
| `manageMembers`  | `false` | Register, edit, delete members  |
| `issueBooks`     | `true`  | Create borrow transactions      |
| `returnBooks`    | `true`  | Process book returns            |
| `viewReports`    | `false` | Access statistics endpoints     |

Admins bypass all permission checks.

### Security

- Passwords are hashed with **bcryptjs** (12 salt rounds)
- Accounts are locked for **15 minutes** after **5 consecutive failed logins**
- Admins can manually unlock accounts via the update issuer endpoint
- Tokens are verified on every request via the `protect` middleware

---

## 🗄️ Data Models

### User
`username`, `password` (hashed), `fullName`, `email`, `phone`, `role`, `employeeId` (auto), `isActive`, `permissions`, `loginAttempts`, `lockedUntil`, `lastLogin`, `createdBy`

### Book
`title`, `author`, `isbn` (unique), `category`, `publisher`, `publishedYear`, `totalCopies`, `availableCopies`, `description`, `language`, `pages`, `status` (auto-updated)

**Categories:** Fiction, Non-Fiction, Science, Technology, History, Biography, Children, Poetry, Philosophy, Arts, Religion, Travel, Other

### Member
`memberId` (auto: `LIB01001`), `name`, `email` (unique), `phone`, `address`, `membershipType`, `membershipExpiry` (1 year default), `status`, `borrowedBooks`, `totalBorrowed`, `fineAmount`

**Membership types:** Standard, Premium, Student, Senior

### Transaction
`transactionId` (auto: `TXN-XXXXXXXXX`), `member`, `book`, `issuedBy`, `type` (Borrow/Return), `borrowDate`, `dueDate` (14 days default), `returnDate`, `status`, `fineAmount`, `finePaid`, `notes`

---

## 📏 Business Rules

- A member must have **Active** status to borrow books
- Members with **unpaid fines** cannot borrow books
- Maximum **3 active borrows** per member at a time
- A member cannot borrow the **same book twice** concurrently
- Fine rate: **₹5 per day** overdue
- Overdue status is updated automatically when transactions are listed
- A member with **active borrows** cannot be deleted
- Admin accounts cannot be deleted via the API
