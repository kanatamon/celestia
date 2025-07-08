# TikTok Divine Live

## Migration Strategy Guidelines

### Overview

This project uses Prisma for database management. Proper migration handling is
crucial for maintaining data integrity across development, staging, and
production environments.

### Environment-Specific Commands

#### Development Environment

```bash
# Create and apply migration with descriptive name
npx prisma migrate dev --name add_user_preferences

# Reset database (⚠️ DESTRUCTIVE - only use in development)
npx prisma migrate reset

# Push schema changes without creating migration (prototyping only)
npx prisma db push

# Check migration status
npx prisma migrate status
```

#### Staging/Production Environment

```bash
# Check current migration status
npx prisma migrate status

# Deploy pending migrations (never use migrate dev in production!)
npx prisma migrate deploy

# Generate Prisma client after migration
npx prisma generate
```

### Safe Migration Patterns

#### ✅ Always Safe Operations

- Adding optional columns
- Creating new tables
- Adding indexes
- Adding constraints to new columns
- Making required fields optional

#### ⚠️ Requires Planning

- Adding required columns to existing tables
- Adding unique constraints to existing data
- Changing column types
- Renaming columns/tables

#### ❌ Potentially Breaking Operations

- Dropping columns/tables
- Making optional fields required
- Adding foreign key constraints to existing data

### Multi-Step Migration Strategy

For breaking changes, use a 3-step approach:

#### Example: Adding Required Email Field

**Step 1: Add Optional Field**

```prisma
model User {
  id       String @id
  email    String? // Start as optional
}
```

```bash
npx prisma migrate dev --name add_optional_email_field
```

**Step 2: Populate Data** Create a data migration script or manual SQL:

```sql
-- Update existing records
UPDATE "User" SET email = CONCAT('user', id, '@temp.com') WHERE email IS NULL;
```

**Step 3: Make Required**

```prisma
model User {
  id       String @id
  email    String @unique // Now required and unique
}
```

```bash
npx prisma migrate dev --name make_email_required
```

### Production Migration Checklist

Before deploying migrations to production:

- [ ] Test migration on staging environment with production-like data
- [ ] Review generated SQL in migration files
- [ ] Ensure backward compatibility if possible
- [ ] Have rollback plan ready
- [ ] Schedule maintenance window if needed
- [ ] Backup database before migration
- [ ] Monitor application after deployment

### Common Migration Issues & Solutions

#### Issue: Adding Required Column to Non-Empty Table

```
Error: Cannot add required column without default value
```

**Solution:** Use multi-step approach above or add temporary default:

```sql
-- Add with default
ALTER TABLE "users" ADD COLUMN "email" TEXT NOT NULL DEFAULT 'temp@example.com';
-- Update with real values
UPDATE "users" SET "email" = CONCAT('user', id, '@example.com');
-- Remove default
ALTER TABLE "users" ALTER COLUMN "email" DROP DEFAULT;
```

#### Issue: Migration Drift

```
Error: Schema drift detected
```

**Solution:** Reset development database or resolve conflicts manually:

```bash
# Development only!
npx prisma migrate reset
```

### CI/CD Pipeline Integration

```yaml
# Example GitHub Actions workflow
deploy:
  steps:
    - name: Check Migration Status
      run: npx prisma migrate status

    - name: Deploy Database Migrations
      run: npx prisma migrate deploy

    - name: Generate Prisma Client
      run: npx prisma generate

    - name: Deploy Application
      run: # your deployment command
```
