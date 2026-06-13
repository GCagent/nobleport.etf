'use client';

/**
 * Global access to NBPT token state and write actions for the dashboard.
 * Must be mounted inside Web3Providers (see src/app/providers.tsx).
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useAccount } from 'wagmi';
import {
  useInvestorStatus,
  useIssueTokens,
  useOfferingStatus,
  useRedeemTokens,
  useTokenBalance,
  useTransferTokens,
  useVoiceContractActions,
} from '@/hooks/useERC1400Actions';

interface ContractContextType {
  balance: string;
  isLoadingBalance: boolean;
  kycVerified: boolean;
  accredited: boolean;
  liveOfferingCleared: boolean;
  issue: ReturnType<typeof useIssueTokens>['issue'];
  transfer: ReturnType<typeof useTransferTokens>['transfer'];
  redeem: ReturnType<typeof useRedeemTokens>['redeem'];
  prepareVoiceCommand: ReturnType<typeof useVoiceContractActions>['prepareVoiceCommand'];
  isIssuePending: boolean;
  isTransferPending: boolean;
  isRedeemPending: boolean;
}

const ContractContext = createContext<ContractContextType | null>(null);

export function ContractProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  const { balance, isLoading: isLoadingBalance } = useTokenBalance(address);
  const { kycVerified, accredited } = useInvestorStatus(address);
  const { liveOfferingCleared } = useOfferingStatus();
  const { issue, isPending: isIssuePending } = useIssueTokens();
  const { transfer, isPending: isTransferPending } = useTransferTokens();
  const { redeem, isPending: isRedeemPending } = useRedeemTokens();
  const { prepareVoiceCommand } = useVoiceContractActions();

  const value = useMemo(
    () => ({
      balance,
      isLoadingBalance,
      kycVerified,
      accredited,
      liveOfferingCleared,
      issue,
      transfer,
      redeem,
      prepareVoiceCommand,
      isIssuePending,
      isTransferPending,
      isRedeemPending,
    }),
    [
      balance,
      isLoadingBalance,
      kycVerified,
      accredited,
      liveOfferingCleared,
      issue,
      transfer,
      redeem,
      prepareVoiceCommand,
      isIssuePending,
      isTransferPending,
      isRedeemPending,
    ],
  );

  return <ContractContext.Provider value={value}>{children}</ContractContext.Provider>;
}

export function useContract() {
  const context = useContext(ContractContext);
  if (!context) throw new Error('useContract must be used within ContractProvider');
  return context;
}
