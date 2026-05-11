use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

declare_id!("Dist1111111111111111111111111111111111111");

/// Maximum depth for Merkle proof verification.
/// 20 levels supports up to 1,048,576 claimants.
const MAX_PROOF_LEN: usize = 20;

/// Maximum number of claimants tracked in the bitmap (1M).
const MAX_NUM_NODES: u64 = 1_048_576;

#[program]
pub mod noble_distributor {
    use super::*;

    /// Initialize a new distribution epoch.
    ///
    /// Authority posts the Merkle root, total amount, and claim window.
    /// The distributor PDA is derived from ["distributor", mint].
    pub fn initialize_distributor(
        ctx: Context<InitializeDistributor>,
        merkle_root: [u8; 32],
        total_amount: u64,
        start_ts: i64,
        end_ts: i64,
    ) -> Result<()> {
        require!(end_ts > start_ts, DistributorError::InvalidTimeWindow);
        require!(total_amount > 0, DistributorError::InvalidAmount);

        let distributor = &mut ctx.accounts.distributor;
        distributor.authority = ctx.accounts.authority.key();
        distributor.mint = ctx.accounts.mint.key();
        distributor.merkle_root = merkle_root;
        distributor.total_amount = total_amount;
        distributor.claimed_amount = 0;
        distributor.claims_count = 0;
        distributor.start_ts = start_ts;
        distributor.end_ts = end_ts;
        distributor.bump = ctx.bumps.distributor;

        emit!(DistributorInitialized {
            distributor: distributor.key(),
            authority: distributor.authority,
            mint: distributor.mint,
            merkle_root,
            total_amount,
            start_ts,
            end_ts,
        });

        Ok(())
    }

    /// Claim tokens from the distribution.
    ///
    /// Claimant provides their leaf index, amount, and Merkle proof.
    /// A ClaimReceipt PDA is created to prevent double claims.
    /// Tokens are transferred from the vault ATA to the claimant ATA.
    pub fn claim(
        ctx: Context<Claim>,
        index: u64,
        amount: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        let distributor = &ctx.accounts.distributor;

        // Enforce claim window
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= distributor.start_ts,
            DistributorError::ClaimNotStarted
        );
        require!(
            clock.unix_timestamp <= distributor.end_ts,
            DistributorError::ClaimExpired
        );

        // Enforce proof length
        require!(
            proof.len() <= MAX_PROOF_LEN,
            DistributorError::ProofTooLong
        );
        require!(index < MAX_NUM_NODES, DistributorError::IndexOutOfRange);

        // Verify Merkle proof
        let leaf = anchor_lang::solana_program::keccak::hashv(&[
            &index.to_le_bytes(),
            &ctx.accounts.claimant.key().to_bytes(),
            &amount.to_le_bytes(),
        ]);

        let mut computed_hash = leaf.0;
        for node in proof.iter() {
            if computed_hash <= *node {
                computed_hash = anchor_lang::solana_program::keccak::hashv(&[
                    &computed_hash,
                    node,
                ])
                .0;
            } else {
                computed_hash = anchor_lang::solana_program::keccak::hashv(&[
                    node,
                    &computed_hash,
                ])
                .0;
            }
        }

        require!(
            computed_hash == distributor.merkle_root,
            DistributorError::InvalidProof
        );

        // Transfer tokens from vault to claimant
        let mint_key = distributor.mint;
        let seeds: &[&[u8]] = &[
            b"distributor",
            mint_key.as_ref(),
            &[distributor.bump],
        ];
        let signer_seeds = &[seeds];

        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.claimant_token_account.to_account_info(),
                    authority: ctx.accounts.distributor.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        // Update distributor state
        let distributor = &mut ctx.accounts.distributor;
        distributor.claimed_amount = distributor
            .claimed_amount
            .checked_add(amount)
            .ok_or(DistributorError::Overflow)?;
        distributor.claims_count = distributor
            .claims_count
            .checked_add(1)
            .ok_or(DistributorError::Overflow)?;

        // Initialize receipt (double-claim prevention)
        let receipt = &mut ctx.accounts.claim_receipt;
        receipt.distributor = distributor.key();
        receipt.claimant = ctx.accounts.claimant.key();
        receipt.index = index;
        receipt.amount = amount;
        receipt.claimed_at = clock.unix_timestamp;

        emit!(ClaimProcessed {
            distributor: distributor.key(),
            claimant: ctx.accounts.claimant.key(),
            index,
            amount,
            claim_receipt: ctx.accounts.claim_receipt.key(),
        });

