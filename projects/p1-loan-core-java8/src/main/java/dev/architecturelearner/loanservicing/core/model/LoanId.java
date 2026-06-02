package dev.architecturelearner.loanservicing.core.model;
import com.fasterxml.uuid.Generators;

import java.util.Objects;
import java.util.UUID;

/**
 * Value object wrapper for loan identity.
 */
public final class LoanId {

    private final UUID value;

    public LoanId(UUID value) {
        this.value = Objects.requireNonNull(value, "value");
    }

    public static LoanId random() {
        return new LoanId(Generators.timeBasedEpochGenerator().generate());
    }

    public UUID getValue() {
        return value;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof LoanId)) {
            return false;
        }
        LoanId loanId = (LoanId) other;
        return value.equals(loanId.value);
    }

    @Override
    public int hashCode() {
        return value.hashCode();
    }

    @Override
    public String toString() {
        return value.toString();
    }
}

