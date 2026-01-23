# Prisma Migrations - Quick Summary

## 🎯 What You Need to Know

### **The Concept (Simple Explanation)**

Think of it like building a house:
1. **Schema** (`schema.prisma`) = Blueprint/Design drawing
2. **Migration** = Construction instructions (SQL)
3. **Database** = The actual house (tables with data)

**The blueprint alone doesn't build the house!** You need construction instructions (migrations) to actually build it.

---

## 🔧 What Happened

### **Before:**
```
schema.prisma exists ✓
Migration files ✗ (missing!)
Database tables ✗ (empty!)
```

Your `docker-entrypoint.sh` ran:
```bash
npx prisma migrate deploy  # ← Tried to apply migrations
```

But there were **no migration files** to apply! So no tables were created.

### **After Running:**
```bash
docker compose exec user-service sh -c "cd /app/services/user-service && npx prisma migrate dev --name init"
```

Now you have:
```
schema.prisma exists ✓
Migration files ✓ (created!)
Database tables ✓ (created!)
```

---

## 📊 Two Commands Explained

### **1. `prisma migrate dev` (Development)**
**Purpose:** CREATE migration files

```bash
npx prisma migrate dev --name init
```

**What it does:**
- Reads your schema.prisma
- Generates SQL migration files
- Applies them to database
- Creates the tables

**When to use:**
- ✅ First time setup (what you just did!)
- ✅ When you change schema.prisma
- ✅ During development

**Output:**
```
prisma/migrations/
  └── 20251213123456_init/
      └── migration.sql  ← The SQL that creates tables
```

---

### **2. `prisma migrate deploy` (Production)**
**Purpose:** APPLY existing migration files

```bash
npx prisma migrate deploy
```

**What it does:**
- Looks for migration files
- Applies any pending ones
- Does NOT create new files

**When to use:**
- ✅ In Docker containers (your entrypoint script)
- ✅ In production
- ✅ In CI/CD

**Requires:**
- Migration files must already exist!

---

## 🚀 What You Need to Do Now

### **You have 9 services with Prisma:**

1. ✅ **user-service** (DONE - tables created!)
2. ⏭️ **queuing-service** (needs migrations)
3. ⏭️ **interaction-service** (needs migrations)
4. ⏭️ **history-service** (needs migrations)
5. ⏭️ **communication-service** (needs migrations)
6. ⏭️ **notification-service** (needs migrations)
7. ⏭️ **moderation-service** (needs migrations)
8. ⏭️ **analytics-service** (needs migrations)
9. ⏭️ **subscription-service** (needs migrations)

### **Option 1: Automated (Recommended)**

Run the PowerShell script:
```powershell
.\create-all-migrations.ps1
```

This will:
- ✅ Create migrations for all 8 remaining services
- ✅ Show progress for each service
- ✅ Display summary at the end

### **Option 2: Manual (One by One)**

```bash
# Queuing Service
docker compose exec queuing-service sh -c "cd /app/services/queuing-service && npx prisma migrate dev --name init"

# Interaction Service
docker compose exec interaction-service sh -c "cd /app/services/interaction-service && npx prisma migrate dev --name init"

# ... and so on for each service
```

---

## ✅ How to Verify It Worked

### **1. Check Migration Files Were Created:**
```powershell
ls services/user-service/prisma/migrations/
```

Should show:
```
20251213123456_init/
```

### **2. Check Database Tables:**
```bash
# User service database
docker compose exec postgres psql -U postgres -d users -c "\dt"
```

Should show tables like:
```
User
Profile
UserSafetyProfile
UserBlock
UserReport
```

### **3. Test the API:**
```bash
curl http://localhost:3001/auth/register -X POST -H "Content-Type: application/json" -d '{"username":"test","email":"test@test.com","password":"Test123!"}'
```

Should work without 500 errors! ✅

---

## 🔄 Future Workflow

### **When You Change Schema:**

1. Edit `schema.prisma`:
```prisma
model User {
  id       String @id @default(cuid())
  username String @unique
  email    String @unique
  phone    String?  // ← New field added
}
```

2. Create migration:
```bash
docker compose exec user-service sh -c "cd /app/services/user-service && npx prisma migrate dev --name add_phone_field"
```

3. Commit to git:
```bash
git add services/user-service/prisma/migrations/
git commit -m "Add phone field to User model"
```

4. Deploy:
- Your `docker-entrypoint.sh` automatically runs `migrate deploy`
- New migration is applied on container startup
- Tables are updated! ✅

---

## 🎓 Key Takeaways

1. **Schema ≠ Database Tables**
   - Schema is just code/design
   - Need migrations to create actual tables

2. **Two Commands, Two Purposes**
   - `migrate dev` = Create migration files (development)
   - `migrate deploy` = Apply migration files (production)

3. **One-Time Setup**
   - Run `migrate dev` once per service
   - Migration files are created
   - Commit them to git
   - `migrate deploy` handles the rest

4. **Your Entrypoint Script**
   - Already has `migrate deploy`
   - Will work automatically once migration files exist
   - No need to change anything!

---

## 📁 Files Created

- ✅ `PRISMA_MIGRATIONS_GUIDE.md` - Detailed explanation
- ✅ `create-all-migrations.ps1` - Automated script
- ✅ `MIGRATIONS_SUMMARY.md` - This file (quick reference)

---

## 🆘 Quick Help

### **Problem:** Service returns 500 error
**Solution:** Create migrations for that service

### **Problem:** "No migration files found"
**Solution:** Run `migrate dev` to create them

### **Problem:** Tables not in database
**Solution:** Check if migrations were applied

### **Problem:** Migration fails
**Solution:** Check schema.prisma for syntax errors

---

## 🎯 Next Steps

1. ✅ Run `.\create-all-migrations.ps1`
2. ✅ Verify migrations created for all services
3. ✅ Restart services: `docker compose restart`
4. ✅ Test each service's endpoints
5. ✅ Commit migration files to git

---

**You're all set!** 🚀

The migrations are a one-time setup. Once created, your `docker-entrypoint.sh` handles everything automatically on container startup.
