package dev.architecturelearner.loanservicing.core.model;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Currency;
import java.util.Objects;

/**
 * BigDecimal-backed monetary value for the domain core.
 */
public final class Money implements Comparable<Money> {

    private static final int SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_EVEN;

    private final BigDecimal amount;
    private final Currency currency;

    public Money(BigDecimal amount, Currency currency) {
        this.amount = Objects.requireNonNull(amount, "amount").setScale(SCALE, ROUNDING_MODE);
        this.currency = Objects.requireNonNull(currency, "currency");
        // TODO LEARNER: decide which additional invariants belong here (negative values, scale policy, supported currencies).
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public Currency getCurrency() {
        return currency;
    }

    public Money add(Money other) {
        validateCurrencyMatches(other);
        // TODO LEARNER: confirm whether mismatched currencies should throw, return Optional, or use another domain result type.
        return new Money(amount.add(other.amount), currency);
    }

    public Money subtract(Money other) {
        validateCurrencyMatches(other);
        // TODO LEARNER: decide whether subtracting below zero is always invalid or sometimes part of a transition workflow.
        return new Money(amount.subtract(other.amount), currency);
    }

    public boolean isNegative() {
        return amount.signum() < 0;
    }

    public boolean isZero() {
        return amount.signum() == 0;
    }

    @Override
    public int compareTo(Money other) {
        validateCurrencyMatches(other);
        return amount.compareTo(other.amount);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Money)) {
            return false;
        }
        Money money = (Money) other;
        return amount.equals(money.amount) && currency.equals(money.currency);
    }

    @Override
    public int hashCode() {
        return Objects.hash(amount, currency);
    }

    @Override
    public String toString() {
        return currency.getCurrencyCode() + " " + amount;
    }

    private void validateCurrencyMatches(Money other) {
        Objects.requireNonNull(other, "other");
        if (!currency.equals(other.currency)) {
            throw new IllegalArgumentException("LEARNER: decide how the domain should handle currency mismatch");
        }
    }
}

