package dev.architecturelearner.loanservicing.core.model;

import net.jqwik.api.ForAll;
import net.jqwik.api.Label;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.BigRange;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.fail;

@Label("Money properties")
class MoneyPropertiesTest {

    @Property
    @Label("addition is commutative")
    void addition_is_commutative(@ForAll @BigRange(min = "0", max = "1000000") BigDecimal a,
                                 @ForAll @BigRange(min = "0", max = "1000000") BigDecimal b) {
        fail("LEARNER: build Money a and b in one currency, assert a.add(b) equals b.add(a)");
    }

    @Property
    @Label("addition is associative")
    void addition_is_associative(@ForAll @BigRange(min = "0", max = "1000000") BigDecimal a,
                                 @ForAll @BigRange(min = "0", max = "1000000") BigDecimal b,
                                 @ForAll @BigRange(min = "0", max = "1000000") BigDecimal c) {
        fail("LEARNER: assert (a + b) + c equals a + (b + c) — watch how per-operation rounding affects this");
    }

    @Property
    @Label("zero is the identity for addition")
    void zero_is_the_identity_for_addition(@ForAll @BigRange(min = "0", max = "1000000") BigDecimal a) {
        fail("LEARNER: assert a.add(zero) equals a in the same currency");
    }

    @Property
    @Label("subtracting what was added restores the original value")
    void subtracting_what_was_added_restores_the_original_value(@ForAll @BigRange(min = "0", max = "1000000") BigDecimal a,
                                                                @ForAll @BigRange(min = "0", max = "1000000") BigDecimal b) {
        fail("LEARNER: assert a.add(b).subtract(b) equals a");
    }

    @Property
    @Label("amount always has scale two")
    void amount_always_has_scale_two(@ForAll @BigRange(min = "-1000000", max = "1000000") BigDecimal a) {
        fail("LEARNER: construct Money from arbitrary-scale input, assert getAmount().scale() == 2 (ADR-0004)");
    }

    @Property
    @Label("compareTo is consistent with equals")
    void compareTo_is_consistent_with_equals(@ForAll @BigRange(min = "0", max = "1000000") BigDecimal a,
                                             @ForAll @BigRange(min = "0", max = "1000000") BigDecimal b) {
        fail("LEARNER: assert (x.compareTo(y) == 0) == x.equals(y) for same-currency Money");
    }
}
