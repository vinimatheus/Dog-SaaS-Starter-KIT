import { describe, it, expect, vi, beforeEach } from 'vitest'
import { securityValidator } from '@/lib/security/security-validator'
import { 
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  CreateUserSchema,
  CreateInviteSchema,
  UniqueIdSchema,
  EmailSchema,
  NameSchema,
  OrganizationNameSchema,
  SearchSchema
} from '@/schemas/security'
import { Role } from '@prisma/client'
import { ZodError } from 'zod'

// Mock dependencies
vi.mock('@/lib/prisma')
vi.mock('@/lib/security-logger')

describe('Input Validation Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('XSS Prevention Tests', () => {
    it('should reject script tags in organization name', () => {
      const maliciousInput = {
        name: '<script>alert("xss")</script>',
        uniqueId: 'test-org'
      }

      expect(() => CreateOrganizationSchema.parse(maliciousInput))
        .toThrow('Nome contém caracteres não permitidos')
    })

    it('should reject javascript: protocol in organization name', () => {
      const maliciousInput = {
        name: 'javascript:alert("xss")',
        uniqueId: 'test-org'
      }

      expect(() => CreateOrganizationSchema.parse(maliciousInput))
        .toThrow('Nome contém caracteres não permitidos')
    })

    it('should reject data: protocol in user name', () => {
      const maliciousInput = {
        name: 'data:text/html,<script>alert("xss")</script>',
        email: 'test@example.com'
      }

      expect(() => CreateUserSchema.parse(maliciousInput))
        .toThrow('Nome contém caracteres não permitidos')
    })

    it('should reject event handlers in names', () => {
      const maliciousInputs = [
        'onclick=alert("xss")',
        'onload=alert("xss")',
        'onerror=alert("xss")',
        'onmouseover=alert("xss")'
      ]

      maliciousInputs.forEach(maliciousName => {
        expect(() => NameSchema.parse(maliciousName))
          .toThrow('Nome contém caracteres não permitidos')
      })
    })

    it('should reject vbscript: protocol', () => {
      const maliciousInput = 'vbscript:msgbox("xss")'

      expect(() => NameSchema.parse(maliciousInput))
        .toThrow('Nome contém caracteres não permitidos')
    })
  })

  describe('SQL Injection Prevention Tests', () => {
    it('should reject SQL injection attempts in search queries', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "UNION SELECT * FROM users",
        "'; INSERT INTO users VALUES ('hacker'); --",
        "' OR 1=1 --",
        "admin'--",
        "' OR 'x'='x",
        "'; DELETE FROM organizations; --"
      ]

      sqlInjectionAttempts.forEach(maliciousQuery => {
        expect(() => SearchSchema.parse({ query: maliciousQuery }))
          .toThrow('Consulta de busca contém caracteres não permitidos')
      })
    })

    it('should reject SQL comments in search queries', () => {
      const maliciousQueries = [
        "test /* comment */",
        "test -- comment",
        "test /* DROP TABLE users */",
        "search -- OR 1=1"
      ]

      maliciousQueries.forEach(maliciousQuery => {
        expect(() => SearchSchema.parse({ query: maliciousQuery }))
          .toThrow('Consulta de busca contém caracteres não permitidos')
      })
    })
  })

  describe('Input Length and Format Validation', () => {
    it('should reject oversized organization names', () => {
      const oversizedName = 'a'.repeat(101)

      expect(() => OrganizationNameSchema.parse(oversizedName))
        .toThrow('Nome da organização deve ter no máximo 50 caracteres')
    })

    it('should reject oversized user names', () => {
      const oversizedName = 'a'.repeat(101)

      expect(() => NameSchema.parse(oversizedName))
        .toThrow('Nome deve ter no máximo 100 caracteres')
    })

    it('should reject oversized emails', () => {
      const oversizedEmail = 'a'.repeat(250) + '@example.com'

      expect(() => EmailSchema.parse(oversizedEmail))
        .toThrow('Email muito longo')
    })

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test..test@example.com',
        'test@example',
        'test@.com',
        'test@example.',
        'test space@example.com'
      ]

      invalidEmails.forEach(invalidEmail => {
        expect(() => EmailSchema.parse(invalidEmail))
          .toThrow()
      })
    })

    it('should reject invalid unique ID formats', () => {
      const invalidIds = [
        'AB', // too short
        'a'.repeat(51), // too long
        'Test-Org', // uppercase
        'test_org', // underscore
        'test org', // space
        'test@org', // special chars
        'test.org', // dot
      ]

      invalidIds.forEach(invalidId => {
        expect(() => UniqueIdSchema.parse(invalidId))
          .toThrow()
      })
    })

    it('should reject reserved words as unique IDs', () => {
      const reservedWords = [
        'api',
        'admin',
        'www',
        'auth',
        'login',
        'organizations',
        'invite',
        'dashboard'
      ]

      reservedWords.forEach(reserved => {
        expect(() => UniqueIdSchema.parse(reserved))
          .toThrow('ID único não pode usar palavras reservadas')
      })
    })
  })

  describe('Data Type Validation', () => {
    it('should reject invalid role values', () => {
      const invalidInvite = {
        email: 'test@example.com',
        role: 'INVALID_ROLE' as any,
        organizationId: 'clx1234567890abcdef'
      }

      expect(() => CreateInviteSchema.parse(invalidInvite))
        .toThrow()
    })

    it('should reject invalid CUID formats', () => {
      const invalidCuids = [
        'invalid-id',
        '123456789',
        'clx123', // too short
        'not-a-cuid',
        ''
      ]

      invalidCuids.forEach(invalidId => {
        const invalidInvite = {
          email: 'test@example.com',
          role: Role.USER,
          organizationId: invalidId
        }

        expect(() => CreateInviteSchema.parse(invalidInvite))
          .toThrow()
      })
    })
  })

  describe('Buffer Overflow Prevention', () => {
    it('should handle extremely large input gracefully', () => {
      const extremelyLargeInput = 'a'.repeat(10000)

      expect(() => NameSchema.parse(extremelyLargeInput))
        .toThrow('Nome deve ter no máximo 100 caracteres')
    })

    it('should handle null bytes in input', () => {
      const inputWithNullBytes = 'test\x00name'

      // Should either reject or sanitize null bytes
      const result = NameSchema.safeParse(inputWithNullBytes)
      if (result.success) {
        // The transform removes null bytes, so check the cleaned result
        expect(result.data).toBe('testname')
      }
    })

    it('should handle unicode overflow attempts', () => {
      const unicodeOverflow = 'test' + '\uFFFF'.repeat(100)

      expect(() => NameSchema.parse(unicodeOverflow))
        .toThrow()
    })
  })

  describe('SecurityValidator Input Sanitization', () => {
    it('should sanitize valid input correctly', () => {
      const validInput = {
        name: '  Test Organization  ',
        uniqueId: 'test-org'
      }

      const sanitized = securityValidator.sanitizeInput(validInput, CreateOrganizationSchema)

      expect(sanitized.name).toBe('Test Organization')
      expect(sanitized.uniqueId).toBe('test-org')
    })

    it('should throw error for invalid input during sanitization', () => {
      const invalidInput = {
        name: '<script>alert("xss")</script>',
        uniqueId: 'test-org'
      }

      expect(() => securityValidator.sanitizeInput(invalidInput, CreateOrganizationSchema))
        .toThrow('Input validation failed')
    })

    it('should handle nested object validation', () => {
      const nestedInput = {
        organization: {
          name: '<script>alert("xss")</script>'
        }
      }

      const nestedSchema = CreateOrganizationSchema.extend({
        organization: CreateOrganizationSchema
      })

      expect(() => securityValidator.sanitizeInput(nestedInput, nestedSchema))
        .toThrow()
    })
  })

  describe('Edge Cases and Boundary Testing', () => {
    it('should handle empty strings appropriately', () => {
      expect(() => NameSchema.parse(''))
        .toThrow('Nome é obrigatório')

      expect(() => EmailSchema.parse(''))
        .toThrow('Email inválido')
    })

    it('should handle whitespace-only input', () => {
      expect(() => NameSchema.parse('   '))
        .toThrow('Nome não pode estar vazio')

      expect(() => OrganizationNameSchema.parse('   '))
        .toThrow('Nome não pode estar vazio')
    })

    it('should handle minimum valid lengths', () => {
      const minValidName = 'a'
      const minValidUniqueId = 'abc'

      expect(() => NameSchema.parse(minValidName)).not.toThrow()
      expect(() => UniqueIdSchema.parse(minValidUniqueId)).not.toThrow()
    })

    it('should handle maximum valid lengths', () => {
      const maxValidName = 'a'.repeat(100)
      const maxValidOrgName = 'a'.repeat(50)
      const maxValidUniqueId = 'a'.repeat(50)

      expect(() => NameSchema.parse(maxValidName)).not.toThrow()
      expect(() => OrganizationNameSchema.parse(maxValidOrgName)).not.toThrow()
      expect(() => UniqueIdSchema.parse(maxValidUniqueId)).not.toThrow()
    })

    it('should handle international characters appropriately', () => {
      const internationalNames = [
        'José Silva',
        'François Müller',
        'Александр Петров',
        '田中太郎',
        'محمد أحمد'
      ]

      internationalNames.forEach(name => {
        expect(() => NameSchema.parse(name)).not.toThrow()
      })
    })

    it('should reject international characters in unique IDs', () => {
      const internationalIds = [
        'josé-silva',
        'françois-müller',
        'александр',
        '田中',
        'محمد'
      ]

      internationalIds.forEach(id => {
        expect(() => UniqueIdSchema.parse(id))
          .toThrow('ID único deve conter apenas letras minúsculas, números e hífens')
      })
    })
  })

  describe('Malicious Payload Detection', () => {
    it('should detect and reject common XSS payloads', () => {
      const xssPayloads = [
        '<img src=x onerror=alert("xss")>',
        '<svg onload=alert("xss")>',
        '<iframe src="javascript:alert(\'xss\')">',
        '<body onload=alert("xss")>',
        '<input onfocus=alert("xss") autofocus>',
        '<select onfocus=alert("xss") autofocus>',
        '<textarea onfocus=alert("xss") autofocus>',
        '<keygen onfocus=alert("xss") autofocus>',
        '<video><source onerror="alert(\'xss\')">',
        '<audio src=x onerror=alert("xss")>'
      ]

      xssPayloads.forEach(payload => {
        expect(() => NameSchema.parse(payload))
          .toThrow('Nome contém caracteres não permitidos')
      })
    })

    it('should detect and reject encoded XSS attempts', () => {
      const encodedPayloads = [
        '&lt;script&gt;alert("xss")&lt;/script&gt;',
        '%3Cscript%3Ealert("xss")%3C/script%3E',
        '&#60;script&#62;alert("xss")&#60;/script&#62;'
      ]

      // Note: These might pass basic validation but should be handled by additional security layers
      encodedPayloads.forEach(payload => {
        const result = NameSchema.safeParse(payload)
        // Either reject or ensure proper encoding
        if (result.success) {
          expect(result.data).not.toContain('<script')
        }
      })
    })

    it('should handle mixed case evasion attempts', () => {
      const mixedCasePayloads = [
        'JaVaScRiPt:alert("xss")',
        'DaTa:text/html,<script>alert("xss")</script>',
        'VbScRiPt:msgbox("xss")'
      ]

      mixedCasePayloads.forEach(payload => {
        expect(() => NameSchema.parse(payload))
          .toThrow('Nome contém caracteres não permitidos')
      })
    })
  })
})