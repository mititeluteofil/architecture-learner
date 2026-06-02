package dev.architecturelearner.loanservicing.core.model;

import java.time.LocalDate;
import java.util.Objects;

/**
 * Aggregate root for a loan in the Java 8 baseline project.
 */
public final class Loan {

    private final LoanId id;
    private final Money principal;
    private final Money outstandingBalance;
    private final LoanStatus status;
    private final LocalDate startDate;

    public Loan(LoanId id,
                Money principal,
                Money outstandingBalance,
                LoanStatus status,
                LocalDate startDate) {
        this.id = Objects.requireNonNull(id, "id");
        this.principal = Objects.requireNonNull(principal, "principal");
        this.outstandingBalance = Objects.requireNonNull(outstandingBalance, "outstandingBalance");
        this.status = Objects.requireNonNull(status, "status");
        this.startDate = Objects.requireNonNull(startDate, "startDate");
        // TODO LEARNER: define construction invariants for principal, outstanding balance, allowed initial status, and date semantics.
    }

    public LoanId getId() {
        return id;
    }

    public Money getPrincipal() {
        return principal;
    }

    public Money getOutstandingBalance() {
        return outstandingBalance;
    }

    public LoanStatus getStatus() {
        return status;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public Loan activate(LocalDate activatedOn) {
        throw new UnsupportedOperationException("LEARNER: implement status transition rules for activating a draft loan");
    }

    public Loan applyPayment(Money paymentAmount, LocalDate receivedOn) {
        throw new UnsupportedOperationException("LEARNER: implement payment invariants, balance update rules, and terminal status handling");
    }

    public Loan markDelinquent(LocalDate delinquentOn) {
        throw new UnsupportedOperationException("LEARNER: implement when a loan may transition into delinquent status");
    }

    public Loan close(LocalDate closedOn) {
        throw new UnsupportedOperationException("LEARNER: implement when closing is allowed and what must be true of the balance");
    }
}

