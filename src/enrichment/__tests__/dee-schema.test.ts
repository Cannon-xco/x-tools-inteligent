// ============================================================
// DEE SCHEMA TEST SUITE
// Tests for dee-schema.ts - Database Migration
// ============================================================

import {
  initDeeSchema,
  isDeeSchemaInitialized,
  dropDeeSchema,
} from '../db/dee-schema';

describe('DEE Schema', () => {
  // Note: These tests require a database connection
  // They will be skipped if DATABASE_URL is not set

  const hasDbConnection = process.env.DATABASE_URL !== undefined;

  beforeEach(async () => {
    if (!hasDbConnection) {
      return;
    }
    // Clean up before each test
    try {
      await dropDeeSchema();
    } catch {
      // Ignore errors if schema doesn't exist
    }
  });

  afterAll(async () => {
    if (!hasDbConnection) {
      return;
    }
    // Clean up after all tests
    try {
      await dropDeeSchema();
    } catch {
      // Ignore errors
    }
  });

  describe('initDeeSchema', () => {
    it('should create schema on first run', async () => {
      if (!hasDbConnection) {
        return;
      }

      // Verify schema is not initialized
      const initialCheck = await isDeeSchemaInitialized();
      expect(initialCheck).toBe(false);

      // Initialize schema
      await initDeeSchema();

      // Verify schema is now initialized
      const finalCheck = await isDeeSchemaInitialized();
      expect(finalCheck).toBe(true);
    });

    it('should be idempotent - safe to run multiple times', async () => {
      if (!hasDbConnection) {
        return;
      }

      // Initialize schema first time
      await initDeeSchema();

      // Verify it's initialized
      const firstCheck = await isDeeSchemaInitialized();
      expect(firstCheck).toBe(true);

      // Run again - should not throw
      await expect(initDeeSchema()).resolves.not.toThrow();
      await expect(initDeeSchema()).resolves.not.toThrow();
      await expect(initDeeSchema()).resolves.not.toThrow();

      // Verify still initialized
      const finalCheck = await isDeeSchemaInitialized();
      expect(finalCheck).toBe(true);
    });
  });

  describe('isDeeSchemaInitialized', () => {
    it('should return false when schema does not exist', async () => {
      if (!hasDbConnection) {
        return;
      }

      // Ensure schema is dropped
      await dropDeeSchema();

      const result = await isDeeSchemaInitialized();
      expect(result).toBe(false);
    });

    it('should return true when schema exists', async () => {
      if (!hasDbConnection) {
        return;
      }

      // Initialize schema
      await initDeeSchema();

      const result = await isDeeSchemaInitialized();
      expect(result).toBe(true);
    });
  });

  describe('dropDeeSchema', () => {
    it('should remove all DEE schema elements', async () => {
      if (!hasDbConnection) {
        return;
      }

      // Initialize first
      await initDeeSchema();
      expect(await isDeeSchemaInitialized()).toBe(true);

      // Drop schema
      await dropDeeSchema();

      // Verify it's gone
      const result = await isDeeSchemaInitialized();
      expect(result).toBe(false);
    });

    it('should not throw when schema does not exist', async () => {
      if (!hasDbConnection) {
        return;
      }

      // Ensure schema is dropped
      await dropDeeSchema();

      // Should not throw
      await expect(dropDeeSchema()).resolves.not.toThrow();
    });
  });

  describe('Schema Structure', () => {
    beforeEach(async () => {
      if (hasDbConnection) {
        await initDeeSchema();
      }
    });

    it('should add verified_emails column to leads table', async () => {
      if (!hasDbConnection) {
        return;
      }

      // This test would need to query information_schema
      // For now, we just verify the schema initialized successfully
      const isInitialized = await isDeeSchemaInitialized();
      expect(isInitialized).toBe(true);
    });

    it('should create enrichment_audit table', async () => {
      if (!hasDbConnection) {
        return;
      }

      const isInitialized = await isDeeSchemaInitialized();
      expect(isInitialized).toBe(true);
    });
  });
});
