use anchor_lang::prelude::*;

declare_id!("Hook1111111111111111111111111111111111111");

/// NBPT Token-2022 Transfer Hook
///
/// Enforces compliance at the protocol edge:
///   - KYC attestation verification
///   - Jurisdiction whitelist
///   - Transfer amount limits
///
/// This program is registered as the transfer hook on the NBPT mint.
/// Every transfer of NBPT tokens invokes execute() which validates
/// the transfer against compliance rules before allowing it to proceed.
///
/// Wire this after the distributor devnet cycle passes.

#[program]
pub mod nbpt_transfer_hook {
    use super::*;

    /// Initialize the hook configuration.
    ///
    /// Sets the compliance authority and default transfer limits.
    /// Only callable once by the mint authority.
    pub fn initialize(
        ctx: Context<Initialize>,
        max_transfer_amount: u64,
        require_kyc: bool,
    ) -> Result<()> {
        let config = &mut ctx.accounts.hook_config;
        config.authority = ctx.accounts.authority.key();
        config.mint = ctx.accounts.mint.key();
        config.max_transfer_amount = max_transfer_amount;
        config.require_kyc = require_kyc;
        config.paused = false;
        config.bump = ctx.bumps.hook_config;

        emit!(HookInitialized {
            mint: config.mint,
            authority: config.authority,
            max_transfer_amount,
            require_kyc,
        });

        Ok(())
    }

    /// Add a wallet to the KYC whitelist.
    ///
    /// Stores an attestation record with jurisdiction and expiry.
    pub fn add_kyc_attestation(
        ctx: Context<AddKycAttestation>,
        jurisdiction: String,
        expiry_ts: i64,
    ) -> Result<()> {
        require!(
            jurisdiction.len() <= 3,
            HookError::InvalidJurisdiction
        );

        let clock = Clock::get()?;
        require!(expiry_ts > clock.unix_timestamp, HookError::ExpiredAttestation);

        let attestation = &mut ctx.accounts.attestation;
        attestation.wallet = ctx.accounts.wallet.key();
        attestation.jurisdiction = jurisdiction.clone();
        attestation.attested_at = clock.unix_timestamp;
        attestation.expiry_ts = expiry_ts;
        attestation.active = true;
        attestation.bump = ctx.bumps.attestation;

        emit!(KycAttestationAdded {
            wallet: attestation.wallet,
            jurisdiction,
            expiry_ts,
        });

        Ok(())
    }

    /// Revoke a KYC attestation.
    pub fn revoke_kyc_attestation(ctx: Context<RevokeKycAttestation>) -> Result<()> {
        let attestation = &mut ctx.accounts.attestation;
        attestation.active = false;

        emit!(KycAttestationRevoked {
            wallet: attestation.wallet,
        });

        Ok(())
    }

    /// Add a jurisdiction to the whitelist.
    pub fn add_jurisdiction(
        ctx: Context<ManageJurisdiction>,
        jurisdiction: String,
    ) -> Result<()> {
        require!(
            jurisdiction.len() <= 3,
            HookError::InvalidJurisdiction
        );

        let entry = &mut ctx.accounts.jurisdiction_entry;
        entry.code = jurisdiction.clone();
        entry.allowed = true;
        entry.bump = ctx.bumps.jurisdiction_entry;

        emit!(JurisdictionAdded {
            code: jurisdiction,
        });

        Ok(())
    }

    /// Remove a jurisdiction from the whitelist.
    pub fn remove_jurisdiction(
        ctx: Context<ManageJurisdiction>,
        _jurisdiction: String,
    ) -> Result<()> {
        let entry = &mut ctx.accounts.jurisdiction_entry;
        entry.allowed = false;

        emit!(JurisdictionRemoved {
            code: entry.code.clone(),
        });

        Ok(())
    }

    /// Pause all transfers (emergency).
    pub fn pause(ctx: Context<AdminAction>) -> Result<()> {
        ctx.accounts.hook_config.paused = true;
        Ok(())
    }

    /// Resume transfers.
    pub fn unpause(ctx: Context<AdminAction>) -> Result<()> {
        ctx.accounts.hook_config.paused = false;
        Ok(())
    }

    /// Transfer hook execute — called by Token-2022 on every transfer.
    ///
    /// This is the enforcement point. If this fails, the transfer is rejected.
    ///
    /// Validates:
    ///   1. Hook is not paused
    ///   2. Amount does not exceed max_transfer_amount
    ///   3. Source wallet has valid KYC attestation (if required)
    ///   4. Destination wallet has valid KYC attestation (if required)
    ///   5. Both wallets are in whitelisted jurisdictions
    ///
    /// Note: The actual spl-transfer-hook-interface::execute signature uses
    /// extra_account_metas. This scaffold shows the validation logic;
    /// full wiring requires the ExtraAccountMetaList setup per Token-2022 spec.
    pub fn execute(
        ctx: Context<Execute>,
        amount: u64,
    ) -> Result<()> {
        let config = &ctx.accounts.hook_config;

        // 1. Check pause
        require!(!config.paused, HookError::TransfersPaused);

        // 2. Check amount limit
        if config.max_transfer_amount > 0 {
            require!(
                amount <= config.max_transfer_amount,
                HookError::TransferExceedsLimit
            );
        }

        // 3. Validate source KYC
        if config.require_kyc {
            let source_kyc = &ctx.accounts.source_attestation;
            require!(source_kyc.active, HookError::KycRequired);

            let clock = Clock::get()?;
            require!(
                source_kyc.expiry_ts > clock.unix_timestamp,
                HookError::KycExpired
            );

            // 4. Validate destination KYC
            let dest_kyc = &ctx.accounts.destination_attestation;
            require!(dest_kyc.active, HookError::KycRequired);
            require!(
                dest_kyc.expiry_ts > clock.unix_timestamp,
                HookError::KycExpired
            );

            // 5. Validate jurisdictions
            let source_jurisdiction = &ctx.accounts.source_jurisdiction;
            require!(
                source_jurisdiction.allowed,
                HookError::JurisdictionNotAllowed
            );

            let dest_jurisdiction = &ctx.accounts.destination_jurisdiction;
            require!(
                dest_jurisdiction.allowed,
                HookError::JurisdictionNotAllowed
            );
        }

        emit!(TransferValidated {
            source: ctx.accounts.source_attestation.wallet,
            destination: ctx.accounts.destination_attestation.wallet,
            amount,
        });

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Mint account validated by caller.
    pub mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + HookConfig::INIT_SPACE,
        seeds = [b"hook-config", mint.key().as_ref()],
        bump,
    )]
    pub hook_config: Account<'info, HookConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(jurisdiction: String, expiry_ts: i64)]
