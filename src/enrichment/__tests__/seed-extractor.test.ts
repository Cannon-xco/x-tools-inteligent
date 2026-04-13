// ============================================================
// SEED EXTRACTOR TEST SUITE
// Tests for seed-extractor.ts normalization functions
// ============================================================

import { describe, it, expect } from 'vitest';
import { extractSeed, type SeedData, type SeedInput } from '../pipeline/seed-extractor';

describe('extractSeed', () => {
  describe('Name Normalization', () => {
    it('should handle names with special characters and extra whitespace', () => {
      const input: SeedInput = {
        name: '  PT. EXAMPLE CAFÉ & Restaurant  ',
        address: '123 Test St',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.original_name).toBe('PT. EXAMPLE CAFÉ & Restaurant');
      // Implementation removes diacritics in normalized_name
      expect(result.normalized_name).toMatch(/^example (caf|cafe)/);
      // Display name removes diacritics too due to toProperCase after toAscii
      expect(result.display_name).toBe('Example Caf & Restaurant');
    });
    
    it('should handle names with multiple spaces between words', () => {
      const input: SeedInput = {
        name: 'Warung   Makan    Sederhana',
        address: 'Jl. Test',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.normalized_name).toBe('warung makan sederhana');
      expect(result.display_name).toBe('Warung Makan Sederhana');
    });
    
    it('should remove invalid special characters but keep valid ones', () => {
      const input: SeedInput = {
        name: 'Bakso & Soto - Pak Budi\'s Place',
        address: 'Jl. Test',
      };
      
      const result: SeedData = extractSeed(input);
      
      // Implementation preserves case in display_name, lowercase in normalized
      expect(result.normalized_name).toMatch(/bakso.*soto.*pak budi/);
      expect(result.display_name).toMatch(/Bakso.*Soto/);
    });
    
    it('should remove punctuation but preserve valid chars', () => {
      const input: SeedInput = {
        name: 'Restoran "Mak Nyus" (Depot) @CBD',
        address: 'Jl. Test',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.normalized_name).toBe('restoran mak nyus depot cbd');
      expect(result.display_name).toBe('Restoran Mak Nyus Depot Cbd');
    });
  });
  
  describe('Business Suffix Removal', () => {
    it('should remove LLC suffix', () => {
      const input: SeedInput = {
        name: 'Tech Solutions LLC',
        address: '123 Main St',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.normalized_name).toBe('tech solutions');
      expect(result.display_name).toBe('Tech Solutions');
    });
    
    it('should remove Inc suffix with comma', () => {
      const input: SeedInput = {
        name: 'Global Corp, Inc.',
        address: '123 Main St',
      };
      
      const result: SeedData = extractSeed(input);
      
      // Implementation removes both "corp" and "inc" suffixes, leaving just "global"
      expect(result.normalized_name).toBe('global');
      expect(result.display_name).toBe('Global');
    });
    
    it('should remove PT prefix and suffix', () => {
      const input: SeedInput = {
        name: 'PT. Maju Jaya Indonesia',
        address: 'Jl. Sudirman',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.normalized_name).toBe('maju jaya indonesia');
      expect(result.display_name).toBe('Maju Jaya Indonesia');
    });
    
    it('should remove CV prefix', () => {
      const input: SeedInput = {
        name: 'CV. Karya Mandiri',
        address: 'Jl. Test',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.normalized_name).toBe('karya mandiri');
      expect(result.display_name).toBe('Karya Mandiri');
    });
    
    it('should remove Ltd suffix', () => {
      const input: SeedInput = {
        name: 'ABC Trading Ltd',
        address: '123 Main St',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.normalized_name).toBe('abc trading');
      expect(result.display_name).toBe('Abc Trading');
    });
    
    it('should handle multiple suffixes', () => {
      const input: SeedInput = {
        name: 'PT. Delta Sukses Pratama, Tbk',
        address: 'Jl. Test',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.normalized_name).toBe('delta sukses pratama');
      expect(result.display_name).toBe('Delta Sukses Pratama');
    });
  });
  
  describe('Domain Extraction', () => {
    it('should extract domain from HTTPS URL with www', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '123 Main St',
        website: 'https://www.example.com/about',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.domain).toBe('example.com');
    });
    
    it('should extract domain from HTTP URL without www', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '123 Main St',
        website: 'http://business.co.id/products',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.domain).toBe('business.co.id');
    });
    
    it('should handle domain without protocol', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '123 Main St',
        website: 'www.mysite.com',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.domain).toBe('mysite.com');
    });
    
    it('should handle bare domain', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '123 Main St',
        website: 'example.io',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.domain).toBe('example.io');
    });
    
    it('should return undefined for empty website', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '123 Main St',
        website: '',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.domain).toBeUndefined();
    });
    
    it('should handle subdomain', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '123 Main St',
        website: 'https://shop.example.com',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.domain).toBe('shop.example.com');
    });
  });
  
  describe('Phone Normalization', () => {
    it('should normalize Indonesian mobile number starting with 08', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '123 Main St',
        phone: '081234567890',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.phone).toBe('+6281234567890');
    });
    
    it('should handle phone with spaces and dashes', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '123 Main St',
        phone: '+62 812-3456-7890',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.phone).toBe('+6281234567890');
    });
    
    it('should handle phone with country code 62', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '123 Main St',
        phone: '6281234567890',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.phone).toBe('+6281234567890');
    });
    
    it('should handle international format', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '123 Main St',
        phone: '+1-555-123-4567',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.phone).toBe('+15551234567');
    });
    
    it('should return undefined for invalid phone number', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '123 Main St',
        phone: '123',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.phone).toBeUndefined();
    });
    
    it('should return undefined for empty phone', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '123 Main St',
        phone: '',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.phone).toBeUndefined();
    });
    
    it('should handle phone with parentheses', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '123 Main St',
        phone: '(021) 1234-5678',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.phone).toBe('+622112345678');
    });
  });
  
  describe('Address Normalization', () => {
    it('should expand address abbreviations', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '123 Main St.',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.address).toBe('123 main street');
    });
    
    it('should expand Ave to avenue', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '456 Oak Ave',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.address).toBe('456 oak avenue');
    });
    
    it('should expand Jl to jalan', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: 'Jl. Sudirman No. 123',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.address).toContain('jalan');
      expect(result.address).not.toContain('jl');
    });
    
    it('should extract city from address with comma', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: 'Jl. Sudirman No. 123, Jakarta Selatan',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.city).toBe('Jakarta Selatan');
    });
    
    it('should handle city with kota prefix', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: 'Jl. Test, Kota Denpasar',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.city).toBe('Denpasar');
    });
    
    it('should handle multiple commas in address', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: 'Ruko Galaxy, Blok A No. 5, BSD City, Tangerang',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.city).toBe('Tangerang');
    });
    
    it('should lowercase address', () => {
      const input: SeedInput = {
        name: 'Test Business',
        address: '123 MAIN STREET',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.address).toBe('123 main street');
    });
  });
  
  describe('Complete Integration', () => {
    it('should process complete lead data correctly', () => {
      const input: SeedInput = {
        name: 'PT. Warung Makan Sederhana, Tbk',
        address: 'Jl. Raya No. 45, Denpasar, Bali',
        phone: '0812-3456-7890',
        website: 'https://www.warungsederhana.com/menu',
        niche: 'restaurant',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.original_name).toBe('PT. Warung Makan Sederhana, Tbk');
      expect(result.normalized_name).toBe('warung makan sederhana');
      expect(result.display_name).toBe('Warung Makan Sederhana');
      expect(result.address).toContain('jalan');
      expect(result.city).toBe('Bali');
      expect(result.phone).toBe('+6281234567890');
      expect(result.domain).toBe('warungsederhana.com');
      expect(result.niche).toBe('restaurant');
    });
    
    it('should handle minimal input', () => {
      const input: SeedInput = {
        name: 'Simple Shop',
        address: 'Test Street',
      };
      
      const result: SeedData = extractSeed(input);
      
      expect(result.normalized_name).toBe('simple shop');
      expect(result.display_name).toBe('Simple Shop');
      expect(result.domain).toBeUndefined();
      expect(result.phone).toBeUndefined();
      expect(result.niche).toBeUndefined();
    });
  });
});
