/**
 * Utility functions for trial calculation, eligibility checking, and validation
 */

import { Organization } from '@prisma/client';
import { 
  TrialStatus, 
  TrialEligibility, 
  TrialCalculation 
} from '@/types/stripe';

/**
 * Standard trial duration in days
 */
export const TRIAL_DURATION_DAYS = 7;

/**
 * Calculate the number of days remaining in a trial period
 * @param trialEndDate - The end date of the trial
 * @returns Number of days remaining (can be negative if expired)
 */
export function calculateTrialDaysRemaining(trialEndDate: Date | null): number {
  if (!trialEndDate) {
    return 0;
  }

  const now = new Date();
  const endDate = new Date(trialEndDate);
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Calculate comprehensive trial information
 * @param trialStartDate - The start date of the trial
 * @param trialEndDate - The end date of the trial
 * @returns Detailed trial calculation result
 */
export function calculateTrialDetails(
  trialStartDate: Date | null,
  trialEndDate: Date | null
): TrialCalculation {
  if (!trialStartDate || !trialEndDate) {
    return {
      isActive: false,
      daysRemaining: 0,
      isExpired: false,
      totalDays: 0,
      daysElapsed: 0
    };
  }

  const now = new Date();
  const startDate = new Date(trialStartDate);
  const endDate = new Date(trialEndDate);

  // Calculate total trial duration
  const totalTime = endDate.getTime() - startDate.getTime();
  const totalDays = Math.ceil(totalTime / (1000 * 60 * 60 * 24));

  // Calculate elapsed days
  const elapsedTime = now.getTime() - startDate.getTime();
  const daysElapsed = Math.max(0, Math.floor(elapsedTime / (1000 * 60 * 60 * 24)));

  // Calculate remaining days
  const remainingTime = endDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));

  const isActive = now >= startDate && now <= endDate;
  const isExpired = now > endDate;

  return {
    isActive,
    daysRemaining: Math.max(0, daysRemaining),
    isExpired,
    totalDays,
    daysElapsed: Math.min(daysElapsed, totalDays)
  };
}

/**
 * Check if an organization is eligible for a trial
 * @param organization - The organization to check
 * @returns Trial eligibility result
 */
export function checkTrialEligibility(organization: Organization): TrialEligibility {
  // Check if trial has already been used
  if (organization.trialUsed) {
    return {
      isEligible: false,
      reason: 'already_used',
      message: 'Esta organização já utilizou o período de teste gratuito'
    };
  }

  // Check if organization already has an active subscription
  if (organization.plan === 'PRO' && organization.stripeSubscriptionId) {
    return {
      isEligible: false,
      reason: 'already_subscribed',
      message: 'Esta organização já possui uma assinatura ativa'
    };
  }

  // Check if organization is currently in trial
  if (organization.trialStartDate && organization.trialEndDate) {
    const now = new Date();
    const trialEnd = new Date(organization.trialEndDate);
    
    if (now <= trialEnd) {
      return {
        isEligible: false,
        reason: 'already_used',
        message: 'Esta organização já está em período de teste'
      };
    }
  }

  return {
    isEligible: true,
    message: 'Organização elegível para período de teste de 7 dias'
  };
}

/**
 * Get comprehensive trial status for an organization
 * @param organization - The organization to check
 * @returns Complete trial status information
 */
export function getTrialStatus(organization: Organization): TrialStatus {
  const trialCalculation = calculateTrialDetails(
    organization.trialStartDate,
    organization.trialEndDate
  );

  return {
    isInTrial: trialCalculation.isActive,
    trialStartDate: organization.trialStartDate,
    trialEndDate: organization.trialEndDate,
    daysRemaining: trialCalculation.daysRemaining,
    hasUsedTrial: organization.trialUsed
  };
}

/**
 * Validate trial status data for consistency
 * @param organization - The organization to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateTrialStatus(organization: Organization): string[] {
  const errors: string[] = [];

  // Check if trial dates are consistent
  if (organization.trialStartDate && organization.trialEndDate) {
    const startDate = new Date(organization.trialStartDate);
    const endDate = new Date(organization.trialEndDate);

    if (startDate >= endDate) {
      errors.push('Data de início do teste deve ser anterior à data de fim');
    }

    // Check if trial duration is reasonable (should be around 7 days)
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = durationMs / (1000 * 60 * 60 * 24);
    
    if (durationDays < 1 || durationDays > 30) {
      errors.push('Duração do período de teste deve estar entre 1 e 30 dias');
    }
  }

  // Check if trial dates exist when trialUsed is true
  if (organization.trialUsed && (!organization.trialStartDate || !organization.trialEndDate)) {
    errors.push('Organização marcada como tendo usado o teste deve ter datas de início e fim');
  }

  // Check if trialUsed is false when trial dates exist
  if ((organization.trialStartDate || organization.trialEndDate) && !organization.trialUsed) {
    errors.push('Organização com datas de teste deve estar marcada como tendo usado o teste');
  }

  return errors;
}

/**
 * Calculate trial end date from start date
 * @param startDate - The trial start date
 * @param durationDays - Duration of trial in days (defaults to 7)
 * @returns The calculated end date
 */
export function calculateTrialEndDate(startDate: Date, durationDays: number = TRIAL_DURATION_DAYS): Date {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays);
  return endDate;
}

/**
 * Check if a trial is about to expire (within specified days)
 * @param trialEndDate - The trial end date
 * @param warningDays - Number of days before expiration to warn (defaults to 2)
 * @returns Whether the trial is about to expire
 */
export function isTrialAboutToExpire(trialEndDate: Date | null, warningDays: number = 2): boolean {
  if (!trialEndDate) {
    return false;
  }

  const now = new Date();
  const endDate = new Date(trialEndDate);
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  return diffDays > 0 && diffDays <= warningDays;
}

/**
 * Format trial days remaining for display
 * @param daysRemaining - Number of days remaining
 * @returns Formatted string for display
 */
export function formatTrialDaysRemaining(daysRemaining: number): string {
  if (daysRemaining <= 0) {
    return 'Período de teste expirado';
  }
  
  if (daysRemaining === 1) {
    return '1 dia restante';
  }
  
  return `${daysRemaining} dias restantes`;
}