pub struct AddKycAttestation<'info> {
    #[account(
        constraint = authority.key() == hook_config.authority @ HookError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub hook_config: Account<'info, HookConfig>,

    /// CHECK: The wallet receiving the KYC attestation.
    pub wallet: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + KycAttestation::INIT_SPACE,
        seeds = [b"kyc", hook_config.key().as_ref(), wallet.key().as_ref()],
        bump,
    )]
    pub attestation: Account<'info, KycAttestation>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeKycAttestation<'info> {
    #[account(
        constraint = authority.key() == hook_config.authority @ HookError::Unauthorized
    )]
    pub authority: Signer<'info>,

    pub hook_config: Account<'info, HookConfig>,

    #[account(mut)]
    pub attestation: Account<'info, KycAttestation>,
}

#[derive(Accounts)]
#[instruction(jurisdiction: String)]
pub struct ManageJurisdiction<'info> {
    #[account(
        constraint = authority.key() == hook_config.authority @ HookError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub hook_config: Account<'info, HookConfig>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + JurisdictionEntry::INIT_SPACE,
        seeds = [b"jurisdiction", hook_config.key().as_ref(), jurisdiction.as_bytes()],
        bump,
    )]
    pub jurisdiction_entry: Account<'info, JurisdictionEntry>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(
        constraint = authority.key() == hook_config.authority @ HookError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub hook_config: Account<'info, HookConfig>,
}

#[derive(Accounts)]
pub struct Execute<'info> {
    #[account(
        seeds = [b"hook-config", hook_config.mint.as_ref()],
        bump = hook_config.bump,
    )]
    pub hook_config: Account<'info, HookConfig>,

    pub source_attestation: Account<'info, KycAttestation>,
    pub destination_attestation: Account<'info, KycAttestation>,
    pub source_jurisdiction: Account<'info, JurisdictionEntry>,
    pub destination_jurisdiction: Account<'info, JurisdictionEntry>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct HookConfig {
    /// Compliance authority (can add/revoke KYC, manage jurisdictions).
    pub authority: Pubkey,
    /// NBPT Token-2022 mint this hook is attached to.
    pub mint: Pubkey,
    /// Maximum transfer amount (0 = unlimited).
    pub max_transfer_amount: u64,
    /// Whether KYC attestation is required for transfers.
    pub require_kyc: bool,
    /// Emergency pause flag.
    pub paused: bool,
    /// PDA bump.
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct KycAttestation {
    /// Wallet this attestation applies to.
    pub wallet: Pubkey,
    /// ISO 3166-1 alpha-2/3 jurisdiction code.
    #[max_len(3)]
    pub jurisdiction: String,
    /// When the attestation was created.
    pub attested_at: i64,
    /// When the attestation expires.
    pub expiry_ts: i64,
    /// Whether the attestation is active.
    pub active: bool,
    /// PDA bump.
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct JurisdictionEntry {
    /// ISO jurisdiction code.
    #[max_len(3)]
    pub code: String,
    /// Whether this jurisdiction is allowed.
    pub allowed: bool,
    /// PDA bump.
    pub bump: u8,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct HookInitialized {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub max_transfer_amount: u64,
    pub require_kyc: bool,
}

#[event]
pub struct KycAttestationAdded {
    pub wallet: Pubkey,
    pub jurisdiction: String,
    pub expiry_ts: i64,
}

#[event]
pub struct KycAttestationRevoked {
    pub wallet: Pubkey,
}

#[event]
pub struct JurisdictionAdded {
    pub code: String,
}

#[event]
pub struct JurisdictionRemoved {
    pub code: String,
}

#[event]
pub struct TransferValidated {
    pub source: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum HookError {
    #[msg("Unauthorized: only the compliance authority can perform this action")]
    Unauthorized,
    #[msg("Transfers are paused")]
    TransfersPaused,
    #[msg("Transfer amount exceeds the configured limit")]
    TransferExceedsLimit,
    #[msg("KYC attestation required for this transfer")]
    KycRequired,
    #[msg("KYC attestation has expired")]
    KycExpired,
    #[msg("Jurisdiction not allowed for transfers")]
    JurisdictionNotAllowed,
    #[msg("Invalid jurisdiction code (max 3 characters)")]
    InvalidJurisdiction,
    #[msg("Attestation has already expired")]
    ExpiredAttestation,
}
