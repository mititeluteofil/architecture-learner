package dev.architecturelearner.loanservicing.core.model;

/**
 * Lifecycle states for a loan in the Java 8 baseline model.
 */
public enum LoanStatus {
    DRAFT,
    ACTIVE,
    DELINQUENT,
    PAID_IN_FULL,
    CLOSED
}