        Ok(())
    }

    /// Close the distributor after the claim window expires.
    ///
    /// Returns unclaimed tokens to the authority's token account.
    /// Only callable by the original authority after end_ts.
    pub fn close_distributor(ctx: Context<CloseDistributor>) -> Result<()> {
        let distributor = &ctx.accounts.distributor;
        let clock = Clock::get()?;

        require!(
            clock.unix_timestamp > distributor.end_ts,
            DistributorError::ClaimWindowActive
        );

        // Transfer remaining tokens back to authority
        let vault_balance = ctx.accounts.vault.amount;
        if vault_balance > 0 {
            let mint_key = distributor.mint;
            let seeds: &[&[u8]] = &[
                b"distributor",
                mint_key.as_ref(),
                &[distributor.bump],
            ];
            let signer_seeds = &[seeds];

            transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    TransferChecked {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.authority_token_account.to_account_info(),
                        authority: ctx.accounts.distributor.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                    },
                    signer_seeds,
                ),
                vault_balance,
                ctx.accounts.mint.decimals,
            )?;
        }

        emit!(DistributorClosed {
            distributor: distributor.key(),
            unclaimed_amount: vault_balance,
            total_claimed: distributor.claimed_amount,
            claims_count: distributor.claims_count,
        });

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeDistributor<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = 8 + Distributor::INIT_SPACE,
        seeds = [b"distributor", mint.key().as_ref()],
        bump,
    )]
    pub distributor: Account<'info, Distributor>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(index: u64, amount: u64)]
pub struct Claim<'info> {
    #[account(mut)]
    pub claimant: Signer<'info>,

    #[account(
        mut,
        seeds = [b"distributor", distributor.mint.as_ref()],
        bump = distributor.bump,
    )]
    pub distributor: Account<'info, Distributor>,

    pub mint: InterfaceAccount<'info, Mint>,

    /// Vault ATA owned by the distributor PDA.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = distributor,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// Claimant's ATA — initialized if needed via associated_token::create.
    #[account(
        init_if_needed,
        payer = claimant,
        associated_token::mint = mint,
        associated_token::authority = claimant,
        associated_token::token_program = token_program,
    )]
    pub claimant_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Receipt PDA — if it already exists, the init will fail → double-claim blocked.
    #[account(
        init,
        payer = claimant,
        space = 8 + ClaimReceipt::INIT_SPACE,
        seeds = [
            b"receipt",
            distributor.key().as_ref(),
            &index.to_le_bytes(),
        ],
        bump,
    )]
    pub claim_receipt: Account<'info, ClaimReceipt>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseDistributor<'info> {
    #[account(
        mut,
        constraint = authority.key() == distributor.authority @ DistributorError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"distributor", distributor.mint.as_ref()],
        bump = distributor.bump,
        close = authority,
    )]
    pub distributor: Account<'info, Distributor>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = distributor,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = authority,
        associated_token::token_program = token_program,
    )]
    pub authority_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct Distributor {
    /// Authority that created this distribution (treasury multisig).
    pub authority: Pubkey,
    /// NBPT Token-2022 mint.
    pub mint: Pubkey,
    /// Merkle root of the distribution tree.
    pub merkle_root: [u8; 32],
    /// Total tokens allocated for this distribution epoch.
    pub total_amount: u64,
    /// Running total of claimed tokens.
    pub claimed_amount: u64,
    /// Number of successful claims.
    pub claims_count: u64,
    /// Unix timestamp — claims open.
    pub start_ts: i64,
    /// Unix timestamp — claims close.
    pub end_ts: i64,
    /// PDA bump seed.
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ClaimReceipt {
    /// Parent distributor.
    pub distributor: Pubkey,
    /// Wallet that claimed.
    pub claimant: Pubkey,
    /// Leaf index in the Merkle tree.
    pub index: u64,
    /// Amount claimed.
    pub amount: u64,
    /// Unix timestamp of claim.
    pub claimed_at: i64,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct DistributorInitialized {
    pub distributor: Pubkey,
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub merkle_root: [u8; 32],
    pub total_amount: u64,
    pub start_ts: i64,
    pub end_ts: i64,
}

#[event]
pub struct ClaimProcessed {
    pub distributor: Pubkey,
    pub claimant: Pubkey,
    pub index: u64,
    pub amount: u64,
    pub claim_receipt: Pubkey,
}

#[event]
pub struct DistributorClosed {
    pub distributor: Pubkey,
    pub unclaimed_amount: u64,
    pub total_claimed: u64,
    pub claims_count: u64,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum DistributorError {
    #[msg("Invalid time window: end must be after start")]
    InvalidTimeWindow,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Claim window has not started")]
    ClaimNotStarted,
    #[msg("Claim window has expired")]
    ClaimExpired,
    #[msg("Merkle proof exceeds maximum depth")]
    ProofTooLong,
    #[msg("Leaf index out of range")]
    IndexOutOfRange,
    #[msg("Invalid Merkle proof")]
    InvalidProof,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Claim window is still active")]
    ClaimWindowActive,
    #[msg("Unauthorized: only the authority can perform this action")]
    Unauthorized,
}
