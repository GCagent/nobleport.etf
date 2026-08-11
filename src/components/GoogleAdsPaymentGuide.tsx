'use client';

import React, { useState } from 'react';

/**
 * Google Ads Payment Guide
 *
 * Step-by-step guide for safely navigating Google Ads billing on mobile.
 * Security: No account IDs stored, no payment proxying, safe external linking.
 */

// ============================================================================
// TYPES
// ============================================================================

interface Step {
  title: string;
  instructions: string[];
  warning?: string;
}

// ============================================================================
// DATA
// ============================================================================

const GOOGLE_ADS_URL = 'https://ads.google.com';

const STEPS: Step[] = [
  {
    title: 'Open Google Ads Directly',
    instructions: [
      'Open Safari on your iPhone.',
      'Navigate to ads.google.com — do not use any email link.',
      'Sign in with the Google account tied to your Ads account.',
    ],
    warning: 'Never follow payment links from emails. Always type the URL directly.',
  },
  {
    title: 'Switch to the Correct Account',
    instructions: [
      'Tap your profile icon (top right).',
      'Confirm you are in the correct Google account.',
      'If managing multiple accounts, use the account selector to choose the correct Ads ID.',
    ],
  },
  {
    title: 'Go to Billing',
    instructions: [
      'Tap the three-line menu (top left).',
      'Tap Billing.',
      'Tap Billing & Payments.',
    ],
  },
  {
    title: 'Pay the Balance',
    instructions: [
      'Tap Summary.',
      'Tap Make a Payment.',
      'Pay the full outstanding balance — accounts usually won\'t reactivate until fully paid.',
    ],
  },
  {
    title: 'Update Payment Method (if needed)',
    instructions: [
      'In Billing, tap Payment Methods.',
      'Add or update your card or bank information.',
      'Save, then return to Summary and make the payment.',
    ],
  },
];

const SAFETY_CHECKS = [
  'Never pay from a link in an email.',
  'Only pay inside ads.google.com.',
  'Confirm transaction status under Billing > Transactions.',
  'If anything looks unusual, stop and verify before proceeding.',
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const StepCard: React.FC<{
  step: Step;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ step, index, isExpanded, onToggle }) => (
  <div className="border border-slate-600 rounded-lg overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-5 py-4 bg-[#1e3a5f] hover:bg-[#243f63] transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0d9488] text-white text-sm font-semibold">
          {index + 1}
        </span>
        <span className="text-white font-medium">{step.title}</span>
      </div>
      <span className="text-slate-400 text-sm">{isExpanded ? '−' : '+'}</span>
    </button>

    {isExpanded && (
      <div className="px-5 py-4 bg-slate-800 space-y-3">
        <ol className="space-y-2">
          {step.instructions.map((instruction, i) => (
            <li key={i} className="flex gap-3 text-slate-200 text-sm">
              <span className="text-[#0d9488] font-mono text-xs mt-0.5">
                {String.fromCharCode(97 + i)}.
              </span>
              <span>{instruction}</span>
            </li>
          ))}
        </ol>

        {step.warning && (
          <div className="mt-3 px-4 py-3 bg-amber-900/30 border border-amber-700/40 rounded text-amber-300 text-sm">
            {step.warning}
          </div>
        )}
      </div>
    )}
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GoogleAdsPaymentGuide() {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]));

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const openGoogleAds = () => {
    window.open(GOOGLE_ADS_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Google Ads Payment Guide
          </h1>
          <p className="mt-2 text-slate-400 text-sm">
            Follow these steps to safely log in and pay your Google Ads balance from an iPhone.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map((step, i) => (
            <StepCard
              key={i}
              step={step}
              index={i}
              isExpanded={expandedSteps.has(i)}
              onToggle={() => toggleStep(i)}
            />
          ))}
        </div>

        {/* Open Google Ads CTA */}
        <div className="flex justify-center">
          <button
            onClick={openGoogleAds}
            className="bg-[#0d9488] hover:bg-[#0f766e] text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Open Google Ads
          </button>
        </div>

        {/* Safety Checklist */}
        <div className="border border-slate-600 rounded-lg p-5 bg-[#1e3a5f]">
          <h2 className="text-lg font-semibold text-white mb-3">
            Safety Checklist
          </h2>
          <ul className="space-y-2">
            {SAFETY_CHECKS.map((check, i) => (
              <li key={i} className="flex items-start gap-3 text-slate-200 text-sm">
                <span className="text-[#0d9488] mt-0.5">&#10003;</span>
                <span>{check}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
